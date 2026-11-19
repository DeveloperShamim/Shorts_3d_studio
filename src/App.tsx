/**
 * Voice of Times — Multi-Episode YouTube Shorts Studio & Headless Render Host.
 *
 * URL Modes:
 *   ?render=1&ep=ms02[&res=1080p|2k|4k][&subtitles=0|1|&nosubs=1] -> Bare target-resolution canvas for render.js
 *   ?play[&ep=ms02]                                                -> Clean live audio-synced playback preview
 *   default[?ep=ms02]                                              -> Full multi-episode studio with Episode Library & GPU MP4 Export
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Cpu,
  Download,
  Film,
  FolderOpen,
  Grid,
  Image as ImageIcon,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Search,
  Shield,
  Subtitles,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import CharacterGalleryModal from './components/CharacterGalleryModal';
import {
  EXPORT_RESOLUTIONS,
  HEIGHT,
  ResolutionKey,
  WIDTH,
  getShotAtForMeta,
  parseResolutionKey,
} from './engine/episodeTypes';
import {
  GpuExportCapabilities,
  Mp4ExportProgress,
  exportMp4InBrowser,
  inspectGpuCapabilities,
} from './engine/mp4Exporter';
import { MoneySecretsShortEngine } from './engine/shortEngine';
import { EPISODES, getEpisodeById, getSeriesList } from './episodes/registry';

interface QcStill {
  time: number;
  shotLabel: string;
  dataUrl: string;
}

function formatTime(sec: number, maxDur: number): string {
  const clamped = Math.max(0, Math.min(maxDur, sec));
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.floor((clamped % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export default function App() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const isRenderMode = searchParams.has('render');
  const isPlayUrlMode = searchParams.has('play');
  const initialRes = useMemo(() => parseResolutionKey(searchParams.get('res')), [searchParams]);
  const initialSubs = useMemo(
    () => !(searchParams.has('nosubs') || searchParams.get('subtitles') === '0' || searchParams.get('subtitles') === 'false'),
    [searchParams],
  );
  const initialEpisode = useMemo(() => getEpisodeById(searchParams.get('ep')), [searchParams]);

  const [activeEpisodeId, setActiveEpisodeId] = useState<string>(initialEpisode.meta.id);
  const activeEpisode = useMemo(() => getEpisodeById(activeEpisodeId), [activeEpisodeId]);
  const meta = activeEpisode.meta;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MoneySecretsShortEngine | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(initialSubs);
  const [exportRes, setExportRes] = useState<ResolutionKey>(initialRes);
  const [dockOpen, setDockOpen] = useState(true);
  const [customSpriteCount, setCustomSpriteCount] = useState(0);
  const [loadedGlbKeys, setLoadedGlbKeys] = useState<string[]>([]);
  const [spriteVersion, setSpriteVersion] = useState(0);

  // Modals
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [charactersOpen, setCharactersOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [librarySeriesFilter, setLibrarySeriesFilter] = useState<string>('ALL');
  const [qcOpen, setQcOpen] = useState(false);
  const [qcStills, setQcStills] = useState<QcStill[]>([]);
  const [qcGenerating, setQcGenerating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // In-browser GPU MP4 export state
  const [isExportingMp4, setIsExportingMp4] = useState(false);
  const [mp4Progress, setMp4Progress] = useState<Mp4ExportProgress | null>(null);
  const [mp4Error, setMp4Error] = useState<string | null>(null);
  const [mp4DoneInfo, setMp4DoneInfo] = useState<string | null>(null);
  const [gpuCaps, setGpuCaps] = useState<GpuExportCapabilities | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  const playingRef = useRef(false);
  const timeRef = useRef(0);
  const loopTimerRef = useRef<number>(0);
  const showSafeZonesRef = useRef(showSafeZones);
  const showSubtitlesRef = useRef(showSubtitles);

  showSafeZonesRef.current = showSafeZones;
  showSubtitlesRef.current = showSubtitles;

  const seriesList = useMemo(() => getSeriesList(), []);

  const filteredEpisodes = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    return EPISODES.filter((ep) => {
      if (librarySeriesFilter !== 'ALL' && ep.meta.series !== librarySeriesFilter) return false;
      if (!q) return true;
      return (
        ep.meta.id.toLowerCase().includes(q) ||
        ep.meta.slug.toLowerCase().includes(q) ||
        ep.meta.seriesLabel.toLowerCase().includes(q) ||
        ep.meta.title.toLowerCase().includes(q) ||
        ep.meta.subtitle.toLowerCase().includes(q) ||
        String(ep.meta.episodeNumber) === q
      );
    });
  }, [librarySearch, librarySeriesFilter]);

  // Initialize deterministic engine whenever the active episode changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    playingRef.current = false;
    setIsPlaying(false);
    setIsReady(false);
    setCurrentTime(0);
    timeRef.current = 0;
    setQcStills([]);
    setMp4Error(null);
    setMp4DoneInfo(null);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.load();
    }

    const engine = new MoneySecretsShortEngine(activeEpisode, canvas);
    if (!isRenderMode) {
      engine.showSafeZones = showSafeZonesRef.current;
      engine.setSubtitles(showSubtitlesRef.current);
    }
    engineRef.current = engine;

    let cancelled = false;
    engine.ready.then(() => {
      if (cancelled) return;
      setCustomSpriteCount(engine.charBank.loadedCount);
      setLoadedGlbKeys(engine.three.getLoadedGlbKeys ? engine.three.getLoadedGlbKeys() : []);
      setSpriteVersion((v) => v + 1);
      setIsReady(true);
      if (!isRenderMode) {
        engine.renderAt(0);
      }
    });

    return () => {
      cancelled = true;
      exportAbortRef.current?.abort();
      cancelAnimationFrame(loopTimerRef.current);
      window.clearTimeout(loopTimerRef.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, [activeEpisode, isRenderMode]);

  // Probe user's GPU & WebCodecs H.264 capabilities when Export modal opens
  useEffect(() => {
    if (!exportOpen || !engineRef.current) return;
    let active = true;
    inspectGpuCapabilities(engineRef.current).then((caps) => {
      if (active) setGpuCaps(caps);
    });
    return () => {
      active = false;
    };
  }, [exportOpen, activeEpisodeId]);

  const handleSelectEpisode = useCallback(
    (id: string) => {
      if (isExportingMp4) return;
      if (id !== activeEpisodeId) {
        setActiveEpisodeId(id);
        if (!isRenderMode && typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('ep', id);
          window.history.replaceState({}, '', url.toString());
        }
      }
      setLibraryOpen(false);
    },
    [activeEpisodeId, isExportingMp4, isRenderMode],
  );

  // Software-WebGL safe draw pacing helper
  const scheduleAfterDraw = useCallback((cb: () => void) => {
    const engine = engineRef.current;
    if (!engine || !engine.three.isSoftwareGl) {
      loopTimerRef.current = requestAnimationFrame(cb);
      return;
    }
    const gl = engine.three.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (!playingRef.current) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          loopTimerRef.current = window.setTimeout(poll, 6);
        } else {
          if (sync) gl.deleteSync(sync);
          loopTimerRef.current = window.setTimeout(cb, 32);
        }
      };
      loopTimerRef.current = window.setTimeout(poll, 6);
    } else {
      loopTimerRef.current = window.setTimeout(cb, 50);
    }
  }, []);

  const renderFrameAt = useCallback(
    (t: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      const clamped = Math.max(0, Math.min(meta.duration, t));
      timeRef.current = clamped;
      engine.renderAt(clamped);
      setCurrentTime(clamped);
    },
    [meta.duration],
  );

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
    cancelAnimationFrame(loopTimerRef.current);
    window.clearTimeout(loopTimerRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const startPlayback = useCallback(() => {
    const audio = audioRef.current;
    const engine = engineRef.current;
    if (!audio || !engine) return;

    const dur = meta.duration;
    if (timeRef.current >= dur - 0.05) {
      timeRef.current = 0;
      audio.currentTime = 0;
    } else {
      audio.currentTime = timeRef.current;
    }

    playingRef.current = true;
    setIsPlaying(true);

    audio.play().catch(() => {
      // If browser blocks unmuted autoplay, advance deterministically via wall clock
    });

    let lastWall = performance.now();
    let lastUiSync = 0;
    let lastRenderedFrame = -1;
    const fps = meta.fps;

    const tick = () => {
      if (!playingRef.current) return;
      const now = performance.now();
      const dt = (now - lastWall) / 1000;
      lastWall = now;

      const nextT = !audio.paused && !audio.ended ? audio.currentTime : timeRef.current + dt;

      if (nextT >= dur) {
        audio.currentTime = 0;
        timeRef.current = 0;
        lastRenderedFrame = 0;
        engine.renderAt(0);
        lastUiSync = now;
        setCurrentTime(0);
      } else {
        timeRef.current = nextT;
        // Strictly quantize preview to exact 30 fps so 120/144/165Hz displays never waste 4-5x GPU/CPU
        const frameIdx = Math.floor(nextT * fps);
        if (frameIdx !== lastRenderedFrame) {
          lastRenderedFrame = frameIdx;
          engine.renderAt(frameIdx / fps);
        }
        if (now - lastUiSync >= 80) {
          lastUiSync = now;
          setCurrentTime(nextT);
        }
      }

      scheduleAfterDraw(tick);
    };

    scheduleAfterDraw(tick);
  }, [meta.duration, meta.fps, scheduleAfterDraw]);

  const togglePlay = useCallback(() => {
    if (isExportingMp4) return;
    if (playingRef.current) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isExportingMp4, startPlayback, stopPlayback]);

  const seekTo = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(meta.duration, t));
      if (audioRef.current) {
        audioRef.current.currentTime = clamped;
      }
      renderFrameAt(clamped);
    },
    [meta.duration, renderFrameAt],
  );

  const stepFrames = useCallback(
    (deltaFrames: number) => {
      stopPlayback();
      const nextFrame = Math.max(
        0,
        Math.min(meta.totalFrames - 1, Math.round(timeRef.current * meta.fps) + deltaFrames),
      );
      seekTo(nextFrame / meta.fps);
    },
    [meta.fps, meta.totalFrames, seekTo, stopPlayback],
  );

  const toggleSafeZones = useCallback(() => {
    setShowSafeZones((prev) => {
      const next = !prev;
      if (engineRef.current) {
        engineRef.current.showSafeZones = next;
        engineRef.current.renderAt(timeRef.current);
      }
      return next;
    });
  }, []);

  const updateSubtitles = useCallback((enabled: boolean) => {
    setShowSubtitles(enabled);
    if (engineRef.current) {
      engineRef.current.setSubtitles(enabled);
      engineRef.current.renderAt(timeRef.current);
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
      }
      return next;
    });
  }, []);

  /** Export single frame JPEG at chosen resolution (1080p / 2K / 4K) & subtitle setting */
  const handleDownloadFrame = useCallback(
    (resKey: ResolutionKey = exportRes, withSubs: boolean = showSubtitles) => {
      const engine = engineRef.current;
      if (!engine) return;
      const prevRes = engine.resolution;
      const prevSafe = engine.showSafeZones;
      const prevSubs = engine.showSubtitles;

      engine.showSafeZones = false;
      engine.setSubtitles(withSubs);
      engine.setResolution(resKey);

      const url = engine.frameJPEG(timeRef.current);

      engine.setResolution(prevRes);
      engine.setSubtitles(prevSubs);
      engine.showSafeZones = prevSafe;
      engine.renderAt(timeRef.current);

      const subTag = withSubs ? 'subs' : 'nosubs';
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meta.slug}_${resKey}_${subTag}_${timeRef.current.toFixed(2)}s.jpg`;
      a.click();
    },
    [exportRes, meta.slug, showSubtitles],
  );

  const handleCancelExport = useCallback(() => {
    exportAbortRef.current?.abort();
  }, []);

  /** GPU-accelerated deterministic frame-by-frame MP4 export (H.264 + AAC) directly in the browser */
  const handleExportMp4Browser = useCallback(async () => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;

    stopPlayback();
    setMp4Error(null);
    setMp4DoneInfo(null);
    setIsExportingMp4(true);
    setMp4Progress({
      phase: 'preparing',
      frame: 0,
      totalFrames: meta.totalFrames,
      percent: 0,
      fps: 0,
      etaSeconds: 0,
      encoderLabel: 'Initializing GPU encoder...',
    });

    const controller = new AbortController();
    exportAbortRef.current = controller;

    const prevRes = engine.resolution;
    const prevSafe = engine.showSafeZones;
    const prevSubs = engine.showSubtitles;
    const prevTime = timeRef.current;

    engine.showSafeZones = false;
    engine.setSubtitles(showSubtitles);
    engine.setResolution(exportRes);

    try {
      const result = await exportMp4InBrowser({
        engine,
        canvas,
        resKey: exportRes,
        showSubtitles,
        preferGpuEncoding: true,
        signal: controller.signal,
        onProgress: (p) => {
          setMp4Progress(p);
          if (p.phase === 'video') {
            setCurrentTime(Math.min(meta.duration, p.frame / meta.fps));
          }
        },
      });

      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 15000);

      const mb = (result.sizeBytes / (1024 * 1024)).toFixed(1);
      setMp4DoneInfo(
        `Saved ${result.filename} (${mb} MB) in ${result.elapsedSeconds.toFixed(1)}s via ${result.encoderLabel}.`,
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setMp4Error(err instanceof Error ? err.message : 'Browser MP4 export failed.');
      }
    } finally {
      exportAbortRef.current = null;
      engine.setResolution(prevRes);
      engine.setSubtitles(prevSubs);
      engine.showSafeZones = prevSafe;
      engine.renderAt(prevTime);
      setCurrentTime(prevTime);
      setIsExportingMp4(false);
    }
  }, [exportRes, meta.duration, meta.fps, meta.totalFrames, showSubtitles, stopPlayback]);

  const cliCommand = useMemo(() => {
    const parts = ['node render.js', `--ep=${meta.id}`, `--res=${exportRes}`];
    if (!showSubtitles) parts.push('--no-subs');
    return parts.join(' ');
  }, [exportRes, meta.id, showSubtitles]);

  const handleCopyCommand = useCallback(() => {
    navigator.clipboard?.writeText(cliCommand).then(() => {
      setCopiedCmd(true);
      window.setTimeout(() => setCopiedCmd(false), 1800);
    });
  }, [cliCommand]);

  const handleSpriteUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const engine = engineRef.current;
    if (!files || !engine) return;

    const allFiles = Array.from(files);
    const pngFiles = allFiles.filter((f) => f.name.toLowerCase().endsWith('.png'));
    const glbFiles = allFiles.filter((f) => f.name.toLowerCase().endsWith('.glb'));

    if (pngFiles.length > 0) {
      const count = await engine.charBank.addFileList(files);
      setCustomSpriteCount(count);
    }
    if (glbFiles.length > 0 && engine.three.loadGlbFiles) {
      await engine.three.loadGlbFiles(glbFiles);
      setLoadedGlbKeys(engine.three.getLoadedGlbKeys ? engine.three.getLoadedGlbKeys() : []);
    }

    setSpriteVersion((v) => v + 1);
    engine.renderAt(timeRef.current);
    e.target.value = '';
  }, []);

  const handleOpenQcStills = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    stopPlayback();
    setQcOpen(true);
    setQcGenerating(true);

    const prevTime = timeRef.current;
    const prevSafe = engine.showSafeZones;
    engine.showSafeZones = false;

    const timestamps = meta.qcTimestamps;
    const results: QcStill[] = [];
    let idx = 0;

    const renderNext = () => {
      if (idx >= timestamps.length) {
        engine.showSafeZones = prevSafe;
        engine.renderAt(prevTime);
        setQcStills(results);
        setQcGenerating(false);
        return;
      }
      const ts = timestamps[idx];
      const shot = getShotAtForMeta(meta, ts);
      const dataUrl = engine.frameJPEG(ts);
      results.push({ time: ts, shotLabel: shot.label, dataUrl });
      idx++;
      setQcStills([...results]);
      window.setTimeout(renderNext, 12);
    };

    window.setTimeout(renderNext, 20);
  }, [meta, stopPlayback]);

  // Keyboard shortcuts: Space play/pause, Left/Right frame step, H toggle dock
  useEffect(() => {
    if (isRenderMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepFrames(1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepFrames(-1);
      } else if (e.key === 'h' || e.key === 'H') {
        setDockOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRenderMode, stepFrames, togglePlay]);

  // Headless Puppeteer render mode (?render=1): ONLY the raw target-resolution canvas
  if (isRenderMode) {
    const preset = EXPORT_RESOLUTIONS[initialRes];
    return (
      <canvas
        key={activeEpisodeId}
        ref={canvasRef}
        width={preset.width}
        height={preset.height}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: `${preset.width}px`,
          height: `${preset.height}px`,
          display: 'block',
        }}
      />
    );
  }

  const currentShot = getShotAtForMeta(meta, currentTime);
  const currentFrame = Math.min(meta.totalFrames - 1, Math.round(currentTime * meta.fps));
  const selectedPreset = EXPORT_RESOLUTIONS[exportRes];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#090B10] text-zinc-100 select-none">
      {/* Master Audio Clock (swaps automatically per episode) */}
      <audio ref={audioRef} src={meta.audioUrl} preload="auto" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,.glb,model/gltf-binary"
        multiple
        onChange={handleSpriteUpload}
        className="hidden"
      />

      {/* Minimal 3-Zone Top Bar */}
      {(!isPlayUrlMode || dockOpen) && (
        <header className="fixed top-0 left-0 right-0 z-20 flex h-14 items-center justify-between gap-6 border-b border-white/8 bg-[#0B0E16]/95 px-6">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              Voice of Times
            </span>
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              disabled={isExportingMp4}
              className="flex items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-[#FFD54A]/60 hover:text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5 text-[#FFD54A]" />
              <span>{meta.seriesLabel}</span>
              <span className="text-zinc-500 hidden lg:inline">· {meta.title}</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            </button>
          </div>

          <nav className="flex items-center gap-6 text-xs font-semibold text-zinc-400">
            <button
              type="button"
              onClick={handleOpenQcStills}
              disabled={!isReady || isExportingMp4}
              className="flex items-center gap-1.5 hover:text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer"
            >
              <Grid className="h-3.5 w-3.5" />
              {meta.qcTimestamps.length} QC Stills
            </button>
            <button
              type="button"
              onClick={() => updateSubtitles(!showSubtitles)}
              disabled={isExportingMp4}
              className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showSubtitles ? 'text-[#22E07A]' : 'text-zinc-500 hover:text-white'
              }`}
            >
              <Subtitles className="h-3.5 w-3.5" />
              {showSubtitles ? 'Subtitles On' : 'Subtitles Off'}
            </button>
            <button
              type="button"
              onClick={toggleSafeZones}
              disabled={isExportingMp4}
              className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showSafeZones ? 'text-[#3CE0FF]' : 'hover:text-white'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              Safe Zones
            </button>
            <button
              type="button"
              onClick={() => setCharactersOpen(true)}
              disabled={isExportingMp4}
              className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                charactersOpen ? 'text-[#FFD54A]' : 'hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              {customSpriteCount > 0 ? `Characters (${customSpriteCount} PNGs)` : 'Characters'}
            </button>
          </nav>

          <button
            type="button"
            onClick={() => setExportOpen(true)}
            disabled={!isReady}
            className="flex items-center gap-1.5 rounded-lg bg-[#FFD54A] px-3.5 py-1.5 text-xs font-bold text-[#090B10] hover:bg-[#ffe073] transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export MP4
          </button>
        </header>
      )}

      {/* Unobstructed Full-Height 9:16 Viewport Stage */}
      <main className="flex h-full w-full items-center justify-center pt-14 pb-4">
        <div
          className="relative flex items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl"
          style={{
            height: dockOpen ? 'calc(100vh - 180px)' : 'calc(100vh - 82px)',
            aspectRatio: '9 / 16',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <canvas
            key={activeEpisodeId}
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            onClick={togglePlay}
            className="h-full w-full cursor-pointer object-contain"
          />

          {!isReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090B10]/95 text-center px-6">
              <div className="text-sm font-bold text-[#FFD54A]">Loading {meta.seriesLabel}</div>
              <div className="mt-1 text-xs text-zinc-400">Preparing 3D worlds, fonts, and SRT clock...</div>
            </div>
          )}
        </div>
      </main>

      {/* Collapsible Bottom Control Dock */}
      <div className="fixed bottom-4 left-1/2 z-20 w-[min(920px,94vw)] -translate-x-1/2">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setDockOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-white/10 bg-[#111520] px-3 py-1 text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            {dockOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            {dockOpen ? 'Hide Controls' : 'Show Controls'}
          </button>
        </div>

        {dockOpen && (
          <div className="rounded-xl border border-white/10 bg-[#111520] px-4 py-3 shadow-2xl">
            {/* Shot Scrubber + Cut Ticks */}
            <div className="relative mb-2.5 flex items-center">
              <input
                type="range"
                min={0}
                max={meta.duration}
                step={1 / meta.fps}
                value={currentTime}
                disabled={isExportingMp4}
                onChange={(e) => {
                  stopPlayback();
                  seekTo(parseFloat(e.target.value));
                }}
                aria-label="Timeline Scrubber"
                className="studio-scrubber relative z-10 w-full disabled:opacity-50"
              />
              <div className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 h-1.5">
                {meta.shots.slice(1).map((s) => (
                  <span
                    key={s.id}
                    style={{ left: `${(s.start / meta.duration) * 100}%` }}
                    className="absolute top-0 h-full w-[1px] bg-white/25"
                  />
                ))}
              </div>
            </div>

            {/* Transport Row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!isReady || isExportingMp4}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFD54A] text-[#090B10] hover:bg-[#ffe073] transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => stepFrames(-1)}
                  disabled={isExportingMp4}
                  title="Previous Frame (Left Arrow)"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => stepFrames(1)}
                  disabled={isExportingMp4}
                  title="Next Frame (Right Arrow)"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopPlayback();
                    seekTo(0);
                  }}
                  disabled={isExportingMp4}
                  title="Restart"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>

              {/* Clean unboxed tabular metadata */}
              <div className="flex items-center gap-3 text-xs text-zinc-400 overflow-hidden">
                <span className="font-mono tabular-nums text-white font-semibold whitespace-nowrap">
                  {formatTime(currentTime, meta.duration)} / {formatTime(meta.duration, meta.duration)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums whitespace-nowrap hidden sm:inline">
                  Frame {String(currentFrame).padStart(4, '0')} / {meta.totalFrames}
                </span>
                <span aria-hidden="true" className="hidden md:inline">·</span>
                <span className="truncate text-zinc-300 hidden md:inline">
                  Shot {currentShot.id}: {currentShot.label}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Organized Multi-Episode Video Library Modal */}
      {libraryOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-6">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0E121C]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-white">Video Library ({EPISODES.length} Episodes)</h2>
                <p className="text-xs text-zinc-400">
                  Every video lives in its own modular folder under <span className="font-mono text-zinc-300">src/episodes/&lt;id&gt;/</span> and renders to <span className="font-mono text-zinc-300">renders/&lt;slug&gt;/</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLibraryOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filter & Search Bar (scales cleanly to dozens of videos) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-6 py-3.5 bg-[#111622]">
              <div className="flex items-center gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setLibrarySeriesFilter('ALL')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    librarySeriesFilter === 'ALL'
                      ? 'bg-[#FFD54A] text-[#090B10]'
                      : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  All Series ({EPISODES.length})
                </button>
                {seriesList.map((series) => (
                  <button
                    key={series}
                    type="button"
                    onClick={() => setLibrarySeriesFilter(series)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      librarySeriesFilter === series
                        ? 'bg-[#FFD54A] text-[#090B10]'
                        : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {series}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[220px] flex-1 max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search episode #, title, or ID..."
                  className="w-full rounded-lg border border-white/10 bg-[#090B10] py-1.5 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-[#FFD54A] focus:outline-none"
                />
              </div>
            </div>

            {/* Episode Cards */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {filteredEpisodes.map((ep) => {
                  const m = ep.meta;
                  const isActive = m.id === activeEpisodeId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectEpisode(m.id)}
                      className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'border-[#FFD54A] bg-[#FFD54A]/8'
                          : 'border-white/10 bg-[#141926] hover:border-white/25'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="font-mono text-[11px] font-bold tracking-wide"
                            style={{ color: m.accentColor }}
                          >
                            {m.seriesLabel} · {m.id}
                          </span>
                          {isActive && (
                            <span className="text-[11px] font-bold text-[#FFD54A]">ACTIVE</span>
                          )}
                        </div>
                        <div className="mt-1.5 text-sm font-bold text-white group-hover:text-[#FFD54A] transition-colors">
                          {m.title}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400 leading-relaxed">
                          {m.subtitle}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3 font-mono text-[11px] text-zinc-400">
                        <span>
                          {m.duration.toFixed(2)}s · {m.totalFrames} frames · {m.shots.length} shots
                        </span>
                        <span className="text-zinc-500">src/episodes/{m.id}/</span>
                      </div>
                    </button>
                  );
                })}
                {filteredEpisodes.length === 0 && (
                  <div className="col-span-full rounded-xl border border-dashed border-white/12 py-10 text-center text-xs text-zinc-400">
                    No episodes match &ldquo;{librarySearch}&rdquo;.
                  </div>
                )}
              </div>

              {/* Organized Production Blueprint */}
              <div className="rounded-xl border border-white/10 bg-[#0B0E16] p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                  <FolderOpen className="h-4 w-4 text-[#3CE0FF]" />
                  Scalable Multi-Video Folder Structure
                </div>
                <div className="mt-2.5 grid grid-cols-1 gap-3 text-[11px] text-zinc-400 sm:grid-cols-3">
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="font-mono font-semibold text-zinc-200">src/engine/</div>
                    <p className="mt-1 leading-relaxed">
                      Shared compositor, PRNG, character rig, textures, GPU MP4 exporter &amp; render API.
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="font-mono font-semibold text-zinc-200">src/episodes/&lt;id&gt;/</div>
                    <p className="mt-1 leading-relaxed">
                      Self-contained <span className="font-mono text-zinc-300">meta.ts</span>,{' '}
                      <span className="font-mono text-zinc-300">scene3d.ts</span>,{' '}
                      <span className="font-mono text-zinc-300">overlay2d.ts</span> per video +{' '}
                      <span className="font-mono text-zinc-300">registry.ts</span>.
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="font-mono font-semibold text-zinc-200">renders/&lt;slug&gt;/</div>
                    <p className="mt-1 leading-relaxed">
                      Batch render any video via <span className="font-mono text-[#FFD54A]">node render.js --ep=ms01</span> or{' '}
                      <span className="font-mono text-[#FFD54A]">--ep=all</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Stills QC Inspector Modal */}
      {qcOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-6">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0E121C]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  {meta.seriesLabel} · {meta.qcTimestamps.length}-Frame Quality Check Sheet
                </h2>
                <p className="text-xs text-zinc-400">
                  Deterministic stills at {meta.qcTimestamps.join(', ')} s ·{' '}
                  {showSubtitles ? 'With Subtitles' : 'Without Subtitles'}. Click any frame to jump.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQcOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 overflow-y-auto p-6 sm:grid-cols-3 md:grid-cols-5">
              {qcStills.map((still) => (
                <button
                  key={still.time}
                  type="button"
                  onClick={() => {
                    setQcOpen(false);
                    seekTo(still.time);
                  }}
                  className="group flex flex-col overflow-hidden rounded-lg border border-white/10 bg-[#141926] text-left hover:border-[#FFD54A] transition-colors cursor-pointer"
                >
                  <div className="aspect-[9/16] w-full overflow-hidden bg-black">
                    <img
                      src={still.dataUrl}
                      alt={`Frame at ${still.time}s`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="font-mono text-xs font-bold tabular-nums text-[#FFD54A]">
                      {still.time}s
                    </div>
                    <div className="truncate text-[11px] text-zinc-400 group-hover:text-zinc-200">
                      {still.shotLabel}
                    </div>
                  </div>
                </button>
              ))}
              {qcGenerating && (
                <div className="flex aspect-[9/16] items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-zinc-400">
                  Rendering {qcStills.length} / {meta.qcTimestamps.length}...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal (GPU WebCodecs MP4 · 1080p / 2K / 4K · With / Without Subtitles) */}
      {exportOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-6">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/12 bg-[#0E121C]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  Export {meta.seriesLabel} MP4 (GPU Render)
                </h2>
                <p className="text-xs text-zinc-400">
                  {meta.title} · {meta.duration.toFixed(2)}s ({meta.totalFrames} frames @ {meta.fps} fps) H.264 + AAC.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isExportingMp4 && setExportOpen(false)}
                disabled={isExportingMp4}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              {/* Detected GPU Hardware Info */}
              {gpuCaps && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#141926] px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-200 min-w-0">
                    <Cpu className="h-4 w-4 shrink-0 text-[#22E07A]" />
                    <span className="font-semibold truncate">{gpuCaps.webglRenderer}</span>
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400">
                    {gpuCaps.hardwareH264ByRes[exportRes]
                      ? 'GPU H.264 Hardware Encode Ready'
                      : gpuCaps.softwareH264ByRes[exportRes]
                        ? 'GPU WebGL Render · Auto H.264 Encode'
                        : 'WebCodecs H.264 Unavailable'}
                  </div>
                </div>
              )}

              {/* Resolution Selector */}
              <div>
                <div className="mb-2.5 text-xs font-semibold text-zinc-300">Resolution (9:16 Vertical)</div>
                <div className="grid grid-cols-3 gap-3">
                  {(['1080p', '2k', '4k'] as ResolutionKey[]).map((key) => {
                    const p = EXPORT_RESOLUTIONS[key];
                    const active = exportRes === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={isExportingMp4}
                        onClick={() => {
                          setExportRes(key);
                          setMp4Error(null);
                          setMp4DoneInfo(null);
                        }}
                        className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer disabled:opacity-50 ${
                          active
                            ? 'border-[#FFD54A] bg-[#FFD54A]/10 text-white'
                            : 'border-white/10 bg-[#141926] text-zinc-300 hover:border-white/25'
                        }`}
                      >
                        <div className="text-sm font-bold">{p.shortLabel}</div>
                        <div className="mt-1 font-mono text-xs tabular-nums text-zinc-400">
                          {p.width} × {p.height}
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500">
                          {p.bitrate} VBR · {meta.fps} fps
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subtitles Selector */}
              <div>
                <div className="mb-2.5 text-xs font-semibold text-zinc-300">Subtitles</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isExportingMp4}
                    onClick={() => updateSubtitles(true)}
                    className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer disabled:opacity-50 ${
                      showSubtitles
                        ? 'border-[#22E07A] bg-[#22E07A]/10 text-white'
                        : 'border-white/10 bg-[#141926] text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    <div className="text-sm font-bold">With Subtitles</div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      3-word speaker-colored captions burned in
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={isExportingMp4}
                    onClick={() => updateSubtitles(false)}
                    className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer disabled:opacity-50 ${
                      !showSubtitles
                        ? 'border-[#22E07A] bg-[#22E07A]/10 text-white'
                        : 'border-white/10 bg-[#141926] text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    <div className="text-sm font-bold">Without Subtitles</div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      Clean video without spoken captions
                    </div>
                  </button>
                </div>
              </div>

              {/* Direct Browser GPU MP4 & Frame Export Buttons */}
              <div className="space-y-3 border-t border-white/10 pt-5">
                <div className="flex flex-wrap items-center gap-3">
                  {!isExportingMp4 ? (
                    <button
                      type="button"
                      onClick={handleExportMp4Browser}
                      className="flex items-center gap-2 rounded-lg bg-[#FFD54A] px-4 py-2.5 text-xs font-bold text-[#090B10] hover:bg-[#ffe073] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Film className="h-4 w-4" />
                      Export MP4 on GPU ({selectedPreset.shortLabel} · {showSubtitles ? 'Subs' : 'No Subs'})
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCancelExport}
                      className="flex items-center gap-2 rounded-lg bg-[#FF3B5C] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#ff5470] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Cancel Render ({(mp4Progress?.percent ?? 0).toFixed(0)}%)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDownloadFrame(exportRes, showSubtitles)}
                    disabled={isExportingMp4}
                    className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    <ImageIcon className="h-4 w-4 text-[#3CE0FF]" />
                    Export Frame JPEG ({selectedPreset.shortLabel})
                  </button>
                </div>

                {isExportingMp4 && mp4Progress && (
                  <div className="space-y-1.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-[#FFD54A] transition-all duration-150"
                        style={{ width: `${mp4Progress.percent}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px] tabular-nums text-zinc-400">
                      <span>
                        {mp4Progress.phase === 'video'
                          ? `Frame ${String(mp4Progress.frame).padStart(4, '0')} / ${mp4Progress.totalFrames} · ${mp4Progress.fps.toFixed(1)} fps · ETA ${Math.ceil(mp4Progress.etaSeconds)}s`
                          : mp4Progress.phase === 'audio'
                            ? 'Encoding 48 kHz stereo audio...'
                            : mp4Progress.phase === 'finalizing'
                              ? 'Finalizing +faststart MP4...'
                              : 'Preparing GPU H.264 encoder...'}
                      </span>
                      <span className="text-zinc-300">{mp4Progress.encoderLabel}</span>
                    </div>
                  </div>
                )}

                {mp4DoneInfo && (
                  <div className="rounded-lg border border-[#22E07A]/35 bg-[#22E07A]/10 px-3 py-2 text-xs text-[#22E07A]">
                    {mp4DoneInfo}
                  </div>
                )}

                {mp4Error && (
                  <div className="rounded-lg border border-[#FF3B5C]/40 bg-[#FF3B5C]/10 px-3 py-2 text-xs text-[#FF3B5C]">
                    {mp4Error}
                  </div>
                )}
              </div>

              {/* Optional Desktop FFmpeg CLI Command (supports single episode or --ep=all) */}
              <div className="border-t border-white/10 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400">
                    Desktop FFmpeg CLI (outputs to renders/{meta.slug}/ · use --ep=all for batch)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCommand}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#FFD54A] hover:text-[#ffe073] cursor-pointer"
                  >
                    {copiedCmd ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedCmd ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#090B10] px-4 py-2.5 font-mono text-xs text-zinc-300">
                  {cliCommand}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Character Cast & Pose Sheet Modal (2D PNG Sprites + 3D Mixamo GLB Rigs) */}
      {charactersOpen && (
        <CharacterGalleryModal
          bank={engineRef.current?.charBank ?? null}
          spriteVersion={spriteVersion}
          customSpriteCount={customSpriteCount}
          loadedGlbKeys={loadedGlbKeys}
          defaultTab={activeEpisodeId === 'ms04' || activeEpisodeId === 'ms05' ? 'glb3d' : 'all'}
          onUploadClick={() => fileInputRef.current?.click()}
          onClose={() => setCharactersOpen(false)}
        />
      )}
    </div>
  );
}
