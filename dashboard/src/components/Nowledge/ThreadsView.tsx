import React, { useState } from "react";
import type { Session, FullChat } from "../../types";
import { getFullChat } from "../../api/ArcRift";

interface ThreadsViewProps {
  sessions: Session[];
  activeSessionId?: string;
  onSessionSelect: (session: Session) => void;
  onDeleteSession: (e: React.MouseEvent, sessionId: string) => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ThreadsView: React.FC<ThreadsViewProps> = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  onDeleteSession,
  onImport,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState<FullChat | null>(null);
  const [selectedSessionName, setSelectedSessionName] = useState("");
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "agent">("all");

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    return (
      s.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.summary && s.summary.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleOpenChat = async (session: Session) => {
    onSessionSelect(session);
    setSelectedSessionName(session.projectName);
    setIsLoadingChat(true);
    setIsDrawerOpen(true);
    try {
      const chat = await getFullChat(session._id);
      setSelectedChat(chat);
    } catch (err) {
      console.error("Failed to load full chat", err);
      setSelectedChat(null);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const getPlatformIcon = (platform?: string) => {
    const p = (platform || "").toLowerCase();
    if (p.includes("antigravity")) return "⚛️";
    if (p.includes("cursor")) return "▲";
    if (p.includes("gemini")) return "✨";
    if (p.includes("claude")) return "✳️";
    return "💬";
  };

  return (
    <div className="nl-threads-view">
      {/* View Header */}
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">会话记录</h1>
          <p className="nl-view-subtitle">
            浏览、搜索和管理从各类 AI 工具保存下来的会话。
          </p>
        </div>
      </div>

      {/* Search Bar with AI Agent Filter */}
      <div className="nl-threads-search-row">
        <div className="nl-threads-search-wrap">
          <span className="nl-search-icon">🔍</span>
          <input
            type="text"
            placeholder="搜索会话记录..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="nl-threads-search-input"
          />
          <button className="nl-search-action-btn">🔍</button>
        </div>
        <button
          className={`nl-agent-pill ${filterMode === "agent" ? "active" : ""}`}
          onClick={() => setFilterMode(filterMode === "all" ? "agent" : "all")}
        >
          🤖 智能体会话
        </button>
      </div>

      {/* Control Bar */}
      <div className="nl-threads-control-bar">
        <div className="nl-threads-left-ctrl">
          <div className="nl-dropdown-select">
            <span>💾 全部 ▾</span>
          </div>
          <span className="nl-result-count">
            结果 <strong>{filteredSessions.length}</strong> 条
          </span>
          <button className="nl-refresh-icon-btn" title="刷新">
            🔄
          </button>
        </div>

        <div className="nl-threads-right-ctrl">
          <label className="nl-btn-primary nl-import-label">
            📥 导入会话
            <input
              type="file"
              accept=".json"
              onChange={onImport}
              style={{ display: "none" }}
            />
          </label>
          <button className="nl-btn-secondary">☑️ 选择</button>
        </div>
      </div>

      {/* Sessions List */}
      <div className="nl-threads-list">
        {filteredSessions.length === 0 ? (
          <div className="nl-empty-state-card">
            <div className="nl-empty-state-icon">💬</div>
            <h2 className="nl-empty-state-title">暂无匹配的会话</h2>
            <p className="nl-empty-state-sub">
              在 IDE (Antigravity / Cursor) 中使用 ArcRift MCP
              或导入会话以在此处管理。
            </p>
          </div>
        ) : (
          filteredSessions.map((s) => (
            <div
              key={s._id}
              className={`nl-thread-item-card ${activeSessionId === s._id ? "active" : ""}`}
              onClick={() => handleOpenChat(s)}
            >
              <div className="nl-thread-avatar">
                {getPlatformIcon(s.platform)}
              </div>
              <div className="nl-thread-body">
                <div className="nl-thread-title">
                  {s.summary ? s.summary.split("\n")[0].replace(/^[#\s]+/, "") : s.projectName}
                </div>
                <div className="nl-thread-meta">
                  <span>💬 {s.topicCount || 1} 条消息</span>
                  <span>·</span>
                  <span className="nl-thread-platform">
                    {s.platform ? s.platform.toUpperCase() : "MCP"}
                  </span>
                </div>
              </div>
              <div className="nl-thread-actions">
                <span className="nl-thread-date">
                  {s.createdAt
                    ? new Date(s.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : new Date(s.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                </span>
                <button
                  className="nl-thread-icon-btn"
                  title="查看详情"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenChat(s);
                  }}
                >
                  📄
                </button>
                <button
                  className="nl-thread-icon-btn"
                  title="删除"
                  onClick={(e) => onDeleteSession(e, s._id)}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sliding Chat Drawer */}
      {isDrawerOpen && (
        <div className="nl-drawer-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <div className="nl-drawer-card" onClick={(e) => e.stopPropagation()}>
            <div className="nl-drawer-header">
              <div className="nl-drawer-title-group">
                <span className="nl-drawer-icon">💬</span>
                <h3>{selectedSessionName} · 会话正文</h3>
              </div>
              <button className="nl-close-btn" onClick={() => setIsDrawerOpen(false)}>
                ✕
              </button>
            </div>
            <div className="nl-drawer-body">
              {isLoadingChat ? (
                <div className="nl-loading-box">正在加载对话内容...</div>
              ) : selectedChat ? (
                <pre className="nl-chat-transcript-text">{selectedChat.rawText}</pre>
              ) : (
                <div className="nl-empty-chat">暂无原始文本</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
