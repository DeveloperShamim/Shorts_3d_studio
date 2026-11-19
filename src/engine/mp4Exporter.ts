/**
 * GPU-Accelerated Deterministic In-Browser MP4 Exporter (WebCodecs H.264 + AAC + mp4-muxer).
 *
 * - Works identically across every registered episode (reads duration, frames, audioUrl, slug from engine.episode.meta).
 * - Renders every single frame deterministically via engine.renderAt(i / fps) using the GPU (WebGL2 high-performance).
 * - Encodes H.264 video frames using the browser's hardware GPU encoder (NVENC / AMF / QuickSync / VideoToolbox)
 *   via WebCodecs VideoEncoder (`hardwareAcceleration: 'prefer-hardware'`), falling back safely if a GPU
 *   driver rejects vertical 4K dimensions.
 * - Decodes and resamples the master audio track to 48 kHz stereo and encodes AAC (or Opus fallback) via AudioEncoder.
 * - Muxes video + audio into a standard +faststart `.mp4` Blob directly in the browser.
 */

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { EXPORT_RESOLUTIONS, FPS, ResolutionKey } from './episodeTypes';
import { MoneySecretsShortEngine } from './shortEngine';

export interface GpuExportCapabilities {
  webglRenderer: string;
  isHardwareWebGL: boolean;
  webCodecsSupported: boolean;
  hardwareH264ByRes: Record<ResolutionKey, boolean>;
  softwareH264ByRes: Record<ResolutionKey, boolean>;
  audioCodec: 'aac' | 'opus' | null;
}

export interface Mp4ExportProgress {
  phase: 'preparing' | 'audio' | 'video' | 'finalizing';
  frame: number;
  totalFrames: number;
  percent: number;
  fps: number;
  etaSeconds: number;
  encoderLabel: string;
}

export interface Mp4ExportResult {
  blob: Blob;
  filename: string;
  sizeBytes: number;
  encoderLabel: string;
  elapsedSeconds: number;
}

interface ProbedVideoConfig {
  config: VideoEncoderConfig;
  usingHardware: boolean;
  codecLabel: string;
}

interface ProbedAudioConfig {
  config: AudioEncoderConfig;
  muxerCodec: 'aac' | 'opus';
  label: string;
}

function cleanGpuName(raw: string): string {
  const angleMatch = raw.match(/ANGLE\s*\(([^,]+),\s*([^,]+?)(?:\s*\(0x[0-9a-fA-F]+\))?(?:,\s*[^)]+)?\)/i);
  if (angleMatch) {
    const adapter = angleMatch[2].trim();
    if (adapter && !/^Direct3D/i.test(adapter)) {
      return adapter;
    }
    return angleMatch[1].trim();
  }
  return raw.trim();
}

export function getWebGLGpuInfo(engine: MoneySecretsShortEngine): { name: string; isHardware: boolean } {
  try {
    const gl = engine.three.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const raw = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    return {
      name: cleanGpuName(raw || 'WebGL2 GPU'),
      isHardware: !engine.three.isSoftwareGl,
    };
  } catch {
    return {
      name: engine.three.isSoftwareGl ? 'Software WebGL' : 'Hardware GPU',
      isHardware: !engine.three.isSoftwareGl,
    };
  }
}

function getH264CodecCandidates(width: number, height: number): string[] {
  const pixels = width * height;
  if (pixels > 4_000_000) {
    return [
      'avc1.640034', // High @ L5.2
      'avc1.640033', // High @ L5.1
      'avc1.4d0034', // Main @ L5.2
      'avc1.4d0033', // Main @ L5.1
      'avc1.420033', // Baseline @ L5.1
    ];
  }
  if (pixels > 2_200_000) {
    return [
      'avc1.640032', // High @ L5.0
      'avc1.640033', // High @ L5.1
      'avc1.640034', // High @ L5.2
      'avc1.4d0032', // Main @ L5.0
      'avc1.4d0033', // Main @ L5.1
      'avc1.420032', // Baseline @ L5.0
    ];
  }
  return [
    'avc1.64002a', // High @ L4.2
    'avc1.640028', // High @ L4.0
    'avc1.640033', // High @ L5.1
    'avc1.4d002a', // Main @ L4.2
    'avc1.4d0028', // Main @ L4.0
    'avc1.42002a', // Baseline @ L4.2
  ];
}

async function probeVideoConfig(
  resKey: ResolutionKey,
  preferHardware: boolean,
  fps = FPS,
): Promise<ProbedVideoConfig | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoEncoder.isConfigSupported !== 'function') {
    return null;
  }

  const preset = EXPORT_RESOLUTIONS[resKey];
  const codecs = getH264CodecCandidates(preset.width, preset.height);
  const bitrate = preset.bitrateBps;

  const accelModes: HardwareAcceleration[] = preferHardware
    ? ['prefer-hardware', 'no-preference', 'prefer-software']
    : ['no-preference', 'prefer-software'];

  for (const accel of accelModes) {
    // Windows MediaFoundation (AMD VCN / NVENC / QSV) reliably engages hardware H.264 on 'realtime'
    const latencyModes: (LatencyMode | undefined)[] =
      accel === 'prefer-hardware' ? ['realtime', 'quality', undefined] : [undefined];
    const bitrateModes: (VideoEncoderBitrateMode | undefined)[] =
      accel === 'prefer-hardware' ? ['variable', 'constant', undefined] : ['variable', undefined];

    for (const latencyMode of latencyModes) {
      for (const codec of codecs) {
        for (const bitrateMode of bitrateModes) {
          const candidate: VideoEncoderConfig = {
            codec,
            width: preset.width,
            height: preset.height,
            bitrate,
            framerate: fps,
            hardwareAcceleration: accel,
            avc: { format: 'avc' },
            ...(bitrateMode ? { bitrateMode } : {}),
            ...(latencyMode ? { latencyMode } : {}),
          };
          try {
            const support = await VideoEncoder.isConfigSupported(candidate);
            if (support.supported && support.config) {
              const usingHardware = accel === 'prefer-hardware';
              const profileName = codec.startsWith('avc1.64')
                ? 'H.264 High'
                : codec.startsWith('avc1.4d')
                  ? 'H.264 Main'
                  : 'H.264 Baseline';
              return {
                config: support.config,
                usingHardware,
                codecLabel: `${usingHardware ? 'GPU' : 'Auto'} ${profileName}`,
              };
            }
          } catch {
            // Try next codec / profile combination
          }
        }
      }
    }
  }

  return null;
}

async function probeAudioConfig(): Promise<ProbedAudioConfig | null> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioEncoder.isConfigSupported !== 'function') {
    return null;
  }

  for (const bitrate of [320_000, 256_000, 192_000, 128_000]) {
    const cfg: AudioEncoderConfig = {
      codec: 'mp4a.40.2',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate,
    };
    try {
      const res = await AudioEncoder.isConfigSupported(cfg);
      if (res.supported && res.config) {
        return {
          config: res.config,
          muxerCodec: 'aac',
          label: `AAC ${Math.round(bitrate / 1000)} kbps`,
        };
      }
    } catch {
      // Try next bitrate
    }
  }

  const opusCfg: AudioEncoderConfig = {
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 192_000,
  };
  try {
    const res = await AudioEncoder.isConfigSupported(opusCfg);
    if (res.supported && res.config) {
      return {
        config: res.config,
        muxerCodec: 'opus',
        label: 'Opus 192 kbps',
      };
    }
  } catch {
    // No WebCodecs audio encoder
  }

  return null;
}

export async function inspectGpuCapabilities(
  engine: MoneySecretsShortEngine,
): Promise<GpuExportCapabilities> {
  const gpu = getWebGLGpuInfo(engine);
  const fps = engine.episode.meta.fps;
  const webCodecsSupported =
    typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

  const hardwareH264ByRes: Record<ResolutionKey, boolean> = {
    '1080p': false,
    '2k': false,
    '4k': false,
  };
  const softwareH264ByRes: Record<ResolutionKey, boolean> = {
    '1080p': false,
    '2k': false,
    '4k': false,
  };

  let audioCodec: 'aac' | 'opus' | null = null;

  if (webCodecsSupported) {
    const [r1080, r2k, r4k, audio] = await Promise.all([
      probeVideoConfig('1080p', true, fps),
      probeVideoConfig('2k', true, fps),
      probeVideoConfig('4k', true, fps),
      probeAudioConfig(),
    ]);

    const applyRes = (key: ResolutionKey, probed: ProbedVideoConfig | null) => {
      if (!probed) return;
      if (probed.usingHardware) {
        hardwareH264ByRes[key] = true;
      } else {
        softwareH264ByRes[key] = true;
      }
    };
    applyRes('1080p', r1080);
    applyRes('2k', r2k);
    applyRes('4k', r4k);
    audioCodec = audio?.muxerCodec ?? null;
  }

  return {
    webglRenderer: gpu.name,
    isHardwareWebGL: gpu.isHardware,
    webCodecsSupported,
    hardwareH264ByRes,
    softwareH264ByRes,
    audioCodec,
  };
}

/** Decode and resample the episode's master audio track to exact 48 kHz stereo matching duration */
async function decodeMasterAudio48k(audioUrl: string, durationSec: number): Promise<AudioBuffer> {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch master audio (${response.status}).`);
  }
  const arrayBuf = await response.arrayBuffer();
  const sampleRate = 48000;
  const totalSamples = Math.ceil(durationSec * sampleRate);

  const decodeCtx = new AudioContext({ sampleRate });
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuf);
  } finally {
    await decodeCtx.close().catch(() => {});
  }

  const offline = new OfflineAudioContext(2, totalSamples, sampleRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  return offline.startRendering();
}

function waitForEncoderSlot(encoder: VideoEncoder, maxQueueSize: number): Promise<void> {
  if (encoder.encodeQueueSize < maxQueueSize) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      encoder.removeEventListener('dequeue', onDequeue);
      window.clearTimeout(timer);
      resolve();
    };
    const onDequeue = () => {
      if (encoder.encodeQueueSize < maxQueueSize) {
        done();
      }
    };
    encoder.addEventListener('dequeue', onDequeue);
    const timer = window.setTimeout(done, 25);
  });
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function runWebCodecsMp4Pass(params: {
  engine: MoneySecretsShortEngine;
  canvas: HTMLCanvasElement;
  resKey: ResolutionKey;
  showSubtitles: boolean;
  probedVideo: ProbedVideoConfig;
  probedAudio: ProbedAudioConfig | null;
  masterAudio: AudioBuffer | null;
  signal: AbortSignal;
  onProgress: (p: Mp4ExportProgress) => void;
}): Promise<Mp4ExportResult> {
  const {
    engine,
    canvas,
    resKey,
    showSubtitles,
    probedVideo,
    probedAudio,
    masterAudio,
    signal,
    onProgress,
  } = params;

  const meta = engine.episode.meta;
  const fps = meta.fps;
  const totalFrames = meta.totalFrames;
  const preset = EXPORT_RESOLUTIONS[resKey];
  const startWall = performance.now();
  const encoderLabel = probedAudio
    ? `${probedVideo.codecLabel} + ${probedAudio.label}`
    : `${probedVideo.codecLabel} (Video Only)`;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: preset.width,
      height: preset.height,
      frameRate: fps,
    },
    ...(probedAudio
      ? {
          audio: {
            codec: probedAudio.muxerCodec,
            numberOfChannels: 2,
            sampleRate: 48000,
          },
        }
      : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let videoFatalError: Error | null = null;
  let audioFatalError: Error | null = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, chunkMeta) => {
      muxer.addVideoChunk(chunk, chunkMeta);
    },
    error: (err) => {
      videoFatalError = err instanceof Error ? err : new Error(String(err));
    },
  });

  videoEncoder.configure(probedVideo.config);

  let audioEncoder: AudioEncoder | null = null;
  if (probedAudio && masterAudio) {
    audioEncoder = new AudioEncoder({
      output: (chunk, chunkMeta) => {
        muxer.addAudioChunk(chunk, chunkMeta);
      },
      error: (err) => {
        audioFatalError = err instanceof Error ? err : new Error(String(err));
      },
    });
    audioEncoder.configure(probedAudio.config);
  }

  try {
    // Step 1: Encode the full 48kHz stereo master audio track
    if (audioEncoder && masterAudio && typeof AudioData !== 'undefined') {
      onProgress({
        phase: 'audio',
        frame: 0,
        totalFrames,
        percent: 1,
        fps: 0,
        etaSeconds: 0,
        encoderLabel,
      });

      const left = masterAudio.getChannelData(0);
      const right = masterAudio.numberOfChannels > 1 ? masterAudio.getChannelData(1) : left;
      const totalSamples = masterAudio.length;
      const chunkSamples = 4800; // 100ms chunks

      for (let offset = 0; offset < totalSamples; offset += chunkSamples) {
        if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
        if (audioFatalError) throw audioFatalError;

        const len = Math.min(chunkSamples, totalSamples - offset);
        const planar = new Float32Array(len * 2);
        planar.set(left.subarray(offset, offset + len), 0);
        planar.set(right.subarray(offset, offset + len), len);

        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate: 48000,
          numberOfFrames: len,
          numberOfChannels: 2,
          timestamp: Math.round((offset / 48000) * 1_000_000),
          data: planar,
        });

        audioEncoder.encode(audioData);
        audioData.close();

        if (audioEncoder.encodeQueueSize > 10) {
          await yieldToUi();
        }
      }
    }

    // Step 2: Deterministic frame-by-frame GPU render & H.264 encode
    const frameDurationUs = Math.round((1 / fps) * 1_000_000);
    const videoStartWall = performance.now();

    for (let i = 0; i < totalFrames; i++) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      if (videoFatalError) throw videoFatalError;
      if (audioFatalError) throw audioFatalError;

      if (videoEncoder.encodeQueueSize >= 8) {
        await waitForEncoderSlot(videoEncoder, 8);
      }

      const t = i / fps;
      engine.renderAt(t);

      const timestampUs = Math.round(t * 1_000_000);
      const frame = new VideoFrame(canvas, {
        timestamp: timestampUs,
        duration: frameDurationUs,
      });

      try {
        videoEncoder.encode(frame, { keyFrame: i % 15 === 0 });
      } finally {
        frame.close();
      }

      if (i % 10 === 0 || i === totalFrames - 1) {
        const elapsedSec = Math.max(0.05, (performance.now() - videoStartWall) / 1000);
        const doneFrames = i + 1;
        const speedFps = doneFrames / elapsedSec;
        const etaSeconds = Math.max(0, (totalFrames - doneFrames) / Math.max(0.1, speedFps));
        onProgress({
          phase: 'video',
          frame: doneFrames,
          totalFrames,
          percent: 2 + (doneFrames / totalFrames) * 95,
          fps: speedFps,
          etaSeconds,
          encoderLabel,
        });
        await yieldToUi();
      }
    }

    // Step 3: Flush hardware encoder pipeline and finalize +faststart MP4 container
    onProgress({
      phase: 'finalizing',
      frame: totalFrames,
      totalFrames,
      percent: 98,
      fps: 0,
      etaSeconds: 0,
      encoderLabel,
    });

    await videoEncoder.flush();
    if (videoFatalError) throw videoFatalError;

    if (audioEncoder) {
      await audioEncoder.flush();
      if (audioFatalError) throw audioFatalError;
    }

    muxer.finalize();

    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    const subTag = showSubtitles ? 'subs' : 'nosubs';
    const filename = `${meta.slug}_SHORT_${preset.key}_${subTag}.mp4`;

    onProgress({
      phase: 'finalizing',
      frame: totalFrames,
      totalFrames,
      percent: 100,
      fps: 0,
      etaSeconds: 0,
      encoderLabel,
    });

    return {
      blob,
      filename,
      sizeBytes: blob.size,
      encoderLabel,
      elapsedSeconds: (performance.now() - startWall) / 1000,
    };
  } finally {
    try {
      if (videoEncoder.state !== 'closed') videoEncoder.close();
    } catch {
      // ignore close errors
    }
    try {
      if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
    } catch {
      // ignore close errors
    }
  }
}

/**
 * Exports the active episode as a standard H.264 + AAC MP4 directly in the browser,
 * prioritizing hardware GPU rendering (WebGL2) and hardware GPU encoding (WebCodecs).
 */
export async function exportMp4InBrowser(options: {
  engine: MoneySecretsShortEngine;
  canvas: HTMLCanvasElement;
  resKey: ResolutionKey;
  showSubtitles: boolean;
  preferGpuEncoding: boolean;
  signal: AbortSignal;
  onProgress: (p: Mp4ExportProgress) => void;
}): Promise<Mp4ExportResult> {
  const { engine, canvas, resKey, showSubtitles, preferGpuEncoding, signal, onProgress } = options;
  const meta = engine.episode.meta;

  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Error(
      'WebCodecs MP4 encoding requires a modern Chromium/Edge/Safari/Firefox browser. Update your browser or use the local render.js command below.',
    );
  }

  onProgress({
    phase: 'preparing',
    frame: 0,
    totalFrames: meta.totalFrames,
    percent: 0,
    fps: 0,
    etaSeconds: 0,
    encoderLabel: 'Probing GPU H.264 encoder...',
  });

  const [probedVideo, probedAudio, masterAudio] = await Promise.all([
    probeVideoConfig(resKey, preferGpuEncoding, meta.fps),
    probeAudioConfig(),
    decodeMasterAudio48k(meta.audioUrl, meta.duration).catch(() => null),
  ]);

  if (signal.aborted) {
    throw new DOMException('Export cancelled', 'AbortError');
  }

  if (!probedVideo) {
    throw new Error(
      `Your browser does not support H.264 MP4 encoding at ${EXPORT_RESOLUTIONS[resKey].shortLabel}. Try 1080p or use the local render.js MP4 command below.`,
    );
  }

  try {
    return await runWebCodecsMp4Pass({
      engine,
      canvas,
      resKey,
      showSubtitles,
      probedVideo,
      probedAudio,
      masterAudio,
      signal,
      onProgress,
    });
  } catch (err) {
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw err;
    }

    if (probedVideo.usingHardware) {
      const fallbackVideo = await probeVideoConfig(resKey, false, meta.fps);
      if (fallbackVideo && !signal.aborted) {
        onProgress({
          phase: 'preparing',
          frame: 0,
          totalFrames: meta.totalFrames,
          percent: 0,
          fps: 0,
          etaSeconds: 0,
          encoderLabel: 'Retrying with Auto H.264 encoder...',
        });
        return runWebCodecsMp4Pass({
          engine,
          canvas,
          resKey,
          showSubtitles,
          probedVideo: fallbackVideo,
          probedAudio,
          masterAudio,
          signal,
          onProgress,
        });
      }
    }

    throw err;
  }
}
