import React, { useEffect, useState, useCallback, useMemo } from "react";
import { fetchMemories, createMemory, updateMemory, deleteMemory, extractErrorMessage } from "../api/ArcRift";
import type { Session, Memory, ImportanceLevel, MemoryCategory } from "../types";
import { useLocale } from "../context/LocaleContext";

interface Props {
  activeSession: Session | null;
  onRefreshSession?: () => void;
}

const IMPORTANCE_CONFIG: Record<ImportanceLevel, { labelZh: string; labelEn: string; color: string; bg: string; icon: string }> = {
  critical: { labelZh: "核心架构", labelEn: "Critical", color: "#FF4D4D", bg: "rgba(255, 77, 77, 0.15)", icon: "🔥" },
  high: { labelZh: "关键决策", labelEn: "High", color: "#FFA726", bg: "rgba(255, 167, 38, 0.15)", icon: "📌" },
  medium: { labelZh: "经验备忘", labelEn: "Medium", color: "#42A5F5", bg: "rgba(66, 165, 245, 0.15)", icon: "💡" },
  low: { labelZh: "细节记录", labelEn: "Low", color: "#9E9E9E", bg: "rgba(158, 158, 158, 0.15)", icon: "📝" },
};

const CATEGORIES: MemoryCategory[] = ["Architecture", "Decision", "Gotcha", "Rule", "Tech", "Note"];

export default function MemoriesStreamView({ activeSession, onRefreshSession }: Props) {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImportance, setSelectedImportance] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // New Memory Form
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newImportance, setNewImportance] = useState<ImportanceLevel>("high");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("Decision");
  const [newTags, setNewTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editing state
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);

  const loadData = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMemories({ sessionId });
      if (res.memories) {
        setMemories(res.memories);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSession?._id) {
      loadData(activeSession._id);
    } else {
      setMemories([]);
    }
  }, [activeSession?._id, loadData]);

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSession?._id || !newContent.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const tags = newTags.split(/[,，\s]+/).filter(Boolean);
      const res = await createMemory({
        sessionId: activeSession._id,
        title: newTitle.trim() || undefined,
        content: newContent.trim(),
        importance: newImportance,
        category: newCategory,
        tags,
        source: "manual",
      });

      if (res.memory) {
        setMemories([res.memory, ...memories]);
        setNewTitle("");
        setNewContent("");
        setNewTags("");
        setSuccessMessage("记忆已成功记录并已同步至知识图谱！");
        setTimeout(() => setSuccessMessage(null), 3000);
        onRefreshSession?.();
      }
    } catch (err) {
      setError(`记录失败: ${extractErrorMessage(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.memories.deleteConfirm)) return;
    try {
      await deleteMemory(id);
      setMemories(memories.filter((m) => m.id !== id));
      setSuccessMessage("记忆已删除");
      setTimeout(() => setSuccessMessage(null), 2500);
      onRefreshSession?.();
    } catch (err) {
      setError(`删除失败: ${extractErrorMessage(err)}`);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMemory) return;
    try {
      const res = await updateMemory(editingMemory.id, {
        title: editingMemory.title,
        content: editingMemory.content,
        importance: editingMemory.importance,
        category: editingMemory.category,
        tags: editingMemory.tags,
      });
      if (res.memory) {
        setMemories(memories.map((m) => (m.id === editingMemory.id ? res.memory : m)));
        setEditingMemory(null);
        setSuccessMessage("记忆已更新");
        setTimeout(() => setSuccessMessage(null), 2500);
      }
    } catch (err) {
      setError(`更新失败: ${extractErrorMessage(err)}`);
    }
  };

  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      if (selectedImportance !== "all" && m.importance !== selectedImportance) return false;
      if (selectedCategory !== "all" && m.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = m.title?.toLowerCase().includes(q);
        const inContent = m.content.toLowerCase().includes(q);
        const inTags = m.tags.some((t) => t.toLowerCase().includes(q));
        if (!inTitle && !inContent && !inTags) return false;
      }
      return true;
    });
  }, [memories, selectedImportance, selectedCategory, searchQuery]);

  if (!activeSession) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>
        <p>{t.sidebar.noSessions}</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, height: "100%", overflowY: "auto", padding: "28px 36px", background: "var(--bg-main)", color: "var(--text-primary)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <span style={{ fontSize: "24px" }}>🗂️</span>
            <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
              {t.memories.title}
            </h1>
            <span style={{
              fontSize: "12px",
              padding: "3px 10px",
              borderRadius: "20px",
              background: "rgba(255, 107, 0, 0.15)",
              color: "var(--primary)",
              border: "1px solid rgba(255, 107, 0, 0.3)",
              fontWeight: 600
            }}>
              {activeSession.projectName} · {memories.length} 条记忆
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            {t.memories.subtitle}
          </p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(235, 87, 87, 0.12)", border: "1px solid rgba(235, 87, 87, 0.3)", color: "#ff6b6b", marginBottom: "18px", fontSize: "13px" }}>
          ⚠️ {error}
        </div>
      )}

      {successMessage && (
        <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(46, 204, 113, 0.12)", border: "1px solid rgba(46, 204, 113, 0.3)", color: "#2ecc71", marginBottom: "18px", fontSize: "13px" }}>
          ✓ {successMessage}
        </div>
      )}

      {/* Quick Add Memory Box */}
      <div style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border-main)",
        borderRadius: "14px",
        padding: "20px 22px",
        marginBottom: "28px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)"
      }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t.memories.quickAddTitlePlaceholder}
            style={{
              flex: "2",
              minWidth: "220px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid var(--border-main)",
              color: "#fff",
              fontSize: "13px",
              outline: "none"
            }}
          />

          <select
            value={newImportance}
            onChange={(e) => setNewImportance(e.target.value as ImportanceLevel)}
            style={{
              flex: "1",
              minWidth: "140px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid var(--border-main)",
              color: IMPORTANCE_CONFIG[newImportance].color,
              fontSize: "13px",
              fontWeight: 600,
              outline: "none"
            }}
          >
            <option value="critical">🔥 {isZh ? "核心架构 (Critical)" : "Critical"}</option>
            <option value="high">📌 {isZh ? "关键决策 (High)" : "High"}</option>
            <option value="medium">💡 {isZh ? "经验备忘 (Medium)" : "Medium"}</option>
            <option value="low">📝 {isZh ? "细节记录 (Low)" : "Low"}</option>
          </select>

          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
            style={{
              flex: "1",
              minWidth: "130px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid var(--border-main)",
              color: "#fff",
              fontSize: "13px",
              outline: "none"
            }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              handleCreate();
            }
          }}
          placeholder={t.memories.quickAddPlaceholder}
          rows={3}
          style={{
            width: "100%",
            background: "rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border-main)",
            borderRadius: "8px",
            padding: "12px 14px",
            color: "var(--text-primary)",
            fontSize: "13px",
            lineHeight: "1.5",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
            marginBottom: "12px"
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <input
            type="text"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder={t.memories.quickAddTagsPlaceholder}
            style={{
              flex: 1,
              minWidth: "200px",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--border-main)",
              color: "var(--text-secondary)",
              fontSize: "12px",
              outline: "none"
            }}
          />

          <button
            type="button"
            onClick={() => handleCreate()}
            disabled={isSubmitting || !newContent.trim()}
            style={{
              padding: "9px 20px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              cursor: isSubmitting || !newContent.trim() ? "not-allowed" : "pointer",
              opacity: isSubmitting || !newContent.trim() ? 0.6 : 1,
              transition: "all 0.2s ease"
            }}
          >
            {isSubmitting ? "正在归档..." : t.memories.saveMemoryBtn}
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ display: "flex", gap: "14px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1", minWidth: "240px" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.memories.searchPlaceholder}
            style={{
              width: "100%",
              padding: "10px 14px 10px 36px",
              borderRadius: "10px",
              background: "var(--bg-panel)",
              border: "1px solid var(--border-main)",
              color: "#fff",
              fontSize: "13px",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
          <span style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-secondary)", fontSize: "14px" }}>
            🔍
          </span>
        </div>

        {/* Importance Pills */}
        <div style={{ display: "flex", gap: "6px", background: "var(--bg-panel)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border-main)" }}>
          <button
            type="button"
            onClick={() => setSelectedImportance("all")}
            style={{
              padding: "6px 12px",
              borderRadius: "7px",
              fontSize: "12px",
              border: "none",
              cursor: "pointer",
              background: selectedImportance === "all" ? "rgba(255, 255, 255, 0.12)" : "transparent",
              color: selectedImportance === "all" ? "#fff" : "var(--text-secondary)",
              fontWeight: selectedImportance === "all" ? 600 : 400
            }}
          >
            {t.memories.allImportance}
          </button>
          {(["critical", "high", "medium", "low"] as ImportanceLevel[]).map((imp) => {
            const cfg = IMPORTANCE_CONFIG[imp];
            const active = selectedImportance === imp;
            return (
              <button
                key={imp}
                type="button"
                onClick={() => setSelectedImportance(imp)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "7px",
                  fontSize: "12px",
                  border: "none",
                  cursor: "pointer",
                  background: active ? cfg.bg : "transparent",
                  color: active ? cfg.color : "var(--text-secondary)",
                  fontWeight: active ? 700 : 400
                }}
              >
                {cfg.icon} {isZh ? cfg.labelZh : cfg.labelEn}
              </button>
            );
          })}
        </div>

        {/* Category Dropdown */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: "8px 14px",
            borderRadius: "10px",
            background: "var(--bg-panel)",
            border: "1px solid var(--border-main)",
            color: "var(--text-primary)",
            fontSize: "12px",
            outline: "none"
          }}
        >
          <option value="all">{t.memories.allCategories}</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Memory Cards Stream */}
      {loading ? (
        <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
          ⏳ {t.common.loading}
        </div>
      ) : filteredMemories.length === 0 ? (
        <div style={{
          background: "var(--bg-panel)",
          border: "1px dashed var(--border-main)",
          borderRadius: "14px",
          padding: "48px 24px",
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: "13px"
        }}>
          {t.memories.emptyMemories}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "18px" }}>
          {filteredMemories.map((mem) => {
            const impCfg = IMPORTANCE_CONFIG[mem.importance] || IMPORTANCE_CONFIG.medium;
            return (
              <div
                key={mem.id}
                style={{
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-main)",
                  borderRadius: "12px",
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)",
                  position: "relative",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                }}
              >
                {/* Top badges */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: impCfg.bg,
                      color: impCfg.color,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}>
                      {impCfg.icon} {isZh ? impCfg.labelZh : impCfg.labelEn}
                    </span>

                    <span style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.06)",
                      color: "var(--text-secondary)",
                      fontWeight: 600
                    }}>
                      {mem.category}
                    </span>

                    {mem.source && mem.source !== "manual" && (
                      <span style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "rgba(0, 168, 255, 0.12)",
                        color: "#00a8ff",
                        fontWeight: 600
                      }}>
                        via {mem.source}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${mem.title}\n\n${mem.content}`);
                        setSuccessMessage("记忆内容已复制");
                        setTimeout(() => setSuccessMessage(null), 2000);
                      }}
                      style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "12px", padding: "2px 4px" }}
                      title="复制"
                    >
                      📋
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMemory(mem)}
                      style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "12px", padding: "2px 4px" }}
                      title="编辑"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(mem.id)}
                      style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "12px", padding: "2px 4px" }}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#fff", lineHeight: "1.4" }}>
                  {mem.title}
                </h3>

                {/* Content */}
                <p style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  margin: 0,
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  flex: 1
                }}>
                  {mem.content}
                </p>

                {/* Tags & Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {mem.tags.map((tag, idx) => (
                      <span key={idx} style={{ fontSize: "11px", color: "var(--primary)", opacity: 0.85 }}>
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", opacity: 0.7 }}>
                    {new Date(mem.updatedAt || mem.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingMemory && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--border-main)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "560px",
            padding: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.6)",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
              {t.memories.editMemory}
            </h2>

            <input
              type="text"
              value={editingMemory.title}
              onChange={(e) => setEditingMemory({ ...editingMemory, title: e.target.value })}
              placeholder="记忆标题"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-main)",
                color: "#fff",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />

            <div style={{ display: "flex", gap: "10px" }}>
              <select
                value={editingMemory.importance}
                onChange={(e) => setEditingMemory({ ...editingMemory, importance: e.target.value as ImportanceLevel })}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid var(--border-main)",
                  color: "#fff",
                  fontSize: "12px",
                  outline: "none"
                }}
              >
                <option value="critical">🔥 核心架构 (Critical)</option>
                <option value="high">📌 关键决策 (High)</option>
                <option value="medium">💡 经验备忘 (Medium)</option>
                <option value="low">📝 细节记录 (Low)</option>
              </select>

              <select
                value={editingMemory.category}
                onChange={(e) => setEditingMemory({ ...editingMemory, category: e.target.value as MemoryCategory })}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid var(--border-main)",
                  color: "#fff",
                  fontSize: "12px",
                  outline: "none"
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <textarea
              value={editingMemory.content}
              onChange={(e) => setEditingMemory({ ...editingMemory, content: e.target.value })}
              rows={6}
              style={{
                width: "100%",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-main)",
                borderRadius: "8px",
                padding: "12px",
                color: "#fff",
                fontSize: "13px",
                lineHeight: "1.6",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit"
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setEditingMemory(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-main)",
                  cursor: "pointer",
                  fontSize: "13px"
                }}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px"
                }}
              >
                {t.memories.saveEdit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
