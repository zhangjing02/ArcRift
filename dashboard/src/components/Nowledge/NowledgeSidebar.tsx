import React from "react";
import type { Session } from "../../types";

export type NavTab =
  | "timeline"
  | "memories"
  | "threads"
  | "ai-now"
  | "graph"
  | "library"
  | "tree"
  | "skills"
  | "context"
  | "stats"
  | "connect"
  | "feedback"
  | "settings";

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  sessions: Session[];
  activeSessionId?: string;
  onSessionSelect: (session: Session) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

/* Minimalist Monochrome SVG Icons (1:1 with Nowledge Mem Screenshot 1) */
const IconHome = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconBulb = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
    <path d="M9 18h6"/>
    <path d="M10 22h4"/>
  </svg>
);

const IconChat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const IconAiNow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="2" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
  </svg>
);

const IconGraph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/>
    <circle cx="6" cy="12" r="3"/>
    <circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const IconBook = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
    <path d="M6 6h10"/>
    <path d="M6 10h10"/>
  </svg>
);

const IconTree = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="3" x2="6" y2="15"/>
    <circle cx="18" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <path d="M18 9a9 9 0 0 1-9 9"/>
  </svg>
);

const IconSkills = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="12" height="12" x="6" y="6" rx="2" transform="rotate(45 12 12)"/>
  </svg>
);

const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconStats = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20V10"/>
    <path d="M18 20V4"/>
    <path d="M6 20v-4"/>
  </svg>
);

const IconPlug = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v6"/>
    <path d="M7 8h10v4a5 5 0 0 1-10 0Z"/>
    <path d="M12 17v5"/>
  </svg>
);

const IconFeedback = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

const IconGear = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

export const NowledgeSidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  sessions,
  activeSessionId,
  onSessionSelect,
  searchQuery,
  onSearchChange,
}) => {
  const activeSession = sessions.find((s) => s._id === activeSessionId) || sessions[0];

  return (
    <aside className="nl-sidebar">
      {/* Top Search Pill (Matching Screenshot 1) */}
      <div className="nl-search-container" style={{ marginTop: 4 }}>
        <div className="nl-search-box">
          <span className="nl-search-icon" style={{ opacity: 0.7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            type="text"
            placeholder="搜索..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="nl-search-input"
          />
        </div>
      </div>

      {/* Main Navigation (Monochrome icons) */}
      <div className="nl-nav-section">
        <button
          className={`nl-nav-item ${currentTab === "timeline" ? "active" : ""}`}
          onClick={() => onTabChange("timeline")}
        >
          <span className="nl-nav-icon"><IconHome /></span>
          <span className="nl-nav-text">时间线</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "memories" ? "active" : ""}`}
          onClick={() => onTabChange("memories")}
        >
          <span className="nl-nav-icon"><IconBulb /></span>
          <span className="nl-nav-text">记忆</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "threads" ? "active" : ""}`}
          onClick={() => onTabChange("threads")}
        >
          <span className="nl-nav-icon"><IconChat /></span>
          <span className="nl-nav-text">会话记录</span>
          {sessions.length > 0 && (
            <span className="nl-nav-badge">{sessions.length}</span>
          )}
        </button>

        <button
          className={`nl-nav-item ${currentTab === "ai-now" ? "active" : ""}`}
          onClick={() => onTabChange("ai-now")}
        >
          <span className="nl-nav-icon"><IconAiNow /></span>
          <span className="nl-nav-text">AI Now</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "graph" ? "active" : ""}`}
          onClick={() => onTabChange("graph")}
        >
          <span className="nl-nav-icon"><IconGraph /></span>
          <span className="nl-nav-text">知识图谱</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "library" ? "active" : ""}`}
          onClick={() => onTabChange("library")}
        >
          <span className="nl-nav-icon"><IconBook /></span>
          <span className="nl-nav-text">资料库</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "tree" ? "active" : ""}`}
          onClick={() => onTabChange("tree")}
        >
          <span className="nl-nav-icon"><IconTree /></span>
          <span className="nl-nav-text">知识树</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "skills" ? "active" : ""}`}
          onClick={() => onTabChange("skills")}
        >
          <span className="nl-nav-icon"><IconSkills /></span>
          <span className="nl-nav-text">技能</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "context" ? "active" : ""}`}
          onClick={() => onTabChange("context")}
        >
          <span className="nl-nav-icon"><IconClock /></span>
          <span className="nl-nav-text">上下文</span>
        </button>
      </div>

      {/* Pinned Section */}
      <div className="nl-pinned-section">
        <div className="nl-section-header">收藏</div>
        <div className="nl-pinned-empty">还没有收藏</div>
      </div>

      {/* Project Selector */}
      <div className="nl-project-section">
        <div className="nl-section-header">当前空间 / 项目</div>
        <select
          value={activeSession?._id || "all"}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "all") {
              onSessionSelect(null as any);
            } else {
              const found = sessions.find((s) => s._id === val);
              if (found) onSessionSelect(found);
            }
          }}
          className="nl-project-select"
        >
          <option value="all">🌟 全部空间 (All Spaces)</option>
          {sessions.map((s) => (
            <option key={s._id} value={s._id}>
              📁 {s.projectName}
            </option>
          ))}
        </select>
      </div>

      {/* Sidebar Footer (Monochrome) */}
      <div className="nl-sidebar-footer">
        <button
          className={`nl-footer-item ${currentTab === "stats" ? "active" : ""}`}
          onClick={() => onTabChange("stats")}
        >
          <span className="nl-nav-icon"><IconStats /></span>
          <span>统计</span>
        </button>

        <button
          className={`nl-footer-item ${currentTab === "connect" ? "active" : ""}`}
          onClick={() => onTabChange("connect")}
        >
          <span className="nl-nav-icon"><IconPlug /></span>
          <span>连接</span>
        </button>

        <button
          className={`nl-footer-item ${currentTab === "feedback" ? "active" : ""}`}
          onClick={() => onTabChange("feedback")}
        >
          <span className="nl-nav-icon"><IconFeedback /></span>
          <span>反馈</span>
        </button>

        <button
          className={`nl-footer-item ${currentTab === "settings" ? "active" : ""}`}
          onClick={() => onTabChange("settings")}
        >
          <span className="nl-nav-icon"><IconGear /></span>
          <span>设置</span>
        </button>

        <div className="nl-user-item">
          <span className="nl-nav-icon"><IconUser /></span>
          <span className="nl-user-name">本地空间</span>
          <span className="nl-online-dot"></span>
        </div>
      </div>
    </aside>
  );
};
