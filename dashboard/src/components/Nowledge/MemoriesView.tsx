import React, { useState, useEffect } from "react";
import type { Session, Memory, ImportanceLevel, MemoryCategory, UnitType } from "../../types";
import { getMemories, createMemory, deleteMemory, updateMemory } from "../../api/ArcRift";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MemoriesViewProps {
  activeSession?: Session;
  onNavigateTab: (tab: string) => void;
}

export const MemoriesView: React.FC<MemoriesViewProps> = ({
  activeSession,
  onNavigateTab,
}) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"normal" | "deep">("normal");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // New Memory Form
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formImportance, setFormImportance] = useState<ImportanceLevel>("high");
  const [formCategory, setFormCategory] = useState<MemoryCategory>("Decision");
  const [formUnitType, setFormUnitType] = useState<UnitType>("decision");
  const [formTags, setFormTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeSession?._id, statusFilter]);

  const loadData = async () => {
    try {
      const targetSessionId = (activeSession?._id && activeSession._id !== "all") ? activeSession._id : undefined;
      const res = await getMemories({
        sessionId: targetSessionId,
        query: searchQuery || undefined,
      });
      if (res.success) {
        setMemories(res.memories);
        // If an active memory is selected, refresh it
        if (selectedMemory) {
          const updated = res.memories.find((m: Memory) => m.id === selectedMemory.id);
          if (updated) setSelectedMemory(updated);
        }
      }
    } catch (err) {
      console.error("Failed to load memories", err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const tagsArray = formTags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      await createMemory({
        sessionId: activeSession?._id || "default",
        title: formTitle.trim(),
        content: formContent.trim(),
        importance: formImportance,
        category: formCategory,
        tags: tagsArray,
        source: "manual",
      });

      setIsModalOpen(false);
      setFormTitle("");
      setFormContent("");
      setFormTags("");
      await loadData();
    } catch (err) {
      console.error("Failed to create memory", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("确定要删除这条记忆吗？")) return;
    try {
      await deleteMemory(id);
      if (selectedMemory?.id === id) {
        setSelectedMemory(null);
        setIsEditing(false);
      }
      await loadData();
    } catch (err) {
      console.error("Failed to delete memory", err);
    }
  };

  const handleSetImportance = async (e: React.MouseEvent, memory: Memory, starIndex: number) => {
    e.stopPropagation();
    const impValues: ImportanceLevel[] = ["low", "low", "medium", "high", "critical"];
    const newImp = impValues[starIndex - 1] || "medium";
    try {
      await updateMemory(memory.id, { importance: newImp });
      await loadData();
    } catch (err) {
      console.error("Failed to update memory importance", err);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedMemory) return;
    try {
      await updateMemory(selectedMemory.id, {
        title: editTitle,
        content: editContent,
      });
      setIsEditing(false);
      await loadData();
    } catch (err) {
      console.error("Failed to save memory edit", err);
    }
  };

  const handleAddTagToSelected = async () => {
    if (!selectedMemory || !newTagInput.trim()) return;
    const currentTags = selectedMemory.tags || [];
    if (!currentTags.includes(newTagInput.trim())) {
      const updatedTags = [...currentTags, newTagInput.trim()];
      try {
        await updateMemory(selectedMemory.id, { tags: updatedTags });
        setNewTagInput("");
        setIsAddingTag(false);
        await loadData();
      } catch (err) {
        console.error("Failed to add tag", err);
      }
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedMemory) return;
    const updatedTags = (selectedMemory.tags || []).filter((t) => t !== tagToRemove);
    try {
      await updateMemory(selectedMemory.id, { tags: updatedTags });
      await loadData();
    } catch (err) {
      console.error("Failed to remove tag", err);
    }
  };

  const getStarCount = (importance?: string | number): number => {
    if (typeof importance === "number") {
      if (importance >= 0.9) return 5;
      if (importance >= 0.75) return 4;
      if (importance >= 0.5) return 3;
      if (importance >= 0.3) return 2;
      return 1;
    }
    if (importance === "critical") return 5;
    if (importance === "high") return 4;
    if (importance === "medium") return 3;
    return 2;
  };

  const getUnitTypeLabel = (unitType?: string, category?: string) => {
    const type = unitType || category || "fact";
    const map: Record<string, string> = {
      decision: "决策",
      fact: "事实",
      learning: "学习",
      preference: "偏好",
      procedure: "流程",
      plan: "规划",
      context: "上下文",
      event: "事件",
      Decision: "决策",
      Architecture: "架构",
      Gotcha: "避坑",
      Rule: "规范",
      Tech: "技术",
      Note: "笔记",
    };
    return map[type] || type;
  };

  const getTimeAgo = (dateStr?: string | Date) => {
    if (!dateStr) return "刚刚";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}天前`;
  };

  // ----------------------------------------------------
  // VIEW 1: Memory Detail Mode (Matches Screenshot 3)
  // ----------------------------------------------------
  if (selectedMemory) {
    const stars = getStarCount(selectedMemory.importance);
    return (
      <div className="nl-memory-detail-layout">
        {/* Top Breadcrumb Bar */}
        <div className="nl-mem-detail-top-bar">
          <button
            className="nl-back-breadcrumb-btn"
            onClick={() => {
              setSelectedMemory(null);
              setIsEditing(false);
            }}
          >
            ‹ 返回记忆列表
          </button>
          <div className="nl-detail-header-actions">
            <button
              className="nl-btn-ghost"
              onClick={() => {
                if (!isEditing) {
                  setEditTitle(selectedMemory.title);
                  setEditContent(selectedMemory.content);
                  setIsEditing(true);
                } else {
                  handleSaveEdit();
                }
              }}
            >
              {isEditing ? "💾 完成编辑" : "✎ 编辑"}
            </button>
          </div>
        </div>

        <div className="nl-mem-detail-body">
          {/* Main Markdown Content Area (Left Column) */}
          <div className="nl-mem-detail-main">
            {isEditing ? (
              <div className="nl-mem-edit-form">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="nl-mem-edit-title-input"
                  placeholder="记忆标题"
                />
                <textarea
                  rows={15}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="nl-mem-edit-content-textarea"
                  placeholder="记忆 Markdown 正文..."
                />
              </div>
            ) : (
              <div className="nl-mem-rendered-article">
                <h1 className="nl-mem-article-title">{selectedMemory.title}</h1>
                <div className="nl-mem-article-content">
                  <MarkdownRenderer content={selectedMemory.content} showSummaryCard={true} />
                </div>
              </div>
            )}
          </div>

          {/* Right Inspector / Metadata Panel (Right Column) */}
          <div className="nl-mem-detail-sidebar">
            <div className="nl-detail-sidebar-card">
              <div className="nl-sidebar-header-row">
                <span className="nl-sidebar-section-title">&#123;&#125; 详细信息</span>
              </div>

              {/* Pin Switch */}
              <div className="nl-sidebar-field-row">
                <span className="nl-field-label">📌 收藏记忆</span>
                <input
                  type="checkbox"
                  className="nl-toggle-switch"
                  checked={selectedMemory.importance === "critical" || (selectedMemory.importance as any) >= 0.9}
                  onChange={(e) => {
                    handleSetImportance(
                      e as any,
                      selectedMemory,
                      e.target.checked ? 5 : 3
                    );
                  }}
                />
              </div>

              {/* Source */}
              <div className="nl-sidebar-field-row">
                <span className="nl-field-label">来源:</span>
                <span className="nl-field-value">来自 {selectedMemory.source || "MCP"}</span>
              </div>

              {/* Unit Type */}
              <div className="nl-sidebar-field-row">
                <span className="nl-field-label">类型:</span>
                <select
                  className="nl-field-select"
                  value={selectedMemory.unitType || selectedMemory.category || "decision"}
                  onChange={async (e) => {
                    await updateMemory(selectedMemory.id, {
                      unitType: e.target.value as any,
                      category: e.target.value as any,
                    });
                    await loadData();
                  }}
                >
                  <option value="decision">决策 ▾</option>
                  <option value="fact">事实 ▾</option>
                  <option value="learning">学习 ▾</option>
                  <option value="procedure">流程 ▾</option>
                  <option value="plan">计划 ▾</option>
                  <option value="context">上下文 ▾</option>
                </select>
              </div>

              {/* Space */}
              <div className="nl-sidebar-field-row">
                <span className="nl-field-label">存放于:</span>
                <span className="nl-field-value nl-space-badge">
                  {selectedMemory.sessionId === "default" || !selectedMemory.sessionId
                    ? "Default"
                    : selectedMemory.sessionId}
                </span>
              </div>

              {/* Created At */}
              <div className="nl-sidebar-field-row">
                <span className="nl-field-label">创建于:</span>
                <span className="nl-field-value">{getTimeAgo(selectedMemory.createdAt)}</span>
              </div>

              {/* Importance 5-Star Rating */}
              <div className="nl-sidebar-field-row">
                <span className="nl-field-label">重要度:</span>
                <div className="nl-star-rating-row">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`nl-star ${star <= stars ? "filled" : "empty"}`}
                      onClick={(e) => handleSetImportance(e, selectedMemory, star)}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>

              {/* Knowledge Graph Button */}
              <button
                className="nl-btn-graph-shortcut"
                onClick={() => onNavigateTab("graph")}
              >
                🌐 知识图谱
              </button>

              {/* Export & Delete Actions */}
              <div className="nl-sidebar-actions-row">
                <button
                  className="nl-sidebar-action-btn"
                  onClick={() => {
                    const blob = new Blob([`# ${selectedMemory.title}\n\n${selectedMemory.content}`], { type: "text/markdown" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${selectedMemory.title}.md`;
                    a.click();
                  }}
                >
                  📥 导出
                </button>
                <button
                  className="nl-sidebar-action-btn danger"
                  onClick={(e) => handleDelete(e, selectedMemory.id)}
                >
                  🗑️ 删除
                </button>
              </div>

              {/* Tags Panel */}
              <div className="nl-sidebar-tags-section">
                <div className="nl-tags-header">
                  <span>🏷️ 标签</span>
                  <button className="nl-btn-icon-tiny" title="管理标签">⚙️</button>
                </div>
                <div className="nl-tags-chip-list">
                  {(selectedMemory.tags || []).map((t) => (
                    <span key={t} className="nl-detail-tag-chip">
                      {t}
                      <button
                        className="nl-tag-remove-x"
                        onClick={() => handleRemoveTag(t)}
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  {isAddingTag ? (
                    <div className="nl-new-tag-input-wrap">
                      <input
                        type="text"
                        autoFocus
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddTagToSelected();
                          if (e.key === "Escape") setIsAddingTag(false);
                        }}
                        className="nl-tag-inline-input"
                        placeholder="输入新标签..."
                      />
                    </div>
                  ) : (
                    <button
                      className="nl-add-tag-chip-btn"
                      onClick={() => setIsAddingTag(true)}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 2: Memory List Mode (Matches Screenshot 2)
  // ----------------------------------------------------
  return (
    <div className="nl-memories-view">
      {/* View Header */}
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">记忆</h1>
          <p className="nl-view-subtitle">查找和管理你的记忆</p>
        </div>
      </div>

      {/* Top Search Bar with Normal / Deep Mode */}
      <form className="nl-mem-search-row" onSubmit={handleSearch}>
        <div className="nl-mem-search-input-wrap">
          <span className="nl-search-icon">🔍</span>
          <input
            type="text"
            placeholder="搜索记忆..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="nl-mem-search-input"
          />
          <div className="nl-search-mode-toggle">
            <button
              type="button"
              className={`nl-mode-btn ${searchMode === "normal" ? "active" : ""}`}
              onClick={() => setSearchMode("normal")}
            >
              普通
            </button>
            <button
              type="button"
              className={`nl-mode-btn ${searchMode === "deep" ? "active" : ""}`}
              onClick={() => setSearchMode("deep")}
            >
              ⚡ 深度
            </button>
          </div>
        </div>
        <button type="submit" className="nl-mem-search-submit">
          搜索
        </button>
      </form>

      {/* Control / Filter Bar */}
      <div className="nl-mem-control-bar">
        <div className="nl-mem-left-controls">
          <span className="nl-result-count">
            结果 <strong>{memories.length}</strong> 条
          </span>
          <button className="nl-refresh-icon-btn" onClick={loadData} title="刷新">
            🔄
          </button>
          <div className="nl-status-pill-group">
            <button
              className={`nl-status-pill ${statusFilter === "active" ? "active" : ""}`}
              onClick={() => setStatusFilter("active")}
            >
              活跃
            </button>
            <button
              className={`nl-status-pill ${statusFilter === "archived" ? "active" : ""}`}
              onClick={() => setStatusFilter("archived")}
            >
              已归档
            </button>
            <button
              className={`nl-status-pill ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              全部
            </button>
          </div>
        </div>

        <div className="nl-mem-right-controls">
          <button className="nl-btn-secondary">
            🎚️ 筛选 •
          </button>
          <button
            className="nl-btn-primary"
            onClick={() => setIsModalOpen(true)}
          >
            ➕ 创建记忆
          </button>
          <button className="nl-btn-secondary">
            ☑️ 选择
          </button>
        </div>
      </div>

      {/* Memory Horizontal List Stream (Matching Screenshot 2) */}
      {memories.length === 0 ? (
        <div className="nl-empty-state-card">
          <div className="nl-empty-state-icon">💡</div>
          <h2 className="nl-empty-state-title">还没有记忆</h2>
          <p className="nl-empty-state-sub">从导入会话或连接笔记开始。</p>
          <div className="nl-empty-state-actions">
            <button
              className="nl-btn-primary"
              onClick={() => onNavigateTab("threads")}
            >
              导入会话
            </button>
            <button
              className="nl-btn-secondary"
              onClick={() => setIsModalOpen(true)}
            >
              创建记忆
            </button>
          </div>
        </div>
      ) : (
        <div className="nl-memory-list-stream">
          {memories.map((m) => {
            const stars = getStarCount(m.importance);
            const unitLabel = getUnitTypeLabel(m.unitType, m.category);
            const timeAgo = getTimeAgo(m.createdAt);

            return (
              <div
                key={m.id}
                className="nl-memory-row-card"
                onClick={() => setSelectedMemory(m)}
              >
                <div className="nl-memory-row-left-icon">
                  <span className="nl-mem-type-bubble">💬</span>
                </div>

                <div className="nl-memory-row-content">
                  <div className="nl-memory-row-title-line">
                    <span className="nl-mem-row-title">{m.title}</span>
                  </div>

                  <div className="nl-memory-row-snippet">
                    {m.content.slice(0, 110)}
                    {m.content.length > 110 ? "..." : ""}
                  </div>

                  <div className="nl-memory-row-badges">
                    <span className="nl-row-badge-type">{unitLabel}</span>
                    <span className="nl-row-badge-source">{m.source || "MCP"} · {timeAgo}</span>
                  </div>

                  {m.tags && m.tags.length > 0 && (
                    <div className="nl-memory-row-tags">
                      {m.tags.map((tag) => (
                        <span key={tag} className="nl-row-tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Star Rating and Actions */}
                <div className="nl-memory-row-right">
                  <div className="nl-row-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`nl-star-icon ${star <= stars ? "lit" : "dim"}`}
                        onClick={(e) => handleSetImportance(e, m, star)}
                      >
                        ★
                      </span>
                    ))}
                  </div>

                  <div className="nl-row-action-buttons">
                    <button
                      className="nl-row-icon-btn"
                      title="删除"
                      onClick={(e) => handleDelete(e, m.id)}
                    >
                      🗑️
                    </button>
                    <button
                      className="nl-row-icon-btn"
                      title="置顶/收藏"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetImportance(e, m, stars === 5 ? 3 : 5);
                      }}
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

      {/* Create Memory Modal */}
      {isModalOpen && (
        <div className="nl-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="nl-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="nl-modal-header">
              <h2>➕ 创建新记忆</h2>
              <button className="nl-close-btn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="nl-modal-form">
              <div className="nl-form-group">
                <label>标题 / 核心结论</label>
                <input
                  type="text"
                  placeholder="例如：OTA 升级接口由参数改为 JSON Body 传参"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>

              <div className="nl-form-row">
                <div className="nl-form-group">
                  <label>重要级别</label>
                  <select
                    value={formImportance}
                    onChange={(e) => setFormImportance(e.target.value as ImportanceLevel)}
                  >
                    <option value="critical">🔥 关键 (Critical - 5星)</option>
                    <option value="high">📌 重要 (High - 4星)</option>
                    <option value="medium">💡 普通 (Medium - 3星)</option>
                    <option value="low">📝 备注 (Low - 2星)</option>
                  </select>
                </div>

                <div className="nl-form-group">
                  <label>知识类型 (Unit Type)</label>
                  <select
                    value={formUnitType}
                    onChange={(e) => {
                      setFormUnitType(e.target.value as UnitType);
                      setFormCategory(e.target.value as any);
                    }}
                  >
                    <option value="decision">💡 决策 (Decision)</option>
                    <option value="fact">🏛️ 事实 (Fact)</option>
                    <option value="procedure">⚡ 流程 (Procedure)</option>
                    <option value="learning">🎓 学习 (Learning)</option>
                    <option value="preference">⚙️ 偏好 (Preference)</option>
                    <option value="plan">🎯 计划 (Plan)</option>
                    <option value="context">📑 上下文 (Context)</option>
                  </select>
                </div>
              </div>

              <div className="nl-form-group">
                <label>标签 (用空格或逗号分隔)</label>
                <input
                  type="text"
                  placeholder="OTA, BLE, MQTT, Android"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                />
              </div>

              <div className="nl-form-group">
                <label>详细正文 (支持 Markdown)</label>
                <textarea
                  rows={6}
                  placeholder="记录详细决策依据、代码改造重点或约定细节..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  required
                />
              </div>

              <div className="nl-modal-actions">
                <button
                  type="button"
                  className="nl-btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="nl-btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? "保存中..." : "保存记忆"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
