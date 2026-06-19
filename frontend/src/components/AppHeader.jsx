
"import React from \"react\";
import { DownloadSimple, Lightning } from \"@phosphor-icons/react\";
import { APP } from \"@/constants/testIds\";

export const AppHeader = ({ jobCount = 0 }) => {
  return (
    <header
      data-testid={APP.header}
      className=\"brutal-border border-b-[2px] border-t-0 border-l-0 border-r-0 bg-white\"
    >
      <div className=\"max-w-7xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between flex-wrap gap-4\">
        <div className=\"flex items-center gap-4\">
          <div className=\"brutal-border w-12 h-12 bg-[#0A0A0A] text-white flex items-center justify-center brutal-shadow-sm\">
            <DownloadSimple size={26} weight=\"bold\" />
          </div>
          <div>
            <h1 className=\"display text-2xl lg:text-3xl font-black uppercase tracking-tight leading-none\">
              GRABBR<span className=\"text-[#FF2A00]\">/</span>
              <span className=\"text-[#002FA7]\">01</span>
            </h1>
            <p className=\"text-[11px] tracking-[0.22em] uppercase font-bold text-[#737373] mt-1\">
              VIDEO EXTRACTION TERMINAL
            </p>
          </div>
        </div>
        <div className=\"flex items-center gap-3\">
          <span className=\"tag tag-muted\">
            <Lightning size={14} weight=\"fill\" /> YT-DLP / 1000+ SITES
          </span>
          <span className=\"tag tag-dark\">
            QUEUE&nbsp;:&nbsp;{String(jobCount).padStart(3, \"0\")}
          </span>
        </div>
      </div>
      <div className=\"divider-thick\" />
    </header>
  );
};
"
Observation: Create successful: /app/frontend/src/components/AppHeader.jsx