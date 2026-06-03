# Windows Auto-Run

Tiga opsi supaya backend tetap jalan walau jendela RDP ditutup.

## 1. Task Scheduler

Recommended kalau mau paling simpel tanpa install service manager tambahan.

```powershell
cd $env:USERPROFILE\Live-Tiktok-RapidTest25\backend\windows
powershell -ExecutionPolicy Bypass -File .\install-task-scheduler.ps1
```

Yang dibuat:

- `TikTok Live Backend`
- `TikTok Live Tunnel`

Default tunnel memakai `start-cloudflared-named.cmd`.

## 2. NSSM

Recommended kalau mau benar-benar jadi Windows Service.

1. Install NSSM dulu.
2. Edit path `NSSM=` di `install-nssm.cmd`.
3. Jalankan sebagai Administrator:

```cmd
cd %USERPROFILE%\Live-Tiktok-RapidTest25\backend\windows
install-nssm.cmd
```

## 3. PM2

Recommended kalau kamu nyaman dengan Node process manager.

Install PM2 global:

```cmd
npm install -g pm2
```

Jalankan backend:

```cmd
cd %USERPROFILE%\Live-Tiktok-RapidTest25\backend
pm2 start ecosystem.config.cjs
pm2 save
```

Cloudflared tetap jalan terpisah:

```cmd
cd %USERPROFILE%\Live-Tiktok-RapidTest25\backend\windows
start-cloudflared-named.cmd
```

## File Bantu

- `start-backend.cmd`
- `start-cloudflared-named.cmd`
- `start-cloudflared-quick.cmd`

## Catatan

Kalau mau URL backend tetap sama setelah restart, pakai **named tunnel**.
Kalau pakai **quick tunnel**, URL `trycloudflare.com` akan berubah setiap kali proses cloudflared di-restart.
