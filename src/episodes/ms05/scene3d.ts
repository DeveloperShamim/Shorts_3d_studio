/**
 * Money Secrets #5 — "The $10,000 That Vanished"
 * Deterministic 3D WebGL Engine (Three.js + RoomEnvironment + PCFSoft Shadows +
 * UnrealBloomPass + subtle BokehPass on close-ups + OutputPass + ACES tone mapping).
 *
 * All 12 grounded 3D worlds are composite multi-part PBR scenes with zero real logos,
 * zero real banknote designs (glowing light stacks/streams only), and wide 54° vertical FOV
 * framing so characters and subjects sit cleanly inside 9:16 without cropping.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
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
  easeOutCubic,
  invLerp,
  lerp,
  punchInFov,
} from '../../engine/prng';
import {
  createCityWindowTexture,
  createContactShadowTexture,
  createGridFloorTexture,
  createMarbleTexture,
  createSignPanelTexture,
} from '../../engine/textures3d';
import { Character3DManager, Clip3DName, HeldPropKind } from '../../engine/characters3d';
import { MS05_META } from './meta';

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl =
      probe.getContext('webgl2', { powerPreference: 'high-performance' }) ||
      probe.getContext('webgl', { powerPreference: 'high-performance' });
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function createSkyDome(topHex: string, midHex: string, bottomHex: string): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, topHex);
  grad.addColorStop(0.55, midHex);
  grad.addColorStop(1, bottomHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.SphereGeometry(95, 24, 18),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false }),
  );
}

function createClockFaceTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0E1422';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#3CE0FF';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(256, 256, 232, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r0 = i % 3 === 0 ? 175 : 196;
    const r1 = 216;
    ctx.strokeStyle = i % 3 === 0 ? '#FFD54A' : 'rgba(255,255,255,0.65)';
    ctx.lineWidth = i % 3 === 0 ? 10 : 5;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(ang) * r0, 256 + Math.sin(ang) * r0);
    ctx.lineTo(256 + Math.cos(ang) * r1, 256 + Math.sin(ang) * r1);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createWoodFloorTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const rng = createRng(5501);
  ctx.fillStyle = '#2A1D15';
  ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) {
    const y = row * 64;
    ctx.fillStyle = `rgb(${44 + Math.floor(rng.range(-6, 8))}, ${29 + Math.floor(rng.range(-4, 6))}, ${20 + Math.floor(rng.range(-3, 5))})`;
    ctx.fillRect(0, y + 2, 512, 60);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y, 512, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = maxAniso;
  return tex;
}

function createMs05CollectorCardTexture(
  maxAniso: number,
  side: 'front' | 'back',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 768, 1024);
  if (side === 'front') {
    grad.addColorStop(0, '#0D1728');
    grad.addColorStop(0.5, '#0A101C');
    grad.addColorStop(1, '#10241E');
  } else {
    grad.addColorStop(0, '#180E18');
    grad.addColorStop(0.5, '#0F101B');
    grad.addColorStop(1, '#260E16');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 768, 1024);

  // Subtle radial geometry
  ctx.strokeStyle = side === 'front' ? 'rgba(60, 224, 255, 0.16)' : 'rgba(255, 59, 92, 0.18)';
  ctx.lineWidth = 3;
  for (let r = 120; r <= 420; r += 75) {
    ctx.beginPath();
    ctx.arc(384, 512, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const borderCol = side === 'front' ? COLORS.cyan : COLORS.alertRed;
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
    ctx.fillText('VOICE OF TIMES', 384, 150);

    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 84px "Poppins", sans-serif';
    ctx.fillText('MONEY', 384, 325);
    ctx.fillText('SECRET', 384, 425);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 190px "Poppins", sans-serif';
    ctx.fillText('#5', 384, 625);

    ctx.fillStyle = COLORS.cyan;
    ctx.font = '700 36px "Poppins", sans-serif';
    ctx.fillText('THE $10,000 THAT VANISHED', 384, 835);
  } else {
    ctx.fillStyle = COLORS.alertRed;
    ctx.font = '700 36px "Poppins", sans-serif';
    ctx.fillText('NEXT EPISODE', 384, 130);

    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 118px "Poppins", sans-serif';
    ctx.fillText('#6', 384, 248);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 58px "Poppins", sans-serif';
    ctx.fillText('THE NIGHT', 384, 410);
    ctx.fillStyle = COLORS.alertRed;
    ctx.font = '800 62px "Poppins", sans-serif';
    ctx.fillText('A BANK DIED', 384, 490);

    // Stylized neon CLOSED box motif
    ctx.fillStyle = 'rgba(255, 59, 92, 0.14)';
    ctx.fillRect(144, 590, 480, 145);
    ctx.strokeStyle = COLORS.alertRed;
    ctx.lineWidth = 8;
    ctx.strokeRect(144, 590, 480, 145);
    ctx.fillStyle = COLORS.alertRed;
    ctx.font = '800 72px "Poppins", sans-serif';
    ctx.fillText('CLOSED', 384, 666);

    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '700 34px "Poppins", sans-serif';
    ctx.fillText('FOLLOW FOR SECRET #6', 384, 885);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

/** Composite 10-part metallic 3D sedan (generic, zero brand logos) */
function buildGenericCar(bodyColor: number): { group: THREE.Group; wheels: THREE.Mesh[] } {
  const group = new THREE.Group();
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: bodyColor,
    roughness: 0.18,
    metalness: 0.72,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1624,
    roughness: 0.12,
    metalness: 0.25,
    clearcoat: 0.9,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.65, metalness: 0.35 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd9e4f2, roughness: 0.18, metalness: 0.92 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.85, metalness: 0.05 });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff3cc,
    emissiveIntensity: 1.05,
    roughness: 0.18,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff2b48,
    emissive: 0xff2b48,
    emissiveIntensity: 0.95,
    roughness: 0.22,
  });

  // Lower chassis
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.56, 4.32), paintMat);
  lower.position.y = 0.62;
  lower.castShadow = true;
  lower.receiveShadow = true;
  group.add(lower);

  // Sculpted hood & rear deck bevel
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.16, 1.32), paintMat);
  hood.position.set(0, 0.94, 1.32);
  hood.rotation.x = 0.08;
  hood.castShadow = true;
  group.add(hood);

  // Cabin greenhouse
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.58, 2.05), glassMat);
  cabin.position.set(0, 1.18, -0.15);
  cabin.castShadow = true;
  group.add(cabin);

  // Roof cap
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.08, 1.72), paintMat);
  roof.position.set(0, 1.48, -0.18);
  roof.castShadow = true;
  group.add(roof);

  // Front grille & bumpers
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.22, 0.08), trimMat);
  grille.position.set(0, 0.58, 2.17);
  group.add(grille);

  for (const sx of [-0.66, 0.66]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.08), headlightMat);
    hl.position.set(sx, 0.72, 2.15);
    group.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), taillightMat);
    tl.position.set(sx, 0.74, -2.15);
    group.add(tl);
  }

  // 4 wheels with chrome hubs
  const wheels: THREE.Mesh[] = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 24);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.26, 16);
  rimGeo.rotateZ(Math.PI / 2);

  for (const [wx, wz] of [
    [-0.92, 1.36],
    [0.92, 1.36],
    [-0.92, -1.36],
    [0.92, -1.36],
  ]) {
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.position.set(wx, 0.36, wz);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, chromeMat);
    tire.add(rim);
    group.add(tire);
    wheels.push(tire);
  }

  return { group, wheels };
}

/** Composite 3D generic architectural building with cornice, doorway & lit windows */
function buildArchitecturalBlock(
  w: number,
  h: number,
  d: number,
  wallHex: number,
  accentHex: number,
  signTex?: THREE.Texture,
): THREE.Group {
  const grp = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: wallHex, roughness: 0.72, metalness: 0.12 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x262e40, roughness: 0.45, metalness: 0.4 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.85,
    roughness: 0.32,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  grp.add(body);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.36, d + 0.3), trimMat);
  plinth.position.y = 0.18;
  plinth.receiveShadow = true;
  grp.add(plinth);

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.28, d + 0.35), trimMat);
  cornice.position.y = h + 0.12;
  grp.add(cornice);

  const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), accentMat);
  strip.position.y = h - 0.18;
  grp.add(strip);

  if (signTex) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.86, 0.92),
      new THREE.MeshBasicMaterial({ map: signTex }),
    );
    sign.position.set(0, h - 0.95, d / 2 + 0.04);
    grp.add(sign);
  }

  return grp;
}

interface DynamicMonitorTex {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  lastKey: string;
  update(text: string, done: boolean): void;
}

function createDynamicMonitorTexture(maxAniso: number): DynamicMonitorTex {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;

  const api: DynamicMonitorTex = {
    canvas,
    ctx,
    tex,
    lastKey: '',
    update(text: string, done: boolean) {
      const k = `${text}_${done ? 1 : 0}`;
      if (k === this.lastKey) return;
      this.lastKey = k;
      ctx.fillStyle = '#07111C';
      ctx.fillRect(0, 0, 512, 320);
      ctx.strokeStyle = done ? COLORS.moneyGreen : COLORS.cyan;
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, 492, 300);
      ctx.fillStyle = COLORS.cyan;
      ctx.font = '700 28px "Poppins", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOAN LEDGER', 256, 74);
      ctx.fillStyle = done ? COLORS.moneyGreen : '#FFFFFF';
      ctx.font = '800 84px "Poppins", sans-serif';
      ctx.fillText(text, 256, 185);
      tex.needsUpdate = true;
    },
  };
  api.update('$0', false);
  return api;
}

interface DynamicCalendarTex {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  lastIdx: number;
  update(monthIdx: number): void;
}

function createDynamicCalendarTexture(maxAniso: number): DynamicCalendarTex {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;

  const api: DynamicCalendarTex = {
    canvas,
    ctx,
    tex,
    lastIdx: -1,
    update(monthIdx: number) {
      const idx = clamp(Math.floor(monthIdx), 0, 11);
      if (idx === this.lastIdx) return;
      this.lastIdx = idx;
      ctx.fillStyle = '#F2F4F8';
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = '#E0344E';
      ctx.fillRect(0, 0, 512, 136);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 68px "Poppins", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOAN YEAR', 256, 72);
      ctx.fillStyle = '#111827';
      ctx.font = '800 154px "Poppins", sans-serif';
      ctx.fillText(months[idx], 256, 308);
      ctx.fillStyle = '#6B7280';
      ctx.font = '700 38px "Poppins", sans-serif';
      ctx.fillText(`PAYMENT ${idx + 1} / 12`, 256, 444);
      tex.needsUpdate = true;
    },
  };
  api.update(0);
  return api;
}

export class Ms05ThreeEngine implements Episode3DController {
  public readonly canvas: HTMLCanvasElement;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly isSoftwareGl: boolean;
  public readonly ready: Promise<void>;

  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly bokehPass: BokehPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly characters: Character3DManager;

  // Lighting rig
  private readonly keyLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly accentLight: THREE.PointLight;

  // World roots
  private readonly worlds: Record<string, THREE.Group> = {};
  private readonly skyDomes: { night: THREE.Mesh; day: THREE.Mesh; dusk: THREE.Mesh; dark: THREE.Mesh };

  // Dynamic animated refs
  private readonly aptLightSlices: THREE.Mesh[] = [];
  private readonly aptParticles: THREE.InstancedMesh;
  private readonly aptParticleData: { x: number; y: number; z: number; vx: number; vy: number; vz: number; seed: number }[] = [];

  private readonly winParticles: THREE.InstancedMesh;
  private readonly winParticleData: { startX: number; startY: number; startZ: number; delay: number; arcY: number }[] = [];

  private readonly clockHourHand: THREE.Object3D;
  private readonly clockMinHand: THREE.Object3D;
  private readonly rewindParticles: THREE.InstancedMesh;
  private readonly rewindParticleData: { x: number; y: number; z: number; phase: number }[] = [];

  private readonly showroomCar: { group: THREE.Group; wheels: THREE.Mesh[] };
  private readonly driveCar: { group: THREE.Group; wheels: THREE.Mesh[] };

  private readonly vaultWheel: THREE.Object3D;
  private readonly vaultBeaconMat: THREE.MeshStandardMaterial;

  private readonly bankerMonitor: DynamicMonitorTex;
  private readonly bankerLightStack: THREE.Group;

  private readonly dealerStreamPulses: THREE.Mesh[] = [];
  private readonly dealerCurve: THREE.CatmullRomCurve3;

  private readonly cityLines: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; pulse: THREE.Mesh; curve: THREE.QuadraticBezierCurve3; order: number }[] = [];

  private readonly calTex: DynamicCalendarTex;
  private readonly calPageFlap: THREE.Object3D;
  private readonly calSlices: THREE.Mesh[] = [];
  private readonly calSparks: THREE.InstancedMesh;
  private readonly calSparkData: { x: number; z: number; seed: number }[] = [];

  private readonly flowGreenArrow: THREE.Group;
  private readonly flowRedArrow: THREE.Group;
  private readonly flowPrismSlices: THREE.Mesh[] = [];
  private readonly flowSparks: THREE.InstancedMesh;
  private readonly flowSparkData: { x: number; y: number; z: number; vx: number; vy: number; vz: number }[] = [];

  private readonly finaleCard: THREE.Group;
  private readonly finaleDarkBank: THREE.Group;
  private readonly finaleClosedSignMat: THREE.MeshStandardMaterial;
  private readonly finaleRain: THREE.InstancedMesh;
  private readonly finaleRainData: { x: number; y: number; z: number; speed: number }[] = [];

  private readonly dustPoints: THREE.Points;
  private readonly contactShadowTex: THREE.CanvasTexture;
  private readonly dummy = new THREE.Object3D();

  constructor() {
    this.isSoftwareGl = detectSoftwareGl();
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
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x090d18, 0.022);

    // RoomEnvironment for crisp PBR specular reflections on every device
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.65;
    pmrem.dispose();

    // Wide 54° vertical FOV for comfortable 9:16 vertical framing
    this.camera = new THREE.PerspectiveCamera(54, WIDTH / HEIGHT, 0.1, 220);

    // 3-point PBR studio lighting rig (calibrated so diffuse surfaces stay crisp and glare-free)
    this.hemiLight = new THREE.HemisphereLight(0x88b4ff, 0x1a1622, 0.54);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1dc, 1.48);
    this.keyLight.position.set(5, 9, 7);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 36;
    const sd = 10;
    this.keyLight.shadow.camera.left = -sd;
    this.keyLight.shadow.camera.right = sd;
    this.keyLight.shadow.camera.top = sd;
    this.keyLight.shadow.camera.bottom = -sd;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.rimLight = new THREE.DirectionalLight(0x6ad4ff, 1.05);
    this.rimLight.position.set(-6, 5, -6);
    this.scene.add(this.rimLight);

    this.accentLight = new THREE.PointLight(0xffd54a, 2.2, 22, 2);
    this.accentLight.position.set(0, 3, 2);
    this.scene.add(this.accentLight);

    // Sky domes (never a black void)
    this.skyDomes = {
      night: createSkyDome('#050914', '#0D172B', '#181E30'),
      day: createSkyDome('#4A8CE0', '#8EC5F5', '#D6E8F8'),
      dusk: createSkyDome('#0A1228', '#1C2242', '#3A2438'),
      dark: createSkyDome('#05060C', '#0A0D18', '#121524'),
    };
    Object.values(this.skyDomes).forEach((d) => {
      d.visible = false;
      this.scene.add(d);
    });

    // Global ambient dust motes
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(220 * 3);
    const rngDust = createRng(50501);
    for (let i = 0; i < 220; i++) {
      dustPos[i * 3] = rngDust.range(-12, 12);
      dustPos[i * 3 + 1] = rngDust.range(0.3, 8);
      dustPos[i * 3 + 2] = rngDust.range(-12, 12);
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.dustPoints = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: 0xffe4a0, size: 0.055, transparent: true, opacity: 0.35 }),
    );
    this.scene.add(this.dustPoints);

    // Shared procedural textures
    this.contactShadowTex = createContactShadowTexture();
    const woodTex = createWoodFloorTexture(maxAniso);
    const marbleTex = createMarbleTexture(maxAniso);
    const cityWinTex = createCityWindowTexture(maxAniso);
    const gridTex = createGridFloorTexture(maxAniso, '#3CE0FF', '#090D18');

    // Realistic 3D Characters (Jordan & Maya built-in 3D rigs + optional Mixamo GLB override)
    this.characters = new Character3DManager();
    this.scene.add(this.characters.man.container);
    this.scene.add(this.characters.woman.container);
    this.characters.man.container.visible = false;
    this.characters.woman.container.visible = false;

    const addWorld = (name: string): THREE.Group => {
      const g = new THREE.Group();
      g.name = `world_${name}`;
      g.visible = false;
      this.scene.add(g);
      this.worlds[name] = g;
      return g;
    };

    const particleGeo = new THREE.OctahedronGeometry(0.055, 0);
    const goldEmissiveMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      emissive: 0xffbe2e,
      emissiveIntensity: 1.25,
      roughness: 0.28,
    });
    const greenEmissiveMat = new THREE.MeshStandardMaterial({
      color: 0x22e07a,
      emissive: 0x22e07a,
      emissiveIntensity: 1.05,
      roughness: 0.28,
    });

    // =========================================================================
    // WORLD 1: NIGHT APARTMENT (Shots 1, 2, 4, 5, 20, 21, 29)
    // =========================================================================
    const apt = addWorld('apartment');
    const aptFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62, metalness: 0.06 }),
    );
    aptFloor.rotation.x = -Math.PI / 2;
    aptFloor.receiveShadow = true;
    apt.add(aptFloor);

    // Rug (offset +0.025 on Y to prevent Z-fighting)
    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 0.03, 3.8),
      new THREE.MeshStandardMaterial({ color: 0x1d2538, roughness: 0.92 }),
    );
    rug.position.set(0, 0.025, 0.2);
    rug.receiveShadow = true;
    apt.add(rug);

    // Back wall + side walls + framed night window
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x171d2c, roughness: 0.84 });
    const backWallL = new THREE.Mesh(new THREE.BoxGeometry(4.5, 6.2, 0.25), wallMat);
    backWallL.position.set(-4.2, 3.1, -3.2);
    const backWallR = new THREE.Mesh(new THREE.BoxGeometry(4.5, 6.2, 0.25), wallMat);
    backWallR.position.set(4.2, 3.1, -3.2);
    const backWallTop = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.8, 0.25), wallMat);
    backWallTop.position.set(0, 5.3, -3.2);
    const backWallBot = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 0.25), wallMat);
    backWallBot.position.set(0, 0.65, -3.2);
    apt.add(backWallL, backWallR, backWallTop, backWallBot);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x262e42, roughness: 0.45, metalness: 0.45 });
    const sill = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.14, 0.36), frameMat);
    sill.position.set(0, 1.32, -3.15);
    apt.add(sill);

    // Distant city silhouettes outside apartment window
    const rngApt = createRng(5502);
    for (let i = 0; i < 10; i++) {
      const bh = rngApt.range(3.5, 9.0);
      const bld = new THREE.Mesh(
        new THREE.BoxGeometry(rngApt.range(1.2, 2.2), bh, rngApt.range(1.2, 2.2)),
        new THREE.MeshStandardMaterial({ map: cityWinTex, roughness: 0.6, metalness: 0.2 }),
      );
      bld.position.set(-8 + i * 1.8, bh / 2 - 1.5, -13 - rngApt.range(0, 6));
      apt.add(bld);
    }

    // Composite modern sofa
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x28334a, roughness: 0.86 });
    const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.46, 1.05), sofaMat);
    sofaBase.position.set(-0.9, 0.28, -1.35);
    sofaBase.castShadow = true;
    sofaBase.receiveShadow = true;
    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.68, 0.26), sofaMat);
    sofaBack.position.set(-0.9, 0.78, -1.78);
    sofaBack.castShadow = true;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.56, 1.05), sofaMat);
    armL.position.set(-2.24, 0.48, -1.35);
    const armR = armL.clone();
    armR.position.x = 0.44;
    apt.add(sofaBase, sofaBack, armL, armR);

    // Warm standing floor lamp on left
    const lampPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 2.05, 12),
      new THREE.MeshStandardMaterial({ color: 0x1b202b, metalness: 0.8, roughness: 0.28 }),
    );
    lampPole.position.set(-2.7, 1.025, -1.8);
    const lampShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.38, 0.46, 20, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xffe2a8,
        emissive: 0xffb84d,
        emissiveIntensity: 0.62,
        side: THREE.DoubleSide,
        roughness: 0.72,
      }),
    );
    lampShade.position.set(-2.7, 2.1, -1.8);
    apt.add(lampPole, lampShade);

    // Coffee table + glowing $10,000 light stack (10 glowing bars that dissolve)
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.08, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x3a261a, roughness: 0.45, metalness: 0.1 }),
    );
    tableTop.position.set(0.85, 0.56, 0.05);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    apt.add(tableTop);
    for (const [lx, lz] of [[-0.6, -0.32], [0.6, -0.32], [-0.6, 0.32], [0.6, 0.32]]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.025, 0.56, 10),
        new THREE.MeshStandardMaterial({ color: 0x181c24, metalness: 0.75, roughness: 0.3 }),
      );
      leg.position.set(0.85 + lx, 0.28, 0.05 + lz);
      apt.add(leg);
    }

    for (let i = 0; i < 10; i++) {
      const slice = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.068, 0.38),
        new THREE.MeshStandardMaterial({
          color: 0xffe066,
          emissive: i % 2 === 0 ? 0xffc83d : 0x22e07a,
          emissiveIntensity: 0.92,
          roughness: 0.25,
          transparent: true,
          opacity: 0.95,
        }),
      );
      slice.position.set(0.85, 0.65 + i * 0.082, 0.05);
      apt.add(slice);
      this.aptLightSlices.push(slice);
    }

    // Dissolving golden particles rising from coffee table
    this.aptParticles = new THREE.InstancedMesh(particleGeo, goldEmissiveMat, 96);
    this.aptParticles.frustumCulled = false;
    const rngP1 = createRng(5503);
    for (let i = 0; i < 96; i++) {
      this.aptParticleData.push({
        x: 0.85 + rngP1.range(-0.42, 0.42),
        y: 0.65 + rngP1.range(0, 0.88),
        z: 0.05 + rngP1.range(-0.24, 0.24),
        vx: rngP1.range(-0.65, 0.45),
        vy: rngP1.range(0.9, 2.3),
        vz: rngP1.range(-1.9, -0.5),
        seed: rngP1.range(0, Math.PI * 2),
      });
    }
    apt.add(this.aptParticles);

    // =========================================================================
    // WORLD 2: APARTMENT WINDOW PARTICLES FLY OUT INTO NIGHT SKY (Shot 3)
    // =========================================================================
    const winW = addWorld('apartmentWindow');
    const winWallMat = new THREE.MeshStandardMaterial({ color: 0x131926, roughness: 0.85 });
    const wLeft = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 0.35), winWallMat);
    wLeft.position.set(-3.6, 3.2, 0);
    const wRight = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 0.35), winWallMat);
    wRight.position.set(3.6, 3.2, 0);
    const wTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.35), winWallMat);
    wTop.position.set(0, 5.5, 0);
    const wBot = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, 0.35), winWallMat);
    wBot.position.set(0, 0.75, 0);
    const wSill = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.16, 0.5), frameMat);
    wSill.position.set(0, 1.52, 0.05);
    winW.add(wLeft, wRight, wTop, wBot, wSill);

    // City skyline outside
    const rngSky = createRng(5504);
    for (let i = 0; i < 16; i++) {
      const h = rngSky.range(4, 13);
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(rngSky.range(1.4, 2.6), h, rngSky.range(1.4, 2.6)),
        new THREE.MeshStandardMaterial({ map: cityWinTex, roughness: 0.55 }),
      );
      tower.position.set(-12 + i * 1.7, h / 2 - 4, -14 - rngSky.range(0, 10));
      winW.add(tower);
    }

    this.winParticles = new THREE.InstancedMesh(particleGeo, goldEmissiveMat, 110);
    this.winParticles.frustumCulled = false;
    const rngWP = createRng(5505);
    for (let i = 0; i < 110; i++) {
      this.winParticleData.push({
        startX: rngWP.range(-1.1, 1.1),
        startY: rngWP.range(1.7, 2.8),
        startZ: rngWP.range(1.4, 3.2),
        delay: rngWP.range(0, 0.65),
        arcY: rngWP.range(1.4, 4.2),
      });
    }
    winW.add(this.winParticles);

    // =========================================================================
    // WORLD 3: REWIND ROOM — BACKWARDS CLOCK & REVERSE PARTICLES (Shot 6)
    // =========================================================================
    const rew = addWorld('rewindRoom');
    const rewFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.45, metalness: 0.25 }),
    );
    rewFloor.rotation.x = -Math.PI / 2;
    rew.add(rewFloor);

    const clockGrp = new THREE.Group();
    clockGrp.position.set(0, 2.35, -1.6);
    const clockRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.22, 0.12, 16, 40),
      new THREE.MeshStandardMaterial({ color: 0x3ce0ff, emissive: 0x1aa8cc, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.2 }),
    );
    const clockFace = new THREE.Mesh(
      new THREE.CircleGeometry(1.18, 36),
      new THREE.MeshBasicMaterial({ map: createClockFaceTexture(maxAniso) }),
    );
    clockFace.position.z = -0.02;
    clockGrp.add(clockRim, clockFace);

    this.clockHourHand = new THREE.Group();
    const hHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.68, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0xffd54a, emissiveIntensity: 1.2 }),
    );
    hHand.position.y = 0.28;
    this.clockHourHand.position.z = 0.06;
    this.clockHourHand.add(hHand);

    this.clockMinHand = new THREE.Group();
    const mHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.95, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x3ce0ff, emissiveIntensity: 1.3 }),
    );
    mHand.position.y = 0.42;
    this.clockMinHand.position.z = 0.1;
    this.clockMinHand.add(mHand);

    const centerPin = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.9, roughness: 0.15 }),
    );
    centerPin.position.z = 0.13;
    clockGrp.add(this.clockHourHand, this.clockMinHand, centerPin);
    rew.add(clockGrp);

    this.rewindParticles = new THREE.InstancedMesh(particleGeo, goldEmissiveMat, 90);
    this.rewindParticles.frustumCulled = false;
    const rngRw = createRng(5506);
    for (let i = 0; i < 90; i++) {
      this.rewindParticleData.push({
        x: rngRw.range(-3.6, 3.6),
        y: rngRw.range(0.5, 4.4),
        z: rngRw.range(-6, 4),
        phase: rngRw.range(0, 1),
      });
    }
    rew.add(this.rewindParticles);

    // =========================================================================
    // WORLD 4: CAR SHOWROOM AT DAY (Shot 7)
    // =========================================================================
    const show = addWorld('carShowroom');
    const showFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 34),
      new THREE.MeshStandardMaterial({ color: 0xc8d2de, roughness: 0.28, metalness: 0.15 }),
    );
    showFloor.rotation.x = -Math.PI / 2;
    showFloor.receiveShadow = true;
    show.add(showFloor);

    // Showroom turntable platform
    const turntable = new THREE.Mesh(
      new THREE.CylinderGeometry(2.65, 2.8, 0.16, 40),
      new THREE.MeshStandardMaterial({ color: 0x1e2636, roughness: 0.25, metalness: 0.65 }),
    );
    turntable.position.set(0.35, 0.08, -0.4);
    turntable.receiveShadow = true;
    show.add(turntable);

    const ringGlow = new THREE.Mesh(
      new THREE.TorusGeometry(2.68, 0.035, 10, 48),
      new THREE.MeshStandardMaterial({ color: 0x3ce0ff, emissive: 0x3ce0ff, emissiveIntensity: 1.5 }),
    );
    ringGlow.rotation.x = Math.PI / 2;
    ringGlow.position.set(0.35, 0.17, -0.4);
    show.add(ringGlow);

    this.showroomCar = buildGenericCar(0x1f7ae0);
    this.showroomCar.group.position.set(0.35, 0.16, -0.4);
    this.showroomCar.group.rotation.y = 0.52;
    show.add(this.showroomCar.group);

    // Glass showroom columns & price placard
    for (let sx = -6; sx <= 6; sx += 4) {
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 6.2, 0.28),
        new THREE.MeshStandardMaterial({ color: 0x344055, metalness: 0.7, roughness: 0.3 }),
      );
      col.position.set(sx, 3.1, -4.6);
      show.add(col);
    }
    const priceStand = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.85, 0.08),
      new THREE.MeshBasicMaterial({ map: createSignPanelTexture(maxAniso, '$10,000', 'AUTO SALE', COLORS.moneyGreen) }),
    );
    priceStand.position.set(1.75, 1.55, 1.35);
    priceStand.rotation.y = -0.35;
    show.add(priceStand);

    // =========================================================================
    // WORLD 5: BRIGHT GENERIC BANK LOBBY (Shot 8)
    // =========================================================================
    const lobby = addWorld('bankLobby');
    const lobbyFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 34),
      new THREE.MeshStandardMaterial({ map: marbleTex, color: 0xd5dce6, roughness: 0.22, metalness: 0.14 }),
    );
    lobbyFloor.rotation.x = -Math.PI / 2;
    lobbyFloor.receiveShadow = true;
    lobby.add(lobbyFloor);

    const colStoneMat = new THREE.MeshStandardMaterial({ color: 0xd6d2c8, roughness: 0.48, metalness: 0.08 });
    for (const sx of [-3.4, 3.4]) {
      for (let sz = -9; sz <= 3; sz += 4) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 6.4, 18), colStoneMat);
        col.position.set(sx, 3.2, sz);
        col.castShadow = true;
        lobby.add(col);
      }
    }
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 1.15, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x2a3346, roughness: 0.35, metalness: 0.25 }),
    );
    counter.position.set(0, 0.575, -6.2);
    counter.castShadow = true;
    counter.receiveShadow = true;
    const bankHeader = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 1.35),
      new THREE.MeshBasicMaterial({ map: createSignPanelTexture(maxAniso, 'BANK', 'LOAN DESK', COLORS.cyan) }),
    );
    bankHeader.position.set(0, 3.6, -7.2);
    lobby.add(counter, bankHeader);

    // =========================================================================
    // WORLD 6: CLOSED STEEL BANK VAULT DOOR (Shot 9)
    // =========================================================================
    const vault = addWorld('vaultClosed');
    const vaultFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ color: 0x161c28, roughness: 0.38, metalness: 0.35 }),
    );
    vaultFloor.rotation.x = -Math.PI / 2;
    vaultFloor.receiveShadow = true;
    vault.add(vaultFloor);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x566275, roughness: 0.28, metalness: 0.88 });
    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x202736, roughness: 0.42, metalness: 0.78 });

    const vaultWall = new THREE.Mesh(new THREE.BoxGeometry(11, 7.5, 1.2), darkSteelMat);
    vaultWall.position.set(0, 3.75, -2.1);
    vault.add(vaultWall);

    const doorRim = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.55, 40), darkSteelMat);
    doorRim.rotation.x = Math.PI / 2;
    doorRim.position.set(0, 2.25, -1.45);
    const doorDisk = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.78, 0.42, 40), steelMat);
    doorDisk.rotation.x = Math.PI / 2;
    doorDisk.position.set(0, 2.25, -1.25);
    doorDisk.castShadow = true;
    vault.add(doorRim, doorDisk);

    // 8 steel locking bolts around perimeter
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.46, 12), steelMat);
      bolt.position.set(Math.cos(ang) * 1.72, 2.25 + Math.sin(ang) * 1.72, -1.12);
      bolt.rotation.z = ang + Math.PI / 2;
      vault.add(bolt);
    }

    // Spoked vault wheel (stays locked!)
    this.vaultWheel = new THREE.Group();
    this.vaultWheel.position.set(0, 2.25, -0.92);
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.075, 14, 32), steelMat);
    this.vaultWheel.add(wheelRing);
    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.32, 10), steelMat);
      spoke.rotation.z = (s / 5) * Math.PI;
      this.vaultWheel.add(spoke);
    }
    vault.add(this.vaultWheel);

    // Red locked beacon bar above vault
    this.vaultBeaconMat = new THREE.MeshStandardMaterial({
      color: 0xff3b5c,
      emissive: 0xff3b5c,
      emissiveIntensity: 1.15,
      roughness: 0.28,
    });
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.18), this.vaultBeaconMat);
    beacon.position.set(0, 4.55, -1.4);
    vault.add(beacon);

    // =========================================================================
    // WORLD 7: ROWS OF SAVINGS DRAWERS — UNTOUCHED (Shot 10)
    // =========================================================================
    const drawersW = addWorld('savingsDrawers');
    const dFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ color: 0x121824, roughness: 0.35, metalness: 0.3 }),
    );
    dFloor.rotation.x = -Math.PI / 2;
    drawersW.add(dFloor);

    const drawerBodyMat = new THREE.MeshStandardMaterial({ color: 0x3b465b, roughness: 0.34, metalness: 0.82 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd9b154, roughness: 0.28, metalness: 0.88 });
    const cabinetBack = new THREE.Mesh(new THREE.BoxGeometry(8.6, 5.2, 0.8), darkSteelMat);
    cabinetBack.position.set(0, 2.6, -2.0);
    drawersW.add(cabinetBack);

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) {
        const dx = -3.0 + c * 1.2;
        const dy = 0.65 + r * 0.86;
        const face = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.72, 0.12), drawerBodyMat);
        face.position.set(dx, dy, -1.55);
        face.castShadow = true;
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.12), brassMat);
        handle.position.set(dx, dy - 0.05, -1.45);
        const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 10), brassMat);
        lock.rotation.x = Math.PI / 2;
        lock.position.set(dx + 0.34, dy + 0.12, -1.48);
        drawersW.add(face, handle, lock);
      }
    }

    // =========================================================================
    // WORLD 8: BANKER DESK + COMPUTER MONITOR + WOMAN (Shots 11, 12, 13, 14)
    // =========================================================================
    const deskW = addWorld('bankerDesk');
    const deskFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.MeshStandardMaterial({ map: marbleTex, color: 0x202838, roughness: 0.34, metalness: 0.18 }),
    );
    deskFloor.rotation.x = -Math.PI / 2;
    deskFloor.receiveShadow = true;
    deskW.add(deskFloor);

    // Office back wall with glass panels
    const officeBack = new THREE.Mesh(
      new THREE.BoxGeometry(12, 6, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x162033, roughness: 0.72 }),
    );
    officeBack.position.set(0, 3, -3.5);
    deskW.add(officeBack);

    // Walnut & steel banker desk
    const deskTop = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.11, 1.25),
      new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.38, metalness: 0.12 }),
    );
    deskTop.position.set(0, 0.88, 0.45);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    const deskPanel = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 0.84, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1b2333, roughness: 0.55 }),
    );
    deskPanel.position.set(0, 0.42, 0.98);
    deskW.add(deskTop, deskPanel);

    // Monitor + keyboard
    this.bankerMonitor = createDynamicMonitorTexture(maxAniso);
    const monStand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.14), darkSteelMat);
    monStand.position.set(0.65, 1.08, 0.42);
    const monBezel = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.74, 0.06), darkSteelMat);
    monBezel.position.set(0.65, 1.46, 0.42);
    monBezel.rotation.y = -0.34;
    const monScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 0.65),
      new THREE.MeshBasicMaterial({ map: this.bankerMonitor.tex }),
    );
    monScreen.position.z = 0.036;
    monBezel.add(monScreen);
    const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.24), darkSteelMat);
    keyboard.position.set(-0.05, 0.95, 0.24);
    deskW.add(monStand, monBezel, keyboard);

    // Glowing holographic $10,000 light stack materializing on the right side of the desk
    this.bankerLightStack = new THREE.Group();
    this.bankerLightStack.position.set(1.08, 0.96, 0.65);
    for (let i = 0; i < 8; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.062, 0.28), greenEmissiveMat);
      bar.position.y = i * 0.078;
      this.bankerLightStack.add(bar);
    }
    deskW.add(this.bankerLightStack);

    // =========================================================================
    // WORLD 9: CAR DRIVES OUT OF SHOWROOM ON BOULEVARD (Shot 15)
    // =========================================================================
    const driveW = addWorld('carDriveOut');
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 80),
      new THREE.MeshStandardMaterial({ color: 0x262b36, roughness: 0.82 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    driveW.add(road);

    const groundSide = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x3b5944, roughness: 0.92 }),
    );
    groundSide.rotation.x = -Math.PI / 2;
    groundSide.position.y = -0.04;
    driveW.add(groundSide);

    // Dashed road lane markings
    for (let rz = -32; rz <= 32; rz += 4.5) {
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.02, 2.0),
        new THREE.MeshStandardMaterial({ color: 0xffd54a, roughness: 0.5 }),
      );
      dash.position.set(0, 0.02, rz);
      driveW.add(dash);
    }

    // Showroom building behind car + stylized roadside trees
    const showroomBuilding = buildArchitecturalBlock(
      11,
      5.2,
      6,
      0xd8e0ea,
      0x3ce0ff,
      createSignPanelTexture(maxAniso, 'AUTO DEALER', 'SHOWROOM', COLORS.highlightYellow),
    );
    showroomBuilding.position.set(-8.5, 0, -4);
    showroomBuilding.rotation.y = Math.PI / 2;
    driveW.add(showroomBuilding);

    for (let tz = -18; tz <= 18; tz += 9) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.22, 1.8, 10),
        new THREE.MeshStandardMaterial({ color: 0x4f3828, roughness: 0.9 }),
      );
      trunk.position.y = 0.9;
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(1.15, 14, 12),
        new THREE.MeshStandardMaterial({ color: 0x2c7848, roughness: 0.8 }),
      );
      crown.position.y = 2.45;
      tree.add(trunk, crown);
      tree.position.set(6.8, 0, tz);
      driveW.add(tree);
    }

    this.driveCar = buildGenericCar(0x1f7ae0);
    driveW.add(this.driveCar.group);

    // =========================================================================
    // WORLD 10: DEALER -> SECOND BANK GLOWING MONEY STREAM (Shot 16)
    // =========================================================================
    const transferW = addWorld('dealerTransfer');
    const tFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.55, metalness: 0.2 }),
    );
    tFloor.rotation.x = -Math.PI / 2;
    transferW.add(tFloor);

    const dealerBld = buildArchitecturalBlock(
      2.9,
      3.1,
      2.6,
      0x222c42,
      0xffd54a,
      createSignPanelTexture(maxAniso, 'DEALER', 'DEPOSIT', COLORS.highlightYellow),
    );
    dealerBld.position.set(-2.9, 0, -1.2);
    const bank2Bld = buildArchitecturalBlock(
      3.1,
      4.4,
      2.8,
      0x1a2838,
      0x22e07a,
      createSignPanelTexture(maxAniso, 'BANK #2', 'CHECKING', COLORS.moneyGreen),
    );
    bank2Bld.position.set(2.9, 0, -1.2);
    transferW.add(dealerBld, bank2Bld);

    this.dealerCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.6, 2.2, -0.4),
      new THREE.Vector3(-0.8, 3.85, 0.35),
      new THREE.Vector3(0.9, 3.9, 0.35),
      new THREE.Vector3(2.6, 2.4, -0.4),
    ]);
    const streamTube = new THREE.Mesh(
      new THREE.TubeGeometry(this.dealerCurve, 44, 0.095, 12, false),
      new THREE.MeshStandardMaterial({
        color: 0x22e07a,
        emissive: 0x22e07a,
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.85,
      }),
    );
    transferW.add(streamTube);

    for (let i = 0; i < 8; i++) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), goldEmissiveMat);
      transferW.add(orb);
      this.dealerStreamPulses.push(orb);
    }

    // =========================================================================
    // WORLD 11: AERIAL DUSK/NIGHT CITY WITH GLOWING MONEY LINES (Shots 17 & 26)
    // =========================================================================
    const cityW = addWorld('duskCity');
    const cFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x090e1a, roughness: 0.72, metalness: 0.25 }),
    );
    cFloor.rotation.x = -Math.PI / 2;
    cityW.add(cFloor);

    const rngCity = createRng(5507);
    const roofPoints: THREE.Vector3[] = [];
    for (let gx = -3; gx <= 3; gx++) {
      for (let gz = -3; gz <= 2; gz++) {
        const bx = gx * 2.55 + rngCity.range(-0.35, 0.35);
        const bz = gz * 2.55 + rngCity.range(-0.35, 0.35);
        const bh = rngCity.range(1.6, 5.4);
        const bw = rngCity.range(1.15, 1.85);
        const bd = rngCity.range(1.15, 1.85);
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(bw, bh, bd),
          new THREE.MeshStandardMaterial({ map: cityWinTex, roughness: 0.5, metalness: 0.25 }),
        );
        b.position.set(bx, bh / 2, bz);
        cityW.add(b);
        roofPoints.push(new THREE.Vector3(bx, bh + 0.15, bz));
      }
    }

    // 18 glowing arcs connecting rooftops across the city
    for (let i = 0; i < 18; i++) {
      const a = roofPoints[(i * 3) % roofPoints.length];
      const b = roofPoints[(i * 7 + 5) % roofPoints.length];
      const mid = a.clone().lerp(b, 0.5);
      mid.y += rngCity.range(1.4, 3.2);
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const col = i % 3 === 0 ? 0xffd54a : i % 3 === 1 ? 0x22e07a : 0x3ce0ff;
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92 });
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.055, 8, false), mat);
      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      cityW.add(mesh, pulse);
      this.cityLines.push({ mesh, mat, pulse, curve, order: i / 18 });
    }

    // =========================================================================
    // WORLD 12: 3D WALL CALENDAR + 12-SLICE LIGHT STACK (Shots 18 & 19)
    // =========================================================================
    const calW = addWorld('calendarStack');
    const calTable = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ color: 0x101521, roughness: 0.45, metalness: 0.3 }),
    );
    calTable.rotation.x = -Math.PI / 2;
    calTable.receiveShadow = true;
    calW.add(calTable);

    // 3D Wall Calendar on left
    const calFrame = new THREE.Group();
    calFrame.position.set(-1.35, 2.15, -0.65);
    calFrame.rotation.y = 0.22;
    const calBack = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.95, 0.14), darkSteelMat);
    this.calTex = createDynamicCalendarTexture(maxAniso);
    const calFace = new THREE.Mesh(
      new THREE.PlaneGeometry(1.72, 1.82),
      new THREE.MeshBasicMaterial({ map: this.calTex.tex }),
    );
    calFace.position.z = 0.08;
    // Flipping top sheet hinge
    this.calPageFlap = new THREE.Group();
    this.calPageFlap.position.set(0, 0.91, 0.09);
    const flapSheet = new THREE.Mesh(
      new THREE.PlaneGeometry(1.72, 1.82),
      new THREE.MeshStandardMaterial({ color: 0xe8edf5, roughness: 0.65, side: THREE.DoubleSide }),
    );
    flapSheet.position.y = -0.91;
    this.calPageFlap.add(flapSheet);
    calFrame.add(calBack, calFace, this.calPageFlap);
    calW.add(calFrame);

    // 12-Slice Glowing Light Stack on right pedestal
    const calPed = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.32, 0.38, 28),
      darkSteelMat,
    );
    calPed.position.set(1.05, 0.19, 0.15);
    calW.add(calPed);

    for (let i = 0; i < 12; i++) {
      const slice = new THREE.Mesh(
        new THREE.BoxGeometry(1.42, 0.11, 0.72),
        new THREE.MeshStandardMaterial({
          color: 0xffe478,
          emissive: i === 0 ? 0xff3b5c : 0x22e07a,
          emissiveIntensity: 0.92,
          roughness: 0.24,
          transparent: true,
          opacity: 0.96,
        }),
      );
      slice.position.set(1.05, 0.48 + i * 0.138, 0.15);
      calW.add(slice);
      this.calSlices.push(slice);
    }

    this.calSparks = new THREE.InstancedMesh(particleGeo, goldEmissiveMat, 72);
    this.calSparks.frustumCulled = false;
    const rngCS = createRng(5508);
    for (let i = 0; i < 72; i++) {
      this.calSparkData.push({
        x: 1.05 + rngCS.range(-0.75, 0.75),
        z: 0.15 + rngCS.range(-0.4, 0.4),
        seed: rngCS.range(0, 1),
      });
    }
    calW.add(this.calSparks);

    // =========================================================================
    // WORLD 13: GRAND CENTRAL BANK STONE HALL (Shot 22)
    // =========================================================================
    const hall = addWorld('centralHall');
    const hallFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 42),
      new THREE.MeshStandardMaterial({ map: marbleTex, color: 0x8e8679, roughness: 0.26, metalness: 0.14 }),
    );
    hallFloor.rotation.x = -Math.PI / 2;
    hallFloor.receiveShadow = true;
    hall.add(hallFloor);

    const travertineMat = new THREE.MeshStandardMaterial({ color: 0xc9beaa, roughness: 0.56, metalness: 0.05 });
    for (const sx of [-3.6, 3.6]) {
      for (let sz = -12; sz <= 4; sz += 4) {
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.6, 1.15), travertineMat);
        plinth.position.set(sx, 0.3, sz);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 6.8, 20), travertineMat);
        shaft.position.set(sx, 3.9, sz);
        shaft.castShadow = true;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 1.2), travertineMat);
        cap.position.set(sx, 7.4, sz);
        hall.add(plinth, shaft, cap);
      }
    }
    const pediment = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.6, 1.2), travertineMat);
    pediment.position.set(0, 7.6, -12.5);
    const hallArch = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 6.8, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x2a2722, roughness: 0.8 }),
    );
    hallArch.position.set(0, 3.4, -13.5);
    hall.add(pediment, hallArch);

    // =========================================================================
    // WORLD 14: CREATION / DESTRUCTION 3D ARROW CHAMBER (Shots 23 & 24)
    // =========================================================================
    const flowW = addWorld('flowChamber');
    const fFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(32, 32),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.42, metalness: 0.25 }),
    );
    fFloor.rotation.x = -Math.PI / 2;
    flowW.add(fFloor);

    const build3DArrow = (hex: number): THREE.Group => {
      const g = new THREE.Group();
      const s = new THREE.Shape();
      s.moveTo(-2.1, -0.28);
      s.lineTo(0.85, -0.28);
      s.lineTo(0.85, -0.72);
      s.lineTo(2.15, 0);
      s.lineTo(0.85, 0.72);
      s.lineTo(0.85, 0.28);
      s.lineTo(-2.1, 0.28);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05 });
      geo.center();
      const mat = new THREE.MeshStandardMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: 1.05,
        roughness: 0.28,
        metalness: 0.35,
      });
      g.add(new THREE.Mesh(geo, mat));
      return g;
    };

    this.flowGreenArrow = build3DArrow(0x22e07a);
    this.flowGreenArrow.position.set(-1.3, 2.35, 0);
    this.flowRedArrow = build3DArrow(0xff3b5c);
    this.flowRedArrow.position.set(-1.3, 2.35, 0);
    flowW.add(this.flowGreenArrow, this.flowRedArrow);

    for (let i = 0; i < 9; i++) {
      const sl = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.11, 0.62),
        new THREE.MeshStandardMaterial({
          color: 0xffe066,
          emissive: 0x22e07a,
          emissiveIntensity: 0.92,
          transparent: true,
          opacity: 0.95,
        }),
      );
      sl.position.set(1.55, 1.55 + i * 0.145, 0);
      flowW.add(sl);
      this.flowPrismSlices.push(sl);
    }

    this.flowSparks = new THREE.InstancedMesh(particleGeo, goldEmissiveMat, 80);
    this.flowSparks.frustumCulled = false;
    const rngFS = createRng(5509);
    for (let i = 0; i < 80; i++) {
      this.flowSparkData.push({
        x: 1.55 + rngFS.range(-0.6, 0.6),
        y: 1.6 + rngFS.range(0, 1.3),
        z: rngFS.range(-0.4, 0.4),
        vx: rngFS.range(-1.8, 2.4),
        vy: rngFS.range(0.5, 2.6),
        vz: rngFS.range(-1.5, 1.5),
      });
    }
    flowW.add(this.flowSparks);

    // =========================================================================
    // WORLD 15: NIGHT WINDOW WITH WOMAN (Shot 25)
    // =========================================================================
    const nw = addWorld('nightWindow');
    const nwFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ color: 0x131824, roughness: 0.35, metalness: 0.2 }),
    );
    nwFloor.rotation.x = -Math.PI / 2;
    nwFloor.receiveShadow = true;
    nw.add(nwFloor);

    // Tall floor-to-ceiling window mullions overlooking night skyline
    for (let mx = -4.5; mx <= 4.5; mx += 2.25) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.14, 7.5, 0.18), darkSteelMat);
      mullion.position.set(mx, 3.75, -2.6);
      nw.add(mullion);
    }
    const rngNW = createRng(5510);
    for (let i = 0; i < 14; i++) {
      const h = rngNW.range(4, 12);
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(rngNW.range(1.2, 2.4), h, rngNW.range(1.2, 2.4)),
        new THREE.MeshStandardMaterial({ map: cityWinTex, roughness: 0.6 }),
      );
      b.position.set(-10 + i * 1.6, h / 2 - 2.5, -12 - rngNW.range(0, 8));
      nw.add(b);
    }

    // =========================================================================
    // WORLD 16: FINALE — CARD #5 -> #6 + DARK RAINY BANK CLOSED (Shots 27 & 28)
    // =========================================================================
    const fin = addWorld('finale');
    const finFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshStandardMaterial({ map: gridTex, color: 0x1c2538, roughness: 0.25, metalness: 0.4 }),
    );
    finFloor.rotation.x = -Math.PI / 2;
    finFloor.receiveShadow = true;
    fin.add(finFloor);

    // Spinning 3D Collector Card (#5 front / #6 back)
    this.finaleCard = new THREE.Group();
    this.finaleCard.position.set(0, 2.75, -0.7);
    const cardCore = new THREE.Mesh(
      new THREE.BoxGeometry(1.72, 2.28, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x161d2e, metalness: 0.85, roughness: 0.22 }),
    );
    const cardFront = new THREE.Mesh(
      new THREE.PlaneGeometry(1.68, 2.24),
      new THREE.MeshBasicMaterial({ map: createMs05CollectorCardTexture(maxAniso, 'front') }),
    );
    cardFront.position.z = 0.044;
    const cardBack = new THREE.Mesh(
      new THREE.PlaneGeometry(1.68, 2.24),
      new THREE.MeshBasicMaterial({ map: createMs05CollectorCardTexture(maxAniso, 'back') }),
    );
    cardBack.rotation.y = Math.PI;
    cardBack.position.z = -0.044;
    this.finaleCard.add(cardCore, cardFront, cardBack);
    fin.add(this.finaleCard);

    // Dark generic bank with flickering "CLOSED" neon sign & slanted rain (Shot 28)
    this.finaleDarkBank = new THREE.Group();
    this.finaleDarkBank.position.set(0, 0, -4.6);
    const darkBankBody = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 5.4, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x141824, roughness: 0.78, metalness: 0.18 }),
    );
    darkBankBody.position.y = 2.7;
    this.finaleDarkBank.add(darkBankBody);
    for (const cx of [-2.4, -0.8, 0.8, 2.4]) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 4.6, 14),
        new THREE.MeshStandardMaterial({ color: 0x1e2436, roughness: 0.65 }),
      );
      col.position.set(cx, 2.3, 1.72);
      this.finaleDarkBank.add(col);
    }
    this.finaleClosedSignMat = new THREE.MeshStandardMaterial({
      color: 0xff3b5c,
      emissive: 0xff3b5c,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    const closedSignFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.78, 0.14),
      this.finaleClosedSignMat,
    );
    closedSignFrame.position.set(0, 1.65, 1.95);
    const closedSignFace = new THREE.Mesh(
      new THREE.PlaneGeometry(2.48, 0.68),
      new THREE.MeshBasicMaterial({ map: createSignPanelTexture(maxAniso, 'CLOSED', 'BANK FAILED', COLORS.alertRed) }),
    );
    closedSignFace.position.set(0, 1.65, 2.04);
    this.finaleDarkBank.add(closedSignFrame, closedSignFace);
    fin.add(this.finaleDarkBank);

    // Deterministic slanted rain streaks (InstancedMesh)
    const rainGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.68, 5);
    const rainMat = new THREE.MeshBasicMaterial({ color: 0x9ac8ff, transparent: true, opacity: 0.45 });
    this.finaleRain = new THREE.InstancedMesh(rainGeo, rainMat, 140);
    this.finaleRain.frustumCulled = false;
    const rngRain = createRng(5511);
    for (let i = 0; i < 140; i++) {
      this.finaleRainData.push({
        x: rngRain.range(-5.5, 5.5),
        y: rngRain.range(0, 8),
        z: rngRain.range(-3.5, 4.5),
        speed: rngRain.range(8.5, 13.0),
      });
    }
    fin.add(this.finaleRain);

    // Subtle grounded contact shadow beneath characters
    const makeShadowDisc = () => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1.15, 1.15),
        new THREE.MeshBasicMaterial({
          map: this.contactShadowTex,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.015;
      return m;
    };
    this.characters.man.container.add(makeShadowDisc());
    this.characters.woman.container.add(makeShadowDisc());

    // Post-processing pipeline (RenderPass -> subtle BokehPass -> UnrealBloomPass -> OutputPass)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: 6.0,
      aperture: 0.00018,
      maxblur: 0.006,
    });
    this.bokehPass.enabled = false;
    this.composer.addPass(this.bokehPass);

    // Calibrated restrained HDR bloom: threshold 1.25 ensures walls, floors, skin, and white backgrounds NEVER bloom
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT), 0.18, 0.22, 1.25);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.ready = this.characters.loadDefaultAssets();
  }

  public setResolution(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public async loadGlbFiles(files: FileList | File[]): Promise<number> {
    return this.characters.loadGlbFiles(files);
  }

  public getLoadedGlbKeys(): string[] {
    return this.characters.getLoadedKeys();
  }

  private showWorld(worldName: string, sky: 'night' | 'day' | 'dusk' | 'dark', fogHex: number, fogDensity: number): void {
    for (const [k, g] of Object.entries(this.worlds)) {
      g.visible = k === worldName;
    }
    this.skyDomes.night.visible = sky === 'night';
    this.skyDomes.day.visible = sky === 'day';
    this.skyDomes.dusk.visible = sky === 'dusk';
    this.skyDomes.dark.visible = sky === 'dark';
    (this.scene.fog as THREE.FogExp2).color.setHex(fogHex);
    (this.scene.fog as THREE.FogExp2).density = fogDensity;
  }

  private placeChar(
    which: 'man' | 'woman',
    x: number,
    y: number,
    z: number,
    rotY: number,
    clip: Clip3DName,
    clipStart: number,
    t: number,
    isSpeaking: boolean,
    holdingProp: HeldPropKind = 'none',
    prevClip?: Clip3DName,
    prevClipStart?: number,
  ): void {
    const ch = which === 'man' ? this.characters.man : this.characters.woman;
    ch.container.visible = true;
    ch.container.position.set(x, y, z);
    ch.container.rotation.set(0, rotY, 0);
    ch.evaluateAt(t, {
      clip,
      clipStart,
      prevClip,
      prevClipStart,
      crossfadeDuration: 0.3,
      isSpeaking,
      holdingProp,
    });
  }

  public renderAt(t: number): void {
    const shot = getShotAtForMeta(MS05_META, t);
    const shotElapsed = Math.max(0, t - shot.start);
    const shotDur = Math.max(0.01, shot.end - shot.start);
    const shotP = clamp(shotElapsed / shotDur, 0, 1);

    // Reset character visibility & DOF each frame (pure deterministic evaluation)
    this.characters.man.container.visible = false;
    this.characters.woman.container.visible = false;
    this.bokehPass.enabled = false;
    this.bloomPass.strength = 0.18;
    this.keyLight.color.setHex(0xfff1dc);
    this.keyLight.intensity = 1.48;
    this.hemiLight.intensity = 0.54;
    this.rimLight.color.setHex(0x6ad4ff);
    this.rimLight.intensity = 0.85;
    this.accentLight.intensity = 1.1;
    this.dustPoints.rotation.y = t * 0.04;

    // Wide 54° vertical FOV with short 8% punch-in on every shot cut
    const baseFov = 54;
    this.camera.fov = punchInFov(baseFov, shotElapsed);
    this.camera.updateProjectionMatrix();

    // Speak windows from SRT
    const manSpeaking = (t >= 5.03 && t <= 7.59) || (t >= 33.98 && t <= 37.98);
    const womanSpeaking = (t >= 19.92 && t <= 22.88) || (t >= 46.02 && t <= 49.58);

    // =========================================================================
    // SHOTS 1, 2, 4, 5, 20, 21, 29 — NIGHT APARTMENT
    // =========================================================================
    if (shot.world === 'apartment') {
      this.showWorld('apartment', 'night', 0x090d18, 0.022);
      this.keyLight.position.set(-3.2, 5.5, 4.2);
      this.keyLight.color.setHex(0xffd9a0);
      this.accentLight.color.setHex(0xffc84a);
      this.accentLight.position.set(-2.5, 2.3, -1.2);
      this.accentLight.intensity = 2.4;

      // Stack dissolve state
      const dissolveP =
        shot.id === 1 || shot.id === 29
          ? 0
          : shot.id === 2
            ? easeInOutCubic(shotP)
            : 1;

      for (let i = 0; i < this.aptLightSlices.length; i++) {
        const threshold = (this.aptLightSlices.length - 1 - i) / this.aptLightSlices.length;
        const alive = clamp((1 - dissolveP - threshold * 0.65) * 2.5, 0, 1);
        const sl = this.aptLightSlices[i];
        sl.visible = alive > 0.02 && shot.id <= 2 || shot.id === 29;
        sl.scale.set(0.6 + alive * 0.4, alive, 0.6 + alive * 0.4);
        (sl.material as THREE.MeshStandardMaterial).opacity = alive * 0.95;
      }

      // Golden particles rising when dissolving (Shot 2) or lingering faint dust
      const showParts = shot.id === 2;
      this.aptParticles.visible = showParts;
      if (showParts) {
        for (let i = 0; i < this.aptParticleData.length; i++) {
          const d = this.aptParticleData[i];
          const life = clamp(shotP * 1.4 - (i / this.aptParticleData.length) * 0.55, 0, 1);
          const sc = life > 0 && life < 1 ? Math.sin(life * Math.PI) * 1.15 : 0.0001;
          this.dummy.position.set(
            d.x + d.vx * life + Math.sin(t * 4 + d.seed) * 0.08,
            d.y + d.vy * life,
            d.z + d.vz * life,
          );
          this.dummy.rotation.set(t * 2 + d.seed, t * 1.5, 0);
          this.dummy.scale.setScalar(sc);
          this.dummy.updateMatrix();
          this.aptParticles.setMatrixAt(i, this.dummy.matrix);
        }
        this.aptParticles.instanceMatrix.needsUpdate = true;
      }

      if (shot.id === 1 || shot.id === 29) {
        // Opening & Seamless Loop: Man holds phone in lower-left, glowing stack on coffee table
        this.placeChar('man', -0.75, 0, -0.3, 0.22, 'looking', shot.start, t, false, 'phone');
        this.camera.position.set(lerp(-0.25, 0.15, shotP), lerp(1.95, 1.85, shotP), lerp(5.15, 4.75, shotP));
        this.camera.lookAt(0.05, 1.35, -0.35);
      } else if (shot.id === 2) {
        // Focus on the glowing $10,000 stack dissolving beside him
        this.placeChar('man', -1.05, 0, -0.45, 0.45, 'surprised', shot.start, t, false, 'none');
        this.camera.position.set(lerp(1.55, 0.85, shotP), lerp(1.55, 1.85, shotP), lerp(3.45, 3.05, shotP));
        this.camera.lookAt(0.55, 1.15, -0.05);
        this.bokehPass.enabled = !this.isSoftwareGl;
        (this.bokehPass.uniforms as Record<string, THREE.IUniform>).focus.value = 3.2;
      } else if (shot.id === 4) {
        // Man startled ("Wait... what?") — medium-wide so full upper body & cap sit cleanly in y 900-1720
        this.placeChar('man', 0.0, 0, 0.35, 0.05, 'surprised', 4.95, t, manSpeaking, 'none');
        this.camera.position.set(lerp(-0.35, 0.15, shotP), 1.62, lerp(4.15, 3.85, shotP));
        this.camera.lookAt(0, 1.48, 0.25);
      } else if (shot.id === 5) {
        // Man looking around confused ("Where did it go?")
        this.placeChar('man', 0.0, 0, 0.35, -0.08, 'looking', 6.3, t, manSpeaking, 'none', 'surprised', 4.95);
        this.camera.position.set(lerp(0.25, 0.72, shotP), 1.66, lerp(3.9, 4.15, shotP));
        this.camera.lookAt(0, 1.48, 0.25);
      } else if (shot.id === 20) {
        // Back in apartment, Man holds "PAID IN FULL" letter & shrugs
        this.placeChar('man', 0.0, 0, 0.45, 0.06, 'shrugging', 33.9, t, manSpeaking, 'letter');
        this.camera.position.set(lerp(-0.45, 0.05, shotP), 1.62, lerp(4.25, 3.95, shotP));
        this.camera.lookAt(0, 1.46, 0.35);
      } else {
        // Shot 21: Orbiting medium-wide on Man talking with PAID IN FULL letter
        this.placeChar('man', 0.0, 0, 0.45, -0.06, 'talking', 36.0, t, manSpeaking, 'letter', 'shrugging', 33.9);
        this.camera.position.set(lerp(0.15, 0.65, shotP), 1.65, lerp(3.95, 4.25, shotP));
        this.camera.lookAt(0, 1.46, 0.35);
      }
    }

    // =========================================================================
    // SHOT 3 — GOLDEN PARTICLES FLY OUT WINDOW INTO NIGHT SKY
    // =========================================================================
    else if (shot.world === 'apartmentWindow') {
      this.showWorld('apartmentWindow', 'night', 0x070d1c, 0.018);
      for (let i = 0; i < this.winParticleData.length; i++) {
        const d = this.winParticleData[i];
        const p = clamp((shotP - d.delay * 0.5) / 0.72, 0, 1);
        const ep = easeOutCubic(p);
        this.dummy.position.set(
          d.startX * (1 + ep * 1.4) + Math.sin(t * 3 + i) * 0.14,
          d.startY + ep * d.arcY,
          lerp(d.startZ, -14.5, ep),
        );
        this.dummy.rotation.set(t * 3, i, t * 2);
        const sc = p > 0 ? (1 - p * 0.45) * 1.2 : 0.001;
        this.dummy.scale.setScalar(sc);
        this.dummy.updateMatrix();
        this.winParticles.setMatrixAt(i, this.dummy.matrix);
      }
      this.winParticles.instanceMatrix.needsUpdate = true;

      this.camera.position.set(lerp(0.3, -0.25, shotP), lerp(2.2, 2.55, shotP), lerp(4.6, 3.4, shotP));
      this.camera.lookAt(0, 2.9, -6);
    }

    // =========================================================================
    // SHOT 6 — VHS REWIND: CLOCK SPINNING BACKWARDS + REVERSE PARTICLES
    // =========================================================================
    else if (shot.world === 'rewindRoom') {
      this.showWorld('rewindRoom', 'dark', 0x060b16, 0.028);
      this.clockMinHand.rotation.z = shotElapsed * 14.5; // Fast counter-clockwise spin!
      this.clockHourHand.rotation.z = shotElapsed * 1.85;

      for (let i = 0; i < this.rewindParticleData.length; i++) {
        const d = this.rewindParticleData[i];
        const p = (1 - ((shotP * 1.8 + d.phase) % 1));
        this.dummy.position.set(
          d.x * p,
          lerp(1.5, d.y, p),
          lerp(1.6, d.z - 5, p),
        );
        this.dummy.scale.setScalar(0.85 + (1 - p) * 0.6);
        this.dummy.rotation.set(0, t * 4, i);
        this.dummy.updateMatrix();
        this.rewindParticles.setMatrixAt(i, this.dummy.matrix);
      }
      this.rewindParticles.instanceMatrix.needsUpdate = true;

      this.camera.position.set(lerp(-0.4, 0.4, shotP), 2.15, lerp(4.6, 3.85, shotP));
      this.camera.lookAt(0, 2.25, -1.6);
    }

    // =========================================================================
    // SHOT 7 — CAR SHOWROOM WINDOW AT DAY ($10,000 CAR)
    // =========================================================================
    else if (shot.world === 'carShowroom') {
      this.showWorld('carShowroom', 'day', 0xaecae8, 0.014);
      this.keyLight.intensity = 1.68;
      this.hemiLight.intensity = 0.75;
      this.bloomPass.strength = 0.12;

      this.showroomCar.group.rotation.y = 0.45 + shotP * 0.28;
      this.placeChar('man', -1.85, 0, 2.05, 0.65, 'looking', shot.start, t, false, 'none');

      this.camera.position.set(lerp(-0.6, 0.9, shotP), 2.05, lerp(7.6, 6.7, shotP));
      this.camera.lookAt(0.05, 1.15, 0.2);
    }

    // =========================================================================
    // SHOT 8 — MAN WALKS INTO GENERIC BANK LOBBY
    // =========================================================================
    else if (shot.world === 'bankLobby') {
      this.showWorld('bankLobby', 'day', 0xc8d8ec, 0.015);
      this.keyLight.intensity = 1.62;
      this.hemiLight.intensity = 0.72;
      this.bloomPass.strength = 0.12;

      const walkZ = lerp(2.2, -1.35, shotP);
      this.placeChar('man', 0, 0, walkZ, Math.PI, 'walking', shot.start, t, false, 'none');

      this.camera.position.set(lerp(0.85, -0.45, shotP), 2.05, lerp(6.1, 3.4, shotP));
      this.camera.lookAt(0, 1.45, walkZ - 1.5);
    }

    // =========================================================================
    // SHOT 9 — VAULT DOOR STAYS SHUT ("VAULT: CLOSED")
    // =========================================================================
    else if (shot.world === 'vaultClosed') {
      this.showWorld('vaultClosed', 'dark', 0x090e18, 0.025);
      this.vaultWheel.rotation.z = 0; // Explicitly locked shut!
      this.vaultBeaconMat.emissiveIntensity = 1.05 + Math.sin(t * 7.5) * 0.35;
      this.accentLight.color.setHex(0xff3b5c);
      this.accentLight.position.set(0, 4.4, -0.5);
      this.accentLight.intensity = 2.6;

      this.camera.position.set(lerp(-0.55, 0.55, shotP), lerp(2.05, 2.25, shotP), lerp(5.85, 5.15, shotP));
      this.camera.lookAt(0, 2.3, -1.2);
    }

    // =========================================================================
    // SHOT 10 — ROWS OF SAVINGS DRAWERS STAY UNTOUCHED
    // =========================================================================
    else if (shot.world === 'savingsDrawers') {
      this.showWorld('savingsDrawers', 'dark', 0x0a0f1c, 0.024);
      this.keyLight.position.set(4, 7, 5);
      this.camera.position.set(lerp(-1.6, 1.4, shotP), 2.35, lerp(5.45, 5.1, shotP));
      this.camera.lookAt(0, 2.35, -1.6);
    }

    // =========================================================================
    // SHOTS 11–14 — BANKER DESK WITH WOMAN TYPING / TALKING / POINTING
    // =========================================================================
    else if (shot.world === 'bankerDesk') {
      this.showWorld('bankerDesk', 'night', 0x0b1220, 0.022);
      this.keyLight.position.set(3.5, 6.5, 5.5);
      this.accentLight.color.setHex(0x22e07a);
      this.accentLight.position.set(1.1, 1.6, 0.7);

      const stages = ['$0', '$1', '$10', '$100', '$1,000', '$10,000'];
      const tp = clamp(invLerp(17.45, 19.15, t), 0, 1);
      const sIdx = Math.min(stages.length - 1, Math.floor(tp * stages.length));
      this.bankerMonitor.update(stages[sIdx], sIdx === stages.length - 1);

      // Glowing light stack grows up on desk as balance is typed
      const stackGrowth = easeOutCubic(clamp(invLerp(17.7, 19.6, t), 0, 1));
      this.bankerLightStack.visible = stackGrowth > 0.02;
      this.bankerLightStack.scale.set(1, Math.max(0.01, stackGrowth), 1);
      this.accentLight.intensity = 1.2 + stackGrowth * 2.2;

      if (shot.id === 11) {
        this.placeChar('woman', -0.15, 0, -0.35, 0.05, 'typing', 16.8, t, false, 'none');
        this.camera.position.set(lerp(-0.55, 0.1, shotP), 1.85, lerp(4.55, 4.15, shotP));
        this.camera.lookAt(0.15, 1.32, 0.15);
      } else if (shot.id === 12) {
        this.placeChar('woman', -0.15, 0, -0.35, 0.12, 'typing', 16.8, t, false, 'none');
        this.camera.position.set(lerp(0.35, 0.95, shotP), 1.72, lerp(3.9, 3.65, shotP));
        this.camera.lookAt(0.35, 1.32, 0.25);
      } else if (shot.id === 13) {
        this.placeChar('woman', -0.25, 0, -0.25, 0.08, 'talking', 19.8, t, womanSpeaking, 'none', 'typing', 16.8);
        this.camera.position.set(lerp(-0.35, 0.2, shotP), 1.65, lerp(4.05, 3.8, shotP));
        this.camera.lookAt(0.05, 1.38, 0.0);
      } else {
        // Shot 14: Woman pointing toward the glowing newly created money stack
        this.placeChar('woman', -0.35, 0, -0.25, 0.26, 'pointing', 21.35, t, womanSpeaking, 'none', 'talking', 19.8);
        this.camera.position.set(lerp(0.2, 0.72, shotP), 1.68, lerp(4.0, 4.25, shotP));
        this.camera.lookAt(0.25, 1.38, 0.1);
      }
    }

    // =========================================================================
    // SHOT 15 — DRIVING NEW CAR OUT OF SHOWROOM
    // =========================================================================
    else if (shot.world === 'carDriveOut') {
      this.showWorld('carDriveOut', 'day', 0xaed0f2, 0.012);
      this.keyLight.intensity = 1.7;
      this.hemiLight.intensity = 0.78;
      this.bloomPass.strength = 0.12;

      const carZ = lerp(-5.5, 6.5, easeInOutCubic(shotP));
      this.driveCar.group.position.set(0, 0, carZ);
      for (const w of this.driveCar.wheels) {
        w.rotation.x = carZ * 2.8;
      }
      this.camera.position.set(lerp(4.4, 3.8, shotP), 1.85, carZ + 5.8);
      this.camera.lookAt(0, 0.95, carZ);
    }

    // =========================================================================
    // SHOT 16 — GLOWING MONEY STREAM FROM DEALER TO SECOND BANK
    // =========================================================================
    else if (shot.world === 'dealerTransfer') {
      this.showWorld('dealerTransfer', 'dusk', 0x10182e, 0.018);
      for (let i = 0; i < this.dealerStreamPulses.length; i++) {
        const u = (shotP * 1.6 + i / this.dealerStreamPulses.length) % 1;
        this.dealerCurve.getPointAt(u, this.dealerStreamPulses[i].position);
        const s = 0.7 + Math.sin(u * Math.PI) * 0.65;
        this.dealerStreamPulses[i].scale.setScalar(s);
      }
      this.camera.position.set(lerp(-0.9, 0.9, shotP), 3.35, lerp(9.2, 8.3, shotP));
      this.camera.lookAt(0, 2.3, -0.8);
    }

    // =========================================================================
    // SHOTS 17 & 26 — AERIAL DUSK/NIGHT CITY WITH GLOWING MONEY-LINES
    // =========================================================================
    else if (shot.world === 'duskCity') {
      const isShrinking = shot.id === 26;
      this.showWorld('duskCity', isShrinking ? 'night' : 'dusk', isShrinking ? 0x060a14 : 0x11172d, 0.02);
      this.bloomPass.strength = isShrinking ? 0.16 : 0.24;

      for (const line of this.cityLines) {
        if (!isShrinking) {
          // Shot 17: Lines spreading & energizing across the city
          const appear = clamp((shotP * 1.45 - line.order * 0.65) * 2.5, 0, 1);
          line.mesh.visible = appear > 0.02;
          line.mat.opacity = appear * 0.92;
          line.pulse.visible = appear > 0.25;
          const u = (t * 0.85 + line.order * 2.7) % 1;
          line.curve.getPointAt(u, line.pulse.position);
        } else {
          // Shot 26: Lines flicker and fade out one by one ("MONEY CAN SHRINK")
          const fadeOut = clamp((shotP * 1.25 - line.order * 0.85) * 3.5, 0, 1);
          const flicker = fadeOut > 0.1 && fadeOut < 0.85 ? (Math.sin(t * 48 + line.order * 30) > 0 ? 1 : 0.25) : 1;
          const alpha = (1 - fadeOut) * flicker;
          line.mesh.visible = alpha > 0.03;
          line.mat.opacity = alpha * 0.9;
          line.pulse.visible = alpha > 0.35;
          const u = (t * 0.45 + line.order * 2.7) % 1;
          line.curve.getPointAt(u, line.pulse.position);
        }
      }

      const orbitAng = isShrinking ? lerp(0.55, 0.92, shotP) : lerp(-0.35, 0.22, shotP);
      const rad = isShrinking ? lerp(11.8, 13.6, shotP) : lerp(12.2, 10.6, shotP);
      this.camera.position.set(Math.sin(orbitAng) * rad, lerp(7.8, 8.6, shotP), Math.cos(orbitAng) * rad);
      this.camera.lookAt(0, 2.2, -0.5);
    }

    // =========================================================================
    // SHOTS 18 & 19 — 3D WALL CALENDAR JAN -> DEC & 12-SLICE LIGHT STACK
    // =========================================================================
    else if (shot.world === 'calendarStack') {
      this.showWorld('calendarStack', 'dark', 0x090d18, 0.024);

      if (shot.id === 18) {
        const monthFloat = shotP * 11.2;
        this.calTex.update(monthFloat);
        const pageFrac = monthFloat % 1;
        this.calPageFlap.rotation.x = -easeOutCubic(clamp(pageFrac * 2.2, 0, 1)) * Math.PI * 0.85;

        const remainingSlices = Math.max(1, 12 - Math.floor(monthFloat));
        for (let i = 0; i < this.calSlices.length; i++) {
          const sl = this.calSlices[i];
          if (i < remainingSlices) {
            sl.visible = true;
            sl.scale.set(1, 1, 1);
            (sl.material as THREE.MeshStandardMaterial).opacity = 0.95;
          } else {
            sl.visible = false;
          }
        }

        // Rising golden deletion sparks off top slice
        const topY = 0.48 + remainingSlices * 0.138;
        for (let i = 0; i < this.calSparkData.length; i++) {
          const d = this.calSparkData[i];
          const p = (shotP * 3.8 + d.seed) % 1;
          this.dummy.position.set(d.x, topY + p * 2.2, d.z);
          this.dummy.scale.setScalar((1 - p) * 0.95);
          this.dummy.rotation.set(t * 3, i, 0);
          this.dummy.updateMatrix();
          this.calSparks.setMatrixAt(i, this.dummy.matrix);
        }
        this.calSparks.instanceMatrix.needsUpdate = true;

        this.camera.position.set(lerp(-0.3, 0.4, shotP), 2.15, lerp(5.9, 5.25, shotP));
        this.camera.lookAt(-0.1, 1.65, -0.1);
      } else {
        // Shot 19: Close-up of the final 12th slice dissolving to zero ("DELETED")
        this.calTex.update(11);
        this.calPageFlap.rotation.x = 0;
        const vanishP = easeInOutCubic(clamp(shotP / 0.58, 0, 1));
        for (let i = 0; i < this.calSlices.length; i++) {
          const sl = this.calSlices[i];
          if (i === 0) {
            const alive = 1 - vanishP;
            sl.visible = alive > 0.02;
            sl.scale.set(0.5 + alive * 0.5, alive, 0.5 + alive * 0.5);
            (sl.material as THREE.MeshStandardMaterial).opacity = alive;
          } else {
            sl.visible = false;
          }
        }

        for (let i = 0; i < this.calSparkData.length; i++) {
          const d = this.calSparkData[i];
          const p = clamp(shotP * 1.45 - d.seed * 0.35, 0, 1);
          this.dummy.position.set(
            d.x + Math.sin(i * 1.7) * p * 1.1,
            0.55 + p * 2.8,
            d.z + Math.cos(i * 1.3) * p * 1.1,
          );
          this.dummy.scale.setScalar(p > 0 && p < 1 ? Math.sin(p * Math.PI) * 1.2 : 0.0001);
          this.dummy.updateMatrix();
          this.calSparks.setMatrixAt(i, this.dummy.matrix);
        }
        this.calSparks.instanceMatrix.needsUpdate = true;

        this.camera.position.set(lerp(1.5, 0.85, shotP), lerp(1.35, 1.55, shotP), lerp(3.4, 2.95, shotP));
        this.camera.lookAt(1.05, 0.72, 0.15);
        this.bokehPass.enabled = !this.isSoftwareGl;
        (this.bokehPass.uniforms as Record<string, THREE.IUniform>).focus.value = 3.1;
      }
    }

    // =========================================================================
    // SHOT 22 — GRAND CLASSICAL STONE HALL (BANK OF ENGLAND, 2014)
    // =========================================================================
    else if (shot.world === 'centralHall') {
      this.showWorld('centralHall', 'dusk', 0x16141a, 0.018);
      this.keyLight.color.setHex(0xffdfa8);
      this.keyLight.intensity = 2.35;
      this.camera.position.set(lerp(-0.45, 0.45, shotP), lerp(2.3, 2.7, shotP), lerp(5.8, 2.6, shotP));
      this.camera.lookAt(0, 3.2, -10);
    }

    // =========================================================================
    // SHOTS 23 & 24 — GREEN CREATED ARROW / RED DESTROYED ARROW
    // =========================================================================
    else if (shot.world === 'flowChamber') {
      this.showWorld('flowChamber', 'dark', 0x070b14, 0.026);
      const isCreate = shot.id === 23;
      this.flowGreenArrow.visible = isCreate;
      this.flowRedArrow.visible = !isCreate;
      this.accentLight.color.setHex(isCreate ? 0x22e07a : 0xff3b5c);
      this.accentLight.intensity = 2.6;

      if (isCreate) {
        const ap = easeOutCubic(clamp(shotP / 0.55, 0, 1));
        this.flowGreenArrow.position.set(lerp(-4.2, -1.25, ap), 2.35, 0);
        this.flowGreenArrow.scale.setScalar(0.7 + ap * 0.3);
        const buildP = easeOutCubic(clamp((shotP - 0.18) / 0.65, 0, 1));
        for (let i = 0; i < this.flowPrismSlices.length; i++) {
          const sl = this.flowPrismSlices[i];
          const k = clamp((buildP * 1.4 - (i / this.flowPrismSlices.length) * 0.65) * 2.2, 0, 1);
          sl.visible = k > 0.02;
          sl.scale.set(k, k, k);
          (sl.material as THREE.MeshStandardMaterial).emissive.setHex(0x22e07a);
        }
        this.flowSparks.visible = false;
      } else {
        const ap = easeOutCubic(clamp(shotP / 0.52, 0, 1));
        this.flowRedArrow.position.set(lerp(-4.2, -1.05, ap), 2.35, 0);
        const destroyP = easeInOutCubic(clamp((shotP - 0.24) / 0.65, 0, 1));
        for (let i = 0; i < this.flowPrismSlices.length; i++) {
          const sl = this.flowPrismSlices[i];
          const alive = clamp((1 - destroyP * 1.3 + (i / this.flowPrismSlices.length) * 0.45), 0, 1);
          sl.visible = alive > 0.02;
          sl.scale.set(alive, alive, alive);
          (sl.material as THREE.MeshStandardMaterial).emissive.setHex(0xff3b5c);
        }
        this.flowSparks.visible = destroyP > 0.05;
        for (let i = 0; i < this.flowSparkData.length; i++) {
          const d = this.flowSparkData[i];
          this.dummy.position.set(
            d.x + d.vx * destroyP,
            d.y + d.vy * destroyP,
            d.z + d.vz * destroyP,
          );
          this.dummy.scale.setScalar(Math.sin(destroyP * Math.PI) * 1.15);
          this.dummy.updateMatrix();
          this.flowSparks.setMatrixAt(i, this.dummy.matrix);
        }
        this.flowSparks.instanceMatrix.needsUpdate = true;
      }

      this.camera.position.set(lerp(-0.4, 0.45, shotP), 2.35, lerp(7.1, 6.45, shotP));
      this.camera.lookAt(0.15, 2.2, 0);
    }

    // =========================================================================
    // SHOT 25 — WOMAN BY FLOOR-TO-CEILING WINDOW AT NIGHT
    // =========================================================================
    else if (shot.world === 'nightWindow') {
      this.showWorld('nightWindow', 'night', 0x070d1c, 0.018);
      this.keyLight.color.setHex(0xffe7c2);
      this.rimLight.color.setHex(0x5cf2d0);
      this.rimLight.intensity = 1.5;

      this.placeChar('woman', 0, 0, 0.25, -0.14, 'talking', shot.start, t, womanSpeaking, 'none');
      this.camera.position.set(lerp(-0.45, 0.35, shotP), 1.62, lerp(4.2, 3.85, shotP));
      this.camera.lookAt(0, 1.44, 0.1);
    }

    // =========================================================================
    // SHOTS 27 & 28 — FINALE CARD #5 -> #6 + BOTH CHARACTERS + RAINY BANK
    // =========================================================================
    else if (shot.world === 'finale') {
      const isCard6 = shot.id === 28;
      this.showWorld('finale', isCard6 ? 'dark' : 'night', isCard6 ? 0x06070f : 0x0a1020, 0.022);

      if (!isCard6) {
        // Shot 27: Glowing #5 card turns gently in 3D, Jordan & Maya both grounded cleanly in front
        this.finaleDarkBank.visible = false;
        this.finaleRain.visible = false;
        this.finaleCard.position.set(0, 2.72, -1.1);
        this.finaleCard.rotation.y = Math.sin(shotP * Math.PI * 1.3) * 0.42;

        this.placeChar('man', -0.92, 0, 0.85, 0.16, 'idle', shot.start, t, false, 'none');
        this.placeChar('woman', 0.92, 0, 0.85, -0.16, 'idle', shot.start, t, false, 'none');

        this.camera.position.set(lerp(-0.35, 0.35, shotP), 1.92, lerp(6.65, 6.15, shotP));
        this.camera.lookAt(0, 1.72, -0.3);
      } else {
        // Shot 28: Card flips to #6 + dark bank with flickering CLOSED sign & deterministic slanted rain
        this.finaleDarkBank.visible = true;
        this.finaleRain.visible = true;
        const flipP = easeOutCubic(clamp(shotP / 0.38, 0, 1));
        this.finaleCard.position.set(0, 3.15, -0.8);
        this.finaleCard.rotation.y = lerp(0, Math.PI, flipP) + Math.sin(shotP * 3) * 0.08;

        // Flickering neon red CLOSED sign (calibrated HDR emissive)
        const flick = Math.sin(t * 37) * Math.cos(t * 19) > -0.45 ? 1.35 : 0.22;
        this.finaleClosedSignMat.emissiveIntensity = flick;
        this.accentLight.color.setHex(0xff3b5c);
        this.accentLight.position.set(0, 2.2, -2.5);
        this.accentLight.intensity = flick * 0.95;

        // Deterministic slanted rain streaks
        for (let i = 0; i < this.finaleRainData.length; i++) {
          const r = this.finaleRainData[i];
          const ry = ((r.y - t * r.speed) % 8 + 8) % 8;
          this.dummy.position.set(r.x + (8 - ry) * 0.08, ry, r.z);
          this.dummy.rotation.set(0, 0, 0.11);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          this.finaleRain.setMatrixAt(i, this.dummy.matrix);
        }
        this.finaleRain.instanceMatrix.needsUpdate = true;

        this.camera.position.set(lerp(0.35, -0.35, shotP), 2.3, lerp(6.9, 6.25, shotP));
        this.camera.lookAt(0, 2.35, -2.5);
      }
    }

    if (this.isSoftwareGl) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }
  }

  public dispose(): void {
    this.composer.dispose();
    this.renderer.dispose();
  }
}
