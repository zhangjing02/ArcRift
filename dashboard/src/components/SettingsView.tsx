import React, { useEffect, useState, useMemo } from "react";
import { fetchSettings, updateSettings, testSettingsConnection, extractErrorMessage, fetchSessions } from "../api/ArcRift";
import { PROVIDER_LIST, type ProviderInfo } from "../constants/locales";
import { useLocale } from "../context/LocaleContext";

const SettingsView: React.FC = () => {
  const { t, locale } = useLocale();
  const [activeTab, setActiveTab] = useState<"config" | "analytics">("config");
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Form State
  const [selectedProviderId, setSelectedProviderId] = useState<string>("siliconflow");
  const [apiBaseUrl, setApiBaseUrl] = useState("https://api.siliconflow.cn/v1");
  const [apiKey, setApiKey] = useState("");
  const [activeExtractionModel, setActiveExtractionModel] = useState("deepseek-ai/DeepSeek-V3");
  const [activeEmbeddingModel, setActiveEmbeddingModel] = useState("BAAI/bge-large-zh-v1.5");
  const [customExtractionModel, setCustomExtractionModel] = useState("");
  const [customEmbeddingModel, setCustomEmbeddingModel] = useState("");
  const [isCustomExtraction, setIsCustomExtraction] = useState(false);
  const [isCustomEmbedding, setIsCustomEmbedding] = useState(false);
  const [contextMode, setContextMode] = useState<"raw" | "summarized">("raw");

  // System & Ollama status
  const [ollamaReachable, setOllamaReachable] = useState(false);
  const [availableLocalModels, setAvailableLocalModels] = useState<string[]>([]);

  // Original saved state for dirty tracking
  const [originalSettings, setOriginalSettings] = useState({
    chatProvider: "siliconflow",
    apiBaseUrl: "https://api.siliconflow.cn/v1",
    apiKey: "",
    extraction: "deepseek-ai/DeepSeek-V3",
    embedding: "BAAI/bge-large-zh-v1.5",
    contextMode: "raw",
  });

  const [saving, setSaving] = useState(false);

  const currentProvider: ProviderInfo = useMemo(() => {
    return PROVIDER_LIST.find((p) => p.id === selectedProviderId) || PROVIDER_LIST[0];
  }, [selectedProviderId]);

  const loadSettingsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSettings();
      setOllamaReachable(data.ollamaReachable);
      setAvailableLocalModels(data.availableModels || []);

      const provider = data.chatProvider || (data.ollamaReachable ? "ollama" : "siliconflow");
      setSelectedProviderId(provider);

      const baseUrl = data.apiBaseUrl || "https://api.siliconflow.cn/v1";
      setApiBaseUrl(baseUrl);
      setApiKey(data.apiKey || "");

      const extractionModel = data.chatModel || data.activeExtractionModel || "deepseek-ai/DeepSeek-V3";
      setActiveExtractionModel(extractionModel);

      const embeddingModel = data.embeddingModel || data.activeEmbeddingModel || "BAAI/bge-large-zh-v1.5";
      setActiveEmbeddingModel(embeddingModel);

      const fetchedMode = data.contextMode === "summarized" ? "summarized" : "raw";
      setContextMode(fetchedMode);

      setOriginalSettings({
        chatProvider: provider,
        apiBaseUrl: baseUrl,
        apiKey: data.apiKey || "",
        extraction: extractionModel,
        embedding: embeddingModel,
        contextMode: fetchedMode,
      });

      const sessionData = await fetchSessions();
      setSessions(sessionData.sessions || []);
    } catch (err) {
      setError(`${t.settings.saveFailed} ${extractErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  // Handle provider switch
  const handleSelectProvider = (prov: ProviderInfo) => {
    setSelectedProviderId(prov.id);
    setApiBaseUrl(prov.chatBaseUrl);
    
    // Set default models if current model not in provider list
    if (!prov.chatModels.includes(activeExtractionModel)) {
      setActiveExtractionModel(prov.defaultChatModel);
      setIsCustomExtraction(false);
    }
    if (!prov.embeddingModels.includes(activeEmbeddingModel)) {
      setActiveEmbeddingModel(prov.defaultEmbeddingModel);
      setIsCustomEmbedding(false);
    }

    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);

    const effectiveExtraction = isCustomExtraction ? customExtractionModel.trim() : activeExtractionModel;
    const effectiveEmbedding = isCustomEmbedding ? customEmbeddingModel.trim() : activeEmbeddingModel;

    try {
      const res = await testSettingsConnection({
        provider: selectedProviderId,
        baseUrl: apiBaseUrl.trim(),
        apiKey: apiKey.trim(),
        model: effectiveExtraction,
        embeddingModel: effectiveEmbedding,
      });
      if (res.success) {
        setTestResult({ success: true, message: res.message || t.settings.testSuccess });
      } else {
        setTestResult({ success: false, message: res.error || t.settings.testFailed });
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || t.settings.testFailed;
      setTestResult({ success: false, message: `${t.settings.testFailed} ${msg}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    setTestResult(null);

    const effectiveExtraction = isCustomExtraction ? customExtractionModel.trim() : activeExtractionModel;
    const effectiveEmbedding = isCustomEmbedding ? customEmbeddingModel.trim() : activeEmbeddingModel;

    try {
      await updateSettings({
        chatProvider: selectedProviderId,
        apiBaseUrl: apiBaseUrl.trim(),
        apiKey: apiKey.trim(),
        chatModel: effectiveExtraction,
        embeddingModel: effectiveEmbedding,
        activeExtractionModel: effectiveExtraction,
        activeEmbeddingModel: effectiveEmbedding,
        contextMode,
      });

      setOriginalSettings({
        chatProvider: selectedProviderId,
        apiBaseUrl: apiBaseUrl.trim(),
        apiKey: apiKey.trim(),
        extraction: effectiveExtraction,
        embedding: effectiveEmbedding,
        contextMode,
      });

      setSuccessMessage(t.settings.saveSuccess);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      setError(`${t.settings.saveFailed} ${extractErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const effectiveExtraction = isCustomExtraction ? customExtractionModel.trim() : activeExtractionModel;
  const effectiveEmbedding = isCustomEmbedding ? customEmbeddingModel.trim() : activeEmbeddingModel;

  const hasUnsavedChanges =
    selectedProviderId !== originalSettings.chatProvider ||
    apiBaseUrl.trim() !== originalSettings.apiBaseUrl ||
    apiKey.trim() !== originalSettings.apiKey ||
    effectiveExtraction !== originalSettings.extraction ||
    effectiveEmbedding !== originalSettings.embedding ||
    contextMode !== originalSettings.contextMode;

  const totalTokensSaved = useMemo(() => sessions.reduce((sum, s) => sum + (s.tokensSaved || 0), 0), [sessions]);
  const totalRetrievals = useMemo(() => sessions.reduce((sum, s) => sum + (s.retrievalCount || 0), 0), [sessions]);
  const costSaved = ((totalTokensSaved / 1000000) * 3.0).toFixed(4);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px", color: "var(--text-secondary)" }}>
        <div className="processing-dot" style={{ width: "16px", height: "16px", marginBottom: "16px" }} />
        <span>{t.common.loading}</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "880px", margin: "90px auto 50px auto", padding: "0 24px" }}>
      {/* Header Card */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border-main)", borderRadius: "16px", backdropFilter: "var(--surface-blur)", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "26px", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: "4px" }}>
              {t.settings.title}
            </h1>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5", margin: 0 }}>
              {t.settings.desc}
            </p>
          </div>
          <button onClick={loadSettingsData} className="action-btn" title={t.settings.refreshBtn} style={{ padding: "8px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        </div>

        {/* AI Service Status Pill */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.25)", padding: "6px 14px", borderRadius: "20px", border: "1px solid var(--border-dim)", fontSize: "12px", marginTop: "6px" }}>
          <span className={`health-indicator ${ollamaReachable || apiKey ? "green" : "red"}`} style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", boxShadow: (ollamaReachable || apiKey) ? "0 0 8px #10B981" : "0 0 8px #EF4444" }} />
          <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{t.settings.connectionStatus}</span>
          <span style={{ color: (ollamaReachable || apiKey) ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
            {(ollamaReachable || apiKey) ? t.settings.statusOnline : t.settings.statusOffline}
          </span>
          <span style={{ opacity: 0.4, margin: "0 4px" }}>|</span>
          <span style={{ color: "var(--text-dim)", fontSize: "11px" }}>
            {currentProvider.name}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("config")}
          style={{
            padding: "10px 22px", borderRadius: "10px", fontSize: "14px", fontWeight: 700,
            background: activeTab === "config" ? "var(--primary)" : "transparent",
            color: activeTab === "config" ? "#fff" : "var(--text-secondary)",
            border: activeTab === "config" ? "1px solid transparent" : "1px solid var(--border-main)",
            cursor: "pointer", transition: "all 0.2s"
          }}
        >
          {t.settings.tabs.config}
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          style={{
            padding: "10px 22px", borderRadius: "10px", fontSize: "14px", fontWeight: 700,
            background: activeTab === "analytics" ? "var(--primary)" : "transparent",
            color: activeTab === "analytics" ? "#fff" : "var(--text-secondary)",
            border: activeTab === "analytics" ? "1px solid transparent" : "1px solid var(--border-main)",
            cursor: "pointer", transition: "all 0.2s"
          }}
        >
          {t.settings.tabs.analytics}
        </button>
      </div>

      {activeTab === "config" ? (
        <form onSubmit={handleSave} style={{ background: "var(--surface)", border: "1px solid var(--border-main)", borderRadius: "16px", backdropFilter: "var(--surface-blur)", padding: "32px", display: "flex", flexDirection: "column", gap: "26px" }}>
          
          {/* Preset Provider Selector Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>
                {t.settings.providerSectionTitle}
              </label>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                {t.settings.providerSectionDesc}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
              {PROVIDER_LIST.map((prov) => {
                const isSelected = selectedProviderId === prov.id;
                return (
                  <div
                    key={prov.id}
                    onClick={() => handleSelectProvider(prov)}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "12px",
                      background: isSelected ? "rgba(99, 102, 241, 0.12)" : "rgba(255, 255, 255, 0.02)",
                      border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--border-dim)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: isSelected ? "var(--primary)" : "var(--text-primary)" }}>
                        {prov.name}
                      </span>
                      {isSelected && (
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--primary)", boxShadow: "0 0 8px var(--primary)" }} />
                      )}
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                      {locale === "zh" ? prov.descZh : prov.descEn}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* API Base URL */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
              {t.settings.baseUrlLabel}
            </label>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
              {t.settings.baseUrlDesc}
            </p>
            <input
              type="text"
              className="search-input"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://api.siliconflow.cn/v1"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "10px",
                fontSize: "14px",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-main)",
                color: "#fff",
                outline: "none"
              }}
            />
          </div>

          {/* API Key */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                {t.settings.apiKeyLabel}
              </label>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: "12px", cursor: "pointer", fontWeight: 600, padding: 0 }}
              >
                {showApiKey ? t.settings.hideKey : t.settings.showKey}
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
              {t.settings.apiKeyDesc}
            </p>
            <div style={{ position: "relative" }}>
              <input
                type={showApiKey ? "text" : "password"}
                className="search-input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selectedProviderId === "ollama" ? "Ollama 本地无需 API Key (可留空)" : t.settings.apiKeyPlaceholder}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid var(--border-main)",
                  color: "#fff",
                  outline: "none"
                }}
              />
            </div>
          </div>

          {/* Extraction Model Config */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                {t.settings.extractionLabel}
              </label>
              <button
                type="button"
                onClick={() => setIsCustomExtraction(!isCustomExtraction)}
                style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
              >
                {isCustomExtraction ? "← 选择预设模型" : "+ 自定义模型输入"}
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
              {t.settings.extractionDesc}
            </p>

            {isCustomExtraction ? (
              <input
                type="text"
                className="search-input"
                value={customExtractionModel}
                onChange={(e) => setCustomExtractionModel(e.target.value)}
                placeholder={t.settings.customModelPlaceholder}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid var(--border-main)",
                  color: "#fff",
                  outline: "none"
                }}
              />
            ) : (
              <select
                className="settings-select"
                value={activeExtractionModel}
                onChange={(e) => setActiveExtractionModel(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid var(--border-main)",
                  color: "#fff",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {selectedProviderId === "ollama" && availableLocalModels.length > 0
                  ? availableLocalModels.map((m) => (
                      <option key={m} value={m}>
                        {m} (本地已拉取)
                      </option>
                    ))
                  : currentProvider.chatModels.map((m) => (
                      <option key={m} value={m}>
                        {m} {m === currentProvider.defaultChatModel ? `(推荐)` : ""}
                      </option>
                    ))}
              </select>
            )}
          </div>

          {/* Embedding Model Config */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                {t.settings.embeddingLabel}
              </label>
              <button
                type="button"
                onClick={() => setIsCustomEmbedding(!isCustomEmbedding)}
                style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
              >
                {isCustomEmbedding ? "← 选择推荐模型" : "+ 自定义向量模型"}
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
              {t.settings.embeddingDesc}
            </p>

            {isCustomEmbedding ? (
              <input
                type="text"
                className="search-input"
                value={customEmbeddingModel}
                onChange={(e) => setCustomEmbeddingModel(e.target.value)}
                placeholder="例如: BAAI/bge-large-zh-v1.5 或 text-embedding-3-small"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid var(--border-main)",
                  color: "#fff",
                  outline: "none"
                }}
              />
            ) : (
              <select
                className="settings-select"
                value={activeEmbeddingModel}
                onChange={(e) => setActiveEmbeddingModel(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid var(--border-main)",
                  color: "#fff",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {currentProvider.embeddingModels.map((m) => (
                  <option key={m} value={m}>
                    {m} {m === currentProvider.defaultEmbeddingModel ? `(推荐)` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Context Injection Mode Config */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
              {t.settings.contextModeLabel}
            </label>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
              {t.settings.contextModeDesc}
            </p>
            <select
              className="settings-select"
              value={contextMode}
              onChange={(e) => setContextMode(e.target.value as "raw" | "summarized")}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "10px",
                fontSize: "14px",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-main)",
                color: "#fff",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="raw">{t.settings.modeRaw}</option>
              <option value="summarized">{t.settings.modeSummarized}</option>
            </select>
          </div>

          {/* Test Result Message Box */}
          {testResult && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: testResult.success ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                border: testResult.success ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                color: testResult.success ? "var(--success)" : "var(--danger)"
              }}
            >
              <span>{testResult.success ? "✓" : "⚠"}</span>
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Action Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-main)", paddingTop: "24px", marginTop: "6px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {error && <span style={{ color: "var(--danger)", fontSize: "13px", fontWeight: 600 }}>{error}</span>}
              {successMessage && <span style={{ color: "var(--success)", fontSize: "13px", fontWeight: 600 }}>{successMessage}</span>}
              {!error && !successMessage && hasUnsavedChanges && (
                <span style={{ color: "var(--primary)", fontSize: "12px", fontWeight: 500 }}>{t.settings.unsavedAlert}</span>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              {/* Test Connection Button */}
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                style={{
                  padding: "12px 20px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: testing ? "not-allowed" : "pointer",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s"
                }}
              >
                {testing ? (
                  <>
                    <div className="processing-dot" style={{ width: "8px", height: "8px" }} />
                    <span>{t.settings.testingBtn}</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>{t.settings.testBtn}</span>
                  </>
                )}
              </button>

              {/* Save Button */}
              <button
                type="submit"
                disabled={!hasUnsavedChanges || saving}
                style={{
                  padding: "12px 28px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: hasUnsavedChanges && !saving ? "pointer" : "not-allowed",
                  background: hasUnsavedChanges ? "var(--primary)" : "rgba(255,255,255,0.05)",
                  color: hasUnsavedChanges ? "white" : "var(--text-dim)",
                  border: hasUnsavedChanges ? "1px solid transparent" : "1px solid var(--border-dim)",
                  boxShadow: hasUnsavedChanges ? "0 0 15px var(--primary-glow)" : "none",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: hasUnsavedChanges && !saving ? "scale(1.02)" : "scale(1)"
                }}
              >
                {saving ? t.settings.savingBtn : t.settings.saveBtn}
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* Analytics Tab */
        <div style={{ background: "var(--surface)", border: "1px solid var(--border-main)", borderRadius: "16px", backdropFilter: "var(--surface-blur)", padding: "32px", display: "flex", flexDirection: "column", gap: "28px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              {t.settings.analytics.title}
            </h2>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              {t.settings.analytics.desc}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            {/* Stat Card 1 */}
            <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-dim)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {t.settings.analytics.statSavedTitle}
              </div>
              <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--primary)", lineHeight: 1 }}>
                {totalTokensSaved.toLocaleString()}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                {t.settings.analytics.statSavedDesc}
              </div>
            </div>

            {/* Stat Card 2 */}
            <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-dim)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {t.settings.analytics.statCostTitle}
              </div>
              <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--success)", lineHeight: 1 }}>
                ${costSaved}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                {t.settings.analytics.statCostDesc}
              </div>
            </div>

            {/* Stat Card 3 */}
            <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-dim)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {t.settings.analytics.statRetrievalsTitle}
              </div>
              <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                {totalRetrievals.toLocaleString()}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                {t.settings.analytics.statRetrievalsDesc}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
