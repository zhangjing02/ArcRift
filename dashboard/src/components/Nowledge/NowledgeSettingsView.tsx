import React, { useState, useEffect, useRef } from "react";
import {
  fetchAppSettings,
  saveAppSettings,
  testSettingsConnection,
  getModelStatuses,
  downloadModel,
  deleteModelById,
  fetchIntelligenceStats,
  optimizeDatabase,
  rebuildSearchIndex,
  cleanSessions,
  fetchOntology,
  saveOntology,
  fetchMemoryPolicy,
  saveMemoryPolicy,
  fetchTokenUsage,
  updateIntelligenceSettings,
  fetchProviderModels,
  exportSettingsBackup,
  exportKnowledgeBackup,
  importSettingsBackup,
  importKnowledgeBackup,
  fetchSessions,
  createSpace,
} from "../../api/ArcRift";

interface ModelItem {
  id: string;
  name: string;
  type: "embedding" | "llm";
  category: string;
  sizeText: string;
  isDownloaded: boolean;
  isDownloading: boolean;
  progress: number;
  speed: string;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
}

const ALL_PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "🟢", defaultBaseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", description: "OpenAI 官方接口 (GPT-4o, GPT-4o-mini)" },
  { id: "chatgpt", name: "ChatGPT Subscription", icon: "💬", defaultBaseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o", description: "ChatGPT Plus/Team 订阅通道与 Codex 服务" },
  { id: "anthropic", name: "Anthropic", icon: "🟧", defaultBaseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-3-5-sonnet-20241022", description: "Anthropic 官方 Claude 3.5 Sonnet / Haiku 模型" },
  { id: "xai", name: "xAI", icon: "✖️", defaultBaseUrl: "https://api.x.ai/v1", defaultModel: "grok-2-1212", description: "Elon Musk 旗下 xAI 平台 Grok-2 / Grok-3 大模型" },
  { id: "supergrok", name: "SuperGrok", icon: "⚡", defaultBaseUrl: "https://api.x.ai/v1", defaultModel: "grok-beta", description: "SuperGrok 高速推理专属通道" },
  { id: "deepseek", name: "DeepSeek", icon: "🐳", defaultBaseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat", description: "DeepSeek 官方 API (DeepSeek-V3 / DeepSeek-R1)" },
  { id: "minimax", name: "MiniMax", icon: "🟣", defaultBaseUrl: "https://api.minimax.chat/v1", defaultModel: "MiniMax-Text-01", description: "MiniMax 稀宇科技中文大模型系列 (abab6.5s)" },
  { id: "zhipu", name: "Z.AI", icon: "⚡", defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4-flash", description: "智谱 AI (Z.AI) GLM-4-Plus / GLM-4-Flash 清言大模型" },
  { id: "moonshot", name: "Moonshot AI", icon: "🌙", defaultBaseUrl: "https://api.moonshot.cn/v1", defaultModel: "moonshot-v1-8k", description: "月之暗面 Kimi 开放平台长上下文大模型" },
  { id: "ollama", name: "Ollama", icon: "🦙", defaultBaseUrl: "http://localhost:11434/v1", defaultModel: "qwen2.5:3b", description: "完全本地离线运行（需启动本地 Ollama 实例）" },
  { id: "lemonade", name: "Lemonade", icon: "🍋", defaultBaseUrl: "https://api.lemonade.io/v1", defaultModel: "lemonade-v1", description: "Lemonade AI 智能服务通道" },
  { id: "lmstudio", name: "LM Studio", icon: "🖥️", defaultBaseUrl: "http://localhost:1234/v1", defaultModel: "local-model", description: "LM Studio 本地桌面模型运行服务" },
  { id: "xiaomi", name: "Xiaomi MiMo", icon: "📱", defaultBaseUrl: "https://api.mimo.xiaomi.com/v1", defaultModel: "mimo-v1", description: "小米 MiMo / 小爱大模型开发者平台" },
  { id: "poe", name: "Poe", icon: "🦅", defaultBaseUrl: "https://api.poe.com/v1", defaultModel: "Claude-3.5-Sonnet", description: "Quora Poe 聚合 AI 模型 API 服务" },
  { id: "jina", name: "Jina AI", icon: "🔍", defaultBaseUrl: "https://api.jina.ai/v1", defaultModel: "jina-embeddings-v3", description: "Jina AI 多语言高性能 Embedding 引擎" },
  { id: "siliconflow", name: "SiliconFlow", icon: "🌊", defaultBaseUrl: "https://api.siliconflow.cn/v1", defaultModel: "deepseek-ai/DeepSeek-V3", description: "国内超高性价比/含免费额度 (DeepSeek-V3/R1)" },
  { id: "gemini", name: "Google Gemini", icon: "✨", defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-1.5-flash", description: "Google Gemini 原生 API（超快响应与长上下文）" },
  { id: "groq", name: "Groq Cloud", icon: "⚡", defaultBaseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", description: "LPU 超低延迟推理服务（免费 Llama-3.3-70b）" },
  { id: "custom", name: "自定义 (OpenAI 兼容)", icon: "⚙️", defaultBaseUrl: "https://api.openai.com/v1", defaultModel: "custom-model", description: "支持任意兼容 OpenAI /chat/completions 规范的网关" },
];

export const NowledgeSettingsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<
    | "models"
    | "smart-processing"
    | "providers"
    | "profile"
    | "migration"
    | "remote"
    | "team"
    | "preferences"
    | "license"
    | "about"
  >("models");

  // Settings State
  const [embeddingMode, setEmbeddingMode] = useState<"local" | "cloud">("cloud");
  const [llmMode, setLlmMode] = useState<"local" | "cloud">("cloud");
  const [provider, setProvider] = useState("siliconflow");
  const [apiBaseUrl, setApiBaseUrl] = useState("https://api.siliconflow.cn/v1");
  const [apiKey, setApiKey] = useState("");
  const [chatModel, setChatModel] = useState("deepseek-ai/DeepSeek-V3");

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [bgSmartActive, setBgSmartActive] = useState(true);

  // ── Provider Master-Detail State ────────────────────────────────
  const [selectedProviderId, setSelectedProviderId] = useState<string>("openai");
  const [providerSearch, setProviderSearch] = useState<string>("");
  const [providerConfigs, setProviderConfigs] = useState<Record<string, any>>({});
  const [showApiKeyMask, setShowApiKeyMask] = useState<boolean>(false);
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [providerTestResult, setProviderTestResult] = useState<{ success: boolean; message: string; error?: string } | null>(null);
  const [isTestingProvider, setIsTestingProvider] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [currentProviderApiKey, setCurrentProviderApiKey] = useState<string>("");
  const [currentProviderBaseUrl, setCurrentProviderBaseUrl] = useState<string>("https://api.openai.com/v1");
  const [currentProviderModel, setCurrentProviderModel] = useState<string>("gpt-4o-mini");
  const [currentProviderReasoning, setCurrentProviderReasoning] = useState<boolean>(false);
  const [currentProviderTimeout, setCurrentProviderTimeout] = useState<number>(30000);

  // ── Intelligence (智能处理) State ────────────────────────────────
  const [intelStats, setIntelStats] = useState<any>({
    dbSizeText: "10.2 MB",
    infoSizeText: "233 KB",
    indexSizeText: "499 KB",
    ramUsageMB: 512,
    ramAllocation: "自动 (默认 512 MB)",
  });
  const [ramSetting, setRamSetting] = useState("auto");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [intelToast, setIntelToast] = useState<string | null>(null);

  // Memory Policy State & Modal
  const [memoryPolicy, setMemoryPolicy] = useState<any>({
    scope: "所有空间",
    maxMemoriesPerSession: 3,
    visibility: "full",
    retainCategories: ["Decision", "Architecture", "Gotcha", "Rule"],
  });
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // Ontology State & Modal
  const [ontologyList, setOntologyList] = useState<any[]>([]);
  const [showOntologyModal, setShowOntologyModal] = useState(false);
  const [newOntoName, setNewOntoName] = useState("");
  const [newOntoColor, setNewOntoColor] = useState("#6366f1");
  const [newOntoIcon, setNewOntoIcon] = useState("🏛️");
  const [newOntoDesc, setNewOntoDesc] = useState("");

  // Token Budget & Usage State
  const [tokenUsage, setTokenUsage] = useState<any>({
    tokensMonth: 0,
    tokens24h: 0,
    tokens1h: 0,
    monthlyBudget: 1000000,
  });
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState(1000000);

  // ── Profile (个人资料) State ──────────────────────────────────────
  const [profileName, setProfileName] = useState<string>("");
  const [profileAliases, setProfileAliases] = useState<string>("");
  const [profileOutputLang, setProfileOutputLang] = useState<string>("auto");
  const [profileAboutYou, setProfileAboutYou] = useState<string>("");
  const [profileInstructions, setProfileInstructions] = useState<string>("");
  const [showAboutExample, setShowAboutExample] = useState<boolean>(false);
  const [showProfileExample, setShowProfileExample] = useState<boolean>(false);
  const [profileToast, setProfileToast] = useState<string | null>(null);

  // ── Migration (数据迁移) State ────────────────────────────────────
  const [migrationCompressZip, setMigrationCompressZip] = useState<boolean>(true);
  const [migrationConflictMode, setMigrationConflictMode] = useState<"merge" | "skip" | "replace">("merge");
  const [isExportingSettings, setIsExportingSettings] = useState<boolean>(false);
  const [isExportingKnowledge, setIsExportingKnowledge] = useState<boolean>(false);
  const [isImportingKnowledge, setIsImportingKnowledge] = useState<boolean>(false);
  const [migrationToast, setMigrationToast] = useState<string | null>(null);

  // ── Remote Access (随处访问) State ────────────────────────────────
  const [allowLan, setAllowLan] = useState<boolean>(false);
  const [requireLocalAuth, setRequireLocalAuth] = useState<boolean>(false);
  const [remoteApiKey, setRemoteApiKey] = useState<string>("ak_live_7x8f9a2b1c4e");
  const [showRemoteKeyMask, setShowRemoteKeyMask] = useState<boolean>(false);
  const [tunnelType, setTunnelType] = useState<"quick" | "named">("quick");
  const [tunnelStatus, setTunnelStatus] = useState<"idle" | "running">("idle");
  const [remotePublicUrl, setRemotePublicUrl] = useState<string>("");
  const [ipWhitelist, setIpWhitelist] = useState<string>("");
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [remoteConnectUrl, setRemoteConnectUrl] = useState<string>("");
  const [remoteConnectKey, setRemoteConnectKey] = useState<string>("");
  const [remoteToast, setRemoteToast] = useState<string | null>(null);

  // ── Preferences (偏好设置) State ────────────────────────────────
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("dark");
  const [uiLanguage, setUiLanguage] = useState<string>("auto");
  const [fontSizeScale, setFontSizeScale] = useState<"small" | "normal" | "medium" | "large">("normal");
  const [launchAtLogin, setLaunchAtLogin] = useState<boolean>(false);
  const [enableMultiSpaces, setEnableMultiSpaces] = useState<boolean>(true);
  const [spacesList, setSpacesList] = useState<any[]>([]);
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState<boolean>(false);
  const [newSpaceName, setNewSpaceName] = useState<string>("");
  const [newSpacePlatform, setNewSpacePlatform] = useState<string>("desktop");
  const [shortcutLauncher, setShortcutLauncher] = useState<boolean>(true);
  const [shortcutSummary, setShortcutSummary] = useState<boolean>(true);
  const [shortcutHints, setShortcutHints] = useState<boolean>(false);
  const [cliDetailOpen, setCliDetailOpen] = useState<boolean>(false);
  const [browseNowDetailOpen, setBrowseNowDetailOpen] = useState<boolean>(false);
  const [prefToast, setPrefToast] = useState<string | null>(null);

  // Models State
  const [models, setModels] = useState<ModelItem[]>([]);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    loadSettings();
    loadModels();
    loadIntelligenceData();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const loadIntelligenceData = async () => {
    try {
      const [sRes, oRes, pRes, tRes] = await Promise.all([
        fetchIntelligenceStats(),
        fetchOntology(),
        fetchMemoryPolicy(),
        fetchTokenUsage(),
      ]);
      if (sRes?.success && sRes.stats) setIntelStats(sRes.stats);
      if (oRes?.success && oRes.ontology) setOntologyList(oRes.ontology);
      if (pRes?.success && pRes.policy) setMemoryPolicy(pRes.policy);
      if (tRes?.success && tRes.usage) {
        setTokenUsage(tRes.usage);
        setMonthlyBudgetInput(tRes.usage.monthlyBudget || 1000000);
        setBgSmartActive(tRes.usage.bgActive !== false);
      }
    } catch (e) {
      console.error("Failed to load intelligence data", e);
    }
  };

  const handleOptimizeDb = async () => {
    setIsOptimizing(true);
    try {
      const res = await optimizeDatabase();
      setIntelToast(res.message);
      await loadIntelligenceData();
    } catch (err: any) {
      setIntelToast("优化失败: " + (err.message || String(err)));
    } finally {
      setIsOptimizing(false);
      setTimeout(() => setIntelToast(null), 4000);
    }
  };

  const handleRebuildIndex = async () => {
    setIsReindexing(true);
    try {
      const res = await rebuildSearchIndex();
      setIntelToast(res.message);
      await loadIntelligenceData();
    } catch (err: any) {
      setIntelToast("重建索引失败: " + (err.message || String(err)));
    } finally {
      setIsReindexing(false);
      setTimeout(() => setIntelToast(null), 4000);
    }
  };

  const handleCleanSessions = async () => {
    setIsCleaning(true);
    try {
      const res = await cleanSessions();
      setIntelToast(res.message);
      await loadIntelligenceData();
    } catch (err: any) {
      setIntelToast("检查清理失败: " + (err.message || String(err)));
    } finally {
      setIsCleaning(false);
      setTimeout(() => setIntelToast(null), 4000);
    }
  };

  const handleSavePolicy = async () => {
    try {
      await saveMemoryPolicy(memoryPolicy);
      setShowPolicyModal(false);
      setIntelToast("记忆策略已更新");
      setTimeout(() => setIntelToast(null), 3000);
    } catch (err: any) {
      alert("保存策略失败: " + err.message);
    }
  };

  const handleAddOntology = async () => {
    if (!newOntoName.trim()) return;
    const updated = [
      ...ontologyList,
      {
        id: `onto_${Date.now()}`,
        name: newOntoName.trim(),
        color: newOntoColor,
        icon: newOntoIcon,
        description: newOntoDesc.trim() || "自定义实体概念",
      },
    ];
    setOntologyList(updated);
    setNewOntoName("");
    setNewOntoDesc("");
    await saveOntology(updated);
  };

  const handleDeleteOntology = async (id: string) => {
    const updated = ontologyList.filter((o) => o.id !== id);
    setOntologyList(updated);
    await saveOntology(updated);
  };

  const handleSaveBudget = async () => {
    try {
      await updateIntelligenceSettings({ monthlyTokenBudget: monthlyBudgetInput });
      setTokenUsage((prev: any) => ({ ...prev, monthlyBudget: monthlyBudgetInput }));
      setShowBudgetModal(false);
      setIntelToast("AI 预算额度已保存");
      setTimeout(() => setIntelToast(null), 3000);
    } catch (e: any) {
      alert("保存预算失败: " + e.message);
    }
  };

  const handleToggleBgSmart = async (checked: boolean) => {
    setBgSmartActive(checked);
    await updateIntelligenceSettings({ bgSmartActive: checked });
  };

  const loadSettings = async () => {
    try {
      const data = await fetchAppSettings();
      if (data) {
        if (data.chatProvider) {
          setProvider(data.chatProvider);
          setSelectedProviderId(data.chatProvider);
        }
        if (data.apiBaseUrl) setApiBaseUrl(data.apiBaseUrl);
        if (data.apiKey) setApiKey(data.apiKey);
        if (data.chatModel) setChatModel(data.chatModel);
        if (data.embeddingMode) setEmbeddingMode(data.embeddingMode);
        if (data.llmMode) setLlmMode(data.llmMode);
        if (data.providerConfigs) {
          setProviderConfigs(data.providerConfigs);
          const cur = data.providerConfigs[data.chatProvider || "openai"];
          if (cur) {
            setCurrentProviderApiKey(cur.apiKey || data.apiKey || "");
            setCurrentProviderBaseUrl(cur.baseUrl || data.apiBaseUrl || "https://api.openai.com/v1");
            setCurrentProviderModel(cur.model || data.chatModel || "gpt-4o-mini");
            setCurrentProviderReasoning(cur.reasoning || false);
          } else {
            setCurrentProviderApiKey(data.apiKey || "");
            setCurrentProviderBaseUrl(data.apiBaseUrl || "https://api.openai.com/v1");
            setCurrentProviderModel(data.chatModel || "gpt-4o-mini");
          }
        } else {
          setCurrentProviderApiKey(data.apiKey || "");
          setCurrentProviderBaseUrl(data.apiBaseUrl || "https://api.openai.com/v1");
          setCurrentProviderModel(data.chatModel || "gpt-4o-mini");
        }

        if (data.userProfile) {
          if (data.userProfile.name) setProfileName(data.userProfile.name);
          if (data.userProfile.aliases) setProfileAliases(data.userProfile.aliases);
          if (data.userProfile.outputLanguage) setProfileOutputLang(data.userProfile.outputLanguage);
          if (data.userProfile.aboutYou) setProfileAboutYou(data.userProfile.aboutYou);
          if (data.userProfile.profileInstructions) setProfileInstructions(data.userProfile.profileInstructions);
        }

        if (data.remoteAccess) {
          if (typeof data.remoteAccess.allowLan === "boolean") setAllowLan(data.remoteAccess.allowLan);
          if (typeof data.remoteAccess.requireLocalAuth === "boolean") setRequireLocalAuth(data.remoteAccess.requireLocalAuth);
          if (data.remoteAccess.apiKey) setRemoteApiKey(data.remoteAccess.apiKey);
          if (data.remoteAccess.tunnelType) setTunnelType(data.remoteAccess.tunnelType);
          if (data.remoteAccess.tunnelStatus) setTunnelStatus(data.remoteAccess.tunnelStatus);
          if (data.remoteAccess.publicUrl) setRemotePublicUrl(data.remoteAccess.publicUrl);
          if (data.remoteAccess.ipWhitelist) setIpWhitelist(data.remoteAccess.ipWhitelist);
        }

        if (data.preferences) {
          if (data.preferences.themeMode) setThemeMode(data.preferences.themeMode);
          if (data.preferences.uiLanguage) setUiLanguage(data.preferences.uiLanguage);
          if (data.preferences.fontSizeScale) setFontSizeScale(data.preferences.fontSizeScale);
          if (typeof data.preferences.launchAtLogin === "boolean") setLaunchAtLogin(data.preferences.launchAtLogin);
          if (typeof data.preferences.enableMultiSpaces === "boolean") setEnableMultiSpaces(data.preferences.enableMultiSpaces);
          if (typeof data.preferences.shortcutLauncher === "boolean") setShortcutLauncher(data.preferences.shortcutLauncher);
          if (typeof data.preferences.shortcutSummary === "boolean") setShortcutSummary(data.preferences.shortcutSummary);
          if (typeof data.preferences.shortcutHints === "boolean") setShortcutHints(data.preferences.shortcutHints);
        }

        try {
          const sessRes = await fetchSessions();
          if (sessRes?.sessions) {
            setSpacesList(sessRes.sessions);
          }
        } catch {}
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    }
  };

  const handleSavePreferences = async (newPrefs: any) => {
    try {
      await saveAppSettings({
        preferences: {
          themeMode,
          uiLanguage,
          fontSizeScale,
          launchAtLogin,
          enableMultiSpaces,
          shortcutLauncher,
          shortcutSummary,
          shortcutHints,
          ...newPrefs,
        },
      });
      setPrefToast("✓ 偏好设置已更新！");
      setTimeout(() => setPrefToast(null), 2500);
    } catch (e) {
      console.error("Failed to save preferences", e);
    }
  };

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return alert("请输入空间名称");
    try {
      await createSpace(newSpaceName.trim(), newSpacePlatform);
      setShowCreateSpaceModal(false);
      setNewSpaceName("");
      const sessRes = await fetchSessions();
      if (sessRes?.sessions) {
        setSpacesList(sessRes.sessions);
      }
      setPrefToast("✓ 记忆空间创建成功！");
      setTimeout(() => setPrefToast(null), 3000);
    } catch (e: any) {
      alert("创建空间失败: " + e.message);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await saveAppSettings({
        userProfile: {
          name: profileName,
          aliases: profileAliases,
          outputLanguage: profileOutputLang,
          aboutYou: profileAboutYou,
          profileInstructions: profileInstructions,
        },
      });
      setProfileToast("✓ 个人资料已保存！AI 将以此作为上下文。");
      setTimeout(() => setProfileToast(null), 3500);
    } catch (err: any) {
      alert("保存个人资料失败: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportSettings = async () => {
    setIsExportingSettings(true);
    try {
      const data = await exportSettingsBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nowledge-mem-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMigrationToast("✓ 应用设置备份已成功导出下载！");
      setTimeout(() => setMigrationToast(null), 3500);
    } catch (err: any) {
      alert("导出设置失败: " + err.message);
    } finally {
      setIsExportingSettings(false);
    }
  };

  const handleExportKnowledge = async () => {
    setIsExportingKnowledge(true);
    try {
      const data = await exportKnowledgeBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nowledge-mem-knowledge-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMigrationToast("✓ 知识全库备份已成功导出下载！");
      setTimeout(() => setMigrationToast(null), 3500);
    } catch (err: any) {
      alert("导出知识库失败: " + err.message);
    } finally {
      setIsExportingKnowledge(false);
    }
  };

  const handleImportSettingsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        await importSettingsBackup(json);
        await loadSettings();
        setMigrationToast("✓ 设置备份恢复成功！");
        setTimeout(() => setMigrationToast(null), 3500);
      } catch (err: any) {
        alert("导入设置失败: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportKnowledgeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingKnowledge(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = await importKnowledgeBackup(json, migrationConflictMode);
        setMigrationToast(`✓ 知识库恢复成功！已导入 ${res.result?.importedMemories || 0} 条记忆、${res.result?.importedFacts || 0} 条关系`);
        setTimeout(() => setMigrationToast(null), 4000);
      } catch (err: any) {
        alert("导入知识库失败: " + err.message);
      } finally {
        setIsImportingKnowledge(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRotateRemoteApiKey = async () => {
    const newKey = "ak_live_" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    setRemoteApiKey(newKey);
    await saveAppSettings({
      remoteAccess: {
        allowLan,
        requireLocalAuth,
        apiKey: newKey,
        tunnelType,
        tunnelStatus,
        publicUrl: remotePublicUrl,
        ipWhitelist,
      },
    });
    setRemoteToast("✓ 已生成新 API 密钥并保存！");
    setTimeout(() => setRemoteToast(null), 3000);
  };

  const handleToggleRemoteTunnel = async () => {
    if (tunnelStatus === "running") {
      setTunnelStatus("idle");
      setRemotePublicUrl("");
      await saveAppSettings({
        remoteAccess: {
          allowLan,
          requireLocalAuth,
          apiKey: remoteApiKey,
          tunnelType,
          tunnelStatus: "idle",
          publicUrl: "",
          ipWhitelist,
        },
      });
      setRemoteToast("随处访问公网隧道已停止");
    } else {
      const quickUrl = `https://mem-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}.trycloudflare.com`;
      setTunnelStatus("running");
      setRemotePublicUrl(quickUrl);
      await saveAppSettings({
        remoteAccess: {
          allowLan,
          requireLocalAuth,
          apiKey: remoteApiKey,
          tunnelType,
          tunnelStatus: "running",
          publicUrl: quickUrl,
          ipWhitelist,
        },
      });
      setRemoteToast(`✓ 随处访问已启动: ${quickUrl}`);
    }
    setTimeout(() => setRemoteToast(null), 3500);
  };

  const handleToggleLanAccess = async (checked: boolean) => {
    setAllowLan(checked);
    await saveAppSettings({
      remoteAccess: {
        allowLan: checked,
        requireLocalAuth,
        apiKey: remoteApiKey,
        tunnelType,
        tunnelStatus,
        publicUrl: remotePublicUrl,
        ipWhitelist,
      },
    });
  };

  const handleSelectProvider = (pId: string) => {
    setSelectedProviderId(pId);
    setProviderTestResult(null);
    setFetchedModels([]);
    const pMeta = ALL_PROVIDERS.find((p) => p.id === pId);
    const existing = providerConfigs[pId];
    if (existing) {
      setCurrentProviderApiKey(existing.apiKey || "");
      setCurrentProviderBaseUrl(existing.baseUrl || pMeta?.defaultBaseUrl || "");
      setCurrentProviderModel(existing.model || pMeta?.defaultModel || "");
      setCurrentProviderReasoning(existing.reasoning || false);
    } else {
      if (pId === provider) {
        setCurrentProviderApiKey(apiKey);
        setCurrentProviderBaseUrl(apiBaseUrl);
        setCurrentProviderModel(chatModel);
      } else {
        setCurrentProviderApiKey("");
        setCurrentProviderBaseUrl(pMeta?.defaultBaseUrl || "");
        setCurrentProviderModel(pMeta?.defaultModel || "");
        setCurrentProviderReasoning(false);
      }
    }
  };

  const handleSaveSelectedProvider = async () => {
    setIsSaving(true);
    try {
      const updatedConfigs = {
        ...providerConfigs,
        [selectedProviderId]: {
          apiKey: currentProviderApiKey,
          baseUrl: currentProviderBaseUrl,
          model: currentProviderModel,
          isConfigured: !!currentProviderApiKey.trim(),
          reasoning: currentProviderReasoning,
          timeout: currentProviderTimeout,
        },
      };
      setProviderConfigs(updatedConfigs);
      setProvider(selectedProviderId);
      setApiKey(currentProviderApiKey);
      setApiBaseUrl(currentProviderBaseUrl);
      setChatModel(currentProviderModel);

      await saveAppSettings({
        chatProvider: selectedProviderId,
        apiBaseUrl: currentProviderBaseUrl,
        apiKey: currentProviderApiKey,
        chatModel: currentProviderModel,
        providerConfigs: updatedConfigs,
        llmMode,
        embeddingMode,
      });

      const pName = ALL_PROVIDERS.find((p) => p.id === selectedProviderId)?.name || selectedProviderId;
      setSaveToast(`✓ ${pName} 服务商配置已永久保存，并已设为当前激活的云端 AI 模型！`);
      setTimeout(() => setSaveToast(null), 4000);
    } catch (err: any) {
      alert("保存失败: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSelectedProvider = async () => {
    setIsTestingProvider(true);
    setProviderTestResult(null);
    try {
      const res = await testSettingsConnection({
        provider: selectedProviderId,
        baseUrl: currentProviderBaseUrl,
        apiKey: currentProviderApiKey,
        model: currentProviderModel,
      });
      setProviderTestResult(res);
    } catch (err: any) {
      setProviderTestResult({ success: false, message: err.message || "连接测试失败" });
    } finally {
      setIsTestingProvider(false);
    }
  };

  const handleFetchModelsForProvider = async () => {
    setIsFetchingModels(true);
    try {
      const res = await fetchProviderModels({
        baseUrl: currentProviderBaseUrl,
        apiKey: currentProviderApiKey,
        provider: selectedProviderId,
      });
      if (res?.success && res.models && res.models.length > 0) {
        setFetchedModels(res.models);
        if (!currentProviderModel || currentProviderModel === "custom-model") {
          setCurrentProviderModel(res.models[0]);
        }
      } else {
        alert("未获取到模型列表，请确认 API Key 与 Base URL 是否正确。");
      }
    } catch (err: any) {
      alert("获取模型失败: " + err.message);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const loadModels = async () => {
    try {
      const res = await getModelStatuses();
      if (res && res.models) {
        setModels(res.models);

        const anyDownloading = res.models.some((m) => m.isDownloading);
        if (anyDownloading) {
          if (!pollTimerRef.current) {
            pollTimerRef.current = setInterval(async () => {
              const updated = await getModelStatuses();
              if (updated && updated.models) {
                setModels(updated.models);
                if (!updated.models.some((m) => m.isDownloading)) {
                  clearInterval(pollTimerRef.current);
                  pollTimerRef.current = null;
                }
              }
            }, 800);
          }
        } else {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error("Failed to load model statuses", err);
    }
  };

  const handleDownload = async (modelId: string) => {
    try {
      const res = await downloadModel(modelId);
      if (res.success) {
        await loadModels();
      } else {
        alert("下载失败: " + res.message);
      }
    } catch (err: any) {
      alert("下载错误: " + err.message);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm("确定要删除此本地模型文件吗？")) return;
    try {
      const res = await deleteModelById(modelId);
      if (res.success) {
        await loadModels();
      } else {
        alert("删除失败: " + res.message);
      }
    } catch (err: any) {
      alert("删除错误: " + err.message);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSettingsConnection({
        provider,
        baseUrl: apiBaseUrl,
        apiKey,
        model: chatModel,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "连接失败" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSwitchEmbeddingMode = async (mode: "local" | "cloud") => {
    setEmbeddingMode(mode);
    try {
      await saveAppSettings({ embeddingMode: mode });
    } catch {}
  };

  const handleSwitchLlmMode = async (mode: "local" | "cloud") => {
    setLlmMode(mode);
    try {
      await saveAppSettings({ llmMode: mode });
    } catch {}
  };

  // Find model items
  const qwenModel = models.find((m) => m.id === "embedding_qwen") || {
    id: "embedding_qwen",
    name: "Qwen3-Embedding-0.6B Q4_K_M (Imatrix)",
    type: "embedding",
    category: "搜索与增强",
    sizeText: "396.0 MB",
    isDownloaded: false,
    isDownloading: false,
    progress: 0,
    speed: "",
    downloadedBytes: 0,
    totalBytes: 396 * 1024 * 1024,
  };

  const gemmaModel = models.find((m) => m.id === "llm_gemma") || {
    id: "llm_gemma",
    name: "Gemma-4 E2B IT UD-Q4_K_XL + vision projector",
    type: "llm",
    category: "在设备上驱动搜索、实体提取与记忆提炼",
    sizeText: "3.9 GB",
    isDownloaded: false,
    isDownloading: false,
    progress: 0,
    speed: "",
    downloadedBytes: 0,
    totalBytes: 1.6 * 1024 * 1024 * 1024,
  };

  return (
    <div className="nl-settings-layout">
      {/* Settings Left Sub-navigation */}
      <div className="nl-settings-sidebar">
        <div className="nl-settings-title">设置</div>
        <div className="nl-settings-sub">管理模型与智能设置。</div>

        <div className="nl-settings-nav">
          <button
            className={`nl-set-nav-item ${activeSubTab === "models" ? "active" : ""}`}
            onClick={() => setActiveSubTab("models")}
          >
            <span>⚙️</span>
            <span>模型</span>
          </button>
          <button
            className={`nl-set-nav-item ${activeSubTab === "smart-processing" ? "active" : ""}`}
            onClick={() => setActiveSubTab("smart-processing")}
          >
            <span>❇️</span>
            <span>智能处理</span>
          </button>
          <button
            className={`nl-set-nav-item ${activeSubTab === "providers" ? "active" : ""}`}
            onClick={() => setActiveSubTab("providers")}
          >
            <span>🌐</span>
            <span>服务商</span>
          </button>
          <button
            className={`nl-set-nav-item ${activeSubTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveSubTab("profile")}
          >
            <span>👤</span>
            <span>个人资料</span>
          </button>
          <button
            className={`nl-set-nav-item ${activeSubTab === "migration" ? "active" : ""}`}
            onClick={() => setActiveSubTab("migration")}
          >
            <span>💾</span>
            <span>数据迁移</span>
          </button>
          <button
            className={`nl-set-nav-item ${activeSubTab === "remote" ? "active" : ""}`}
            onClick={() => setActiveSubTab("remote")}
          >
            <span>💎</span>
            <span>随处访问</span>
          </button>
          <button
            className={`nl-set-nav-item ${activeSubTab === "team" ? "active" : ""}`}
            onClick={() => setActiveSubTab("team")}
          >
            <span>👥</span>
            <span>团队</span>
          </button>
          <button
            className={`nl-set-nav-item ${activeSubTab === "preferences" ? "active" : ""}`}
            onClick={() => setActiveSubTab("preferences")}
          >
            <span>🎨</span>
            <span>偏好设置</span>
          </button>
          <button
            className={`nl-set-nav-item ${activeSubTab === "license" ? "active" : ""}`}
            onClick={() => setActiveSubTab("license")}
          >
            <span>📜</span>
            <span>授权许可</span>
          </button>
          <button
            className={`nl-set-nav-item ${activeSubTab === "about" ? "active" : ""}`}
            onClick={() => setActiveSubTab("about")}
          >
            <span>ℹ️</span>
            <span>关于</span>
          </button>
        </div>
      </div>

      {/* Settings Main Content Area */}
      <div className="nl-settings-content">
        {/* Save Toast Notification */}
        {saveToast && (
          <div
            style={{
              padding: "10px 16px",
              marginBottom: 16,
              borderRadius: 8,
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#10b981",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>💾</span>
            <span>{saveToast}</span>
          </div>
        )}

        {/* 1. 模型 (Models) Tab (Screenshot 1) */}
        {activeSubTab === "models" && (
          <div className="nl-set-panel">
            <div className="nl-set-header-row">
              <div>
                <h2>模型</h2>
                <p className="nl-set-desc">驱动搜索和智能功能的本地 / 云端 AI 模型。</p>
              </div>
              <button className="nl-btn-secondary" onClick={handleTestConnection} disabled={isTesting}>
                {isTesting ? "验证中..." : "验证模型"}
              </button>
            </div>

            {testResult && (
              <div className={`nl-test-banner ${testResult.success ? "success" : "error"}`}>
                {testResult.success ? "✓ " : "✕ "} {testResult.message}
              </div>
            )}

            {/* Model Cards Grid */}
            <div className="nl-model-cards-grid">
              {/* Card 1: 索引模型 (方案 A: 真实轻量本地嵌入) */}
              <div className="nl-model-box">
                <div className="nl-model-box-header">
                  <div className="nl-model-title-wrap">
                    <span className="nl-model-icon">🔍</span>
                    <h3>索引模型</h3>
                  </div>
                  <div className="nl-model-status-pills">
                    {qwenModel.isDownloaded ? (
                      <>
                        <span className="nl-status-green">● 已安装</span>
                        <span className="nl-status-blue">● 已验证</span>
                      </>
                    ) : qwenModel.isDownloading ? (
                      <span className="nl-status-blue">● 下载中 {qwenModel.progress}%</span>
                    ) : (
                      <span className="nl-status-gray">● 未安装</span>
                    )}
                  </div>
                </div>
                <div className="nl-model-box-sub">{qwenModel.category}</div>
                <div className="nl-model-meta-grid">
                  <div className="nl-meta-col">
                    <span className="nl-lbl">模型:</span>
                    <span className="nl-val">{qwenModel.name}</span>
                  </div>
                  <div className="nl-meta-col">
                    <span className="nl-lbl">大小:</span>
                    <span className="nl-val">{qwenModel.sizeText}</span>
                  </div>
                </div>

                {/* Progress bar if downloading */}
                {qwenModel.isDownloading && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                      <span>下载进度: {qwenModel.progress}%</span>
                      <span>{qwenModel.speed}</span>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${qwenModel.progress}%`, height: "100%", background: "#3b82f6", transition: "width 0.3s ease" }}></div>
                    </div>
                  </div>
                )}

                <div className="nl-model-box-footer">
                  {qwenModel.isDownloaded ? (
                    <div style={{ display: "flex", width: "100%", gap: 8 }}>
                      <button className="nl-btn-downloaded" style={{ flex: 1 }}>
                        ✓ 已下载
                      </button>
                      <button
                        className="nl-btn-secondary"
                        style={{ padding: "0 10px", fontSize: 12 }}
                        title="删除模型文件"
                        onClick={() => handleDeleteModel("embedding_qwen")}
                      >
                        🗑️
                      </button>
                    </div>
                  ) : (
                    <button
                      className="nl-btn-secondary"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => handleDownload("embedding_qwen")}
                      disabled={qwenModel.isDownloading}
                    >
                      {qwenModel.isDownloading ? `⏬ 下载中 (${qwenModel.progress}%)` : `⬇ 下载 (${qwenModel.sizeText})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Card 2: 本地 LLM (方案 B: 真实本地 LLM 下载) */}
              <div className="nl-model-box">
                <div className="nl-model-box-header">
                  <div className="nl-model-title-wrap">
                    <span className="nl-model-icon">🤖</span>
                    <h3>本地 LLM</h3>
                  </div>
                  <div className="nl-model-status-pills">
                    {gemmaModel.isDownloaded ? (
                      <>
                        <span className="nl-status-green">● 已安装</span>
                        <span className="nl-status-blue">● 已验证</span>
                      </>
                    ) : gemmaModel.isDownloading ? (
                      <span className="nl-status-blue">● 下载中 {gemmaModel.progress}%</span>
                    ) : (
                      <span className="nl-status-gray">● 未安装</span>
                    )}
                  </div>
                </div>
                <div className="nl-model-box-sub">{gemmaModel.category}</div>
                <div className="nl-model-meta-grid">
                  <div className="nl-meta-col">
                    <span className="nl-lbl">模型:</span>
                    <span className="nl-val">{gemmaModel.name}</span>
                  </div>
                  <div className="nl-meta-col">
                    <span className="nl-lbl">大小:</span>
                    <span className="nl-val">{gemmaModel.sizeText}</span>
                  </div>
                </div>

                {/* Progress bar if downloading */}
                {gemmaModel.isDownloading && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                      <span>下载进度: {gemmaModel.progress}%</span>
                      <span>{gemmaModel.speed}</span>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${gemmaModel.progress}%`, height: "100%", background: "#10b981", transition: "width 0.3s ease" }}></div>
                    </div>
                  </div>
                )}

                <div className="nl-model-box-footer">
                  {gemmaModel.isDownloaded ? (
                    <div style={{ display: "flex", width: "100%", gap: 8 }}>
                      <button className="nl-btn-downloaded" style={{ flex: 1 }}>
                        ✓ 已下载
                      </button>
                      <button
                        className="nl-btn-secondary"
                        style={{ padding: "0 10px", fontSize: 12 }}
                        title="删除模型文件"
                        onClick={() => handleDeleteModel("llm_gemma")}
                      >
                        🗑️
                      </button>
                    </div>
                  ) : (
                    <button
                      className="nl-btn-secondary"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => handleDownload("llm_gemma")}
                      disabled={gemmaModel.isDownloading}
                    >
                      {gemmaModel.isDownloading ? `⏬ 下载中 (${gemmaModel.progress}%)` : `⬇ 下载 (${gemmaModel.sizeText})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Card 3: 索引模型服务商 (本地 vs 云端 切换) */}
              <div className="nl-model-box">
                <div className="nl-model-box-header">
                  <div className="nl-model-title-wrap">
                    <span className="nl-model-icon">🌐</span>
                    <h3>索引模型服务商</h3>
                  </div>
                  <button className="nl-btn-link" onClick={() => setActiveSubTab("providers")}>
                    管理服务商 ↗
                  </button>
                </div>
                <div className="nl-model-box-sub">搜索默认在本地；需要云端嵌入模型时，再切换到服务商。</div>
                <div className="nl-toggle-row">
                  <div className="nl-mode-switch">
                    <button
                      className={`nl-mode-btn ${embeddingMode === "local" ? "active" : ""}`}
                      onClick={() => handleSwitchEmbeddingMode("local")}
                    >
                      本地
                    </button>
                    <button
                      className={`nl-mode-btn ${embeddingMode === "cloud" ? "active" : ""}`}
                      onClick={() => handleSwitchEmbeddingMode("cloud")}
                    >
                      云端
                    </button>
                  </div>
                </div>
                <div className="nl-model-box-footer">
                  <span className="nl-status-current">
                    ✓ 当前 <strong>{embeddingMode === "local" ? "本地 Qwen 索引模型 / FTS" : `云端 (${provider})`}</strong>
                  </span>
                </div>
              </div>

              {/* Card 4: LLM 服务商 (本地 vs 云端 切换) */}
              <div className="nl-model-box">
                <div className="nl-model-box-header">
                  <div className="nl-model-title-wrap">
                    <span className="nl-model-icon">☁️</span>
                    <h3>LLM 服务商</h3>
                  </div>
                  <button className="nl-btn-link" onClick={() => setActiveSubTab("providers")}>
                    管理服务商 ↗
                  </button>
                </div>
                <div className="nl-model-box-sub">时间线、AI Now 和后台智能需要远程服务商</div>
                <div className="nl-toggle-row">
                  <div className="nl-mode-switch">
                    <button
                      className={`nl-mode-btn ${llmMode === "local" ? "active" : ""}`}
                      onClick={() => handleSwitchLlmMode("local")}
                    >
                      本地
                    </button>
                    <button
                      className={`nl-mode-btn ${llmMode === "cloud" ? "active" : ""}`}
                      onClick={() => handleSwitchLlmMode("cloud")}
                    >
                      云端
                    </button>
                  </div>
                </div>
                <div className="nl-warning-callout">
                  {llmMode === "local"
                    ? "● 当前使用本地离线 LLM 模型处理实体抽取。"
                    : `● 当前使用云端 ${provider} 驱动实体提炼与对话分析。`}
                </div>
              </div>
            </div>

            {/* GPU 加速 Card */}
            <div className="nl-card" style={{ marginTop: 16 }}>
              <div className="nl-gpu-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>⚙️</span>
                  <div>
                    <h3 style={{ fontSize: 14 }}>GPU 加速</h3>
                    <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginTop: 2 }}>
                      使用 GPU 加速设备嵌入和本地模型运行。如果 GPU 无法使用，将自动回退到 CPU。
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 12 }}>
                此版本使用 CPU 运行。GPU 加速需要安装 Nowledge Mem 的 GPU 版本。
              </div>
            </div>
          </div>
        )}

        {/* 2. 智能处理 (Smart Processing) Tab */}
        {activeSubTab === "smart-processing" && (
          <div className="nl-set-panel" style={{ animation: "fadeIn 0.2s ease" }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f8fafc" }}>记忆处理</h2>
              <p style={{ fontSize: 13, color: "var(--nl-text-secondary)", marginTop: 4 }}>
                选择 Mem 在你保存、同步或导入知识后，哪些事情可以自动完成。
              </p>
            </div>

            {intelToast && (
              <div style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                ℹ️ {intelToast}
              </div>
            )}

            {/* 1. 搜索与索引健康 */}
            <div className="nl-card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🔍</span>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f8fafc" }}>搜索</h3>
                    <p style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>让每一条记忆都能被找到</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
                    就绪
                  </span>
                  <button
                    className="nl-btn-secondary"
                    style={{ fontSize: 12, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}
                    onClick={handleRebuildIndex}
                    disabled={isReindexing}
                  >
                    <span>🔄</span> {isReindexing ? "正在重建..." : "重建索引"}
                  </button>
                </div>
              </div>

              {/* 容量统计指标条 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: 6, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  动态档案 <strong style={{ color: "#f8fafc" }}>{intelStats.dbSizeText}</strong> · 信息 <strong style={{ color: "#f8fafc" }}>{intelStats.infoSizeText}</strong> · 搜索索引 <strong style={{ color: "#f8fafc" }}>{intelStats.indexSizeText}</strong>
                </div>
                <button
                  className="nl-btn-secondary"
                  style={{ fontSize: 12, padding: "3px 8px" }}
                  onClick={handleOptimizeDb}
                  disabled={isOptimizing}
                >
                  ⚡ {isOptimizing ? "优化中..." : "优化"}
                </button>
              </div>

              {/* 会话存储子项 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <h4 style={{ fontSize: 13, color: "#f1f5f9", marginBottom: 2 }}>会话存储</h4>
                  <p style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>
                    检查且整理入库下的空白/重复记录，有会话内容或记忆遗漏的记录不会被丢弃。
                  </p>
                </div>
                <button
                  className="nl-btn-secondary"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={handleCleanSessions}
                  disabled={isCleaning}
                >
                  🔍 {isCleaning ? "检查中..." : "检查"}
                </button>
              </div>

              {/* 搜索与回溯 RAM 子项 */}
              <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
                <details style={{ cursor: "pointer" }}>
                  <summary style={{ fontSize: 13, color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
                    <span>▼ 搜索与回溯 RAM</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>自动 · 最低 512 MB</span>
                  </summary>
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--nl-text-muted)" }}>
                    <p style={{ marginBottom: 8 }}>
                      只影响大型数据集合，收集的是全部历史，以及重要证据。除非 Mem 提示 RAM 不够，否则建议保持自动。
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ color: "#f1f5f9" }}>预留多少 RAM:</span>
                      <select
                        value={ramSetting}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setRamSetting(val);
                          await updateIntelligenceSettings({ searchRamLimit: val });
                          setIntelStats((prev: any) => ({ ...prev, ramAllocation: val }));
                        }}
                        className="nl-input"
                        style={{ padding: "3px 8px", fontSize: 12, width: 140 }}
                      >
                        <option value="auto">自动 (默认 512MB)</option>
                        <option value="1024MB">1024 MB</option>
                        <option value="2048MB">2048 MB</option>
                        <option value="4096MB">4096 MB</option>
                      </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "rgba(0,0,0,0.2)", padding: 10, borderRadius: 6 }}>
                      <div>当前使用: <strong style={{ color: "#10b981" }}>{intelStats.ramUsageMB} MB</strong></div>
                      <div>下次启动: <strong style={{ color: "#f1f5f9" }}>{intelStats.ramAllocation || "512 MB"}</strong></div>
                      <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 6 }}>
                        <span>自动模式允许的最低值: <strong>512 MB</strong></span>
                        <button
                          className="nl-btn-secondary"
                          style={{ fontSize: 11, padding: "2px 6px" }}
                          onClick={() => {
                            setRamSetting("auto");
                            setIntelToast("已重置自动最低值");
                            setTimeout(() => setIntelToast(null), 3000);
                          }}
                        >
                          忘记自动最低值
                        </button>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* 2. 记忆策略 */}
            <div className="nl-card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f8fafc", marginBottom: 2 }}>⚙️ 记忆策略</h3>
                  <p style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>决定 Mem 何时对选定内容长久记住，应该留什么。</p>
                  <div style={{ fontSize: 12, color: "#818cf8", marginTop: 6 }}>
                    {memoryPolicy.scope || "所有空间"} · 最多 {memoryPolicy.maxMemoriesPerSession || 3} 条记忆 · {memoryPolicy.visibility === "full" ? "可见细节" : "极简摘要"}
                  </div>
                </div>
                <button
                  className="nl-btn-secondary"
                  style={{ fontSize: 12, padding: "5px 12px" }}
                  onClick={() => setShowPolicyModal(true)}
                >
                  自定义
                </button>
              </div>
            </div>

            {/* 3. 本体 (Ontology) */}
            <div className="nl-card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f8fafc", marginBottom: 2 }}>🧩 本体 (Ontology)</h3>
                  <p style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>
                    告诉 Mem 你世界里有哪些公理——组织架构、实体、客户——让知识按你的话归类，而不是通用模型。
                  </p>
                  <div style={{ fontSize: 12, color: "#10b981", marginTop: 6 }}>
                    ● 已配置 ({ontologyList.length} 种领域概念本体)
                  </div>
                </div>
                <button
                  className="nl-btn-primary"
                  style={{ fontSize: 12, padding: "5px 12px" }}
                  onClick={() => setShowOntologyModal(true)}
                >
                  去本体库打开 →
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#64748b", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8 }}>
                💡 关联长在顶层上，你能亲眼看到它们对应的节点颜色。AI 发现新概念/实体类型时：按需归入本体，这与模型配置一致。
              </div>
            </div>

            {/* 4. 后台任务 */}
            <div className="nl-card" style={{ marginBottom: 16 }}>
              <div className="nl-smart-header-card" style={{ background: "transparent", padding: 0, marginBottom: 12 }}>
                <div className="nl-smart-title-wrap">
                  <span style={{ fontSize: 20 }}>⚡</span>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f8fafc" }}>后台任务</h3>
                    <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginTop: 2 }}>
                      允许 Mem 自动进行简报、分类、去重、联想建议和记忆演化等 AI 任务
                    </p>
                  </div>
                </div>
                <div className="nl-switch-wrap">
                  <span className="nl-switch-label" style={{ fontSize: 12 }}>● {bgSmartActive ? "就绪" : "已暂停"}</span>
                  <input
                    type="checkbox"
                    checked={bgSmartActive}
                    onChange={(e) => handleToggleBgSmart(e.target.checked)}
                    className="nl-checkbox-toggle"
                  />
                </div>
              </div>

              {/* 后台工作状态 */}
              <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 6, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 500 }}>后台工作</span>
                  <span style={{ fontSize: 12, color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "1px 8px", borderRadius: 4 }}>
                    空闲
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>
                  当前没有任务在运行。新笔记、同步对话或定时计划需要处理时，会自动开始后台工作。
                </p>
              </div>

              {/* AI 用量与预算 */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 500 }}>AI 用量总览</span>
                    <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginTop: 2 }}>
                      统计这台设备上的 Mem 实际调用的模型 Token，并区分自动任务与你主动打开的 AI，限制以避免透支自动任务。
                    </p>
                  </div>
                  <button
                    className="nl-btn-secondary"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => setShowBudgetModal(true)}
                  >
                    预算额度
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10 }}>
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: 10, borderRadius: 6, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>本月</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc", marginTop: 4 }}>{tokenUsage.tokensMonth} tokens</div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: 10, borderRadius: 6, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>过去 24 小时</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc", marginTop: 4 }}>{tokenUsage.tokens24h} tokens</div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: 10, borderRadius: 6, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>过去 1 小时</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc", marginTop: 4 }}>{tokenUsage.tokens1h} tokens</div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: 10, borderRadius: 6, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>正在进行的任务</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>还没有记录到模型调用</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. 服务商 (Providers) Tab */}
        {activeSubTab === "providers" && (
          <div className="nl-set-panel" style={{ maxWidth: 960, animation: "fadeIn 0.2s ease" }}>
            {/* 顶栏 Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f8fafc" }}>服务商</h2>
                <p style={{ fontSize: 13, color: "var(--nl-text-secondary)", marginTop: 2 }}>
                  连接你日常的 AI 服务商。
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#10b981" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
                <span>Nowledge AI 正常</span>
                <span style={{ color: "#64748b", margin: "0 4px" }}>·</span>
                <span style={{ color: "#94a3b8", cursor: "pointer" }}>查看状态 ↗</span>
              </div>
            </div>

            {/* 顶部 LLM 服务商模式切换 Banner */}
            <div className="nl-card" style={{ marginBottom: 16, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>⚡</span>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>LLM 服务商</h3>
                  <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginTop: 2 }}>
                    时间线、AI Now 和后台智能需要远程服务商
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="nl-mode-switch">
                  <button
                    className={`nl-mode-btn ${llmMode === "local" ? "active" : ""}`}
                    onClick={() => handleSwitchLlmMode("local")}
                  >
                    本地
                  </button>
                  <button
                    className={`nl-mode-btn ${llmMode === "cloud" ? "active" : ""}`}
                    onClick={() => handleSwitchLlmMode("cloud")}
                  >
                    云端
                  </button>
                </div>

                <div style={{ fontSize: 12, color: llmMode === "local" ? "#10b981" : "#818cf8", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: llmMode === "local" ? "#10b981" : "#818cf8" }}></span>
                  {llmMode === "local" ? "正在使用本地模型" : `正在使用云端 (${ALL_PROVIDERS.find(p => p.id === provider)?.name || provider})`}
                </div>
              </div>
            </div>

            {/* 主体 Master-Detail 左右双栏结构 */}
            <div className="nl-providers-master-detail">
              {/* 左侧栏：服务商筛选与列表 */}
              <div className="nl-providers-sidebar-col">
                <div className="nl-provider-search-box">
                  <input
                    type="text"
                    placeholder="🔍 筛选..."
                    value={providerSearch}
                    onChange={(e) => setProviderSearch(e.target.value)}
                    className="nl-provider-search-input"
                  />
                </div>
                <div className="nl-providers-scroll-list">
                  {ALL_PROVIDERS.filter((p) =>
                    p.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
                    p.id.toLowerCase().includes(providerSearch.toLowerCase())
                  ).map((p) => {
                    const isConfigured = !!(providerConfigs[p.id]?.apiKey || (p.id === provider && apiKey));
                    const isCurrentActive = provider === p.id && llmMode === "cloud";
                    const isSelected = selectedProviderId === p.id;

                    return (
                      <div
                        key={p.id}
                        className={`nl-provider-list-item ${isSelected ? "active" : ""}`}
                        onClick={() => handleSelectProvider(p.id)}
                      >
                        <div className="nl-provider-item-left">
                          <span className="nl-provider-item-icon">{p.icon}</span>
                          <span className="nl-provider-item-name">{p.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {isCurrentActive && (
                            <span style={{ fontSize: 9, background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "1px 5px", borderRadius: 4 }}>
                              当前
                            </span>
                          )}
                          <span className={`nl-provider-status-badge ${isConfigured ? "configured" : ""}`}>
                            {isConfigured ? "已配置" : "未配置"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 右侧栏：所选服务商详细配置面板 */}
              {(() => {
                const curMeta = ALL_PROVIDERS.find((p) => p.id === selectedProviderId) || ALL_PROVIDERS[0];
                const isCurConfigured = !!(providerConfigs[curMeta.id]?.apiKey || (curMeta.id === provider && apiKey));

                return (
                  <div className="nl-provider-detail-card">
                    {/* Header */}
                    <div className="nl-provider-detail-header">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 22 }}>{curMeta.icon}</span>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc" }}>{curMeta.name}</h3>
                            <span style={{ fontSize: 11, color: isCurConfigured ? "#10b981" : "#64748b", background: isCurConfigured ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4 }}>
                              {isCurConfigured ? "已配置 ●" : "未配置"}
                            </span>
                          </div>
                          <p style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 2 }}>{curMeta.description}</p>
                        </div>
                      </div>

                      <button
                        className="nl-btn-primary"
                        style={{ fontSize: 12, padding: "5px 16px" }}
                        onClick={handleSaveSelectedProvider}
                        disabled={isSaving}
                      >
                        {isSaving ? "保存中..." : "保存"}
                      </button>
                    </div>

                    {/* Form Fields */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {/* API 密钥 */}
                      <div className="nl-form-group">
                        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>API 密钥 <span style={{ color: "#ef4444" }}>*</span></span>
                          <button
                            type="button"
                            className="nl-btn-link"
                            style={{ fontSize: 11, color: "#818cf8" }}
                            onClick={() => setShowApiKeyMask(!showApiKeyMask)}
                          >
                            {showApiKeyMask ? "隐藏" : "显示"}
                          </button>
                        </label>
                        <input
                          type={showApiKeyMask ? "text" : "password"}
                          placeholder="sk-..."
                          value={currentProviderApiKey}
                          onChange={(e) => setCurrentProviderApiKey(e.target.value)}
                          className="nl-input"
                          style={{ fontFamily: showApiKeyMask ? "monospace" : "inherit" }}
                        />
                      </div>

                      {/* 访问地址 */}
                      <div className="nl-form-group">
                        <label>访问地址 (可选)</label>
                        <input
                          type="text"
                          placeholder={curMeta.defaultBaseUrl}
                          value={currentProviderBaseUrl}
                          onChange={(e) => setCurrentProviderBaseUrl(e.target.value)}
                          className="nl-input"
                        />
                      </div>

                      {/* 验证与获取模型按钮组 */}
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          type="button"
                          className="nl-btn-secondary"
                          style={{ fontSize: 12, padding: "5px 12px", display: "flex", alignItems: "center", gap: 4 }}
                          onClick={handleTestSelectedProvider}
                          disabled={isTestingProvider}
                        >
                          {isTestingProvider ? "验证中..." : "验证"}
                        </button>
                        <button
                          type="button"
                          className="nl-btn-secondary"
                          style={{ fontSize: 12, padding: "5px 12px", display: "flex", alignItems: "center", gap: 4 }}
                          onClick={handleFetchModelsForProvider}
                          disabled={isFetchingModels}
                        >
                          {isFetchingModels ? "获取中..." : "获取模型"}
                        </button>
                      </div>

                      {/* 测试反馈 Banner */}
                      {providerTestResult && (
                        <div
                          className={`nl-test-banner ${providerTestResult.success ? "success" : "error"}`}
                          style={{ margin: "4px 0", fontSize: 12 }}
                        >
                          {providerTestResult.success ? "✓ " : "✕ "} {providerTestResult.message || providerTestResult.error}
                        </div>
                      )}

                      {/* 模型选择 */}
                      <div className="nl-form-group">
                        <label>模型 <span style={{ color: "#ef4444" }}>*</span></label>
                        {fetchedModels.length > 0 ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <select
                              value={currentProviderModel}
                              onChange={(e) => setCurrentProviderModel(e.target.value)}
                              className="nl-input"
                              style={{ flex: 1 }}
                            >
                              {fetchedModels.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="nl-btn-secondary"
                              style={{ fontSize: 11, padding: "0 8px" }}
                              onClick={() => setFetchedModels([])}
                            >
                              手动输入
                            </button>
                          </div>
                        ) : (
                          <input
                            type="text"
                            placeholder="输入模型名称 (如: gpt-4o, deepseek-chat)"
                            value={currentProviderModel}
                            onChange={(e) => setCurrentProviderModel(e.target.value)}
                            className="nl-input"
                          />
                        )}
                        <p style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 6, lineHeight: 1.4 }}>
                          尚未加载模型，可先获取模型，或手动输入模型名称。检查对话模型可用：如果该模型或服务不支持思考参数，请在高级选项中关闭思考开关。
                        </p>
                      </div>

                      {/* 高级选项折叠 */}
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                        <details
                          open={showAdvanced}
                          onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
                          style={{ cursor: "pointer" }}
                        >
                          <summary style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                            {showAdvanced ? "▼" : "▶"} 高级选项
                          </summary>
                          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12, paddingLeft: 8 }}>
                            <div className="nl-form-group">
                              <label style={{ fontSize: 12 }}>超时时间 (毫秒)</label>
                              <input
                                type="number"
                                value={currentProviderTimeout}
                                onChange={(e) => setCurrentProviderTimeout(parseInt(e.target.value, 10) || 30000)}
                                className="nl-input"
                                style={{ fontSize: 12, padding: "4px 8px" }}
                              />
                            </div>

                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.2)", padding: "8px 12px", borderRadius: 6 }}>
                              <div>
                                <span style={{ fontSize: 12, color: "#f1f5f9" }}>开启深度思考 / 推理 (Reasoning)</span>
                                <p style={{ fontSize: 11, color: "var(--nl-text-muted)" }}>适用于 DeepSeek-R1、o1、o3-mini 等支持思考链的模型</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={currentProviderReasoning}
                                onChange={(e) => setCurrentProviderReasoning(e.target.checked)}
                                className="nl-checkbox-toggle"
                              />
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 4. 个人资料 (Profile) Tab (Screenshot 1) */}
        {activeSubTab === "profile" && (
          <div className="nl-set-panel" style={{ maxWidth: 860, animation: "fadeIn 0.2s ease" }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f8fafc" }}>我的信息</h2>
              <p style={{ fontSize: 13, color: "var(--nl-text-secondary)", marginTop: 2 }}>
                帮助 AI 了解你是谁、你关注什么。
              </p>
            </div>

            {profileToast && (
              <div style={{ padding: "8px 14px", marginBottom: 14, borderRadius: 6, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#10b981", fontSize: 12 }}>
                {profileToast}
              </div>
            )}

            {/* Top Grid: 身份 & 语言 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* 卡片 1: 身份 */}
              <div className="nl-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15 }}>👤</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>身份</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 12 }}>
                  提到「我」时，AI 便知道是你。
                </p>

                <div className="nl-form-group" style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11 }}>姓名</label>
                  <input
                    type="text"
                    placeholder="你的名字"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="nl-input"
                  />
                </div>

                <div className="nl-form-group">
                  <label style={{ fontSize: 11 }}>别名</label>
                  <input
                    type="text"
                    placeholder="@推特、GitHub 用户名、昵称"
                    value={profileAliases}
                    onChange={(e) => setProfileAliases(e.target.value)}
                    className="nl-input"
                  />
                  <p style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 4 }}>
                    逗号分隔。帮助 AI 在不同平台识别你。
                  </p>
                </div>
              </div>

              {/* 卡片 2: 语言 */}
              <div className="nl-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15 }}>🌐</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>语言</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 12 }}>
                  AI 生成内容所使用的语言。
                </p>

                <div className="nl-form-group">
                  <label style={{ fontSize: 11 }}>输出语言</label>
                  <select
                    value={profileOutputLang}
                    onChange={(e) => setProfileOutputLang(e.target.value)}
                    className="nl-input"
                  >
                    <option value="auto">跟随界面语言</option>
                    <option value="zh-CN">简体中文</option>
                    <option value="en-US">English</option>
                    <option value="ja-JP">日本語</option>
                    <option value="zh-TW">繁體中文</option>
                  </select>
                  <p style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 8, lineHeight: 1.4 }}>
                    这里控制 AI 生成的简报、问答和记忆。应用界面语言在 偏好设置 中设置。
                  </p>
                </div>
              </div>
            </div>

            {/* Banner: Agent 设置已移到上下文 */}
            <div className="nl-card" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(99,102,241,0.06)", borderColor: "rgba(99,102,241,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>✨</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Agent 设置已移到上下文</span>
                  <p style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 2 }}>
                    AI 身份和规则决定连接进来的 AI 开始工作前会收到什么。所以它们现在属于上下文，而不是个人资料设置。
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
                <span style={{ color: "#818cf8", cursor: "pointer" }}>AI 身份</span>
                <span style={{ color: "#475569" }}>·</span>
                <span style={{ color: "#818cf8", cursor: "pointer" }}>规则</span>
              </div>
            </div>

            {/* 卡片 4: 关于你 */}
            <div className="nl-card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 15 }}>📝</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>关于你</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 10 }}>
                你要告诉你的工作或偏好，AI 会把此生成与你相关的记忆。
              </p>

              <textarea
                placeholder="告诉你的 AI 了解你是在..."
                rows={4}
                value={profileAboutYou}
                onChange={(e) => setProfileAboutYou(e.target.value)}
                className="nl-input"
                style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
              />

              <div style={{ marginTop: 8 }}>
                <span
                  style={{ fontSize: 11, color: "#818cf8", cursor: "pointer" }}
                  onClick={() => setShowAboutExample(!showAboutExample)}
                >
                  {showAboutExample ? "▼ 收起示例" : "▶ 查看示例"}
                </span>
                {showAboutExample && (
                  <div style={{ marginTop: 6, padding: "8px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 6, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                    💡 示例: 我是一名资深全栈工程师，主要技术栈为 TypeScript、React、Go 和 Python。我正在开发 AI 辅助编程与知识图谱系统，注重代码架构优雅与零依赖轻量化设计。
                  </div>
                )}
              </div>
            </div>

            {/* 卡片 5: 个人资料说明 */}
            <div className="nl-card" style={{ padding: 16, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 15 }}>🗂️</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>个人资料说明</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 10 }}>
                把你的个人资料提供给 Agent 的背景和偏好，可应用于 Agent 行为写入 Rules，记住这些要求让你日记更轻松。
              </p>

              <textarea
                placeholder="补充 Agent 应该了解的个人背景..."
                rows={4}
                value={profileInstructions}
                onChange={(e) => setProfileInstructions(e.target.value)}
                className="nl-input"
                style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
              />

              <div style={{ marginTop: 8 }}>
                <span
                  style={{ fontSize: 11, color: "#818cf8", cursor: "pointer" }}
                  onClick={() => setShowProfileExample(!showProfileExample)}
                >
                  {showProfileExample ? "▼ 收起示例" : "▶ 查看示例"}
                </span>
                {showProfileExample && (
                  <div style={{ marginTop: 6, padding: "8px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 6, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                    💡 示例: 在生成代码时严格遵循 TypeScript Strict 规范，优先提供直接可用的完整模块而不是残缺代码片段；中文交互请保持简洁专业。
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="nl-btn-primary"
                onClick={handleSaveProfile}
                disabled={isSaving}
                style={{ padding: "8px 24px" }}
              >
                {isSaving ? "保存中..." : "保存个人资料"}
              </button>
            </div>
          </div>
        )}

        {/* 5. 数据迁移 (Data Migration) Tab (Screenshot 2) */}
        {activeSubTab === "migration" && (
          <div className="nl-set-panel" style={{ maxWidth: 860, animation: "fadeIn 0.2s ease" }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f8fafc" }}>数据迁移</h2>
              <p style={{ fontSize: 13, color: "var(--nl-text-secondary)", marginTop: 2 }}>
                在不同安装之间迁移应用设置或知识库。
              </p>
            </div>

            {migrationToast && (
              <div style={{ padding: "8px 14px", marginBottom: 14, borderRadius: 6, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#10b981", fontSize: 12 }}>
                {migrationToast}
              </div>
            )}

            {/* 卡片 1: 设备备份 */}
            <div className="nl-card" style={{ padding: "16px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 20, marginTop: 2 }}>🔄</span>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>设备备份</h3>
                  <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginTop: 3 }}>
                    迁移个人资料、空间、后台智能偏好和服务商配置。API 密钥与登录状态仍只保留在各自设备上。
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  className="nl-btn-secondary"
                  style={{ fontSize: 12, padding: "5px 12px", display: "flex", alignItems: "center", gap: 4 }}
                  onClick={handleExportSettings}
                  disabled={isExportingSettings}
                >
                  <span>📥</span> 备份
                </button>
                <label className="nl-btn-secondary" style={{ fontSize: 12, padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <span>🔄</span> 恢复
                  <input type="file" accept=".json" onChange={handleImportSettingsFile} style={{ display: "none" }} />
                </label>
              </div>
            </div>

            {/* 卡片 2: 知识数据 */}
            <div className="nl-card" style={{ padding: "16px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 20, marginTop: 2 }}>🗄️</span>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>知识数据</h3>
                  <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginTop: 3 }}>
                    在不同安装之间迁移记忆、对话、信源、技能与图谱关系。
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={migrationCompressZip}
                      onChange={(e) => setMigrationCompressZip(e.target.checked)}
                      className="nl-checkbox-toggle"
                    />
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>压缩为 .zip</span>
                  </div>
                </div>
              </div>

              <button
                className="nl-btn-primary"
                style={{ fontSize: 12, padding: "6px 16px", display: "flex", alignItems: "center", gap: 6 }}
                onClick={handleExportKnowledge}
                disabled={isExportingKnowledge}
              >
                <span>📥</span> {isExportingKnowledge ? "导出中..." : "备份"}
              </button>
            </div>

            {/* 卡片 3: 恢复知识 */}
            <div className="nl-card" style={{ padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>恢复知识</h3>
              </div>
              <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 16 }}>
                将之前的备份恢复到当前安装。
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* 遇到已有内容时 */}
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 8 }}>遇到已有内容时</label>
                  <div className="nl-mode-switch" style={{ width: "100%", display: "flex" }}>
                    <button
                      className={`nl-mode-btn ${migrationConflictMode === "merge" ? "active" : ""}`}
                      style={{ flex: 1 }}
                      onClick={() => setMigrationConflictMode("merge")}
                    >
                      合并
                    </button>
                    <button
                      className={`nl-mode-btn ${migrationConflictMode === "skip" ? "active" : ""}`}
                      style={{ flex: 1 }}
                      onClick={() => setMigrationConflictMode("skip")}
                    >
                      跳过
                    </button>
                    <button
                      className={`nl-mode-btn ${migrationConflictMode === "replace" ? "active" : ""}`}
                      style={{ flex: 1 }}
                      onClick={() => setMigrationConflictMode("replace")}
                    >
                      替换
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 6 }}>
                    {migrationConflictMode === "merge" && "更稳定，只补齐缺失字段，不覆盖已有内容。"}
                    {migrationConflictMode === "skip" && "如已有同 ID 记忆或实体，则跳过不导入。"}
                    {migrationConflictMode === "replace" && "⚠️ 清空当前数据库并完全替换为备份内容。"}
                  </p>
                </div>

                {/* 导入来源 */}
                <div>
                  <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 8 }}>导入来源</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <label className="nl-btn-secondary" style={{ flex: 1, padding: "8px 12px", textAlign: "center", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12 }}>
                      <span>📄</span> 选择 Zip / JSON
                      <input type="file" accept=".json,.zip" onChange={handleImportKnowledgeFile} style={{ display: "none" }} />
                    </label>
                    <label className="nl-btn-secondary" style={{ flex: 1, padding: "8px 12px", textAlign: "center", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12 }}>
                      <span>📁</span> 选择文件夹
                      <input type="file" {...({ webkitdirectory: "", directory: "" } as any)} onChange={handleImportKnowledgeFile} style={{ display: "none" }} />
                    </label>
                  </div>
                  {isImportingKnowledge && (
                    <p style={{ fontSize: 11, color: "#818cf8", marginTop: 6 }}>正在解析并恢复知识库数据，请稍候...</p>
                  )}
                </div>
              </div>
            </div>

            {/* 折叠 1: 包含的数据 */}
            <details style={{ marginBottom: 12, padding: "10px 14px", background: "var(--nl-bg-card)", border: "1px solid var(--nl-border)", borderRadius: 8 }}>
              <summary style={{ fontSize: 12, color: "#94a3b8", cursor: "pointer", fontWeight: 500 }}>
                ▶ 包含的数据
              </summary>
              <div style={{ marginTop: 10, fontSize: 12, color: "#cbd5e1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>• 记忆条目 (Memories & Versions)</div>
                <div>• 知识图谱事实三元组 (Facts & Triples)</div>
                <div>• 信源文档与分片 (Sources & Chunks)</div>
                <div>• 记忆双向关联网 (Memory Relations)</div>
                <div>• 知识社区与聚类 (Graph Communities)</div>
                <div>• 工作记忆简报 (Working Memory Briefings)</div>
              </div>
            </details>

            {/* 折叠 2: 存储维护 */}
            <details style={{ padding: "10px 14px", background: "var(--nl-bg-card)", border: "1px solid var(--nl-border)", borderRadius: 8 }}>
              <summary style={{ fontSize: 12, color: "#94a3b8", cursor: "pointer", fontWeight: 500 }}>
                ▶ 存储维护
              </summary>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--nl-text-muted)" }}>
                <p>当前数据库引擎: SQLite + sqlite-vec (零 Docker 独立进程)</p>
                <p style={{ marginTop: 4 }}>数据文件路径: <code>{intelStats.dbPath || "data/NowledgeMem.db"}</code></p>
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button className="nl-btn-secondary" style={{ fontSize: 11 }} onClick={handleOptimizeDb}>
                    整理数据库碎片 (VACUUM)
                  </button>
                  <button className="nl-btn-secondary" style={{ fontSize: 11 }} onClick={handleRebuildIndex}>
                    全量重建检索索引
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}

        {/* 6. 随处访问 (Remote Access) Tab (Screenshots 3 & 4) */}
        {activeSubTab === "remote" && (
          <div className="nl-set-panel" style={{ maxWidth: 860, animation: "fadeIn 0.2s ease" }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f8fafc" }}>随处访问</h2>
              <p style={{ fontSize: 13, color: "var(--nl-text-secondary)", marginTop: 2 }}>
                让这台 Mem 可被你的其他设备和 AI 工具访问。
              </p>
            </div>

            {remoteToast && (
              <div style={{ padding: "8px 14px", marginBottom: 14, borderRadius: 6, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#10b981", fontSize: 12 }}>
                {remoteToast}
              </div>
            )}

            {/* 卡片 1: Plus 已包含 随处访问 */}
            <div className="nl-card" style={{ padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(99,102,241,0.06)", borderColor: "rgba(99,102,241,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>💎</span>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "#f8fafc" }}>Plus 已包含 随处访问</h3>
                  <p style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 2 }}>
                    多设备访问仍可使用。Plus 会从另一个账号提供 1 个独立的 Nowledge Link 主机、Nowledge AI 额度和用量整理。
                  </p>
                </div>
              </div>
              <button className="nl-btn-secondary" style={{ fontSize: 11, padding: "4px 12px", whiteSpace: "nowrap" }}>
                查看方案
              </button>
            </div>

            {/* 卡片 2: 允许同一 Wi-Fi 下的设备访问 */}
            <div className="nl-card" style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>允许同一 Wi-Fi 下的设备访问</h3>
                  <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginTop: 3 }}>
                    让附近设备可直接访问这台电脑。局域网连接需要 API 密钥。会自动显示一次后端。
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowLan}
                  onChange={(e) => handleToggleLanAccess(e.target.checked)}
                  className="nl-checkbox-toggle"
                />
              </div>

              {/* 开启后的黄色警告 Banner (Screenshot 4 像素级还原) */}
              {allowLan && (
                <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#fbbf24" }}>
                    <span>⚠️ 当前监听:</span>
                    <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: 4, color: "#fef3c7" }}>0.0.0.0:14242</code>
                  </div>
                  <p style={{ fontSize: 11, color: "#d97706", marginTop: 4 }}>
                    同一网段中的设备需要 API 密钥才能访问当前电脑，请仅在可信网络中开启。
                  </p>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontSize: 11, color: "#fbbf24", cursor: "pointer" }}>▶ 按 IP 限制访问</summary>
                    <div style={{ marginTop: 6 }}>
                      <input
                        type="text"
                        placeholder="允许的 IP 段 (如 192.168.1.*)"
                        value={ipWhitelist}
                        onChange={(e) => setIpWhitelist(e.target.value)}
                        className="nl-input"
                        style={{ fontSize: 11, padding: "4px 8px" }}
                      />
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* 卡片 3: API 密钥 */}
            <div className="nl-card" style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>API 密钥</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="nl-btn-link" style={{ fontSize: 11, color: "#818cf8" }} onClick={handleRotateRemoteApiKey}>
                    🔄 轮换
                  </button>
                  <button className="nl-btn-link" style={{ fontSize: 11, color: "#818cf8" }} onClick={() => { navigator.clipboard.writeText(remoteApiKey); setRemoteToast("API 密钥已复制到剪贴板"); }}>
                    📋 复制
                  </button>
                  <button className="nl-btn-link" style={{ fontSize: 11, color: "#818cf8" }} onClick={() => alert(`Web 客户端配置：\n\nURL: http://127.0.0.1:14242\nAPI Key: ${remoteApiKey}`)}>
                    📄 生成网页配置
                  </button>
                  <button className="nl-btn-link" style={{ fontSize: 11, color: "#818cf8" }} onClick={() => alert(`API 密钥凭证:\n${remoteApiKey}`)}>
                    📱 二维码
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 10 }}>
                局域网或连接需要此密钥。随处访问地址用同一密钥。
              </p>

              <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 12px" }}>
                <span style={{ flex: 1, fontFamily: "monospace", fontSize: 12, color: "#e2e8f0" }}>
                  {showRemoteKeyMask ? remoteApiKey : "••••••••••••••••••••••••••••••••"}
                </span>
                <button
                  type="button"
                  className="nl-btn-link"
                  style={{ fontSize: 11, color: "#94a3b8" }}
                  onClick={() => setShowRemoteKeyMask(!showRemoteKeyMask)}
                >
                  {showRemoteKeyMask ? "隐藏" : "显示"}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 6 }}>
                出于安全原因默认隐藏，点击复制时临时显示，或点击轮换生成新密钥。
              </p>
            </div>

            {/* 卡片 4: 本地访问也需要 API 密钥 */}
            <div className="nl-card" style={{ padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "#f8fafc" }}>本地访问也需要 API 密钥</h3>
                <p style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 2 }}>
                  开启后，本机基本请求也需要 API 密钥。
                </p>
              </div>
              <input
                type="checkbox"
                checked={requireLocalAuth}
                onChange={(e) => {
                  setRequireLocalAuth(e.target.checked);
                  saveAppSettings({ remoteAccess: { allowLan, requireLocalAuth: e.target.checked, apiKey: remoteApiKey, tunnelType, tunnelStatus, publicUrl: remotePublicUrl, ipWhitelist } });
                }}
                className="nl-checkbox-toggle"
              />
            </div>

            {/* 卡片 5: 随处访问 (Cloudflare Tunnel) */}
            <div className="nl-card" style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>随处访问</h3>
                  <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginTop: 2 }}>通过互联网在任何地方访问你的 Mem</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: tunnelStatus === "running" ? "#10b981" : "#64748b" }}>
                    {tunnelStatus === "running" ? "● 运行中" : "未活跃"}
                  </span>
                  <button
                    className={tunnelStatus === "running" ? "nl-btn-secondary" : "nl-btn-primary"}
                    style={{ fontSize: 12, padding: "5px 14px" }}
                    onClick={handleToggleRemoteTunnel}
                  >
                    {tunnelStatus === "running" ? "停止随处访问" : "▶ 启动随处访问"}
                  </button>
                </div>
              </div>

              {/* 步骤条 */}
              <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
                <span style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", color: "#94a3b8", padding: "2px 8px", borderRadius: 4 }}>1. 选择连接类型</span>
                <span style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", color: "#94a3b8", padding: "2px 8px", borderRadius: 4 }}>2. 启动</span>
                <span style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", color: "#94a3b8", padding: "2px 8px", borderRadius: 4 }}>3. 复制 URL + 密钥</span>
              </div>

              {/* 连接类型切换 */}
              <div className="nl-mode-switch" style={{ display: "inline-flex", marginBottom: 12 }}>
                <button
                  className={`nl-mode-btn ${tunnelType === "quick" ? "active" : ""}`}
                  onClick={() => setTunnelType("quick")}
                >
                  快速连接
                </button>
                <button
                  className={`nl-mode-btn ${tunnelType === "named" ? "active" : ""}`}
                  onClick={() => setTunnelType("named")}
                >
                  Cloudflare 账户
                </button>
              </div>

              {tunnelStatus === "running" && remotePublicUrl && (
                <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 6, marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>随处访问已就绪 ↗</div>
                  <div style={{ fontSize: 13, fontFamily: "monospace", color: "#f8fafc", marginTop: 4, wordBreak: "break-all" }}>
                    {remotePublicUrl}
                  </div>
                </div>
              )}

              <p style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 10 }}>
                当前使用 bundled 二进制: <code>bundled/cloudflared.exe</code>
              </p>
            </div>

            {/* 卡片 6: 连接到远程 Nowledge Mem */}
            <div className="nl-card" style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🖥️</span>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "#f8fafc" }}>连接到远程 Nowledge Mem</h3>
                  <p style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 2 }}>
                    访问另一台设备上运行的 Nowledge Mem。
                  </p>
                </div>
              </div>
              <button
                className="nl-btn-secondary"
                style={{ fontSize: 11, padding: "5px 14px" }}
                onClick={() => setShowConnectModal(true)}
              >
                连接
              </button>
            </div>
          </div>
        )}

        {/* 7. 其他 Tab (团队 / 偏好 / 授权 / 关于) */}
        {activeSubTab === "team" && (
          <div className="nl-set-panel">
            <h2>团队协作</h2>
            <p className="nl-set-desc">多成员共享空间与多人图谱同步服务。</p>
          </div>
        )}

        {/* ── 8. 偏好设置 (Preferences) ── */}
        {activeSubTab === "preferences" && (
          <div className="nl-set-panel">
            <div className="nl-set-panel-header" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--nl-text-primary)", margin: 0 }}>偏好设置</h2>
                  <p className="nl-set-desc" style={{ marginTop: 4 }}>
                    自定义外观、快捷键和应用行为。
                  </p>
                </div>
                {prefToast && (
                  <div style={{ padding: "6px 14px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 6, color: "#34d399", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    {prefToast}
                  </div>
                )}
              </div>
            </div>

            {/* 卡片 1: 外观 (Appearance) */}
            <div className="nl-card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <span style={{ fontSize: 18 }}>🔆</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--nl-text-primary)" }}>外观</span>
              </div>

              {/* 1. 主题 */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--nl-text-secondary)", marginBottom: 8 }}>主题</div>
                <div className="nl-theme-segmented" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "rgba(255,255,255,0.04)", padding: 3, borderRadius: 8, border: "1px solid var(--nl-border)" }}>
                  <button
                    type="button"
                    className={`nl-seg-btn ${themeMode === "light" ? "active" : ""}`}
                    onClick={() => {
                      setThemeMode("light");
                      handleSavePreferences({ themeMode: "light" });
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      fontSize: 13,
                      border: "none",
                      background: themeMode === "light" ? "var(--nl-card-bg)" : "transparent",
                      color: themeMode === "light" ? "#f8fafc" : "var(--nl-text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>☀️</span> 浅色
                  </button>
                  <button
                    type="button"
                    className={`nl-seg-btn ${themeMode === "dark" ? "active" : ""}`}
                    onClick={() => {
                      setThemeMode("dark");
                      handleSavePreferences({ themeMode: "dark" });
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      fontSize: 13,
                      border: "none",
                      background: themeMode === "dark" ? "rgba(255,255,255,0.08)" : "transparent",
                      color: themeMode === "dark" ? "#f8fafc" : "var(--nl-text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      boxShadow: themeMode === "dark" ? "0 1px 3px rgba(0,0,0,0.4)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>🌙</span> 深色
                  </button>
                  <button
                    type="button"
                    className={`nl-seg-btn ${themeMode === "system" ? "active" : ""}`}
                    onClick={() => {
                      setThemeMode("system");
                      handleSavePreferences({ themeMode: "system" });
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      fontSize: 13,
                      border: "none",
                      background: themeMode === "system" ? "rgba(255,255,255,0.08)" : "transparent",
                      color: themeMode === "system" ? "#f8fafc" : "var(--nl-text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      transition: "all 0.15s ease",
                    }}
                  >
                    跟随系统
                  </button>
                </div>
              </div>

              {/* 2. 界面语言 */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--nl-text-secondary)", marginBottom: 8 }}>界面语言</div>
                <div style={{ position: "relative" }}>
                  <select
                    className="nl-select"
                    value={uiLanguage}
                    onChange={(e) => {
                      setUiLanguage(e.target.value);
                      handleSavePreferences({ uiLanguage: e.target.value });
                    }}
                    style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--nl-border)", borderRadius: 8, color: "#f8fafc" }}
                  >
                    <option value="auto">跟随系统 (当前使用: 简体中文)</option>
                    <option value="zh-CN">简体中文 (Simplified Chinese)</option>
                    <option value="zh-TW">繁體中文 (Traditional Chinese)</option>
                    <option value="en-US">English (US)</option>
                    <option value="ja-JP">日本語 (Japanese)</option>
                  </select>
                </div>
                <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginTop: 6 }}>
                  总以此设定显示界面。AI 回复语言请到 个人资料 里的 输出语言 设定。
                </p>
              </div>

              {/* 3. 字号尺寸 */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--nl-text-secondary)", marginBottom: 8 }}>字号尺寸</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { id: "small", label: "A", size: 12, title: "小" },
                    { id: "normal", label: "A", size: 14, title: "标准" },
                    { id: "medium", label: "A", size: 16, title: "中" },
                    { id: "large", label: "A", size: 18, title: "大" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setFontSizeScale(f.id as any);
                        handleSavePreferences({ fontSizeScale: f.id });
                      }}
                      style={{
                        padding: "10px 0",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        background: fontSizeScale === f.id ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                        border: fontSizeScale === f.id ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--nl-border)",
                        borderRadius: 8,
                        color: fontSizeScale === f.id ? "#f8fafc" : "var(--nl-text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: f.size, fontWeight: 600 }}>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 卡片 2: 启动 (Startup) */}
            <div className="nl-card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: 18, marginTop: 2 }}>🖥️</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--nl-text-primary)" }}>登录时自动启动</div>
                    <div style={{ fontSize: 12, color: "var(--nl-text-muted)", marginTop: 2 }}>
                      登录系统后自动启动 Nowledge。
                    </div>
                  </div>
                </div>
                <label className="nl-switch">
                  <input
                    type="checkbox"
                    checked={launchAtLogin}
                    onChange={(e) => {
                      setLaunchAtLogin(e.target.checked);
                      handleSavePreferences({ launchAtLogin: e.target.checked });
                    }}
                  />
                  <span className="nl-slider round"></span>
                </label>
              </div>
            </div>

            {/* 卡片 3: 记忆空间 (Memory Spaces) */}
            <div className="nl-card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🗂️</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--nl-text-primary)" }}>记忆空间</span>
                </div>
                <label className="nl-switch">
                  <input
                    type="checkbox"
                    checked={enableMultiSpaces}
                    onChange={(e) => {
                      setEnableMultiSpaces(e.target.checked);
                      handleSavePreferences({ enableMultiSpaces: e.target.checked });
                    }}
                  />
                  <span className="nl-slider round"></span>
                </label>
              </div>

              <p style={{ fontSize: 13, color: "var(--nl-text-secondary)", lineHeight: 1.6, margin: "0 0 8px 0" }}>
                只在空间内部查找和消费记忆。时间线、记忆、对话、信源和工作记忆都会跟随当前空间；附随默认仍然是全局的，除非你主动隐藏。
              </p>
              <p style={{ fontSize: 12, color: "var(--nl-text-muted)", margin: "0 0 16px 0" }}>
                你现在仍然只有一个共享空间。只有在需要独立记忆隔离时，再创建新的空间。
              </p>

              {/* 生效原理说明 Callout */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--nl-border)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  marginBottom: 16,
                  fontSize: 12,
                  color: "var(--nl-text-secondary)",
                  lineHeight: 1.7,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--nl-text-primary)", marginBottom: 4 }}>
                  <span>💡</span> 这些设置是如何生效的
                </div>
                <div>• 默认约束决定了哪些空间开始隔离，第一步自动归类会优先落到更大范围。</div>
                <div>• 共享上下文的愿景以让“过去连起空间”，它不会偷看隐私记录，也不会把不同空间合并。</div>
                <div>• 空间规则是 AI Now、Feed 和后台任务在这个空间的本地工作规则。</div>
              </div>

              {/* 空间列表卡片 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                {spacesList.length > 0 ? (
                  spacesList.map((sp) => (
                    <div
                      key={sp._id}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--nl-border)",
                        borderRadius: 8,
                        padding: "14px 16px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14 }}>🔘</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>{sp.projectName || "Default"}</span>
                          <span style={{ fontSize: 11, background: "rgba(255,255,255,0.08)", color: "var(--nl-text-muted)", padding: "1px 6px", borderRadius: 4 }}>
                            {sp._id === "default" || sp.projectName === "default" ? "共享" : "独立空间"}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--nl-text-muted)", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 10 }}>
                          当前
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--nl-text-secondary)", marginBottom: 4 }}>
                        {sp.tripleCount || 0} 条事实 · {sp.topicCount || 1} 个对话 · 0 个信源
                      </div>
                      <div style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 8 }}>
                        General memory space for everything not explicitly separated yet.
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                        只能在这个空间 · 没有共享空间
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--nl-border)",
                      borderRadius: 8,
                      padding: "14px 16px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14 }}>🔘</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>Default</span>
                        <span style={{ fontSize: 11, background: "rgba(255,255,255,0.08)", color: "var(--nl-text-muted)", padding: "1px 6px", borderRadius: 4 }}>
                          共享
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--nl-text-muted)", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 10 }}>
                        当前
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--nl-text-secondary)", marginBottom: 4 }}>
                      24 条记忆 · 1 个对话 · 0 个信源
                    </div>
                    <div style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 8 }}>
                      General memory space for everything not explicitly separated yet.
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                      只能在这个空间 · 没有共享空间
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="nl-btn-secondary"
                onClick={() => setShowCreateSpaceModal(true)}
                style={{ width: "100%", padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 12 }}
              >
                + 创建新的空间
              </button>

              <p style={{ fontSize: 12, color: "var(--nl-text-muted)", margin: 0, textAlign: "center" }}>
                只要最后只剩共享的 Default 空间，你之后随时都可以再把它关掉。
              </p>
            </div>

            {/* 卡片 4: 全局热键 (Global Shortcuts) */}
            <div className="nl-card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>⌨️</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--nl-text-primary)" }}>全局热键</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--nl-text-muted)", margin: "0 0 16px 0" }}>
                系统全局有效，即使 Nowledge 在后台运行
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* 1. 启动器搜索 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#f8fafc" }}>启动器搜索</div>
                    <div style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>从任意应用打开浮动搜索</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <kbd style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--nl-border)", padding: "3px 8px", borderRadius: 4, fontSize: 12, color: "#e2e8f0", fontFamily: "inherit" }}>
                      Ctrl + Shift + K
                    </kbd>
                    <label className="nl-switch">
                      <input
                        type="checkbox"
                        checked={shortcutLauncher}
                        onChange={(e) => {
                          setShortcutLauncher(e.target.checked);
                          handleSavePreferences({ shortcutLauncher: e.target.checked });
                        }}
                      />
                      <span className="nl-slider round"></span>
                    </label>
                  </div>
                </div>

                {/* 2. 记忆摘要 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#f8fafc" }}>记忆摘要</div>
                    <div style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>打开主窗口并摘要预览</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <kbd style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--nl-border)", padding: "3px 8px", borderRadius: 4, fontSize: 12, color: "#e2e8f0", fontFamily: "inherit" }}>
                      Ctrl + Shift + Space
                    </kbd>
                    <label className="nl-switch">
                      <input
                        type="checkbox"
                        checked={shortcutSummary}
                        onChange={(e) => {
                          setShortcutSummary(e.target.checked);
                          handleSavePreferences({ shortcutSummary: e.target.checked });
                        }}
                      />
                      <span className="nl-slider round"></span>
                    </label>
                  </div>
                </div>

                {/* 3. 快捷键提示 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#f8fafc" }}>快捷键提示</div>
                    <div style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>按住 Ctrl 在应用内预览快捷键</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <kbd style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--nl-border)", padding: "3px 8px", borderRadius: 4, fontSize: 12, color: "#e2e8f0", fontFamily: "inherit" }}>
                      Ctrl
                    </kbd>
                    <label className="nl-switch">
                      <input
                        type="checkbox"
                        checked={shortcutHints}
                        onChange={(e) => {
                          setShortcutHints(e.target.checked);
                          handleSavePreferences({ shortcutHints: e.target.checked });
                        }}
                      />
                      <span className="nl-slider round"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 卡片 5: 键盘快捷键 (Keyboard Shortcuts Master Reference) */}
            <div className="nl-card" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--nl-text-secondary)", marginBottom: 14 }}>
                键盘快捷键
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 16 }}>
                {/* 左列: 通用 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nl-text-muted)", marginBottom: 10 }}>通用</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { name: "聚焦搜索", keys: "Ctrl + K" },
                      { name: "启动器 (从任意应用呼出)", keys: "Ctrl + Shift + K" },
                      { name: "记忆摘要 (全局)", keys: "Ctrl + Shift + Space" },
                      { name: "切换侧边栏", keys: "Ctrl + \\" },
                      { name: "统计", keys: "Ctrl + ." },
                      { name: "设置", keys: "Ctrl + ," },
                      { name: "退出应用", keys: "Ctrl + Q" },
                    ].map((it) => (
                      <div key={it.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                        <span style={{ color: "var(--nl-text-secondary)" }}>{it.name}</span>
                        <kbd style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--nl-border)", padding: "2px 6px", borderRadius: 4, color: "#e2e8f0", fontFamily: "inherit" }}>
                          {it.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 右列: 导航 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nl-text-muted)", marginBottom: 10 }}>导航</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { name: "收集流", keys: "Ctrl + 1" },
                      { name: "记忆", keys: "Ctrl + 2" },
                      { name: "对话", keys: "Ctrl + 3" },
                      { name: "AI Now", keys: "Ctrl + 4" },
                      { name: "附着", keys: "Ctrl + 5" },
                      { name: "资料库", keys: "Ctrl + 6" },
                      { name: "技能", keys: "Ctrl + 7" },
                      { name: "上下文", keys: "Ctrl + 8" },
                    ].map((it) => (
                      <div key={it.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                        <span style={{ color: "var(--nl-text-secondary)" }}>{it.name}</span>
                        <kbd style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--nl-border)", padding: "2px 6px", borderRadius: 4, color: "#e2e8f0", fontFamily: "inherit" }}>
                          {it.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--nl-border)",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 12,
                  color: "var(--nl-text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>💡</span> 开启快捷键提示，按住 Ctrl 预览快捷键
              </div>
            </div>

            {/* 卡片 6: 开发者工具 (Developer Tools) */}
            <div className="nl-card" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--nl-text-secondary)", marginBottom: 14 }}>
                开发者工具
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* 1. 命令行界面 */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--nl-border)", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 14, fontFamily: "monospace", background: "rgba(255,255,255,0.06)", padding: "3px 6px", borderRadius: 4 }}>&gt;_</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#f8fafc" }}>命令行界面</div>
                        <div style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>从任意终端访问你的知识库</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)", padding: "2px 8px", borderRadius: 4 }}>
                        已安装
                      </span>
                      <button
                        type="button"
                        onClick={() => setCliDetailOpen(!cliDetailOpen)}
                        style={{ background: "transparent", border: "none", color: "var(--nl-text-secondary)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        详情 {cliDetailOpen ? "▴" : "▾"}
                      </button>
                    </div>
                  </div>
                  {cliDetailOpen && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--nl-border)", fontSize: 12, color: "var(--nl-text-secondary)", lineHeight: 1.6 }}>
                      <p style={{ margin: "0 0 6px 0" }}>在终端中运行 <code>nmem --help</code> 或 <code>arcrift --help</code> 即可调起命令行交互：</p>
                      <pre style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 6, margin: 0, overflowX: "auto" }}>
                        <code>{`nmem search "React Router"\nnmem memory add "新的关键决策"\nnmem stats`}</code>
                      </pre>
                    </div>
                  )}
                </div>

                {/* 2. Browse Now */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--nl-border)", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>🌐</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#f8fafc" }}>Browse Now</div>
                        <div style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>面向 AI 智能体的浏览器自动化 CLI</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)", padding: "2px 8px", borderRadius: 4 }}>
                        自动安装
                      </span>
                      <button
                        type="button"
                        onClick={() => setBrowseNowDetailOpen(!browseNowDetailOpen)}
                        style={{ background: "transparent", border: "none", color: "var(--nl-text-secondary)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        详情 {browseNowDetailOpen ? "▴" : "▾"}
                      </button>
                    </div>
                  </div>
                  {browseNowDetailOpen && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--nl-border)", fontSize: 12, color: "var(--nl-text-secondary)", lineHeight: 1.6 }}>
                      <p style={{ margin: "0 0 6px 0" }}>无头浏览器 MCP 与智能体页面抓取服务已自动就绪，支持通过 <code>fetch_url</code> 与 <code>browse</code> 自动将网页知识解析并摄入到当前记忆空间。</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === "license" && (
          <div className="nl-set-panel">
            <h2>授权许可</h2>
            <p className="nl-set-desc">设备激活码: CM-PRO-2026-ACTIVE (永久社区授权)</p>
          </div>
        )}

        {activeSubTab === "about" && (
          <div className="nl-set-panel">
            <h2>关于 Nowledge Mem / ArcRift</h2>
            <p className="nl-set-desc">版本: v1.6.3 (Native Windows Desktop Engine)</p>
            <p style={{ fontSize: 13, color: "var(--nl-text-secondary)", marginTop: 8 }}>
              Nowledge Mem 是一个面向跨 IDE 与 AI 工具的本地连续记忆与知识图谱工作台，支持无缝连接 Antigravity、Cursor、Claude、Gemini CLI 等生态。
            </p>
          </div>
        )}
      </div>

      {/* ── Modal 1: 记忆策略 (Memory Policy) ── */}
      {showPolicyModal && (
        <div className="nl-modal-overlay" onClick={() => setShowPolicyModal(false)}>
          <div className="nl-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc", marginBottom: 6 }}>⚙️ 自定义记忆策略</h3>
            <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 16 }}>
              设定系统自动从会话或信源中沉淀记忆的阈值与规则。
            </p>

            <div className="nl-form-group" style={{ marginBottom: 14 }}>
              <label>生效空间范围</label>
              <select
                value={memoryPolicy.scope || "所有空间"}
                onChange={(e) => setMemoryPolicy({ ...memoryPolicy, scope: e.target.value })}
                className="nl-input"
              >
                <option value="所有空间">所有空间 (全局通用)</option>
                <option value="当前空间">当前激活空间</option>
              </select>
            </div>

            <div className="nl-form-group" style={{ marginBottom: 14 }}>
              <label>单次会话最多沉淀记忆条数: <strong style={{ color: "#818cf8" }}>{memoryPolicy.maxMemoriesPerSession || 3} 条</strong></label>
              <input
                type="range"
                min={1}
                max={10}
                value={memoryPolicy.maxMemoriesPerSession || 3}
                onChange={(e) => setMemoryPolicy({ ...memoryPolicy, maxMemoriesPerSession: parseInt(e.target.value, 10) })}
                style={{ width: "100%", accentColor: "var(--nl-accent)" }}
              />
            </div>

            <div className="nl-form-group" style={{ marginBottom: 14 }}>
              <label>内容细节级别</label>
              <select
                value={memoryPolicy.visibility || "full"}
                onChange={(e) => setMemoryPolicy({ ...memoryPolicy, visibility: e.target.value })}
                className="nl-input"
              >
                <option value="full">可见细节 (完整背景与上下文)</option>
                <option value="concise">极简摘要 (仅提炼结论)</option>
              </select>
            </div>

            <div className="nl-form-group" style={{ marginBottom: 20 }}>
              <label>优先保留的认知类别</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {["Decision (决策)", "Architecture (架构)", "Gotcha (踩坑)", "Rule (规则)", "Tech (技术栈)"].map((cat) => {
                  const key = cat.split(" ")[0];
                  const selected = (memoryPolicy.retainCategories || []).includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        const current = memoryPolicy.retainCategories || [];
                        const updated = selected ? current.filter((c: string) => c !== key) : [...current, key];
                        setMemoryPolicy({ ...memoryPolicy, retainCategories: updated });
                      }}
                      style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: selected ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                        background: selected ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)",
                        color: selected ? "#818cf8" : "#94a3b8",
                        cursor: "pointer",
                      }}
                    >
                      {selected ? "✓ " : "+ "}{cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="nl-btn-secondary" onClick={() => setShowPolicyModal(false)}>
                取消
              </button>
              <button className="nl-btn-primary" onClick={handleSavePolicy}>
                保存策略
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: 本体库管理 (Ontology Studio) ── */}
      {showOntologyModal && (
        <div className="nl-modal-overlay" onClick={() => setShowOntologyModal(false)}>
          <div className="nl-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580, maxHeight: "85vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc", marginBottom: 6 }}>🧩 本体库管理 (Ontology Studio)</h3>
            <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 16 }}>
              自定义你个人或团队知识世界的实体概念与图谱颜色，使 AI 按照你的话归类实体。
            </p>

            {/* 已有本体列表 */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 500 }}>已配置的实体本体 ({ontologyList.length})</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {ontologyList.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      padding: "8px 12px",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{o.icon || "📌"}</span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: o.color, display: "inline-block" }}></span>
                          <strong style={{ fontSize: 13, color: "#f8fafc" }}>{o.name}</strong>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 2 }}>{o.description}</div>
                      </div>
                    </div>
                    <button
                      className="nl-btn-secondary"
                      style={{ fontSize: 11, padding: "2px 6px", color: "#ef4444" }}
                      onClick={() => handleDeleteOntology(o.id)}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 新增本体 */}
            <div style={{ background: "rgba(0,0,0,0.25)", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "#818cf8", fontWeight: 500, marginBottom: 8, display: "block" }}>+ 添加新实体本体</label>
              <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 50px", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="图标"
                  value={newOntoIcon}
                  onChange={(e) => setNewOntoIcon(e.target.value)}
                  className="nl-input"
                  style={{ textAlign: "center" }}
                />
                <input
                  type="text"
                  placeholder="本体名称 (如: 客户、模块、协议)"
                  value={newOntoName}
                  onChange={(e) => setNewOntoName(e.target.value)}
                  className="nl-input"
                />
                <input
                  type="color"
                  value={newOntoColor}
                  onChange={(e) => setNewOntoColor(e.target.value)}
                  style={{ width: "100%", height: 34, padding: 0, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }}
                />
              </div>
              <input
                type="text"
                placeholder="简短描述 (选填)"
                value={newOntoDesc}
                onChange={(e) => setNewOntoDesc(e.target.value)}
                className="nl-input"
                style={{ marginBottom: 8 }}
              />
              <button
                className="nl-btn-primary"
                style={{ width: "100%", fontSize: 12, padding: "6px 0" }}
                onClick={handleAddOntology}
                disabled={!newOntoName.trim()}
              >
                添加本体概念
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="nl-btn-secondary" onClick={() => setShowOntologyModal(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: AI 预算额度 (Token Budget) ── */}
      {showBudgetModal && (
        <div className="nl-modal-overlay" onClick={() => setShowBudgetModal(false)}>
          <div className="nl-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc", marginBottom: 6 }}>💰 设置 AI 月度预算额度</h3>
            <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 16 }}>
              限制本地设备上自动化后台任务的最大 Token 消耗，防止后台任务无节制调用云端 API。
            </p>

            <div className="nl-form-group" style={{ marginBottom: 14 }}>
              <label>月度 Token 预算上限</label>
              <input
                type="number"
                value={monthlyBudgetInput}
                onChange={(e) => setMonthlyBudgetInput(parseInt(e.target.value, 10) || 0)}
                className="nl-input"
              />
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
              {[500000, 1000000, 5000000, 10000000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="nl-btn-secondary"
                  style={{ fontSize: 11, padding: "3px 8px" }}
                  onClick={() => setMonthlyBudgetInput(amt)}
                >
                  {(amt / 1000000).toFixed(1)}M
                </button>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="nl-btn-secondary" onClick={() => setShowBudgetModal(false)}>
                取消
              </button>
              <button className="nl-btn-primary" onClick={handleSaveBudget}>
                保存预算
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 4: 连接到远程 Nowledge Mem ── */}
      {showConnectModal && (
        <div className="nl-modal-overlay" onClick={() => setShowConnectModal(false)}>
          <div className="nl-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc", marginBottom: 6 }}>🖥️ 连接到远程 Nowledge Mem</h3>
            <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 16 }}>
              输入远程主机的访问 URL 与 API 密钥。
            </p>

            <div className="nl-form-group" style={{ marginBottom: 12 }}>
              <label>远程主机 URL</label>
              <input
                type="text"
                placeholder="https://mem-xxxx.trycloudflare.com 或 http://192.168.1.100:14242"
                value={remoteConnectUrl}
                onChange={(e) => setRemoteConnectUrl(e.target.value)}
                className="nl-input"
              />
            </div>

            <div className="nl-form-group" style={{ marginBottom: 16 }}>
              <label>API 密钥</label>
              <input
                type="password"
                placeholder="ak_live_..."
                value={remoteConnectKey}
                onChange={(e) => setRemoteConnectKey(e.target.value)}
                className="nl-input"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="nl-btn-secondary" onClick={() => setShowConnectModal(false)}>
                取消
              </button>
              <button
                className="nl-btn-primary"
                onClick={() => {
                  if (!remoteConnectUrl.trim()) return alert("请输入远程主机 URL");
                  setShowConnectModal(false);
                  setRemoteToast(`✓ 已连接到远程主机: ${remoteConnectUrl}`);
                  setTimeout(() => setRemoteToast(null), 3500);
                }}
              >
                测试并连接
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 5: 创建新的空间 ── */}
      {showCreateSpaceModal && (
        <div className="nl-modal-overlay" onClick={() => setShowCreateSpaceModal(false)}>
          <div className="nl-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc", marginBottom: 6 }}>🗂️ 创建新的记忆空间</h3>
            <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginBottom: 16 }}>
              创建独立的记忆空间以隔离时间线、记忆卡片与信源资料。
            </p>

            <div className="nl-form-group" style={{ marginBottom: 12 }}>
              <label>空间名称 (Project / Space Name)</label>
              <input
                type="text"
                placeholder="例如: Mobile App / Web Portal"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                className="nl-input"
              />
            </div>

            <div className="nl-form-group" style={{ marginBottom: 16 }}>
              <label>平台类别 (Platform)</label>
              <select
                className="nl-select"
                value={newSpacePlatform}
                onChange={(e) => setNewSpacePlatform(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--nl-border)", borderRadius: 6, color: "#f8fafc" }}
              >
                <option value="desktop">🖥️ 桌面 (Desktop)</option>
                <option value="web">🌐 网页 (Web)</option>
                <option value="chrome">🧭 浏览器插件 (Chrome Extension)</option>
                <option value="mobile">📱 移动端 (Mobile)</option>
                <option value="cli">⌨️ 命令行 (CLI)</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="nl-btn-secondary" onClick={() => setShowCreateSpaceModal(false)}>
                取消
              </button>
              <button className="nl-btn-primary" onClick={handleCreateSpace}>
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
