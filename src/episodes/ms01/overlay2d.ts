import { drawCharacter } from '../../engine/characters';
import {
  EpisodeCharacterArgs,
  EpisodeGraphicsArgs,
  HEIGHT,
  SAFE_CENTER_X,
  WIDTH,
} from '../../engine/episodeTypes';
import { COLORS, clamp, easeInOutCubic, easeOutCubic, hash1, invLerp, lerp } from '../../engine/prng';

export function drawMs01PreOverlayFx(
  ctx: CanvasRenderingContext2D,
  webglCanvas: HTMLCanvasElement,
  t: number,
): void {
  if (t >= 27.6 && t <= 28.35) {
    const glitchPower = 1 - invLerp(27.6, 28.35, t);
    const frameIdx = Math.floor(t * 30);
    const srcScaleY = webglCanvas.height / HEIGHT;
    for (let s = 0; s < 7; s++) {
      const sy = Math.floor(hash1(frameIdx * 17 + s * 31) * HEIGHT);
      const sh = Math.floor(28 + hash1(frameIdx * 13 + s * 43) * 95);
      const dx = (hash1(frameIdx * 23 + s * 59) - 0.5) * 96 * glitchPower;
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
    ctx.fillStyle = `rgba(255, 59, 92, ${0.18 * glitchPower})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

export function drawMs01Characters(ctx: CanvasRenderingContext2D, args: EpisodeCharacterArgs): void {
  const { t, shotId, shotElapsed, activeCue, bank } = args;
  const jordanSpeaking = activeCue?.speaker === 'jordan';
  const mayaSpeaking = activeCue?.speaker === 'maya';

  if (shotId === 4) {
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

  if (shotId === 11) {
    drawCharacter(ctx, bank, {
      pose: 'M_worry_point',
      x: SAFE_CENTER_X,
      bottomY: 1710,
      height: 750,
      appearElapsed: shotElapsed,
      isSpeaking: mayaSpeaking,
      t,
    });
    return;
  }

  if (shotId === 21) {
    drawCharacter(ctx, bank, {
      pose: 'M_smile_point',
      x: SAFE_CENTER_X,
      bottomY: 1710,
      height: 745,
      appearElapsed: shotElapsed,
      isSpeaking: mayaSpeaking,
      t,
    });
    return;
  }

  if (shotId === 22) {
    drawCharacter(ctx, bank, {
      pose: 'J_worry_shrug',
      x: SAFE_CENTER_X,
      bottomY: 1690,
      height: 710,
      appearElapsed: shotElapsed,
      isSpeaking: jordanSpeaking,
      isRunning: true,
      t,
    });
    return;
  }

  if (shotId === 23 || shotId === 24) {
    drawCharacter(ctx, bank, {
      pose: 'M_cheer_cheer',
      x: SAFE_CENTER_X + 60,
      bottomY: 1715,
      height: 715,
      appearElapsed: t - 42.3,
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

export function drawMs01Graphics(ctx: CanvasRenderingContext2D, args: EpisodeGraphicsArgs): void {
  const { t, shotId, shotElapsed, helpers } = args;

  switch (shotId) {
    case 1: {
      const p = easeInOutCubic(invLerp(0.35, 1.35, t));
      const val = Math.round(lerp(100, 131, p));
      const col = val > 110 ? COLORS.alertRed : '#FFFFFF';
      helpers.drawHeadline(ctx, `$${val}`, SAFE_CENTER_X, 395, 186, col, shotElapsed, 1.0);
      break;
    }
    case 2:
      helpers.drawStamp(ctx, 'ON PURPOSE', SAFE_CENTER_X, 430, shotElapsed, 690);
      break;
    case 3:
      helpers.drawHeadline(ctx, "PRICES WON'T DROP", SAFE_CENTER_X, 385, 86, COLORS.alertRed, shotElapsed);
      break;
    case 4:
      helpers.drawHeadline(ctx, 'ON PURPOSE?!', SAFE_CENTER_X, 410, 114, COLORS.highlightYellow, shotElapsed);
      break;
    case 5:
      helpers.drawHeadline(ctx, '+31%', SAFE_CENTER_X, 390, 184, COLORS.alertRed, shotElapsed);
      helpers.drawFactTag(ctx, 'US CPI, JAN 2020 → OCT 2026 (BLS)', 625, Math.max(0, shotElapsed - 0.35));
      break;
    case 6: {
      const popScale = 1 + Math.sin(shotElapsed * 14) * 0.025;
      helpers.drawHeadline(ctx, '$100', SAFE_CENTER_X, 390, 178, COLORS.moneyGreen, shotElapsed, popScale);
      break;
    }
    case 7: {
      const jumpVal = Math.round(lerp(100, 131, easeOutCubic(clamp(shotElapsed / 0.35, 0, 1))));
      helpers.drawHeadline(ctx, `$${jumpVal}`, SAFE_CENTER_X, 375, 176, COLORS.alertRed, shotElapsed);
      helpers.drawHeadline(ctx, 'SAME CART', SAFE_CENTER_X, 535, 76, COLORS.highlightYellow, Math.max(0, shotElapsed - 0.18));
      break;
    }
    case 8:
      helpers.drawYellowBanner(ctx, 'THE SECRET', SAFE_CENTER_X, 405, shotElapsed);
      break;
    case 9:
      helpers.drawHeadline(ctx, '2%', SAFE_CENTER_X, 375, 188, COLORS.highlightYellow, shotElapsed);
      helpers.drawFactTag(ctx, 'FED INFLATION TARGET: 2%', 615, Math.max(0, shotElapsed - 0.25));
      break;
    case 10:
      helpers.drawHeadline(ctx, '+2%', SAFE_CENTER_X, 365, 152, COLORS.moneyGreen, shotElapsed);
      helpers.drawHeadline(ctx, 'EVERY YEAR', SAFE_CENTER_X, 505, 74, '#FFFFFF', Math.max(0, shotElapsed - 0.15));
      break;
    case 11:
      helpers.drawHeadline(ctx, 'SCARIER?', SAFE_CENTER_X, 400, 134, COLORS.alertRed, shotElapsed);
      break;
    case 12:
      helpers.drawHeadline(ctx, 'PEOPLE WAIT', SAFE_CENTER_X, 385, 96, COLORS.highlightYellow, shotElapsed);
      break;
    case 13:
      helpers.drawHeadline(ctx, 'LESS SALES', SAFE_CENTER_X, 385, 102, COLORS.orange, shotElapsed);
      break;
    case 14:
      helpers.drawHeadline(ctx, 'JOB CUTS', SAFE_CENTER_X, 385, 110, COLORS.alertRed, shotElapsed);
      break;
    case 15: {
      const glitchJitter = t < 28.25 ? (hash1(Math.floor(t * 30) * 19) - 0.5) * 18 : 0;
      helpers.drawHeadline(ctx, 'DEFLATION', SAFE_CENTER_X + glitchJitter, 420, 132, COLORS.alertRed, shotElapsed);
      break;
    }
    case 16:
      helpers.drawHeadline(ctx, 'SINCE 1955...', SAFE_CENTER_X, 385, 104, COLORS.moneyGreen, shotElapsed);
      break;
    case 17:
      helpers.drawHeadline(ctx, 'ONLY ONCE', SAFE_CENTER_X, 380, 114, COLORS.alertRed, shotElapsed);
      helpers.drawFactTag(ctx, 'BLS: 2009 FIRST ANNUAL CPI DROP SINCE 1955', 610, Math.max(0, shotElapsed - 0.3));
      break;
    case 18:
    case 19:
      helpers.drawHeadline(ctx, '2009 CRASH', SAFE_CENTER_X, 390, 114, COLORS.alertRed, t - 34.8);
      break;
    case 20:
      helpers.drawLabelBadge(ctx, 'FAST RISE', 310, 355, COLORS.alertRed, shotElapsed);
      helpers.drawLabelBadge(ctx, '2% TARGET', 705, 585, COLORS.moneyGreen, Math.max(0, shotElapsed - 0.2));
      break;
    case 21:
      helpers.drawHeadline(ctx, 'SLOWER, NOT LOWER', SAFE_CENTER_X, 395, 82, COLORS.moneyGreen, shotElapsed);
      break;
    case 22:
      helpers.drawHeadline(ctx, 'HOW DO I KEEP UP?', SAFE_CENTER_X, 395, 82, COLORS.highlightYellow, shotElapsed);
      break;
    case 23:
    case 24: {
      const el = t - 42.3;
      helpers.drawLabelBadge(ctx, 'YOUR PAY + SAVINGS', 345, 340, COLORS.moneyGreen, el);
      helpers.drawLabelBadge(ctx, 'PRICES', 745, 535, COLORS.alertRed, Math.max(0, el - 0.18));
      break;
    }
    case 25:
      helpers.drawHeadline(ctx, 'MONEY SECRET #1', SAFE_CENTER_X, 315, 84, COLORS.highlightYellow, shotElapsed);
      break;
    case 26: {
      const pulse = 1 + Math.sin(shotElapsed * 9) * 0.04;
      helpers.drawHeadline(ctx, 'FOLLOW', SAFE_CENTER_X, 345, 134, COLORS.cyan, shotElapsed, pulse);
      break;
    }
    case 27: {
      const fade = 1 - invLerp(51.8, 52.27, t);
      ctx.save();
      ctx.globalAlpha = fade;
      helpers.drawHeadline(ctx, '$131', SAFE_CENTER_X, 395, 186, COLORS.alertRed, shotElapsed);
      ctx.restore();
      break;
    }
  }
}
