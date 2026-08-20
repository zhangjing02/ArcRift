import React, { useState, useEffect } from "react";
import { scanAgentSessions, importAgentSessions } from "../../api/ArcRift";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface DiscoveredSession {
  id: string;
  externalChatId?: string;
  platform: string;
  projectName: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  relativeTime?: string;
  timestamp?: number;
  rawText: string;
  messages: Array<{ role: "User" | "Assistant"; text: string; time?: string }>;
  imported?: boolean;
  hasNewMessages?: boolean;
  dbMessageCount?: number;
}

interface ProjectGroup {
  projectName: string;
  platform: string;
  totalMessages: number;
  importedCount: number;
  hasNewMessagesCount?: number;
  latestUpdate?: string;
  latestTimestamp?: number;
  sessions: DiscoveredSession[];
}

interface AgentImporterViewProps {
  onBack: () => void;
  onViewSession?: (session: any) => void;
  onImportSuccess?: () => void;
}

export const AgentImporterView: React.FC<AgentImporterViewProps> = ({
  onBack,
  onViewSession,
  onImportSuccess,
}) => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [allSessions, setAllSessions] = useState<DiscoveredSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [activePreview, setActivePreview] = useState<DiscoveredSession | null>(null);
  const [isAutoSync, setIsAutoSync] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAllMessages, setShowAllMessages] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await scanAgentSessions();
      if (res && res.success) {
        const rawGroups: ProjectGroup[] = res.groups || [];
        const rawSessions: DiscoveredSession[] = res.sessions || [];

        setGroups(rawGroups);
        setAllSessions(rawSessions);

        // Expand all projects by default
        const exp = new Set<string>(rawGroups.map((g) => g.projectName));
        setExpandedProjects(exp);

        // Select un-imported sessions or sessions with new messages by default
        const needSyncIds = new Set<string>(
          rawSessions
            .filter((s) => !s.imported || s.hasNewMessages)
            .map((s) => s.id)
        );
        setSelectedIds(needSyncIds.size > 0 ? needSyncIds : new Set(rawSessions.map((s) => s.id)));

        // Set first session as active preview
        if (rawSessions.length > 0) {
          setActivePreview(rawSessions[0]);
        }
      }
    } catch (err) {
      console.error("Failed to scan agent sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reset showAllMessages when activePreview changes
  useEffect(() => {
    setShowAllMessages(false);
  }, [activePreview?.id]);

  const toggleProjectExpand = (projectName: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectName)) next.delete(projectName);
      else next.add(projectName);
      return next;
    });
  };

  const toggleSelectSession = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectGroup = (g: ProjectGroup) => {
    const groupIds = g.sessions.map((s) => s.id);
    const allSelected = groupIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        groupIds.forEach((id) => next.delete(id));
      } else {
        groupIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === allSessions.length && allSessions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allSessions.map((s) => s.id)));
    }
  };

  const handleExport = () => {
    const targetSessions = allSessions.filter((s) => selectedIds.has(s.id));
    const toExport = targetSessions.length > 0 ? targetSessions : activePreview ? [activePreview] : [];
    if (toExport.length === 0) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(toExport, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `agent_sessions_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setToastMessage(`已成功导出 ${toExport.length} 个会话数据`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleImport = async (andView = false) => {
    const targetSessions = allSessions.filter((s) => selectedIds.has(s.id));
    const total = targetSessions.length;
    if (total === 0) return;

    setIsImporting(true);
    try {
      const BATCH_SIZE = 10;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalImported = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = targetSessions.slice(i, i + BATCH_SIZE);
        const res = await importAgentSessions(batch);
        if (res && res.success) {
          totalCreated += (res.createdCount ?? res.importedCount ?? 0);
          totalUpdated += (res.updatedCount ?? 0);
          totalSkipped += (res.skippedCount ?? 0);
          totalImported += (res.importedCount ?? 0);
        }
      }

      // Mark imported and clear new messages flag in local state
      setAllSessions((prev) =>
        prev.map((s) => (selectedIds.has(s.id) ? { ...s, imported: true, hasNewMessages: false } : s))
      );
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          importedCount: g.sessions.filter((s) => selectedIds.has(s.id) || s.imported).length,
          hasNewMessagesCount: g.sessions.filter((s) => !selectedIds.has(s.id) && s.hasNewMessages).length,
          sessions: g.sessions.map((s) => (selectedIds.has(s.id) ? { ...s, imported: true, hasNewMessages: false } : s)),
        }))
      );

      // Informative status toast
      let msg = "";
      if (totalCreated > 0 || totalUpdated > 0) {
        msg = `导入完成：新增 ${totalCreated} 个，更新 ${totalUpdated} 个${totalSkipped > 0 ? `，跳过 ${totalSkipped} 个已存在会话` : ""}`;
      } else if (totalSkipped > 0) {
        msg = `所选会话已是最新版本：自动跳过 ${totalSkipped} 个重复会话`;
      } else {
        msg = `成功同步 ${totalImported} 个会话`;
      }

      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 4500);

      if (andView && activePreview) {
        onViewSession?.({
          _id: activePreview.id,
          projectName: activePreview.title || activePreview.projectName,
          platform: activePreview.platform,
          topicCount: activePreview.messageCount,
          summary: activePreview.rawText,
        });
      } else {
        onImportSuccess?.();
      }
    } catch (err) {
      console.error("Import failed:", err);
      setToastMessage("导入失败：" + (err instanceof Error ? err.message : String(err)));
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsImporting(false);
    }
  };

  const getPlatformIcon = (platform?: string) => {
    const p = (platform || "").toLowerCase();
    if (p.includes("antigravity")) return "⚛️";
    if (p.includes("claude") || p.includes("codex")) return "✳️";
    if (p.includes("cursor")) return "▲";
    if (p.includes("opencode")) return "📱";
    return "🤖";
  };

  // Filter groups according to search
  const filteredGroups = groups
    .map((g) => {
      const filtered = g.sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.projectName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return { ...g, sessions: filtered };
    })
    .filter(
      (g) =>
        g.sessions.length > 0 ||
        g.projectName.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="nl-agent-importer-view">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="nl-import-toast">
          <div className="nl-toast-icon">🔔</div>
          <div className="nl-toast-content">
            <div className="nl-toast-title">提示</div>
            <div className="nl-toast-desc">{toastMessage}</div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="nl-agent-header">
        <div className="nl-agent-header-left">
          <button className="nl-agent-back-btn" onClick={onBack} title="返回会话记录">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div className="nl-agent-title-group">
            <h1 className="nl-agent-title">智能体会话</h1>
            <p className="nl-agent-subtitle">发现并导入 AI 编程助手保存的会话</p>
          </div>
        </div>
        <div className="nl-agent-header-right">
          <button
            className={`nl-agent-sync-toggle ${isAutoSync ? "active" : ""}`}
            onClick={() => setIsAutoSync(!isAutoSync)}
            title={isAutoSync ? "自动同步已开启" : "自动同步已关闭"}
          >
            <span className="nl-sync-icon">⚙️</span>
            <span>自动同步</span>
            <span className={`nl-sync-indicator ${isAutoSync ? "on" : "off"}`} />
          </button>
        </div>
      </div>

      {/* Main Split Body */}
      <div className="nl-agent-body">
        {/* Left Tree Column */}
        <div className="nl-agent-tree-col">
          <div className="nl-agent-tree-header">
            <div className="nl-agent-tree-title">会话</div>
            <div className="nl-agent-tree-count">
              {loading ? "扫描中..." : `${allSessions.length} 个会话, ${groups.length} 个项目`}
            </div>
          </div>

          <div className="nl-agent-tree-search-wrap">
            <div className="nl-tree-search-box">
              <span className="nl-tree-search-icon">🔍</span>
              <input
                type="text"
                placeholder="搜索会话..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="nl-agent-tree-search-input"
              />
              {searchQuery && (
                <button
                  className="nl-tree-search-clear"
                  onClick={() => setSearchQuery("")}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="nl-agent-tree-ctrl-bar">
            <button className="nl-agent-tree-ctrl-btn" onClick={loadData} disabled={loading}>
              <span className={`nl-ctrl-btn-icon ${loading ? "spinning" : ""}`}>🔄</span> 刷新
            </button>
            <button
              className={`nl-agent-tree-ctrl-btn ${selectedIds.size === allSessions.length && allSessions.length > 0 ? "active" : ""}`}
              onClick={handleSelectAll}
            >
              ☑️ 选择
            </button>
            <span className="nl-agent-selected-hint">已选择 {selectedIds.size} 个会话</span>
          </div>

          {/* Group Tree List or Loading State */}
          <div className="nl-agent-tree-list">
            {loading ? (
              /* Screenshot 3: Left Centered Loading Animation */
              <div className="nl-agent-loading-card">
                <div className="nl-agent-radar-anim">
                  <div className="nl-radar-ring ring1" />
                  <div className="nl-radar-ring ring2" />
                  <div className="nl-radar-ring ring3" />
                  <div className="nl-radar-center">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)" />
                      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-45 12 12)" />
                      <circle cx="12" cy="12" r="2" fill="#818cf8" />
                    </svg>
                  </div>
                </div>
                <div className="nl-agent-loading-title">正在扫描会话...</div>
                <div className="nl-agent-loading-subtitle">
                  正在检查 Claude Code, Codex, Cursor 和 OpenCode, Google Antigravity
                </div>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="nl-agent-empty-tree">
                <span>💬</span>
                <p>未发现匹配的智能体会话</p>
              </div>
            ) : (
              filteredGroups.map((g) => {
                const isExpanded = expandedProjects.has(g.projectName);
                const groupIds = g.sessions.map((s) => s.id);
                const isGroupSelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));
                const isGroupIndeterminate = !isGroupSelected && groupIds.some((id) => selectedIds.has(id));

                return (
                  <div key={g.projectName} className="nl-agent-group-block">
                    {/* Project Header Row */}
                    <div
                      className="nl-agent-group-row"
                      onClick={() => toggleProjectExpand(g.projectName)}
                    >
                      <button
                        className="nl-agent-checkbox-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectGroup(g);
                        }}
                      >
                        {isGroupSelected ? (
                          <span className="nl-custom-check checked">✓</span>
                        ) : isGroupIndeterminate ? (
                          <span className="nl-custom-check indeterminate">−</span>
                        ) : (
                          <span className="nl-custom-check" />
                        )}
                      </button>
                      <span className="nl-agent-group-arrow">{isExpanded ? "▾" : "▸"}</span>
                      <span className="nl-agent-group-icon">{getPlatformIcon(g.platform)}</span>
                      <span className="nl-agent-group-name" title={g.projectName}>{g.projectName}</span>
                      <div className="nl-agent-group-meta">
                        <span className="nl-agent-group-time">{g.latestUpdate || g.sessions[0]?.updatedAt || "08:39"}</span>
                        <span className="nl-agent-group-count">{g.sessions.length}</span>
                      </div>
                    </div>

                    {/* Child Sessions */}
                    {isExpanded && (
                      <div className="nl-agent-child-list">
                        {g.sessions.map((s) => {
                          const isSelected = selectedIds.has(s.id);
                          const isActive = activePreview?.id === s.id;

                          return (
                            <div
                              key={s.id}
                              className={`nl-agent-child-row ${isActive ? "active" : ""}`}
                              onClick={() => setActivePreview(s)}
                            >
                              <button
                                className="nl-agent-checkbox-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectSession(s.id);
                                }}
                              >
                                {isSelected ? (
                                  <span className="nl-custom-check checked">✓</span>
                                ) : (
                                  <span className="nl-custom-check" />
                                )}
                              </button>
                              <span className="nl-agent-child-expand-icon">&gt;</span>
                              <span className="nl-agent-child-title" title={s.title}>
                                {s.title || "还没有预览"}
                              </span>
                              <div className="nl-agent-child-meta">
                                <span className="nl-agent-msg-count">💬 {s.messageCount}</span>
                                <span className="nl-agent-child-date">{s.updatedAt}</span>
                                {s.imported ? (
                                  s.hasNewMessages ? (
                                    <span
                                      className="nl-child-updated-tag"
                                      style={{
                                        color: "#38bdf8",
                                        backgroundColor: "rgba(56, 189, 248, 0.15)",
                                        padding: "1px 6px",
                                        borderRadius: "10px",
                                        fontSize: "11px",
                                        fontWeight: 500,
                                      }}
                                      title={`数据库已存 ${s.dbMessageCount || 0} 条，发现新消息`}
                                    >
                                      +新消息
                                    </span>
                                  ) : (
                                    <span
                                      className="nl-child-imported-tag"
                                      style={{
                                        color: "#34d399",
                                        backgroundColor: "rgba(52, 211, 153, 0.15)",
                                        padding: "1px 6px",
                                        borderRadius: "10px",
                                        fontSize: "11px",
                                        fontWeight: 500,
                                      }}
                                      title="已同步到知识库"
                                    >
                                      ✓ 已同步
                                    </span>
                                  )
                                ) : (
                                  <span
                                    className="nl-child-new-tag"
                                    style={{
                                      color: "#a78bfa",
                                      backgroundColor: "rgba(167, 139, 250, 0.12)",
                                      padding: "1px 6px",
                                      borderRadius: "10px",
                                      fontSize: "11px",
                                    }}
                                    title="尚未导入"
                                  >
                                    未导入
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Preview Column */}
        <div className="nl-agent-preview-col">
          {loading ? (
            /* Screenshot 3: Right Centered Empty/Prompt State */
            <div className="nl-agent-preview-placeholder">
              <div className="nl-empty-chat-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="nl-empty-title">选择会话</h3>
              <p className="nl-empty-subtitle">从列表中选择一个会话，预览后再导入</p>
            </div>
          ) : activePreview ? (
            /* Screenshot 4: Right Active Session Preview */
            <div className="nl-agent-preview-content">
              {/* Preview Header */}
              <div className="nl-agent-prev-header">
                <div className="nl-agent-prev-path">
                  <span className="nl-path-arrow">&gt;</span>
                  <span className="nl-path-name">{activePreview.projectName || activePreview.platform}</span>
                  {activePreview.imported && (
                    <span
                      className="nl-prev-imported-badge"
                      style={{
                        color: activePreview.hasNewMessages ? "#38bdf8" : "#34d399",
                        backgroundColor: activePreview.hasNewMessages ? "rgba(56, 189, 248, 0.15)" : "rgba(52, 211, 153, 0.15)",
                        border: `1px solid ${activePreview.hasNewMessages ? "rgba(56, 189, 248, 0.3)" : "rgba(52, 211, 153, 0.3)"}`,
                        borderRadius: "12px",
                        padding: "2px 8px",
                        fontSize: "12px",
                        marginLeft: "8px",
                      }}
                    >
                      {activePreview.hasNewMessages ? "⟳ 发现新消息待同步" : "✓ 已同步"}
                    </span>
                  )}
                </div>
                <h2 className="nl-agent-prev-title">{activePreview.projectName || activePreview.title}</h2>
                <div className="nl-agent-prev-meta">
                  💬 {activePreview.messageCount} 条消息 · {activePreview.relativeTime || activePreview.updatedAt}
                </div>
              </div>

              {/* Preview Chat Message Stream */}
              <div className="nl-agent-prev-stream">
                {activePreview.messages && activePreview.messages.length > 0 ? (
                  (showAllMessages ? activePreview.messages : activePreview.messages.slice(0, 4)).map((m, idx) => (
                    <div key={idx} className={`nl-agent-prev-bubble-row ${m.role.toLowerCase()}`}>
                      <div className="nl-agent-prev-bubble-avatar">
                        {m.role === "User" ? "👤" : "🤖"}
                      </div>
                      <div className="nl-agent-prev-bubble-box">
                        <div className="nl-agent-prev-bubble-role">{m.role}</div>
                        <div className="nl-agent-prev-bubble-text">
                          <MarkdownRenderer
                            content={m.text}
                            showSummaryCard={false}
                            className="nl-bubble-md-renderer"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="nl-agent-prev-bubble-row user">
                    <div className="nl-agent-prev-bubble-avatar">👤</div>
                    <div className="nl-agent-prev-bubble-box">
                      <div className="nl-agent-prev-bubble-role">User</div>
                      <div className="nl-agent-prev-bubble-text">
                        <MarkdownRenderer
                          content={activePreview.rawText}
                          showSummaryCard={false}
                          className="nl-bubble-md-renderer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activePreview.messages && activePreview.messages.length > 4 && (
                  <div
                    className="nl-agent-prev-more-hint"
                    onClick={() => setShowAllMessages(!showAllMessages)}
                  >
                    <span>
                      💬 {showAllMessages ? "收起多余消息" : `还有 ${activePreview.messages.length - 4} 条消息`}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Tip Info Card (1:1 with Screenshot 4) */}
              <div className="nl-agent-prev-tip-card">
                <div className="nl-tip-card-header">
                  <span className="nl-tip-icon">ⓘ</span>
                  <strong>导入一次，后面就更省心</strong>
                </div>
                <p className="nl-tip-card-text">
                  Mem 先把这段会话存下来。打开自动同步后，它会继续为这条会话追加新消息；在支持项目识别的应用里，也会把这一项目后续出现的新会话带进来。
                </p>
              </div>
            </div>
          ) : (
            <div className="nl-agent-preview-placeholder">
              <div className="nl-empty-chat-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="nl-empty-title">选择会话</h3>
              <p className="nl-empty-subtitle">从列表中选择一个会话，预览后再导入</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Action Bar (1:1 with Screenshot 4) */}
      <div className="nl-agent-action-bar">
        <div className="nl-agent-action-left">
          <label className="nl-agent-select-all-label" onClick={handleSelectAll}>
            <span className={`nl-custom-check ${selectedIds.size === allSessions.length && allSessions.length > 0 ? "checked" : ""}`}>
              {selectedIds.size === allSessions.length && allSessions.length > 0 ? "✓" : ""}
            </span>
            <span>全选</span>
          </label>
          <span className="nl-agent-selected-counter">
            {selectedIds.size} / {allSessions.length} 已选择
          </span>
          <button className="nl-btn-export" onClick={handleExport} title="导出为 JSON 文件">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>导出</span>
          </button>
        </div>

        <div className="nl-agent-action-right">
          <button
            className="nl-btn-light"
            onClick={() => handleImport(true)}
            disabled={isImporting || selectedIds.size === 0}
          >
            📥 导入并查看
          </button>
          <button className="nl-btn-secondary" onClick={onBack}>
            取消
          </button>
          <button
            className="nl-btn-primary"
            onClick={() => handleImport(false)}
            disabled={isImporting || selectedIds.size === 0}
          >
            {isImporting ? "正在导入..." : `📥 导入 (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};


