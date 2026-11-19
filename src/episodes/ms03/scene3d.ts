/**
 * Money Secrets #3 — "Sticky Money: 0.4% vs 20%"
 * Deterministic Three.js 3D Engine (8 composite 3D worlds, calibrated HDR bloom, zero voids).
 * Every single frame is a pure function of time t (seconds) with seeded PRNG.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
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
  createContactShadowTexture,
  createGridFloorTexture,
  createMarbleTexture,
  createSignPanelTexture,
} from '../../engine/textures3d';
import { MS03_META } from './meta';

type WorldId =
  | 'bankLobby'
  | 'piggyVault'
  | 'pedestalStack'
  | 'aprBars'
  | 'fedVault'
  | 'stickyHoney'
  | 'onlineVault'
  | 'finale';

const getShotAt = (t: number) => getShotAtForMeta(MS03_META, t);

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
  bankLobby: {
    top: 0x070a14,
    mid: 0x111829,
    bottom: 0x0c0f19,
    fog: 0x0e1322,
    fogDensity: 0.017,
    keyColor: 0xffe4b8,
    keyIntensity: 1.25,
    rimColor: 0x3ce0ff,
    rimIntensity: 0.85,
    bloomStrength: 0.28,
  },
  piggyVault: {
    top: 0x080a16,
    mid: 0x161a2e,
    bottom: 0x0b0e18,
    fog: 0x101424,
    fogDensity: 0.018,
    keyColor: 0xffd7a3,
    keyIntensity: 1.2,
    rimColor: 0xff5a9d,
    rimIntensity: 0.9,
    bloomStrength: 0.28,
  },
  pedestalStack: {
    top: 0x050911,
    mid: 0x0c1724,
    bottom: 0x070c14,
    fog: 0x09111d,
    fogDensity: 0.02,
    keyColor: 0xfff0d4,
    keyIntensity: 1.35,
    rimColor: 0x22e07a,
    rimIntensity: 0.85,
    bloomStrength: 0.26,
  },
  aprBars: {
    top: 0x0a0612,
    mid: 0x1a0d22,
    bottom: 0x0c0914,
    fog: 0x140b1c,
    fogDensity: 0.014,
    keyColor: 0xffd4c2,
    keyIntensity: 1.15,
    rimColor: 0xff3b5c,
    rimIntensity: 1.05,
    bloomStrength: 0.3,
  },
  fedVault: {
    top: 0x050c18,
    mid: 0x0d1e34,
    bottom: 0x07101d,
    fog: 0x0a1628,
    fogDensity: 0.016,
    keyColor: 0xe6f4ff,
    keyIntensity: 1.25,
    rimColor: 0x3ce0ff,
    rimIntensity: 1.0,
    bloomStrength: 0.3,
  },
  stickyHoney: {
    top: 0x120a04,
    mid: 0x261507,
    bottom: 0x100904,
    fog: 0x1b0f05,
    fogDensity: 0.019,
    keyColor: 0xffd57a,
    keyIntensity: 1.3,
    rimColor: 0xffa62b,
    rimIntensity: 1.05,
    bloomStrength: 0.3,
  },
  onlineVault: {
    top: 0x041218,
    mid: 0x0a262d,
    bottom: 0x061419,
    fog: 0x081e24,
    fogDensity: 0.016,
    keyColor: 0xdffef5,
    keyIntensity: 1.3,
    rimColor: 0x22e07a,
    rimIntensity: 1.1,
    bloomStrength: 0.31,
  },
  finale: {
    top: 0x070a18,
    mid: 0x141d34,
    bottom: 0x080c16,
    fog: 0x0c1324,
    fogDensity: 0.015,
    keyColor: 0xffe4a8,
    keyIntensity: 1.3,
    rimColor: 0x3ce0ff,
    rimIntensity: 0.95,
    bloomStrength: 0.3,
  },
};

function configureTex(tex: THREE.CanvasTexture, maxAniso: number): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

/** Procedural coin face texture ("0.4%" or "$") */
function createCoinFaceTexture(label: string, accentHex: string, maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createRadialGradient(210, 190, 30, 256, 256, 256);
  grad.addColorStop(0, '#FFF1A8');
  grad.addColorStop(0.55, '#E4B13A');
  grad.addColorStop(1, '#986C14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#FFF5C4';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(256, 256, 218, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(72, 46, 8, 0.55)';
  ctx.lineWidth = 8;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.arc(256, 256, 192, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#2B1B04';
  ctx.font = '800 132px "Poppins", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 266);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.strokeText(label, 256, 266);

  return configureTex(new THREE.CanvasTexture(c), maxAniso);
}

/** Procedural generic 3D credit card face (NO real logos or brands, bold engraved "20%") */
function createGenericCardTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 640;
  const ctx = c.getContext('2d')!;

  // Matte obsidian-crimson brushed metal card
  const bg = ctx.createLinearGradient(0, 0, 1024, 640);
  bg.addColorStop(0, '#1B1118');
  bg.addColorStop(0.52, '#2B111C');
  bg.addColorStop(1, '#120C14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 640);

  // Subtle brushed metal micro-lines
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let y = 0; y < 640; y += 6) {
    ctx.fillRect(0, y, 1024, 2);
  }

  // Crimson rim border
  ctx.strokeStyle = COLORS.alertRed;
  ctx.lineWidth = 14;
  ctx.strokeRect(20, 20, 984, 600);

  // Generic gold EMV chip on upper-left
  const chipGrad = ctx.createLinearGradient(88, 128, 224, 228);
  chipGrad.addColorStop(0, '#FFE48C');
  chipGrad.addColorStop(1, '#BA8520');
  ctx.fillStyle = chipGrad;
  ctx.beginPath();
  ctx.roundRect(88, 130, 140, 102, 16);
  ctx.fill();
  ctx.strokeStyle = '#573B08';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(136, 130);
  ctx.lineTo(136, 232);
  ctx.moveTo(182, 130);
  ctx.lineTo(182, 232);
  ctx.moveTo(88, 181);
  ctx.lineTo(228, 181);
  ctx.stroke();

  // Header label (strictly generic)
  ctx.fillStyle = 'rgba(255, 190, 204, 0.72)';
  ctx.font = '700 32px "Poppins", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('CREDIT CARD APR', 940, 68);

  // HUGE engraved "20%"
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 260px "Poppins", sans-serif';
  ctx.fillStyle = '#090509';
  ctx.fillText('20%', 564, 344);
  ctx.fillStyle = COLORS.alertRed;
  ctx.fillText('20%', 556, 336);
  ctx.strokeStyle = '#FFB3C1';
  ctx.lineWidth = 5;
  ctx.strokeText('20%', 556, 336);

  // Generic masked digits strip (no real format/logo)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = '700 34px "Poppins", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('••••   ••••   ••••   0000', 88, 540);

  return configureTex(new THREE.CanvasTexture(c), maxAniso);
}

/** Generic plain green banknote ("$100" text only — strictly NO real US $100 design) */
function createGenericBanknoteTexture(amountText: string, maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 460;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 1024, 460);
  grad.addColorStop(0, '#1D6B44');
  grad.addColorStop(0.5, '#278E5A');
  grad.addColorStop(1, '#195E3B');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 460);

  // Simple geometric border only
  ctx.strokeStyle = '#9EF5C4';
  ctx.lineWidth = 14;
  ctx.strokeRect(28, 28, 968, 404);

  ctx.strokeStyle = 'rgba(158, 245, 196, 0.45)';
  ctx.lineWidth = 4;
  ctx.strokeRect(52, 52, 920, 356);

  // Clean centered circle emblem
  ctx.fillStyle = 'rgba(10, 40, 24, 0.35)';
  ctx.beginPath();
  ctx.arc(512, 230, 146, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6FF0A8';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Amount text ONLY
  ctx.fillStyle = '#E8FFF2';
  ctx.font = '800 154px "Poppins", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(amountText, 512, 240);

  // Corner numbers
  ctx.font = '800 54px "Poppins", sans-serif';
  ctx.fillStyle = '#B8FBD6';
  ctx.textAlign = 'left';
  ctx.fillText(amountText, 76, 106);
  ctx.textAlign = 'right';
  ctx.fillText(amountText, 948, 366);

  return configureTex(new THREE.CanvasTexture(c), maxAniso);
}

/** Procedural golden honey sign texture for 3D "STICKY MONEY" slab */
function createHoneySlabTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#FFD452');
  grad.addColorStop(0.5, '#E59216');
  grad.addColorStop(1, '#9E5306');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Glossy honey wave streaks
  ctx.fillStyle = 'rgba(255, 244, 194, 0.32)';
  ctx.beginPath();
  ctx.ellipse(260, 110, 240, 42, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(760, 150, 190, 34, 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#572802';
  ctx.lineWidth = 18;
  ctx.strokeRect(18, 18, 988, 476);

  ctx.fillStyle = '#2B1100';
  ctx.font = '800 132px "Poppins", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('STICKY', 512, 186);
  ctx.fillText('MONEY', 512, 342);

  return configureTex(new THREE.CanvasTexture(c), maxAniso);
}

/** Procedural metallic collector card texture for Money Secrets #3 (front) and #4 teaser (back) */
function createMs03CollectorCardTexture(
  maxAniso: number,
  side: 'front' | 'back',
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 1080;
  const ctx = c.getContext('2d')!;

  const accent = side === 'front' ? COLORS.highlightYellow : COLORS.moneyGreen;
  const grad = ctx.createLinearGradient(0, 0, 768, 1080);
  if (side === 'front') {
    grad.addColorStop(0, '#10182E');
    grad.addColorStop(0.5, '#192746');
    grad.addColorStop(1, '#0B1020');
  } else {
    grad.addColorStop(0, '#091E1C');
    grad.addColorStop(0.5, '#10352D');
    grad.addColorStop(1, '#071412');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 768, 1080);

  // Subtle diagonal sheen lines
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 3;
  for (let i = -1080; i < 1800; i += 44) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 540, 1080);
    ctx.stroke();
  }

  // Metallic outer and inner borders
  ctx.strokeStyle = accent;
  ctx.lineWidth = 18;
  ctx.strokeRect(28, 28, 712, 1024);

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(54, 54, 660, 972);

  // Top channel header
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '700 32px "Poppins", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(side === 'front' ? 'VOICE OF TIMES' : 'NEXT EPISODE', 384, 128);

  // Accent divider
  ctx.fillStyle = accent;
  ctx.fillRect(214, 168, 340, 6);

  if (side === 'front') {
    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 54px "Poppins", sans-serif';
    ctx.fillText('MONEY SECRET', 384, 290);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 220px "Poppins", sans-serif';
    ctx.fillText('#3', 384, 495);

    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 62px "Poppins", sans-serif';
    ctx.fillText('STICKY MONEY', 384, 710);

    ctx.fillStyle = '#D7E7FF';
    ctx.font = '700 40px "Poppins", sans-serif';
    ctx.fillText('0.4% VS 20%', 384, 795);

    // Bottom badge strip
    ctx.fillStyle = 'rgba(34, 224, 122, 0.18)';
    ctx.fillRect(108, 882, 552, 86);
    ctx.strokeStyle = COLORS.moneyGreen;
    ctx.lineWidth = 4;
    ctx.strokeRect(108, 882, 552, 86);
    ctx.fillStyle = COLORS.moneyGreen;
    ctx.font = '800 36px "Poppins", sans-serif';
    ctx.fillText('MOVE IT → 4%+ APY', 384, 926);
  } else {
    ctx.fillStyle = COLORS.moneyGreen;
    ctx.font = '800 54px "Poppins", sans-serif';
    ctx.fillText('MONEY SECRET', 384, 275);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 210px "Poppins", sans-serif';
    ctx.fillText('#4', 384, 470);

    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 54px "Poppins", sans-serif';
    ctx.fillText('WHY A $100 BILL', 384, 675);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 46px "Poppins", sans-serif';
    ctx.fillText('COSTS LESS THAN $1', 384, 750);
    ctx.fillText('TO MAKE', 384, 812);

    ctx.fillStyle = 'rgba(255, 213, 74, 0.18)';
    ctx.fillRect(116, 892, 536, 82);
    ctx.strokeStyle = COLORS.highlightYellow;
    ctx.lineWidth = 4;
    ctx.strokeRect(116, 892, 536, 82);
    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 36px "Poppins", sans-serif';
    ctx.fillText('FOLLOW FOR #4', 384, 934);
  }

  return configureTex(new THREE.CanvasTexture(c), maxAniso);
}

/** Build a composite 3D piggy bank (9 distinct parts) */
function createPiggyBank3D(): THREE.Group {
  const group = new THREE.Group();
  const pinkMat = new THREE.MeshPhysicalMaterial({
    color: 0xf47fa9,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1520, roughness: 0.4, metalness: 0.2 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd54a,
    roughness: 0.22,
    metalness: 0.88,
    emissive: 0x5c4200,
    emissiveIntensity: 0.35,
  });

  // 1. Plump ceramic body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.95, 28, 22), pinkMat);
  body.scale.set(1.22, 0.92, 0.94);
  body.position.y = 0.96;
  group.add(body);

  // 2. Snout cylinder + 2 nostrils
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.34, 24), pinkMat);
  snout.rotation.z = Math.PI / 2;
  snout.position.set(1.16, 0.96, 0);
  group.add(snout);

  for (const nz of [-0.11, 0.11]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), darkMat);
    nostril.position.set(1.33, 0.98, nz);
    group.add(nostril);
  }

  // 3. Ears
  const earGeo = new THREE.ConeGeometry(0.24, 0.42, 12);
  for (const ez of [-0.42, 0.42]) {
    const ear = new THREE.Mesh(earGeo, pinkMat);
    ear.position.set(0.55, 1.66, ez);
    ear.rotation.z = -0.35;
    ear.rotation.x = ez > 0 ? 0.25 : -0.25;
    group.add(ear);
  }

  // 4. Eyes
  for (const ez of [-0.44, 0.44]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), darkMat);
    eye.position.set(0.84, 1.24, ez);
    group.add(eye);
  }

  // 5. Four stubby legs grounded at y=0
  const legGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.46, 14);
  const legPositions: [number, number][] = [
    [-0.55, -0.42],
    [-0.55, 0.42],
    [0.52, -0.42],
    [0.52, 0.42],
  ];
  for (const [lx, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, pinkMat);
    leg.position.set(lx, 0.23, lz);
    group.add(leg);
  }

  // 6. Top coin slot + gleaming half-inserted coin
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.1), darkMat);
  slot.position.set(0.02, 1.82, 0);
  group.add(slot);

  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 22), goldMat);
  coin.rotation.x = Math.PI / 2;
  coin.position.set(0.02, 1.92, 0);
  group.add(coin);

  // 7. Curly tail ring
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 10, 18), pinkMat);
  tail.position.set(-1.18, 1.06, 0);
  tail.rotation.y = Math.PI / 2;
  group.add(tail);

  return group;
}

/** Build a composite banded $10,000 stack of generic green bills */
function createCashStack3D(billTex: THREE.CanvasTexture, strapTex: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group();
  const billMat = new THREE.MeshStandardMaterial({
    map: billTex,
    roughness: 0.62,
    metalness: 0.08,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xd5e4d6,
    roughness: 0.78,
    metalness: 0.04,
  });

  // 5 layered bill bricks for crisp layered cash silhouette
  for (let i = 0; i < 5; i++) {
    const brick = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.22, 1.24),
      [edgeMat, edgeMat, billMat, billMat, edgeMat, edgeMat],
    );
    brick.position.y = 0.11 + i * 0.235;
    brick.rotation.y = (i - 2) * 0.015;
    group.add(brick);
  }

  // Metallic gold paper strap wrapping the middle with "$10,000"
  const strapMat = new THREE.MeshStandardMaterial({
    map: strapTex,
    roughness: 0.34,
    metalness: 0.45,
  });
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.22, 1.3), strapMat);
  strap.position.y = 0.6;
  group.add(strap);

  return group;
}

/** Build a fluted marble bank column (plinth + shaft + neck + capital) */
function createMarbleColumn(marbleMat: THREE.Material, brassMat: THREE.Material, height = 10.5): THREE.Group {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.5), marbleMat);
  plinth.position.y = 0.35;
  g.add(plinth);

  const ringBot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.28, 20), brassMat);
  ringBot.position.y = 0.84;
  g.add(ringBot);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, height - 1.8, 18), marbleMat);
  shaft.position.y = 0.98 + (height - 1.8) / 2;
  g.add(shaft);

  const ringTop = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.56, 0.28, 20), brassMat);
  ringTop.position.y = height - 0.72;
  g.add(ringTop);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.58, 1.56), marbleMat);
  cap.position.y = height - 0.29;
  g.add(cap);

  return g;
}

export class Ms03ThreeEngine implements Episode3DController {
  public readonly canvas: HTMLCanvasElement;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly isSoftwareGl: boolean;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly fog: THREE.FogExp2;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly dustPoints: THREE.Points;
  private readonly maxAniso: number;

  private readonly worlds: Record<WorldId, THREE.Group>;

  // Animated handles across worlds
  private lobbyCoin!: THREE.Group;
  private lobbyCard!: THREE.Group;
  private lobbyShockRing!: THREE.Mesh;

  private piggyFloating!: THREE.Group;
  private piggyTrailCoins!: THREE.InstancedMesh;
  private piggyVaultDoorPivot!: THREE.Group;

  private pedestalCash!: THREE.Group;
  private pedestalCoins39!: THREE.InstancedMesh;
  private pedestalSpotCone!: THREE.Mesh;

  private barGreenMesh!: THREE.Mesh;
  private barRedMesh!: THREE.Mesh;
  private barGreenCap!: THREE.Mesh;
  private barRedCap!: THREE.Mesh;

  private fedVaultGroup!: THREE.Group;
  private fedVaultWheel!: THREE.Group;
  private fedPiggy!: THREE.Group;
  private fedFlowCoins!: THREE.InstancedMesh;
  private fedProfitBridge!: THREE.Group;
  private giantBankDoorGroup!: THREE.Group;

  private honeyCoinsInst!: THREE.InstancedMesh;
  private honeyDripsInst!: THREE.InstancedMesh;
  private stickyMonolith!: THREE.Group;
  private stickyDripIcicles: THREE.Mesh[] = [];

  private onlineVaultHero!: THREE.Group;
  private onlineDoorLeft!: THREE.Mesh;
  private onlineDoorRight!: THREE.Mesh;
  private onlineLightRays!: THREE.Group;
  private flyingCashStack!: THREE.Group;
  private splitCompareGroup!: THREE.Group;
  private splitRightCoinsInst!: THREE.InstancedMesh;
  private speedTunnelGroup!: THREE.Group;
  private speedStreaksInst!: THREE.InstancedMesh;

  private finaleCardGroup!: THREE.Group;
  private finaleNoteGroup!: THREE.Group;
  private finaleCoinsInst!: THREE.InstancedMesh;
  private finaleCoinSeeds: Array<{ r: number; ang: number; y: number; spd: number; spin: number }> = [];

  private renderWidth = WIDTH;
  private renderHeight = HEIGHT;
  private pmremTex: THREE.Texture | null = null;

  constructor() {
    this.isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(WIDTH, HEIGHT, false);
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x0e1322, 0.017);
    this.scene.fog = this.fog;

    // Studio environment reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmremTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.pmremTex;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(46, WIDTH / HEIGHT, 0.1, 220);
    this.camera.position.set(0, 2.5, 11);

    // Sky dome gradient (guarantees zero empty black void in any direction)
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x070a14) },
        uMid: { value: new THREE.Color(0x111829) },
        uBottom: { value: new THREE.Color(0x0c0f19) },
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
            : mix(uMid, uBottom, pow(clamp(-h, 0.0, 1.0), 0.75));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 18), this.skyMat);
    this.scene.add(skyDome);

    // 3-Point studio lighting rig
    const hemi = new THREE.HemisphereLight(0xa6c8ff, 0x1a1e2e, 0.65);
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(0xffe4b8, 1.25);
    this.keyLight.position.set(6, 12, 8);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x3ce0ff, 0.85);
    this.rimLight.position.set(-8, 6, -7);
    this.scene.add(this.rimLight);

    // Ambient floating dust/star motes
    this.dustPoints = this.createDustField();
    this.scene.add(this.dustPoints);

    // Build all 8 self-contained 3D worlds
    this.worlds = {
      bankLobby: this.buildBankLobbyWorld(),
      piggyVault: this.buildPiggyVaultWorld(),
      pedestalStack: this.buildPedestalStackWorld(),
      aprBars: this.buildAprBarsWorld(),
      fedVault: this.buildFedVaultWorld(),
      stickyHoney: this.buildStickyHoneyWorld(),
      onlineVault: this.buildOnlineVaultWorld(),
      finale: this.buildFinaleWorld(),
    };

    (Object.values(this.worlds) as THREE.Group[]).forEach((g) => {
      g.visible = false;
      this.scene.add(g);
    });

    // Post-processing: calibrated restrained HDR UnrealBloomPass + OutputPass
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT), 0.28, 0.25, 1.18);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  public setResolution(width: number, height: number): void {
    if (this.renderWidth === width && this.renderHeight === height) return;
    this.renderWidth = width;
    this.renderHeight = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private createDustField(): THREE.Points {
    const rng = createRng(30301);
    const count = 240;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rng.range(-26, 26);
      positions[i * 3 + 1] = rng.range(0.5, 22);
      positions[i * 3 + 2] = rng.range(-26, 18);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xdceeff,
      size: 0.11,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  // --------------------------------------------------------------------------
  // WORLD 1: Grand Generic Bank Lobby (0.00-6.80 & 49.60-51.61 seamless loop)
  // --------------------------------------------------------------------------
  private buildBankLobbyWorld(): THREE.Group {
    const group = new THREE.Group();
    const marbleTex = createMarbleTexture(this.maxAniso);
    marbleTex.repeat.set(6, 6);
    marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping;

    const floorMat = new THREE.MeshStandardMaterial({
      map: marbleTex,
      color: 0x3b4358,
      roughness: 0.24,
      metalness: 0.18,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), floorMat);
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    const colMat = new THREE.MeshStandardMaterial({
      map: marbleTex,
      color: 0x626b82,
      roughness: 0.36,
      metalness: 0.12,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4a246,
      roughness: 0.24,
      metalness: 0.88,
    });

    // Colonnade on both sides + distant rear gallery wall (zero void!)
    for (let i = 0; i < 5; i++) {
      const z = 4 - i * 5.2;
      for (const side of [-1, 1]) {
        const col = createMarbleColumn(colMat, brassMat, 11.2);
        col.position.set(side * 5.6, 0, z);
        group.add(col);
      }
    }

    // Back grand wall with recessed marble arch + brass trim
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(36, 14, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x161c2c, roughness: 0.65, metalness: 0.1 }),
    );
    backWall.position.set(0, 7, -18.5);
    group.add(backWall);

    const archRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.4, 0.24, 14, 36, Math.PI),
      brassMat,
    );
    archRing.position.set(0, 4.8, -17.8);
    group.add(archRing);

    // Subtle overhead coffered beams
    for (let i = 0; i < 5; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.65, 0.8), colMat);
      beam.position.set(0, 11.2, 4 - i * 5.2);
      group.add(beam);
    }

    // Contact shadow planes under coin & card
    const shadowTex = createContactShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const coinShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), shadowMat);
    coinShadow.rotation.x = -Math.PI / 2;
    coinShadow.position.set(-1.75, 0.02, 1.2);
    group.add(coinShadow);

    const cardShadow = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.6), shadowMat);
    cardShadow.rotation.x = -Math.PI / 2;
    cardShadow.position.set(1.25, 0.02, 0.8);
    group.add(cardShadow);

    // Left hero: tiny glowing "0.4%" coin
    this.lobbyCoin = new THREE.Group();
    const coinFaceTex = createCoinFaceTexture('0.4%', COLORS.moneyGreen, this.maxAniso);
    const coinRimMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0x22e07a,
      emissiveIntensity: 0.45,
    });
    const coinFaceMat = new THREE.MeshStandardMaterial({
      map: coinFaceTex,
      roughness: 0.24,
      metalness: 0.78,
      emissive: 0x165e32,
      emissiveIntensity: 0.3,
    });
    const coinDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.68, 0.14, 36),
      [coinRimMat, coinFaceMat, coinFaceMat],
    );
    coinDisc.rotation.x = Math.PI / 2;
    this.lobbyCoin.add(coinDisc);

    const coinHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.84, 0.03, 12, 36),
      new THREE.MeshBasicMaterial({ color: 0x22e07a }),
    );
    this.lobbyCoin.add(coinHalo);
    this.lobbyCoin.position.set(-1.75, 1.95, 1.2);
    group.add(this.lobbyCoin);

    // Right hero: HUGE generic 3D credit card with "20%" engraved
    this.lobbyCard = new THREE.Group();
    const cardTex = createGenericCardTexture(this.maxAniso);
    const cardFaceMat = new THREE.MeshStandardMaterial({
      map: cardTex,
      roughness: 0.28,
      metalness: 0.62,
    });
    const cardEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xff3b5c,
      roughness: 0.22,
      metalness: 0.75,
      emissive: 0xff3b5c,
      emissiveIntensity: 1.35,
    });
    const cardBody = new THREE.Mesh(
      new THREE.BoxGeometry(3.85, 2.42, 0.16),
      [cardEdgeMat, cardEdgeMat, cardEdgeMat, cardEdgeMat, cardFaceMat, cardFaceMat],
    );
    cardBody.position.y = 1.21;
    this.lobbyCard.add(cardBody);
    this.lobbyCard.position.set(1.15, 0.15, 0.8);
    group.add(this.lobbyCard);

    // Impact shockwave ring when the 20% card slams down
    this.lobbyShockRing = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.92, 36),
      new THREE.MeshBasicMaterial({
        color: 0xff3b5c,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      }),
    );
    this.lobbyShockRing.rotation.x = -Math.PI / 2;
    this.lobbyShockRing.position.set(1.15, 0.04, 0.8);
    group.add(this.lobbyShockRing);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 2: Piggy Bank Floating into Open Vault (6.80-9.20)
  // --------------------------------------------------------------------------
  private buildPiggyVaultWorld(): THREE.Group {
    const group = new THREE.Group();
    const gridTex = createGridFloorTexture(this.maxAniso, '#3CE0FF', '#0A0E1C');
    gridTex.repeat.set(10, 10);
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.32, metalness: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    // Vault back bulkhead wall
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x263147,
      roughness: 0.32,
      metalness: 0.85,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xe3b448,
      roughness: 0.22,
      metalness: 0.9,
    });

    const wall = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 1.8), steelMat);
    wall.position.set(0, 6, -5.2);
    group.add(wall);

    // Glowing amber circular vault opening
    const vaultFrame = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.36, 18, 42), brassMat);
    vaultFrame.position.set(0.4, 3.6, -4.1);
    group.add(vaultFrame);

    const interiorGlow = new THREE.Mesh(
      new THREE.CircleGeometry(2.65, 36),
      new THREE.MeshBasicMaterial({ color: 0xffc84a }),
    );
    interiorGlow.position.set(0.4, 3.6, -4.25);
    group.add(interiorGlow);

    // Heavy circular vault door swung open on right hinge
    this.piggyVaultDoorPivot = new THREE.Group();
    this.piggyVaultDoorPivot.position.set(3.2, 3.6, -4.0);
    const doorDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.68, 2.68, 0.42, 36), steelMat);
    doorDisc.rotation.x = Math.PI / 2;
    doorDisc.position.set(-2.8, 0, 0.25);
    this.piggyVaultDoorPivot.add(doorDisc);

    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.1, 12, 24), brassMat);
    wheelRing.position.set(-2.8, 0, 0.54);
    this.piggyVaultDoorPivot.add(wheelRing);
    this.piggyVaultDoorPivot.rotation.y = -1.15;
    group.add(this.piggyVaultDoorPivot);

    // Floating 3D piggy bank getting pulled into the vault
    this.piggyFloating = createPiggyBank3D();
    this.piggyFloating.scale.setScalar(0.95);
    group.add(this.piggyFloating);

    // Trail of gleaming gold coins streaming behind piggy bank
    const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0x6b4b00,
      emissiveIntensity: 0.4,
    });
    this.piggyTrailCoins = new THREE.InstancedMesh(coinGeo, coinMat, 28);
    this.piggyTrailCoins.frustumCulled = false;
    group.add(this.piggyTrailCoins);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 3: $10,000 Stack Under Spotlight + 39 Coins (9.20-15.50)
  // --------------------------------------------------------------------------
  private buildPedestalStackWorld(): THREE.Group {
    const group = new THREE.Group();
    const marbleTex = createMarbleTexture(this.maxAniso);
    marbleTex.repeat.set(5, 5);
    marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(55, 55),
      new THREE.MeshStandardMaterial({ map: marbleTex, color: 0x202838, roughness: 0.28, metalness: 0.25 }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    // Surrounding gallery pillars so background has real depth
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x182132, roughness: 0.55, metalness: 0.2 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a442, roughness: 0.24, metalness: 0.88 });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.5;
      const col = createMarbleColumn(pillarMat, brassMat, 10);
      col.position.set(Math.cos(angle) * 11, 0, Math.sin(angle) * 11 - 4);
      group.add(col);
    }

    // Tiered obsidian & brass pedestal grounded at y=0
    const pedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.9, 0.48, 36),
      new THREE.MeshStandardMaterial({ color: 0x101624, roughness: 0.3, metalness: 0.7 }),
    );
    pedBase.position.y = 0.24;
    group.add(pedBase);

    const pedMid = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.25, 1.35, 36),
      new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.36, metalness: 0.55 }),
    );
    pedMid.position.y = 1.15;
    group.add(pedMid);

    const pedRim = new THREE.Mesh(new THREE.TorusGeometry(2.18, 0.055, 12, 42), brassMat);
    pedRim.rotation.x = Math.PI / 2;
    pedRim.position.y = 1.83;
    group.add(pedRim);

    // Volumetric spotlight cone from ceiling
    this.pedestalSpotCone = new THREE.Mesh(
      new THREE.ConeGeometry(3.8, 12.5, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xdcfef0,
        transparent: true,
        opacity: 0.09,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.pedestalSpotCone.position.set(0, 7.6, 0);
    group.add(this.pedestalSpotCone);

    // Neat banded $10,000 stack on pedestal
    const billTex = createGenericBanknoteTexture('$100', this.maxAniso);
    const strapTex = createSignPanelTexture(this.maxAniso, '$10,000', 'SAVINGS', COLORS.highlightYellow);
    this.pedestalCash = createCashStack3D(billTex, strapTex);
    this.pedestalCash.position.set(-0.45, 1.84, 0.05);
    group.add(this.pedestalCash);

    // Tiny pile of exactly 39 individual 3D gold coins next to the big stack
    const coinGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.055, 18);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      roughness: 0.22,
      metalness: 0.9,
      emissive: 0x6b4700,
      emissiveIntensity: 0.28,
    });
    this.pedestalCoins39 = new THREE.InstancedMesh(coinGeo, coinMat, 39);
    const rng = createRng(39039);
    // Arrange 39 coins as 3 tiny neat stacks (15 + 13 + 11 = 39) right beside the $10,000 stack
    const stackSpecs: Array<{ x: number; z: number; count: number }> = [
      { x: 1.38, z: 0.38, count: 15 },
      { x: 1.72, z: 0.12, count: 13 },
      { x: 1.56, z: -0.22, count: 11 },
    ];
    let idx = 0;
    for (const s of stackSpecs) {
      for (let k = 0; k < s.count; k++) {
        _dummy.position.set(
          s.x + rng.range(-0.02, 0.02),
          1.86 + k * 0.058,
          s.z + rng.range(-0.02, 0.02),
        );
        _dummy.rotation.set(0, rng.range(0, Math.PI), 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.pedestalCoins39.setMatrixAt(idx++, _dummy.matrix);
      }
    }
    this.pedestalCoins39.instanceMatrix.needsUpdate = true;
    this.pedestalCoins39.computeBoundingSphere();
    group.add(this.pedestalCoins39);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 4: 0.39% vs 19.7% 3D Skyscraper Bars (15.50-21.40)
  // --------------------------------------------------------------------------
  private buildAprBarsWorld(): THREE.Group {
    const group = new THREE.Group();
    const gridTex = createGridFloorTexture(this.maxAniso, '#FF3B5C', '#120919');
    gridTex.repeat.set(16, 16);
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.34, metalness: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    // Distant horizon reference pillars for monumental height scale
    const refMat = new THREE.MeshStandardMaterial({
      color: 0x1d1629,
      roughness: 0.6,
      metalness: 0.3,
    });
    for (let i = -4; i <= 4; i++) {
      if (Math.abs(i) < 2) continue;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.65, 16, 0.65), refMat);
      tower.position.set(i * 3.6, 8, -11);
      group.add(tower);
    }

    // Horizontal elevation measurement lines behind the bars
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x3b2342 });
    for (let h = 2; h <= 14; h += 2) {
      const rule = new THREE.Mesh(new THREE.BoxGeometry(11, 0.05, 0.05), lineMat);
      rule.position.set(0, h, -2.2);
      group.add(rule);
    }

    // Left bar: tiny green 0.39% bar (unit height 1 scaled dynamically)
    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x22e07a,
      roughness: 0.25,
      metalness: 0.45,
      emissive: 0x12783e,
      emissiveIntensity: 0.7,
    });
    const barGeo = new THREE.BoxGeometry(1.85, 1, 1.85);
    barGeo.translate(0, 0.5, 0);

    this.barGreenMesh = new THREE.Mesh(barGeo, greenMat);
    this.barGreenMesh.position.set(-1.65, 0, 0);
    group.add(this.barGreenMesh);

    this.barGreenCap = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.14, 2.02),
      new THREE.MeshStandardMaterial({
        color: 0x7effba,
        roughness: 0.2,
        metalness: 0.7,
        emissive: 0x22e07a,
        emissiveIntensity: 1.25,
      }),
    );
    this.barGreenCap.position.set(-1.65, 0.35, 0);
    group.add(this.barGreenCap);

    // Right bar: towering crimson 19.7% skyscraper bar
    const redMat = new THREE.MeshStandardMaterial({
      color: 0xff3b5c,
      roughness: 0.26,
      metalness: 0.48,
      emissive: 0x99142b,
      emissiveIntensity: 0.85,
    });
    this.barRedMesh = new THREE.Mesh(barGeo, redMat);
    this.barRedMesh.position.set(1.65, 0, 0);
    group.add(this.barRedMesh);

    this.barRedCap = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, 0.18, 2.05),
      new THREE.MeshStandardMaterial({
        color: 0xff8ea2,
        roughness: 0.2,
        metalness: 0.72,
        emissive: 0xff3b5c,
        emissiveIntensity: 1.4,
      }),
    );
    this.barRedCap.position.set(1.65, 14, 0);
    group.add(this.barRedCap);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 5: Fed Rate ~4% Round Vault + Money Flow + Giant Bank Door (21.40-27.25)
  // --------------------------------------------------------------------------
  private buildFedVaultWorld(): THREE.Group {
    const group = new THREE.Group();
    const gridTex = createGridFloorTexture(this.maxAniso, '#3CE0FF', '#081222');
    gridTex.repeat.set(12, 12);
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.3, metalness: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    // --- Sub-stage A (21.40-26.00): Round Fed ~4% Vault + Piggy Bank + Profit Bridge ---
    this.fedVaultGroup = new THREE.Group();
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x26354d,
      roughness: 0.24,
      metalness: 0.88,
    });
    const cyanGlowMat = new THREE.MeshStandardMaterial({
      color: 0x3ce0ff,
      roughness: 0.2,
      metalness: 0.5,
      emissive: 0x3ce0ff,
      emissiveIntensity: 1.4,
    });

    // Cylindrical round vault body
    const vaultDrum = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 1.3, 40), titaniumMat);
    vaultDrum.rotation.x = Math.PI / 2;
    vaultDrum.position.set(1.3, 3.1, -2.0);
    this.fedVaultGroup.add(vaultDrum);

    const vaultRing = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.14, 16, 48), cyanGlowMat);
    vaultRing.position.set(1.3, 3.1, -1.32);
    this.fedVaultGroup.add(vaultRing);

    // Spoked locking wheel
    this.fedVaultWheel = new THREE.Group();
    this.fedVaultWheel.position.set(1.3, 3.1, -1.12);
    const wheelRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.11, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.2, metalness: 0.92 }),
    );
    this.fedVaultWheel.add(wheelRim);
    for (let s = 0; s < 6; s++) {
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.2, 10),
        new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.2, metalness: 0.92 }),
      );
      spoke.rotation.z = (s * Math.PI) / 3;
      this.fedVaultWheel.add(spoke);
    }
    this.fedVaultGroup.add(this.fedVaultWheel);

    // Label plaque "FED RATE ~4%"
    const fedSignTex = createSignPanelTexture(this.maxAniso, 'FED RATE', '~4%', COLORS.cyan);
    const fedSign = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.15, 0.18),
      new THREE.MeshStandardMaterial({ map: fedSignTex, roughness: 0.28, metalness: 0.35 }),
    );
    fedSign.position.set(1.3, 6.2, -1.6);
    this.fedVaultGroup.add(fedSign);

    // Piggy bank on left (0.4%)
    this.fedPiggy = createPiggyBank3D();
    this.fedPiggy.scale.setScalar(0.85);
    this.fedPiggy.position.set(-2.5, 0, 0.8);
    this.fedPiggy.rotation.y = 0.45;
    this.fedVaultGroup.add(this.fedPiggy);

    // Flowing stream of coins arching from piggy bank -> Fed 4% vault
    const coinGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0x805a00,
      emissiveIntensity: 0.45,
    });
    this.fedFlowCoins = new THREE.InstancedMesh(coinGeo, coinMat, 48);
    this.fedFlowCoins.frustumCulled = false;
    this.fedVaultGroup.add(this.fedFlowCoins);

    // Glowing "PROFIT" gap monolith between piggy bank and 4% vault
    this.fedProfitBridge = new THREE.Group();
    const profitTex = createSignPanelTexture(this.maxAniso, 'BANK', 'PROFIT', COLORS.moneyGreen);
    const profitPanel = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.2, 0.22),
      new THREE.MeshStandardMaterial({
        map: profitTex,
        roughness: 0.22,
        metalness: 0.3,
        emissive: 0x105c30,
        emissiveIntensity: 0.55,
      }),
    );
    this.fedProfitBridge.add(profitPanel);
    this.fedProfitBridge.position.set(-0.5, 3.0, -0.2);
    this.fedVaultGroup.add(this.fedProfitBridge);

    group.add(this.fedVaultGroup);

    // --- Sub-stage B (26.00-27.25): Giant Imposing Closed Bank Door ---
    this.giantBankDoorGroup = new THREE.Group();
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0x3b2c20,
      roughness: 0.34,
      metalness: 0.82,
    });
    const brassTrimMat = new THREE.MeshStandardMaterial({
      color: 0xd9a74a,
      roughness: 0.24,
      metalness: 0.9,
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.2, 11.4, 1.4), titaniumMat);
    frame.position.set(0, 5.7, -2.5);
    this.giantBankDoorGroup.add(frame);

    const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(6.6, 9.6, 0.7), bronzeMat);
    doorLeaf.position.set(0, 4.9, -1.9);
    this.giantBankDoorGroup.add(doorLeaf);

    // Recessed door panels + rivets + massive brass wheel
    for (const py of [2.4, 6.8]) {
      for (const px of [-1.55, 1.55]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.1, 0.16), brassTrimMat);
        panel.position.set(px, py, -1.52);
        this.giantBankDoorGroup.add(panel);
      }
    }
    const doorHandle = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.1, 12, 24), brassTrimMat);
    doorHandle.position.set(0, 4.6, -1.35);
    this.giantBankDoorGroup.add(doorHandle);

    this.giantBankDoorGroup.visible = false;
    group.add(this.giantBankDoorGroup);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 6: Sticky Money — Honey-Glued Coins + Dripping Honey Slab (27.25-32.60)
  // --------------------------------------------------------------------------
  private buildStickyHoneyWorld(): THREE.Group {
    const group = new THREE.Group();
    const marbleTex = createMarbleTexture(this.maxAniso);
    marbleTex.repeat.set(6, 6);
    marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ map: marbleTex, color: 0x261a12, roughness: 0.34, metalness: 0.2 }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    // Thick glossy golden honey puddle spread on floor
    const honeyMat = new THREE.MeshPhysicalMaterial({
      color: 0xe68a00,
      roughness: 0.08,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      emissive: 0x733a00,
      emissiveIntensity: 0.42,
    });
    const puddle = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.2, 0.14, 40), honeyMat);
    puddle.position.set(0, 0.07, 0);
    group.add(puddle);

    // Secondary organic puddle lobes
    const lobeSpecs: [number, number, number][] = [
      [-2.8, 1.9, 2.2],
      [3.1, 1.4, 2.0],
      [-2.1, -2.5, 2.4],
      [2.4, -2.1, 2.3],
    ];
    for (const [lx, lz, lr] of lobeSpecs) {
      const lobe = new THREE.Mesh(new THREE.CylinderGeometry(lr, lr * 1.08, 0.12, 28), honeyMat);
      lobe.position.set(lx, 0.06, lz);
      group.add(lobe);
    }

    // 55 gold coins glued & partially submerged in the honey puddle
    const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.09, 20);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      roughness: 0.2,
      metalness: 0.88,
      emissive: 0x5c3900,
      emissiveIntensity: 0.25,
    });
    this.honeyCoinsInst = new THREE.InstancedMesh(coinGeo, coinMat, 55);
    const rng = createRng(77077);
    for (let i = 0; i < 55; i++) {
      const r = Math.sqrt(rng.next()) * 4.4;
      const a = rng.range(0, Math.PI * 2);
      _dummy.position.set(Math.cos(a) * r, 0.14 + rng.range(0, 0.05), Math.sin(a) * r);
      _dummy.rotation.set(rng.range(-0.22, 0.22), rng.range(0, Math.PI), rng.range(-0.22, 0.22));
      _dummy.scale.setScalar(rng.range(0.85, 1.18));
      _dummy.updateMatrix();
      this.honeyCoinsInst.setMatrixAt(i, _dummy.matrix);
    }
    this.honeyCoinsInst.instanceMatrix.needsUpdate = true;
    this.honeyCoinsInst.computeBoundingSphere();
    group.add(this.honeyCoinsInst);

    // Slow-motion falling honey droplets from above
    const dropGeo = new THREE.SphereGeometry(0.14, 14, 14);
    dropGeo.scale(0.85, 1.75, 0.85);
    this.honeyDripsInst = new THREE.InstancedMesh(dropGeo, honeyMat, 22);
    this.honeyDripsInst.frustumCulled = false;
    group.add(this.honeyDripsInst);

    // 3D Golden Honey "STICKY MONEY" sculptural monolith with hanging honey icicles
    this.stickyMonolith = new THREE.Group();
    const slabTex = createHoneySlabTexture(this.maxAniso);
    const slabFaceMat = new THREE.MeshPhysicalMaterial({
      map: slabTex,
      roughness: 0.14,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      emissive: 0x5c3000,
      emissiveIntensity: 0.35,
    });
    const slabMesh = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 2.75, 0.65),
      [honeyMat, honeyMat, honeyMat, honeyMat, slabFaceMat, slabFaceMat],
    );
    slabMesh.position.y = 3.1;
    this.stickyMonolith.add(slabMesh);

    this.stickyDripIcicles = [];
    for (let d = 0; d < 9; d++) {
      const dx = lerp(-2.35, 2.35, d / 8);
      const icicle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, 1.0, 12), honeyMat);
      icicle.position.set(dx, 1.45, 0.28);
      this.stickyMonolith.add(icicle);
      this.stickyDripIcicles.push(icicle);
    }

    this.stickyMonolith.visible = false;
    group.add(this.stickyMonolith);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 7: Futuristic 4%+ Vault + Flying Cash + Split $39 vs $430 + Speed Tunnel
  // --------------------------------------------------------------------------
  private buildOnlineVaultWorld(): THREE.Group {
    const group = new THREE.Group();
    const gridTex = createGridFloorTexture(this.maxAniso, '#22E07A', '#06181E');
    gridTex.repeat.set(14, 14);
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(75, 75),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.26, metalness: 0.42 }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    // --- Sub-stage A (32.60-39.10 & 42.30-43.80): Futuristic 4%+ Vault ---
    this.onlineVaultHero = new THREE.Group();
    const darkGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x10242e,
      roughness: 0.16,
      metalness: 0.72,
      clearcoat: 0.9,
    });
    const neonGreenMat = new THREE.MeshStandardMaterial({
      color: 0x22e07a,
      roughness: 0.2,
      metalness: 0.4,
      emissive: 0x22e07a,
      emissiveIntensity: 1.45,
    });

    // Sleek futuristic hexagonal-arch vault shell (strictly no logos)
    const archLeft = new THREE.Mesh(new THREE.BoxGeometry(1.1, 6.2, 2.2), darkGlassMat);
    archLeft.position.set(-2.9, 3.1, -3.0);
    this.onlineVaultHero.add(archLeft);

    const archRight = new THREE.Mesh(new THREE.BoxGeometry(1.1, 6.2, 2.2), darkGlassMat);
    archRight.position.set(2.9, 3.1, -3.0);
    this.onlineVaultHero.add(archRight);

    const archTop = new THREE.Mesh(new THREE.BoxGeometry(6.9, 1.2, 2.3), darkGlassMat);
    archTop.position.set(0, 6.6, -3.0);
    this.onlineVaultHero.add(archTop);

    // Neon trim edges
    const trimTop = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.12, 0.12), neonGreenMat);
    trimTop.position.set(0, 5.95, -1.85);
    this.onlineVaultHero.add(trimTop);

    // Glowing emerald interior backdrop
    const vaultCore = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 5.8),
      new THREE.MeshBasicMaterial({ color: 0x7effc6 }),
    );
    vaultCore.position.set(0, 3.0, -3.6);
    this.onlineVaultHero.add(vaultCore);

    // Twin sliding blast doors
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x16313e,
      roughness: 0.24,
      metalness: 0.84,
    });
    this.onlineDoorLeft = new THREE.Mesh(new THREE.BoxGeometry(2.4, 5.8, 0.36), doorMat);
    this.onlineDoorLeft.position.set(-1.2, 3.0, -2.5);
    this.onlineVaultHero.add(this.onlineDoorLeft);

    this.onlineDoorRight = new THREE.Mesh(new THREE.BoxGeometry(2.4, 5.8, 0.36), doorMat);
    this.onlineDoorRight.position.set(1.2, 3.0, -2.5);
    this.onlineVaultHero.add(this.onlineDoorRight);

    // "4%+" top plaque
    const apySignTex = createSignPanelTexture(this.maxAniso, 'ONLINE VAULT', '4%+', COLORS.moneyGreen);
    const apySign = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 1.2, 0.2),
      new THREE.MeshStandardMaterial({ map: apySignTex, roughness: 0.24, metalness: 0.35 }),
    );
    apySign.position.set(0, 6.65, -1.78);
    this.onlineVaultHero.add(apySign);

    // Volumetric emerald-cyan light rays pouring out of the open vault
    this.onlineLightRays = new THREE.Group();
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0x38f7a6,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let r = 0; r < 5; r++) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 11), rayMat);
      ray.position.set(lerp(-1.8, 1.8, r / 4), 2.8, 1.2);
      ray.rotation.x = Math.PI / 2 - 0.12;
      ray.rotation.z = lerp(0.28, -0.28, r / 4);
      this.onlineLightRays.add(ray);
    }
    this.onlineVaultHero.add(this.onlineLightRays);

    // Flying $10,000 bill stack (animates into the open vault during 34.80-37.00s)
    const billTex = createGenericBanknoteTexture('$100', this.maxAniso);
    const strapTex = createSignPanelTexture(this.maxAniso, '$10,000', 'MOVE', COLORS.moneyGreen);
    this.flyingCashStack = createCashStack3D(billTex, strapTex);
    this.flyingCashStack.scale.setScalar(0.85);
    this.onlineVaultHero.add(this.flyingCashStack);

    group.add(this.onlineVaultHero);

    // --- Sub-stage B (39.10-42.30): Split Screen $39 (small grey) vs $430 (big green) ---
    this.splitCompareGroup = new THREE.Group();

    // Glowing vertical split divider beam
    const divider = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 10, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xffd54a }),
    );
    divider.position.set(0, 4.5, 0.5);
    this.splitCompareGroup.add(divider);

    // Left dark grey pedestal + tiny grey coin stack ($39)
    const greyPed = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.45, 0.6, 24),
      new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7, metalness: 0.2 }),
    );
    greyPed.position.set(-2.1, 0.3, 0);
    this.splitCompareGroup.add(greyPed);

    const greyCoinMat = new THREE.MeshStandardMaterial({ color: 0x7b8494, roughness: 0.5, metalness: 0.45 });
    for (let c = 0; c < 6; c++) {
      const gc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 18), greyCoinMat);
      gc.position.set(-2.1 + (c % 2) * 0.28 - 0.14, 0.64 + Math.floor(c / 2) * 0.075, 0);
      this.splitCompareGroup.add(gc);
    }

    // Right vibrant emerald pedestal + huge gleaming 11x coin towers ($430)
    const greenPed = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 1.9, 0.65, 28),
      new THREE.MeshStandardMaterial({
        color: 0x104d30,
        roughness: 0.25,
        metalness: 0.55,
        emissive: 0x10663a,
        emissiveIntensity: 0.5,
      }),
    );
    greenPed.position.set(2.15, 0.32, 0);
    this.splitCompareGroup.add(greenPed);

    const richCoinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.09, 18);
    const richCoinMat = new THREE.MeshStandardMaterial({
      color: 0x22e07a,
      roughness: 0.2,
      metalness: 0.85,
      emissive: 0x168046,
      emissiveIntensity: 0.5,
    });
    this.splitRightCoinsInst = new THREE.InstancedMesh(richCoinGeo, richCoinMat, 110);
    this.splitRightCoinsInst.frustumCulled = false;
    this.splitCompareGroup.add(this.splitRightCoinsInst);

    this.splitCompareGroup.visible = false;
    group.add(this.splitCompareGroup);

    // --- Sub-stage C (42.30-43.80): Speed streaks rushing toward the 4%+ vault ---
    this.speedTunnelGroup = new THREE.Group();
    const streakGeo = new THREE.BoxGeometry(0.06, 0.06, 2.8);
    const streakMat = new THREE.MeshBasicMaterial({ color: 0x3ce0ff });
    this.speedStreaksInst = new THREE.InstancedMesh(streakGeo, streakMat, 48);
    this.speedStreaksInst.frustumCulled = false;
    this.speedTunnelGroup.add(this.speedStreaksInst);
    this.speedTunnelGroup.visible = false;
    group.add(this.speedTunnelGroup);

    return group;
  }

  // --------------------------------------------------------------------------
  // WORLD 8: Finale Coin Storm + Spinning Card (#3 / #4) + Generic $100 Note
  // --------------------------------------------------------------------------
  private buildFinaleWorld(): THREE.Group {
    const group = new THREE.Group();
    const gridTex = createGridFloorTexture(this.maxAniso, '#FFD54A', '#0C1120');
    gridTex.repeat.set(12, 12);
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.34, metalness: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    // Spinning collector card ("MONEY SECRET #3" front, "#4: WHY A $100 BILL COSTS LESS THAN $1" back)
    this.finaleCardGroup = new THREE.Group();
    const frontTex = createMs03CollectorCardTexture(this.maxAniso, 'front');
    const backTex = createMs03CollectorCardTexture(this.maxAniso, 'back');
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0x997000,
      emissiveIntensity: 0.6,
    });
    const frontMat = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.24, metalness: 0.45 });
    const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.24, metalness: 0.45 });

    const card = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 4.9, 0.16),
      [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat],
    );
    this.finaleCardGroup.add(card);
    this.finaleCardGroup.position.set(0, 3.6, 0);
    group.add(this.finaleCardGroup);

    // Glowing generic plain green $100 banknote (strictly plain green + "$100" text only!)
    this.finaleNoteGroup = new THREE.Group();
    const noteTex = createGenericBanknoteTexture('$100', this.maxAniso);
    const noteFaceMat = new THREE.MeshStandardMaterial({
      map: noteTex,
      roughness: 0.32,
      metalness: 0.25,
      emissive: 0x167844,
      emissiveIntensity: 0.45,
    });
    const noteEdgeMat = new THREE.MeshStandardMaterial({
      color: 0x22e07a,
      roughness: 0.25,
      metalness: 0.5,
      emissive: 0x22e07a,
      emissiveIntensity: 1.25,
    });
    const noteMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.54, 0.06),
      [noteEdgeMat, noteEdgeMat, noteEdgeMat, noteEdgeMat, noteFaceMat, noteFaceMat],
    );
    this.finaleNoteGroup.add(noteMesh);
    this.finaleNoteGroup.position.set(0, 1.35, 1.85);
    this.finaleNoteGroup.visible = false;
    group.add(this.finaleNoteGroup);

    // 140-coin 3D golden storm
    const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      roughness: 0.2,
      metalness: 0.92,
      emissive: 0x6e4d00,
      emissiveIntensity: 0.35,
    });
    const rng = createRng(43843);
    this.finaleCoinSeeds = [];
    for (let i = 0; i < 140; i++) {
      this.finaleCoinSeeds.push({
        r: rng.range(2.6, 10.5),
        ang: rng.range(0, Math.PI * 2),
        y: rng.range(0.4, 9.5),
        spd: rng.range(0.55, 1.45),
        spin: rng.range(2.2, 6.0),
      });
    }
    this.finaleCoinsInst = new THREE.InstancedMesh(coinGeo, coinMat, 140);
    this.finaleCoinsInst.frustumCulled = false;
    group.add(this.finaleCoinsInst);

    return group;
  }

  // ============================================================================
  // DETERMINISTIC PER-FRAME RENDER AT EXACT TIME t (seconds)
  // ============================================================================
  public renderAt(t: number): void {
    const shot = getShotAt(t);
    const shotElapsed = Math.max(0, t - shot.start);
    const shotDur = Math.max(0.01, shot.end - shot.start);
    const u = clamp(shotElapsed / shotDur, 0, 1);

    // Activate only the current shot's 3D world
    (Object.keys(this.worlds) as WorldId[]).forEach((wid) => {
      this.worlds[wid].visible = wid === shot.world;
    });

    // Apply world palette & calibrated bloom
    const pal = WORLD_PALETTES[shot.world as WorldId] ?? WORLD_PALETTES.bankLobby;
    this.skyMat.uniforms.uTop.value.setHex(pal.top);
    this.skyMat.uniforms.uMid.value.setHex(pal.mid);
    this.skyMat.uniforms.uBottom.value.setHex(pal.bottom);
    this.fog.color.setHex(pal.fog);
    this.fog.density = pal.fogDensity;
    this.keyLight.color.setHex(pal.keyColor);
    this.keyLight.intensity = pal.keyIntensity;
    this.rimLight.color.setHex(pal.rimColor);
    this.rimLight.intensity = pal.rimIntensity;
    this.bloomPass.strength = pal.bloomStrength;

    this.dustPoints.rotation.y = t * 0.028;
    this.dustPoints.position.y = Math.sin(t * 0.35) * 0.35;

    let baseFov = 46;
    let camX = 0;
    let camY = 2.4;
    let camZ = 10.0;
    let lookX = 0;
    let lookY = 2.0;
    let lookZ = 0;

    switch (shot.world) {
      case 'bankLobby': {
        // Gentle float & spin on left 0.4% coin
        this.lobbyCoin.position.set(-1.8, 1.95 + Math.sin(t * 3.1) * 0.16, 1.3);
        this.lobbyCoin.rotation.y = t * 1.45;
        this.lobbyCoin.scale.setScalar(shot.id === 1 ? easeOutBack(clamp(shotElapsed / 0.35, 0, 1), 1.4) : 1.0);

        if (shot.id === 1) {
          // 0.00-1.60: Coin floats on left, credit card hidden above frame
          this.lobbyCard.visible = false;
          (this.lobbyShockRing.material as THREE.MeshBasicMaterial).opacity = 0;
          camX = lerp(-0.6, -1.0, u);
          camY = lerp(2.6, 2.3, u);
          camZ = lerp(9.4, 8.2, u);
          lookX = -1.2;
          lookY = 1.95;
          lookZ = 0.8;
        } else if (shot.id === 2) {
          // 1.60-3.40: HUGE 20% credit card slams down with camera shake!
          this.lobbyCard.visible = true;
          const slamT = clamp(shotElapsed / 0.32, 0, 1);
          const cardY = lerp(9.5, 0.25, easeOutCubic(slamT));
          this.lobbyCard.position.set(1.05, cardY, 0.85);
          this.lobbyCard.rotation.set(0.06, lerp(-0.45, -0.18, easeOutCubic(slamT)), 0);

          // Shockwave ring pulse on impact
          const impactT = clamp((shotElapsed - 0.22) / 0.55, 0, 1);
          const ringScale = lerp(0.5, 4.4, easeOutCubic(impactT));
          this.lobbyShockRing.scale.setScalar(ringScale);
          (this.lobbyShockRing.material as THREE.MeshBasicMaterial).opacity =
            shotElapsed > 0.22 ? (1 - impactT) * 0.85 : 0;

          // Procedural camera shake after slam
          const shakeAmp = shotElapsed > 0.22 ? Math.exp(-(shotElapsed - 0.22) * 8.5) * 0.42 : 0;
          const shakeX = Math.sin(shotElapsed * 74) * shakeAmp;
          const shakeY = Math.cos(shotElapsed * 63) * shakeAmp;

          camX = lerp(0.4, 0.85, u) + shakeX;
          camY = lerp(2.5, 2.25, u) + shakeY;
          camZ = lerp(9.4, 8.5, u);
          lookX = 0.75;
          lookY = 1.7;
          lookZ = 0.5;
        } else if (shot.id === 3 || shot.id === 4) {
          // 3.40-6.80: Side-by-side 0.4% vs 20%, slow dramatic dolly
          this.lobbyCard.visible = true;
          this.lobbyCard.position.set(1.15, 0.35 + Math.sin(t * 2.2) * 0.08, 0.75);
          this.lobbyCard.rotation.set(0.04, -0.22 + Math.sin(t * 1.1) * 0.06, 0);
          (this.lobbyShockRing.material as THREE.MeshBasicMaterial).opacity = 0;

          camX = lerp(-0.3, 0.35, u);
          camY = lerp(2.5, 2.9, u);
          camZ = shot.id === 4 ? lerp(9.2, 8.1, u) : lerp(10.0, 9.2, u);
          lookX = 0.0;
          lookY = 1.75;
          lookZ = 0.6;
        } else {
          // Shot 27 (49.60-51.61): Seamless return to opening "0.4% vs 20%" lobby framing
          this.lobbyCard.visible = true;
          const fadeLift = easeInOutCubic(clamp((u - 0.6) / 0.4, 0, 1));
          this.lobbyCard.position.set(1.15, lerp(0.35, 1.1, fadeLift), 0.75);
          this.lobbyCard.rotation.set(0.04, -0.2, 0);
          (this.lobbyShockRing.material as THREE.MeshBasicMaterial).opacity = 0;

          camX = lerp(0.25, -0.6, u);
          camY = lerp(2.7, 2.6, u);
          camZ = lerp(9.8, 9.4, u);
          lookX = lerp(0.0, -1.2, u);
          lookY = 1.95;
          lookZ = 0.8;
        }
        break;
      }

      case 'piggyVault': {
        // 6.80-9.20: Piggy bank floats away from foreground into open golden vault
        const pull = easeInOutCubic(u);
        this.piggyFloating.position.set(
          lerp(-0.9, 0.35, pull),
          lerp(2.4, 3.3, pull) + Math.sin(t * 5.2) * 0.16,
          lerp(2.6, -2.9, pull),
        );
        this.piggyFloating.rotation.set(
          Math.sin(t * 4.5) * 0.14,
          lerp(0.6, 2.4, pull),
          Math.cos(t * 3.8) * 0.12,
        );
        this.piggyFloating.scale.setScalar(lerp(0.95, 0.58, pull));

        // Swirling coin stream sucked into vault
        for (let i = 0; i < 28; i++) {
          const phase = (i / 28 + shotElapsed * 0.55) % 1;
          const z = lerp(2.8, -3.8, phase);
          const swirlR = (1 - phase) * 1.15 + 0.18;
          const a = phase * 9.0 + i * 0.8;
          _dummy.position.set(0.3 + Math.cos(a) * swirlR, 2.8 + Math.sin(a) * swirlR * 0.65, z);
          _dummy.rotation.set(t * 3 + i, t * 4, 0);
          _dummy.scale.setScalar(lerp(1.0, 0.45, phase));
          _dummy.updateMatrix();
          this.piggyTrailCoins.setMatrixAt(i, _dummy.matrix);
        }
        this.piggyTrailCoins.instanceMatrix.needsUpdate = true;

        camX = lerp(-0.5, 0.5, u);
        camY = lerp(2.8, 3.1, u);
        camZ = lerp(8.8, 7.6, u);
        lookX = 0.25;
        lookY = 3.0;
        lookZ = -2.2;
        break;
      }

      case 'pedestalStack': {
        // 9.20-15.50: $10,000 stack on spotlight pedestal + 39-coin close-up
        this.pedestalCash.rotation.y = Math.sin(t * 0.7) * 0.16;
        (this.pedestalSpotCone.material as THREE.MeshBasicMaterial).opacity =
          0.08 + Math.sin(t * 2.5) * 0.015;

        if (shot.id === 6) {
          camX = lerp(-2.2, 0.8, u);
          camY = lerp(3.9, 3.5, u);
          camZ = lerp(8.4, 7.1, u);
          lookX = 0;
          lookY = 2.35;
          lookZ = 0;
        } else if (shot.id === 7) {
          camX = lerp(0.8, 2.0, u);
          camY = lerp(3.5, 3.9, u);
          camZ = lerp(7.1, 6.4, u);
          lookX = 0.2;
          lookY = 2.4;
          lookZ = 0;
        } else {
          // Shot 8 (13.40-15.50): Close-up on the tiny pile of 39 coins next to big $10,000 stack
          baseFov = 38;
          camX = lerp(1.5, 2.4, u);
          camY = lerp(3.15, 2.85, u);
          camZ = lerp(4.4, 3.6, u);
          lookX = 1.1;
          lookY = 2.2;
          lookZ = 0.12;
        }
        break;
      }

      case 'aprBars': {
        // 15.50-21.40: Green 0.39% bar vs Skyscraper Red 19.7% bar
        const growProgress = shot.id === 9 ? easeOutCubic(clamp(shotElapsed / 1.4, 0, 1)) : 1.0;
        const greenH = Math.max(0.05, 0.32 * growProgress);
        const redH = Math.max(0.05, 14.2 * growProgress);

        this.barGreenMesh.scale.y = greenH;
        this.barGreenCap.position.y = greenH + 0.07;

        this.barRedMesh.scale.y = redH;
        this.barRedCap.position.y = redH + 0.09;

        if (shot.id === 9) {
          // Wide shot watching tiny green vs giant red bar grow
          camX = lerp(-1.2, 0.6, u);
          camY = lerp(2.2, 4.2, u);
          camZ = lerp(12.2, 13.8, u);
          lookX = 0.2;
          lookY = lerp(1.8, 4.6, u);
          lookZ = 0;
        } else if (shot.id === 10) {
          // 17.60-19.40: Dramatic upward tilt climbing the red skyscraper bar to its summit
          camX = lerp(0.8, -1.2, u);
          camY = lerp(3.4, 13.4, easeInOutCubic(u));
          camZ = lerp(9.5, 10.6, u);
          lookX = 1.45;
          lookY = lerp(5.2, 14.0, easeInOutCubic(u));
          lookZ = 0;
        } else {
          // 19.40-21.40: Hero orbit around summit as "50x" slams in
          const shake = Math.exp(-shotElapsed * 9) * 0.32;
          camX = lerp(-2.2, 2.2, u) + Math.sin(shotElapsed * 68) * shake;
          camY = lerp(11.5, 13.8, u) + Math.cos(shotElapsed * 60) * shake;
          camZ = lerp(13.5, 11.8, u);
          lookX = 0.4;
          lookY = 8.5;
          lookZ = 0;
        }
        break;
      }

      case 'fedVault': {
        const isDoorShot = shot.id === 14;
        this.fedVaultGroup.visible = !isDoorShot;
        this.giantBankDoorGroup.visible = isDoorShot;

        if (!isDoorShot) {
          this.fedVaultWheel.rotation.z = t * 0.85;
          this.fedPiggy.position.y = Math.sin(t * 3.0) * 0.08;

          const showFlow = shot.id === 13;
          this.fedFlowCoins.visible = showFlow;
          this.fedProfitBridge.visible = showFlow;

          if (showFlow) {
            const bridgeScale = easeOutBack(clamp((shotElapsed - 0.25) / 0.35, 0, 1), 1.35);
            this.fedProfitBridge.scale.setScalar(Math.max(0.001, bridgeScale));
            this.fedProfitBridge.position.y = 3.0 + Math.sin(t * 4.0) * 0.1;

            for (let i = 0; i < 48; i++) {
              const p = (i / 48 + shotElapsed * 0.48) % 1;
              const x = lerp(-2.2, 1.25, p);
              const y = lerp(1.5, 3.1, p) + Math.sin(p * Math.PI) * 1.9;
              const z = lerp(0.8, -1.4, p) + Math.sin(i * 1.3) * 0.22;
              _dummy.position.set(x, y, z);
              _dummy.rotation.set(t * 4 + i, t * 3, 0);
              _dummy.scale.setScalar(0.85 + Math.sin(p * Math.PI) * 0.3);
              _dummy.updateMatrix();
              this.fedFlowCoins.setMatrixAt(i, _dummy.matrix);
            }
            this.fedFlowCoins.instanceMatrix.needsUpdate = true;
          }

          if (shot.id === 12) {
            camX = lerp(0.4, 1.4, u);
            camY = lerp(3.4, 3.8, u);
            camZ = lerp(9.2, 8.2, u);
            lookX = 1.1;
            lookY = 3.2;
            lookZ = -1.6;
          } else {
            camX = lerp(-0.8, 0.6, u);
            camY = lerp(3.4, 3.9, u);
            camZ = lerp(10.4, 9.4, u);
            lookX = -0.35;
            lookY = 2.7;
            lookZ = -0.5;
          }
        } else {
          // Shot 14 (26.00-27.25): Giant bank door shuddering as Jordan bangs on it
          const bangImpulse = Math.pow(Math.abs(Math.sin(t * 14)), 6) * 0.14;
          this.giantBankDoorGroup.position.z = -bangImpulse;
          camX = lerp(-0.5, 0.5, u) + Math.sin(t * 44) * bangImpulse * 0.7;
          camY = lerp(3.6, 4.1, u);
          camZ = lerp(8.8, 7.6, u);
          lookX = 0;
          lookY = 4.2;
          lookZ = -1.8;
        }
        break;
      }

      case 'stickyHoney': {
        // 27.25-32.60: Honey-glued coins + slow-motion falling drops + 3D STICKY MONEY slab
        for (let i = 0; i < 22; i++) {
          const p = (i / 22 + t * 0.22) % 1; // Slow-motion drip
          const a = i * 2.39996;
          const r = 0.6 + (i % 5) * 0.75;
          _dummy.position.set(Math.cos(a) * r, lerp(6.8, 0.15, p * p), Math.sin(a) * r);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(1, 0.9 + p * 0.6, 1);
          _dummy.updateMatrix();
          this.honeyDripsInst.setMatrixAt(i, _dummy.matrix);
        }
        this.honeyDripsInst.instanceMatrix.needsUpdate = true;

        const showMonolith = shot.id === 16 || shot.id === 17;
        this.stickyMonolith.visible = showMonolith;
        if (showMonolith) {
          const revealT = t - 29.6;
          const pop = easeOutBack(clamp(revealT / 0.35, 0, 1), 1.25);
          this.stickyMonolith.scale.setScalar(Math.max(0.01, pop));
          this.stickyMonolith.position.set(0, 0.15, -0.4);

          this.stickyDripIcicles.forEach((icicle, idx) => {
            const stretch = 0.55 + clamp((revealT - idx * 0.08) * 0.45, 0, 1.35);
            icicle.scale.set(1, stretch, 1);
            icicle.position.y = 1.72 - stretch * 0.5;
          });
        }

        if (shot.id === 15) {
          // Low-angle macro glide over coins stuck in golden honey
          camX = lerp(-2.4, 2.2, u);
          camY = lerp(2.3, 1.75, u);
          camZ = lerp(6.8, 5.6, u);
          lookX = 0;
          lookY = 0.45;
          lookZ = 0;
        } else if (shot.id === 16) {
          camX = lerp(-0.8, 0.6, u);
          camY = lerp(3.2, 2.9, u);
          camZ = lerp(9.6, 8.6, u);
          lookX = 0;
          lookY = 2.6;
          lookZ = -0.3;
        } else {
          // Shot 17 (31.10-32.60): Dramatic low-angle orbit showing honey dripping onto coins
          camX = lerp(2.6, -2.4, u);
          camY = lerp(1.9, 2.6, u);
          camZ = lerp(8.2, 7.4, u);
          lookX = 0;
          lookY = 2.1;
          lookZ = -0.2;
        }
        break;
      }

      case 'onlineVault': {
        const isSplit = shot.id === 21 || shot.id === 22;
        const isTunnel = shot.id === 23;
        this.onlineVaultHero.visible = !isSplit;
        this.splitCompareGroup.visible = isSplit;
        this.speedTunnelGroup.visible = isTunnel;

        if (!isSplit) {
          // Vault blast doors open wide starting at 32.60s
          const openP = shot.id === 18 ? easeOutCubic(clamp(shotElapsed / 1.15, 0, 1)) : 1.0;
          this.onlineDoorLeft.position.x = lerp(-1.2, -3.55, openP);
          this.onlineDoorRight.position.x = lerp(1.2, 3.55, openP);
          this.onlineLightRays.visible = openP > 0.15;
          this.onlineLightRays.scale.set(openP, 1, openP);

          // Shot 19 (34.80-37.00): $10,000 stack flies smoothly into the glowing 4%+ vault
          const showFly = shot.id === 19 || shot.id === 20;
          this.flyingCashStack.visible = showFly;
          if (shot.id === 19) {
            const fp = easeInOutCubic(u);
            this.flyingCashStack.position.set(
              lerp(-3.6, 0.0, fp),
              lerp(1.4, 2.7, fp) + Math.sin(fp * Math.PI) * 1.45,
              lerp(3.4, -2.6, fp),
            );
            this.flyingCashStack.rotation.set(
              Math.sin(fp * Math.PI) * 0.28,
              lerp(0.9, 0.0, fp),
              Math.sin(fp * Math.PI) * -0.18,
            );
            this.flyingCashStack.scale.setScalar(lerp(0.95, 0.58, fp));
          } else if (shot.id === 20) {
            // Glowing inside vault while counter climbs to $430 / YEAR
            this.flyingCashStack.position.set(0, 2.1 + Math.sin(t * 3.5) * 0.14, -2.4);
            this.flyingCashStack.rotation.set(0, t * 0.9, 0);
            this.flyingCashStack.scale.setScalar(0.72);
          }

          if (isTunnel) {
            // Speed streaks rushing past camera toward the 4%+ vault
            for (let i = 0; i < 48; i++) {
              const p = (i / 48 + shotElapsed * 1.8) % 1;
              const a = i * 2.39996;
              const r = 2.2 + (i % 4) * 1.1;
              _dummy.position.set(Math.cos(a) * r, 2.6 + Math.sin(a) * r * 0.75, lerp(-5, 11, p));
              _dummy.rotation.set(0, 0, 0);
              _dummy.scale.set(1, 1, 1.3);
              _dummy.updateMatrix();
              this.speedStreaksInst.setMatrixAt(i, _dummy.matrix);
            }
            this.speedStreaksInst.instanceMatrix.needsUpdate = true;

            baseFov = 54;
            camX = Math.sin(t * 16) * 0.12;
            camY = 2.6 + Math.abs(Math.sin(t * 18)) * 0.15;
            camZ = lerp(9.4, 6.2, u);
            lookX = 0;
            lookY = 3.0;
            lookZ = -3.0;
          } else if (shot.id === 18) {
            camX = lerp(-1.1, 0.8, u);
            camY = lerp(3.2, 3.6, u);
            camZ = lerp(10.6, 8.8, u);
            lookX = 0;
            lookY = 3.2;
            lookZ = -2.8;
          } else if (shot.id === 19) {
            camX = lerp(-1.8, 1.0, u);
            camY = lerp(3.0, 3.4, u);
            camZ = lerp(9.8, 8.2, u);
            lookX = lerp(-1.4, 0, u);
            lookY = 2.8;
            lookZ = -1.2;
          } else {
            camX = lerp(0.8, -0.8, u);
            camY = lerp(3.0, 3.5, u);
            camZ = lerp(8.4, 7.2, u);
            lookX = 0;
            lookY = 3.1;
            lookZ = -2.6;
          }
        } else {
          // Shots 21 & 22 (39.10-42.30): Split screen $39 (small grey) vs $430 (big green 11x coin towers)
          const rise = easeOutCubic(clamp((t - 39.1) / 1.1, 0, 1));
          const towerOffsets: [number, number][] = [
            [2.15, 0.0],
            [1.45, 0.45],
            [2.85, 0.42],
            [1.55, -0.48],
            [2.78, -0.45],
          ];
          let ci = 0;
          for (let col = 0; col < 5; col++) {
            const [tx, tz] = towerOffsets[col];
            const stackH = col === 0 ? 30 : 20;
            for (let k = 0; k < stackH; k++) {
              const targetY = 0.72 + k * 0.115 * rise;
              _dummy.position.set(tx, targetY, tz);
              _dummy.rotation.set(0, k * 0.2 + t * 0.4, 0);
              _dummy.scale.setScalar(rise > 0.02 ? 1 : 0.001);
              _dummy.updateMatrix();
              this.splitRightCoinsInst.setMatrixAt(ci++, _dummy.matrix);
            }
          }
          this.splitRightCoinsInst.instanceMatrix.needsUpdate = true;

          camX = shot.id === 21 ? lerp(-0.5, 0.5, u) : lerp(0.5, -0.3, u);
          camY = lerp(3.2, 3.6, u);
          camZ = shot.id === 21 ? lerp(10.6, 9.6, u) : lerp(9.6, 8.5, u);
          lookX = 0;
          lookY = 2.4;
          lookZ = 0;
        }
        break;
      }

      case 'finale': {
        // Swirling 140-coin golden storm
        for (let i = 0; i < this.finaleCoinSeeds.length; i++) {
          const s = this.finaleCoinSeeds[i];
          const a = s.ang + t * s.spd;
          _dummy.position.set(
            Math.cos(a) * s.r,
            ((s.y + t * 0.65) % 9.2) + 0.3,
            Math.sin(a) * s.r - 1.5,
          );
          _dummy.rotation.set(t * s.spin, a, Math.sin(t * 2 + i) * 0.5);
          _dummy.scale.setScalar(1.0);
          _dummy.updateMatrix();
          this.finaleCoinsInst.setMatrixAt(i, _dummy.matrix);
        }
        this.finaleCoinsInst.instanceMatrix.needsUpdate = true;

        if (shot.id === 24 || shot.id === 25) {
          // 43.80-46.80: Card spins proudly showing "MONEY SECRET #3"
          this.finaleNoteGroup.visible = false;
          const finT = t - 43.8;
          this.finaleCardGroup.position.set(0, 3.7 + Math.sin(t * 2.8) * 0.16, 0);
          this.finaleCardGroup.rotation.y = finT * 1.15;
          this.finaleCardGroup.rotation.x = Math.sin(t * 1.8) * 0.07;

          camX = shot.id === 24 ? lerp(-1.2, 0.9, u) : lerp(0.9, -0.6, u);
          camY = lerp(3.4, 3.8, u);
          camZ = shot.id === 24 ? lerp(10.6, 9.5, u) : lerp(9.5, 8.6, u);
          lookX = 0;
          lookY = 3.2;
          lookZ = 0;
        } else {
          // Shot 26 (46.80-49.60): Card flips cleanly to back face (#4 teaser) + glowing generic $100 note!
          const flipP = easeOutCubic(clamp(shotElapsed / 0.55, 0, 1));
          this.finaleCardGroup.position.set(0, 4.15 + Math.sin(t * 2.5) * 0.12, -0.3);
          this.finaleCardGroup.rotation.y = lerp(0, Math.PI, flipP) + Math.sin(t * 1.4) * 0.08;
          this.finaleCardGroup.rotation.x = 0.04;

          this.finaleNoteGroup.visible = true;
          const notePop = easeOutBack(clamp((shotElapsed - 0.18) / 0.4, 0, 1), 1.35);
          this.finaleNoteGroup.scale.setScalar(Math.max(0.01, notePop));
          this.finaleNoteGroup.position.set(0, 1.5 + Math.sin(t * 3.2) * 0.12, 1.75);
          this.finaleNoteGroup.rotation.set(0.12, Math.sin(t * 1.7) * 0.24, Math.cos(t * 2.1) * 0.05);

          camX = lerp(-0.8, 0.9, u);
          camY = lerp(3.3, 3.6, u);
          camZ = lerp(9.8, 8.8, u);
          lookX = 0;
          lookY = 2.9;
          lookZ = 0.2;
        }
        break;
      }
    }

    // Apply mandatory 8% tighter FOV punch-in easing out over 0.25s on every cut
    this.camera.fov = punchInFov(baseFov, shotElapsed);
    this.camera.updateProjectionMatrix();
    this.camera.position.set(camX, camY, camZ);
    _camLook.set(lookX, lookY, lookZ);
    this.camera.lookAt(_camLook);

    if (this.isSoftwareGl) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }
  }

  public dispose(): void {
    this.composer.dispose();
    this.pmremTex?.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.renderer.dispose();
  }
}
