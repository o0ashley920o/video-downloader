import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import {
  API_ROOT,
  DOWNLOAD_FORMATS,
  formatBytes,
  formatDuration,
  formatJobStatus,
  queueBulkDownload,
  queueSingleDownload,
  subscribeToJob,
} from '@/lib/api';

function triggerSaveDialog(jobId, filename) {
  const a = document.createElement('a');
  a.href = `${API_ROOT}/video/file/${jobId}`;
  if (filename) {
    a.download = filename;
  }
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const DEFAULT_TEMPLATE = '%(title).80s';

const EMPTY_SINGLE = {
  url: '',
  format_choice: 'best',
  filename_template: DEFAULT_TEMPLATE,
  subtitles: 'none',
  subtitle_langs: 'en',
};

const EMPTY_BULK = {
  urls: '',
  format_choice: 'best',
  filename_template: DEFAULT_TEMPLATE,
  subtitles: 'none',
  subtitle_langs: 'en',
};

const STATUS_ORDER = ['queued', 'downloading', 'paused', 'completed', 'failed', 'cancelled'];

function splitUrls(rawText) {
  return rawText
    .split(/\r?\n|,|\s+/)
    .map((value) => value.trim())
    .filter((value) => /^https?:\/\//i.test(value));
}

function statusTone(status) {
  if (status === 'completed') {
    return 'chip chip-good';
  }

  if (status === 'failed' || status === 'cancelled') {
    return 'chip chip-bad';
  }

  if (status === 'downloading') {
    return 'chip chip-active';
  }

  return 'chip chip-neutral';
}

function JobCard({ job, onDownload }) {
  return (
    <article className="job-card">
      <div className="job-card-top">
        <div>
          <div className="job-title">{job.title || 'Untitled download'}</div>
          <div className="job-url">{job.url}</div>
        </div>
        <div className={statusTone(job.status)}>{formatJobStatus(job.status)}</div>
      </div>

      <div className="progress-track" aria-label={`Download progress ${job.progress || 0}%`}>
        <span style={{ width: `${Math.max(0, Math.min(100, Number(job.progress) || 0))}%` }} />
      </div>

      <div className="job-stats">
        <div>
          <span className="job-stat-label">Progress</span>
          <strong>{Number(job.progress || 0).toFixed(1)}%</strong>
        </div>
        <div>
          <span className="job-stat-label">Speed</span>
          <strong>{job.speed || '—'}</strong>
        </div>
        <div>
          <span className="job-stat-label">ETA</span>
          <strong>{job.eta || '—'}</strong>
        </div>
        <div>
          <span className="job-stat-label">Format</span>
          <strong>{job.format_choice || 'best'}</strong>
        </div>
      </div>

      <div className="job-footer">
        <div>
          <span className="job-stat-label">File</span>
          <strong>{job.filename || 'Waiting for yt-dlp...'}</strong>
        </div>
        <div>
          <span className="job-stat-label">Size</span>
          <strong>{formatBytes(job.filesize)}</strong>
        </div>
        <div>
          <span className="job-stat-label">Duration</span>
          <strong>{formatDuration(job.duration)}</strong>
        </div>
      </div>

      {job.error ? <div className="job-error">{job.error}</div> : null}

      {job.status === 'completed' && (
        <div className="job-save-row">
          <button
            className="button"
            type="button"
            onClick={() => onDownload(job.id, job.filename)}
          >
            Save file
          </button>
        </div>
      )}
    </article>
  );
}

function App() {
  const [singleForm, setSingleForm] = useState(EMPTY_SINGLE);
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK);
  const [jobs, setJobs] = useState([]);
  const [singlePending, setSinglePending] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [message, setMessage] = useState('Ready to queue downloads.');
  const streamRefs = useRef(new Map());
  const triggeredDownloads = useRef(new Set());

  const jobCounts = useMemo(() => {
    return STATUS_ORDER.reduce(
      (accumulator, status) => {
        accumulator[status] = jobs.filter((job) => job.status === status).length;
        return accumulator;
      },
      { queued: 0, downloading: 0, paused: 0, completed: 0, failed: 0, cancelled: 0 },
    );
  }, [jobs]);

  useEffect(() => {
    return () => {
      streamRefs.current.forEach((socket) => socket.close());
      streamRefs.current.clear();
    };
  }, []);

  const mergeJob = (incomingJob) => {
    setJobs((currentJobs) => {
      const nextJob = { ...incomingJob };
      const jobIndex = currentJobs.findIndex((job) => job.id === nextJob.id);

      if (jobIndex === -1) {
        return [nextJob, ...currentJobs];
      }

      const nextJobs = [...currentJobs];
      nextJobs[jobIndex] = { ...nextJobs[jobIndex], ...nextJob };
      return nextJobs;
    });
  };

  const closeStream = (jobId) => {
    const socket = streamRefs.current.get(jobId);
    if (socket) {
      socket.close();
      streamRefs.current.delete(jobId);
    }
  };

  const watchJob = (job) => {
    if (!job?.id || streamRefs.current.has(job.id)) {
      return;
    }

    const socket = subscribeToJob(
      job.id,
      (update) => {
        mergeJob(update);

        if (update.status === 'completed' && !triggeredDownloads.current.has(job.id)) {
          triggeredDownloads.current.add(job.id);
          triggerSaveDialog(job.id, update.filename);
        }

        if (['completed', 'failed', 'cancelled'].includes(update.status)) {
          closeStream(job.id);
        }
      },
      () => closeStream(job.id),
    );

    streamRefs.current.set(job.id, socket);
  };

  const queueJobs = (queuedJobs) => {
    queuedJobs.forEach((job) => {
      mergeJob(job);
      watchJob(job);
    });
  };

  const handleSingleSubmit = async (event) => {
    event.preventDefault();

    if (!singleForm.url.trim()) {
      setMessage('Paste a video URL first.');
      return;
    }

    setSinglePending(true);
    setMessage('Queueing single download...');

    try {
      const job = await queueSingleDownload({
        url: singleForm.url.trim(),
        format_choice: singleForm.format_choice,
        filename_template: singleForm.filename_template.trim() || DEFAULT_TEMPLATE,
        subtitles: singleForm.subtitles,
        subtitle_langs: singleForm.subtitle_langs.trim() || 'en',
      });

      queueJobs([job]);
      setMessage(`Queued ${job.title || job.url}`);
      setSingleForm((current) => ({ ...current, url: '' }));
    } catch (error) {
      setMessage(error.message || 'Unable to queue the download.');
    } finally {
      setSinglePending(false);
    }
  };

  const handleBulkSubmit = async (event) => {
    event.preventDefault();

    const urls = splitUrls(bulkForm.urls);

    if (!urls.length) {
      setMessage('Add at least one valid URL to the bulk queue.');
      return;
    }

    setBulkPending(true);
    setMessage(`Queueing ${urls.length} downloads...`);

    try {
      const queuedJobs = await queueBulkDownload({
        urls,
        format_choice: bulkForm.format_choice,
        filename_template: bulkForm.filename_template.trim() || DEFAULT_TEMPLATE,
        subtitles: bulkForm.subtitles,
        subtitle_langs: bulkForm.subtitle_langs.trim() || 'en',
      });

      queueJobs(queuedJobs);
      setMessage(`Queued ${queuedJobs.length} bulk downloads.`);
      setBulkForm(EMPTY_BULK);
    } catch (error) {
      setMessage(error.message || 'Unable to queue bulk downloads.');
    } finally {
      setBulkPending(false);
    }
  };

  const bulkUrls = splitUrls(bulkForm.urls);

  return (
    <div className="App">
      <div className="app-shell">
        <header className="hero-shell">
          <div className="hero-copy">
            <div className="eyebrow">Video Downloader / FastAPI queue</div>
            <h1>Queue downloads, track progress, and keep the browser in sync with yt-dlp.</h1>
            <p>
              This frontend now matches the FastAPI task queue in <span>backend/server.py</span>.
              Submit one URL or a batch, then watch live job updates stream back from the backend.
            </p>
          </div>

          <div className="status-stack">
            <div className="status-card">
              <span className="status-label">Connection</span>
              <strong>{message}</strong>
            </div>
            <div className="stats-row">
              <span className="chip chip-neutral">Queued {jobCounts.queued}</span>
              <span className="chip chip-active">Active {jobCounts.downloading}</span>
              <span className="chip chip-good">Done {jobCounts.completed}</span>
              <span className="chip chip-bad">Failed {jobCounts.failed}</span>
            </div>
          </div>
        </header>

        <main className="grid-two">
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">Single download</div>
                <h2>Queue one video</h2>
              </div>
              <span className="chip chip-neutral">POST /api/video/download</span>
            </div>

            <form className="field-stack" onSubmit={handleSingleSubmit}>
              <label className="field">
                <span className="label">Video URL</span>
                <input
                  className="input"
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={singleForm.url}
                  onChange={(event) => setSingleForm((current) => ({ ...current, url: event.target.value }))}
                />
              </label>

              <div className="inline-grid">
                <label className="field">
                  <span className="label">Format</span>
                  <select
                    className="select"
                    value={singleForm.format_choice}
                    onChange={(event) =>
                      setSingleForm((current) => ({ ...current, format_choice: event.target.value }))
                    }
                  >
                    {DOWNLOAD_FORMATS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="label">Subtitles</span>
                  <select
                    className="select"
                    value={singleForm.subtitles}
                    onChange={(event) =>
                      setSingleForm((current) => ({ ...current, subtitles: event.target.value }))
                    }
                  >
                    <option value="none">None</option>
                    <option value="all">All</option>
                    <option value="auto">Auto</option>
                  </select>
                </label>
              </div>

              <div className="inline-grid">
                <label className="field">
                  <span className="label">Filename template</span>
                  <input
                    className="input"
                    value={singleForm.filename_template}
                    onChange={(event) =>
                      setSingleForm((current) => ({
                        ...current,
                        filename_template: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span className="label">Subtitle languages</span>
                  <input
                    className="input"
                    value={singleForm.subtitle_langs}
                    onChange={(event) =>
                      setSingleForm((current) => ({ ...current, subtitle_langs: event.target.value }))
                    }
                    placeholder="en,es"
                  />
                </label>
              </div>

              <div className="action-row">
                <button className="button" type="submit" disabled={singlePending}>
                  {singlePending ? 'Queueing...' : 'Queue download'}
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">Bulk download</div>
                <h2>Queue many URLs</h2>
              </div>
              <span className="chip chip-neutral">POST /api/video/download/bulk</span>
            </div>

            <form className="field-stack" onSubmit={handleBulkSubmit}>
              <label className="field">
                <span className="label">URLs</span>
                <textarea
                  className="textarea"
                  placeholder={[
                    'https://youtube.com/watch?v=...',
                    'https://vimeo.com/...',
                    'https://tiktok.com/...',
                  ].join('\n')}
                  value={bulkForm.urls}
                  onChange={(event) => setBulkForm((current) => ({ ...current, urls: event.target.value }))}
                />
              </label>

              <div className="inline-grid">
                <label className="field">
                  <span className="label">Format</span>
                  <select
                    className="select"
                    value={bulkForm.format_choice}
                    onChange={(event) =>
                      setBulkForm((current) => ({ ...current, format_choice: event.target.value }))
                    }
                  >
                    {DOWNLOAD_FORMATS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="label">Subtitles</span>
                  <select
                    className="select"
                    value={bulkForm.subtitles}
                    onChange={(event) =>
                      setBulkForm((current) => ({ ...current, subtitles: event.target.value }))
                    }
                  >
                    <option value="none">None</option>
                    <option value="all">All</option>
                    <option value="auto">Auto</option>
                  </select>
                </label>
              </div>

              <div className="inline-grid">
                <label className="field">
                  <span className="label">Filename template</span>
                  <input
                    className="input"
                    value={bulkForm.filename_template}
                    onChange={(event) =>
                      setBulkForm((current) => ({
                        ...current,
                        filename_template: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span className="label">Subtitle languages</span>
                  <input
                    className="input"
                    value={bulkForm.subtitle_langs}
                    onChange={(event) =>
                      setBulkForm((current) => ({ ...current, subtitle_langs: event.target.value }))
                    }
                    placeholder="en,es"
                  />
                </label>
              </div>

              <div className="action-row">
                <div className="note">{bulkUrls.length} valid URL{bulkUrls.length === 1 ? '' : 's'} found</div>
                <button className="button secondary" type="submit" disabled={bulkPending || bulkUrls.length === 0}>
                  {bulkPending ? 'Queueing...' : 'Queue bulk'}
                </button>
              </div>
            </form>
          </section>
        </main>

        <section className="panel ledger-panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">Live ledger</div>
              <h2>Jobs stream back from FastAPI</h2>
            </div>
            <span className="chip chip-neutral">{jobs.length} jobs tracked locally</span>
          </div>

          {jobs.length === 0 ? (
            <div className="empty-state">
              No jobs yet. Queue a single URL or a batch to begin streaming progress updates.
            </div>
          ) : (
            <div className="queue-list">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} onDownload={triggerSaveDialog} />
              ))}
            </div>
          )}
        </section>

        <footer className="footer">
          <span>FastAPI task queue</span>
          <span>yt-dlp worker</span>
          <span>WebSocket progress</span>
        </footer>
      </div>
    </div>
  );
}

export default App;