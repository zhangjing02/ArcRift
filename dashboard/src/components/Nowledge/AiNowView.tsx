import React, { useState, useEffect } from "react";
import type { Session, WorkingMemory } from "../../types";
import { getWorkingMemory, saveWorkingMemory, generateWorkingMemory } from "../../api/ArcRift";

interface AiNowViewProps {
  activeSession?: Session;
}

export const AiNowView: React.FC<AiNowViewProps> = ({ activeSession }) => {
  const [wm, setWm] = useState<WorkingMemory | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [briefing, setBriefing] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [activeDecisions, setActiveDecisions] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    loadWorkingMemory();
  }, [activeSession?._id]);

  const loadWorkingMemory = async () => {
    if (!activeSession?._id) return;
    try {
      const res = await getWorkingMemory(activeSession._id);
      if (res.success && res.workingMemory) {
        setWm(res.workingMemory);
        setBriefing(res.workingMemory.briefing);
        setFocusAreas(res.workingMemory.focusAreas || []);
        setActiveDecisions(res.workingMemory.activeDecisions || []);
        setBlockers(res.workingMemory.blockers || []);
      }
    } catch (err) {
      console.error("Failed to load working memory", err);
    }
  };

  const handleGenerate = async () => {
    if (!activeSession?._id || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await generateWorkingMemory(activeSession._id);
      if (res.success && res.workingMemory) {
        setWm(res.workingMemory);
        setBriefing(res.workingMemory.briefing);
        setFocusAreas(res.workingMemory.focusAreas || []);
        setActiveDecisions(res.workingMemory.activeDecisions || []);
        setBlockers(res.workingMemory.blockers || []);
      }
    } catch (err) {
      console.error("Failed to auto-generate working memory", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!activeSession?._id || isSaving) return;
    setIsSaving(true);
    try {
      const res = await saveWorkingMemory(activeSession._id, {
        briefing,
        focusAreas,
        activeDecisions,
        blockers,
      });
      if (res.success && res.workingMemory) {
        setWm(res.workingMemory);
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Failed to save working memory", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyForAgent = () => {
    const text = `# ${activeSession?.projectName || "Project"} - AI Working Memory Briefing
${briefing}

## 🎯 当前焦点与待办 (Focus Areas)
${focusAreas.map((f) => `- ${f}`).join("\n") || "暂无"}

## ⚖️ 活跃技术决策 (Active Decisions)
${activeDecisions.map((d) => `- ${d}`).join("\n") || "暂无"}

## ⚠️ 阻塞与避坑注意 (Blockers & Gotchas)
${blockers.map((b) => `- ${b}`).join("\n") || "无阻碍"}`;

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="nl-ainow-view">
      {/* Header */}
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">
            <span style={{ color: "#38bdf8", marginRight: 8 }}>❇️</span>
            AI Now · 今日工作记忆
          </h1>
          <p className="nl-view-subtitle">
            项目《{activeSession?.projectName || "默认项目"}》的高信号状态晨报与上下文快照
          </p>
        </div>

        <div className="nl-view-actions">
          <button
            className="nl-btn-secondary"
            onClick={handleCopyForAgent}
            title="复制给 AI Agent"
          >
            {copySuccess ? "✓ 已复制到剪贴板" : "📋 复制给 Agent"}
          </button>
          <button
            className="nl-btn-primary"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? "✨ 正在生成简报..." : "✨ AI 自动提炼简报"}
          </button>
          {isEditing ? (
            <button
              className="nl-btn-success"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "保存中..." : "💾 保存修改"}
            </button>
          ) : (
            <button
              className="nl-btn-secondary"
              onClick={() => setIsEditing(true)}
            >
              ✏️ 编辑
            </button>
          )}
        </div>
      </div>

      {/* Briefing Executive Summary Card */}
      <div className="nl-briefing-card">
        <div className="nl-briefing-header">
          <span className="nl-briefing-icon">📌</span>
          <h3>项目态势速览 (Executive Briefing)</h3>
          {wm?.lastGeneratedAt && (
            <span className="nl-briefing-time">
              更新于 {new Date(wm.lastGeneratedAt).toLocaleString()}
            </span>
          )}
        </div>
        {isEditing ? (
          <textarea
            className="nl-briefing-textarea"
            rows={4}
            value={briefing}
            onChange={(e) => setBriefing(e.target.value)}
          />
        ) : (
          <div className="nl-briefing-text">
            {briefing || "暂无工作记忆简报。点击右上角「AI 自动提炼简报」即可一键生成！"}
          </div>
        )}
      </div>

      {/* 3 Pillars Grid */}
      <div className="nl-pillars-grid">
        {/* Focus Areas */}
        <div className="nl-pillar-card">
          <div className="nl-pillar-header">
            <span className="nl-pillar-icon" style={{ color: "#38bdf8" }}>🎯</span>
            <h4>当前核心焦点 (Focus Areas)</h4>
          </div>
          <div className="nl-pillar-body">
            {focusAreas.length === 0 ? (
              <div className="nl-pillar-empty">暂无焦点项</div>
            ) : (
              <ul className="nl-pillar-list">
                {focusAreas.map((item, idx) => (
                  <li key={idx} className="nl-pillar-item">
                    <span className="nl-item-dot"></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Active Decisions */}
        <div className="nl-pillar-card">
          <div className="nl-pillar-header">
            <span className="nl-pillar-icon" style={{ color: "#a855f7" }}>⚖️</span>
            <h4>活跃决策与约定 (Active Decisions)</h4>
          </div>
          <div className="nl-pillar-body">
            {activeDecisions.length === 0 ? (
              <div className="nl-pillar-empty">暂无记录的决策</div>
            ) : (
              <ul className="nl-pillar-list">
                {activeDecisions.map((item, idx) => (
                  <li key={idx} className="nl-pillar-item">
                    <span className="nl-item-dot" style={{ background: "#a855f7" }}></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Blockers & Gotchas */}
        <div className="nl-pillar-card">
          <div className="nl-pillar-header">
            <span className="nl-pillar-icon" style={{ color: "#ef4444" }}>⚠️</span>
            <h4>阻塞与避坑注意 (Blockers)</h4>
          </div>
          <div className="nl-pillar-body">
            {blockers.length === 0 ? (
              <div className="nl-pillar-empty" style={{ color: "#10b981" }}>✓ 目前无已知阻塞</div>
            ) : (
              <ul className="nl-pillar-list">
                {blockers.map((item, idx) => (
                  <li key={idx} className="nl-pillar-item">
                    <span className="nl-item-dot" style={{ background: "#ef4444" }}></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
