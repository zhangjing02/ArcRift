import React, { useState, useEffect } from "react";
import { scanAgentSessions, importAgentSessions } from "../../api/ArcRift";

interface DiscoveredSession {
  id: string;
  platform: string;
  projectName: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  rawText: string;
  messages: Array<{ role: "User" | "Assistant"; text: string; time?: string }>;
  imported?: boolean;
}

interface ProjectGroup {
  projectName: string;
  platform: string;
  totalMessages: number;
  importedCount: number;
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

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await scanAgentSessions();
      if (res && res.success) {
        setGroups(res.groups || []);
        setAllSessions(res.sessions || []);

        // Expand all projects by default
        const exp = new Set<string>((res.groups || []).map((g) => g.projectName));
        setExpandedProjects(exp);

        // Select all by default
        const allIds = new Set<string>((res.sessions || []).map((s) => s.id));
        setSelectedIds(allIds);

        // Set first session as active preview
        if (res.sessions && res.sessions.length > 0) {
          setActivePreview(res.sessions[0]);
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
    if (selectedIds.size === allSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allSessions.map((s) => s.id)));
    }
  };

  const handleImport = async (andView = false) => {
    const targetSessions = allSessions.filter((s) => selectedIds.has(s.id));
    const total = targetSessions.length;
    if (total === 0) return;

    setIsImporting(true);
    try {
      const BATCH_SIZE = 10;
      let totalImported = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = targetSessions.slice(i, i + BATCH_SIZE);
        const res = await importAgentSessions(batch);
        if (res && res.success) {
          totalImported += res.importedCount;
        }
      }

      if (totalImported > 0) {
        // Mark imported in local state
        setAllSessions((prev) =>
          prev.map((s) => (selectedIds.has(s.id) ? { ...s, imported: true } : s))
        );
        setGroups((prev) =>
          prev.map((g) => ({
            ...g,
            importedCount: g.sessions.filter((s) => selectedIds.has(s.id) || s.imported).length,
            sessions: g.sessions.map((s) => (selectedIds.has(s.id) ? { ...s, imported: true } : s)),
          }))
        );

        setToastMessage(`成功导入 ${totalImported} 个会话`);
        setTimeout(() => setToastMessage(null), 4000);

        if (andView && activePreview) {
          onViewSession?.({
            _id: activePreview.id,
            projectName: activePreview.title,
            platform: activePreview.platform,
            topicCount: activePreview.messageCount,
            summary: activePreview.rawText,
          });
        } else {
          onImportSuccess?.();
        }
      }
    } catch (err) {
      console.error("Import failed:", err);
      setToastMessage("导入失败：" + (err instanceof Error ? err.message : String(err)));
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsImporting(false);
    }
  };

  // Filter groups according to search
  const filteredGroups = groups
    .map((g) => {
      const filtered = g.sessions.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return { ...g, sessions: filtered };
    })
    .filter((g) => g.sessions.length > 0 || g.projectName.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="nl-agent-importer-view">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="nl-import-toast">
          <div className="nl-toast-icon">🔔</div>
          <div className="nl-toast-content">
            <div className="nl-toast-title">会话已导入</div>
            <div className="nl-toast-desc">{toastMessage}</div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="nl-agent-header">
        <div className="nl-agent-header-left">
          <button className="nl-agent-back-btn" onClick={onBack} title="返回会话记录">
            ←
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
          >
            ⚙️ 自动同步
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
              {allSessions.length} 个会话, {groups.length} 个项目
            </div>
          </div>

          <div className="nl-agent-tree-search-wrap">
            <input
              type="text"
              placeholder="搜索会话..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="nl-agent-tree-search-input"
            />
          </div>

          <div className="nl-agent-tree-ctrl-bar">
            <button className="nl-agent-tree-ctrl-btn" onClick={loadData}>
              🔄 刷新
            </button>
            <button className="nl-agent-tree-ctrl-btn" onClick={() => setSelectedIds(new Set())}>
              ✕ 取消
            </button>
            <span className="nl-agent-selected-hint">已选择 {selectedIds.size} 个会话</span>
          </div>

          {/* Group Tree List */}
          <div className="nl-agent-tree-list">
            {loading ? (
              <div className="nl-agent-loading-state">
                <span className="nl-spinner">🔄</span> 正在扫描本地 AI 会话...
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="nl-agent-empty-tree">未发现匹配会话</div>
            ) : (
              filteredGroups.map((g) => {
                const isExpanded = expandedProjects.has(g.projectName);
                const groupIds = g.sessions.map((s) => s.id);
                const isGroupSelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));
                const isGroupIndeterminate =
                  !isGroupSelected && groupIds.some((id) => selectedIds.has(id));

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
                        {isGroupSelected ? "☑️" : isGroupIndeterminate ? "➖" : "🔘"}
                      </button>
                      <span className="nl-agent-group-arrow">{isExpanded ? "▾" : "▸"}</span>
                      <span className="nl-agent-group-icon">
                        {g.platform?.toLowerCase().includes("antigravity")
                          ? "⚛️"
                          : g.platform?.toLowerCase().includes("claude")
                          ? "✳️"
                          : "🤖"}
                      </span>
                      <span className="nl-agent-group-name">{g.projectName}</span>
                      <div className="nl-agent-group-meta">
                        <span className="nl-agent-group-time">{g.sessions[0]?.updatedAt || "01:06"}</span>
                        <span className="nl-agent-group-count">{g.sessions.length}</span>
                        {g.importedCount > 0 && (
                          <span className="nl-agent-group-imported-tag">
                            {g.importedCount}/
                          </span>
                        )}
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
                                {isSelected ? "☑️" : "🔘"}
                              </button>
                              <span className="nl-agent-child-icon">💬</span>
                              <span className="nl-agent-child-title" title={s.title}>
                                {s.title}
                              </span>
                              <div className="nl-agent-child-meta">
                                {s.imported && <span className="nl-child-imported-dot">✓</span>}
                                <span className="nl-agent-child-date">{s.updatedAt}</span>
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
          {activePreview ? (
            <div className="nl-agent-preview-content">
              {/* Preview Header */}
              <div className="nl-agent-prev-header">
                <div className="nl-agent-prev-path">
                  <span>&gt;_ {activePreview.projectName}</span>
                  {activePreview.imported && (
                    <span className="nl-prev-imported-badge">✓ 已导入</span>
                  )}
                </div>
                <h2 className="nl-agent-prev-title">{activePreview.title}</h2>
                <div className="nl-agent-prev-meta">
                  💬 {activePreview.messageCount} 条消息 · {activePreview.updatedAt}
                </div>
              </div>

              {/* Preview Chat Message Stream */}
              <div className="nl-agent-prev-stream">
                {activePreview.messages && activePreview.messages.length > 0 ? (
                  activePreview.messages.slice(0, 4).map((m, idx) => (
                    <div key={idx} className={`nl-agent-prev-bubble-row ${m.role.toLowerCase()}`}>
                      <div className="nl-agent-prev-bubble-avatar">
                        {m.role === "User" ? "👤" : "🤖"}
                      </div>
                      <div className="nl-agent-prev-bubble-box">
                        <div className="nl-agent-prev-bubble-role">{m.role}</div>
                        <div className="nl-agent-prev-bubble-text">{m.text}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="nl-agent-prev-bubble-row user">
                    <div className="nl-agent-prev-bubble-avatar">👤</div>
                    <div className="nl-agent-prev-bubble-box">
                      <div className="nl-agent-prev-bubble-role">User</div>
                      <div className="nl-agent-prev-bubble-text">{activePreview.rawText}</div>
                    </div>
                  </div>
                )}

                {activePreview.messageCount > 4 && (
                  <div className="nl-agent-prev-more-hint">
                    <span>口 还有 {activePreview.messageCount - 4} 条消息</span>
                  </div>
                )}
              </div>

              {/* Bottom Tip Info Card (1:1 with Screenshot 1) */}
              <div className="nl-agent-prev-tip-card">
                <div className="nl-tip-card-header">
                  <span>ℹ️</span>
                  <strong>导入一次，后面就更省心</strong>
                </div>
                <p className="nl-tip-card-text">
                  Mem 先把你选中的会话存下来。打开自动同步后，它会继续为你这些会话添加新消息；在支持项目识别的应用里，也会把同一项目后续出现的新会话带进来。
                </p>
              </div>
            </div>
          ) : (
            <div className="nl-agent-preview-empty">
              <span>💬</span>
              <p>请在左侧选择一个会话以预览内容</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Action Bar (1:1 with Screenshot 1) */}
      <div className="nl-agent-action-bar">
        <div className="nl-agent-action-left">
          <label className="nl-agent-select-all-label" onClick={handleSelectAll}>
            <input
              type="checkbox"
              checked={selectedIds.size === allSessions.length && allSessions.length > 0}
              onChange={handleSelectAll}
            />
            <span>全选</span>
          </label>
          <span className="nl-agent-selected-counter">
            {selectedIds.size} / {allSessions.length} 已选择
          </span>
        </div>

        <div className="nl-agent-action-right">
          <button className="nl-btn-secondary" onClick={() => {}}>
            导出
          </button>
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
