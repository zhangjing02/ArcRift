import React, { useState, useEffect } from "react";
import {
  fetchSettings,
  updateSettings,
  testSettingsConnection,
} from "../../api/ArcRift";
import type { SettingsResponse } from "../../api/ArcRift";

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

  const [, setSettings] = useState<SettingsResponse | null>(null);
  const [embeddingMode, setEmbeddingMode] = useState<"local" | "cloud">("local");
  const [llmMode, setLlmMode] = useState<"local" | "cloud">("cloud");
  const [provider, setProvider] = useState("siliconflow");
  const [apiBaseUrl, setApiBaseUrl] = useState("https://api.siliconflow.cn/v1");
  const [apiKey, setApiKey] = useState("");
  const [chatModel, setChatModel] = useState("deepseek-ai/DeepSeek-V3");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bgSmartActive, setBgSmartActive] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await fetchSettings();
      setSettings(data);
      if (data.chatProvider) setProvider(data.chatProvider);
      if (data.apiBaseUrl) setApiBaseUrl(data.apiBaseUrl);
      if (data.apiKey) setApiKey(data.apiKey);
      if (data.chatModel) setChatModel(data.chatModel);
      if (data.embeddingProvider === "openai-compatible") setEmbeddingMode("cloud");
    } catch (err) {
      console.error("Failed to load settings", err);
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
      await updateSettings({
        chatProvider: provider,
        apiBaseUrl,
        apiKey,
        chatModel,
        embeddingProvider: embeddingMode === "cloud" ? "openai-compatible" : "local",
      });
      alert("设置已保存并即时生效！");
      await loadSettings();
    } catch (err: any) {
      alert("保存失败: " + err.message);
    } finally {
      setIsSaving(false);
    }
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
              {/* Card 1: 索引模型 */}
              <div className="nl-model-box">
                <div className="nl-model-box-header">
                  <div className="nl-model-title-wrap">
                    <span className="nl-model-icon">🔍</span>
                    <h3>索引模型</h3>
                  </div>
                  <div className="nl-model-status-pills">
                    <span className="nl-status-green">● 已安装</span>
                    <span className="nl-status-blue">● 已验证</span>
                  </div>
                </div>
                <div className="nl-model-box-sub">搜索与增强</div>
                <div className="nl-model-meta-grid">
                  <div className="nl-meta-col">
                    <span className="nl-lbl">模型:</span>
                    <span className="nl-val">Qwen3-Embedding-0.6B Q4_K_M (Imatrix)</span>
                  </div>
                  <div className="nl-meta-col">
                    <span className="nl-lbl">大小:</span>
                    <span className="nl-val">396.0 MB</span>
                  </div>
                </div>
                <div className="nl-model-box-footer">
                  <button className="nl-btn-downloaded">✓ 已下载</button>
                </div>
              </div>

              {/* Card 2: 本地 LLM */}
              <div className="nl-model-box">
                <div className="nl-model-box-header">
                  <div className="nl-model-title-wrap">
                    <span className="nl-model-icon">🤖</span>
                    <h3>本地 LLM</h3>
                  </div>
                  <div className="nl-model-status-pills">
                    <span className="nl-status-gray">● 未安装</span>
                  </div>
                </div>
                <div className="nl-model-box-sub">在设备上驱动搜索、实体提取与记忆提炼</div>
                <div className="nl-model-meta-grid">
                  <div className="nl-meta-col">
                    <span className="nl-lbl">模型:</span>
                    <span className="nl-val">Gemma-4 E2B IT UD-Q4_K_XL + vision projector</span>
                  </div>
                  <div className="nl-meta-col">
                    <span className="nl-lbl">大小:</span>
                    <span className="nl-val">3.9 GB</span>
                  </div>
                </div>
                <div className="nl-model-box-footer">
                  <button className="nl-btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                    ⬇ 下载
                  </button>
                </div>
              </div>

              {/* Card 3: 索引模型服务商 */}
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
                      onClick={() => setEmbeddingMode("local")}
                    >
                      本地
                    </button>
                    <button
                      className={`nl-mode-btn ${embeddingMode === "cloud" ? "active" : ""}`}
                      onClick={() => setEmbeddingMode("cloud")}
                    >
                      云端
                    </button>
                  </div>
                </div>
                <div className="nl-model-box-footer">
                  <span className="nl-status-current">
                    ✓ 当前 <strong>{embeddingMode === "local" ? "本地搜索 索引模型" : "云端 BAAI/bge-m3"}</strong>
                  </span>
                </div>
              </div>

              {/* Card 4: LLM 服务商 */}
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
                      onClick={() => setLlmMode("local")}
                    >
                      本地
                    </button>
                    <button
                      className={`nl-mode-btn ${llmMode === "cloud" ? "active" : ""}`}
                      onClick={() => setLlmMode("cloud")}
                    >
                      云端
                    </button>
                  </div>
                </div>
                <div className="nl-warning-callout">
                  ⚠️ 在 Windows 上，内置本地 LLM 目前默认走 CPU，可能会比较慢，也容易让设备发热。当前更推荐使用远程 LLM。
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

        {/* 2. 智能处理 (Smart Processing) Tab (Screenshot 2) */}
        {activeSubTab === "smart-processing" && (
          <div className="nl-set-panel">
            {/* Header with Switch */}
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

            {/* Background Work Status */}
            <div className="nl-card" style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <h3 style={{ fontSize: 14 }}>后台工作</h3>
                <span style={{ fontSize: 12, color: "#10b981" }}>空闲</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>
                当前没有任务在运行。新记忆、同步对话或定时计划需要处理时，会自动开始后台工作。
              </p>
            </div>

            {/* AI Token Usage Overview */}
            <div className="nl-card" style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 14 }}>AI 用量总览</h3>
                  <p style={{ fontSize: 12, color: "var(--nl-text-muted)", marginTop: 2 }}>
                    统计这台设备上的 Mem 实例上报的模型 token，并区分自动任务和你主动打开的 AI。限额只会暂停自动任务。
                  </p>
                </div>
                <button className="nl-btn-secondary" style={{ fontSize: 11, padding: "4px 8px" }}>
                  编辑限额
                </button>
              </div>

              <div className="nl-usage-stats-grid">
                <div className="nl-usage-col">
                  <span className="nl-usage-lbl">本月</span>
                  <span className="nl-usage-num">0 tokens</span>
                  <span className="nl-usage-sub">自动 0 · 你打开的 AI 0</span>
                </div>
                <div className="nl-usage-col">
                  <span className="nl-usage-lbl">总是 · 24 小时</span>
                  <span className="nl-usage-num">0 tokens</span>
                  <span className="nl-usage-sub">自动 0 · 你打开的 AI 0</span>
                </div>
                <div className="nl-usage-col">
                  <span className="nl-usage-lbl">总是 · 1 小时</span>
                  <span className="nl-usage-num">0 tokens</span>
                  <span className="nl-usage-sub">自动 0 · 你打开的 AI 0</span>
                </div>
                <div className="nl-usage-col">
                  <span className="nl-usage-lbl">主要消耗来源</span>
                  <span className="nl-usage-sub" style={{ marginTop: 8 }}>还没有记录到模型调用</span>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="nl-progress-group">
                <div className="nl-progress-row">
                  <span>本小时</span>
                  <span>0 / 5.0M</span>
                </div>
                <div className="nl-progress-bar"><div className="nl-progress-fill" style={{ width: "0%" }}></div></div>
              </div>

              <div className="nl-progress-group">
                <div className="nl-progress-row">
                  <span>24 小时</span>
                  <span>0 / 10M</span>
                </div>
                <div className="nl-progress-bar"><div className="nl-progress-fill" style={{ width: "0%" }}></div></div>
              </div>
            </div>

            {/* Run History List */}
            <div className="nl-card" style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ fontSize: 14 }}>运行历史</h3>
                <span style={{ fontSize: 12, color: "var(--nl-text-muted)" }}>查看 14 次运行 ▾</span>
              </div>

              <div className="nl-history-list">
                {[
                  { name: "技能维护", time: "38分钟前", status: "已完成 · 未使用 AI" },
                  { name: "标签整合", time: "38分钟前", status: "已完成 · 未使用 AI" },
                  { name: "Wiki Summary Writing", time: "38分钟前", status: "已跳过 · 无可处理内容" },
                  { name: "知识图谱同构", time: "38分钟前", status: "已完成 · 未使用 AI" },
                  { name: "Wiki 主题检测", time: "38分钟前", status: "已完成 · 未使用 AI" },
                ].map((item, idx) => (
                  <div key={idx} className="nl-history-row">
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "var(--nl-text-muted)", marginTop: 2 }}>
                        {item.time} · {item.status}
                      </div>
                    </div>
                    <span className="nl-tag-pill">未使用 AI ▾</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. 服务商 (Providers) Tab */}
        {activeSubTab === "providers" && (
          <div className="nl-set-panel">
            <h2>AI 服务商与 API 秘钥配置</h2>
            <p className="nl-set-desc">配置云端兼容 API（如硅基流动、DeepSeek、OpenAI、Gemini 等）。</p>

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
                    }
                  }}
                >
                  <option value="siliconflow">硅基流动 (SiliconFlow) - 推荐</option>
                  <option value="deepseek">DeepSeek 官方 API</option>
                  <option value="openai">OpenAI 官方</option>
                  <option value="custom">自定义 (OpenAI 兼容)</option>
                </select>
              </div>

              <div className="nl-form-group" style={{ marginBottom: 14 }}>
                <label>API Base URL</label>
                <input
                  type="text"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                />
              </div>

              <div className="nl-form-group" style={{ marginBottom: 14 }}>
                <label>API Key</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="nl-form-group" style={{ marginBottom: 16 }}>
                <label>Chat 模型名称</label>
                <input
                  type="text"
                  value={chatModel}
                  onChange={(e) => setChatModel(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
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
                  {isSaving ? "保存中..." : "保存设置"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Other Tabs Placeholder */}
        {["profile", "migration", "remote", "team", "preferences", "license", "about"].includes(activeSubTab) && (
          <div className="nl-set-panel">
            <h2>{activeSubTab.toUpperCase()}</h2>
            <div className="nl-card" style={{ marginTop: 16 }}>
              <p style={{ color: "var(--nl-text-muted)" }}>本地实例运行正常，数据全加密保存在本地 SQLite 中。</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
