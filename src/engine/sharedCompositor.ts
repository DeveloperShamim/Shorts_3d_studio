/**
 * Unified Multi-Episode 9:16 GPU Compositor (native 1080p / 2K / 4K).
 *
 * GPU Pipeline (zero GPU->CPU readback):
 *   1. Three.js renders 3D scene on its WebGL2 canvas (`webglCanvas`).
 *   2. Transparent 2D HUD (headlines, Fact Tags, captions, progress bar, optional 2D sprites)
 *      renders onto a lightweight 1080x1920 offscreen `overlayCanvas`.
 *   3. Output canvas runs a WebGL2 fullscreen fragment shader that copies `webglCanvas`
 *      directly GPU-to-GPU via `texImage2D`, alpha-composites `overlayCanvas`, and applies
 *      cut flashes, radial vignette, and deterministic 6.5% film grain 100% on the GPU.
 *   4. Automatically falls back to Canvas2D only if WebGL2 is unavailable.
 */

import { CharacterSpriteBank } from './characters';
import {
  CaptionChunk,
  CompositorHelpers,
  EpisodeModule,
  HEIGHT,
  SAFE_CENTER_X,
  SAFE_LEFT,
  SAFE_MAX_W,
  SAFE_RIGHT,
  SrtCue,
  WIDTH,
  getActiveChunk,
  getActiveCue,
  getShotAtForMeta,
} from './episodeTypes';
import { COLORS, clamp, easeOutBack, easeOutCubic, lerp } from './prng';
import { createStillGrainCanvas } from './textures3d';

const COMPOSITE_VERT = `#version 300 es
precision highp float;
const vec2 POS[4] = vec2[4](
  vec2(-1.0, -1.0),
  vec2( 1.0, -1.0),
  vec2(-1.0,  1.0),
  vec2( 1.0,  1.0)
);
out vec2 vUv;
void main() {
  vec2 p = POS[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

const COMPOSITE_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSceneTex;
uniform sampler2D uOverlayTex;
uniform vec4 uFlash;       // rgb = flash color, a = intensity

in vec2 vUv;
out vec4 fragColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 col = texture(uSceneTex, vUv).rgb;

  // Smooth radial vignette on 3D scene (center x=0.5, y=0.48 top-down)
  vec2 p = vec2((vUv.x - 0.5) * 1080.0, (0.52 - vUv.y) * 1920.0);
  float dist = length(p);
  float t = clamp((dist - 367.2) / (1228.8 - 367.2), 0.0, 1.0);
  float vigAlpha = t < 0.72
    ? mix(0.0, 0.22, t / 0.72)
    : mix(0.22, 0.62, (t - 0.72) / 0.28);
  col *= (1.0 - vigAlpha);

  // Ultra-subtle luminance-weighted film micro-grain (clean darks, crisp midtones, zero noise on text)
  vec2 gCoord = floor(vUv * vec2(1080.0, 1920.0));
  float n = hash12(gCoord) - 0.5;
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  float midWeight = smoothstep(0.03, 0.24, luma) * (1.0 - smoothstep(0.78, 0.98, luma));
  col = clamp(col + n * 0.015 * midWeight, 0.0, 1.0);

  // Premultiplied-alpha Porter-Duff source-over composite (razor-sharp HUD & captions)
  vec4 ov = texture(uOverlayTex, vUv);
  col = col * (1.0 - ov.a) + ov.rgb;

  // 2-frame white / 4-frame red cut flash
  if (uFlash.a > 0.001) {
    col = mix(col, uFlash.rgb, uFlash.a);
  }

  fragColor = vec4(col, 1.0);
}
`;

interface WebGL2CompositorState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  sceneTex: WebGLTexture;
  overlayTex: WebGLTexture;
  uSceneLoc: WebGLUniformLocation | null;
  uOverlayLoc: WebGLUniformLocation | null;
  uFlashLoc: WebGLUniformLocation | null;
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createLinearTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function initWebGL2Compositor(canvas: HTMLCanvasElement): WebGL2CompositorState | null {
  try {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
      desynchronized: false,
    });
    if (!gl) return null;

    const vs = compileShader(gl, gl.VERTEX_SHADER, COMPOSITE_VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, COMPOSITE_FRAG);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return null;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return null;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    const vao = gl.createVertexArray();
    const sceneTex = createLinearTexture(gl);
    const overlayTex = createLinearTexture(gl);
    if (!vao || !sceneTex || !overlayTex) {
      if (vao) gl.deleteVertexArray(vao);
      if (sceneTex) gl.deleteTexture(sceneTex);
      if (overlayTex) gl.deleteTexture(overlayTex);
      gl.deleteProgram(program);
      return null;
    }

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    return {
      gl,
      program,
      vao,
      sceneTex,
      overlayTex,
      uSceneLoc: gl.getUniformLocation(program, 'uSceneTex'),
      uOverlayLoc: gl.getUniformLocation(program, 'uOverlayTex'),
      uFlashLoc: gl.getUniformLocation(program, 'uFlash'),
    };
  } catch {
    return null;
  }
}

export class ShortCompositor {
  public readonly canvas: HTMLCanvasElement;
  public readonly isGpuCompositor: boolean;

  // WebGL2 GPU compositor state (primary fast path)
  private readonly glState: WebGL2CompositorState | null;
  private readonly overlayCanvas: HTMLCanvasElement;
  private readonly overlayCtx: CanvasRenderingContext2D;

  // Fallback Canvas2D state (only used if WebGL2 context is unavailable)
  private readonly fallbackCtx: CanvasRenderingContext2D | null;
  private readonly grainCanvas: HTMLCanvasElement | null;
  private readonly vignetteGrad: CanvasGradient | null;

  private readonly helpers: CompositorHelpers;

  public outWidth: number = WIDTH;
  public outHeight: number = HEIGHT;

  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;

    // Try 100% GPU WebGL2 compositor first (eliminates WebGL -> 2D CPU readback!)
    this.glState = initWebGL2Compositor(this.canvas);
    this.isGpuCompositor = this.glState !== null;

    if (this.glState) {
      this.overlayCanvas = document.createElement('canvas');
      this.overlayCanvas.width = WIDTH;
      this.overlayCanvas.height = HEIGHT;
      this.overlayCtx = this.overlayCanvas.getContext('2d', {
        alpha: true,
        willReadFrequently: false,
      })!;
      this.fallbackCtx = null;
      this.grainCanvas = null;
      this.vignetteGrad = null;
    } else {
      // Safe fallback if WebGL2 is blocked
      this.fallbackCtx = this.canvas.getContext('2d', {
        alpha: false,
        willReadFrequently: false,
      })!;
      this.overlayCanvas = this.canvas;
      this.overlayCtx = this.fallbackCtx;
      this.grainCanvas = createStillGrainCanvas(WIDTH, HEIGHT);
      const g = this.fallbackCtx.createRadialGradient(
        WIDTH * 0.5,
        HEIGHT * 0.48,
        WIDTH * 0.34,
        WIDTH * 0.5,
        HEIGHT * 0.5,
        HEIGHT * 0.64,
      );
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.72, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0.62)');
      this.vignetteGrad = g;
    }

    this.helpers = {
      drawHeadline: (ctx, text, cx, cy, fontSize, color, elapsed, extraScale = 1.0) =>
        this.drawHeadline(ctx, text, cx, cy, fontSize, color, elapsed, extraScale),
      drawYellowBanner: (ctx, text, cx, cy, elapsed) =>
        this.drawYellowBanner(ctx, text, cx, cy, elapsed),
      drawStamp: (ctx, text, cx, cy, elapsed, width = 680) =>
        this.drawStamp(ctx, text, cx, cy, elapsed, width),
      drawLabelBadge: (ctx, text, cx, cy, accentHex, elapsed) =>
        this.drawLabelBadge(ctx, text, cx, cy, accentHex, elapsed),
      drawFactTag: (ctx, text, cy, elapsed) =>
        this.drawFactTag(ctx, text, cy, elapsed),
      drawOutlinedText: (ctx, text, x, y, fillStyle, outlineWidth, shadowBlur) =>
        this.drawOutlinedText(ctx, text, x, y, fillStyle, outlineWidth, shadowBlur),
    };
  }

  public setResolution(width: number, height: number): void {
    if (this.outWidth === width && this.outHeight === height && this.canvas.width === width) return;
    this.outWidth = width;
    this.outHeight = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  public composite(
    episode: EpisodeModule,
    webglCanvas: HTMLCanvasElement,
    t: number,
    cues: SrtCue[],
    chunks: CaptionChunk[],
    charBank: CharacterSpriteBank,
    showSafeZones: boolean,
    showSubtitles = true,
  ): void {
    const { meta } = episode;
    const shot = getShotAtForMeta(meta, t);
    const shotElapsed = Math.max(0, t - shot.start);
    const activeCue = getActiveCue(cues, t);
    const activeChunk = getActiveChunk(chunks, t);

    if (this.glState) {
      // --- PRIMARY 100% GPU WEBGL2 COMPOSITING PATH (ZERO WEBGL->2D READBACK) ---
      const ctx = this.overlayCtx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      // 1. Optional episode pre-overlay FX (transparent VHS bars, speed lines, glitch slices)
      if (episode.drawPreOverlayFx) {
        ctx.save();
        episode.drawPreOverlayFx(ctx, webglCanvas, t);
        ctx.restore();
      }

      // 2. Episode 2D Characters Layer (no-op for 3D episodes MS04 & MS05)
      episode.drawCharacters(ctx, {
        t,
        shotId: shot.id,
        shotElapsed,
        activeCue,
        bank: charBank,
      });

      // 3. Top Progress Bar (0 to meta.progressBarEnd at y ~190)
      if (t >= 0 && t <= meta.progressBarEnd) {
        this.drawTopProgressBar(ctx, t, meta.progressBarEnd, meta.seriesLabel, meta.channel);
      }

      // 4. Episode Headlines, Big Numbers, Stamps, Fact Tags, Badges (strictly y 250..700)
      episode.drawGraphics(ctx, {
        t,
        shotId: shot.id,
        shotElapsed,
        helpers: this.helpers,
      });

      // 5. Captions Layer (y ~905, Poppins Bold 74px uppercase, 3 words — ALWAYS ABOVE)
      if (showSubtitles && activeChunk) {
        this.drawCaption(ctx, activeChunk, t);
      }

      // 6. Optional QC Safe-Zone Guides (preview only)
      if (showSafeZones) {
        this.drawSafeZoneGuides(ctx);
      }

      // 7. GPU Shader Composite: Three.js WebGL2 texture + 2D HUD + Flash + Vignette + Film Grain
      const { gl, program, vao, sceneTex, overlayTex, uSceneLoc, uOverlayLoc, uFlashLoc } = this.glState;
      const [fr, fg, fb, fa] = this.getCutFlash(meta, t);

      gl.viewport(0, 0, this.outWidth, this.outHeight);
      gl.useProgram(program);
      gl.bindVertexArray(vao);

      // Upload Three.js WebGL2 canvas directly GPU-to-GPU (D3D11/ANGLE zero CPU readback)
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, webglCanvas);

      // Upload lightweight 1080x1920 transparent 2D HUD canvas (GPU-upscaled smoothly at 2K/4K)
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, overlayTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.overlayCanvas);

      gl.uniform1i(uSceneLoc, 0);
      gl.uniform1i(uOverlayLoc, 1);
      gl.uniform4f(uFlashLoc, fr, fg, fb, fa);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      return;
    }

    // --- FALLBACK CANVAS 2D PATH (ONLY IF WEBGL2 IS UNAVAILABLE) ---
    const ctx = this.fallbackCtx!;
    const scaleX = this.outWidth / WIDTH;
    const scaleY = this.outHeight / HEIGHT;

    ctx.save();
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(webglCanvas, 0, 0, WIDTH, HEIGHT);
    if (episode.drawPreOverlayFx) {
      episode.drawPreOverlayFx(ctx, webglCanvas, t);
    }
    ctx.restore();

    episode.drawCharacters(ctx, {
      t,
      shotId: shot.id,
      shotElapsed,
      activeCue,
      bank: charBank,
    });

    if (t >= 0 && t <= meta.progressBarEnd) {
      this.drawTopProgressBar(ctx, t, meta.progressBarEnd, meta.seriesLabel, meta.channel);
    }

    episode.drawGraphics(ctx, {
      t,
      shotId: shot.id,
      shotElapsed,
      helpers: this.helpers,
    });

    if (showSubtitles && activeChunk) {
      this.drawCaption(ctx, activeChunk, t);
    }

    const [fr, fg, fb, fa] = this.getCutFlash(meta, t);
    if (fa > 0.001) {
      ctx.save();
      ctx.fillStyle = `rgba(${Math.round(fr * 255)}, ${Math.round(fg * 255)}, ${Math.round(fb * 255)}, ${fa})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();
    }

    ctx.save();
    if (this.vignetteGrad) {
      ctx.fillStyle = this.vignetteGrad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    if (this.grainCanvas) {
      ctx.globalAlpha = 0.015;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.grainCanvas, 0, 0, WIDTH, HEIGHT);
    }
    ctx.restore();

    if (showSafeZones) {
      this.drawSafeZoneGuides(ctx);
    }

    ctx.restore();
  }

  public dispose(): void {
    if (!this.glState) return;
    const { gl, program, vao, sceneTex, overlayTex } = this.glState;
    gl.deleteTexture(sceneTex);
    gl.deleteTexture(overlayTex);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  }

  private getCutFlash(meta: EpisodeModule['meta'], t: number): [number, number, number, number] {
    const twoFrames = 2 / 30;
    for (let i = 0; i < meta.shots.length; i++) {
      const s = meta.shots[i];
      if (!s.flashOnCut && !s.redFlashOnCut) continue;
      const dt = t - s.start;
      const span = s.redFlashOnCut ? 4 / 30 : twoFrames;
      if (dt >= 0 && dt < span) {
        const intensity = 1 - dt / span;
        if (s.redFlashOnCut) {
          return [1.0, 59 / 255, 92 / 255, 0.55 * intensity];
        }
        return [1.0, 1.0, 1.0, 0.88 * intensity];
      }
    }
    return [0, 0, 0, 0];
  }

  private drawTopProgressBar(
    ctx: CanvasRenderingContext2D,
    t: number,
    endSec: number,
    seriesLabel: string,
    channel: string,
  ): void {
    const progress = clamp(t / Math.max(0.1, endSec), 0, 1);
    const barX = 72;
    const barW = 860;
    const barY = 190;
    const barH = 10;

    ctx.save();
    ctx.font = '700 26px "Poppins", sans-serif';
    ctx.textBaseline = 'bottom';

    ctx.textAlign = 'left';
    this.drawOutlinedText(ctx, seriesLabel.toUpperCase(), barX, barY - 12, '#FFD54A', 7, 0);

    ctx.textAlign = 'right';
    this.drawOutlinedText(ctx, channel.toUpperCase(), barX + barW, barY - 12, 'rgba(255,255,255,0.88)', 6, 0);

    ctx.fillStyle = 'rgba(12, 16, 24, 0.72)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const fillW = Math.max(12, barW * progress);
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    fillGrad.addColorStop(0, '#FFD54A');
    fillGrad.addColorStop(1, '#FFAE2B');
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillW, barH, 6);
    ctx.fill();
    ctx.restore();
  }

  private drawHeadline(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    fontSize: number,
    color: string,
    elapsed: number,
    extraScale = 1.0,
  ): void {
    const pop = easeOutBack(clamp(elapsed / 0.24, 0, 1), 1.35);
    const alpha = clamp(elapsed / 0.1, 0, 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `800 ${fontSize}px "Poppins", sans-serif`;
    const measured = ctx.measureText(text).width;
    const fitScale = measured > SAFE_MAX_W ? SAFE_MAX_W / measured : 1;

    ctx.translate(cx, cy);
    ctx.scale(pop * fitScale * extraScale, pop * fitScale * extraScale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.drawOutlinedText(ctx, text, 0, 0, color, Math.max(14, fontSize * 0.16), 18);
    ctx.restore();
  }

  private drawYellowBanner(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    elapsed: number,
  ): void {
    const pop = easeOutBack(clamp(elapsed / 0.28, 0, 1), 1.45);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.045);
    ctx.scale(pop, pop);

    const bw = 740;
    const bh = 148;
    // Fast crisp drop-rect shadow (zero CPU shadowBlur pass)
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.beginPath();
    ctx.roundRect(-bw / 2 + 4, -bh / 2 + 12, bw, bh, 18);
    ctx.fill();

    ctx.fillStyle = COLORS.highlightYellow;
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 18);
    ctx.fill();

    ctx.strokeStyle = '#090B10';
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.fillStyle = '#0B0D13';
    ctx.font = '800 94px "Poppins", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 5, bw - 48);
    ctx.restore();
  }

  private drawStamp(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    elapsed: number,
    width = 680,
  ): void {
    const slamP = easeOutCubic(clamp(elapsed / 0.22, 0, 1));
    const scale = lerp(1.42, 1.0, slamP);
    const shake = Math.exp(-elapsed * 11) * 16;
    const sx = Math.sin(elapsed * 65) * shake;
    const sy = Math.cos(elapsed * 58) * shake;

    ctx.save();
    ctx.translate(cx + sx, cy + sy);
    ctx.rotate(-0.08);
    ctx.scale(scale, scale);

    const rw = Math.min(SAFE_MAX_W, width);
    const rh = 166;
    ctx.fillStyle = 'rgba(18, 8, 12, 0.88)';
    ctx.beginPath();
    ctx.roundRect(-rw / 2, -rh / 2, rw, rh, 18);
    ctx.fill();
    ctx.strokeStyle = COLORS.alertRed;
    ctx.lineWidth = 12;
    ctx.stroke();

    ctx.font = '800 92px "Poppins", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.drawOutlinedText(ctx, text, 0, 4, COLORS.alertRed, 14, 14);
    ctx.restore();
  }

  private drawLabelBadge(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    accentHex: string,
    elapsed: number,
  ): void {
    if (elapsed <= 0) return;
    const pop = easeOutBack(clamp(elapsed / 0.25, 0, 1), 1.35);
    ctx.save();
    ctx.font = '800 44px "Poppins", sans-serif';
    const textW = ctx.measureText(text).width;
    const padX = 32;
    const bw = Math.min(SAFE_MAX_W, textW + padX * 2);
    const bh = 84;
    const clampedCx = clamp(cx, SAFE_LEFT + bw / 2, SAFE_RIGHT - bw / 2);

    ctx.translate(clampedCx, cy);
    ctx.scale(pop, pop);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(-bw / 2 + 2, -bh / 2 + 8, bw, bh, 16);
    ctx.fill();

    ctx.fillStyle = 'rgba(10, 13, 20, 0.9)';
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 16);
    ctx.fill();

    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = accentHex;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 3, bw - padX);
    ctx.restore();
  }

  private drawFactTag(
    ctx: CanvasRenderingContext2D,
    text: string,
    cy: number,
    elapsed: number,
  ): void {
    if (elapsed <= 0) return;
    const pop = easeOutBack(clamp(elapsed / 0.28, 0, 1), 1.55);

    ctx.save();
    const badgeW = 138;
    const badgeH = 56;
    const padOuter = 16;
    const gap = 20;

    let fontSize = 40;
    ctx.font = `700 ${fontSize}px "Poppins", sans-serif`;
    let textW = ctx.measureText(text).width;
    const maxTextW = SAFE_MAX_W - (padOuter * 2 + badgeW + gap + 14);
    if (textW > maxTextW) {
      fontSize = Math.max(28, Math.floor((fontSize * maxTextW) / textW));
      ctx.font = `700 ${fontSize}px "Poppins", sans-serif`;
      textW = ctx.measureText(text).width;
    }

    const pillW = Math.min(SAFE_MAX_W, padOuter * 2 + badgeW + gap + textW + 14);
    const pillH = 86;

    ctx.translate(SAFE_CENTER_X, cy);
    ctx.scale(pop, pop);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(-pillW / 2 + 2, -pillH / 2 + 10, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(9, 11, 16, 0.94)';
    ctx.beginPath();
    ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    ctx.stroke();

    const bx = -pillW / 2 + padOuter;
    const by = -badgeH / 2;
    ctx.fillStyle = COLORS.moneyGreen;
    ctx.beginPath();
    ctx.roundRect(bx, by, badgeW, badgeH, badgeH / 2);
    ctx.fill();

    ctx.fillStyle = '#07140D';
    ctx.font = '800 32px "Poppins", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('REAL', bx + badgeW / 2, 2);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${fontSize}px "Poppins", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + badgeW + gap, 2, maxTextW);

    ctx.restore();
  }

  private drawCaption(ctx: CanvasRenderingContext2D, chunk: CaptionChunk, t: number): void {
    const chunkElapsed = Math.max(0, t - chunk.start);
    const pop = lerp(0.9, 1.0, easeOutBack(clamp(chunkElapsed / 0.14, 0, 1), 1.35));

    const fillColor =
      chunk.speaker === 'jordan' || chunk.speaker === 'man'
        ? COLORS.jordanYellow
        : chunk.speaker === 'maya' || chunk.speaker === 'woman'
          ? COLORS.mayaTeal
          : COLORS.narratorWhite;

    ctx.save();
    ctx.font = '800 74px "Poppins", sans-serif';
    const measured = ctx.measureText(chunk.text).width;
    const fitScale = measured > SAFE_MAX_W ? SAFE_MAX_W / measured : 1;

    ctx.translate(SAFE_CENTER_X, 905);
    ctx.scale(pop * fitScale, pop * fitScale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.drawOutlinedText(ctx, chunk.text, 0, 0, fillColor, 18, 16);
    ctx.restore();
  }

  private drawOutlinedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fillStyle: string,
    outlineWidth: number,
    shadowBlur: number,
  ): void {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (shadowBlur > 0) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = outlineWidth + 4;
      ctx.strokeText(text, x, y + 7);
    }
    ctx.strokeStyle = '#06070B';
    ctx.lineWidth = outlineWidth;
    ctx.strokeText(text, x, y);

    ctx.fillStyle = fillStyle;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private drawSafeZoneGuides(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 59, 92, 0.16)';
    ctx.fillRect(0, HEIGHT - 200, WIDTH, 200);
    ctx.fillRect(WIDTH - 120, 0, 120, HEIGHT - 200);

    ctx.strokeStyle = 'rgba(60, 224, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);

    ctx.strokeRect(SAFE_LEFT, 250, SAFE_MAX_W, 450);
    ctx.beginPath();
    ctx.moveTo(SAFE_LEFT, 905);
    ctx.lineTo(SAFE_RIGHT, 905);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 213, 74, 0.7)';
    ctx.strokeRect(SAFE_LEFT, 900, SAFE_MAX_W, 820);

    ctx.setLineDash([]);
    ctx.fillStyle = '#3CE0FF';
    ctx.font = '700 22px "Poppins", sans-serif';
    ctx.fillText('HEADLINE ZONE (y 250–700)', SAFE_LEFT + 12, 280);
    ctx.fillText('CAPTIONS (y 905)', SAFE_LEFT + 12, 892);
    ctx.fillStyle = '#FFD54A';
    ctx.fillText('CHARACTERS (y 900–1720)', SAFE_LEFT + 12, 932);
    ctx.fillStyle = '#FF3B5C';
    ctx.fillText('NO-GO: BOTTOM 200px & RIGHT 120px (YOUTUBE UI)', 44, HEIGHT - 90);
    ctx.restore();
  }
}
