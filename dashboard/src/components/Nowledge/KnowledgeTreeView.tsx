import React, { useState, useEffect } from "react";
import type { Session, Memory, UnitType } from "../../types";
import { fetchMemories } from "../../api/ArcRift";

interface KnowledgeTreeViewProps {
  activeSession?: Session;
  onNavigateTab?: (tab: string) => void;
}

type TreeBranchKey =
  | "none"
  | "all_memories"
  | "by_date_root"
  | "date_item"
  | "tags_root"
  | "tag_item"
  | "crystals"
  | "by_type_root"
  | "type_item"
  | "recorded_in"
  | "happened_at"
  | "working_memory"
  | "activity"
  | "skills"
  | "threads"
  | "wiki"
  | "context"
  | "artifacts"
  | "ontology";

export const KnowledgeTreeView: React.FC<KnowledgeTreeViewProps> = ({
  activeSession,
  onNavigateTab,
}) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<TreeBranchKey>("none");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [selectedType, setSelectedType] = useState<UnitType | string>("");
  const [selectedMemoryDetail, setSelectedMemoryDetail] = useState<Memory | null>(null);

  // Tree nodes expanded states
  const [expandedNodes, setExpandedNodes] = useState<{
    memories: boolean;
    byDate: boolean;
    tags: boolean;
    byType: boolean;
    recordedIn: boolean;
    happenedAt: boolean;
  }>({
    memories: true,
    byDate: false,
    tags: false,
    byType: false,
    recordedIn: false,
    happenedAt: false,
  });

  const toggleNode = (nodeKey: keyof typeof expandedNodes) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  useEffect(() => {
    loadData();
  }, [activeSession?._id]);

  const loadData = async () => {
    try {
      const res = await fetchMemories({ sessionId: activeSession?._id });
      if (res.success) {
        setMemories(res.memories);
      }
    } catch (err) {
      console.error("Failed to load memories for knowledge tree", err);
    }
  };

  // Group memories by date
  const dateGroupsMap = new Map<string, Memory[]>();
  // Group memories by tags
  const tagCountMap = new Map<string, number>();
  // Group memories by unit type
  const typeGroupsMap = new Map<string, Memory[]>();

  memories.forEach((m) => {
    // 1. By Date
    const d = new Date(m.createdAt);
    const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    if (!dateGroupsMap.has(dateStr)) dateGroupsMap.set(dateStr, []);
    dateGroupsMap.get(dateStr)!.push(m);

    // 2. By Tags
    (m.tags || []).forEach((t) => {
      const tagClean = t.trim();
      if (tagClean) {
        tagCountMap.set(tagClean, (tagCountMap.get(tagClean) || 0) + 1);
      }
    });

    // 3. By Unit Type
    const uType = m.unitType || m.category || "fact";
    if (!typeGroupsMap.has(uType)) typeGroupsMap.set(uType, []);
    typeGroupsMap.get(uType)!.push(m);
  });

  const sortedTags = Array.from(tagCountMap.entries()).sort((a, b) => b[1] - a[1]);
  const sortedDates = Array.from(dateGroupsMap.keys());

  // Unit Types configuration
  const unitTypeDefinitions: { key: string; name: string; desc: string; icon: string }[] = [
    { key: "fact", name: "事实", desc: "客观确立的技术基准、数据规范与环境配置。", icon: "🏛️" },
    { key: "preference", name: "偏好", desc: "个人与团队的工作风格、代码偏好与习惯。", icon: "⚙️" },
    { key: "decision", name: "决策", desc: "经过论证的重大技术选型、架构改动与方案裁决。", icon: "💡" },
    { key: "plan", name: "计划", desc: "已规划的阶段任务、路线图与后续演进安排。", icon: "🎯" },
    { key: "procedure", name: "流程", desc: "标准操作规范、部署排查步骤与工作流法则。", icon: "⚡" },
    { key: "learning", name: "学习", desc: "从实践、踩坑与调试中领悟提炼的经验教训。", icon: "🎓" },
    { key: "context", name: "上下文", desc: "项目背景、团队角色与长期系统上下文信息。", icon: "📑" },
    { key: "event", name: "事件", desc: "所有被记录的关键事件、里程碑或会话归档。", icon: "📅" },
  ];

  const getMemoriesForBranch = (): Memory[] => {
    if (selectedBranch === "all_memories") return memories;
    if (selectedBranch === "date_item" && selectedDate) {
      return dateGroupsMap.get(selectedDate) || [];
    }
    if (selectedBranch === "tag_item" && selectedTag) {
      return memories.filter((m) => (m.tags || []).includes(selectedTag));
    }
    if (selectedBranch === "crystals") {
      return memories.filter((m) => m.importance === "critical" || (m.importance as any) >= 0.8);
    }
    if (selectedBranch === "type_item" && selectedType) {
      return memories.filter(
        (m) => (m.unitType || m.category || "fact").toLowerCase() === selectedType.toLowerCase()
      );
    }
    return [];
  };

  const branchMemories = getMemoriesForBranch();

  // Heatmap generation
  const heatmapDays = Array.from({ length: 35 }, (_, i) => {
    const dayNum = i + 1;
    const hasActivity = dayNum === 17 || dayNum === 18 || dayNum === 23;
    const level = dayNum === 18 ? 3 : dayNum === 17 ? 2 : hasActivity ? 1 : 0;
    return { dayNum, level };
  });

  return (
    <div className="nl-knowledge-tree-layout">
      {/* ─────────────────────────────────────────────────────────────
          LEFT: Virtual Knowledge Tree Sidebar (Screenshots 1 - 5)
      ───────────────────────────────────────────────────────────── */}
      <div className="nl-tree-sidebar-col">
        {/* Search in Tree */}
        <div className="nl-tree-search-wrap">
          <span className="nl-tree-search-icon">🔍</span>
          <input
            type="text"
            placeholder="在树中查找..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="nl-tree-search-input"
          />
        </div>

        {/* Tree Node Hierarchy */}
        <div className="nl-tree-nodes-list">
          {/* ROOT 1: 记忆 (Memories) */}
          <div className="nl-tree-node-group">
            <div
              className={`nl-tree-node-row root ${selectedBranch === "all_memories" ? "active" : ""}`}
              onClick={() => {
                toggleNode("memories");
                setSelectedBranch("all_memories");
                setSelectedMemoryDetail(null);
              }}
            >
              <span className="nl-tree-arrow">{expandedNodes.memories ? "▾" : "▸"}</span>
              <span className="nl-tree-icon">🗂️</span>
              <span className="nl-tree-label">记忆</span>
            </div>

            {expandedNodes.memories && (
              <div className="nl-tree-sub-children">
                {/* 1.1 全部记忆 */}
                <div
                  className={`nl-tree-node-row ${selectedBranch === "all_memories" ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedBranch("all_memories");
                    setSelectedMemoryDetail(null);
                  }}
                >
                  <span className="nl-tree-icon">💡</span>
                  <span className="nl-tree-label">全部记忆</span>
                  <span className="nl-tree-count-badge">{memories.length}</span>
                </div>

                {/* 1.2 按日期 */}
                <div className="nl-tree-sub-group">
                  <div
                    className={`nl-tree-node-row ${selectedBranch === "by_date_root" ? "selected" : ""}`}
                    onClick={() => {
                      toggleNode("byDate");
                      setSelectedBranch("by_date_root");
                      setSelectedMemoryDetail(null);
                    }}
                  >
                    <span className="nl-tree-arrow">{expandedNodes.byDate ? "▾" : "▸"}</span>
                    <span className="nl-tree-icon">📅</span>
                    <span className="nl-tree-label">按日期</span>
                  </div>

                  {expandedNodes.byDate && (
                    <div className="nl-tree-date-picker-embedded">
                      {/* Mini Heatmap Grid in Tree */}
                      <div className="nl-tree-mini-calendar">
                        <div className="nl-calendar-header">
                          <span className="nl-tree-cal-title">日历</span>
                          <span className="nl-tree-cal-month">&lt; 2026年8月 &gt;</span>
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
                            <div key={idx} className={`nl-heatmap-cell lvl-${cell.level}`} />
                          ))}
                        </div>
                      </div>

                      {/* Date Child Nodes */}
                      {sortedDates.map((dateStr) => (
                        <div
                          key={dateStr}
                          className={`nl-tree-node-row leaf ${selectedBranch === "date_item" && selectedDate === dateStr ? "selected" : ""}`}
                          onClick={() => {
                            setSelectedDate(dateStr);
                            setSelectedBranch("date_item");
                            setSelectedMemoryDetail(null);
                          }}
                        >
                          <span className="nl-tree-icon">📅</span>
                          <span className="nl-tree-label">{dateStr}</span>
                          <span className="nl-tree-count-badge">
                            {dateGroupsMap.get(dateStr)?.length}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 1.3 标签 */}
                <div className="nl-tree-sub-group">
                  <div
                    className={`nl-tree-node-row ${selectedBranch === "tags_root" ? "selected" : ""}`}
                    onClick={() => {
                      toggleNode("tags");
                      setSelectedBranch("tags_root");
                      setSelectedMemoryDetail(null);
                    }}
                  >
                    <span className="nl-tree-arrow">{expandedNodes.tags ? "▾" : "▸"}</span>
                    <span className="nl-tree-icon">🏷️</span>
                    <span className="nl-tree-label">标签</span>
                    <span className="nl-tree-count-badge">{sortedTags.length}</span>
                  </div>

                  {expandedNodes.tags && (
                    <div className="nl-tree-tags-list">
                      {sortedTags.map(([tag, count]) => (
                        <div
                          key={tag}
                          className={`nl-tree-node-row leaf ${selectedBranch === "tag_item" && selectedTag === tag ? "selected" : ""}`}
                          onClick={() => {
                            setSelectedTag(tag);
                            setSelectedBranch("tag_item");
                            setSelectedMemoryDetail(null);
                          }}
                        >
                          <span className="nl-tree-icon">🏷️</span>
                          <span className="nl-tree-label">{tag}</span>
                          <span className="nl-tree-count-badge">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 1.4 结晶 */}
                <div
                  className={`nl-tree-node-row ${selectedBranch === "crystals" ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedBranch("crystals");
                    setSelectedMemoryDetail(null);
                  }}
                >
                  <span className="nl-tree-icon">💎</span>
                  <span className="nl-tree-label">结晶</span>
                  <span className="nl-tree-count-badge">
                    {memories.filter((m) => m.importance === "critical" || (m.importance as any) >= 0.8).length}
                  </span>
                </div>

                {/* 1.5 按类型 */}
                <div className="nl-tree-sub-group">
                  <div
                    className={`nl-tree-node-row ${selectedBranch === "by_type_root" ? "selected" : ""}`}
                    onClick={() => {
                      toggleNode("byType");
                      setSelectedBranch("by_type_root");
                      setSelectedMemoryDetail(null);
                    }}
                  >
                    <span className="nl-tree-arrow">{expandedNodes.byType ? "▾" : "▸"}</span>
                    <span className="nl-tree-icon">💡</span>
                    <span className="nl-tree-label">按类型</span>
                  </div>

                  {expandedNodes.byType && (
                    <div className="nl-tree-types-list">
                      {unitTypeDefinitions.map((uDef) => {
                        const count = (typeGroupsMap.get(uDef.key) || []).length;
                        return (
                          <div
                            key={uDef.key}
                            className={`nl-tree-node-row leaf ${selectedBranch === "type_item" && selectedType === uDef.key ? "selected" : ""}`}
                            onClick={() => {
                              setSelectedType(uDef.key);
                              setSelectedBranch("type_item");
                              setSelectedMemoryDetail(null);
                            }}
                          >
                            <span className="nl-tree-icon">{uDef.icon}</span>
                            <span className="nl-tree-label">{uDef.name}</span>
                            {count > 0 && (
                              <span className="nl-tree-count-badge">{count}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 1.6 记录于 */}
                <div
                  className="nl-tree-node-row"
                  onClick={() => toggleNode("recordedIn")}
                >
                  <span className="nl-tree-arrow">{expandedNodes.recordedIn ? "▾" : "▸"}</span>
                  <span className="nl-tree-icon">📥</span>
                  <span className="nl-tree-label">记录于</span>
                </div>

                {/* 1.7 发生于 */}
                <div
                  className="nl-tree-node-row"
                  onClick={() => toggleNode("happenedAt")}
                >
                  <span className="nl-tree-arrow">{expandedNodes.happenedAt ? "▾" : "▸"}</span>
                  <span className="nl-tree-icon">🕒</span>
                  <span className="nl-tree-label">发生于</span>
                </div>
              </div>
            )}
          </div>

          {/* ROOT 2: 工作记录 */}
          <div
            className={`nl-tree-node-row root ${selectedBranch === "working_memory" ? "selected" : ""}`}
            onClick={() => {
              setSelectedBranch("working_memory");
              setSelectedMemoryDetail(null);
            }}
          >
            <span className="nl-tree-arrow">▸</span>
            <span className="nl-tree-icon">📑</span>
            <span className="nl-tree-label">工作记录</span>
          </div>

          {/* ROOT 3: 动态 */}
          <div
            className={`nl-tree-node-row root ${selectedBranch === "activity" ? "selected" : ""}`}
            onClick={() => {
              setSelectedBranch("activity");
              setSelectedMemoryDetail(null);
            }}
          >
            <span className="nl-tree-arrow">▸</span>
            <span className="nl-tree-icon">⚡</span>
            <span className="nl-tree-label">动态</span>
          </div>

          {/* ROOT 4: Skills */}
          <div
            className={`nl-tree-node-row root ${selectedBranch === "skills" ? "selected" : ""}`}
            onClick={() => {
              setSelectedBranch("skills");
              setSelectedMemoryDetail(null);
            }}
          >
            <span className="nl-tree-arrow">▸</span>
            <span className="nl-tree-icon">❖</span>
            <span className="nl-tree-label">Skills</span>
          </div>

          {/* ROOT 5: 会话 */}
          <div
            className={`nl-tree-node-row root ${selectedBranch === "threads" ? "selected" : ""}`}
            onClick={() => {
              setSelectedBranch("threads");
              setSelectedMemoryDetail(null);
            }}
          >
            <span className="nl-tree-arrow">▸</span>
            <span className="nl-tree-icon">💬</span>
            <span className="nl-tree-label">会话</span>
          </div>

          {/* ROOT 6: Wiki */}
          <div
            className={`nl-tree-node-row root ${selectedBranch === "wiki" ? "selected" : ""}`}
            onClick={() => {
              setSelectedBranch("wiki");
              setSelectedMemoryDetail(null);
            }}
          >
            <span className="nl-tree-arrow">▸</span>
            <span className="nl-tree-icon">📖</span>
            <span className="nl-tree-label">Wiki</span>
          </div>

          {/* ROOT 7: 上下文 */}
          <div
            className={`nl-tree-node-row root ${selectedBranch === "context" ? "selected" : ""}`}
            onClick={() => {
              setSelectedBranch("context");
              setSelectedMemoryDetail(null);
            }}
          >
            <span className="nl-tree-arrow">▸</span>
            <span className="nl-tree-icon">⊘</span>
            <span className="nl-tree-label">上下文</span>
          </div>

          {/* ROOT 8: 产物 */}
          <div
            className={`nl-tree-node-row root ${selectedBranch === "artifacts" ? "selected" : ""}`}
            onClick={() => {
              setSelectedBranch("artifacts");
              setSelectedMemoryDetail(null);
            }}
          >
            <span className="nl-tree-arrow">▸</span>
            <span className="nl-tree-icon">📦</span>
            <span className="nl-tree-label">产物</span>
          </div>

          {/* ROOT 9: Ontology */}
          <div
            className={`nl-tree-node-row root ${selectedBranch === "ontology" ? "selected" : ""}`}
            onClick={() => {
              setSelectedBranch("ontology");
              setSelectedMemoryDetail(null);
            }}
          >
            <span className="nl-tree-arrow">▸</span>
            <span className="nl-tree-icon">🏛️</span>
            <span className="nl-tree-label">Ontology</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT: Branch Content View (Matches Screenshots 1 - 5)
      ───────────────────────────────────────────────────────────── */}
      <div className="nl-tree-content-col">
        {/* STATE 0: Empty Placeholder (Screenshot 1) */}
        {selectedBranch === "none" && (
          <div className="nl-tree-empty-state">
            <div className="nl-tree-empty-icon">🌿</div>
            <h2 className="nl-tree-empty-title">选择一个分支</h2>
            <p className="nl-tree-empty-sub">
              从左侧树中查询 Mem 的结构：长期记忆、保存的会话、图谱 Wiki、上下文、工作记录、动态、产物和技能。
            </p>
          </div>
        )}

        {/* STATE 1: 全部记忆 (Screenshot 2) */}
        {selectedBranch === "all_memories" && (
          <div className="nl-tree-branch-panel">
            <div className="nl-tree-panel-header">
              <div className="nl-tree-panel-breadcrumb">🗂️ 记忆</div>
              <h1 className="nl-tree-panel-title">全部记忆</h1>
              <p className="nl-tree-panel-desc">
                所有记忆的精选列表。每一条都是一个可以长期使用的判断、经验、偏好、计划或约定，而不是长文档。
              </p>
            </div>

            <div className="nl-tree-memories-list-stream">
              <div className="nl-tree-list-subheading">深度</div>
              {memories.map((m) => (
                <div
                  key={m.id}
                  className={`nl-tree-memory-card ${selectedMemoryDetail?.id === m.id ? "active" : ""}`}
                  onClick={() => setSelectedMemoryDetail(m)}
                >
                  <span className="nl-tree-card-icon">💡</span>
                  <div className="nl-tree-card-main">
                    <div className="nl-tree-card-title">{m.title}</div>
                    <div className="nl-tree-card-date">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="nl-tree-mem-badge">记忆</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATE 2: 按日期查看记忆 (Screenshot 3) */}
        {selectedBranch === "by_date_root" && (
          <div className="nl-tree-branch-panel">
            <div className="nl-tree-panel-header">
              <div className="nl-tree-panel-breadcrumb">🗂️ 记忆</div>
              <h1 className="nl-tree-panel-title">按日期查看记忆</h1>
              <p className="nl-tree-panel-desc">
                在左侧日历板上方的日历回看"那天我学到了什么"。选中某一天后，它会作为树中的普通分支打开。
              </p>
            </div>

            <div className="nl-tree-recent-dates-section">
              <div className="nl-tree-list-subheading">最近日期</div>
              <div className="nl-recent-dates-grid">
                {sortedDates.map((dateStr) => (
                  <div
                    key={dateStr}
                    className="nl-recent-date-card"
                    onClick={() => {
                      setSelectedDate(dateStr);
                      setSelectedBranch("date_item");
                    }}
                  >
                    <div className="nl-recent-date-icon">📅</div>
                    <div className="nl-recent-date-info">
                      <div className="nl-recent-date-text">{dateStr}</div>
                      <div className="nl-recent-date-action">打开这一天</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STATE 3: 具体某一天 (Selected Date View) */}
        {selectedBranch === "date_item" && (
          <div className="nl-tree-branch-panel">
            <div className="nl-tree-panel-header">
              <div className="nl-tree-panel-breadcrumb">
                <span
                  className="nl-crumb-link"
                  onClick={() => setSelectedBranch("by_date_root")}
                >
                  🗂️ 记忆 / 按日期
                </span>
              </div>
              <h1 className="nl-tree-panel-title">📅 {selectedDate}</h1>
              <p className="nl-tree-panel-desc">
                该日期共沉淀了 {branchMemories.length} 条记忆与经验。
              </p>
            </div>

            <div className="nl-tree-memories-list-stream">
              {branchMemories.map((m) => (
                <div
                  key={m.id}
                  className="nl-tree-memory-card"
                  onClick={() => setSelectedMemoryDetail(m)}
                >
                  <span className="nl-tree-card-icon">💡</span>
                  <div className="nl-tree-card-main">
                    <div className="nl-tree-card-title">{m.title}</div>
                    <div className="nl-tree-card-date">
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <span className="nl-tree-mem-badge">记忆</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATE 4: 标签 (Screenshot 4) */}
        {selectedBranch === "tags_root" && (
          <div className="nl-tree-branch-panel">
            <div className="nl-tree-panel-header">
              <div className="nl-tree-panel-breadcrumb">🗂️ 记忆</div>
              <h1 className="nl-tree-panel-title">标签</h1>
              <p className="nl-tree-panel-desc">
                标签是你自己的归纳方式。这里把最常用的概念放在最容易抵达的位置。
              </p>
            </div>

            <div className="nl-tree-tags-grid-section">
              <div className="nl-tree-list-subheading">最常用</div>
              <div className="nl-tags-2col-grid">
                {sortedTags.map(([tag, count]) => (
                  <div
                    key={tag}
                    className="nl-tag-overview-card"
                    onClick={() => {
                      setSelectedTag(tag);
                      setSelectedBranch("tag_item");
                    }}
                  >
                    <div className="nl-tag-card-header">
                      <span className="nl-tag-icon">🏷️</span>
                      <span className="nl-tag-name">{tag}</span>
                    </div>
                    <div className="nl-tag-card-desc">按这个标签聚合的记忆。</div>
                    <div className="nl-tag-card-count">{count} memories</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STATE 5: 具体某个标签 (Selected Tag View) */}
        {selectedBranch === "tag_item" && (
          <div className="nl-tree-branch-panel">
            <div className="nl-tree-panel-header">
              <div className="nl-tree-panel-breadcrumb">
                <span
                  className="nl-crumb-link"
                  onClick={() => setSelectedBranch("tags_root")}
                >
                  🗂️ 记忆 / 标签
                </span>
              </div>
              <h1 className="nl-tree-panel-title">🏷️ #{selectedTag}</h1>
              <p className="nl-tree-panel-desc">
                包含 #{selectedTag} 标签的全部长期记忆（共 {branchMemories.length} 条）。
              </p>
            </div>

            <div className="nl-tree-memories-list-stream">
              {branchMemories.map((m) => (
                <div
                  key={m.id}
                  className="nl-tree-memory-card"
                  onClick={() => setSelectedMemoryDetail(m)}
                >
                  <span className="nl-tree-card-icon">💡</span>
                  <div className="nl-tree-card-main">
                    <div className="nl-tree-card-title">{m.title}</div>
                    <div className="nl-tree-card-date">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="nl-tree-mem-badge">记忆</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATE 6: 结晶 (Crystals) */}
        {selectedBranch === "crystals" && (
          <div className="nl-tree-branch-panel">
            <div className="nl-tree-panel-header">
              <div className="nl-tree-panel-breadcrumb">🗂️ 记忆</div>
              <h1 className="nl-tree-panel-title">💎 知识结晶</h1>
              <p className="nl-tree-panel-desc">
                提炼的高价值核心决策与架构经验（重要度 Critical / High）。
              </p>
            </div>

            <div className="nl-tree-memories-list-stream">
              {branchMemories.map((m) => (
                <div
                  key={m.id}
                  className="nl-tree-memory-card"
                  onClick={() => setSelectedMemoryDetail(m)}
                >
                  <span className="nl-tree-card-icon">💎</span>
                  <div className="nl-tree-card-main">
                    <div className="nl-tree-card-title">{m.title}</div>
                    <div className="nl-tree-card-date">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="nl-tree-mem-badge">结晶</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATE 7: 按类型与具体类型 (Screenshot 5) */}
        {(selectedBranch === "by_type_root" || selectedBranch === "type_item") && (
          <div className="nl-tree-branch-panel">
            <div className="nl-tree-panel-header">
              <div className="nl-tree-panel-breadcrumb">🗂️ 记忆</div>
              <h1 className="nl-tree-panel-title">
                {selectedType
                  ? unitTypeDefinitions.find((u) => u.key === selectedType)?.name || selectedType
                  : "按类型分类"}
              </h1>
              <p className="nl-tree-panel-desc">
                {selectedType
                  ? unitTypeDefinitions.find((u) => u.key === selectedType)?.desc || "所有被记录的分类记忆。"
                  : "按 8 大认知类型（事实、偏好、决策、计划、流程、学习、上下文、事件）组织。"}
              </p>
            </div>

            {branchMemories.length === 0 ? (
              <div className="nl-tree-empty-state">
                <div className="nl-tree-empty-icon">📅</div>
                <h2 className="nl-tree-empty-title">
                  还没有{selectedType ? unitTypeDefinitions.find((u) => u.key === selectedType)?.name : "此类型"}记录
                </h2>
                <p className="nl-tree-empty-sub">
                  通过会话提炼或快速捕获沉淀更多此类知识。
                </p>
              </div>
            ) : (
              <div className="nl-tree-memories-list-stream">
                {branchMemories.map((m) => (
                  <div
                    key={m.id}
                    className="nl-tree-memory-card"
                    onClick={() => setSelectedMemoryDetail(m)}
                  >
                    <span className="nl-tree-card-icon">💡</span>
                    <div className="nl-tree-card-main">
                      <div className="nl-tree-card-title">{m.title}</div>
                      <div className="nl-tree-card-date">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="nl-tree-mem-badge">记忆</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Other Root Branches Shortcuts */}
        {selectedBranch === "working_memory" && (
          <div className="nl-tree-branch-panel">
            <div className="nl-tree-panel-header">
              <div className="nl-tree-panel-breadcrumb">🗂️ 工作记录</div>
              <h1 className="nl-tree-panel-title">📑 每日工作简报</h1>
              <p className="nl-tree-panel-desc">跨会话注入的即时工作态势与焦点领域。</p>
            </div>
            <button
              className="nl-btn-primary"
              onClick={() => onNavigateTab && onNavigateTab("timeline")}
            >
              前往时间线查看
            </button>
          </div>
        )}

        {selectedBranch === "threads" && (
          <div className="nl-tree-branch-panel">
            <div className="nl-tree-panel-header">
              <div className="nl-tree-panel-breadcrumb">🗂️ 会话</div>
              <h1 className="nl-tree-panel-title">💬 保存的会话记录</h1>
              <p className="nl-tree-panel-desc">来自 Gemini、ChatGPT、Claude 与 Antigravity 的全量对话。</p>
            </div>
            <button
              className="nl-btn-primary"
              onClick={() => onNavigateTab && onNavigateTab("threads")}
            >
              前往会话记录列表
            </button>
          </div>
        )}

        {/* Selected Memory Quick Modal / Drawer */}
        {selectedMemoryDetail && (
          <div
            className="nl-modal-backdrop"
            onClick={() => setSelectedMemoryDetail(null)}
          >
            <div
              className="nl-modal-card"
              style={{ maxWidth: "680px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="nl-modal-header">
                <h2>{selectedMemoryDetail.title}</h2>
                <button
                  className="nl-close-btn"
                  onClick={() => setSelectedMemoryDetail(null)}
                >
                  ✕
                </button>
              </div>
              <div className="nl-modal-body" style={{ padding: "16px 20px" }}>
                <pre className="nl-markdown-pre" style={{ maxHeight: "360px" }}>
                  {selectedMemoryDetail.content}
                </pre>
                <div style={{ display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
                  {(selectedMemoryDetail.tags || []).map((t) => (
                    <span key={t} className="nl-detail-tag-chip">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
