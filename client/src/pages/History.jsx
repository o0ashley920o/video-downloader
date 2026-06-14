import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { socket } from '../App.jsx';
import '../styles/History.css';

export default function History() {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState(null);

  const fetchDownloads = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.dateRange = dateFilter;
      if (search) params.search = search;

      const [downloadsRes, summaryRes] = await Promise.all([
        axios.get('/api/downloads', { params }),
        axios.get('/api/downloads/status/summary'),
      ]);

      setDownloads(downloadsRes.data.data);
      setSummary(summaryRes.data);
    } catch {
      setDownloads([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter, search]);

  useEffect(() => {
    fetchDownloads();
  }, [fetchDownloads]);

  useEffect(() => {
    const events = ['download-started', 'download-progress', 'download-completed', 'download-failed'];
    events.forEach((event) => socket.on(event, fetchDownloads));
    return () => events.forEach((event) => socket.off(event, fetchDownloads));
  }, [fetchDownloads]);

  const handleDelete = async (id) => {
    await axios.delete(`/api/downloads/${id}`);
    fetchDownloads();
  };

  const statuses = ['', 'completed', 'downloading', 'pending', 'failed'];
  const dates = ['', 'today', 'week', 'month'];

  return (
    <div className="history">
      <div className="history-header">
        <div>
          <h2>Download History</h2>
          {summary && (
            <p className="summary-text">
              {summary.total} total · {summary.completed} completed · {summary.downloading} active
            </p>
          )}
        </div>
        <input
          type="search"
          placeholder="Search title or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="filter-group">
        {statuses.map((s) => (
          <button
            key={s || 'all'}
            className={`filter-btn ${statusFilter === s ? 'active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="filter-group" style={{ marginBottom: 24 }}>
        {dates.map((d) => (
          <button
            key={d || 'all-time'}
            className={`filter-btn ${dateFilter === d ? 'active' : ''}`}
            onClick={() => setDateFilter(d)}
          >
            {d === 'today' ? 'Today' : d === 'week' ? 'This Week' : d === 'month' ? 'This Month' : 'All Time'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : downloads.length === 0 ? (
        <div className="empty-state">
          <h3>No downloads yet</h3>
          <p>Start by downloading a video from the Download page</p>
        </div>
      ) : (
        <div className="downloads-grid">
          {downloads.map((d) => (
            <div key={d.id} className={`download-card status-${d.status}`}>
              {d.thumbnail && (
                <img src={d.thumbnail} alt={d.title} className="download-thumbnail" />
              )}
              <div className="download-info">
                <h4 className="download-title">{d.title || d.url}</h4>
                <div className="download-meta">
                  <span className={`status-badge status-${d.status}`}>{d.status}</span>
                  {d.quality && <span className="quality-badge">{d.quality}</span>}
                </div>
                {d.status === 'downloading' && (
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${d.progress || 0}%` }} />
                    <span className="progress-text">{Math.round(d.progress || 0)}%</span>
                  </div>
                )}
                {d.error && <p className="error-text">{d.error}</p>}
                <div className="download-dates">
                  <span>Started: {new Date(d.created_at).toLocaleString()}</span>
                  {d.completed_at && <span>Completed: {new Date(d.completed_at).toLocaleString()}</span>}
                </div>
              </div>
              <div className="download-actions">
                <button className="btn-delete" onClick={() => handleDelete(d.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
