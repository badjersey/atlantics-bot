# 🌊 Atlantic's Music Bot

Bot musik Discord dengan fitur lengkap — putar lagu dari YouTube, antrian, loop, shuffle, dan kontrol via tombol interaktif.

---

## 📋 Fitur
- 🎵 Putar lagu dari YouTube (nama/URL)
- 📋 Antrian lagu (queue)
- ⏸️ Pause / Resume
- ⏭️ Skip lagu
- 🔁 Mode Loop
- 🔀 Shuffle antrian
- 🔊 Atur volume
- 🎛️ Tombol kontrol interaktif
- 🗑️ Hapus lagu dari antrian

---

## 🚀 Cara Setup (Step by Step)

### LANGKAH 1 — Buat Bot di Discord Developer Portal

1. Buka https://discord.com/developers/applications
2. Klik **"New Application"** → beri nama **"Atlantic's"**
3. Buka tab **"Bot"** → klik **"Add Bot"**
4. Di bagian **Token**, klik **"Reset Token"** → salin tokennya
5. Di bagian **Privileged Gateway Intents**, aktifkan:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
6. Buka tab **"OAuth2" → "General"** → salin **Application ID** (ini adalah CLIENT_ID)

### LANGKAH 2 — Undang Bot ke Server

1. Masih di OAuth2, buka **"URL Generator"**
2. Centang scope: `bot` dan `applications.commands`
3. Centang permissions: `Connect`, `Speak`, `Send Messages`, `Embed Links`, `Read Message History`
4. Salin URL yang muncul → buka di browser → pilih servermu → klik Authorize

### LANGKAH 3 — Deploy ke Railway (Gratis)

1. Buka https://railway.app → daftar/login dengan GitHub
2. Klik **"New Project"** → **"Deploy from GitHub repo"**
3. Upload semua file bot ini ke GitHub repo baru terlebih dahulu
4. Pilih repo tersebut di Railway
5. Setelah deploy, buka tab **"Variables"** → tambahkan:
   - `TOKEN` = token bot kamu
   - `CLIENT_ID` = application ID kamu
6. Railway akan otomatis menjalankan bot!

### LANGKAH 4 — Alternatif: Deploy ke Render (Gratis)

1. Buka https://render.com → daftar dengan GitHub
2. Klik **"New" → "Background Worker"**
3. Connect ke GitHub repo bot ini
4. Isi:
   - **Name**: atlantics-bot
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
5. Di bagian **Environment Variables**, tambahkan TOKEN dan CLIENT_ID
6. Klik **"Create Background Worker"**

---

## ⚙️ Perintah Bot

| Perintah | Keterangan |
|---|---|
| `/play [lagu/URL]` | Putar lagu dari YouTube |
| `/skip` | Lewati lagu |
| `/stop` | Hentikan & kosongkan antrian |
| `/pause` | Jeda lagu |
| `/resume` | Lanjutkan lagu |
| `/queue` | Tampilkan antrian |
| `/nowplaying` | Lagu yang sedang diputar |
| `/loop` | Toggle mode loop |
| `/shuffle` | Acak antrian |
| `/volume [1-100]` | Atur volume |
| `/remove [posisi]` | Hapus lagu dari antrian |
| `/ping` | Cek latensi bot |
| `/help` | Daftar semua perintah |

---

## 🛠️ Jalankan Secara Lokal

```bash
# Install dependencies
npm install

# Salin .env.example ke .env dan isi nilainya
cp .env.example .env

# Jalankan bot
npm start
```

---

Made with ❤️ — Atlantic's Music Bot 🌊
