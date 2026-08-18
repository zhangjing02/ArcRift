import React, { useState, useEffect } from "react";
import type { Session, Memory } from "../../types";
import {
  fetchMemories,
  createMemory,
  fetchSessions,
} from "../../api/ArcRift";
import { IconGlobe, IconFileDoc, IconBook } from "./Icons";

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

  // Real Calendar View Month state
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1); // 1-12

  useEffect(() => {
    loadData();
  }, [activeSession?._id]);

  const loadData = async () => {
    try {
      const res = await fetchMemories({ sessionId: activeSession?._id });
      if (res.success && res.memories) {
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

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Group memories into date clusters and consecutive blocks
  const formatDateLabel = (dateStr: string | Date) => {
    const d = new Date(dateStr);
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

  // Inject system event
  const todayLabel = "今天";
  if (!dayGroupsMap.has(todayLabel)) {
    dayGroupsMap.set(todayLabel, { dateLabel: todayLabel, memories: [], events: [] });
  }

  const firstDay = Array.from(dayGroupsMap.keys())[0] || todayLabel;
  dayGroupsMap.get(firstDay)?.events.push({
    id: "evt_rule_review",
    type: "event",
    dateKey: firstDay,
    title: "Rule review completed",
    time: "18:09",
    source: "system",
  });

  // Stats for Right Sidebar
  const totalMemoriesCount = memories.length;
  const totalCrystalsCount = memories.filter(
    (m) => m.importance === "critical" || (m.importance as any) >= 0.9
  ).length;
  const totalTopicsCount = Math.max(1, allSessions.length);
  const totalResourceGroups = 0;

  // Real Memory Counts Calculation per day (YYYY-MM-DD)
  const memoryCountsByDate = new Map<string, number>();
  memories.forEach((m) => {
    const d = new Date(m.createdAt);
    const dateKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
    memoryCountsByDate.set(dateKey, (memoryCountsByDate.get(dateKey) || 0) + 1);
  });

  // Calculate real Calendar Grid (35 cells: 5 rows x 7 cols)
  const firstDayObj = new Date(viewYear, viewMonth - 1, 1);
  const startDayOfWeek = (firstDayObj.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

  const heatmapDays = Array.from({ length: 35 }, (_, i) => {
    const dayNum = i - startDayOfWeek + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      return { dayNum: null, level: 0, count: 0, isToday: false, dateKey: "" };
    }
    const dateKey = `${viewYear}-${viewMonth.toString().padStart(2, "0")}-${dayNum.toString().padStart(2, "0")}`;
    const count = memoryCountsByDate.get(dateKey) || 0;
    const isToday =
      viewYear === now.getFullYear() &&
      viewMonth === now.getMonth() + 1 &&
      dayNum === now.getDate();

    let level = 0;
    if (count === 1) level = 1;
    else if (count >= 2 && count <= 4) level = 2;
    else if (count > 4) level = 3;

    return { dayNum, level, count, isToday, dateKey };
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
              <button className="nl-tool-btn" title="添加链接">
                <IconGlobe size={14} />
              </button>
              <button className="nl-tool-btn" title="插入文件">
                <IconFileDoc size={14} />
              </button>
              <button className="nl-tool-btn" title="关联资料库">
                <IconBook size={14} />
              </button>
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
                        连续保存了 {savedCount} 条记忆
                      </span>
                      <span className="nl-group-time-range">
                        {firstTime} - {lastTime}
                      </span>
                    </div>
                    <div className="nl-grouped-preview-titles">
                      {group.memories.slice(0, 3).map((m, idx) => (
                        <span key={m.id} className="nl-preview-title-item">
                          {idx + 1}. {m.title}
                          {idx < 2 && idx < group.memories.length - 1 ? " · " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="nl-timeline-items-list">
                    {/* Render individual memory items */}
                    {group.memories.map((m) => {
                      const isExpanded = expandedMemoryIds.has(m.id);
                      const timeStr = new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <div key={m.id} className="nl-timeline-item-card">
                          <div className="nl-timeline-item-main">
                            <div className="nl-timeline-item-header">
                              <h3
                                className="nl-item-title"
                                onClick={() => toggleMemoryExpand(m.id)}
                              >
                                {m.title}
                              </h3>
                              <span className="nl-item-time">{timeStr}</span>
                            </div>

                            {/* Collapsible Content */}
                            {isExpanded && (
                              <div className="nl-item-expanded-body">
                                <p className="nl-item-full-text">{m.content}</p>
                                {m.tags && m.tags.length > 0 && (
                                  <div className="nl-item-tags-row">
                                    {m.tags.map((t) => (
                                      <span key={t} className="nl-tag-badge">
                                        #{t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="nl-item-footer">
                              <button
                                className="nl-btn-text-action"
                                onClick={() => toggleMemoryExpand(m.id)}
                              >
                                {isExpanded ? "收起" : "展开"}
                              </button>
                              <span className="nl-badge-saved">已保存</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Render Events */}
                    {group.events.map((evt) => (
                      <div key={evt.id} className="nl-timeline-event-row">
                        <span className="nl-event-bullet">•</span>
                        <span className="nl-event-title">{evt.title}</span>
                        <span className="nl-event-time">{evt.time}</span>
                      </div>
                    ))}
                  </div>
                )}
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

        {/* Activity Heatmap Calendar (Real Data Driven) */}
        <div className="nl-widget-card">
          <div className="nl-calendar-header">
            <span className="nl-widget-title">活动日历</span>
            <div className="nl-month-nav">
              <button
                className="nl-month-arrow"
                onClick={handlePrevMonth}
                title="上个月"
              >
                ‹
              </button>
              <span className="nl-current-month-text">
                {viewYear}年{viewMonth}月
              </span>
              <button
                className="nl-month-arrow"
                onClick={handleNextMonth}
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
                className={`nl-heatmap-cell ${cell.dayNum ? `lvl-${cell.level}` : "empty"} ${cell.isToday ? "today" : ""}`}
                title={
                  cell.dayNum
                    ? `${viewYear}年${viewMonth}月${cell.dayNum}日: ${cell.count} 条记录`
                    : ""
                }
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
