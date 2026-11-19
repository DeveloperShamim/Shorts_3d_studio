import { EpisodeMeta } from '../../engine/episodeTypes';

export const MS01_META: EpisodeMeta = {
  id: 'ms01',
  slug: 'MoneySecrets1',
  series: 'MONEY SECRETS',
  episodeNumber: 1,
  seriesLabel: 'MONEY SECRET #1',
  channel: 'Voice of Times',
  title: 'Why Prices Never Come Back Down',
  subtitle: '$100 -> $131, The 2% Fed Target & Deflation Spiral',
  duration: 52.27,
  fps: 30,
  totalFrames: 1568,
  progressBarEnd: 45.8,
  accentColor: '#FF3B5C',
  audioUrl: '/assets/aistudio/MoneySecrets1_FULL_AUDIO_2caa72b5.mp3',
  srtUrl: '/assets/aistudio/MoneySecrets1_captions_19937db8.srt',
  cueSpeakers: {
    1: 'narrator',
    2: 'jordan',
    3: 'narrator',
    4: 'narrator',
    5: 'maya',
    6: 'narrator',
    7: 'narrator',
    8: 'maya',
    9: 'jordan',
    10: 'maya',
    11: 'narrator',
  },
  defaultSrt: `1
00:00:00,100 --> 00:00:04,096
Prices are NOT coming back down. And that's on purpose.

2
00:00:04,276 --> 00:00:06,135
Wait... on PURPOSE?!

3
00:00:06,315 --> 00:00:12,861
Since 2020, prices are up about 31%. A $100 cart now costs about $131.

4
00:00:13,041 --> 00:00:19,016
Here's the secret. The Federal Reserve WANTS prices to rise. About 2% every year.

5
00:00:19,366 --> 00:00:21,307
Because falling prices are even scarier.

6
00:00:21,487 --> 00:00:29,628
If prices drop, people wait to buy. Stores sell less, cut jobs, and prices drop again. That's deflation.

7
00:00:29,808 --> 00:00:37,629
In the US, prices fell for a whole year only once since 1955: 2009, during the crash.

8
00:00:37,979 --> 00:00:40,950
So the goal isn't lower prices. It's slower rises.

9
00:00:41,130 --> 00:00:42,180
Then how do I keep up?!

10
00:00:42,359 --> 00:00:45,451
Your pay and your savings have to grow faster than prices.

11
00:00:45,801 --> 00:00:51,589
That's Money Secret #1. Follow for #2: who actually owns America's debt.
`,
  shots: [
    { id: 1, start: 0.0, end: 1.5, world: 'aisle', label: 'Aisle & $100→$131 Tag', lineRef: 'Line 1' },
    { id: 2, start: 1.5, end: 2.8, world: 'aisle', label: 'ON PURPOSE Stamp Slam', lineRef: 'Line 1', flashOnCut: true },
    { id: 3, start: 2.8, end: 4.2, world: 'aisle', label: 'Rising Red Price Line', lineRef: 'Line 1', flashOnCut: true },
    { id: 4, start: 4.2, end: 6.2, world: 'aisle', label: 'Jordan Shocked', lineRef: 'Line 2', flashOnCut: true },
    { id: 5, start: 6.2, end: 8.6, world: 'cpiCart', label: '2020→2026 +31% Chart', lineRef: 'Line 3' },
    { id: 6, start: 8.6, end: 10.8, world: 'cpiCart', label: '$100 Shopping Cart Fill', lineRef: 'Line 3' },
    { id: 7, start: 10.8, end: 13.0, world: 'cpiCart', label: '$131 Same Cart + Coins', lineRef: 'Line 3', flashOnCut: true },
    { id: 8, start: 13.0, end: 15.4, world: 'vault', label: 'Marble Hall & Vault', lineRef: 'Line 4' },
    { id: 9, start: 15.4, end: 17.2, world: 'vault', label: 'Vault Opens: 2% Target', lineRef: 'Line 4', flashOnCut: true },
    { id: 10, start: 17.2, end: 19.2, world: 'vault', label: 'Flying +2% Calendar', lineRef: 'Line 4' },
    { id: 11, start: 19.2, end: 21.4, world: 'storm', label: 'Maya & Deflation Storm', lineRef: 'Line 5' },
    { id: 12, start: 21.4, end: 23.4, world: 'spiral', label: 'Spiral: People Wait', lineRef: 'Line 6' },
    { id: 13, start: 23.4, end: 25.4, world: 'spiral', label: 'Spiral: Less Sales Shop', lineRef: 'Line 6' },
    { id: 14, start: 25.4, end: 27.6, world: 'spiral', label: 'Spiral: Job Cuts', lineRef: 'Line 6' },
    { id: 15, start: 27.6, end: 29.8, world: 'spiral', label: 'DEFLATION Loop Glitch', lineRef: 'Line 6', flashOnCut: true },
    { id: 16, start: 29.8, end: 32.2, world: 'timeline', label: '1955–2025 CPI Timeline', lineRef: 'Line 7' },
    { id: 17, start: 32.2, end: 34.8, world: 'timeline', label: '2009 Only Red Bar', lineRef: 'Line 7', flashOnCut: true },
    { id: 18, start: 34.8, end: 36.3, world: 'timeline', label: '2009 Cracked Ground', lineRef: 'Line 7' },
    { id: 19, start: 36.3, end: 37.8, world: 'timeline', label: '2009 Crash Tickers', lineRef: 'Line 7' },
    { id: 20, start: 37.8, end: 40.0, world: 'race', label: 'Fast Rise vs 2% Lines', lineRef: 'Line 8' },
    { id: 21, start: 40.0, end: 41.0, world: 'race', label: 'Maya: Slower Not Lower', lineRef: 'Line 8' },
    { id: 22, start: 41.0, end: 42.3, world: 'race', label: 'Jordan Price Treadmill', lineRef: 'Line 9' },
    { id: 23, start: 42.3, end: 44.0, world: 'race', label: 'Pay + Savings Race', lineRef: 'Line 10' },
    { id: 24, start: 44.0, end: 45.6, world: 'race', label: 'Coins Overtake Prices', lineRef: 'Line 10' },
    { id: 25, start: 45.6, end: 48.4, world: 'finale', label: 'Money Secret #1 Card', lineRef: 'Line 11', flashOnCut: true },
    { id: 26, start: 48.4, end: 50.8, world: 'finale', label: 'Flip to #2 Mystery', lineRef: 'Line 11', flashOnCut: true },
    { id: 27, start: 50.8, end: 52.27, world: 'aisle', label: 'Loop Back to $131 Tag', lineRef: 'Loop' },
  ],
  qcTimestamps: [1, 5, 10, 14, 18, 20, 24, 28, 31, 35, 39, 41.5, 44, 47, 51],
};

export const HISTORICAL_US_CPI: readonly number[] = [
  0.4, 1.5, 3.3, 2.8, 0.7,
  1.7, 1.0, 1.0, 1.3, 1.3,
  1.6, 2.9, 3.1, 4.2, 5.5,
  5.7, 4.4, 3.2, 6.2, 11.0,
  9.1, 5.8, 6.5, 7.6, 11.3,
  13.5, 10.3, 6.2, 3.2, 4.3,
  3.6, 1.9, 3.6, 4.1, 4.8,
  5.4, 4.2, 3.0, 3.0, 2.6,
  2.8, 3.0, 2.3, 1.6, 2.2,
  3.4, 2.8, 1.6, 2.3, 2.7,
  3.4, 3.2, 2.8, 3.8, -0.4,
  1.6, 3.2, 2.1, 1.5, 1.6,
  0.1, 1.3, 2.1, 2.4, 1.8,
  1.2, 4.7, 8.0, 4.1, 2.9, 2.7,
];
