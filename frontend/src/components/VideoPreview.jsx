
"import React from \"react\";
import { Clock, User, FilmStrip, Warning } from \"@phosphor-icons/react\";
import { formatDuration } from \"@/lib/api\";
import { SINGLE } from \"@/constants/testIds\";

export const VideoPreview = ({ info, testId = SINGLE.previewCard }) => {
  if (info?.error) {
    return (
      <div
        data-testid={SINGLE.previewError}
        className=\"brutal-border bg-[#FF2A00] text-white p-5 flex items-start gap-3 rise\"
      >
        <Warning size={22} weight=\"bold\" />
        <div className=\"font-mono text-sm break-all\">
          <div className=\"label-xs text-white mb-1\">EXTRACTION FAILED</div>
          {info.error}
        </div>
      </div>
    );
  }
  if (!info) return null;

  return (
    <div data-testid={testId} className=\"brutal-card p-0 overflow-hidden rise\">
      <div className=\"grid md:grid-cols-[260px_1fr]\">
        <div className=\"relative bg-[#0A0A0A] aspect-video md:aspect-auto md:h-full overflow-hidden border-r-0 md:border-r-2 border-[#0A0A0A]\">
          {info.thumbnail ? (
            <img
              src={info.thumbnail}
              alt={info.title}
              className=\"w-full h-full object-cover\"
              onError={(e) => { e.target.style.display = \"none\"; }}
            />
          ) : (
            <div className=\"w-full h-full flex items-center justify-center text-white/40\">
              <FilmStrip size={48} weight=\"bold\" />
            </div>
          )}
          <div className=\"absolute top-2 left-2\">
            <span className=\"tag tag-dark\">READY</span>
          </div>
        </div>
        <div className=\"p-5 lg:p-6 flex flex-col gap-3\">
          <div className=\"label-xs text-[#737373]\">VIDEO METADATA / 01</div>
          <h3 className=\"display text-xl lg:text-2xl font-black leading-tight line-clamp-2\">
            {info.title || \"Untitled\"}
          </h3>
          <div className=\"flex flex-wrap gap-3 text-xs font-mono text-[#0A0A0A]\">
            {info.uploader && (
              <div className=\"flex items-center gap-1.5\">
                <User size={14} weight=\"bold\" />
                <span className=\"font-semibold\">{info.uploader}</span>
              </div>
            )}
            <div className=\"flex items-center gap-1.5\">
              <Clock size={14} weight=\"bold\" />
              <span className=\"font-semibold\">{formatDuration(info.duration)}</span>
            </div>
            <div className=\"flex items-center gap-1.5\">
              <FilmStrip size={14} weight=\"bold\" />
              <span className=\"font-semibold\">
                {(info.formats || []).length} FORMATS
              </span>
            </div>
          </div>
          <div className=\"text-[11px] font-mono text-[#737373] break-all border-t-2 border-[#E5E5E5] pt-3 mt-auto\">
            {info.url}
          </div>
        </div>
      </div>
    </div>
  );
};
"
Observation: Create successful: /app/frontend/src/components/VideoPreview.jsx