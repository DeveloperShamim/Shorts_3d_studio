import { drawCharacter } from '../../engine/characters';
import {
  EpisodeCharacterArgs,
  EpisodeGraphicsArgs,
  HEIGHT,
  SAFE_CENTER_X,
  SAFE_LEFT,
  SAFE_RIGHT,
  WIDTH,
} from '../../engine/episodeTypes';
import { COLORS, clamp, easeOutBack, easeOutCubic, hash1, invLerp, lerp } from '../../engine/prng';

/** Glitch slice beat at 29.60s ("STICKY MONEY" reveal) + speed lines at 42.30-43.80s */
export function drawMs03PreOverlayFx(
  ctx: CanvasRenderingContext2D,
  webglCanvas: HTMLCanvasElement,
  t: number,
): void {
  // Glitch reveal beat on "STICKY MONEY" (29.60 - 30.25s)
  if (t >= 29.6 && t <= 30.25) {
    const power = 1 - invLerp(29.6, 30.25, t);
    const frameIdx = Math.floor(t * 30);
    const srcScaleY = webglCanvas.height / HEIGHT;
    for (let s = 0; s < 8; s++) {
      const sy = Math.floor(hash1(frameIdx * 19 + s * 37) * HEIGHT);
      const sh = Math.floor(24 + hash1(frameIdx * 11 + s * 53) * 86);
      const dx = (hash1(frameIdx * 29 + s * 61) - 0.5) * 110 * power;
      ctx.drawImage(
        webglCanvas,
        0,
        sy * srcScaleY,
        webglCanvas.width,
        sh * srcScaleY,
        dx,
        sy,
        WIDTH,
        sh,
      );
    }
    ctx.fillStyle = `rgba(255, 195, 40, ${0.22 * power})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Dynamic anime speed lines when Jordan sprints toward the 4%+ vault (42.30 - 43.80s)
  if (t >= 42.3 && t < 43.8) {
    const elapsed = t - 42.3;
    const cx = SAFE_CENTER_X;
    const cy = 960;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
      const angle = (i / 34) * Math.PI * 2 + Math.sin(i * 1.7) * 0.08;
      const phase = (elapsed * 3.4 + hash1(i * 41)) % 1;
      const r0 = 260 + phase * 320;
      const r1 = r0 + 210 + hash1(i * 73) * 260;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(34, 224, 122, 0.42)' : 'rgba(60, 224, 255, 0.34)';
      ctx.lineWidth = 4 + hash1(i * 17) * 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
      ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Stylized 2D piggy bank prop carried by Jordan while sprinting in Shot 23 */
function drawCarriedPiggyBank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
): void {
  const bob = Math.abs(Math.sin(t * 18.0)) * -18;
  const tilt = Math.sin(t * 18.0) * 0.09 - 0.08;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(tilt);

  ctx.shadowColor = 'rgba(255, 130, 175, 0.45)';
  ctx.shadowBlur = 18;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Legs
  ctx.fillStyle = '#EB78A2';
  ctx.strokeStyle = '#0B0D13';
  ctx.lineWidth = 7;
  for (const lx of [-58, -22, 22, 54]) {
    ctx.beginPath();
    ctx.roundRect(lx - 14, 42, 28, 36, 10);
    ctx.fill();
    ctx.stroke();
  }

  // Body
  const bodyGrad = ctx.createRadialGradient(-24, -22, 16, 0, 0, 118);
  bodyGrad.addColorStop(0, '#FFA8C8');
  bodyGrad.addColorStop(1, '#E26A98');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 108, 76, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ears
  for (const ex of [36, 62]) {
    ctx.beginPath();
    ctx.moveTo(ex - 16, -54);
    ctx.lineTo(ex + 6, -92);
    ctx.lineTo(ex + 22, -48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Snout
  ctx.fillStyle = '#FF92BA';
  ctx.beginPath();
  ctx.ellipse(106, -2, 26, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#6B1F3C';
  ctx.beginPath();
  ctx.ellipse(100, -8, 5, 9, 0, 0, Math.PI * 2);
  ctx.ellipse(114, -8, 5, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Coin slot + gleaming coin sticking out
  ctx.fillStyle = '#2B1420';
  ctx.beginPath();
  ctx.roundRect(-26, -68, 52, 10, 5);
  ctx.fill();

  ctx.fillStyle = '#FFD54A';
  ctx.beginPath();
  ctx.arc(0, -76, 20, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Eye
  ctx.fillStyle = '#12131A';
  ctx.beginPath();
  ctx.arc(64, -22, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Shock impact lines when Jordan bangs on the giant bank door (Shot 14) */
function drawDoorBangImpact(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
  const pulse = (t * 4.5) % 1;
  const alpha = (1 - pulse) * 0.9;
  const r0 = 28 + pulse * 36;
  const r1 = 68 + pulse * 52;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLORS.highlightYellow;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.8 + (i / 5) * Math.PI * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawMs03Characters(ctx: CanvasRenderingContext2D, args: EpisodeCharacterArgs): void {
  const { t, shotId, shotElapsed, activeCue, bank } = args;
  const jordanSpeaking = activeCue?.speaker === 'jordan';
  const mayaSpeaking = activeCue?.speaker === 'maya';

  // Shot 5 (6.80-9.20): Jordan shocked (J_shock_up)
  if (shotId === 5) {
    drawCharacter(ctx, bank, {
      pose: 'J_shock_up',
      x: SAFE_CENTER_X,
      bottomY: 1710,
      height: 750,
      appearElapsed: shotElapsed,
      isSpeaking: jordanSpeaking,
      t,
    });
    return;
  }

  // Shot 12 (21.40-23.60): Maya explaining Fed Rate ~4% (M_smile_point)
  if (shotId === 12) {
    drawCharacter(ctx, bank, {
      pose: 'M_smile_point',
      x: SAFE_CENTER_X,
      bottomY: 1715,
      height: 735,
      appearElapsed: shotElapsed,
      isSpeaking: mayaSpeaking,
      t,
    });
    return;
  }

  // Shot 14 (26.00-27.25): Jordan banging on giant bank door (J_worry_shrug)
  if (shotId === 14) {
    const bangOffset = Math.sin(t * 24) * 10;
    drawCharacter(ctx, bank, {
      pose: 'J_worry_shrug',
      x: SAFE_CENTER_X - 40 + bangOffset,
      bottomY: 1710,
      height: 740,
      appearElapsed: shotElapsed,
      isSpeaking: jordanSpeaking,
      isRunning: true,
      t,
    });
    drawDoorBangImpact(ctx, SAFE_CENTER_X + 165, 1320, t);
    return;
  }

  // Shot 21 & 22 (39.10-42.30): Maya cheering in front of $39 vs $430 split (M_cheer_cheer)
  if (shotId === 21 || shotId === 22) {
    drawCharacter(ctx, bank, {
      pose: 'M_cheer_cheer',
      x: SAFE_CENTER_X,
      bottomY: 1715,
      height: 700,
      appearElapsed: t - 39.1,
      isSpeaking: mayaSpeaking,
      t,
    });
    return;
  }

  // Shot 23 (42.30-43.80): Jordan (J_talk_cheer) running toward 4%+ vault carrying piggy bank
  if (shotId === 23) {
    const sprintX = lerp(SAFE_CENTER_X - 90, SAFE_CENTER_X + 55, clamp(shotElapsed / 1.4, 0, 1));
    drawCharacter(ctx, bank, {
      pose: 'J_talk_cheer',
      x: sprintX,
      bottomY: 1715,
      height: 710,
      appearElapsed: shotElapsed,
      isSpeaking: jordanSpeaking,
      isRunning: true,
      t,
    });
    drawCarriedPiggyBank(ctx, sprintX + 155, 1465, t);
    return;
  }

  // Shot 24 & 25 (43.80-46.80): Both Jordan and Maya celebrating over coin storm
  if (shotId === 24 || shotId === 25) {
    const appear = t - 43.8;
    drawCharacter(ctx, bank, {
      pose: 'J_talk_cheer',
      x: 295,
      bottomY: 1715,
      height: 645,
      appearElapsed: appear,
      isSpeaking: false,
      t,
    });
    drawCharacter(ctx, bank, {
      pose: 'M_cheer_cheer',
      x: 715,
      bottomY: 1715,
      height: 645,
      appearElapsed: appear,
      isSpeaking: false,
      t,
    });
  }
}

export function drawMs03Graphics(ctx: CanvasRenderingContext2D, args: EpisodeGraphicsArgs): void {
  const { t, shotId, shotElapsed, helpers } = args;
  const cx = SAFE_CENTER_X;

  switch (shotId) {
    case 1: {
      // 0.00-1.60: Boom on frame 0 — tiny glowing 0.4% coin on left
      helpers.drawHeadline(ctx, '0.4%', 285, 420, 134, COLORS.moneyGreen, shotElapsed);
      helpers.drawLabelBadge(ctx, 'YOUR SAVINGS', 285, 550, COLORS.moneyGreen, shotElapsed - 0.2);
      break;
    }

    case 2: {
      // 1.60-3.40: Huge 20% credit card slams down on right
      const shake = Math.exp(-shotElapsed * 9) * 14;
      const sx = Math.sin(shotElapsed * 58) * shake;
      helpers.drawHeadline(ctx, '20%', 705 + sx, 410, 152, COLORS.alertRed, shotElapsed);
      helpers.drawLabelBadge(ctx, 'YOUR CARD APR', 705, 550, COLORS.alertRed, shotElapsed - 0.18);
      break;
    }

    case 3: {
      // 3.40-5.00: Side by side tiny 0.4% vs giant 20% + Headline "THEY PAY YOU / YOU PAY THEM"
      helpers.drawHeadline(ctx, 'THEY PAY YOU', cx, 330, 82, COLORS.moneyGreen, shotElapsed);
      helpers.drawHeadline(ctx, 'YOU PAY THEM', cx, 435, 86, COLORS.alertRed, Math.max(0, shotElapsed - 0.18));
      helpers.drawLabelBadge(ctx, '0.4%  VS  20%', cx, 565, COLORS.highlightYellow, Math.max(0, shotElapsed - 0.25));
      break;
    }

    case 4: {
      // 5.00-6.80: Red stamp "SECRET" hits the screen (no overlap with other big text)
      helpers.drawStamp(ctx, 'SECRET', cx, 470, shotElapsed, 640);
      break;
    }

    case 5: {
      // 6.80-9.20: Jordan shocked + "MY MONEY?!"
      helpers.drawHeadline(ctx, 'MY MONEY?!', cx, 430, 118, COLORS.highlightYellow, shotElapsed);
      break;
    }

    case 6: {
      // 9.20-11.40: $10,000 stack under spotlight
      helpers.drawHeadline(ctx, '$10,000', cx, 385, 134, COLORS.moneyGreen, shotElapsed);
      helpers.drawLabelBadge(ctx, 'SAVINGS ACCOUNT', cx, 525, COLORS.cyan, shotElapsed - 0.25);
      break;
    }

    case 7: {
      // 11.40-13.40: Slow counter crawls up to "$39 / YEAR" + FDIC Fact Tag
      const countP = easeOutCubic(clamp(shotElapsed / 1.45, 0, 1));
      const dollars = Math.round(lerp(0, 39, countP));
      helpers.drawHeadline(ctx, `$${dollars} / YEAR`, cx, 365, 110, COLORS.highlightYellow, shotElapsed);
      helpers.drawFactTag(ctx, 'FDIC NATIONAL SAVINGS RATE 0.39% (NOV 2026)', 535, Math.max(0, shotElapsed - 0.2));
      break;
    }

    case 8: {
      // 13.40-15.50: Close-up tiny pile of 39 coins -> "JUST $39"
      helpers.drawHeadline(ctx, 'JUST $39', cx, 420, 136, COLORS.alertRed, shotElapsed);
      helpers.drawLabelBadge(ctx, 'OUT OF $10,000', cx, 555, COLORS.highlightYellow, shotElapsed - 0.2);
      break;
    }

    case 9: {
      // 15.50-17.60: Two 3D bars: green 0.39% vs red 19.7%
      helpers.drawLabelBadge(ctx, 'SAVINGS: 0.39%', 275, 420, COLORS.moneyGreen, shotElapsed);
      helpers.drawLabelBadge(ctx, 'CARD: 19.7%', 710, 420, COLORS.alertRed, Math.max(0, shotElapsed - 0.25));
      break;
    }

    case 10: {
      // 17.60-19.40: Tilt up skyscraper red bar + Bankrate Fact Tag
      helpers.drawHeadline(ctx, '19.71% APR', cx, 365, 108, COLORS.alertRed, shotElapsed);
      helpers.drawFactTag(ctx, 'AVG CARD APR 19.71% (BANKRATE, NOV 2026)', 535, Math.max(0, shotElapsed - 0.15));
      break;
    }

    case 11: {
      // 19.40-21.40: Huge "50x" slams in with a boom
      const slam = lerp(1.55, 1.0, easeOutCubic(clamp(shotElapsed / 0.24, 0, 1)));
      const shake = Math.exp(-shotElapsed * 10) * 14;
      helpers.drawHeadline(
        ctx,
        '50x',
        cx + Math.sin(shotElapsed * 60) * shake,
        415,
        210,
        COLORS.alertRed,
        shotElapsed,
        slam,
      );
      helpers.drawLabelBadge(ctx, 'MORE THAN SAVINGS', cx, 585, COLORS.highlightYellow, Math.max(0, shotElapsed - 0.2));
      break;
    }

    case 12: {
      // 21.40-23.60: Maya + Fed Rate ~4% + Fed Target Fact Tag
      helpers.drawHeadline(ctx, 'FED RATE ~4%', cx, 360, 100, COLORS.cyan, shotElapsed);
      helpers.drawFactTag(ctx, 'FED TARGET 3.75-4.00% (SEP 2026)', 525, Math.max(0, shotElapsed - 0.2));
      break;
    }

    case 13: {
      // 23.60-26.00: Money flows 0.4% -> 4% vault, glowing PROFIT gap
      helpers.drawLabelBadge(ctx, 'YOU GET 0.4%', 255, 345, COLORS.highlightYellow, shotElapsed);
      helpers.drawLabelBadge(ctx, 'BANK EARNS 4%', 740, 345, COLORS.cyan, Math.max(0, shotElapsed - 0.15));
      helpers.drawYellowBanner(ctx, 'THE PROFIT GAP', cx, 530, Math.max(0, shotElapsed - 0.35));
      break;
    }

    case 14: {
      // 26.00-27.25: Jordan banging on bank door -> "WHY?!"
      helpers.drawHeadline(ctx, 'WHY?!', cx, 430, 165, COLORS.alertRed, shotElapsed);
      break;
    }

    case 15: {
      // 27.25-29.60: Coins glued in golden honey -> "NEVER MOVED"
      helpers.drawHeadline(ctx, 'NEVER MOVED', cx, 425, 108, COLORS.highlightYellow, shotElapsed);
      break;
    }

    case 16:
    case 17: {
      // 29.60-32.60: Huge dripping golden-honey "STICKY MONEY"
      const revealElapsed = t - 29.6;
      drawHoneyDrippingHeadline(ctx, cx, 430, revealElapsed);
      break;
    }

    case 18: {
      // 32.60-34.80: Futuristic 4%+ vault opens + Top APYs Fact Tag
      helpers.drawHeadline(ctx, '4%+ APY', cx, 360, 130, COLORS.moneyGreen, shotElapsed);
      helpers.drawFactTag(ctx, 'TOP SAVINGS APYs 4.3-4.4% (NOV 2026)', 530, Math.max(0, shotElapsed - 0.2));
      break;
    }

    case 19: {
      // 34.80-37.00: $10,000 stack flies into the new 4%+ vault
      helpers.drawHeadline(ctx, 'MOVE YOUR $10,000', cx, 400, 84, COLORS.cyan, shotElapsed);
      helpers.drawLabelBadge(ctx, 'SAME MONEY · NEW VAULT', cx, 530, COLORS.moneyGreen, Math.max(0, shotElapsed - 0.25));
      break;
    }

    case 20: {
      // 37.00-39.10: Counter climbs fast to "$430 / YEAR" in green
      const climbP = easeOutCubic(clamp(shotElapsed / 1.15, 0, 1));
      const dollars = Math.round(lerp(39, 430, climbP));
      helpers.drawHeadline(ctx, `$${dollars} / YEAR`, cx, 420, 122, COLORS.moneyGreen, shotElapsed);
      helpers.drawLabelBadge(ctx, 'ON THE SAME $10,000', cx, 560, COLORS.highlightYellow, Math.max(0, shotElapsed - 0.2));
      break;
    }

    case 21:
    case 22: {
      // 39.10-42.30: Split screen "$39" (small grey) vs "$430" (big green), "11x" pops between them
      const splitElapsed = t - 39.1;
      helpers.drawHeadline(ctx, '$39', 240, 385, 92, '#9BA4B5', splitElapsed);
      helpers.drawHeadline(ctx, '$430', 750, 375, 134, COLORS.moneyGreen, Math.max(0, splitElapsed - 0.15));
      if (t >= 40.25) {
        helpers.drawYellowBanner(ctx, '11x MORE!', cx, 565, t - 40.25);
      }
      break;
    }

    case 23: {
      // 42.30-43.80: Jordan running toward 4%+ vault
      helpers.drawHeadline(ctx, 'MOVING IT TODAY!', cx, 410, 90, COLORS.moneyGreen, shotElapsed);
      break;
    }

    case 24:
    case 25: {
      // 43.80-46.80: Money Secret #3 card over coin storm
      const finElapsed = t - 43.8;
      helpers.drawHeadline(ctx, 'MONEY SECRET #3', cx, 365, 86, COLORS.highlightYellow, finElapsed);
      break;
    }

    case 26: {
      // 46.80-49.60: Teaser #4 + FOLLOW
      helpers.drawHeadline(ctx, 'NEXT: SECRET #4', cx, 345, 76, COLORS.cyan, shotElapsed);
      helpers.drawYellowBanner(ctx, 'FOLLOW', cx, 505, Math.max(0, shotElapsed - 0.25));
      break;
    }

    case 27: {
      // 49.60-51.61: Return to opening "0.4% vs 20%" so the Short loops seamlessly into frame 1
      helpers.drawHeadline(ctx, '0.4%', 285, 420, 120, COLORS.moneyGreen, shotElapsed);
      helpers.drawHeadline(ctx, '20%', 705, 420, 128, COLORS.alertRed, shotElapsed);
      break;
    }
  }

  // Mandatory last-3-seconds disclaimer (48.61 - 51.61s): 36px at bottom above 200px safe zone
  if (t >= 48.61) {
    const discAlpha = clamp((t - 48.61) / 0.25, 0, 1);
    ctx.save();
    ctx.globalAlpha = discAlpha;
    ctx.font = '700 36px "Poppins", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = 'Educational only, not financial advice';
    const maxW = SAFE_RIGHT - SAFE_LEFT;
    const measured = ctx.measureText(text).width;
    const fit = measured > maxW ? maxW / measured : 1;
    ctx.translate(cx, 1680);
    ctx.scale(fit, fit);
    helpers.drawOutlinedText(ctx, text, 0, 0, 'rgba(235, 240, 248, 0.92)', 10, 10);
    ctx.restore();
  }
}

/** Dripping golden honey stylized headline for "STICKY MONEY" (29.60 - 32.60s) */
function drawHoneyDrippingHeadline(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  elapsed: number,
): void {
  const pop = easeOutBack(clamp(elapsed / 0.26, 0, 1), 1.35);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);

  const lines = ['STICKY', 'MONEY'];
  const lineY = [-58, 62];
  const fontSize = 124;

  // Dripping golden honey icicles hanging from letters
  ctx.fillStyle = '#F5A623';
  ctx.strokeStyle = '#090B10';
  ctx.lineWidth = 6;
  for (let d = 0; d < 9; d++) {
    const dx = lerp(-310, 310, d / 8);
    const dripGrow = clamp((elapsed - 0.15 - (d % 4) * 0.14) * 0.85, 0, 1);
    const dripLen = 28 + dripGrow * (64 + hash1(d * 31) * 70);
    const yStart = d % 2 === 0 ? -8 : 108;

    ctx.beginPath();
    ctx.moveTo(dx - 11, yStart);
    ctx.quadraticCurveTo(dx - 7, yStart + dripLen * 0.72, dx - 14, yStart + dripLen);
    ctx.arc(dx, yStart + dripLen, 14, Math.PI, 0, true);
    ctx.quadraticCurveTo(dx + 7, yStart + dripLen * 0.72, dx + 11, yStart);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glossy specular highlight on honey droplet
    ctx.fillStyle = 'rgba(255, 245, 195, 0.75)';
    ctx.beginPath();
    ctx.ellipse(dx - 4, yStart + dripLen - 2, 4, 7, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F5A623';
  }

  // Glossy amber-gold letter fill with thick black outline
  ctx.font = `800 ${fontSize}px "Poppins", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (let i = 0; i < lines.length; i++) {
    const y = lineY[i];
    const grad = ctx.createLinearGradient(0, y - 60, 0, y + 60);
    grad.addColorStop(0, '#FFF09E');
    grad.addColorStop(0.45, '#FFC533');
    grad.addColorStop(1, '#D97B0B');

    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.strokeStyle = '#07080D';
    ctx.lineWidth = 22;
    ctx.strokeText(lines[i], 0, y);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = grad;
    ctx.fillText(lines[i], 0, y);
  }

  ctx.restore();
}
