# Antrean Joki - TikTok LIVE Control Deck

Dashboard real-time untuk mengelola antrean joki saat streaming TikTok LIVE.
Chat & gift feed, antrean terpadu dengan 4 status, gift rules, dan spinner
pemenang — semua di satu halaman.

## Fitur

- **Antrean** dengan 4 status: Menunggu → Proses → Belum Dikirim → Selesai
- **Live Chat & Gift feed** real-time via WebSocket
- **Gift Rules** untuk auto-trigger joki berdasarkan nama gift atau jumlah coin
- **Default rule (catch-all)** untuk gift yang belum punya rule spesifik
- **Spinner** undian pemenang dari sesi angka chat
- **Background mode** — tab bekerja walau tidak terlihat (Wake Lock + auto-reconnect)
- **Export / Import** TXT atau JSON, dengan filter per status
- **Data tersimpan di browser** (localStorage), tanpa database, tanpa backend sendiri

## Cara Pakai

### 1. Online (GitHub Pages)

Cukup buka URL GitHub Pages repo ini. Backend otomatis menggunakan
server publik `tiktok-chat-reader.zerody.one`.

### 2. Local (jalankan sendiri)

Kalau mau pakai backend sendiri, jalankan server lokal dulu:

```bash
cd backend
npm install
node server.js
```

Lalu buka `index.html` (browser akan load dari `file://` dan otomatis
fallback ke `https://tiktok-chat-reader.zerody.one/` kalau gagal konek).

Atau serve root folder dengan static server apapun:

```bash
npx serve .
```

## Struktur

- `index.html` — entry point
- `app.js` — semua logic (chat handler, gift rules, antrean, spinner, dll)
- `styles.css` — styling
- `backend/` — server opsional (berbasis [TikTok-Chat-Reader](https://github.com/zerodytrash/TikTok-Chat-Reader))

## Tech

- Vanilla JS (no framework)
- localStorage untuk persistence
- WebSocket ke TikTok Chat Reader backend
- Wake Lock API & Notifications API (untuk background mode)

## Lisensi

MIT
