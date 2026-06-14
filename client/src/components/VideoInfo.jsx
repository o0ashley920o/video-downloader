import '../styles/VideoInfo.css';

function formatDuration(seconds) {
  if (!seconds) return 'Unknown';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export default function VideoInfo({ info, quality, onQualityChange, filenamePattern, onFilenameChange, onDownload, downloading }) {
  if (!info) return null;

  const qualities = info.formats?.length
    ? info.formats.map((f) => f.quality)
    : ['1080p', '720p', '480p', '360p', 'audio'];

  return (
    <div className="video-info">
      <div className="video-preview">
        {info.thumbnail && (
          <img src={info.thumbnail} alt={info.title} className="video-thumbnail" />
        )}
        <div className="video-details">
          <h3 className="video-title">{info.title}</h3>
          {info.uploader && <p className="video-uploader">{info.uploader}</p>}
          <p className="video-duration">Duration: {formatDuration(info.duration)}</p>
        </div>
      </div>

      <div className="download-options">
        <div className="form-group">
          <label>Quality</label>
          <select value={quality} onChange={(e) => onQualityChange(e.target.value)}>
            {qualities.map((q) => (
              <option key={q} value={q}>{q === 'audio' ? 'MP3 Audio' : q}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Filename Pattern</label>
          <input
            type="text"
            value={filenamePattern}
            onChange={(e) => onFilenameChange(e.target.value)}
            placeholder="%(title)s"
          />
          <small className="hint">Variables: %(title)s, %(uploader)s, %(upload_date)s</small>
        </div>

        {info.formats?.length > 0 && (
          <div className="formats-list">
            {info.formats.slice(0, 5).map((f) => (
              <span key={f.quality} className="format-tag">
                {f.quality} ({f.format}{f.filesize ? ` · ${formatSize(f.filesize)}` : ''})
              </span>
            ))}
          </div>
        )}

        <button className="btn btn-primary" onClick={onDownload} disabled={downloading}>
          {downloading ? 'Starting...' : 'Download'}
        </button>
      </div>
    </div>
  );
}
