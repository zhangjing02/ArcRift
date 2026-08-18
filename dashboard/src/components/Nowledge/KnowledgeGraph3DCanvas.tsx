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
// Strata & Dimension Configuration (1:1 with Nowledge Mem)
// ─────────────────────────────────────────────────────────────────────────────
const METRIC_CONFIG: Record<HeightMetric, {
  title: string;
  name: string;
  icon: string;
  description: string;
  levels: Array<{ label: string; height: number; yPercent: number }>;
}> = {
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

// Create clean, minimalist floating text sprite for peak nodes
function createTextSprite(rawText: string, color: string = "#ffffff"): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 512;
  canvas.height = 72;

  const cleanText = rawText
    .replace(/^tag:/, "")
    .replace(/^[0-9a-fA-F-]{36}\s*/, "")
    .trim();
  const text = cleanText.length > 22 ? cleanText.slice(0, 20) + "…" : cleanText;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Minimalist translucent capsule
  ctx.fillStyle = "rgba(10, 14, 22, 0.75)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;

  const r = 6;
  const w = Math.min(canvas.width - 16, Math.max(120, text.length * 16 + 32));
  const h = 32;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();

  // Fine white text
  ctx.font = "500 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color || "#e2e8f0";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(38, 5.3, 1);
  return sprite;
}

// Generate organic contour loop points at specific elevation
function createContourLoop(centerX: number, centerZ: number, radiusX: number, radiusZ: number, pointsCount = 48, jitter = 0.18): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= pointsCount; i++) {
    const angle = (i / pointsCount) * Math.PI * 2;
    // Harmonic wave for natural organic isoline curvature
    const harmonic = 1 + Math.sin(angle * 3 + 1.2) * jitter + Math.cos(angle * 5 - 0.6) * (jitter * 0.5);
    const x = centerX + Math.cos(angle) * radiusX * harmonic;
    const z = centerZ + Math.sin(angle) * radiusZ * harmonic;
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
  // 1. Target Position Generator (Computes natural clusters & height tiers)
  // ─────────────────────────────────────────────────────────────────────────
  const computeTargetPositions = useCallback(
    (nodes: GraphNode[], links: any[], metric: HeightMetric, mode: ViewMode3D) => {
      const totalNodes = nodes.length;
      if (totalNodes === 0) return new Map<string, { x: number; y: number; z: number }>();

      const degreeMap = new Map<string, number>();
      links.forEach((l: any) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        degreeMap.set(src, (degreeMap.get(src) || 0) + 1);
        degreeMap.set(tgt, (degreeMap.get(tgt) || 0) + 1);
      });
      const maxDegree = Math.max(1, ...Array.from(degreeMap.values()));

      // 2D force simulation for natural planar cluster layout
      const simNodes = nodes.map((n) => ({ id: n.id, x: (Math.random() - 0.5) * 320, y: (Math.random() - 0.5) * 320 }));
      const simLinks = links.map((l) => ({
        source: typeof l.source === "object" ? l.source.id : l.source,
        target: typeof l.target === "object" ? l.target.id : l.target,
      }));

      const sim = d3
        .forceSimulation(simNodes as any)
        .force("charge", d3.forceManyBody().strength(-140))
        .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(60))
        .force("center", d3.forceCenter(0, 0))
        .stop();

      for (let i = 0; i < 90; i++) sim.tick();

      const planarCoords = new Map<string, { x: number; z: number }>();
      simNodes.forEach((sn: any) => {
        planarCoords.set(sn.id, { x: sn.x || 0, z: sn.y || 0 });
      });

      const targetMap = new Map<string, { x: number; y: number; z: number }>();

      nodes.forEach((n, i) => {
        const deg = degreeMap.get(n.id) || 1;
        const basePlanar = planarCoords.get(n.id) || { x: 0, z: 0 };
        let tx = basePlanar.x;
        let tz = basePlanar.z;
        let ty = 25;

        if (mode === "galaxy") {
          // Galaxy view: Spherical constellation layout
          const phi = Math.acos(-1 + (2 * i) / totalNodes);
          const theta = Math.sqrt(totalNodes * Math.PI) * phi;
          const r = 160 + (deg / maxDegree) * 60;
          tx = r * Math.sin(phi) * Math.cos(theta);
          ty = r * Math.cos(phi) * 0.7;
          tz = r * Math.sin(phi) * Math.sin(theta);
        } else {
          // Terrain view: Rigorous Topographic Stratification
          if (metric === "influence") {
            const ratio = deg / maxDegree;
            ty = ratio * 210 + 20;
            // Higher nodes pulled gently toward the ridge/peak
            const pull = 0.55 + (1 - ratio) * 0.45;
            tx = basePlanar.x * pull;
            tz = basePlanar.z * pull;
          } else if (metric === "structure") {
            const sorted = [...nodes].sort((a, b) => (degreeMap.get(b.id) || 1) - (degreeMap.get(a.id) || 1));
            const rank = sorted.findIndex((s) => s.id === n.id);
            const tier = Math.floor((rank / Math.max(1, totalNodes)) * 4);
            const ringRadii = [45, 110, 190, 290];
            const ringHeights = [230, 160, 95, 25];
            ty = ringHeights[tier] + (Math.random() - 0.5) * 8;

            const angle = (i / totalNodes) * Math.PI * 2 + tier * 0.7;
            const r = ringRadii[tier] + (Math.random() - 0.5) * 20;
            tx = Math.cos(angle) * r;
            tz = Math.sin(angle) * r;
          } else if (metric === "morphology") {
            const t = (n.type || "").toLowerCase();
            if (t.includes("rule") || t.includes("arch") || t.includes("skill")) ty = 230;
            else if (t.includes("tech") || t.includes("doc") || t.includes("file") || t.includes("project")) ty = 160;
            else if (t.includes("concept") || t.includes("entity")) ty = 95;
            else if (t.includes("memory") || t.includes("decision")) ty = 50;
            else ty = 25;

            ty += (Math.random() - 0.5) * 6;
            tx = basePlanar.x * 0.92;
            tz = basePlanar.z * 0.92;
          } else if (metric === "growth") {
            const ageRatio = (totalNodes - 1 - i) / Math.max(1, totalNodes - 1);
            if (ageRatio > 0.8) ty = 230;
            else if (ageRatio > 0.55) ty = 160;
            else if (ageRatio > 0.25) ty = 95;
            else ty = 25;

            ty += (Math.random() - 0.5) * 6;
            tx = basePlanar.x * 0.92;
            tz = basePlanar.z * 0.92;
          }
        }

        targetMap.set(n.id, { x: tx, y: ty, z: tz });
      });

      return targetMap;
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Initialize Three.js Scene, Camera, Topographic Contours & Loop
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c0f17");
    scene.fog = new THREE.FogExp2("#0c0f17", 0.0012);
    sceneRef.current = scene;

    // Camera (Isometric angle matching Nowledge Mem Screenshot 1)
    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 3000);
    camera.position.set(380, 290, 480);
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
    controls.target.set(0, 80, 0);
    controlsRef.current = controls;

    // Ambient Lighting (Soft moonlight glow)
    const ambientLight = new THREE.AmbientLight("#e0f2fe", 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight("#ffffff", 0.8);
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
          meshes.push(entry.meshGroup.children[0]); // Core sphere
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
              label: (entry.raw as any).label || (entry.raw as any).name || entry.raw.id,
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
  }, []); // Run ONCE on mount

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Synchronize Graph Objects & Topographic Contour Layers
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !data.nodes || data.nodes.length === 0) return;

    linksDataRef.current = data.links || [];
    const targetMap = computeTargetPositions(data.nodes, data.links, heightMetric, viewMode);

    const degreeMap = new Map<string, number>();
    data.links.forEach((l: any) => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      degreeMap.set(src, (degreeMap.get(src) || 0) + 1);
      degreeMap.set(tgt, (degreeMap.get(tgt) || 0) + 1);
    });

    const sortedByDegree = [...data.nodes].sort((a, b) => (degreeMap.get(b.id) || 1) - (degreeMap.get(a.id) || 1));
    const peakNodeIds = new Set(sortedByDegree.slice(0, 3).map((n) => n.id));

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
      const isPeak = peakNodeIds.has(n.id);
      const radius = isPeak ? 3.6 : Math.max(1.8, Math.min(3.2, 1.8 + Math.sqrt(deg) * 0.45));
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

        // Micro-Sphere Star Point
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 16, 16),
          new THREE.MeshStandardMaterial({
            color: threeCol,
            emissive: threeCol,
            emissiveIntensity: 0.65,
            roughness: 0.25,
            metalness: 0.1,
          })
        );
        group.add(sphere);

        // Faint Subtle Glow (Small aura)
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 1.8, 12, 12),
          new THREE.MeshBasicMaterial({
            color: threeCol,
            transparent: true,
            opacity: 0.08,
            side: THREE.BackSide,
            depthWrite: false,
          })
        );
        group.add(halo);

        // Only Peak Nodes show clean White Billboard Sprite
        let labelSprite: THREE.Sprite | undefined;
        if (isPeak) {
          const nodeLabel = (n as any).label || (n as any).title || (n as any).name || n.id;
          labelSprite = createTextSprite(nodeLabel, "#f1f5f9");
          labelSprite.position.set(0, radius + 6, 0);
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

    // Rebuild Link Lines (Ultra-faint lines 0.4px feel)
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

        linkColors.push(src.threeColor.r * 0.5, src.threeColor.g * 0.5, src.threeColor.b * 0.5);
        linkColors.push(tgt.threeColor.r * 0.5, tgt.threeColor.g * 0.5, tgt.threeColor.b * 0.5);
      }
    });

    const linksGeo = new THREE.BufferGeometry();
    linksGeo.setAttribute("position", new THREE.Float32BufferAttribute(linkPositions, 3));
    linksGeo.setAttribute("color", new THREE.Float32BufferAttribute(linkColors, 3));

    const linksMesh = new THREE.LineSegments(
      linksGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.12 })
    );
    scene.add(linksMesh);
    linksMeshRef.current = linksMesh;

    // Rebuild Topographic Contour Landscape Rings (1:1 with Screenshot 1)
    if (contoursGroupRef.current) {
      const cGroup = contoursGroupRef.current;
      while (cGroup.children.length > 0) {
        cGroup.remove(cGroup.children[0]);
      }

      if (viewMode === "terrain") {
        const contourTiers = [
          { y: 230, rx: 42, rz: 32, opacity: 0.35 },
          { y: 195, rx: 70, rz: 55, opacity: 0.28 },
          { y: 160, rx: 110, rz: 85, opacity: 0.22 },
          { y: 125, rx: 160, rz: 125, opacity: 0.18 },
          { y: 90, rx: 215, rz: 170, opacity: 0.14 },
          { y: 55, rx: 270, rz: 220, opacity: 0.11 },
          { y: 20, rx: 330, rz: 275, opacity: 0.08 },
        ];

        contourTiers.forEach((tier) => {
          const points = createContourLoop(0, 0, tier.rx, tier.rz, 56, 0.22);
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
      }
    }
  }, [data, heightMetric, viewMode, computeTargetPositions]);

  const currentMetric = METRIC_CONFIG[heightMetric];

  return (
    <div className="nl-graph-3d-wrapper" style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* 3D Canvas Mount Point */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* ─────────────────────────────────────────────────────────────
          1. LEFT ELEVATION STRATA HUD (1:1 with Screenshot 1, 2, 3, 4)
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
          2. BOTTOM-RIGHT 4D DIMENSION CONTROLLER (1:1 with Screenshot 1)
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

            {/* Dynamic Explanatory Footer */}
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
