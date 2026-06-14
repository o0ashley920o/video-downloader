import { useState } from 'react';
import axios from 'axios';
import '../styles/BulkDownloader.css';

export default function BulkDownloader({ onSuccess, onError }) {
  const [urls, setUrls] = useState('');
  const [quality, setQuality] = useState('best');
  const [filenamePattern, setFilenamePattern] = useState('%(title)s');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const urlList = urls.split('\n').map((u) => u.trim()).filter(Boolean);
    if (!urlList.length) {
      onError('Please enter at least one URL');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post('/api/videos/bulk-download', {
        urls: urlList,
        quality,
        format: quality === 'audio' ? 'mp3' : 'mp4',
        filenamePattern,
      });
      onSuccess(`Queued ${data.downloadIds.length} downloads`);
      setUrls('');
    } catch (err) {
      onError(err.response?.data?.error || 'Bulk download failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="bulk-downloader" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>URLs (one per line)</label>
        <textarea
          rows={6}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="https://youtube.com/watch?v=...&#10;https://tiktok.com/@user/video/..."
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Quality</label>
          <select value={quality} onChange={(e) => setQuality(e.target.value)}>
            <option value="best">Best Available</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
            <option value="360p">360p</option>
            <option value="audio">MP3 Audio</option>
          </select>
        </div>

        <div className="form-group">
          <label>Filename Pattern</label>
          <input
            type="text"
            value={filenamePattern}
            onChange={(e) => setFilenamePattern(e.target.value)}
          />
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Queuing...' : 'Start Bulk Download'}
      </button>
    </form>
  );
}
