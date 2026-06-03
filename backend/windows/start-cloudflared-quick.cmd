@echo off
setlocal
set "CLOUDFLARED=%USERPROFILE%\Downloads\cloudflared.exe"
if not exist "%CLOUDFLARED%" set "CLOUDFLARED=cloudflared.exe"
"%CLOUDFLARED%" tunnel --url http://127.0.0.1:8081
