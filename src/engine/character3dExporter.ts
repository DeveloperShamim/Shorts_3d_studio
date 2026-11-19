/**
 * Transparent-Background 3D Character PNG Studio & Exporter (Three.js WebGL2).
 *
 * Renders sculpted 3D Jordan & Maya rigs (or loaded Mixamo GLB rigs) on a single shared
 * offscreen transparent WebGLRenderer with studio 3-point lighting + RoomEnvironment reflections,
 * exporting crisp alpha-transparent PNGs at HD (1080x1440), 2K (1440x1920), or 4K (2160x2880).
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Character3DId,
  Character3DManager,
  Clip3DName,
  HeldPropKind,
} from './characters3d';

export type CharacterPngFraming = 'full' | 'upper';
export type CharacterPngSizeKey = 'hd' | '2k' | '4k';

export const CHARACTER_PNG_SIZES: Record<
  CharacterPngSizeKey,
  { key: CharacterPngSizeKey; label: string; width: number; height: number }
> = {
  hd: { key: 'hd', label: 'HD (1080×1440)', width: 1080, height: 1440 },
  '2k': { key: '2k', label: '2K (1440×1920)', width: 1440, height: 1920 },
  '4k': { key: '4k', label: '4K (2160×2880)', width: 2160, height: 2880 },
};

export interface Character3DPngOptions {
  character: Character3DId;
  clip: Clip3DName;
  framing: CharacterPngFraming;
  yawDeg: number;
  mouthOpen: boolean;
  prop: HeldPropKind;
  poseTime: number;
  width: number;
  height: number;
}

/** Pick an expressive deterministic pose timestamp for each clip */
export function getDefaultPoseTime(clip: Clip3DName): number {
  switch (clip) {
    case 'cheering':
      return 0.35;
    case 'surprised':
      return 0.25;
    case 'shrugging':
      return 0.45;
    case 'pointing':
      return 0.4;
    case 'walking':
      return 0.22;
    case 'talking':
      return 0.55;
    case 'typing':
      return 0.3;
    case 'looking':
      return 0.5;
    case 'idle':
    default:
      return 0.4;
  }
}

export class Character3DPngStudio {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly envRT: THREE.WebGLRenderTarget;
  private readonly chars: Character3DManager;
  private disposed = false;

  public readonly ready: Promise<void>;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(360, 480, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.65;

    // Clean studio 3-point lighting for crisp cutouts
    const hemi = new THREE.HemisphereLight(0xdcebff, 0x262d3d, 0.72);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.75);
    keyLight.position.set(2.4, 3.6, 3.2);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x9ecaff, 0.65);
    fillLight.position.set(-2.6, 2.2, 2.0);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x66e8ff, 1.05);
    rimLight.position.set(-1.4, 2.8, -2.6);
    this.scene.add(rimLight);

    this.camera = new THREE.PerspectiveCamera(34, 3 / 4, 0.1, 30);

    this.chars = new Character3DManager();
    this.scene.add(this.chars.man.container);
    this.scene.add(this.chars.woman.container);

    this.ready = this.chars.loadDefaultAssets();
  }

  public renderPngDataUrl(opts: Character3DPngOptions): string {
    if (this.disposed) return '';

    const w = Math.max(64, Math.round(opts.width));
    const h = Math.max(64, Math.round(opts.height));
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false);
    }

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    const activeRig = opts.character === 'man' ? this.chars.man : this.chars.woman;
    const otherRig = opts.character === 'man' ? this.chars.woman : this.chars.man;

    otherRig.container.visible = false;
    activeRig.container.visible = true;
    activeRig.container.position.set(0, 0, 0);
    activeRig.container.rotation.set(0, THREE.MathUtils.degToRad(opts.yawDeg), 0);

    // Pick a mouth-open phase when requested (sin(t*14.2)*cos(t*6.3) peaks strongly near t=0.44)
    const evalT = opts.mouthOpen ? Math.max(0.01, opts.poseTime) : opts.poseTime;
    activeRig.evaluateAt(opts.mouthOpen ? 0.44 : evalT, {
      clip: opts.clip,
      clipStart: opts.mouthOpen ? 0.44 - opts.poseTime : 0,
      isSpeaking: opts.mouthOpen,
      holdingProp: opts.prop,
      holdingNote: opts.prop === 'note',
    });

    // Frame full body or waist-up portrait cleanly with breathing room on all 4 edges
    const isMaya = opts.character === 'woman';
    if (opts.framing === 'upper') {
      const lookY = isMaya ? 1.32 : 1.38;
      this.camera.position.set(0, lookY + 0.04, 1.92);
      this.camera.lookAt(0, lookY, 0);
    } else {
      const lookY = isMaya ? 0.87 : 0.91;
      this.camera.position.set(0, lookY + 0.08, 3.65);
      this.camera.lookAt(0, lookY, 0);
    }

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);

    return this.renderer.domElement.toDataURL('image/png');
  }

  public downloadPng(opts: Character3DPngOptions, customFileName?: string): void {
    const url = this.renderPngDataUrl(opts);
    if (!url) return;

    const charSlug = opts.character === 'man' ? 'jordan_3d' : 'maya_3d';
    const mouthTag = opts.mouthOpen ? 'open' : 'closed';
    const propTag = opts.prop !== 'none' ? `_${opts.prop}` : '';
    const angleTag = opts.yawDeg !== 0 ? `_${Math.round(opts.yawDeg)}deg` : '';
    const fileName =
      customFileName ??
      `${charSlug}_${opts.clip}_${opts.framing}_${mouthTag}${propTag}${angleTag}.png`;

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.envRT.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}
