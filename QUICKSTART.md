# ⚡ Quick Start Guide (5 minutes)

Get Video Downloader running in 5 minutes!

## 1️⃣ Prerequisites (2 minutes)

Make sure you have:
- **Node.js 16+** ([Download](https://nodejs.org/))
- **Python 3.6+** ([Download](https://www.python.org/))

Verify in terminal:
```bash
node --version
python --version
```

## 2️⃣ Install yt-dlp (30 seconds)

```bash
pip install yt-dlp
yt-dlp --version
```

## 3️⃣ Clone & Install Dependencies (1.5 minutes)

```bash
# Clone repository
git clone https://github.com/o0ashley920o/video-downloader.git
cd video-downloader

# Backend
cd server
npm install

# Frontend (in new terminal)
cd ../client
npm install
```

## 4️⃣ Start Servers (1 minute)

**Terminal 1 - Backend:**
```bash
cd server
npm start
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

## 5️⃣ Open Browser

Go to: **http://localhost:5173**

---

## 🎬 Try It Out

### Download a Video
1. Paste a YouTube/TikTok/Instagram URL
2. Click "Fetch Info"
3. Select quality
4. Click "Download"
5. Go to "History" to see progress

### Bulk Download
1. Click "Bulk Download"
2. Paste 3-4 URLs (one per line)
3. Click "Start Bulk Download"
4. Watch them queue up

### Dark Mode
Click 🌙 in top-right corner

---

## ❌ Something Not Working?

### Backend won't start
- Check if port 5000 is free: `netstat -ano | findstr :5000`
- Change `PORT` in `server/.env`

### yt-dlp not found
```bash
# Try using python module
python -m yt_dlp --version
```

### Frontend won't load
- Make sure backend is running
- Check terminal for errors

---

## 📚 Need More Help?

- Full setup guide: [SETUP.md](SETUP.md)
- GitHub issues: [video-downloader/issues](https://github.com/o0ashley920o/video-downloader/issues)

---

**That's it! You're all set! 🚀**
