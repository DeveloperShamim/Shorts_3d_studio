import { EpisodeMeta, FPS, ShotSpec, Speaker } from '../../engine/episodeTypes';

export const MS03_DUR = 51.61;
export const MS03_TOTAL_FRAMES = 1548; // 51.61 * 30

export const MS03_AUDIO_URL = '/assets/aistudio/MoneySecrets3_FULL_AUDIO_c0395462.mp3';
export const MS03_SRT_URL = '/assets/aistudio/MoneySecrets3_captions_26a788a3.srt';

export const MS03_DEFAULT_SRT = `1
00:00:00,100 --> 00:00:06,689
Your bank pays you 0.4% on savings. Then charges you 20% on your card. Here's the secret.

2
00:00:06,869 --> 00:00:09,104
Wait... they're using MY money?!

3
00:00:09,284 --> 00:00:15,366
The average savings account pays about 0.39%. $10,000 earns you just $39 a year.

4
00:00:15,546 --> 00:00:21,300
The average credit card? About 20%. That's 50 times more.

5
00:00:21,650 --> 00:00:25,893
And the Fed's rate is about 4%. So banks can earn way more than they pay you.

6
00:00:26,073 --> 00:00:27,172
So why don't they pay me more?!

7
00:00:27,353 --> 00:00:32,529
Because most people never move their money. Banks call it... sticky money.

8
00:00:32,878 --> 00:00:39,018
But some online banks pay over 4% right now. That same $10,000 earns about $430.

9
00:00:39,198 --> 00:00:42,237
Same money. 11 times more. Just by moving it.

10
00:00:42,417 --> 00:00:43,635
I'm moving mine today!

11
00:00:43,985 --> 00:00:50,933
That's Money Secret #3. Follow for #4: why a $100 bill costs less than $1 to make.
`;

export const MS03_CUE_SPEAKERS: Record<number, Speaker> = {
  1: 'narrator',
  2: 'jordan',
  3: 'narrator',
  4: 'narrator',
  5: 'maya',
  6: 'jordan',
  7: 'narrator',
  8: 'narrator',
  9: 'maya',
  10: 'jordan',
  11: 'narrator',
};

// Every single shot <= 2.80 s so something new happens at least every 3 seconds.
export const MS03_SHOTS: readonly ShotSpec[] = [
  { id: 1, start: 0.0, end: 1.6, world: 'bankLobby', label: 'Grand Bank Lobby: 0.4% Coin', lineRef: 'Line 1' },
  { id: 2, start: 1.6, end: 3.4, world: 'bankLobby', label: 'Giant 20% Credit Card Slam', lineRef: 'Line 1', flashOnCut: true },
  { id: 3, start: 3.4, end: 5.0, world: 'bankLobby', label: '0.4% vs 20% Side by Side', lineRef: 'Line 1', flashOnCut: true },
  { id: 4, start: 5.0, end: 6.8, world: 'bankLobby', label: 'Red Stamp: SECRET', lineRef: 'Line 1', flashOnCut: true },
  { id: 5, start: 6.8, end: 9.2, world: 'piggyVault', label: 'Jordan Shocked: Piggy to Vault', lineRef: 'Line 2' },
  { id: 6, start: 9.2, end: 11.4, world: 'pedestalStack', label: '$10,000 Stack Under Spotlight', lineRef: 'Line 3' },
  { id: 7, start: 11.4, end: 13.4, world: 'pedestalStack', label: '$39 / Year Counter + FDIC Fact', lineRef: 'Line 3' },
  { id: 8, start: 13.4, end: 15.5, world: 'pedestalStack', label: 'Close-Up: Tiny Pile of 39 Coins', lineRef: 'Line 3' },
  { id: 9, start: 15.5, end: 17.6, world: 'aprBars', label: '3D Bars: 0.39% vs 19.7%', lineRef: 'Line 4' },
  { id: 10, start: 17.6, end: 19.4, world: 'aprBars', label: 'Tilt Up Skyscraper Bar + APR Fact', lineRef: 'Line 4' },
  { id: 11, start: 19.4, end: 21.4, world: 'aprBars', label: 'Huge 50x Slam', lineRef: 'Line 4', flashOnCut: true },
  { id: 12, start: 21.4, end: 23.6, world: 'fedVault', label: 'Maya: Fed Rate ~4% Vault', lineRef: 'Line 5' },
  { id: 13, start: 23.6, end: 26.0, world: 'fedVault', label: 'Money Flow & Profit Gap', lineRef: 'Line 5' },
  { id: 14, start: 26.0, end: 27.25, world: 'fedVault', label: 'Jordan Banging on Bank Door', lineRef: 'Line 6' },
  { id: 15, start: 27.25, end: 29.6, world: 'stickyHoney', label: 'Coins Glued in Golden Honey', lineRef: 'Line 7' },
  { id: 16, start: 29.6, end: 31.1, world: 'stickyHoney', label: 'Glitch Reveal: STICKY MONEY', lineRef: 'Line 7', redFlashOnCut: true },
  { id: 17, start: 31.1, end: 32.6, world: 'stickyHoney', label: 'Honey Dripping Close-Up', lineRef: 'Line 7' },
  { id: 18, start: 32.6, end: 34.8, world: 'onlineVault', label: 'Futuristic 4%+ Vault Opens', lineRef: 'Line 8', flashOnCut: true },
  { id: 19, start: 34.8, end: 37.0, world: 'onlineVault', label: '$10,000 Stack Flies to Vault', lineRef: 'Line 8' },
  { id: 20, start: 37.0, end: 39.1, world: 'onlineVault', label: 'Fast Counter: $430 / Year', lineRef: 'Line 8' },
  { id: 21, start: 39.1, end: 40.7, world: 'onlineVault', label: 'Split Screen: $39 vs $430', lineRef: 'Line 9', flashOnCut: true },
  { id: 22, start: 40.7, end: 42.3, world: 'onlineVault', label: '11x Pop + Maya Cheer', lineRef: 'Line 9' },
  { id: 23, start: 42.3, end: 43.8, world: 'onlineVault', label: 'Jordan Running to 4%+ Vault', lineRef: 'Line 10' },
  { id: 24, start: 43.8, end: 45.3, world: 'finale', label: 'Money Secret #3 Card + Storm', lineRef: 'Line 11', flashOnCut: true },
  { id: 25, start: 45.3, end: 46.8, world: 'finale', label: 'Jordan & Maya Finale Hero', lineRef: 'Line 11' },
  { id: 26, start: 46.8, end: 49.6, world: 'finale', label: 'Teaser #4: Generic $100 Note', lineRef: 'Line 11', flashOnCut: true },
  { id: 27, start: 49.6, end: 51.61, world: 'bankLobby', label: 'Seamless Loop: 0.4% vs 20%', lineRef: 'Loop' },
];

export const MS03_QC_TIMESTAMPS: readonly number[] = [
  1, 2.5, 4.2, 6, 8, 10.5, 12.5, 14.5, 16.5, 18.5, 20.5, 22.5, 25, 26.6, 28.5, 31, 33.5, 36, 38, 40.5, 43, 45, 48, 50.5,
];

export const MS03_META: EpisodeMeta = {
  id: 'ms03',
  slug: 'MoneySecrets3',
  series: 'MONEY SECRETS',
  episodeNumber: 3,
  seriesLabel: 'MONEY SECRET #3',
  channel: 'Voice of Times',
  title: 'Sticky Money: 0.4% vs 20%',
  subtitle: 'Why banks pay 0.39% on savings, charge 20% on cards, and how moving cash pays 11x more.',
  duration: MS03_DUR,
  fps: FPS,
  totalFrames: MS03_TOTAL_FRAMES,
  progressBarEnd: 44.0,
  accentColor: '#FFD54A',
  audioUrl: MS03_AUDIO_URL,
  srtUrl: MS03_SRT_URL,
  defaultSrt: MS03_DEFAULT_SRT,
  cueSpeakers: MS03_CUE_SPEAKERS,
  shots: MS03_SHOTS,
  qcTimestamps: MS03_QC_TIMESTAMPS,
};
