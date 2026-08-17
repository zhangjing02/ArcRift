import React, { useState } from "react";

interface SkillItem {
  id: string;
  name: string;
  description: string;
  trigger: string;
  steps: string;
  enabled: boolean;
  tools: string[];
}

export const SkillsView: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({
  onNavigateTab,
}) => {
  const [skills, setSkills] = useState<SkillItem[]>([
    {
      id: "skill_1",
      name: "BeBeBus OTA 升级接口规范与错误码排查",
      description: "确保所有 OTA 升级请求使用 POST Body 传参，并自动拦截 12/8 硬件错误码",
      trigger: "当修改 OTA 升级逻辑、接口传参或处理设备 MQTT 进度上报时",
      steps: "1. 接口必须调用 postBodyAsync 将 deviceId 封装为 JSON Body。\n2. 解析 MQTT cmd=2020 返回的 errorCode，对 12/8 进行即时状态流转。\n3. 杜绝 15s 假成功超时等待。",
      enabled: true,
      tools: ["Antigravity", "Gemini CLI", "Cursor"],
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillDesc, setNewSkillDesc] = useState("");
  const [newSkillTrigger, setNewSkillTrigger] = useState("");
  const [newSkillSteps, setNewSkillSteps] = useState("");

  // Assistant Widget states
  const [assistantMinimized, setAssistantMinimized] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<
    { role: "assistant" | "user"; text: string }[]
  >([
    {
      role: "assistant",
      text: "跟我说一种你的工作方式，我就把它变成你的 AI 会遵循的技能。或者打开这里任意一个技能，我来帮你打磨或用起来。",
    },
  ]);

  // Dropdowns in tool card
  const [showOtherTools, setShowOtherTools] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const handleCreateSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;

    const newSkill: SkillItem = {
      id: `skill_${Date.now()}`,
      name: newSkillName,
      description: newSkillDesc || "自定义开发规范技能",
      trigger: newSkillTrigger || "智能体自动匹配",
      steps: newSkillSteps || "遵循既定最佳实践规范",
      enabled: true,
      tools: ["Antigravity", "Gemini CLI", "Cursor"],
    };

    setSkills([newSkill, ...skills]);
    setIsModalOpen(false);
    setNewSkillName("");
    setNewSkillDesc("");
    setNewSkillTrigger("");
    setNewSkillSteps("");
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
          text: `收到！我已经为你梳理出技能草稿「${userMsg.slice(0, 20)}...」，包含触发规则与标准执行流程。你可以点击左侧「+ 描述你的第一个技能」将其保存到你的工具生态中！`,
        },
      ]);
    }, 700);
  };

  return (
    <div className="nl-skills-page-container">
      {/* Header (1:1 with Screenshot) */}
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">技能</h1>
          <p className="nl-view-subtitle">从你的经验中提炼出的可复用流程</p>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="nl-skills-content-scroll">
        {/* Hero Banner Area (1:1) */}
        <div className="nl-skills-hero">
          <h2 className="nl-hero-title">教你的 AI 照你的方式做事</h2>
          <p className="nl-hero-desc">
            描述一种你的做事方式：你怎么发布一次版本、怎么审一个 PR、怎么报一张表。Mem 会把它变成技能，让你的 AI 在你连接的每个工具里都照着做。
          </p>

          <div className="nl-hero-actions">
            <button
              className="nl-btn-primary"
              onClick={() => setIsModalOpen(true)}
            >
              ＋ 描述你的第一个技能
            </button>
            <button
              className="nl-btn-secondary"
              onClick={() => alert("支持导入 SKILL.md 或 YAML 技能定义文件")}
            >
              📥 导入你已经写好的
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

        {/* Active Skills List (if any) */}
        {skills.length > 0 && (
          <div className="nl-active-skills-section">
            <div className="nl-skills-section-header">已启用的技能 ({skills.length})</div>
            <div className="nl-skills-cards-list">
              {skills.map((s) => (
                <div key={s.id} className="nl-skill-item-card">
                  <div className="nl-skill-card-top">
                    <span className="nl-skill-card-icon">❖</span>
                    <span className="nl-skill-card-name">{s.name}</span>
                    <span className="nl-skill-active-badge">● 已生效</span>
                  </div>
                  <p className="nl-skill-card-desc">{s.description}</p>
                  <div className="nl-skill-card-trigger">
                    <span className="nl-trigger-label">触发条件：</span>
                    <span>{s.trigger}</span>
                  </div>
                  <div className="nl-skill-card-tools">
                    {s.tools.map((t) => (
                      <span key={t} className="nl-tool-pill">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Tools Ecosystem Card (1:1 with Screenshot) */}
        <div className="nl-tool-ecosystem-card">
          <div className="nl-eco-header-row">
            <div className="nl-eco-title-group">
              <div className="nl-eco-title">
                <span className="nl-eco-icon">❖</span>
                <span>在你的工具中使用这些技能</span>
              </div>
              <div className="nl-eco-sub">
                已启用的技能会作为你的智能体已经在读取的原生文件出现。
              </div>
            </div>
            <div className="nl-eco-status-badge">
              ● 正在 Gemini CLI, Antigravity 中生效
            </div>
          </div>

          <div className="nl-eco-waiting-tip">● 等待工具首次使用技能</div>

          {/* Connected Tool Rows (1:1) */}
          <div className="nl-eco-tools-list">
            {/* Tool 1: Cursor */}
            <div className="nl-eco-tool-row">
              <div className="nl-eco-tool-left">
                <div className="nl-eco-tool-avatar">▲</div>
                <div className="nl-eco-tool-info">
                  <div className="nl-eco-tool-name">Cursor</div>
                  <div className="nl-eco-tool-desc">已检测到</div>
                </div>
              </div>
              <button
                className="nl-btn-secondary"
                style={{ fontSize: "12px", padding: "4px 12px" }}
                onClick={() => onNavigateTab && onNavigateTab("connect")}
              >
                连接
              </button>
            </div>

            {/* Tool 2: Gemini CLI */}
            <div className="nl-eco-tool-row">
              <div className="nl-eco-tool-left">
                <div className="nl-eco-tool-avatar">✨</div>
                <div className="nl-eco-tool-info">
                  <div className="nl-eco-tool-name">Gemini CLI</div>
                  <div className="nl-eco-tool-desc">
                    已连接。开启一个技能后就会出现在这里。
                  </div>
                </div>
              </div>
            </div>

            {/* Tool 3: Antigravity */}
            <div className="nl-eco-tool-row">
              <div className="nl-eco-tool-left">
                <div className="nl-eco-tool-avatar">⚛️</div>
                <div className="nl-eco-tool-info">
                  <div className="nl-eco-tool-name">Antigravity</div>
                  <div className="nl-eco-tool-desc">
                    已连接。开启一个技能后就会出现在这里。
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Section 1: 其他工具 (53) */}
          <div className="nl-eco-dropdown-toggle">
            <button
              className="nl-dropdown-btn"
              onClick={() => setShowOtherTools(!showOtherTools)}
            >
              <span>{showOtherTools ? "▼" : "▶"} 其他工具 (53)</span>
            </button>
            {showOtherTools && (
              <div className="nl-dropdown-content">
                <div className="nl-other-tools-grid">
                  {[
                    "Claude Code",
                    "Grok Build",
                    "Claude Desktop",
                    "Codex",
                    "Copilot CLI",
                    "Windsurf",
                    "OpenClaw",
                    "Alma",
                  ].map((tool) => (
                    <div key={tool} className="nl-other-tool-chip">
                      <span>● {tool}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Section 2: 工作原理 */}
          <div className="nl-eco-dropdown-toggle">
            <button
              className="nl-dropdown-btn"
              onClick={() => setShowHowItWorks(!showHowItWorks)}
            >
              <span>{showHowItWorks ? "▼" : "▶"} 工作原理</span>
            </button>
            {showHowItWorks && (
              <div className="nl-dropdown-content" style={{ fontSize: "12px", color: "var(--nl-text-secondary)", lineHeight: "1.6" }}>
                ChronosMind 通过 Model Context Protocol (MCP) 与标准 SKILL.md 规范，将你沉淀的工作流程与工程经验自动注入至 Antigravity、Cursor 及各类 AI CLI 中。当智能体执行相关任务时，会自动读取并遵循这些规则。
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Skill Assistant Widget (1:1 with Screenshot Bottom Right) */}
      <div className={`nl-floating-assistant-widget ${assistantMinimized ? "minimized" : ""}`}>
        <div className="nl-assistant-header">
          <div className="nl-assistant-title">
            <span>🪄</span>
            <span>技能助手</span>
          </div>
          <div className="nl-assistant-actions">
            <button
              className="nl-assistant-icon-btn"
              onClick={() => setAssistantMinimized(!assistantMinimized)}
            >
              {assistantMinimized ? "□" : "—"}
            </button>
          </div>
        </div>

        {!assistantMinimized && (
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
        )}
      </div>

      {/* Modal: Create Skill */}
      {isModalOpen && (
        <div className="nl-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="nl-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="nl-modal-header">
              <h2 className="nl-modal-title">描述你的新技能</h2>
              <button className="nl-close-btn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSkill} className="nl-modal-form">
              <div className="nl-form-group">
                <label>技能名称 (Skill Name)</label>
                <input
                  type="text"
                  placeholder="例如：OTA 升级接口规范与错误码拦截"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  required
                />
              </div>

              <div className="nl-form-group">
                <label>何时使用 / 触发条件 (When to trigger)</label>
                <input
                  type="text"
                  placeholder="例如：当进行 OTA 升级传参改造或排查 MQTT 错误码时"
                  value={newSkillTrigger}
                  onChange={(e) => setNewSkillTrigger(e.target.value)}
                />
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
                  placeholder="1. 第一步...\n2. 第二步...\n3. 核心避坑点..."
                  value={newSkillSteps}
                  onChange={(e) => setNewSkillSteps(e.target.value)}
                />
              </div>

              <div className="nl-modal-actions">
                <button
                  type="button"
                  className="nl-btn-secondary"
                  onClick={() => setIsModalOpen(false)}
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
    </div>
  );
};
