/**
 * Money Secrets #5 — "The $10,000 That Vanished"
 * 2D Overlay Graphics Layer (strictly y 250..700 headlines/numbers, phone & banker screens,
 * Fact Tag, counters, VHS rewind scanlines, and last-3s disclaimer).
 * 3D characters are rendered directly in WebGL (Ms05ThreeEngine) with shared lighting & shadows.
 * Zero character names on screen. One headline & at most one Fact Tag at a time.
 */

import {
  EpisodeCharacterArgs,
  EpisodeGraphicsArgs,
  HEIGHT,
  SAFE_CENTER_X,
  SAFE_MAX_W,
  WIDTH,
} from '../../engine/episodeTypes';
import { COLORS, clamp, easeOutBack, easeOutCubic, invLerp, lerp } from '../../engine/prng';

/** Characters in MS05 are realistic 3D models rendered in WebGL; no 2D sprite overlay needed */
export function drawMs05Characters(
  _ctx: CanvasRenderingContext2D,
  _args: EpisodeCharacterArgs,
): void {
  // Rendered inside Ms05ThreeEngine with soft shadows & shared scene lighting.
}

/** Deterministic VHS-style rewind scan lines + chromatic tracking bar during Shot 6 (7.70-9.40s) */
export function drawMs05PreOverlayFx(
  ctx: CanvasRenderingContext2D,
  _webglCanvas: HTMLCanvasElement,
  t: number,
): void {
  if (t < 7.7 || t >= 9.4) return;
  const localT = t - 7.7;

  ctx.save();
  // Pure transparent chromatic VHS tracking bands (zero WebGL->2D GPU readback)
  const bandY = ((1 - ((localT * 1.45) % 1)) * HEIGHT) | 0;
  ctx.fillStyle = 'rgba(60, 224, 255, 0.14)';
  ctx.fillRect(0, bandY - 26, WIDTH, 44);
  ctx.fillStyle = 'rgba(255, 59, 92, 0.12)';
  ctx.fillRect(0, bandY + 18, WIDTH, 28);

  // Crisp VHS horizontal scanlines across viewport
  ctx.fillStyle = 'rgba(8, 12, 22, 0.16)';
  for (let y = 0; y < HEIGHT; y += 8) {
    ctx.fillRect(0, y, WIDTH, 2);
  }

  // Tracking static flicker strip (deterministic from localT)
  const barY = ((localT * 920) % HEIGHT) | 0;
  const grad = ctx.createLinearGradient(0, barY - 22, 0, barY + 22);
  grad.addColorStop(0, 'rgba(60, 224, 255, 0)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.28)');
  grad.addColorStop(1, 'rgba(60, 224, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, barY - 22, WIDTH, 44);
  ctx.restore();
}

/** Big glowing smartphone screen overlay: "FINAL PAYMENT" + interactive PAY tap pop */
function drawPhonePaymentOverlay(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  isLoopEnd: boolean,
): void {
  const pop = easeOutBack(clamp(elapsed / 0.28, 0, 1), 1.35);
  const tapTime = isLoopEnd ? 0.95 : 0.72;
  const tapped = elapsed >= tapTime;
  const tapElapsed = Math.max(0, elapsed - tapTime);
  const btnScale = tapped
    ? 1 - Math.exp(-tapElapsed * 14) * Math.sin(tapElapsed * 24) * 0.12
    : 1;

  ctx.save();
  ctx.translate(SAFE_CENTER_X, 455);
  ctx.scale(pop, pop);

  const pw = 520;
  const ph = 370;

  // Crisp drop-rect shadow (zero CPU shadowBlur)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
  ctx.beginPath();
  ctx.roundRect(-pw / 2 + 4, -ph / 2 + 12, pw, ph, 34);
  ctx.fill();

  // Phone bezel
  ctx.fillStyle = '#0B101C';
  ctx.beginPath();
  ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 34);
  ctx.fill();

  ctx.strokeStyle = tapped ? COLORS.moneyGreen : 'rgba(255, 213, 74, 0.75)';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Top notch bar
  ctx.fillStyle = '#1B2336';
  ctx.beginPath();
  ctx.roundRect(-64, -ph / 2 + 16, 128, 12, 6);
  ctx.fill();

  // Header
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.cyan;
  ctx.font = '700 28px "Poppins", sans-serif';
  ctx.fillText('AUTO LOAN · #12 OF 12', 0, -112);

  // Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 44px "Poppins", sans-serif';
  ctx.fillText('FINAL PAYMENT', 0, -56);

  // Amount
  ctx.fillStyle = COLORS.highlightYellow;
  ctx.font = '800 66px "Poppins", sans-serif';
  ctx.fillText('$10,000.00', 0, 18);

  // Tap button
  ctx.save();
  ctx.translate(0, 114);
  ctx.scale(btnScale, btnScale);
  const bw = 340;
  const bh = 80;
  ctx.fillStyle = tapped ? '#16B562' : COLORS.moneyGreen;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 20);
  ctx.fill();

  ctx.fillStyle = '#06150C';
  ctx.font = '800 42px "Poppins", sans-serif';
  ctx.fillText(tapped ? '✓ PAID' : 'PAY NOW', 0, 2);

  // Expanding tap ripple ring on press
  if (tapped && tapElapsed < 0.55) {
    const rp = tapElapsed / 0.55;
    ctx.strokeStyle = `rgba(34, 224, 122, ${(1 - rp) * 0.9})`;
    ctx.lineWidth = 8 * (1 - rp) + 2;
    ctx.beginPath();
    ctx.arc(0, 0, 32 + rp * 120, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}

/** Banker monitor typing overlay: "$0" -> "$10,000" with blinking typing cursor */
function drawBankerAccountOverlay(ctx: CanvasRenderingContext2D, t: number): void {
  const localT = clamp(t - 16.8, 0, 3.0);
  const pop = easeOutBack(clamp(localT / 0.28, 0, 1), 1.3);

  // Typing stages from 17.5s to 19.1s: "$0" -> "$1" -> "$10" -> "$100" -> "$1,000" -> "$10,000"
  const stages = ['$0', '$1', '$10', '$100', '$1,000', '$10,000'];
  const typeProgress = clamp(invLerp(17.45, 19.15, t), 0, 1);
  const stageIdx = Math.min(stages.length - 1, Math.floor(typeProgress * stages.length));
  const typedText = stages[stageIdx];
  const cursorOn = Math.floor(localT * 6.5) % 2 === 0;
  const done = stageIdx === stages.length - 1;

  ctx.save();
  ctx.translate(SAFE_CENTER_X, 395);
  ctx.scale(pop, pop);

  const w = 740;
  const h = 250;
  ctx.fillStyle = 'rgba(8, 14, 24, 0.92)';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 24);
  ctx.fill();

  ctx.strokeStyle = done ? COLORS.moneyGreen : COLORS.cyan;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Top title strip
  ctx.fillStyle = done ? 'rgba(34, 224, 122, 0.16)' : 'rgba(60, 224, 255, 0.14)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 8, -h / 2 + 8, w - 16, 60, [18, 18, 0, 0]);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = done ? COLORS.moneyGreen : COLORS.cyan;
  ctx.font = '700 32px "Poppins", sans-serif';
  ctx.fillText('BORROWER ACCOUNT BALANCE', 0, -86);

  // Typed balance with cursor
  ctx.font = '800 110px "Poppins", sans-serif';
  const display = `${typedText}${cursorOn ? '|' : ' '}`;
  ctx.strokeStyle = '#05080F';
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  ctx.strokeText(display, 0, 32);
  ctx.fillStyle = done ? COLORS.moneyGreen : '#FFFFFF';
  ctx.fillText(display, 0, 32);

  ctx.restore();
}

/** Animated arrow equation card ("LOAN -> MONEY CREATED" / "REPAY -> MONEY DESTROYED") */
function drawEquationBanner(
  ctx: CanvasRenderingContext2D,
  leftText: string,
  rightText: string,
  accent: string,
  elapsed: number,
): void {
  const pop = easeOutBack(clamp(elapsed / 0.28, 0, 1), 1.35);
  const arrowP = easeOutCubic(clamp((elapsed - 0.18) / 0.45, 0, 1));

  ctx.save();
  ctx.translate(SAFE_CENTER_X, 375);
  ctx.scale(pop, pop);

  const w = Math.min(SAFE_MAX_W, 856);
  const h = 195;

  ctx.fillStyle = 'rgba(8, 11, 18, 0.90)';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 24);
  ctx.fill();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';

  // Top line: LEFT ->
  ctx.font = '800 62px "Poppins", sans-serif';
  ctx.strokeStyle = '#06070B';
  ctx.lineWidth = 12;
  const topLabel = `${leftText}  →`;
  ctx.strokeText(topLabel, 0, -36);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(topLabel, 0, -36);

  // Bottom line: MONEY CREATED / MONEY DESTROYED revealing smoothly
  ctx.save();
  ctx.globalAlpha = arrowP;
  ctx.translate(lerp(-36, 0, arrowP), 42);
  ctx.font = '800 62px "Poppins", sans-serif';
  ctx.strokeStyle = '#06070B';
  ctx.lineWidth = 14;
  ctx.strokeText(rightText, 0, 0, w - 56);
  ctx.fillStyle = accent;
  ctx.fillText(rightText, 0, 0, w - 56);
  ctx.restore();

  ctx.restore();
}

/** Last 3 seconds educational disclaimer (36px, safely above bottom 200px) */
function drawDisclaimer(ctx: CanvasRenderingContext2D, t: number): void {
  if (t < 53.43) return;
  const alpha = clamp((t - 53.43) / 0.35, 0, 1);
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

export function drawMs05Graphics(
  ctx: CanvasRenderingContext2D,
  { t, shotId, shotElapsed, helpers }: EpisodeGraphicsArgs,
): void {
  // Shot 1 (0.00-1.60): Night apartment — big phone screen overlay "FINAL PAYMENT"
  if (shotId === 1) {
    drawPhonePaymentOverlay(ctx, shotElapsed, false);
  }

  // Shot 2 (1.60-3.20): Glowing $10,000 stack dissolving into golden particles
  else if (shotId === 2) {
    const p = easeOutCubic(clamp(shotElapsed / 1.35, 0, 1));
    const rem = Math.round(lerp(10_000, 1_500, p));
    helpers.drawHeadline(
      ctx,
      `$${rem.toLocaleString('en-US')}`,
      SAFE_CENTER_X,
      365,
      138,
      COLORS.highlightYellow,
      shotElapsed,
    );
  }

  // Shot 3 (3.20-4.95): Particles fly out window — "-$10,000 FROM THE WORLD"
  else if (shotId === 3) {
    helpers.drawHeadline(ctx, '-$10,000', SAFE_CENTER_X, 345, 134, COLORS.alertRed, shotElapsed);
    helpers.drawHeadline(
      ctx,
      'FROM THE WORLD',
      SAFE_CENTER_X,
      475,
      78,
      '#FFFFFF',
      Math.max(0, shotElapsed - 0.16),
    );
  }

  // Shots 4-5 (4.95-7.70): Man looks around confused — "WHERE DID IT GO?"
  else if (shotId === 4 || shotId === 5) {
    helpers.drawHeadline(
      ctx,
      'WHERE DID IT GO?',
      SAFE_CENTER_X,
      355,
      86,
      COLORS.highlightYellow,
      Math.max(0, t - 5.02),
    );
  }

  // Shot 6 (7.70-9.40): VHS Rewind — "1 YEAR EARLIER"
  else if (shotId === 6) {
    helpers.drawLabelBadge(ctx, '◄◄ REWIND', SAFE_CENTER_X, 310, COLORS.cyan, shotElapsed);
    helpers.drawHeadline(
      ctx,
      '1 YEAR EARLIER',
      SAFE_CENTER_X,
      435,
      96,
      COLORS.highlightYellow,
      Math.max(0, shotElapsed - 0.12),
    );
  }

  // Shot 7 (9.40-11.10): Car showroom window with $10,000 price tag
  else if (shotId === 7) {
    helpers.drawHeadline(ctx, '$10,000', SAFE_CENTER_X, 345, 132, COLORS.moneyGreen, shotElapsed);
    helpers.drawLabelBadge(ctx, 'CAR PRICE', SAFE_CENTER_X, 470, COLORS.highlightYellow, shotElapsed - 0.15);
  }

  // Shot 8 (11.10-12.90): Man walks into generic bank lobby
  else if (shotId === 8) {
    helpers.drawLabelBadge(ctx, 'LOAN APPLICATION', SAFE_CENTER_X, 345, COLORS.cyan, shotElapsed);
  }

  // Shot 9 (12.90-14.80): Closed vault door — red label "VAULT: CLOSED"
  else if (shotId === 9) {
    helpers.drawStamp(ctx, 'VAULT: CLOSED', SAFE_CENTER_X, 375, shotElapsed, 760);
  }

  // Shot 10 (14.80-16.80): Savings drawers — "OTHER PEOPLE'S SAVINGS" + "NOT TOUCHED"
  else if (shotId === 10) {
    helpers.drawLabelBadge(
      ctx,
      "OTHER PEOPLE'S SAVINGS",
      SAFE_CENTER_X,
      325,
      COLORS.cyan,
      shotElapsed,
    );
    helpers.drawHeadline(
      ctx,
      'NOT TOUCHED',
      SAFE_CENTER_X,
      455,
      96,
      COLORS.alertRed,
      Math.max(0, shotElapsed - 0.28),
    );
  }

  // Shots 11-12 (16.80-19.80): Banker typing — Account balance "$0" -> "$10,000"
  else if (shotId === 11 || shotId === 12) {
    drawBankerAccountOverlay(ctx, t);
  }

  // Shots 13-14 (19.80-22.95): Woman talking & pointing — Huge "NEW MONEY"
  else if (shotId === 13 || shotId === 14) {
    helpers.drawHeadline(
      ctx,
      'NEW MONEY',
      SAFE_CENTER_X,
      365,
      126,
      COLORS.moneyGreen,
      Math.max(0, t - 19.9),
    );
  }

  // Shot 15 (22.95-25.00): He drives the new car out of the showroom
  else if (shotId === 15) {
    helpers.drawLabelBadge(ctx, 'CAR PURCHASED', SAFE_CENTER_X, 340, COLORS.highlightYellow, shotElapsed);
  }

  // Shot 16 (25.00-26.90): Glowing money stream from dealer into second bank
  else if (shotId === 16) {
    helpers.drawLabelBadge(ctx, 'DEALER → BANK #2', SAFE_CENTER_X, 345, COLORS.moneyGreen, shotElapsed);
  }

  // Shot 17 (26.90-28.90): Aerial city at dusk — "MOVING THROUGH THE ECONOMY"
  else if (shotId === 17) {
    helpers.drawHeadline(ctx, 'MOVING THROUGH', SAFE_CENTER_X, 335, 84, '#FFFFFF', shotElapsed);
    helpers.drawHeadline(
      ctx,
      'THE ECONOMY',
      SAFE_CENTER_X,
      445,
      98,
      COLORS.moneyGreen,
      Math.max(0, shotElapsed - 0.15),
    );
  }

  // Shot 18 (28.90-31.30): Calendar JAN -> DEC; counter "$10,000" -> "$833"
  else if (shotId === 18) {
    const p = clamp(shotElapsed / 2.35, 0, 1);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const mIdx = Math.min(11, Math.floor(p * 11.4));
    const remaining = Math.max(833, Math.round(lerp(10_000, 833, p)));
    helpers.drawLabelBadge(
      ctx,
      `MONTH ${mIdx + 1} · ${months[mIdx]}`,
      SAFE_CENTER_X,
      310,
      COLORS.cyan,
      Math.max(0.25, shotElapsed),
    );
    helpers.drawHeadline(
      ctx,
      `$${remaining.toLocaleString('en-US')}`,
      SAFE_CENTER_X,
      435,
      134,
      COLORS.highlightYellow,
      Math.max(0.25, shotElapsed),
    );
  }

  // Shot 19 (31.30-33.90): Last slice dissolves to $0 -> "DELETED"
  else if (shotId === 19) {
    if (shotElapsed < 0.72) {
      const rem = Math.max(0, Math.round(lerp(833, 0, clamp(shotElapsed / 0.65, 0, 1))));
      helpers.drawHeadline(ctx, `$${rem}`, SAFE_CENTER_X, 370, 148, COLORS.alertRed, 0.3);
    } else {
      helpers.drawHeadline(
        ctx,
        'DELETED',
        SAFE_CENTER_X,
        385,
        148,
        COLORS.alertRed,
        shotElapsed - 0.72,
      );
    }
  }

  // Shots 20-21 (33.90-38.05): Back in apartment, Man holds "PAID IN FULL" letter
  else if (shotId === 20 || shotId === 21) {
    helpers.drawHeadline(
      ctx,
      'MADE IT...',
      SAFE_CENTER_X,
      330,
      98,
      COLORS.highlightYellow,
      Math.max(0, t - 33.98),
    );
    if (t >= 35.6) {
      helpers.drawHeadline(
        ctx,
        'ERASED IT?',
        SAFE_CENTER_X,
        445,
        104,
        COLORS.alertRed,
        t - 35.6,
      );
    }
  }

  // Shot 22 (38.05-40.60): Grand stone central bank hall — Fact Tag "BANK OF ENGLAND, 2014"
  else if (shotId === 22) {
    helpers.drawFactTag(ctx, 'BANK OF ENGLAND, 2014', 360, shotElapsed);
  }

  // Shot 23 (40.60-43.10): Green arrow — "LOAN -> MONEY CREATED"
  else if (shotId === 23) {
    drawEquationBanner(ctx, 'LOAN', 'MONEY CREATED', COLORS.moneyGreen, shotElapsed);
  }

  // Shot 24 (43.10-45.75): Red arrow — "REPAY -> MONEY DESTROYED"
  else if (shotId === 24) {
    drawEquationBanner(ctx, 'REPAY', 'MONEY DESTROYED', COLORS.alertRed, shotElapsed);
  }

  // Shot 25 (45.75-47.70): Woman by night window
  else if (shotId === 25) {
    helpers.drawLabelBadge(ctx, 'NO NEW BORROWING', SAFE_CENTER_X, 345, '#5CF2D0', shotElapsed);
  }

  // Shot 26 (47.70-49.70): City money-lines fade out — "MONEY CAN SHRINK"
  else if (shotId === 26) {
    helpers.drawHeadline(
      ctx,
      'MONEY CAN SHRINK',
      SAFE_CENTER_X,
      375,
      88,
      COLORS.cyan,
      shotElapsed,
    );
  }

  // Shot 27 (49.70-52.40): Glowing card "MONEY SECRET #5" turns in 3D, both characters in front
  else if (shotId === 27) {
    helpers.drawLabelBadge(ctx, 'MONEY SECRET #5', SAFE_CENTER_X, 315, COLORS.highlightYellow, shotElapsed);
  }

  // Shot 28 (52.40-54.90): Card flips to #6 + dark bank in rain — "FOLLOW"
  else if (shotId === 28) {
    helpers.drawYellowBanner(ctx, 'FOLLOW', SAFE_CENTER_X, 330, Math.max(0, shotElapsed - 0.22));
  }

  // Shot 29 (54.90-56.43): Return to opening phone "FINAL PAYMENT" shot for seamless loop
  else if (shotId === 29) {
    drawPhonePaymentOverlay(ctx, shotElapsed, true);
  }

  // Last 3 seconds educational disclaimer (53.43-56.43)
  drawDisclaimer(ctx, t);
}
