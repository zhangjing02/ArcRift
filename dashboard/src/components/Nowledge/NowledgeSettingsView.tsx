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
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    }
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

        {/* Other Tabs */}
        {activeSubTab === "profile" && (
          <div className="nl-set-panel">
            <h2>个人资料</h2>
            <p className="nl-set-desc">本地设备实例 ID: CM-{Math.random().toString(36).slice(2, 8).toUpperCase()}</p>
          </div>
        )}

        {activeSubTab === "about" && (
          <div className="nl-set-panel">
            <h2>关于 ChronosMind</h2>
            <p className="nl-set-desc">版本: v1.6.3 (Native Windows Desktop Engine)</p>
            <p style={{ fontSize: 13, color: "var(--nl-text-secondary)", marginTop: 8 }}>
              ChronosMind 是一个面向跨 IDE 与 AI 工具的本地连续记忆与知识图谱工作台，支持无缝连接 Antigravity、Cursor、Claude、Gemini CLI 等生态。
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
    </div>
  );
};
