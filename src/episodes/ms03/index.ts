import { EpisodeModule } from '../../engine/episodeTypes';
import { MS03_META } from './meta';
import { drawMs03Characters, drawMs03Graphics, drawMs03PreOverlayFx } from './overlay2d';
import { Ms03ThreeEngine } from './scene3d';

export const MS03_EPISODE: EpisodeModule = {
  meta: MS03_META,
  create3DEngine: () => new Ms03ThreeEngine(),
  drawPreOverlayFx: drawMs03PreOverlayFx,
  drawCharacters: drawMs03Characters,
  drawGraphics: drawMs03Graphics,
};
