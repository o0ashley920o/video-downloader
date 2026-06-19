"# GRABBR/01 — Video Extraction Terminal (PRD)

## Original Problem Statement
> Create me a Windows program that will download videos using a URL. I want to be able to download single videos as well as bulk videos from multiple URLs.

## Resolved Approach
Built a **web-based** video downloader (accessed via browser on Windows or any OS) instead of a native Windows .exe, per user clarification. Powered by `yt-dlp` + `ffmpeg` for 1000+ site support (YouTube, Vimeo, TikTok, Twitter/X, Instagram, Facebook, Xhamster, etc.).

## User Personas
- Power downloader needing reliable, batchable extraction across many platforms
- Researcher/archivist saving content for offline review
- Casual user pulling a single video occasionally

## Core Requirements (locked)
- Single URL download with metadata preview
- Bulk URL download (paste many URLs)
- Quality/format selector (1080p / 720p / 480p / 360p / Best / Audio MP3)
- Live progress bar, ETA, speed
- Download history (ledger) with status, file size, format
- Server-side storage with download links (browser streams the file)
- Thumbnail preview before download

## Architecture
- **Backend**: FastAPI + yt-dlp + ffmpeg. Jobs persisted in MongoDB. Downloads stored in `/app/backend/downloads/`. Async background tasks with progress hooks.
- **Frontend**: React (CRA) + Tailwind + Phosphor icons + Sonner toasts. Swiss/Brutalist high-contrast design (Cabinet Grotesk + IBM Plex Mono).
- **Polling**: Frontend polls `/api/video/jobs` every 1.5s while any job is queued or downloading.

## API Surface (all under /api)
- POST `/video/info` — extract metadata for one URL
- POST `/video/info/bulk` — extract metadata for many URLs
- POST `/video/download` — queue one download (returns job)
- POST `/video/download/bulk` — queue many downloads
- GET  `/video/jobs` — list all jobs (history)
- GET  `/video/jobs/{id}` — single job status
- GET  `/video/file/{id}` — stream the downloaded file
- DELETE `/video/jobs/{id}` — delete job + file
- DELETE `/video/jobs` — clear all

## Implemented (2026-02)
- ✅ Backend: all endpoints functional, tested with Rick Astley YouTube 360p MP4 (download succeeded, 8.7MB)
- ✅ Frontend: Single tab, Bulk tab, Ledger tab — all wired with toasts and polling
- ✅ Swiss/brutalist UI per design_agent guidelines
- ✅ Format/quality selector incl. MP3 audio extraction
- ✅ Live progress bars + speed + ETA
- ✅ Thumbnail previews in single and bulk modes

## Prioritized Backlog
### P1
- Playlist support (`noplaylist=False` toggle)
- Per-job pause/resume/cancel
- Subtitles download option
### P2
- Cookie-based auth for private/geo-locked videos
- Concurrent download cap configuration
- Bulk import from `.txt` file upload
- Search & filter in history

## Test Credentials
None — app has no authentication.
"