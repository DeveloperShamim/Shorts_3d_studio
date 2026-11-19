/**
 * Money Secrets #4 — "The Life of a $100 Bill"
 * Master Clock: 59.36 s (1781 frames @ 30 fps) locked to MS4_audio.wav & MS4.srt.
 * Every shot strictly <= 2.80 s with something new on screen at least every 3 s.
 */

import { EpisodeMeta, FPS, ShotSpec, Speaker } from '../../engine/episodeTypes';

export const MS04_DEFAULT_SRT = `1
00:00:00,100 --> 00:00:05,064
This $100 bill cost about 11 cents to make. So why is it worth $100?

2
00:00:05,414 --> 00:00:10,596
Its life starts at a government printing plant, as a blank sheet of cotton and linen paper.

3
00:00:10,776 --> 00:00:16,391
Ink, a blue security ribbon, and about 11 cents later... it's done.

4
00:00:16,571 --> 00:00:19,994
This year, the Fed ordered up to 877 million of them.

5
00:00:20,174 --> 00:00:26,269
It ships to a Federal Reserve bank... then to a local bank... then into his wallet.

6
00:00:26,619 --> 00:00:29,928
So it's just paper... worth a hundred bucks?

7
00:00:30,108 --> 00:00:35,004
It's worth $100 because everyone agrees it is. The store, the bank, the government.

8
00:00:35,184 --> 00:00:41,622
The government takes it for taxes, and the law says it's good for all debts. That's the secret: trust.

9
00:00:41,972 --> 00:00:48,571
Our bill changes hands for about 15 years. Then it's worn out, shredded, and replaced.

10
00:00:48,751 --> 00:00:52,089
15 years for 11 cents? Best deal ever.

11
00:00:52,269 --> 00:00:58,675
That's Money Secret #4. Follow for #5: when you pay off a loan, money disappears.
`;

export const MS04_CUE_SPEAKERS: Record<number, Speaker> = {
  1: 'narrator',
  2: 'narrator',
  3: 'narrator',
  4: 'narrator',
  5: 'narrator',
  6: 'man',
  7: 'woman',
  8: 'narrator',
  9: 'narrator',
  10: 'man',
  11: 'narrator',
};

/** 31 deterministic shots across 9 3D worlds — every shot strictly <= 2.80 s */
export const MS04_SHOTS: readonly ShotSpec[] = [
  // LINE 1 (0.10-5.06)
  { id: 1, start: 0.0, end: 1.7, world: 'macroNote', label: 'Macro $100 Note Float', lineRef: 'L1', flashOnCut: true },
  { id: 2, start: 1.7, end: 3.4, world: 'macroNote', label: '11¢ Cost Counter', lineRef: 'L1', flashOnCut: true },
  { id: 3, start: 3.4, end: 5.2, world: 'macroNote', label: '11¢ → $100 · WHY?', lineRef: 'L1', flashOnCut: true },

  // LINE 2 (5.41-10.60)
  { id: 4, start: 5.2, end: 7.6, world: 'printingHall', label: 'Printing Plant Track', lineRef: 'L2', flashOnCut: true },
  { id: 5, start: 7.6, end: 9.15, world: 'printingHall', label: 'Blank Cotton-Linen Feed', lineRef: 'L2' },
  { id: 6, start: 9.15, end: 10.7, world: 'printingHall', label: 'Press Bed Macro Angle', lineRef: 'L2' },

  // LINE 3 (10.78-16.39)
  { id: 7, start: 10.7, end: 12.6, world: 'printingHall', label: 'Green Ink Rollers Press', lineRef: 'L3' },
  { id: 8, start: 12.6, end: 14.5, world: 'ribbonMacro', label: 'Blue Security Ribbon Slide', lineRef: 'L3' },
  { id: 9, start: 14.5, end: 16.5, world: 'cutterPress', label: 'Guillotine Cut · DONE', lineRef: 'L3', flashOnCut: true },

  // LINE 4 (16.57-19.99)
  { id: 10, start: 16.5, end: 18.3, world: 'warehouse', label: 'Pallet Towers Stacking', lineRef: 'L4' },
  { id: 11, start: 18.3, end: 20.1, world: 'warehouse', label: '877,000,000 Print Order', lineRef: 'L4' },

  // LINE 5 (20.17-26.27)
  { id: 12, start: 20.1, end: 22.1, world: 'armoredStreet', label: 'Armored Truck · Fed Bank', lineRef: 'L5' },
  { id: 13, start: 22.1, end: 24.1, world: 'localVault', label: 'Local Bank Cash Drawers', lineRef: 'L5' },
  { id: 14, start: 24.1, end: 26.4, world: 'streetAtm', label: 'Dusk ATM · Man Walks Up', lineRef: 'L5' },

  // LINE 6 (26.62-29.93) — THE MAN
  { id: 15, start: 26.4, end: 28.2, world: 'streetAtm', label: 'Man Shrugs · JUST PAPER?', lineRef: 'L6' },
  { id: 16, start: 28.2, end: 30.0, world: 'streetAtm', label: 'Man Orbit Under Streetlamp', lineRef: 'L6' },

  // LINE 7 (30.11-35.00) — THE WOMAN
  { id: 17, start: 30.0, end: 32.4, world: 'streetAtm', label: 'Woman Walks In & Talks', lineRef: 'L7' },
  { id: 18, start: 32.4, end: 35.1, world: 'streetAtm', label: 'Store · Bank · Government', lineRef: 'L7' },

  // LINE 8 (35.18-41.62)
  { id: 19, start: 35.1, end: 37.2, world: 'legalDesk', label: 'Tax Form · ACCEPTED', lineRef: 'L8', flashOnCut: true },
  { id: 20, start: 37.2, end: 39.4, world: 'macroNote', label: 'Legal Tender Engraving', lineRef: 'L8' },
  { id: 21, start: 39.4, end: 41.7, world: 'trustCity', label: 'TRUST Over Night City', lineRef: 'L8', flashOnCut: true },

  // LINE 9 (41.97-48.57)
  { id: 22, start: 41.7, end: 42.5, world: 'montage', label: 'Montage 1: Café (Yr 1–5)', lineRef: 'L9' },
  { id: 23, start: 42.5, end: 43.3, world: 'montage', label: 'Montage 2: Taxi (Yr 6–10)', lineRef: 'L9' },
  { id: 24, start: 43.3, end: 44.1, world: 'montage', label: 'Montage 3: Shop (Yr 11–15)', lineRef: 'L9' },
  { id: 25, start: 44.1, end: 46.3, world: 'wornNote', label: 'Worn & Torn · 15 Yr Lifespan', lineRef: 'L9' },
  { id: 26, start: 46.3, end: 48.7, world: 'shredder', label: 'Shredder Confetti & Fresh Bill', lineRef: 'L9', flashOnCut: true },

  // LINE 10 (48.75-52.09) — THE MAN
  { id: 27, start: 48.7, end: 50.45, world: 'streetAtm', label: 'Man Cheering · BEST DEAL EVER', lineRef: 'L10' },
  { id: 28, start: 50.45, end: 52.2, world: 'streetAtm', label: 'Man Celebrates Fresh Note', lineRef: 'L10' },

  // LINE 11 (52.27-58.67)
  { id: 29, start: 52.2, end: 55.0, world: 'finale', label: 'Card #4 + Both Characters', lineRef: 'L11' },
  { id: 30, start: 55.0, end: 57.8, world: 'finale', label: 'Card #5 Dissolve · FOLLOW', lineRef: 'L11', flashOnCut: true },
  { id: 31, start: 57.8, end: 59.36, world: 'macroNote', label: 'Seamless Loop → Frame 1', lineRef: 'L11' },
];

export const MS04_META: EpisodeMeta = {
  id: 'ms04',
  slug: 'MoneySecrets4',
  series: 'MONEY SECRETS',
  episodeNumber: 4,
  seriesLabel: 'MONEY SECRET #4',
  channel: 'Voice of Times',
  title: 'The Life of a $100 Bill',
  subtitle: 'Why an 11¢ piece of cotton-linen paper is worth $100',
  duration: 59.36,
  fps: FPS,
  totalFrames: 1781,
  progressBarEnd: 52.3,
  accentColor: '#22E07A',
  audioUrl: '/assets/aistudio/MS4_audio_c0462338.wav',
  srtUrl: '/assets/aistudio/MS4_419dbdc6.srt',
  defaultSrt: MS04_DEFAULT_SRT,
  cueSpeakers: MS04_CUE_SPEAKERS,
  shots: MS04_SHOTS,
  qcTimestamps: [
    1, 3, 4.5, 6.5, 9, 11.5, 13.5, 15.5, 17.5, 19, 21, 23, 25, 28, 31, 34, 36, 38.5, 40.5, 43,
    45, 47.5, 50, 53.5, 56.5, 58.5,
  ],
};
