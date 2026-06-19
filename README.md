# Antrean Joki - TikTok LIVE Control Deck

Dashboard real-time untuk mengelola antrean joki saat streaming TikTok LIVE.
Fokus utama project ini sekarang ada di:

- antrean joki berbasis gift
- history gifter
- gift rules per mode
- overlay OBS untuk spin dan antrean

## Fitur

- **Antrean** dengan 4 status: Menunggu → Proses → Belum Dikirim → Selesai
- **Gift feed** real-time dari TikTok LIVE
- **History Gifter** searchable di dashboard
- **Gift Rules 2 mode**
  - Mode BR
  - Mode Kick
- **Per-card mode switch** untuk gift entry: tiap card antrean gift bisa diganti `Mode BR` / `Mode Kick`
- **Import / Export antrean**
- **Overlay OBS**
  - `overlay.html` untuk hasil spin
  - `queue-overlay.html` untuk antrean aktif
- **Queue overlay** hide status `done` dan auto-scroll loop saat data panjang
- **Data tersimpan di browser** via `localStorage`
- **Backend opsional** untuk online sync antar browser / OBS

## Cara Pakai

### 1. Jalankan backend

Kalau mau pakai backend sendiri, jalankan server dulu:

```bash
cd backend
npm install
node server.js
```

### 2. Jalankan tunnel kalau perlu URL online

Untuk akses dari browser lain / OBS / GitHub Pages, expose backend dengan `cloudflared`.

Named tunnel:

```bash
cloudflared tunnel --config ~/.cloudflared/config.yml run
```

Quick tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:8081
```

### 3. Buka dashboard

Dashboard utama:

```text
https://rapidtest25.github.io/Live-Tiktok-RapidTest25/
```

Isi `Username TikTok` dan `Backend URL`, lalu klik `Connect`.

### 4. Overlay OBS

Spin overlay:

```text
overlay.html?backend=YOUR_BACKEND_URL
```

Queue overlay:

```text
queue-overlay.html?backend=YOUR_BACKEND_URL
```

Contoh:

```text
https://rapidtest25.github.io/Live-Tiktok-RapidTest25/queue-overlay.html?backend=https%3A%2F%2Flive.aksocialboost.my.id
```

### 5. Windows RDP helper

Folder `backend/windows/` berisi helper untuk:

- `Task Scheduler`
- `NSSM`
- `PM2`

Lihat detail di:

```text
backend/windows/README.md
```

## Struktur

- `index.html` — dashboard utama
- `app.js` — logic antrean, gift rules, history gifter, overlay sync
- `styles.css` — styling utama dashboard
- `overlay.html` — overlay OBS hasil spin
- `queue-overlay.html` — overlay OBS antrean aktif
- `auction.html` — overlay auction / eksperimen lelang
- `auction-control.html` — control panel auction / eksperimen lelang
- `backend/` — Express + Socket.IO backend
- `backend/windows/` — helper auto-run Windows RDP

## Catatan Penting

- `diamondCount` dari TikTok event diperlakukan sebagai **total coin event**
- queue gift hanya merge dalam jendela waktu singkat agar tidak numpuk absurd
- status `done` tidak ditampilkan di queue overlay
- beberapa fitur lama seperti spinner card / sesi angka card sudah disembunyikan dari UI, tapi sebagian logic internal masih dipertahankan agar perubahan kecil tetap aman

## Development

Serve root folder dengan static server apapun jika dibutuhkan:

```bash
npx serve .
```

## Tech

- Vanilla JS
- Express + Socket.IO
- localStorage
- Cloudflared tunnel
- Wake Lock API & Notifications API

## Lisensi

MIT
