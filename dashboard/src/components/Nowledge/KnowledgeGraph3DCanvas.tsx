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

interface Node3DEntry {
  raw: GraphNode;
  id: string;
  degree: number;
  color: string;
  threeColor: THREE.Color;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  meshGroup: THREE.Group;
  stalkLine: THREE.Line;
  stalkFoot: THREE.Mesh;
  haloMesh: THREE.Mesh;
  selectionRing?: THREE.Mesh;
}

// ─────────────────────────────────────────────────────────────────────────────
// Strata labels configuration for HUD overlay
// ─────────────────────────────────────────────────────────────────────────────
const STRATA_CONFIG: Record<HeightMetric, {
  title: string;
  description: string;
  levels: Array<{ label: string; height: number; color: string }>;
}> = {
  influence: {
    title: "影响力 (Influence)",
    description: "度中心性越高，节点高度越高并向中心靠拢，形成峰峦地形",
    levels: [
      { label: "核心枢纽 (Hub)", height: 240, color: "#f472b6" },
      { label: "高影响力", height: 170, color: "#c084fc" },
      { label: "中等连接", height: 100, color: "#60a5fa" },
      { label: "边缘末梢", height: 30, color: "#64748b" },
    ],
  },
  structure: {
    title: "结构 (Structure)",
    description: "K-Core 拓扑层级，内部核心节点高耸，外围结构依序呈阶梯分布",
    levels: [
      { label: "核心内圈 (Core)", height: 240, color: "#f472b6" },
      { label: "主结构层", height: 170, color: "#c084fc" },
      { label: "桥接层", height: 100, color: "#60a5fa" },
      { label: "离散外圈", height: 30, color: "#64748b" },
    ],
  },
  morphology: {
    title: "形态 (Morphology)",
    description: "按本体知识类型进行水平地层分阶，自底向上呈现知识结晶过程",
    levels: [
      { label: "知识结晶 / 规则", height: 240, color: "#f472b6" },
      { label: "技术规范 / 架构", height: 170, color: "#c084fc" },
      { label: "概念 / 实体", height: 100, color: "#60a5fa" },
      { label: "记忆 / 决策", height: 50, color: "#34d399" },
      { label: "原始记录 / 对话", height: 15, color: "#64748b" },
    ],
  },
  growth: {
    title: "增长 (Growth)",
    description: "时间地层剖面，最新产生的记忆悬浮顶层，历史知识沉入地基",
    levels: [
      { label: "现在 (Recent)", height: 240, color: "#f472b6" },
      { label: "7 天内", height: 165, color: "#c084fc" },
      { label: "30 天内", height: 95, color: "#60a5fa" },
      { label: "1 年以上 (History)", height: 25, color: "#64748b" },
    ],
  },
};

// Create billboard canvas text sprite
function createTextSprite(text: string, color: string = "#ffffff"): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 384;
  canvas.height = 96;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(10, 14, 24, 0.78)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 2;

  const r = 16;
  const w = Math.min(canvas.width - 8, Math.max(120, text.length * 16 + 32));
  const h = 42;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text.length > 16 ? text.slice(0, 15) + "..." : text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(38, 9.5, 1);
  return sprite;
}

export const KnowledgeGraph3DCanvas: React.FC<KnowledgeGraph3DCanvasProps> = ({
  data,
  selectedNode,
  onNodeSelect,
  getNodeColor,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
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
  const elevationGridGroupRef = useRef<THREE.Group | null>(null);

  // Graph Data & Object References
  const nodeEntriesRef = useRef<Map<string, Node3DEntry>>(new Map());
  const linksMeshRef = useRef<THREE.LineSegments | null>(null);
  const particlesMeshRef = useRef<THREE.Points | null>(null);
  const particleDataRef = useRef<Array<{ linkIdx: number; progress: number; speed: number }>>([]);
  const linksDataRef = useRef<any[]>([]);

  const raycasterRef = useRef(new THREE.Raycaster());
  const mousePosRef = useRef(new THREE.Vector2(-999, -999));
  const isPointerDownRef = useRef(false);
  const pointerDownPosRef = useRef({ x: 0, y: 0 });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Target Position Generator (Pure function, zero side effects)
  // ─────────────────────────────────────────────────────────────────────────
  const computeTargetPositions = useCallback(
    (nodes: GraphNode[], links: any[], metric: HeightMetric) => {
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

      // 2D force simulation for natural planar layout
      const simNodes = nodes.map((n) => ({ id: n.id, x: (Math.random() - 0.5) * 350, y: (Math.random() - 0.5) * 350 }));
      const simLinks = links.map((l) => ({
        source: typeof l.source === "object" ? l.source.id : l.source,
        target: typeof l.target === "object" ? l.target.id : l.target,
      }));

      const sim = d3
        .forceSimulation(simNodes as any)
        .force("charge", d3.forceManyBody().strength(-160))
        .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(65))
        .force("center", d3.forceCenter(0, 0))
        .stop();

      for (let i = 0; i < 80; i++) sim.tick();

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
        let ty = 30;

        if (metric === "influence") {
          const ratio = deg / maxDegree;
          ty = ratio * 230 + 25;
          const pull = 0.45 + (1 - ratio) * 0.55;
          tx = basePlanar.x * pull;
          tz = basePlanar.z * pull;
        } else if (metric === "structure") {
          const sorted = [...nodes].sort((a, b) => (degreeMap.get(b.id) || 1) - (degreeMap.get(a.id) || 1));
          const rank = sorted.findIndex((s) => s.id === n.id);
          const tier = Math.floor((rank / Math.max(1, totalNodes)) * 4);
          const ringRadii = [60, 140, 220, 320];
          const ringHeights = [240, 170, 100, 30];
          ty = ringHeights[tier] + (Math.random() - 0.5) * 12;

          const angle = (i / totalNodes) * Math.PI * 2 + tier * 0.8;
          const r = ringRadii[tier] + (Math.random() - 0.5) * 25;
          tx = Math.cos(angle) * r;
          tz = Math.sin(angle) * r;
        } else if (metric === "morphology") {
          const t = (n.type || "").toLowerCase();
          if (t.includes("rule") || t.includes("arch") || t.includes("skill")) ty = 240;
          else if (t.includes("tech") || t.includes("doc") || t.includes("file")) ty = 170;
          else if (t.includes("concept") || t.includes("entity")) ty = 100;
          else if (t.includes("memory") || t.includes("decision")) ty = 50;
          else ty = 15;

          ty += (Math.random() - 0.5) * 8;
          tx = basePlanar.x * 0.95;
          tz = basePlanar.z * 0.95;
        } else if (metric === "growth") {
          const ageRatio = i / Math.max(1, totalNodes - 1);
          if (ageRatio > 0.8) ty = 240;
          else if (ageRatio > 0.55) ty = 165;
          else if (ageRatio > 0.25) ty = 95;
          else ty = 25;

          ty += (Math.random() - 0.5) * 10;
          const angle = ageRatio * Math.PI * 4;
          const r = 70 + ageRatio * 190;
          tx = Math.cos(angle) * r;
          tz = Math.sin(angle) * r;
        }

        targetMap.set(n.id, { x: tx, y: ty, z: tz });
      });

      return targetMap;
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Initialize Three.js Scene ONCE on Mount (Never re-initialized)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#080b12");
    scene.fog = new THREE.FogExp2(0x080b12, 0.0014);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 3000);
    camera.position.set(0, 320, 520);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.75;
    controls.maxDistance = 1400;
    controls.minDistance = 60;
    controls.target.set(0, 80, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xddeeff, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(200, 500, 300);
    scene.add(dirLight);

    const blueLight = new THREE.PointLight(0x60a5fa, 2.5, 900);
    blueLight.position.set(-250, 200, -100);
    scene.add(blueLight);

    const purpleLight = new THREE.PointLight(0xa855f7, 2.0, 800);
    purpleLight.position.set(250, 150, 200);
    scene.add(purpleLight);

    // 6. Base Floor Grid & Elevation Strata Rings
    const elevationGroup = new THREE.Group();
    scene.add(elevationGroup);
    elevationGridGroupRef.current = elevationGroup;

    [80, 160, 240, 320, 420].forEach((r) => {
      const ringGeo = new THREE.RingGeometry(r - 0.6, r + 0.6, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: r === 420 ? 0.08 : 0.04,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0;
      elevationGroup.add(ring);
    });

    const axisMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.04 });
    const axisGeoX = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-450, 0, 0), new THREE.Vector3(450, 0, 0)]);
    const axisGeoZ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -450), new THREE.Vector3(0, 0, 450)]);
    elevationGroup.add(new THREE.Line(axisGeoX, axisMat));
    elevationGroup.add(new THREE.Line(axisGeoZ, axisMat));

    // 7. Mouse and Pointer Event Listeners
    const handlePointerDown = (e: MouseEvent) => {
      isPointerDownRef.current = true;
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mousePosRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePosRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerUp = (e: MouseEvent) => {
      isPointerDownRef.current = false;
      const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
      const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);
      if (dx > 4 || dy > 4) return; // drag/orbit, not a click

      if (!cameraRef.current || !sceneRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(mouse, cameraRef.current);

      const clickableMeshes: THREE.Object3D[] = [];
      nodeEntriesRef.current.forEach((n) => clickableMeshes.push(n.meshGroup));

      const intersects = raycasterRef.current.intersectObjects(clickableMeshes, true);
      if (intersects.length > 0) {
        let topObj: THREE.Object3D | null = intersects[0].object;
        while (topObj && !topObj.userData?.nodeId) topObj = topObj.parent;
        if (topObj && topObj.userData?.nodeId) {
          const entry = nodeEntriesRef.current.get(topObj.userData.nodeId);
          if (entry && onNodeSelectRef.current) {
            onNodeSelectRef.current(entry.raw);
          }
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    // 8. ResizeObserver on Container (Handles sidebar expand/collapse cleanly)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        const h = Math.floor(entry.contentRect.height);
        if (w > 0 && h > 0 && rendererRef.current && cameraRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // 9. Continuous Animation Loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      // Lerp node positions
      const lerpFactor = 0.08;
      let isMoving = false;

      nodeEntriesRef.current.forEach((entry) => {
        if (entry.currentPos.distanceTo(entry.targetPos) > 0.05) {
          entry.currentPos.lerp(entry.targetPos, lerpFactor);
          isMoving = true;
        }
        entry.meshGroup.position.copy(entry.currentPos);

        // Update stalk lines
        const posAttr = entry.stalkLine.geometry.attributes.position as THREE.BufferAttribute;
        posAttr.setXYZ(0, entry.currentPos.x, entry.currentPos.y, entry.currentPos.z);
        posAttr.setXYZ(1, entry.currentPos.x, 0, entry.currentPos.z);
        posAttr.needsUpdate = true;

        entry.stalkFoot.position.set(entry.currentPos.x, 0.2, entry.currentPos.z);
      });

      // Update link line vertices
      if (isMoving && linksMeshRef.current && linksDataRef.current.length > 0) {
        const posAttr = linksMeshRef.current.geometry.attributes.position as THREE.BufferAttribute;
        let idx = 0;
        linksDataRef.current.forEach((l: any) => {
          const srcId = typeof l.source === "object" ? l.source.id : l.source;
          const tgtId = typeof l.target === "object" ? l.target.id : l.target;
          const src = nodeEntriesRef.current.get(srcId);
          const tgt = nodeEntriesRef.current.get(tgtId);
          if (src && tgt) {
            posAttr.setXYZ(idx++, src.currentPos.x, src.currentPos.y, src.currentPos.z);
            posAttr.setXYZ(idx++, tgt.currentPos.x, tgt.currentPos.y, tgt.currentPos.z);
          }
        });
        posAttr.needsUpdate = true;
      }

      // Update particle stream
      if (particlesMeshRef.current && linksDataRef.current.length > 0) {
        const pPosAttr = particlesMeshRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const pData = particleDataRef.current;
        const links = linksDataRef.current;

        for (let i = 0; i < pData.length; i++) {
          const p = pData[i];
          p.progress = (p.progress + p.speed) % 1.0;
          const link = links[p.linkIdx % links.length];
          if (!link) continue;

          const srcId = typeof link.source === "object" ? link.source.id : link.source;
          const tgtId = typeof link.target === "object" ? link.target.id : link.target;
          const src = nodeEntriesRef.current.get(srcId);
          const tgt = nodeEntriesRef.current.get(tgtId);

          if (src && tgt) {
            const px = src.currentPos.x + (tgt.currentPos.x - src.currentPos.x) * p.progress;
            const py = src.currentPos.y + (tgt.currentPos.y - src.currentPos.y) * p.progress;
            const pz = src.currentPos.z + (tgt.currentPos.z - src.currentPos.z) * p.progress;
            pPosAttr.setXYZ(i, px, py, pz);
          }
        }
        pPosAttr.needsUpdate = true;
      }

      // Raycast hover detection
      if (cameraRef.current && !isPointerDownRef.current) {
        raycasterRef.current.setFromCamera(mousePosRef.current, cameraRef.current);
        const clickableMeshes: THREE.Object3D[] = [];
        nodeEntriesRef.current.forEach((n) => clickableMeshes.push(n.meshGroup));

        const intersects = raycasterRef.current.intersectObjects(clickableMeshes, true);
        if (intersects.length > 0) {
          let topObj: THREE.Object3D | null = intersects[0].object;
          while (topObj && !topObj.userData?.nodeId) topObj = topObj.parent;
          if (topObj && topObj.userData?.nodeId) {
            const entry = nodeEntriesRef.current.get(topObj.userData.nodeId);
            if (entry) {
              const label = (entry.raw as any).label || (entry.raw as any).name || entry.id;
              setHoveredNode({ label, type: entry.raw.type, color: entry.color, degree: entry.degree });
              renderer.domElement.style.cursor = "pointer";
            }
          }
        } else {
          setHoveredNode(null);
          renderer.domElement.style.cursor = "default";
        }
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
  // 3. Synchronize Graph Objects only when Data actually changes (ID set change)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !data.nodes || data.nodes.length === 0) return;

    linksDataRef.current = data.links || [];
    const targetMap = computeTargetPositions(data.nodes, data.links, heightMetric);

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
        scene.remove(entry.stalkLine);
        scene.remove(entry.stalkFoot);
        existingMap.delete(id);
      }
    });

    // Add or update nodes
    data.nodes.forEach((n) => {
      const deg = degreeMap.get(n.id) || 1;
      const colStr = getNodeColorRef.current(n.type);
      const threeCol = new THREE.Color(colStr);
      const radius = Math.max(3.8, Math.min(13, 3.8 + Math.sqrt(deg) * 2.1));
      const target = targetMap.get(n.id) || { x: 0, y: 30, z: 0 };
      const targetVec = new THREE.Vector3(target.x, target.y, target.z);

      let entry = existingMap.get(n.id);
      if (entry) {
        // Node already exists: smoothly update its target position without recreating mesh
        entry.raw = n;
        entry.degree = deg;
        entry.targetPos.copy(targetVec);
      } else {
        // Create new node mesh
        const group = new THREE.Group();
        group.userData = { nodeId: n.id };

        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 24, 24),
          new THREE.MeshStandardMaterial({
            color: threeCol,
            emissive: threeCol,
            emissiveIntensity: 0.65,
            roughness: 0.25,
            metalness: 0.2,
          })
        );
        group.add(sphere);

        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 2.3, 16, 16),
          new THREE.MeshBasicMaterial({
            color: threeCol,
            transparent: true,
            opacity: 0.08,
            side: THREE.BackSide,
            depthWrite: false,
          })
        );
        group.add(halo);

        const nodeLabel = (n as any).label || (n as any).name || n.id;
        const labelSprite = createTextSprite(nodeLabel, colStr);
        labelSprite.position.set(0, radius + 10, 0);
        group.add(labelSprite);

        const initialPos = new THREE.Vector3(target.x, 0, target.z);
        group.position.copy(initialPos);
        scene.add(group);

        const stalkGeo = new THREE.BufferGeometry().setFromPoints([initialPos, new THREE.Vector3(target.x, 0, target.z)]);
        const stalkLine = new THREE.Line(
          stalkGeo,
          new THREE.LineBasicMaterial({ color: threeCol, transparent: true, opacity: 0.22 })
        );
        scene.add(stalkLine);

        const footGeo = new THREE.RingGeometry(2, 4.5, 16);
        const stalkFoot = new THREE.Mesh(
          footGeo,
          new THREE.MeshBasicMaterial({ color: threeCol, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
        );
        stalkFoot.rotation.x = Math.PI / 2;
        stalkFoot.position.set(target.x, 0.2, target.z);
        scene.add(stalkFoot);

        entry = {
          raw: n,
          id: n.id,
          degree: deg,
          color: colStr,
          threeColor: threeCol,
          currentPos: initialPos,
          targetPos: targetVec,
          meshGroup: group,
          stalkLine,
          stalkFoot,
          haloMesh: halo,
        };
        existingMap.set(n.id, entry);
      }
    });

    // Rebuild Link Segments
    if (linksMeshRef.current) scene.remove(linksMeshRef.current);
    if (particlesMeshRef.current) scene.remove(particlesMeshRef.current);

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

        linkColors.push(src.threeColor.r * 0.7, src.threeColor.g * 0.7, src.threeColor.b * 0.7);
        linkColors.push(tgt.threeColor.r * 0.7, tgt.threeColor.g * 0.7, tgt.threeColor.b * 0.7);
      }
    });

    const linksGeo = new THREE.BufferGeometry();
    linksGeo.setAttribute("position", new THREE.Float32BufferAttribute(linkPositions, 3));
    linksGeo.setAttribute("color", new THREE.Float32BufferAttribute(linkColors, 3));

    const linksMesh = new THREE.LineSegments(
      linksGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32 })
    );
    scene.add(linksMesh);
    linksMeshRef.current = linksMesh;

    // Rebuild Link Particles
    const numParticles = Math.min(60, data.links.length * 2);
    const particleGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(numParticles * 3);
    const pCol = new Float32Array(numParticles * 3);
    const pData: Array<{ linkIdx: number; progress: number; speed: number }> = [];

    for (let p = 0; p < numParticles; p++) {
      pData.push({
        linkIdx: p % Math.max(1, data.links.length),
        progress: Math.random(),
        speed: 0.003 + Math.random() * 0.004,
      });
      pCol[p * 3] = 0.8;
      pCol[p * 3 + 1] = 0.9;
      pCol[p * 3 + 2] = 1.0;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));

    const particleSystem = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({
        size: 4,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(particleSystem);
    particlesMeshRef.current = particleSystem;
    particleDataRef.current = pData;
  }, [data.nodes, data.links, computeTargetPositions]);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Update Target Positions when Height Metric changes (Smooth in-place transition)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!data.nodes || data.nodes.length === 0) return;
    const targetMap = computeTargetPositions(data.nodes, data.links, heightMetric);

    nodeEntriesRef.current.forEach((entry, id) => {
      const target = targetMap.get(id);
      if (target) {
        entry.targetPos.set(target.x, target.y, target.z);
      }
    });

    // Update strata rings in elevation group
    const elevGroup = elevationGridGroupRef.current;
    if (elevGroup) {
      while (elevGroup.children.length > 7) {
        elevGroup.remove(elevGroup.children[elevGroup.children.length - 1]);
      }
      STRATA_CONFIG[heightMetric].levels.forEach((lvl) => {
        const ringGeo = new THREE.RingGeometry(218, 220, 64);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(lvl.color),
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = lvl.height;
        elevGroup.add(ring);
      });
    }
  }, [heightMetric, data.nodes, data.links, computeTargetPositions]);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Update Selection Visuals & Camera Focus (Zero canvas rebuild)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    nodeEntriesRef.current.forEach((entry) => {
      const isSelected = selectedNode?.id === entry.id;
      if (isSelected) {
        if (!entry.selectionRing) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(12, 0.9, 12, 32),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
          );
          entry.selectionRing = ring;
          entry.meshGroup.add(ring);
        }
        (entry.haloMesh.material as THREE.MeshBasicMaterial).opacity = 0.25;
      } else {
        if (entry.selectionRing) {
          entry.meshGroup.remove(entry.selectionRing);
          entry.selectionRing.geometry.dispose();
          entry.selectionRing = undefined;
        }
        (entry.haloMesh.material as THREE.MeshBasicMaterial).opacity = 0.08;
      }
    });

    // Smoothly pan camera controls target to selected node
    if (controlsRef.current && selectedNode) {
      const entry = nodeEntriesRef.current.get(selectedNode.id);
      if (entry) {
        controlsRef.current.target.lerp(entry.targetPos, 0.4);
      }
    }
  }, [selectedNode]);

  const activeStrata = STRATA_CONFIG[heightMetric];

  return (
    <div
      className="nl-graph-3d-canvas"
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#080b12",
      }}
    >
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* ── 3D Mode Height Selector Panel (Bottom-Right, 1:1 Nowledge Mem Style) ── */}
      <div
        style={{
          position: "absolute",
          bottom: 52,
          right: 14,
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
          pointerEvents: "auto",
        }}
      >
        <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 500 }}>高度代表什么？</div>

        {/* Height Metric Capsule Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(18, 22, 32, 0.88)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 20,
            padding: "3px 6px",
            boxShadow: "0 6px 24px rgba(0, 0, 0, 0.4)",
          }}
        >
          {(["influence", "structure", "morphology", "growth"] as HeightMetric[]).map((m) => {
            const icons: Record<HeightMetric, string> = {
              influence: "▲ 影响力",
              structure: "🝯 结构",
              morphology: "◈ 形态",
              growth: "⬆ 增长",
            };
            const active = heightMetric === m;
            return (
              <button
                key={m}
                onClick={() => setHeightMetric(m)}
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  padding: "3px 9px",
                  borderRadius: 14,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: active ? "rgba(96, 165, 250, 0.22)" : "transparent",
                  color: active ? "#60a5fa" : "#64748b",
                  transition: "all 0.15s ease",
                }}
              >
                {icons[m]}
              </button>
            );
          })}
        </div>

        {/* Compact active metric description */}
        <div
          style={{
            fontSize: 10,
            color: "#64748b",
            maxWidth: 240,
            textAlign: "right",
            lineHeight: 1.3,
          }}
        >
          {activeStrata.description}
        </div>
      </div>

      {/* ── Hover Tooltip ── */}
      {hoveredNode && (
        <div
          style={{
            position: "absolute",
            bottom: 54,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(13, 18, 30, 0.94)",
            border: `1px solid ${hoveredNode.color}55`,
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 11.5,
            color: "#f1f5f9",
            fontFamily: "inherit",
            pointerEvents: "none",
            backdropFilter: "blur(12px)",
            boxShadow: `0 8px 30px rgba(0, 0, 0, 0.6), 0 0 15px ${hoveredNode.color}33`,
            textAlign: "center",
            zIndex: 25,
          }}
        >
          <div style={{ fontWeight: 600, color: hoveredNode.color, marginBottom: 1 }}>
            {hoveredNode.label}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>
            类型: {hoveredNode.type || "未知"} | 连接数: {hoveredNode.degree}
          </div>
        </div>
      )}
    </div>
  );
};
