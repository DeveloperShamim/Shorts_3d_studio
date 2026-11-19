/**
 * Money Secrets #4 — "The Life of a $100 Bill"
 * 2D Overlay Graphics Layer (strictly y 250..700 headlines/numbers, Fact Tags, stamps, counters).
 * Characters are rendered directly inside the 3D WebGL scene (Ms04ThreeEngine) so they share
 * the exact same lights, RoomEnvironment reflections, and PCFSoft shadows.
 * Zero character names on screen. One headline & at most one Fact Tag at a time.
 */

import {
  EpisodeCharacterArgs,
  EpisodeGraphicsArgs,
  SAFE_CENTER_X,
  SAFE_MAX_W,
} from '../../engine/episodeTypes';
import { COLORS, clamp, easeOutBack, easeOutCubic, invLerp, lerp } from '../../engine/prng';

/** Characters in MS04 are realistic 3D models rendered in WebGL; no 2D sprite overlay needed */
export function drawMs04Characters(
  _ctx: CanvasRenderingContext2D,
  _args: EpisodeCharacterArgs,
): void {
  // Rendered inside Ms04ThreeEngine with soft shadows & shared scene lighting.
}

/** Green/emerald "ACCEPTED FOR TAXES" rubber stamp with impact settle */
function drawAcceptedStamp(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  elapsed: number,
): void {
  if (elapsed < 0) return;
  const slamP = easeOutCubic(clamp(elapsed / 0.22, 0, 1));
  const scale = lerp(1.48, 1.0, slamP);
  const shake = Math.exp(-elapsed * 12) * 14;
  const sx = Math.sin(elapsed * 62) * shake;
  const sy = Math.cos(elapsed * 54) * shake;

  ctx.save();
  ctx.translate(cx + sx, cy + sy);
  ctx.rotate(-0.075);
  ctx.scale(scale, scale);

  const rw = Math.min(SAFE_MAX_W, 810);
  const rh = 138;
  ctx.fillStyle = 'rgba(7, 22, 14, 0.90)';
  ctx.beginPath();
  ctx.roundRect(-rw / 2, -rh / 2, rw, rh, 18);
  ctx.fill();

  ctx.strokeStyle = COLORS.moneyGreen;
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(34, 224, 122, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-rw / 2 + 12, -rh / 2 + 12, rw - 24, rh - 24, 10);
  ctx.stroke();

  ctx.font = '800 58px "Poppins", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#04120B';
  ctx.lineWidth = 12;
  ctx.strokeText('ACCEPTED FOR TAXES', 0, 3);
  ctx.fillStyle = COLORS.moneyGreen;
  ctx.fillText('ACCEPTED FOR TAXES', 0, 3);
  ctx.restore();
}

/** Clean animated counter pill/callout for 11¢ -> $100 and YEAR 1..15 */
function drawCostJump(
  ctx: CanvasRenderingContext2D,
  helpers: EpisodeGraphicsArgs['helpers'],
  elapsed: number,
): void {
  const pop = easeOutBack(clamp(elapsed / 0.28, 0, 1), 1.4);
  ctx.save();
  ctx.translate(SAFE_CENTER_X, 345);
  ctx.scale(pop, pop);

  const bw = 760;
  const bh = 148;
  ctx.fillStyle = 'rgba(9, 13, 22, 0.88)';
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 24);
  ctx.fill();
  ctx.strokeStyle = COLORS.moneyGreen;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.font = '800 84px "Poppins", sans-serif';

  ctx.textAlign = 'right';
  helpers.drawOutlinedText(ctx, '11¢', -82, 4, '#FFFFFF', 14, 12);

  ctx.textAlign = 'center';
  helpers.drawOutlinedText(ctx, '→', 0, 2, COLORS.highlightYellow, 12, 10);

  ctx.textAlign = 'left';
  helpers.drawOutlinedText(ctx, '$100', 82, 4, COLORS.moneyGreen, 14, 16);
  ctx.restore();
}

/** Last 3 seconds educational disclaimer (36px, safely above bottom 200px) */
function drawDisclaimer(ctx: CanvasRenderingContext2D, t: number): void {
  if (t < 56.36) return;
  const alpha = clamp((t - 56.36) / 0.35, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '700 36px "Poppins", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#06070B';
  ctx.lineWidth = 10;
  ctx.strokeText('Educational only, not financial advice', SAFE_CENTER_X, 1682);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
  ctx.fillText('Educational only, not financial advice', SAFE_CENTER_X, 1682);
  ctx.restore();
}

export function drawMs04Graphics(
  ctx: CanvasRenderingContext2D,
  { t, shotId, shotElapsed, helpers }: EpisodeGraphicsArgs,
): void {
  // Shot 1 (0.00-1.70): Opening hook boom — clean macro $100 note, crisp badge
  if (shotId === 1) {
    helpers.drawHeadline(ctx, '$100 BILL', SAFE_CENTER_X, 345, 114, COLORS.moneyGreen, shotElapsed);
  }

  // Shot 2 (1.70-3.40): Counter "11¢" in white beside the floating note
  else if (shotId === 2) {
    const cents = Math.round(lerp(1, 11, easeOutCubic(clamp(shotElapsed / 0.55, 0, 1))));
    helpers.drawHeadline(ctx, `${cents}¢`, SAFE_CENTER_X, 360, 168, '#FFFFFF', shotElapsed);
    helpers.drawLabelBadge(ctx, 'COST TO MAKE', SAFE_CENTER_X, 510, COLORS.cyan, shotElapsed - 0.22);
  }

  // Shot 3 (3.40-5.20): Counter jumps "11¢ → $100" with punch + "WHY?"
  else if (shotId === 3) {
    drawCostJump(ctx, helpers, shotElapsed);
    if (shotElapsed >= 0.35) {
      helpers.drawHeadline(
        ctx,
        'WHY?',
        SAFE_CENTER_X,
        545,
        152,
        COLORS.highlightYellow,
        shotElapsed - 0.35,
      );
    }
  }

  // Shot 4 (5.20-7.60): Printing plant hall — crisp location callout
  else if (shotId === 4) {
    helpers.drawLabelBadge(ctx, 'PRINTING PLANT', SAFE_CENTER_X, 340, COLORS.cyan, shotElapsed);
  }

  // Shots 5-6 (7.60-10.70): Blank cotton & linen sheets + Fact Tag
  else if (shotId === 5 || shotId === 6) {
    const tagElapsed = Math.max(0, t - 7.75);
    helpers.drawFactTag(ctx, '75% COTTON, 25% LINEN', 350, tagElapsed);
  }

  // Shot 7 (10.70-12.60): Green ink rollers pressing the sheet
  else if (shotId === 7) {
    helpers.drawHeadline(ctx, 'GREEN INK', SAFE_CENTER_X, 345, 108, COLORS.moneyGreen, shotElapsed);
  }

  // Shot 8 (12.60-14.50): Blue security ribbon macro
  else if (shotId === 8) {
    helpers.drawLabelBadge(
      ctx,
      'BLUE SECURITY RIBBON',
      SAFE_CENTER_X,
      345,
      COLORS.cyan,
      shotElapsed,
    );
  }

  // Shot 9 (14.50-16.50): Guillotine cut -> Fact tag + "DONE"
  else if (shotId === 9) {
    helpers.drawFactTag(ctx, 'FED: 11.3¢ PER $100 NOTE (2025)', 335, shotElapsed);
    if (shotElapsed >= 0.72) {
      helpers.drawHeadline(
        ctx,
        'DONE',
        SAFE_CENTER_X,
        515,
        142,
        COLORS.moneyGreen,
        shotElapsed - 0.72,
      );
    }
  }

  // Shot 10 (16.50-18.30): Pallets stacking up
  else if (shotId === 10) {
    helpers.drawLabelBadge(
      ctx,
      'WAREHOUSE STACKS',
      SAFE_CENTER_X,
      340,
      COLORS.highlightYellow,
      shotElapsed,
    );
  }

  // Shot 11 (18.30-20.10): Big counter "877,000,000" + Fact tag
  else if (shotId === 11) {
    const p = easeOutCubic(clamp(shotElapsed / 0.85, 0, 1));
    const count = Math.round(lerp(120_000_000, 877_000_000, p));
    const formatted = count.toLocaleString('en-US');
    helpers.drawHeadline(
      ctx,
      formatted,
      SAFE_CENTER_X,
      365,
      118,
      COLORS.highlightYellow,
      shotElapsed,
    );
    helpers.drawFactTag(ctx, '2026 FED PRINT ORDER (UP TO)', 525, Math.max(0, shotElapsed - 0.25));
  }

  // Shot 12 (20.10-22.10): Armored truck at night
  else if (shotId === 12) {
    helpers.drawHeadline(
      ctx,
      'FEDERAL RESERVE BANK',
      SAFE_CENTER_X,
      355,
      74,
      COLORS.cyan,
      shotElapsed,
    );
  }

  // Shot 13 (22.10-24.10): Local bank vault drawers
  else if (shotId === 13) {
    helpers.drawHeadline(
      ctx,
      'LOCAL BANK',
      SAFE_CENTER_X,
      355,
      104,
      COLORS.moneyGreen,
      shotElapsed,
    );
  }

  // Shot 14 (24.10-26.40): Street ATM at dusk — Man walks up
  else if (shotId === 14) {
    helpers.drawLabelBadge(ctx, 'INTO HIS WALLET', SAFE_CENTER_X, 340, COLORS.highlightYellow, shotElapsed);
  }

  // Shots 15-16 (26.40-30.00): The Man holding the note up — "JUST PAPER?"
  else if (shotId === 15 || shotId === 16) {
    const headlineElapsed = Math.max(0, t - 26.55);
    helpers.drawHeadline(
      ctx,
      'JUST PAPER?',
      SAFE_CENTER_X,
      355,
      112,
      COLORS.highlightYellow,
      headlineElapsed,
    );
  }

  // Shot 17 (30.00-32.40): The Woman walks in beside him
  else if (shotId === 17) {
    helpers.drawHeadline(
      ctx,
      'EVERYONE AGREES',
      SAFE_CENTER_X,
      350,
      86,
      '#5CF2D0',
      shotElapsed,
    );
  }

  // Shot 18 (32.40-35.10): She points — 3 buildings light up: STORE, BANK, GOVERNMENT
  else if (shotId === 18) {
    // Sequence 1-by-1 without ever overlapping
    if (t >= 32.55) {
      helpers.drawLabelBadge(ctx, 'STORE', 225, 345, COLORS.highlightYellow, t - 32.55);
    }
    if (t >= 33.35) {
      helpers.drawLabelBadge(ctx, 'BANK', 502, 345, COLORS.moneyGreen, t - 33.35);
    }
    if (t >= 34.15) {
      helpers.drawLabelBadge(ctx, 'GOVERNMENT', 765, 455, COLORS.cyan, t - 34.15);
    }
  }

  // Shot 19 (35.10-37.20): Tax form & note side by side + stamp "ACCEPTED FOR TAXES"
  else if (shotId === 19) {
    if (shotElapsed >= 0.42) {
      drawAcceptedStamp(ctx, SAFE_CENTER_X, 395, shotElapsed - 0.42);
    } else {
      helpers.drawLabelBadge(ctx, 'TAXES', SAFE_CENTER_X, 340, COLORS.cyan, shotElapsed);
    }
  }

  // Shot 20 (37.20-39.40): Macro "LEGAL TENDER FOR ALL DEBTS" + Fact tag
  else if (shotId === 20) {
    helpers.drawFactTag(ctx, 'PRINTED ON EVERY FED NOTE', 345, shotElapsed);
  }

  // Shot 21 (39.40-41.70): Huge glowing word "TRUST" over the city at night
  else if (shotId === 21) {
    const pulse = 1 + Math.sin(shotElapsed * 5.2) * 0.025;
    helpers.drawHeadline(
      ctx,
      'TRUST',
      SAFE_CENTER_X,
      395,
      166,
      COLORS.highlightYellow,
      shotElapsed,
      pulse,
    );
  }

  // Shots 22-24 (41.70-44.10): Fast montage (Café, Taxi, Shop) with continuous YEAR 1 ... YEAR 15
  else if (shotId === 22 || shotId === 23 || shotId === 24) {
    const progress = clamp(invLerp(41.7, 44.05, t), 0, 1);
    const year = Math.max(1, Math.min(15, Math.floor(1 + progress * 14.99)));
    helpers.drawHeadline(
      ctx,
      `YEAR ${year}`,
      SAFE_CENTER_X,
      355,
      138,
      COLORS.highlightYellow,
      Math.max(0.25, t - 41.7),
    );
    const place = shotId === 22 ? 'CAFÉ' : shotId === 23 ? 'TAXI' : 'SHOP COUNTER';
    const accent = shotId === 22 ? COLORS.orange : shotId === 23 ? COLORS.highlightYellow : COLORS.moneyGreen;
    helpers.drawLabelBadge(ctx, place, SAFE_CENTER_X, 500, accent, shotElapsed);
  }

  // Shot 25 (44.10-46.30): Creased, faded & torn note + Fact tag
  else if (shotId === 25) {
    helpers.drawFactTag(ctx, '$100 NOTE LIFESPAN ~15 YEARS', 350, shotElapsed);
  }

  // Shot 26 (46.30-48.70): Industrial shredder -> crisp new note drops
  else if (shotId === 26) {
    if (shotElapsed < 1.35) {
      helpers.drawHeadline(ctx, 'SHREDDED', SAFE_CENTER_X, 345, 114, COLORS.alertRed, shotElapsed);
    } else {
      helpers.drawHeadline(
        ctx,
        'REPLACED',
        SAFE_CENTER_X,
        345,
        114,
        COLORS.moneyGreen,
        shotElapsed - 1.35,
      );
    }
  }

  // Shots 27-28 (48.70-52.20): The Man laughing/cheering — "BEST DEAL EVER"
  else if (shotId === 27 || shotId === 28) {
    helpers.drawHeadline(
      ctx,
      'BEST DEAL EVER',
      SAFE_CENTER_X,
      355,
      104,
      COLORS.highlightYellow,
      Math.max(0, t - 48.8),
    );
  }

  // Shot 29 (52.20-55.00): Glowing card "MONEY SECRET #4" turning in 3D, both characters in front
  else if (shotId === 29) {
    helpers.drawLabelBadge(ctx, 'MONEY SECRET #4', SAFE_CENTER_X, 310, COLORS.highlightYellow, shotElapsed);
  }

  // Shot 30 (55.00-57.80): Card flips to #5 + money stack dissolves -> "FOLLOW"
  else if (shotId === 30) {
    helpers.drawYellowBanner(ctx, 'FOLLOW', SAFE_CENTER_X, 330, Math.max(0, shotElapsed - 0.3));
  }

  // Shot 31 (57.80-59.36): Seamless return to opening floating note (clean frame)

  // Last 3 seconds educational disclaimer (56.36-59.36)
  drawDisclaimer(ctx, t);
}
