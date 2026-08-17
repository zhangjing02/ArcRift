import React, { useState, useEffect } from "react";
import type { Session, Memory, ImportanceLevel, MemoryCategory } from "../../types";
import { getMemories, createMemory, deleteMemory } from "../../api/ArcRift";

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

  // New Memory Form
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formImportance, setFormImportance] = useState<ImportanceLevel>("high");
  const [formCategory, setFormCategory] = useState<MemoryCategory>("Decision");
  const [formTags, setFormTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeSession?._id, statusFilter]);

  const loadData = async () => {
    try {
      const res = await getMemories({
        sessionId: activeSession?._id,
        query: searchQuery || undefined,
      });
      if (res.success) {
        setMemories(res.memories);
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
      if (selectedMemory?.id === id) setSelectedMemory(null);
      await loadData();
    } catch (err) {
      console.error("Failed to delete memory", err);
    }
  };

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
          🔍 搜索
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

      {/* Main Content Area */}
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
        <div className="nl-memory-grid">
          {memories.map((m) => (
            <div
              key={m.id}
              className={`nl-memory-card ${selectedMemory?.id === m.id ? "selected" : ""}`}
              onClick={() => setSelectedMemory(m)}
            >
              <div className="nl-memory-card-header">
                <span className={`nl-badge nl-badge-${m.importance}`}>
                  {m.importance === "critical" ? "🔥 关键" : m.importance === "high" ? "📌 重要" : "💡 提示"}
                </span>
                <span className="nl-category-tag">{m.category}</span>
                <button
                  className="nl-card-del-btn"
                  onClick={(e) => handleDelete(e, m.id)}
                  title="删除"
                >
                  🗑️
                </button>
              </div>

              <h3 className="nl-memory-card-title">{m.title}</h3>
              <p className="nl-memory-card-content">{m.content}</p>

              {m.tags && m.tags.length > 0 && (
                <div className="nl-memory-tags">
                  {m.tags.map((t) => (
                    <span key={t} className="nl-tag-pill">
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              <div className="nl-memory-card-footer">
                <span className="nl-card-date">
                  {new Date(m.createdAt).toLocaleDateString()}
                </span>
                <span className="nl-card-source">源: {m.source}</span>
              </div>
            </div>
          ))}
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
                    <option value="critical">🔥 关键 (Critical)</option>
                    <option value="high">📌 重要 (High)</option>
                    <option value="medium">💡 普通 (Medium)</option>
                    <option value="low">📝 备注 (Low)</option>
                  </select>
                </div>

                <div className="nl-form-group">
                  <label>知识分类</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as MemoryCategory)}
                  >
                    <option value="Decision">决策 (Decision)</option>
                    <option value="Architecture">架构 (Architecture)</option>
                    <option value="Gotcha">避坑 (Gotcha)</option>
                    <option value="Rule">规范 (Rule)</option>
                    <option value="Tech">技术 (Tech)</option>
                    <option value="Note">笔记 (Note)</option>
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
