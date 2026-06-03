@echo off
setlocal

set "NSSM=C:\nssm\win64\nssm.exe"
set "NODE=%ProgramFiles%\nodejs\node.exe"
set "BACKEND_DIR=%USERPROFILE%\Live-Tiktok-RapidTest25\backend"
set "CLOUDFLARED=%USERPROFILE%\Downloads\cloudflared.exe"

if not exist "%NSSM%" (
  echo Edit file ini dulu: path NSSM belum benar.
  exit /b 1
)

"%NSSM%" install TikTokLiveBackend "%NODE%" "server.js"
"%NSSM%" set TikTokLiveBackend AppDirectory "%BACKEND_DIR%"
"%NSSM%" set TikTokLiveBackend Start SERVICE_AUTO_START

"%NSSM%" install TikTokLiveTunnel "%CLOUDFLARED%" "tunnel --config %USERPROFILE%\.cloudflared\config.yml run"
"%NSSM%" set TikTokLiveTunnel AppDirectory "%BACKEND_DIR%"
"%NSSM%" set TikTokLiveTunnel Start SERVICE_AUTO_START

echo NSSM service selesai dibuat.
