import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../models/database.js';
import { getVideoInfo, downloadVideo } from '../services/ytdlp.js';

export default function createVideoRoutes(io, processQueue) {
  const router = express.Router();

  router.post('/info', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL is required' });

      const info = await getVideoInfo(url);
      res.json(info);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/download', async (req, res) => {
    try {
      const { url, quality = 'best', format = 'mp4', filenamePattern = '%(title)s' } = req.body;
      if (!url) return res.status(400).json({ error: 'URL is required' });

      let info = {};
      try {
        info = await getVideoInfo(url);
      } catch {
        info = { title: url, thumbnail: null };
      }

      const id = uuidv4();
      const download = await db.createDownload({
        id,
        url,
        title: info.title,
        thumbnail: info.thumbnail,
        quality,
        format,
        filenamePattern,
      });

      io.emit('download-started', { id, title: info.title });
      processQueue();

      res.json({ id: download.id, status: download.status });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/bulk-download', async (req, res) => {
    try {
      const { urls, quality = 'best', format = 'mp4', filenamePattern = '%(title)s' } = req.body;
      if (!urls?.length) return res.status(400).json({ error: 'URLs array is required' });

      const batchId = uuidv4();
      const downloadIds = [];

      for (const url of urls) {
        const trimmed = url.trim();
        if (!trimmed) continue;

        let info = {};
        try {
          info = await getVideoInfo(trimmed);
        } catch {
          info = { title: trimmed, thumbnail: null };
        }

        const id = uuidv4();
        await db.createDownload({
          id,
          url: trimmed,
          title: info.title,
          thumbnail: info.thumbnail,
          quality,
          format,
          filenamePattern,
          batchId,
        });

        downloadIds.push(id);
        io.emit('download-started', { id, title: info.title });
      }

      processQueue();
      res.json({ batchId, downloadIds, status: 'queued' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export async function runDownload(download, io) {
  const { id, url, quality, format, filename_pattern: filenamePattern } = download;

  await db.updateDownload(id, { status: 'downloading', progress: 0 });

  try {
    const downloadsDir = process.env.DOWNLOADS_DIR || './downloads';
    await downloadVideo(
      url,
      downloadsDir,
      quality === 'audio' ? 'mp3' : quality,
      filenamePattern,
      (progress) => {
        db.updateDownload(id, { progress });
        io.emit('download-progress', { id, progress });
      }
    );

    await db.updateDownload(id, {
      status: 'completed',
      progress: 100,
      completed_at: new Date().toISOString(),
    });
    io.emit('download-completed', { id });
  } catch (error) {
    await db.updateDownload(id, {
      status: 'failed',
      error: error.message,
    });
    io.emit('download-failed', { id, error: error.message });
  }
}
