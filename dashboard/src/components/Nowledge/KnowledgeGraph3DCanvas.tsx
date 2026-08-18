import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as d3 from "d3-force";
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
  color: string;
  threeColor: THREE.Color;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  meshGroup: THREE.Group;
  labelSprite?: THREE.Sprite;
  isPeak: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Strata & Dimension Configuration (1:1 with Nowledge Mem Screenshot 1)
// ─────────────────────────────────────────────────────────────────────────────
const METRIC_CONFIG: Record<
  HeightMetric,
  {
    title: string;
    name: string;
    icon: string;
    description: string;
    levels: Array<{ label: string; height: number; yPercent: number }>;
  }
> = {
  influence: {
    title: "影响力地形",
    name: "影响力",
    icon: "⛰️",
    description: "高处代表更重要、连接更强的知识。",
    levels: [
      { label: "核心枢纽", height: 230, yPercent: 82 },
      { label: "主结构", height: 160, yPercent: 62 },
      { label: "普通节点", height: 95, yPercent: 42 },
      { label: "外围边缘", height: 25, yPercent: 18 },
    ],
  },
  structure: {
    title: "结构深度",
    name: "结构",
    icon: "⚙️",
    description: "外围节点逐步移除后，越高的节点越能保持连接。",
    levels: [
      { label: "核心内圈", height: 230, yPercent: 82 },
      { label: "主结构层", height: 160, yPercent: 62 },
      { label: "桥接层", height: 95, yPercent: 42 },
      { label: "离散外圈", height: 25, yPercent: 18 },
    ],
  },
  morphology: {
    title: "知识形态",
    name: "形态",
    icon: "❄️",
    description: "高度从原始凭据逐步走向可用知识。",
    levels: [
      { label: "技能", height: 230, yPercent: 82 },
      { label: "实体", height: 160, yPercent: 62 },
      { label: "记忆单元", height: 95, yPercent: 42 },
      { label: "轨迹", height: 25, yPercent: 18 },
    ],
  },
  growth: {
    title: "记录增长",
    name: "增长",
    icon: "🕒",
    description: "最近加入的记录位于较旧记录之上。",
    levels: [
      { label: "现在", height: 230, yPercent: 82 },
      { label: "7 天", height: 160, yPercent: 62 },
      { label: "30 天", height: 95, yPercent: 42 },
      { label: "1 年以上", height: 25, yPercent: 18 },
    ],
  },
};

// Create clean, minimalist floating text sprite for peak nodes (1:1 with Screenshot 1)
function createTextSprite(rawText: string, color: string = "#ffffff"): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 512;
  canvas.height = 64;

  const cleanText = rawText
    .replace(/^tag:/, "")
    .replace(/^[0-9a-fA-F-]{36}\s*/, "")
    .trim();
  const text = cleanText.length > 20 ? cleanText.slice(0, 18) + "…" : cleanText;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Minimalist text with subtle shadow
  ctx.font = "500 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color || "#f1f5f9";
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 4;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(36, 4.5, 1);
  return sprite;
}

// Generate organic contour loop points at specific elevation
function createOrganicContourLoop(
  centerX: number,
  centerZ: number,
  radiusX: number,
  radiusZ: number,
  pointsCount = 48,
  jitter = 0.16
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= pointsCount; i++) {
    const angle = (i / pointsCount) * Math.PI * 2;
    // Harmonic wave for natural organic isoline curvature
    const harmonic = 1 + Math.sin(angle * 3 + 1.2) * jitter + Math.cos(angle * 4 - 0.8) * (jitter * 0.45);
    const x = centerX + Math.cos(angle) * Math.max(12, radiusX) * harmonic;
    const z = centerZ + Math.sin(angle) * Math.max(10, radiusZ) * harmonic;
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
  const [hoveredNode, setHoveredNode] = useState<{ label: string; type?: string; color: string; degree: number } | null>(null);

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
  // 1. Cluster-Aware Target Position Generator
  // ─────────────────────────────────────────────────────────────────────────
  const computeTargetPositionsAndClusters = useCallback(
    (nodes: GraphNode[], links: any[], metric: HeightMetric, mode: ViewMode3D) => {
      const totalNodes = nodes.length;
      if (totalNodes === 0) {
        return {
          targetMap: new Map<string, { x: number; y: number; z: number }>(),
          clusters: [] as Array<{ id: string; center: { cx: number; cz: number }; nodes: Array<{ id: string; x: number; z: number; y: number }> }>,
          peakNodes: new Set<string>(),
        };
      }

      const degreeMap = new Map<string, number>();
      links.forEach((l: any) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        degreeMap.set(src, (degreeMap.get(src) || 0) + 1);
        degreeMap.set(tgt, (degreeMap.get(tgt) || 0) + 1);
      });
      const maxDegree = Math.max(1, ...Array.from(degreeMap.values()));

      // Identify major clusters (e.g. ArcRift, WechatBot, NotionAI, Workflow, etc.)
      const clusterAssignment = new Map<string, string>();
      nodes.forEach((n) => {
        const sid = (n as any).sessionId || (n.id.startsWith("tag:") ? n.id.slice(4) : "default");
        clusterAssignment.set(n.id, sid);
      });

      // Cluster centers in 2D plane
      const distinctClusters = Array.from(new Set(clusterAssignment.values()));
      const clusterCenterOffsets = new Map<string, { cx: number; cz: number }>();

      const clusterOffsetsList = [
        { cx: 80, cz: 40 },    // Right Peak (ArcRift)
        { cx: -130, cz: -50 }, // Left Peak (WechatBot / NotionAI)
        { cx: -20, cz: 110 },  // Front Peak (Workflow)
        { cx: 140, cz: -90 },  // Far Right (AndroidDev)
        { cx: -120, cz: 90 },  // Front Left (BeBeBus)
      ];

      distinctClusters.forEach((cId, idx) => {
        const off = clusterOffsetsList[idx % clusterOffsetsList.length];
        clusterCenterOffsets.set(cId, off);
      });

      // 2D force simulation for intra-cluster natural distribution
      const simNodes = nodes.map((n) => {
        const cId = clusterAssignment.get(n.id) || "default";
        const cCenter = clusterCenterOffsets.get(cId) || { cx: 0, cz: 0 };
        return {
          id: n.id,
          x: cCenter.cx + (Math.random() - 0.5) * 80,
          y: cCenter.cz + (Math.random() - 0.5) * 80,
        };
      });

      const simLinks = links.map((l) => ({
        source: typeof l.source === "object" ? l.source.id : l.source,
        target: typeof l.target === "object" ? l.target.id : l.target,
      }));

      const sim = d3
        .forceSimulation(simNodes as any)
        .force("charge", d3.forceManyBody().strength(-100))
        .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(38))
        .force("collision", d3.forceCollide().radius(18))
        .stop();

      for (let i = 0; i < 90; i++) sim.tick();

      const planarCoords = new Map<string, { x: number; z: number }>();
      simNodes.forEach((sn: any) => {
        planarCoords.set(sn.id, { x: sn.x || 0, z: sn.y || 0 });
      });

      const targetMap = new Map<string, { x: number; y: number; z: number }>();
      const peakNodes = new Set<string>();

      // Find top peak node for each major cluster
      distinctClusters.forEach((cId) => {
        const clusterNodes = nodes.filter((n) => clusterAssignment.get(n.id) === cId);
        if (clusterNodes.length > 0) {
          clusterNodes.sort((a, b) => (degreeMap.get(b.id) || 1) - (degreeMap.get(a.id) || 1));
          peakNodes.add(clusterNodes[0].id);
        }
      });

      nodes.forEach((n, i) => {
        const deg = degreeMap.get(n.id) || 1;
        const basePlanar = planarCoords.get(n.id) || { x: 0, z: 0 };
        const isPeak = peakNodes.has(n.id);
        const cId = clusterAssignment.get(n.id) || "default";
        const cCenter = clusterCenterOffsets.get(cId) || { cx: 0, cz: 0 };

        let tx = basePlanar.x;
        let tz = basePlanar.z;
        let ty = 25;

        if (mode === "galaxy") {
          const phi = Math.acos(-1 + (2 * i) / totalNodes);
          const theta = Math.sqrt(totalNodes * Math.PI) * phi;
          const r = 160 + (deg / maxDegree) * 60;
          tx = r * Math.sin(phi) * Math.cos(theta);
          ty = r * Math.cos(phi) * 0.7;
          tz = r * Math.sin(phi) * Math.sin(theta);
        } else {
          // Terrain mode
          if (metric === "influence") {
            if (isPeak) {
              ty = 230;
              tx = cCenter.cx;
              tz = cCenter.cz;
            } else {
              const ratio = deg / maxDegree;
              ty = ratio * 190 + 20;
              // Higher nodes gravitate toward their cluster center
              const pull = 0.4 + (1 - ratio) * 0.6;
              tx = cCenter.cx + (basePlanar.x - cCenter.cx) * pull;
              tz = cCenter.cz + (basePlanar.z - cCenter.cz) * pull;
            }
          } else if (metric === "structure") {
            const sorted = [...nodes].sort((a, b) => (degreeMap.get(b.id) || 1) - (degreeMap.get(a.id) || 1));
            const rank = sorted.findIndex((s) => s.id === n.id);
            const tier = Math.floor((rank / Math.max(1, totalNodes)) * 4);
            const ringHeights = [230, 160, 95, 25];
            ty = ringHeights[tier] + (Math.random() - 0.5) * 6;

            const pull = tier === 0 ? 0.2 : tier === 1 ? 0.5 : tier === 2 ? 0.8 : 1.1;
            tx = cCenter.cx + (basePlanar.x - cCenter.cx) * pull;
            tz = cCenter.cz + (basePlanar.z - cCenter.cz) * pull;
          } else if (metric === "morphology") {
            const t = (n.type || "").toLowerCase();
            if (t.includes("rule") || t.includes("arch") || t.includes("skill")) ty = 230;
            else if (t.includes("tech") || t.includes("doc") || t.includes("file") || t.includes("project")) ty = 160;
            else if (t.includes("concept") || t.includes("entity")) ty = 95;
            else if (t.includes("memory") || t.includes("decision")) ty = 50;
            else ty = 25;

            ty += (Math.random() - 0.5) * 5;
          } else if (metric === "growth") {
            const ageRatio = (totalNodes - 1 - i) / Math.max(1, totalNodes - 1);
            if (ageRatio > 0.8) ty = 230;
            else if (ageRatio > 0.55) ty = 160;
            else if (ageRatio > 0.25) ty = 95;
            else ty = 25;

            ty += (Math.random() - 0.5) * 5;
          }
        }

        targetMap.set(n.id, { x: tx, y: ty, z: tz });
      });

      // Group into final cluster objects for contour rendering
      const clusters = distinctClusters.map((cId) => {
        const cCenter = clusterCenterOffsets.get(cId) || { cx: 0, cz: 0 };
        const cNodes = nodes
          .filter((n) => clusterAssignment.get(n.id) === cId)
          .map((n) => {
            const t = targetMap.get(n.id) || { x: 0, y: 0, z: 0 };
            return { id: n.id, x: t.x, z: t.z, y: t.y };
          });
        return {
          id: cId,
          center: cCenter,
          nodes: cNodes,
        };
      });

      return { targetMap, clusters, peakNodes };
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Initialize Three.js Scene, Camera, Orbit Controls
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0d1017");
    scene.fog = new THREE.FogExp2("#0d1017", 0.0011);
    sceneRef.current = scene;

    // Camera (Isometric angle matching Nowledge Mem Screenshot 1)
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 3000);
    camera.position.set(340, 240, 440);
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
    controls.maxDistance = 1400;
    controls.minDistance = 120;
    controls.target.set(-10, 65, 0);
    controlsRef.current = controls;

    // Ambient Lighting (Soft moonlight glow)
    const ambientLight = new THREE.AmbientLight("#e0f2fe", 0.95);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight("#ffffff", 0.85);
    dirLight.position.set(200, 400, 200);
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
  // 3. Synchronize Graph Objects & Multi-Peak Topographic Contours (1:1)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !data.nodes || data.nodes.length === 0) return;

    linksDataRef.current = data.links || [];
    const { targetMap, clusters, peakNodes } = computeTargetPositionsAndClusters(
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
      const colStr = getNodeColorRef.current(n.type);
      const threeCol = new THREE.Color(colStr);
      const isPeak = peakNodes.has(n.id);
      const radius = isPeak ? 3.4 : Math.max(1.8, Math.min(3.0, 1.8 + Math.sqrt(deg) * 0.4));
      const target = targetMap.get(n.id) || { x: 0, y: 30, z: 0 };
      const targetVec = new THREE.Vector3(target.x, target.y, target.z);

      let entry = existingMap.get(n.id);
      if (entry) {
        entry.raw = n;
        entry.degree = deg;
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
            emissiveIntensity: 0.7,
            roughness: 0.2,
            metalness: 0.1,
          })
        );
        group.add(sphere);

        // Faint Subtle Aura
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 1.6, 12, 12),
          new THREE.MeshBasicMaterial({
            color: threeCol,
            transparent: true,
            opacity: 0.08,
            side: THREE.BackSide,
            depthWrite: false,
          })
        );
        group.add(halo);

        // Only Peak Nodes show clean White Billboard Text Sprite
        let labelSprite: THREE.Sprite | undefined;
        if (isPeak) {
          const nodeLabel = (n as any).label || (n as any).title || (n as any).name || n.id;
          labelSprite = createTextSprite(nodeLabel, "#f1f5f9");
          labelSprite.position.set(0, radius + 7, 0);
          group.add(labelSprite);
        }

        const initialPos = new THREE.Vector3(target.x, target.y, target.z);
        group.position.copy(initialPos);
        scene.add(group);

        entry = {
          raw: n,
          id: n.id,
          degree: deg,
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

    // Rebuild Link Lines (Delicate semi-transparent line segments)
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

        linkColors.push(src.threeColor.r * 0.45, src.threeColor.g * 0.45, src.threeColor.b * 0.45);
        linkColors.push(tgt.threeColor.r * 0.45, tgt.threeColor.g * 0.45, tgt.threeColor.b * 0.45);
      }
    });

    const linksGeo = new THREE.BufferGeometry();
    linksGeo.setAttribute("position", new THREE.Float32BufferAttribute(linkPositions, 3));
    linksGeo.setAttribute("color", new THREE.Float32BufferAttribute(linkColors, 3));

    const linksMesh = new THREE.LineSegments(
      linksGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.10 })
    );
    scene.add(linksMesh);
    linksMeshRef.current = linksMesh;

    // ─────────────────────────────────────────────────────────────────────
    // Rebuild Multi-Peak Cluster Contours & Ground Island Pads (1:1 with Screenshot 1)
    // ─────────────────────────────────────────────────────────────────────
    if (contoursGroupRef.current) {
      const cGroup = contoursGroupRef.current;
      while (cGroup.children.length > 0) {
        cGroup.remove(cGroup.children[0]);
      }

      if (viewMode === "terrain") {
        // 1. Render Topographic Ascending Tiers for each Mountain Cluster
        clusters.forEach((cluster) => {
          if (cluster.nodes.length === 0) return;

          const isMajorCluster = cluster.nodes.length >= 3;
          const tierLevels = [
            { y: 230, scale: 0.28, opacity: 0.38 },
            { y: 190, scale: 0.48, opacity: 0.30 },
            { y: 150, scale: 0.72, opacity: 0.24 },
            { y: 110, scale: 0.95, opacity: 0.18 },
            { y: 70, scale: 1.25, opacity: 0.14 },
            { y: 30, scale: 1.55, opacity: 0.10 },
          ];

          // Compute cluster radius in X and Z
          const maxDistX = Math.max(30, ...cluster.nodes.map((n) => Math.abs(n.x - cluster.center.cx)));
          const maxDistZ = Math.max(25, ...cluster.nodes.map((n) => Math.abs(n.z - cluster.center.cz)));

          tierLevels.forEach((tier) => {
            if (!isMajorCluster && tier.y > 150) return;

            const rx = maxDistX * tier.scale + 12;
            const rz = maxDistZ * tier.scale + 10;
            const points = createOrganicContourLoop(cluster.center.cx, cluster.center.cz, rx, rz, 48, 0.16);
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({
              color: new THREE.Color("#7dd3fc"),
              transparent: true,
              opacity: tier.opacity,
            });
            const lineLoop = new THREE.LineLoop(geo, mat);
            lineLoop.position.y = tier.y;
            cGroup.add(lineLoop);
          });
        });

        // 2. Render Tiny Stepping Stone Contour Pads for Peripheral / Ground Nodes (Screenshot 1)
        data.nodes.forEach((n) => {
          const t = targetMap.get(n.id);
          if (t && t.y <= 45 && !peakNodes.has(n.id)) {
            const padPoints = createOrganicContourLoop(t.x, t.z, 14, 11, 20, 0.18);
            const geo = new THREE.BufferGeometry().setFromPoints(padPoints);
            const mat = new THREE.LineBasicMaterial({
              color: new THREE.Color("#94a3b8"),
              transparent: true,
              opacity: 0.22,
            });
            const lineLoop = new THREE.LineLoop(geo, mat);
            lineLoop.position.y = Math.max(10, t.y - 8);
            cGroup.add(lineLoop);
          }
        });
      }
    }
  }, [data, heightMetric, viewMode, computeTargetPositionsAndClusters]);

  const currentMetric = METRIC_CONFIG[heightMetric];

  return (
    <div className="nl-graph-3d-wrapper" style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* 3D Canvas Mount Point */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* ─────────────────────────────────────────────────────────────
          1. LEFT ELEVATION STRATA HUD (1:1 with Screenshot 1)
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

      {/* Hover Node Tooltip */}
      {hoveredNode && (
        <div className="nl-3d-hover-tooltip">
          <span className="nl-3d-tooltip-dot" style={{ backgroundColor: hoveredNode.color }} />
          <span className="nl-3d-tooltip-title">{hoveredNode.label}</span>
          <span className="nl-3d-tooltip-meta">({hoveredNode.degree} 条连接)</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. BOTTOM-RIGHT 4D CONTROLLER (1:1 with Screenshot 1)
      ───────────────────────────────────────────────────────────── */}
      <div className="nl-3d-control-widget">
        {/* Top View Mode Switcher: 地形 vs 知识星图 */}
        <div className="nl-3d-viewmode-toggle">
          <button
            className={`nl-3d-viewmode-btn ${viewMode === "terrain" ? "active" : ""}`}
            onClick={() => setViewMode("terrain")}
          >
            <span>⛰️</span> 地形
          </button>
          <button
            className={`nl-3d-viewmode-btn ${viewMode === "galaxy" ? "active" : ""}`}
            onClick={() => setViewMode("galaxy")}
          >
            <span>🌌</span> 知识星图
          </button>
        </div>

        {/* Height Dimension Section */}
        {viewMode === "terrain" && (
          <div className="nl-3d-metric-section">
            <div className="nl-3d-metric-header">高度代表什么？</div>
            <div className="nl-3d-metric-grid">
              {(Object.keys(METRIC_CONFIG) as HeightMetric[]).map((key) => {
                const cfg = METRIC_CONFIG[key];
                return (
                  <button
                    key={key}
                    className={`nl-3d-metric-btn ${heightMetric === key ? "active" : ""}`}
                    onClick={() => setHeightMetric(key)}
                  >
                    <span>{cfg.icon}</span>
                    <span>{cfg.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Explanatory Footer (Minimalist Muted 1:1) */}
            <div className="nl-3d-metric-desc">
              <span className="nl-metric-desc-title">{currentMetric.title}</span>
              <p className="nl-metric-desc-text">{currentMetric.description}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
