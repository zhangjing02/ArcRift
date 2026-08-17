import React, { useState, useEffect, useRef } from "react";
import {
  fetchAppSettings,
  saveAppSettings,
  testSettingsConnection,
  getModelStatuses,
  downloadModel,
  deleteModelById,
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

  // Models State
  const [models, setModels] = useState<ModelItem[]>([]);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    loadSettings();
    loadModels();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const loadSettings = async () => {
    try {
      const data = await fetchAppSettings();
      if (data) {
        if (data.chatProvider) setProvider(data.chatProvider);
        if (data.apiBaseUrl) setApiBaseUrl(data.apiBaseUrl);
        if (data.apiKey) setApiKey(data.apiKey);
        if (data.chatModel) setChatModel(data.chatModel);
        if (data.embeddingMode) setEmbeddingMode(data.embeddingMode);
        if (data.llmMode) setLlmMode(data.llmMode);
      }
    } catch (err) {
      console.error("Failed to load settings", err);
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

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await saveAppSettings({
        chatProvider: provider,
        apiBaseUrl,
        apiKey,
        chatModel,
        llmMode,
        embeddingMode,
        embeddingProvider: embeddingMode === "cloud" ? "openai-compatible" : "ollama",
      });
      setSaveToast("✓ API Key 与配置已永久保存！重启软件将自动加载生效。");
      setTimeout(() => setSaveToast(null), 4000);
      await loadSettings();
    } catch (err: any) {
      alert("保存失败: " + err.message);
    } finally {
      setIsSaving(false);
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
          <div className="nl-set-panel">
            <div className="nl-smart-header-card">
              <div className="nl-smart-title-wrap">
                <span style={{ fontSize: 20 }}>❇️</span>
                <div>
                  <h2>后台智能</h2>
                  <p style={{ fontSize: 13, color: "var(--nl-text-secondary)", marginTop: 2 }}>
                    允许 Mem 自动运行简报、洞察、结晶、技能建议和记忆维护等 AI 任务
                  </p>
                </div>
              </div>
              <div className="nl-switch-wrap">
                <span className="nl-switch-label">● {bgSmartActive ? "就绪" : "已暂停"}</span>
                <input
                  type="checkbox"
                  checked={bgSmartActive}
                  onChange={(e) => setBgSmartActive(e.target.checked)}
                  className="nl-checkbox-toggle"
                />
              </div>
            </div>

            <div className="nl-card" style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <h3 style={{ fontSize: 14 }}>后台工作</h3>
                <span style={{ fontSize: 12, color: "#10b981" }}>空闲</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>
                当前没有任务在运行。新记忆、同步对话或定时计划需要处理时，会自动开始后台工作。
              </p>
            </div>
          </div>
        )}

        {/* 3. 服务商 (Providers) Tab */}
        {activeSubTab === "providers" && (
          <div className="nl-set-panel">
            <h2>AI 服务商与 API 秘钥配置</h2>
            <p className="nl-set-desc">配置云端兼容 API（如硅基流动、DeepSeek、OpenAI、Gemini 等）。输入并保存后将永久保存在软件中，无需每次重复输入。</p>

            <div className="nl-card" style={{ marginTop: 16 }}>
              <div className="nl-form-group" style={{ marginBottom: 14 }}>
                <label>预设服务商</label>
                <select
                  value={provider}
                  onChange={(e) => {
                    const p = e.target.value;
                    setProvider(p);
                    if (p === "siliconflow") {
                      setApiBaseUrl("https://api.siliconflow.cn/v1");
                      setChatModel("deepseek-ai/DeepSeek-V3");
                    } else if (p === "deepseek") {
                      setApiBaseUrl("https://api.deepseek.com/v1");
                      setChatModel("deepseek-chat");
                    } else if (p === "openai") {
                      setApiBaseUrl("https://api.openai.com/v1");
                      setChatModel("gpt-4o-mini");
                    } else if (p === "gemini") {
                      setApiBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai");
                      setChatModel("gemini-1.5-flash");
                    } else if (p === "groq") {
                      setApiBaseUrl("https://api.groq.com/openai/v1");
                      setChatModel("llama-3.3-70b-versatile");
                    } else if (p === "ollama") {
                      setApiBaseUrl("http://localhost:11434/v1");
                      setChatModel("qwen2.5:3b");
                    }
                  }}
                  className="nl-input"
                >
                  <option value="siliconflow">SiliconFlow (硅基流动 - 推荐/含免费额度)</option>
                  <option value="deepseek">DeepSeek 官方 API</option>
                  <option value="openai">OpenAI 官方 (GPT-4o-mini)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="groq">Groq Cloud (超快推理)</option>
                  <option value="ollama">Ollama (本地离线)</option>
                </select>
              </div>

              <div className="nl-form-group" style={{ marginBottom: 14 }}>
                <label>API Key / 秘钥 (填写后永久保存在本地)</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="nl-input"
                />
              </div>

              <div className="nl-form-group" style={{ marginBottom: 14 }}>
                <label>API Base URL</label>
                <input
                  type="text"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  className="nl-input"
                />
              </div>

              <div className="nl-form-group" style={{ marginBottom: 20 }}>
                <label>模型名称 (Chat Model)</label>
                <input
                  type="text"
                  value={chatModel}
                  onChange={(e) => setChatModel(e.target.value)}
                  className="nl-input"
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  className="nl-btn-secondary"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                >
                  {isTesting ? "测试中..." : "测试连接"}
                </button>
                <button
                  className="nl-btn-primary"
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                >
                  {isSaving ? "保存中..." : "保存设置 (永久持久化)"}
                </button>
              </div>

              {testResult && (
                <div
                  className={`nl-test-banner ${testResult.success ? "success" : "error"}`}
                  style={{ marginTop: 14 }}
                >
                  {testResult.success ? "✓ " : "✕ "} {testResult.message}
                </div>
              )}
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
    </div>
  );
};
