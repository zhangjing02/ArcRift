import React, { useState, useEffect } from "react";
import type { Session, Memory } from "../../types";
import { fetchMemories } from "../../api/ArcRift";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
  IconSearch,
  IconMemories,
  IconFolder,
  IconGraph,
  IconTag,
  IconCalendar,
  IconTimeline,
  IconThreads,
  IconSkills,
  IconContext,
  IconLibrary,
  IconTree,
  IconCategory,
  IconAiNow,
  IconChevronRight,
} from "./Icons";

interface KnowledgeTreeViewProps {
  activeSession?: Session;
  onNavigateTab?: (tab: string) => void;
}

const TreeChevron: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
  <span className="nl-tree-arrow-wrap">
    <IconChevronRight
      size={11}
      style={{
        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.15s ease",
      }}
    />
  </span>
);

export const KnowledgeTreeView: React.FC<KnowledgeTreeViewProps> = ({
  activeSession,
  onNavigateTab,
}) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  // Tree nodes expanded states (Drawer accordion like Nowledge Mem)
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({
    root_memories: true,
    all_memories: true,
    by_project: false,
    by_date: false,
    by_tags: false,
    by_type: false,
    crystals: false,
    recorded_in: false,
    happened_at: false,
    working_memory: false,
    activity: false,
    skills: false,
    threads: false,
    wiki: false,
    context: false,
    artifacts: false,
    ontology: false,
  });

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    loadData();
  }, [activeSession?._id]);

  const loadData = async () => {
    try {
      const res = await fetchMemories({ sessionId: activeSession?._id });
      if (res.success && res.memories) {
        setMemories(res.memories);
        if (res.memories.length > 0 && !selectedMemory) {
          setSelectedMemory(res.memories[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load memories for knowledge tree", err);
    }
  };

  // Group memories
  const projectGroupsMap = new Map<string, Memory[]>();
  const dateGroupsMap = new Map<string, Memory[]>();
  const tagGroupsMap = new Map<string, Memory[]>();
  const typeGroupsMap = new Map<string, Memory[]>();

  memories.forEach((m) => {
    // Project
    const pTag =
      (m.sessionId && m.sessionId !== "default" ? m.sessionId : null) ||
      (m.tags && m.tags.length > 0 ? m.tags[0] : null) ||
      "ChronosMind";
    if (!projectGroupsMap.has(pTag)) projectGroupsMap.set(pTag, []);
    projectGroupsMap.get(pTag)!.push(m);

    // Date
    const d = new Date(m.createdAt);
    const dateStr = `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
    if (!dateGroupsMap.has(dateStr)) dateGroupsMap.set(dateStr, []);
    dateGroupsMap.get(dateStr)!.push(m);

    // Tags
    (m.tags || []).forEach((t) => {
      const clean = t.trim();
      if (clean) {
        if (!tagGroupsMap.has(clean)) tagGroupsMap.set(clean, []);
        tagGroupsMap.get(clean)!.push(m);
      }
    });

    // Type
    const uType = m.unitType || m.category || "决策";
    if (!typeGroupsMap.has(uType)) typeGroupsMap.set(uType, []);
    typeGroupsMap.get(uType)!.push(m);
  });

  const sortedProjects = Array.from(projectGroupsMap.entries()).sort((a, b) => b[1].length - a[1].length);
  const sortedDates = Array.from(dateGroupsMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  const sortedTags = Array.from(tagGroupsMap.entries()).sort((a, b) => b[1].length - a[1].length);
  const sortedTypes = Array.from(typeGroupsMap.entries()).sort((a, b) => b[1].length - a[1].length);

  // Search filter for leaf memory items
  const filterMems = (list: Memory[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        (m.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  };

  const getTimeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins} 分钟前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} 小时前`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} 天前`;
  };

  return (
    <div className="nl-knowledge-tree-layout">
      {/* ─────────────────────────────────────────────────────────────
          LEFT: Expandable Nested Drawer Tree (Matches Screenshot 3)
      ───────────────────────────────────────────────────────────── */}
      <aside className="nl-tree-sidebar-col">
        {/* Search in Tree */}
        <div className="nl-tree-search-wrap">
          <IconSearch size={14} className="nl-tree-search-icon" />
          <input
            type="text"
            placeholder="在树中查找..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="nl-tree-search-input"
          />
        </div>

        {/* Tree Accordion Hierarchy */}
        <div className="nl-tree-nodes-list">
          {/* ROOT 1: 记忆 (Memories) */}
          <div className="nl-tree-node-group">
            <div
              className={`nl-tree-node-row ${expanded.root_memories ? "open" : ""}`}
              onClick={() => toggle("root_memories")}
            >
              <TreeChevron isOpen={expanded.root_memories} />
              <IconMemories size={14} className="nl-tree-icon" />
              <span className="nl-tree-label">记忆</span>
            </div>

            {expanded.root_memories && (
              <div className="nl-tree-sub-children">
                {/* 1.1 全部记忆 (Expandable Drawer to Leaf Nodes) */}
                <div className="nl-tree-sub-group">
                  <div
                    className={`nl-tree-node-row ${expanded.all_memories ? "open" : ""}`}
                    onClick={() => toggle("all_memories")}
                  >
                    <TreeChevron isOpen={expanded.all_memories} />
                    <IconFolder size={14} className="nl-tree-icon" />
                    <span className="nl-tree-label">全部记忆</span>
                    <span className="nl-tree-count-badge">{memories.length}</span>
                  </div>

                  {expanded.all_memories && (
                    <div className="nl-tree-leafs-container">
                      {filterMems(memories).map((m) => (
                        <div
                          key={m.id}
                          className={`nl-tree-leaf-row ${selectedMemory?.id === m.id ? "active" : ""}`}
                          onClick={() => setSelectedMemory(m)}
                        >
                          <span className="nl-tree-leaf-bullet">
                            <IconMemories size={11} className="nl-tree-leaf-icon" />
                          </span>
                          <span className="nl-tree-leaf-title" title={m.title}>
                            {m.title}
                          </span>
                          <span className="nl-tree-leaf-badge">MEM</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 1.2 按项目 (Projects Drawer) */}
                <div className="nl-tree-sub-group">
                  <div
                    className={`nl-tree-node-row ${expanded.by_project ? "open" : ""}`}
                    onClick={() => toggle("by_project")}
                  >
                    <TreeChevron isOpen={expanded.by_project} />
                    <IconTree size={14} className="nl-tree-icon" />
                    <span className="nl-tree-label">按项目</span>
                    <span className="nl-tree-count-badge">{sortedProjects.length}</span>
                  </div>

                  {expanded.by_project && (
                    <div className="nl-tree-nested-subgroup">
                      {sortedProjects.map(([pName, pMems]) => (
                        <div key={pName} className="nl-tree-sub-project-block">
                          <div
                            className="nl-tree-node-row sub"
                            onClick={() => toggle(`proj_${pName}`)}
                          >
                            <TreeChevron isOpen={expanded[`proj_${pName}`]} />
                            <span className="nl-tree-label">{pName}</span>
                            <span className="nl-tree-count-badge">{pMems.length}</span>
                          </div>
                          {expanded[`proj_${pName}`] && (
                            <div className="nl-tree-leafs-container">
                              {filterMems(pMems).map((m) => (
                                <div
                                  key={m.id}
                                  className={`nl-tree-leaf-row ${selectedMemory?.id === m.id ? "active" : ""}`}
                                  onClick={() => setSelectedMemory(m)}
                                >
                                  <span className="nl-tree-leaf-bullet">
                                    <IconMemories size={11} className="nl-tree-leaf-icon" />
                                  </span>
                                  <span className="nl-tree-leaf-title" title={m.title}>
                                    {m.title}
                                  </span>
                                  <span className="nl-tree-leaf-badge">MEM</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 1.3 按日期 */}
                <div className="nl-tree-sub-group">
                  <div
                    className={`nl-tree-node-row ${expanded.by_date ? "open" : ""}`}
                    onClick={() => toggle("by_date")}
                  >
                    <TreeChevron isOpen={expanded.by_date} />
                    <IconCalendar size={14} className="nl-tree-icon" />
                    <span className="nl-tree-label">按日期</span>
                    <span className="nl-tree-count-badge">{sortedDates.length}</span>
                  </div>

                  {expanded.by_date && (
                    <div className="nl-tree-nested-subgroup">
                      {sortedDates.map(([dStr, dMems]) => (
                        <div key={dStr}>
                          <div
                            className="nl-tree-node-row sub"
                            onClick={() => toggle(`date_${dStr}`)}
                          >
                            <TreeChevron isOpen={expanded[`date_${dStr}`]} />
                            <span className="nl-tree-label">{dStr}</span>
                            <span className="nl-tree-count-badge">{dMems.length}</span>
                          </div>
                          {expanded[`date_${dStr}`] && (
                            <div className="nl-tree-leafs-container">
                              {filterMems(dMems).map((m) => (
                                <div
                                  key={m.id}
                                  className={`nl-tree-leaf-row ${selectedMemory?.id === m.id ? "active" : ""}`}
                                  onClick={() => setSelectedMemory(m)}
                                >
                                  <span className="nl-tree-leaf-bullet">
                                    <IconMemories size={11} className="nl-tree-leaf-icon" />
                                  </span>
                                  <span className="nl-tree-leaf-title" title={m.title}>
                                    {m.title}
                                  </span>
                                  <span className="nl-tree-leaf-badge">MEM</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 1.4 标签 */}
                <div className="nl-tree-sub-group">
                  <div
                    className={`nl-tree-node-row ${expanded.by_tags ? "open" : ""}`}
                    onClick={() => toggle("by_tags")}
                  >
                    <TreeChevron isOpen={expanded.by_tags} />
                    <IconTag size={14} className="nl-tree-icon" />
                    <span className="nl-tree-label">标签</span>
                    <span className="nl-tree-count-badge">{sortedTags.length}</span>
                  </div>

                  {expanded.by_tags && (
                    <div className="nl-tree-nested-subgroup">
                      {sortedTags.map(([tag, tMems]) => (
                        <div key={tag}>
                          <div
                            className="nl-tree-node-row sub"
                            onClick={() => toggle(`tag_${tag}`)}
                          >
                            <TreeChevron isOpen={expanded[`tag_${tag}`]} />
                            <span className="nl-tree-label">#{tag}</span>
                            <span className="nl-tree-count-badge">{tMems.length}</span>
                          </div>
                          {expanded[`tag_${tag}`] && (
                            <div className="nl-tree-leafs-container">
                              {filterMems(tMems).map((m) => (
                                <div
                                  key={m.id}
                                  className={`nl-tree-leaf-row ${selectedMemory?.id === m.id ? "active" : ""}`}
                                  onClick={() => setSelectedMemory(m)}
                                >
                                  <span className="nl-tree-leaf-bullet">
                                    <IconMemories size={11} className="nl-tree-leaf-icon" />
                                  </span>
                                  <span className="nl-tree-leaf-title" title={m.title}>
                                    {m.title}
                                  </span>
                                  <span className="nl-tree-leaf-badge">MEM</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 1.5 结晶 */}
                <div
                  className="nl-tree-node-row"
                  onClick={() => toggle("crystals")}
                >
                  <TreeChevron isOpen={expanded.crystals} />
                  <IconAiNow size={13} className="nl-tree-icon" />
                  <span className="nl-tree-label">结晶</span>
                </div>

                {/* 1.6 按类型 */}
                <div className="nl-tree-sub-group">
                  <div
                    className={`nl-tree-node-row ${expanded.by_type ? "open" : ""}`}
                    onClick={() => toggle("by_type")}
                  >
                    <TreeChevron isOpen={expanded.by_type} />
                    <IconCategory size={13} className="nl-tree-icon" />
                    <span className="nl-tree-label">按类型</span>
                    <span className="nl-tree-count-badge">{sortedTypes.length}</span>
                  </div>

                  {expanded.by_type && (
                    <div className="nl-tree-nested-subgroup">
                      {sortedTypes.map(([uType, tMems]) => (
                        <div key={uType}>
                          <div
                            className="nl-tree-node-row sub"
                            onClick={() => toggle(`type_${uType}`)}
                          >
                            <TreeChevron isOpen={expanded[`type_${uType}`]} />
                            <span className="nl-tree-label">{uType}</span>
                            <span className="nl-tree-count-badge">{tMems.length}</span>
                          </div>
                          {expanded[`type_${uType}`] && (
                            <div className="nl-tree-leafs-container">
                              {filterMems(tMems).map((m) => (
                                <div
                                  key={m.id}
                                  className={`nl-tree-leaf-row ${selectedMemory?.id === m.id ? "active" : ""}`}
                                  onClick={() => setSelectedMemory(m)}
                                >
                                  <span className="nl-tree-leaf-bullet">
                                    <IconMemories size={11} className="nl-tree-leaf-icon" />
                                  </span>
                                  <span className="nl-tree-leaf-title" title={m.title}>
                                    {m.title}
                                  </span>
                                  <span className="nl-tree-leaf-badge">MEM</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ROOT 2: 记录于 */}
          <div className="nl-tree-node-row" onClick={() => toggle("recorded_in")}>
            <TreeChevron isOpen={expanded.recorded_in} />
            <IconTimeline size={13} className="nl-tree-icon" />
            <span className="nl-tree-label">记录于</span>
          </div>

          {/* ROOT 3: 发生于 */}
          <div className="nl-tree-node-row" onClick={() => toggle("happened_at")}>
            <TreeChevron isOpen={expanded.happened_at} />
            <IconTimeline size={13} className="nl-tree-icon" />
            <span className="nl-tree-label">发生于</span>
          </div>

          {/* ROOT 4: 工作记忆 */}
          <div className="nl-tree-node-row" onClick={() => onNavigateTab && onNavigateTab("context")}>
            <TreeChevron isOpen={false} />
            <IconCalendar size={13} className="nl-tree-icon" />
            <span className="nl-tree-label">工作记忆</span>
          </div>

          {/* ROOT 5: 动态 */}
          <div className="nl-tree-node-row" onClick={() => onNavigateTab && onNavigateTab("timeline")}>
            <TreeChevron isOpen={false} />
            <IconTimeline size={13} className="nl-tree-icon" />
            <span className="nl-tree-label">动态</span>
          </div>

          {/* ROOT 6: Skills */}
          <div className="nl-tree-node-row" onClick={() => onNavigateTab && onNavigateTab("skills")}>
            <TreeChevron isOpen={false} />
            <IconSkills size={13} className="nl-tree-icon" />
            <span className="nl-tree-label">Skills</span>
          </div>

          {/* ROOT 7: 会话 */}
          <div className="nl-tree-node-row" onClick={() => onNavigateTab && onNavigateTab("threads")}>
            <TreeChevron isOpen={false} />
            <IconThreads size={13} className="nl-tree-icon" />
            <span className="nl-tree-label">会话</span>
          </div>

          {/* ROOT 8: Wiki */}
          <div className="nl-tree-node-row" onClick={() => onNavigateTab && onNavigateTab("library")}>
            <TreeChevron isOpen={false} />
            <IconLibrary size={13} className="nl-tree-icon" />
            <span className="nl-tree-label">Wiki</span>
          </div>

          {/* ROOT 9: 上下文 */}
          <div className="nl-tree-node-row" onClick={() => onNavigateTab && onNavigateTab("context")}>
            <TreeChevron isOpen={false} />
            <IconContext size={13} className="nl-tree-icon" />
            <span className="nl-tree-label">上下文</span>
          </div>

          {/* ROOT 10: 产物 */}
          <div className="nl-tree-node-row" onClick={() => onNavigateTab && onNavigateTab("library")}>
            <TreeChevron isOpen={false} />
            <IconCategory size={13} className="nl-tree-icon" />
            <span className="nl-tree-label">产物</span>
          </div>

          {/* ROOT 11: Ontology */}
          <div className="nl-tree-node-row" onClick={() => onNavigateTab && onNavigateTab("graph")}>
            <TreeChevron isOpen={false} />
            <IconFolder size={13} className="nl-tree-icon" />
            <span className="nl-tree-label">Ontology</span>
          </div>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT: Drawer Detail Canvas (1:1 with Screenshot 3)
      ───────────────────────────────────────────────────────────── */}
      <main className="nl-tree-detail-canvas-col">
        {selectedMemory ? (
          <div className="nl-tree-memory-article-wrap">
            {/* Top Memory Header */}
            <div className="nl-tree-article-header">
              <div className="nl-tree-type-badge-row">
                <IconMemories size={15} className="nl-tree-type-icon" />
                <span className="nl-tree-type-pill">Memory</span>
              </div>

              <h1 className="nl-tree-article-title">{selectedMemory.title}</h1>

              <div className="nl-tree-article-meta-row">
                <span>{getTimeAgo(selectedMemory.createdAt)}</span>
                <span className="nl-meta-dot">•</span>
                <span>95% confidence</span>
                <span className="nl-meta-dot">•</span>
                <span>
                  {selectedMemory.importance === "critical"
                    ? "400% importance"
                    : selectedMemory.importance === "high"
                    ? "250% importance"
                    : "100% importance"}
                </span>
              </div>
            </div>

            {/* Knowledge Graph Interactive Canvas Box (Matches Screenshot 3) */}
            <div className="nl-tree-graph-preview-box">
              <div className="nl-tree-graph-header">
                <span className="nl-tree-graph-label">图谱</span>
                <button
                  className="nl-tree-graph-dive-btn"
                  onClick={() => onNavigateTab && onNavigateTab("graph")}
                >
                  <IconGraph size={13} style={{ marginRight: 4 }} />
                  <span>深入研究</span>
                </button>
              </div>

              <div className="nl-tree-graph-canvas">
                <svg className="nl-tree-graph-svg" viewBox="0 0 600 240">
                  {/* Subtle Grid Background */}
                  <defs>
                    <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Connecting lines */}
                  <line x1="300" y1="95" x2="160" y2="70" stroke="rgba(255,255,255,0.15)" strokeDasharray="4" />
                  <line x1="300" y1="95" x2="440" y2="70" stroke="rgba(255,255,255,0.15)" strokeDasharray="4" />
                  <line x1="300" y1="95" x2="220" y2="180" stroke="rgba(255,255,255,0.15)" strokeDasharray="4" />
                  <line x1="300" y1="95" x2="380" y2="180" stroke="rgba(255,255,255,0.15)" strokeDasharray="4" />

                  {/* Outer glow for main node */}
                  <circle cx="300" cy="95" r="50" fill="url(#nodeGlow)" />

                  {/* Satellite Node 1: Project / Space */}
                  <g className="nl-graph-node">
                    <circle cx="160" cy="70" r="14" fill="#0369a1" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="160" y="96" fill="#94a3b8" fontSize="10" textAnchor="middle">
                      {selectedMemory.sessionId || "Project"}
                    </text>
                  </g>

                  {/* Satellite Node 2: Unit Type */}
                  <g className="nl-graph-node">
                    <circle cx="440" cy="70" r="14" fill="#047857" stroke="#34d399" strokeWidth="1.5" />
                    <text x="440" y="96" fill="#94a3b8" fontSize="10" textAnchor="middle">
                      {selectedMemory.unitType || selectedMemory.category || "决策"}
                    </text>
                  </g>

                  {/* Satellite Node 3: Primary Tag */}
                  {selectedMemory.tags && selectedMemory.tags[0] && (
                    <g className="nl-graph-node">
                      <circle cx="220" cy="180" r="12" fill="#6d28d9" stroke="#a78bfa" strokeWidth="1.5" />
                      <text x="220" y="204" fill="#94a3b8" fontSize="10" textAnchor="middle">
                        #{selectedMemory.tags[0]}
                      </text>
                    </g>
                  )}

                  {/* Satellite Node 4: Secondary Tag */}
                  {selectedMemory.tags && selectedMemory.tags[1] && (
                    <g className="nl-graph-node">
                      <circle cx="380" cy="180" r="12" fill="#d97706" stroke="#fbbf24" strokeWidth="1.5" />
                      <text x="380" y="204" fill="#94a3b8" fontSize="10" textAnchor="middle">
                        #{selectedMemory.tags[1]}
                      </text>
                    </g>
                  )}

                  {/* Center Main Node */}
                  <g className="nl-graph-node-center">
                    <circle cx="300" cy="95" r="34" fill="#0096c7" stroke="#38bdf8" strokeWidth="1.5" />
                  </g>

                  {/* Center Node Title Label below */}
                  <text
                    x="300"
                    y="155"
                    fill="#f1f5f9"
                    fontSize="13"
                    fontWeight="500"
                    textAnchor="middle"
                    className="nl-graph-center-title"
                  >
                    {selectedMemory.title.length > 32
                      ? selectedMemory.title.slice(0, 32) + "..."
                      : selectedMemory.title}
                  </text>
                </svg>

                {/* Graph Legend (Matches Screenshot 3) */}
                <div className="nl-tree-graph-legend">
                  <span className="nl-legend-item">
                    <span className="nl-legend-dot blue" /> 记忆
                  </span>
                  <span className="nl-legend-item">
                    <span className="nl-legend-dot purple" /> 主题
                  </span>
                  <span className="nl-legend-item">
                    <span className="nl-legend-dot yellow" /> 知识结晶
                  </span>
                  <span className="nl-legend-item">
                    <span className="nl-legend-dot green" /> 资料
                  </span>
                </div>
              </div>
            </div>

            {/* Rich Markdown Body */}
            <div className="nl-tree-markdown-container">
              <MarkdownRenderer content={selectedMemory.content} showSummaryCard={false} />
            </div>
          </div>
        ) : (
          <div className="nl-tree-empty-canvas">
            <IconTree size={40} className="nl-empty-tree-icon" />
            <h3>从左侧树中展开并选择一项记忆</h3>
            <p>支持多层级抽屉展开：全部记忆、按项目、按日期、按标签与分类。</p>
          </div>
        )}
      </main>
    </div>
  );
};
