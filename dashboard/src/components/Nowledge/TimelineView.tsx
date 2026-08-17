import React, { useState, useEffect } from "react";
import type { Session, Memory } from "../../types";
import { fetchMemories, createMemory } from "../../api/ArcRift";

interface TimelineViewProps {
  activeSession?: Session;
  onNavigateTab: (tab: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  activeSession,
  onNavigateTab,
}) => {
  const [quickText, setQuickText] = useState("");
  const [filterPill, setFilterPill] = useState<
    "all" | "discoveries" | "crystals" | "attention" | "saved" | "events"
  >("all");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadMemories();
  }, [activeSession?._id]);

  const loadMemories = async () => {
    try {
      const res = await fetchMemories({ sessionId: activeSession?._id });
      if (res.success) {
        setMemories(res.memories);
      }
    } catch (err) {
      console.error("Failed to load memories for timeline", err);
    }
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createMemory({
        sessionId: activeSession?._id || "default",
        title: quickText.slice(0, 30),
        content: quickText,
        importance: "high",
        category: "Note",
        source: "quick_capture",
      });
      setQuickText("");
      await loadMemories();
    } catch (err) {
      console.error("Failed to submit quick capture", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build combined timeline items (Sessions + Memories + Events)
  const timelineItems = [
    ...(activeSession
      ? [
          {
            id: `session_${activeSession._id}`,
            type: "session_import",
            badge: "会话已导入",
            title: `已从 ${activeSession.platform || "antigravity"} 保存 1 个会话`,
            subtitle: "现在就能搜索。 安排第一批记忆",
            time: "15:23",
            source: activeSession.platform || "antigravity",
            messageCount: activeSession.topicCount || 4,
            importedCount: 1,
            content: activeSession.summary || "原始会话已就绪，支持向量与全文检索。",
          },
        ]
      : []),
    ...memories.map((m) => ({
      id: m.id,
      type: "crystal",
      badge: m.importance === "critical" ? "💎 核心结晶" : "💡 知识记忆",
      title: m.title,
      subtitle: m.content.slice(0, 100) + (m.content.length > 100 ? "..." : ""),
      time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      source: m.source,
      category: m.category,
      content: m.content,
      tags: m.tags,
    })),
  ];

  const filteredItems = timelineItems.filter((item) => {
    if (filterPill === "all") return true;
    if (filterPill === "crystals") return item.type === "crystal";
    if (filterPill === "events") return item.type === "session_import";
    if (filterPill === "saved") return true;
    return true;
  });

  return (
    <div className="nl-timeline-layout">
      {/* Center Feed Column */}
      <div className="nl-feed-column">
        {/* View Header */}
        <div className="nl-view-header">
          <div className="nl-view-title-group">
            <h1 className="nl-view-title">时间线</h1>
            <p className="nl-view-subtitle">最近的保存、发现与工作记忆</p>
          </div>
        </div>

        {/* Quick Capture Composer */}
        <div className="nl-composer-card">
          <textarea
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            placeholder="想到了什么？"
            className="nl-composer-input"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleQuickSubmit(e);
              }
            }}
          />
          <div className="nl-composer-actions">
            <div className="nl-composer-tools">
              <button className="nl-tool-btn" title="附件">📎</button>
              <button className="nl-tool-btn" title="插入文件">📁</button>
              <button className="nl-tool-btn" title="知识库资料">📖</button>
            </div>
            <button
              onClick={handleQuickSubmit}
              disabled={!quickText.trim() || isSubmitting}
              className="nl-submit-btn"
              title="发送 (Ctrl+Enter)"
            >
              ↑
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="nl-filter-bar">
          <button
            className={`nl-filter-pill ${filterPill === "all" ? "active" : ""}`}
            onClick={() => setFilterPill("all")}
          >
            全部
          </button>
          <button
            className={`nl-filter-pill ${filterPill === "discoveries" ? "active" : ""}`}
            onClick={() => setFilterPill("discoveries")}
          >
            发现
          </button>
          <button
            className={`nl-filter-pill ${filterPill === "crystals" ? "active" : ""}`}
            onClick={() => setFilterPill("crystals")}
          >
            知识结晶
          </button>
          <button
            className={`nl-filter-pill ${filterPill === "attention" ? "active" : ""}`}
            onClick={() => setFilterPill("attention")}
          >
            待关注
          </button>
          <button
            className={`nl-filter-pill ${filterPill === "saved" ? "active" : ""}`}
            onClick={() => setFilterPill("saved")}
          >
            已保存
          </button>
          <button
            className={`nl-filter-pill ${filterPill === "events" ? "active" : ""}`}
            onClick={() => setFilterPill("events")}
          >
            事件
          </button>
        </div>

        {/* Timeline Group Header */}
        <div className="nl-timeline-divider">
          <span className="nl-divider-icon">📅</span>
          <span>今天 · {filteredItems.length} 事件</span>
        </div>

        {/* Timeline Feed Stream */}
        <div className="nl-feed-list">
          {filteredItems.length === 0 ? (
            <div className="nl-feed-empty">
              <div className="nl-empty-icon">🌱</div>
              <div className="nl-empty-title">今天暂无新事件</div>
              <div className="nl-empty-sub">在上方记录想法，或通过 Antigravity / Cursor 自动同步会话。</div>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className={`nl-feed-card ${selectedItem?.id === item.id ? "selected" : ""}`}
                onClick={() => setSelectedItem(item)}
              >
                <div className="nl-card-indicator">
                  <span className="nl-dot"></span>
                </div>
                <div className="nl-card-main">
                  <div className="nl-card-header">
                    <span className="nl-card-badge">💬 {item.badge}</span>
                    <span className="nl-card-time">{item.time}</span>
                  </div>
                  <div className="nl-card-title">{item.title}</div>
                  {item.subtitle && (
                    <div className="nl-card-snippet">{item.subtitle}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Context Inspector / Statistics Dashboard */}
      <div className="nl-inspector-column">
        {selectedItem ? (
          <div className="nl-inspector-detail">
            <div className="nl-inspector-header">
              <span className="nl-inspector-label">详情</span>
              <button
                className="nl-close-btn"
                onClick={() => setSelectedItem(null)}
              >
                ✕
              </button>
            </div>

            <h2 className="nl-detail-title">{selectedItem.title}</h2>

            <div className="nl-detail-box">
              <div className="nl-detail-box-badge">💬 {selectedItem.badge}</div>
              <p className="nl-detail-box-text">
                Mem 会先保存原始会话，所以你和你的 Agent 现在已经可以搜索它们。长期记忆提炼是可选操作；当你选择处理时，Mem 只会先从这个来源安排一个小批次。
              </p>
            </div>

            {/* Metadata Table */}
            <div className="nl-metadata-table">
              <div className="nl-meta-row">
                <span className="nl-meta-key">已导入</span>
                <span className="nl-meta-val">{selectedItem.importedCount || 1}</span>
              </div>
              <div className="nl-meta-row">
                <span className="nl-meta-key">消息数</span>
                <span className="nl-meta-val">{selectedItem.messageCount || 4}</span>
              </div>
              <div className="nl-meta-row">
                <span className="nl-meta-key">来源</span>
                <span className="nl-meta-val">{selectedItem.source || "antigravity"}</span>
              </div>
            </div>

            <div className="nl-detail-actions">
              <div className="nl-action-tip">✓ 原始会话已经可以搜索。</div>
              <div className="nl-action-tip">✓ 只把值得长期保留的事实、决策、流程和经验提炼成记忆。</div>
              <button
                className="nl-primary-action-btn"
                onClick={() => onNavigateTab("memories")}
              >
                安排第一批记忆
              </button>
            </div>

            {/* Mini Knowledge Graph Preview */}
            <div className="nl-mini-graph-section">
              <div className="nl-mini-graph-header">
                <span>知识图谱</span>
                <button
                  className="nl-expand-link"
                  onClick={() => onNavigateTab("graph")}
                >
                  ⤢ 展开
                </button>
              </div>
              <div className="nl-mini-graph-canvas">
                <div className="nl-graph-placeholder">
                  <div className="nl-pulsing-node"></div>
                  <span>{activeSession?.tripleCount ? `${activeSession.tripleCount} 个图谱三元组就绪` : "No graph data"}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Default Dashboard View (Screenshot 1 Right side) */
          <div className="nl-inspector-overview">
            <div className="nl-overview-header">
              <span>项目概览</span>
            </div>

            {/* 4 Stat Cards */}
            <div className="nl-stats-grid">
              <div className="nl-stat-card">
                <div className="nl-stat-num">{memories.length}</div>
                <div className="nl-stat-name">记忆</div>
              </div>
              <div className="nl-stat-card">
                <div className="nl-stat-num">{activeSession?.tripleCount || 0}</div>
                <div className="nl-stat-name">知识发现</div>
              </div>
              <div className="nl-stat-card">
                <div className="nl-stat-num">{activeSession?.topicCount || 1}</div>
                <div className="nl-stat-name">主题</div>
              </div>
              <div className="nl-stat-card">
                <div className="nl-stat-num">0</div>
                <div className="nl-stat-name">遗忘中</div>
              </div>
            </div>

            {/* Calendar Heatmap Matrix */}
            <div className="nl-calendar-card">
              <div className="nl-calendar-header">
                <span>活动日历</span>
                <span className="nl-cal-month">◀ 2026年8月 ▶</span>
              </div>
              <div className="nl-calendar-grid">
                {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
                  <div key={d} className="nl-cal-day-label">{d}</div>
                ))}
                {Array.from({ length: 31 }).map((_, i) => {
                  const dayNum = i + 1;
                  const isActive = dayNum === 17; // Today August 17
                  return (
                    <div
                      key={i}
                      className={`nl-cal-cell ${isActive ? "active" : ""}`}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Events Log */}
            <div className="nl-recent-events">
              <div className="nl-events-header">最近事件</div>
              <div className="nl-event-row">
                <span className="nl-event-dot"></span>
                <span className="nl-event-text">
                  Synced 1 {activeSession?.platform || "antigravity"} conversation(s)
                </span>
                <span className="nl-event-time">5分钟前</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
