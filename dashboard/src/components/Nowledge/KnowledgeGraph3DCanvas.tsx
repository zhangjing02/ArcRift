import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GraphData, GraphNode } from "../../types";

interface KnowledgeGraph3DCanvasProps {
  data: GraphData;
  selectedNode: GraphNode | null;
  onNodeSelect: (node: GraphNode) => void;
  getNodeColor: (type?: string) => string;
}

export type HeightMetric = "influence" | "structure" | "morphology" | "growth";
export type ViewMode3D = "terrain" | "galaxy";

interface Node3DEntry {
  raw: GraphNode;
  id: string;
  degree: number;
  influencePercent: number;
  color: string;
  threeColor: THREE.Color;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  meshGroup: THREE.Group;
  labelSprite?: THREE.Sprite;
  isPeak: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Strata & Dimension Configuration (1:1 with Nowledge Mem Screenshot 1, 2, 3)
// ─────────────────────────────────────────────────────────────────────────────
const METRIC_CONFIG: Record<
  HeightMetric,
  {
    title: string;
    name: string;
    description: string;
    levels: Array<{ label: string; height: number; yPercent: number }>;
  }
> = {
  influence: {
    title: "影响力地形",
    name: "影响力",
    description: "高处代表更重要、连接更强的知识。",
    levels: [
      { label: "核心枢纽", height: 270, yPercent: 86 },
      { label: "主结构", height: 190, yPercent: 64 },
      { label: "普通节点", height: 110, yPercent: 44 },
      { label: "外围边缘", height: 25, yPercent: 18 },
    ],
  },
  structure: {
    title: "结构深度",
    name: "结构",
    description: "外围节点逐步移除后，越高的节点越能保持连接。",
    levels: [
      { label: "核心内圈", height: 270, yPercent: 86 },
      { label: "主结构层", height: 190, yPercent: 64 },
      { label: "桥接层", height: 110, yPercent: 44 },
      { label: "离散外圈", height: 25, yPercent: 18 },
    ],
  },
  morphology: {
    title: "知识形态",
    name: "形态",
    description: "高度从原始凭据逐步走向可用知识。",
    levels: [
      { label: "技能", height: 270, yPercent: 86 },
      { label: "实体", height: 190, yPercent: 64 },
      { label: "记忆单元", height: 110, yPercent: 44 },
      { label: "轨迹", height: 25, yPercent: 18 },
    ],
  },
  growth: {
    title: "记录增长",
    name: "增长",
    description: "最近加入的记录位于较旧记录之上。",
    levels: [
      { label: "现在", height: 270, yPercent: 86 },
      { label: "7 天", height: 190, yPercent: 64 },
      { label: "30 天", height: 110, yPercent: 44 },
      { label: "1 年以上", height: 25, yPercent: 18 },
    ],
  },
};

// Create clean floating 2-line text sprite (1:1 with Screenshot 1: Title + "🔵 memory · 影响力 85%")
function createTextSprite(
  rawText: string,
  typeStr: string = "memory",
  influencePercent: number = 85,
  color: string = "#ffffff"
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 512;
  canvas.height = 80;

  const cleanText = rawText
    .replace(/^tag:/, "")
    .replace(/^[0-9a-fA-F-]{36}\s*/, "")
    .trim();
  const text = cleanText.length > 20 ? cleanText.slice(0, 18) + "…" : cleanText;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Line 1: Title
  ctx.font = "600 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color || "#f8fafc";
  ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
  ctx.shadowBlur = 4;
  ctx.fillText(text, canvas.width / 2, 24);

  // Line 2: Subtitle with type & real computed influence %
  ctx.font = "400 12.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.shadowBlur = 3;
  ctx.fillText(`${typeStr || "memory"} · 影响力 ${influencePercent}%`, canvas.width / 2, 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(38, 5.9, 1);
  return sprite;
}

// Generate organic contour loop points at specific elevation
function createOrganicContourLoop(
  centerX: number,
  centerZ: number,
  radiusX: number,
  radiusZ: number,
  pointsCount = 56,
  jitter = 0.15
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= pointsCount; i++) {
    const angle = (i / pointsCount) * Math.PI * 2;
    const harmonic = 1 + Math.sin(angle * 3 + 1.2) * jitter + Math.cos(angle * 5 - 0.7) * (jitter * 0.45);
    const x = centerX + Math.cos(angle) * Math.max(10, radiusX) * harmonic;
    const z = centerZ + Math.sin(angle) * Math.max(8, radiusZ) * harmonic;
    points.push(new THREE.Vector3(x, 0, z));
  }
  return points;
}

export const KnowledgeGraph3DCanvas: React.FC<KnowledgeGraph3DCanvasProps> = ({
  data,
  selectedNode,
  onNodeSelect,
  getNodeColor,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode3D>("terrain");
  const [heightMetric, setHeightMetric] = useState<HeightMetric>("influence");
  const [hoveredNode, setHoveredNode] = useState<{
    label: string;
    type?: string;
    color: string;
    degree: number;
    influencePercent: number;
  } | null>(null);

  // Stable callbacks / references
  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;

  const getNodeColorRef = useRef(getNodeColor);
  getNodeColorRef.current = getNodeColor;

  const selectedNodeRef = useRef<GraphNode | null>(selectedNode);
  selectedNodeRef.current = selectedNode;

  // Three.js Core Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const contoursGroupRef = useRef<THREE.Group | null>(null);

  // Graph Data & Object References
  const nodeEntriesRef = useRef<Map<string, Node3DEntry>>(new Map());
  const linksMeshRef = useRef<THREE.LineSegments | null>(null);
  const linksDataRef = useRef<any[]>([]);

  const raycasterRef = useRef(new THREE.Raycaster());
  const mousePosRef = useRef(new THREE.Vector2(-999, -999));
  const isPointerDownRef = useRef(false);
  const pointerDownPosRef = useRef({ x: 0, y: 0 });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Rigorous Multi-Dimensional Mathematics (PageRank, K-Core, Morphology, Growth)
  // ─────────────────────────────────────────────────────────────────────────
  const computeTargetPositionsAndLandscape = useCallback(
    (nodes: GraphNode[], links: any[], metric: HeightMetric, mode: ViewMode3D) => {
      const totalNodes = nodes.length;
      if (totalNodes === 0) {
        return {
          targetMap: new Map<string, { x: number; y: number; z: number }>(),
          influenceMap: new Map<string, number>(),
          mountains: [] as any[],
          steppingStones: [] as Array<{ x: number; z: number; y: number }>,
          peakNodes: new Set<string>(),
        };
      }

      // 1. Degree Centrality & Adjacency Map
      const adjSet = new Map<string, Set<string>>();
      nodes.forEach((n) => adjSet.set(n.id, new Set()));

      const degreeMap = new Map<string, number>();
      links.forEach((l: any) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        if (adjSet.has(src) && adjSet.has(tgt) && src !== tgt) {
          adjSet.get(src)!.add(tgt);
          adjSet.get(tgt)!.add(src);
        }
        degreeMap.set(src, (degreeMap.get(src) || 0) + 1);
        degreeMap.set(tgt, (degreeMap.get(tgt) || 0) + 1);
      });
      const maxDegree = Math.max(1, ...Array.from(degreeMap.values()));

      // 2. Power Iteration PageRank Algorithm (Damping = 0.85, 20 iterations)
      const N = nodes.length;
      let pr = new Map<string, number>();
      nodes.forEach((n) => pr.set(n.id, 1 / N));
      const damping = 0.85;

      for (let iter = 0; iter < 20; iter++) {
        const newPr = new Map<string, number>();
        nodes.forEach((n) => newPr.set(n.id, (1 - damping) / N));
        links.forEach((l: any) => {
          const srcId = typeof l.source === "object" ? l.source.id : l.source;
          const tgtId = typeof l.target === "object" ? l.target.id : l.target;
          const srcDeg = degreeMap.get(srcId) || 1;
          const tgtDeg = degreeMap.get(tgtId) || 1;
          newPr.set(tgtId, (newPr.get(tgtId) || 0) + damping * ((pr.get(srcId) || 0) / srcDeg));
          newPr.set(srcId, (newPr.get(srcId) || 0) + damping * ((pr.get(tgtId) || 0) / tgtDeg));
        });
        pr = newPr;
      }
      const maxPr = Math.max(1e-5, ...Array.from(pr.values()));

      // 3. Composite Influence Score Computation (0 ~ 100%)
      const influenceMap = new Map<string, number>();
      nodes.forEach((n) => {
        const baseImp =
          typeof (n as any).importance === "number"
            ? (n as any).importance
            : typeof (n as any).importance === "string"
            ? parseFloat((n as any).importance) || 0.6
            : 0.6;
        const prRatio = (pr.get(n.id) || 0) / maxPr;
        const degRatio = (degreeMap.get(n.id) || 1) / maxDegree;

        // Weighted Composite Influence
        const rawScore = 0.15 + baseImp * 0.45 + prRatio * 0.28 + degRatio * 0.12;
        const influencePercent = Math.min(99, Math.max(12, Math.round(rawScore * 100)));
        influenceMap.set(n.id, influencePercent);
      });

      // 4. K-Core Peeling Algorithm (结构深度)
      const degMap = new Map<string, number>();
      nodes.forEach((n) => degMap.set(n.id, adjSet.get(n.id)!.size));

      const kCoreMap = new Map<string, number>();
      let curK = 1;
      const unpeeled = new Set(nodes.map((n) => n.id));

      while (unpeeled.size > 0 && curK <= 10) {
        let hasRemoval = true;
        while (hasRemoval) {
          hasRemoval = false;
          const toPeel: string[] = [];
          for (const nid of unpeeled) {
            if ((degMap.get(nid) || 0) < curK) {
              toPeel.push(nid);
            }
          }
          if (toPeel.length > 0) {
            hasRemoval = true;
            for (const pid of toPeel) {
              unpeeled.delete(pid);
              kCoreMap.set(pid, Math.max(0, curK - 1));
              const neighbors = adjSet.get(pid) || new Set();
              for (const nbr of neighbors) {
                if (unpeeled.has(nbr)) {
                  degMap.set(nbr, Math.max(0, (degMap.get(nbr) || 1) - 1));
                }
              }
            }
          }
        }
        curK++;
      }
      unpeeled.forEach((nid) => kCoreMap.set(nid, curK - 1));
      const maxK = Math.max(1, ...Array.from(kCoreMap.values()));

      // 5. Cluster Grouping by Project / Topic
      const clusterAssignment = new Map<string, string>();
      nodes.forEach((n) => {
        const sid = (n as any).sessionId || (n.id.startsWith("tag:") ? n.id.slice(4) : "ArcRift");
        let cluster = "ArcRift";
        if (sid.toLowerCase().includes("wechat")) cluster = "WechatBot";
        else if (sid.toLowerCase().includes("workflow")) cluster = "Workflow";
        else if (sid.toLowerCase().includes("notion")) cluster = "NotionAI";
        else if (sid.toLowerCase().includes("bebe")) cluster = "BeBeBus";
        clusterAssignment.set(n.id, cluster);
      });

      // Major Mountains with independent centers
      const mountainBases = [
        { id: "ArcRift", cx: 120, cz: -30, baseRadiusX: 135, baseRadiusZ: 105 },
        { id: "WechatBot", cx: -170, cz: -60, baseRadiusX: 110, baseRadiusZ: 85 },
        { id: "Workflow", cx: -20, cz: 55, baseRadiusX: 120, baseRadiusZ: 90 },
      ];

      // Compute peak node and actual peak height for each mountain
      const mountains = mountainBases.map((m) => {
        const mNodes = nodes.filter((n) => clusterAssignment.get(n.id) === m.id);
        let peakNode = mNodes[0];
        let maxInf = 50;
        mNodes.forEach((n) => {
          const inf = influenceMap.get(n.id) || 50;
          if (inf > maxInf) {
            maxInf = inf;
            peakNode = n;
          }
        });

        // Actual Peak Height calculated strictly from its Max Influence!
        const peakY = (maxInf / 100) * 255 + 20;

        return {
          ...m,
          peakNodeId: peakNode ? peakNode.id : null,
          maxInfluence: maxInf,
          peakY,
          nodes: mNodes,
        };
      });

      const peakNodes = new Set<string>();
      mountains.forEach((m) => {
        if (m.peakNodeId) peakNodes.add(m.peakNodeId);
      });

      // Timestamps sorted for Growth Horizon
      const timestamps = nodes
        .map((n) => ((n as any).firstSeen ? new Date((n as any).firstSeen).getTime() : Date.now()))
        .sort((a, b) => b - a);
      const minTs = timestamps[timestamps.length - 1] || Date.now();
      const maxTs = timestamps[0] || Date.now();
      const tsRange = Math.max(1, maxTs - minTs);

      const targetMap = new Map<string, { x: number; y: number; z: number }>();
      const steppingStones: Array<{ x: number; z: number; y: number }> = [];

      // Stepping stone grid in the foreground (Screenshot 2)
      const stonePositions = [
        { x: 50, z: 120 }, { x: 110, z: 135 }, { x: 170, z: 110 }, { x: 220, z: 140 },
        { x: -90, z: 130 }, { x: -140, z: 150 }, { x: -190, z: 120 }, { x: -240, z: 150 },
        { x: 20, z: 175 }, { x: 80, z: 195 }, { x: 140, z: 180 }, { x: 200, z: 210 },
        { x: -50, z: 190 }, { x: -110, z: 215 }, { x: -170, z: 190 }, { x: -220, z: 230 },
        { x: 0, z: 240 }, { x: 60, z: 260 }, { x: 120, z: 250 }, { x: -70, z: 265 },
      ];

      let stoneIndex = 0;

      nodes.forEach((n, i) => {
        const inf = influenceMap.get(n.id) || 50;
        const cId = clusterAssignment.get(n.id) || "ArcRift";
        const m = mountains.find((mt) => mt.id === cId) || mountains[0];

        if (mode === "galaxy") {
          const phi = Math.acos(-1 + (2 * i) / totalNodes);
          const theta = Math.sqrt(totalNodes * Math.PI) * phi;
          const r = 160 + (inf / 100) * 60;
          targetMap.set(n.id, {
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.cos(phi) * 0.7,
            z: r * Math.sin(phi) * Math.sin(theta),
          });
          return;
        }

        // Calculate Y elevation strictly according to the active Dimension
        let ty = 25;
        if (metric === "influence") {
          // Height strictly determined by Influence Score (0 ~ 100% -> 20 ~ 275px)
          ty = (inf / 100) * 255 + 20;
        } else if (metric === "structure") {
          // K-Core Peeling Depth
          const kc = kCoreMap.get(n.id) || 0;
          const deg = degreeMap.get(n.id) || 0;
          if (kc >= maxK && maxK >= 2) {
            ty = 250 + (deg / maxDegree) * 20; // 核心内圈
          } else if (kc >= Math.ceil(maxK * 0.6)) {
            ty = 175 + (deg / maxDegree) * 20; // 主结构层
          } else if (kc >= 1) {
            ty = 100 + (deg / maxDegree) * 15; // 桥接层
          } else {
            ty = 20 + Math.random() * 10; // 离散外圈
          }
        } else if (metric === "morphology") {
          const t = (n.type || "").toLowerCase();
          const cat = ((n as any).category || "").toLowerCase();
          if (t.includes("rule") || t.includes("arch") || t.includes("skill")) {
            ty = 265 + (Math.random() - 0.5) * 8; // 技能
          } else if (t.includes("project") || t.includes("entity") || t.includes("concept") || cat.includes("project") || n.id.startsWith("tag:")) {
            ty = 185 + (Math.random() - 0.5) * 8; // 实体/项目
          } else if (t.includes("memory") || t.includes("decision") || t.includes("fact")) {
            ty = 105 + (Math.random() - 0.5) * 8; // 记忆单元
          } else {
            ty = 25 + (Math.random() - 0.5) * 6; // 轨迹/对话
          }
        } else if (metric === "growth") {
          const created = (n as any).firstSeen ? new Date((n as any).firstSeen).getTime() : Date.now();
          const ageRatio = (created - minTs) / tsRange; // 1 = latest, 0 = oldest
          ty = 25 + ageRatio * 245; // Smooth continuous time horizon
        }

        // Calculate X, Z planar position
        if (peakNodes.has(n.id)) {
          targetMap.set(n.id, { x: m.cx, y: ty, z: m.cz });
        } else if (inf >= 38 || ty >= 50) {
          // Mountain slope node
          const radiusScale = Math.max(0.2, 1 - (ty / m.peakY) * 0.75);
          const angle = (i * 1.37) % (Math.PI * 2);
          const rx = m.baseRadiusX * radiusScale * 0.6;
          const rz = m.baseRadiusZ * radiusScale * 0.6;
          const tx = m.cx + Math.cos(angle) * rx;
          const tz = m.cz + Math.sin(angle) * rz;

          targetMap.set(n.id, { x: tx, y: ty, z: tz });
        } else {
          // Peripheral base node sitting on stepping stone pad (Screenshot 2)
          const stone = stonePositions[stoneIndex % stonePositions.length];
          stoneIndex++;
          const tx = stone.x + (Math.random() - 0.5) * 8;
          const tz = stone.z + (Math.random() - 0.5) * 8;

          targetMap.set(n.id, { x: tx, y: ty, z: tz });
          steppingStones.push({ x: tx, z: tz, y: ty });
        }
      });

      return {
        targetMap,
        influenceMap,
        mountains,
        steppingStones,
        peakNodes,
      };
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Initialize Three.js Scene, High Isometric Camera & Controls
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c0f17");
    scene.fog = new THREE.FogExp2("#0c0f17", 0.0009);
    sceneRef.current = scene;

    // Camera: High Isometric Pitch Angle (~48° looking down, 1:1 with Screenshot 2)
    const camera = new THREE.PerspectiveCamera(38, width / height, 1, 3000);
    camera.position.set(380, 480, 520);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 1500;
    controls.minDistance = 140;
    controls.target.set(0, 90, 40);
    controlsRef.current = controls;

    // Ambient Moonlight
    const ambientLight = new THREE.AmbientLight("#e0f2fe", 0.95);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight("#ffffff", 0.85);
    dirLight.position.set(200, 450, 200);
    scene.add(dirLight);

    // Contours Group
    const contoursGroup = new THREE.Group();
    scene.add(contoursGroup);
    contoursGroupRef.current = contoursGroup;

    // Raycaster Pointer Events
    const handlePointerDown = (e: PointerEvent) => {
      isPointerDownRef.current = true;
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mousePosRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePosRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerUp = (e: PointerEvent) => {
      isPointerDownRef.current = false;
      const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
      const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);
      if (dx < 5 && dy < 5) {
        raycasterRef.current.setFromCamera(mousePosRef.current, camera);
        const meshes: THREE.Object3D[] = [];
        nodeEntriesRef.current.forEach((entry) => {
          meshes.push(entry.meshGroup.children[0]);
        });

        const intersects = raycasterRef.current.intersectObjects(meshes, false);
        if (intersects.length > 0) {
          const hitMesh = intersects[0].object;
          const hitGroup = hitMesh.parent;
          if (hitGroup && hitGroup.userData && hitGroup.userData.nodeId) {
            const hitId = hitGroup.userData.nodeId;
            const entry = nodeEntriesRef.current.get(hitId);
            if (entry) {
              onNodeSelectRef.current(entry.raw);
            }
          }
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // Animation Loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      const entries = nodeEntriesRef.current;

      // Smooth Morphing of Node Positions
      entries.forEach((entry) => {
        entry.currentPos.lerp(entry.targetPos, 0.08);
        entry.meshGroup.position.copy(entry.currentPos);
      });

      // Update Link Line Positions
      if (linksMeshRef.current && linksDataRef.current) {
        const posAttr = linksMeshRef.current.geometry.attributes.position as THREE.BufferAttribute;
        if (posAttr) {
          const array = posAttr.array as Float32Array;
          let idx = 0;

          linksDataRef.current.forEach((l: any) => {
            const srcId = typeof l.source === "object" ? l.source.id : l.source;
            const tgtId = typeof l.target === "object" ? l.target.id : l.target;
            const src = entries.get(srcId);
            const tgt = entries.get(tgtId);

            if (src && tgt && idx + 5 < array.length) {
              array[idx++] = src.currentPos.x;
              array[idx++] = src.currentPos.y;
              array[idx++] = src.currentPos.z;
              array[idx++] = tgt.currentPos.x;
              array[idx++] = tgt.currentPos.y;
              array[idx++] = tgt.currentPos.z;
            }
          });
          posAttr.needsUpdate = true;
        }
      }

      // Hover Raycasting
      raycasterRef.current.setFromCamera(mousePosRef.current, camera);
      const meshes: THREE.Object3D[] = [];
      entries.forEach((entry) => {
        meshes.push(entry.meshGroup.children[0]);
      });

      const intersects = raycasterRef.current.intersectObjects(meshes, false);
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const hitGroup = hitMesh.parent;
        if (hitGroup && hitGroup.userData && hitGroup.userData.nodeId) {
          const hitId = hitGroup.userData.nodeId;
          const entry = entries.get(hitId);
          if (entry) {
            setHoveredNode({
              label: (entry.raw as any).label || (entry.raw as any).title || (entry.raw as any).name || entry.raw.id,
              type: entry.raw.type,
              color: entry.color,
              degree: entry.degree,
              influencePercent: entry.influencePercent,
            });
            renderer.domElement.style.cursor = "pointer";
          }
        }
      } else {
        setHoveredNode(null);
        renderer.domElement.style.cursor = "default";
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Synchronize Graph Objects & Differentiated Mountain Contours
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !data.nodes || data.nodes.length === 0) return;

    linksDataRef.current = data.links || [];
    const { targetMap, influenceMap, mountains, steppingStones, peakNodes } = computeTargetPositionsAndLandscape(
      data.nodes,
      data.links,
      heightMetric,
      viewMode
    );

    const degreeMap = new Map<string, number>();
    data.links.forEach((l: any) => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      degreeMap.set(src, (degreeMap.get(src) || 0) + 1);
      degreeMap.set(tgt, (degreeMap.get(tgt) || 0) + 1);
    });

    const existingMap = nodeEntriesRef.current;
    const currentIds = new Set(data.nodes.map((n) => n.id));

    // Remove deleted nodes
    existingMap.forEach((entry, id) => {
      if (!currentIds.has(id)) {
        scene.remove(entry.meshGroup);
        existingMap.delete(id);
      }
    });

    // Add or update nodes
    data.nodes.forEach((n) => {
      const deg = degreeMap.get(n.id) || 1;
      const inf = influenceMap.get(n.id) || 50;
      const colStr = getNodeColorRef.current(n.type);
      const threeCol = new THREE.Color(colStr);
      const isPeak = peakNodes.has(n.id);
      const radius = isPeak ? 3.6 : Math.max(1.8, Math.min(2.8, 1.8 + Math.sqrt(deg) * 0.35));
      const target = targetMap.get(n.id) || { x: 0, y: 30, z: 0 };
      const targetVec = new THREE.Vector3(target.x, target.y, target.z);

      let entry = existingMap.get(n.id);
      if (entry) {
        entry.raw = n;
        entry.degree = deg;
        entry.influencePercent = inf;
        entry.targetPos.copy(targetVec);
      } else {
        const group = new THREE.Group();
        group.userData = { nodeId: n.id };

        // Micro-Sphere Star Point (Clean gemstone feel)
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 16, 16),
          new THREE.MeshStandardMaterial({
            color: threeCol,
            emissive: threeCol,
            emissiveIntensity: 0.75,
            roughness: 0.2,
            metalness: 0.1,
          })
        );
        group.add(sphere);

        // Faint Subtle Glow
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 1.5, 12, 12),
          new THREE.MeshBasicMaterial({
            color: threeCol,
            transparent: true,
            opacity: 0.08,
            side: THREE.BackSide,
            depthWrite: false,
          })
        );
        group.add(halo);

        // Only Peak Nodes show clean White Billboard Text Sprite (with real calculated Influence %)
        let labelSprite: THREE.Sprite | undefined;
        if (isPeak) {
          const nodeLabel = (n as any).label || (n as any).title || (n as any).name || n.id;
          labelSprite = createTextSprite(nodeLabel, n.type || "memory", inf, "#f8fafc");
          labelSprite.position.set(0, radius + 8, 0);
          group.add(labelSprite);
        }

        const initialPos = new THREE.Vector3(target.x, target.y, target.z);
        group.position.copy(initialPos);
        scene.add(group);

        entry = {
          raw: n,
          id: n.id,
          degree: deg,
          influencePercent: inf,
          color: colStr,
          threeColor: threeCol,
          currentPos: initialPos,
          targetPos: targetVec,
          meshGroup: group,
          labelSprite,
          isPeak,
        };
        existingMap.set(n.id, entry);
      }
    });

    // Rebuild Link Lines (Delicate & barely visible to keep landscape clean)
    if (linksMeshRef.current) scene.remove(linksMeshRef.current);

    const linkPositions: number[] = [];
    const linkColors: number[] = [];

    data.links.forEach((l: any) => {
      const srcId = typeof l.source === "object" ? l.source.id : l.source;
      const tgtId = typeof l.target === "object" ? l.target.id : l.target;
      const src = existingMap.get(srcId);
      const tgt = existingMap.get(tgtId);
      if (src && tgt) {
        linkPositions.push(src.currentPos.x, src.currentPos.y, src.currentPos.z);
        linkPositions.push(tgt.currentPos.x, tgt.currentPos.y, tgt.currentPos.z);

        linkColors.push(src.threeColor.r * 0.3, src.threeColor.g * 0.3, src.threeColor.b * 0.3);
        linkColors.push(tgt.threeColor.r * 0.3, tgt.threeColor.g * 0.3, tgt.threeColor.b * 0.3);
      }
    });

    const linksGeo = new THREE.BufferGeometry();
    linksGeo.setAttribute("position", new THREE.Float32BufferAttribute(linkPositions, 3));
    linksGeo.setAttribute("color", new THREE.Float32BufferAttribute(linkColors, 3));

    const linksMesh = new THREE.LineSegments(
      linksGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.04 })
    );
    scene.add(linksMesh);
    linksMeshRef.current = linksMesh;

    // ─────────────────────────────────────────────────────────────────────
    // Rebuild Differentiated Mountain Contours (Each mountain peaks at its own height!)
    // ─────────────────────────────────────────────────────────────────────
    if (contoursGroupRef.current) {
      const cGroup = contoursGroupRef.current;
      while (cGroup.children.length > 0) {
        cGroup.remove(cGroup.children[0]);
      }

      if (viewMode === "terrain") {
        const standardElevationLevels = [28, 65, 105, 145, 185, 225, 265];

        // 1. Each mountain renders contours only up to its own peak height!
        mountains.forEach((m) => {
          const mountainTiers = standardElevationLevels.filter((lvlY) => lvlY <= m.peakY + 10);

          mountainTiers.forEach((tierY, idx) => {
            const isSummit = idx === mountainTiers.length - 1;
            const progress = (tierY - 28) / Math.max(1, m.peakY - 28);
            const scale = Math.max(0.18, 1.4 - progress * 1.15);

            const rx = isSummit ? 20 : m.baseRadiusX * scale;
            const rz = isSummit ? 14 : m.baseRadiusZ * scale;
            const opacity = 0.10 + progress * 0.30;

            const points = createOrganicContourLoop(m.cx, m.cz, rx, rz, 56, 0.14);
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({
              color: new THREE.Color("#93c5fd"),
              transparent: true,
              opacity,
            });
            const lineLoop = new THREE.LineLoop(geo, mat);
            lineLoop.position.y = isSummit ? m.peakY : tierY;
            cGroup.add(lineLoop);
          });
        });

        // 2. Stepping Stone Island Pads in Foreground (Screenshot 2)
        steppingStones.forEach((st) => {
          const padPoints = createOrganicContourLoop(st.x, st.z, 16, 12, 24, 0.18);
          const geo = new THREE.BufferGeometry().setFromPoints(padPoints);
          const mat = new THREE.LineBasicMaterial({
            color: new THREE.Color("#94a3b8"),
            transparent: true,
            opacity: 0.24,
          });
          const lineLoop = new THREE.LineLoop(geo, mat);
          lineLoop.position.y = st.y - 4;
          cGroup.add(lineLoop);
        });
      }
    }
  }, [data, heightMetric, viewMode, computeTargetPositionsAndLandscape]);

  const currentMetric = METRIC_CONFIG[heightMetric];

  return (
    <div className="nl-graph-3d-wrapper" style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* 3D Canvas Mount Point */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* ─────────────────────────────────────────────────────────────
          1. LEFT ELEVATION STRATA HUD (1:1 with Screenshot 2)
      ───────────────────────────────────────────────────────────── */}
      {viewMode === "terrain" && (
        <div className="nl-3d-left-strata-hud">
          {currentMetric.levels.map((lvl, idx) => (
            <div
              key={idx}
              className="nl-strata-level-row"
              style={{
                position: "absolute",
                top: `${100 - lvl.yPercent}%`,
                left: 20,
              }}
            >
              <span className="nl-strata-label">{lvl.label}</span>
              <div className="nl-strata-tick-line" />
            </div>
          ))}
        </div>
      )}

      {/* Hover Node Tooltip with Computed Influence % */}
      {hoveredNode && (
        <div className="nl-3d-hover-tooltip">
          <span className="nl-3d-tooltip-dot" style={{ backgroundColor: hoveredNode.color }} />
          <span className="nl-3d-tooltip-title">{hoveredNode.label}</span>
          <span className="nl-3d-tooltip-meta">
            ({hoveredNode.type || "memory"} · 影响力 {hoveredNode.influencePercent}%)
          </span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. BOTTOM-RIGHT 4D CONTROLLER (Pure Text 1:1 with Nowledge Mem)
      ───────────────────────────────────────────────────────────── */}
      <div className="nl-3d-control-widget">
        {/* Top View Mode Switcher: [ 地形 ] | [ 知识星图 ] */}
        <div className="nl-3d-viewmode-pill-container">
          <button
            className={`nl-3d-viewmode-pill ${viewMode === "terrain" ? "active" : ""}`}
            onClick={() => setViewMode("terrain")}
          >
            地形
          </button>
          <button
            className={`nl-3d-viewmode-pill ${viewMode === "galaxy" ? "active" : ""}`}
            onClick={() => setViewMode("galaxy")}
          >
            知识星图
          </button>
        </div>

        {/* Height Dimension Section */}
        {viewMode === "terrain" && (
          <>
            <div className="nl-3d-metric-header">高度代表什么？</div>

            {/* Single Horizontal Row of 4 Dimension Pills (Pure Text) */}
            <div className="nl-3d-metric-horizontal-row">
              {(Object.keys(METRIC_CONFIG) as HeightMetric[]).map((key) => {
                const cfg = METRIC_CONFIG[key];
                const isActive = heightMetric === key;
                return (
                  <button
                    key={key}
                    className={`nl-3d-metric-inline-btn ${isActive ? "active" : ""}`}
                    onClick={() => setHeightMetric(key)}
                  >
                    {cfg.name}
                  </button>
                );
              })}
            </div>

            {/* Dynamic Explanatory Footer (No boxes, pure clean text) */}
            <div className="nl-3d-metric-caption-group">
              <div className="nl-metric-caption-title">{currentMetric.title}</div>
              <div className="nl-metric-caption-desc">{currentMetric.description}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
