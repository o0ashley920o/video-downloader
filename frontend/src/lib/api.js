import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 60000 });

export const fetchInfo = (url) => api.post("/video/info", { url }).then((r) => r.data);
export const fetchInfoBulk = (urls) => api.post("/video/info/bulk", { urls }).then((r) => r.data);
export const startDownload = (payload) => api.post("/video/download", payload).then((r) => r.data);
export const startBulkDownload = (payload) => api.post("/video/download/bulk", payload).then((r) => r.data);
export const listJobs = () => api.get("/video/jobs").then((r) => r.data);
export const deleteJob = (id) => api.delete(`/video/jobs/${id}`).then((r) => r.data);
export const clearAllJobs = () => api.delete("/video/jobs").then((r) => r.data);
export const fileUrl = (id) => `${API}/video/file/${id}`;

// Controller endpoints
export const pauseJob = (id) => api.post(`/video/jobs/${id}/paused`).then((r) => r.data);
export const resumeJob = (id) => api.post(`/video/jobs/${id}/resume`).then((r) => r.data);
export const cancelJob = (id) => api.post(`/video/jobs/${id}/cancel`).then((r) => r.data);

export const streamJobProgress = (jobId, onMessageCallback, onCloseCallback) => {
  const wsUrl = BACKEND_URL.replace(/^http/, "ws");
  const ws = new WebSocket(`${wsUrl}/api/video/stream/${jobId}`);

  ws.onopen = () => {
    console.log(`Connected to progress stream for job: ${jobId}`);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessageCallback(data);
  };

  ws.onclose = () => {
    console.log(`Stream disconnected for job: ${jobId}`);
    if (onCloseCallback) onCloseCallback();
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return ws;
};

export const FORMAT_OPTIONS = [
  { value: "best", label: "Best Available" },
  { value: "1080p", label: "1080p MP4" },
  { value: "720p", label: "720p MP4" },
  { value: "480p", label: "480p MP4" },
  { value: "360p", label: "360p MP4" },
  { value: "audio", label: "Audio (MP3)" },
];

export const formatBytes = (b) => {
  if (!b && b !== 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
};

export const formatDuration = (s) => {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};