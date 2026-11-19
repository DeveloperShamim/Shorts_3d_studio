# Adding a New Video Episode (Organized Multi-Video Workflow)

All shared engine code (PRNG, characters, safe zones, captions, Fact Tags, top progress bar, vignette, film grain, GPU MP4 exporter, and CLI renderer) lives in `src/engine/` and is reused automatically across every video.

## Folder Layout
```text
public/assets/
  chars/                 # Shared Jordan & Maya PNG sprites (J_*.png, M_*.png)
  episodes/
    ms03/                # Place new episode audio (.wav/.mp3) & captions (.srt) here
src/episodes/
  registry.ts            # Central episode catalog
  ms01/                  # Money Secrets #1
  ms02/                  # Money Secrets #2
  ms03/                  # <-- Your next episode:
    meta.ts              # Duration, frames, audio/SRT paths, speakers, shot list, QC timestamps
    scene3d.ts           # Deterministic Three.js 3D worlds implementing Episode3DController
    overlay2d.ts         # Shot characters + 2D headlines/Fact Tags using shared helpers
    index.ts             # Exports MS03_EPISODE: EpisodeModule
renders/
  MoneySecrets1/         # Auto-created organized output folder per episode
  MoneySecrets2/
  MoneySecrets3/
```

## 3 Steps to Register a New Video
1. Create `src/episodes/ms03/` (`meta.ts`, `scene3d.ts`, `overlay2d.ts`, `index.ts`).
2. Add `MS03_EPISODE` to `EPISODES` in `src/episodes/registry.ts`.
3. Add the matching entry in root `episodes.json` for `node render.js --ep=ms03` and `RENDER.bat`.
