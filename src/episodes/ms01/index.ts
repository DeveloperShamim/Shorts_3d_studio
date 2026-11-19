import { EpisodeModule } from '../../engine/episodeTypes';
import { MS01_META } from './meta';
import { drawMs01Characters, drawMs01Graphics, drawMs01PreOverlayFx } from './overlay2d';
import { Ms01ThreeEngine } from './scene3d';

export const MS01_EPISODE: EpisodeModule = {
  meta: MS01_META,
  create3DEngine: () => new Ms01ThreeEngine(),
  drawCharacters: drawMs01Characters,
  drawGraphics: drawMs01Graphics,
  drawPreOverlayFx: drawMs01PreOverlayFx,
};
