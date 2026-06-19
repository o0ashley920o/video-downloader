import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { MagnifyingGlass, DownloadSimple, ListBullets, Warning, Pause, Play, XCircle } from "@phosphor-icons/react";
import { fetchInfoBulk, startBulkDownload, FORMAT_OPTIONS, formatDuration, streamJobProgress, pauseJob, resumeJob, cancelJob } from "@/lib/api";
import { BULK } from "@/constants/testIds";

export const BulkPanel = ({ onJobsCreated }) => {
  const [text, setText] = useState("");
  const [previews, setPreviews] = useState([]);
  const [fmt, setFmt] = useState("best");
  const [fetching, setFetching] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeJobs, setActiveJobs] = useState({});

  const parseUrls = () =>
    text
      .split(/\r?\n|,|\s+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s));

  const onFetchAll = async () => {
    const urls = parseUrls();
    if (!urls.length) return toast.error("Paste at least one valid URL");
    setFetching(true);
    setPreviews([]);
    try {
      const data = await fetchInfoBulk(urls);
      setPreviews(data);
      const ok = data.filter((d) => !d.error).length;
      toast.success(`Scanned ${data.length} — ${ok} OK, ${data.length - ok} failed`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Scan failed");
    } finally {
      setFetching(false);
    }
  };

  const onDownloadAll = async () => {
    const urls = previews.length > 0 ? previews.filter((p) => !p.error).map((p) => p.url) : parseUrls();
    if (!urls.length) return toast.error("Nothing to download");
    setDownloading(true);
    try {
      const jobs = await startBulkDownload({ urls, format_choice: fmt });
      toast.success(`Queued ${jobs.length} downloads`);
      
      const initialJobState = {};
      jobs.forEach((job) => {
        initialJobState[job.url] = job;
      });
      setActiveJobs(initialJobState);
      onJobsCreated?.(jobs);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bulk download failed");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const activeStreams = {};

    Object.keys(activeJobs).forEach((urlKey) => {
      const job = activeJobs[urlKey];
      if (!job?.id || ["completed", "failed", "cancelled"].includes(job?.status)) return;

      const ws = streamJobProgress(
        job.id,
        (updatedData) => {
          setActiveJobs((prev) => ({
            ...prev,
            [urlKey]: { ...prev[urlKey], ...updatedData },
          }));
        },
        () => {
          console.log(`Bulk stream connection finished for item: ${job.id}`);
        }
      );

      activeStreams[job.id] = ws;
    });

    return () => {
      Object.values(activeStreams).forEach((ws) => ws.close());
    };
  }, [Object.keys(activeJobs).length]);

  const handleItemPause = async (urlKey, id) => {
    try {
      const res = await pauseJob(id);
      setActiveJobs((prev) => ({ ...prev, [urlKey]: { ...prev[urlKey], ...res } }));
    } catch (e) {
      toast.error("Failed to pause item");
    }
  };

  const handleItemResume = async (urlKey, id) => {
    try {
      const res = await resumeJob(id);
      setActiveJobs((prev) => ({ ...prev, [urlKey]: { ...prev[urlKey], ...res } }));
    } catch (e) {
      toast.error("Failed to resume item");
    }
  };

  const handleItemCancel = async (urlKey, id) => {
    try {
      const res = await cancelJob(id);
      setActiveJobs((prev) => ({ ...prev, [urlKey]: { ...prev[urlKey], ...res } }));
    } catch (e) {
      toast.error("Failed to cancel item");
    }
  };

  const lineCount = parseUrls().length;

  return (
    <div className="space-y-6">
      <div className="brutal-card p-6 lg:p-8">
        <div className="flex items-center justify-between mb-3">
          <div className="label-xs">BATCH INPUT / ONE URL PER LINE</div>
          <span className="tag tag-muted">
            <ListBullets size={12} weight="bold" /> {lineCount} URLS
          </span>
        </div>
        <textarea
          data-testid={BULK.textarea}
          className="brutal-textarea"
          placeholder={"https://youtube.com/watch?v=...\nhttps://vimeo.com/...\nhttps://tiktok.com/..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
        />

        <div className="mt-6 grid md:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div>
            <div className="label-xs mb-2">FORMAT / QUALITY (APPLIED TO ALL)</div>
            <select
              data-testid={BULK.formatSelect}
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
            data-testid={BULK.fetchBtn}
            onClick={onFetchAll}
            disabled={fetching || lineCount === 0}
            className="brutal-btn brutal-btn-secondary"
          >
            <MagnifyingGlass size={18} weight="bold" />
            {fetching ? "SCANNING…" : "SCAN ALL"}
          </button>
          <button
            data-testid={BULK.downloadAllBtn}
            onClick={onDownloadAll}
            disabled={downloading || lineCount === 0}
            className="brutal-btn brutal-btn-primary"
          >
            <DownloadSimple size={18} weight="bold" />
            {downloading ? "QUEUING…" : "DOWNLOAD ALL"}
          </button>
        </div>
      </div>

      {previews.length > 0 && (
        <div data-testid={BULK.previewList} className="brutal-card p-0">
          <div className="p-4 border-b-2 border-[#0A0A0A] flex items-center justify-between bg-[#0A0A0A] text-white">
            <div className="label-xs text-white">BATCH PREVIEW / {previews.length} ITEMS</div>
            <span className="tag tag-blue">
              {previews.filter((p) => !p.error).length} VALID
            </span>
          </div>
          <ul>
            {previews.map((p, i) => {
              const activeJobInstance = activeJobs[p.url];
              return (
                <li
                  key={i}
                  className="grid grid-cols-[80px_1fr_auto] gap-4 items-center p-4 border-b-2 border-[#E5E5E5] last:border-b-0"
                >
                  <div className="aspect-video bg-[#0A0A0A] brutal-border overflow-hidden">
                    {p.thumbnail && !p.error ? (
                      <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/40">
                        <Warning size={20} weight="bold" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    {p.error ? (
                      <>
                        <div className="font-bold text-[#FF2A00] text-sm">FAILED</div>
                        <div className="text-xs text-[#737373] break-all">{p.error}</div>
                        <div className="text-[10px] text-[#737373] mt-1 truncate">{p.url}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-bold text-sm truncate">{p.title}</div>
                        <div className="text-xs text-[#737373] flex gap-3 font-mono">
                          <span>{p.uploader || "—"}</span>
                          <span>·</span>
                          <span>{formatDuration(p.duration)}</span>
                        </div>
                        
                        {activeJobInstance && (
                          <div className="pt-2 font-mono text-xs space-y-2 border-t border-dashed border-gray-300 mt-2">
                            <div className="flex justify-between text-[10px] font-bold text-gray-600">
                              <span>STATUS: <span className="text-black uppercase">{activeJobInstance.status}</span></span>
                              {activeJobInstance.speed && <span>SPEED: {activeJobInstance.speed}</span>}
                              {activeJobInstance.eta && <span>ETA: {activeJobInstance.eta}</span>}
                            </div>
                            
                            {activeJobInstance.progress !== undefined && (
                              <div className="w-full bg-gray-100 border border-black h-3 relative overflow-hidden">
                                <div 
                                  className="bg-black h-full transition-all duration-300" 
                                  style={{ width: `${activeJobInstance.progress}%` }}
                                />
                              </div>
                            )}

                            <div className="flex gap-2">
                              {activeJobInstance.status === "downloading" && (
                                <button onClick={() => handleItemPause(p.url, activeJobInstance.id)} className="text-[10px] px-2 py-0.5 border border-black bg-white flex items-center gap-0.5 hover:bg-gray-100 font-bold">
                                  <Pause size={10} weight="bold" /> PAUSE
                                </button>
                              )}
                              {activeJobInstance.status === "paused" && (
                                <button onClick={() => handleItemResume(p.url, activeJobInstance.id)} className="text-[10px] px-2 py-0.5 border border-black bg-black text-white flex items-center gap-0.5 hover:bg-gray-800 font-bold">
                                  <Play size={10} weight="bold" /> RESUME
                                </button>
                              )}
                              {!["completed", "failed", "cancelled"].includes(activeJobInstance.status) && (
                                <button onClick={() => handleItemCancel(p.url, activeJobInstance.id)} className="text-[10px] px-2 py-0.5 border border-red-600 text-red-600 bg-white flex items-center gap-0.5 hover:bg-red-50 font-bold ml-auto">
                                  <XCircle size={10} weight="bold" /> ABORT
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="text-[10px] text-[#737373] truncate font-mono">{p.url}</div>
                      </>
                    )}
                  </div>
                  <div>
                    <span className={p.error ? "tag tag-red" : "tag tag-blue"}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};