import React, { useEffect, useState, useCallback } from "react";
import { fetchWorkingMemory, saveWorkingMemory, generateWorkingMemory, extractErrorMessage } from "../api/ArcRift";
import type { Session, WorkingMemory } from "../types";
import { useLocale } from "../context/LocaleContext";

interface Props {
  activeSession: Session | null;
  onRefreshSession?: () => void;
}

export default function WorkingMemoryView({ activeSession, onRefreshSession }: Props) {
  const { t } = useLocale();

  const [workingMemory, setWorkingMemory] = useState<WorkingMemory | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Editable fields
  const [briefing, setBriefing] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [activeDecisions, setActiveDecisions] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);

  // Input states for adding new items
  const [newFocus, setNewFocus] = useState("");
  const [newDecision, setNewDecision] = useState("");
  const [newBlocker, setNewBlocker] = useState("");

  const loadData = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWorkingMemory(sessionId);
      if (res.workingMemory) {
        setWorkingMemory(res.workingMemory);
        setBriefing(res.workingMemory.briefing || "");
        setFocusAreas(res.workingMemory.focusAreas || []);
        setActiveDecisions(res.workingMemory.activeDecisions || []);
        setBlockers(res.workingMemory.blockers || []);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSession?._id) {
      loadData(activeSession._id);
    } else {
      setWorkingMemory(null);
      setBriefing("");
      setFocusAreas([]);
      setActiveDecisions([]);
      setBlockers([]);
    }
  }, [activeSession?._id, loadData]);

  const handleGenerate = async () => {
    if (!activeSession?._id) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await generateWorkingMemory(activeSession._id);
      if (res.workingMemory) {
        setWorkingMemory(res.workingMemory);
        setBriefing(res.workingMemory.briefing || "");
        setFocusAreas(res.workingMemory.focusAreas || []);
        setActiveDecisions(res.workingMemory.activeDecisions || []);
        setBlockers(res.workingMemory.blockers || []);
        setSuccessMessage("AI 已成功自动提炼最新工作记忆简报！");
        setTimeout(() => setSuccessMessage(null), 3000);
        onRefreshSession?.();
      }
    } catch (err) {
      setError(`AI 生成简报失败: ${extractErrorMessage(err)}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!activeSession?._id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await saveWorkingMemory(activeSession._id, {
        briefing: briefing.trim(),
        focusAreas,
        activeDecisions,
        blockers,
      });
      if (res.workingMemory) {
        setWorkingMemory(res.workingMemory);
        setSuccessMessage(t.common.success || "工作记忆已保存");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError(`保存失败: ${extractErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyForAgent = () => {
    if (!activeSession) return;
    const focusStr = focusAreas.length > 0 ? focusAreas.map(f => `- ${f}`).join("\n") : "- 正常推进中";
    const decisionsStr = activeDecisions.length > 0 ? activeDecisions.map(d => `- ${d}`).join("\n") : "- 遵循现有架构规范";
    const blockersStr = blockers.length > 0 ? blockers.map(b => `- ${b}`).join("\n") : "- 无阻塞风险";

    const promptText = `<WORKING_MEMORY project="${activeSession.projectName}">
# 🧠 项目工作记忆 (Working Memory): ${activeSession.projectName}

## 📋 今日工作简报 (Executive Briefing)
${briefing || "暂无简报正文"}

## 🎯 当前聚焦重点 (Focus Areas)
${focusStr}

## 🏛️ 核心架构决策 (Active Decisions)
${decisionsStr}

## ⚠️ 阻塞点与避坑备忘 (Blockers & Gotchas)
${blockersStr}
</WORKING_MEMORY>`;

    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setSuccessMessage(t.workingMemory.copySuccess);
    setTimeout(() => {
      setCopied(false);
      setSuccessMessage(null);
    }, 3000);
  };

  const handleAddFocus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFocus.trim()) return;
    setFocusAreas([...focusAreas, newFocus.trim()]);
    setNewFocus("");
  };

  const handleRemoveFocus = (index: number) => {
    setFocusAreas(focusAreas.filter((_, i) => i !== index));
  };

  const handleAddDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDecision.trim()) return;
    setActiveDecisions([...activeDecisions, newDecision.trim()]);
    setNewDecision("");
  };

  const handleRemoveDecision = (index: number) => {
    setActiveDecisions(activeDecisions.filter((_, i) => i !== index));
  };

  const handleAddBlocker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlocker.trim()) return;
    setBlockers([...blockers, newBlocker.trim()]);
    setNewBlocker("");
  };

  const handleRemoveBlocker = (index: number) => {
    setBlockers(blockers.filter((_, i) => i !== index));
  };

  if (!activeSession) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>
        <p>{t.sidebar.noSessions}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)" }}>
        <p>⏳ {t.common.loading}</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, height: "100%", overflowY: "auto", padding: "28px 36px", background: "var(--bg-main)", color: "var(--text-primary)" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <span style={{ fontSize: "24px" }}>🧠</span>
            <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
              {t.workingMemory.title}
            </h1>
            <span style={{
              fontSize: "12px",
              padding: "3px 10px",
              borderRadius: "20px",
              background: "rgba(255, 107, 0, 0.15)",
              color: "var(--primary)",
              border: "1px solid rgba(255, 107, 0, 0.3)",
              fontWeight: 600
            }}>
              {activeSession.projectName}
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            {t.workingMemory.subtitle}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="glow-btn"
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: 700,
              background: "linear-gradient(135deg, #FF6B00 0%, #FF8800 100%)",
              color: "#fff",
              border: "none",
              cursor: generating ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 14px rgba(255, 107, 0, 0.35)",
              opacity: generating ? 0.7 : 1,
              transition: "all 0.2s ease",
            }}
          >
            <span>{generating ? "⏳" : "✨"}</span>
            {generating ? t.workingMemory.generating : t.workingMemory.generateBtn}
          </button>

          <button
            type="button"
            onClick={handleCopyForAgent}
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: 600,
              background: "rgba(255, 255, 255, 0.06)",
              color: copied ? "#2ecc71" : "var(--text-primary)",
              border: "1px solid var(--border-main)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s ease"
            }}
          >
            <span>{copied ? "✓" : "📋"}</span>
            {t.workingMemory.copyForAgent}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: 600,
              background: "rgba(255, 255, 255, 0.12)",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              cursor: saving ? "not-allowed" : "pointer",
              transition: "all 0.2s ease"
            }}
          >
            {saving ? t.workingMemory.saving : t.workingMemory.saveBtn}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(235, 87, 87, 0.12)", border: "1px solid rgba(235, 87, 87, 0.3)", color: "#ff6b6b", marginBottom: "18px", fontSize: "13px" }}>
          ⚠️ {error}
        </div>
      )}

      {successMessage && (
        <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(46, 204, 113, 0.12)", border: "1px solid rgba(46, 204, 113, 0.3)", color: "#2ecc71", marginBottom: "18px", fontSize: "13px" }}>
          ✓ {successMessage}
        </div>
      )}

      {/* Executive Briefing Section */}
      <div style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border-main)",
        borderRadius: "14px",
        padding: "22px 24px",
        marginBottom: "24px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            {t.workingMemory.dailyBriefing}
          </h2>
          {workingMemory?.updatedAt && (
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {t.workingMemory.lastGenerated} {new Date(workingMemory.updatedAt).toLocaleString()}
            </span>
          )}
        </div>

        <textarea
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          placeholder={t.workingMemory.placeholderBriefing}
          rows={4}
          style={{
            width: "100%",
            background: "rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border-main)",
            borderRadius: "10px",
            padding: "14px 16px",
            color: "var(--text-primary)",
            fontSize: "14px",
            lineHeight: "1.6",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit"
          }}
        />
      </div>

      {/* 3-Column Working Memory Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "20px"
      }}>
        {/* 1. Focus Areas (今日聚焦重点) */}
        <div style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-main)",
          borderRadius: "14px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "6px", color: "var(--primary)" }}>
              {t.workingMemory.focusAreas}
            </h3>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(255, 107, 0, 0.15)", color: "var(--primary)", fontWeight: 700 }}>
              {focusAreas.length}
            </span>
          </div>

          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: "120px" }}>
            {focusAreas.length === 0 ? (
              <div style={{ color: "var(--text-secondary)", fontSize: "12px", fontStyle: "italic", padding: "16px 0" }}>
                {t.workingMemory.emptyFocus}
              </div>
            ) : (
              focusAreas.map((item, idx) => (
                <div key={idx} style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  fontSize: "13px",
                  lineHeight: "1.4"
                }}>
                  <span style={{ color: "var(--primary)", marginTop: "2px" }}>•</span>
                  <span style={{ flex: 1 }}>{item}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFocus(idx)}
                    style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "0 4px", fontSize: "14px" }}
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add input */}
          <form onSubmit={handleAddFocus} style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
            <input
              type="text"
              value={newFocus}
              onChange={(e) => setNewFocus(e.target.value)}
              placeholder="+ 添加聚焦事项..."
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-main)",
                color: "#fff",
                fontSize: "12px",
                outline: "none"
              }}
            />
            <button
              type="submit"
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#fff",
                border: "1px solid var(--border-main)",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              添加
            </button>
          </form>
        </div>

        {/* 2. Active Decisions (进行中架构决策) */}
        <div style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-main)",
          borderRadius: "14px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "6px", color: "#4ECDC4" }}>
              {t.workingMemory.activeDecisions}
            </h3>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(78, 205, 196, 0.15)", color: "#4ECDC4", fontWeight: 700 }}>
              {activeDecisions.length}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: "120px" }}>
            {activeDecisions.length === 0 ? (
              <div style={{ color: "var(--text-secondary)", fontSize: "12px", fontStyle: "italic", padding: "16px 0" }}>
                {t.workingMemory.emptyDecisions}
              </div>
            ) : (
              activeDecisions.map((item, idx) => (
                <div key={idx} style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  fontSize: "13px",
                  lineHeight: "1.4"
                }}>
                  <span style={{ color: "#4ECDC4", marginTop: "2px" }}>🏛️</span>
                  <span style={{ flex: 1 }}>{item}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDecision(idx)}
                    style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "0 4px", fontSize: "14px" }}
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddDecision} style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
            <input
              type="text"
              value={newDecision}
              onChange={(e) => setNewDecision(e.target.value)}
              placeholder="+ 记录架构/技术决策..."
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-main)",
                color: "#fff",
                fontSize: "12px",
                outline: "none"
              }}
            />
            <button
              type="submit"
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#fff",
                border: "1px solid var(--border-main)",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              添加
            </button>
          </form>
        </div>

        {/* 3. Blockers & Gotchas (阻塞点与避坑备忘) */}
        <div style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-main)",
          borderRadius: "14px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "6px", color: "#FF6B6B" }}>
              {t.workingMemory.blockers}
            </h3>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(255, 107, 107, 0.15)", color: "#FF6B6B", fontWeight: 700 }}>
              {blockers.length}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: "120px" }}>
            {blockers.length === 0 ? (
              <div style={{ color: "var(--text-secondary)", fontSize: "12px", fontStyle: "italic", padding: "16px 0" }}>
                {t.workingMemory.emptyBlockers}
              </div>
            ) : (
              blockers.map((item, idx) => (
                <div key={idx} style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "rgba(255, 107, 107, 0.06)",
                  border: "1px solid rgba(255, 107, 107, 0.15)",
                  fontSize: "13px",
                  lineHeight: "1.4"
                }}>
                  <span style={{ color: "#FF6B6B", marginTop: "2px" }}>⚠️</span>
                  <span style={{ flex: 1 }}>{item}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBlocker(idx)}
                    style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "0 4px", fontSize: "14px" }}
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddBlocker} style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
            <input
              type="text"
              value={newBlocker}
              onChange={(e) => setNewBlocker(e.target.value)}
              placeholder="+ 添加避坑/阻塞风险..."
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-main)",
                color: "#fff",
                fontSize: "12px",
                outline: "none"
              }}
            />
            <button
              type="submit"
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#fff",
                border: "1px solid var(--border-main)",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              添加
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
