import { EpisodeMeta } from '../../engine/episodeTypes';

export const MS02_META: EpisodeMeta = {
  id: 'ms02',
  slug: 'MoneySecrets2',
  series: 'MONEY SECRETS',
  episodeNumber: 2,
  seriesLabel: 'MONEY SECRET #2',
  channel: 'Voice of Times',
  title: "Who Owns America's $40T Debt?",
  subtitle: 'Skyline $40T Counter, Debt Pie, Globe & Interest Tap',
  duration: 54.07,
  fps: 30,
  totalFrames: 1622,
  progressBarEnd: 46.3,
  accentColor: '#FFD54A',
  audioUrl: '/assets/aistudio/MoneySecrets2_FULL_AUDIO_4446b210.mp3',
  srtUrl: '/assets/aistudio/MoneySecrets2_captions_83941143.srt',
  cueSpeakers: {
    1: 'narrator',
    2: 'jordan',
    3: 'narrator',
    4: 'maya',
    5: 'narrator',
    6: 'narrator',
    7: 'jordan',
    8: 'narrator',
    9: 'narrator',
    10: 'maya',
    11: 'narrator',
  },
  defaultSrt: `1
00:00:00,100 --> 00:00:05,981
America owes $40 trillion. And the biggest lender isn't China. It's YOU.

2
00:00:06,161 --> 00:00:08,756
Me?! I didn't lend anybody anything!

3
00:00:08,936 --> 00:00:14,627
Let's split the $40 trillion. First, about a fifth, America owes... to itself.

4
00:00:14,977 --> 00:00:17,805
Social Security and Medicare funds lent it to the government.

5
00:00:17,985 --> 00:00:22,020
Next, the Federal Reserve. About $4.4 trillion.

6
00:00:22,200 --> 00:00:27,725
Foreign countries? About $9 trillion. Japan is #1. Then the UK.

7
00:00:27,905 --> 00:00:28,640
And China?!

8
00:00:28,820 --> 00:00:32,364
About $600 billion. That's less than 2% of the debt.

9
00:00:32,714 --> 00:00:41,009
Almost half belongs to Americans. Banks, pension funds, mutual funds... maybe even your 401(k).

10
00:00:41,190 --> 00:00:45,992
So when the government pays over $1 trillion a year in interest, a lot of it goes back to Americans.

11
00:00:46,341 --> 00:00:53,386
That's Money Secret #2. Follow for #3: why banks pay you almost nothing on savings.
`,
  shots: [
    { id: 1, start: 0.0, end: 1.6, world: 'skyline', label: 'Night Skyline & $40T Counter', lineRef: 'Line 1' },
    { id: 2, start: 1.6, end: 3.2, world: 'skyline', label: 'Counter Splits into Gold Stack', lineRef: 'Line 1', flashOnCut: true },
    { id: 3, start: 3.2, end: 4.6, world: 'skyline', label: 'NOT CHINA Stamp Slam', lineRef: 'Line 1', flashOnCut: true },
    { id: 4, start: 4.6, end: 6.1, world: 'skyline', label: "3D Pointer: IT'S YOU", lineRef: 'Line 1', flashOnCut: true },
    { id: 5, start: 6.1, end: 8.8, world: 'skyline', label: 'Jordan Shocked & Empty Pockets', lineRef: 'Line 2' },
    { id: 6, start: 8.8, end: 11.0, world: 'pieWorld', label: '3D Debt Pie Chart', lineRef: 'Line 3' },
    { id: 7, start: 11.0, end: 12.8, world: 'pieWorld', label: '19% Blue Slice Lifts Out', lineRef: 'Line 3' },
    { id: 8, start: 12.8, end: 14.8, world: 'pieWorld', label: 'Owed to Itself Loop Arrow', lineRef: 'Line 3' },
    { id: 9, start: 14.8, end: 16.35, world: 'govVaults', label: 'Maya: SS & Medicare Vaults', lineRef: 'Line 4' },
    { id: 10, start: 16.35, end: 17.9, world: 'govVaults', label: 'Coin Flow -> US Government', lineRef: 'Line 4' },
    { id: 11, start: 17.9, end: 20.0, world: 'fedHall', label: 'Marble Hall & Gold Slice', lineRef: 'Line 5' },
    { id: 12, start: 20.0, end: 22.1, world: 'fedHall', label: 'Federal Reserve $4.4T', lineRef: 'Line 5', flashOnCut: true },
    { id: 13, start: 22.1, end: 24.2, world: 'globe', label: 'Spinning 3D Globe: $9.3T Foreign', lineRef: 'Line 6' },
    { id: 14, start: 24.2, end: 26.0, world: 'globe', label: 'Japan #1 ($1.1T) Bar', lineRef: 'Line 6' },
    { id: 15, start: 26.0, end: 27.8, world: 'globe', label: 'UK #2 ($1.0T) Bar + TIC Tag', lineRef: 'Line 6' },
    { id: 16, start: 27.8, end: 28.75, world: 'globe', label: 'Whip-Pan China + Jordan', lineRef: 'Line 7', redFlashOnCut: true },
    { id: 17, start: 28.75, end: 30.6, world: 'globe', label: 'China Small Bar $618B', lineRef: 'Line 8' },
    { id: 18, start: 30.6, end: 32.5, world: 'pieWorld', label: 'Pie Sliver 1.5% (< 2%)', lineRef: 'Line 8', flashOnCut: true },
    { id: 19, start: 32.5, end: 34.8, world: 'pieWorld', label: 'Americans ~45% Green Slice', lineRef: 'Line 9', flashOnCut: true },
    { id: 20, start: 34.8, end: 36.8, world: 'pieWorld', label: 'Bank, Pension & Mutual Icons', lineRef: 'Line 9' },
    { id: 21, start: 36.8, end: 39.0, world: 'suburb', label: 'Suburban Street Coin Streams', lineRef: 'Line 9' },
    { id: 22, start: 39.0, end: 41.1, world: 'suburb', label: 'Glowing YOUR 401(k) Jar', lineRef: 'Line 9' },
    { id: 23, start: 41.1, end: 43.5, world: 'interestTap', label: 'INTEREST Tap: $1T+ / Year', lineRef: 'Line 10', flashOnCut: true },
    { id: 24, start: 43.5, end: 46.1, world: 'interestTap', label: 'Coin River Back to Americans', lineRef: 'Line 10' },
    { id: 25, start: 46.1, end: 48.8, world: 'finale', label: 'Money Secret #2 Card + Duo', lineRef: 'Line 11', flashOnCut: true },
    { id: 26, start: 48.8, end: 51.6, world: 'finale', label: 'Flip to #3: 0.5% vs 25%', lineRef: 'Line 11', flashOnCut: true },
    { id: 27, start: 51.6, end: 54.07, world: 'skyline', label: 'Loop Back to $40T Skyline', lineRef: 'Loop' },
  ],
  qcTimestamps: [1, 4, 7, 10, 13, 16, 19, 23, 26, 28.2, 30, 32, 35, 38, 42, 45, 48, 52],
};
