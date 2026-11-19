import { EpisodeModule } from '../../engine/episodeTypes';
import { MS05_META } from './meta';
import { drawMs05Characters, drawMs05Graphics, drawMs05PreOverlayFx } from './overlay2d';
import { Ms05ThreeEngine } from './scene3d';

export const MS05_EPISODE: EpisodeModule = {
  meta: MS05_META,
  create3DEngine: () => new Ms05ThreeEngine(),
  drawCharacters: drawMs05Characters,
  drawGraphics: drawMs05Graphics,
  drawPreOverlayFx: drawMs05PreOverlayFx,
};
