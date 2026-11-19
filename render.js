#!/usr/bin/env node
/**
 * Voice of Times — Multi-Episode Deterministic Frame-by-Frame MP4 Renderer
 * Supports unlimited organized episodes via episodes.json (1080p, 2K, 4K · With or Without Subtitles).
 *
 * Outputs are neatly organized per episode:
 *   renders/<slug>/<slug>_SHORT_<res>[_nosubs].mp4
 *   renders/<slug>/preview_stills/
 *   renders/<slug>/render_log.txt
 *
 * Usage:
 *   node render.js --list                                   -> List all registered episodes
 *   node render.js --ep=ms01                                -> Render Money Secrets #1 (1080p, with subtitles)
 *   node render.js --ep=ms02 --res=4k --no-subs             -> Render Money Secrets #2 (4K, without subtitles)
 *   node render.js --ep=all --res=1080p                     -> Batch render ALL episodes sequentially
 *   node render.js --ep=ms02 --stills [--res=2k] [--no-subs] -> Render QC preview stills into renders/<slug>/preview_stills/
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANIFEST_PATH = path.join(__dirname, 'episodes.json');
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('FATAL ERROR: episodes.json not found in project root.');
  process.exit(1);
}
const MANIFEST = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

const RESOLUTION_PRESETS = {
  '1080p': { key: '1080p', width: 1080, height: 1920, bitrate: '16M', maxrate: '20M', bufsize: '32M' },
  '2k': { key: '2k', width: 1440, height: 2560, bitrate: '28M', maxrate: '36M', bufsize: '56M' },
  '4k': { key: '4k', width: 2160, height: 3840, bitrate: '50M', maxrate: '65M', bufsize: '100M' },
};

function parseArgs(argv) {
  let epArg = MANIFEST.defaultEpisode || (MANIFEST.episodes[0] && MANIFEST.episodes[0].id) || 'ms02';
  let resKey = '1080p';
  let subtitles = true;
  let stillsOnly = false;
  let listOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    const arg = raw.toLowerCase();
    if (arg === '--list' || arg === '-l') {
      listOnly = true;
    } else if (arg === '--stills') {
      stillsOnly = true;
    } else if (arg === '--no-subs' || arg === '--nosubs' || arg === '--subtitles=false' || arg === '--subtitles=0') {
      subtitles = false;
    } else if (arg === '--subs' || arg === '--subtitles=true' || arg === '--subtitles=1') {
      subtitles = true;
    } else if (arg.startsWith('--ep=')) {
      epArg = raw.slice(5).trim();
    } else if ((arg === '--ep' || arg === '-e') && argv[i + 1]) {
      epArg = argv[++i].trim();
    } else if (arg.startsWith('--res=')) {
      const val = arg.slice(6);
      if (val === '4k' || val === '2160' || val === '2160p') resKey = '4k';
      else if (val === '2k' || val === '1440' || val === '1440p') resKey = '2k';
      else resKey = '1080p';
    } else if (arg === '--res' && argv[i + 1]) {
      const val = argv[++i].toLowerCase();
      if (val === '4k' || val === '2160' || val === '2160p') resKey = '4k';
      else if (val === '2k' || val === '1440' || val === '1440p') resKey = '2k';
      else resKey = '1080p';
    } else if (arg === '--4k') {
      resKey = '4k';
    } else if (arg === '--2k') {
      resKey = '2k';
    } else if (arg === '--1080p' || arg === '--1080') {
      resKey = '1080p';
    }
  }

  return { epArg, preset: RESOLUTION_PRESETS[resKey], subtitles, stillsOnly, listOnly };
}

const ARGS = parseArgs(process.argv.slice(2));
const { preset: RES, subtitles: WITH_SUBTITLES, stillsOnly: STILLS_ONLY } = ARGS;
const WIDTH = RES.width;
const HEIGHT = RES.height;
const SUB_SUFFIX = WITH_SUBTITLES ? '' : '_nosubs';

if (ARGS.listOnly) {
  console.log(`\n${MANIFEST.channel} — Registered Episodes (${MANIFEST.episodes.length}):`);
  for (const ep of MANIFEST.episodes) {
    const defTag = ep.id === MANIFEST.defaultEpisode ? ' (default)' : '';
    console.log(
      `  [${ep.id}] ${ep.series} #${ep.episodeNumber} — ${ep.title} (${ep.duration}s, ${ep.totalFrames} frames)${defTag}`,
    );
  }
  console.log('\nExamples:');
  console.log('  node render.js --ep=ms01 --res=1080p');
  console.log('  node render.js --ep=ms02 --res=4k --no-subs');
  console.log('  node render.js --ep=all --res=1080p\n');
  process.exit(0);
}

function resolveTargetEpisodes(epArg) {
  const normalized = epArg.toLowerCase();
  if (normalized === 'all') {
    return MANIFEST.episodes;
  }
  const match = MANIFEST.episodes.find(
    (e) =>
      e.id.toLowerCase() === normalized ||
      e.slug.toLowerCase() === normalized ||
      String(e.episodeNumber) === normalized,
  );
  if (!match) {
    const ids = MANIFEST.episodes.map((e) => e.id).join(', ');
    throw new Error(`Unknown episode "${epArg}". Available episodes: ${ids}, or "all".`);
  }
  return [match];
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.srt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

const ROOT_LOG_FILE = path.join(__dirname, 'render_log.txt');
fs.writeFileSync(
  ROOT_LOG_FILE,
  `=== ${MANIFEST.channel} Multi-Episode Render Log (${new Date().toISOString()}) | target=${ARGS.epArg} | ${RES.key} (${WIDTH}x${HEIGHT}) | subtitles=${WITH_SUBTITLES} ===\n`,
);

let activeEpisodeLogFile = null;

function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  fs.appendFileSync(ROOT_LOG_FILE, line + '\n');
  if (activeEpisodeLogFile) {
    fs.appendFileSync(activeEpisodeLogFile, line + '\n');
  }
}

function findMasterAudio(ep) {
  const candidates = (ep.audioCandidates || []).map((rel) => path.join(__dirname, rel));
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    `Master audio not found for ${ep.id} (${ep.slug}). Checked:\n  - ${(ep.audioCandidates || []).join('\n  - ')}`,
  );
}

function findBrowserExecutable() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const platform = os.platform();
  const candidates =
    platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        ]
      : platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/microsoft-edge',
          ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error(
    'Chrome/Edge executable not found. Install Google Chrome or Edge, or set CHROME_PATH.',
  );
}

async function resolveFfmpegPath() {
  try {
    const mod = await import('ffmpeg-static');
    if (mod.default && fs.existsSync(mod.default)) return mod.default;
  } catch {
    // Fall back to system ffmpeg on PATH
  }
  const which = spawnSync(os.platform() === 'win32' ? 'where' : 'which', ['ffmpeg'], {
    encoding: 'utf-8',
  });
  if (which.status === 0 && which.stdout.trim()) {
    return which.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('ffmpeg not found. Run: npm install ffmpeg-static');
}

function detectBestH264Encoder(ffmpegBin) {
  const gpuCandidates =
    os.platform() === 'darwin'
      ? ['h264_videotoolbox', 'h264_nvenc', 'h264_amf', 'h264_qsv']
      : ['h264_nvenc', 'h264_amf', 'h264_qsv', 'h264_videotoolbox'];
  const encList = spawnSync(ffmpegBin, ['-hide_banner', '-encoders'], { encoding: 'utf-8' });
  const available = encList.stdout || '';

  for (const enc of gpuCandidates) {
    if (!available.includes(enc)) continue;
    const probe = spawnSync(
      ffmpegBin,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=256x256:d=0.1',
        '-frames:v',
        '2',
        ...buildEncoderArgs(enc),
        '-f',
        'null',
        '-',
      ],
      { encoding: 'utf-8' },
    );
    if (probe.status === 0) {
      log(`Hardware GPU H.264 encoder verified: ${enc}`);
      return enc;
    }
  }

  log('No hardware GPU H.264 encoder available on this machine; falling back to libx264.');
  return 'libx264';
}

function buildEncoderArgs(encoder) {
  const common = [
    '-c:v',
    encoder,
    '-profile:v',
    'high',
    '-b:v',
    RES.bitrate,
    '-maxrate',
    RES.maxrate,
    '-bufsize',
    RES.bufsize,
    '-g',
    '15',
    '-pix_fmt',
    'yuv420p',
  ];

  if (encoder === 'h264_nvenc') {
    return [...common, '-rc', 'vbr', '-preset', 'p5', '-bf', '2'];
  }
  if (encoder === 'h264_amf') {
    return [...common, '-rc', 'vbr_peak', '-quality', 'quality'];
  }
  if (encoder === 'h264_qsv') {
    return [...common, '-preset', 'medium'];
  }
  if (encoder === 'h264_videotoolbox') {
    return [...common, '-allow_sw', '0', '-realtime', '0'];
  }
  return [...common, '-preset', 'medium'];
}

function ensureBuiltDist() {
  const distIndex = path.join(__dirname, 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    log('dist/index.html not found — running "npm run build" to bundle Three.js & Poppins locally...');
    execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });
  }
}

function scanCharacterPngs() {
  const dirs = [
    path.join(__dirname, 'assets', 'chars'),
    path.join(__dirname, 'public', 'assets', 'chars'),
  ];
  const found = new Map();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.toLowerCase().endsWith('.png') && !found.has(file)) {
        found.set(file, path.join(dir, file));
      }
    }
  }
  return found;
}

function startLocalServer(distDir) {
  const charMap = scanCharacterPngs();
  log(`Discovered ${charMap.size} custom character PNG sprite(s) in assets/chars/.`);

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(urlObj.pathname);

      if (pathname === '/assets/chars/manifest.json') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ files: Array.from(charMap.keys()) }));
        return;
      }

      if (pathname.startsWith('/assets/chars/')) {
        const fname = path.basename(pathname);
        const fullPath = charMap.get(fname);
        if (fullPath && fs.existsSync(fullPath)) {
          res.writeHead(200, { 'Content-Type': 'image/png' });
          fs.createReadStream(fullPath).pipe(res);
          return;
        }
      }

      // Allow local episode SRT override files in project root or assets/episodes/<id>/
      if (pathname.endsWith('.srt')) {
        const requestedBase = path.basename(pathname);
        for (const ep of MANIFEST.episodes) {
          for (const rel of ep.srtCandidates || []) {
            const full = path.join(__dirname, rel);
            if (path.basename(full) === requestedBase && fs.existsSync(full)) {
              res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
              fs.createReadStream(full).pipe(res);
              return;
            }
          }
        }
      }

      const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      let filePath = path.join(distDir, relPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

async function renderEpisode(page, port, ep, ffmpegBin, encoder) {
  const epOutDir = path.join(__dirname, 'renders', ep.slug);
  fs.mkdirSync(epOutDir, { recursive: true });
  activeEpisodeLogFile = path.join(epOutDir, 'render_log.txt');
  fs.writeFileSync(
    activeEpisodeLogFile,
    `=== ${ep.series} #${ep.episodeNumber}: ${ep.title} (${new Date().toISOString()}) | ${RES.key} (${WIDTH}x${HEIGHT}) | subtitles=${WITH_SUBTITLES} ===\n`,
  );

  const fps = ep.fps || 30;
  const dur = ep.duration;
  const totalFrames = ep.totalFrames || Math.round(dur * fps);
  const pageUrl = `http://127.0.0.1:${port}/?render=1&ep=${encodeURIComponent(ep.id)}&res=${RES.key}&subtitles=${WITH_SUBTITLES ? '1' : '0'}`;

  log(`--- Starting [${ep.id}] ${ep.series} #${ep.episodeNumber}: ${ep.title} ---`);
  log(`Navigating to ${pageUrl}`);

  await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => window.ready);
  const pageDur = await page.evaluate(() => window.DUR);
  const pageEp = await page.evaluate(() => window.EPISODE_ID);
  const gpuRenderer = await page.evaluate(() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { powerPreference: 'high-performance' });
      if (!gl) return 'Unavailable';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return String(name || 'WebGL2 GPU');
    } catch {
      return 'Unknown';
    }
  });
  log(`Engine ready. EPISODE_ID=${pageEp} | window.DUR=${pageDur}s (${totalFrames} frames @ ${fps} fps) | WebGL GPU: ${gpuRenderer}`);

  if (STILLS_ONLY) {
    const stillsDir = path.join(epOutDir, 'preview_stills');
    fs.mkdirSync(stillsDir, { recursive: true });
    const qcTimes = ep.qcTimestamps || [1, 10, 20, 30, 40, 50];
    for (const ts of qcTimes) {
      const dataUrl = await page.evaluate((sec) => window.frameJPEG(sec), ts);
      const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const outFile = path.join(stillsDir, `still_${RES.key}${SUB_SUFFIX}_${String(ts).padStart(4, '0')}s.jpg`);
      fs.writeFileSync(outFile, Buffer.from(b64, 'base64'));
      log(`Saved QC still: renders/${ep.slug}/preview_stills/${path.basename(outFile)}`);
    }
    log(`All ${qcTimes.length} QC stills written to ${stillsDir}`);
    return;
  }

  const audioPath = findMasterAudio(ep);
  log(`Master audio: ${audioPath}`);
  const outputMp4 = path.join(epOutDir, `${ep.slug}_SHORT_${RES.key}${SUB_SUFFIX}.mp4`);

  const ffmpegArgs = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-f',
    'image2pipe',
    '-vcodec',
    'mjpeg',
    '-framerate',
    String(fps),
    '-i',
    'pipe:0',
    '-i',
    audioPath,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    ...buildEncoderArgs(encoder),
    '-c:a',
    'aac',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-b:a',
    '320k',
    '-movflags',
    '+faststart',
    '-t',
    String(dur),
    outputMp4,
  ];

  log(`Starting ffmpeg (${encoder}) -> renders/${ep.slug}/${path.basename(outputMp4)}`);
  const ff = spawn(ffmpegBin, ffmpegArgs, { stdio: ['pipe', 'inherit', 'pipe'] });
  ff.stderr.on('data', (chunk) => log(`[ffmpeg] ${chunk.toString().trim()}`));

  const ffClosed = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`)),
    );
  });

  const startTime = Date.now();
  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    const dataUrl = await page.evaluate((sec) => window.frameJPEG(sec), t);
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const buf = Buffer.from(b64, 'base64');

    if (!ff.stdin.write(buf)) {
      await new Promise((res) => ff.stdin.once('drain', res));
    }

    if (i % 30 === 0 || i === totalFrames - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const fpsDone = (i + 1) / Math.max(0.01, elapsed);
      const eta = (totalFrames - i - 1) / Math.max(0.01, fpsDone);
      const pct = (((i + 1) / totalFrames) * 100).toFixed(1);
      log(
        `[${ep.id}] Frame ${String(i + 1).padStart(4, '0')}/${totalFrames} (${pct}%) · t=${t.toFixed(2)}s · ${fpsDone.toFixed(1)} fps · ETA ${eta.toFixed(0)}s`,
      );
    }
  }

  ff.stdin.end();
  await ffClosed;

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const sizeMb = (fs.statSync(outputMp4).size / (1024 * 1024)).toFixed(2);
  log(`DONE [${ep.id}] -> ${outputMp4} (${sizeMb} MB) in ${totalSec}s.`);
}

async function main() {
  const targets = resolveTargetEpisodes(ARGS.epArg);
  ensureBuiltDist();

  const puppeteer = await import('puppeteer-core');
  const chromePath = findBrowserExecutable();
  log(`Using browser: ${chromePath}`);
  log(`Target episodes: ${targets.map((e) => e.id).join(', ')}`);
  log(`Preset: ${RES.key.toUpperCase()} (${WIDTH}x${HEIGHT}, ${RES.bitrate} VBR / ${RES.maxrate} max) · Subtitles: ${WITH_SUBTITLES ? 'ON' : 'OFF'}`);

  let ffmpegBin = null;
  let encoder = null;
  if (!STILLS_ONLY) {
    ffmpegBin = await resolveFfmpegPath();
    encoder = detectBestH264Encoder(ffmpegBin);
  }

  const distDir = path.join(__dirname, 'dist');
  const { server, port } = await startLocalServer(distDir);

  const chromeArgs = [
    '--ignore-gpu-blocklist',
    '--enable-gpu',
    '--enable-webgl',
    '--enable-accelerated-2d-canvas',
    '--enable-gpu-rasterization',
    '--enable-zero-copy',
    '--disable-software-rasterizer',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    `--window-size=${WIDTH},${HEIGHT}`,
  ];
  if (os.platform() === 'win32') {
    chromeArgs.push('--use-gl=angle', '--use-angle=d3d11');
  } else if (os.platform() === 'darwin') {
    chromeArgs.push('--use-gl=angle', '--use-angle=metal');
  } else {
    chromeArgs.push('--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan');
  }

  const browser = await puppeteer.default.launch({
    executablePath: chromePath,
    headless: 'new',
    args: chromeArgs,
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
  });

  try {
    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') log(`[browser error] ${msg.text()}`);
    });
    page.on('pageerror', (err) => log(`[pageerror] ${err.message}`));

    for (const ep of targets) {
      await renderEpisode(page, port, ep, ffmpegBin, encoder);
    }

    activeEpisodeLogFile = null;
    log(`ALL DONE! Rendered ${targets.length} episode(s) into renders/<slug>/.`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  log(`FATAL ERROR: ${err.stack || err.message}`);
  process.exit(1);
});
