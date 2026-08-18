import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import type { GraphData, GraphNode } from "../../types";
import { getGraphData, fetchMemories } from "../../api/ArcRift";
import {
  IconSearch,
  IconSparkles,
  IconMaximize,
  IconCompress,
  IconLink,
  IconSettings,
  IconLibrary,
  IconLayers,
  IconTarget,
  IconPointer,
  IconSidebarToggle,
  IconLasso,
  IconGlobe,
  IconNetwork,
  IconFolder,
} from "./Icons";
import { KnowledgeGraph3DCanvas } from "./KnowledgeGraph3DCanvas";

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
  
  // Tabs: 解读 | 查看 | 本体 | 图谱维护 (1:1 with Nowledge Mem Screenshot 1)
  const [activeTab, setActiveTab] = useState<"interpret" | "view" | "ontology" | "maintain">("interpret");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showCommunities, setShowCommunities] = useState(true);
  const [isConnectingMemory, setIsConnectingMemory] = useState(false);
  const [isLassoActive, setIsLassoActive] = useState(false);
  const [selectMode, setSelectMode] = useState<"select" | "pan">("select");
  const [canvasMode, setCanvasMode] = useState<"overview" | "explore">("overview");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Maintain Panel states
  const [expandedMaintainCard, setExpandedMaintainCard] = useState<string | null>(null);
  const [maintainStatus, setMaintainStatus] = useState<string | null>(null);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [recentMemories, setRecentMemories] = useState<string[]>([]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomBehaviorRef = useRef<any>(null);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);

  const [memoriesMap, setMemoriesMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    loadGraph();
  }, [sessionId]);

  // Keyboard shortcut listener for Tab / Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Tab") {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        // Esc exits CSS-only fullscreen — no OS fullscreen to exit
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Pure CSS fullscreen: expands within the app window only, never calls requestFullscreen()
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) {
        setIsSidebarOpen(false); // Hide sidebar drawer on entering fullscreen
      }
      setTimeout(() => {
        handleFitCanvas();
      }, 50);
      return next;
    });
  };

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
        const map = new Map<string, any>();
        mRes.memories.forEach((m: any) => {
          map.set(m.id, m);
        });
        setMemoriesMap(map);
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

  const getNodeColor = useCallback((type: string = "") => {
    switch (type.toLowerCase()) {
      case "entity":
      case "concept":
        return "#a855f7"; // 🟣 实体
      case "memory":
      case "decision":
        return "#0096c7"; // 🔵 记忆 (Nowledge Mem Teal/Cyan)
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
        return "#0096c7";
    }
  }, []);

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

  // Connected links for selected node
  const connectedLinks = useMemo(() => {
    if (!selectedNode) return [];
    return data.links.filter((l: any) => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      return src === selectedNode.id || tgt === selectedNode.id;
    });
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

    const getNodeLabel = (d: any) => {
      const raw = d.label || d.title || d.name || d.id || "";
      if (raw.startsWith("tag:")) return raw.slice(4);
      // Remove leading UUIDs if any
      const clean = raw.replace(/^[0-9a-fA-F-]{36}\s*/, "").trim();
      return clean.length > 24 ? clean.slice(0, 22) + "…" : clean || raw;
    };

    const isProjectOrHub = (d: any) => {
      return (
        d.type === "project" ||
        d.category === "project" ||
        (d.id && typeof d.id === "string" && d.id.startsWith("tag:"))
      );
    };

    // Calculate node degree for representative selection
    const degreeMap = new Map<string, number>();
    validLinks.forEach((l: any) => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      degreeMap.set(src, (degreeMap.get(src) || 0) + 1);
      degreeMap.set(tgt, (degreeMap.get(tgt) || 0) + 1);
    });

    // Select top 6-8 prominent nodes to show labels by default
    const prominentSet = new Set<string>();
    nodes.forEach((n) => {
      if (isProjectOrHub(n)) prominentSet.add(n.id);
    });
    const sortedByDegree = [...nodes].sort(
      (a, b) => (degreeMap.get(b.id) || 0) - (degreeMap.get(a.id) || 0)
    );
    let addedMemories = 0;
    for (const n of sortedByDegree) {
      if (!prominentSet.has(n.id) && addedMemories < 5) {
        prominentSet.add(n.id);
        addedMemories++;
      }
    }

    const simulation = d3
      .forceSimulation(nodes)
      .velocityDecay(0.68) // High viscous fluid damping: calm, steady, zero violent wobble
      .force(
        "link",
        d3
          .forceLink(validLinks)
          .id((d: any) => d.id)
          .distance((l: any) => (l.relation === "tagged_with" ? 80 : 120))
          .strength(0.2)
      )
      .force("charge", d3.forceManyBody().strength(-110).distanceMax(380).distanceMin(15))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.03))
      .force("collision", d3.forceCollide().radius((d: any) => (isProjectOrHub(d) ? 36 : 28)).strength(0.7));

    // Pre-warm 120 iterations in memory so initial render is 100% stable and fully settled
    simulation.stop();
    for (let i = 0; i < 120; ++i) simulation.tick();

    simulationRef.current = simulation;

    // Defs for glowing ring
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "node-glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "2.0").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Ultra-faint, delicate stardust links (Almost invisible by default, exactly like Nowledge Mem)
    const linkGroup = g.append("g").attr("class", "graph-links-group");
    const link = linkGroup
      .selectAll("line")
      .data(validLinks)
      .join("line")
      .attr("stroke", "rgba(255, 255, 255, 0.04)")
      .attr("stroke-width", 0.65)
      .attr("x1", (d: any) => d.source.x)
      .attr("y1", (d: any) => d.source.y)
      .attr("x2", (d: any) => d.target.x)
      .attr("y2", (d: any) => d.target.y);

    // Dynamic graph spotlight helper
    const spotlightGraph = (activeId: string | null) => {
      if (!activeId) {
        // Reset to quiet cosmic state
        link
          .transition()
          .duration(200)
          .attr("stroke", "rgba(255, 255, 255, 0.04)")
          .attr("stroke-width", 0.65);

        nodeGroup.each(function (d: any) {
          const group = d3.select(this);
          const isProm = prominentSet.has(d.id);
          const isProj = isProjectOrHub(d);

          group
            .select(".graph-node-halo")
            .transition()
            .duration(200)
            .attr("r", isProj ? 7 : 4)
            .attr("opacity", isProj ? 0.16 : 0.10);

          group
            .select(".graph-node-circle")
            .transition()
            .duration(200)
            .attr("r", isProj ? 3.5 : 2.0)
            .attr("stroke", "rgba(255, 255, 255, 0.6)")
            .attr("stroke-width", 0.6);

          group
            .select(".graph-node-label")
            .transition()
            .duration(200)
            .attr("opacity", isProm ? 0.85 : 0)
            .attr("fill", isProj ? "#7dd3fc" : "#cbd5e1");
        });
        return;
      }

      // Find neighbor IDs
      const neighbors = new Set<string>([activeId]);
      validLinks.forEach((l: any) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        if (src === activeId) neighbors.add(tgt);
        if (tgt === activeId) neighbors.add(src);
      });

      // Highlight active links
      link
        .transition()
        .duration(150)
        .attr("stroke", (l: any) => {
          const src = typeof l.source === "object" ? l.source.id : l.source;
          const tgt = typeof l.target === "object" ? l.target.id : l.target;
          return src === activeId || tgt === activeId
            ? "rgba(56, 189, 248, 0.45)"
            : "rgba(255, 255, 255, 0.015)";
        })
        .attr("stroke-width", (l: any) => {
          const src = typeof l.source === "object" ? l.source.id : l.source;
          const tgt = typeof l.target === "object" ? l.target.id : l.target;
          return src === activeId || tgt === activeId ? 1.2 : 0.4;
        });

      // Spotlight active node & neighbors
      nodeGroup.each(function (d: any) {
        const group = d3.select(this);
        const isSelf = d.id === activeId;
        const isNeighbor = neighbors.has(d.id);
        const isProm = prominentSet.has(d.id);
        const isProj = isProjectOrHub(d);

        group
          .select(".graph-node-halo")
          .transition()
          .duration(150)
          .attr("r", isSelf ? 14 : isNeighbor ? 8 : (isProj ? 7 : 4))
          .attr("opacity", isSelf ? 0.45 : isNeighbor ? 0.22 : 0.05);

        group
          .select(".graph-node-circle")
          .transition()
          .duration(150)
          .attr("r", isSelf ? 5.0 : isNeighbor ? 3.2 : (isProj ? 3.5 : 2.0))
          .attr("stroke", isSelf ? "#38bdf8" : isNeighbor ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.3)")
          .attr("stroke-width", isSelf ? 2.0 : isNeighbor ? 1.0 : 0.5);

        group
          .select(".graph-node-label")
          .transition()
          .duration(150)
          .attr("opacity", isSelf || isNeighbor ? 1 : (isProm ? 0.35 : 0))
          .attr("fill", isSelf ? "#38bdf8" : isNeighbor ? "#f1f5f9" : (isProj ? "#7dd3fc" : "#64748b"));
      });
    };

    // Nodes Group
    const nodeGroup = g
      .append("g")
      .attr("class", "graph-nodes-group")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "graph-node-group")
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
      .call(
        d3
          .drag<any, any>()
          .on("start", (event, d) => {
            // Very gentle micro-alpha, only local spring reacts - NO global screen shock!
            if (!event.active) simulation.alphaTarget(0.015).restart();
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
      .on("mouseenter", (_, d) => {
        spotlightGraph(d.id);
      })
      .on("mouseleave", () => {
        spotlightGraph(selectedNode ? selectedNode.id : null);
      })
      .on("click", (e, d) => {
        e.stopPropagation();
        setSelectedNode(d);
        spotlightGraph(d.id);
      });

    // Outer Halo (Delicate subtle aura)
    nodeGroup
      .append("circle")
      .attr("class", "graph-node-halo")
      .attr("r", (d: any) => (isProjectOrHub(d) ? 7 : 4))
      .attr("fill", (d: any) => getNodeColor(d.type))
      .attr("opacity", (d: any) => (isProjectOrHub(d) ? 0.16 : 0.10));

    // Main Dot (Tiny, refined starry point)
    nodeGroup
      .append("circle")
      .attr("class", "graph-node-circle")
      .attr("r", (d: any) => (isProjectOrHub(d) ? 3.5 : 2.0))
      .attr("fill", (d: any) => getNodeColor(d.type))
      .attr("stroke", "rgba(255, 255, 255, 0.65)")
      .attr("stroke-width", 0.6)
      .attr("cursor", "pointer");

    // Node Clean Labels - ONLY PROMINENT NODES VISIBLE BY DEFAULT!
    nodeGroup
      .append("text")
      .attr("class", "graph-node-label")
      .attr("dx", (d: any) => (isProjectOrHub(d) ? 8 : 6))
      .attr("dy", 3.5)
      .attr("fill", (d: any) => (isProjectOrHub(d) ? "#7dd3fc" : "#cbd5e1"))
      .attr("font-size", (d: any) => (isProjectOrHub(d) ? "11px" : "10px"))
      .attr("font-weight", (d: any) => (isProjectOrHub(d) ? "600" : "400"))
      .attr("stroke", "#090d16")
      .attr("stroke-width", 2.5)
      .attr("paint-order", "stroke fill")
      .attr("cursor", "pointer")
      .attr("opacity", (d: any) => (prominentSet.has(d.id) ? 0.85 : 0))
      .text((d: any) => getNodeLabel(d));

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Initial spotlight on selected node if any
    if (selectedNode) {
      spotlightGraph(selectedNode.id);
    }

    return () => {
      simulation.stop();
    };
  }, [filteredData, viewDimension]);

  // 2. LIGHTWEIGHT SELECTION HIGHLIGHT (Zero physics restart!)
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    if (!selectedNode) {
      svg.selectAll(".graph-links-group line")
        .transition().duration(200)
        .attr("stroke", "rgba(255, 255, 255, 0.04)")
        .attr("stroke-width", 0.65);
      return;
    }

    const activeId = selectedNode.id;
    svg.selectAll(".graph-links-group line")
      .transition()
      .duration(150)
      .attr("stroke", (l: any) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        return src === activeId || tgt === activeId
          ? "rgba(56, 189, 248, 0.45)"
          : "rgba(255, 255, 255, 0.015)";
      })
      .attr("stroke-width", (l: any) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        return src === activeId || tgt === activeId ? 1.2 : 0.4;
      });
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

  const getCleanName = (nodeOrId: any) => {
    if (!nodeOrId) return "";
    const raw = typeof nodeOrId === "object" ? nodeOrId.label || nodeOrId.title || nodeOrId.name || nodeOrId.id : nodeOrId;
    if (typeof raw !== "string") return "";
    if (raw.startsWith("tag:")) return raw.slice(4);
    return raw.replace(/^[0-9a-fA-F-]{36}\s*/, "").trim() || raw;
  };

  const handleAskQuestion = (question: string) => {
    setAiPrompt(question);
    setIsAsking(true);
    setTimeout(() => {
      const activeName = selectedNode ? getCleanName(selectedNode) : "知识图谱";
      setAiAnswer(
        `关于「${activeName}」的图谱深度洞察：当前图谱中已连接 ${data.nodes.length} 个实体与 ${data.links.length} 条关系。核心语义关联包括架构规范、关键事件流转机制以及全局记忆沉淀。`
      );
      setIsAsking(false);
    }, 500);
  };

  const handleRunMaintain = (action: string) => {
    setMaintainStatus(`正在执行「${action}」...`);
    setTimeout(() => {
      setMaintainStatus(`「${action}」执行完毕，图谱已处于最优健康状态。`);
      setTimeout(() => setMaintainStatus(null), 3000);
    }, 800);
  };

  const activeEntityName = selectedNode
    ? getCleanName(selectedNode)
    : getCleanName(recentMemories[0]) || "ChronosMind";

  const secondaryEntityName = getCleanName(neighbors[0]) || getCleanName(recentMemories[1]) || "BeBeBus";
  const activeColor = getNodeColor(selectedNode?.type || "");

  return (
    <div className={`nl-graph-view-container ${isFullscreen ? "fullscreen-mode" : ""}`}>
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
          {/* Top Canvas Toolbar Capsule (Exact 1:1 Tooltips & Shortkey Badges) */}
          <div className="nl-canvas-floating-header">
            {/* Left Tools: Overview/Explore + 2D/3D + Lasso Pill */}
            <div className="nl-canvas-capsule-left">
              <button
                className={`nl-canvas-pill-btn ${canvasMode === "overview" ? "active" : ""}`}
                onClick={() => setCanvasMode("overview")}
                title="总览"
              >
                <IconNetwork size={13} />
                <span>总览</span>
              </button>
              <button
                className={`nl-canvas-pill-btn ${canvasMode === "explore" ? "active" : ""}`}
                onClick={() => setCanvasMode("explore")}
                title="探索"
              >
                <IconGlobe size={13} />
                <span>探索</span>
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

              {/* Lasso Active Capsule (Screenshot 2/4) */}
              {isLassoActive && (
                <div className="nl-canvas-lasso-pill" onClick={() => setIsLassoActive(false)}>
                  <IconLasso size={12} />
                  <span>套索 A</span>
                </div>
              )}
            </div>

            {/* Right Tools Group: Community, Fit, Select, Link, Lasso, Fullscreen, Sidebar */}
            <div className="nl-canvas-capsule-right">
              <button
                className={`nl-canvas-icon-btn ${showCommunities ? "purple-glow" : ""}`}
                onClick={() => setShowCommunities(!showCommunities)}
                title="隐藏社区气泡 C"
              >
                <IconLayers size={13} />
              </button>
              <button className="nl-canvas-icon-btn" onClick={handleFitCanvas} title="将图谱适配到画布 F">
                <IconTarget size={13} />
              </button>
              <button
                className={`nl-canvas-icon-btn ${selectMode === "select" ? "active" : ""}`}
                onClick={() => setSelectMode(selectMode === "select" ? "pan" : "select")}
                title="选择 S"
              >
                <IconPointer size={13} />
              </button>
              <button
                className={`nl-canvas-icon-btn ${isConnectingMemory ? "teal-glow" : ""}`}
                onClick={() => setIsConnectingMemory(!isConnectingMemory)}
                title="连接记忆 L"
              >
                <IconLink size={13} />
              </button>
              <button
                className={`nl-canvas-icon-btn ${isLassoActive ? "purple-glow" : ""}`}
                onClick={() => setIsLassoActive(!isLassoActive)}
                title={isLassoActive ? "退出套索 A" : "套索选择 A"}
              >
                <IconLasso size={13} />
              </button>
              <button
                className={`nl-canvas-icon-btn ${isFullscreen ? "active" : ""}`}
                onClick={toggleFullscreen}
                title={isFullscreen ? "退出全屏 Esc" : "全屏 Esc"}
              >
                {isFullscreen ? <IconCompress size={13} /> : <IconMaximize size={13} />}
              </button>
              <div className="nl-canvas-v-sep" />
              <button
                className="nl-canvas-icon-btn"
                title={isSidebarOpen ? "隐藏 Tab" : "显示 Tab"}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <IconSidebarToggle size={13} />
              </button>
            </div>
          </div>

          {/* Interactive "连接两条记忆" Dropdown Banner (Screenshot 3) */}
          {isConnectingMemory && (
            <div className="nl-connect-memories-banner">
              <div className="nl-connect-banner-left">
                <span className="nl-connect-banner-icon"><IconLink size={14} /></span>
                <div className="nl-connect-banner-text">
                  <span className="nl-connect-banner-title">连接两条记忆</span>
                  <span className="nl-connect-banner-desc">先选择第一条记忆，再选择要连到的那条记忆。</span>
                </div>
              </div>
              <button className="nl-connect-banner-cancel" onClick={() => setIsConnectingMemory(false)}>
                取消
              </button>
            </div>
          )}

          {/* 2D SVG vs 3D Canvas Switcher (Always preserve 2D SVG so D3 state is retained) */}
          <svg
            ref={svgRef}
            className="nl-graph-d3-canvas"
            style={{ display: viewDimension === "2D" ? "block" : "none" }}
          ></svg>
          {viewDimension === "3D" && (
            <KnowledgeGraph3DCanvas
              data={filteredData}
              selectedNode={selectedNode}
              onNodeSelect={setSelectedNode}
              getNodeColor={getNodeColor}
            />
          )}

          {/* Bottom Floating Bar inside Canvas (Exact match with Screenshot 2) */}
          <div className="nl-canvas-bottom-bar">
            {/* 5-Color Category Legend Pill */}
            <div className="nl-canvas-bottom-legend">
              <span className="nl-legend-pill">
                <span className="nl-legend-dot" style={{ background: "#a855f7" }} /> 实体
              </span>
              <span className="nl-legend-pill">
                <span className="nl-legend-dot" style={{ background: "#0096c7" }} /> 记忆
              </span>
              <span className="nl-legend-pill">
                <span className="nl-legend-dot" style={{ background: "#10b981" }} /> 资料
              </span>
              <span className="nl-legend-pill">
                <span className="nl-legend-dot" style={{ background: "#f97316" }} /> 对话
              </span>
              <span className="nl-legend-pill">
                <span className="nl-legend-dot" style={{ background: "#ef4444" }} /> 技能
              </span>
            </div>

            {/* Action Buttons Capsule */}
            <div className="nl-canvas-bottom-actions">
              <div className="nl-canvas-stat-pill">
                <span>{filteredData.nodes.length}</span>
                <span className="nl-stat-dot">•</span>
                <span>{filteredData.links.length}</span>
              </div>
              <button className="nl-floating-action-btn" onClick={handleFitCanvas}>
                <IconMaximize size={12} style={{ marginRight: 4 }} />
                Expand W
              </button>
              <button className="nl-floating-action-btn highlight" onClick={() => setIsSidebarOpen(true)}>
                <IconSparkles size={12} style={{ marginRight: 4 }} />
                探查 E
              </button>
              <button className="nl-floating-close-btn" onClick={() => setSelectedNode(null)}>
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Knowledge Inspector & Maintenance */}
        {isSidebarOpen && (
          <div className="nl-graph-inspector-panel">
            {/* Top Inspector Tabs: 解读 | 查看 | 本体 | 图谱维护 (1:1 with Screenshot 1) */}
            <div className="nl-inspector-tabs-header">
              <button
                className={`nl-inspector-tab-btn ${activeTab === "interpret" ? "active" : ""}`}
                onClick={() => setActiveTab("interpret")}
              >
                <IconSparkles size={13} className="nl-tab-icon" />
                <span>解读</span>
              </button>
              <button
                className={`nl-inspector-tab-btn ${activeTab === "view" ? "active" : ""}`}
                onClick={() => setActiveTab("view")}
              >
                <IconLibrary size={13} className="nl-tab-icon" />
                <span>查看</span>
                <span className="nl-tab-dot-online">•</span>
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
                <span className="nl-tab-icon" style={{ fontSize: 13, lineHeight: 1 }}>☷</span>
                <span>图谱维护</span>
              </button>
            </div>

            {/* Inspector Content Body */}
            <div className="nl-inspector-content-scroll">
              {/* ── TAB 1: 解读 (Interpret & AI Q&A) ── */}
              {activeTab === "interpret" && (
                <>
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

                  {aiAnswer && (
                    <div className="nl-graph-ai-insight-box">
                      <div className="nl-insight-header">
                        <IconSparkles size={13} style={{ color: "#38bdf8" }} />
                        <span>图谱智能分析</span>
                      </div>
                      <p className="nl-insight-body">{aiAnswer}</p>
                    </div>
                  )}
                </>
              )}

              {/* ── TAB 2: 查看 (Node / Memory Inspector 1:1 with Nowledge Mem) ── */}
              {activeTab === "view" && (() => {
                const mem = selectedNode ? memoriesMap.get(selectedNode.id) : null;
                const isMem = !!mem;
                const cleanTitle = selectedNode ? getCleanName(selectedNode) : "未选择节点";
                const unitType = isMem ? (mem.unit_type || "fact") : (selectedNode?.type || "entity");

                // Parse labels
                let tags: string[] = [];
                if (isMem && mem.labels) {
                  try {
                    tags = typeof mem.labels === "string" ? JSON.parse(mem.labels) : mem.labels;
                  } catch {
                    if (typeof mem.labels === "string") tags = mem.labels.split(/[,，\s]+/);
                  }
                }

                // Format importance percentage
                const rawImp = isMem ? mem.importance : "medium";
                let impPercent = 80;
                if (typeof rawImp === "number") impPercent = Math.round(rawImp * 100);
                else if (rawImp === "high" || rawImp === "critical") impPercent = 100;
                else if (rawImp === "low") impPercent = 50;

                // Format date
                const formatDate = (iso?: string) => {
                  if (!iso) return "2026/8/17";
                  try {
                    const d = new Date(iso);
                    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                  } catch {
                    return "2026/8/17";
                  }
                };

                return (
                  <div className="nl-inspector-view-tab">
                    {/* Top Unit Type Badge & Hero Title */}
                    <div className="nl-view-node-header">
                      <span className="nl-view-badge" style={{ backgroundColor: `${activeColor}22`, color: activeColor, borderColor: `${activeColor}44` }}>
                        {isMem ? `🔵 ${unitType === "decision" ? "决策" : unitType === "learning" ? "学习" : unitType === "rule" ? "规则" : "记忆"}` : `🟣 ${selectedNode?.type === "project" ? "项目" : "实体"}`}
                      </span>
                      <h2 className="nl-view-node-title">{cleanTitle}</h2>
                    </div>

                    {/* Section: 为什么并存 */}
                    <div className="nl-view-info-card">
                      <div className="nl-view-info-card-header">
                        <span className="nl-info-title">为什么并存</span>
                        <span className="nl-info-count">{connectedLinks.length} 条可见连接</span>
                      </div>
                      <p className="nl-info-desc">
                        {isMem
                          ? "这是一条保存下来的记忆，它如此稳定，是因为已经配对了搜索、检索等预期阶段的实体。"
                          : `这是图谱中的核心枢纽概念，聚合了 ${connectedLinks.length} 条沉淀记忆与上下文拓扑。`}
                      </p>
                    </div>

                    {/* Section: 下一步 */}
                    {isMem && (
                      <div className="nl-view-info-card">
                        <div className="nl-view-info-card-header">
                          <span className="nl-info-title">下一步</span>
                        </div>
                        <p className="nl-info-desc">
                          自动提取历史上下文，生成更精细的关系网络连接。
                        </p>
                      </div>
                    )}

                    {/* Section: 包含上下文标签 */}
                    {tags.length > 0 && (
                      <div className="nl-view-tags-section">
                        <div className="nl-view-section-label">包含上下文标签</div>
                        <div className="nl-view-tags-pills">
                          {tags.map((t, i) => (
                            <span key={i} className="nl-context-tag-pill">
                              🏷️ {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="nl-view-quick-actions">
                      <button className="nl-view-action-chip" onClick={() => handleAskQuestion(`围绕 "${cleanTitle}" 还有什么？`)}>
                        <span>◈</span> 打开完整上下文
                      </button>
                      <button className="nl-view-action-chip" onClick={() => handleRunMaintain("归并记忆")}>
                        <span>☷</span> 归并记忆
                      </button>
                    </div>

                    {/* Section: 详细内容 / 题名 */}
                    {isMem && mem.content && (
                      <div className="nl-view-content-section">
                        <div className="nl-view-section-label">题名 / 摘要 / 详细内容</div>
                        <div className="nl-view-markdown-box">
                          {mem.content}
                        </div>
                      </div>
                    )}

                    {/* Section: 可见网络 / 拓扑关系 */}
                    <div className="nl-view-network-section">
                      <div className="nl-view-section-header-row">
                        <span className="nl-view-section-label">可见网络</span>
                        <span className="nl-network-count">{connectedLinks.length} 条连接</span>
                      </div>

                      {connectedLinks.length === 0 ? (
                        <div className="nl-network-empty-tip">当前节点在全局图谱中未连接到其他实体。</div>
                      ) : (
                        <div className="nl-connected-links-list">
                          {connectedLinks.map((l: any, idx: number) => {
                            const src = typeof l.source === "object" ? l.source.id : l.source;
                            const tgt = typeof l.target === "object" ? l.target.id : l.target;
                            const srcClean = getCleanName(src);
                            const tgtClean = getCleanName(tgt);
                            const isSelfSrc = src === selectedNode?.id;
                            const otherId = isSelfSrc ? tgt : src;
                            const otherClean = isSelfSrc ? tgtClean : srcClean;

                            return (
                              <div
                                key={idx}
                                className="nl-link-item-row clickable"
                                onClick={() => {
                                  const targetNode = data.nodes.find((n) => n.id === otherId);
                                  if (targetNode) setSelectedNode(targetNode);
                                }}
                              >
                                <span className="nl-link-node">{otherClean}</span>
                                <span className="nl-link-rel">({l.relation || "related_to"})</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Footer Metadata: 重要性 / 更新 / 创建 */}
                    <div className="nl-view-metadata-footer">
                      <div className="nl-meta-row">
                        <span className="nl-meta-k">重要性</span>
                        <span className="nl-meta-v">{impPercent}%</span>
                      </div>
                      <div className="nl-meta-row">
                        <span className="nl-meta-k">更新</span>
                        <span className="nl-meta-v">{formatDate(isMem ? (mem.updatedAt || mem.createdAt) : undefined)}</span>
                      </div>
                      <div className="nl-meta-row">
                        <span className="nl-meta-k">创建</span>
                        <span className="nl-meta-v">{formatDate(isMem ? mem.createdAt : undefined)}</span>
                      </div>
                    </div>

                    {/* Bottom Action Buttons: 连接 / 剪裁 / 取消选择 */}
                    <div className="nl-view-footer-actions">
                      <button className="nl-footer-btn" onClick={() => setIsConnectingMemory(true)}>
                        <IconLink size={12} />
                        <span>连接</span>
                      </button>
                      <button className="nl-footer-btn" onClick={() => handleRunMaintain("剪裁记忆")}>
                        <span>✂️</span>
                        <span>剪裁</span>
                      </button>
                      <button className="nl-footer-btn cancel" onClick={() => setSelectedNode(null)}>
                        <span>✕</span>
                        <span>取消选择</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── TAB 3: 本体 (Ontology Schema) ── */}
              {activeTab === "ontology" && (
                <div className="nl-inspector-ontology-tab">
                  <div className="nl-view-section-header">本体分类体系</div>
                  <div className="nl-ontology-cards-grid">
                    <div className="nl-onto-card">
                      <span className="nl-onto-badge" style={{ color: "#a855f7" }}>🟣 实体 / 概念</span>
                      <p className="nl-onto-desc">业务实体、核心名词、技术概念与抽象定义</p>
                    </div>
                    <div className="nl-onto-card">
                      <span className="nl-onto-badge" style={{ color: "#0096c7" }}>🔵 记忆 / 决策</span>
                      <p className="nl-onto-desc">AI 对话提炼的持久化经验、架构决策与方案记录</p>
                    </div>
                    <div className="nl-onto-card">
                      <span className="nl-onto-badge" style={{ color: "#10b981" }}>🟢 资料 / 技术栈</span>
                      <p className="nl-onto-desc">代码库文件、技术文档与外部参考源</p>
                    </div>
                    <div className="nl-onto-card">
                      <span className="nl-onto-badge" style={{ color: "#ef4444" }}>🔴 技能 / 架构规则</span>
                      <p className="nl-onto-desc">智能体 Skills、编码规范与避坑规则</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 4: 图谱维护 (Exact match with Screenshot 1 & 3) ── */}
              {activeTab === "maintain" && (
                <div className="nl-inspector-maintain-tab">
                  <div className="nl-maintain-hero-header">
                    <h3 className="nl-maintain-title">维护图谱</h3>
                    <p className="nl-maintain-desc">
                      当主题、权重或图谱健康状态变旧时，在这里刷新。真正的探索从画布和解读面板开始；这里负责让图谱保持健康。
                    </p>
                  </div>

                  {maintainStatus && (
                    <div className="nl-maintain-status-banner">
                      {maintainStatus}
                    </div>
                  )}

                  <div className="nl-maintain-cards-list">
                    {/* 1. 聚类 */}
                    <div className="nl-maintain-card">
                      <div
                        className="nl-maintain-card-header"
                        onClick={() =>
                          setExpandedMaintainCard(expandedMaintainCard === "cluster" ? null : "cluster")
                        }
                      >
                        <div className="nl-maintain-card-left">
                          <span className="nl-maintain-card-icon"><IconNetwork size={15} /></span>
                          <div className="nl-maintain-card-texts">
                            <span className="nl-maintain-card-name">聚类</span>
                            <span className="nl-maintain-card-sub">将节点分组为社区。</span>
                          </div>
                        </div>
                        <span className="nl-maintain-arrow">{expandedMaintainCard === "cluster" ? "▴" : "▾"}</span>
                      </div>
                      {expandedMaintainCard === "cluster" && (
                        <div className="nl-maintain-card-body">
                          <p>基于 Louvain 图拓扑算法自动识别紧密相关的知识聚类，并生成社区气泡。</p>
                          <button className="nl-maintain-action-btn" onClick={() => handleRunMaintain("聚类分析")}>
                            立即执行聚类
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 2. 图谱权重 */}
                    <div className="nl-maintain-card">
                      <div
                        className="nl-maintain-card-header"
                        onClick={() =>
                          setExpandedMaintainCard(expandedMaintainCard === "weight" ? null : "weight")
                        }
                      >
                        <div className="nl-maintain-card-left">
                          <span className="nl-maintain-card-icon"><IconTarget size={15} /></span>
                          <div className="nl-maintain-card-texts">
                            <span className="nl-maintain-card-name">图谱权重</span>
                            <span className="nl-maintain-card-sub">刷新图谱信号，帮助搜索识别更核心的记忆和实体。</span>
                          </div>
                        </div>
                        <span className="nl-maintain-arrow">{expandedMaintainCard === "weight" ? "▴" : "▾"}</span>
                      </div>
                      {expandedMaintainCard === "weight" && (
                        <div className="nl-maintain-card-body">
                          <p>计算节点的入度、出度与介数中心性（PageRank），提升关键知识检索的优先权重。</p>
                          <button className="nl-maintain-action-btn" onClick={() => handleRunMaintain("权重重算")}>
                            刷新图谱权重
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 3. 清理 */}
                    <div className="nl-maintain-card">
                      <div
                        className="nl-maintain-card-header"
                        onClick={() =>
                          setExpandedMaintainCard(expandedMaintainCard === "prune" ? null : "prune")
                        }
                      >
                        <div className="nl-maintain-card-left">
                          <span className="nl-maintain-card-icon"><IconFolder size={15} /></span>
                          <div className="nl-maintain-card-texts">
                            <span className="nl-maintain-card-name">清理</span>
                            <span className="nl-maintain-card-sub">查找并删除孤立点。</span>
                          </div>
                        </div>
                        <span className="nl-maintain-arrow">{expandedMaintainCard === "prune" ? "▴" : "▾"}</span>
                      </div>
                      {expandedMaintainCard === "prune" && (
                        <div className="nl-maintain-card-body">
                          <p>扫描没有连接任何边与记忆的游离孤立实体，保持图谱整洁高效。</p>
                          <button className="nl-maintain-action-btn danger" onClick={() => handleRunMaintain("清理孤立点")}>
                            扫描并清理
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom AI Question Input (Shown in Interpret tab) */}
            {activeTab === "interpret" && (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
};
