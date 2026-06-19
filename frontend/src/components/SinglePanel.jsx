import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { MagnifyingGlass, DownloadSimple, Link, Pause, Play, XCircle } from "@phosphor-icons/react";
import { fetchInfo, startDownload, FORMAT_OPTIONS, streamJobProgress, pauseJob, resumeJob, cancelJob } from "@/lib/api";
import { VideoPreview } from "@/components/VideoPreview";
import { SINGLE } from "@/constants/testIds";

export const SinglePanel = ({ onJobsCreated }) => {
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState(null);
  const [fmt, setFmt] = useState("best");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeJob, setActiveJob] = useState(null);

  useEffect(() => {
    if (!activeJob?.id || ["completed", "failed", "cancelled"].includes(activeJob?.status)) {
      return;
    }

    const ws = streamJobProgress(
      activeJob.id,
      (updatedData) => {
        setActiveJob((prev) => (prev ? { ...prev, ...updatedData } : updatedData));
      },
      () => {
        console.log("WebSocket connection closed cleanly.");
      }
    );

    return () => {
      ws.close();
    };
  }, [activeJob?.id, activeJob?.status]);

  const onFetch = async () => {
    if (!url.trim()) return toast.error("Paste a URL first");
    setLoading(true);
    setInfo(null);
    try {
      const data = await fetchInfo(url.trim());
      setInfo(data);
      if (data.error) toast.error("Could not fetch info");
      else toast.success("Metadata extracted");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fetch failed");
    } finally {
      setLoading(false);
    }
  };

  const onDownload = async () => {
    if (!url.trim()) return toast.error("Paste a URL first");
    setDownloading(true);
    try {
      const job = await startDownload({
        url: url.trim(),
        title: info?.title,
        thumbnail: info?.thumbnail,
        format_choice: fmt,
      });
      toast.success(`Queued: ${(info?.title || "Video").slice(0, 50)}`);
      setActiveJob(job);
      onJobsCreated?.([job]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handlePause = async () => {
    if (!activeJob) return;
    try {
      const res = await pauseJob(activeJob.id);
      setActiveJob(res);
      toast.success("Download paused");
    } catch (e) {
      toast.error("Failed to pause download");
    }
  };

  const handleResume = async () => {
    if (!activeJob) return;
    try {
      const res = await resumeJob(activeJob.id);
      setActiveJob(res);
      toast.success("Resuming download...");
    } catch (e) {
      toast.error("Failed to resume download");
    }
  };

  const handleCancel = async () => {
    if (!activeJob) return;
    try {
      const res = await cancelJob(activeJob.id);
      setActiveJob(res);
      toast.success("Download cancelled");
    } catch (e) {
      toast.error("Failed to cancel download");
    }
  };

  return (
    <div className="space-y-6">
      <div className="brutal-card p-6 lg:p-8">
        <div className="label-xs mb-3">INPUT / TARGET URL</div>
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Link
              size={18}
              weight="bold"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737373]"
            />
            <input
              data-testid={SINGLE.urlInput}
              type="url"
              className="brutal-input pl-11"
              placeholder="https://youtube.com/watch?v=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onFetch()}
            />
          </div>
          <button
            data-testid={SINGLE.fetchBtn}
            onClick={onFetch}
            disabled={loading}
            className="brutal-btn brutal-btn-secondary"
          >
            <MagnifyingGlass size={18} weight="bold" />
            {loading ? "SCANNING…" : "FETCH INFO"}
          </button>
        </div>

        <div className="mt-6 grid md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <div className="label-xs mb-2">FORMAT / QUALITY</div>
            <select
              data-testid={SINGLE.formatSelect}
              value={fmt}
              onChange={(e) => setFmt(e.target.value)}
              className="select-native w-full md:w-72"
            >
              {FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            data-testid={SINGLE.downloadBtn}
            onClick={onDownload}
            disabled={downloading || !url.trim()}
            className="brutal-btn brutal-btn-primary"
          >
            <DownloadSimple size={18} weight="bold" />
            {downloading ? "QUEUING…" : "DOWNLOAD"}
          </button>
        </div>
      </div>

      {activeJob && (
        <div className="brutal-card p-6 bg-white space-y-4 font-mono text-sm">
          <div className="flex justify-between items-center border-b border-black pb-2">
            <div className="font-bold uppercase text-xs tracking-wider">LIVE TASK FEED</div>
            <div className="px-2 py-0.5 border border-black font-bold uppercase text-xs rounded bg-yellow-100">
              {activeJob.status}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="truncate font-bold">{activeJob.title || "Processing stream..."}</div>
            {activeJob.progress !== undefined && (
              <div className="w-full bg-gray-200 border border-black h-4 relative overflow-hidden">
                <div 
                  className="bg-black h-full transition-all duration-300" 
                  style={{ width: `${activeJob.progress}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold mix-blend-difference text-white">
                  {activeJob.progress}%
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs pt-1">
            <div><span className="text-gray-500">SPEED:</span> {activeJob.speed || "—"}</div>
            <div><span className="text-gray-500">ETA:</span> {activeJob.eta || "—"}</div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-black">
            {activeJob.status === "downloading" && (
              <button onClick={handlePause} className="brutal-btn brutal-btn-secondary text-xs py-1 px-3 flex items-center gap-1">
                <Pause size={14} weight="bold" /> PAUSE
              </button>
            )}
            {activeJob.status === "paused" && (
              <button onClick={handleResume} className="brutal-btn brutal-btn-primary text-xs py-1 px-3 flex items-center gap-1">
                <Play size={14} weight="bold" /> RESUME
              </button>
            )}
            {!["completed", "failed", "cancelled"].includes(activeJob.status) && (
              <button onClick={handleCancel} className="brutal-btn border border-red-600 text-red-600 hover:bg-red-50 text-xs py-1 px-3 flex items-center gap-1 ml-auto">
                <XCircle size={14} weight="bold" /> ABORT
              </button>
            )}
          </div>
        </div>
      )}

      {info && <VideoPreview info={info} />}

      {!info && !activeJob && (
        <div className="brutal-border border-dashed bg-white p-8 text-center text-[#737373] font-mono text-sm">
          <div className="label-xs mb-2 text-[#737373]">AWAITING TARGET</div>
          Paste a video URL above to preview metadata before downloading.
        </div>
      )}
    </div>
  );
};