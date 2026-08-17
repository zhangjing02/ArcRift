import React, { useState } from "react";
import type { Session, FullChat, Memory } from "../../types";
import { getFullChat, getGraphData, createMemory, getMemories } from "../../api/ArcRift";

interface ThreadsViewProps {
  sessions: Session[];
  activeSessionId?: string;
  onSessionSelect: (session: Session) => void;
  onDeleteSession: (e: React.MouseEvent, sessionId: string) => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ThreadsView: React.FC<ThreadsViewProps> = ({
  sessions,
  onSessionSelect,
  onDeleteSession,
  onImport,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeThreadSession, setActiveThreadSession] = useState<Session | null>(null);
  const [selectedChat, setSelectedChat] = useState<FullChat | null>(null);
  const [sessionGraph, setSessionGraph] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [sessionMemories, setSessionMemories] = useState<Memory[]>([]);
  const [filterMode, setFilterMode] = useState<"all" | "agent">("all");
  const [isDistilling, setIsDistilling] = useState(false);

  // Accordion toggle states
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    info: true,
    memory: true,
    entities: true,
  });

  const toggleSection = (sec: "summary" | "info" | "memory" | "entities") => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

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
    try {
      const chat = await getFullChat(session._id);
      setSelectedChat(chat);
      const graph = await getGraphData(session._id);
      setSessionGraph(graph);
      const memRes = await getMemories({ sessionId: session._id });
      if (memRes.success) {
        setSessionMemories(memRes.memories);
      }
    } catch (err) {
      console.error("Failed to load thread details", err);
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
            tags: [activeThreadSession.projectName, activeThreadSession.platform || "gemini"],
            source: "distillation",
          });
        }
      }
      const memRes = await getMemories({ sessionId: activeThreadSession._id });
      if (memRes.success) setSessionMemories(memRes.memories);
      alert(`已成功为《${activeThreadSession.projectName}》提炼沉淀了 ${sections.length} 条结构化长期记忆！`);
    } catch (err) {
      console.error("Failed to distill memories", err);
    } finally {
      setIsDistilling(false);
    }
  };

  const getPlatformIcon = (platform?: string) => {
    const p = (platform || "").toLowerCase();
    if (p.includes("gemini")) return "✨";
    if (p.includes("claude")) return "✳️";
    if (p.includes("gpt") || p.includes("openai")) return "🟢";
    if (p.includes("cursor")) return "▲";
    if (p.includes("antigravity")) return "⚛️";
    return "💬";
  };

  // ----------------------------------------------------
  // VIEW 1: Thread Detail Mode (Matches Screenshot 5)
  // ----------------------------------------------------
  if (activeThreadSession) {
    const rawContent = selectedChat?.rawText || activeThreadSession.summary || "暂无对话原始文本";
    const platformName = activeThreadSession.platform || "gemini";
    const totalMsgCount = activeThreadSession.topicCount || 16;
    const coveredCount = sessionMemories.length;

    // Parse conversation into user and assistant bubbles
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
            time: "18:09",
            text: rawContent.split("</USER_REQUEST>")[1]?.replace("<ASSISTANT_RESPONSE>", "")?.replace("</ASSISTANT_RESPONSE>", "").trim() || rawContent,
          },
        ]
      : [
          {
            role: "User",
            avatar: "👤",
            text: `你这个查询的也不对啊？`,
          },
          {
            role: "Assistant",
            avatar: "🤖",
            time: "18:09",
            text: rawContent,
          },
        ];

    return (
      <div className="nl-thread-detail-container">
        {/* Top Header Breadcrumb Bar */}
        <div className="nl-thread-top-bar">
          <div className="nl-thread-top-info">
            <button className="nl-thread-back-btn" onClick={handleBackToList}>
              ‹ 返回所有会话
            </button>
            <span className="nl-thread-platform-badge">
              ✦ {platformName}
            </span>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="nl-thread-detail-body">
          {/* Left Column: Chat Conversation Stream */}
          <div className="nl-thread-chat-stream">
            {messageBlocks.map((msg, idx) => (
              <div key={idx} className={`nl-chat-msg-row ${msg.role.toLowerCase()}`}>
                <div className="nl-msg-avatar-col">
                  <div className={`nl-chat-avatar ${msg.role.toLowerCase()}`}>
                    {msg.role === "User" ? "👤" : getPlatformIcon(platformName)}
                  </div>
                </div>

                <div className="nl-msg-content-col">
                  <div className="nl-msg-header-line">
                    <span className="nl-msg-role-name">{msg.role}</span>
                    {msg.role === "Assistant" && (
                      <span className="nl-msg-date-icon" title="系统记录">📅</span>
                    )}
                    <div className="nl-msg-tools">
                      <button className="nl-msg-tool-btn" title="复制文本">📋</button>
                      <button className="nl-msg-tool-btn" title="赞同">👍</button>
                    </div>
                  </div>

                  <div className="nl-msg-bubble-body">
                    <pre className="nl-chat-msg-pre">{msg.text}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: AI Extraction & Sidebar Panels */}
          <div className="nl-thread-sidebar-panel">
            {/* Top Action Header */}
            <div className="nl-thread-sidebar-top-actions">
              <button
                className="nl-btn-distill-primary"
                onClick={handleDistillMemories}
                disabled={isDistilling}
              >
                ⚡ {isDistilling ? "正在提炼..." : "提炼"}
              </button>
              <button className="nl-btn-layout-toggle" title="切换布局">
                田
              </button>
            </div>

            <div className="nl-covered-progress-row">
              <span className="nl-covered-text">
                {coveredCount}/{totalMsgCount} Covered
              </span>
              <div className="nl-covered-icons">
                <button className="nl-btn-icon-subtle">🗑️</button>
                <button className="nl-btn-icon-subtle">▾</button>
              </div>
            </div>

            {/* Accordion 1: AI 摘要 */}
            <div className="nl-thread-accordion-card">
              <div
                className="nl-accordion-header"
                onClick={() => toggleSection("summary")}
              >
                <div className="nl-accordion-title">
                  <span>📑</span> AI 摘要
                </div>
                <span className="nl-accordion-arrow">
                  {expandedSections.summary ? "▾" : "▸"}
                </span>
              </div>
              {expandedSections.summary && (
                <div className="nl-accordion-content">
                  {activeThreadSession.summary ? (
                    <div className="nl-thread-summary-text">
                      {activeThreadSession.summary}
                    </div>
                  ) : (
                    <div className="nl-empty-hint-text">还未提炼。</div>
                  )}
                </div>
              )}
            </div>

            {/* Accordion 2: 会话信息 */}
            <div className="nl-thread-accordion-card">
              <div
                className="nl-accordion-header"
                onClick={() => toggleSection("info")}
              >
                <div className="nl-accordion-title">
                  <span>🗂️</span> 会话信息
                </div>
                <span className="nl-accordion-arrow">
                  {expandedSections.info ? "▾" : "▸"}
                </span>
              </div>
              {expandedSections.info && (
                <div className="nl-accordion-content">
                  <div className="nl-thread-info-meta-list">
                    <div className="nl-info-meta-row">
                      <span className="nl-info-meta-icon">📄</span>
                      <span className="nl-info-meta-val">{activeThreadSession.projectName}</span>
                    </div>
                    <div className="nl-info-meta-row">
                      <span className="nl-info-meta-icon">{getPlatformIcon(platformName)}</span>
                      <span className="nl-info-meta-val">{platformName}</span>
                    </div>
                    <div className="nl-info-meta-row">
                      <span className="nl-info-meta-icon">💬</span>
                      <span className="nl-info-meta-val">{totalMsgCount} 条消息</span>
                    </div>
                    <div className="nl-info-meta-row">
                      <span className="nl-info-meta-icon">👤</span>
                      <span className="nl-info-meta-val">User, Assistant</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: 记忆 */}
            <div className="nl-thread-accordion-card">
              <div
                className="nl-accordion-header"
                onClick={() => toggleSection("memory")}
              >
                <div className="nl-accordion-title">
                  <span>💡</span> 记忆
                </div>
                <span className="nl-accordion-arrow">
                  {expandedSections.memory ? "▾" : "▸"}
                </span>
              </div>
              {expandedSections.memory && (
                <div className="nl-accordion-content">
                  {sessionMemories.length > 0 ? (
                    <div className="nl-thread-extracted-memories">
                      {sessionMemories.map((m) => (
                        <div key={m.id} className="nl-extracted-mem-pill">
                          <span className="nl-mem-dot">💡</span>
                          <span className="nl-mem-title-short">{m.title}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="nl-empty-hint-text">尚未提取记忆</div>
                  )}
                </div>
              )}
            </div>

            {/* Accordion 4: 提取的实体 */}
            <div className="nl-thread-accordion-card">
              <div
                className="nl-accordion-header"
                onClick={() => toggleSection("entities")}
              >
                <div className="nl-accordion-title">
                  <span>🌐</span> 提取的实体
                </div>
                <span className="nl-accordion-arrow">
                  {expandedSections.entities ? "▾" : "▸"}
                </span>
              </div>
              {expandedSections.entities && (
                <div className="nl-accordion-content">
                  {sessionGraph.nodes.length > 0 ? (
                    <div className="nl-thread-entity-chips">
                      {sessionGraph.nodes.map((n: any) => (
                        <span key={n.id} className="nl-entity-chip">
                          {n.id}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="nl-empty-hint-text">尚未提取实体</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 2: Thread List Mode (Matches Screenshot 4)
  // ----------------------------------------------------
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

      {/* Top Search Bar */}
      <div className="nl-threads-search-row">
        <div className="nl-threads-search-input-wrap">
          <span className="nl-search-icon">🔍</span>
          <input
            type="text"
            placeholder="搜索会话记录..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="nl-threads-search-input"
          />
          <button className="nl-threads-search-icon-btn">🔍</button>
        </div>
        <button
          className={`nl-btn-agent-threads ${filterMode === "agent" ? "active" : ""}`}
          onClick={() => setFilterMode(filterMode === "agent" ? "all" : "agent")}
        >
          ⚡ 智能体会话
        </button>
      </div>

      {/* Control Bar */}
      <div className="nl-threads-control-bar">
        <div className="nl-threads-left-controls">
          <select className="nl-select-dropdown">
            <option value="all">全部 ▾</option>
            <option value="gemini">Gemini</option>
            <option value="claude">Claude</option>
            <option value="openai">ChatGPT</option>
            <option value="antigravity">Antigravity</option>
          </select>
          <span className="nl-result-count">
            结果 <strong>{filteredSessions.length}</strong> 条
          </span>
          <button className="nl-refresh-icon-btn" title="刷新">
            🔄
          </button>
        </div>

        <div className="nl-threads-right-controls">
          <label className="nl-btn-primary" style={{ cursor: "pointer" }}>
            📥 导入会话
            <input
              type="file"
              accept=".json,.jsonl,.txt,.md"
              style={{ display: "none" }}
              onChange={onImport}
            />
          </label>
          <button className="nl-btn-secondary">
            ☑️ 选择
          </button>
        </div>
      </div>

      {/* Thread Cards Stream */}
      {filteredSessions.length === 0 ? (
        <div className="nl-empty-state-card">
          <div className="nl-empty-state-icon">💬</div>
          <h2 className="nl-empty-state-title">暂无会话记录</h2>
          <p className="nl-empty-state-sub">
            通过右上角“导入会话”导入 ChatGPT/Claude/Gemini 历史记录，或通过 Antigravity MCP 自动保存。
          </p>
        </div>
      ) : (
        <div className="nl-threads-list-stream">
          {filteredSessions.map((s) => {
            const platformIcon = getPlatformIcon(s.platform);
            const dateFormatted = s.updatedAt
              ? new Date(s.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Aug 16, 2026";

            return (
              <div
                key={s._id}
                className="nl-thread-row-card"
                onClick={() => handleOpenThread(s)}
              >
                <div className="nl-thread-row-icon">
                  <span className="nl-platform-icon-circle">{platformIcon}</span>
                </div>

                <div className="nl-thread-row-main">
                  <div className="nl-thread-row-title">{s.projectName}</div>
                  <div className="nl-thread-row-meta">
                    💬 {s.topicCount || 16} 条消息 · {s.platform || "gemini"}
                  </div>
                </div>

                <div className="nl-thread-row-right">
                  <span className="nl-thread-row-date">{dateFormatted}</span>
                  <div className="nl-thread-row-actions">
                    <button
                      className="nl-row-icon-btn"
                      title="删除会话"
                      onClick={(e) => onDeleteSession(e, s._id)}
                    >
                      🗑️
                    </button>
                    <button
                      className="nl-row-icon-btn"
                      title="置顶"
                      onClick={(e) => e.stopPropagation()}
                    >
                      📌
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
