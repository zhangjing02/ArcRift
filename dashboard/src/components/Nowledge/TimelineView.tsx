import React, { useState, useEffect } from "react";
import type { Session, Memory } from "../../types";
import {
  fetchMemories,
  createMemory,
  fetchSessions,
} from "../../api/ArcRift";

interface TimelineViewProps {
  activeSession?: Session;
  sessions?: Session[];
  onSessionSelect?: (session: Session) => void;
  onNavigateTab: (tab: string) => void;
}

interface SingleEventBlock {
  id: string;
  type: "event";
  dateKey: string;
  title: string;
  time: string;
  source?: string;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  activeSession,
  sessions = [],
}) => {
  const [quickText, setQuickText] = useState("");
  const [filterPill, setFilterPill] = useState<
    "all" | "discoveries" | "crystals" | "attention" | "saved" | "events"
  >("all");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>(sessions);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [expandedMemoryIds, setExpandedMemoryIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Heatmap generation state
  const [calendarMonth, setCalendarMonth] = useState("2026年8月");

  useEffect(() => {
    loadData();
  }, [activeSession?._id]);

  const loadData = async () => {
    try {
      const res = await fetchMemories({ sessionId: activeSession?._id });
      if (res.success) {
        setMemories(res.memories);
      }
      const sRes = await fetchSessions();
      if (sRes && sRes.sessions) {
        setAllSessions(sRes.sessions);
      }
    } catch (err) {
      console.error("Failed to load timeline data", err);
    }
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createMemory({
        sessionId: activeSession?._id || "default",
        title: quickText.slice(0, 40),
        content: quickText,
        importance: "high",
        category: "Note",
        source: "quick_capture",
      });
      setQuickText("");
      await loadData();
    } catch (err) {
      console.error("Failed to submit quick capture", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleMemoryExpand = (memId: string) => {
    setExpandedMemoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(memId)) next.delete(memId);
      else next.add(memId);
      return next;
    });
  };

  // Group memories into date clusters and consecutive blocks
  const formatDateLabel = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isToday) return "今天";
    if (isYesterday) return "昨天";
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  // Build day groups
  const dayGroupsMap = new Map<
    string,
    {
      dateLabel: string;
      memories: Memory[];
      events: SingleEventBlock[];
    }
  >();

  // Sort memories newest first
  const sortedMemories = [...memories].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  sortedMemories.forEach((m) => {
    const label = formatDateLabel(m.createdAt);
    if (!dayGroupsMap.has(label)) {
      dayGroupsMap.set(label, { dateLabel: label, memories: [], events: [] });
    }
    dayGroupsMap.get(label)!.memories.push(m);
  });

  // Inject sample/real system event
  const todayLabel = "今天";
  if (!dayGroupsMap.has(todayLabel)) {
    dayGroupsMap.set(todayLabel, { dateLabel: todayLabel, memories: [], events: [] });
  }

  // Add rule review event for demonstration / audit log
  const firstDay = Array.from(dayGroupsMap.keys())[0] || todayLabel;
  dayGroupsMap.get(firstDay)?.events.push({
    id: "evt_rule_review",
    type: "event",
    dateKey: firstDay,
    title: "Rule review completed",
    time: "18:09",
    source: "system",
  });

  // Calculate stats for Right Sidebar
  const totalMemoriesCount = memories.length;
  const totalCrystalsCount = memories.filter((m) => m.importance === "critical" || (m.importance as any) >= 0.9).length;
  const totalTopicsCount = Math.max(1, allSessions.length);
  const totalResourceGroups = 0;

  // Generate 35 calendar cells (5 weeks * 7 days)
  const heatmapDays = Array.from({ length: 35 }, (_, i) => {
    const dayNum = i + 1;
    // Active cells for demo match screenshot
    const hasActivity = dayNum === 17 || dayNum === 18 || dayNum === 23 || dayNum === 24;
    const level = dayNum === 18 ? 3 : dayNum === 17 ? 2 : hasActivity ? 1 : 0;
    return { dayNum, level };
  });

  return (
    <div className="nl-timeline-layout">
      {/* ─────────────────────────────────────────────────────────────
          1. CENTER TIMELINE FEED COLUMN (Matches Screenshot 1)
      ───────────────────────────────────────────────────────────── */}
      <div className="nl-feed-column">
        {/* View Header */}
        <div className="nl-view-header">
          <div className="nl-view-title-group">
            <h1 className="nl-view-title">时间线</h1>
            <p className="nl-view-subtitle">最近的保存、发现与工作记录</p>
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
              <button className="nl-tool-btn" title="添加链接">🌍</button>
              <button className="nl-tool-btn" title="插入文件">📄</button>
              <button className="nl-tool-btn" title="关联资料库">📖</button>
            </div>
            <button
              onClick={handleQuickSubmit}
              disabled={!quickText.trim() || isSubmitting}
              className="nl-submit-btn"
              title="保存到记忆 (Ctrl+Enter)"
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

        {/* Timeline Group Stream */}
        <div className="nl-timeline-feed-stream">
          {Array.from(dayGroupsMap.entries()).map(([dateLabel, group]) => {
            const savedCount = group.memories.length;
            const eventCount = group.events.length;
            const groupId = `group_${dateLabel}`;
            const isGroupExpanded = expandedGroupIds.has(groupId);

            // Time range calculation for grouped consecutive block
            const firstTime = group.memories[group.memories.length - 1]?.createdAt
              ? new Date(group.memories[group.memories.length - 1].createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "00:00";
            const lastTime = group.memories[0]?.createdAt
              ? new Date(group.memories[0].createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "23:59";

            return (
              <div key={dateLabel} className="nl-day-timeline-section">
                {/* Date Group Header */}
                <div className="nl-day-group-header">
                  <span className="nl-day-square-bullet">■</span>
                  <span className="nl-day-label">{dateLabel}</span>
                  <span className="nl-day-summary">
                    {savedCount > 0 && `${savedCount} 已保存`}
                    {savedCount > 0 && eventCount > 0 && " · "}
                    {eventCount > 0 && `${eventCount} 事件`}
                  </span>
                </div>

                {/* Consecutive Group Card (Collapse / Expand) */}
                {savedCount > 2 && !isGroupExpanded ? (
                  <div
                    className="nl-grouped-collapse-card"
                    onClick={() => toggleGroupExpand(groupId)}
                  >
                    <div className="nl-grouped-card-top">
                      <span className="nl-group-arrow">▸</span>
                      <span className="nl-group-title-strong">
                        {savedCount} memories saved
                      </span>
                      <span className="nl-group-time-span">
                        {firstTime} - {lastTime}
                      </span>
                    </div>
                    <div className="nl-grouped-card-desc">
                      Grouped from {savedCount} consecutive save cards. Expand to inspect each one.
                    </div>
                  </div>
                ) : (
                  /* Expanded Individual Save Cards */
                  <div className="nl-individual-cards-list">
                    {savedCount > 2 && isGroupExpanded && (
                      <button
                        className="nl-group-collapse-toggle-btn"
                        onClick={() => toggleGroupExpand(groupId)}
                      >
                        ▾ 收起 {savedCount} 条连续保存卡片
                      </button>
                    )}

                    {group.memories.map((mem) => {
                      const isMemExpanded = expandedMemoryIds.has(mem.id);
                      const timeStr = new Date(mem.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                      return (
                        <div key={mem.id} className="nl-timeline-card-item">
                          <div className="nl-card-time-marker">{timeStr}</div>
                          <div className="nl-timeline-card-content">
                            <div className="nl-card-heading">
                              <h3 className="nl-card-title-text">{mem.title}</h3>
                            </div>
                            <div className="nl-card-body-text">
                              {isMemExpanded ? mem.content : mem.content.slice(0, 150) + (mem.content.length > 150 ? "..." : "")}
                            </div>
                            <div className="nl-card-footer-bar">
                              {mem.content.length > 150 && (
                                <button
                                  className="nl-card-expand-link"
                                  onClick={() => toggleMemoryExpand(mem.id)}
                                >
                                  {isMemExpanded ? "收起" : "展开"}
                                </button>
                              )}
                              <span className="nl-saved-badge">■ 已保存</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Events list */}
                {group.events.map((evt) => (
                  <div key={evt.id} className="nl-timeline-event-row">
                    <span className="nl-event-dot">•</span>
                    <span className="nl-event-title">{evt.title}</span>
                    <span className="nl-event-time">{evt.time}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. RIGHT INSPECTOR / STATS DASHBOARD (Matches Screenshot 1)
      ───────────────────────────────────────────────────────────── */}
      <div className="nl-inspector-column">
        {/* Knowledge Overview Card */}
        <div className="nl-widget-card">
          <div className="nl-widget-title">知识概览</div>
          <div className="nl-overview-grid-4">
            <div className="nl-overview-box">
              <div className="nl-overview-number">{totalMemoriesCount}</div>
              <div className="nl-overview-label">记忆</div>
            </div>
            <div className="nl-overview-box">
              <div className="nl-overview-number">{totalCrystalsCount}</div>
              <div className="nl-overview-label">知识结晶</div>
            </div>
            <div className="nl-overview-box">
              <div className="nl-overview-number">{totalTopicsCount}</div>
              <div className="nl-overview-label">主题</div>
            </div>
            <div className="nl-overview-box">
              <div className="nl-overview-number">{totalResourceGroups}</div>
              <div className="nl-overview-label">资源群</div>
            </div>
          </div>
          <div className="nl-overview-footer-text">
            {totalMemoriesCount} 条记忆，{totalTopicsCount} 个主题
          </div>
        </div>

        {/* Activity Heatmap Calendar */}
        <div className="nl-widget-card">
          <div className="nl-calendar-header">
            <span className="nl-widget-title">活动日历</span>
            <div className="nl-month-nav">
              <button
                className="nl-month-arrow"
                onClick={() => setCalendarMonth("2026年7月")}
                title="上个月"
              >
                ‹
              </button>
              <span className="nl-current-month-text">{calendarMonth}</span>
              <button
                className="nl-month-arrow"
                onClick={() => setCalendarMonth("2026年8月")}
                title="下个月"
              >
                ›
              </button>
            </div>
          </div>

          <div className="nl-calendar-weekdays">
            <span>一</span>
            <span>二</span>
            <span>三</span>
            <span>四</span>
            <span>五</span>
            <span>六</span>
            <span>日</span>
          </div>

          <div className="nl-heatmap-grid">
            {heatmapDays.map((cell, idx) => (
              <div
                key={idx}
                className={`nl-heatmap-cell lvl-${cell.level}`}
                title={`第 ${cell.dayNum} 天`}
              />
            ))}
          </div>

          <div className="nl-heatmap-legend">
            <span className="nl-legend-label">少</span>
            <span className="nl-heatmap-cell lvl-0"></span>
            <span className="nl-heatmap-cell lvl-1"></span>
            <span className="nl-heatmap-cell lvl-2"></span>
            <span className="nl-heatmap-cell lvl-3"></span>
            <span className="nl-legend-label">多</span>
          </div>
        </div>

        {/* Recent Events List */}
        <div className="nl-widget-card">
          <div className="nl-widget-title">最近事件</div>
          <div className="nl-recent-events-list">
            <div className="nl-recent-event-item">
              <span className="nl-recent-event-bullet">•</span>
              <span className="nl-recent-event-name">Rule review completed</span>
              <span className="nl-recent-event-time">1天</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
