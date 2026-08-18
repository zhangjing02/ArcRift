import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import type { GraphData, GraphNode } from "../../types";
import { getGraphData, fetchMemories } from "../../api/ArcRift";
import {
  IconSearch,
  IconSparkles,
  IconMaximize,
  IconRefresh,
  IconLink,
  IconSettings,
  IconLibrary,
  IconLayers,
  IconTarget,
  IconPointer,
  IconSidebarToggle,
} from "./Icons";

interface NowledgeGraphViewProps {
  sessionId?: string;
}

export const NowledgeGraphView: React.FC<NowledgeGraphViewProps> = ({
  sessionId,
}) => {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSpeed, setSearchSpeed] = useState<"smart" | "fast">("smart");
  const [depthScope, setDepthScope] = useState(1);
  const [viewDimension, setViewDimension] = useState<"2D" | "3D">("2D");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeTab, setActiveTab] = useState<"explore" | "details" | "ontology" | "maintain">("explore");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showCommunities, setShowCommunities] = useState(true);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [recentMemories, setRecentMemories] = useState<string[]>([]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomBehaviorRef = useRef<any>(null);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);

  useEffect(() => {
    loadGraph();
  }, [sessionId]);

  const loadGraph = async () => {
    try {
      const g = await getGraphData(sessionId);
      if (g && g.nodes) {
        setData(g as GraphData);
        if (g.nodes.length > 0) {
          setSelectedNode((prev) => {
            if (prev) {
              const found = g.nodes.find((n: any) => n.id === prev.id);
              if (found) return found;
            }
            return g.nodes[0];
          });
        }
      }
      const mRes = await fetchMemories({ sessionId });
      if (mRes && mRes.memories) {
        setRecentMemories(mRes.memories.map((m) => m.title));
      }
    } catch (err) {
      console.error("Failed to load graph data", err);
    }
  };

  // Filtered nodes & links based on search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    const matchedNodeIds = new Set(
      data.nodes
        .filter((n: GraphNode) => n.id.toLowerCase().includes(q) || (n.type && n.type.toLowerCase().includes(q)))
        .map((n: GraphNode) => n.id)
    );

    const links = data.links.filter(
      (l: any) =>
        matchedNodeIds.has(typeof l.source === "object" ? (l.source as any).id : l.source) ||
        matchedNodeIds.has(typeof l.target === "object" ? (l.target as any).id : l.target)
    );

    return { nodes: data.nodes.filter((n: GraphNode) => matchedNodeIds.has(n.id)), links };
  }, [data, searchQuery]);

  const getNodeColor = (type: string = "") => {
    switch (type.toLowerCase()) {
      case "entity":
      case "concept":
        return "#a855f7"; // 🟣 实体
      case "memory":
      case "decision":
        return "#0284c7"; // 🔵 记忆
      case "document":
      case "file":
      case "tech":
        return "#10b981"; // 🟢 资料 / 技术
      case "chat":
      case "session":
        return "#f97316"; // 🟠 对话
      case "skill":
      case "rule":
      case "architecture":
        return "#ef4444"; // 🔴 技能 / 架构
      default:
        return "#0284c7";
    }
  };

  // Find neighbor entities for selectedNode
  const neighbors = useMemo(() => {
    if (!selectedNode) return [];
    const set = new Set<string>();
    data.links.forEach((l: any) => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      if (src === selectedNode.id) set.add(tgt);
      if (tgt === selectedNode.id) set.add(src);
    });
    return Array.from(set);
  }, [selectedNode, data.links]);

  // 1. STABLE D3 FORCE SIMULATION (Only runs when filteredData changes - NEVER restarts on node click!)
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 560;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", [0, 0, width, height] as any);

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    if (filteredData.nodes.length === 0) return;

    const nodes: any[] = filteredData.nodes.map((d: any) => ({ ...d }));
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const validLinks: any[] = filteredData.links
      .filter((l: any) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        return nodeIds.has(src) && nodeIds.has(tgt);
      })
      .map((d: any) => ({ ...d }));

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(validLinks).id((d: any) => d.id).distance(125))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));

    simulationRef.current = simulation;

    // Defs
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "node-glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Links
    const link = g
      .append("g")
      .attr("stroke", "rgba(148, 163, 184, 0.2)")
      .attr("stroke-width", 1.5)
      .selectAll("line")
      .data(validLinks)
      .join("line");

    // Link Labels
    const linkText = g
      .append("g")
      .selectAll("text")
      .data(validLinks)
      .join("text")
      .attr("font-size", "10px")
      .attr("fill", "#64748b")
      .attr("text-anchor", "middle")
      .text((d: any) => d.relation || "");

    // Nodes Group
    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "graph-node-group")
      .call(
        d3
          .drag<any, any>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on("click", (e, d) => {
        e.stopPropagation();
        setSelectedNode(d);
      });

    // Outer Halo
    node
      .append("circle")
      .attr("class", "graph-node-halo")
      .attr("r", 18)
      .attr("fill", (d: any) => getNodeColor(d.type))
      .attr("opacity", 0.12);

    // Main Circle
    node
      .append("circle")
      .attr("class", "graph-node-circle")
      .attr("r", 12)
      .attr("fill", (d: any) => getNodeColor(d.type))
      .attr("stroke", "rgba(255,255,255,0.85)")
      .attr("stroke-width", 1.5)
      .attr("filter", "url(#node-glow)")
      .attr("cursor", "pointer");

    // Node Labels
    node
      .append("text")
      .attr("class", "graph-node-label")
      .attr("dx", 16)
      .attr("dy", 4)
      .attr("fill", "#f8fafc")
      .attr("font-size", "11.5px")
      .attr("font-weight", "500")
      .text((d: any) => d.id);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkText
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [filteredData]);

  // 2. LIGHTWEIGHT SELECTION HIGHLIGHT (Zero physics restart!)
  useEffect(() => {
    if (!svgRef.current || !selectedNode) return;
    const svg = d3.select(svgRef.current);
    svg
      .selectAll(".graph-node-halo")
      .transition()
      .duration(150)
      .attr("r", (d: any) => (d.id === selectedNode.id ? 26 : 18))
      .attr("opacity", (d: any) => (d.id === selectedNode.id ? 0.35 : 0.12));

    svg
      .selectAll(".graph-node-circle")
      .transition()
      .duration(150)
      .attr("stroke", (d: any) => (d.id === selectedNode.id ? "#38bdf8" : "rgba(255,255,255,0.85)"))
      .attr("stroke-width", (d: any) => (d.id === selectedNode.id ? 2.5 : 1.5));
  }, [selectedNode]);

  const handleFitCanvas = () => {
    if (!svgRef.current || !zoomBehaviorRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 560;
    const svg = d3.select(svgRef.current);
    svg
      .transition()
      .duration(300)
      .call(
        zoomBehaviorRef.current.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(1).translate(-width / 2, -height / 2)
      );
  };

  const handleAskQuestion = (question: string) => {
    setAiPrompt(question);
    setIsAsking(true);
    setTimeout(() => {
      const activeName = selectedNode ? selectedNode.id : "知识图谱";
      setAiAnswer(
        `关于「${activeName}」的图谱深度洞察：当前图谱中已连接 ${data.nodes.length} 个实体与 ${data.links.length} 条关系。核心语义关联包括架构规范、关键事件流转机制以及全局记忆沉淀。`
      );
      setIsAsking(false);
    }, 500);
  };

  const activeEntityName = selectedNode
    ? selectedNode.id
    : recentMemories[0] || "ChronosMind";

  const secondaryEntityName = neighbors[0] || recentMemories[1] || "BeBeBus";
  const activeColor = getNodeColor(selectedNode?.type || "");

  return (
    <div className="nl-graph-view-container">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP SEARCH & SCOPE TOOLBAR (1:1 with Nowledge Mem)
      ───────────────────────────────────────────────────────────── */}
      <div className="nl-graph-top-bar">
        <div className="nl-graph-search-container">
          <div className="nl-graph-search-input-wrap">
            <IconSearch size={14} className="nl-graph-search-magnifier" />
            <input
              type="text"
              placeholder="搜索实体、主题或问题..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="nl-graph-search-field"
            />
          </div>

          <div className="nl-graph-search-controls">
            <div className="nl-graph-mode-pills">
              <button
                className={`nl-graph-mode-btn ${searchSpeed === "smart" ? "active" : ""}`}
                onClick={() => setSearchSpeed("smart")}
              >
                智能
              </button>
              <button
                className={`nl-graph-mode-btn ${searchSpeed === "fast" ? "active" : ""}`}
                onClick={() => setSearchSpeed("fast")}
              >
                快捷
              </button>
            </div>

            <div className="nl-graph-scope-group">
              <span className="nl-scope-sparkle">✦ 范围</span>
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  className={`nl-scope-num-btn ${depthScope === lvl ? "active" : ""}`}
                  onClick={() => setDepthScope(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <button className="nl-graph-search-submit-btn" title="执行图谱检索">
              <IconSearch size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN GRAPH BODY (Left Canvas + Right Inspector)
      ───────────────────────────────────────────────────────────── */}
      <div className="nl-graph-split-body">
        {/* LEFT PANE: Graph Canvas Box */}
        <div className="nl-graph-canvas-box" ref={containerRef}>
          {/* Top Canvas Toolbar Capsule (1:1 Match with Screenshot Tooltips) */}
          <div className="nl-canvas-floating-header">
            {/* Left Tools: Overview/Explore + 2D/3D */}
            <div className="nl-canvas-capsule-left">
              <button className="nl-canvas-icon-btn active" title="总览 / 探索模式">
                <IconSparkles size={13} />
              </button>
              <div className="nl-canvas-dim-pills">
                <button
                  className={`nl-dim-pill ${viewDimension === "2D" ? "active" : ""}`}
                  onClick={() => setViewDimension("2D")}
                >
                  2D
                </button>
                <button
                  className={`nl-dim-pill ${viewDimension === "3D" ? "active" : ""}`}
                  onClick={() => setViewDimension("3D")}
                >
                  3D
                </button>
              </div>
            </div>

            {/* Right Tools Group: Community, Fit, Pointer, Link, Refresh, Fullscreen, Sidebar */}
            <div className="nl-canvas-capsule-right">
              <button
                className={`nl-canvas-icon-btn ${showCommunities ? "purple-glow" : ""}`}
                onClick={() => setShowCommunities(!showCommunities)}
                title="隐藏/显示社区气泡 C"
              >
                <IconLayers size={13} />
              </button>
              <button className="nl-canvas-icon-btn" onClick={handleFitCanvas} title="将图谱适配到画布 F">
                <IconTarget size={13} />
              </button>
              <button className="nl-canvas-icon-btn" title="指针选择模式">
                <IconPointer size={13} />
              </button>
              <button className="nl-canvas-icon-btn" title="显示关系拓扑">
                <IconLink size={13} />
              </button>
              <button className="nl-canvas-icon-btn" title="重新布局 / 刷新" onClick={() => loadGraph()}>
                <IconRefresh size={13} />
              </button>
              <button className="nl-canvas-icon-btn" title="全屏查看">
                <IconMaximize size={13} />
              </button>
              <div className="nl-canvas-v-sep" />
              <button
                className="nl-canvas-icon-btn"
                title="收起/展开右侧面板"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <IconSidebarToggle size={13} />
              </button>
            </div>
          </div>

          {/* D3 SVG Canvas */}
          <svg ref={svgRef} className="nl-graph-d3-canvas"></svg>

          {/* Bottom Floating Bar inside Canvas */}
          <div className="nl-canvas-bottom-bar">
            <div className="nl-canvas-bottom-legend">
              <span className="nl-legend-pill">
                <span className="nl-legend-dot-purple" /> 实体
              </span>
              <span className="nl-legend-counter">{filteredData.nodes.length}</span>
              <span className="nl-legend-counter">{filteredData.links.length}</span>
            </div>

            <div className="nl-canvas-bottom-actions">
              <button className="nl-floating-action-btn">
                <IconSparkles size={12} style={{ marginRight: 4 }} />
                发现
              </button>
              <button className="nl-floating-action-btn" onClick={handleFitCanvas}>
                <IconMaximize size={12} style={{ marginRight: 4 }} />
                Expand
              </button>
              <button className="nl-floating-action-btn highlight" onClick={() => setIsSidebarOpen(true)}>
                <IconSparkles size={12} style={{ marginRight: 4 }} />
                探查
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Knowledge Inspector & Q&A Exploration */}
        {isSidebarOpen && (
          <div className="nl-graph-inspector-panel">
            {/* Top Inspector Tabs */}
            <div className="nl-inspector-tabs-header">
              <button
                className={`nl-inspector-tab-btn ${activeTab === "explore" ? "active" : ""}`}
                onClick={() => setActiveTab("explore")}
              >
                <IconSparkles size={13} className="nl-tab-icon" />
                <span>探查</span>
              </button>
              <button
                className={`nl-inspector-tab-btn ${activeTab === "details" ? "active" : ""}`}
                onClick={() => setActiveTab("details")}
              >
                <IconLibrary size={13} className="nl-tab-icon" />
                <span>详情</span>
              </button>
              <button
                className={`nl-inspector-tab-btn ${activeTab === "ontology" ? "active" : ""}`}
                onClick={() => setActiveTab("ontology")}
              >
                <IconSettings size={13} className="nl-tab-icon" />
                <span>本体</span>
              </button>
              <button
                className={`nl-inspector-tab-btn ${activeTab === "maintain" ? "active" : ""}`}
                onClick={() => setActiveTab("maintain")}
              >
                <IconRefresh size={13} className="nl-tab-icon" />
                <span>图谱维护</span>
              </button>
            </div>

            {/* Inspector Content Body */}
            <div className="nl-inspector-content-scroll">
              {/* Top Center Entity Visual Disk & Reactive Title */}
              <div className="nl-inspector-entity-hero">
                <div className="nl-entity-circle-disk" style={{ backgroundColor: activeColor }}>
                  <div className="nl-entity-inner-circle" />
                </div>
                <h2 className="nl-entity-hero-title" title={activeEntityName}>
                  {activeEntityName}
                </h2>
                {selectedNode?.type && (
                  <span className="nl-entity-type-badge">{selectedNode.type}</span>
                )}
              </div>

              {/* Questions Stream / Q&A Prompt List (Dynamically targets activeEntityName!) */}
              <div className="nl-graph-questions-list">
                <div
                  className="nl-question-card-item"
                  onClick={() =>
                    handleAskQuestion(`关于 "${activeEntityName}" 我了解什么？`)
                  }
                >
                  关于 "{activeEntityName}" 我了解什么？
                </div>

                <div
                  className="nl-question-card-item"
                  onClick={() =>
                    handleAskQuestion(`什么是 "${activeEntityName}"？`)
                  }
                >
                  什么是 "{activeEntityName}"？
                </div>

                <div
                  className="nl-question-card-item"
                  onClick={() =>
                    handleAskQuestion(`我应该在何时使用 "${activeEntityName}"？`)
                  }
                >
                  我应该在何时使用 "{activeEntityName}"？
                </div>

                <div
                  className="nl-question-card-item"
                  onClick={() =>
                    handleAskQuestion(`围绕 "${activeEntityName}" 还有什么？`)
                  }
                >
                  围绕 "{activeEntityName}" 还有什么？
                </div>

                <div
                  className="nl-question-card-item"
                  onClick={() =>
                    handleAskQuestion(`关于 "${secondaryEntityName}" 我了解什么？`)
                  }
                >
                  关于 "{secondaryEntityName}" 我了解什么？
                </div>
              </div>

              {/* AI Graph Insight Answer Card */}
              {aiAnswer && (
                <div className="nl-graph-ai-insight-box">
                  <div className="nl-insight-header">
                    <IconSparkles size={13} style={{ color: "#38bdf8" }} />
                    <span>图谱智能分析</span>
                  </div>
                  <p className="nl-insight-body">{aiAnswer}</p>
                </div>
              )}
            </div>

            {/* Bottom AI Question Input */}
            <div className="nl-graph-ask-bar">
              <input
                type="text"
                placeholder="问一下你的知识图谱..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && aiPrompt.trim()) {
                    handleAskQuestion(aiPrompt);
                  }
                }}
                className="nl-graph-ask-input"
              />
              <button
                className="nl-graph-ask-btn"
                disabled={!aiPrompt.trim() || isAsking}
                onClick={() => handleAskQuestion(aiPrompt)}
              >
                {isAsking ? "..." : "↑"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
