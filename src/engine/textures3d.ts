/**
 * High-resolution procedural CanvasTextures for Money Secrets #2 3D worlds & props.
 * All albedo textures use SRGBColorSpace and max anisotropy.
 * Zero external files or Math.random() calls.
 */

import * as THREE from 'three';
import { COLORS, createRng } from './prng';

function configureTex(tex: THREE.CanvasTexture, maxAniso: number): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

/** Dynamic 3D LED Debt Counter Monolith texture rolling up to $40,000,000,000,000 */
export interface DynamicDebtCounterTex {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  lastKey: string;
  update(trillions: number, alertRed: boolean): void;
}

export function createDebtCounterTexture(maxAniso: number): DynamicDebtCounterTex {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  const texture = configureTex(new THREE.CanvasTexture(canvas), maxAniso);

  const api: DynamicDebtCounterTex = {
    canvas,
    ctx,
    texture,
    lastKey: '',
    update(trillions: number, alertRed: boolean) {
      const clampedT = Math.max(0, Math.min(40, trillions));
      const key = `${Math.round(clampedT * 100)}_${alertRed ? 1 : 0}`;
      if (key === this.lastKey) return;
      this.lastKey = key;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Dark brushed LED cabinet face
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0B101B');
      bg.addColorStop(1, '#121828');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Scanline grid
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      for (let y = 0; y < h; y += 8) {
        ctx.fillRect(0, y, w, 2);
      }

      const borderCol = alertRed ? COLORS.alertRed : COLORS.highlightYellow;
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      // Top status header
      ctx.fillStyle = alertRed ? 'rgba(255, 59, 92, 0.18)' : 'rgba(255, 213, 74, 0.14)';
      ctx.fillRect(16, 16, w - 32, 68);

      ctx.fillStyle = borderCol;
      ctx.font = '800 32px "Poppins", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('U.S. NATIONAL DEBT CLOCK', w / 2, 52);

      // Format full 14-digit dollar counter ($40,000,000,000,000)
      const dollars = Math.round(clampedT * 1_000_000_000_000);
      const formatted = `$${dollars.toLocaleString('en-US')}`;

      ctx.fillStyle = alertRed ? COLORS.alertRed : '#FFE27A';
      ctx.font = '800 74px "Poppins", sans-serif';
      ctx.fillText(formatted, w / 2, 206, w - 64);

      // Bottom ticker strip
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = '700 26px "Poppins", sans-serif';
      ctx.fillText('WHO ACTUALLY OWNS THIS DEBT?', w / 2, 322);

      texture.needsUpdate = true;
    },
  };

  api.update(40, false);
  return api;
}

/** Procedural lit night skyscraper window texture (warm + cyan lit panes) */
export function createCityWindowTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const rng = createRng(40402);

  ctx.fillStyle = '#0D1320';
  ctx.fillRect(0, 0, 512, 1024);

  const cols = 8;
  const rows = 28;
  const padX = 14;
  const padY = 12;
  const cellW = (512 - padX * 2) / cols;
  const cellH = (1024 - padY * 2) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const litRoll = rng.next();
      const x = padX + c * cellW + 5;
      const y = padY + r * cellH + 5;
      const w = cellW - 10;
      const h = cellH - 10;

      if (litRoll > 0.62) {
        const warm = rng.next() > 0.32;
        ctx.fillStyle = warm
          ? `rgba(255, 210, 128, ${rng.range(0.35, 0.78)})`
          : `rgba(92, 224, 255, ${rng.range(0.28, 0.65)})`;
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.fillStyle = '#151E30';
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  const tex = configureTex(new THREE.CanvasTexture(canvas), maxAniso);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Stylized 3D Earth Globe equirectangular texture (2048x1024).
 * Uses accurate longitude/latitude mapping so Japan (138°E, 36°N), UK (-2°W, 54°N),
 * and China (104°E, 35°N) align cleanly with 3D surface pins! Zero logos.
 */
export function createEarthGlobeTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  // Deep space ocean gradient
  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, '#091A30');
  ocean.addColorStop(0.5, '#071426');
  ocean.addColorStop(1, '#0A1C33');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, w, h);

  // Subtle lat/lon tactical grid
  ctx.strokeStyle = 'rgba(60, 224, 255, 0.14)';
  ctx.lineWidth = 2;
  for (let lon = -180; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const drawContinent = (
    pts: [number, number][], // [lon, lat]
    fill: string,
    stroke: string,
  ) => {
    ctx.beginPath();
    pts.forEach(([lon, lat], idx) => {
      const x = ((lon + 180) / 360) * w;
      const y = ((90 - lat) / 180) * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 4;
    ctx.stroke();
  };

  const landFill = '#183C54';
  const landEdge = '#3CE0FF';

  // North America
  drawContinent(
    [
      [-165, 65], [-140, 70], [-95, 70], [-75, 60], [-55, 48],
      [-75, 35], [-82, 25], [-98, 20], [-105, 16], [-115, 28],
      [-125, 42], [-138, 56],
    ],
    landFill,
    landEdge,
  );

  // South America
  drawContinent(
    [
      [-80, 10], [-60, 8], [-36, -6], [-40, -22], [-54, -36],
      [-68, -54], [-75, -44], [-80, -18], [-82, -2],
    ],
    landFill,
    landEdge,
  );

  // Europe
  drawContinent(
    [
      [-9, 38], [5, 43], [16, 42], [28, 42], [42, 48], [58, 66],
      [28, 70], [10, 62], [4, 52], [-4, 48],
    ],
    landFill,
    landEdge,
  );

  // UK highlight island (lon ~ -2, lat ~ 54)
  drawContinent(
    [[-6, 51], [1.5, 51], [1, 58], [-5, 58.5]],
    '#1F6A52',
    COLORS.moneyGreen,
  );

  // Africa
  drawContinent(
    [
      [-16, 16], [-6, 35], [12, 36], [33, 30], [43, 12], [50, 10],
      [40, -14], [28, -33], [16, -33], [10, -6], [-8, 5],
    ],
    landFill,
    landEdge,
  );

  // Asia
  drawContinent(
    [
      [40, 46], [58, 68], [100, 72], [150, 68], [168, 60],
      [142, 48], [130, 38], [122, 30], [114, 22], [106, 10],
      [96, 16], [82, 12], [68, 24], [54, 24], [42, 34],
    ],
    landFill,
    landEdge,
  );

  // China highlight region (lon 80..124, lat 20..48)
  drawContinent(
    [
      [78, 38], [96, 44], [122, 48], [128, 42], [120, 31],
      [114, 22], [104, 21], [94, 28], [82, 30],
    ],
    '#4A1E2E',
    COLORS.alertRed,
  );

  // Japan highlight archipelago (lon ~ 138, lat ~ 36)
  drawContinent(
    [[130, 32], [137, 34], [142, 40], [145, 44], [140, 43], [134, 37]],
    '#1F5D6B',
    COLORS.highlightYellow,
  );

  // Australia
  drawContinent(
    [
      [114, -22], [132, -12], [146, -15], [153, -28],
      [145, -38], [128, -34], [115, -33],
    ],
    landFill,
    landEdge,
  );

  return configureTex(new THREE.CanvasTexture(canvas), maxAniso);
}

export function createMarbleTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const rng = createRng(9002);

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#1B202C');
  grad.addColorStop(0.5, '#262D3D');
  grad.addColorStop(1, '#151924');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 28; i++) {
    ctx.beginPath();
    let x = rng.range(0, 512);
    let y = rng.range(0, 512);
    ctx.moveTo(x, y);
    for (let s = 0; s < 14; s++) {
      x += rng.range(-45, 55);
      y += rng.range(10, 45);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle =
      i % 4 === 0
        ? `rgba(255, 213, 74, ${rng.range(0.06, 0.16)})`
        : `rgba(180, 195, 225, ${rng.range(0.04, 0.13)})`;
    ctx.lineWidth = rng.range(1, 3.5);
    ctx.stroke();
  }

  const tex = configureTex(new THREE.CanvasTexture(canvas), maxAniso);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createGridFloorTexture(
  maxAniso: number,
  lineHex: string,
  bgHex: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = lineHex;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 508);

  const tex = configureTex(new THREE.CanvasTexture(canvas), maxAniso);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 22);
  return tex;
}

export function createSignPanelTexture(
  maxAniso: number,
  title: string,
  subtitle: string,
  accentHex: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0F131E';
  ctx.fillRect(0, 0, 768, 384);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, 740, 356);

  ctx.fillStyle = accentHex;
  ctx.fillRect(14, 14, 740, 26);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 74px "Poppins", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 384, subtitle ? 168 : 204, 680);

  if (subtitle) {
    ctx.fillStyle = accentHex;
    ctx.font = '700 38px "Poppins", sans-serif';
    ctx.fillText(subtitle, 384, 278, 680);
  }

  return configureTex(new THREE.CanvasTexture(canvas), maxAniso);
}

export function createJar401kTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0F1A1A';
  ctx.fillRect(0, 0, 768, 512);

  ctx.strokeStyle = COLORS.moneyGreen;
  ctx.lineWidth = 14;
  ctx.strokeRect(16, 16, 736, 480);

  ctx.fillStyle = 'rgba(34, 224, 122, 0.16)';
  ctx.fillRect(24, 24, 720, 120);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.moneyGreen;
  ctx.font = '700 44px "Poppins", sans-serif';
  ctx.fillText('RETIREMENT SAVINGS', 384, 86);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 118px "Poppins", sans-serif';
  ctx.fillText('YOUR 401(k)', 384, 285, 680);

  ctx.fillStyle = COLORS.highlightYellow;
  ctx.font = '700 40px "Poppins", sans-serif';
  ctx.fillText('HOLDS U.S. TREASURIES', 384, 415);

  return configureTex(new THREE.CanvasTexture(canvas), maxAniso);
}

/**
 * Finale 3D Collector Card texture:
 *   front -> "MONEY SECRET #2 · WHO OWNS AMERICA'S DEBT?"
 *   back  -> "#3: WHY BANKS PAY YOU ALMOST NOTHING" with tiny "0.5%" vs huge "25%"
 */
export function createCollectorCardTexture(
  maxAniso: number,
  side: 'front' | 'back',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 768, 1024);
  if (side === 'front') {
    grad.addColorStop(0, '#141B29');
    grad.addColorStop(0.5, '#0C121D');
    grad.addColorStop(1, '#192218');
  } else {
    grad.addColorStop(0, '#121728');
    grad.addColorStop(0.5, '#0D1322');
    grad.addColorStop(1, '#26121C');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 768, 1024);

  ctx.strokeStyle = side === 'front' ? 'rgba(255,213,74,0.14)' : 'rgba(60,224,255,0.16)';
  ctx.lineWidth = 3;
  for (let r = 120; r <= 420; r += 75) {
    ctx.beginPath();
    ctx.arc(384, 512, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const borderCol = side === 'front' ? COLORS.highlightYellow : COLORS.cyan;
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 18;
  ctx.strokeRect(24, 24, 720, 976);
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, 672, 928);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (side === 'front') {
    ctx.fillStyle = COLORS.moneyGreen;
    ctx.font = '700 36px "Poppins", sans-serif';
    ctx.fillText('VOICE OF TIMES', 384, 152);

    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 84px "Poppins", sans-serif';
    ctx.fillText('MONEY', 384, 345);
    ctx.fillText('SECRET', 384, 445);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 184px "Poppins", sans-serif';
    ctx.fillText('#2', 384, 650);

    ctx.fillStyle = COLORS.moneyGreen;
    ctx.font = '700 36px "Poppins", sans-serif';
    ctx.fillText('WHO OWNS THE $40T DEBT', 384, 845);
  } else {
    ctx.fillStyle = COLORS.cyan;
    ctx.font = '700 36px "Poppins", sans-serif';
    ctx.fillText('NEXT EPISODE', 384, 128);

    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 104px "Poppins", sans-serif';
    ctx.fillText('#3', 384, 238);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 46px "Poppins", sans-serif';
    ctx.fillText('WHY BANKS PAY YOU', 384, 348);
    ctx.fillStyle = COLORS.alertRed;
    ctx.font = '800 50px "Poppins", sans-serif';
    ctx.fillText('ALMOST NOTHING', 384, 412);

    // Tiny "0.5%" vs Huge "25%" comparison box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(88, 490, 592, 340);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 3;
    ctx.strokeRect(88, 490, 592, 340);

    // Left tiny 0.5%
    ctx.fillStyle = '#9BA4B5';
    ctx.font = '700 26px "Poppins", sans-serif';
    ctx.fillText('YOUR SAVINGS', 218, 560);
    ctx.fillStyle = COLORS.alertRed;
    ctx.font = '800 46px "Poppins", sans-serif';
    ctx.fillText('0.5%', 218, 680);

    // VS divider
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '800 30px "Poppins", sans-serif';
    ctx.fillText('VS', 342, 680);

    // Right huge 25%
    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '700 26px "Poppins", sans-serif';
    ctx.fillText('BANK CREDIT CARD', 515, 560);
    ctx.fillStyle = COLORS.moneyGreen;
    ctx.font = '800 142px "Poppins", sans-serif';
    ctx.fillText('25%', 515, 690);

    ctx.fillStyle = COLORS.cyan;
    ctx.font = '700 34px "Poppins", sans-serif';
    ctx.fillText('FOLLOW FOR SECRET #3', 384, 902);
  }

  return configureTex(new THREE.CanvasTexture(canvas), maxAniso);
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.32)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Deterministic still film grain overlay canvas (pre-baked alpha for 100% GPU source-over compositing) */
export function createStillGrainCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const gw = Math.floor(w / 2);
  const gh = Math.floor(h / 2);
  canvas.width = gw;
  canvas.height = gh;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(gw, gh);
  const data = img.data;
  const rng = createRng(202602);
  for (let i = 0; i < data.length; i += 4) {
    const r = rng.next();
    const bright = r > 0.5 ? 255 : 0;
    const strength = Math.abs(r - 0.5) * 2;
    data[i] = bright;
    data[i + 1] = bright;
    data[i + 2] = bright;
    data[i + 3] = Math.floor(strength * 255);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
