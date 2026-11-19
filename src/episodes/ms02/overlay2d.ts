import { drawCharacter } from '../../engine/characters';
import {
  EpisodeCharacterArgs,
  EpisodeGraphicsArgs,
  SAFE_CENTER_X,
} from '../../engine/episodeTypes';
import { COLORS, clamp, easeOutBack, easeOutCubic, hash1, invLerp, lerp } from '../../engine/prng';

function drawEmptyPocketsMoths(
  ctx: CanvasRenderingContext2D,
  cx: number,
  pocketY: number,
  elapsed: number,
  t: number,
): void {
  const pop = easeOutBack(clamp((elapsed - 0.15) / 0.35, 0, 1), 1.4);
  if (pop <= 0.01) return;

  ctx.save();
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + dir * 185, pocketY);
    ctx.rotate(dir * (0.38 + Math.sin(t * 7) * 0.06));
    ctx.scale(pop, pop);

    ctx.fillStyle = '#E8E4D8';
    ctx.strokeStyle = '#0B0D13';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.quadraticCurveTo(dir * 95, -24, dir * 105, 42);
    ctx.quadraticCurveTo(dir * 52, 84, 0, 48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#9AA3B5';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(dir * 16, -14);
    ctx.quadraticCurveTo(dir * 72, 2, dir * 78, 36);
    ctx.stroke();
    ctx.restore();
  }

  for (let m = 0; m < 4; m++) {
    const dir = m % 2 === 0 ? -1 : 1;
    const flyT = clamp((elapsed - 0.22 - m * 0.14) / 1.9, 0, 1);
    if (flyT <= 0) continue;

    const mx = cx + dir * (195 + flyT * (220 + hash1(m * 19) * 140));
    const my = pocketY - flyT * (210 + hash1(m * 31) * 180) + Math.sin(t * 14 + m * 2.1) * 24;
    const wingFlap = Math.abs(Math.sin(t * 28 + m * 1.7));

    ctx.save();
    ctx.globalAlpha = (1 - flyT * 0.45) * clamp(flyT * 6, 0, 1);
    ctx.translate(mx, my);
    ctx.rotate(dir * 0.22 + Math.sin(t * 9 + m) * 0.15);

    ctx.fillStyle = '#FFE4A8';
    ctx.strokeStyle = '#0B0D13';
    ctx.lineWidth = 4;
    for (const wSide of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(
        wSide * 18 * (0.4 + 0.6 * wingFlap),
        -4,
        22 * (0.35 + 0.65 * wingFlap),
        14,
        wSide * -0.35,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#3C352C';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (let d = 0; d < 14; d++) {
    const dir = d % 2 === 0 ? -1 : 1;
    const dt = clamp((elapsed - 0.18 - (d % 5) * 0.12) / 1.8, 0, 1);
    if (dt <= 0) continue;
    const dx = cx + dir * (175 + dt * (110 + hash1(d * 41) * 260));
    const dy = pocketY + (hash1(d * 53) - 0.5) * 140 - dt * (80 + hash1(d * 67) * 170);
    const r = 4 + hash1(d * 79) * 8;
    ctx.save();
    ctx.globalAlpha = (1 - dt) * 0.72;
    ctx.fillStyle = d % 3 === 0 ? '#FFD54A' : '#DCE4F2';
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawMs02Characters(ctx: CanvasRenderingContext2D, args: EpisodeCharacterArgs): void {
  const { t, shotId, shotElapsed, activeCue, bank } = args;
  const jordanSpeaking = activeCue?.speaker === 'jordan';
  const mayaSpeaking = activeCue?.speaker === 'maya';

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
    drawEmptyPocketsMoths(ctx, SAFE_CENTER_X, 1545, shotElapsed, t);
    return;
  }

  if (shotId === 9 || shotId === 10) {
    drawCharacter(ctx, bank, {
      pose: 'M_smile_point',
      x: SAFE_CENTER_X,
      bottomY: 1715,
      height: 730,
      appearElapsed: t - 14.8,
      isSpeaking: mayaSpeaking,
      t,
    });
    return;
  }

  if (shotId === 16) {
    drawCharacter(ctx, bank, {
      pose: 'J_worry_think',
      x: 265,
      bottomY: 1715,
      height: 610,
      appearElapsed: shotElapsed,
      isSpeaking: jordanSpeaking,
      t,
    });
    return;
  }

  if (shotId === 24) {
    drawCharacter(ctx, bank, {
      pose: 'M_cheer_cheer',
      x: SAFE_CENTER_X,
      bottomY: 1715,
      height: 725,
      appearElapsed: shotElapsed,
      isSpeaking: mayaSpeaking,
      t,
    });
    return;
  }

  if (shotId === 25) {
    drawCharacter(ctx, bank, {
      pose: 'J_idle',
      x: 300,
      bottomY: 1715,
      height: 660,
      appearElapsed: shotElapsed,
      isSpeaking: false,
      t,
    });
    drawCharacter(ctx, bank, {
      pose: 'M_cheer_cheer',
      x: 695,
      bottomY: 1715,
      height: 660,
      appearElapsed: Math.max(0, shotElapsed - 0.08),
      isSpeaking: false,
      t,
    });
  }
}

export function drawMs02Graphics(ctx: CanvasRenderingContext2D, args: EpisodeGraphicsArgs): void {
  const { t, shotId, shotElapsed, helpers } = args;

  switch (shotId) {
    case 1: {
      const trillions = lerp(0, 40, easeOutCubic(clamp(shotElapsed / 1.25, 0, 1)));
      const dollars = Math.round(trillions * 1_000_000_000_000);
      helpers.drawHeadline(ctx, `$${dollars.toLocaleString('en-US')}`, SAFE_CENTER_X, 360, 76, COLORS.highlightYellow, shotElapsed);
      break;
    }
    case 2:
      helpers.drawHeadline(ctx, '$40 TRILLION', SAFE_CENTER_X, 385, 128, COLORS.highlightYellow, shotElapsed);
      break;
    case 3:
      helpers.drawStamp(ctx, 'NOT CHINA', SAFE_CENTER_X, 430, shotElapsed, 670);
      break;
    case 4: {
      const pulse = 1 + Math.sin(shotElapsed * 10) * 0.035;
      helpers.drawHeadline(ctx, "IT'S YOU", SAFE_CENTER_X, 395, 162, COLORS.highlightYellow, shotElapsed, pulse);
      break;
    }
    case 5:
      helpers.drawHeadline(ctx, 'ME?!', SAFE_CENTER_X, 405, 184, COLORS.highlightYellow, shotElapsed);
      break;
    case 6:
      helpers.drawHeadline(ctx, 'WHO OWNS IT?', SAFE_CENTER_X, 385, 108, '#FFFFFF', shotElapsed);
      break;
    case 7:
      helpers.drawHeadline(ctx, '19%', SAFE_CENTER_X, 395, 188, COLORS.cyan, shotElapsed);
      break;
    case 8:
      helpers.drawHeadline(ctx, 'OWED TO ITSELF', SAFE_CENTER_X, 380, 96, COLORS.cyan, shotElapsed);
      helpers.drawFactTag(ctx, '$7.6T INTRAGOVERNMENTAL (TREASURY)', 610, Math.max(0, shotElapsed - 0.25));
      break;
    case 9:
      helpers.drawLabelBadge(ctx, 'SOCIAL SECURITY', 285, 360, COLORS.cyan, shotElapsed);
      helpers.drawLabelBadge(ctx, 'MEDICARE', 725, 485, COLORS.moneyGreen, Math.max(0, shotElapsed - 0.18));
      break;
    case 10:
      helpers.drawHeadline(ctx, '→ US GOVERNMENT', SAFE_CENTER_X, 395, 86, COLORS.highlightYellow, shotElapsed);
      break;
    case 11:
      helpers.drawHeadline(ctx, 'FEDERAL RESERVE', SAFE_CENTER_X, 385, 92, COLORS.highlightYellow, shotElapsed);
      break;
    case 12:
      helpers.drawHeadline(ctx, '$4.4T', SAFE_CENTER_X, 355, 168, COLORS.highlightYellow, shotElapsed);
      helpers.drawHeadline(ctx, 'FEDERAL RESERVE', SAFE_CENTER_X, 495, 62, '#FFFFFF', Math.max(0, shotElapsed - 0.12));
      helpers.drawFactTag(ctx, 'FED HOLDINGS ~$4.4T', 625, Math.max(0, shotElapsed - 0.28));
      break;
    case 13:
      helpers.drawHeadline(ctx, '$9.3T FOREIGN', SAFE_CENTER_X, 370, 108, COLORS.cyan, shotElapsed);
      helpers.drawLabelBadge(ctx, '24% OF U.S. DEBT', SAFE_CENTER_X, 515, COLORS.highlightYellow, Math.max(0, shotElapsed - 0.22));
      break;
    case 14:
      helpers.drawLabelBadge(ctx, '#1 FOREIGN LENDER', SAFE_CENTER_X, 315, COLORS.highlightYellow, shotElapsed);
      helpers.drawHeadline(ctx, 'JAPAN $1.1T', SAFE_CENTER_X, 460, 118, COLORS.highlightYellow, Math.max(0, shotElapsed - 0.12));
      break;
    case 15:
      helpers.drawLabelBadge(ctx, '#2 FOREIGN LENDER', SAFE_CENTER_X, 305, COLORS.moneyGreen, shotElapsed);
      helpers.drawHeadline(ctx, 'UK $1.0T', SAFE_CENTER_X, 445, 134, COLORS.moneyGreen, Math.max(0, shotElapsed - 0.1));
      helpers.drawFactTag(ctx, 'US TREASURY TIC DATA, JUL 2026', 615, Math.max(0, shotElapsed - 0.25));
      break;
    case 16:
      helpers.drawHeadline(ctx, 'CHINA?!', SAFE_CENTER_X, 415, 152, COLORS.alertRed, shotElapsed);
      break;
    case 17: {
      const boomScale = 1 + Math.exp(-shotElapsed * 10) * 0.18;
      helpers.drawLabelBadge(ctx, 'CHINA', SAFE_CENTER_X, 310, COLORS.alertRed, shotElapsed);
      helpers.drawHeadline(ctx, '$618B', SAFE_CENTER_X, 465, 172, COLORS.alertRed, shotElapsed, boomScale);
      break;
    }
    case 18:
      helpers.drawLabelBadge(ctx, 'ONLY 1.5%', SAFE_CENTER_X, 315, COLORS.alertRed, shotElapsed);
      helpers.drawHeadline(ctx, 'LESS THAN 2%', SAFE_CENTER_X, 470, 114, COLORS.alertRed, Math.max(0, shotElapsed - 0.12));
      break;
    case 19:
      helpers.drawHeadline(ctx, 'AMERICANS', SAFE_CENTER_X, 355, 120, COLORS.moneyGreen, shotElapsed);
      helpers.drawHeadline(ctx, '~45%', SAFE_CENTER_X, 515, 168, COLORS.highlightYellow, Math.max(0, shotElapsed - 0.16));
      break;
    case 20:
      helpers.drawLabelBadge(ctx, 'BANKS', 225, 345, COLORS.cyan, shotElapsed);
      helpers.drawLabelBadge(ctx, 'PENSIONS', 515, 445, COLORS.highlightYellow, Math.max(0, shotElapsed - 0.35));
      helpers.drawLabelBadge(ctx, 'MUTUAL FUNDS', 725, 555, COLORS.moneyGreen, Math.max(0, shotElapsed - 0.7));
      break;
    case 21:
      helpers.drawHeadline(ctx, 'EVERYDAY AMERICANS', SAFE_CENTER_X, 385, 84, COLORS.moneyGreen, shotElapsed);
      break;
    case 22:
      helpers.drawHeadline(ctx, 'MAYBE YOU', SAFE_CENTER_X, 395, 134, COLORS.highlightYellow, shotElapsed);
      break;
    case 23:
      helpers.drawHeadline(ctx, '$1T+ A YEAR', SAFE_CENTER_X, 385, 128, COLORS.highlightYellow, shotElapsed);
      helpers.drawFactTag(ctx, 'INTEREST > $1 TRILLION/YEAR', 610, Math.max(0, shotElapsed - 0.25));
      break;
    case 24:
      helpers.drawHeadline(ctx, 'BACK TO AMERICANS', SAFE_CENTER_X, 395, 84, COLORS.moneyGreen, shotElapsed);
      break;
    case 25:
      helpers.drawHeadline(ctx, 'MONEY SECRET #2', SAFE_CENTER_X, 310, 84, COLORS.highlightYellow, shotElapsed);
      break;
    case 26: {
      const pulse = 1 + Math.sin(shotElapsed * 9) * 0.04;
      helpers.drawHeadline(ctx, 'FOLLOW', SAFE_CENTER_X, 330, 136, COLORS.cyan, shotElapsed, pulse);
      helpers.drawLabelBadge(ctx, 'NEXT: 0.5%  VS  25%', SAFE_CENTER_X, 470, COLORS.highlightYellow, Math.max(0, shotElapsed - 0.25));
      break;
    }
    case 27: {
      const fade = 1 - invLerp(53.45, 54.07, t);
      ctx.save();
      ctx.globalAlpha = fade;
      helpers.drawHeadline(ctx, '$40 TRILLION', SAFE_CENTER_X, 385, 128, COLORS.highlightYellow, shotElapsed);
      ctx.restore();
      break;
    }
  }
}
