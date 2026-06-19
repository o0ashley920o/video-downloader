const trimTrailingSlash = (value) => (value ? value.replace(/\/$/, '') : '');

const BACKEND_URL = trimTrailingSlash(process.env.REACT_APP_BACKEND_URL || '');
export const API_ROOT = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

const resolveWebSocketBase = () => {
  if (BACKEND_URL) {
    return BACKEND_URL.startsWith('https://')
      ? BACKEND_URL.replace('https://', 'wss://')
      : BACKEND_URL.replace('http://', 'ws://');
  }

  if (typeof window === 'undefined') {
    return 'ws://localhost:8000';
  }

  return window.location.origin.startsWith('https://')
    ? window.location.origin.replace('https://', 'wss://')
    : window.location.origin.replace('http://', 'ws://');
};

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body:
      options.body && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const DOWNLOAD_FORMATS = [
  { value: 'best', label: 'Best available' },
  { value: '1080p', label: '1080p MP4' },
  { value: '720p', label: '720p MP4' },
  { value: '480p', label: '480p MP4' },
  { value: '360p', label: '360p MP4' },
  { value: 'audio', label: 'Audio only (MP3)' },
];

export const queueSingleDownload = (payload) =>
  requestJson('/video/download', {
    method: 'POST',
    body: payload,
  });

export const queueBulkDownload = (payload) =>
  requestJson('/video/download/bulk', {
    method: 'POST',
    body: payload,
  });

export const subscribeToJob = (jobId, onMessage, onClose) => {
  const ws = new WebSocket(`${resolveWebSocketBase()}/api/video/stream/${jobId}`);

  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch (error) {
      console.error('Failed to parse job stream event', error);
    }
  };

  ws.onclose = () => {
    if (onClose) {
      onClose();
    }
  };

  ws.onerror = (error) => {
    console.error('Job stream error', error);
  };

  return ws;
};

export const formatBytes = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  const numeric = Number(value);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let size = numeric;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(size < 10 ? 2 : 1)} ${units[index]}`;
};

export const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) {
    return '—';
  }

  const totalSeconds = Math.max(0, Math.floor(Number(seconds)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

export const formatJobStatus = (status) => {
  if (!status) {
    return 'Queued';
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
};