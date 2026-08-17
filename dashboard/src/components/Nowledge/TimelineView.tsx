import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import type { Session, Memory, GraphData } from "../../types";
import {
  fetchMemories,
  createMemory,
  getGraphData,
  getFullChat,
} from "../../api/ArcRift";

interface TimelineViewProps {
  activeSession?: Session;
  sessions?: Session[];
  onSessionSelect?: (session: Session) => void;
  onNavigateTab: (tab: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  activeSession,
  sessions = [],
  onSessionSelect,
  onNavigateTab,
}) => {
  const [quickText, setQuickText] = useState("");
  const [filterPill, setFilterPill] = useState<
    "all" | "discoveries" | "crystals" | "attention" | "saved" | "events"
  >("all");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionGraph, setSessionGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [fullChatText, setFullChatText] = useState<string | null>(null);
  const [showFullChat, setShowFullChat] = useState(false);
  const [isDistilling, setIsDistilling] = useState(false);

  const miniSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    loadMemories();
    if (activeSession?._id) {
      loadSessionDetails(activeSession._id);
    }
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

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const g = await getGraphData(sessionId);
      setSessionGraph(g as GraphData);
      const chat = await getFullChat(sessionId);
      setFullChatText(chat?.rawText || null);
    } catch (err) {
      console.error("Failed to load session details", err);
    }
  };

  // Render Mini D3 Graph in Right Inspector
  useEffect(() => {
    if (!miniSvgRef.current || sessionGraph.nodes.length === 0) return;

    const width = 320;
    const height = 140;

    const svg = d3.select(miniSvgRef.current);
    svg.selectAll("*").remove();

    svg.attr("viewBox", [0, 0, width, height] as any);

    const nodes = sessionGraph.nodes.map((d: any) => ({ ...d }));
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const links = sessionGraph.links
      .filter((l: any) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        return nodeIds.has(src) && nodeIds.has(tgt);
      })
      .map((d: any) => ({ ...d }));

    const simulation = d3
      .forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(45))
      .force("charge", d3.forceManyBody().strength(-80))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(18));

    const link = svg
      .append("g")
      .attr("stroke", "rgba(56, 189, 248, 0.3)")
      .attr("stroke-width", 1.5)
      .selectAll("line")
      .data(links)
      .join("line");

    const node = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g");

    node
      .append("circle")
      .attr("r", 7)
      .attr("fill", (d: any) => (d.type === "Tech" ? "#10b981" : d.type === "Decision" ? "#38bdf8" : "#c084fc"))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1);

    node
      .append("text")
      .attr("dx", 10)
      .attr("dy", 3)
      .attr("fill", "#94a3b8")
      .attr("font-size", "9px")
      .text((d: any) => (d.id.length > 8 ? d.id.slice(0, 8) + "…" : d.id));

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [sessionGraph, selectedItem]);

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

  // Automatically distill session into long-term memories
  const handleDistillMemories = async () => {
    if (!activeSession || isDistilling) return;
    setIsDistilling(true);
    try {
      // Split summary paragraphs into high-signal memory crystal cards
      const summaryText = activeSession.summary || "";
      const sections = summaryText.split(/##\s+/).filter(Boolean);

      for (const sec of sections) {
        const lines = sec.trim().split("\n");
        const title = lines[0].replace(/^[0-9.\s]+/, "").trim();
        const content = lines.slice(1).join("\n").trim();
        if (title && content) {
          await createMemory({
            sessionId: activeSession._id,
            title: title.slice(0, 40),
            content,
            importance: "critical",
            category: title.includes("接口") ? "Architecture" : title.includes("错误码") ? "Gotcha" : "Decision",
            tags: [activeSession.projectName, "OTA", "Android"],
            source: "distillation",
          });
        }
      }

      await loadMemories();
      alert(`已成功为《${activeSession.projectName}》提炼沉淀了 ${sections.length} 条结构化长期记忆！`);
      onNavigateTab("memories");
    } catch (err) {
      console.error("Failed to distill memories", err);
    } finally {
      setIsDistilling(false);
    }
  };

  // Build combined timeline items from real sessions + memories
  const currentSessions = sessions.length > 0 ? sessions : (activeSession ? [activeSession] : []);

  const timelineItems = [
    ...currentSessions.map((s) => ({
      id: `session_${s._id}`,
      type: "session_import",
      badge: "会话已导入",
      rawSession: s,
      title: `《${s.projectName}》会话已导入`,
      subtitle: s.summary
        ? s.summary.replace(/[#*`\n]/g, " ").slice(0, 110) + "..."
        : `已从 ${s.platform || "MCP"} 捕获会话，提取了 ${s.tripleCount || 0} 个知识三元组。`,
      time: s.createdAt
        ? new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "刚刚",
      source: s.platform || "Antigravity",
      messageCount: s.topicCount || 1,
      importedCount: 1,
      content: s.summary || "原始会话已就绪，支持向量与全文检索。",
    })),
    ...memories.map((m) => ({
      id: `mem_${m.id}`,
      type: "crystal",
      badge: m.importance === "critical" ? "💎 核心结晶" : "💡 知识记忆",
      title: m.title,
      subtitle: m.content.slice(0, 100) + (m.content.length > 100 ? "..." : ""),
      time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      source: m.source || "手动记录",
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

  // Default active selection to first item if none selected
  const activeDetailItem = selectedItem || (filteredItems.length > 0 ? filteredItems[0] : null);

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
                className={`nl-feed-card ${activeDetailItem?.id === item.id ? "selected" : ""}`}
                onClick={() => {
                  setSelectedItem(item);
                  if ((item as any).rawSession && onSessionSelect) {
                    onSessionSelect((item as any).rawSession);
                  }
                }}
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
        {activeDetailItem ? (
          <div className="nl-inspector-detail">
            <div className="nl-inspector-header">
              <span className="nl-inspector-label">详情</span>
              <span className="nl-card-time">{activeDetailItem.time}</span>
            </div>

            <h2 className="nl-detail-title">{activeDetailItem.title}</h2>

            {/* Real Summary Markdown Box */}
            <div className="nl-detail-box">
              <div className="nl-detail-box-badge">💬 {activeDetailItem.badge}</div>
              <div className="nl-real-summary-markdown">
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "13px", lineHeight: "1.6", color: "#e2e8f0" }}>
                  {activeDetailItem.content}
                </pre>
              </div>
            </div>

            {/* Metadata Table */}
            <div className="nl-metadata-table">
              <div className="nl-meta-row">
                <span className="nl-meta-key">项目空间</span>
                <span className="nl-meta-val" style={{ color: "#38bdf8", fontWeight: "bold" }}>
                  {(activeDetailItem as any).rawSession?.projectName || activeSession?.projectName || "默认项目"}
                </span>
              </div>
              <div className="nl-meta-row">
                <span className="nl-meta-key">已导入会话</span>
                <span className="nl-meta-val">{activeDetailItem.importedCount || 1} 条</span>
              </div>
              <div className="nl-meta-row">
                <span className="nl-meta-key">图谱知识事实</span>
                <span className="nl-meta-val" style={{ color: "#10b981" }}>
                  {(activeDetailItem as any).rawSession?.tripleCount || sessionGraph.nodes.length || 0} 个实体三元组
                </span>
              </div>
              <div className="nl-meta-row">
                <span className="nl-meta-key">来源工具</span>
                <span className="nl-meta-val">{activeDetailItem.source || "Antigravity"}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="nl-detail-actions">
              <div className="nl-action-tip">✓ 原始会话已建立向量索引，支持全文及语义检索。</div>
              <div className="nl-action-tip">✓ 点击下方按钮可将本次讨论关键要点提炼为原子记忆卡片。</div>
              <button
                className="nl-primary-action-btn"
                onClick={handleDistillMemories}
                disabled={isDistilling}
              >
                {isDistilling ? "正在智能提炼..." : "✨ 安排第一批记忆 (提炼结晶)"}
              </button>

              {fullChatText && (
                <button
                  className="nl-btn-secondary"
                  style={{ width: "100%", marginTop: 8, justifyContent: "center" }}
                  onClick={() => setShowFullChat(!showFullChat)}
                >
                  {showFullChat ? "收起原始会话正文" : "📄 查看原始对话文本"}
                </button>
              )}
            </div>

            {/* Collapsible Full Chat Text */}
            {showFullChat && fullChatText && (
              <div className="nl-card" style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: "12px", color: "var(--nl-text-muted)", marginBottom: 8 }}>原始对话记录</h4>
                <pre className="nl-chat-transcript-text" style={{ maxHeight: "200px", fontSize: "12px" }}>
                  {fullChatText}
                </pre>
              </div>
            )}

            {/* Real Interactive Mini Knowledge Graph */}
            <div className="nl-mini-graph-section">
              <div className="nl-mini-graph-header">
                <span>知识图谱 ({sessionGraph.nodes.length} 节点)</span>
                <button
                  className="nl-expand-link"
                  onClick={() => onNavigateTab("graph")}
                >
                  ⤢ 展开全图
                </button>
              </div>
              <div className="nl-mini-graph-canvas">
                {sessionGraph.nodes.length > 0 ? (
                  <svg ref={miniSvgRef} style={{ width: "100%", height: "100%" }}></svg>
                ) : (
                  <div className="nl-graph-placeholder">
                    <div className="nl-pulsing-node"></div>
                    <span>No graph data</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Default Dashboard View */
          <div className="nl-inspector-overview">
            <div className="nl-overview-header">
              <span>项目概览</span>
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
};
