import express from 'express';
import * as db from '../models/database.js';

export default function createDownloadRoutes() {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { status, search, dateRange, limit, offset } = req.query;
      const result = await db.getDownloads({
        status,
        search,
        dateRange,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/status/summary', async (_req, res) => {
    try {
      const summary = await db.getStatusSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const download = await db.getDownload(req.params.id);
      if (!download) return res.status(404).json({ error: 'Download not found' });
      res.json(download);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await db.deleteDownload(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
