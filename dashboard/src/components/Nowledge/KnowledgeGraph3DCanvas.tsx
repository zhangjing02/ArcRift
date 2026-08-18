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

interface Node3DData extends GraphNode {
  degree: number;
  color: string;
  threeColor: THREE.Color;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  meshGroup?: THREE.Group;
  stalkLine?: THREE.Line;
  stalkFoot?: THREE.Mesh;
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
  ctx.fillStyle = "rgba(10, 14, 24, 0.75)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2;
  
  // Rounded pill background
  const r = 16;
  const w = Math.min(canvas.width - 8, Math.max(120, text.length * 16 + 32));
  const h = 42;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();

  // Text
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
  const [hoveredNode, setHoveredNode] = useState<Node3DData | null>(null);

  // Scene state refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodesMapRef = useRef<Map<string, Node3DData>>(new Map());
  const linksMeshRef = useRef<THREE.LineSegments | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const particleDataRef = useRef<Array<{ linkIdx: number; progress: number; speed: number }>>([]);
  const animFrameRef = useRef<number>(0);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mousePosRef = useRef(new THREE.Vector2(-999, -999));
  const elevationGridGroupRef = useRef<THREE.Group | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate Node Target Positions (X, Y=Height, Z) for the active metric
  // ─────────────────────────────────────────────────────────────────────────
  const computeTargetPositions = useCallback(
    (nodes: GraphNode[], links: any[], metric: HeightMetric) => {
      const totalNodes = nodes.length;
      if (totalNodes === 0) return new Map<string, { x: number; y: number; z: number }>();

      // 1. Calculate degree map
      const degreeMap = new Map<string, number>();
      links.forEach((l: any) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        degreeMap.set(src, (degreeMap.get(src) || 0) + 1);
        degreeMap.set(tgt, (degreeMap.get(tgt) || 0) + 1);
      });
      const maxDegree = Math.max(1, ...Array.from(degreeMap.values()));

      // 2. Run a fast 2D D3 force layout for balanced base planar distribution
      const simNodes = nodes.map((n) => ({ id: n.id, x: (Math.random() - 0.5) * 400, y: (Math.random() - 0.5) * 400 }));
      const simLinks = links.map((l) => ({
        source: typeof l.source === "object" ? l.source.id : l.source,
        target: typeof l.target === "object" ? l.target.id : l.target,
      }));

      const sim = d3
        .forceSimulation(simNodes as any)
        .force("charge", d3.forceManyBody().strength(-180))
        .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(70))
        .force("center", d3.forceCenter(0, 0))
        .stop();

      for (let i = 0; i < 90; i++) sim.tick();

      const planarCoords = new Map<string, { x: number; z: number }>();
      simNodes.forEach((sn: any) => {
        planarCoords.set(sn.id, { x: sn.x || 0, z: sn.y || 0 });
      });

      // 3. Compute 3D target coordinates (X, Y=Height, Z) based on the Metric
      const targetMap = new Map<string, { x: number; y: number; z: number }>();

      nodes.forEach((n, i) => {
        const deg = degreeMap.get(n.id) || 1;
        const basePlanar = planarCoords.get(n.id) || { x: 0, z: 0 };
        let tx = basePlanar.x;
        let tz = basePlanar.z;
        let ty = 30; // Y is height in Three.js standard (Up vector is Y)

        if (metric === "influence") {
          const ratio = deg / maxDegree; // 0..1
          // High degree -> peak height and pulled towards center
          ty = ratio * 230 + 25;
          const pull = 0.45 + (1 - ratio) * 0.55;
          tx = basePlanar.x * pull;
          tz = basePlanar.z * pull;
        } else if (metric === "structure") {
          const sorted = [...nodes].sort((a, b) => (degreeMap.get(b.id) || 1) - (degreeMap.get(a.id) || 1));
          const rank = sorted.findIndex((s) => s.id === n.id);
          const tier = Math.floor((rank / Math.max(1, totalNodes)) * 4); // 0=Core, 1, 2, 3=Outer
          const ringRadii = [60, 140, 220, 320];
          const ringHeights = [240, 170, 100, 30];
          ty = ringHeights[tier] + (Math.random() - 0.5) * 15;
          
          const angle = (i / totalNodes) * Math.PI * 2 + tier * 0.8;
          const r = ringRadii[tier] + (Math.random() - 0.5) * 30;
          tx = Math.cos(angle) * r;
          tz = Math.sin(angle) * r;
        } else if (metric === "morphology") {
          const t = (n.type || "").toLowerCase();
          if (t.includes("rule") || t.includes("arch") || t.includes("skill")) {
            ty = 240;
          } else if (t.includes("tech") || t.includes("doc") || t.includes("file")) {
            ty = 170;
          } else if (t.includes("concept") || t.includes("entity")) {
            ty = 100;
          } else if (t.includes("memory") || t.includes("decision")) {
            ty = 50;
          } else {
            ty = 15;
          }
          ty += (Math.random() - 0.5) * 10;
          tx = basePlanar.x * 0.95;
          tz = basePlanar.z * 0.95;
        } else if (metric === "growth") {
          const ageRatio = i / Math.max(1, totalNodes - 1); // 0=oldest, 1=newest
          if (ageRatio > 0.8) ty = 240;
          else if (ageRatio > 0.55) ty = 165;
          else if (ageRatio > 0.25) ty = 95;
          else ty = 25;

          ty += (Math.random() - 0.5) * 14;
          // Spiral time ladder layout
          const angle = ageRatio * Math.PI * 4;
          const r = 80 + ageRatio * 180;
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
  // Three.js Scene Setup & Lifecycle
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
    controls.dampingFactor = 0.07;
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

    // Base concentric floor rings at Y=0
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

    // Cross axes on ground
    const axisMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.04 });
    const axisGeoX = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-450, 0, 0), new THREE.Vector3(450, 0, 0)]);
    const axisGeoZ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -450), new THREE.Vector3(0, 0, 450)]);
    elevationGroup.add(new THREE.Line(axisGeoX, axisMat));
    elevationGroup.add(new THREE.Line(axisGeoZ, axisMat));

    // 7. Raycaster Mouse Event Handlers
    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mousePosRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePosRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handleClick = (e: MouseEvent) => {
      if (!cameraRef.current || !sceneRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(mouse, cameraRef.current);

      const clickableMeshes: THREE.Object3D[] = [];
      nodesMapRef.current.forEach((n) => {
        if (n.meshGroup) clickableMeshes.push(n.meshGroup);
      });

      const intersects = raycasterRef.current.intersectObjects(clickableMeshes, true);
      if (intersects.length > 0) {
        let topObj: THREE.Object3D | null = intersects[0].object;
        while (topObj && !topObj.userData?.nodeId) {
          topObj = topObj.parent;
        }
        if (topObj && topObj.userData?.nodeId) {
          const clickedNode = nodesMapRef.current.get(topObj.userData.nodeId);
          if (clickedNode) onNodeSelect(clickedNode);
        }
      }
    };

    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("click", handleClick);

    // 8. Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("click", handleClick);
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onNodeSelect]);

  // ─────────────────────────────────────────────────────────────────────────
  // Update Nodes, Links, Particles & Elevation Strata when Data or Metric changes
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !data.nodes || data.nodes.length === 0) return;

    // 1. Calculate Target Positions
    const targetMap = computeTargetPositions(data.nodes, data.links, heightMetric);

    // Degree Map
    const degreeMap = new Map<string, number>();
    data.links.forEach((l: any) => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      degreeMap.set(src, (degreeMap.get(src) || 0) + 1);
      degreeMap.set(tgt, (degreeMap.get(tgt) || 0) + 1);
    });

    // 2. Clean previous node meshes & links
    nodesMapRef.current.forEach((n) => {
      if (n.meshGroup) scene.remove(n.meshGroup);
      if (n.stalkLine) scene.remove(n.stalkLine);
      if (n.stalkFoot) scene.remove(n.stalkFoot);
    });
    if (linksMeshRef.current) scene.remove(linksMeshRef.current);
    if (particleSystemRef.current) scene.remove(particleSystemRef.current);

    // Clean strata planes
    const elevGroup = elevationGridGroupRef.current;
    if (elevGroup) {
      while (elevGroup.children.length > 7) {
        elevGroup.remove(elevGroup.children[elevGroup.children.length - 1]);
      }
      // Add subtle strata rings for active height metric levels
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

    const newNodesMap = new Map<string, Node3DData>();

    // 3. Build Node 3D Objects
    data.nodes.forEach((n) => {
      const deg = degreeMap.get(n.id) || 1;
      const colStr = getNodeColor(n.type);
      const threeCol = new THREE.Color(colStr);
      const radius = Math.max(3.8, Math.min(13, 3.8 + Math.sqrt(deg) * 2.1));

      const target = targetMap.get(n.id) || { x: 0, y: 30, z: 0 };
      const currentPos = new THREE.Vector3(target.x, 0, target.z); // rise from floor initially
      const targetPos = new THREE.Vector3(target.x, target.y, target.z);

      // Node Group (Sphere + Glow Halo + Text Label)
      const group = new THREE.Group();
      group.userData = { nodeId: n.id };

      // Core Sphere
      const sphereGeo = new THREE.SphereGeometry(radius, 24, 24);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: threeCol,
        emissive: threeCol,
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.2,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      group.add(sphere);

      // Outer Halo Sphere
      const haloGeo = new THREE.SphereGeometry(radius * 2.3, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: threeCol,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      group.add(halo);

      // Text Sprite Label
      const nodeLabel = (n as any).label || (n as any).name || n.id;
      const labelSprite = createTextSprite(nodeLabel, colStr);
      labelSprite.position.set(0, radius + 10, 0);
      group.add(labelSprite);

      group.position.copy(currentPos);
      scene.add(group);

      // Vertical Stalk Drop Line to Ground
      const stalkGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z),
        new THREE.Vector3(currentPos.x, 0, currentPos.z),
      ]);
      const stalkMat = new THREE.LineBasicMaterial({
        color: threeCol,
        transparent: true,
        opacity: 0.22,
      });
      const stalkLine = new THREE.Line(stalkGeo, stalkMat);
      scene.add(stalkLine);

      // Ground Ripple Foot Circle
      const footGeo = new THREE.RingGeometry(2, 4.5, 16);
      const footMat = new THREE.MeshBasicMaterial({
        color: threeCol,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      });
      const stalkFoot = new THREE.Mesh(footGeo, footMat);
      stalkFoot.rotation.x = Math.PI / 2;
      stalkFoot.position.set(currentPos.x, 0.2, currentPos.z);
      scene.add(stalkFoot);

      newNodesMap.set(n.id, {
        ...n,
        degree: deg,
        color: colStr,
        threeColor: threeCol,
        currentPos,
        targetPos,
        meshGroup: group,
        stalkLine,
        stalkFoot,
      });
    });

    nodesMapRef.current = newNodesMap;

    // 4. Build Links Wireframe
    const linkPositions: number[] = [];
    const linkColors: number[] = [];

    data.links.forEach((l: any) => {
      const srcId = typeof l.source === "object" ? l.source.id : l.source;
      const tgtId = typeof l.target === "object" ? l.target.id : l.target;
      const src = newNodesMap.get(srcId);
      const tgt = newNodesMap.get(tgtId);
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

    const linksMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.32,
    });
    const linksMesh = new THREE.LineSegments(linksGeo, linksMat);
    scene.add(linksMesh);
    linksMeshRef.current = linksMesh;

    // 5. Flowing Glowing Particles along Links
    const numParticles = Math.min(60, data.links.length * 2);
    const particleGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(numParticles * 3);
    const pCol = new Float32Array(numParticles * 3);
    const pData: Array<{ linkIdx: number; progress: number; speed: number }> = [];

    for (let p = 0; p < numParticles; p++) {
      const linkIdx = p % Math.max(1, data.links.length);
      pData.push({
        linkIdx,
        progress: Math.random(),
        speed: 0.003 + Math.random() * 0.004,
      });
      pCol[p * 3] = 0.8;
      pCol[p * 3 + 1] = 0.9;
      pCol[p * 3 + 2] = 1.0;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 4,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);
    particleSystemRef.current = particleSystem;
    particleDataRef.current = pData;
  }, [data, heightMetric, computeTargetPositions, getNodeColor]);

  // ─────────────────────────────────────────────────────────────────────────
  // Main Animation / Render Loop (Lerp positions, raycast hover, particles)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !renderer || !camera || !controls) return;

    let isSubscribed = true;

    const animate = () => {
      if (!isSubscribed) return;
      animFrameRef.current = requestAnimationFrame(animate);

      controls.update();

      // 1. Smoothly interpolate (lerp) node positions towards target
      const lerpFactor = 0.07;
      let hasMovingNodes = false;

      nodesMapRef.current.forEach((n) => {
        if (n.currentPos.distanceTo(n.targetPos) > 0.1) {
          n.currentPos.lerp(n.targetPos, lerpFactor);
          hasMovingNodes = true;
        }

        if (n.meshGroup) {
          n.meshGroup.position.copy(n.currentPos);
        }

        // Update stalk drop lines
        if (n.stalkLine) {
          const posAttr = n.stalkLine.geometry.attributes.position as THREE.BufferAttribute;
          posAttr.setXYZ(0, n.currentPos.x, n.currentPos.y, n.currentPos.z);
          posAttr.setXYZ(1, n.currentPos.x, 0, n.currentPos.z);
          posAttr.needsUpdate = true;
        }
        if (n.stalkFoot) {
          n.stalkFoot.position.set(n.currentPos.x, 0.2, n.currentPos.z);
        }
      });

      // 2. Update Link geometries if nodes are moving
      if (hasMovingNodes && linksMeshRef.current && data.links) {
        const posAttr = linksMeshRef.current.geometry.attributes.position as THREE.BufferAttribute;
        let idx = 0;
        data.links.forEach((l: any) => {
          const srcId = typeof l.source === "object" ? l.source.id : l.source;
          const tgtId = typeof l.target === "object" ? l.target.id : l.target;
          const src = nodesMapRef.current.get(srcId);
          const tgt = nodesMapRef.current.get(tgtId);
          if (src && tgt) {
            posAttr.setXYZ(idx++, src.currentPos.x, src.currentPos.y, src.currentPos.z);
            posAttr.setXYZ(idx++, tgt.currentPos.x, tgt.currentPos.y, tgt.currentPos.z);
          }
        });
        posAttr.needsUpdate = true;
      }

      // 3. Update Animated Flowing Particles along Links
      if (particleSystemRef.current && data.links && data.links.length > 0) {
        const pPosAttr = particleSystemRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const pData = particleDataRef.current;

        for (let i = 0; i < pData.length; i++) {
          const p = pData[i];
          p.progress = (p.progress + p.speed) % 1.0;
          const link = data.links[p.linkIdx % data.links.length];
          if (!link) continue;

          const srcId = typeof link.source === "object" ? link.source.id : link.source;
          const tgtId = typeof link.target === "object" ? link.target.id : link.target;
          const src = nodesMapRef.current.get(srcId);
          const tgt = nodesMapRef.current.get(tgtId);

          if (src && tgt) {
            const px = src.currentPos.x + (tgt.currentPos.x - src.currentPos.x) * p.progress;
            const py = src.currentPos.y + (tgt.currentPos.y - src.currentPos.y) * p.progress;
            const pz = src.currentPos.z + (tgt.currentPos.z - src.currentPos.z) * p.progress;
            pPosAttr.setXYZ(i, px, py, pz);
          }
        }
        pPosAttr.needsUpdate = true;
      }

      // 4. Raycasting for Hover state
      raycasterRef.current.setFromCamera(mousePosRef.current, camera);
      const meshes: THREE.Object3D[] = [];
      nodesMapRef.current.forEach((n) => {
        if (n.meshGroup) meshes.push(n.meshGroup);
      });

      const intersects = raycasterRef.current.intersectObjects(meshes, true);
      if (intersects.length > 0) {
        let topObj: THREE.Object3D | null = intersects[0].object;
        while (topObj && !topObj.userData?.nodeId) topObj = topObj.parent;
        if (topObj && topObj.userData?.nodeId) {
          const n = nodesMapRef.current.get(topObj.userData.nodeId);
          setHoveredNode(n || null);
          renderer.domElement.style.cursor = "pointer";
        }
      } else {
        setHoveredNode(null);
        renderer.domElement.style.cursor = "default";
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      isSubscribed = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [data.links]);

  // ─────────────────────────────────────────────────────────────────────────
  // Smoothly Focus Camera on Selected Node
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!controlsRef.current || !selectedNode) return;
    const node = nodesMapRef.current.get(selectedNode.id);
    if (node) {
      const targetPos = node.targetPos;
      controlsRef.current.target.set(targetPos.x, targetPos.y, targetPos.z);
    }
  }, [selectedNode]);

  const activeStrata = STRATA_CONFIG[heightMetric];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#080b12",
      }}
    >
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* ── TOP-LEFT: Height Dimension Selector Pills ── */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 16,
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          background: "rgba(11, 15, 25, 0.85)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 10,
          padding: "8px 12px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.04em" }}>
            3D 空间高度维度
          </span>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {(["influence", "structure", "morphology", "growth"] as HeightMetric[]).map((m) => {
            const icons: Record<HeightMetric, string> = {
              influence: "⛰ 影响力",
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
                  fontSize: 11.5,
                  fontWeight: active ? 600 : 400,
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: `1px solid ${active ? "rgba(96, 165, 250, 0.6)" : "rgba(255, 255, 255, 0.06)"}`,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: active
                    ? "linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(147, 51, 234, 0.25))"
                    : "rgba(255, 255, 255, 0.02)",
                  color: active ? "#ffffff" : "#94a3b8",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: active ? "0 0 12px rgba(59, 130, 246, 0.25)" : "none",
                }}
              >
                {icons[m]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT HUD: Elevation Strata Ruler & Descriptions ── */}
      <div
        style={{
          position: "absolute",
          top: 14,
          right: 16,
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          background: "rgba(11, 15, 25, 0.85)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 10,
          padding: "10px 14px",
          maxWidth: 260,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: "#cbd5e1" }}>{activeStrata.title}</div>
        <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4, marginBottom: 4 }}>
          {activeStrata.description}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {activeStrata.levels.map((lvl) => (
            <div key={lvl.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: lvl.color,
                    boxShadow: `0 0 6px ${lvl.color}`,
                  }}
                />
                <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{lvl.label}</span>
              </div>
              <span style={{ fontSize: 9.5, color: "#475569", fontFamily: "monospace" }}>
                Y={lvl.height}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM HUD: Navigation & Interaction Guide ── */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 16,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 10,
          color: "#64748b",
          background: "rgba(11, 15, 25, 0.75)",
          backdropFilter: "blur(8px)",
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid rgba(255, 255, 255, 0.05)",
          pointerEvents: "none",
        }}
      >
        <span>🖱 左键拖拽: 360° 旋转</span>
        <span>•</span>
        <span>右键拖拽: 平移视口</span>
        <span>•</span>
        <span>滚轮: 缩放</span>
        <span>•</span>
        <span>点击节点: 查看详情</span>
      </div>

      {/* ── Hover Tooltip ── */}
      {hoveredNode && (
        <div
          style={{
            position: "absolute",
            bottom: 45,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(13, 18, 30, 0.94)",
            border: `1px solid ${hoveredNode.color}55`,
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 12,
            color: "#f1f5f9",
            fontFamily: "inherit",
            pointerEvents: "none",
            backdropFilter: "blur(12px)",
            boxShadow: `0 8px 30px rgba(0, 0, 0, 0.6), 0 0 15px ${hoveredNode.color}33`,
            textAlign: "center",
            zIndex: 30,
          }}
        >
          <div style={{ fontWeight: 600, color: hoveredNode.color, marginBottom: 2 }}>
            {(hoveredNode as any).label || (hoveredNode as any).name || hoveredNode.id}
          </div>
          <div style={{ fontSize: 10.5, color: "#94a3b8" }}>
            类型: {hoveredNode.type || "未知"} | 连接数: {hoveredNode.degree}
          </div>
        </div>
      )}
    </div>
  );
};
