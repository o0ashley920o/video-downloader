"import { useEffect, useState, useCallback, useRef } from \"react\";
import \"@/App.css\";
import { Toaster } from \"sonner\";
import { AppHeader } from \"@/components/AppHeader\";
import { SinglePanel } from \"@/components/SinglePanel\";
import { BulkPanel } from \"@/components/BulkPanel\";
import { HistoryList } from \"@/components/HistoryList\";
import { listJobs, deleteJob, clearAllJobs } from \"@/lib/api\";
import { APP } from \"@/constants/testIds\";
import { toast } from \"sonner\";

const TABS = [
  { key: \"single\", label: \"01 / SINGLE\", testid: APP.tabSingle },
  { key: \"bulk\", label: \"02 / BULK BATCH\", testid: APP.tabBulk },
  { key: \"history\", label: \"03 / LEDGER\", testid: APP.tabHistory },
];

function App() {
  const [tab, setTab] = useState(\"single\");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listJobs();
      setJobs(data);
    } catch (e) {
      // silent in poll
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // poll while there are active jobs
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === \"queued\" || j.status === \"downloading\");
    if (hasActive) {
      pollRef.current = setInterval(refresh, 1500);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [jobs, refresh]);

  const onJobsCreated = (newJobs) => {
    setJobs((prev) => [...newJobs, ...prev]);
    setTab(\"history\");
    setTimeout(refresh, 800);
  };

  const onDelete = async (id) => {
    try {
      await deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      toast.success(\"Job removed\");
    } catch {
      toast.error(\"Delete failed\");
    }
  };

  const onClear = async () => {
    if (!window.confirm(\"Delete all jobs and downloaded files?\")) return;
    try {
      await clearAllJobs();
      setJobs([]);
      toast.success(\"Ledger cleared\");
    } catch {
      toast.error(\"Clear failed\");
    }
  };

  return (
    <div data-testid={APP.root} className=\"App min-h-screen\">
      <Toaster position=\"top-right\" />
      <AppHeader jobCount={jobs.length} />

      <main className=\"max-w-7xl mx-auto px-6 lg:px-12 py-8 lg:py-12\">
        {/* Hero */}
        <section className=\"mb-10 lg:mb-14 rise\">
          <div className=\"label-xs text-[#737373] mb-3\">CONTROL ROOM / RUN-01</div>
          <h2 className=\"display text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tighter leading-[0.95]\">
            EXTRACT ANY VIDEO.<br />
            <span className=\"text-[#002FA7]\">ONE URL OR ONE HUNDRED.</span>
          </h2>
          <p className=\"mt-5 max-w-2xl text-sm lg:text-base text-[#0A0A0A] leading-relaxed\">
            A no-frills video extraction terminal powered by{\" \"}
            <span className=\"font-bold\">yt-dlp</span>. Paste a URL — or a batch — pick a format,
            and pull MP4/MP3 files straight from 1000+ sources.
          </p>
        </section>

        {/* Tabs */}
        <div className=\"brutal-border bg-white border-l-0 border-r-0 border-t-0 mb-8 flex overflow-x-auto\">
          {TABS.map((t) => (
            <button
              key={t.key}
              data-testid={t.testid}
              data-active={tab === t.key}
              className=\"tab-btn\"
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === \"single\" && <SinglePanel onJobsCreated={onJobsCreated} />}
        {tab === \"bulk\" && <BulkPanel onJobsCreated={onJobsCreated} />}
        {tab === \"history\" && (
          <HistoryList
            jobs={jobs}
            onDelete={onDelete}
            onClear={onClear}
            onRefresh={refresh}
            loading={loading}
          />
        )}
      </main>

      <footer className=\"border-t-2 border-[#0A0A0A] bg-white\">
        <div className=\"max-w-7xl mx-auto px-6 lg:px-12 py-6 text-[11px] font-mono uppercase tracking-[0.18em] text-[#737373] flex flex-wrap items-center justify-between gap-3\">
          <span>GRABBR/01 · BUILT FOR EXTRACTION</span>
          <span>POWERED BY YT-DLP · FFMPEG</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
"
Observation: Overwrite successful: /app/frontend/src/App.js