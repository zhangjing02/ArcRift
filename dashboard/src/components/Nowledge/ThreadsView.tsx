import React, { useState } from "react";
import type { Session, FullChat } from "../../types";
import { getFullChat, getGraphData, createMemory } from "../../api/ArcRift";

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
  const [activeThreadSession, setActiveThreadSession] = useState<Session | null>(null);
  const [selectedChat, setSelectedChat] = useState<FullChat | null>(null);
  const [sessionGraph, setSessionGraph] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "agent">("all");
  const [isDistilling, setIsDistilling] = useState(false);

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    return (
      s.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.summary && s.summary.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleOpenThread = async (session: Session) => {
    onSessionSelect(session);
    setActiveThreadSession(session);
    setIsLoadingChat(true);
    try {
      const chat = await getFullChat(session._id);
      setSelectedChat(chat);
      const graph = await getGraphData(session._id);
      setSessionGraph(graph);
    } catch (err) {
      console.error("Failed to load thread details", err);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleBackToList = () => {
    setActiveThreadSession(null);
    setSelectedChat(null);
  };

  const handleDistillMemories = async () => {
    if (!activeThreadSession || isDistilling) return;
    setIsDistilling(true);
    try {
      const summaryText = activeThreadSession.summary || selectedChat?.rawText || "";
      const sections = summaryText.split(/##\s+/).filter(Boolean);

      for (const sec of sections) {
        const lines = sec.trim().split("\n");
        const title = lines[0].replace(/^[0-9.\s]+/, "").trim();
        const content = lines.slice(1).join("\n").trim();
        if (title && content) {
          await createMemory({
            sessionId: activeThreadSession._id,
            title: title.slice(0, 40),
            content,
            importance: "critical",
            category: title.includes("接口") ? "Architecture" : title.includes("错误码") ? "Gotcha" : "Decision",
            tags: [activeThreadSession.projectName, "OTA", "Android"],
            source: "distillation",
          });
        }
      }
      alert(`已成功为《${activeThreadSession.projectName}》提炼沉淀了结构化长期记忆！`);
    } catch (err) {
      console.error("Failed to distill memories", err);
    } finally {
      setIsDistilling(false);
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

  // If a thread is selected, render the 2-Column Thread View (matching Screenshot 2!)
  if (activeThreadSession) {
    const rawContent = selectedChat?.rawText || activeThreadSession.summary || "暂无对话原始文本";
    
    // Parse messages (User vs Assistant)
    const messageBlocks = rawContent.includes("<USER_REQUEST>")
      ? [
          {
            role: "User",
            avatar: "👤",
            text: rawContent.split("</USER_REQUEST>")[0].replace("<USER_REQUEST>", "").trim(),
          },
          {
            role: "Assistant",
            avatar: "🤖",
            text: rawContent.split("</USER_REQUEST>")[1]?.replace("<ASSISTANT_RESPONSE>", "")?.replace("</ASSISTANT_RESPONSE>", "").trim() || rawContent,
          },
        ]
      : [
          {
            role: "User",
            avatar: "👤",
            text: activeThreadSession.summary?.slice(0, 120) || "项目上下文",
          },
          {
            role: "Assistant",
            avatar: "🤖",
            text: rawContent,
          },
        ];

    return (
      <div className="nl-thread-detail-layout">
        {/* Left / Center Chat Stream Column */}
        <div className="nl-thread-chat-pane">
          {/* Header Bar with Back Button */}
          <div className="nl-thread-chat-header">
            <button className="nl-back-btn" onClick={handleBackToList}>
              ◀ 返回所有会话
            </button>
            <div className="nl-thread-header-badge">
              <span>{getPlatformIcon(activeThreadSession.platform)}</span>
              <span>{activeThreadSession.platform?.toUpperCase() || "ANTIGRAVITY"}</span>
            </div>
          </div>

          {/* Chat Messages Stream */}
          <div className="nl-chat-messages-stream">
            {isLoadingChat ? (
              <div className="nl-loading-box">正在加载对话上下文...</div>
            ) : (
              messageBlocks.map((msg, idx) => (
                <div key={idx} className={`nl-chat-bubble-card ${msg.role === "User" ? "user-bubble" : "ai-bubble"}`}>
                  <div className="nl-bubble-header">
                    <span className="nl-bubble-avatar">{msg.avatar}</span>
                    <span className="nl-bubble-role">{msg.role}</span>
                  </div>
                  <pre className="nl-bubble-text">{msg.text}</pre>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Inspector Column (Matching Screenshot 2 Right Side) */}
        <div className="nl-thread-inspector-pane">
          {/* Top Distill Action */}
          <div className="nl-thread-distill-card">
            <button
              className="nl-primary-action-btn"
              onClick={handleDistillMemories}
              disabled={isDistilling}
            >
              {isDistilling ? "正在提炼..." : "✨ 提炼 (Distill Memory)"}
            </button>
          </div>

          {/* AI Summary Accordion */}
          <div className="nl-inspector-accordion">
            <div className="nl-accordion-header">
              <span>✨ AI 摘要</span>
            </div>
            <div className="nl-accordion-body">
              <pre className="nl-summary-accordion-text">
                {activeThreadSession.summary || "已就绪"}
              </pre>
            </div>
          </div>

          {/* Session Metadata Accordion */}
          <div className="nl-inspector-accordion">
            <div className="nl-accordion-header">
              <span>💬 会话信息</span>
            </div>
            <div className="nl-accordion-body">
              <div className="nl-meta-row">
                <span className="nl-meta-key">来源平台</span>
                <span className="nl-meta-val">{activeThreadSession.platform || "antigravity"}</span>
              </div>
              <div className="nl-meta-row">
                <span className="nl-meta-key">切片 / 消息</span>
                <span className="nl-meta-val">{activeThreadSession.topicCount || 2} 条</span>
              </div>
              <div className="nl-meta-row">
                <span className="nl-meta-key">捕获时间</span>
                <span className="nl-meta-val">
                  {new Date(activeThreadSession.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Extracted Graph Entities Accordion */}
          <div className="nl-inspector-accordion">
            <div className="nl-accordion-header">
              <span>🕸️ 关联的实体 ({sessionGraph.nodes.length})</span>
            </div>
            <div className="nl-accordion-body">
              {sessionGraph.nodes.length === 0 ? (
                <div className="nl-empty-sub" style={{ fontSize: "11px" }}>尚未关联实体</div>
              ) : (
                <div className="nl-entity-chips-wrap">
                  {sessionGraph.nodes.map((node: any) => (
                    <span key={node.id} className="nl-entity-chip">
                      ● {node.id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, render the Thread List View
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
              onClick={() => handleOpenThread(s)}
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
                    handleOpenThread(s);
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
    </div>
  );
};
