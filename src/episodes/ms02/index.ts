import { EpisodeModule } from '../../engine/episodeTypes';
import { MS02_META } from './meta';
import { drawMs02Characters, drawMs02Graphics } from './overlay2d';
import { ThreeShortEngine } from './scene3d';

export const MS02_EPISODE: EpisodeModule = {
  meta: MS02_META,
  create3DEngine: () => new ThreeShortEngine(),
  drawCharacters: drawMs02Characters,
  drawGraphics: drawMs02Graphics,
};
