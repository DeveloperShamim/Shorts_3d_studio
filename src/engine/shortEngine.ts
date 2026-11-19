/**
 * Master Deterministic Multi-Episode Short Engine.
 * Exposes the exact global render contract required by render.js / Puppeteer:
 *   window.EPISODE_ID = 'ms02'
 *   window.DUR = 54.07
 *   window.ready (Promise resolving after fonts, SRT, sprites, and shaders are ready)
 *   window.renderAt(t) -> renders exact deterministic frame at t seconds
 *   window.frameJPEG(t) -> renders frame at t and returns JPEG data URL (quality 0.95)
 *   window.setResolution('1080p' | '2k' | '4k')
 *   window.setSubtitles(boolean)
 */

import { CharacterSpriteBank } from './characters';
import {
  CaptionChunk,
  EXPORT_RESOLUTIONS,
  Episode3DController,
  EpisodeModule,
  ResolutionKey,
  SrtCue,
  buildCaptionChunks,
  parseResolutionKey,
  parseSrt,
} from './episodeTypes';
import { ShortCompositor } from './sharedCompositor';

declare global {
  interface Window {
    EPISODE_ID: string;
    DUR: number;
    ready: Promise<void>;
    renderAt: (t: number) => void;
    frameJPEG: (t: number) => string;
    setResolution: (res: ResolutionKey) => void;
    setSubtitles: (enabled: boolean) => void;
  }
}

export class MoneySecretsShortEngine {
  public readonly episode: EpisodeModule;
  public readonly three: Episode3DController;
  public readonly compositor: ShortCompositor;
  public readonly charBank: CharacterSpriteBank;
  public cues: SrtCue[];
  public chunks: CaptionChunk[];
  public showSafeZones = false;
  public showSubtitles = true;
  public resolution: ResolutionKey = '1080p';
  public readonly ready: Promise<void>;
  private disposed = false;

  constructor(episode: EpisodeModule, outputCanvas?: HTMLCanvasElement) {
    this.episode = episode;
    this.three = episode.create3DEngine();
    this.compositor = new ShortCompositor(outputCanvas);
    this.charBank = new CharacterSpriteBank();

    // Respect URL query params (?res=1080p|2k|4k&subtitles=0|1 or ?nosubs=1)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const resParam = params.get('res');
      if (resParam) {
        this.setResolution(parseResolutionKey(resParam));
      }
      if (params.has('nosubs') || params.get('subtitles') === '0' || params.get('subtitles') === 'false') {
        this.showSubtitles = false;
      }
    }

    // Parse embedded SRT immediately so frame 0 is valid even before fetch finishes
    this.cues = parseSrt(episode.meta.defaultSrt, episode.meta.cueSpeakers);
    this.chunks = buildCaptionChunks(this.cues);

    this.ready = this.init();
    this.attachWindowApi();
  }

  public setResolution(key: ResolutionKey): void {
    const preset = EXPORT_RESOLUTIONS[key];
    this.resolution = key;
    this.three.setResolution(preset.width, preset.height);
    this.compositor.setResolution(preset.width, preset.height);
  }

  public setSubtitles(enabled: boolean): void {
    this.showSubtitles = enabled;
  }

  private async init(): Promise<void> {
    // 1. Wait for bundled local Poppins Bold font to finish loading
    if (typeof document !== 'undefined' && document.fonts) {
      try {
        await Promise.all([
          document.fonts.load('700 74px "Poppins"'),
          document.fonts.load('800 74px "Poppins"'),
          document.fonts.ready,
        ]);
      } catch {
        // Proceed with loaded font set
      }
    }

    // 2. Fetch uploaded SRT file if reachable (falls back seamlessly to exact embedded SRT)
    try {
      const res = await fetch(this.episode.meta.srtUrl, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        const parsed = parseSrt(text, this.episode.meta.cueSpeakers);
        if (parsed.length > 0 && !this.disposed) {
          this.cues = parsed;
          this.chunks = buildCaptionChunks(parsed);
        }
      }
    } catch {
      // Keep embedded SRT
    }

    // 3. Load any custom PNG character sprites listed in /assets/chars/manifest.json
    await this.charBank.loadFromManifest();

    // 3b. Wait for any episode 3D assets (e.g., GLB rigged characters/animations)
    if (this.three.ready) {
      await this.three.ready;
    }

    if (this.disposed) return;

    // 4. Pre-warm WebGL shaders & render frame 0 cleanly
    this.renderAt(0);
  }

  public renderAt(t: number): void {
    if (this.disposed) return;
    const dur = this.episode.meta.duration;
    const safeT = Math.max(0, Math.min(dur, Number.isFinite(t) ? t : 0));
    this.three.renderAt(safeT);
    this.compositor.composite(
      this.episode,
      this.three.canvas,
      safeT,
      this.cues,
      this.chunks,
      this.charBank,
      this.showSafeZones,
      this.showSubtitles,
    );
  }

  public frameJPEG(t: number): string {
    this.renderAt(t);
    return this.compositor.canvas.toDataURL('image/jpeg', 0.95);
  }

  private attachWindowApi(): void {
    if (typeof window === 'undefined') return;
    window.EPISODE_ID = this.episode.meta.id;
    window.DUR = this.episode.meta.duration;
    window.ready = this.ready;
    window.renderAt = (t: number) => this.renderAt(t);
    window.frameJPEG = (t: number) => this.frameJPEG(t);
    window.setResolution = (res: ResolutionKey) => this.setResolution(res);
    window.setSubtitles = (enabled: boolean) => this.setSubtitles(enabled);
  }

  public dispose(): void {
    this.disposed = true;
    this.three.dispose();
    this.compositor.dispose();
  }
}
