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
      {/* Top Search Pill */}
      <div className="nl-search-container">
        <div className="nl-search-box">
          <span className="nl-search-icon">🔍</span>
          <input
            type="text"
            placeholder="搜索..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="nl-search-input"
          />
        </div>
      </div>

      {/* Main Navigation */}
      <div className="nl-nav-section">
        <button
          className={`nl-nav-item ${currentTab === "timeline" ? "active" : ""}`}
          onClick={() => onTabChange("timeline")}
        >
          <span className="nl-nav-icon">🏠</span>
          <span className="nl-nav-text">时间线</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "memories" ? "active" : ""}`}
          onClick={() => onTabChange("memories")}
        >
          <span className="nl-nav-icon">💡</span>
          <span className="nl-nav-text">记忆</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "threads" ? "active" : ""}`}
          onClick={() => onTabChange("threads")}
        >
          <span className="nl-nav-icon">💬</span>
          <span className="nl-nav-text">会话记录</span>
          {sessions.length > 0 && (
            <span className="nl-nav-badge">{sessions.length}</span>
          )}
        </button>

        <button
          className={`nl-nav-item ${currentTab === "ai-now" ? "active" : ""}`}
          onClick={() => onTabChange("ai-now")}
        >
          <span className="nl-nav-icon" style={{ color: "#38bdf8" }}>❇️</span>
          <span className="nl-nav-text">AI Now</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "graph" ? "active" : ""}`}
          onClick={() => onTabChange("graph")}
        >
          <span className="nl-nav-icon" style={{ color: "#a855f7" }}>🕸️</span>
          <span className="nl-nav-text">知识图谱</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "library" ? "active" : ""}`}
          onClick={() => onTabChange("library")}
        >
          <span className="nl-nav-icon">📚</span>
          <span className="nl-nav-text">资料库</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "tree" ? "active" : ""}`}
          onClick={() => onTabChange("tree")}
        >
          <span className="nl-nav-icon" style={{ color: "#10b981" }}>🌲</span>
          <span className="nl-nav-text">知识树</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "skills" ? "active" : ""}`}
          onClick={() => onTabChange("skills")}
        >
          <span className="nl-nav-icon" style={{ color: "#f59e0b" }}>❖</span>
          <span className="nl-nav-text">技能</span>
        </button>

        <button
          className={`nl-nav-item ${currentTab === "context" ? "active" : ""}`}
          onClick={() => onTabChange("context")}
        >
          <span className="nl-nav-icon" style={{ color: "#ec4899" }}>⊘</span>
          <span className="nl-nav-text">上下文</span>
        </button>
      </div>

      {/* Pinned Section */}
      <div className="nl-pinned-section">
        <div className="nl-section-header">
          <span>收藏</span>
        </div>
        <div className="nl-pinned-empty">还没有收藏</div>
      </div>

      {/* Project Switcher in Sidebar */}
      <div className="nl-project-section">
        <div className="nl-section-header">
          <span>当前空间 / 项目</span>
        </div>
        <div className="nl-project-selector">
          <select
            value={activeSession?._id || ""}
            onChange={(e) => {
              const target = sessions.find((s) => s._id === e.target.value);
              if (target) onSessionSelect(target);
            }}
            className="nl-project-select"
          >
            {sessions.map((s) => (
              <option key={s._id} value={s._id}>
                {s.projectName} ({s.tripleCount || 0} 事实)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bottom Utility Menu */}
      <div className="nl-sidebar-footer">
        <button
          className={`nl-footer-item ${currentTab === "stats" ? "active" : ""}`}
          onClick={() => onTabChange("stats")}
        >
          <span className="nl-footer-icon">📊</span>
          <span>统计</span>
        </button>

        <button
          className={`nl-footer-item ${currentTab === "connect" ? "active" : ""}`}
          onClick={() => onTabChange("connect")}
        >
          <span className="nl-footer-icon">🔌</span>
          <span>连接</span>
        </button>

        <button
          className={`nl-footer-item ${currentTab === "feedback" ? "active" : ""}`}
          onClick={() => onTabChange("feedback")}
        >
          <span className="nl-footer-icon">💬</span>
          <span>反馈</span>
        </button>

        <button
          className={`nl-footer-item ${currentTab === "settings" ? "active" : ""}`}
          onClick={() => onTabChange("settings")}
        >
          <span className="nl-footer-icon">⚙️</span>
          <span>设置</span>
        </button>

        <div className="nl-user-item">
          <div className="nl-user-avatar">👤</div>
          <span className="nl-user-name">本地空间</span>
          <span className="nl-online-dot"></span>
        </div>
      </div>
    </aside>
  );
};
