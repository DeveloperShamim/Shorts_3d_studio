@echo off
setlocal
title Voice of Times - Multi-Episode Renderer

echo ========================================================
echo   VOICE OF TIMES - MULTI-EPISODE SHORTS RENDERER
echo ========================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Download Node.js LTS from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do echo Detected Node %%v

if not exist "node_modules\puppeteer-core" (
  echo Installing render dependencies ^(puppeteer-core, ffmpeg-static^)...
  call npm install puppeteer-core ffmpeg-static
  if %errorlevel% neq 0 (
    echo [ERROR] Failed to install render dependencies.
    pause
    exit /b 1
  )
)

if not exist "node_modules\ffmpeg-static" (
  echo Installing ffmpeg-static...
  call npm install ffmpeg-static
)

if not exist "dist\index.html" (
  echo Building local production bundle...
  call npm run build
  if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
  )
)

set "RENDER_ARGS=%*"
if "%RENDER_ARGS%"=="" (
  node render.js --list
  echo Enter episode ID ^(e.g. ms01, ms02, ms03, ms04, ms05^) or "all" to batch render every video:
  set /p EP_CHOICE="Episode [default ms05]: "
  if "%EP_CHOICE%"=="" set "EP_CHOICE=ms05"

  echo.
  echo Select Export Resolution:
  echo   [1] 1080p Full HD ^(1080x1920 · 16 Mbps^)
  echo   [2] 2K QHD        ^(1440x2560 · 28 Mbps^)
  echo   [3] 4K Ultra HD   ^(2160x3840 · 50 Mbps^)
  set /p RES_CHOICE="Enter choice [1-3, default 1]: "
  set "RES_FLAG=--res=1080p"
  if "%RES_CHOICE%"=="2" set "RES_FLAG=--res=2k"
  if "%RES_CHOICE%"=="3" set "RES_FLAG=--res=4k"

  echo.
  echo Include Subtitles?
  echo   [1] With Subtitles ^(default^)
  echo   [2] Without Subtitles
  set /p SUB_CHOICE="Enter choice [1-2, default 1]: "
  set "SUB_FLAG="
  if "%SUB_CHOICE%"=="2" set "SUB_FLAG=--no-subs"

  set "RENDER_ARGS=--ep=%EP_CHOICE% %RES_FLAG% %SUB_FLAG%"
)

echo.
echo Starting deterministic frame-by-frame MP4 render: node render.js %RENDER_ARGS%
echo Organized outputs will be saved under renders\^<slug^>\
echo.
node render.js %RENDER_ARGS%
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Render failed. Check render_log.txt for details.
  pause
  exit /b 1
)

echo.
echo Render complete! Check the renders\ folder.
pause
endlocal
