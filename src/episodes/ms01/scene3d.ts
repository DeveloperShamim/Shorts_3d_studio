/**
 * Episode #1 — Money Secrets #1 ("Why Prices Never Come Back Down")
 * Complete deterministic 8-world Three.js engine with calibrated restrained HDR bloom.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
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
  easeOutBack,
  easeOutBounce,
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
import { HISTORICAL_US_CPI, MS01_META } from './meta';

type WorldId =
  | 'aisle'
  | 'cpiCart'
  | 'vault'
  | 'storm'
  | 'spiral'
  | 'timeline'
  | 'race'
  | 'finale';

const _dummy = new THREE.Object3D();
const _camLook = new THREE.Vector3();

function configureTex(tex: THREE.CanvasTexture, maxAniso: number): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function createMs01PriceTagTexture(maxAniso: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const texture = configureTex(new THREE.CanvasTexture(canvas), maxAniso);
  let lastKey = '';

  const update = (priceDollars: number, stampProgress: number, isRedMode: boolean) => {
    const pRounded = Math.round(priceDollars);
    const sBucket = Math.round(stampProgress * 40);
    const key = `${pRounded}_${sBucket}_${isRedMode ? 1 : 0}`;
    if (key === lastKey) return;
    lastKey = key;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#D8D4C8');
    bg.addColorStop(1, '#BEB9AA');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#141720';
    ctx.fillRect(0, 0, w, 200);
    ctx.fillStyle = isRedMode ? COLORS.alertRed : COLORS.highlightYellow;
    ctx.fillRect(0, 192, w, 16);

    ctx.beginPath();
    ctx.arc(w / 2, 92, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#090B10';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#C9A24B';
    ctx.stroke();

    ctx.fillStyle = '#333845';
    ctx.font = '700 34px "Poppins", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RETAIL PRICE INDEX', w / 2, 275);

    ctx.fillStyle = isRedMode ? '#CC1634' : '#10131B';
    ctx.font = '800 228px "Poppins", sans-serif';
    ctx.fillText(`$${pRounded}`, w / 2, 515);

    ctx.fillStyle = isRedMode ? '#9E1B32' : '#404756';
    ctx.font = '700 40px "Poppins", sans-serif';
    ctx.fillText(isRedMode ? '+31% SINCE 2020' : 'STANDARD BASKET', w / 2, 675);

    const rng = createRng(1337);
    let bx = 92;
    ctx.fillStyle = '#11131A';
    while (bx < w - 92) {
      const bw = rng.int(4, 16);
      if (rng.next() > 0.35) ctx.fillRect(bx, 745, bw, 155);
      bx += bw + rng.int(4, 10);
    }

    if (stampProgress > 0.01) {
      ctx.save();
      ctx.translate(w / 2, 540);
      ctx.rotate(-0.18);
      const s = 1.0 + (1 - Math.min(1, stampProgress)) * 0.42;
      ctx.scale(s, s);
      ctx.globalAlpha = Math.min(1, stampProgress * 2.5);
      ctx.fillStyle = 'rgba(215, 22, 55, 0.16)';
      ctx.fillRect(-295, -78, 590, 156);
      ctx.strokeStyle = '#E01A3B';
      ctx.lineWidth = 16;
      ctx.strokeRect(-295, -78, 590, 156);
      ctx.fillStyle = '#E01A3B';
      ctx.font = '800 76px "Poppins", sans-serif';
      ctx.fillText('ON PURPOSE', 0, 4);
      ctx.restore();
    }
    texture.needsUpdate = true;
  };

  update(100, 0, false);
  return { texture, update };
}

function createMs01CardTex(maxAniso: number, side: 'front' | 'back'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 768, 1024);
  grad.addColorStop(0, '#141B29');
  grad.addColorStop(0.5, '#0C121D');
  grad.addColorStop(1, side === 'front' ? '#192218' : '#1C1329');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 768, 1024);

  const border = side === 'front' ? COLORS.highlightYellow : COLORS.cyan;
  ctx.strokeStyle = border;
  ctx.lineWidth = 18;
  ctx.strokeRect(24, 24, 720, 976);
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
    ctx.fillText('#1', 384, 650);
    ctx.fillStyle = COLORS.moneyGreen;
    ctx.font = '700 38px "Poppins", sans-serif';
    ctx.fillText('WHY PRICES STAY UP', 384, 845);
  } else {
    ctx.fillStyle = COLORS.cyan;
    ctx.font = '700 36px "Poppins", sans-serif';
    ctx.fillText('NEXT EPISODE', 384, 145);
    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 120px "Poppins", sans-serif';
    ctx.fillText('#2', 384, 285);
    ctx.fillStyle = COLORS.cyan;
    ctx.font = '800 220px "Poppins", sans-serif';
    ctx.fillText('?', 384, 520);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 54px "Poppins", sans-serif';
    ctx.fillText('WHO OWNS', 384, 735);
    ctx.fillStyle = COLORS.highlightYellow;
    ctx.font = '800 58px "Poppins", sans-serif';
    ctx.fillText("AMERICA'S DEBT?", 384, 815);
  }
  return configureTex(new THREE.CanvasTexture(canvas), maxAniso);
}

function createCalendarTex(maxAniso: number, label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#D7D8DF';
  ctx.fillRect(0, 0, 512, 640);
  ctx.fillStyle = '#E02447';
  ctx.fillRect(0, 0, 512, 138);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 48px "Poppins", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 84);
  ctx.fillStyle = '#101420';
  ctx.font = '800 176px "Poppins", sans-serif';
  ctx.fillText('+2%', 256, 392);
  ctx.fillStyle = '#129A52';
  ctx.font = '700 34px "Poppins", sans-serif';
  ctx.fillText('ANNUAL TARGET', 256, 535);
  return configureTex(new THREE.CanvasTexture(canvas), maxAniso);
}

function createTreadmillTex(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#151822';
  ctx.fillRect(0, 0, 512, 1024);
  const tags = ['$131', '+31%', 'RENT UP', 'FOOD UP', '+2% / YR', 'PRICES'];
  for (let i = 0; i < 6; i++) {
    const y = i * 170 + 16;
    ctx.fillStyle = '#242938';
    ctx.fillRect(28, y, 456, 142);
    ctx.strokeStyle = COLORS.alertRed;
    ctx.lineWidth = 6;
    ctx.strokeRect(32, y + 4, 448, 134);
    ctx.fillStyle = i % 2 === 0 ? COLORS.alertRed : COLORS.highlightYellow;
    ctx.font = '800 62px "Poppins", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tags[i], 256, y + 74);
  }
  const tex = configureTex(new THREE.CanvasTexture(canvas), maxAniso);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  return tex;
}

const PALETTES: Record<WorldId, { top: number; mid: number; bottom: number; fog: number; bloom: number }> = {
  aisle: { top: 0x090e1c, mid: 0x161a29, bottom: 0x0f121c, fog: 0x111522, bloom: 0.26 },
  cpiCart: { top: 0x061021, mid: 0x0f2038, bottom: 0x091322, fog: 0x0b1628, bloom: 0.28 },
  vault: { top: 0x0b0e18, mid: 0x1a1e2e, bottom: 0x10131e, fog: 0x121624, bloom: 0.28 },
  storm: { top: 0x05070e, mid: 0x12192c, bottom: 0x090c16, fog: 0x0b0f1b, bloom: 0.3 },
  spiral: { top: 0x14050b, mid: 0x240914, bottom: 0x100409, fog: 0x19060e, bloom: 0.3 },
  timeline: { top: 0x060d18, mid: 0x0e1d30, bottom: 0x08101a, fog: 0x0a1422, bloom: 0.28 },
  race: { top: 0x07121b, mid: 0x102430, bottom: 0x09131c, fog: 0x0b1720, bloom: 0.28 },
  finale: { top: 0x060a14, mid: 0x121d32, bottom: 0x090f1b, fog: 0x0c1322, bloom: 0.3 },
};

export class Ms01ThreeEngine implements Episode3DController {
  public readonly canvas: HTMLCanvasElement;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly isSoftwareGl: boolean;

  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly fog: THREE.FogExp2;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly dustPoints: THREE.Points;
  private readonly worlds: Record<WorldId, THREE.Group>;
  private readonly priceTagTex: ReturnType<typeof createMs01PriceTagTexture>;

  private priceTagGroup!: THREE.Group;
  private aisleRedLine!: THREE.Mesh;
  private aisleAlertLight!: THREE.PointLight;
  private cartGroup!: THREE.Group;
  private groceryItems: { mesh: THREE.Mesh; targetPos: THREE.Vector3; delay: number }[] = [];
  private walletCoins!: THREE.InstancedMesh;
  private walletCoinData: { angle: number; speed: number; up: number; phase: number }[] = [];
  private vaultDoorPivot!: THREE.Group;
  private vaultWheel!: THREE.Group;
  private calendarPages: THREE.Mesh[] = [];
  private stormLightning: THREE.Mesh[] = [];
  private stormArrow!: THREE.Group;
  private spiralRings: THREE.Mesh[] = [];
  private spiralPanels: THREE.Mesh[] = [];
  private bar2009Mesh!: THREE.Mesh;
  private timelineGroup!: THREE.Group;
  private treadmillGroup!: THREE.Group;
  private treadmillTex!: THREE.CanvasTexture;
  private raceCurvesGroup!: THREE.Group;
  private coinTowerInst!: THREE.InstancedMesh;
  private finaleCard!: THREE.Group;
  private finaleCoins!: THREE.InstancedMesh;
  private finaleOrbits: { r: number; y: number; ang: number; spd: number }[] = [];

  constructor() {
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

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
    this.renderer.setSize(WIDTH, HEIGHT, false);
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x111522, 0.018);
    this.scene.fog = this.fog;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = envRT.texture;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(46, WIDTH / HEIGHT, 0.1, 320);
    const rt = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, {
      type: THREE.HalfFloatType,
      samples: this.isSoftwareGl ? 0 : 4,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setSize(WIDTH, HEIGHT);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT), 0.28, 0.25, 1.18);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.priceTagTex = createMs01PriceTagTexture(maxAniso);

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x090e1c) },
        uMid: { value: new THREE.Color(0x161a29) },
        uBottom: { value: new THREE.Color(0x0f121c) },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBottom; varying vec3 vP;
        void main(){
          float h = clamp(vP.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = h < 0.48 ? mix(uBottom, uMid, smoothstep(0.12, 0.48, h)) : mix(uMid, uTop, smoothstep(0.48, 0.92, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(180, 28, 20), this.skyMat));

    const rng = createRng(10101);
    const pos = new Float32Array(320 * 3);
    for (let i = 0; i < 320; i++) {
      pos[i * 3] = rng.range(-40, 40);
      pos[i * 3 + 1] = rng.range(-4, 34);
      pos[i * 3 + 2] = rng.range(-48, 22);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dustPoints = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: 0xffe4a8, size: 0.2, transparent: true, opacity: 0.55 }),
    );
    this.scene.add(this.dustPoints);

    this.scene.add(new THREE.HemisphereLight(0xaec4ec, 0x161c2c, 0.55));
    const key = new THREE.DirectionalLight(0xffe6bd, 1.2);
    key.position.set(8, 16, 12);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x3ce0ff, 0.9, 60);
    rim.position.set(-8, 7, -8);
    this.scene.add(rim);

    this.worlds = {
      aisle: this.buildAisleWorld(maxAniso),
      cpiCart: this.buildCpiCartWorld(maxAniso),
      vault: this.buildVaultWorld(maxAniso),
      storm: this.buildStormWorld(),
      spiral: this.buildSpiralWorld(maxAniso),
      timeline: this.buildTimelineWorld(maxAniso),
      race: this.buildRaceWorld(maxAniso),
      finale: this.buildFinaleWorld(maxAniso),
    };
    (Object.values(this.worlds) as THREE.Group[]).forEach((w) => {
      w.visible = false;
      this.scene.add(w);
    });
  }

  public setResolution(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private buildAisleWorld(maxAniso: number): THREE.Group {
    const g = new THREE.Group();
    const rng = createRng(1001);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 140),
      new THREE.MeshStandardMaterial({ map: createGridFloorTexture(maxAniso, '#FFD54A', '#10141F'), roughness: 0.45 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    g.add(floor);

    // Instanced supermarket shelf boxes along left & right aisles
    const boxGeo = new THREE.BoxGeometry(0.85, 0.72, 0.7);
    const boxMat = new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0.12 });
    const count = 240;
    const inst = new THREE.InstancedMesh(boxGeo, boxMat, count);
    const cols = [0x2a4f7c, 0xc24838, 0x268255, 0xc4952d, 0x5c3e82];
    const tmpCol = new THREE.Color();
    let idx = 0;
    for (let z = 12; z >= -36; z -= 2.6) {
      for (const side of [-1, 1]) {
        for (let level = 0; level < 3; level++) {
          if (idx >= count) break;
          _dummy.position.set(side * 4.4, -1.5 + level * 1.4, z);
          _dummy.rotation.set(0, rng.range(-0.08, 0.08), 0);
          _dummy.scale.set(rng.range(0.8, 1.15), rng.range(0.75, 1.1), 1);
          _dummy.updateMatrix();
          inst.setMatrixAt(idx, _dummy.matrix);
          inst.setColorAt(idx, tmpCol.setHex(cols[idx % cols.length]));
          idx++;
        }
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    g.add(inst);

    // Giant 3D Price Tag swinging in center
    this.priceTagGroup = new THREE.Group();
    this.priceTagGroup.position.set(0, 1.2, 0);
    const tagMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 3.6, 0.16),
      new THREE.MeshStandardMaterial({ map: this.priceTagTex.texture, roughness: 0.42 }),
    );
    this.priceTagGroup.add(tagMesh);
    g.add(this.priceTagGroup);

    // Rising glowing red price line in sky
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5, -0.5, -18),
      new THREE.Vector3(-1.5, 1.2, -16),
      new THREE.Vector3(1.5, 2.8, -14),
      new THREE.Vector3(5, 6.2, -12),
    ]);
    this.aisleRedLine = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 40, 0.16, 12, false),
      new THREE.MeshStandardMaterial({ color: 0xff3b5c, emissive: 0xff3b5c, emissiveIntensity: 1.8, toneMapped: false }),
    );
    g.add(this.aisleRedLine);

    this.aisleAlertLight = new THREE.PointLight(0xff3b5c, 0, 36);
    this.aisleAlertLight.position.set(0, 3, 4);
    g.add(this.aisleAlertLight);

    return g;
  }

  private buildCpiCartWorld(maxAniso: number): THREE.Group {
    const g = new THREE.Group();
    const rng = createRng(2001);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ map: createGridFloorTexture(maxAniso, '#3CE0FF', '#081222'), roughness: 0.42 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.3;
    g.add(floor);

    // Rising CPI neon ribbon
    const ribbonCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.5, -1.0, -5),
      new THREE.Vector3(-1.5, 0.2, -4.5),
      new THREE.Vector3(1.5, 1.8, -4.0),
      new THREE.Vector3(4.5, 3.8, -3.5),
    ]);
    g.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(ribbonCurve, 40, 0.14, 12, false),
        new THREE.MeshStandardMaterial({ color: 0xff3b5c, emissive: 0xff3b5c, emissiveIntensity: 1.7, toneMapped: false }),
      ),
    );

    // 3D Shopping Cart + Dropping Grocery Boxes
    this.cartGroup = new THREE.Group();
    this.cartGroup.position.set(0, -1.3, 0.5);
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8c5d9, metalness: 0.85, roughness: 0.25 });
    const basket = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.8, 2.0),
      new THREE.MeshStandardMaterial({ color: 0x8ea4c2, wireframe: true }),
    );
    basket.position.y = 1.2;
    this.cartGroup.add(basket);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 2.0), metal);
    base.position.y = 0.25;
    this.cartGroup.add(base);
    g.add(this.cartGroup);

    const boxCols = [0x22e07a, 0xffd54a, 0x3ce0ff, 0xff6a3a, 0xff3b5c, 0x9b72ff];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 0.72, 0.72),
        new THREE.MeshStandardMaterial({ color: boxCols[i], roughness: 0.4 }),
      );
      this.cartGroup.add(m);
      this.groceryItems.push({
        mesh: m,
        targetPos: new THREE.Vector3(-0.9 + (i % 3) * 0.9, 0.7 + Math.floor(i / 3) * 0.75, (i % 2 - 0.5) * 0.6),
        delay: i * 0.22,
      });
    }

    // Flying coins from wallet
    const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.88, roughness: 0.2 });
    for (let i = 0; i < 36; i++) {
      this.walletCoinData.push({
        angle: rng.range(0, Math.PI * 2),
        speed: rng.range(1.6, 3.2),
        up: rng.range(2.2, 5.2),
        phase: rng.range(0, 1),
      });
    }
    this.walletCoins = new THREE.InstancedMesh(coinGeo, coinMat, 36);
    g.add(this.walletCoins);

    return g;
  }

  private buildVaultWorld(maxAniso: number): THREE.Group {
    const g = new THREE.Group();
    const marbleMat = new THREE.MeshStandardMaterial({ map: createMarbleTexture(maxAniso), roughness: 0.28, metalness: 0.2 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.88, roughness: 0.2 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), marbleMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    g.add(floor);

    for (let z = 6; z >= -10; z -= 4) {
      for (const side of [-1, 1]) {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.64, 13, 18), marbleMat);
        shaft.position.set(side * 5.0, 4.1, z);
        g.add(shaft);
      }
    }

    const frame = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.42, 16, 44), goldMat);
    frame.position.set(0, 1.5, -10);
    g.add(frame);

    const glowBack = new THREE.Mesh(
      new THREE.CircleGeometry(3.0, 32),
      new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0xffc83d, emissiveIntensity: 1.45, toneMapped: false }),
    );
    glowBack.position.set(0, 1.5, -10.2);
    g.add(glowBack);

    this.vaultDoorPivot = new THREE.Group();
    this.vaultDoorPivot.position.set(-3.2, 1.5, -9.8);
    const door = new THREE.Mesh(
      new THREE.CylinderGeometry(3.1, 3.1, 0.5, 36),
      new THREE.MeshStandardMaterial({ color: 0x262e40, metalness: 0.85, roughness: 0.25 }),
    );
    door.rotation.x = Math.PI / 2;
    door.position.x = 3.2;
    this.vaultDoorPivot.add(door);

    this.vaultWheel = new THREE.Group();
    this.vaultWheel.position.set(3.2, 0, 0.4);
    this.vaultWheel.add(new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.14, 12, 28), goldMat));
    this.vaultDoorPivot.add(this.vaultWheel);
    g.add(this.vaultDoorPivot);

    const months = ['2026', '2027', '2028', '2029', '2030', '2031'];
    for (let i = 0; i < months.length; i++) {
      const page = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 2.2, 0.06),
        new THREE.MeshStandardMaterial({ map: createCalendarTex(maxAniso, months[i]), roughness: 0.4 }),
      );
      g.add(page);
      this.calendarPages.push(page);
    }
    return g;
  }

  private buildStormWorld(): THREE.Group {
    const g = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0x1a2234, roughness: 0.85 });
    for (let i = 0; i < 12; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), cloudMat);
      puff.position.set((i - 5.5) * 2.2, 5.2 + (i % 3) * 0.9, -8 - (i % 4) * 3);
      g.add(puff);
    }

    const boltMat = new THREE.MeshStandardMaterial({ color: 0x3ce0ff, emissive: 0x3ce0ff, emissiveIntensity: 1.9, toneMapped: false });
    for (let b = 0; b < 3; b++) {
      const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6.5, 0.18), boltMat);
      bolt.position.set((b - 1) * 4.5, 1.8, -6);
      bolt.rotation.z = (b - 1) * 0.22;
      g.add(bolt);
      this.stormLightning.push(bolt);
    }

    this.stormArrow = new THREE.Group();
    const redGlow = new THREE.MeshStandardMaterial({ color: 0xff3b5c, emissive: 0xff3b5c, emissiveIntensity: 1.6, toneMapped: false });
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.6, 0.45), redGlow);
    const head = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.0, 4), redGlow);
    head.rotation.z = Math.PI;
    head.position.y = -2.4;
    this.stormArrow.add(shaft, head);
    this.stormArrow.position.set(0, 1.5, -2);
    g.add(this.stormArrow);
    return g;
  }

  private buildSpiralWorld(maxAniso: number): THREE.Group {
    const g = new THREE.Group();
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xff3b5c, emissive: 0xff2247, emissiveIntensity: 1.5, toneMapped: false });
    for (let i = 0; i < 16; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.1, 10, 40), ringMat);
      r.position.z = 6 - i * 2.8;
      g.add(r);
      this.spiralRings.push(r);
    }
    const labels = [
      { t: 'PEOPLE WAIT', s: 'PRICES FALL', c: '#FFD54A' },
      { t: 'LESS SALES', s: 'SHOPS CLOSE', c: '#FF6A3A' },
      { t: 'JOB CUTS', s: 'SPIRAL DOWN', c: '#FF3B5C' },
    ];
    for (let i = 0; i < labels.length; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 1.9, 0.2),
        new THREE.MeshStandardMaterial({ map: createSignPanelTexture(maxAniso, labels[i].t, labels[i].s, labels[i].c) }),
      );
      p.position.set(0, 0.4, -2 - i * 4);
      g.add(p);
      this.spiralPanels.push(p);
    }
    return g;
  }

  private buildTimelineWorld(maxAniso: number): THREE.Group {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 120),
      new THREE.MeshStandardMaterial({ map: createGridFloorTexture(maxAniso, '#22E07A', '#07121C'), roughness: 0.45 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.2;
    g.add(floor);

    this.timelineGroup = new THREE.Group();
    g.add(this.timelineGroup);

    const greenMat = new THREE.MeshStandardMaterial({ color: 0x22e07a, metalness: 0.35, roughness: 0.3, emissive: 0x107a42, emissiveIntensity: 0.3 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff3b5c, emissive: 0xff3b5c, emissiveIntensity: 1.65, toneMapped: false });

    HISTORICAL_US_CPI.forEach((val, idx) => {
      const x = (idx - 54) * 0.55; // 2009 (index 54) centered at x=0!
      const h = Math.max(0.35, Math.abs(val) * 0.45);
      const is2009 = idx === 54;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.38, h, 0.5), is2009 ? redMat : greenMat);
      bar.position.set(x, is2009 ? -2.2 - h / 2 + 0.2 : -2.2 + h / 2, -2);
      this.timelineGroup.add(bar);
      if (is2009) this.bar2009Mesh = bar;
    });
    return g;
  }

  private buildRaceWorld(maxAniso: number): THREE.Group {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ map: createGridFloorTexture(maxAniso, '#22E07A', '#08141E'), roughness: 0.45 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    g.add(floor);

    this.raceCurvesGroup = new THREE.Group();
    const fastCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4, -1.5, -2),
      new THREE.Vector3(-1, 0.2, -2),
      new THREE.Vector3(2, 2.6, -2),
      new THREE.Vector3(4.5, 5.2, -2),
    ]);
    const slowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4, -1.5, -1),
      new THREE.Vector3(-1, -1.0, -1),
      new THREE.Vector3(2, -0.3, -1),
      new THREE.Vector3(4.5, 0.4, -1),
    ]);
    this.raceCurvesGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(fastCurve, 32, 0.16, 10, false),
        new THREE.MeshStandardMaterial({ color: 0xff3b5c, emissive: 0xff3b5c, emissiveIntensity: 1.7, toneMapped: false }),
      ),
      new THREE.Mesh(
        new THREE.TubeGeometry(slowCurve, 32, 0.16, 10, false),
        new THREE.MeshStandardMaterial({ color: 0x22e07a, emissive: 0x22e07a, emissiveIntensity: 1.7, toneMapped: false }),
      ),
    );
    g.add(this.raceCurvesGroup);

    this.treadmillGroup = new THREE.Group();
    this.treadmillTex = createTreadmillTex(maxAniso);
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.35, 7.5),
      new THREE.MeshStandardMaterial({ map: this.treadmillTex, roughness: 0.45 }),
    );
    belt.position.set(0, -1.6, 0);
    this.treadmillGroup.add(belt);
    g.add(this.treadmillGroup);

    const coinGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.18, 20);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0x22e07a, metalness: 0.78, roughness: 0.22 });
    this.coinTowerInst = new THREE.InstancedMesh(coinGeo, coinMat, 40);
    g.add(this.coinTowerInst);
    return g;
  }

  private buildFinaleWorld(maxAniso: number): THREE.Group {
    const g = new THREE.Group();
    const rng = createRng(9090);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ map: createGridFloorTexture(maxAniso, '#3CE0FF', '#080E1A'), roughness: 0.45 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.4;
    g.add(floor);

    this.finaleCard = new THREE.Group();
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.9, roughness: 0.2 });
    const card = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.55, 0.16), [
      edgeMat,
      edgeMat,
      edgeMat,
      edgeMat,
      new THREE.MeshStandardMaterial({ map: createMs01CardTex(maxAniso, 'front'), roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: createMs01CardTex(maxAniso, 'back'), roughness: 0.3 }),
    ]);
    this.finaleCard.add(card);
    g.add(this.finaleCard);

    const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.88, roughness: 0.2 });
    for (let i = 0; i < 90; i++) {
      this.finaleOrbits.push({
        r: rng.range(3.5, 9.5),
        y: rng.range(-2.2, 5.8),
        ang: rng.range(0, Math.PI * 2),
        spd: rng.range(0.5, 1.3) * (i % 2 === 0 ? 1 : -1),
      });
    }
    this.finaleCoins = new THREE.InstancedMesh(coinGeo, coinMat, 90);
    g.add(this.finaleCoins);
    return g;
  }

  public renderAt(t: number): void {
    const shot = getShotAtForMeta(MS01_META, t);
    const shotElapsed = Math.max(0, t - shot.start);
    const u = clamp(shotElapsed / Math.max(0.01, shot.end - shot.start), 0, 1);
    const world = shot.world as WorldId;

    (Object.keys(this.worlds) as WorldId[]).forEach((k) => {
      this.worlds[k].visible = k === world;
    });

    const pal = PALETTES[world];
    this.skyMat.uniforms.uTop.value.setHex(pal.top);
    this.skyMat.uniforms.uMid.value.setHex(pal.mid);
    this.skyMat.uniforms.uBottom.value.setHex(pal.bottom);
    this.fog.color.setHex(pal.fog);
    this.bloomPass.strength = pal.bloom;
    this.dustPoints.rotation.y = t * 0.025;

    let camX = 0;
    let camY = 1.6;
    let camZ = 10.5;
    _camLook.set(0, 0.8, 0);

    if (world === 'aisle') {
      const priceVal = shot.id === 1 ? lerp(100, 131, easeInOutCubic(invLerp(0.35, 1.35, t))) : 131;
      const stampP = shot.id === 2 ? clamp(shotElapsed / 0.25, 0, 1) : shot.id > 2 ? 1 : 0;
      this.priceTagTex.update(priceVal, stampP, priceVal > 110);
      this.priceTagGroup.visible = shot.id !== 4;
      this.priceTagGroup.rotation.y = shot.id === 1 ? lerp(-0.8, 0, easeOutBack(clamp(shotElapsed / 0.7, 0, 1))) : Math.sin(t * 2) * 0.14;
      this.aisleRedLine.visible = shot.id === 3;
      this.aisleAlertLight.intensity = shot.id === 4 ? 3.5 : 0.4;
      camZ = shot.id === 2 ? lerp(7.2, 5.8, u) : lerp(11.0, 8.2, u);
      camY = shot.id === 3 ? lerp(1.0, 3.6, u) : 1.5;
    } else if (world === 'cpiCart') {
      const showCart = shot.id === 6 || shot.id === 7;
      this.cartGroup.visible = showCart;
      this.walletCoins.visible = shot.id === 7;
      for (const item of this.groceryItems) {
        const p = shot.id === 6 ? clamp((shotElapsed - item.delay) / 0.55, 0, 1) : 1;
        item.mesh.position.set(item.targetPos.x, lerp(6.5, item.targetPos.y, easeOutBounce(p)), item.targetPos.z);
      }
      for (let i = 0; i < this.walletCoinData.length; i++) {
        const c = this.walletCoinData[i];
        const p = (shotElapsed * 0.85 + c.phase) % 1;
        _dummy.position.set(Math.cos(c.angle) * p * 4.5, -1.0 + Math.sin(p * Math.PI) * c.up, Math.sin(c.angle) * p * 3.5);
        _dummy.rotation.set(p * 10, p * 6, 0);
        _dummy.scale.setScalar(1);
        _dummy.updateMatrix();
        this.walletCoins.setMatrixAt(i, _dummy.matrix);
      }
      this.walletCoins.instanceMatrix.needsUpdate = true;
      camX = lerp(-1.8, 1.8, u);
      camY = 2.0;
      camZ = lerp(9.8, 7.6, u);
    } else if (world === 'vault') {
      const openP = shot.id === 8 ? 0 : shot.id === 9 ? easeInOutCubic(u) : 1;
      this.vaultDoorPivot.rotation.y = -openP * 1.45;
      this.vaultWheel.rotation.z = openP * Math.PI * 2.2;
      this.calendarPages.forEach((p, idx) => {
        p.visible = shot.id === 10;
        const fly = (shotElapsed * 0.9 + idx * 0.25) % 1.5;
        p.position.set((idx - 2.5) * 1.6, Math.sin(fly * 3 + idx) * 1.4 + 1.2, lerp(-8, 6, clamp(fly / 1.5, 0, 1)));
        p.rotation.set(fly * 1.2, fly * 1.8, 0.2);
      });
      camZ = lerp(10.5, 5.2, u);
      _camLook.set(0, 1.4, -8);
    } else if (world === 'storm') {
      this.stormArrow.position.y = 1.6 + Math.sin(t * 6) * 0.25;
      this.stormLightning.forEach((b, i) => {
        b.visible = Math.sin(t * 28 + i * 2.5) > 0.45;
      });
      camX = Math.sin(u * 2) * 1.2;
      camZ = lerp(10.5, 8.6, u);
    } else if (world === 'spiral') {
      this.spiralRings.forEach((r, i) => {
        r.rotation.z = t * 1.2 + i * 0.2;
        r.position.z = ((6 - i * 2.8 + t * 8) % 44) - 34;
      });
      this.spiralPanels.forEach((p, i) => {
        p.visible = shot.id === 12 + i;
        p.rotation.y = Math.sin(t * 2.5) * 0.2;
      });
      camZ = lerp(9.2, 6.2, u);
    } else if (world === 'timeline') {
      const scrollX = shot.id === 16 ? lerp(18, 2, u) : 0;
      this.timelineGroup.position.x = scrollX;
      this.bar2009Mesh.scale.y = shot.id >= 17 ? 2.4 : 1.0;
      camY = shot.id >= 17 ? 1.0 : 2.6;
      camZ = shot.id >= 17 ? lerp(8.5, 5.8, u) : lerp(12.0, 9.5, u);
    } else if (world === 'race') {
      this.raceCurvesGroup.visible = shot.id === 20 || shot.id === 21;
      this.treadmillGroup.visible = shot.id === 22;
      this.treadmillTex.offset.y = -t * 1.8;
      const showTower = shot.id === 23 || shot.id === 24;
      this.coinTowerInst.visible = showTower;
      const grow = shot.id === 23 ? u * 0.55 : 0.55 + u * 0.45;
      for (let i = 0; i < 40; i++) {
        const show = i / 40 <= grow;
        _dummy.position.set(0, -2.2 + i * 0.19, -1.5);
        _dummy.rotation.set(0, t + i * 0.2, 0);
        _dummy.scale.setScalar(show ? 1 : 0.001);
        _dummy.updateMatrix();
        this.coinTowerInst.setMatrixAt(i, _dummy.matrix);
      }
      this.coinTowerInst.instanceMatrix.needsUpdate = true;
      camX = lerp(-1.5, 1.5, u);
      camZ = lerp(10.0, 8.0, u);
    } else {
      this.finaleCard.position.y = 1.1 + Math.sin(t * 2.6) * 0.14;
      this.finaleCard.rotation.y = shot.id === 25 ? Math.sin(shotElapsed * 2) * 0.3 : lerp(0, Math.PI, easeInOutCubic(clamp(shotElapsed / 0.65, 0, 1)));
      for (let i = 0; i < this.finaleOrbits.length; i++) {
        const c = this.finaleOrbits[i];
        const a = c.ang + t * c.spd;
        _dummy.position.set(Math.cos(a) * c.r, c.y, Math.sin(a) * c.r - 2);
        _dummy.rotation.set(t * 2.2, a, 0);
        _dummy.scale.setScalar(1);
        _dummy.updateMatrix();
        this.finaleCoins.setMatrixAt(i, _dummy.matrix);
      }
      this.finaleCoins.instanceMatrix.needsUpdate = true;
      camZ = lerp(10.0, 8.4, u);
    }

    this.camera.fov = punchInFov(46, shotElapsed);
    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(_camLook);
    this.camera.updateProjectionMatrix();
    this.composer.render();
  }

  public dispose(): void {
    this.composer.dispose();
    this.renderer.dispose();
  }
}
