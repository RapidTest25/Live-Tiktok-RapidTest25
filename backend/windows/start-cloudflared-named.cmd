@echo off
setlocal
set "CLOUDFLARED=%USERPROFILE%\Downloads\cloudflared.exe"
if not exist "%CLOUDFLARED%" set "CLOUDFLARED=cloudflared.exe"
"%CLOUDFLARED%" tunnel --config "%USERPROFILE%\.cloudflared\config.yml" run
