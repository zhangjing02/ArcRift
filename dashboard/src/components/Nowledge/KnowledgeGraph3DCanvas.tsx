import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ForceGraph3D } from "react-force-graph";
import * as THREE from "three";
import type { GraphData, GraphNode } from "../../types";

interface KnowledgeGraph3DCanvasProps {
  data: GraphData;
  selectedNode: GraphNode | null;
  onNodeSelect: (node: GraphNode) => void;
  getNodeColor: (type?: string) => string;
}

type HeightMetric = "influence" | "structure" | "morphology" | "growth";

function hexToThreeColor(hex: string): THREE.Color {
  try { return new THREE.Color(hex); } catch { return new THREE.Color(0x60a5fa); }
}

function computeNodeZ(
  node: any,
  index: number,
  totalNodes: number,
  degreeMap: Map<string, number>,
  maxDegree: number,
  heightMetric: HeightMetric
): { z: number; layer: number } {
  const degree = degreeMap.get(node.id) || 1;

  if (heightMetric === "influence") {
    const ratio = degree / maxDegree;
    return { z: ratio * 300 + 10, layer: Math.min(4, Math.floor(ratio * 5)) };
  }

  if (heightMetric === "structure") {
    const sorted = Array.from(degreeMap.entries()).sort((a, b) => b[1] - a[1]);
    const rank = sorted.findIndex(([id]) => id === node.id);
    const shellRatio = rank < 0 ? 1 : rank / Math.max(1, totalNodes - 1);
    return { z: (1 - shellRatio) * 280 + 10, layer: Math.min(4, 4 - Math.floor(shellRatio * 5)) };
  }

  if (heightMetric === "morphology") {
    const t = (node.type || "").toLowerCase();
    if (t.includes("rule") || t.includes("arch") || t.includes("skill")) return { z: 300, layer: 4 };
    if (t.includes("tech") || t.includes("doc") || t.includes("file")) return { z: 220, layer: 3 };
    if (t.includes("concept") || t.includes("entity")) return { z: 140, layer: 2 };
    if (t.includes("memory") || t.includes("decision")) return { z: 70, layer: 1 };
    return { z: 10, layer: 0 };
  }

  if (heightMetric === "growth") {
    const ageRatio = index / Math.max(1, totalNodes - 1);
    if (ageRatio > 0.85) return { z: 280 + Math.random() * 30, layer: 3 };
    if (ageRatio > 0.6) return { z: 180 + Math.random() * 30, layer: 2 };
    if (ageRatio > 0.3) return { z: 90 + Math.random() * 30, layer: 1 };
    return { z: 10 + Math.random() * 30, layer: 0 };
  }

  return { z: 0, layer: 0 };
}

const STRATA_LABELS: Record<HeightMetric, Array<{ label: string; color: string }>> = {
  influence: [
    { label: "核心枢纽", color: "#f472b6" },
    { label: "高影响力", color: "#a78bfa" },
    { label: "中等连接", color: "#60a5fa" },
    { label: "边缘节点", color: "#6b7280" },
  ],
  structure: [
    { label: "核心层", color: "#f472b6" },
    { label: "内层", color: "#a78bfa" },
    { label: "中层", color: "#60a5fa" },
    { label: "离散层", color: "#6b7280" },
  ],
  morphology: [
    { label: "知识结晶", color: "#f472b6" },
    { label: "技术规范", color: "#a78bfa" },
    { label: "概念实体", color: "#60a5fa" },
    { label: "记忆决策", color: "#34d399" },
    { label: "原始记录", color: "#6b7280" },
  ],
  growth: [
    { label: "现在", color: "#f472b6" },
    { label: "7 天", color: "#a78bfa" },
    { label: "30 天", color: "#60a5fa" },
    { label: "1 年以上", color: "#6b7280" },
  ],
};

export const KnowledgeGraph3DCanvas: React.FC<KnowledgeGraph3DCanvasProps> = ({
  data,
  selectedNode,
  onNodeSelect,
  getNodeColor,
}) => {
  const graphRef = useRef<any>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [heightMetric, setHeightMetric] = useState<HeightMetric>("influence");
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) });
      }
    });
    ro.observe(el);
    setDimensions({ width: el.clientWidth || 800, height: el.clientHeight || 600 });
    return () => ro.disconnect();
  }, []);

  const graphData = useMemo(() => {
    if (!data.nodes || data.nodes.length === 0) return { nodes: [], links: [] };
    const degreeMap = new Map<string, number>();
    data.links.forEach((l: any) => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      degreeMap.set(src, (degreeMap.get(src) || 0) + 1);
      degreeMap.set(tgt, (degreeMap.get(tgt) || 0) + 1);
    });
    const maxDegree = Math.max(1, ...Array.from(degreeMap.values()));

    const nodes = data.nodes.map((n: GraphNode, i: number) => {
      const { z, layer } = computeNodeZ(n, i, data.nodes.length, degreeMap, maxDegree, heightMetric);
      return {
        ...n,
        fz: z,
        degree: degreeMap.get(n.id) || 1,
        layer,
        color: getNodeColor(n.type),
      };
    });

    const links = data.links.map((l: any) => ({
      ...l,
      source: typeof l.source === "object" ? l.source.id : l.source,
      target: typeof l.target === "object" ? l.target.id : l.target,
    }));

    return { nodes, links };
  }, [data.nodes, data.links, heightMetric, getNodeColor]);

  const nodeThreeObject = useCallback((node: any) => {
    const color = node.color || "#60a5fa";
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    const radius = Math.max(3, Math.min(12, 3 + Math.sqrt(node.degree || 1) * 1.8));
    const group = new THREE.Group();

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 20),
      new THREE.MeshPhongMaterial({
        color: hexToThreeColor(color),
        emissive: hexToThreeColor(color),
        emissiveIntensity: isSelected ? 1.2 : isHovered ? 0.9 : 0.55,
        shininess: 80,
        transparent: true,
        opacity: 0.92,
      })
    );
    group.add(sphere);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 2.4, 16, 16),
      new THREE.MeshBasicMaterial({
        color: hexToThreeColor(color),
        transparent: true,
        opacity: isSelected ? 0.18 : isHovered ? 0.12 : 0.06,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    group.add(halo);

    if (isSelected) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 2.2, 0.7, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
      );
      group.add(ring);
    }

    return group;
  }, [selectedNode, hoveredNode]);

  useEffect(() => {
    if (graphRef.current) {
      (graphRef.current as any).cameraPosition({ x: 0, y: -180, z: 480 }, { x: 0, y: 0, z: 0 }, 0);
    }
  }, []);

  useEffect(() => {
    if (graphRef.current && selectedNode) {
      const node = graphData.nodes.find((n: any) => n.id === selectedNode.id) as any;
      if (node && node.x !== undefined) {
        (graphRef.current as any).cameraPosition(
          { x: node.x, y: node.y - 80, z: (node.fz || 0) + 120 },
          { x: node.x, y: node.y, z: node.fz || 0 },
          800
        );
      }
    }
  }, [selectedNode, graphData.nodes]);

  const strata = STRATA_LABELS[heightMetric];

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: "#080b12" }}>
      {/* Height metric pills */}
      <div style={{
        position: "absolute", top: 10, left: 12, zIndex: 10,
        display: "flex", gap: 4, flexWrap: "wrap",
      }}>
        {(["influence", "structure", "morphology", "growth"] as HeightMetric[]).map((m) => {
          const labels: Record<HeightMetric, string> = { influence: "▲ 影响力", structure: "✦ 结构", morphology: "◈ 形态", growth: "⬆ 增长" };
          const active = heightMetric === m;
          return (
            <button key={m} onClick={() => setHeightMetric(m)} style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 20,
              border: `1px solid ${active ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.08)"}`,
              cursor: "pointer", fontFamily: "sans-serif",
              background: active ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.03)",
              color: active ? "#93c5fd" : "#64748b", transition: "all 0.2s",
            }}>
              {labels[m]}
            </button>
          );
        })}
      </div>

      {/* Strata legend */}
      <div style={{
        position: "absolute", top: "50%", right: 14, zIndex: 10,
        transform: "translateY(-50%)", display: "flex",
        flexDirection: "column", gap: 8, pointerEvents: "none",
      }}>
        {strata.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 22, height: 1, background: s.color, opacity: 0.6, boxShadow: `0 0 6px ${s.color}` }} />
            <span style={{ fontSize: 10, color: s.color, fontFamily: "sans-serif", opacity: 0.8, letterSpacing: "0.05em" }}>{s.label}</span>
          </div>
        ))}
      </div>

      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#080b12"
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={(node: any) => node.label || node.id || ""}
        nodeOpacity={0.9}
        nodeRelSize={4}
        linkColor={() => "rgba(148,163,184,0.2)"}
        linkOpacity={0.3}
        linkWidth={0.6}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.2}
        linkDirectionalParticleSpeed={0.003}
        linkDirectionalParticleColor={(link: any) => {
          const srcId = typeof link.source === "object" ? link.source.id : link.source;
          const src = graphData.nodes.find((n: any) => n.id === srcId) as any;
          return src?.color || "#60a5fa";
        }}
        onNodeClick={(node: any) => onNodeSelect(node as GraphNode)}
        onNodeHover={(node: any) => setHoveredNode(node)}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        enablePointerInteraction={true}
        showNavInfo={false}
      />

      {hoveredNode && (
        <div style={{
          position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)",
          background: "rgba(12,18,32,0.92)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#e2e8f0",
          fontFamily: "sans-serif", pointerEvents: "none", backdropFilter: "blur(8px)",
          maxWidth: 280, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{hoveredNode.label || hoveredNode.id}</div>
          {hoveredNode.type && <div style={{ color: "#64748b", fontSize: 10 }}>{hoveredNode.type}</div>}
        </div>
      )}
    </div>
  );
};


