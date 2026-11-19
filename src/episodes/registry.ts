/**
 * Central Episode Registry for Voice of Times Multi-Video Production System.
 *
 * To add Episode #3, #4, #5...:
 *   1. Create folder src/episodes/ms03/ with meta.ts, scene3d.ts, overlay2d.ts, index.ts
 *   2. Import MS03_EPISODE below and add it to EPISODES
 *   3. Add its matching entry to root episodes.json for CLI/batch rendering
 */

import { EpisodeModule } from '../engine/episodeTypes';
import { MS01_EPISODE } from './ms01';
import { MS02_EPISODE } from './ms02';
import { MS03_EPISODE } from './ms03';
import { MS04_EPISODE } from './ms04';
import { MS05_EPISODE } from './ms05';

export const EPISODES: readonly EpisodeModule[] = [
  MS01_EPISODE,
  MS02_EPISODE,
  MS03_EPISODE,
  MS04_EPISODE,
  MS05_EPISODE,
];

export const DEFAULT_EPISODE_ID = 'ms05';

export function getEpisodeById(id: string | null | undefined): EpisodeModule {
  const normalized = (id ?? '').trim().toLowerCase();
  const match = EPISODES.find(
    (ep) =>
      ep.meta.id.toLowerCase() === normalized ||
      ep.meta.slug.toLowerCase() === normalized ||
      String(ep.meta.episodeNumber) === normalized,
  );
  if (match) return match;
  return EPISODES.find((ep) => ep.meta.id === DEFAULT_EPISODE_ID) ?? EPISODES[0];
}

export function getSeriesList(): string[] {
  const set = new Set<string>();
  for (const ep of EPISODES) {
    set.add(ep.meta.series);
  }
  return Array.from(set);
}
