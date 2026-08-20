import React, { useState, useRef, useEffect } from "react";
import type { Session, FullChat, Memory } from "../../types";
import { getFullChat, getGraphData, createMemory, getMemories, deleteSession, rebuildSearchIndex } from "../../api/ArcRift";
import { SessionImporterModal } from "./SessionImporterModal";
import { AgentImporterView } from "./AgentImporterView";

interface ThreadsViewProps {
  sessions: Session[];
  activeSessionId?: string;
  onSessionSelect: (session: Session) => void;
  onDeleteSession: (e: React.MouseEvent, sessionId: string) => void;
  onImport?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function parseConversationMessages(rawContent: string): { role: string; text: string; time?: string }[] {
  if (!rawContent || !rawContent.trim()) return [];

  // Case 1: Markdown turns like ## User / ## Assistant
  if (/(?:^|\n)##+\s*(User|Assistant|Human|AI|Claude|Gemini|ChatGPT)/i.test(rawContent)) {
    const parts = rawContent.split(/(?:^|\n)(?=##+\s*(?:User|Assistant|Human|AI|Claude|Gemini|ChatGPT))/i);
    const messages: { role: string; text: string }[] = [];
    for (const part of parts) {
      if (!part.trim()) continue;
      const headerMatch = part.match(/^##+\s*(User|Assistant|Human|AI|Claude|Gemini|ChatGPT)[^\n]*/i);
      if (headerMatch) {
        const rawRole = headerMatch[1].toLowerCase();
        const role = (rawRole === "user" || rawRole === "human") ? "User" : "Assistant";
        const text = part.slice(headerMatch[0].length).trim();
        if (text) messages.push({ role, text });
      } else {
        messages.push({ role: "User", text: part.trim() });
      }
    }
    if (messages.length > 0) return messages;
  }

  // Case 2: XML format with <USER_REQUEST>
  if (rawContent.includes("<USER_REQUEST>")) {
    const userPart = rawContent.split("</USER_REQUEST>")[0].replace(/<USER_REQUEST>/g, "").trim();
    const assistantPart = rawContent.split("</USER_REQUEST>")[1]?.replace(/<\/?ASSISTANT_RESPONSE>/g, "")?.trim() || "";
    const res: { role: string; text: string }[] = [];
    if (userPart) {
      const cleanUser = userPart.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, "")
                               .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/g, "")
                               .trim();
      res.push({ role: "User", text: cleanUser });
    }
    if (assistantPart) {
      const cleanAssistant = assistantPart.replace(/<thought>[\s\S]*?<\/thought>/g, "").trim();
      res.push({ role: "Assistant", text: cleanAssistant });
    }
    if (res.length > 0) return res;
  }

  // Case 3: JSON lines (transcript.jsonl)
  if (rawContent.startsWith("{") || rawContent.includes('"type":"USER_INPUT"')) {
    const lines = rawContent.split("\n").filter(Boolean);
    const messages: { role: string; text: string }[] = [];
    for (const l of lines) {
      try {
        const item = JSON.parse(l);
        if (item.type === "USER_INPUT" && item.content) {
          let text = item.content;
          const reqMatch = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
          if (reqMatch) text = reqMatch[1];
          text = text.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, "")
                     .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/g, "")
                     .replace(/<user_information>[\s\S]*?<\/user_information>/g, "")
                     .trim();
          if (text) messages.push({ role: "User", text });
        } else if (item.type === "PLANNER_RESPONSE" && item.content) {
          let text = item.content;
          text = text.replace(/<thought>[\s\S]*?<\/thought>/g, "").trim();
          if (text) messages.push({ role: "Assistant", text });
        }
      } catch {}
    }
    if (messages.length > 0) return messages;
  }

  // Case 4: Plain text fallback
  return [
    { role: "User", text: rawContent }
  ];
}

const PLATFORM_OPTIONS = [
  { value: "all", label: "全部", icon: "⊟" },
  { value: "antigravity", label: "Antigravity", icon: "⚛️" },
  { value: "codex", label: "codex", icon: "✳️" },
  { value: "gemini", label: "gemini", icon: "✨" },
];

export const ThreadsView: React.FC<ThreadsViewProps> = ({
  sessions,
  onSessionSelect,
  onDeleteSession,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "detail" | "agent_import">("list");
  const [activeThreadSession, setActiveThreadSession] = useState<Session | null>(null);
  const [selectedChat, setSelectedChat] = useState<FullChat | null>(null);
  const [sessionGraph, setSessionGraph] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [sessionMemories, setSessionMemories] = useState<Memory[]>([]);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false);
  const [isDistilling, setIsDistilling] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDistillModalOpen, setIsDistillModalOpen] = useState(false);
  const [distillTargetMsg, setDistillTargetMsg] = useState<{ text: string; role: string } | null>(null);
  const [distillStep, setDistillStep] = useState<"confirm" | "success">("confirm");

  // Selection Mode State (1:1 with Images 1 & 2)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchOperating, setIsBatchOperating] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Timeline scrubber & hover state (Screenshot 5)
  const [isTimelineHovered, setIsTimelineHovered] = useState(false);
  const [isJumpMenuOpen, setIsJumpMenuOpen] = useState(false);
  const chatStreamRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Pagination state (Screenshot 3)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Accordion toggle states
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    info: true,
    memory: true,
    entities: true,
  });

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Close platform dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsPlatformDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleSection = (sec: "summary" | "info" | "memory" | "entities") => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const openDistillModal = (msg?: { text: string; role: string }) => {
    setDistillTargetMsg(msg || null);
    setDistillStep("confirm");
    setIsDistillModalOpen(true);
  };

  const handleCloseDistillModal = () => {
    setIsDistillModalOpen(false);
    setDistillTargetMsg(null);
  };

  const handleConfirmDistill = async () => {
    if (!activeThreadSession) return;
    setIsDistilling(true);

    try {
      const textToExtract = distillTargetMsg?.text || selectedChat?.rawText || activeThreadSession.projectName;
      const titleCandidate = distillTargetMsg?.text?.slice(0, 30) || `${activeThreadSession.projectName} 关键提炼`;

      await createMemory({
        sessionId: activeThreadSession._id,
        title: titleCandidate.replace(/[#*_`]/g, "").trim(),
        content: textToExtract.slice(0, 1200),
        importance: "3",
        category: "Concept",
        tags: [activeThreadSession.platform || "gemini", "Distilled"],
        source: "conversation_distill",
      });

      const memRes = await getMemories();
      const allMems = Array.isArray(memRes) ? memRes : (memRes?.memories || []);
      setSessionMemories(allMems.filter((m: Memory) => m.sessionId === activeThreadSession._id));

      setDistillStep("success");
    } catch (e) {
      console.error("Distill failed:", e);
    } finally {
      setIsDistilling(false);
    }
  };

  const handleOpenThread = async (session: Session) => {
    if (isSelectMode) {
      toggleSelectSession(session._id);
      return;
    }

    setActiveThreadSession(session);
    setViewMode("detail");
    onSessionSelect(session);

    try {
      const chat = await getFullChat(session._id);
      setSelectedChat(chat);
    } catch {
      setSelectedChat(null);
    }

    try {
      const graph = await getGraphData(session._id);
      setSessionGraph(graph);
    } catch {
      setSessionGraph({ nodes: [], links: [] });
    }

    try {
      const memRes = await getMemories();
      const allMems = Array.isArray(memRes) ? memRes : (memRes?.memories || []);
      setSessionMemories(allMems.filter((m: Memory) => m.sessionId === session._id));
    } catch {
      setSessionMemories([]);
    }
  };

  const handleBackToList = () => {
    setActiveThreadSession(null);
    setSelectedChat(null);
    setViewMode("list");
  };

  const scrollToTurn = (index: number) => {
    const el = document.getElementById(`msg-turn-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setIsJumpMenuOpen(false);
  };

  const scrollToBottom = () => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTo({
        top: chatStreamRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const getPlatformIcon = (platform?: string) => {
    const p = (platform || "").toLowerCase();
    if (p.includes("antigravity")) {
      return (
        <span className="nl-icon-antigravity" title="Google Antigravity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)" />
            <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-45 12 12)" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        </span>
      );
    }
    if (p.includes("claude") || p.includes("codex")) return <span className="nl-icon-claude">✳️</span>;
    if (p.includes("gpt") || p.includes("openai")) return <span className="nl-icon-gpt">🟢</span>;
    if (p.includes("cursor")) return <span className="nl-icon-cursor">▲</span>;
    return <span className="nl-icon-gemini">✨</span>;
  };

  // Filter sessions
  const filteredSessions = sessions.filter((s) => {
    const matchesSearch = s.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform =
      platformFilter === "all" ||
      (s.platform && s.platform.toLowerCase().includes(platformFilter.toLowerCase()));
    return matchesSearch && matchesPlatform;
  });

  // Pagination calculation (Screenshot 3)
  const totalItems = filteredSessions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const currentItems = filteredSessions.slice(startIndex, startIndex + pageSize);

  // Selection handlers
  const toggleSelectSession = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSessions.map((s) => s._id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedIds.size} 个会话吗？此操作不可逆。${selectedIds.size > 1 ? "\n注意：会话对应的知识实体也会被清理。" : ""}`)) {
      return;
    }

    setIsBatchOperating(true);
    try {
      for (const id of selectedIds) {
        await deleteSession(id);
      }
      showToast(`成功删除 ${selectedIds.size} 个会话记录！`, "success");
      setSelectedIds(new Set());
      setIsSelectMode(false);
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      console.error("Batch delete failed:", e);
      showToast("批量删除失败", "error");
    } finally {
      setIsBatchOperating(false);
    }
  };

  const handleBatchReindex = async () => {
    setIsBatchOperating(true);
    try {
      const res = await rebuildSearchIndex();
      if (res && res.success) {
        showToast(`全库检索索引已重建成功 (共 ${res.indexedCount || filteredSessions.length} 条会话)！`, "success");
      } else {
        showToast("重建检索索引完成", "success");
      }
    } catch (e) {
      console.error("Reindex failed:", e);
      showToast("重建索引遇到异常", "error");
    } finally {
      setIsBatchOperating(false);
    }
  };

  // ----------------------------------------------------
  // VIEW MODE 1: Full-Page Agent Importer (Screenshots 1 & 2)
  // ----------------------------------------------------
  if (viewMode === "agent_import") {
    return (
      <AgentImporterView
        onBack={() => setViewMode("list")}
        onViewSession={(s) => handleOpenThread(s)}
        onImportSuccess={() => {
          window.location.reload();
        }}
      />
    );
  }

  // ----------------------------------------------------
  // VIEW MODE 2: Thread Detail Mode (Screenshots 4 & 5)
  // ----------------------------------------------------
  if (viewMode === "detail" && activeThreadSession) {
    const rawContent = selectedChat?.rawText || activeThreadSession.summary || "暂无对话原始文本";
    const platformName = activeThreadSession.platform || "gemini";
    const totalMsgCount = activeThreadSession.topicCount || 16;
    const coveredCount = sessionMemories.length;
    const messageBlocks = parseConversationMessages(rawContent);

    return (
      <div className="nl-thread-detail-container">
        {/* Top Header Breadcrumb Bar */}
        <div className="nl-thread-top-bar">
          <div className="nl-thread-top-info">
            <button className="nl-thread-back-btn" onClick={handleBackToList}>
              ← 返回所有会话
            </button>
            <div className="nl-thread-platform-pill">
              {getPlatformIcon(platformName)}
              <span>{platformName}</span>
            </div>
          </div>
        </div>

        {/* Detail Content (Chat on left, Inspector on right) */}
        <div className="nl-thread-detail-body">
          {/* Left Conversational Stream */}
          <div className="nl-thread-chat-pane">
            <div className="nl-thread-chat-prompt-header">
              <h2 className="nl-thread-chat-prompt-title">你想从哪个功能点开始继续？</h2>
            </div>

            <div className="nl-thread-chat-stream" ref={chatStreamRef}>
              {messageBlocks.map((msg, index) => (
                <div key={index} id={`msg-turn-${index}`} className="nl-chat-msg-row">
                  <div className="nl-msg-avatar-col">
                    <div className={`nl-chat-avatar ${msg.role.toLowerCase()}`}>
                      {msg.role === "User" ? "👤" : "🤖"}
                    </div>
                  </div>

                  <div className="nl-msg-content-col">
                    <div className="nl-msg-header-line">
                      <span className="nl-msg-role-name">{msg.role}</span>
                      {msg.role === "Assistant" && (
                        <span className="nl-msg-date-icon" title="系统记录">📅</span>
                      )}
                      <div className="nl-msg-tools">
                        <button
                          className="nl-msg-tool-btn"
                          title="复制文本"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.text);
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                          </svg>
                        </button>
                        <button
                          className="nl-msg-tool-btn distill"
                          title="从这条消息提炼记忆"
                          onClick={() => openDistillModal(msg)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="nl-msg-bubble-body">
                      <pre className="nl-chat-msg-pre">{msg.text}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline Scrubber Track & Hover Drawer (Screenshot 5 user annotation) */}
            <div
              className="nl-thread-timeline-rail"
              onMouseEnter={() => setIsTimelineHovered(true)}
              onMouseLeave={() => setIsTimelineHovered(false)}
            >
              <div className="nl-timeline-scrub-bar">
                {messageBlocks.slice(0, 30).map((_, idx) => (
                  <div
                    key={idx}
                    className="nl-scrub-tick"
                    onClick={() => scrollToTurn(idx)}
                    title={`跳转到第 ${idx + 1} 轮`}
                  />
                ))}
              </div>

              {/* Hover Drawer with turn snippets */}
              {isTimelineHovered && (
                <div className="nl-timeline-hover-drawer">
                  <div className="nl-drawer-header">
                    <span>📌 对话目录 ({messageBlocks.length})</span>
                  </div>
                  <div className="nl-drawer-list">
                    {messageBlocks.map((m, idx) => {
                      const snippet = m.text.slice(0, 45).replace(/[#*_`]/g, "");
                      return (
                        <div
                          key={idx}
                          className="nl-drawer-item"
                          onClick={() => scrollToTurn(idx)}
                        >
                          <span className={`nl-drawer-badge ${m.role.toLowerCase()}`}>
                            {m.role === "User" ? "U" : "A"}
                          </span>
                          <span className="nl-drawer-snippet">
                            - {snippet}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Floating Bottom Navigator (Screenshot 4) */}
            <div className="nl-thread-bottom-nav">
              <button className="nl-bottom-nav-btn calendar" title="时间线">
                📅
              </button>
              <div className="nl-bottom-nav-jump-wrap">
                <button
                  className="nl-bottom-nav-btn jump-btn"
                  onClick={() => setIsJumpMenuOpen(!isJumpMenuOpen)}
                >
                  <span>{messageBlocks.length}</span>
                  <span className="nl-arrow">▾</span>
                </button>
                {isJumpMenuOpen && (
                  <div className="nl-jump-popup-menu">
                    {messageBlocks.map((m, idx) => (
                      <div
                        key={idx}
                        className="nl-jump-menu-item"
                        onClick={() => scrollToTurn(idx)}
                      >
                        <span className="nl-jump-turn-num">#{idx + 1}</span>
                        <span className="nl-jump-turn-text">{m.text.slice(0, 25)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="nl-bottom-nav-btn scroll-down"
                  onClick={scrollToBottom}
                  title="滚动到底部"
                >
                  ⬇️
                </button>
              </div>
            </div>
          </div>

          {/* Right Inspector Column */}
          <div className="nl-thread-inspector-pane">
            <div className="nl-inspector-top-action">
              <button
                className="nl-btn-primary distill-all-btn"
                onClick={() => openDistillModal()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  backgroundColor: "#4f46e5",
                  color: "#ffffff",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontWeight: 600,
                  fontSize: "13px",
                  width: "100%",
                }}
              >
                <span>✨</span> 提炼
              </button>
              <div className="nl-coverage-pill">
                <span className="nl-coverage-icon">📊</span>
                <span>{coveredCount}/{totalMsgCount} Covered</span>
              </div>
            </div>

            {/* Accordion 1: AI 摘要 */}
            <div className="nl-thread-accordion-card">
              <div
                className="nl-accordion-header"
                onClick={() => toggleSection("summary")}
              >
                <div className="nl-accordion-title">
                  <span>📄</span> AI 摘要
                </div>
                <span className="nl-accordion-arrow">
                  {expandedSections.summary ? "▾" : "▸"}
                </span>
              </div>
              {expandedSections.summary && (
                <div className="nl-accordion-content">
                  <p className="nl-empty-hint-text">还没有摘要。</p>
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
                  <span>ℹ️</span> 会话信息
                </div>
                <span className="nl-accordion-arrow">
                  {expandedSections.info ? "▾" : "▸"}
                </span>
              </div>
              {expandedSections.info && (
                <div className="nl-accordion-content">
                  <div className="nl-thread-meta-title">
                    {activeThreadSession.projectName}
                  </div>
                  <div className="nl-thread-meta-tags">
                    <span className="nl-meta-tag platform">
                      {platformName}
                    </span>
                    <span className="nl-meta-tag msgs">
                      💬 {messageBlocks.length || totalMsgCount} 条消息
                    </span>
                  </div>
                  <div className="nl-thread-meta-actors">
                    👤 User, Assistant
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

        {/* 1:1 Distill Modal */}
        {isDistillModalOpen && (
          <div className="nl-modal-backdrop" onClick={handleCloseDistillModal} style={{ zIndex: 1000 }}>
            <div
              className="nl-modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "460px",
                width: "90%",
                backgroundColor: "#16181f",
                border: "1px solid #2e323e",
                borderRadius: "14px",
                padding: "24px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
                color: "#ffffff",
              }}
            >
              {distillStep === "confirm" ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div>
                      <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "#818cf8" }}>✨</span> 提炼会话
                      </h2>
                      <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
                        从这段会话中提取知识
                      </p>
                    </div>
                    <button
                      onClick={handleCloseDistillModal}
                      style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "18px", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#1c1f28",
                      border: "1px solid #2a2e3a",
                      borderRadius: "10px",
                      padding: "16px",
                      marginBottom: "16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "13px", color: "#f8fafc", marginBottom: "6px" }}>
                      <span>☁️</span> 在后台提炼
                    </div>
                    <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 14px 0" }}>
                      Mem 会通读这段对话，把关键内容整理成记忆。整个过程在后台完成，再长的对话也能处理。
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        backgroundColor: "#14161d",
                        border: "1px solid #232733",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#cbd5e1" }}>
                        <span style={{ color: "#818cf8" }}>☑️</span> 已选择 {distillTargetMsg ? "1 条消息" : `全部 ${messageBlocks.length || totalMsgCount} 条消息`}
                      </div>
                      <span style={{ color: "#94a3b8", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                        {activeThreadSession.projectName}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "20px" }}>
                    Remote AI is not enabled (Local CM Engine active)
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                      className="nl-btn-secondary"
                      onClick={handleCloseDistillModal}
                      style={{ fontSize: "12px", padding: "6px 12px" }}
                    >
                      ✨ 最小化
                    </button>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        className="nl-btn-secondary"
                        onClick={handleCloseDistillModal}
                        style={{ fontSize: "12px", padding: "6px 14px" }}
                      >
                        取消
                      </button>
                      <button
                        className="nl-btn-primary"
                        onClick={handleConfirmDistill}
                        disabled={isDistilling}
                        style={{
                          fontSize: "12px",
                          padding: "6px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          backgroundColor: "#4f46e5",
                          borderColor: "#4338ca",
                        }}
                      >
                        ✨ {isDistilling ? "正在加入..." : "加入后台处理"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "16px 10px" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(99, 102, 241, 0.15)",
                      border: "2px solid #818cf8",
                      color: "#818cf8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "22px",
                      margin: "0 auto 16px auto",
                    }}
                  >
                    ✓
                  </div>
                  <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 8px 0", color: "#ffffff" }}>
                    已加入后台处理
                  </h2>
                  <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 22px 0" }}>
                    处理完成后，你可以在时间线和动态中看到生成的记忆。
                  </p>
                  <button
                    className="nl-btn-primary"
                    onClick={handleCloseDistillModal}
                    style={{
                      minWidth: "110px",
                      padding: "8px 24px",
                      fontSize: "13px",
                      backgroundColor: "#4f46e5",
                      borderColor: "#4338ca",
                      borderRadius: "8px",
                    }}
                  >
                    完成
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW MODE 3: Main Thread List Mode (Screenshots 1-4)
  // ----------------------------------------------------
  const currentSelectedOption = PLATFORM_OPTIONS.find((o) => o.value === platformFilter) || PLATFORM_OPTIONS[0];

  return (
    <div className="nl-threads-view">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`nl-toast-alert ${toastMessage.type}`}>
          <span className="nl-toast-icon">
            {toastMessage.type === "success" ? "✓" : toastMessage.type === "error" ? "✕" : "ℹ️"}
          </span>
          <span className="nl-toast-text">{toastMessage.text}</span>
        </div>
      )}

      {/* Session Importer Modal (For file uploads) */}
      <SessionImporterModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onOpenAgentImporter={() => {
          setIsImportModalOpen(false);
          setViewMode("agent_import");
        }}
        onImportSuccess={() => window.location.reload()}
      />

      {/* View Header */}
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">会话记录</h1>
          <p className="nl-view-subtitle">
            浏览、搜索和管理从各类 AI 工具保存下来的会话。
          </p>
        </div>
      </div>

      {/* Top Search Row (1:1 with Images 1 & 2) */}
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
          <button className="nl-threads-search-icon-btn" title="搜索">
            🔍
          </button>
        </div>
        <button
          className="nl-btn-agent-threads active"
          onClick={() => setViewMode("agent_import")}
          title="发现并批量导入本地 AI 智能体会话"
        >
          <span className="nl-btn-agent-icon">✳️</span>
          <span>智能体会话</span>
        </button>
      </div>

      {/* Control Bar (1:1 with Images 1-4) */}
      <div className="nl-threads-control-bar">
        {!isSelectMode ? (
          <>
            <div className="nl-threads-left-controls">
              {/* Custom Platform Filter Dropdown (Images 3 & 4) */}
              <div className="nl-platform-dropdown-wrap" ref={dropdownRef}>
                <button
                  className="nl-platform-dropdown-btn"
                  onClick={() => setIsPlatformDropdownOpen(!isPlatformDropdownOpen)}
                >
                  <span className="nl-pdrop-icon">{currentSelectedOption.icon}</span>
                  <span className="nl-pdrop-label">{currentSelectedOption.label}</span>
                  <span className="nl-pdrop-arrow">▾</span>
                </button>

                {isPlatformDropdownOpen && (
                  <div className="nl-platform-dropdown-menu">
                    {PLATFORM_OPTIONS.map((opt) => (
                      <div
                        key={opt.value}
                        className={`nl-platform-dropdown-item ${platformFilter === opt.value ? "active" : ""}`}
                        onClick={() => {
                          setPlatformFilter(opt.value);
                          setIsPlatformDropdownOpen(false);
                        }}
                      >
                        <span className="nl-pdrop-item-icon">{opt.icon}</span>
                        <span className="nl-pdrop-item-label">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <span className="nl-result-count">
                结果 <strong>{filteredSessions.length}</strong> 条
              </span>
              <button className="nl-refresh-icon-btn" title="刷新" onClick={() => window.location.reload()}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                  <path d="M16 16h5v5"/>
                </svg>
              </button>
            </div>

            <div className="nl-threads-right-controls">
              <button
                className="nl-btn-import-thread"
                onClick={() => setIsImportModalOpen(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>导入会话</span>
              </button>
              <button
                className="nl-btn-secondary"
                onClick={() => {
                  setIsSelectMode(true);
                  setSelectedIds(new Set());
                }}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2"/>
                  <path d="m7 12 2 2 3-3"/>
                  <path d="m13 12 2 2 3-3"/>
                </svg>
                <span>选择</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Selection Mode Control Bar (1:1 with Memories & Threads View) */}
            <div className="nl-threads-left-controls">
              <span className="nl-result-count">
                已选择 <strong>{selectedIds.size}</strong> / {filteredSessions.length} 条
              </span>
              <button
                className="nl-btn-secondary"
                onClick={handleSelectAll}
                style={{ fontSize: "11.5px", padding: "4px 8px" }}
              >
                {selectedIds.size === filteredSessions.length ? "取消全选" : "全选"}
              </button>
              <button
                className="nl-btn-secondary"
                onClick={() => setSelectedIds(new Set())}
                style={{ fontSize: "11.5px", padding: "4px 8px" }}
              >
                清空
              </button>
            </div>

            <div className="nl-threads-right-controls">
              <button
                className="nl-btn-danger"
                onClick={handleBatchDelete}
                disabled={isBatchOperating || selectedIds.size === 0}
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>{isBatchOperating ? "删除中..." : `批量删除 (${selectedIds.size})`}</span>
              </button>
              <button
                className="nl-btn-secondary"
                onClick={handleBatchReindex}
                disabled={isBatchOperating}
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
              >
                <span>⚡</span>
                <span>重新索引</span>
              </button>
              <button
                className="nl-btn-secondary"
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedIds(new Set());
                }}
                style={{ fontSize: "12px" }}
              >
                ✕ 退出选择
              </button>
            </div>
          </>
        )}
      </div>

      {/* Thread Cards Stream (Screenshot 3) */}
      {filteredSessions.length === 0 ? (
        <div className="nl-empty-state-card">
          <div className="nl-empty-state-icon">💬</div>
          <h2 className="nl-empty-state-title">暂无会话记录</h2>
          <p className="nl-empty-state-sub">
            点击右上角“智能体会话”一键发现并批量导入本地会话，或通过“导入会话”导入记录。
          </p>
        </div>
      ) : (
        <div className="nl-threads-list-stream">
          {currentItems.map((s) => {
            const dateFormatted = s.updatedAt
              ? new Date(s.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Aug 19, 2026";
            const isSelected = selectedIds.has(s._id);

            return (
              <div
                key={s._id}
                className={`nl-thread-row-card ${isSelected ? "selected" : ""}`}
                onClick={() => handleOpenThread(s)}
              >
                {/* Selection Checkbox */}
                {isSelectMode && (
                  <div
                    className="nl-row-checkbox-wrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectSession(s._id);
                    }}
                  >
                    <div className={`nl-custom-checkbox ${isSelected ? "checked" : ""}`}>
                      {isSelected && "✓"}
                    </div>
                  </div>
                )}

                <div className="nl-thread-row-icon">
                  <div className="nl-platform-icon-circle">
                    {getPlatformIcon(s.platform)}
                  </div>
                </div>

                <div className="nl-thread-row-main">
                  <div className="nl-thread-row-title">{s.projectName}</div>
                  <div className="nl-thread-row-meta">
                    💬 {s.topicCount || 16} 条消息 · {s.platform || "Antigravity"}
                  </div>
                </div>

                <div className="nl-thread-row-right">
                  <span className="nl-thread-row-date">{dateFormatted}</span>
                  {!isSelectMode && (
                    <div className="nl-thread-row-actions">
                      <button
                        className="nl-row-icon-btn"
                        title="删除会话"
                        onClick={(e) => onDeleteSession(e, s._id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                      <button
                        className="nl-row-icon-btn"
                        title="置顶/收藏"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer (1:1 with Screenshot 3) */}
      {filteredSessions.length > 0 && (
        <div className="nl-threads-pagination-bar">
          <div className="nl-pagination-info">
            第 {validPage} 页，共 {totalPages} 页 {startIndex + 1}-{Math.min(startIndex + pageSize, totalItems)} / 共 {totalItems} 条
          </div>
          <div className="nl-pagination-controls">
            <span className="nl-pagination-jump-text">页码 / {totalPages}</span>
            <button
              className="nl-pagination-btn"
              disabled={validPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              ◀ 上一页
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`nl-pagination-num-btn ${p === validPage ? "active" : ""}`}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="nl-pagination-btn"
              disabled={validPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页 ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
