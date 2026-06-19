
"import React from \"react\";
import { Trash, DownloadSimple, ArrowsClockwise, CheckCircle, XCircle, Clock, FilmStrip } from \"@phosphor-icons/react\";
import { fileUrl, formatBytes } from \"@/lib/api\";
import { HIST } from \"@/constants/testIds\";

const StatusBadge = ({ status }) => {
  if (status === \"completed\")
    return (
      <span className=\"tag tag-blue\">
        <CheckCircle size={12} weight=\"fill\" /> DONE
      </span>
    );
  if (status === \"failed\")
    return (
      <span className=\"tag tag-red\">
        <XCircle size={12} weight=\"fill\" /> FAIL
      </span>
    );
  if (status === \"downloading\")
    return (
      <span className=\"tag tag-dark\">
        <DownloadSimple size={12} weight=\"bold\" /> <span className=\"blink\">DL</span>
      </span>
    );
  return (
    <span className=\"tag tag-muted\">
      <Clock size={12} weight=\"bold\" /> QUEUED
    </span>
  );
};

export const HistoryList = ({ jobs, onDelete, onClear, onRefresh, loading }) => {
  return (
    <div className=\"space-y-4\">
      <div className=\"brutal-card p-4 lg:p-5 flex items-center justify-between flex-wrap gap-3\">
        <div>
          <div className=\"label-xs\">DOWNLOAD LEDGER</div>
          <div className=\"font-mono text-xs text-[#737373] mt-1\">
            {jobs.length} job{jobs.length !== 1 ? \"s\" : \"\"} •{\" \"}
            {jobs.filter((j) => j.status === \"completed\").length} completed •{\" \"}
            {jobs.filter((j) => j.status === \"downloading\").length} active
          </div>
        </div>
        <div className=\"flex items-center gap-2\">
          <button
            data-testid={HIST.refresh}
            onClick={onRefresh}
            className=\"brutal-btn brutal-btn-secondary brutal-btn-sm\"
          >
            <ArrowsClockwise size={14} weight=\"bold\" className={loading ? \"animate-spin\" : \"\"} />
            REFRESH
          </button>
          {jobs.length > 0 && (
            <button
              data-testid={HIST.clearAll}
              onClick={onClear}
              className=\"brutal-btn brutal-btn-danger brutal-btn-sm\"
            >
              <Trash size={14} weight=\"bold\" />
              CLEAR ALL
            </button>
          )}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className=\"brutal-border border-dashed bg-white p-12 text-center text-[#737373] font-mono text-sm\">
          <FilmStrip size={36} weight=\"bold\" className=\"mx-auto mb-3 opacity-40\" />
          <div className=\"label-xs text-[#737373]\">LEDGER EMPTY</div>
          <div className=\"mt-2\">No downloads yet. Submit a URL to begin.</div>
        </div>
      ) : (
        <div data-testid={HIST.list} className=\"brutal-card p-0 overflow-hidden\">
          <div className=\"hidden lg:grid grid-cols-[100px_1fr_140px_140px_180px] gap-3 px-4 py-3 bg-[#0A0A0A] text-white label-xs\">
            <div className=\"text-white\">THUMB</div>
            <div className=\"text-white\">TITLE / URL</div>
            <div className=\"text-white\">FORMAT</div>
            <div className=\"text-white\">SIZE</div>
            <div className=\"text-white text-right\">STATUS / ACTIONS</div>
          </div>
          <ul>
            {jobs.map((j) => (
              <li
                key={j.id}
                data-testid={HIST.item(j.id)}
                className=\"grid grid-cols-1 lg:grid-cols-[100px_1fr_140px_140px_180px] gap-3 items-center p-4 border-b-2 border-[#E5E5E5] last:border-b-0 hover:bg-[#F2F2F2]\"
              >
                <div className=\"aspect-video w-24 bg-[#0A0A0A] brutal-border overflow-hidden\">
                  {j.thumbnail ? (
                    <img src={j.thumbnail} alt=\"\" className=\"w-full h-full object-cover\" />
                  ) : (
                    <div className=\"w-full h-full flex items-center justify-center text-white/40\">
                      <FilmStrip size={20} weight=\"bold\" />
                    </div>
                  )}
                </div>

                <div className=\"min-w-0\">
                  <div className=\"font-bold text-sm truncate\">
                    {j.title || j.url}
                  </div>
                  <div className=\"text-[11px] text-[#737373] mt-1 truncate font-mono\">{j.url}</div>
                  {j.status === \"downloading\" && (
                    <div className=\"mt-2\">
                      <div className=\"brutal-progress\">
                        <div style={{ width: `${j.progress || 0}%` }} />
                      </div>
                      <div className=\"flex justify-between text-[10px] font-mono mt-1 text-[#737373]\">
                        <span>{(j.progress || 0).toFixed(1)}%</span>
                        <span>
                          {j.speed || \"\"} {j.eta ? `· ETA ${j.eta}` : \"\"}
                        </span>
                      </div>
                    </div>
                  )}
                  {j.status === \"completed\" && (
                    <div className=\"mt-1\">
                      <div className=\"brutal-progress done\"><div style={{ width: \"100%\" }} /></div>
                    </div>
                  )}
                  {j.status === \"failed\" && (
                    <div className=\"mt-1 text-[11px] text-[#FF2A00] font-mono break-words\">
                      {j.error || \"Unknown error\"}
                    </div>
                  )}
                </div>

                <div className=\"font-mono text-xs\">
                  <span className=\"tag tag-muted\">{(j.format_choice || \"best\").toUpperCase()}</span>
                  {j.ext && <div className=\"mt-1 text-[10px] text-[#737373]\">.{j.ext}</div>}
                </div>

                <div className=\"font-mono text-xs\">{formatBytes(j.filesize)}</div>

                <div className=\"flex items-center justify-start lg:justify-end gap-2 flex-wrap\">
                  <StatusBadge status={j.status} />
                  {j.status === \"completed\" && (
                    <a
                      data-testid={HIST.itemDownload(j.id)}
                      href={fileUrl(j.id)}
                      target=\"_blank\"
                      rel=\"noreferrer\"
                      className=\"brutal-btn brutal-btn-primary brutal-btn-sm\"
                    >
                      <DownloadSimple size={12} weight=\"bold\" />
                      GET
                    </a>
                  )}
                  <button
                    data-testid={HIST.itemDelete(j.id)}
                    onClick={() => onDelete(j.id)}
                    className=\"brutal-btn brutal-btn-secondary brutal-btn-sm\"
                    title=\"Delete\"
                  >
                    <Trash size={12} weight=\"bold\" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
"
Observation: Create successful: /app/frontend/src/components/HistoryList.jsx