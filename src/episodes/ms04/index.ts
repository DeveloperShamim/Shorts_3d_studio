import { EpisodeModule } from '../../engine/episodeTypes';
import { MS04_META } from './meta';
import { drawMs04Characters, drawMs04Graphics } from './overlay2d';
import { Ms04ThreeEngine } from './scene3d';

export const MS04_EPISODE: EpisodeModule = {
  meta: MS04_META,
  create3DEngine: () => new Ms04ThreeEngine(),
  drawCharacters: drawMs04Characters,
  drawGraphics: drawMs04Graphics,
};
