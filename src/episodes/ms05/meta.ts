/**
 * Money Secrets #5 — "The $10,000 That Vanished"
 * Master Clock: 56.43 s (1693 frames @ 30 fps) locked to MS5_audio.wav & MS5.srt.
 * Every shot strictly <= 2.70 s (<= 2.8 s rule) with something new on screen at least every 3 s.
 */

import { EpisodeMeta, FPS, ShotSpec, Speaker } from '../../engine/episodeTypes';

export const MS05_DEFAULT_SRT = `1
00:00:00,100 --> 00:00:04,847
He just made his last loan payment... and $10,000 disappeared from the world.

2
00:00:05,027 --> 00:00:07,592
Wait... what? Where did it go?

3
00:00:07,942 --> 00:00:12,798
Rewind one year. He needs $10,000 for a car, so he walks into a bank.

4
00:00:12,978 --> 00:00:19,743
The banker doesn't open a vault. She doesn't take anyone's savings. She just types 10,000 into his account.

5
00:00:19,923 --> 00:00:22,881
That money didn't exist yesterday. The bank just created it.

6
00:00:23,231 --> 00:00:28,798
He buys the car. The dealer deposits it in another bank. Now it's moving through the economy.

7
00:00:28,978 --> 00:00:33,799
Every month he pays it back... and the part that repays the loan... is deleted.

8
00:00:33,979 --> 00:00:37,983
So my loan made the money... and paying it off erased it?

9
00:00:38,163 --> 00:00:45,665
Exactly. The Bank of England said it plainly. A new loan creates money, and repaying it destroys money.

10
00:00:46,015 --> 00:00:49,580
So when everyone stops borrowing, the amount of money can actually shrink.

11
00:00:49,760 --> 00:00:55,746
That's Money Secret #5. Follow for #6: the night a bank died.
`;

export const MS05_CUE_SPEAKERS: Record<number, Speaker> = {
  1: 'narrator',
  2: 'man',
  3: 'narrator',
  4: 'narrator',
  5: 'woman',
  6: 'narrator',
  7: 'narrator',
  8: 'man',
  9: 'narrator',
  10: 'woman',
  11: 'narrator',
};

/** 29 deterministic shots across 12 grounded 3D worlds — every shot strictly <= 2.70 s */
export const MS05_SHOTS: readonly ShotSpec[] = [
  // LINE 1 (0.10-4.85)
  { id: 1, start: 0.0, end: 1.6, world: 'apartment', label: 'Night Apartment · Final Payment', lineRef: 'L1', flashOnCut: true },
  { id: 2, start: 1.6, end: 3.2, world: 'apartment', label: '$10,000 Light Stack Dissolving', lineRef: 'L1', flashOnCut: true },
  { id: 3, start: 3.2, end: 4.95, world: 'apartmentWindow', label: 'Particles Fly Out Window', lineRef: 'L1', flashOnCut: true },

  // LINE 2 (5.03-7.59) — THE MAN
  { id: 4, start: 4.95, end: 6.3, world: 'apartment', label: 'Man Startled · Where Did It Go?', lineRef: 'L2', flashOnCut: true },
  { id: 5, start: 6.3, end: 7.7, world: 'apartment', label: 'Man Looking Around Confused', lineRef: 'L2' },

  // LINE 3 (7.94-12.80)
  { id: 6, start: 7.7, end: 9.4, world: 'rewindRoom', label: 'VHS Rewind · 1 Year Earlier', lineRef: 'L3', flashOnCut: true },
  { id: 7, start: 9.4, end: 11.1, world: 'carShowroom', label: 'Showroom Car · $10,000 Tag', lineRef: 'L3' },
  { id: 8, start: 11.1, end: 12.9, world: 'bankLobby', label: 'Man Walks Into Bank Lobby', lineRef: 'L3' },

  // LINE 4 (12.98-19.74)
  { id: 9, start: 12.9, end: 14.8, world: 'vaultClosed', label: 'Vault Door · CLOSED', lineRef: 'L4' },
  { id: 10, start: 14.8, end: 16.8, world: 'savingsDrawers', label: "Other People's Savings · Untouched", lineRef: 'L4' },
  { id: 11, start: 16.8, end: 18.3, world: 'bankerDesk', label: 'Banker Typing · $0 Balance', lineRef: 'L4' },
  { id: 12, start: 18.3, end: 19.8, world: 'bankerDesk', label: 'Typed $10,000 Into Account', lineRef: 'L4' },

  // LINE 5 (19.92-22.88) — THE WOMAN
  { id: 13, start: 19.8, end: 21.35, world: 'bankerDesk', label: 'Woman Talking · NEW MONEY', lineRef: 'L5', flashOnCut: true },
  { id: 14, start: 21.35, end: 22.95, world: 'bankerDesk', label: 'Woman Pointing at Screen', lineRef: 'L5' },

  // LINE 6 (23.23-28.80)
  { id: 15, start: 22.95, end: 25.0, world: 'carDriveOut', label: 'Driving New Car Out of Showroom', lineRef: 'L6' },
  { id: 16, start: 25.0, end: 26.9, world: 'dealerTransfer', label: 'Money Stream → Second Bank', lineRef: 'L6' },
  { id: 17, start: 26.9, end: 28.9, world: 'duskCity', label: 'Aerial City · Moving Economy', lineRef: 'L6' },

  // LINE 7 (28.98-33.80)
  { id: 18, start: 28.9, end: 31.3, world: 'calendarStack', label: 'Calendar JAN→DEC · Slices Vanish', lineRef: 'L7' },
  { id: 19, start: 31.3, end: 33.9, world: 'calendarStack', label: 'Last Slice Dissolves · DELETED', lineRef: 'L7', flashOnCut: true },

  // LINE 8 (33.98-37.98) — THE MAN
  { id: 20, start: 33.9, end: 36.0, world: 'apartment', label: 'Man Holds PAID IN FULL Letter', lineRef: 'L8' },
  { id: 21, start: 36.0, end: 38.05, world: 'apartment', label: 'Man Shrugs · Made It, Erased It?', lineRef: 'L8' },

  // LINE 9 (38.16-45.66)
  { id: 22, start: 38.05, end: 40.6, world: 'centralHall', label: 'Grand Stone Hall · Bank of England', lineRef: 'L9' },
  { id: 23, start: 40.6, end: 43.1, world: 'flowChamber', label: 'Green Arrow · Loan Creates Money', lineRef: 'L9', flashOnCut: true },
  { id: 24, start: 43.1, end: 45.75, world: 'flowChamber', label: 'Red Arrow · Repay Destroys Money', lineRef: 'L9', flashOnCut: true },

  // LINE 10 (46.02-49.58) — THE WOMAN
  { id: 25, start: 45.75, end: 47.7, world: 'nightWindow', label: 'Woman by Night Window', lineRef: 'L10' },
  { id: 26, start: 47.7, end: 49.7, world: 'duskCity', label: 'City Money-Lines Fade Out', lineRef: 'L10' },

  // LINE 11 (49.76-55.75)
  { id: 27, start: 49.7, end: 52.4, world: 'finale', label: 'Card #5 + Both 3D Characters', lineRef: 'L11' },
  { id: 28, start: 52.4, end: 54.9, world: 'finale', label: 'Card #6 · Bank Closed in Rain', lineRef: 'L11', flashOnCut: true },
  { id: 29, start: 54.9, end: 56.43, world: 'apartment', label: 'Seamless Loop → Final Payment', lineRef: 'L11' },
];

export const MS05_META: EpisodeMeta = {
  id: 'ms05',
  slug: 'MoneySecrets5',
  series: 'MONEY SECRETS',
  episodeNumber: 5,
  seriesLabel: 'MONEY SECRET #5',
  channel: 'Voice of Times',
  title: 'The $10,000 That Vanished',
  subtitle: 'How bank loans create money out of thin air — and repayment deletes it',
  duration: 56.43,
  fps: FPS,
  totalFrames: 1693,
  progressBarEnd: 49.8,
  accentColor: '#3CE0FF',
  audioUrl: '/assets/aistudio/MS5_audio_1e9ebb1f.wav',
  srtUrl: '/assets/aistudio/MS5_f7afe00b.srt',
  defaultSrt: MS05_DEFAULT_SRT,
  cueSpeakers: MS05_CUE_SPEAKERS,
  shots: MS05_SHOTS,
  qcTimestamps: [
    1, 2.5, 4, 6, 8.5, 10, 12, 14, 16, 18.5, 21, 24, 26, 28, 30, 32.5, 36, 39, 42, 44.5, 47, 49,
    51, 53.5, 55.8,
  ],
};
