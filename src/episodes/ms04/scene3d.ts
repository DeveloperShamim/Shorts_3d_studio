/**
 * Money Secrets #4 — "The Life of a $100 Bill"
 * Deterministic Realistic PBR Three.js Engine.
 *
 * Features:
 *   - 12 grounded composite 3D stages across 9 worlds (zero voids, full sky dome + fog + dust)
 *   - Realistic 3D rigged characters via Character3DManager (Mixamo GLB + deterministic
 *     THREE.AnimationMixer + 0.3s crossfade + neutral grey articulated mannequin fallback)
 *   - Soft PCFSoft shadows, warm key light, cool rim light, RoomEnvironment PBR reflections
 *   - Subtle BokehPass shallow depth-of-field on macro close-ups + calibrated UnrealBloomPass
 *   - Strict generic green $100 banknote with blue vertical ribbon (NO real US currency design)
 *   - Seamless loop back to frame 0 macro floating note
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Character3DManager } from '../../engine/characters3d';
import {
  Episode3DController,
  HEIGHT,
  WIDTH,
  getShotAtForMeta,
} from '../../engine/episodeTypes';
import {
  COLORS,
  clamp,
  createRng,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  invLerp,
  lerp,
  punchInFov,
} from '../../engine/prng';
import {
  createGridFloorTexture,
  createMarbleTexture,
  createSignPanelTexture,
} from '../../engine/textures3d';
import { MS04_META } from './meta';

type WorldId =
  | 'macroNote'
  | 'printingHall'
  | 'ribbonMacro'
  | 'cutterPress'
  | 'warehouse'
  | 'armoredStreet'
  | 'localVault'
  | 'streetAtm'
  | 'legalDesk'
  | 'trustCity'
  | 'montage'
  | 'wornNote'
  | 'shredder'
  | 'finale';

const getShotAt = (t: number) => getShotAtForMeta(MS04_META, t);
const _dummy = new THREE.Object3D();
const _camLook = new THREE.Vector3();

interface SkyPalette {
  top: number;
  mid: number;
  bottom: number;
  fog: number;
  fogDensity: number;
  keyColor: number;
  keyIntensity: number;
  rimColor: number;
  rimIntensity: number;
  bloomStrength: number;
}

const WORLD_PALETTES: Record<WorldId, SkyPalette> = {
  macroNote: {
    top: 0x070c10,
    mid: 0x121c22,
    bottom: 0x090d11,
    fog: 0x0d151a,
    fogDensity: 0.02,
    keyColor: 0xffe4b8,
    keyIntensity: 1.55,
    rimColor: 0x3ce0ff,
    rimIntensity: 0.95,
    bloomStrength: 0.28,
  },
  printingHall: {
    top: 0x0a0e16,
    mid: 0x16202e,
    bottom: 0x0b1018,
    fog: 0x111926,
    fogDensity: 0.017,
    keyColor: 0xfff0d6,
    keyIntensity: 1.45,
    rimColor: 0x3ce0ff,
    rimIntensity: 0.9,
    bloomStrength: 0.26,
  },
  ribbonMacro: {
    top: 0x050b16,
    mid: 0x0c1b30,
    bottom: 0x060b14,
    fog: 0x091424,
    fogDensity: 0.022,
    keyColor: 0xffe9c7,
    keyIntensity: 1.5,
    rimColor: 0x3ce0ff,
    rimIntensity: 1.25,
    bloomStrength: 0.3,
  },
  cutterPress: {
    top: 0x0b0f14,
    mid: 0x19232c,
    bottom: 0x0c1015,
    fog: 0x121a22,
    fogDensity: 0.019,
    keyColor: 0xfff2dc,
    keyIntensity: 1.45,
    rimColor: 0x22e07a,
    rimIntensity: 0.85,
    bloomStrength: 0.26,
  },
  warehouse: {
    top: 0x090d14,
    mid: 0x161d28,
    bottom: 0x0a0d12,
    fog: 0x111720,
    fogDensity: 0.015,
    keyColor: 0xffe0ad,
    keyIntensity: 1.4,
    rimColor: 0x3ce0ff,
    rimIntensity: 0.78,
    bloomStrength: 0.28,
  },
  armoredStreet: {
    top: 0x050914,
    mid: 0x0e182c,
    bottom: 0x060a12,
    fog: 0x0a1222,
    fogDensity: 0.015,
    keyColor: 0xdbeeff,
    keyIntensity: 1.15,
    rimColor: 0x3ce0ff,
    rimIntensity: 1.0,
    bloomStrength: 0.32,
  },
  localVault: {
    top: 0x060b14,
    mid: 0x111d2e,
    bottom: 0x080d16,
    fog: 0x0d1624,
    fogDensity: 0.019,
    keyColor: 0xffe8c2,
    keyIntensity: 1.4,
    rimColor: 0x22e07a,
    rimIntensity: 0.95,
    bloomStrength: 0.29,
  },
  streetAtm: {
    top: 0x0a0d1f,
    mid: 0x1e2040,
    bottom: 0x101324,
    fog: 0x161830,
    fogDensity: 0.014,
    keyColor: 0xffd79e,
    keyIntensity: 1.65,
    rimColor: 0x56c8ff,
    rimIntensity: 1.1,
    bloomStrength: 0.3,
  },
  legalDesk: {
    top: 0x090b12,
    mid: 0x171b26,
    bottom: 0x0a0d14,
    fog: 0x111520,
    fogDensity: 0.02,
    keyColor: 0xffe7bc,
    keyIntensity: 1.5,
    rimColor: 0x3ce0ff,
    rimIntensity: 0.85,
    bloomStrength: 0.26,
  },
  trustCity: {
    top: 0x040814,
    mid: 0x0d1930,
    bottom: 0x060b16,
    fog: 0x091324,
    fogDensity: 0.011,
    keyColor: 0xffe3a8,
    keyIntensity: 1.35,
    rimColor: 0x3ce0ff,
    rimIntensity: 1.15,
    bloomStrength: 0.34,
  },
  montage: {
    top: 0x0c0b12,
    mid: 0x1d1a26,
    bottom: 0x0c0b10,
    fog: 0x14121c,
    fogDensity: 0.021,
    keyColor: 0xffe4b5,
    keyIntensity: 1.5,
    rimColor: 0x3ce0ff,
    rimIntensity: 0.85,
    bloomStrength: 0.27,
  },
  wornNote: {
    top: 0x0c0a08,
    mid: 0x1c1712,
    bottom: 0x0a0908,
    fog: 0x14100d,
    fogDensity: 0.022,
    keyColor: 0xffd9a0,
    keyIntensity: 1.4,
    rimColor: 0xff6a3a,
    rimIntensity: 0.85,
    bloomStrength: 0.24,
  },
  shredder: {
    top: 0x090d14,
    mid: 0x161f2c,
    bottom: 0x0a0e16,
    fog: 0x101824,
    fogDensity: 0.018,
    keyColor: 0xf4f8ff,
    keyIntensity: 1.45,
    rimColor: 0x22e07a,
    rimIntensity: 1.0,
    bloomStrength: 0.29,
  },
  finale: {
    top: 0x070a18,
    mid: 0x141e36,
    bottom: 0x080c16,
    fog: 0x0d1528,
    fogDensity: 0.014,
    keyColor: 0xffe6b2,
    keyIntensity: 1.55,
    rimColor: 0x54d4ff,
    rimIntensity: 1.05,
    bloomStrength: 0.31,
  },
};

function configureTex(tex: THREE.CanvasTexture, maxAniso: number): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Strictly GENERIC green $100 banknote with blue vertical security ribbon & plain
 * "LEGAL TENDER FOR ALL DEBTS" text. Zero portraits, zero seals, zero real US layout.
 */
function createGeneric100NoteTexture(
  maxAniso: number,
  options: { worn?: boolean; showRibbon?: boolean; sheetGrid?: boolean } = {},
): THREE.CanvasTexture {
  const { worn = false, showRibbon = true, sheetGrid = false } = options;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 460;
  const ctx = c.getContext('2d')!;

  const drawSingleNote = (ox: number, oy: number, nw: number, nh: number) => {
    ctx.save();
    ctx.translate(ox, oy);

    // Base cotton-linen tinted green paper
    const bg = ctx.createLinearGradient(0, 0, nw, nh);
    if (worn) {
      bg.addColorStop(0, '#5A6A57');
      bg.addColorStop(0.5, '#6C7D66');
      bg.addColorStop(1, '#4F5C4C');
    } else {
      bg.addColorStop(0, '#1D6B44');
      bg.addColorStop(0.5, '#298F5B');
      bg.addColorStop(1, '#195D3A');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, nw, nh);

    // Subtle geometric cotton-linen weave lines
    ctx.strokeStyle = worn ? 'rgba(255,255,255,0.04)' : 'rgba(200,255,224,0.06)';
    ctx.lineWidth = Math.max(1, nw * 0.0015);
    for (let x = 20; x < nw; x += nw / 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, nh);
      ctx.stroke();
    }

    // Clean double geometric frame
    const pad = nw * 0.028;
    ctx.strokeStyle = worn ? '#9EB09A' : '#A9F7CB';
    ctx.lineWidth = Math.max(3, nw * 0.011);
    ctx.strokeRect(pad, pad, nw - pad * 2, nh - pad * 2);

    ctx.strokeStyle = worn ? 'rgba(180,196,176,0.4)' : 'rgba(169,247,203,0.45)';
    ctx.lineWidth = Math.max(1.5, nw * 0.004);
    ctx.strokeRect(pad * 1.9, pad * 1.9, nw - pad * 3.8, nh - pad * 3.8);

    // Blue vertical security ribbon
    if (showRibbon) {
      const rx = nw * 0.625;
      const rw = nw * 0.044;
      const rGrad = ctx.createLinearGradient(rx, 0, rx + rw, 0);
      rGrad.addColorStop(0, worn ? '#3A5878' : '#1E80FF');
      rGrad.addColorStop(0.5, worn ? '#6890B8' : '#66D4FF');
      rGrad.addColorStop(1, worn ? '#304B69' : '#186CE0');
      ctx.fillStyle = rGrad;
      ctx.fillRect(rx, pad * 0.4, rw, nh - pad * 0.8);

      // Subtle micro-squares along security ribbon
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      for (let sy = pad * 2; sy < nh - pad * 2; sy += nh * 0.09) {
        ctx.fillRect(rx + rw * 0.25, sy, rw * 0.5, nh * 0.032);
      }
    }

    // Clean central medallion (pure geometry, zero portrait/seal)
    const cx = nw * 0.42;
    const cy = nh * 0.47;
    const rad = nh * 0.29;
    ctx.fillStyle = worn ? 'rgba(30, 38, 28, 0.28)' : 'rgba(9, 44, 25, 0.34)';
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = worn ? '#96AA92' : '#7AF2B2';
    ctx.lineWidth = Math.max(2, nw * 0.005);
    ctx.stroke();

    // Bold "$100" numeral
    ctx.fillStyle = worn ? '#D8E0D4' : '#EEFFF5';
    ctx.font = `800 ${Math.round(nh * 0.31)}px "Poppins", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$100', cx, cy + nh * 0.02);

    // Corner "$100" markers
    ctx.font = `800 ${Math.round(nh * 0.115)}px "Poppins", sans-serif`;
    ctx.fillStyle = worn ? '#BCC8B8' : '#BDFAD7';
    ctx.textAlign = 'left';
    ctx.fillText('$100', pad * 2.5, pad * 3.7);
    ctx.textAlign = 'right';
    ctx.fillText('$100', nw - pad * 2.5, nh - pad * 3.1);

    // Plain engraved-looking legal text strip (featured in Shot 20)
    ctx.fillStyle = worn ? 'rgba(220,226,214,0.65)' : '#DCFFEE';
    ctx.font = `700 ${Math.round(nh * 0.072)}px "Poppins", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('LEGAL TENDER FOR ALL DEBTS', nw * 0.5, nh * 0.855);

    // Optional realistic wear: creases, soil mottling, edge notch
    if (worn) {
      const rng = createRng(1515);
      // Fold creases
      ctx.strokeStyle = 'rgba(255, 250, 232, 0.34)';
      ctx.lineWidth = 4;
      for (const fx of [0.28, 0.51, 0.74]) {
        ctx.beginPath();
        ctx.moveTo(nw * fx, 0);
        ctx.lineTo(nw * (fx + rng.range(-0.03, 0.03)), nh);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(35, 24, 14, 0.42)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, nh * 0.52);
      ctx.lineTo(nw, nh * 0.47);
      ctx.stroke();

      // Age spots & grime
      for (let i = 0; i < 42; i++) {
        ctx.fillStyle = `rgba(62, 46, 26, ${rng.range(0.05, 0.18)})`;
        ctx.beginPath();
        ctx.arc(rng.range(0, nw), rng.range(0, nh), rng.range(12, 56), 0, Math.PI * 2);
        ctx.fill();
      }

      // Torn corner silhouette effect
      ctx.fillStyle = '#120F0C';
      ctx.beginPath();
      ctx.moveTo(nw, 0);
      ctx.lineTo(nw - nw * 0.11, 0);
      ctx.lineTo(nw - nw * 0.07, nh * 0.09);
      ctx.lineTo(nw - nw * 0.03, nh * 0.15);
      ctx.lineTo(nw, nh * 0.22);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  };

  if (sheetGrid) {
    // 2x2 uncut press sheet
    ctx.fillStyle = '#E8E3D5';
    ctx.fillRect(0, 0, 1024, 460);
    const gap = 14;
    const cw = (1024 - gap * 3) / 2;
    const ch = (460 - gap * 3) / 2;
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < 2; col++) {
        drawSingleNote(gap + col * (cw + gap), gap + r * (ch + gap), cw, ch);
      }
    }
  } else {
    drawSingleNote(0, 0, 1024, 460);
  }

  return configureTex(new THREE.CanvasTexture(c), maxAniso);
}

/** Crisp blank cotton-linen paper sheet texture */
function createBlankPaperTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#EFECE2';
  ctx.fillRect(0, 0, 512, 512);

  const rng = createRng(7525);
  for (let i = 0; i < 450; i++) {
    ctx.strokeStyle = i % 7 === 0 ? 'rgba(42,102,165,0.14)' : 'rgba(180,170,150,0.2)';
    ctx.lineWidth = 1.2;
    const x = rng.range(0, 512);
    const y = rng.range(0, 512);
    const a = rng.range(0, Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,115,105,0.22)';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 496);
  return configureTex(new THREE.CanvasTexture(c), maxAniso);
}

/** Crisp generic TAX FORM document texture */
function createTaxFormTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 1024;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#F3F1EA';
  ctx.fillRect(0, 0, 768, 1024);

  ctx.fillStyle = '#182438';
  ctx.fillRect(44, 48, 680, 112);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 56px "Poppins", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('TAX FORM', 74, 104);

  ctx.fillStyle = '#3CE0FF';
  ctx.font = '700 28px "Poppins", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('ANNUAL FILING', 694, 104);

  // Generic form boxes & lines
  ctx.strokeStyle = '#9BA4B5';
  ctx.lineWidth = 3;
  for (let row = 0; row < 8; row++) {
    const y = 210 + row * 82;
    ctx.strokeRect(48, y, 672, 58);
    ctx.fillStyle = '#3B4558';
    ctx.font = '700 22px "Poppins", sans-serif';
    ctx.textAlign = 'left';
    const labels = [
      'LINE 1  GROSS INCOME',
      'LINE 2  ADJUSTMENTS',
      'LINE 3  TAXABLE AMOUNT',
      'LINE 4  TOTAL TAX DUE',
      'LINE 5  PAYMENT METHOD',
      'LINE 6  LEGAL TENDER',
      'LINE 7  STATUS: ACCEPTED',
      'LINE 8  SIGNATURE',
    ];
    ctx.fillText(labels[row], 68, y + 30);
    ctx.fillStyle = '#1A2433';
    ctx.fillRect(460, y + 24, 220, 10);
  }

  // Green checkmark box at bottom
  ctx.fillStyle = 'rgba(34, 224, 122, 0.16)';
  ctx.fillRect(48, 888, 672, 84);
  ctx.strokeStyle = '#22E07A';
  ctx.lineWidth = 5;
  ctx.strokeRect(48, 888, 672, 84);
  ctx.fillStyle = '#107D42';
  ctx.font = '800 34px "Poppins", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAYMENT ACCEPTED IN CASH ($100)', 384, 932);

  return configureTex(new THREE.CanvasTexture(c), maxAniso);
}

/** Metallic Collector Card texture for #4 front & #5 teaser back */
function createMs04CollectorCardTexture(
  maxAniso: number,
  side: 'front' | 'back',
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 1080;
  const ctx = c.getContext('2d')!;

  const accent = side === 'front' ? COLORS.moneyGreen : COLORS.cyan;
  const grad = ctx.createLinearGradient(0, 0, 768, 1080);
  if (side === 'front') {
    grad.addColorStop(0, '#091E16');
    grad.addColorStop(0.5, '#123829');
    grad.addColorStop(1, '#07140F');
  } else {
    grad.addColorStop(0, '#0A1328');
    grad.addColorStop(0.5, '#132548');
    grad.addColorStop(1, '#080E1E');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 768, 1080);

  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 3;
  for (let i = -1080; i < 1800; i += 44) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 540, 1080);
    ctx.stroke();
  }

  ctx.strokeStyle = accent;
  ctx.lineWidth = 18;
  ctx.strokeRect(28, 28, 712, 1024);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(54, 54, 660, 972);

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '700 32px "Poppins", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(side === 'front' ? 'VOICE OF TIMES' : 'NEXT EPISODE', 384, 128);

  ctx.fillStyle = accent;
  ctx.fillRect(214, 168, 340, 6);

  if (side === 'front') {
    ctx.fillStyle = COLORS.moneyGreen;
    ctx.font = '800 54px "Poppins", sans-serif';
    ctx.fillText('MONEY SECRET', 384, 290);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 220px "Poppins", sans-serif';
    ctx.fillText('#4', 384, 495);

    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 54px "Poppins", sans-serif';
    ctx.fillText('THE LIFE OF A', 384, 695);
    ctx.fillText('$100 BILL', 384, 765);

    ctx.fillStyle = 'rgba(34, 224, 122, 0.18)';
    ctx.fillRect(108, 876, 552, 86);
    ctx.strokeStyle = COLORS.moneyGreen;
    ctx.lineWidth = 4;
    ctx.strokeRect(108, 876, 552, 86);
    ctx.fillStyle = COLORS.moneyGreen;
    ctx.font = '800 36px "Poppins", sans-serif';
    ctx.fillText('11¢ PAPER → $100 TRUST', 384, 920);
  } else {
    ctx.fillStyle = COLORS.cyan;
    ctx.font = '800 54px "Poppins", sans-serif';
    ctx.fillText('MONEY SECRET', 384, 270);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 210px "Poppins", sans-serif';
    ctx.fillText('#5', 384, 465);

    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 50px "Poppins", sans-serif';
    ctx.fillText('PAY OFF A LOAN...', 384, 665);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 52px "Poppins", sans-serif';
    ctx.fillText('MONEY', 384, 745);
    ctx.fillText('DISAPPEARS', 384, 810);

    ctx.fillStyle = 'rgba(255, 213, 74, 0.18)';
    ctx.fillRect(116, 892, 536, 82);
    ctx.strokeStyle = COLORS.highlightYellow;
    ctx.lineWidth = 4;
    ctx.strokeRect(116, 892, 536, 82);
    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 36px "Poppins", sans-serif';
    ctx.fillText('FOLLOW FOR #5', 384, 934);
  }

  return configureTex(new THREE.CanvasTexture(c), maxAniso);
}

/** Build gently arched high-detail 3D banknote plane */
function createCurvedBillGeometry(w: number, h: number, arch = 0.12): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(w, h, 24, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const nx = x / (w * 0.5);
    const z = Math.sin(nx * Math.PI * 0.85) * arch + Math.cos((y / (h * 0.5)) * 1.4) * (arch * 0.28);
    pos.setZ(i, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Build a strapped 3D cash bundle */
function createBillBundleMesh(
  billTex: THREE.Texture,
  w = 1.56,
  h = 0.28,
  d = 0.72,
): THREE.Group {
  const g = new THREE.Group();
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xcfe8d6, roughness: 0.75, metalness: 0.05 });
  const topMat = new THREE.MeshStandardMaterial({ map: billTex, roughness: 0.42, metalness: 0.08 });
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    [sideMat, sideMat, topMat, topMat, sideMat, sideMat],
  );
  block.castShadow = true;
  block.receiveShadow = true;
  g.add(block);

  const strap = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.22, h + 0.015, d + 0.015),
    new THREE.MeshStandardMaterial({ color: 0xffd54a, roughness: 0.35, metalness: 0.2 }),
  );
  g.add(strap);
  return g;
}

export class Ms04ThreeEngine implements Episode3DController {
  public readonly canvas: HTMLCanvasElement;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly isSoftwareGl: boolean;
  public readonly ready: Promise<void>;

  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly bokehPass: BokehPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly maxAniso: number;
  private readonly fog: THREE.FogExp2;

  private readonly skyMat: THREE.ShaderMaterial;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly fillLight: THREE.HemisphereLight;
  private readonly dustPoints: THREE.Points;

  // Shared procedural textures
  private readonly crispNoteTex: THREE.CanvasTexture;
  private readonly noRibbonNoteTex: THREE.CanvasTexture;
  private readonly wornNoteTex: THREE.CanvasTexture;
  private readonly blankPaperTex: THREE.CanvasTexture;
  private readonly sheetGridTex: THREE.CanvasTexture;

  // Realistic 3D Character Manager (shared across streetAtm & finale)
  private readonly chars3D: Character3DManager;

  // Worlds
  private readonly worlds: Record<WorldId, THREE.Group>;

  // Animated handles per world
  private macroNoteGroup!: THREE.Group;
  private macroNoteMesh!: THREE.Mesh;

  private pressRollers: THREE.Mesh[] = [];
  private pressSheets: THREE.Mesh[] = [];
  private pressPrintedSheet!: THREE.Mesh;

  private ribbonNoteMesh!: THREE.Mesh;
  private blueRibbonStrip!: THREE.Mesh;

  private cutterBlade!: THREE.Group;
  private cutterUncutSheet!: THREE.Mesh;
  private cutterCutStack!: THREE.Group;

  private warehousePallets: THREE.Group[] = [];

  private armoredTruck!: THREE.Group;
  private truckWheels: THREE.Mesh[] = [];
  private truckBeacon!: THREE.Mesh;
  private streetLampsArmored: THREE.Group[] = [];

  private vaultDrawers: THREE.Group[] = [];

  private streetCharAnchor!: THREE.Group;
  private atmCashBill!: THREE.Mesh;
  private bldgStoreMat!: THREE.MeshStandardMaterial;
  private bldgBankMat!: THREE.MeshStandardMaterial;
  private bldgGovMat!: THREE.MeshStandardMaterial;
  private bldgStoreSignMat!: THREE.MeshStandardMaterial;
  private bldgBankSignMat!: THREE.MeshStandardMaterial;
  private bldgGovSignMat!: THREE.MeshStandardMaterial;

  private legalDeskBill!: THREE.Mesh;
  private legalDeskTax!: THREE.Mesh;

  private trustLettersGroup!: THREE.Group;

  private montageCafe!: THREE.Group;
  private montageTaxi!: THREE.Group;
  private montageShop!: THREE.Group;
  private montageBill!: THREE.Mesh;

  private wornNoteCrispMesh!: THREE.Mesh;
  private wornNoteDamagedMesh!: THREE.Mesh;

  private shredderRollerL!: THREE.Mesh;
  private shredderRollerR!: THREE.Mesh;
  private shredderWornIn!: THREE.Mesh;
  private shredderConfetti!: THREE.InstancedMesh;
  private shredderFreshOut!: THREE.Mesh;
  private readonly confettiSeeds: Array<{ x: number; z: number; rot: number; speed: number; phase: number }> = [];

  private finaleCharAnchor!: THREE.Group;
  private finaleCardGroup!: THREE.Group;
  private finaleDissolveStack!: THREE.Group;
  private finaleParticles!: THREE.InstancedMesh;
  private readonly dissolveSeeds: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; delay: number }> = [];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(WIDTH, HEIGHT, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;

    // Realistic soft shadow map (PCFSoft) for grounded 3D characters & props
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const gl = this.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    this.isSoftwareGl = /swiftshader|llvmpipe|software/i.test(rendererStr);
    this.maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x0d151a, 0.018);
    this.scene.fog = this.fog;

    // RoomEnvironment IBL so realistic skin, clothing, steel, and paper respond physically
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.48;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(42, WIDTH / HEIGHT, 0.1, 220);
    this.camera.position.set(0, 2.2, 6.5);

    // Sky dome gradient
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x070c10) },
        uMid: { value: new THREE.Color(0x121c22) },
        uBottom: { value: new THREE.Color(0x090d11) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uBottom;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          vec3 col = h >= 0.0
            ? mix(uMid, uTop, pow(clamp(h, 0.0, 1.0), 0.72))
            : mix(uMid, uBottom, pow(clamp(-h, 0.0, 1.0), 0.72));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(130, 32, 24), this.skyMat);
    this.scene.add(skyDome);

    // Warm shadow-casting key light + cool rim light + hemisphere fill
    this.keyLight = new THREE.DirectionalLight(0xffe4b8, 1.5);
    this.keyLight.position.set(5.5, 11.5, 6.5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 38;
    this.keyLight.shadow.camera.left = -8;
    this.keyLight.shadow.camera.right = 8;
    this.keyLight.shadow.camera.top = 8;
    this.keyLight.shadow.camera.bottom = -8;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.radius = 3.2;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x3ce0ff, 0.95);
    this.rimLight.position.set(-6.5, 7.5, -7.5);
    this.scene.add(this.rimLight);

    this.fillLight = new THREE.HemisphereLight(0xb8d4ff, 0x1a1e2e, 0.55);
    this.scene.add(this.fillLight);

    // Ambient floating dust motes (deterministic PRNG)
    this.dustPoints = this.buildDustField();
    this.scene.add(this.dustPoints);

    // Shared procedural banknote & paper textures
    this.crispNoteTex = createGeneric100NoteTexture(this.maxAniso, { worn: false, showRibbon: true });
    this.noRibbonNoteTex = createGeneric100NoteTexture(this.maxAniso, { worn: false, showRibbon: false });
    this.wornNoteTex = createGeneric100NoteTexture(this.maxAniso, { worn: true, showRibbon: true });
    this.blankPaperTex = createBlankPaperTexture(this.maxAniso);
    this.sheetGridTex = createGeneric100NoteTexture(this.maxAniso, { worn: false, showRibbon: true, sheetGrid: true });

    // 3D Realistic Characters (Mixamo GLB + neutral grey articulated stand-in mannequin fallback)
    this.chars3D = new Character3DManager(this.crispNoteTex);
    this.ready = this.chars3D.loadDefaultAssets();

    // Build all 3D worlds
    this.worlds = {
      macroNote: this.buildMacroNoteWorld(),
      printingHall: this.buildPrintingHallWorld(),
      ribbonMacro: this.buildRibbonMacroWorld(),
      cutterPress: this.buildCutterPressWorld(),
      warehouse: this.buildWarehouseWorld(),
      armoredStreet: this.buildArmoredStreetWorld(),
      localVault: this.buildLocalVaultWorld(),
      streetAtm: this.buildStreetAtmWorld(),
      legalDesk: this.buildLegalDeskWorld(),
      trustCity: this.buildTrustCityWorld(),
      montage: this.buildMontageWorld(),
      wornNote: this.buildWornNoteWorld(),
      shredder: this.buildShredderWorld(),
      finale: this.buildFinaleWorld(),
    };

    for (const group of Object.values(this.worlds)) {
      group.visible = false;
      this.scene.add(group);
    }

    // Post-processing: RenderPass -> subtle BokehPass (macro shots only) -> calibrated UnrealBloomPass -> OutputPass
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: 3.4,
      aperture: 0.00018,
      maxblur: 0.0055,
    });
    this.bokehPass.enabled = false;
    this.composer.addPass(this.bokehPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(WIDTH, HEIGHT),
      0.19,
      0.22,
      1.25,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  public async loadGlbFiles(files: FileList | File[]): Promise<number> {
    return this.chars3D.loadGlbFiles(files);
  }

  public getLoadedGlbKeys(): string[] {
    return this.chars3D.getLoadedKeys();
  }

  public setResolution(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private buildDustField(): THREE.Points {
    const rng = createRng(4004);
    const count = 220;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rng.range(-12, 12);
      positions[i * 3 + 1] = rng.range(0.3, 12);
      positions[i * 3 + 2] = rng.range(-12, 10);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe8b5,
      size: 0.065,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(geo, mat);
  }

  // --------------------------------------------------------------------------
  // WORLD 1: Macro Floating $100 Note + Legal Tender Close-up + Seamless Loop
  // --------------------------------------------------------------------------
  private buildMacroNoteWorld(): THREE.Group {
    const group = new THREE.Group();

    // Subtle dark reflective studio floor far below so there is never an empty void
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x0b1116, roughness: 0.35, metalness: 0.45 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.2;
    floor.receiveShadow = true;
    group.add(floor);

    // Subtle warm volumetric spotlight cone behind note
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(4.2, 11, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffdf9e,
        transparent: true,
        opacity: 0.075,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    cone.position.set(0, 3.8, -1.6);
    group.add(cone);

    // Curved high-detail generic $100 banknote
    this.macroNoteGroup = new THREE.Group();
    const noteMat = new THREE.MeshStandardMaterial({
      map: this.crispNoteTex,
      roughness: 0.44,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    this.macroNoteMesh = new THREE.Mesh(createCurvedBillGeometry(3.2, 1.44, 0.14), noteMat);
    this.macroNoteMesh.castShadow = true;
    this.macroNoteMesh.receiveShadow = true;
    this.macroNoteGroup.add(this.macroNoteMesh);
    this.macroNoteGroup.position.set(0, 1.35, 0);
    group.add(this.macroNoteGroup);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 2: Generic Industrial Printing Plant Hall + Cotton/Linen + Ink Rollers
  // --------------------------------------------------------------------------
  private buildPrintingHallWorld(): THREE.Group {
    const group = new THREE.Group();
    const gridTex = createGridFloorTexture(this.maxAniso, '#284560', '#0D131D');
    gridTex.repeat.set(14, 14);
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.38, metalness: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x2b3646, roughness: 0.36, metalness: 0.82 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd0dce8, roughness: 0.16, metalness: 0.94 });
    const inkRollerMat = new THREE.MeshStandardMaterial({
      color: 0x1b8e53,
      roughness: 0.24,
      metalness: 0.55,
      emissive: 0x0b4226,
      emissiveIntensity: 0.45,
    });

    // Overhead industrial beams & warm shop lights
    for (let z = -14; z <= 6; z += 5) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(16, 0.45, 0.45), steelMat);
      beam.position.set(0, 8.6, z);
      group.add(beam);

      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.14, 0.55),
        new THREE.MeshBasicMaterial({ color: 0xfff0cc }),
      );
      lamp.position.set(0, 8.3, z);
      group.add(lamp);
    }

    // Long industrial printing press chassis
    const bed = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.5, 16), steelMat);
    bed.position.set(0, 0.75, -3.5);
    bed.receiveShadow = true;
    group.add(bed);

    for (const sx of [-2.05, 2.05]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.9, 15.6), steelMat);
      rail.position.set(sx, 2.25, -3.5);
      rail.castShadow = true;
      group.add(rail);
    }

    // 7 rotating precision steel / green-ink rollers along the press line
    this.pressRollers = [];
    for (let i = 0; i < 7; i++) {
      const isInk = i >= 4;
      const roller = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 3.85, 28),
        isInk ? inkRollerMat : chromeMat,
      );
      roller.rotation.z = Math.PI / 2;
      roller.position.set(0, 2.02, 2.5 - i * 2.1);
      roller.castShadow = true;
      group.add(roller);
      this.pressRollers.push(roller);
    }

    // 6 blank cotton-linen sheets gliding along the conveyor
    const blankMat = new THREE.MeshStandardMaterial({
      map: this.blankPaperTex,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    this.pressSheets = [];
    for (let i = 0; i < 6; i++) {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.65), blankMat);
      sheet.rotation.x = -Math.PI / 2;
      sheet.position.set(0, 1.54, 4.5 - i * 2.3);
      sheet.receiveShadow = true;
      group.add(sheet);
      this.pressSheets.push(sheet);
    }

    // Freshly printed $100 sheet emerging past the green ink roller
    this.pressPrintedSheet = new THREE.Mesh(
      new THREE.PlaneGeometry(3.25, 1.65),
      new THREE.MeshStandardMaterial({
        map: this.sheetGridTex,
        roughness: 0.45,
        metalness: 0.06,
        side: THREE.DoubleSide,
      }),
    );
    this.pressPrintedSheet.rotation.x = -Math.PI / 2;
    this.pressPrintedSheet.position.set(0, 1.555, -6.5);
    group.add(this.pressPrintedSheet);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 3: Macro Blue Security Ribbon Sliding into Note (12.60-14.50)
  // --------------------------------------------------------------------------
  private buildRibbonMacroWorld(): THREE.Group {
    const group = new THREE.Group();
    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(45, 45),
      new THREE.MeshStandardMaterial({ color: 0x0b1422, roughness: 0.35, metalness: 0.55 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.receiveShadow = true;
    group.add(table);

    // Note without ribbon baked in, resting on precision inspection deck
    this.ribbonNoteMesh = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.04, 2.0),
      new THREE.MeshStandardMaterial({ map: this.noRibbonNoteTex, roughness: 0.48, metalness: 0.06 }),
    );
    this.ribbonNoteMesh.position.set(0, 0.45, 0);
    this.ribbonNoteMesh.castShadow = true;
    this.ribbonNoteMesh.receiveShadow = true;
    group.add(this.ribbonNoteMesh);

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.42, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x162235, roughness: 0.3, metalness: 0.78 }),
    );
    deck.position.set(0, 0.21, 0);
    group.add(deck);

    // Shimmering metallic blue security ribbon sliding smoothly into the note
    this.blueRibbonStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.025, 2.02),
      new THREE.MeshStandardMaterial({
        color: 0x2698ff,
        roughness: 0.16,
        metalness: 0.85,
        emissive: 0x1c9eff,
        emissiveIntensity: 1.35,
      }),
    );
    this.blueRibbonStrip.position.set(0.55, 0.485, -2.5);
    group.add(this.blueRibbonStrip);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 4: Industrial Guillotine Cutter Press (14.50-16.50)
  // --------------------------------------------------------------------------
  private buildCutterPressWorld(): THREE.Group {
    const group = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x101620, roughness: 0.4, metalness: 0.4 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x2a3648, roughness: 0.34, metalness: 0.85 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe6eff8, roughness: 0.12, metalness: 0.96 });

    // Cutter worktable
    const table = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.4, 4.4), steelMat);
    table.position.set(0, 0.7, 0);
    table.receiveShadow = true;
    group.add(table);

    // Side gantry posts
    for (const sx of [-2.85, 2.85]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.4, 0.75), steelMat);
      post.position.set(sx, 3.2, -0.1);
      post.castShadow = true;
      group.add(post);
    }

    // Guillotine blade assembly
    this.cutterBlade = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.55, 0.32), steelMat);
    beam.position.y = 0.5;
    this.cutterBlade.add(beam);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.55, 0.08), bladeMat);
    edge.position.y = 0;
    this.cutterBlade.add(edge);
    this.cutterBlade.position.set(0, 3.6, -0.05);
    group.add(this.cutterBlade);

    // Uncut 2x2 sheet before slice
    this.cutterUncutSheet = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.12, 1.9),
      new THREE.MeshStandardMaterial({ map: this.sheetGridTex, roughness: 0.45, metalness: 0.06 }),
    );
    this.cutterUncutSheet.position.set(0, 1.47, 0);
    group.add(this.cutterUncutSheet);

    // Cut stack of neat crisp $100 bundles after slice
    this.cutterCutStack = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = createBillBundleMesh(this.crispNoteTex, 1.8, 0.24, 0.84);
      b.position.set(0, 1.54 + i * 0.25, 0);
      b.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.015;
      this.cutterCutStack.add(b);
    }
    this.cutterCutStack.visible = false;
    group.add(this.cutterCutStack);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 5: Towering Warehouse of Bundled $100 Pallets (16.50-20.10)
  // --------------------------------------------------------------------------
  private buildWarehouseWorld(): THREE.Group {
    const group = new THREE.Group();
    const gridTex = createGridFloorTexture(this.maxAniso, '#35495E', '#0D121A');
    gridTex.repeat.set(16, 16);
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.42, metalness: 0.28 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7b5632, roughness: 0.82, metalness: 0.04 });
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x1d2634, roughness: 0.5, metalness: 0.72 });

    // High warehouse ceiling trusses & warm high-bay fixtures
    for (let z = -22; z <= 6; z += 7) {
      const truss = new THREE.Mesh(new THREE.BoxGeometry(24, 0.55, 0.55), trussMat);
      truss.position.set(0, 15.5, z);
      group.add(truss);
      const bulb = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.85, 0.35, 16),
        new THREE.MeshBasicMaterial({ color: 0xffe6b3 }),
      );
      bulb.position.set(0, 14.9, z);
      group.add(bulb);
    }

    // 3x4 grid of tall pallet stacks rising skyward
    this.warehousePallets = [];
    const cols = [-4.2, 0, 4.2];
    const rows = [-1.5, -6.0, -10.5, -15.0];
    for (const rz of rows) {
      for (const cx of cols) {
        const tower = new THREE.Group();
        tower.position.set(cx, 0, rz);

        // Wooden pallet base
        const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 2.2), woodMat);
        pallet.position.y = 0.11;
        pallet.castShadow = true;
        pallet.receiveShadow = true;
        tower.add(pallet);

        // Stacked tiers of strapped $100 bundles
        const tiers = cx === 0 && rz === -1.5 ? 10 : 9;
        for (let t = 0; t < tiers; t++) {
          const tierBundle = createBillBundleMesh(this.crispNoteTex, 2.35, 0.58, 1.95);
          tierBundle.position.y = 0.52 + t * 0.62;
          tower.add(tierBundle);
        }

        group.add(tower);
        this.warehousePallets.push(tower);
      }
    }

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 6: Generic Armored Truck Driving Through Night City (20.10-22.10)
  // --------------------------------------------------------------------------
  private buildArmoredStreetWorld(): THREE.Group {
    const group = new THREE.Group();

    // Wet reflective night asphalt road
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 120),
      new THREE.MeshStandardMaterial({ color: 0x10151e, roughness: 0.18, metalness: 0.52 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    group.add(road);

    // Dashed yellow center lane markings
    const laneMat = new THREE.MeshBasicMaterial({ color: 0xffd54a });
    for (let z = -50; z <= 30; z += 5) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 2.1), laneMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.02, z);
      group.add(dash);
    }

    // Night skyline buildings flanking the street
    const rng = createRng(2026);
    const bldgMat = new THREE.MeshStandardMaterial({ color: 0x121b2c, roughness: 0.55, metalness: 0.35 });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const h = rng.range(10, 26);
        const w = rng.range(3.5, 5.5);
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5.5), bldgMat);
        b.position.set(side * (9.5 + w * 0.4), h * 0.5, 16 - i * 7.5);
        group.add(b);

        // Glowing warm/cyan window strips
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.65, h * 0.7),
          new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? 0x3ce0ff : 0xffdf99,
            transparent: true,
            opacity: 0.32,
          }),
        );
        win.position.set(side * (9.5 - 0.06), h * 0.52, 16 - i * 7.5);
        win.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        group.add(win);
      }
    }

    // Scrolling street lamps
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x243042, roughness: 0.4, metalness: 0.8 });
    this.streetLampsArmored = [];
    for (let i = 0; i < 8; i++) {
      const lampGrp = new THREE.Group();
      const side = i % 2 === 0 ? -1 : 1;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 6.2, 10), poleMat);
      pole.position.set(side * 5.2, 3.1, 0);
      lampGrp.add(pole);
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.16, 0.35),
        new THREE.MeshBasicMaterial({ color: 0xffe4aa }),
      );
      glow.position.set(side * 4.5, 6.1, 0);
      lampGrp.add(glow);
      lampGrp.position.z = 12 - i * 9;
      group.add(lampGrp);
      this.streetLampsArmored.push(lampGrp);
    }

    // Generic Armored Truck (strictly no logos or text)
    this.armoredTruck = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x273446, roughness: 0.34, metalness: 0.78 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x8ea2ba, roughness: 0.25, metalness: 0.88 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1624, roughness: 0.1, metalness: 0.2, clearcoat: 1 });

    // Armored cargo box
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.45, 2.35, 4.6), armorMat);
    box.position.set(0, 1.85, -0.75);
    box.castShadow = true;
    this.armoredTruck.add(box);

    // Side metallic belt stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 4.62), trimMat);
    stripe.position.set(0, 1.65, -0.75);
    this.armoredTruck.add(stripe);

    // Forward armored cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.85, 2.0), armorMat);
    cab.position.set(0, 1.6, 2.45);
    cab.castShadow = true;
    this.armoredTruck.add(cab);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.05, 1.25), armorMat);
    hood.position.set(0, 1.2, 3.85);
    this.armoredTruck.add(hood);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.65, 0.1), glassMat);
    windshield.position.set(0, 2.02, 3.45);
    this.armoredTruck.add(windshield);

    // Glowing dual headlights + cones
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff4cc });
    for (const hx of [-0.72, 0.72]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.1), headMat);
      hl.position.set(hx, 1.08, 4.5);
      this.armoredTruck.add(hl);

      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(1.3, 6.5, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xfff0c2,
          transparent: true,
          opacity: 0.11,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      beam.rotation.x = -Math.PI / 2;
      beam.position.set(hx, 0.9, 7.8);
      this.armoredTruck.add(beam);
    }

    // Roof amber security beacon
    this.truckBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.25, 0.22, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffaa22,
        emissive: 0xffaa22,
        emissiveIntensity: 1.6,
        roughness: 0.2,
      }),
    );
    this.truckBeacon.position.set(0, 3.12, 1.9);
    this.armoredTruck.add(this.truckBeacon);

    // 4 heavy wheels
    this.truckWheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.36, 20);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x161920, roughness: 0.8, metalness: 0.1 });
    for (const wx of [-1.22, 1.22]) {
      for (const wz of [-1.8, 2.9]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.56, wz);
        this.armoredTruck.add(w);
        this.truckWheels.push(w);
      }
    }

    group.add(this.armoredTruck);
    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 7: Generic Local Bank Vault with Open Cash Drawers (22.10-24.10)
  // --------------------------------------------------------------------------
  private buildLocalVaultWorld(): THREE.Group {
    const group = new THREE.Group();
    const marbleTex = createMarbleTexture(this.maxAniso);
    marbleTex.repeat.set(5, 5);
    marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ map: marbleTex, color: 0x1b2434, roughness: 0.26, metalness: 0.3 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x2a374b, roughness: 0.28, metalness: 0.88 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xe3b857, roughness: 0.22, metalness: 0.92 });

    // Vault back & side walls
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 1.2), steelMat);
    backWall.position.set(0, 5, -4.5);
    group.add(backWall);

    // 3x3 bank of brushed steel safety/cash drawers
    this.vaultDrawers = [];
    for (let row = 0; row < 3; row++) {
      for (let col = -1; col <= 1; col++) {
        const drawer = new THREE.Group();
        drawer.position.set(col * 2.15, 1.15 + row * 1.15, -3.4);

        const tray = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.82, 2.2), steelMat);
        tray.castShadow = true;
        drawer.add(tray);

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.14), handleMat);
        handle.position.set(0, 0, 1.15);
        drawer.add(handle);

        // Bundles of $100 bills tucked neatly inside drawer
        for (const bx of [-0.42, 0.42]) {
          const bundle = createBillBundleMesh(this.crispNoteTex, 0.72, 0.32, 1.45);
          bundle.position.set(bx, 0.36, 0.1);
          drawer.add(bundle);
        }

        group.add(drawer);
        this.vaultDrawers.push(drawer);
      }
    }

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 8: Dusk Street ATM + 3 Buildings (STORE, BANK, GOVERNMENT) + 3D Characters
  // --------------------------------------------------------------------------
  private buildStreetAtmWorld(): THREE.Group {
    const group = new THREE.Group();

    // Sidewalk & dusk avenue floor strictly at y = 0 (characters stand grounded here!)
    const sidewalk = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshStandardMaterial({ color: 0x262c3a, roughness: 0.68, metalness: 0.12 }),
    );
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.receiveShadow = true;
    group.add(sidewalk);

    // Sidewalk curb & wet road strip behind characters
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(40, 0.14, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x3f4759, roughness: 0.7 }),
    );
    curb.position.set(0, 0.07, -2.2);
    curb.receiveShadow = true;
    group.add(curb);

    const avenue = new THREE.Mesh(
      new THREE.PlaneGeometry(45, 7.5),
      new THREE.MeshStandardMaterial({ color: 0x141926, roughness: 0.22, metalness: 0.45 }),
    );
    avenue.rotation.x = -Math.PI / 2;
    avenue.position.set(0, 0.01, -6.1);
    avenue.receiveShadow = true;
    group.add(avenue);

    // Generic Street ATM Kiosk on the left side of the sidewalk
    const atmGroup = new THREE.Group();
    atmGroup.position.set(-1.65, 0, -0.35);
    atmGroup.rotation.y = 0.25;
    const kioskMat = new THREE.MeshStandardMaterial({ color: 0x1e283b, roughness: 0.35, metalness: 0.72 });
    const atmBody = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.25, 0.78), kioskMat);
    atmBody.position.y = 1.125;
    atmBody.castShadow = true;
    atmBody.receiveShadow = true;
    atmGroup.add(atmBody);

    // Glowing cyan ATM screen (strictly generic)
    const atmScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.68, 0.46),
      new THREE.MeshStandardMaterial({
        color: 0x3ce0ff,
        emissive: 0x3ce0ff,
        emissiveIntensity: 1.2,
        roughness: 0.18,
      }),
    );
    atmScreen.position.set(0, 1.48, 0.4);
    atmGroup.add(atmScreen);

    // Cash dispensing slot + sliding $100 bill
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x090c12, roughness: 0.5 }),
    );
    slot.position.set(0, 1.02, 0.39);
    atmGroup.add(slot);

    this.atmCashBill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.14),
      new THREE.MeshStandardMaterial({ map: this.crispNoteTex, side: THREE.DoubleSide }),
    );
    this.atmCashBill.rotation.x = -Math.PI / 2 + 0.15;
    this.atmCashBill.position.set(0, 1.02, 0.52);
    atmGroup.add(this.atmCashBill);
    group.add(atmGroup);

    // Warm Dusk Streetlamp beside the characters
    const lampPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.09, 4.6, 12),
      new THREE.MeshStandardMaterial({ color: 0x1e2533, roughness: 0.42, metalness: 0.78 }),
    );
    lampPole.position.set(1.95, 2.3, -1.5);
    lampPole.castShadow = true;
    group.add(lampPole);

    const lampHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffe4a8,
        emissive: 0xffd078,
        emissiveIntensity: 1.65,
      }),
    );
    lampHead.position.set(1.65, 4.55, -1.35);
    group.add(lampHead);

    // 3 Background Architectural Buildings across the street: STORE, BANK, GOVERNMENT
    // They start muted dusk-lit and illuminate sequentially during Shot 18 (32.40-35.10s)
    const makeBuilding = (
      x: number,
      w: number,
      h: number,
      title: string,
      accentHex: string,
      emissiveHex: number,
    ) => {
      const bGrp = new THREE.Group();
      bGrp.position.set(x, 0, -12.5);

      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x1b2336,
        roughness: 0.65,
        metalness: 0.25,
        emissive: emissiveHex,
        emissiveIntensity: 0.04,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4.2), wallMat);
      body.position.y = h * 0.5;
      bGrp.add(body);

      const signTex = createSignPanelTexture(this.maxAniso, title, 'ACCEPTS $100', accentHex);
      const signMat = new THREE.MeshStandardMaterial({
        map: signTex,
        roughness: 0.3,
        metalness: 0.25,
        emissive: emissiveHex,
        emissiveIntensity: 0.06,
      });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 1.35, 0.24), signMat);
      sign.position.set(0, h + 0.85, 1.8);
      bGrp.add(sign);

      // Architectural cornice / columns on BANK & GOVERNMENT
      if (title !== 'STORE') {
        const colMat = new THREE.MeshStandardMaterial({ color: 0x35425c, roughness: 0.5 });
        for (const cx of [-w * 0.32, 0, w * 0.32]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, h * 0.72, 12), colMat);
          col.position.set(cx, h * 0.36, 2.15);
          bGrp.add(col);
        }
      }

      group.add(bGrp);
      return { wallMat, signMat };
    };

    const store = makeBuilding(-4.3, 3.6, 5.2, 'STORE', COLORS.highlightYellow, 0xffc83d);
    const bank = makeBuilding(0.0, 3.9, 6.2, 'BANK', COLORS.moneyGreen, 0x22e07a);
    const gov = makeBuilding(4.4, 4.2, 6.8, 'GOVERNMENT', COLORS.cyan, 0x3ce0ff);

    this.bldgStoreMat = store.wallMat;
    this.bldgStoreSignMat = store.signMat;
    this.bldgBankMat = bank.wallMat;
    this.bldgBankSignMat = bank.signMat;
    this.bldgGovMat = gov.wallMat;
    this.bldgGovSignMat = gov.signMat;

    // Anchor where realistic 3D characters stand on the sidewalk (y = 0)
    this.streetCharAnchor = new THREE.Group();
    group.add(this.streetCharAnchor);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 9: Legal Desk — Tax Form & Generic $100 Note Side by Side (35.10-37.20)
  // --------------------------------------------------------------------------
  private buildLegalDeskWorld(): THREE.Group {
    const group = new THREE.Group();

    const desk = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x251a14, roughness: 0.42, metalness: 0.18 }),
    );
    desk.rotation.x = -Math.PI / 2;
    desk.receiveShadow = true;
    group.add(desk);

    // Desk blotter mat
    const blotter = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 0.04, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x101824, roughness: 0.72, metalness: 0.05 }),
    );
    blotter.position.set(0, 0.02, 0);
    blotter.receiveShadow = true;
    group.add(blotter);

    // Crisp Tax Form on left
    const taxTex = createTaxFormTexture(this.maxAniso);
    this.legalDeskTax = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 0.03, 2.85),
      new THREE.MeshStandardMaterial({ map: taxTex, roughness: 0.65, metalness: 0.02 }),
    );
    this.legalDeskTax.position.set(-1.18, 0.06, 0.15);
    this.legalDeskTax.rotation.y = 0.06;
    this.legalDeskTax.castShadow = true;
    group.add(this.legalDeskTax);

    // Generic $100 Note on right
    this.legalDeskBill = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.03, 1.06),
      new THREE.MeshStandardMaterial({ map: this.crispNoteTex, roughness: 0.45, metalness: 0.06 }),
    );
    this.legalDeskBill.position.set(1.22, 0.07, 0.35);
    this.legalDeskBill.rotation.y = -0.14;
    this.legalDeskBill.castShadow = true;
    group.add(this.legalDeskBill);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 10: Night City Skyline with Monumental Glowing "TRUST" (39.40-41.70)
  // --------------------------------------------------------------------------
  private buildTrustCityWorld(): THREE.Group {
    const group = new THREE.Group();

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 110),
      new THREE.MeshStandardMaterial({ color: 0x09101d, roughness: 0.3, metalness: 0.5 }),
    );
    ground.rotation.x = -Math.PI / 2;
    group.add(ground);

    const rng = createRng(9904);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x121d32, roughness: 0.42, metalness: 0.55 });
    for (let i = 0; i < 42; i++) {
      const x = rng.range(-18, 18);
      const z = rng.range(-26, -3);
      if (Math.abs(x) < 2.2 && z > -9) continue;
      const w = rng.range(1.4, 3.2);
      const h = rng.range(4, 16);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), towerMat);
      b.position.set(x, h * 0.5, z);
      group.add(b);

      // Glowing rooftop accent bar
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.9, 0.12, w * 0.9),
        new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0x22e07a : 0x3ce0ff }),
      );
      cap.position.set(x, h + 0.08, z);
      group.add(cap);
    }

    // Glowing architectural sky-beacon rings rising behind the "TRUST" centerpiece
    this.trustLettersGroup = new THREE.Group();
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      emissive: 0xffc83d,
      emissiveIntensity: 1.35,
      roughness: 0.2,
      metalness: 0.8,
    });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.09, 14, 48), ringMat);
    halo.position.set(0, 6.2, -5.5);
    this.trustLettersGroup.add(halo);

    const trustSignTex = createSignPanelTexture(this.maxAniso, 'TRUST', 'THE REAL VALUE', COLORS.highlightYellow);
    const trustBoard = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 2.0, 0.28),
      new THREE.MeshStandardMaterial({
        map: trustSignTex,
        emissive: 0x5c4400,
        emissiveIntensity: 0.55,
        roughness: 0.24,
        metalness: 0.4,
      }),
    );
    trustBoard.position.set(0, 6.2, -5.2);
    this.trustLettersGroup.add(trustBoard);
    group.add(this.trustLettersGroup);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 11: 15-Year Fast Montage (Café / Taxi / Shop Counter) (41.70-44.10)
  // --------------------------------------------------------------------------
  private buildMontageWorld(): THREE.Group {
    const group = new THREE.Group();

    // Shared animated $100 bill sliding hand-to-hand across each counter
    this.montageBill = new THREE.Mesh(
      createCurvedBillGeometry(2.1, 0.95, 0.06),
      new THREE.MeshStandardMaterial({
        map: this.crispNoteTex,
        roughness: 0.44,
        metalness: 0.06,
        side: THREE.DoubleSide,
      }),
    );
    this.montageBill.rotation.x = -Math.PI / 2 + 0.12;
    this.montageBill.position.set(0, 1.36, 0.3);
    this.montageBill.castShadow = true;
    group.add(this.montageBill);

    // Sub-scene A: Warm Café Marble Counter + Coffee Cup
    this.montageCafe = new THREE.Group();
    const cafeFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x1a130e, roughness: 0.5 }),
    );
    cafeFloor.rotation.x = -Math.PI / 2;
    this.montageCafe.add(cafeFloor);
    const cafeCounter = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 1.25, 3.2),
      new THREE.MeshStandardMaterial({ map: createMarbleTexture(this.maxAniso), roughness: 0.25 }),
    );
    cafeCounter.position.set(0, 0.625, 0);
    cafeCounter.receiveShadow = true;
    this.montageCafe.add(cafeCounter);
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.25, 0.55, 22),
      new THREE.MeshStandardMaterial({ color: 0xf4eee4, roughness: 0.22 }),
    );
    cup.position.set(-1.55, 1.52, -0.35);
    cup.castShadow = true;
    this.montageCafe.add(cup);
    group.add(this.montageCafe);

    // Sub-scene B: Yellow Taxi Console + Night Lights
    this.montageTaxi = new THREE.Group();
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 1.25, 3.0),
      new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.45, metalness: 0.25 }),
    );
    dash.position.set(0, 0.625, 0);
    this.montageTaxi.add(dash);
    const meter = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.65, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0x6b4b00, emissiveIntensity: 0.55 }),
    );
    meter.position.set(1.45, 1.55, -0.5);
    this.montageTaxi.add(meter);
    const taxiHood = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshStandardMaterial({ color: 0x241d0c, roughness: 0.4 }),
    );
    taxiHood.rotation.x = -Math.PI / 2;
    this.montageTaxi.add(taxiHood);
    this.montageTaxi.visible = false;
    group.add(this.montageTaxi);

    // Sub-scene C: Modern Shop Checkout Counter + Register
    this.montageShop = new THREE.Group();
    const shopFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x0e1816, roughness: 0.45 }),
    );
    shopFloor.rotation.x = -Math.PI / 2;
    this.montageShop.add(shopFloor);
    const shopCounter = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 1.25, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.32, metalness: 0.35 }),
    );
    shopCounter.position.set(0, 0.625, 0);
    this.montageShop.add(shopCounter);
    const regScreen = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.9, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x22e07a, emissive: 0x147a42, emissiveIntensity: 0.9 }),
    );
    regScreen.position.set(1.6, 1.85, -0.6);
    regScreen.rotation.y = -0.35;
    this.montageShop.add(regScreen);
    this.montageShop.visible = false;
    group.add(this.montageShop);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 12: Worn, Creased, Faded & Torn Note Macro (44.10-46.30)
  // --------------------------------------------------------------------------
  private buildWornNoteWorld(): THREE.Group {
    const group = new THREE.Group();
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x120f0c, roughness: 0.6 }),
    );
    backdrop.rotation.x = -Math.PI / 2;
    backdrop.position.y = -2.2;
    group.add(backdrop);

    // Crisp bill crossfading seamlessly into the creased/faded/torn bill
    const geo = createCurvedBillGeometry(3.25, 1.46, 0.22);
    this.wornNoteCrispMesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: this.crispNoteTex,
        roughness: 0.45,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
      }),
    );
    this.wornNoteCrispMesh.position.set(0, 1.3, 0);
    group.add(this.wornNoteCrispMesh);

    this.wornNoteDamagedMesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: this.wornNoteTex,
        roughness: 0.82,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    );
    this.wornNoteDamagedMesh.position.set(0, 1.3, 0.015);
    group.add(this.wornNoteDamagedMesh);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 13: Industrial Shredder + Green Confetti + Crisp New Note Drop (46.30-48.70)
  // --------------------------------------------------------------------------
  private buildShredderWorld(): THREE.Group {
    const group = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(55, 55),
      new THREE.MeshStandardMaterial({ color: 0x0e141d, roughness: 0.36, metalness: 0.45 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const housingMat = new THREE.MeshStandardMaterial({ color: 0x243040, roughness: 0.34, metalness: 0.84 });
    const teethMat = new THREE.MeshStandardMaterial({ color: 0xdbe6f2, roughness: 0.16, metalness: 0.95 });

    // Industrial shredder hopper frame
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.2, 2.4), housingMat);
    frameL.position.set(-2.2, 2.7, 0);
    group.add(frameL);
    const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.2, 2.4), housingMat);
    frameR.position.set(2.2, 2.7, 0);
    group.add(frameR);

    // Twin counter-rotating toothed steel shafts
    const shaftGeo = new THREE.CylinderGeometry(0.46, 0.46, 3.9, 16);
    this.shredderRollerL = new THREE.Mesh(shaftGeo, teethMat);
    this.shredderRollerL.rotation.z = Math.PI / 2;
    this.shredderRollerL.position.set(0, 2.75, -0.5);
    group.add(this.shredderRollerL);

    this.shredderRollerR = new THREE.Mesh(shaftGeo, teethMat);
    this.shredderRollerR.rotation.z = Math.PI / 2;
    this.shredderRollerR.position.set(0, 2.75, 0.5);
    group.add(this.shredderRollerR);

    // Worn bill feeding downward into shredder jaws
    this.shredderWornIn = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.18),
      new THREE.MeshStandardMaterial({ map: this.wornNoteTex, roughness: 0.8, side: THREE.DoubleSide }),
    );
    this.shredderWornIn.position.set(0, 4.1, 0);
    group.add(this.shredderWornIn);

    // 180 green paper confetti strips bursting out beneath the rollers
    const confGeo = new THREE.BoxGeometry(0.08, 0.34, 0.02);
    const confMat = new THREE.MeshStandardMaterial({
      color: 0x3ad17c,
      roughness: 0.65,
      metalness: 0.05,
    });
    this.shredderConfetti = new THREE.InstancedMesh(confGeo, confMat, 180);
    this.shredderConfetti.frustumCulled = false;
    const rng = createRng(4646);
    for (let i = 0; i < 180; i++) {
      this.confettiSeeds.push({
        x: rng.range(-1.65, 1.65),
        z: rng.range(-0.35, 0.35),
        rot: rng.range(0, Math.PI * 2),
        speed: rng.range(1.8, 3.9),
        phase: rng.range(0, 0.75),
      });
    }
    group.add(this.shredderConfetti);

    // Brand-new crisp $100 note dropping smoothly into center light after shred
    this.shredderFreshOut = new THREE.Mesh(
      createCurvedBillGeometry(2.9, 1.3, 0.1),
      new THREE.MeshStandardMaterial({
        map: this.crispNoteTex,
        roughness: 0.38,
        metalness: 0.1,
        side: THREE.DoubleSide,
      }),
    );
    this.shredderFreshOut.position.set(0, 5.5, 1.1);
    this.shredderFreshOut.visible = false;
    group.add(this.shredderFreshOut);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 14: Finale — Glowing Card #4/#5 + Both 3D Characters + Dissolving Cash
  // --------------------------------------------------------------------------
  private buildFinaleWorld(): THREE.Group {
    const group = new THREE.Group();
    const gridTex = createGridFloorTexture(this.maxAniso, '#22E07A', '#0A101E');
    gridTex.repeat.set(12, 12);
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.32, metalness: 0.38 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    // Metallic 3D card ("MONEY SECRET #4" front / "#5: PAY OFF A LOAN... MONEY DISAPPEARS" back)
    this.finaleCardGroup = new THREE.Group();
    const frontTex = createMs04CollectorCardTexture(this.maxAniso, 'front');
    const backTex = createMs04CollectorCardTexture(this.maxAniso, 'back');
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0x7a5b00,
      emissiveIntensity: 0.45,
    });
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 3.28, 0.12),
      [
        edgeMat,
        edgeMat,
        edgeMat,
        edgeMat,
        new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.25, metalness: 0.42 }),
        new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.25, metalness: 0.42 }),
      ],
    );
    card.castShadow = true;
    this.finaleCardGroup.add(card);
    this.finaleCardGroup.position.set(0, 3.15, -1.6);
    group.add(this.finaleCardGroup);

    // Stack of money that dissolves into glowing particles during Shot 30 (55.00-57.80s)
    this.finaleDissolveStack = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const bundle = createBillBundleMesh(this.crispNoteTex, 1.35, 0.22, 0.64);
      bundle.position.y = 0.11 + i * 0.23;
      this.finaleDissolveStack.add(bundle);
    }
    this.finaleDissolveStack.position.set(0, 0, 0.1);
    group.add(this.finaleDissolveStack);

    const pGeo = new THREE.OctahedronGeometry(0.065, 0);
    const pMat = new THREE.MeshStandardMaterial({
      color: 0x38f7a6,
      emissive: 0x22e07a,
      emissiveIntensity: 1.45,
      roughness: 0.2,
    });
    this.finaleParticles = new THREE.InstancedMesh(pGeo, pMat, 220);
    this.finaleParticles.frustumCulled = false;
    const rng = createRng(5505);
    for (let i = 0; i < 220; i++) {
      this.dissolveSeeds.push({
        x: rng.range(-0.7, 0.7),
        y: rng.range(0.05, 0.95),
        z: rng.range(-0.35, 0.45),
        vx: rng.range(-1.4, 1.4),
        vy: rng.range(1.2, 3.6),
        vz: rng.range(-0.9, 0.9),
        delay: rng.range(0, 0.55),
      });
    }
    group.add(this.finaleParticles);

    // Anchor where both realistic 3D characters stand grounded on y = 0 in front of the card
    this.finaleCharAnchor = new THREE.Group();
    group.add(this.finaleCharAnchor);

    return group;
  }

  private mountCharactersTo(anchor: THREE.Group): void {
    if (this.chars3D.man.container.parent !== anchor) {
      anchor.add(this.chars3D.man.container);
    }
    if (this.chars3D.woman.container.parent !== anchor) {
      anchor.add(this.chars3D.woman.container);
    }
  }

  public renderAt(t: number): void {
    const shot = getShotAt(t);
    const worldId = (shot.world as WorldId) in this.worlds ? (shot.world as WorldId) : 'macroNote';
    const shotElapsed = Math.max(0, t - shot.start);
    const shotDur = Math.max(0.1, shot.end - shot.start);
    const u = clamp(shotElapsed / shotDur, 0, 1);

    // Toggle active world
    for (const [key, grp] of Object.entries(this.worlds)) {
      grp.visible = key === worldId;
    }

    // Apply palette & lighting
    const pal = WORLD_PALETTES[worldId];
    this.skyMat.uniforms.uTop.value.setHex(pal.top);
    this.skyMat.uniforms.uMid.value.setHex(pal.mid);
    this.skyMat.uniforms.uBottom.value.setHex(pal.bottom);
    this.fog.color.setHex(pal.fog);
    this.fog.density = pal.fogDensity;
    this.keyLight.color.setHex(pal.keyColor);
    this.keyLight.intensity = pal.keyIntensity;
    this.rimLight.color.setHex(pal.rimColor);
    this.rimLight.intensity = pal.rimIntensity;
    this.bloomPass.strength = pal.bloomStrength * 0.65;

    // Gentle deterministic dust drift
    this.dustPoints.rotation.y = t * 0.045;
    this.dustPoints.position.y = Math.sin(t * 0.45) * 0.18;

    // Default: BokehPass off unless macro close-up shot
    this.bokehPass.enabled = false;

    const baseFov = 54;
    this.camera.fov = punchInFov(baseFov, shotElapsed);

    // ------------------------------------------------------------------------
    // SHOT-BY-SHOT DETERMINISTIC ANIMATION & CAMERA (Balanced 9:16 Wide Framing)
    // ------------------------------------------------------------------------

    if (worldId === 'macroNote') {
      // Subtle shallow DOF on macro shots
      this.bokehPass.enabled = !this.isSoftwareGl;
      const bokehUniforms = this.bokehPass.uniforms as Record<string, THREE.IUniform>;
      if (bokehUniforms.focus) bokehUniforms.focus.value = 6.2;
      if (bokehUniforms.aperture) bokehUniforms.aperture.value = 0.00014;

      if (shot.id === 1) {
        // Opening frame 0 boom: gently turning floating generic $100 note with full horizontal margins
        const boom = 1 + Math.exp(-shotElapsed * 10) * 0.12;
        this.macroNoteGroup.position.set(0, 1.3 + Math.sin(t * 1.6) * 0.08, 0);
        this.macroNoteGroup.rotation.set(0.08, Math.sin(t * 0.75) * 0.3, Math.sin(t * 0.9) * 0.04);
        this.macroNoteGroup.scale.setScalar(boom);
        this.camera.position.set(lerp(-0.28, 0.2, u), 1.5, lerp(6.6, 6.0, u));
        _camLook.set(0, 1.35, 0);
      } else if (shot.id === 2) {
        this.macroNoteGroup.position.set(0, 1.15 + Math.sin(t * 1.6) * 0.07, 0);
        this.macroNoteGroup.rotation.set(0.12, 0.22 + u * 0.34, -0.05);
        this.macroNoteGroup.scale.setScalar(1.0);
        this.camera.position.set(lerp(0.2, 0.65, u), 1.48, lerp(6.1, 6.45, u));
        _camLook.set(0, 1.25, 0);
      } else if (shot.id === 3) {
        const punch = 1 + Math.exp(-Math.max(0, shotElapsed - 0.12) * 9) * 0.14;
        this.macroNoteGroup.position.set(0, 1.12, 0);
        this.macroNoteGroup.rotation.set(-0.06, lerp(0.5, -0.18, easeOutCubic(u)), 0.03);
        this.macroNoteGroup.scale.setScalar(punch);
        this.camera.position.set(lerp(0.55, -0.12, u), 1.42, lerp(6.5, 5.75, u));
        _camLook.set(0, 1.22, 0);
      } else if (shot.id === 20) {
        // Shot 20 (37.20-39.40): Clean readable macro glide across "LEGAL TENDER FOR ALL DEBTS"
        this.macroNoteGroup.position.set(0, 1.42, 0);
        this.macroNoteGroup.rotation.set(-0.16, lerp(-0.12, 0.12, u), 0);
        this.macroNoteGroup.scale.setScalar(1.08);
        this.camera.position.set(lerp(-0.65, 0.65, easeInOutCubic(u)), 1.18, 4.15);
        _camLook.set(lerp(-0.25, 0.25, u), 1.05, 0);
        if (bokehUniforms.focus) bokehUniforms.focus.value = 4.15;
      } else {
        // Shot 31 (57.80-59.36): Seamless return to exact frame 0 floating $100 note pose
        const ease = easeInOutCubic(u);
        this.macroNoteGroup.position.set(0, lerp(1.5, 1.3, ease), 0);
        this.macroNoteGroup.rotation.set(
          lerp(0.22, 0.08, ease),
          lerp(0.6, 0.0, ease),
          lerp(-0.08, 0.0, ease),
        );
        this.macroNoteGroup.scale.setScalar(lerp(0.9, 1.0, ease));
        this.camera.position.set(lerp(0.35, -0.28, ease), lerp(1.68, 1.5, ease), lerp(7.2, 6.6, ease));
        _camLook.set(0, 1.35, 0);
      }
    } else if (worldId === 'printingHall') {
      // Spin all industrial steel & ink rollers deterministically
      for (let i = 0; i < this.pressRollers.length; i++) {
        this.pressRollers[i].rotation.x = t * 5.2 * (i % 2 === 0 ? 1 : -1);
      }
      // Feed blank sheets smoothly along conveyor belt
      for (let i = 0; i < this.pressSheets.length; i++) {
        const z = ((4.5 - i * 2.3 - t * 2.4) % 13.8 + 13.8) % 13.8 - 7.8;
        this.pressSheets[i].position.z = z;
        this.pressSheets[i].visible = shot.id < 7 || z > -3.6;
      }
      this.pressPrintedSheet.visible = shot.id === 7;
      if (shot.id === 7) {
        this.pressPrintedSheet.position.z = lerp(-3.8, -7.8, easeOutCubic(u));
      }

      if (shot.id === 4) {
        // Wide tracking along the printing hall & machines
        this.camera.position.set(lerp(5.2, 4.2, u), lerp(5.0, 4.2, u), lerp(9.4, 3.6, u));
        _camLook.set(0, 1.8, -3.5);
      } else if (shot.id === 5) {
        // Blank cotton-linen sheets feeding through rollers
        this.camera.position.set(lerp(3.6, 2.8, u), 3.6, lerp(5.6, 3.8, u));
        _camLook.set(0, 1.65, 0.2);
      } else if (shot.id === 6) {
        // Opposite angle tracking along sheets on press bed
        this.camera.position.set(lerp(-3.5, -2.6, u), 3.2, lerp(4.2, 1.6, u));
        _camLook.set(0, 1.65, -2.2);
      } else {
        // Shot 7: Green ink rollers pressing the sheet; pattern appears
        this.camera.position.set(lerp(3.9, 3.1, u), 3.85, lerp(-0.2, -3.2, u));
        _camLook.set(0, 1.65, -5.6);
      }
    } else if (worldId === 'ribbonMacro') {
      this.bokehPass.enabled = !this.isSoftwareGl;
      const bokehUniforms = this.bokehPass.uniforms as Record<string, THREE.IUniform>;
      if (bokehUniforms.focus) bokehUniforms.focus.value = 5.2;
      if (bokehUniforms.aperture) bokehUniforms.aperture.value = 0.00016;

      const slideP = easeOutCubic(clamp(u / 0.82, 0, 1));
      this.blueRibbonStrip.position.set(0.55, 0.485, lerp(-2.4, 0, slideP));
      this.camera.position.set(lerp(-0.6, 0.8, u), lerp(3.85, 3.35, u), lerp(4.65, 3.95, u));
      _camLook.set(0.25, 0.48, 0);
    } else if (worldId === 'cutterPress') {
      const cutMoment = 0.44;
      if (u < cutMoment) {
        const drop = easeInOutCubic(u / cutMoment);
        this.cutterBlade.position.y = lerp(3.6, 1.72, drop);
        this.cutterUncutSheet.visible = true;
        this.cutterCutStack.visible = false;
      } else {
        const lift = easeOutCubic((u - cutMoment) / (1 - cutMoment));
        this.cutterBlade.position.y = lerp(1.72, 3.45, lift);
        this.cutterUncutSheet.visible = false;
        this.cutterCutStack.visible = true;
        this.cutterCutStack.scale.setScalar(easeOutBack(clamp((u - cutMoment) * 3.5, 0, 1), 1.25));
      }
      this.camera.position.set(lerp(2.1, 1.0, u), lerp(4.2, 3.75, u), lerp(7.8, 6.6, u));
      _camLook.set(0, 2.0, 0);
    } else if (worldId === 'warehouse') {
      // Pallets dynamically stack upward in Shot 10, then crane up/back in Shot 11
      const stackP = shot.id === 10 ? easeOutCubic(u) : 1;
      for (let i = 0; i < this.warehousePallets.length; i++) {
        const localP = clamp((stackP - (i % 4) * 0.08) / 0.7, 0.15, 1);
        this.warehousePallets[i].scale.y = localP;
      }
      if (shot.id === 10) {
        this.camera.position.set(lerp(-1.8, 1.8, u), lerp(2.8, 5.8, u), lerp(8.6, 7.2, u));
        _camLook.set(0, lerp(2.8, 4.8, u), -4.8);
      } else {
        this.camera.position.set(lerp(1.8, 3.4, u), lerp(5.8, 8.6, u), lerp(7.2, 12.6, u));
        _camLook.set(0, 4.5, -7.8);
      }
    } else if (worldId === 'armoredStreet') {
      // Wheels spin & streetlamps whiz past while armored truck cruises smoothly
      for (const w of this.truckWheels) {
        w.rotation.x = t * 9.5;
      }
      const beaconPulse = 1.2 + Math.sin(t * 14) * 0.8;
      (this.truckBeacon.material as THREE.MeshStandardMaterial).emissiveIntensity = beaconPulse;

      for (let i = 0; i < this.streetLampsArmored.length; i++) {
        const z = ((12 - i * 9 - shotElapsed * 14) % 72 + 72) % 72 - 36;
        this.streetLampsArmored[i].position.z = z;
      }
      this.armoredTruck.position.set(0, Math.sin(t * 12) * 0.02, lerp(-2.2, 1.8, u));
      this.camera.position.set(lerp(5.6, 6.3, u), 3.1, lerp(10.0, 11.8, u));
      _camLook.set(0, 1.75, this.armoredTruck.position.z + 0.8);
    } else if (worldId === 'localVault') {
      // Cash drawers glide smoothly open revealing neat $100 stacks
      for (let i = 0; i < this.vaultDrawers.length; i++) {
        const open = easeOutCubic(clamp((u - (i % 3) * 0.12) / 0.65, 0, 1));
        this.vaultDrawers[i].position.z = lerp(-3.4, -2.05, open);
      }
      this.camera.position.set(lerp(-2.2, 2.0, u), lerp(2.8, 3.2, u), lerp(5.8, 4.6, u));
      _camLook.set(0, 2.3, -2.4);
    } else if (worldId === 'streetAtm') {
      // 3D Jordan & Maya grounded strictly on sidewalk y = 0, framed cleanly inside y 900..1720
      this.mountCharactersTo(this.streetCharAnchor);
      const man = this.chars3D.man;
      const woman = this.chars3D.woman;

      // Reset background building illumination before Shot 18
      const storeLit = shot.id === 18 ? easeOutCubic(clamp((t - 32.55) / 0.4, 0, 1)) : 0;
      const bankLit = shot.id === 18 ? easeOutCubic(clamp((t - 33.35) / 0.4, 0, 1)) : 0;
      const govLit = shot.id === 18 ? easeOutCubic(clamp((t - 34.15) / 0.4, 0, 1)) : 0;

      this.bldgStoreMat.emissiveIntensity = lerp(0.04, 0.55, storeLit);
      this.bldgStoreSignMat.emissiveIntensity = lerp(0.06, 1.25, storeLit);
      this.bldgBankMat.emissiveIntensity = lerp(0.04, 0.55, bankLit);
      this.bldgBankSignMat.emissiveIntensity = lerp(0.06, 1.25, bankLit);
      this.bldgGovMat.emissiveIntensity = lerp(0.04, 0.55, govLit);
      this.bldgGovSignMat.emissiveIntensity = lerp(0.06, 1.25, govLit);

      this.atmCashBill.visible = shot.id === 14 && t < 25.4;
      if (shot.id === 14) {
        const billOut = clamp(invLerp(24.9, 25.35, t), 0, 1);
        this.atmCashBill.position.z = lerp(0.38, 0.58, billOut);
      }

      if (shot.id === 14) {
        // 24.10-26.40: Jordan walks up to ATM (walking -> looking) and pulls out the note
        man.container.visible = true;
        woman.container.visible = false;
        const walkDone = clamp(invLerp(24.1, 25.25, t), 0, 1);
        man.container.position.set(lerp(1.4, -0.5, easeOutCubic(walkDone)), 0, lerp(0.85, 0.35, walkDone));
        man.container.rotation.y = lerp(-0.85, -0.45, walkDone);

        if (t < 25.25) {
          man.evaluateAt(t, { clip: 'walking', clipStart: 24.1, holdingNote: false });
        } else {
          man.evaluateAt(t, {
            clip: 'looking',
            clipStart: 25.25,
            prevClip: 'walking',
            prevClipStart: 24.1,
            crossfadeDuration: 0.3,
            holdingNote: true,
          });
        }

        // Wide comfortable dusk street framing (full character + ATM + streetlamp + sky)
        this.camera.position.set(lerp(1.2, 0.65, u), 2.1, lerp(6.8, 6.2, u));
        _camLook.set(-0.35, 1.78, 0.0);
      } else if (shot.id === 15 || shot.id === 16) {
        // 26.40-30.00 (Line 6): Medium-wide shot of Jordan holding the note under streetlight
        man.container.visible = true;
        woman.container.visible = false;
        man.container.position.set(-0.08, 0, 0.35);
        man.container.rotation.y = 0.16;

        const isSpeaking = t >= 26.62 && t <= 29.93;
        if (shot.id === 15) {
          man.evaluateAt(t, {
            clip: 'shrugging',
            clipStart: 26.4,
            prevClip: 'looking',
            prevClipStart: 25.25,
            crossfadeDuration: 0.3,
            isSpeaking,
            holdingNote: true,
          });
          this.camera.position.set(lerp(-0.45, 0.35, u), 1.98, lerp(5.45, 5.1, u));
          _camLook.set(-0.08, 1.75, 0.35);
        } else {
          man.evaluateAt(t, {
            clip: 'talking',
            clipStart: 28.2,
            prevClip: 'shrugging',
            prevClipStart: 26.4,
            crossfadeDuration: 0.3,
            isSpeaking,
            holdingNote: true,
          });
          this.camera.position.set(lerp(0.45, 1.15, u), 1.95, lerp(5.2, 5.55, u));
          _camLook.set(-0.08, 1.75, 0.35);
        }
      } else if (shot.id === 17) {
        // 30.00-32.40 (Line 7): Maya walks into frame beside Jordan (walking -> talking)
        man.container.visible = true;
        woman.container.visible = true;

        man.container.position.set(-0.68, 0, 0.25);
        man.container.rotation.y = 0.36;
        man.evaluateAt(t, {
          clip: 'idle',
          clipStart: 30.0,
          prevClip: 'talking',
          prevClipStart: 28.2,
          crossfadeDuration: 0.3,
          holdingNote: true,
        });

        const walkIn = clamp(invLerp(30.0, 31.15, t), 0, 1);
        woman.container.position.set(lerp(2.25, 0.62, easeOutCubic(walkIn)), 0, 0.25);
        woman.container.rotation.y = lerp(-1.15, -0.3, walkIn);
        const isWomanSpeaking = t >= 30.11 && t <= 35.0;

        if (t < 31.15) {
          woman.evaluateAt(t, { clip: 'walking', clipStart: 30.0, isSpeaking: isWomanSpeaking });
        } else {
          woman.evaluateAt(t, {
            clip: 'talking',
            clipStart: 31.15,
            prevClip: 'walking',
            prevClipStart: 30.0,
            crossfadeDuration: 0.3,
            isSpeaking: isWomanSpeaking,
          });
        }

        this.camera.position.set(lerp(0.2, -0.1, u), 2.02, lerp(6.65, 6.25, u));
        _camLook.set(0.0, 1.78, 0.1);
      } else if (shot.id === 18) {
        // 32.40-35.10 (Line 7): Maya points; STORE, BANK, GOVERNMENT buildings light up behind them
        man.container.visible = true;
        woman.container.visible = true;

        man.container.position.set(-0.7, 0, 0.35);
        man.container.rotation.y = 0.3;
        man.evaluateAt(t, { clip: 'looking', clipStart: 32.4, prevClip: 'idle', prevClipStart: 30.0, holdingNote: true });

        woman.container.position.set(0.68, 0, 0.35);
        woman.container.rotation.y = -0.24;
        woman.evaluateAt(t, {
          clip: 'pointing',
          clipStart: 32.4,
          prevClip: 'talking',
          prevClipStart: 31.15,
          crossfadeDuration: 0.3,
          isSpeaking: t <= 35.0,
        });

        // Wide establishing pullback so both full characters & all 3 illuminated buildings fit comfortably
        this.camera.position.set(lerp(-0.25, 0.35, u), 2.15, lerp(7.35, 8.1, u));
        _camLook.set(0, 2.25, -3.0);
      } else {
        // Shots 27-28 (48.70-52.20, Line 10): Jordan laughing/cheering with the crisp new note
        man.container.visible = true;
        woman.container.visible = false;
        man.container.position.set(0, 0, 0.35);
        man.container.rotation.y = 0.08;

        const isSpeaking = t >= 48.75 && t <= 52.09;
        man.evaluateAt(t, {
          clip: 'cheering',
          clipStart: 48.7,
          isSpeaking,
          holdingNote: true,
        });

        if (shot.id === 27) {
          this.camera.position.set(lerp(-0.5, 0.3, u), 2.0, lerp(5.65, 5.25, u));
          _camLook.set(0, 1.76, 0.35);
        } else {
          this.camera.position.set(lerp(0.3, 0.95, u), 2.02, lerp(5.25, 5.65, u));
          _camLook.set(0, 1.76, 0.35);
        }
      }
    } else if (worldId === 'legalDesk') {
      this.legalDeskBill.position.y = 0.07 + Math.sin(t * 2.5) * 0.008;
      this.camera.position.set(lerp(-0.45, 0.45, u), lerp(5.65, 5.05, u), lerp(4.65, 3.95, u));
      _camLook.set(0, 0.15, 0.25);
    } else if (worldId === 'trustCity') {
      this.trustLettersGroup.position.y = Math.sin(t * 1.6) * 0.18;
      this.camera.position.set(lerp(-2.8, 2.8, u), lerp(4.2, 6.4, u), lerp(15.2, 11.8, u));
      _camLook.set(0, 5.4, -5.5);
    } else if (worldId === 'montage') {
      this.montageCafe.visible = shot.id === 22;
      this.montageTaxi.visible = shot.id === 23;
      this.montageShop.visible = shot.id === 24;

      // Bill smoothly slides hand-to-hand across the counter on every montage cut
      const slide = easeOutCubic(u);
      this.montageBill.position.set(lerp(-1.0, 0.95, slide), 1.36 + Math.sin(u * Math.PI) * 0.2, 0.25);
      this.montageBill.rotation.z = lerp(-0.18, 0.16, slide);

      this.camera.position.set(lerp(-0.65, 0.65, u), 3.85, lerp(5.6, 5.0, u));
      _camLook.set(0, 1.4, 0.1);
    } else if (worldId === 'wornNote') {
      this.bokehPass.enabled = !this.isSoftwareGl;
      const bokehUniforms = this.bokehPass.uniforms as Record<string, THREE.IUniform>;
      if (bokehUniforms.focus) bokehUniforms.focus.value = 5.6;

      // Crossfade crisp note into creased/faded/torn note over shot duration
      const wear = easeInOutCubic(clamp(u / 0.78, 0, 1));
      (this.wornNoteCrispMesh.material as THREE.MeshStandardMaterial).opacity = 1 - wear;
      (this.wornNoteDamagedMesh.material as THREE.MeshStandardMaterial).opacity = wear;
      const rotY = lerp(-0.22, 0.28, u);
      this.wornNoteCrispMesh.rotation.set(0.1, rotY, Math.sin(t * 1.4) * 0.04);
      this.wornNoteDamagedMesh.rotation.copy(this.wornNoteCrispMesh.rotation);

      this.camera.position.set(lerp(-0.4, 0.45, u), 1.48, lerp(6.0, 5.35, u));
      _camLook.set(0, 1.32, 0);
    } else if (worldId === 'shredder') {
      this.shredderRollerL.rotation.x = t * 14;
      this.shredderRollerR.rotation.x = -t * 14;

      const shredDone = clamp(u / 0.56, 0, 1);
      this.shredderWornIn.visible = u < 0.58;
      this.shredderWornIn.position.y = lerp(4.1, 2.55, easeInOutCubic(shredDone));
      this.shredderWornIn.scale.y = clamp(1 - shredDone * 0.9, 0.05, 1);

      // Green confetti strips shower out underneath the rollers
      for (let i = 0; i < this.confettiSeeds.length; i++) {
        const s = this.confettiSeeds[i];
        const age = Math.max(0, shotElapsed - s.phase * 0.65);
        const active = age > 0 && age < 1.85;
        if (active) {
          _dummy.position.set(
            s.x + Math.sin(age * 6 + s.rot) * 0.25,
            Math.max(0.06, 2.45 - age * s.speed),
            s.z + Math.cos(age * 5 + s.rot) * 0.35,
          );
          _dummy.rotation.set(age * 6 + s.rot, age * 4, s.rot);
          _dummy.scale.setScalar(1);
        } else {
          _dummy.position.set(0, -10, 0);
          _dummy.scale.setScalar(0.001);
        }
        _dummy.updateMatrix();
        this.shredderConfetti.setMatrixAt(i, _dummy.matrix);
      }
      this.shredderConfetti.instanceMatrix.needsUpdate = true;

      // Fresh crisp $100 note drops cleanly into center light after shred (u >= 0.55)
      if (u >= 0.55) {
        const dropP = easeOutBack(clamp((u - 0.55) / 0.36, 0, 1), 1.2);
        this.shredderFreshOut.visible = true;
        this.shredderFreshOut.position.set(0, lerp(5.4, 2.65, dropP), 1.55);
        this.shredderFreshOut.rotation.set(0.06, Math.sin(t * 2.2) * 0.16, 0);
      } else {
        this.shredderFreshOut.visible = false;
      }

      this.camera.position.set(lerp(-0.65, 0.6, u), lerp(3.15, 2.9, u), lerp(8.4, 7.4, u));
      _camLook.set(0, 2.45, 0.3);
    } else if (worldId === 'finale') {
      // Shots 29-30: Glowing card #4/#5 + Both 3D Jordan & Maya in front (idle) + Dissolving stack
      this.mountCharactersTo(this.finaleCharAnchor);
      const man = this.chars3D.man;
      const woman = this.chars3D.woman;
      man.container.visible = true;
      woman.container.visible = true;

      man.container.position.set(-0.96, 0, 0.85);
      man.container.rotation.y = 0.22;
      man.evaluateAt(t, { clip: 'idle', clipStart: 52.2, holdingNote: false });

      woman.container.position.set(0.96, 0, 0.85);
      woman.container.rotation.y = -0.22;
      woman.evaluateAt(t, { clip: 'idle', clipStart: 52.2, holdingNote: false });

      if (shot.id === 29) {
        // Card "#4" slowly turns in 3D above both characters
        this.finaleCardGroup.position.set(0, 3.15 + Math.sin(t * 1.9) * 0.1, -1.35);
        this.finaleCardGroup.rotation.set(0.04, Math.sin(shotElapsed * 0.9) * 0.38, 0);
        this.finaleDissolveStack.visible = true;
        this.finaleDissolveStack.scale.setScalar(1);
        this.finaleParticles.visible = false;

        this.camera.position.set(lerp(-0.45, 0.45, u), 2.25, lerp(7.8, 7.3, u));
        _camLook.set(0, 2.15, -0.35);
      } else {
        // Shot 30 (55.00-57.80): Card flips to #5 & stack of money dissolves upward into particles
        const flipP = easeInOutCubic(clamp(shotElapsed / 0.85, 0, 1));
        this.finaleCardGroup.position.set(0, 3.15 + Math.sin(t * 2.1) * 0.1, -1.35);
        this.finaleCardGroup.rotation.set(0.04, lerp(0, Math.PI, flipP) + Math.sin(shotElapsed * 1.1) * 0.16, 0);

        const dissolveP = clamp(shotElapsed / 2.1, 0, 1);
        this.finaleDissolveStack.visible = dissolveP < 0.85;
        this.finaleDissolveStack.scale.set(
          1,
          Math.max(0.02, 1 - easeInOutCubic(dissolveP)),
          1,
        );

        this.finaleParticles.visible = true;
        for (let i = 0; i < this.dissolveSeeds.length; i++) {
          const s = this.dissolveSeeds[i];
          const age = Math.max(0, shotElapsed - s.delay);
          const life = clamp(age / 1.9, 0, 1);
          if (age > 0 && life < 1) {
            const sc = Math.sin(life * Math.PI) * 1.15;
            _dummy.position.set(
              s.x + s.vx * age,
              s.y + s.vy * age,
              0.1 + s.z + s.vz * age,
            );
            _dummy.rotation.set(age * 4, age * 3, age * 2);
            _dummy.scale.setScalar(sc);
          } else {
            _dummy.position.set(0, -10, 0);
            _dummy.scale.setScalar(0.001);
          }
          _dummy.updateMatrix();
          this.finaleParticles.setMatrixAt(i, _dummy.matrix);
        }
        this.finaleParticles.instanceMatrix.needsUpdate = true;

        this.camera.position.set(lerp(0.45, -0.35, u), 2.3, lerp(7.3, 8.0, u));
        _camLook.set(0, 2.2, -0.35);
      }
    }

    this.camera.lookAt(_camLook);
    this.camera.updateProjectionMatrix();
    this.composer.render();
  }

  public dispose(): void {
    this.composer.dispose();
    this.renderer.dispose();
  }
}
