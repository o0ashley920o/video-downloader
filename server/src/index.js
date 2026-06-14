import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, getPendingDownloads } from './models/database.js';
import createVideoRoutes, { runDownload } from './routes/videos.js';
import createDownloadRoutes from './routes/downloads.js';
import { checkYtdlpInstalled, getResolvedYtdlpCommand } from './services/ytdlp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');

process.env.DATABASE_PATH = path.resolve(serverRoot, process.env.DATABASE_PATH || './database.sqlite');
process.env.DOWNLOADS_DIR = path.resolve(serverRoot, process.env.DOWNLOADS_DIR || './downloads');

const PORT = process.env.PORT || 5000;
const downloadsDir = process.env.DOWNLOADS_DIR;

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:5173', methods: ['GET', 'POST'] },
});

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

let isProcessing = false;

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    while (true) {
      const pending = await getPendingDownloads();
      const next = pending[0];
      if (!next) break;
      await runDownload(next, io);
    }
  } finally {
    isProcessing = false;
  }
}

app.use('/api/videos', createVideoRoutes(io, processQueue));
app.use('/api/downloads', createDownloadRoutes());

app.get('/api/health', async (_req, res) => {
  const ytdlpOk = await checkYtdlpInstalled();
  res.json({ status: 'ok', ytdlp: ytdlpOk, ytdlpCommand: getResolvedYtdlpCommand() });
});

await initDatabase();

const ytdlpOk = await checkYtdlpInstalled();
if (!ytdlpOk) {
  console.warn(`Warning: yt-dlp not found (tried: ${getResolvedYtdlpCommand()})`);
  console.warn('Set YTDLP_PATH in .env to "python -m yt_dlp" or the full path to yt-dlp.exe');
} else {
  console.log(`yt-dlp ready: ${getResolvedYtdlpCommand()}`);
}

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  processQueue();
});
