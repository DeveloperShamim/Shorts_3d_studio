import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
  CHARACTER_CATALOG,
  CharacterPose,
  CharacterPoseInfo,
  CharacterProfile,
  CharacterSpriteBank,
  drawCharacter,
} from '../engine/characters';
import {
  CHARACTER_3D_SPECS,
  Character3DId,
  Clip3DName,
  HeldPropKind,
} from '../engine/characters3d';
import {
  CHARACTER_PNG_SIZES,
  Character3DPngStudio,
  CharacterPngFraming,
  CharacterPngSizeKey,
  getDefaultPoseTime,
} from '../engine/character3dExporter';

type PreviewMouthMode = 'closed' | 'open' | 'talk';
type CharacterTab = 'all' | 'jordan' | 'maya' | 'glb3d';

interface CharacterGalleryModalProps {
  bank: CharacterSpriteBank | null;
  spriteVersion: number;
  customSpriteCount: number;
  loadedGlbKeys?: string[];
  defaultTab?: CharacterTab;
  onUploadClick: () => void;
  onClose: () => void;
}

interface PoseCanvasProps {
  bank: CharacterSpriteBank | null;
  pose: CharacterPose;
  mouthMode: PreviewMouthMode;
  spriteVersion: number;
}

const CHECKER_BG_STYLE: React.CSSProperties = {
  backgroundColor: '#101521',
  backgroundImage:
    'linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%), ' +
    'linear-gradient(-45deg, rgba(255,255,255,0.05) 25%, transparent 25%), ' +
    'linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.05) 75%), ' +
    'linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.05) 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
};

const ANGLE_PRESETS = [
  { label: 'Front', deg: 0 },
  { label: '3/4 L', deg: -28 },
  { label: '3/4 R', deg: 28 },
  { label: 'Side', deg: 72 },
  { label: 'Back', deg: 180 },
] as const;

const PROP_OPTIONS: { key: HeldPropKind; label: string }[] = [
  { key: 'none', label: 'No Prop' },
  { key: 'note', label: '$100 Bill' },
  { key: 'phone', label: 'Phone' },
  { key: 'letter', label: 'Letter' },
];

function CharacterPoseCanvas({ bank, pose, mouthMode, spriteVersion }: PoseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const activeBank = bank ?? new CharacterSpriteBank();
    let rafId = 0;
    const startWall = performance.now();

    const drawFrame = (t: number, isSpeaking: boolean) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0F1422');
      bg.addColorStop(1, '#090C14');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(24, h - 18);
      ctx.lineTo(w - 24, h - 18);
      ctx.stroke();

      drawCharacter(ctx, activeBank, {
        pose,
        x: w * 0.5,
        bottomY: h - 16,
        height: h * 0.82,
        appearElapsed: 1.0,
        isSpeaking,
        t,
      });
    };

    if (mouthMode === 'closed') {
      drawFrame(0, false);
    } else if (mouthMode === 'open') {
      drawFrame(0.15, true);
    } else {
      const tick = () => {
        const elapsed = (performance.now() - startWall) / 1000;
        drawFrame(elapsed, true);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [bank, pose, mouthMode, spriteVersion]);

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={420}
      className="h-full w-full object-contain"
    />
  );
}

/** Export any 2D character pose with 100% transparent background */
function download2DCharacterPng(
  bank: CharacterSpriteBank | null,
  poseInfo: CharacterPoseInfo,
  mouthOpen: boolean,
): void {
  const offscreen = document.createElement('canvas');
  offscreen.width = 1080;
  offscreen.height = 1350;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, offscreen.width, offscreen.height);
  drawCharacter(ctx, bank ?? new CharacterSpriteBank(), {
    pose: poseInfo.pose,
    x: offscreen.width * 0.5,
    bottomY: offscreen.height - 48,
    height: offscreen.height * 0.88,
    appearElapsed: 1.0,
    isSpeaking: mouthOpen,
    t: mouthOpen ? 0.15 : 0,
  });

  const a = document.createElement('a');
  a.href = offscreen.toDataURL('image/png');
  a.download = mouthOpen ? poseInfo.openFile : poseInfo.closedFile;
  a.click();
}

export default function CharacterGalleryModal({
  bank,
  spriteVersion,
  customSpriteCount,
  loadedGlbKeys = [],
  defaultTab = 'glb3d',
  onUploadClick,
  onClose,
}: CharacterGalleryModalProps) {
  const [selectedChar, setSelectedChar] = useState<CharacterTab>(defaultTab);
  const [mouthMode, setMouthMode] = useState<PreviewMouthMode>('talk');
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const loadedGlbSet = useMemo(() => new Set(loadedGlbKeys), [loadedGlbKeys]);

  // 3D Transparent PNG Studio state
  const studioRef = useRef<Character3DPngStudio | null>(null);
  const [studioReady, setStudioReady] = useState(false);
  const [studioChar, setStudioChar] = useState<Character3DId>('man');
  const [studioClip, setStudioClip] = useState<Clip3DName>('cheering');
  const [studioFraming, setStudioFraming] = useState<CharacterPngFraming>('full');
  const [studioYaw, setStudioYaw] = useState<number>(-18);
  const [studioMouthOpen, setStudioMouthOpen] = useState<boolean>(false);
  const [studioProp, setStudioProp] = useState<HeldPropKind>('none');
  const [studioPoseTime, setStudioPoseTime] = useState<number>(() => getDefaultPoseTime('cheering'));
  const [pngSizeKey, setPngSizeKey] = useState<CharacterPngSizeKey>('hd');
  const [studioPreviewUrl, setStudioPreviewUrl] = useState<string>('');
  const [thumbs3d, setThumbs3d] = useState<Record<string, string>>({});
  const [batchDownloading, setBatchDownloading] = useState<Character3DId | null>(null);
  const dragStartRef = useRef<{ x: number; startYaw: number } | null>(null);

  const totalPoses = useMemo(
    () => CHARACTER_CATALOG.reduce((sum, c) => sum + c.poses.length, 0),
    [],
  );

  // Clips available for the currently chosen 3D character in the studio
  const studioClipSpecs = useMemo(
    () => CHARACTER_3D_SPECS.filter((s) => s.character === studioChar && s.clip !== 'rig'),
    [studioChar],
  );

  // Initialize shared 3D PNG studio renderer when 3D tab is active
  useEffect(() => {
    if (selectedChar !== 'glb3d') return;
    let alive = true;
    const studio = new Character3DPngStudio();
    studioRef.current = studio;

    studio.ready.then(() => {
      if (!alive) return;
      setStudioReady(true);

      // Render fast transparent thumbnails for all 3D pose cards
      const generated: Record<string, string> = {};
      for (const spec of CHARACTER_3D_SPECS) {
        const clip: Clip3DName = spec.clip === 'rig' ? 'idle' : spec.clip;
        generated[spec.key] = studio.renderPngDataUrl({
          character: spec.character,
          clip,
          framing: 'full',
          yawDeg: spec.character === 'man' ? -16 : 16,
          mouthOpen: clip === 'talking' || clip === 'surprised' || clip === 'cheering',
          prop:
            clip === 'shrugging' || clip === 'looking' || clip === 'cheering'
              ? 'note'
              : 'none',
          poseTime: getDefaultPoseTime(clip),
          width: 300,
          height: 400,
        });
      }
      if (alive) {
        setThumbs3d(generated);
      }
    });

    return () => {
      alive = false;
      studio.dispose();
      studioRef.current = null;
      setStudioReady(false);
    };
  }, [selectedChar]);

  // Re-render live transparent studio preview whenever controls change
  useEffect(() => {
    if (!studioReady || !studioRef.current) return;
    const url = studioRef.current.renderPngDataUrl({
      character: studioChar,
      clip: studioClip,
      framing: studioFraming,
      yawDeg: studioYaw,
      mouthOpen: studioMouthOpen,
      prop: studioProp,
      poseTime: studioPoseTime,
      width: 480,
      height: 640,
    });
    setStudioPreviewUrl(url);
  }, [
    studioReady,
    studioChar,
    studioClip,
    studioFraming,
    studioYaw,
    studioMouthOpen,
    studioProp,
    studioPoseTime,
  ]);

  const handleSwitchStudioChar = useCallback((nextChar: Character3DId) => {
    setStudioChar(nextChar);
    const validForChar = CHARACTER_3D_SPECS.filter(
      (s) => s.character === nextChar && s.clip !== 'rig',
    );
    if (!validForChar.some((s) => s.clip === studioClip)) {
      const fallback: Clip3DName = nextChar === 'man' ? 'cheering' : 'pointing';
      setStudioClip(fallback);
      setStudioPoseTime(getDefaultPoseTime(fallback));
    }
  }, [studioClip]);

  const handleDownloadStudioPng = useCallback(() => {
    const studio = studioRef.current;
    if (!studio || !studioReady) return;
    const preset = CHARACTER_PNG_SIZES[pngSizeKey];
    studio.downloadPng({
      character: studioChar,
      clip: studioClip,
      framing: studioFraming,
      yawDeg: studioYaw,
      mouthOpen: studioMouthOpen,
      prop: studioProp,
      poseTime: studioPoseTime,
      width: preset.width,
      height: preset.height,
    });
  }, [
    pngSizeKey,
    studioChar,
    studioClip,
    studioFraming,
    studioMouthOpen,
    studioPoseTime,
    studioProp,
    studioReady,
    studioYaw,
  ]);

  const handleDownload3DCardPng = useCallback(
    (charId: Character3DId, clip: Clip3DName, key: string) => {
      const studio = studioRef.current;
      if (!studio || !studioReady) return;
      const preset = CHARACTER_PNG_SIZES[pngSizeKey];
      studio.downloadPng(
        {
          character: charId,
          clip,
          framing: studioFraming,
          yawDeg: studioYaw,
          mouthOpen:
            mouthMode === 'open' ||
            (mouthMode === 'talk' && (clip === 'talking' || clip === 'surprised' || clip === 'cheering')),
          prop: studioProp,
          poseTime: getDefaultPoseTime(clip),
          width: preset.width,
          height: preset.height,
        },
        `${charId === 'man' ? 'jordan' : 'maya'}_3d_${key.replace(/^(man|woman)_?/, '') || 'base'}_${studioFraming}_${preset.key}.png`,
      );
    },
    [mouthMode, pngSizeKey, studioFraming, studioProp, studioReady, studioYaw],
  );

  const handleDownloadAll3DCharPngs = useCallback(
    async (charId: Character3DId) => {
      const studio = studioRef.current;
      if (!studio || !studioReady || batchDownloading) return;
      setBatchDownloading(charId);
      const preset = CHARACTER_PNG_SIZES[pngSizeKey];
      const specs = CHARACTER_3D_SPECS.filter((s) => s.character === charId && s.clip !== 'rig');
      for (const spec of specs) {
        const clip = spec.clip as Clip3DName;
        studio.downloadPng(
          {
            character: charId,
            clip,
            framing: studioFraming,
            yawDeg: studioYaw,
            mouthOpen: clip === 'talking' || clip === 'surprised' || clip === 'cheering',
            prop: studioProp,
            poseTime: getDefaultPoseTime(clip),
            width: preset.width,
            height: preset.height,
          },
          `${charId === 'man' ? 'jordan' : 'maya'}_3d_${clip}_${studioFraming}_${preset.key}.png`,
        );
        await new Promise((r) => window.setTimeout(r, 180));
      }
      setBatchDownloading(null);
    },
    [batchDownloading, pngSizeKey, studioFraming, studioProp, studioReady, studioYaw],
  );

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CHARACTER_CATALOG.filter((char) => selectedChar === 'all' || char.id === selectedChar)
      .map((char): CharacterProfile => {
        if (!q) return char;
        const charMatches =
          char.name.toLowerCase().includes(q) ||
          char.role.toLowerCase().includes(q) ||
          char.prefix.toLowerCase().includes(q);
        if (charMatches) return char;
        const matchingPoses = char.poses.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            p.pose.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.closedFile.toLowerCase().includes(q) ||
            p.openFile.toLowerCase().includes(q),
        );
        return { ...char, poses: matchingPoses };
      })
      .filter((char) => char.poses.length > 0);
  }, [search, selectedChar]);

  const handleCopyPose = (poseInfo: CharacterPoseInfo) => {
    const text = `${poseInfo.closedFile}, ${poseInfo.openFile}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(poseInfo.pose);
      window.setTimeout(() => setCopiedKey(null), 1600);
    });
  };

  const handlePreviewPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, startYaw: studioYaw };
  };

  const handlePreviewPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    let next = Math.round(dragStartRef.current.startYaw + dx * 0.85);
    while (next > 180) next -= 360;
    while (next < -180) next += 360;
    setStudioYaw(next);
  };

  const handlePreviewPointerUp = () => {
    dragStartRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-6">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0E121C]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-white">
              Characters &amp; Transparent PNG Studio ({CHARACTER_CATALOG.length} Characters · {totalPoses} 2D / {CHARACTER_3D_SPECS.length} 3D)
            </h2>
            <p className="text-xs text-zinc-400">
              Export 3D Jordan &amp; Maya poses as transparent PNGs (HD / 2K / 4K) for thumbnails &amp; editing, or upload custom PNG/GLB assets.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onUploadClick}
              className="flex items-center gap-1.5 rounded-lg bg-[#FFD54A] px-3.5 py-2 text-xs font-bold text-[#090B10] hover:bg-[#ffe073] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              {selectedChar === 'glb3d'
                ? loadedGlbKeys.length > 0
                  ? `Upload GLBs (${loadedGlbKeys.length} Loaded)`
                  : 'Upload 3D GLB Files'
                : customSpriteCount > 0
                  ? `Upload PNGs (${customSpriteCount} Loaded)`
                  : 'Upload PNG / GLB'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter, Mouth State Preview, and Search Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-[#111622] px-6 py-3.5">
          {/* Character Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedChar('glb3d')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                selectedChar === 'glb3d'
                  ? 'bg-[#22E07A] text-[#07140D]'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              3D Characters + PNG Export ({CHARACTER_3D_SPECS.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedChar('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                selectedChar === 'all'
                  ? 'bg-[#FFD54A] text-[#090B10]'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              2D Sprites ({CHARACTER_CATALOG.length})
            </button>
            {CHARACTER_CATALOG.map((char) => (
              <button
                key={char.id}
                type="button"
                onClick={() => setSelectedChar(char.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  selectedChar === char.id
                    ? 'bg-white/15 text-white border border-white/25'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10 border border-transparent'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: char.colorHex }}
                />
                {char.name} ({char.poses.length})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mouth Animation Preview Mode */}
            <div className="flex items-center rounded-lg border border-white/10 bg-[#090B10] p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setMouthMode('closed')}
                className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  mouthMode === 'closed' ? 'bg-white/12 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Closed (_0)
              </button>
              <button
                type="button"
                onClick={() => setMouthMode('open')}
                className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  mouthMode === 'open' ? 'bg-white/12 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Open (_1)
              </button>
              <button
                type="button"
                onClick={() => setMouthMode('talk')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  mouthMode === 'talk' ? 'bg-[#22E07A]/20 text-[#22E07A]' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Volume2 className="h-3 w-3" />
                Live Talk
              </button>
            </div>

            {/* Search */}
            <div className="relative w-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or pose..."
                className="w-full rounded-lg border border-white/10 bg-[#090B10] py-1.5 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-[#FFD54A] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {selectedChar === 'glb3d' ? (
            <div className="space-y-8">
              {/* Interactive 3D Transparent PNG Snapshot Studio */}
              <section className="rounded-2xl border border-white/12 bg-[#131826] p-5">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {/* Left: Draggable 360° Transparent Preview */}
                  <div className="lg:col-span-5 flex flex-col gap-2.5">
                    <div
                      onPointerDown={handlePreviewPointerDown}
                      onPointerMove={handlePreviewPointerMove}
                      onPointerUp={handlePreviewPointerUp}
                      onPointerCancel={handlePreviewPointerUp}
                      style={CHECKER_BG_STYLE}
                      className="relative flex aspect-[3/4] w-full max-h-[380px] items-center justify-center overflow-hidden rounded-xl border border-white/12 cursor-grab active:cursor-grabbing select-none"
                    >
                      {studioPreviewUrl ? (
                        <img
                          src={studioPreviewUrl}
                          alt="3D Character Transparent PNG Preview"
                          draggable={false}
                          className="h-full w-full object-contain pointer-events-none"
                        />
                      ) : (
                        <div className="text-xs text-zinc-400">Initializing 3D PNG Studio...</div>
                      )}
                      <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-zinc-300">
                        <span className="rounded bg-black/70 px-2 py-0.5">
                          Transparent PNG · Drag to Rotate
                        </span>
                        <span className="rounded bg-black/70 px-2 py-0.5">
                          {studioYaw}°
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Studio Controls & Download */}
                  <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            3D Character PNG Exporter (Alpha Transparent)
                          </h3>
                          <p className="text-xs text-zinc-400">
                            Rotate, pick any pose, framing, or prop, and download crisp transparent PNGs.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setStudioYaw(0);
                            setStudioFraming('full');
                            setStudioMouthOpen(false);
                            setStudioProp('none');
                            setStudioPoseTime(getDefaultPoseTime(studioClip));
                          }}
                          className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Reset
                        </button>
                      </div>

                      {/* Character & Framing */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <div className="mb-1.5 text-[11px] font-semibold text-zinc-400">Character</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSwitchStudioChar('man')}
                              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                                studioChar === 'man'
                                  ? 'border-[#FFD54A] bg-[#FFD54A]/15 text-[#FFD54A]'
                                  : 'border-white/10 bg-[#0B0E16] text-zinc-300 hover:border-white/25'
                              }`}
                            >
                              Jordan 3D
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSwitchStudioChar('woman')}
                              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                                studioChar === 'woman'
                                  ? 'border-[#5CF2D0] bg-[#5CF2D0]/15 text-[#5CF2D0]'
                                  : 'border-white/10 bg-[#0B0E16] text-zinc-300 hover:border-white/25'
                              }`}
                            >
                              Maya 3D
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="mb-1.5 text-[11px] font-semibold text-zinc-400">Framing &amp; Mouth</div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setStudioFraming('full')}
                              className={`rounded-lg border px-2 py-2 text-xs font-semibold cursor-pointer ${
                                studioFraming === 'full'
                                  ? 'border-[#22E07A] bg-[#22E07A]/15 text-[#22E07A]'
                                  : 'border-white/10 bg-[#0B0E16] text-zinc-300'
                              }`}
                            >
                              Full
                            </button>
                            <button
                              type="button"
                              onClick={() => setStudioFraming('upper')}
                              className={`rounded-lg border px-2 py-2 text-xs font-semibold cursor-pointer ${
                                studioFraming === 'upper'
                                  ? 'border-[#22E07A] bg-[#22E07A]/15 text-[#22E07A]'
                                  : 'border-white/10 bg-[#0B0E16] text-zinc-300'
                              }`}
                            >
                              Upper
                            </button>
                            <button
                              type="button"
                              onClick={() => setStudioMouthOpen((v) => !v)}
                              className={`rounded-lg border px-2 py-2 text-xs font-semibold cursor-pointer ${
                                studioMouthOpen
                                  ? 'border-[#3CE0FF] bg-[#3CE0FF]/15 text-[#3CE0FF]'
                                  : 'border-white/10 bg-[#0B0E16] text-zinc-300'
                              }`}
                            >
                              {studioMouthOpen ? 'Mouth Open' : 'Closed'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Pose Buttons */}
                      <div>
                        <div className="mb-1.5 text-[11px] font-semibold text-zinc-400">Pose / Animation Clip</div>
                        <div className="flex flex-wrap gap-1.5">
                          {studioClipSpecs.map((spec) => {
                            const clip = spec.clip as Clip3DName;
                            const active = studioClip === clip;
                            return (
                              <button
                                key={spec.key}
                                type="button"
                                onClick={() => {
                                  setStudioClip(clip);
                                  setStudioPoseTime(getDefaultPoseTime(clip));
                                }}
                                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                                  active
                                    ? 'border-[#FFD54A] bg-[#FFD54A] text-[#090B10]'
                                    : 'border-white/10 bg-[#0B0E16] text-zinc-300 hover:border-white/25'
                                }`}
                              >
                                {spec.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Held Prop + Angle Presets */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <div className="mb-1.5 text-[11px] font-semibold text-zinc-400">Held Prop</div>
                          <div className="flex flex-wrap gap-1.5">
                            {PROP_OPTIONS.map((opt) => (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => setStudioProp(opt.key)}
                                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                                  studioProp === opt.key
                                    ? 'border-[#22E07A] bg-[#22E07A]/15 text-[#22E07A]'
                                    : 'border-white/10 bg-[#0B0E16] text-zinc-300 hover:border-white/25'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1.5 text-[11px] font-semibold text-zinc-400">Camera Angle</div>
                          <div className="flex flex-wrap gap-1.5">
                            {ANGLE_PRESETS.map((ap) => (
                              <button
                                key={ap.label}
                                type="button"
                                onClick={() => setStudioYaw(ap.deg)}
                                className={`rounded-lg border px-2 py-1 text-xs font-semibold cursor-pointer ${
                                  studioYaw === ap.deg
                                    ? 'border-[#3CE0FF] bg-[#3CE0FF]/15 text-[#3CE0FF]'
                                    : 'border-white/10 bg-[#0B0E16] text-zinc-300 hover:border-white/25'
                                }`}
                              >
                                {ap.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Rotation & Pose Frame Sliders */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block space-y-1">
                          <div className="flex justify-between text-[11px] text-zinc-400">
                            <span>Turn Angle</span>
                            <span className="font-mono text-zinc-200">{studioYaw}°</span>
                          </div>
                          <input
                            type="range"
                            min={-180}
                            max={180}
                            step={1}
                            value={studioYaw}
                            onChange={(e) => setStudioYaw(Number(e.target.value))}
                            className="w-full accent-[#FFD54A]"
                          />
                        </label>
                        <label className="block space-y-1">
                          <div className="flex justify-between text-[11px] text-zinc-400">
                            <span>Pose Frame Timing</span>
                            <span className="font-mono text-zinc-200">{studioPoseTime.toFixed(2)}s</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={2}
                            step={0.05}
                            value={studioPoseTime}
                            onChange={(e) => setStudioPoseTime(Number(e.target.value))}
                            className="w-full accent-[#22E07A]"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Resolution Picker + Primary Download Button */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                      <div className="flex items-center gap-1.5">
                        {(['hd', '2k', '4k'] as CharacterPngSizeKey[]).map((key) => {
                          const s = CHARACTER_PNG_SIZES[key];
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setPngSizeKey(key)}
                              className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-bold cursor-pointer ${
                                pngSizeKey === key
                                  ? 'border-[#FFD54A] bg-[#FFD54A]/15 text-[#FFD54A]'
                                  : 'border-white/10 bg-[#0B0E16] text-zinc-400 hover:text-white'
                              }`}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={!studioReady}
                        onClick={handleDownloadStudioPng}
                        className="flex items-center gap-2 rounded-lg bg-[#22E07A] px-4 py-2.5 text-xs font-bold text-[#07140D] hover:bg-[#3bf08e] transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
                      >
                        <Download className="h-4 w-4" />
                        Download Transparent PNG
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* All 3D Pose Cards with Live Transparent Thumbnails & 1-Click PNG Download */}
              {(['man', 'woman'] as const).map((charId) => {
                const accent = charId === 'man' ? '#FFD54A' : '#5CF2D0';
                const heading =
                  charId === 'man'
                    ? 'Jordan 3D (Yellow Hoodie & Red Cap)'
                    : 'Maya 3D (Teal Sweater & Ponytail)';
                const sub =
                  charId === 'man'
                    ? 'Caption Color #FFD54A · Click any pose to load in studio or download transparent PNG directly'
                    : 'Caption Color #5CF2D0 · Click any pose to load in studio or download transparent PNG directly';
                const items = CHARACTER_3D_SPECS.filter((s) => {
                  if (s.character !== charId) return false;
                  const q = search.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    s.fileName.toLowerCase().includes(q) ||
                    s.label.toLowerCase().includes(q) ||
                    s.description.toLowerCase().includes(q)
                  );
                });
                if (items.length === 0) return null;
                return (
                  <section key={charId} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
                        <div>
                          <h3 className="text-base font-bold text-white">{heading}</h3>
                          <p className="text-xs text-zinc-400">{sub}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!studioReady || batchDownloading !== null}
                        onClick={() => handleDownloadAll3DCharPngs(charId)}
                        className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:border-[#22E07A] hover:text-[#22E07A] transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {batchDownloading === charId
                          ? 'Downloading PNGs...'
                          : `Download All ${charId === 'man' ? 'Jordan' : 'Maya'} 3D PNGs`}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {items.map((item) => {
                        const isLoaded = loadedGlbSet.has(item.key);
                        const isCopied = copiedKey === item.key;
                        const clip: Clip3DName = item.clip === 'rig' ? 'idle' : item.clip;
                        const thumbUrl = thumbs3d[item.key];
                        return (
                          <div
                            key={item.key}
                            className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#141926]"
                          >
                            {/* Transparent 3D Thumbnail */}
                            <button
                              type="button"
                              onClick={() => {
                                setStudioChar(item.character);
                                setStudioClip(clip);
                                setStudioPoseTime(getDefaultPoseTime(clip));
                              }}
                              style={CHECKER_BG_STYLE}
                              title="Load pose in 3D PNG Studio above"
                              className="relative aspect-[3/4] w-full overflow-hidden border-b border-white/8 cursor-pointer group"
                            >
                              {thumbUrl ? (
                                <img
                                  src={thumbUrl}
                                  alt={item.label}
                                  className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                                  Rendering...
                                </div>
                              )}
                              <span
                                className={`absolute top-2.5 right-2.5 rounded bg-black/75 px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                  isLoaded ? 'text-[#22E07A]' : 'text-zinc-300'
                                }`}
                              >
                                {isLoaded ? 'GLB' : '3D'}
                              </span>
                            </button>

                            <div className="flex flex-1 flex-col justify-between p-3.5 space-y-3">
                              <div>
                                <div className="text-sm font-bold text-white">{item.label}</div>
                                <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                                  {item.description}
                                </p>
                              </div>

                              <div className="space-y-2 border-t border-white/8 pt-2.5">
                                <button
                                  type="button"
                                  disabled={!studioReady}
                                  onClick={() => handleDownload3DCardPng(item.character, clip, item.key)}
                                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#22E07A]/15 border border-[#22E07A]/35 px-3 py-1.5 text-xs font-bold text-[#22E07A] hover:bg-[#22E07A] hover:text-[#07140D] transition-colors disabled:opacity-40 cursor-pointer"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Download PNG
                                </button>
                                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                                  <span className="truncate text-zinc-400">{item.fileName}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(item.fileName).then(() => {
                                        setCopiedKey(item.key);
                                        window.setTimeout(() => setCopiedKey(null), 1600);
                                      });
                                    }}
                                    className="flex items-center gap-1 text-zinc-400 hover:text-[#FFD54A] cursor-pointer"
                                  >
                                    {isCopied ? (
                                      <Check className="h-3 w-3 text-[#22E07A]" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <>
              {filteredProfiles.map((char) => (
                <section key={char.id} className="space-y-4">
                  {/* Character Profile Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-1.5 rounded-full"
                        style={{ backgroundColor: char.colorHex }}
                      />
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-lg font-bold text-white">{char.name}</h3>
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: char.colorHex }}
                          >
                            {char.prefix}*.png
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">{char.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: char.colorHex }}
                      />
                      <span>
                        Rim &amp; Caption: <span className="font-mono text-zinc-200">{char.colorHex}</span> ({char.colorName})
                      </span>
                    </div>
                  </div>

                  {/* Pose Grid */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {char.poses.map((poseInfo) => {
                      const hasClosed = bank?.hasVariant(poseInfo.pose, false) ?? false;
                      const hasOpen = bank?.hasVariant(poseInfo.pose, true) ?? false;
                      const isCopied = copiedKey === poseInfo.pose;

                      return (
                        <div
                          key={poseInfo.pose}
                          className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#141926]"
                        >
                          {/* Live Character Preview */}
                          <div className="relative aspect-[6/7] w-full overflow-hidden bg-[#090C14]">
                            <CharacterPoseCanvas
                              bank={bank}
                              pose={poseInfo.pose}
                              mouthMode={mouthMode}
                              spriteVersion={spriteVersion}
                            />
                            <div className="pointer-events-none absolute top-2.5 left-3 flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: char.colorHex }}
                              />
                              <span className="text-xs font-bold text-white drop-shadow">
                                {char.name}
                              </span>
                            </div>
                          </div>

                          {/* Pose Name, Download PNG & File Names */}
                          <div className="flex flex-1 flex-col justify-between p-3.5 space-y-3">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-bold text-white">{poseInfo.label}</div>
                                <button
                                  type="button"
                                  onClick={() => handleCopyPose(poseInfo)}
                                  title="Copy PNG filenames"
                                  className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-[#FFD54A] transition-colors cursor-pointer"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="h-3 w-3 text-[#22E07A]" />
                                      <span className="text-[#22E07A]">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      <span>Names</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                                {poseInfo.description}
                              </p>
                            </div>

                            <div className="space-y-2 border-t border-white/8 pt-2.5">
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => download2DCharacterPng(bank, poseInfo, false)}
                                  className="flex items-center justify-center gap-1 rounded-lg bg-white/6 border border-white/10 px-2 py-1.5 text-[11px] font-semibold text-zinc-200 hover:border-[#FFD54A] hover:text-[#FFD54A] transition-colors cursor-pointer"
                                >
                                  <Download className="h-3 w-3" />
                                  PNG (_0)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => download2DCharacterPng(bank, poseInfo, true)}
                                  className="flex items-center justify-center gap-1 rounded-lg bg-white/6 border border-white/10 px-2 py-1.5 text-[11px] font-semibold text-zinc-200 hover:border-[#22E07A] hover:text-[#22E07A] transition-colors cursor-pointer"
                                >
                                  <Download className="h-3 w-3" />
                                  PNG (_1)
                                </button>
                              </div>
                              <div className="space-y-1 font-mono text-[11px]">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-zinc-300">{poseInfo.closedFile}</span>
                                  <span className={hasClosed ? 'text-[#22E07A] font-semibold' : 'text-zinc-500'}>
                                    {hasClosed ? 'PNG' : 'Built-in'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-zinc-300">{poseInfo.openFile}</span>
                                  <span className={hasOpen ? 'text-[#22E07A] font-semibold' : 'text-zinc-500'}>
                                    {hasOpen ? 'PNG' : 'Built-in'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}

              {filteredProfiles.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/12 py-12 text-center text-xs text-zinc-400">
                  No characters or poses match &ldquo;{search}&rdquo;.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
