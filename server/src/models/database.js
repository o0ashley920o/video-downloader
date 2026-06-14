import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '../..');

sqlite3.verbose();
let db;

function getDb() {
  if (!db) {
    const dbPath = path.resolve(serverRoot, process.env.DATABASE_PATH || './database.sqlite');
    db = new sqlite3.Database(dbPath);
  }
  return db;
}

export function initDatabase() {
  return new Promise((resolve, reject) => {
    getDb().serialize(() => {
      getDb().run(`
        CREATE TABLE IF NOT EXISTS downloads (
          id TEXT PRIMARY KEY,
          url TEXT NOT NULL,
          title TEXT,
          thumbnail TEXT,
          quality TEXT,
          format TEXT,
          filename_pattern TEXT,
          status TEXT DEFAULT 'pending',
          progress REAL DEFAULT 0,
          file_path TEXT,
          file_size INTEGER,
          error TEXT,
          batch_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          completed_at TEXT
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export async function createDownload(data) {
  const { id, url, title, thumbnail, quality, format, filenamePattern, batchId } = data;
  await run(
    `INSERT INTO downloads (id, url, title, thumbnail, quality, format, filename_pattern, status, batch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [id, url, title || null, thumbnail || null, quality, format, filenamePattern, batchId || null]
  );
  return get('SELECT * FROM downloads WHERE id = ?', [id]);
}

export async function updateDownload(id, fields) {
  const allowed = ['title', 'thumbnail', 'status', 'progress', 'file_path', 'file_size', 'error', 'completed_at'];
  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(fields)) {
    const col = key === 'filePath' ? 'file_path' : key === 'fileSize' ? 'file_size' : key;
    if (allowed.includes(col)) {
      updates.push(`${col} = ?`);
      values.push(value);
    }
  }

  if (updates.length === 0) return get('SELECT * FROM downloads WHERE id = ?', [id]);

  values.push(id);
  await run(`UPDATE downloads SET ${updates.join(', ')} WHERE id = ?`, values);
  return get('SELECT * FROM downloads WHERE id = ?', [id]);
}

export async function getDownload(id) {
  return get('SELECT * FROM downloads WHERE id = ?', [id]);
}

export async function deleteDownload(id) {
  await run('DELETE FROM downloads WHERE id = ?', [id]);
  return { success: true };
}

export async function getDownloads({ status, search, dateRange, limit = 50, offset = 0 } = {}) {
  let sql = 'SELECT * FROM downloads WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND (title LIKE ? OR url LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (dateRange === 'today') {
    sql += " AND date(created_at) = date('now')";
  } else if (dateRange === 'week') {
    sql += " AND created_at >= datetime('now', '-7 days')";
  } else if (dateRange === 'month') {
    sql += " AND created_at >= datetime('now', '-30 days')";
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countRow = await get(countSql, params);

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const data = await all(sql, params);
  return { data, total: countRow?.count || 0, limit, offset };
}

export async function getStatusSummary() {
  const rows = await all(`
    SELECT status, COUNT(*) as count FROM downloads GROUP BY status
  `);

  const summary = { total: 0, completed: 0, downloading: 0, pending: 0, failed: 0 };
  for (const row of rows) {
    summary[row.status] = row.count;
    summary.total += row.count;
  }
  return summary;
}

export async function getPendingDownloads() {
  return all("SELECT * FROM downloads WHERE status = 'pending' ORDER BY created_at ASC");
}

export default getDb;
