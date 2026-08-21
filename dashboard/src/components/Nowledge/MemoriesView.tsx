import React, { useState, useEffect } from "react";
import type { Session, Memory, ImportanceLevel, MemoryCategory, UnitType } from "../../types";
import { getMemories, createMemory, deleteMemory, updateMemory } from "../../api/ArcRift";
import { apiClient } from "../../api/client";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
  IconBack,
  IconEdit,
  IconPin,
  IconArchive,
  IconGraph,
  IconExport,
  IconTrash,
  IconTag,
  IconSearch,
  IconTerminal,
  IconCategory,
  IconFolder,
  IconCalendar,
  IconStar,
  IconCheck,
} from "./Icons";
import { SessionImporterModal } from "./SessionImporterModal";

interface MemoriesViewProps {
  activeSession?: Session;
  onNavigateTab: (tab: string) => void;
  onSelectedMemoryChange?: (memory: Memory | null) => void;
  onPinnedChange?: () => void;
  initialSelectedMemoryId?: string | null;
}

export const MemoriesView: React.FC<MemoriesViewProps> = ({
  activeSession,
  onNavigateTab,
  onSelectedMemoryChange,
  onPinnedChange,
  initialSelectedMemoryId,
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
  const [editTab, setEditTab] = useState<"edit" | "preview" | "split">("edit");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [saveSuccessTip, setSaveSuccessTip] = useState(false);
  const [saveErrorTip, setSaveErrorTip] = useState<string | null>(null);

  useEffect(() => {
    onSelectedMemoryChange?.(selectedMemory);
  }, [selectedMemory]);

  useEffect(() => {
    if (initialSelectedMemoryId && memories.length > 0) {
      const found = memories.find((m) => m.id === initialSelectedMemoryId);
      if (found) setSelectedMemory(found);
    }
  }, [initialSelectedMemoryId, memories]);

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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchOperating, setIsBatchOperating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, [activeSession?._id, statusFilter]);

  const loadData = async () => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage(null);
    try {
      const targetSessionId = (activeSession?._id && activeSession._id !== "all") ? activeSession._id : undefined;
      const res = await getMemories({
        sessionId: targetSessionId,
        query: searchQuery || undefined,
      });
      if (res && res.success) {
        setMemories(res.memories || []);
        // If an active memory is selected, refresh it
        if (selectedMemory) {
          const updated = (res.memories || []).find((m: Memory) => m.id === selectedMemory.id);
          if (updated) setSelectedMemory(updated);
        }
      } else {
        setIsError(true);
        setErrorMessage("获取记忆列表失败");
      }
    } catch (err: any) {
      console.error("Failed to load memories", err);
      setIsError(true);
      setErrorMessage(err?.response?.data?.error || err?.message || "无法连接到后端服务 (Network Error)");
    } finally {
      setIsLoading(false);
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

  const handleToggleArchive = async (e: React.MouseEvent, memory: Memory) => {
    e.stopPropagation();
    const isCurrentlyArchived = memory.claimStatus === "archived" || memory.claimStatus === "superseded";
    const nextStatus = isCurrentlyArchived ? "asserted" : "archived";
    try {
      await updateMemory(memory.id, { claimStatus: nextStatus as any });
      showToast(isCurrentlyArchived ? "已恢复至活跃记忆" : "已将该记忆归档", "success");
      await loadData();
    } catch (err) {
      showToast("归档状态更新失败", "error");
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, memory: Memory) => {
    e.stopPropagation();
    const nextPinned = !memory.isPinned;
    try {
      await updateMemory(memory.id, { isPinned: nextPinned } as any);
      showToast(nextPinned ? "已添加到左侧收藏" : "已从收藏中移除", "success");
      await loadData();
      onPinnedChange?.();
    } catch (err) {
      showToast("更新收藏状态失败", "error");
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredMemories.map((m) => m.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBatchReindex = async () => {
    if (selectedIds.size === 0 || isBatchOperating) return;
    setIsBatchOperating(true);
    try {
      const res = await apiClient.post("/api/memories/reindex", {
        ids: Array.from(selectedIds),
      });
      const data = res.data;
      if (data && data.success) {
        showToast(`已成功重建 ${data.count} 条记忆全文与向量索引！`, "success");
        setIsSelectMode(false);
        setSelectedIds(new Set());
        await loadData();
      } else {
        showToast("重建索引失败：" + (data?.error || "未知错误"), "error");
      }
    } catch (err: any) {
      showToast("重建索引发生异常：" + (err?.response?.data?.error || err.message), "error");
    } finally {
      setIsBatchOperating(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0 || isBatchOperating) return;
    if (!window.confirm(`确定要永久删除选中的 ${selectedIds.size} 条记忆吗？`)) return;
    setIsBatchOperating(true);
    try {
      const res = await apiClient.post("/api/memories/batch-delete", {
        ids: Array.from(selectedIds),
      });
      const data = res.data;
      if (data && data.success) {
        showToast(`已成功删除 ${data.deletedCount} 条记忆！`, "success");
        setIsSelectMode(false);
        setSelectedIds(new Set());
        await loadData();
        onPinnedChange?.();
      } else {
        showToast("批量删除失败", "error");
      }
    } catch (err: any) {
      showToast("批量删除发生异常：" + (err?.response?.data?.error || err.message), "error");
    } finally {
      setIsBatchOperating(false);
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
    if (!selectedMemory || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      const res = await updateMemory(selectedMemory.id, {
        title: editTitle,
        content: editContent,
      });

      const updatedMem: Memory = res.memory || {
        ...selectedMemory,
        title: editTitle,
        content: editContent,
        updatedAt: new Date(),
      };

      // 1. Immediately update active selected memory state
      setSelectedMemory(updatedMem);
      setIsEditing(false);
      setSaveSuccessTip(true);
      setTimeout(() => setSaveSuccessTip(false), 2500);

      // 2. Immediately update memory in the list state
      setMemories((prev) =>
        prev.map((m) => (m.id === updatedMem.id ? updatedMem : m))
      );

      // 3. Background reload
      loadData();
    } catch (err: any) {
      console.error("Failed to save memory edit", err);
      setSaveErrorTip(err?.message || "网络请求异常");
      setTimeout(() => setSaveErrorTip(null), 4000);
    } finally {
      setIsSavingEdit(false);
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
      if (importance >= 0.90) return 5;
      if (importance >= 0.72) return 4;
      if (importance >= 0.45) return 3;
      if (importance >= 0.25) return 2;
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
            <IconBack size={13} />
            <span>返回记忆列表</span>
          </button>
          <div className="nl-detail-header-actions">
            {saveErrorTip && (
              <span className="nl-save-error-badge">
                ✕ 保存失败: {saveErrorTip}
              </span>
            )}
            {saveSuccessTip && (
              <span className="nl-save-success-badge">
                <IconCheck size={13} style={{ marginRight: 4 }} />
                已保存
              </span>
            )}
            {isEditing ? (
              <div className="nl-edit-actions-group">
                <button
                  type="button"
                  className="nl-btn-cancel-edit"
                  disabled={isSavingEdit}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsEditing(false);
                    setEditTitle(selectedMemory.title);
                    setEditContent(selectedMemory.content);
                  }}
                >
                  ✕ 取消
                </button>
                <button
                  type="button"
                  className="nl-btn-save-edit"
                  disabled={isSavingEdit}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSaveEdit();
                  }}
                >
                  <IconCheck size={14} style={{ marginRight: 4 }} />
                  {isSavingEdit ? "保存中..." : "保存"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="nl-detail-header-icon-btn"
                title="编辑记忆"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditTitle(selectedMemory.title);
                  setEditContent(selectedMemory.content);
                  setIsEditing(true);
                  setEditTab("edit");
                }}
              >
                <IconEdit size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="nl-mem-detail-body">
          {/* Main Markdown Content Area (Left Column) */}
          <div className="nl-mem-detail-main">
            {isEditing ? (
              <div className="nl-mem-edit-container">
                <div className="nl-mem-edit-title-wrap">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="nl-mem-inline-edit-title"
                    placeholder="记忆标题..."
                  />
                </div>
                <div className="nl-mem-editor-toolbar">
                  <div className="nl-mem-editor-tabs">
                    <button
                      className={`nl-editor-tab-btn ${editTab === "edit" ? "active" : ""}`}
                      onClick={() => setEditTab("edit")}
                    >
                      Markdown 编辑
                    </button>
                    <button
                      className={`nl-editor-tab-btn ${editTab === "preview" ? "active" : ""}`}
                      onClick={() => setEditTab("preview")}
                    >
                      实时预览
                    </button>
                    <button
                      className={`nl-editor-tab-btn ${editTab === "split" ? "active" : ""}`}
                      onClick={() => setEditTab("split")}
                    >
                      分栏对比
                    </button>
                  </div>
                  <span className="nl-editor-tip">支持 Markdown 语法与代码块</span>
                </div>

                {editTab === "edit" && (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="nl-mem-inline-edit-textarea"
                    placeholder="在此输入或修改记忆的 Markdown 正文..."
                    autoFocus
                  />
                )}
                {editTab === "preview" && (
                  <div className="nl-mem-preview-box">
                    <MarkdownRenderer content={editContent} showSummaryCard={true} />
                  </div>
                )}
                {editTab === "split" && (
                  <div className="nl-mem-split-editor">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="nl-mem-inline-edit-textarea split"
                      placeholder="Markdown 源码..."
                    />
                    <div className="nl-mem-preview-box split">
                      <MarkdownRenderer content={editContent} showSummaryCard={true} />
                    </div>
                  </div>
                )}
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
                <span className="nl-field-label">
                  <IconPin size={13} className="nl-field-icon" />
                  收藏记忆
                </span>
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
                <span className="nl-field-label">
                  <IconTerminal size={13} className="nl-field-icon" />
                  来源:
                </span>
                <span className="nl-field-value">来自 {selectedMemory.source || "MCP"}</span>
              </div>

              {/* Unit Type */}
              <div className="nl-sidebar-field-row">
                <span className="nl-field-label">
                  <IconCategory size={13} className="nl-field-icon" />
                  类型:
                </span>
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
                <span className="nl-field-label">
                  <IconFolder size={13} className="nl-field-icon" />
                  存放于:
                </span>
                <span className="nl-field-value nl-space-badge">
                  {selectedMemory.sessionId === "default" || !selectedMemory.sessionId
                    ? "Default"
                    : selectedMemory.sessionId}
                </span>
              </div>

              {/* Created At */}
              <div className="nl-sidebar-field-row">
                <span className="nl-field-label">
                  <IconCalendar size={13} className="nl-field-icon" />
                  创建于:
                </span>
                <span className="nl-field-value">{getTimeAgo(selectedMemory.createdAt)}</span>
              </div>

              {/* Importance 5-Star Rating */}
              <div className="nl-sidebar-field-row">
                <span className="nl-field-label">
                  <IconStar size={13} className="nl-field-icon" />
                  重要度:
                </span>
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
                <IconGraph size={14} style={{ marginRight: 6 }} />
                <span>知识图谱</span>
              </button>

              {/* Export, Archive, Favorite & Delete Actions (Icon-only) */}
              <div className="nl-sidebar-actions-row">
                <button
                  className={`nl-sidebar-action-btn ${selectedMemory.isPinned ? "active" : ""}`}
                  onClick={(e) => handleTogglePin(e, selectedMemory)}
                  style={{ color: selectedMemory.isPinned ? "#818cf8" : undefined }}
                  title={selectedMemory.isPinned ? "取消收藏" : "收藏记忆"}
                  aria-label={selectedMemory.isPinned ? "取消收藏" : "收藏记忆"}
                >
                  <IconPin size={15} filled={selectedMemory.isPinned} />
                </button>
                <button
                  className="nl-sidebar-action-btn"
                  onClick={(e) => handleToggleArchive(e, selectedMemory)}
                  title={selectedMemory.claimStatus === "archived" || selectedMemory.claimStatus === "superseded" ? "恢复至活跃" : "归档记忆"}
                  aria-label={selectedMemory.claimStatus === "archived" || selectedMemory.claimStatus === "superseded" ? "恢复至活跃" : "归档记忆"}
                >
                  <IconArchive size={15} />
                </button>
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
                  title="导出为 Markdown"
                  aria-label="导出为 Markdown"
                >
                  <IconExport size={15} />
                </button>
                <button
                  className="nl-sidebar-action-btn danger"
                  onClick={(e) => handleDelete(e, selectedMemory.id)}
                  title="删除记忆"
                  aria-label="删除记忆"
                >
                  <IconTrash size={15} />
                </button>
              </div>

              {/* Tags Panel */}
              <div className="nl-sidebar-tags-section">
                <div className="nl-tags-header">
                  <span>
                    <IconTag size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    标签
                  </span>
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
  // Filter memories according to status tab (active vs archived vs all)
  const filteredMemories = memories.filter((m) => {
    const isArchived = m.claimStatus === "archived" || m.claimStatus === "superseded" || (m as any).isArchived;
    if (statusFilter === "active") return !isArchived;
    if (statusFilter === "archived") return isArchived;
    return true;
  });

  return (
    <div className="nl-memories-view">
      {/* Session Importer Modal */}
      <SessionImporterModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          setStatusFilter("active");
          showToast("会话导入成功！已自动同步更新活跃记忆与会话中心。", "success");
          loadData();
        }}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "28px",
            zIndex: 9999,
            backgroundColor: toastMessage.type === "error" ? "#7f1d1d" : "#064e3b",
            color: toastMessage.type === "error" ? "#fecaca" : "#a7f3d0",
            border: `1px solid ${toastMessage.type === "error" ? "#ef4444" : "#10b981"}`,
            padding: "10px 18px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>{toastMessage.type === "error" ? "✕" : "✓"}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

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
          <span className="nl-search-icon">
            <IconSearch size={14} />
          </span>
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
              深度
            </button>
          </div>
        </div>
        <button type="submit" className="nl-mem-search-submit">
          搜索
        </button>
      </form>

      {/* Control / Filter Bar */}
      <div className="nl-mem-control-bar">
        {!isSelectMode ? (
          <>
            <div className="nl-mem-left-controls">
              <span className="nl-result-count">
                结果 <strong>{filteredMemories.length}</strong> 条
              </span>
              <button className="nl-refresh-icon-btn" title="刷新" onClick={loadData}>
                🔄
              </button>
            </div>

            <div className="nl-mem-right-controls">
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
              <button className="nl-btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🔀</span> 筛选 •
              </button>
              <button
                className="nl-btn-primary"
                onClick={() => setIsModalOpen(true)}
              >
                + 创建记忆
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
            {/* Selection Mode Control Bar (1:1 with Screenshot 2) */}
            <div className="nl-mem-left-controls">
              <span className="nl-result-count">
                结果 <strong>{filteredMemories.length}</strong> 条
              </span>
              <button
                className="nl-refresh-icon-btn"
                title="刷新"
                onClick={loadData}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "13px" }}
              >
                🔄
              </button>
            </div>

            <div className="nl-mem-right-controls" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button className="nl-btn-secondary" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                🔀 筛选 •
              </button>
              <button className="nl-btn-secondary" onClick={handleSelectAll}>
                全部
              </button>
              <button className="nl-btn-secondary" onClick={handleDeselectAll}>
                无
              </button>
              <button
                className="nl-btn-secondary"
                onClick={handleBatchReindex}
                disabled={selectedIds.size === 0 || isBatchOperating}
                style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }}
                title="为选中的记忆重新计算并生成全文检索 (FTS5) 与向量嵌入 (Vector Embeddings) 索引"
              >
                {isBatchOperating ? "索引中..." : `重建索引 (${selectedIds.size})`}
              </button>
              <button
                className="nl-btn-secondary"
                disabled={selectedIds.size === 0}
                style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }}
              >
                ▾ 移动
              </button>
              <button
                className="nl-btn-primary"
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0 || isBatchOperating}
                style={{
                  backgroundColor: "#ef4444",
                  borderColor: "#dc2626",
                  color: "#ffffff",
                  opacity: selectedIds.size === 0 ? 0.5 : 1,
                }}
              >
                删除 ({selectedIds.size})
              </button>
              <button
                className="nl-btn-secondary"
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedIds(new Set());
                }}
              >
                ↩ 取消
              </button>
            </div>
          </>
        )}
      </div>

      {/* Memory Horizontal List Stream (Matching Screenshot 1 & 2) */}
      {isError ? (
        <div
          className="nl-empty-state-card"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "80px 20px",
            textAlign: "center",
            border: "1px dashed rgba(239, 68, 68, 0.4)",
            borderRadius: "12px",
            background: "rgba(239, 68, 68, 0.05)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              marginBottom: "16px",
              color: "#f87171",
            }}
          >
            ⚠️
          </div>
          <h2 style={{ fontSize: "17px", fontWeight: 600, color: "#f87171", margin: "0 0 6px 0" }}>
            无法连接到后端知识库服务
          </h2>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 20px 0", maxWidth: "450px" }}>
            {errorMessage || "服务可能正在启动或离线，记忆数据仍安全保存在本地数据库中。"}
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="nl-btn-primary"
              style={{ padding: "8px 20px", fontSize: "13px", borderRadius: "8px" }}
              onClick={loadData}
            >
              🔄 重新连接
            </button>
          </div>
        </div>
      ) : isLoading && memories.length === 0 ? (
        <div
          className="nl-empty-state-card"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "80px 20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "12px" }}>
            ⏳
          </div>
          <p style={{ fontSize: "14px", color: "#94a3b8" }}>正在加载知识库记忆...</p>
        </div>
      ) : filteredMemories.length === 0 ? (
        <div
          className="nl-empty-state-card"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "100px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              marginBottom: "18px",
              color: "#94a3b8",
            }}
          >
            💡
          </div>
          {searchQuery ? (
            <>
              <h2 style={{ fontSize: "17px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px 0" }}>
                未找到匹配的记忆
              </h2>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px 0" }}>
                没有找到与 "{searchQuery}" 相关的记录。
              </p>
              <button
                className="nl-btn-secondary"
                style={{ padding: "8px 18px", fontSize: "13px", borderRadius: "8px" }}
                onClick={() => {
                  setSearchQuery("");
                  setTimeout(() => loadData(), 0);
                }}
              >
                清除搜索条件
              </button>
            </>
          ) : activeSession && activeSession._id !== "all" ? (
            <>
              <h2 style={{ fontSize: "17px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px 0" }}>
                空间「{activeSession.projectName}」暂无记忆
              </h2>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px 0" }}>
                该空间下还没有独立记忆条目。你可以创建新记忆，或在上方切换回「全部空间」。
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="nl-btn-primary"
                  style={{ padding: "8px 18px", fontSize: "13px", borderRadius: "8px" }}
                  onClick={() => setIsModalOpen(true)}
                >
                  + 在此空间创建记忆
                </button>
              </div>
            </>
          ) : statusFilter === "archived" ? (
            <>
              <h2 style={{ fontSize: "17px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px 0" }}>
                暂无已归档记忆
              </h2>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px 0" }}>
                所有当前记忆均为活跃状态。
              </p>
              <button
                className="nl-btn-secondary"
                style={{ padding: "8px 18px", fontSize: "13px", borderRadius: "8px" }}
                onClick={() => setStatusFilter("active")}
              >
                查看活跃记忆
              </button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: "17px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px 0" }}>
                还没有记忆
              </h2>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px 0" }}>
                从导入会话或连接笔记开始。
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="nl-btn-primary"
                  style={{ padding: "8px 18px", fontSize: "13px", borderRadius: "8px" }}
                  onClick={() => setIsImportModalOpen(true)}
                >
                  导入会话
                </button>
                <button
                  className="nl-btn-secondary"
                  style={{ padding: "8px 18px", fontSize: "13px", borderRadius: "8px" }}
                  onClick={() => onNavigateTab?.("settings")}
                >
                  连接笔记
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="nl-memory-list-stream">
          {filteredMemories.map((m) => {
            const stars = getStarCount(m.importance);
            const unitLabel = getUnitTypeLabel(m.unitType, m.category);
            const timeAgo = getTimeAgo(m.createdAt);
            const isArchived = m.claimStatus === "archived" || m.claimStatus === "superseded";

            return (
              <div
                key={m.id}
                className="nl-memory-row-card"
                onClick={() => {
                  if (isSelectMode) {
                    handleToggleSelect(m.id);
                  } else {
                    setSelectedMemory(m);
                  }
                }}
                style={{
                  backgroundColor: isSelectMode && selectedIds.has(m.id) ? "rgba(99, 102, 241, 0.08)" : undefined,
                  borderColor: isSelectMode && selectedIds.has(m.id) ? "rgba(99, 102, 241, 0.4)" : undefined,
                }}
              >
                <div
                  className="nl-memory-row-left-icon"
                  onClick={(e) => {
                    if (isSelectMode) {
                      e.stopPropagation();
                      handleToggleSelect(m.id);
                    }
                  }}
                  style={{ cursor: isSelectMode ? "pointer" : "default" }}
                >
                  {isSelectMode ? (
                    selectedIds.has(m.id) ? (
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          backgroundColor: "#6366f1",
                          border: "2px solid #6366f1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        ✓
                      </div>
                    ) : (
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          border: "2px solid rgba(255, 255, 255, 0.35)",
                          backgroundColor: "transparent",
                        }}
                      />
                    )
                  ) : (
                    <span className="nl-mem-type-bubble">💬</span>
                  )}
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
                      title={isArchived ? "恢复至活跃" : "归档记忆"}
                      onClick={(e) => handleToggleArchive(e, m)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isArchived ? (
                          <>
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          </>
                        ) : (
                          <>
                            <rect width="20" height="5" x="2" y="3" rx="1" />
                            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                            <path d="M10 12h4" />
                          </>
                        )}
                      </svg>
                    </button>
                    <button
                      className="nl-row-icon-btn"
                      title="删除"
                      onClick={(e) => handleDelete(e, m.id)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                    <button
                      className={`nl-row-icon-btn ${m.isPinned ? "pinned" : ""}`}
                      title={m.isPinned ? "取消收藏" : "收藏记忆"}
                      onClick={(e) => handleTogglePin(e, m)}
                      style={{ color: m.isPinned ? "#818cf8" : undefined }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill={m.isPinned ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                      </svg>
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
