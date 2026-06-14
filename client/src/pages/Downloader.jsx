import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import VideoInfo from '../components/VideoInfo.jsx';
import BulkDownloader from '../components/BulkDownloader.jsx';
import '../styles/Downloader.css';

export default function Downloader() {
  const [mode, setMode] = useState('single');
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState(null);
  const [quality, setQuality] = useState('best');
  const [filenamePattern, setFilenamePattern] = useState('%(title)s');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const fetchInfo = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError('');
    setInfo(null);

    try {
      const { data } = await axios.post('/api/videos/info', { url: url.trim() });
      setInfo(data);
      if (data.formats?.length) {
        setQuality(data.formats[0].quality);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch video info');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      await axios.post('/api/videos/download', {
        url: url.trim(),
        quality,
        format: quality === 'audio' ? 'mp3' : 'mp4',
        filenamePattern,
      });
      setSuccess('Download started! Check History for progress.');
      setTimeout(() => navigate('/history'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="downloader card">
      <h2>Download Videos</h2>

      <div className="mode-tabs">
        <button
          className={`mode-tab ${mode === 'single' ? 'active' : ''}`}
          onClick={() => setMode('single')}
        >
          Single Download
        </button>
        <button
          className={`mode-tab ${mode === 'bulk' ? 'active' : ''}`}
          onClick={() => setMode('bulk')}
        >
          Bulk Download
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {mode === 'single' ? (
        <>
          <div className="url-input-group">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube, TikTok, Instagram URL..."
              onKeyDown={(e) => e.key === 'Enter' && fetchInfo()}
            />
            <button className="btn btn-primary" onClick={fetchInfo} disabled={loading}>
              {loading ? 'Fetching...' : 'Fetch Info'}
            </button>
          </div>

          {info && (
            <VideoInfo
              info={info}
              quality={quality}
              onQualityChange={setQuality}
              filenamePattern={filenamePattern}
              onFilenameChange={setFilenamePattern}
              onDownload={handleDownload}
              downloading={downloading}
            />
          )}
        </>
      ) : (
        <BulkDownloader
          onSuccess={(msg) => { setSuccess(msg); setError(''); setTimeout(() => navigate('/history'), 1500); }}
          onError={(msg) => { setError(msg); setSuccess(''); }}
        />
      )}
    </div>
  );
}
