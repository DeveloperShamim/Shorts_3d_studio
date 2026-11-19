/**
 * Character sprite manager & stylized 2D explainer character renderer for Jordan and Maya.
 *
 * - Automatically loads user PNG sprites from /assets/chars/manifest.json (J_*.png, M_*.png
 *   with _0 mouth-closed and _1 mouth-open variants) with zero 404 requests.
 * - Supports live browser uploads (customSprites map) for instant previewing.
 * - When custom PNG sprites are not provided, renders crisp illustrated Canvas2D characters
 *   matching every pose in the shot list, complete with 9 Hz lip-sync, eye blink, tiny bob,
 *   0.3s pop-in overshoot, and soft colored rim glow (Jordan warm yellow, Maya teal).
 */

import { COLORS, clamp, easeOutBack } from './prng';

export type CharacterPose =
  | 'J_shock_up'
  | 'J_worry_shrug'
  | 'J_worry_think'
  | 'J_talk_cheer'
  | 'J_idle'
  | 'M_worry_point'
  | 'M_smile_point'
  | 'M_cheer_cheer';

export interface CharacterPoseInfo {
  pose: CharacterPose;
  label: string;
  description: string;
  closedFile: string;
  openFile: string;
}

export interface CharacterProfile {
  id: 'jordan' | 'maya';
  name: string;
  role: string;
  prefix: 'J_' | 'M_';
  colorHex: string;
  colorName: string;
  poses: readonly CharacterPoseInfo[];
}

export const CHARACTER_CATALOG: readonly CharacterProfile[] = [
  {
    id: 'jordan',
    name: 'Jordan',
    role: 'Curious Everyman · Reaction Host',
    prefix: 'J_',
    colorHex: COLORS.jordanYellow,
    colorName: 'Warm Yellow',
    poses: [
      {
        pose: 'J_shock_up',
        label: 'Shocked Up',
        description: 'Hands raised in disbelief for big reveals & price/debt shocks',
        closedFile: 'J_shock_up_0.png',
        openFile: 'J_shock_up_1.png',
      },
      {
        pose: 'J_worry_shrug',
        label: 'Worried Shrug',
        description: 'Confused shrug or pumping arms while running on treadmill',
        closedFile: 'J_worry_shrug_0.png',
        openFile: 'J_worry_shrug_1.png',
      },
      {
        pose: 'J_worry_think',
        label: 'Worried Think',
        description: 'Hand on chin questioning tough economic realities',
        closedFile: 'J_worry_think_0.png',
        openFile: 'J_worry_think_1.png',
      },
      {
        pose: 'J_talk_cheer',
        label: 'Talk Cheer',
        description: 'Excited talking & cheering pose for big action payoffs',
        closedFile: 'J_talk_cheer_0.png',
        openFile: 'J_talk_cheer_1.png',
      },
      {
        pose: 'J_idle',
        label: 'Friendly Wave',
        description: 'Relaxed wave for closing calls-to-action & finales',
        closedFile: 'J_idle_0.png',
        openFile: 'J_idle_1.png',
      },
    ],
  },
  {
    id: 'maya',
    name: 'Maya',
    role: 'Finance Explainer · Analyst Guide',
    prefix: 'M_',
    colorHex: COLORS.mayaTeal,
    colorName: 'Bright Teal',
    poses: [
      {
        pose: 'M_worry_point',
        label: 'Concerned Point',
        description: 'Serious pointing gesture breaking down warning stats',
        closedFile: 'M_worry_point_0.png',
        openFile: 'M_worry_point_1.png',
      },
      {
        pose: 'M_smile_point',
        label: 'Confident Point',
        description: 'Upbeat pointing gesture explaining solutions & insights',
        closedFile: 'M_smile_point_0.png',
        openFile: 'M_smile_point_1.png',
      },
      {
        pose: 'M_cheer_cheer',
        label: 'Victory Cheer',
        description: 'Both arms raised celebrating wins & finale payoffs',
        closedFile: 'M_cheer_cheer_0.png',
        openFile: 'M_cheer_cheer_1.png',
      },
    ],
  },
];

export interface CharacterDrawSpec {
  pose: CharacterPose;
  /** Normalized horizontal center in 1080px frame */
  x: number;
  /** Feet / waist bottom anchor Y (keeps character in y ~900..1720) */
  bottomY: number;
  /** Target height in pixels (default ~760) */
  height: number;
  /** Seconds elapsed since character appeared in this shot */
  appearElapsed: number;
  /** True while this character's SRT line is actively playing */
  isSpeaking: boolean;
  /** Global timeline time in seconds */
  t: number;
  /** Optional flip horizontally */
  flipX?: boolean;
  /** Optional running bounce (for Jordan on treadmill) */
  isRunning?: boolean;
}

export class CharacterSpriteBank {
  private images = new Map<string, HTMLImageElement>();
  public loadedCount = 0;

  async loadFromManifest(): Promise<void> {
    try {
      const res = await fetch('/assets/chars/manifest.json', { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as { files?: string[] };
      const files = Array.isArray(json.files) ? json.files : [];
      await Promise.all(
        files
          .filter((f) => f.toLowerCase().endsWith('.png'))
          .map((file) => this.loadUrl(file.replace(/\.png$/i, ''), `/assets/chars/${file}`)),
      );
    } catch {
      // Manifest absent or offline — gracefully use procedural characters
    }
  }

  loadUrl(key: string, url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.images.set(key, img);
        this.loadedCount = this.images.size;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
  }

  async addFileList(files: FileList): Promise<number> {
    const tasks: Promise<void>[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.name.toLowerCase().endsWith('.png')) continue;
      const key = f.name.replace(/\.png$/i, '');
      const url = URL.createObjectURL(f);
      tasks.push(this.loadUrl(key, url));
    }
    await Promise.all(tasks);
    return this.images.size;
  }

  hasCustomSprite(pose: CharacterPose): boolean {
    return this.images.has(`${pose}_0`) || this.images.has(`${pose}_1`);
  }

  hasVariant(pose: CharacterPose, mouthOpen: boolean): boolean {
    return this.images.has(`${pose}_${mouthOpen ? 1 : 0}`);
  }

  getSprite(pose: CharacterPose, mouthOpen: boolean): HTMLImageElement | null {
    const primary = `${pose}_${mouthOpen ? 1 : 0}`;
    const fallback = `${pose}_${mouthOpen ? 0 : 1}`;
    return this.images.get(primary) ?? this.images.get(fallback) ?? null;
  }
}

/**
 * Deterministic ~9 Hz mouth open/closed toggle when speaking, with natural micro-pauses.
 */
function isMouthOpenAt(t: number, isSpeaking: boolean): boolean {
  if (!isSpeaking) return false;
  const tick = Math.floor(t * 9.0);
  // Subtle natural cadence: mostly alternating 9 Hz with occasional closed syllable beat
  const phase = tick % 7;
  if (phase === 6) return false;
  return tick % 2 === 1;
}

/**
 * Draws a character sprite (user PNG if available, otherwise rich procedural Canvas2D art)
 * with soft colored rim glow, 0.3s pop-in overshoot, 9 Hz lip sync, and speaking bob.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  bank: CharacterSpriteBank,
  spec: CharacterDrawSpec,
): void {
  const { pose, x, bottomY, height, appearElapsed, isSpeaking, t, flipX, isRunning } = spec;
  const isJordan = pose.startsWith('J_');
  const rimColor = isJordan ? COLORS.jordanYellow : COLORS.mayaTeal;

  // Pop-in over 0.3s with crisp overshoot
  const popProgress = clamp(appearElapsed / 0.3, 0, 1);
  const popScale = easeOutBack(popProgress, 1.45);
  const popAlpha = clamp(appearElapsed / 0.14, 0, 1);

  const mouthOpen = isMouthOpenAt(t, isSpeaking);
  const speakBob = isSpeaking ? Math.abs(Math.sin(t * Math.PI * 9.0)) * -10 : Math.sin(t * 2.4) * 4;
  const runBob = isRunning ? Math.abs(Math.sin(t * 18.0)) * -24 : 0;
  const runLean = isRunning ? Math.sin(t * 18.0) * 0.05 : 0;
  const subtleSway = isSpeaking ? Math.sin(t * 5.2) * 0.018 : Math.sin(t * 1.9) * 0.01;

  ctx.save();
  ctx.globalAlpha = popAlpha;

  // Subtle colored rim halo behind character
  const haloGrad = ctx.createRadialGradient(
    x,
    bottomY - height * 0.46,
    height * 0.08,
    x,
    bottomY - height * 0.46,
    height * 0.5,
  );
  haloGrad.addColorStop(0, isJordan ? 'rgba(255, 213, 74, 0.14)' : 'rgba(92, 242, 208, 0.14)');
  haloGrad.addColorStop(0.6, isJordan ? 'rgba(255, 213, 74, 0.04)' : 'rgba(92, 242, 208, 0.04)');
  haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(x, bottomY - height * 0.46, height * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Anchor at bottom-center for pop-in scaling
  ctx.translate(x, bottomY + speakBob + runBob);
  ctx.rotate(subtleSway + runLean);
  ctx.scale((flipX ? -1 : 1) * popScale, popScale);

  const customImg = bank.getSprite(pose, mouthOpen);
  if (customImg) {
    const aspect = customImg.naturalWidth / Math.max(1, customImg.naturalHeight);
    const drawH = height;
    const drawW = drawH * aspect;

    // Subtle colored rim glow
    ctx.save();
    ctx.shadowColor = rimColor;
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = -2;
    ctx.drawImage(customImg, -drawW / 2, -drawH, drawW, drawH);
    ctx.restore();

    ctx.drawImage(customImg, -drawW / 2, -drawH, drawW, drawH);
  } else {
    // High-craft stylized procedural 2D character fallback
    const unit = height / 760;
    ctx.scale(unit, unit);
    if (isJordan) {
      drawProceduralJordan(ctx, pose, mouthOpen, t, isRunning ?? false, rimColor);
    } else {
      drawProceduralMaya(ctx, pose, mouthOpen, t, rimColor);
    }
  }

  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Stylized Jordan: warm amber/gold hoodie, expressive eyebrows, dark curly fade hair,
 * warm yellow rim lighting, pose-specific arms & expressions.
 */
function drawProceduralJordan(
  ctx: CanvasRenderingContext2D,
  pose: CharacterPose,
  mouthOpen: boolean,
  t: number,
  isRunning: boolean,
  rimColor: string,
): void {
  const blink = (t * 0.9 + 0.3) % 3.7 > 3.58;
  const shocked = pose === 'J_shock_up';
  const thinking = pose === 'J_worry_think';
  const worried = pose === 'J_worry_shrug' || thinking;
  const cheering = pose === 'J_talk_cheer';

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Outer rim glow silhouette pass
  ctx.shadowColor = rimColor;
  ctx.shadowBlur = 16;

  // Torso / Hoodie (anchors at y=0 bottom, head up to y=-720)
  const hoodieGrad = ctx.createLinearGradient(-150, -340, 150, 0);
  hoodieGrad.addColorStop(0, '#2B3245');
  hoodieGrad.addColorStop(1, '#1A1F2E');
  ctx.fillStyle = hoodieGrad;
  ctx.strokeStyle = '#0B0D13';
  ctx.lineWidth = 10;

  ctx.beginPath();
  ctx.moveTo(-165, 0);
  ctx.quadraticCurveTo(-180, -255, -108, -320);
  ctx.lineTo(108, -320);
  ctx.quadraticCurveTo(180, -255, 165, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Rim highlight stroke along shoulders
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-158, -95);
  ctx.quadraticCurveTo(-165, -245, -104, -314);
  ctx.lineTo(104, -314);
  ctx.quadraticCurveTo(165, -245, 158, -95);
  ctx.stroke();

  // Warm yellow hoodie accent collar + drawstrings
  ctx.fillStyle = COLORS.jordanYellow;
  ctx.strokeStyle = '#0B0D13';
  ctx.lineWidth = 7;
  drawRoundedRect(ctx, -68, -335, 136, 54, 24);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#FFD54A';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-26, -280);
  ctx.lineTo(-32, -185);
  ctx.moveTo(26, -280);
  ctx.lineTo(32, -185);
  ctx.stroke();

  // Pose-specific arms & hands
  const armWave = isRunning ? Math.sin(t * 18) * 34 : Math.sin(t * 4) * 8;
  ctx.fillStyle = '#252C3E';
  ctx.strokeStyle = '#0B0D13';
  ctx.lineWidth = 9;

  if (shocked) {
    // Both hands raised near temples in shock!
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 130, -260);
      ctx.quadraticCurveTo(dir * 235, -310, dir * 210, -455 + armWave * 0.5);
      ctx.lineTo(dir * 155, -445 + armWave * 0.5);
      ctx.quadraticCurveTo(dir * 170, -320, dir * 105, -210);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Open shocked hand
      ctx.fillStyle = '#C9895B';
      ctx.beginPath();
      ctx.arc(dir * 184, -472 + armWave * 0.5, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#252C3E';
    }
  } else if (thinking) {
    // Worried thinking pose: right hand raised to chin, left arm crossed
    ctx.beginPath();
    ctx.moveTo(-132, -240);
    ctx.quadraticCurveTo(-180, -140, 20, -165);
    ctx.lineTo(14, -215);
    ctx.quadraticCurveTo(-125, -195, -104, -205);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(132, -250);
    ctx.quadraticCurveTo(205, -245, 76, -372 + armWave * 0.4);
    ctx.lineTo(34, -345 + armWave * 0.4);
    ctx.quadraticCurveTo(130, -255, 100, -200);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#C9895B';
    ctx.beginPath();
    ctx.arc(46, -382 + armWave * 0.4, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (worried) {
    // Shrugging / running pumping arms
    for (const dir of [-1, 1]) {
      const yOff = isRunning ? dir * armWave : -12;
      ctx.beginPath();
      ctx.moveTo(dir * 135, -250);
      ctx.quadraticCurveTo(dir * 220, -180 + yOff, dir * 230, -290 + yOff);
      ctx.lineTo(dir * 176, -295 + yOff);
      ctx.quadraticCurveTo(dir * 175, -215 + yOff, dir * 112, -200);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#C9895B';
      ctx.beginPath();
      ctx.ellipse(dir * 208, -315 + yOff, 34, 24, dir * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#252C3E';
    }
  } else if (cheering) {
    // Excited cheering / running-with-piggy-bank arms
    for (const dir of [-1, 1]) {
      const yOff = isRunning ? dir * armWave * 0.65 : Math.sin(t * 9) * 12;
      ctx.beginPath();
      ctx.moveTo(dir * 130, -255);
      ctx.quadraticCurveTo(dir * 230, -320 + yOff, dir * 204, -468 + yOff);
      ctx.lineTo(dir * 152, -456 + yOff);
      ctx.quadraticCurveTo(dir * 172, -325 + yOff, dir * 105, -205);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#C9895B';
      ctx.beginPath();
      ctx.arc(dir * 178, -486 + yOff, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#252C3E';
    }
  } else {
    // Finale friendly wave / relaxed posture
    ctx.beginPath();
    ctx.moveTo(132, -250);
    ctx.quadraticCurveTo(220, -295, 206, -420 + armWave);
    ctx.lineTo(156, -412 + armWave);
    ctx.quadraticCurveTo(165, -310, 108, -210);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#C9895B';
    ctx.beginPath();
    ctx.arc(182, -440 + armWave, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Neck
  ctx.fillStyle = '#B8784C';
  ctx.strokeStyle = '#0B0D13';
  ctx.lineWidth = 8;
  drawRoundedRect(ctx, -34, -395, 68, 80, 20);
  ctx.fill();
  ctx.stroke();

  // Ears
  ctx.fillStyle = '#C9895B';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(dir * 124, -502, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Head
  const skinGrad = ctx.createLinearGradient(-120, -640, 120, -370);
  skinGrad.addColorStop(0, '#D89A6C');
  skinGrad.addColorStop(1, '#BE7E52');
  ctx.fillStyle = skinGrad;
  ctx.beginPath();
  ctx.ellipse(0, -512, 124, 140, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Warm rim highlight on head edge
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, -512, 122, -Math.PI * 0.88, -Math.PI * 0.12);
  ctx.stroke();

  // Hair (textured modern curly fade)
  ctx.fillStyle = '#19151B';
  ctx.strokeStyle = '#0B0D13';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-124, -530);
  ctx.quadraticCurveTo(-142, -645, -75, -675);
  ctx.quadraticCurveTo(-18, -716, 48, -688);
  ctx.quadraticCurveTo(138, -662, 124, -530);
  ctx.quadraticCurveTo(96, -592, 42, -595);
  ctx.quadraticCurveTo(-16, -606, -86, -586);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Eyes
  const eyeY = -518;
  for (const dir of [-1, 1]) {
    const ex = dir * 46;
    if (blink && !shocked) {
      ctx.strokeStyle = '#12131A';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(ex - 20, eyeY);
      ctx.lineTo(ex + 20, eyeY);
      ctx.stroke();
    } else {
      const eyeR = shocked ? 27 : 21;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#12131A';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeR, shocked ? 30 : 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#151822';
      ctx.beginPath();
      ctx.arc(ex, eyeY + (shocked ? 0 : 2), shocked ? 9 : 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - 4, eyeY - 5, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Expressive eyebrows
    ctx.strokeStyle = '#19151B';
    ctx.lineWidth = 11;
    ctx.beginPath();
    if (shocked) {
      ctx.moveTo(ex - 24, eyeY - 46);
      ctx.quadraticCurveTo(ex, eyeY - 64, ex + 24, eyeY - 46);
    } else if (worried) {
      ctx.moveTo(ex - 24 * dir, eyeY - 48);
      ctx.lineTo(ex + 22 * dir, eyeY - 32);
    } else {
      ctx.moveTo(ex - 22, eyeY - 38);
      ctx.quadraticCurveTo(ex, eyeY - 46, ex + 22, eyeY - 36);
    }
    ctx.stroke();
  }

  // Nose
  ctx.strokeStyle = '#8F5733';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-4, -490);
  ctx.quadraticCurveTo(14, -468, -2, -456);
  ctx.stroke();

  // Mouth (9 Hz open/closed)
  ctx.strokeStyle = '#14151D';
  ctx.lineWidth = 7;
  if (mouthOpen) {
    ctx.fillStyle = '#4B1222';
    ctx.beginPath();
    if (shocked) {
      ctx.ellipse(0, -418, 28, 36, 0, 0, Math.PI * 2);
    } else if (worried) {
      ctx.ellipse(0, -420, 34, 22, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(0, -430, 32, 0, Math.PI);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    // Teeth highlight
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-18, -436, 36, 10);
  } else {
    ctx.beginPath();
    if (shocked || worried) {
      ctx.moveTo(-26, -422);
      ctx.quadraticCurveTo(0, -434, 26, -418);
    } else {
      ctx.moveTo(-28, -426);
      ctx.quadraticCurveTo(0, -402, 28, -426);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Stylized Maya: sharp teal-trimmed blazer, sleek dark bob hair, round glasses,
 * teal rim glow, expressive pointing/cheering poses.
 */
function drawProceduralMaya(
  ctx: CanvasRenderingContext2D,
  pose: CharacterPose,
  mouthOpen: boolean,
  t: number,
  rimColor: string,
): void {
  const blink = (t * 0.85 + 1.4) % 4.1 > 3.98;
  const worried = pose === 'M_worry_point';
  const cheering = pose === 'M_cheer_cheer';

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Back hair layer
  ctx.shadowColor = rimColor;
  ctx.shadowBlur = 28;
  ctx.fillStyle = '#171C2B';
  ctx.strokeStyle = '#0A0C12';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(0, -525, 142, 162, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Blazer / Torso
  const jacketGrad = ctx.createLinearGradient(-150, -320, 150, 0);
  jacketGrad.addColorStop(0, '#133742');
  jacketGrad.addColorStop(1, '#0C212A');
  ctx.fillStyle = jacketGrad;
  ctx.beginPath();
  ctx.moveTo(-152, 0);
  ctx.quadraticCurveTo(-165, -245, -96, -315);
  ctx.lineTo(96, -315);
  ctx.quadraticCurveTo(165, -245, 152, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Rim highlight
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-148, -90);
  ctx.quadraticCurveTo(-156, -240, -92, -310);
  ctx.lineTo(92, -310);
  ctx.quadraticCurveTo(156, -240, 148, -90);
  ctx.stroke();

  // Crisp inner white/teal top + blazer lapels
  ctx.fillStyle = '#E8F7F4';
  ctx.strokeStyle = '#0A0C12';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-48, -315);
  ctx.lineTo(0, -170);
  ctx.lineTo(48, -315);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.mayaTeal;
  ctx.beginPath();
  ctx.moveTo(-92, -315);
  ctx.lineTo(-42, -315);
  ctx.lineTo(-10, -185);
  ctx.lineTo(-70, -210);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(92, -315);
  ctx.lineTo(42, -315);
  ctx.lineTo(10, -185);
  ctx.lineTo(70, -210);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Arms based on pose
  const gestureWave = Math.sin(t * 6.5) * 10;
  ctx.fillStyle = '#12333D';
  ctx.strokeStyle = '#0A0C12';
  ctx.lineWidth = 8;

  if (cheering) {
    // Both arms raised high in victory!
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 124, -255);
      ctx.quadraticCurveTo(dir * 228, -335, dir * 195, -495 + gestureWave);
      ctx.lineTo(dir * 144, -482 + gestureWave);
      ctx.quadraticCurveTo(dir * 165, -340, dir * 100, -205);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#E4AC86';
      ctx.beginPath();
      ctx.arc(dir * 172, -514 + gestureWave, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#12333D';
    }
  } else {
    // Pointing arm up-right explaining key concept
    ctx.beginPath();
    ctx.moveTo(122, -250);
    ctx.quadraticCurveTo(222, -285, 224, -430 + gestureWave * 0.7);
    ctx.lineTo(174, -426 + gestureWave * 0.7);
    ctx.quadraticCurveTo(172, -305, 102, -205);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pointing hand + index finger
    ctx.fillStyle = '#E4AC86';
    ctx.beginPath();
    ctx.arc(200, -445 + gestureWave * 0.7, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawRoundedRect(ctx, 190, -512 + gestureWave * 0.7, 20, 62, 10);
    ctx.fill();
    ctx.stroke();
  }

  // Neck
  ctx.fillStyle = '#D49A74';
  drawRoundedRect(ctx, -28, -390, 56, 78, 18);
  ctx.fill();
  ctx.stroke();

  // Head
  const skinGrad = ctx.createLinearGradient(-110, -630, 110, -370);
  skinGrad.addColorStop(0, '#F0BC96');
  skinGrad.addColorStop(1, '#DCA17B');
  ctx.fillStyle = skinGrad;
  ctx.beginPath();
  ctx.ellipse(0, -512, 112, 132, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Sleek front bangs
  ctx.fillStyle = '#171C2B';
  ctx.beginPath();
  ctx.moveTo(-116, -540);
  ctx.quadraticCurveTo(-110, -652, 0, -656);
  ctx.quadraticCurveTo(110, -652, 116, -540);
  ctx.quadraticCurveTo(64, -596, 12, -578);
  ctx.quadraticCurveTo(-56, -592, -116, -540);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Eyes + stylish thin teal glasses
  const eyeY = -512;
  for (const dir of [-1, 1]) {
    const ex = dir * 42;
    if (blink) {
      ctx.strokeStyle = '#12131A';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(ex - 18, eyeY);
      ctx.lineTo(ex + 18, eyeY);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#12131A';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 20, 21, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#141A26';
      ctx.beginPath();
      ctx.arc(ex, eyeY + 1, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - 4, eyeY - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyebrows
    ctx.strokeStyle = '#171C2B';
    ctx.lineWidth = 9;
    ctx.beginPath();
    if (worried) {
      ctx.moveTo(ex - 20 * dir, eyeY - 44);
      ctx.lineTo(ex + 18 * dir, eyeY - 30);
    } else {
      ctx.moveTo(ex - 20, eyeY - 36);
      ctx.quadraticCurveTo(ex, eyeY - 46, ex + 20, eyeY - 34);
    }
    ctx.stroke();
  }

  // Round glasses rims
  ctx.strokeStyle = COLORS.mayaTeal;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(-42, eyeY, 31, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(42, eyeY, 31, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-11, eyeY);
  ctx.lineTo(11, eyeY);
  ctx.stroke();

  // Mouth (9 Hz open/closed)
  ctx.strokeStyle = '#14151D';
  ctx.lineWidth = 6.5;
  if (mouthOpen) {
    ctx.fillStyle = '#521527';
    ctx.beginPath();
    if (worried) {
      ctx.ellipse(0, -424, 24, 18, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(0, -434, 30, 0, Math.PI);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-16, -436, 32, 9);
  } else {
    ctx.beginPath();
    if (worried) {
      ctx.moveTo(-22, -424);
      ctx.quadraticCurveTo(0, -434, 22, -422);
    } else {
      ctx.moveTo(-28, -432);
      ctx.quadraticCurveTo(0, -404, 28, -432);
    }
    ctx.stroke();
  }

  ctx.restore();
}
