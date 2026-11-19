/**
 * Voice of Times — Money Secrets #2 ("Who Owns America's $40 Trillion Debt?")
 * Deterministic Three.js 3D Worlds Engine (9:16 vertical, native 1080p / 2K / 4K).
 *
 * Pipeline:
 * - WebGLRenderer (high-performance GPU, ACESFilmicToneMapping, SRGBColorSpace, preserveDrawingBuffer)
 * - PMREM RoomEnvironment (calibrated intensity 0.42 so diffuse/metallic surfaces never blow out)
 * - EffectComposer + RenderPass + Restrained HDR UnrealBloomPass (threshold 1.18, strength 0.25-0.32) + OutputPass
 * - 8 complete 3D worlds covering all 27 shots (0.00s -> 54.07s):
 *     1) skyline     : Night city skyline + giant 3D $40T digital counter -> gold coin stack -> 3D pointing hand/arrow
 *     2) pieWorld    : 3D extruded donut/pie chart over dark grid floor, 19% blue slice + loop arrow, 1.5% red sliver,
 *                      45% green Americans slice + flying 3D Bank, Pension Safe, and Mutual Fund icons
 *     3) govVaults   : Social Security & Medicare 3D vaults streaming golden coin arcs into US Government building
 *     4) fedHall     : Marble classical column hall + giant round vault door + lifted gold Federal Reserve slice
 *     5) globe       : Spinning stylized 3D Earth in starry space with accurate rising bars for Japan, UK, and China
 *     6) suburb      : Instanced twilight suburban street with coins arcing into houses + glowing YOUR 401(k) jar
 *     7) interestTap : Giant metallic INTEREST faucet pouring a cascading river of coins back into suburban homes
 *     8) finale      : Swirling coin storm + spinning 3D Money Secret #2 -> #3 collector card
 * - Zero Math.random(); zero per-frame allocations; continuous camera motion + 8% 0.25s FOV punch-in per shot.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  clamp,
  createRng,
  easeInOutCubic,
  easeOutBack,
  easeOutBounce,
  easeOutCubic,
  lerp,
  punchInFov,
} from '../../engine/prng';
import {
  HEIGHT,
  WIDTH,
  getShotAtForMeta,
} from '../../engine/episodeTypes';
import { MS02_META } from './meta';
import {
  DynamicDebtCounterTex,
  createCityWindowTexture,
  createCollectorCardTexture,
  createContactShadowTexture,
  createDebtCounterTexture,
  createEarthGlobeTexture,
  createGridFloorTexture,
  createJar401kTexture,
  createMarbleTexture,
  createSignPanelTexture,
} from '../../engine/textures3d';

type WorldId =
  | 'skyline'
  | 'pieWorld'
  | 'govVaults'
  | 'fedHall'
  | 'globe'
  | 'suburb'
  | 'interestTap'
  | 'finale';

const getShotAt = (t: number) => getShotAtForMeta(MS02_META, t);

const _dummy = new THREE.Object3D();
const _camLook = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _tmpVec = new THREE.Vector3();

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
  skyline: {
    top: 0x060a16,
    mid: 0x0f1830,
    bottom: 0x0b101d,
    fog: 0x0c1324,
    fogDensity: 0.015,
    keyColor: 0xffe4b5,
    keyIntensity: 1.2,
    rimColor: 0x3ce0ff,
    rimIntensity: 0.85,
    bloomStrength: 0.28,
  },
  pieWorld: {
    top: 0x050b18,
    mid: 0x0d1b30,
    bottom: 0x08101c,
    fog: 0x091322,
    fogDensity: 0.016,
    keyColor: 0xe6f2ff,
    keyIntensity: 1.2,
    rimColor: 0x22e07a,
    rimIntensity: 0.9,
    bloomStrength: 0.28,
  },
  govVaults: {
    top: 0x07101d,
    mid: 0x102236,
    bottom: 0x091420,
    fog: 0x0b1826,
    fogDensity: 0.016,
    keyColor: 0xfff0d4,
    keyIntensity: 1.25,
    rimColor: 0x5cf2d0,
    rimIntensity: 0.95,
    bloomStrength: 0.26,
  },
  fedHall: {
    top: 0x0a0d18,
    mid: 0x1a1e2e,
    bottom: 0x10131e,
    fog: 0x121624,
    fogDensity: 0.017,
    keyColor: 0xffe0a6,
    keyIntensity: 1.25,
    rimColor: 0xffd54a,
    rimIntensity: 1.0,
    bloomStrength: 0.28,
  },
  globe: {
    top: 0x03060f,
    mid: 0x081326,
    bottom: 0x040914,
    fog: 0x050b18,
    fogDensity: 0.008,
    keyColor: 0xdff4ff,
    keyIntensity: 1.35,
    rimColor: 0x3ce0ff,
    rimIntensity: 1.0,
    bloomStrength: 0.3,
  },
  suburb: {
    top: 0x081222,
    mid: 0x13263a,
    bottom: 0x0c1724,
    fog: 0x0e1c2c,
    fogDensity: 0.015,
    keyColor: 0xffe8c2,
    keyIntensity: 1.25,
    rimColor: 0x22e07a,
    rimIntensity: 0.9,
    bloomStrength: 0.26,
  },
  interestTap: {
    top: 0x07121b,
    mid: 0x112432,
    bottom: 0x09141d,
    fog: 0x0a1822,
    fogDensity: 0.014,
    keyColor: 0xfff0cc,
    keyIntensity: 1.25,
    rimColor: 0xffd54a,
    rimIntensity: 1.0,
    bloomStrength: 0.29,
  },
  finale: {
    top: 0x060a14,
    mid: 0x121d32,
    bottom: 0x090f1b,
    fog: 0x0c1322,
    fogDensity: 0.013,
    keyColor: 0xfff1cc,
    keyIntensity: 1.25,
    rimColor: 0x3ce0ff,
    rimIntensity: 0.95,
    bloomStrength: 0.3,
  },
};

function latLonToVec3(latDeg: number, lonDeg: number, radius: number): THREE.Vector3 {
  const phi = ((lonDeg + 180) / 360) * Math.PI * 2;
  const theta = ((90 - latDeg) / 180) * Math.PI;
  const x = -radius * Math.cos(phi) * Math.sin(theta);
  const y = radius * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

function createExtrudedDonutSlice(
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
  depth: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const segments = Math.max(8, Math.round(Math.abs(endAngle - startAngle) * 28));
  shape.moveTo(Math.cos(startAngle) * innerR, Math.sin(startAngle) * innerR);
  shape.lineTo(Math.cos(startAngle) * outerR, Math.sin(startAngle) * outerR);
  shape.absarc(0, 0, outerR, startAngle, endAngle, false);
  shape.lineTo(Math.cos(endAngle) * innerR, Math.sin(endAngle) * innerR);
  shape.absarc(0, 0, innerR, endAngle, startAngle, true);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
    curveSegments: segments,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

interface PieSliceHandle {
  group: THREE.Group;
  midAngle: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
}

interface CoinStreamItem {
  phase: number;
  speed: number;
  streamIdx: number; // 0 = left vault, 1 = right vault
  wobble: number;
}

interface SuburbHousePos {
  x: number;
  z: number;
  side: number;
}

interface SuburbCoinArc {
  targetIdx: number;
  phase: number;
  speed: number;
  arcH: number;
}

interface RiverCoin {
  phase: number;
  speed: number;
  laneX: number;
  spin: number;
  bob: number;
}

export class ThreeShortEngine {
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
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly rimLight: THREE.PointLight;
  private readonly accentLight: THREE.PointLight;
  private readonly dustPoints: THREE.Points;

  private readonly worlds: Record<WorldId, THREE.Group>;
  private readonly debtCounterTex: DynamicDebtCounterTex;

  // World 1: Skyline
  private counterGroup!: THREE.Group;
  private counterLeftHalf!: THREE.Mesh;
  private counterRightHalf!: THREE.Mesh;
  private skylineCoinsInst!: THREE.InstancedMesh;
  private skylineCoinPositions: { x: number; y: number; z: number; rot: number }[] = [];
  private pointerGroup!: THREE.Group;
  private skylineAlertLight!: THREE.PointLight;

  // World 2: Pie / Donut Chart
  private pieRoot!: THREE.Group;
  private pieSlices!: {
    intragov: PieSliceHandle;
    fed: PieSliceHandle;
    foreign: PieSliceHandle;
    china: PieSliceHandle;
    americans: PieSliceHandle;
  };
  private loopArrowGroup!: THREE.Group;
  private iconBankGroup!: THREE.Group;
  private iconPensionGroup!: THREE.Group;
  private iconMutualGroup!: THREE.Group;

  // World 3: Social Security & Medicare Vaults -> US Gov
  private ssDoorPivot!: THREE.Group;
  private medDoorPivot!: THREE.Group;
  private govStreamCoins!: THREE.InstancedMesh;
  private govStreamData: CoinStreamItem[] = [];

  // World 4: Marble Hall & Federal Reserve Vault
  private fedVaultPivot!: THREE.Group;
  private fedVaultWheel!: THREE.Group;
  private fedGoldSlice!: THREE.Group;
  private fedInteriorLight!: THREE.PointLight;

  // World 5: Spinning 3D Earth Globe
  private globeGroup!: THREE.Group;
  private japanBarPivot!: THREE.Group;
  private japanBarMesh!: THREE.Mesh;
  private ukBarPivot!: THREE.Group;
  private ukBarMesh!: THREE.Mesh;
  private chinaBarPivot!: THREE.Group;
  private chinaBarMesh!: THREE.Mesh;
  private globeRing!: THREE.Mesh;

  // World 6: Suburban Street & 401(k) Jar
  private suburbStreetGroup!: THREE.Group;
  private suburbHousePositions: SuburbHousePos[] = [];
  private suburbCoinsInst!: THREE.InstancedMesh;
  private suburbCoinArcs: SuburbCoinArc[] = [];
  private jar401kGroup!: THREE.Group;
  private jarCoinsInst!: THREE.InstancedMesh;
  private jarInnerCoins: { x: number; y: number; z: number; delay: number }[] = [];

  // World 7: Giant INTEREST Tap & Coin River
  private tapHandleGroup!: THREE.Group;
  private tapRiverCoinsInst!: THREE.InstancedMesh;
  private tapRiverData: RiverCoin[] = [];

  // World 8: Finale Collector Card & Coin Storm
  private finaleCardGroup!: THREE.Group;
  private finaleCoinsInst!: THREE.InstancedMesh;
  private finaleCoinOrbits: { r: number; y: number; angle: number; speed: number; tilt: number }[] = [];

  constructor() {
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
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
    this.renderer.shadowMap.enabled = false;

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x0c1324, 0.015);
    this.scene.fog = this.fog;

    // Calibrated PMREM environment for crisp metallic sheen without blowing out bloom
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = envRT.texture;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(46, WIDTH / HEIGHT, 0.1, 350);
    this.camera.position.set(0, 4, 14);

    // EffectComposer + Restrained HDR UnrealBloomPass (threshold 1.18) + OutputPass
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
    this.debtCounterTex = createDebtCounterTexture(maxAniso);

    // Layer 1 (BACK): Full 3D Gradient Sky Dome
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x060a16) },
        uMid: { value: new THREE.Color(0x0f1830) },
        uBottom: { value: new THREE.Color(0x0b101d) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uBottom;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp(vWorldPos.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = h < 0.48
            ? mix(uBottom, uMid, smoothstep(0.12, 0.48, h))
            : mix(uMid, uTop, smoothstep(0.48, 0.92, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 24), this.skyMat);
    this.scene.add(skyDome);

    // Layer 1 (BACK): Deterministic floating stars / dust particles
    this.dustPoints = this.createDustField();
    this.scene.add(this.dustPoints);

    // 3-Point Rigged Studio Lights
    this.hemiLight = new THREE.HemisphereLight(0x9fb8e8, 0x161c2c, 0.55);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffe4b5, 1.2);
    this.keyLight.position.set(10, 18, 12);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.PointLight(0x3ce0ff, 0.9, 65, 1.2);
    this.rimLight.position.set(-9, 8, -8);
    this.scene.add(this.rimLight);

    this.accentLight = new THREE.PointLight(0xffd54a, 0.75, 55, 1.3);
    this.accentLight.position.set(8, 5, 7);
    this.scene.add(this.accentLight);

    // Build all 8 3D Worlds
    const contactShadow = createContactShadowTexture();
    this.worlds = {
      skyline: this.buildSkylineWorld(maxAniso),
      pieWorld: this.buildPieWorld(maxAniso, contactShadow),
      govVaults: this.buildGovVaultsWorld(maxAniso),
      fedHall: this.buildFedHallWorld(maxAniso),
      globe: this.buildGlobeWorld(maxAniso),
      suburb: this.buildSuburbWorld(maxAniso),
      interestTap: this.buildInterestTapWorld(maxAniso),
      finale: this.buildFinaleWorld(maxAniso),
    };

    (Object.values(this.worlds) as THREE.Group[]).forEach((g) => {
      g.visible = false;
      this.scene.add(g);
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

  private createDustField(): THREE.Points {
    const count = 420;
    const rng = createRng(20260201);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color(0x9bc8ff),
      new THREE.Color(0xffe08a),
      new THREE.Color(0x70f0ff),
      new THREE.Color(0xffffff),
    ];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = rng.range(-48, 48);
      positions[i * 3 + 1] = rng.range(-6, 40);
      positions[i * 3 + 2] = rng.range(-56, 24);
      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  // ============================================================================
  // WORLD 1: NIGHT CITY SKYLINE + $40T DIGITAL COUNTER + COIN STACK + 3D POINTER
  // ============================================================================
  private buildSkylineWorld(maxAniso: number): THREE.Group {
    const group = new THREE.Group();
    const rng = createRng(1002);

    // City ground grid
    const floorTex = createGridFloorTexture(maxAniso, '#3CE0FF', '#090F1C');
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.3 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4.5;
    group.add(floor);

    // Instanced night skyscrapers with lit windows (160 buildings framing a central avenue)
    const winTex = createCityWindowTexture(maxAniso);
    const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
    const bldgMat = new THREE.MeshStandardMaterial({
      map: winTex,
      emissiveMap: winTex,
      emissive: new THREE.Color(0x9fc2e8),
      emissiveIntensity: 0.45,
      roughness: 0.42,
      metalness: 0.55,
    });

    const bldgCount = 150;
    const bldgs = new THREE.InstancedMesh(bldgGeo, bldgMat, bldgCount);
    let idx = 0;
    for (let i = 0; i < bldgCount; i++) {
      // Keep central canyon clear for the $40T monolith & gold coin stack
      const side = i % 2 === 0 ? -1 : 1;
      const band = Math.floor(i / 2);
      const ring = band % 5;
      const x = side * (5.8 + ring * 3.8 + rng.range(-0.9, 0.9));
      const z = rng.range(-56, 14);
      const w = rng.range(1.8, 3.6);
      const d = rng.range(1.8, 3.6);
      const h = rng.range(6.5, 22.0) + (ring < 2 ? 3 : 0);

      _dummy.position.set(x, -4.5 + h / 2, z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(w, h, d);
      _dummy.updateMatrix();
      bldgs.setMatrixAt(idx++, _dummy.matrix);
    }
    bldgs.instanceMatrix.needsUpdate = true;
    group.add(bldgs);

    // Rooftop cyan beacon strips along skyline
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x3ce0ff,
      emissive: 0x3ce0ff,
      emissiveIntensity: 1.8,
      toneMapped: false,
    });
    for (let i = -3; i <= 3; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 60), beaconMat);
      strip.position.set(i * 5.2, -4.42, -20);
      group.add(strip);
    }

    // Giant 3D Digital Counter Monolith (two halves that split apart in Shot 2!)
    this.counterGroup = new THREE.Group();
    this.counterGroup.position.set(0, 2.6, -2.5);

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1a2233,
      metalness: 0.78,
      roughness: 0.28,
    });
    const screenMat = new THREE.MeshStandardMaterial({
      map: this.debtCounterTex.texture,
      emissiveMap: this.debtCounterTex.texture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.65,
      roughness: 0.35,
      metalness: 0.15,
    });

    // Left half of counter
    this.counterLeftHalf = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.1, 0.55), frameMat);
    const leftUV = new THREE.PlaneGeometry(4.0, 2.85);
    const uvL = leftUV.attributes.uv;
    uvL.setXY(0, 0, 1);
    uvL.setXY(1, 0.5, 1);
    uvL.setXY(2, 0, 0);
    uvL.setXY(3, 0.5, 0);
    const leftScreen = new THREE.Mesh(leftUV, screenMat);
    leftScreen.position.z = 0.29;
    this.counterLeftHalf.add(leftScreen);
    this.counterLeftHalf.position.x = -2.1;
    this.counterGroup.add(this.counterLeftHalf);

    // Right half of counter
    this.counterRightHalf = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.1, 0.55), frameMat);
    const rightUV = new THREE.PlaneGeometry(4.0, 2.85);
    const uvR = rightUV.attributes.uv;
    uvR.setXY(0, 0.5, 1);
    uvR.setXY(1, 1, 1);
    uvR.setXY(2, 0.5, 0);
    uvR.setXY(3, 1, 0);
    const rightScreen = new THREE.Mesh(rightUV, screenMat);
    rightScreen.position.z = 0.29;
    this.counterRightHalf.add(rightScreen);
    this.counterRightHalf.position.x = 2.1;
    this.counterGroup.add(this.counterRightHalf);

    // Neon trim bars on top/bottom of monolith
    const neonTrimMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      emissive: 0xffd54a,
      emissiveIntensity: 1.7,
      toneMapped: false,
    });
    const topNeonL = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.1, 0.62), neonTrimMat);
    topNeonL.position.y = 1.56;
    this.counterLeftHalf.add(topNeonL);
    const topNeonR = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.1, 0.62), neonTrimMat);
    topNeonR.position.y = 1.56;
    this.counterRightHalf.add(topNeonR);

    group.add(this.counterGroup);

    // Towering Stack of 3D Gold Coins revealed when the $40T counter splits!
    const coinGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.18, 24);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffc83d,
      metalness: 0.88,
      roughness: 0.22,
      emissive: 0x5c3c00,
      emissiveIntensity: 0.25,
    });
    const stackSpecs = [
      { x: 0, z: -3.2, count: 34 },
      { x: -1.65, z: -2.4, count: 24 },
      { x: 1.65, z: -2.4, count: 26 },
      { x: -0.9, z: -4.4, count: 29 },
      { x: 0.95, z: -4.3, count: 28 },
      { x: -2.6, z: -3.8, count: 17 },
      { x: 2.6, z: -3.8, count: 19 },
    ];
    this.skylineCoinPositions = [];
    for (const st of stackSpecs) {
      for (let c = 0; c < st.count; c++) {
        this.skylineCoinPositions.push({
          x: st.x + rng.range(-0.07, 0.07),
          y: -4.35 + c * 0.22,
          z: st.z + rng.range(-0.07, 0.07),
          rot: rng.range(0, Math.PI),
        });
      }
    }
    this.skylineCoinsInst = new THREE.InstancedMesh(coinGeo, coinMat, this.skylineCoinPositions.length);
    group.add(this.skylineCoinsInst);

    // Giant 3D Pointing Arrow / Hand pointing straight at camera (Shot 4: "IT'S YOU")
    this.pointerGroup = new THREE.Group();
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      metalness: 0.65,
      roughness: 0.25,
      emissive: 0xffb800,
      emissiveIntensity: 0.55,
    });
    const arrowGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffe478,
      emissive: 0xffd54a,
      emissiveIntensity: 1.85,
      toneMapped: false,
    });
    // Stylized sculpted pointing hand + bold glowing arrow shaft pointing along +Z
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 1.3, 24), new THREE.MeshStandardMaterial({
      color: 0x1c2538,
      metalness: 0.5,
      roughness: 0.4,
    }));
    cuff.rotation.x = Math.PI / 2;
    cuff.position.z = -2.6;
    this.pointerGroup.add(cuff);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 20), arrowMat);
    palm.scale.set(1.05, 0.95, 1.15);
    palm.position.z = -1.2;
    this.pointerGroup.add(palm);

    // Bold pointing index finger + glowing arrow tip pointing directly toward camera (+Z)
    const fingerShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 2.8, 20), arrowMat);
    fingerShaft.rotation.x = Math.PI / 2;
    fingerShaft.position.set(0, 0.25, 0.85);
    this.pointerGroup.add(fingerShaft);

    const arrowTip = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.45, 24), arrowGlowMat);
    arrowTip.rotation.x = Math.PI / 2;
    arrowTip.position.set(0, 0.25, 2.6);
    this.pointerGroup.add(arrowTip);

    // Curled supporting fingers & thumb
    for (let f = 0; f < 3; f++) {
      const curled = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 8, 14), arrowMat);
      curled.rotation.z = Math.PI / 2;
      curled.position.set(0.05, -0.35 - f * 0.42, -0.35);
      this.pointerGroup.add(curled);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.75, 8, 14), arrowMat);
    thumb.rotation.set(0.3, 0, -0.6);
    thumb.position.set(-0.95, 0.65, -0.6);
    this.pointerGroup.add(thumb);

    // Concentric glowing target rings around pointer
    for (let r = 0; r < 2; r++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75 + r * 0.7, 0.055, 12, 48), arrowGlowMat);
      ring.position.z = 1.6 - r * 1.1;
      this.pointerGroup.add(ring);
    }

    this.pointerGroup.position.set(0, 0.9, 1.8);
    this.pointerGroup.visible = false;
    group.add(this.pointerGroup);

    this.skylineAlertLight = new THREE.PointLight(0xff3b5c, 0, 42);
    this.skylineAlertLight.position.set(0, 4, 6);
    group.add(this.skylineAlertLight);

    return group;
  }

  // ============================================================================
  // WORLD 2: 3D PIE / DONUT CHART + LOOP ARROW + BANK / PENSION / MUTUAL ICONS
  // ============================================================================
  private buildPieWorld(maxAniso: number, contactShadow: THREE.CanvasTexture): THREE.Group {
    const group = new THREE.Group();

    const gridTex = createGridFloorTexture(maxAniso, '#3CE0FF', '#070E1C');
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.42, metalness: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    group.add(floor);

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10.5, 10.5),
      new THREE.MeshBasicMaterial({ map: contactShadow, transparent: true, opacity: 0.75, depthWrite: false }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -2.36;
    group.add(shadowPlane);

    // Glowing holographic pedestal ring under pie chart
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x3ce0ff,
      emissive: 0x3ce0ff,
      emissiveIntensity: 1.6,
      toneMapped: false,
    });
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.06, 12, 64), ringMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = -2.25;
    group.add(baseRing);

    this.pieRoot = new THREE.Group();
    this.pieRoot.position.set(0, -0.35, 0);
    group.add(this.pieRoot);

    // 5 exact debt slices summing to 100% (2 * PI):
    // 19% Intragovernmental (cyan/blue), 11% Fed (gold), 23.5% Other Foreign (teal),
    // 1.5% China (alert red), 45% Americans (money green)
    const gap = 0.025;
    const specs: {
      key: keyof ThreeShortEngine['pieSlices'];
      pct: number;
      color: number;
      emissive: number;
    }[] = [
      { key: 'intragov', pct: 0.19, color: 0x26b8ff, emissive: 0x1e9fff },
      { key: 'fed', pct: 0.11, color: 0xffd54a, emissive: 0xffb800 },
      { key: 'foreign', pct: 0.235, color: 0x237fa6, emissive: 0x165e80 },
      { key: 'china', pct: 0.015, color: 0xff3b5c, emissive: 0xff2247 },
      { key: 'americans', pct: 0.45, color: 0x22e07a, emissive: 0x12c964 },
    ];

    let cursor = 0;
    const slices: Partial<ThreeShortEngine['pieSlices']> = {};

    for (const sp of specs) {
      const span = sp.pct * Math.PI * 2;
      const a0 = cursor + gap * 0.5;
      const a1 = cursor + span - gap * 0.5;
      const mid = cursor + span * 0.5;
      cursor += span;

      const sliceGeo = createExtrudedDonutSlice(1.55, 3.65, a0, a1, 1.05);
      const sliceMat = new THREE.MeshStandardMaterial({
        color: sp.color,
        metalness: 0.45,
        roughness: 0.28,
        emissive: sp.emissive,
        emissiveIntensity: 0.22,
      });
      const mesh = new THREE.Mesh(sliceGeo, sliceMat);
      const sliceGroup = new THREE.Group();
      sliceGroup.add(mesh);
      this.pieRoot.add(sliceGroup);

      slices[sp.key] = {
        group: sliceGroup,
        midAngle: mid,
        mesh,
        mat: sliceMat,
      };
    }

    this.pieSlices = slices as ThreeShortEngine['pieSlices'];

    // Glowing 3D Loop / Mirror Arrow around the 19% "Owed to Itself" slice (Shot 8)
    this.loopArrowGroup = new THREE.Group();
    const loopMat = new THREE.MeshStandardMaterial({
      color: 0x3ce0ff,
      emissive: 0x3ce0ff,
      emissiveIntensity: 1.8,
      toneMapped: false,
    });
    for (let k = 0; k < 2; k++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.11, 14, 48, Math.PI * 0.8), loopMat);
      arc.rotation.z = k * Math.PI;
      this.loopArrowGroup.add(arc);

      const headAngle = k * Math.PI + Math.PI * 0.8;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 16), loopMat);
      cone.position.set(Math.cos(headAngle) * 2.15, Math.sin(headAngle) * 2.15, 0);
      cone.rotation.z = headAngle;
      this.loopArrowGroup.add(cone);
    }
    this.loopArrowGroup.rotation.x = Math.PI * 0.35;
    this.loopArrowGroup.visible = false;
    group.add(this.loopArrowGroup);

    // Three 3D Icons that fly in & bounce-land onto the Green Americans Slice (Shot 20)
    // 1. Bank Building Icon
    this.iconBankGroup = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xdde5f0, roughness: 0.35, metalness: 0.2 });
    const goldAccent = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.85, roughness: 0.25 });
    const bankBase = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 1.3), stoneMat);
    bankBase.position.y = 0.12;
    this.iconBankGroup.add(bankBase);
    for (let c = -1; c <= 1; c++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.0, 14), stoneMat);
      col.position.set(c * 0.52, 0.72, 0.4);
      this.iconBankGroup.add(col);
      const colB = col.clone();
      colB.position.z = -0.4;
      this.iconBankGroup.add(colB);
    }
    const bankCore = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 0.7), new THREE.MeshStandardMaterial({
      color: 0x1d2c40,
      roughness: 0.4,
      metalness: 0.5,
    }));
    bankCore.position.y = 0.72;
    this.iconBankGroup.add(bankCore);
    const bankRoof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.6, 4), goldAccent);
    bankRoof.rotation.y = Math.PI / 4;
    bankRoof.position.y = 1.5;
    this.iconBankGroup.add(bankRoof);
    this.iconBankGroup.visible = false;
    group.add(this.iconBankGroup);

    // 2. Pension Fund Safe Icon
    this.iconPensionGroup = new THREE.Group();
    const safeMat = new THREE.MeshStandardMaterial({ color: 0x263449, metalness: 0.78, roughness: 0.3 });
    const safeBody = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.45, 1.2), safeMat);
    safeBody.position.y = 0.75;
    this.iconPensionGroup.add(safeBody);
    const safeDial = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 12, 24), goldAccent);
    safeDial.position.set(0, 0.8, 0.64);
    this.iconPensionGroup.add(safeDial);
    const safeSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), goldAccent);
    safeSpoke.position.set(0, 0.8, 0.66);
    this.iconPensionGroup.add(safeSpoke);
    const safeSpoke2 = safeSpoke.clone();
    safeSpoke2.rotation.z = Math.PI / 2;
    this.iconPensionGroup.add(safeSpoke2);
    this.iconPensionGroup.visible = false;
    group.add(this.iconPensionGroup);

    // 3. Mutual Fund Rising Chart Icon
    this.iconMutualGroup = new THREE.Group();
    const barHeights = [0.55, 0.95, 1.45];
    const barCols = [0x3ce0ff, 0x22e07a, 0xffd54a];
    for (let b = 0; b < 3; b++) {
      const bm = new THREE.MeshStandardMaterial({
        color: barCols[b],
        emissive: barCols[b],
        emissiveIntensity: 0.55,
        metalness: 0.4,
        roughness: 0.25,
      });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.38, barHeights[b], 0.38), bm);
      bar.position.set((b - 1) * 0.48, barHeights[b] / 2, 0);
      this.iconMutualGroup.add(bar);
    }
    const baseChart = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.14, 0.65), safeMat);
    baseChart.position.y = 0.07;
    this.iconMutualGroup.add(baseChart);
    this.iconMutualGroup.visible = false;
    group.add(this.iconMutualGroup);

    return group;
  }

  // ============================================================================
  // WORLD 3: SOCIAL SECURITY & MEDICARE VAULTS -> US GOVERNMENT BUILDING
  // ============================================================================
  private buildGovVaultsWorld(maxAniso: number): THREE.Group {
    const group = new THREE.Group();
    const rng = createRng(3002);

    const floorTex = createGridFloorTexture(maxAniso, '#5CF2D0', '#07131D');
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45, metalness: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.6;
    group.add(floor);

    const vaultSteel = new THREE.MeshStandardMaterial({ color: 0x233144, metalness: 0.8, roughness: 0.28 });
    const vaultGold = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.85, roughness: 0.22 });

    const buildLabeledVault = (label: string, accent: string, xPos: number) => {
      const vg = new THREE.Group();
      vg.position.set(xPos, -0.7, 2.2);

      const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.6, 2.6), vaultSteel);
      vg.add(box);

      const trim = new THREE.Mesh(new THREE.BoxGeometry(3.32, 0.18, 2.72), vaultGold);
      trim.position.y = 1.8;
      vg.add(trim);

      // Hinged front vault door
      const pivot = new THREE.Group();
      pivot.position.set(-1.3, 0, 1.32);
      const door = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.24, 28), vaultSteel);
      door.rotation.x = Math.PI / 2;
      door.position.x = 1.3;
      pivot.add(door);

      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 12, 24), vaultGold);
      wheel.position.set(1.3, 0, 0.16);
      pivot.add(wheel);
      vg.add(pivot);

      // Glowing gold vault interior
      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(0.95, 24),
        new THREE.MeshStandardMaterial({
          color: 0xffd54a,
          emissive: 0xffd54a,
          emissiveIntensity: 1.5,
          toneMapped: false,
        }),
      );
      glow.position.set(0, 0, 1.31);
      vg.add(glow);

      // Signboard above vault
      const signTex = createSignPanelTexture(maxAniso, label, 'TRUST FUND', accent);
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 1.5, 0.2),
        new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35 }),
      );
      sign.position.set(0, 2.85, 0.6);
      vg.add(sign);

      group.add(vg);
      return pivot;
    };

    this.ssDoorPivot = buildLabeledVault('SOCIAL SECURITY', '#3CE0FF', -3.6);
    this.medDoorPivot = buildLabeledVault('MEDICARE', '#22E07A', 3.6);

    // Generic Pillared "US GOVERNMENT" Building in background center
    const govGroup = new THREE.Group();
    govGroup.position.set(0, -2.6, -7.8);

    const marbleTex = createMarbleTexture(maxAniso);
    const marbleMat = new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.32, metalness: 0.2 });

    const steps = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.8, 5.2), marbleMat);
    steps.position.y = 0.4;
    govGroup.add(steps);

    const hallBody = new THREE.Mesh(new THREE.BoxGeometry(8.2, 5.2, 4.0), new THREE.MeshStandardMaterial({
      color: 0x1a2232,
      roughness: 0.45,
      metalness: 0.3,
    }));
    hallBody.position.set(0, 3.4, -0.3);
    govGroup.add(hallBody);

    for (let i = -3; i <= 3; i++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 5.2, 16), marbleMat);
      col.position.set(i * 1.15, 3.4, 2.0);
      govGroup.add(col);
    }

    const pediment = new THREE.Mesh(new THREE.ConeGeometry(6.6, 2.2, 4), marbleMat);
    pediment.rotation.y = Math.PI / 4;
    pediment.scale.set(1.05, 1, 0.65);
    pediment.position.set(0, 7.05, 0.2);
    govGroup.add(pediment);

    const govSignTex = createSignPanelTexture(maxAniso, 'US GOVERNMENT', 'TREASURY BONDS', '#FFD54A');
    const govSign = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 2.1, 0.25),
      new THREE.MeshStandardMaterial({ map: govSignTex, roughness: 0.35 }),
    );
    govSign.position.set(0, 5.1, 2.45);
    govGroup.add(govSign);

    group.add(govGroup);

    // Instanced golden coins streaming from both vaults into the US Government building
    const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      metalness: 0.88,
      roughness: 0.2,
      emissive: 0xffb800,
      emissiveIntensity: 0.65,
    });
    const streamCount = 96;
    this.govStreamData = [];
    for (let i = 0; i < streamCount; i++) {
      this.govStreamData.push({
        phase: rng.range(0, 1),
        speed: rng.range(0.55, 0.85),
        streamIdx: i % 2,
        wobble: rng.range(-0.4, 0.4),
      });
    }
    this.govStreamCoins = new THREE.InstancedMesh(coinGeo, coinMat, streamCount);
    group.add(this.govStreamCoins);

    return group;
  }

  // ============================================================================
  // WORLD 4: MARBLE HALL + FEDERAL RESERVE VAULT + LIFTED GOLD SLICE
  // ============================================================================
  private buildFedHallWorld(maxAniso: number): THREE.Group {
    const group = new THREE.Group();
    const marbleTex = createMarbleTexture(maxAniso);
    const marbleMat = new THREE.MeshStandardMaterial({
      map: marbleTex,
      roughness: 0.26,
      metalness: 0.24,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      metalness: 0.88,
      roughness: 0.2,
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 100), marbleMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    group.add(floor);

    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(36, 22, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x161b28, roughness: 0.55, metalness: 0.2 }),
    );
    wall.position.set(0, 7.5, -13);
    group.add(wall);

    // Tall fluted classical columns lining both sides
    for (let z = 6; z >= -10; z -= 4) {
      for (const side of [-1, 1]) {
        const colGroup = new THREE.Group();
        colGroup.position.set(side * 5.2, -2.4, z);
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 1.7), marbleMat);
        plinth.position.y = 0.35;
        colGroup.add(plinth);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.65, 13.5, 20), marbleMat);
        shaft.position.y = 7.2;
        colGroup.add(shaft);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.65, 1.75), goldMat);
        cap.position.y = 14.1;
        colGroup.add(cap);
        group.add(colGroup);
      }
    }

    // Giant Generic Round Vault Frame & Door
    const vaultFrame = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.45, 20, 48), goldMat);
    vaultFrame.position.set(0, 1.6, -12.0);
    group.add(vaultFrame);

    const vaultGlowBack = new THREE.Mesh(
      new THREE.CircleGeometry(3.15, 40),
      new THREE.MeshStandardMaterial({
        color: 0xffd54a,
        emissive: 0xffc83d,
        emissiveIntensity: 1.4,
        toneMapped: false,
      }),
    );
    vaultGlowBack.position.set(0, 1.6, -12.2);
    group.add(vaultGlowBack);

    this.fedVaultPivot = new THREE.Group();
    this.fedVaultPivot.position.set(-3.4, 1.6, -11.9);
    const doorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(3.25, 3.25, 0.55, 40),
      new THREE.MeshStandardMaterial({ color: 0x262e40, metalness: 0.85, roughness: 0.25 }),
    );
    doorMesh.rotation.x = Math.PI / 2;
    doorMesh.position.x = 3.4;
    this.fedVaultPivot.add(doorMesh);

    this.fedVaultWheel = new THREE.Group();
    this.fedVaultWheel.position.set(3.4, 0, 0.42);
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.14, 14, 36), goldMat);
    this.fedVaultWheel.add(wheelRim);
    for (let s = 0; s < 6; s++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 10), goldMat);
      spoke.rotation.z = (s * Math.PI) / 3;
      this.fedVaultWheel.add(spoke);
    }
    this.fedVaultPivot.add(this.fedVaultWheel);
    group.add(this.fedVaultPivot);

    // Second Pie Slice (Gold, 11% Federal Reserve) lifted dramatically in center!
    this.fedGoldSlice = new THREE.Group();
    const goldSliceGeo = createExtrudedDonutSlice(1.1, 3.0, -0.35, 0.35, 0.95);
    const goldSliceMesh = new THREE.Mesh(
      goldSliceGeo,
      new THREE.MeshStandardMaterial({
        color: 0xffd54a,
        metalness: 0.82,
        roughness: 0.2,
        emissive: 0xffae00,
        emissiveIntensity: 0.48,
      }),
    );
    goldSliceMesh.position.x = -1.65;
    this.fedGoldSlice.add(goldSliceMesh);
    this.fedGoldSlice.position.set(0, 0.7, -2.5);
    group.add(this.fedGoldSlice);

    this.fedInteriorLight = new THREE.PointLight(0xffd54a, 2.2, 32);
    this.fedInteriorLight.position.set(0, 2.0, -9.5);
    group.add(this.fedInteriorLight);

    return group;
  }

  // ============================================================================
  // WORLD 5: SPINNING 3D EARTH GLOBE IN SPACE + JAPAN / UK / CHINA BARS
  // ============================================================================
  private buildGlobeWorld(maxAniso: number): THREE.Group {
    const group = new THREE.Group();

    const earthTex = createEarthGlobeTexture(maxAniso);
    const R = 3.2;

    this.globeGroup = new THREE.Group();
    this.globeGroup.position.set(0, -0.3, 0);
    group.add(this.globeGroup);

    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(R, 64, 48),
      new THREE.MeshStandardMaterial({
        map: earthTex,
        emissiveMap: earthTex,
        emissive: new THREE.Color(0x88d8ff),
        emissiveIntensity: 0.32,
        roughness: 0.45,
        metalness: 0.22,
      }),
    );
    this.globeGroup.add(earthMesh);

    // Subtle atmospheric outer halo shell
    const atmos = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.045, 48, 36),
      new THREE.MeshBasicMaterial({
        color: 0x3ce0ff,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
      }),
    );
    this.globeGroup.add(atmos);

    // Equatorial orbital ring
    this.globeRing = new THREE.Mesh(
      new THREE.TorusGeometry(R * 1.38, 0.035, 10, 96),
      new THREE.MeshStandardMaterial({
        color: 0x3ce0ff,
        emissive: 0x3ce0ff,
        emissiveIntensity: 1.6,
        toneMapped: false,
      }),
    );
    this.globeRing.rotation.x = Math.PI * 0.43;
    this.globeRing.position.set(0, -0.3, 0);
    group.add(this.globeRing);

    const makeCountryBar = (lat: number, lon: number, colorHex: number, radiusBase: number) => {
      const pos = latLonToVec3(lat, lon, R);
      const normal = pos.clone().normalize();
      const pivot = new THREE.Group();
      pivot.position.copy(pos);
      pivot.quaternion.setFromUnitVectors(_up, normal);

      // Glowing pin ring on globe surface
      const pin = new THREE.Mesh(
        new THREE.TorusGeometry(radiusBase * 1.8, 0.04, 10, 24),
        new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 1.75,
          toneMapped: false,
        }),
      );
      pin.rotation.x = Math.PI / 2;
      pin.position.y = 0.03;
      pivot.add(pin);

      // Rising unit-height bar (anchored at base y=0 via translated geometry)
      const barGeo = new THREE.CylinderGeometry(radiusBase * 0.85, radiusBase, 1.0, 20);
      barGeo.translate(0, 0.5, 0);
      const barMesh = new THREE.Mesh(
        barGeo,
        new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 1.45,
          roughness: 0.2,
          metalness: 0.35,
          toneMapped: false,
        }),
      );
      pivot.add(barMesh);

      this.globeGroup.add(pivot);
      return { pivot, barMesh };
    };

    // Accurate coordinates: Japan (36°N, 138°E), UK (54°N, -2°W), China (35°N, 104°E)
    const jp = makeCountryBar(36, 138, 0xffd54a, 0.16);
    this.japanBarPivot = jp.pivot;
    this.japanBarMesh = jp.barMesh;

    const uk = makeCountryBar(54, -2, 0x22e07a, 0.16);
    this.ukBarPivot = uk.pivot;
    this.ukBarMesh = uk.barMesh;

    const cn = makeCountryBar(35, 104, 0xff3b5c, 0.15);
    this.chinaBarPivot = cn.pivot;
    this.chinaBarMesh = cn.barMesh;

    return group;
  }

  // ============================================================================
  // WORLD 6: SUBURBAN STREET OF HOUSES + GLOWING YOUR 401(k) JAR
  // ============================================================================
  private buildSuburbWorld(maxAniso: number): THREE.Group {
    const group = new THREE.Group();
    const rng = createRng(6002);

    // Suburban grass ground + glowing night road
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({ color: 0x0d1e1c, roughness: 0.85, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.2;
    group.add(ground);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 140),
      new THREE.MeshStandardMaterial({ color: 0x161b26, roughness: 0.7, metalness: 0.1 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -2.17, -22);
    group.add(road);

    // Dashed road centerline
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      emissive: 0xffd54a,
      emissiveIntensity: 1.2,
    });
    for (let z = 12; z >= -64; z -= 4.2) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 1.8), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, -2.15, z);
      group.add(dash);
    }

    // Suburban Street of Instanced Houses (2 rows x 10 houses = 20 cozy glowing homes)
    this.suburbStreetGroup = new THREE.Group();
    group.add(this.suburbStreetGroup);

    const houseBodyGeo = new THREE.BoxGeometry(2.8, 2.0, 2.5);
    const houseBodyMat = new THREE.MeshStandardMaterial({ color: 0x263448, roughness: 0.55, metalness: 0.15 });
    const houseRoofGeo = new THREE.ConeGeometry(2.35, 1.45, 4);
    const houseRoofMat = new THREE.MeshStandardMaterial({ color: 0x1a2434, roughness: 0.5, metalness: 0.25 });
    const winGeo = new THREE.PlaneGeometry(0.58, 0.58);
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xffe49c,
      emissive: 0xffcb5c,
      emissiveIntensity: 1.35,
      toneMapped: false,
    });

    this.suburbHousePositions = [];
    for (let row = 0; row < 10; row++) {
      for (const side of [-1, 1]) {
        this.suburbHousePositions.push({
          x: side * 5.2,
          z: 8 - row * 5.8,
          side,
        });
      }
    }

    const count = this.suburbHousePositions.length;
    const bodies = new THREE.InstancedMesh(houseBodyGeo, houseBodyMat, count);
    const roofs = new THREE.InstancedMesh(houseRoofGeo, houseRoofMat, count);
    const windows = new THREE.InstancedMesh(winGeo, winMat, count * 2);

    this.suburbHousePositions.forEach((h, i) => {
      _dummy.position.set(h.x, -1.2, h.z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      bodies.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(h.x, 0.5, h.z);
      _dummy.rotation.set(0, Math.PI / 4, 0);
      _dummy.updateMatrix();
      roofs.setMatrixAt(i, _dummy.matrix);

      // Two warm glowing windows facing the road
      for (let w = 0; w < 2; w++) {
        _dummy.position.set(h.x - h.side * 1.42, -1.05, h.z + (w === 0 ? -0.58 : 0.58));
        _dummy.rotation.set(0, h.side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        windows.setMatrixAt(i * 2 + w, _dummy.matrix);
      }
    });
    bodies.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    windows.instanceMatrix.needsUpdate = true;
    this.suburbStreetGroup.add(bodies, roofs, windows);

    // Instanced golden coins arcing down from the sky into every house
    const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      metalness: 0.88,
      roughness: 0.2,
      emissive: 0xffb800,
      emissiveIntensity: 0.7,
    });
    const arcCount = 80;
    this.suburbCoinArcs = [];
    for (let i = 0; i < arcCount; i++) {
      this.suburbCoinArcs.push({
        targetIdx: i % count,
        phase: rng.range(0, 1),
        speed: rng.range(0.55, 0.9),
        arcH: rng.range(4.5, 8.5),
      });
    }
    this.suburbCoinsInst = new THREE.InstancedMesh(coinGeo, coinMat, arcCount);
    this.suburbStreetGroup.add(this.suburbCoinsInst);

    // Hero Glowing Retirement Jar labeled "YOUR 401(k)" (Shot 22)
    this.jar401kGroup = new THREE.Group();
    this.jar401kGroup.position.set(0, -1.6, 5.5);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.9, 0.55, 36),
      new THREE.MeshStandardMaterial({ color: 0x162233, metalness: 0.7, roughness: 0.3 }),
    );
    pedestal.position.y = -0.35;
    this.jar401kGroup.add(pedestal);

    const pedRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.65, 0.06, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x22e07a,
        emissive: 0x22e07a,
        emissiveIntensity: 1.7,
        toneMapped: false,
      }),
    );
    pedRing.rotation.x = Math.PI / 2;
    pedRing.position.y = -0.05;
    this.jar401kGroup.add(pedRing);

    // Translucent glass jar body
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x8ef5c8,
      roughness: 0.14,
      metalness: 0.05,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
    });
    const jarBody = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.82, 3.6, 36), glassMat);
    jarBody.position.y = 1.85;
    this.jar401kGroup.add(jarBody);

    // Gold screw lid with coin slot
    const lidMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.88, roughness: 0.22 });
    const jarLid = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.56, 0.55, 32), lidMat);
    jarLid.position.y = 3.85;
    this.jar401kGroup.add(jarLid);

    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.12, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x05070b }),
    );
    slot.position.y = 4.13;
    this.jar401kGroup.add(slot);

    // Front label badge curved slightly / flat crisp plaque "YOUR 401(k)"
    const jarTex = createJar401kTexture(maxAniso);
    const labelPlaque = new THREE.Mesh(
      new THREE.BoxGeometry(2.65, 1.75, 0.14),
      new THREE.MeshStandardMaterial({ map: jarTex, roughness: 0.3 }),
    );
    labelPlaque.position.set(0, 1.9, 1.85);
    this.jar401kGroup.add(labelPlaque);

    // Coins filling inside the 401(k) jar
    this.jarInnerCoins = [];
    for (let c = 0; c < 64; c++) {
      const layer = Math.floor(c / 8);
      const ang = (c % 8) * (Math.PI / 4) + layer * 0.4;
      const rad = rng.range(0.15, 1.2);
      this.jarInnerCoins.push({
        x: Math.cos(ang) * rad,
        y: 0.22 + layer * 0.28,
        z: Math.sin(ang) * rad,
        delay: c / 64,
      });
    }
    this.jarCoinsInst = new THREE.InstancedMesh(coinGeo, coinMat, this.jarInnerCoins.length);
    this.jar401kGroup.add(this.jarCoinsInst);

    this.jar401kGroup.visible = false;
    group.add(this.jar401kGroup);

    return group;
  }

  // ============================================================================
  // WORLD 7: GIANT "INTEREST" TAP POURING COIN RIVER BACK INTO HOUSES
  // ============================================================================
  private buildInterestTapWorld(maxAniso: number): THREE.Group {
    const group = new THREE.Group();
    const rng = createRng(7002);

    const floorTex = createGridFloorTexture(maxAniso, '#FFD54A', '#09111C');
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 150),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45, metalness: 0.3 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.0;
    group.add(floor);

    // Giant Stylized Chrome & Gold Tap / Faucet labeled "INTEREST"
    const tapGroup = new THREE.Group();
    tapGroup.position.set(0, 3.2, -3.5);
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xb8c7db, metalness: 0.88, roughness: 0.22 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.88, roughness: 0.2 });

    // Horizontal intake pipe from back
    const pipeBack = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 6.0, 28), chromeMat);
    pipeBack.rotation.x = Math.PI / 2;
    pipeBack.position.set(0, 0, -3.0);
    tapGroup.add(pipeBack);

    // Valve body collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.5, 28), goldMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0, 0);
    tapGroup.add(collar);

    // Spout curving downward
    const spoutCurve = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.72, 20, 32, Math.PI * 0.5), chromeMat);
    spoutCurve.rotation.y = Math.PI / 2;
    spoutCurve.position.set(0, -1.5, 0.4);
    tapGroup.add(spoutCurve);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.96, 0.55, 28), goldMat);
    nozzle.position.set(0, -1.65, 1.9);
    tapGroup.add(nozzle);

    // Turning Valve Wheel Handle on top
    this.tapHandleGroup = new THREE.Group();
    this.tapHandleGroup.position.set(0, 1.9, 0);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.2, 16), chromeMat);
    stem.position.y = -0.5;
    this.tapHandleGroup.add(stem);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.16, 14, 32), new THREE.MeshStandardMaterial({
      color: 0x22e07a,
      metalness: 0.5,
      roughness: 0.25,
      emissive: 0x16a358,
      emissiveIntensity: 0.4,
    }));
    wheel.rotation.x = Math.PI / 2;
    this.tapHandleGroup.add(wheel);
    for (let s = 0; s < 4; s++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 10), goldMat);
      sp.rotation.z = Math.PI / 2;
      sp.rotation.y = (s * Math.PI) / 4;
      this.tapHandleGroup.add(sp);
    }
    tapGroup.add(this.tapHandleGroup);

    // Bold "INTEREST" Sign mounted on front of tap valve
    const tapSignTex = createSignPanelTexture(maxAniso, 'INTEREST', '$1T+ EVERY YEAR', '#FFD54A');
    const tapSign = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 1.5, 0.22),
      new THREE.MeshStandardMaterial({ map: tapSignTex, roughness: 0.3 }),
    );
    tapSign.position.set(0, 0.15, 2.75);
    tapGroup.add(tapSign);

    group.add(tapGroup);

    // Glowing Coin River Channel flowing forward toward American suburban houses
    const riverBed = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 26),
      new THREE.MeshStandardMaterial({
        color: 0xffd54a,
        emissive: 0xffae00,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        metalness: 0.5,
      }),
    );
    riverBed.rotation.x = -Math.PI / 2;
    riverBed.position.set(0, -2.96, 8.5);
    group.add(riverBed);

    // Row of suburban houses flanking the downstream coin river (visible in Shot 24!)
    const hBodyGeo = new THREE.BoxGeometry(2.4, 1.9, 2.2);
    const hRoofGeo = new THREE.ConeGeometry(2.0, 1.3, 4);
    const hBodyMat = new THREE.MeshStandardMaterial({ color: 0x26384d, roughness: 0.5 });
    const hRoofMat = new THREE.MeshStandardMaterial({ color: 0x1a2636, roughness: 0.45 });
    const hWinMat = new THREE.MeshStandardMaterial({
      color: 0xffe49c,
      emissive: 0xffcb5c,
      emissiveIntensity: 1.35,
      toneMapped: false,
    });
    for (let i = 0; i < 6; i++) {
      for (const side of [-1, 1]) {
        const hg = new THREE.Group();
        hg.position.set(side * 4.4, -2.05, 1.5 + i * 3.8);
        const body = new THREE.Mesh(hBodyGeo, hBodyMat);
        hg.add(body);
        const roof = new THREE.Mesh(hRoofGeo, hRoofMat);
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 1.6;
        hg.add(roof);
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.65), hWinMat);
        win.position.set(-side * 1.22, 0.1, 0);
        win.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        hg.add(win);
        group.add(hg);
      }
    }

    // 180 instanced cascading gold coins pouring out of nozzle and flowing down the river
    const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.09, 16);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      metalness: 0.88,
      roughness: 0.18,
      emissive: 0xffb800,
      emissiveIntensity: 0.5,
    });
    const riverCount = 180;
    this.tapRiverData = [];
    for (let i = 0; i < riverCount; i++) {
      this.tapRiverData.push({
        phase: rng.range(0, 1),
        speed: rng.range(0.42, 0.62),
        laneX: rng.range(-1.55, 1.55),
        spin: rng.range(2, 6),
        bob: rng.range(0, Math.PI * 2),
      });
    }
    this.tapRiverCoinsInst = new THREE.InstancedMesh(coinGeo, coinMat, riverCount);
    group.add(this.tapRiverCoinsInst);

    return group;
  }

  // ============================================================================
  // WORLD 8: FINALE COLLECTOR CARD (#2 -> #3) & SWIRLING COIN STORM
  // ============================================================================
  private buildFinaleWorld(maxAniso: number): THREE.Group {
    const group = new THREE.Group();
    const rng = createRng(8002);

    const floorTex = createGridFloorTexture(maxAniso, '#3CE0FF', '#080E1A');
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45, metalness: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.4;
    group.add(floor);

    this.finaleCardGroup = new THREE.Group();
    this.finaleCardGroup.position.set(0, 1.0, 0);

    const frontTex = createCollectorCardTexture(maxAniso, 'front');
    const backTex = createCollectorCardTexture(maxAniso, 'back');

    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      metalness: 0.9,
      roughness: 0.2,
    });
    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.3,
      metalness: 0.2,
    });
    const backMat = new THREE.MeshStandardMaterial({
      map: backTex,
      roughness: 0.3,
      metalness: 0.2,
    });

    const card = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.55, 0.16), [
      edgeMat,
      edgeMat,
      edgeMat,
      edgeMat,
      frontMat,
      backMat,
    ]);
    this.finaleCardGroup.add(card);

    // Restrained glowing halo ring around card
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(2.95, 0.055, 12, 64),
      new THREE.MeshStandardMaterial({
        color: 0xffd54a,
        emissive: 0xffd54a,
        emissiveIntensity: 1.65,
        toneMapped: false,
      }),
    );
    this.finaleCardGroup.add(halo);
    group.add(this.finaleCardGroup);

    // Swirling Coin Storm (120 orbiting gold coins)
    const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.09, 16);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      metalness: 0.88,
      roughness: 0.2,
      emissive: 0x7a5000,
      emissiveIntensity: 0.25,
    });
    const stormCount = 120;
    this.finaleCoinOrbits = [];
    for (let i = 0; i < stormCount; i++) {
      this.finaleCoinOrbits.push({
        r: rng.range(3.6, 10.5),
        y: rng.range(-2.6, 6.2),
        angle: rng.range(0, Math.PI * 2),
        speed: rng.range(0.45, 1.35) * (i % 2 === 0 ? 1 : -1),
        tilt: rng.range(0, Math.PI),
      });
    }
    this.finaleCoinsInst = new THREE.InstancedMesh(coinGeo, coinMat, stormCount);
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

    // Switch visible world
    (Object.keys(this.worlds) as WorldId[]).forEach((wid) => {
      this.worlds[wid].visible = wid === shot.world;
    });

    // Apply world palette & calibrated bloom
    const pal = WORLD_PALETTES[shot.world as WorldId] ?? WORLD_PALETTES.skyline;
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

    // Gentle deterministic star/dust drift
    this.dustPoints.rotation.y = t * 0.025;
    this.dustPoints.position.y = Math.sin(t * 0.35) * 0.4;

    // Default camera FOV with mandatory 8% tighter 0.25s punch-in on every shot cut
    let baseFov = 46;
    let camX = 0;
    let camY = 2.0;
    let camZ = 12.0;
    _camLook.set(0, 1.0, 0);

    // Animate active world & camera per shot
    switch (shot.world) {
      case 'skyline': {
        this.animateSkyline(shot.id, t, shotElapsed, u);
        if (shot.id === 1) {
          // Boom shake on frame 0 + flying toward giant $40T counter
          const boomShake = Math.exp(-t * 9.5) * 0.35;
          camX = Math.sin(t * 52) * boomShake;
          camY = lerp(1.6, 2.5, u) + Math.cos(t * 44) * boomShake;
          camZ = lerp(14.5, 9.6, u);
          _camLook.set(0, 2.4, -2.5);
        } else if (shot.id === 2) {
          // Push into splitting counter revealing gold coin stack
          camX = Math.sin(u * 1.1) * 1.4;
          camY = lerp(2.2, 0.8, u);
          camZ = lerp(10.5, 6.2, u);
          _camLook.set(0, -0.5, -3.2);
        } else if (shot.id === 3) {
          // Red alert sweep on NOT CHINA slam
          const slamShake = Math.exp(-shotElapsed * 11) * 0.28;
          camX = lerp(-1.8, 1.6, u) + Math.sin(shotElapsed * 65) * slamShake;
          camY = 1.4 + Math.cos(shotElapsed * 55) * slamShake;
          camZ = lerp(8.8, 7.6, u);
          _camLook.set(0, 0.2, -3.2);
        } else if (shot.id === 4) {
          // Dramatic zoom on 3D hand/arrow pointing straight at camera
          baseFov = 48;
          camX = Math.sin(u * 2.4) * 0.6;
          camY = lerp(0.8, 1.05, u);
          camZ = lerp(10.8, 8.0, u);
          _camLook.set(0, 0.9, 1.8);
        } else if (shot.id === 5) {
          // Jordan shocked in front, skyline bokeh behind
          camX = lerp(-1.5, 1.5, u);
          camY = 2.4;
          camZ = lerp(11.5, 9.8, u);
          _camLook.set(0, 1.0, -5.0);
        } else {
          // Shot 27 (51.60-54.07): Loop cleanly back to opening skyline & $40T counter!
          camX = lerp(1.2, 0, easeInOutCubic(u));
          camY = lerp(2.6, 1.6, easeInOutCubic(u));
          camZ = lerp(10.2, 14.5, easeInOutCubic(u));
          _camLook.set(0, 2.4, -2.5);
        }
        break;
      }

      case 'pieWorld': {
        this.animatePieWorld(shot.id, t, shotElapsed, u);
        if (shot.id === 6) {
          camX = Math.sin(u * 0.8) * 2.2;
          camY = lerp(7.8, 5.4, u);
          camZ = lerp(10.2, 8.6, u);
          _camLook.set(0, -0.2, 0);
        } else if (shot.id === 7) {
          camX = lerp(1.5, 3.2, u);
          camY = lerp(5.4, 4.6, u);
          camZ = lerp(8.6, 7.2, u);
          _camLook.set(0.8, 0.5, 0.5);
        } else if (shot.id === 8) {
          const ang = lerp(0.55, 1.25, u);
          camX = Math.cos(ang) * 7.6;
          camY = lerp(4.2, 3.6, u);
          camZ = Math.sin(ang) * 7.6;
          _camLook.set(0.7, 0.8, 0.4);
        } else if (shot.id === 18) {
          // Close-up on tiny 1.5% red China sliver!
          baseFov = 42;
          camX = lerp(-1.2, 0.6, u);
          camY = lerp(4.6, 3.6, u);
          camZ = lerp(7.4, 5.8, u);
          _camLook.set(0, 0.4, 0.8);
        } else if (shot.id === 19) {
          // Dramatic pull back as 45% green Americans slice glows & grows
          camX = lerp(-1.8, 1.8, u);
          camY = lerp(4.8, 6.0, u);
          camZ = lerp(8.2, 9.6, u);
          _camLook.set(0, 0.2, 0);
        } else {
          // Shot 20: Orbit gently watching Bank, Pension Safe, and Mutual Fund land
          camX = lerp(1.8, -1.6, u);
          camY = lerp(4.6, 3.9, u);
          camZ = lerp(8.8, 7.4, u);
          _camLook.set(0, 1.1, 0.6);
        }
        break;
      }

      case 'govVaults': {
        this.animateGovVaults(shot.id, t, shotElapsed, u);
        if (shot.id === 9) {
          camX = lerp(-1.2, 1.2, u);
          camY = lerp(1.8, 2.2, u);
          camZ = lerp(12.2, 10.6, u);
          _camLook.set(0, 1.0, -2.5);
        } else {
          camX = lerp(1.2, -0.8, u);
          camY = lerp(2.2, 2.8, u);
          camZ = lerp(10.6, 7.2, u);
          _camLook.set(0, 1.8, -6.8);
        }
        break;
      }

      case 'fedHall': {
        this.animateFedHall(shot.id, t, shotElapsed, u);
        if (shot.id === 11) {
          camX = lerp(-1.8, 1.4, u);
          camY = lerp(2.6, 1.8, u);
          camZ = lerp(10.8, 6.2, u);
          _camLook.set(0, 1.2, -4.5);
        } else {
          camX = lerp(1.4, -0.8, u);
          camY = lerp(1.8, 1.3, u);
          camZ = lerp(6.2, 4.2, u);
          _camLook.set(0, 0.9, -2.6);
        }
        break;
      }

      case 'globe': {
        this.animateGlobe(shot.id, t, shotElapsed, u);
        if (shot.id === 13) {
          camX = lerp(-1.6, 1.2, u);
          camY = lerp(1.6, 1.1, u);
          camZ = lerp(10.5, 8.8, u);
          _camLook.set(0, -0.2, 0);
        } else if (shot.id === 14) {
          // Push into Japan #1 bar
          camX = lerp(0.9, -0.5, u);
          camY = lerp(1.5, 2.0, u);
          camZ = lerp(8.4, 7.2, u);
          _camLook.set(0, 1.1, 1.8);
        } else if (shot.id === 15) {
          // Push into UK #2 bar
          camX = lerp(-0.8, 0.9, u);
          camY = lerp(2.1, 2.4, u);
          camZ = lerp(8.2, 7.2, u);
          _camLook.set(0, 1.6, 1.6);
        } else if (shot.id === 16) {
          // Fast whip-pan dramatic zoom on China!
          baseFov = 40;
          const shake = Math.exp(-shotElapsed * 9) * 0.25;
          camX = lerp(2.6, 0.2, easeOutCubic(u)) + Math.sin(shotElapsed * 70) * shake;
          camY = lerp(2.0, 1.6, u);
          camZ = lerp(9.0, 6.6, easeOutCubic(u));
          _camLook.set(0, 1.0, 1.8);
        } else {
          // Shot 17: Boom reveal of China's small $618B bar
          const boom = Math.exp(-shotElapsed * 10) * 0.28;
          camX = lerp(0.2, -0.9, u) + Math.sin(shotElapsed * 62) * boom;
          camY = lerp(1.6, 1.9, u) + Math.cos(shotElapsed * 55) * boom;
          camZ = lerp(6.8, 7.8, u);
          _camLook.set(0, 1.0, 1.8);
        }
        break;
      }

      case 'suburb': {
        this.animateSuburb(shot.id, t, shotElapsed, u);
        if (shot.id === 21) {
          // Fly down suburban street watching coins stream into houses
          camX = Math.sin(u * Math.PI) * 1.1;
          camY = lerp(5.2, 1.9, easeOutCubic(u));
          camZ = lerp(14.5, 2.5, u);
          _camLook.set(0, -0.2, -14.0);
        } else {
          // Shot 22: Hero orbit around glowing YOUR 401(k) jar
          const ang = lerp(-0.32, 0.32, u);
          camX = Math.sin(ang) * 7.8;
          camY = lerp(1.4, 2.1, u);
          camZ = 5.5 + Math.cos(ang) * 7.8;
          _camLook.set(0, 0.5, 5.5);
        }
        break;
      }

      case 'interestTap': {
        this.animateInterestTap(shot.id, t, shotElapsed, u);
        if (shot.id === 23) {
          // Push into giant INTEREST faucet pouring coin cascade
          camX = lerp(-1.5, 1.2, u);
          camY = lerp(2.6, 1.6, u);
          camZ = lerp(9.4, 6.8, u);
          _camLook.set(0, 1.2, -1.6);
        } else {
          // Shot 24: Pull back along glowing coin river flowing into houses
          camX = lerp(1.2, -1.2, u);
          camY = lerp(2.4, 3.8, u);
          camZ = lerp(12.5, 17.5, u);
          _camLook.set(0, -0.5, 2.5);
        }
        break;
      }

      case 'finale': {
        this.animateFinale(shot.id, t, shotElapsed, u);
        camX = Math.sin(t * 0.7) * 1.1;
        camY = lerp(1.4, 1.0, u);
        camZ = shot.id === 25 ? lerp(10.4, 8.8, u) : lerp(9.6, 8.2, u);
        _camLook.set(0, 0.9, 0);
        break;
      }
    }

    // Apply mandatory 8% tighter 0.25s FOV punch-in at the start of every shot
    this.camera.fov = punchInFov(baseFov, shotElapsed);
    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(_camLook);
    this.camera.updateProjectionMatrix();

    this.composer.render();
  }

  private animateSkyline(shotId: number, t: number, shotElapsed: number, u: number): void {
    // Counter roll-up in Shot 1 (0 -> 40T); steady 40T in loop Shot 27
    if (shotId === 1) {
      const trillions = lerp(0, 40, easeOutCubic(clamp(shotElapsed / 1.25, 0, 1)));
      this.debtCounterTex.update(trillions, false);
      this.counterGroup.visible = true;
      this.counterLeftHalf.position.set(-2.1, 0, 0);
      this.counterRightHalf.position.set(2.1, 0, 0);
      this.counterLeftHalf.rotation.y = 0;
      this.counterRightHalf.rotation.y = 0;
      this.counterGroup.position.y = 2.6 + Math.sin(t * 2.4) * 0.12;
      this.skylineCoinsInst.visible = false;
      this.pointerGroup.visible = false;
      this.skylineAlertLight.intensity = 0;
    } else if (shotId === 2) {
      // Counter splits open horizontally to reveal towering gold coin stacks!
      this.debtCounterTex.update(40, false);
      const split = easeOutCubic(clamp(shotElapsed / 0.75, 0, 1));
      this.counterGroup.visible = split < 0.98;
      this.counterLeftHalf.position.x = lerp(-2.1, -9.5, split);
      this.counterRightHalf.position.x = lerp(2.1, 9.5, split);
      this.counterLeftHalf.rotation.y = -split * 0.65;
      this.counterRightHalf.rotation.y = split * 0.65;

      this.skylineCoinsInst.visible = true;
      const coinGrow = easeOutBack(clamp(shotElapsed / 0.65, 0, 1), 1.15);
      for (let i = 0; i < this.skylineCoinPositions.length; i++) {
        const c = this.skylineCoinPositions[i];
        _dummy.position.set(c.x, lerp(-4.8, c.y, coinGrow), c.z);
        _dummy.rotation.set(0, c.rot + t * 0.35, 0);
        _dummy.scale.setScalar(clamp(coinGrow, 0.01, 1));
        _dummy.updateMatrix();
        this.skylineCoinsInst.setMatrixAt(i, _dummy.matrix);
      }
      this.skylineCoinsInst.instanceMatrix.needsUpdate = true;
      this.pointerGroup.visible = false;
      this.skylineAlertLight.intensity = 0;
    } else if (shotId === 3) {
      // Red alert lighting behind "NOT CHINA" stamp slam
      this.counterGroup.visible = false;
      this.skylineCoinsInst.visible = true;
      for (let i = 0; i < this.skylineCoinPositions.length; i++) {
        const c = this.skylineCoinPositions[i];
        _dummy.position.set(c.x, c.y, c.z);
        _dummy.rotation.set(0, c.rot + t * 0.25, 0);
        _dummy.scale.setScalar(1);
        _dummy.updateMatrix();
        this.skylineCoinsInst.setMatrixAt(i, _dummy.matrix);
      }
      this.skylineCoinsInst.instanceMatrix.needsUpdate = true;
      this.pointerGroup.visible = false;
      this.skylineAlertLight.intensity = 3.2 + Math.sin(t * 16) * 0.9;
    } else if (shotId === 4) {
      // Big 3D Hand / Arrow swings forward pointing directly at the camera!
      this.counterGroup.visible = false;
      this.skylineCoinsInst.visible = true;
      this.pointerGroup.visible = true;
      const pop = easeOutBack(clamp(shotElapsed / 0.38, 0, 1), 1.5);
      this.pointerGroup.scale.setScalar(pop);
      this.pointerGroup.position.set(0, 0.9 + Math.sin(t * 6) * 0.1, lerp(-1.5, 2.1, pop));
      this.pointerGroup.rotation.set(Math.sin(t * 4) * 0.06, Math.sin(u * Math.PI) * 0.14, 0);
      this.skylineAlertLight.intensity = 0.6;
    } else if (shotId === 5) {
      // Jordan shocked in front of dark skyline
      this.counterGroup.visible = false;
      this.skylineCoinsInst.visible = true;
      this.pointerGroup.visible = false;
      this.skylineAlertLight.intensity = 1.4;
    } else {
      // Shot 27: Return to opening $40T counter over night city for seamless loop!
      this.debtCounterTex.update(40, false);
      this.counterGroup.visible = true;
      const reassemble = easeOutCubic(clamp(shotElapsed / 0.6, 0, 1));
      this.counterLeftHalf.position.set(lerp(-6.5, -2.1, reassemble), 0, 0);
      this.counterRightHalf.position.set(lerp(6.5, 2.1, reassemble), 0, 0);
      this.counterLeftHalf.rotation.y = lerp(-0.4, 0, reassemble);
      this.counterRightHalf.rotation.y = lerp(0.4, 0, reassemble);
      this.counterGroup.position.y = 2.6 + Math.sin(t * 2.4) * 0.1;
      this.skylineCoinsInst.visible = false;
      this.pointerGroup.visible = false;
      this.skylineAlertLight.intensity = 0;
    }
  }

  private animatePieWorld(shotId: number, t: number, shotElapsed: number, u: number): void {
    // Reset all slices to neutral resting state
    const allSlices = Object.values(this.pieSlices);
    for (const s of allSlices) {
      s.group.position.set(0, 0, 0);
      s.group.scale.setScalar(1);
      s.mat.emissiveIntensity = 0.22;
    }
    this.loopArrowGroup.visible = false;
    this.iconBankGroup.visible = false;
    this.iconPensionGroup.visible = false;
    this.iconMutualGroup.visible = false;

    if (shotId === 6) {
      // Full rotating pie chart popping in smoothly
      const pop = easeOutBack(clamp(shotElapsed / 0.55, 0, 1), 1.25);
      this.pieRoot.scale.setScalar(pop);
      this.pieRoot.rotation.y = t * 0.45;
    } else if (shotId === 7 || shotId === 8) {
      // 19% Intragovernmental Blue Slice lifts out and glows!
      this.pieRoot.scale.setScalar(1);
      // Orient slice 0 toward front-right camera
      const targetRot = -this.pieSlices.intragov.midAngle + Math.PI * 0.42;
      this.pieRoot.rotation.y = targetRot + Math.sin(t * 0.5) * 0.12;

      const lift = shotId === 7 ? easeOutBack(clamp(shotElapsed / 0.55, 0, 1), 1.3) : 1.0;
      const sl = this.pieSlices.intragov;
      const pushR = 0.85 * lift;
      sl.group.position.set(Math.cos(sl.midAngle) * pushR, 1.15 * lift, -Math.sin(sl.midAngle) * pushR);
      sl.mat.emissiveIntensity = lerp(0.22, 1.3, lift);

      if (shotId === 8) {
        this.loopArrowGroup.visible = true;
        this.loopArrowGroup.position.set(0.75, 1.25, 0.45);
        this.loopArrowGroup.rotation.y = t * 2.4;
        const apop = easeOutBack(clamp(shotElapsed / 0.35, 0, 1), 1.4);
        this.loopArrowGroup.scale.setScalar(apop);
      }
    } else if (shotId === 18) {
      // Tiny 1.5% red China sliver pulls forward!
      this.pieRoot.scale.setScalar(1);
      const targetRot = -this.pieSlices.china.midAngle + Math.PI * 0.5;
      this.pieRoot.rotation.y = targetRot + Math.sin(u * Math.PI) * 0.14;

      const lift = easeOutBack(clamp(shotElapsed / 0.45, 0, 1), 1.4);
      const sl = this.pieSlices.china;
      const pushR = 1.45 * lift;
      sl.group.position.set(Math.cos(sl.midAngle) * pushR, 1.1 * lift, -Math.sin(sl.midAngle) * pushR);
      sl.group.scale.set(1, 1 + 0.5 * lift, 1);
      sl.mat.emissiveIntensity = 1.65;
    } else if (shotId === 19 || shotId === 20) {
      // Biggest ~45% Green Americans slice glows & grows dramatically!
      this.pieRoot.scale.setScalar(1);
      const targetRot = -this.pieSlices.americans.midAngle + Math.PI * 0.5;
      this.pieRoot.rotation.y = targetRot + Math.sin(t * 0.45) * 0.12;

      const grow = shotId === 19 ? easeOutBack(clamp(shotElapsed / 0.6, 0, 1), 1.3) : 1.0;
      const sl = this.pieSlices.americans;
      const pushR = 0.65 * grow;
      sl.group.position.set(Math.cos(sl.midAngle) * pushR, 0.75 * grow, -Math.sin(sl.midAngle) * pushR);
      sl.group.scale.set(1 + 0.14 * grow, 1 + 0.45 * grow, 1 + 0.14 * grow);
      sl.mat.emissiveIntensity = lerp(0.22, 1.1, grow);

      if (shotId === 20) {
        // 3D Bank, Pension Safe, and Mutual Fund icons fly in & bounce-land on the green slice!
        const icons = [
          { g: this.iconBankGroup, delay: 0.0, tx: -1.85, tz: 1.55 },
          { g: this.iconPensionGroup, delay: 0.35, tx: 0.0, tz: 2.35 },
          { g: this.iconMutualGroup, delay: 0.7, tx: 1.85, tz: 1.55 },
        ];
        for (const ic of icons) {
          const p = clamp((shotElapsed - ic.delay) / 0.65, 0, 1);
          ic.g.visible = p > 0;
          const b = easeOutBounce(p);
          ic.g.position.set(ic.tx, lerp(9.5, 1.75, b), ic.tz);
          ic.g.rotation.y = Math.sin(t * 2.0 + ic.delay * 4) * 0.25;
          ic.g.scale.setScalar(lerp(0.4, 0.92, clamp(p * 2.2, 0, 1)));
        }
      }
    }
  }

  private animateGovVaults(shotId: number, t: number, shotElapsed: number, _u: number): void {
    const openAngle =
      shotId === 9
        ? easeOutCubic(clamp(shotElapsed / 0.65, 0, 1)) * 1.45
        : 1.45;
    this.ssDoorPivot.rotation.y = -openAngle;
    this.medDoorPivot.rotation.y = openAngle;

    // Stream golden coins along parabolic arcs from Social Security (-3.6) and Medicare (+3.6) to US Gov (0, 2, -6.5)
    for (let i = 0; i < this.govStreamData.length; i++) {
      const c = this.govStreamData[i];
      const prog = (t * c.speed + c.phase) % 1;
      const sx = c.streamIdx === 0 ? -3.6 : 3.6;
      const x = lerp(sx, c.wobble * 1.6, prog);
      const z = lerp(3.4, -5.8, prog);
      const y = lerp(-0.5, 1.8, prog) + Math.sin(prog * Math.PI) * 2.8;

      _dummy.position.set(x, y, z);
      _dummy.rotation.set(prog * 8, prog * 5, Math.PI / 2);
      _dummy.scale.setScalar(Math.sin(prog * Math.PI) * 0.55 + 0.55);
      _dummy.updateMatrix();
      this.govStreamCoins.setMatrixAt(i, _dummy.matrix);
    }
    this.govStreamCoins.instanceMatrix.needsUpdate = true;
  }

  private animateFedHall(shotId: number, t: number, shotElapsed: number, _u: number): void {
    const doorProg =
      shotId === 11
        ? easeInOutCubic(clamp((shotElapsed - 0.15) / 1.35, 0, 1))
        : 1.0;

    this.fedVaultWheel.rotation.z = doorProg * Math.PI * 2.2;
    this.fedVaultPivot.rotation.y = -doorProg * 1.45;
    this.fedInteriorLight.intensity = 1.4 + doorProg * 2.4;

    // Gold slice lifts and rotates smoothly in center of hall
    const lift = shotId === 11 ? easeOutBack(clamp((shotElapsed - 0.3) / 0.85, 0, 1), 1.3) : 1.0;
    this.fedGoldSlice.position.y = lerp(-1.5, 0.75, lift) + Math.sin(t * 2.5) * 0.12;
    this.fedGoldSlice.rotation.y = t * 0.75;
    this.fedGoldSlice.scale.setScalar(shotId === 12 ? 1.15 : lerp(0.5, 1.0, lift));
  }

  private animateGlobe(shotId: number, t: number, shotElapsed: number, u: number): void {
    // Target Y rotations so each country faces +Z directly toward camera:
    // rotY = -(lonDeg + 90) * Math.PI / 180
    const rotJapan = (-(138 + 90) * Math.PI) / 180; // -3.979 rad
    const rotUK = (-(-2 + 90) * Math.PI) / 180; // -1.536 rad
    const rotChina = (-(104 + 90) * Math.PI) / 180; // -3.386 rad

    this.globeRing.rotation.z = t * 0.35;

    let jpH = 0.001;
    let ukH = 0.001;
    let cnH = 0.001;

    if (shotId === 13) {
      // Smooth continuous spin showing world continents
      this.globeGroup.rotation.y = lerp(rotJapan - 1.35, rotJapan - 0.25, u);
      this.globeGroup.rotation.x = 0.28;
    } else if (shotId === 14) {
      // Lock onto Japan (#1: $1.1T) — tall glowing gold bar rises!
      this.globeGroup.rotation.y = lerp(rotJapan - 0.25, rotJapan + 0.08, easeOutCubic(u));
      this.globeGroup.rotation.x = 0.36;
      jpH = easeOutBack(clamp(shotElapsed / 0.55, 0, 1), 1.25) * 2.45;
    } else if (shotId === 15) {
      // Rotate smoothly from Japan to UK (#2: $1.0T) — tall green bar rises!
      this.globeGroup.rotation.y = lerp(rotJapan + 0.08, rotUK + 0.06, easeInOutCubic(clamp(u / 0.6, 0, 1)));
      this.globeGroup.rotation.x = lerp(0.36, 0.52, easeInOutCubic(clamp(u / 0.6, 0, 1)));
      jpH = 2.45;
      ukH = easeOutBack(clamp((shotElapsed - 0.32) / 0.55, 0, 1), 1.25) * 2.22;
    } else if (shotId === 16) {
      // Fast whip-pan back to China ("And China?!")
      this.globeGroup.rotation.y = lerp(rotUK + 0.06, rotChina, easeOutCubic(clamp(u / 0.55, 0, 1)));
      this.globeGroup.rotation.x = lerp(0.52, 0.35, easeOutCubic(u));
      jpH = 2.45;
      ukH = 2.22;
      cnH = 0.15;
    } else {
      // Shot 17: Small alert-red bar rises from China ($618B — noticeably shorter than Japan/UK!)
      this.globeGroup.rotation.y = rotChina + Math.sin(u * Math.PI) * 0.12;
      this.globeGroup.rotation.x = 0.35;
      jpH = 2.45;
      ukH = 2.22;
      cnH = easeOutBack(clamp(shotElapsed / 0.45, 0, 1), 1.35) * 1.18;
    }

    this.japanBarMesh.scale.set(1, Math.max(0.001, jpH), 1);
    this.japanBarPivot.visible = jpH > 0.01;

    this.ukBarMesh.scale.set(1, Math.max(0.001, ukH), 1);
    this.ukBarPivot.visible = ukH > 0.01;

    this.chinaBarMesh.scale.set(1, Math.max(0.001, cnH), 1);
    this.chinaBarPivot.visible = cnH > 0.01;
  }

  private animateSuburb(shotId: number, t: number, shotElapsed: number, _u: number): void {
    const showJar = shotId === 22;
    this.jar401kGroup.visible = showJar;
    this.suburbStreetGroup.visible = true;

    // Coins arcing down from sky into every suburban house
    for (let i = 0; i < this.suburbCoinArcs.length; i++) {
      const a = this.suburbCoinArcs[i];
      const h = this.suburbHousePositions[a.targetIdx];
      const p = (t * a.speed + a.phase) % 1;
      const x = lerp(0, h.x, p);
      const z = lerp(h.z - 5, h.z, p);
      const y = lerp(a.arcH, -0.4, p * p) + Math.sin(p * Math.PI) * 1.8;

      _dummy.position.set(x, y, z);
      _dummy.rotation.set(p * 10, p * 7, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      this.suburbCoinsInst.setMatrixAt(i, _dummy.matrix);
    }
    this.suburbCoinsInst.instanceMatrix.needsUpdate = true;

    if (showJar) {
      const pop = easeOutBack(clamp(shotElapsed / 0.4, 0, 1), 1.3);
      this.jar401kGroup.scale.setScalar(pop);
      this.jar401kGroup.rotation.y = Math.sin(t * 1.3) * 0.24;

      // Animate gold coins dropping inside the YOUR 401(k) jar
      const fillProg = clamp(shotElapsed / 1.4, 0, 1);
      for (let i = 0; i < this.jarInnerCoins.length; i++) {
        const c = this.jarInnerCoins[i];
        const cp = clamp((fillProg - c.delay * 0.6) / 0.35, 0, 1);
        const y = lerp(4.8, c.y, easeOutBounce(cp));
        _dummy.position.set(c.x, y, c.z);
        _dummy.rotation.set(0, i * 0.7, 0);
        _dummy.scale.setScalar(cp > 0 ? 1 : 0.001);
        _dummy.updateMatrix();
        this.jarCoinsInst.setMatrixAt(i, _dummy.matrix);
      }
      this.jarCoinsInst.instanceMatrix.needsUpdate = true;
    }
  }

  private animateInterestTap(_shotId: number, t: number, _shotElapsed: number, _u: number): void {
    // Rotate tap valve wheel continuously
    this.tapHandleGroup.rotation.y = t * 2.2;

    // Pour coins out of nozzle (0, 1.5, -1.6) straight down then flowing forward down the river!
    for (let i = 0; i < this.tapRiverData.length; i++) {
      const c = this.tapRiverData[i];
      const p = (t * c.speed + c.phase) % 1;
      if (p < 0.28) {
        // Vertical cascade pouring from nozzle into pool
        const fallP = p / 0.28;
        _tmpVec.set(
          c.laneX * 0.28 * fallP,
          lerp(1.45, -2.75, fallP * fallP),
          lerp(-1.6, -1.1 + fallP * 0.7, fallP),
        );
      } else {
        // Flowing forward down the glowing coin river toward the houses
        const flowP = (p - 0.28) / 0.72;
        const spread = lerp(0.5, 1.35, flowP);
        _tmpVec.set(
          c.laneX * spread + Math.sin(flowP * 8 + c.bob) * 0.25,
          -2.75 + Math.abs(Math.sin(flowP * 14 + c.bob)) * 0.35,
          lerp(-0.4, 20.5, flowP),
        );
      }

      _dummy.position.copy(_tmpVec);
      _dummy.rotation.set(t * c.spin, t * c.spin * 0.7, c.bob);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      this.tapRiverCoinsInst.setMatrixAt(i, _dummy.matrix);
    }
    this.tapRiverCoinsInst.instanceMatrix.needsUpdate = true;
  }

  private animateFinale(shotId: number, t: number, shotElapsed: number, _u: number): void {
    if (shotId === 25) {
      // Spin gently showing front ("MONEY SECRET #2")
      const pop = easeOutBack(clamp(shotElapsed / 0.45, 0, 1), 1.35);
      this.finaleCardGroup.scale.setScalar(pop);
      this.finaleCardGroup.rotation.y = Math.sin(shotElapsed * 2.1) * 0.32;
      this.finaleCardGroup.position.y = 1.2 + Math.sin(t * 2.8) * 0.14;
    } else {
      // Shot 26: Crisp 180-degree flip to back ("#3: WHY BANKS PAY YOU ALMOST NOTHING", 0.5% vs 25%)
      const flip = easeInOutCubic(clamp(shotElapsed / 0.65, 0, 1));
      this.finaleCardGroup.scale.setScalar(1.04);
      this.finaleCardGroup.rotation.y = lerp(0, Math.PI, flip) + Math.sin(shotElapsed * 2.2) * 0.14;
      this.finaleCardGroup.position.y = 1.05 + Math.sin(t * 3.0) * 0.12;
    }

    // Orbiting gold coin storm
    for (let i = 0; i < this.finaleCoinOrbits.length; i++) {
      const c = this.finaleCoinOrbits[i];
      const ang = c.angle + t * c.speed;
      _dummy.position.set(
        Math.cos(ang) * c.r,
        c.y + Math.sin(t * 1.8 + c.tilt) * 0.55,
        Math.sin(ang) * c.r - 2.0,
      );
      _dummy.rotation.set(t * 2.5 + c.tilt, ang, t * 1.4);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      this.finaleCoinsInst.setMatrixAt(i, _dummy.matrix);
    }
    this.finaleCoinsInst.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.composer.dispose();
    this.renderer.dispose();
  }
}
