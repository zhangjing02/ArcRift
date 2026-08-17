import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import type { GraphData, GraphNode } from "../../types";
import { getGraphData } from "../../api/ArcRift";

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
  const [, setSelectedNode] = useState<GraphNode | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadGraph();
  }, [sessionId]);

  const loadGraph = async () => {
    try {
      const g = await getGraphData(sessionId);
      setData(g as GraphData);
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
        .filter((n: GraphNode) => n.id.toLowerCase().includes(q) || n.type.toLowerCase().includes(q))
        .map((n: GraphNode) => n.id)
    );

    const links = data.links.filter(
      (l: any) =>
        matchedNodeIds.has(typeof l.source === "object" ? (l.source as any).id : l.source) ||
        matchedNodeIds.has(typeof l.target === "object" ? (l.target as any).id : l.target)
    );

    return { nodes: data.nodes.filter((n: GraphNode) => matchedNodeIds.has(n.id)), links };
  }, [data, searchQuery]);

  // Color mapping based on Nowledge Mem categories
  const getNodeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "entity":
      case "concept":
        return "#a855f7"; // 🟣 实体
      case "memory":
      case "decision":
        return "#3b82f6"; // 🔵 记忆
      case "document":
      case "file":
      case "tech":
        return "#10b981"; // 🟢 资料
      case "chat":
      case "session":
        return "#f97316"; // 🟠 对话
      case "skill":
      case "rule":
      case "architecture":
        return "#ef4444"; // 🔴 技能 / 规则
      default:
        return "#64748b";
    }
  };

  // Render D3 Simulation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg.attr("viewBox", [0, 0, width, height] as any);

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const nodes: any[] = filteredData.nodes.map((d: any) => ({ ...d }));
    const links: any[] = filteredData.links.map((d: any) => ({ ...d }));

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-240))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(35));

    // Links
    const link = g
      .append("g")
      .attr("stroke", "rgba(148, 163, 184, 0.25)")
      .attr("stroke-width", 1.5)
      .selectAll("line")
      .data(links)
      .join("line");

    // Link Labels (Relations)
    const linkText = g
      .append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("font-size", "9px")
      .attr("fill", "#64748b")
      .attr("text-anchor", "middle")
      .text((d: any) => d.relation || "");

    // Nodes
    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
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

    // Glowing Circles
    node
      .append("circle")
      .attr("r", 14)
      .attr("fill", (d: any) => getNodeColor(d.type))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer");

    // Node Labels
    node
      .append("text")
      .attr("dx", 18)
      .attr("dy", 4)
      .attr("fill", "#f1f5f9")
      .attr("font-size", "11px")
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

  const handleAskQuestion = (question: string) => {
    setAiPrompt(question);
    setIsAsking(true);
    setTimeout(() => {
      setAiAnswer(`关于「${question}」的图谱推演：当前在图谱中检索到了 ${data.nodes.length} 个实体与 ${data.links.length} 条关系三元组。核心脉络聚焦于 OTA 接口改造与 Android 架构协议约定。`);
      setIsAsking(false);
    }, 1000);
  };

  return (
    <div className="nl-graph-view-container">
      {/* Top Header */}
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">知识图谱</h1>
          <p className="nl-view-subtitle">
            全图 · {data.nodes.length} 个节点，{data.links.length} 条边
          </p>
        </div>
      </div>

      {/* Search & Scope Toolbar */}
      <div className="nl-graph-toolbar">
        <div className="nl-graph-search-wrap">
          <span className="nl-search-icon">🔍</span>
          <input
            type="text"
            placeholder="搜索实体、主题或问题..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="nl-graph-search-input"
          />
          <div className="nl-speed-pills">
            <button
              className={`nl-speed-pill ${searchSpeed === "smart" ? "active" : ""}`}
              onClick={() => setSearchSpeed("smart")}
            >
              智能
            </button>
            <button
              className={`nl-speed-pill ${searchSpeed === "fast" ? "active" : ""}`}
              onClick={() => setSearchSpeed("fast")}
            >
              快速
            </button>
          </div>
          <div className="nl-depth-selector">
            <span className="nl-depth-label">✨ 范围</span>
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                className={`nl-depth-num ${depthScope === lvl ? "active" : ""}`}
                onClick={() => setDepthScope(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
          <button className="nl-graph-search-btn">🔍</button>
        </div>
      </div>

      {/* Main Canvas & Right Explore Layout */}
      <div className="nl-graph-body">
        {/* Canvas Area */}
        <div className="nl-graph-canvas-wrap" ref={containerRef}>
          {/* Top Floating Controls */}
          <div className="nl-canvas-top-tools">
            <div className="nl-tool-group">
              <button className="nl-canvas-btn" title="随机重排">🔀</button>
              <button className="nl-canvas-btn" title="全局居中">🌐</button>
              <div className="nl-dim-toggle">
                <button
                  className={`nl-dim-btn ${viewDimension === "2D" ? "active" : ""}`}
                  onClick={() => setViewDimension("2D")}
                >
                  2D
                </button>
                <button
                  className={`nl-dim-btn ${viewDimension === "3D" ? "active" : ""}`}
                  onClick={() => setViewDimension("3D")}
                >
                  3D
                </button>
              </div>
            </div>

            <div className="nl-tool-group">
              <button className="nl-canvas-btn" title="层级视图">📚</button>
              <button className="nl-canvas-btn" title="聚焦核心">🎯</button>
              <button className="nl-canvas-btn" title="关系过滤">🔗</button>
              <button className="nl-canvas-btn" title="全屏查看">⤢</button>
            </div>

            <div className="nl-tool-group">
              <button className="nl-action-chip">✨ 解读</button>
              <button className="nl-action-chip">📄 查看</button>
              <button className="nl-action-chip">⚙️ 本体</button>
              <button className="nl-action-chip">☷ 图谱维护</button>
            </div>
          </div>

          {/* D3 SVG Canvas */}
          <svg ref={svgRef} className="nl-graph-svg"></svg>

          {/* Bottom Left Legend */}
          <div className="nl-graph-legend">
            <div className="nl-legend-pill">
              <span className="nl-legend-dot" style={{ background: "#a855f7" }}></span>
              <span>实体</span>
            </div>
            <div className="nl-legend-pill">
              <span className="nl-legend-dot" style={{ background: "#3b82f6" }}></span>
              <span>记忆</span>
            </div>
            <div className="nl-legend-pill">
              <span className="nl-legend-dot" style={{ background: "#10b981" }}></span>
              <span>资料</span>
            </div>
            <div className="nl-legend-pill">
              <span className="nl-legend-dot" style={{ background: "#f97316" }}></span>
              <span>对话</span>
            </div>
            <div className="nl-legend-pill">
              <span className="nl-legend-dot" style={{ background: "#ef4444" }}></span>
              <span>技能</span>
            </div>
          </div>
        </div>

        {/* Right Explore Drawer (Screenshot 5 Right Side) */}
        <div className="nl-graph-explore-panel">
          <div className="nl-explore-header">探索</div>

          <div className="nl-explore-prompts">
            <button
              className="nl-prompt-chip"
              onClick={() => handleAskQuestion("发现意想不到的关联")}
            >
              发现意想不到的关联
            </button>
            <button
              className="nl-prompt-chip"
              onClick={() => handleAskQuestion("哪里有知识空白？")}
            >
              哪里有知识空白？
            </button>
            <button
              className="nl-prompt-chip"
              onClick={() => handleAskQuestion("哪些说法互相矛盾？")}
            >
              哪些说法互相矛盾？
            </button>
            <button
              className="nl-prompt-chip"
              onClick={() => handleAskQuestion("识别知识族群")}
            >
              识别知识族群
            </button>
            <button
              className="nl-prompt-chip"
              onClick={() => handleAskQuestion("我的知识是如何演变的？")}
            >
              我的知识是如何演变的？
            </button>
            <button
              className="nl-prompt-chip"
              onClick={() => handleAskQuestion("我有哪些盲区值得去看？")}
            >
              我有哪些盲区值得去看？
            </button>
          </div>

          {aiAnswer && (
            <div className="nl-ai-graph-response">
              <div className="nl-ai-graph-label">✨ 图谱洞察</div>
              <p>{aiAnswer}</p>
            </div>
          )}

          {/* Ask Input Card */}
          <div className="nl-ask-graph-card">
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
              className="nl-ask-graph-input"
            />
            <button
              className="nl-ask-submit-btn"
              disabled={!aiPrompt.trim() || isAsking}
              onClick={() => handleAskQuestion(aiPrompt)}
            >
              {isAsking ? "..." : "↑"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
