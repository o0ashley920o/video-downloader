# 📥 Video Downloader

A modern, full-stack web application for downloading videos from 1000+ websites. Built with React, Node.js, and SQLite.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-16+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.2-blue.svg)](https://react.dev)

## ✨ Features

### 🎥 Core Downloading
- **Multi-Site Support**: Download from YouTube, TikTok, Instagram, Facebook, Twitter/X, Vimeo, and 1000+ other sites
- **Single & Bulk Downloads**: Download one video or multiple URLs at once
- **Quality Selection**: Choose from 1080p, 720p, 480p, 360p, or MP3 audio only
- **Custom Filenames**: Use patterns like `%(uploader)s - %(title)s` for organized downloads

### 🎨 User Interface
- **Thumbnail Previews**: See video thumbnails, title, duration before downloading
- **Real-time Progress**: Live progress bars showing download status
- **Dark Mode**: Toggle between light and dark themes (preference saved)
- **Responsive Design**: Works seamlessly on desktop and mobile

### 📊 Download Management
- **Download History**: Persistent history with full search capabilities
- **Advanced Filters**: 
  - Filter by status (Completed, Downloading, Failed, Pending)
  - Filter by date range (Today, This Week, This Month)
  - Search by title or URL
- **Batch Management**: Track multiple downloads in organized queue
- **Download Details**: View file size, quality, format, timestamps

### 🔧 Advanced Options
- **Filename Patterns**: Support for variables like:
  - `%(title)s` - Video title
  - `%(uploader)s` - Channel name
  - `%(upload_date)s` - Upload date
  - `%(id)s` - Video ID
  - `%(duration)s` - Duration
- **Real-time Updates**: WebSocket integration for instant progress updates
- **Error Handling**: Clear error messages and recovery options

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React 18.2 + Vite + Axios |
| **Backend** | Node.js + Express.js + Socket.io |
| **Database** | SQLite3 |
| **Downloader** | yt-dlp (1000+ sites) |
| **Styling** | CSS3 with gradients and animations |

## 📦 Installation

### Prerequisites
- Node.js 16+ ([Download](https://nodejs.org/))
- Python 3.6+ ([Download](https://www.python.org/))
- Git (optional)

### Quick Start

**1. Clone the repository:**
```bash
git clone https://github.com/o0ashley920o/video-downloader.git
cd video-downloader
```

**2. Install yt-dlp:**
```bash
# Windows
pip install yt-dlp

# Verify installation
yt-dlp --version
```

**3. Install dependencies:**
```bash
# Backend
cd server
npm install

# Frontend (new terminal)
cd ../client
npm install
```

**4. Configure environment:**
```bash
cd server
copy .env.example .env
# Edit .env if needed (defaults work fine)
```

**5. Start the servers:**
```bash
# Terminal 1: Backend
cd server
npm start
# or for development with auto-reload:
npm run dev
```

```bash
# Terminal 2: Frontend
cd client
npm run dev
```

**6. Open in browser:**
```
http://localhost:5173
```

> **See [SETUP.md](SETUP.md) for detailed installation guide with troubleshooting!**

## 🚀 Usage

### Single Download
1. Enter a video URL
2. Click "Fetch Info" to preview
3. Select quality and customize filename (optional)
4. Click "Download"
5. Monitor progress in History

### Bulk Download
1. Switch to "Bulk Download" mode
2. Paste multiple URLs (one per line)
3. Select quality and filename pattern
4. Click "Start Bulk Download"
5. All downloads queue automatically

### Using Custom Filenames
```
%(title)s                           # Just the title
%(uploader)s - %(title)s            # Channel - Title
[%(upload_date)s] %(title)s         # [Date] Title
%(uploader)s/%(title)s              # Organized in folders
```

### Advanced Filtering
1. Go to History page
2. Click ⚙️ Filters
3. Select Status (Completed, Downloading, Failed)
4. Select Date Range (Today, Week, Month)
5. Use search box for specific videos
6. Click "Clear All Filters" to reset

### Dark Mode
Click 🌙 icon in top-right header. Your preference is saved automatically.

## 📁 Project Structure

```
video-downloader/
├── server/
│   ├── src/
│   │   ├── index.js               # Server entry point
│   │   ├── routes/
│   │   │   ├── videos.js          # Download endpoints
│   │   │   └── downloads.js       # History endpoints
│   │   ├── models/
│   │   │   └── database.js        # SQLite setup
│   │   ├── services/
│   │   │   └── ytdlp.js           # yt-dlp integration
│   │   └── middleware/
│   ├── downloads/                 # Downloaded files
│   ├── database.sqlite            # SQLite database
│   ├── package.json
│   └── .env.example
├── client/
│   ├── src/
│   │   ├── App.jsx                # Main app component
│   │   ├── pages/
│   │   │   ├── Downloader.jsx     # Download page
│   │   │   └── History.jsx        # History page
│   │   ├── components/
│   │   │   ├── Header.jsx         # Navigation header
│   │   │   ├── VideoInfo.jsx      # Video preview
│   │   │   └── BulkDownloader.jsx # Bulk download
│   │   ├── styles/                # CSS files
│   │   ├── main.jsx               # React entry point
│   │   └── App.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── SETUP.md                       # Detailed setup guide
├── README.md                      # This file
└── .gitignore
```

## 🔌 API Endpoints

### Videos
```
POST /api/videos/info
  Request: { url: string }
  Response: { title, duration, thumbnail, formats, uploader }

POST /api/videos/download
  Request: { url, quality, format, filenamePattern }
  Response: { id, status }

POST /api/videos/bulk-download
  Request: { urls: [], quality, format, filenamePattern }
  Response: { batchId, downloadIds, status }
```

### Downloads
```
GET /api/downloads?status=completed&search=title&dateRange=week
  Response: { data: [], total, limit, offset }

GET /api/downloads/:id
  Response: { id, url, title, status, progress, ... }

DELETE /api/downloads/:id
  Response: { success: true }

GET /api/downloads/status/summary
  Response: { total, completed, downloading, pending, failed }
```

### WebSocket Events
```
download-started      { id, title }
download-progress     { id, progress }
download-completed    { id }
download-failed       { id, error }
```

## ⚙️ Configuration

### Server Environment Variables (`.env`)
```env
PORT=5000                              # Server port
NODE_ENV=development                   # Environment
CORS_ORIGIN=http://localhost:5173      # Frontend URL
DATABASE_PATH=./database.sqlite        # Database location
DOWNLOADS_DIR=./downloads              # Downloads folder
YTDLP_PATH=yt-dlp                      # yt-dlp command/path
```

## 🐛 Troubleshooting

### "yt-dlp is not recognized"
```bash
# Try using python module
python -m yt_dlp --version

# Or specify full path in .env
YTDLP_PATH=C:\Users\YourName\AppData\Local\Programs\Python\Python311\Scripts\yt-dlp.exe
```

### "Port 5000 is already in use"
Change `PORT` in `server/.env` to 5001 or another available port.

### "Cannot connect to backend"
- Ensure backend is running on port 5000
- Check `CORS_ORIGIN` in `.env` matches frontend URL
- Look for errors in backend terminal

### "Downloads folder permission denied"
Make sure the `server/downloads` folder is writable:
```bash
# Windows: Right-click folder → Properties → Security → Edit
# Grant write permissions to your user
```

See [SETUP.md](SETUP.md) for more troubleshooting.

## 📊 Supported Sites

yt-dlp supports 1000+ websites including:
- ✅ YouTube
- ✅ TikTok
- ✅ Instagram
- ✅ Facebook
- ✅ Twitter/X
- ✅ Vimeo
- ✅ Twitch
- ✅ Reddit
- ✅ And many more...

[See full list](https://github.com/yt-dlp/yt-dlp/blob/master/README.md#supported-sites)

## 🎯 Performance

- **Download Speed:** Limited by your internet connection
- **Concurrent Downloads:** Handles multiple downloads in queue
- **Memory Usage:** Efficient streaming prevents memory overflow
- **Database:** SQLite maintains history without slowdown
- **Real-time Updates:** WebSocket ensures instant UI updates

## 🔐 Security

- ✅ No video is stored permanently on server (except metadata)
- ✅ Downloaded files managed locally
- ✅ Secure CORS configuration
- ✅ Input validation on all endpoints
- ✅ Environment variables protect sensitive config

## 🚀 Future Enhancements

- [ ] Playlist downloading support
- [ ] Download speed limiting
- [ ] Pause/resume downloads
- [ ] Email notifications
- [ ] Scheduled downloads
- [ ] Multi-language support
- [ ] Cloud storage integration
- [ ] API documentation (Swagger)

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Feel free to:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

- 📖 See [SETUP.md](SETUP.md) for detailed setup guide
- 🐛 Report bugs via [GitHub Issues](https://github.com/o0ashley920o/video-downloader/issues)
- 💬 Ask questions in [GitHub Discussions](https://github.com/o0ashley920o/video-downloader/discussions)

## 🎉 Credits

Built with:
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Video downloader
- [React](https://react.dev) - UI framework
- [Express.js](https://expressjs.com/) - Backend framework
- [Socket.io](https://socket.io/) - Real-time communication
- [SQLite](https://www.sqlite.org/) - Database

---

**Made with ❤️ for video enthusiasts**

*Download responsibly. Respect copyright and terms of service.*
