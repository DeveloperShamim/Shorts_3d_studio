/**
 * Core Multi-Episode Video System Types, Resolution Presets, and SRT Utilities.
 * Every episode plugs into this contract so unlimited videos stay cleanly organized.
 */

import * as THREE from 'three';
import { CharacterSpriteBank } from './characters';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const SAFE_LEFT = 56;
export const SAFE_RIGHT = 948; // 1080 - 132 (clears right 120px YouTube buttons)
export const SAFE_CENTER_X = (SAFE_LEFT + SAFE_RIGHT) / 2; // 502px
export const SAFE_MAX_W = SAFE_RIGHT - SAFE_LEFT; // 892px

export type ResolutionKey = '1080p' | '2k' | '4k';

export interface ResolutionPreset {
  key: ResolutionKey;
  label: string;
  shortLabel: string;
  width: number;
  height: number;
  bitrate: string;
  maxrate: string;
  bufsize: string;
  bitrateBps: number;
}

export const EXPORT_RESOLUTIONS: Record<ResolutionKey, ResolutionPreset> = {
  '1080p': {
    key: '1080p',
    label: '1080p Full HD',
    shortLabel: '1080p',
    width: 1080,
    height: 1920,
    bitrate: '16M',
    maxrate: '20M',
    bufsize: '32M',
    bitrateBps: 16_000_000,
  },
  '2k': {
    key: '2k',
    label: '2K QHD',
    shortLabel: '2K',
    width: 1440,
    height: 2560,
    bitrate: '28M',
    maxrate: '36M',
    bufsize: '56M',
    bitrateBps: 28_000_000,
  },
  '4k': {
    key: '4k',
    label: '4K Ultra HD',
    shortLabel: '4K',
    width: 2160,
    height: 3840,
    bitrate: '50M',
    maxrate: '65M',
    bufsize: '100M',
    bitrateBps: 50_000_000,
  },
};

export function parseResolutionKey(raw: string | null | undefined): ResolutionKey {
  const normalized = (raw ?? '').toLowerCase().trim();
  if (normalized === '4k' || normalized === '2160' || normalized === '2160p') return '4k';
  if (normalized === '2k' || normalized === '1440' || normalized === '1440p') return '2k';
  return '1080p';
}

export type Speaker = 'narrator' | 'jordan' | 'maya' | 'man' | 'woman';

export interface SrtCue {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker: Speaker;
}

export interface CaptionChunk {
  cueId: number;
  speaker: Speaker;
  text: string;
  start: number;
  end: number;
}

export interface ShotSpec {
  id: number;
  start: number;
  end: number;
  world: string;
  label: string;
  lineRef: string;
  flashOnCut?: boolean;
  redFlashOnCut?: boolean;
}

export interface EpisodeMeta {
  id: string;
  slug: string;
  series: string;
  episodeNumber: number;
  seriesLabel: string;
  channel: string;
  title: string;
  subtitle: string;
  duration: number;
  fps: number;
  totalFrames: number;
  progressBarEnd: number;
  accentColor: string;
  audioUrl: string;
  srtUrl: string;
  defaultSrt: string;
  cueSpeakers: Record<number, Speaker>;
  shots: readonly ShotSpec[];
  qcTimestamps: readonly number[];
}

export interface Episode3DController {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly isSoftwareGl: boolean;
  readonly ready?: Promise<void>;
  setResolution(width: number, height: number): void;
  renderAt(t: number): void;
  loadGlbFiles?(files: FileList | File[]): Promise<number>;
  getLoadedGlbKeys?(): string[];
  dispose(): void;
}

export interface CompositorHelpers {
  drawHeadline(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    fontSize: number,
    color: string,
    elapsed: number,
    extraScale?: number,
  ): void;
  drawYellowBanner(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    elapsed: number,
  ): void;
  drawStamp(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    elapsed: number,
    width?: number,
  ): void;
  drawLabelBadge(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    accentHex: string,
    elapsed: number,
  ): void;
  drawFactTag(
    ctx: CanvasRenderingContext2D,
    text: string,
    cy: number,
    elapsed: number,
  ): void;
  drawOutlinedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fillStyle: string,
    outlineWidth: number,
    shadowBlur: number,
  ): void;
}

export interface EpisodeCharacterArgs {
  t: number;
  shotId: number;
  shotElapsed: number;
  activeCue: SrtCue | null;
  bank: CharacterSpriteBank;
}

export interface EpisodeGraphicsArgs {
  t: number;
  shotId: number;
  shotElapsed: number;
  helpers: CompositorHelpers;
}

export interface EpisodeModule {
  meta: EpisodeMeta;
  create3DEngine(): Episode3DController;
  drawCharacters(ctx: CanvasRenderingContext2D, args: EpisodeCharacterArgs): void;
  drawGraphics(ctx: CanvasRenderingContext2D, args: EpisodeGraphicsArgs): void;
  drawPreOverlayFx?(
    ctx: CanvasRenderingContext2D,
    webglCanvas: HTMLCanvasElement,
    t: number,
  ): void;
}

function parseSrtTime(ts: string): number {
  const m = ts.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  return (
    parseInt(m[1], 10) * 3600 +
    parseInt(m[2], 10) * 60 +
    parseInt(m[3], 10) +
    parseInt(m[4], 10) / 1000
  );
}

export function parseSrt(raw: string, cueSpeakers: Record<number, Speaker>): SrtCue[] {
  const blocks = raw.replace(/\r/g, '').trim().split(/\n\s*\n/);
  const cues: SrtCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const id = parseInt(lines[0], 10);
    const timeParts = lines[1].split('-->');
    if (timeParts.length !== 2) continue;
    const start = parseSrtTime(timeParts[0]);
    const end = parseSrtTime(timeParts[1]);
    const text = lines.slice(2).join(' ').replace(/\s+/g, ' ').trim();
    cues.push({
      id,
      start,
      end,
      text,
      speaker: cueSpeakers[id] ?? 'narrator',
    });
  }
  return cues;
}

/** Splits each SRT cue into 3-word chunks, duration proportional to chunk character length. */
export function buildCaptionChunks(cues: SrtCue[]): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  for (const cue of cues) {
    const words = cue.text.split(/\s+/).filter(Boolean);
    const groups: string[] = [];
    for (let i = 0; i < words.length; i += 3) {
      groups.push(words.slice(i, i + 3).join(' '));
    }
    const weights = groups.map((g) => Math.max(3, g.replace(/\s+/g, '').length));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const span = Math.max(0.1, cue.end - cue.start);
    let cursor = cue.start;
    for (let i = 0; i < groups.length; i++) {
      const dur = (weights[i] / totalWeight) * span;
      const next = i === groups.length - 1 ? cue.end : cursor + dur;
      chunks.push({
        cueId: cue.id,
        speaker: cue.speaker,
        text: groups[i].toUpperCase(),
        start: cursor,
        end: next,
      });
      cursor = next;
    }
  }
  return chunks;
}

export function getShotAtForMeta(meta: EpisodeMeta, t: number): ShotSpec {
  const clamped = Math.max(0, Math.min(meta.duration - 0.0001, t));
  for (let i = 0; i < meta.shots.length; i++) {
    if (clamped >= meta.shots[i].start && clamped < meta.shots[i].end) {
      return meta.shots[i];
    }
  }
  return meta.shots[meta.shots.length - 1];
}

export function getActiveCue(cues: SrtCue[], t: number): SrtCue | null {
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i].start && t <= cues[i].end) return cues[i];
  }
  return null;
}

export function getActiveChunk(chunks: CaptionChunk[], t: number): CaptionChunk | null {
  for (let i = 0; i < chunks.length; i++) {
    if (t >= chunks[i].start && t < chunks[i].end) return chunks[i];
  }
  return null;
}
