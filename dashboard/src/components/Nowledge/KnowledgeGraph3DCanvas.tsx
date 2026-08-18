import React, { useEffect, useRef, useState, useMemo } from "react";
import type { GraphData, GraphNode } from "../../types";

interface KnowledgeGraph3DCanvasProps {
  data: GraphData;
  selectedNode: GraphNode | null;
  onNodeSelect: (node: GraphNode) => void;
  getNodeColor: (type?: string) => string;
}

type HeightMetric = "influence" | "structure" | "morphology" | "growth";
type ViewMode3D = "terrain" | "constellation";

interface Node3D extends GraphNode {
  x: number;
  y: number;
  z: number;
  targetZ: number;
  currentZ: number;
  degree: number;
  layer: number;
  screenX?: number;
  screenY?: number;
  screenScale?: number;
  depth?: number;
}

export const KnowledgeGraph3DCanvas: React.FC<KnowledgeGraph3DCanvasProps> = ({
  data,
  selectedNode,
  onNodeSelect,
  getNodeColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode3D, setViewMode3D] = useState<ViewMode3D>("terrain");
  const [heightMetric, setHeightMetric] = useState<HeightMetric>("influence");
  const [hoveredNode, setHoveredNode] = useState<Node3D | null>(null);

  // Camera 3D state
  const cameraRef = useRef({
    rotX: 0.65, // pitch (~37 deg)
    rotY: -0.45, // yaw
    zoom: 1.05,
    panX: 0,
    panY: -30,
    isDragging: false,
    dragButton: 0,
    lastMouseX: 0,
    lastMouseY: 0,
    targetRotX: 0.65,
    targetRotY: -0.45,
    targetPanX: 0,
    targetPanY: -30,
    targetZoom: 1.05,
  });

  // Current node positions for smooth transition animation
  const nodePositionsRef = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());

  // Calculate 3D node coordinates — each mode has completely different spatial logic
  const nodes3D = useMemo(() => {
    if (!data.nodes || data.nodes.length === 0) return [];

    // ── Degree map ─────────────────────────────────────────────────────────────
    const degreeMap = new Map<string, number>();
    data.links.forEach((l: any) => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      degreeMap.set(src, (degreeMap.get(src) || 0) + 1);
      degreeMap.set(tgt, (degreeMap.get(tgt) || 0) + 1);
    });

    const totalNodes = data.nodes.length;
    const maxDegree = Math.max(1, ...Array.from(degreeMap.values()));

    return data.nodes.map((n: GraphNode, i: number) => {
      const degree = degreeMap.get(n.id) || 1;
      let x = 0, y = 0, z = 0, layer = 0;

      // ────────────────────────────────────────────────────────────────────────
      // CONSTELLATION MODE — nodes on sphere surface, all same height band
      // ────────────────────────────────────────────────────────────────────────
      if (viewMode3D === "constellation") {
        const phi = Math.acos(-1 + (2 * i) / Math.max(1, totalNodes));
        const theta = Math.sqrt(totalNodes * Math.PI) * phi;
        const R = 240;
        x = R * Math.sin(phi) * Math.cos(theta);
        y = R * Math.sin(phi) * Math.sin(theta);
        z = R * Math.cos(phi) * 0.5 + 100; // flatten slightly
        layer = 0;

      // ────────────────────────────────────────────────────────────────────────
      // INFLUENCE MODE — mountain terrain: high-degree nodes rise to peaks,
      //   low-degree nodes scatter flat at base. XY spreads based on degree rank.
      //   => High-connectivity hub at center-top, peripheral nodes fan out flat.
      // ────────────────────────────────────────────────────────────────────────
      } else if (heightMetric === "influence") {
        const degreeRatio = degree / maxDegree; // 0..1
        // High-degree nodes cluster near center, low-degree spread wide
        const radialDistance = (1 - degreeRatio) * 320 + 40;
        const angle = (i / totalNodes) * Math.PI * 2 + (i * 0.618) * Math.PI;
        x = Math.cos(angle) * radialDistance * (0.7 + Math.random() * 0.3);
        y = Math.sin(angle) * radialDistance * (0.7 + Math.random() * 0.3);
        // Z = height is purely driven by degree
        z = degreeRatio * 350 + (degree > 1 ? 30 : 5);
        layer = Math.min(4, Math.floor(degreeRatio * 5));

      // ────────────────────────────────────────────────────────────────────────
      // STRUCTURE MODE — concentric shell rings, nodes at same K-core level
      //   are placed on the same radial shell. Innermost core = tallest.
      //   => Nodes that survive k-core pruning stay central and high.
      // ────────────────────────────────────────────────────────────────────────
      } else if (heightMetric === "structure") {
        // Approximate k-core depth by degree rank
        const sortedByDegree = [...data.nodes]
          .map((nn: GraphNode) => ({ id: nn.id, deg: degreeMap.get(nn.id) || 1 }))
          .sort((a, b) => b.deg - a.deg);
        const rank = sortedByDegree.findIndex((nn) => nn.id === n.id);
        const shellRatio = rank / Math.max(1, totalNodes - 1); // 0=innermost core, 1=outermost
        
        // Nodes in same shell distributed evenly in that ring
        const numInShell = Math.max(1, Math.round(totalNodes / 5));
        const shellIndex = Math.floor(rank / numInShell);
        const posInShell = rank % numInShell;
        const shellAngle = (posInShell / numInShell) * Math.PI * 2 + shellIndex * 0.8;
        
        const minR = 40, maxR = 340;
        const r = minR + shellRatio * (maxR - minR);
        x = Math.cos(shellAngle) * r;
        y = Math.sin(shellAngle) * r;
        // Inner (lower shellRatio) → higher Z, outer nodes very flat
        z = (1 - shellRatio) * 300 + 15;
        layer = Math.min(4, 4 - Math.floor(shellRatio * 5));

      // ────────────────────────────────────────────────────────────────────────
      // MORPHOLOGY MODE — strict horizontal layers by knowledge type.
      //   Each type occupies a different altitude band with nodes distributed
      //   across a wide XY plane within that band.
      //   Layer 0 (ground): raw records / chat
      //   Layer 1 (low):    memory / decision
      //   Layer 2 (mid):    concept / entity
      //   Layer 3 (high):   document / tech
      //   Layer 4 (peak):   skill / rule / architecture
      // ────────────────────────────────────────────────────────────────────────
      } else if (heightMetric === "morphology") {
        const t = (n.type || "").toLowerCase();
        if (t.includes("rule") || t.includes("arch") || t.includes("skill")) {
          layer = 4; z = 320;
        } else if (t.includes("tech") || t.includes("doc") || t.includes("file")) {
          layer = 3; z = 240;
        } else if (t.includes("concept") || t.includes("entity")) {
          layer = 2; z = 155;
        } else if (t.includes("memory") || t.includes("decision")) {
          layer = 1; z = 75;
        } else {
          layer = 0; z = 15;
        }
        // Within each layer, distribute nodes on a wide flat grid
        const layerNodes = data.nodes.filter((nn: GraphNode) => {
          const nt = (nn.type || "").toLowerCase();
          if (layer === 4) return nt.includes("rule") || nt.includes("arch") || nt.includes("skill");
          if (layer === 3) return nt.includes("tech") || nt.includes("doc") || nt.includes("file");
          if (layer === 2) return nt.includes("concept") || nt.includes("entity");
          if (layer === 1) return nt.includes("memory") || nt.includes("decision");
          return true;
        });
        const posInLayer = layerNodes.findIndex((nn: GraphNode) => nn.id === n.id);
        const countInLayer = Math.max(1, layerNodes.length);
        const layerAngle = (posInLayer / countInLayer) * Math.PI * 2;
        const layerR = 90 + posInLayer * 30;
        x = Math.cos(layerAngle) * layerR;
        y = Math.sin(layerAngle) * layerR;

      // ────────────────────────────────────────────────────────────────────────
      // GROWTH MODE — time strata: newest nodes at top, oldest at bottom.
      //   Nodes at same time band share a horizontal layer.
      //   Time bands: 0-7d, 7-30d, 30d-1yr, 1yr+
      // ────────────────────────────────────────────────────────────────────────
      } else if (heightMetric === "growth") {
        // Use node index as proxy for "age" (first added = oldest = lowest)
        const ageRatio = i / Math.max(1, totalNodes - 1); // 0=oldest, 1=newest
        
        // 4 distinct time bands
        if (ageRatio > 0.85) { layer = 3; z = 300; }         // 现在 (recent)
        else if (ageRatio > 0.6) { layer = 2; z = 210; }     // 7天
        else if (ageRatio > 0.3) { layer = 1; z = 120; }     // 30天
        else { layer = 0; z = 30; }                           // 1年以上

        // Add some vertical jitter within band
        z += (Math.random() - 0.5) * 25;

        // XY: stagger nodes in a zigzag across the canvas
        const angle = (i / totalNodes) * Math.PI * 4 + layer * 0.9;
        const r = 100 + (i % 5) * 55;
        x = Math.cos(angle) * r;
        y = Math.sin(angle) * r;
      }

      // Retrieve previous position for smooth lerp (if exists)
      const prev = nodePositionsRef.current.get(n.id);
      const startX = prev ? prev.x : x;
      const startY = prev ? prev.y : y;
      const startZ = prev ? prev.z : z;

      return {
        ...n,
        x: startX,
        y: startY,
        z: startZ,
        targetX: x,
        targetY: y,
        targetZ: z,
        currentZ: startZ,
        degree,
        layer,
      } as Node3D & { targetX: number; targetY: number };
    });
  }, [data.nodes, data.links, heightMetric, viewMode3D]);

  // Main 3D Perspective Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = (canvas.width = canvas.clientWidth * window.devicePixelRatio || 800);
      const height = (canvas.height = canvas.clientHeight * window.devicePixelRatio || 600);
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Camera Damping / Smooth Interpolation
      const cam = cameraRef.current;
      cam.rotX += (cam.targetRotX - cam.rotX) * 0.15;
      cam.rotY += (cam.targetRotY - cam.rotY) * 0.15;
      cam.zoom += (cam.targetZoom - cam.zoom) * 0.15;
      cam.panX += (cam.targetPanX - cam.panX) * 0.15;
      cam.panY += (cam.targetPanY - cam.panY) * 0.15;

      const cosX = Math.cos(cam.rotX);
      const sinX = Math.sin(cam.rotX);
      const cosY = Math.cos(cam.rotY);
      const sinY = Math.sin(cam.rotY);
      const fov = 750 * cam.zoom;

      // Project 3D coordinate (x, y, z) into 2D Screen Space
      const project = (x3d: number, y3d: number, z3d: number) => {
        // 1. Rotate around Y (Yaw)
        const x1 = x3d * cosY - y3d * sinY;
        const y1 = x3d * sinY + y3d * cosY;
        const z1 = z3d;

        // 2. Rotate around X (Pitch)
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        // 3. Perspective divide
        const depth = z2 + 800;
        const scale = depth > 10 ? fov / depth : 0;
        const sx = cx + (x2 + cam.panX) * scale;
        const sy = cy + (y2 + cam.panY) * scale;

        return { sx, sy, scale, depth, visible: depth > 10 };
      };

      // ── 1. DRAW BASE TERRAIN CONTOUR RINGS / GRID ─────────────────────────
      if (viewMode3D === "terrain") {
        // Draw isometric base planes & elevation contour rings
        const ringElevations = [0, 80, 160, 240, 320];
        ringElevations.forEach((elev) => {
          const pCenter = project(0, 0, elev);
          if (!pCenter.visible) return;

          ctx.save();
          ctx.strokeStyle = elev === 0 ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.025)";
          ctx.lineWidth = 1 * window.devicePixelRatio;

          // Draw multiple concentric terrain rings matching screenshots
          [120, 220, 320].forEach((r) => {
            ctx.beginPath();
            const segments = 48;
            for (let s = 0; s <= segments; s++) {
              const rad = (s / segments) * Math.PI * 2;
              const px = Math.cos(rad) * r;
              const py = Math.sin(rad) * r;
              const p = project(px, py, elev);
              if (s === 0) ctx.moveTo(p.sx, p.sy);
              else ctx.lineTo(p.sx, p.sy);
            }
            ctx.stroke();
          });
          ctx.restore();
        });

        // ── Left Height Ladder Annotations (Screenshot 4: 增长 / 形态) ──
        ctx.save();
        ctx.fillStyle = "#64748b";
        ctx.font = `${10.5 * window.devicePixelRatio}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = "right";

        if (heightMetric === "growth") {
          const timeSteps = [
            { label: "现在", z: 300 },
            { label: "7 天", z: 210 },
            { label: "30 天", z: 120 },
            { label: "1 年以上", z: 30 },
          ];
          timeSteps.forEach((step) => {
            const p = project(-380, 0, step.z);
            if (p.visible) {
              const pTick = project(-340, 0, step.z);
              ctx.strokeStyle = "rgba(100, 116, 139, 0.35)";
              ctx.lineWidth = 0.8 * window.devicePixelRatio;
              ctx.beginPath();
              ctx.moveTo(p.sx - 8, p.sy);
              ctx.lineTo(p.sx, p.sy);
              ctx.lineTo(pTick.sx, pTick.sy);
              ctx.stroke();
              ctx.fillText(step.label, p.sx - 12, p.sy + 4);
            }
          });
        } else if (heightMetric === "morphology") {
          const morphSteps = [
            { label: "知识结晶", z: 320 },
            { label: "技术规范", z: 240 },
            { label: "概念实体", z: 155 },
            { label: "记忆决策", z: 75 },
            { label: "原始记录", z: 15 },
          ];
          morphSteps.forEach((step) => {
            const p = project(-380, 0, step.z);
            if (p.visible) {
              ctx.fillText(step.label, p.sx - 12, p.sy + 4);
            }
          });
        } else if (heightMetric === "influence") {
          const influenceSteps = [
            { label: "高影响力", z: 350 },
            { label: "中等", z: 200 },
            { label: "低", z: 60 },
          ];
          influenceSteps.forEach((step) => {
            const p = project(-380, 0, step.z);
            if (p.visible) {
              ctx.fillText(step.label, p.sx - 12, p.sy + 4);
            }
          });
        } else if (heightMetric === "structure") {
          const structureSteps = [
            { label: "核心", z: 300 },
            { label: "内层", z: 200 },
            { label: "中层", z: 110 },
            { label: "离散", z: 20 },
          ];
          structureSteps.forEach((step) => {
            const p = project(-380, 0, step.z);
            if (p.visible) {
              ctx.fillText(step.label, p.sx - 12, p.sy + 4);
            }
          });
        }
        ctx.restore();
      }

      // ── 2. PROJECT AND INTERPOLATE ALL NODES (X/Y/Z smooth lerp) ───────────
      const projectedNodes: Node3D[] = [];
      const lerp = 0.10;
      nodes3D.forEach((n: any) => {
        // Lerp X and Y too for smooth spatial transition
        n.x += ((n.targetX ?? n.x) - n.x) * lerp;
        n.y += ((n.targetY ?? n.y) - n.y) * lerp;
        n.z += (n.targetZ - n.z) * lerp;
        n.currentZ = n.z;

        // Save current position for next mode switch
        nodePositionsRef.current.set(n.id, { x: n.x, y: n.y, z: n.z });

        const p = project(n.x, n.y, n.z);
        if (p.visible) {
          n.screenX = p.sx;
          n.screenY = p.sy;
          n.screenScale = p.scale;
          n.depth = p.depth;
          projectedNodes.push(n);
        }
      });

      // Sort by 3D depth for painter's algorithm (back-to-front)
      projectedNodes.sort((a, b) => (b.depth || 0) - (a.depth || 0));

      const nodeMap = new Map<string, Node3D>();
      projectedNodes.forEach((n) => nodeMap.set(n.id, n));

      // ── 3. DRAW VERTICAL DROP LINES & ELEVATION CONTOURS (Terrain Mode) ──
      if (viewMode3D === "terrain") {
        projectedNodes.forEach((n) => {
          const baseP = project(n.x, n.y, 0);
          if (!baseP.visible || !n.screenX || !n.screenY) return;

          ctx.save();
          // Vertical drop pillar dashed line
          ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
          ctx.setLineDash([3 * window.devicePixelRatio, 3 * window.devicePixelRatio]);
          ctx.beginPath();
          ctx.moveTo(baseP.sx, baseP.sy);
          ctx.lineTo(n.screenX, n.screenY);
          ctx.stroke();

          // Base elevation ellipse
          ctx.setLineDash([]);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
          ctx.lineWidth = 1;
          const ellipseR = Math.max(12, n.degree * 8) * (baseP.scale || 1);
          ctx.beginPath();
          ctx.ellipse(baseP.sx, baseP.sy, ellipseR, ellipseR * 0.45, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.restore();
        });
      }

      // ── 4. DRAW 3D TOPOLOGICAL LINK LINES ────────────────────────────────
      data.links.forEach((l: any) => {
        const srcId = typeof l.source === "object" ? l.source.id : l.source;
        const tgtId = typeof l.target === "object" ? l.target.id : l.target;
        const src = nodeMap.get(srcId);
        const tgt = nodeMap.get(tgtId);

        if (src && tgt && src.screenX && src.screenY && tgt.screenX && tgt.screenY) {
          ctx.save();
          const isHighlighted =
            (selectedNode && (src.id === selectedNode.id || tgt.id === selectedNode.id)) ||
            (hoveredNode && (src.id === hoveredNode.id || tgt.id === hoveredNode.id));

          ctx.strokeStyle = isHighlighted ? "rgba(56, 189, 248, 0.55)" : "rgba(148, 163, 184, 0.18)";
          ctx.lineWidth = (isHighlighted ? 2 : 1) * window.devicePixelRatio;

          ctx.beginPath();
          ctx.moveTo(src.screenX, src.screenY);
          ctx.lineTo(tgt.screenX, tgt.screenY);
          ctx.stroke();
          ctx.restore();
        }
      });

      // ── 5. DRAW 3D NODES & GLOWING LABELS ────────────────────────────────
      projectedNodes.forEach((n) => {
        if (!n.screenX || !n.screenY || !n.screenScale) return;

        const isSelected = selectedNode?.id === n.id;
        const isHovered = hoveredNode?.id === n.id;
        const color = getNodeColor(n.type);
        const baseRadius = Math.max(5, Math.min(16, 6 + n.degree * 1.5));
        const r = baseRadius * n.screenScale * (isSelected ? 1.4 : isHovered ? 1.2 : 1.0);

        ctx.save();

        // Outer Glowing Halo
        ctx.beginPath();
        ctx.arc(n.screenX, n.screenY, r * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "rgba(56, 189, 248, 0.35)" : isHovered ? "rgba(255, 255, 255, 0.3)" : color;
        ctx.globalAlpha = isSelected || isHovered ? 0.4 : 0.15;
        ctx.fill();

        // Main Node Sphere
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(n.screenX, n.screenY, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = isSelected ? "#38bdf8" : "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = (isSelected ? 2.5 : 1.2) * window.devicePixelRatio;
        ctx.stroke();

        // 3D Billboarding Text Label (Screenshot 1: White Clean Title)
        const fontSize = Math.max(9, Math.min(13, 11 * n.screenScale)) * window.devicePixelRatio;
        ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = isSelected ? "#38bdf8" : "#f1f5f9";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 4 * window.devicePixelRatio;

        const labelText = n.id.length > 20 ? n.id.slice(0, 19) + "..." : n.id;
        ctx.fillText(labelText, n.screenX, n.screenY - r - 6 * window.devicePixelRatio);

        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [nodes3D, selectedNode, hoveredNode, heightMetric, viewMode3D, data.links]);

  // ── MOUSE & TOUCH 3D EVENT HANDLERS ──────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cam = cameraRef.current;
    cam.isDragging = true;
    cam.dragButton = e.button;
    cam.lastMouseX = e.clientX;
    cam.lastMouseY = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * window.devicePixelRatio;
    const mouseY = (e.clientY - rect.top) * window.devicePixelRatio;

    const cam = cameraRef.current;
    if (cam.isDragging) {
      const deltaX = e.clientX - cam.lastMouseX;
      const deltaY = e.clientY - cam.lastMouseY;
      cam.lastMouseX = e.clientX;
      cam.lastMouseY = e.clientY;

      if (cam.dragButton === 0) {
        // Left button: 3D Orbit Rotate
        cam.targetRotY += deltaX * 0.008;
        cam.targetRotX = Math.max(0.05, Math.min(1.45, cam.targetRotX + deltaY * 0.008));
      } else {
        // Right button: 3D Pan
        cam.targetPanX += deltaX * 0.8;
        cam.targetPanY += deltaY * 0.8;
      }
      return;
    }

    // Node Hover Detection
    let foundNode: Node3D | null = null;
    nodes3D.forEach((n) => {
      if (n.screenX && n.screenY && n.screenScale) {
        const dx = mouseX - n.screenX;
        const dy = mouseY - n.screenY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 18 * window.devicePixelRatio) {
          foundNode = n;
        }
      }
    });

    setHoveredNode(foundNode);
    canvas.style.cursor = foundNode ? "pointer" : cam.isDragging ? "grabbing" : "grab";
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cam = cameraRef.current;
    cam.isDragging = false;

    // Node Click Detection
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * window.devicePixelRatio;
    const mouseY = (e.clientY - rect.top) * window.devicePixelRatio;

    nodes3D.forEach((n) => {
      if (n.screenX && n.screenY) {
        const dx = mouseX - n.screenX;
        const dy = mouseY - n.screenY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 18 * window.devicePixelRatio) {
          onNodeSelect(n);
        }
      }
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cam = cameraRef.current;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    cam.targetZoom = Math.max(0.4, Math.min(3.2, cam.targetZoom * zoomFactor));
  };

  return (
    <div className="nl-3d-graph-wrapper">
      {/* 3D WebGL / Canvas Viewport */}
      <canvas
        ref={canvasRef}
        className="nl-3d-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* ─────────────────────────────────────────────────────────────
          3D FLOATING BOTTOM-RIGHT CONTROLS (Screenshot 1, 2, 3, 4)
      ───────────────────────────────────────────────────────────── */}
      <div className="nl-3d-floating-controls-panel">
        {/* Top 3D Mode Toggle: 地形 | 知识星图 */}
        <div className="nl-3d-mode-capsule">
          <button
            className={`nl-3d-mode-btn ${viewMode3D === "terrain" ? "active" : ""}`}
            onClick={() => setViewMode3D("terrain")}
          >
            ⛰ 地形
          </button>
          <button
            className={`nl-3d-mode-btn ${viewMode3D === "constellation" ? "active" : ""}`}
            onClick={() => setViewMode3D("constellation")}
          >
            🌌 知识星图
          </button>
        </div>

        {/* Height Dimension Selector (Screenshot 1-4) */}
        {viewMode3D === "terrain" && (
          <div className="nl-3d-height-section">
            <div className="nl-3d-height-title">高度代表什么？</div>
            <div className="nl-3d-metric-pills">
              <button
                className={`nl-3d-metric-btn ${heightMetric === "influence" ? "active" : ""}`}
                onClick={() => setHeightMetric("influence")}
              >
                ⛰ 影响力
              </button>
              <button
                className={`nl-3d-metric-btn ${heightMetric === "structure" ? "active" : ""}`}
                onClick={() => setHeightMetric("structure")}
              >
                🝯 结构
              </button>
              <button
                className={`nl-3d-metric-btn ${heightMetric === "morphology" ? "active" : ""}`}
                onClick={() => setHeightMetric("morphology")}
              >
                🥞 形态
              </button>
              <button
                className={`nl-3d-metric-btn ${heightMetric === "growth" ? "active" : ""}`}
                onClick={() => setHeightMetric("growth")}
              >
                🕒 增长
              </button>
            </div>

            {/* Metric Explanation Card (1:1 with Screenshot 1-4) */}
            <div className="nl-3d-metric-desc-card">
              {heightMetric === "influence" && (
                <>
                  <div className="nl-3d-desc-name">影响力地形</div>
                  <div className="nl-3d-desc-sub">高处代表更重要、连接更强的知识。</div>
                </>
              )}
              {heightMetric === "structure" && (
                <>
                  <div className="nl-3d-desc-name">结构深度</div>
                  <div className="nl-3d-desc-sub">外围节点逐步移除后，越高的节点越能保持连接。</div>
                </>
              )}
              {heightMetric === "morphology" && (
                <>
                  <div className="nl-3d-desc-name">知识形态</div>
                  <div className="nl-3d-desc-sub">高度从原始证据逐步走向可复用知识。</div>
                </>
              )}
              {heightMetric === "growth" && (
                <>
                  <div className="nl-3d-desc-name">记录增长</div>
                  <div className="nl-3d-desc-sub">最近加入的记录位于较旧记录之上。</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
