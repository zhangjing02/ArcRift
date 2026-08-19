import React, { useState, useEffect } from "react";
import {
  fetchSkills,
  scanAgentSkills,
  importAgentSkills,
  createSkill,
  toggleSkill,
  deleteSkill,
  detectSystemTools,
  connectToolById,
  disconnectToolById,
} from "../../api/ArcRift";

interface SkillItem {
  id: string;
  name: string;
  description: string;
  trigger: string;
  steps: string;
  sourceTool?: string;
  sourcePath?: string;
  enabled: boolean;
  tools: string[];
  category?: string;
  rawMarkdown?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DetectedTool {
  id: string;
  name: string;
  avatar?: string;
  iconType?: string;
  detected: boolean;
  connected: boolean;
  statusText: string;
  configPath?: string;
}

// Brand SVG Icons for AI Tools
const ToolBrandIcon: React.FC<{ type?: string; name: string }> = ({ type, name }) => {
  const n = (type || name).toLowerCase();

  if (n.includes("codex") || n.includes("openai") || n.includes("chatgpt")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    );
  }

  if (n.includes("claude")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
      </svg>
    );
  }

  if (n.includes("gemini")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
          fill="url(#gemini-grad)"
        />
        <defs>
          <linearGradient id="gemini-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop offset="0.5" stopColor="#818cf8" />
            <stop offset="1" stopColor="#c084fc" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (n.includes("opencode")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M9 10l-2 2 2 2M15 10l2 2-2 2" />
      </svg>
    );
  }

  if (n.includes("antigravity")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.75">
        <circle cx="12" cy="12" r="3" />
        <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(30 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(150 12 12)" />
      </svg>
    );
  }

  if (n.includes("kiro")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 9l4 3-4 3M13 15h4" />
      </svg>
    );
  }

  if (n.includes("cursor")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="4,3 20,11 13,13 11,20" />
      </svg>
    );
  }

  if (n.includes("copilot") || n.includes("github")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="8" />
        <circle cx="9" cy="11" r="1.5" fill="currentColor" />
        <circle cx="15" cy="11" r="1.5" fill="currentColor" />
        <path d="M9 16c1.5 1 4.5 1 6 0" />
      </svg>
    );
  }

  if (n.includes("windsurf") || n.includes("codeium")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.75">
        <path d="M2 16c3-3 6-3 9 0s6 3 9 0M2 12c3-3 6-3 9 0s6 3 9 0" />
      </svg>
    );
  }

  if (n.includes("qwen")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.75">
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
        <circle cx="12" cy="12" r="3" fill="#8b5cf6" />
      </svg>
    );
  }

  if (n.includes("mistral")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
        <path d="M4 18V6l4 6 4-6 4 6 4-6v12" />
      </svg>
    );
  }

  if (n.includes("trae")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
        <path d="M4 4h16v4H4zM10 8v12h4V8z" />
      </svg>
    );
  }

  if (n.includes("deep") || n.includes("agent")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.75">
        <circle cx="12" cy="12" r="7" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    );
  }

  if (n.includes("tabnine")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2">
        <rect x="5" y="5" width="6" height="6" rx="1" />
        <rect x="13" y="5" width="6" height="6" rx="1" />
        <rect x="5" y="13" width="6" height="6" rx="1" />
        <rect x="13" y="13" width="6" height="6" rx="1" />
      </svg>
    );
  }

  // Default clean AI tool terminal glyph
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 10l3 2-3 2M13 14h3" />
    </svg>
  );
};

// 50 Other AI Tools strictly matching Nowledge Mem list
const ALL_50_OTHER_TOOLS = [
  { id: "cursor", name: "Cursor" },
  { id: "github_copilot", name: "GitHub Copilot" },
  { id: "alderdesk", name: "AlderDesk" },
  { id: "augment", name: "Augment" },
  { id: "qwen_code", name: "Qwen Code" },
  { id: "iflow_cli", name: "iFlow CLI" },
  { id: "qoder", name: "Qoder" },
  { id: "openhands", name: "OpenHands" },
  { id: "deep_agents", name: "Deep Agents" },
  { id: "tabnine_cli", name: "Tabnine CLI" },
  { id: "crush", name: "Crush" },
  { id: "mistral_vibe", name: "Mistral Vibe" },
  { id: "devin_terminal", name: "Devin for Terminal" },
  { id: "firebender", name: "Firebender" },
  { id: "forgecode", name: "ForgeCode" },
  { id: "pochi", name: "Pochi" },
  { id: "adal", name: "AdaL" },
  { id: "ibm_bob", name: "IBM Bob" },
  { id: "codebuddy", name: "CodeBuddy" },
  { id: "codemaker", name: "Codemaker" },
  { id: "code_studio", name: "Code Studio" },
  { id: "codearts_agent", name: "CodeArts Agent" },
  { id: "command_code", name: "Command Code" },
  { id: "cortex_code", name: "Cortex Code" },
  { id: "trae", name: "Trae" },
  { id: "trae_cn", name: "Trae CN" },
  { id: "windsurf", name: "Windsurf" },
  { id: "aider", name: "Aider" },
  { id: "continue_dev", name: "Continue.dev" },
  { id: "cline", name: "Cline / Roo Code" },
  { id: "zed_ai", name: "Zed AI" },
  { id: "amazon_q", name: "Amazon Q Developer" },
  { id: "replit_agent", name: "Replit Agent" },
  { id: "bolt_diy", name: "Bolt.diy" },
  { id: "lovable", name: "Lovable" },
  { id: "v0_vercel", name: "v0 by Vercel" },
  { id: "openclaw", name: "OpenClaw" },
  { id: "alma", name: "Alma" },
  { id: "goose_cli", name: "Goose CLI" },
  { id: "supermaven", name: "Supermaven" },
  { id: "codeium_windsurf", name: "Codeium Windsurf" },
  { id: "cody", name: "Sourcegraph Cody" },
  { id: "bloop", name: "Bloop" },
  { id: "cursor_nightly", name: "Cursor Nightly" },
  { id: "claude_desktop", name: "Claude Desktop" },
  { id: "chatgpt_desktop", name: "ChatGPT Desktop" },
  { id: "grok_build", name: "Grok Build" },
  { id: "pycharm_ai", name: "PyCharm AI" },
  { id: "vscode_copilot", name: "VS Code Copilot" },
  { id: "webstorm_ai", name: "WebStorm AI" },
];

export const SkillsView: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({
  onNavigateTab,
}) => {
  // Real Database Skills State
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loadingSkills, setLoadingSkills] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Real System Tools Detection State
  const [detectedTools, setDetectedTools] = useState<DetectedTool[]>([]);
  const [activeSummary, setActiveSummary] = useState<string>("Google Antigravity, Gemini CLI");
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  // Update check state
  const [hasNewVersion] = useState<boolean>(false);
  const [newVersionTag] = useState<string>("");

  // Accordion Dropdowns
  const [showOtherTools, setShowOtherTools] = useState(true);
  const [showHowItWorks, setShowHowItWorks] = useState(true);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<SkillItem | null>(null);
  const [specifyPathTool, setSpecifyPathTool] = useState<{ id: string; name: string } | null>(null);
  const [customPathInput, setCustomPathInput] = useState("");

  // Agent Skills Scanner State (in Import Modal)
  const [importTab, setImportTab] = useState<"scan" | "paste">("scan");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [scannedSkills, setScannedSkills] = useState<any[]>([]);
  const [scannedStats, setScannedStats] = useState<Record<string, number>>({});
  const [scanKeyword, setScanKeyword] = useState<string>("");
  const [pasteContent, setPasteContent] = useState<string>("");

  // Create Skill Form State
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillDesc, setNewSkillDesc] = useState("");
  const [newSkillTrigger, setNewSkillTrigger] = useState("");
  const [newSkillSteps, setNewSkillSteps] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState("工作流与规范");

  // Floating Assistant Widget
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<
    { role: "assistant" | "user"; text: string }[]
  >([
    {
      role: "assistant",
      text: "跟我说一种你的工作方式，我就把它变成你的 AI 会遵循的技能。或者打开这里任意一个技能，我来帮你打磨或用起来。",
    },
  ]);

  useEffect(() => {
    loadTools();
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setLoadingSkills(true);
    try {
      const res = await fetchSkills();
      if (res && res.success) {
        setSkills(res.skills || []);
      }
    } catch (err) {
      console.error("Failed to load skills from database", err);
    } finally {
      setLoadingSkills(false);
    }
  };

  const loadTools = async () => {
    try {
      const res = await detectSystemTools();
      if (res && res.tools && res.tools.length > 0) {
        setDetectedTools(res.tools);
        if (res.activeSummary) {
          setActiveSummary(res.activeSummary);
        }
      }
    } catch (err) {
      console.error("Failed to detect system AI tools", err);
    }
  };

  const handleScanAgents = async () => {
    setIsScanning(true);
    try {
      const res = await scanAgentSkills();
      if (res && res.success) {
        setScannedSkills(res.skills || []);
        setScannedStats(res.byTool || {});
      }
    } catch (err) {
      console.error("Failed to scan agent skills", err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleImportAllScanned = async (selectedIds?: string[]) => {
    setIsImporting(true);
    try {
      const res = await importAgentSkills(selectedIds);
      if (res && res.success) {
        alert(res.message);
        await loadSkills();
        setIsImportModalOpen(false);
      } else {
        alert("导入失败: " + res.message);
      }
    } catch (err) {
      console.error("Failed to import agent skills", err);
      alert("导入过程发生异常");
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggleSkill = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await toggleSkill(id);
      if (res && res.success) {
        setSkills((prev) =>
          prev.map((s) => (s.id === id ? { ...s, enabled: res.enabled } : s))
        );
      }
    } catch (err) {
      console.error("Failed to toggle skill", err);
    }
  };

  const handleDeleteSkill = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确定要删除技能「${name}」吗？`)) return;
    try {
      const res = await deleteSkill(id);
      if (res && res.success) {
        setSkills((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete skill", err);
    }
  };

  const handleConnectTool = async (toolId: string) => {
    setIsConnecting(toolId);
    try {
      const res = await connectToolById(toolId);
      if (res.success) {
        alert(res.message);
        await loadTools();
      } else {
        alert("连接提示: " + res.message);
      }
    } catch (err) {
      console.error("Failed to connect tool", err);
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnectTool = async (toolId: string) => {
    try {
      const res = await disconnectToolById(toolId);
      if (res.success) {
        await loadTools();
      }
    } catch (err) {
      console.error("Failed to disconnect tool", err);
    }
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;

    try {
      const res = await createSkill({
        name: newSkillName.trim(),
        description: newSkillDesc.trim(),
        trigger: newSkillTrigger.trim(),
        steps: newSkillSteps.trim(),
        category: newSkillCategory,
        tools: ["Google Antigravity", "Codex", "Claude Code"],
      });

      if (res && res.success) {
        await loadSkills();
        setIsCreateModalOpen(false);
        setNewSkillName("");
        setNewSkillDesc("");
        setNewSkillTrigger("");
        setNewSkillSteps("");
      } else {
        alert("创建失败: " + res.message);
      }
    } catch (err) {
      console.error("Failed to create skill", err);
    }
  };

  const handleSaveCustomPath = () => {
    if (!customPathInput.trim() || !specifyPathTool) return;
    alert(`已为 ${specifyPathTool.name} 成功绑定自定义路径：\n${customPathInput}`);
    setSpecifyPathTool(null);
    setCustomPathInput("");
  };

  const handleAssistantSend = () => {
    if (!assistantInput.trim()) return;
    const userMsg = assistantInput;
    setAssistantMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setAssistantInput("");

    setTimeout(() => {
      setAssistantMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `收到！我已经为你提炼出技能草稿「${userMsg.slice(0, 24)}...」，包含触发规则与步骤。你可以点击左上角「+ 描述你的第一个技能」将其保存并同步到所有已连接的 AI 工具！`,
        },
      ]);
    }, 600);
  };

  // Filter skills by search query
  const filteredSkills = skills.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q)) ||
      (s.category && s.category.toLowerCase().includes(q)) ||
      (s.sourceTool && s.sourceTool.toLowerCase().includes(q))
    );
  });

  // Real detected or connected tools on user's machine
  const realDetectedTools = detectedTools.filter((t) => t.detected || t.connected);
  const detectedIds = realDetectedTools.map((t) => t.id.toLowerCase());

  // Other tools (not detected on user's machine)
  const remainingOtherTools = ALL_50_OTHER_TOOLS.filter(
    (t) => !detectedIds.includes(t.id.toLowerCase())
  );

  return (
    <div className="nl-skills-page-container">
      {/* 1. Header Bar: Title and Subtitle */}
      <div className="nl-skills-top-bar">
        <div className="nl-skills-header-left">
          <div className="nl-skills-header-title-row">
            <span className="nl-skills-title-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
            <h1 className="nl-skills-title">技能</h1>
          </div>
          <div className="nl-skills-subtitle">从你的经验中提炼出的可复用流程</div>
        </div>

        {hasNewVersion && (
          <div className="nl-skills-header-right">
            <button
              className="nl-skills-update-btn"
              onClick={() => alert(`准备下载并安装新版本 ${newVersionTag}...`)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>安装更新</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Main Content Scroll Area */}
      <div className="nl-skills-content-scroll">
        {/* Hero Section */}
        <div className="nl-skills-hero">
          <h2 className="nl-hero-title">教你的 AI 照你的方式做事</h2>
          <p className="nl-hero-desc">
            描述一种你的做事方式：你怎么发布一次版本、怎么审一个 PR、怎么做投资研报。ChronosMind 会把它变成技能，让你的 AI 在你连接的每个工具里都照着做。
          </p>

          <div className="nl-hero-actions">
            <button
              className="nl-btn-pill-white"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <span>＋</span>
              <span>描述你的第一个技能</span>
            </button>
            <button
              className="nl-btn-pill-dark"
              onClick={() => {
                setIsImportModalOpen(true);
                handleScanAgents();
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>导入你已经写好的 ({skills.length > 0 ? `已收录 ${skills.length}` : "扫描本机 Agent 技能"})</span>
            </button>
          </div>

          <div className="nl-hero-sublink">
            <span>Mem 也会在你工作时自己发现它们。已经用过其他 AI 工具？ </span>
            <button
              className="nl-inline-link"
              onClick={() => onNavigateTab && onNavigateTab("threads")}
            >
              把那些会话记录导入进来
            </button>
          </div>
        </div>

        {/* Active Skills (Loaded from SQLite Database) */}
        <div className="nl-active-skills-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div className="nl-skills-section-header" style={{ margin: 0 }}>
              已启用的技能 ({filteredSkills.filter((s) => s.enabled).length} / {skills.length})
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="搜索技能名称、描述或分类..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  backgroundColor: "#16171d",
                  border: "1px solid #282a36",
                  color: "#fff",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  width: "220px",
                }}
              />
              <button
                onClick={() => {
                  setIsImportModalOpen(true);
                  handleScanAgents();
                }}
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  color: "#34d399",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                📥 扫描/导入本机技能
              </button>
            </div>
          </div>

          {loadingSkills ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
              正在加载 ChronosMind 技能库...
            </div>
          ) : skills.length === 0 ? (
            <div style={{
              padding: "36px 24px",
              textAlign: "center",
              backgroundColor: "#121318",
              border: "1px dashed #262934",
              borderRadius: "10px",
              color: "#94a3b8"
            }}>
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>⚡</div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#f1f5f9", marginBottom: "6px" }}>
                尚未导入任何 Agent 技能
              </div>
              <p style={{ fontSize: "13px", color: "#64748b", maxWidth: "460px", margin: "0 auto 18px" }}>
                ChronosMind 已自动检测到您本机安装的 Codex、Antigravity、Claude 等 Agent 工具中的现成技能，点击下方即可一键导入！
              </p>
              <button
                className="nl-btn-pill-white"
                style={{ padding: "8px 20px", fontSize: "13px" }}
                onClick={() => {
                  setIsImportModalOpen(true);
                  handleScanAgents();
                }}
              >
                📥 立即扫描并导入本机所有 Agent 技能
              </button>
            </div>
          ) : (
            <div className="nl-skills-cards-list">
              {filteredSkills.map((s) => (
                <div
                  key={s.id}
                  className="nl-skill-item-card"
                  onClick={() => setDetailSkill(s)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="nl-skill-card-top">
                    <span className="nl-skill-card-icon">❖</span>
                    <span className="nl-skill-card-name">{s.name}</span>
                    {s.category && (
                      <span style={{
                        fontSize: "11px",
                        backgroundColor: "#1e222e",
                        color: "#93c5fd",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        border: "1px solid rgba(147, 197, 253, 0.2)",
                        marginLeft: "8px",
                      }}>
                        {s.category}
                      </span>
                    )}
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
                      <button
                        onClick={(e) => handleToggleSkill(s.id, e)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 500,
                          color: s.enabled ? "#34d399" : "#64748b",
                        }}
                      >
                        {s.enabled ? "● 已生效" : "○ 已暂停"}
                      </button>
                      <button
                        onClick={(e) => handleDeleteSkill(s.id, s.name, e)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: "13px",
                          padding: "2px 4px",
                          opacity: 0.7,
                        }}
                        title="删除技能"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <p className="nl-skill-card-desc">{s.description}</p>

                  <div className="nl-skill-card-trigger">
                    <span className="nl-trigger-label">触发条件：</span>
                    <span>{s.trigger}</span>
                  </div>

                  <div className="nl-skill-card-tools">
                    {s.sourceTool && (
                      <span style={{
                        fontSize: "11px",
                        backgroundColor: "#181e29",
                        color: "#60a5fa",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        border: "1px solid rgba(96, 165, 250, 0.3)",
                      }}>
                        来源: {s.sourceTool}
                      </span>
                    )}
                    {s.tools && s.tools.map((t) => (
                      <span key={t} className="nl-tool-pill">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. "在你的工具中使用这些技能" Section */}
        <div className="nl-tool-ecosystem-section">
          <div className="nl-eco-header-row">
            <div className="nl-eco-title-group">
              <div className="nl-eco-title">
                <span className="nl-eco-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
                  </svg>
                </span>
                <span>在你的工具中使用这些技能</span>
              </div>
              <div className="nl-eco-sub">
                已启用的技能会作为你的智能体已经在读取的原生文件出现。
              </div>
              <div className="nl-eco-waiting-tip">
                <span className="nl-green-dot">●</span> 等待工具首次使用技能
              </div>
            </div>

            <div className="nl-eco-status-badge">
              <span className="nl-green-dot">●</span> 正在 {activeSummary} 中生效
            </div>
          </div>

          {/* Primary Detected & Connected Tools List */}
          <div className="nl-eco-tools-list">
            {realDetectedTools.length === 0 ? (
              <div style={{ padding: "16px 20px", color: "#9ca3af", fontSize: "13px", backgroundColor: "#14151a", borderRadius: "8px", border: "1px solid #20222a" }}>
                正在扫描系统 AI 工具配置...（如未自动识别，可在下方「其他工具」中指定路径）
              </div>
            ) : (
              realDetectedTools.map((tool) => (
                <div key={tool.id} className="nl-tool-card-row">
                  <div className="nl-tool-card-left">
                    <div className="nl-tool-icon-box">
                      <ToolBrandIcon type={tool.id} name={tool.name} />
                    </div>
                    <div className="nl-tool-info">
                      <div className="nl-tool-name">{tool.name}</div>
                      <div className="nl-tool-status-desc">{tool.statusText}</div>
                    </div>
                  </div>

                  <div className="nl-tool-card-right">
                    {tool.connected ? (
                      <button
                        className="nl-btn-disconnect"
                        onClick={() => handleDisconnectTool(tool.id)}
                      >
                        断开
                      </button>
                    ) : tool.detected ? (
                      <button
                        className="nl-btn-connect"
                        onClick={() => handleConnectTool(tool.id)}
                        disabled={isConnecting === tool.id}
                      >
                        {isConnecting === tool.id ? "连接中..." : "连接"}
                      </button>
                    ) : (
                      <button
                        className="nl-btn-specify-path"
                        onClick={() => setSpecifyPathTool(tool)}
                      >
                        指定路径
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 4. Collapsible Section: 其他工具 (N) */}
          <div className="nl-accordion-wrap">
            <button
              className="nl-skills-accordion-toggle"
              onClick={() => setShowOtherTools(!showOtherTools)}
            >
              <span className={`nl-accordion-arrow ${showOtherTools ? "open" : ""}`}>
                {showOtherTools ? "v" : ">"}
              </span>
              <span>其他工具 ({remainingOtherTools.length})</span>
            </button>

            {showOtherTools && (
              <div className="nl-other-tools-full-list">
                {remainingOtherTools.map((tool) => (
                  <div key={tool.id} className="nl-tool-card-row">
                    <div className="nl-tool-card-left">
                      <div className="nl-tool-icon-box">
                        <ToolBrandIcon type={tool.id} name={tool.name} />
                      </div>
                      <div className="nl-tool-info">
                        <div className="nl-tool-name">{tool.name}</div>
                        <div className="nl-tool-status-desc">未检测到</div>
                      </div>
                    </div>

                    <div className="nl-tool-card-right">
                      <button
                        className="nl-btn-specify-path"
                        onClick={() => setSpecifyPathTool(tool)}
                      >
                        指定路径
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Collapsible Section: 工作原理 */}
          <div className="nl-accordion-wrap">
            <button
              className="nl-skills-accordion-toggle"
              onClick={() => setShowHowItWorks(!showHowItWorks)}
            >
              <span className={`nl-accordion-arrow ${showHowItWorks ? "open" : ""}`}>
                {showHowItWorks ? "v" : ">"}
              </span>
              <span>工作原理</span>
            </button>

            {showHowItWorks && (
              <div className="nl-how-it-works-content">
                你启用的技能会放进每个工具自己的技能目录下的 nowledge-mem 文件夹。工具会像读取普通文件一样自动加载它们，不会改动其他任何东西，你自己的技能也保持独立。关闭某个工具即可移除链接。
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Floating Circular Magic Wand Button (Bottom Right - 1:1 with Screenshot) */}
      <button
        className="nl-floating-fab-btn"
        title="技能助手"
        onClick={() => setIsAssistantOpen(!isAssistantOpen)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M12.2 6.2L11 5M17.8 6.2L19 5M12.2 11.8L11 13" />
          <path d="M3 21l9-9" />
          <path d="M12.2 11.8l-1.4-1.4a2 2 0 0 1 0-2.8l3.6-3.6a2 2 0 0 1 2.8 0l1.4 1.4a2 2 0 0 1 0 2.8l-3.6 3.6a2 2 0 0 1-2.8 0z" />
        </svg>
      </button>

      {/* Floating Skill Assistant Drawer / Dialog */}
      {isAssistantOpen && (
        <div className="nl-floating-assistant-panel">
          <div className="nl-assistant-header">
            <div className="nl-assistant-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M12.2 6.2L11 5" />
                <path d="M3 21l9-9" />
              </svg>
              <span>技能助手</span>
            </div>
            <button className="nl-close-btn-subtle" onClick={() => setIsAssistantOpen(false)}>
              ✕
            </button>
          </div>

          <div className="nl-assistant-body">
            <div className="nl-assistant-messages">
              {assistantMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`nl-assistant-msg-bubble ${
                    msg.role === "assistant" ? "ai-msg" : "user-msg"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
            </div>

            <div className="nl-assistant-input-wrap">
              <input
                type="text"
                placeholder="跟我说一种你的工作方式，或提问..."
                value={assistantInput}
                onChange={(e) => setAssistantInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAssistantSend();
                }}
                className="nl-assistant-input"
              />
              <button
                className="nl-assistant-send-btn"
                disabled={!assistantInput.trim()}
                onClick={handleAssistantSend}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Specify Custom Tool Path */}
      {specifyPathTool && (
        <div className="nl-modal-backdrop" onClick={() => setSpecifyPathTool(null)}>
          <div className="nl-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="nl-modal-header">
              <h2 className="nl-modal-title">指定 {specifyPathTool.name} 路径</h2>
              <button className="nl-close-btn" onClick={() => setSpecifyPathTool(null)}>
                ✕
              </button>
            </div>

            <div className="nl-modal-form">
              <div className="nl-form-group">
                <label>配置文件或技能存放目录 (Configuration / Skills Directory)</label>
                <input
                  type="text"
                  placeholder="例如：C:\Users\Username\.tool\skills 或 /home/user/.tool"
                  value={customPathInput}
                  onChange={(e) => setCustomPathInput(e.target.value)}
                />
              </div>

              <div className="nl-modal-actions">
                <button
                  type="button"
                  className="nl-btn-secondary"
                  onClick={() => setSpecifyPathTool(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="nl-btn-primary"
                  onClick={handleSaveCustomPath}
                >
                  保存并同步技能
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Describe New Skill */}
      {isCreateModalOpen && (
        <div className="nl-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div className="nl-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="nl-modal-header">
              <h2 className="nl-modal-title">描述你的新技能</h2>
              <button className="nl-close-btn" onClick={() => setIsCreateModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSkill} className="nl-modal-form">
              <div className="nl-form-group">
                <label>技能名称 (Skill Name)</label>
                <input
                  type="text"
                  placeholder="例如：BeBeBus OTA 升级接口规范与错误码排查"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  required
                />
              </div>

              <div className="nl-form-group">
                <label>技能分类 (Category)</label>
                <select
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value)}
                  style={{
                    backgroundColor: "#16171d",
                    border: "1px solid #282a36",
                    color: "#fff",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    width: "100%",
                  }}
                >
                  <option value="工作流与规范">工作流与规范</option>
                  <option value="金融与投资研报">金融与投资研报</option>
                  <option value="移动端开发与架构">移动端开发与架构</option>
                  <option value="工程效能与流程">工程效能与流程</option>
                  <option value="生命科学与数据">生命科学与数据</option>
                </select>
              </div>

              <div className="nl-form-group">
                <label>简要描述 (Description)</label>
                <input
                  type="text"
                  placeholder="该技能的核心目标与要求"
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                />
              </div>

              <div className="nl-form-group">
                <label>标准执行步骤与规范 (Procedure Markdown)</label>
                <textarea
                  rows={4}
                  placeholder="1. 第一步：传参验证...\n2. 第二步：错误码拦截...\n3. 核心规约..."
                  value={newSkillSteps}
                  onChange={(e) => setNewSkillSteps(e.target.value)}
                />
              </div>

              <div className="nl-modal-actions">
                <button
                  type="button"
                  className="nl-btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  取消
                </button>
                <button type="submit" className="nl-btn-primary">
                  保存并启用技能
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Modal: Import Agent Skills (Scanner & Batch Importer) */}
      {isImportModalOpen && (
        <div className="nl-modal-backdrop" onClick={() => setIsImportModalOpen(false)}>
          <div className="nl-modal-card" style={{ maxWidth: "760px", width: "92%" }} onClick={(e) => e.stopPropagation()}>
            <div className="nl-modal-header">
              <div>
                <h2 className="nl-modal-title">导入 Agent 技能</h2>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  自动扫描并读取本机 Codex、Google Antigravity、Claude 等 Agent 工具中的 SKILL.md
                </div>
              </div>
              <button className="nl-close-btn" onClick={() => setIsImportModalOpen(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid #20232e", padding: "0 20px 12px" }}>
              <button
                type="button"
                onClick={() => setImportTab("scan")}
                style={{
                  background: "none",
                  border: "none",
                  color: importTab === "scan" ? "#fff" : "#64748b",
                  borderBottom: importTab === "scan" ? "2px solid #38bdf8" : "2px solid transparent",
                  paddingBottom: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                自动扫描本机 ({scannedSkills.length > 0 ? scannedSkills.length : "待扫描"})
              </button>
              <button
                type="button"
                onClick={() => setImportTab("paste")}
                style={{
                  background: "none",
                  border: "none",
                  color: importTab === "paste" ? "#fff" : "#64748b",
                  borderBottom: importTab === "paste" ? "2px solid #38bdf8" : "2px solid transparent",
                  paddingBottom: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                手动粘贴 SKILL.md
              </button>
            </div>

            {importTab === "scan" ? (
              <div style={{ padding: "16px 20px" }}>
                {/* Stats Header */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "#151720",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  border: "1px solid #252836",
                  flexWrap: "wrap",
                  gap: "10px",
                }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "12px", color: "#cbd5e1", flexWrap: "wrap" }}>
                    <span>共扫描到 <strong>{scannedSkills.length}</strong> 个技能</span>
                    {Object.entries(scannedStats).map(([tool, count]) => (
                      <span key={tool} style={{ color: "#93c5fd", backgroundColor: "#1e293b", padding: "2px 6px", borderRadius: "4px" }}>
                        {tool}: {count}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={handleScanAgents}
                      disabled={isScanning}
                      style={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #334155",
                        color: "#94a3b8",
                        borderRadius: "6px",
                        padding: "6px 12px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      {isScanning ? "扫描中..." : "🔄 重新扫描"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleImportAllScanned()}
                      disabled={isImporting || scannedSkills.length === 0}
                      style={{
                        backgroundColor: "#059669",
                        border: "none",
                        color: "#fff",
                        borderRadius: "6px",
                        padding: "6px 14px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {isImporting ? "正在写入..." : `📥 全部导入到 ChronosMind (${scannedSkills.length})`}
                    </button>
                  </div>
                </div>

                {/* Filter and Scanned Skills List */}
                <input
                  type="text"
                  placeholder="过滤待导入技能..."
                  value={scanKeyword}
                  onChange={(e) => setScanKeyword(e.target.value)}
                  style={{
                    backgroundColor: "#121318",
                    border: "1px solid #252836",
                    color: "#fff",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    width: "100%",
                    marginBottom: "12px",
                  }}
                />

                <div style={{ maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {scannedSkills
                    .filter((s) => !scanKeyword || s.name.toLowerCase().includes(scanKeyword.toLowerCase()) || (s.description && s.description.toLowerCase().includes(scanKeyword.toLowerCase())))
                    .map((s) => (
                      <div
                        key={s.id}
                        style={{
                          backgroundColor: "#14161f",
                          border: "1px solid #232635",
                          borderRadius: "6px",
                          padding: "10px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ maxWidth: "78%" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "13px" }}>{s.name}</span>
                            <span style={{ fontSize: "11px", color: "#60a5fa", backgroundColor: "#1e293b", padding: "1px 6px", borderRadius: "4px" }}>
                              {s.sourceTool}
                            </span>
                            {s.isImported && (
                              <span style={{ fontSize: "11px", color: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.1)", padding: "1px 6px", borderRadius: "4px" }}>
                                已在库中
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.description || s.trigger}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleImportAllScanned([s.id])}
                          style={{
                            backgroundColor: s.isImported ? "#1e293b" : "rgba(16, 185, 129, 0.2)",
                            border: s.isImported ? "1px solid #334155" : "1px solid rgba(16, 185, 129, 0.4)",
                            color: s.isImported ? "#94a3b8" : "#34d399",
                            borderRadius: "4px",
                            padding: "4px 10px",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          {s.isImported ? "重新同步" : "导入"}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="nl-modal-form" style={{ padding: "16px 20px" }}>
                <div className="nl-form-group">
                  <label>粘贴 SKILL.md 或 Prompt 文本</label>
                  <textarea
                    rows={8}
                    placeholder="---&#10;name: MySkill&#10;description: 技能说明...&#10;---&#10;&#10;## 步骤..."
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                  />
                </div>

                <div className="nl-modal-actions">
                  <button
                    type="button"
                    className="nl-btn-secondary"
                    onClick={() => setIsImportModalOpen(false)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="nl-btn-primary"
                    onClick={async () => {
                      if (!pasteContent.trim()) return;
                      await createSkill({
                        name: "粘贴导入技能_" + Date.now().toString().slice(-4),
                        description: "从剪贴板导入的技能规范",
                        rawMarkdown: pasteContent,
                      });
                      await loadSkills();
                      setIsImportModalOpen(false);
                      setPasteContent("");
                    }}
                  >
                    确认解析并导入
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 10. Modal: Skill Detail View / Drawer */}
      {detailSkill && (
        <div className="nl-modal-backdrop" onClick={() => setDetailSkill(null)}>
          <div className="nl-modal-card" style={{ maxWidth: "800px", width: "92%" }} onClick={(e) => e.stopPropagation()}>
            <div className="nl-modal-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <h2 className="nl-modal-title">{detailSkill.name}</h2>
                  <span style={{
                    fontSize: "12px",
                    color: detailSkill.enabled ? "#34d399" : "#94a3b8",
                    backgroundColor: detailSkill.enabled ? "rgba(16, 185, 129, 0.1)" : "#1e293b",
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}>
                    {detailSkill.enabled ? "● 已生效" : "○ 已暂停"}
                  </span>
                  {detailSkill.sourceTool && (
                    <span style={{
                      fontSize: "12px",
                      color: "#60a5fa",
                      backgroundColor: "#1e293b",
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}>
                      来源: {detailSkill.sourceTool}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  {detailSkill.sourcePath ? `路径: ${detailSkill.sourcePath}` : "本地 ChronosMind 技能"}
                </div>
              </div>
              <button className="nl-close-btn" onClick={() => setDetailSkill(null)}>
                ✕
              </button>
            </div>

            <div style={{ maxHeight: "460px", overflowY: "auto", padding: "16px 20px" }}>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "4px" }}>描述</div>
                <div style={{ fontSize: "13px", color: "#f1f5f9" }}>{detailSkill.description}</div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "4px" }}>触发规则</div>
                <div style={{ fontSize: "13px", color: "#cbd5e1", backgroundColor: "#151720", padding: "8px 12px", borderRadius: "6px" }}>
                  {detailSkill.trigger}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "4px" }}>完整 SKILL 规范正文</div>
                <pre style={{
                  backgroundColor: "#0d0e12",
                  padding: "12px 16px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#cbd5e1",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  lineHeight: "1.6",
                  border: "1px solid #1e212b",
                }}>
                  {detailSkill.rawMarkdown || detailSkill.steps}
                </pre>
              </div>
            </div>

            <div className="nl-modal-actions" style={{ padding: "12px 20px" }}>
              <button
                type="button"
                className="nl-btn-secondary"
                onClick={() => setDetailSkill(null)}
              >
                关闭
              </button>
              <button
                type="button"
                className="nl-btn-primary"
                onClick={async () => {
                  await toggleSkill(detailSkill.id);
                  setDetailSkill({ ...detailSkill, enabled: !detailSkill.enabled });
                  await loadSkills();
                }}
              >
                {detailSkill.enabled ? "暂停该技能" : "启用该技能"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
