import React, { useState } from "react";

interface AiToolItem {
  id: string;
  name: string;
  icon: string;
  version: string;
  description: string;
  tags: string[];
  status: "installed" | "copy_prompt" | "install" | "guide";
  prompt: string;
}

export const ConnectView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<"ai-tools" | "mcp" | "extension" | "import">("ai-tools");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const mainPrompt = `读取 https://mem.nowledge.co/SKILL.md，按其中说明为我当前使用的 AI 工具安装或更新 Nowledge Mem。`;

  const aiTools: AiToolItem[] = [
    {
      id: "claude-code",
      name: "Claude Code",
      icon: "✳️",
      version: "0.7.23",
      description: "Claude Code 连接：Working Memory、检索引导、hooks 与自动会话捕获。",
      tags: ["自动捕获", "自动回忆"],
      status: "install",
      prompt: `读取 https://mem.nowledge.co/SKILL.md，按其中说明为 Claude Code 安装或更新 Nowledge Mem。`,
    },
    {
      id: "grok-build",
      name: "Grok Build",
      icon: "⚡",
      version: "0.7.23",
      description: "Grok Build 编程智能体连接：启动上下文、记忆引导、hooks 与自动本地会话捕获。",
      tags: ["自动捕获", "自动回忆"],
      status: "install",
      prompt: `读取 https://mem.nowledge.co/SKILL.md，按其中说明为 Grok Build 安装或更新 Nowledge Mem。`,
    },
    {
      id: "claude-desktop",
      name: "Claude Desktop",
      icon: "🖥️",
      version: "最新",
      description: "通过 MCP 连接 Claude Desktop，让对话可以检索和回忆你的记忆。",
      tags: ["MCP", "引导检索", "手动设置"],
      status: "guide",
      prompt: `配置 Claude Desktop 的 claude_desktop_config.json 中的 ArcRift / Nowledge Mem MCP 服务。`,
    },
    {
      id: "gemini-cli",
      name: "Gemini CLI",
      icon: "✨",
      version: "0.1.9",
      description: "Gemini CLI 连接：内含 MCP、hooks、路由检索、真实对话保存与交接摘要。",
      tags: ["自动捕获", "MCP", "引导检索"],
      status: "copy_prompt",
      prompt: `读取 https://mem.nowledge.co/SKILL.md，按其中说明为 Gemini CLI 安装或更新 Nowledge Mem。`,
    },
    {
      id: "google-antigravity",
      name: "Google Antigravity",
      icon: "⚛️",
      version: "0.1.3",
      description: "Google Antigravity 连接：启动上下文、内置 MCP、skills、lifecycle hooks、离线重试与自动 transcript 捕获。",
      tags: ["自动捕获", "MCP", "自动回忆"],
      status: "copy_prompt",
      prompt: `读取 https://mem.nowledge.co/SKILL.md，按其中说明为 Google Antigravity 安装或更新 Nowledge Mem。安装 nowledge-co/nowledge-mem-google-antigravity 插件，重启 Antigravity，用 nmem status 和 Context Bundle 或 Working Memory 检查验证，再跑一个短会话并确认 nmem t list --source antigravity 能看到捕获的 Thread。`,
    },
    {
      id: "cursor",
      name: "Cursor",
      icon: "▲",
      version: "最新",
      description: "Cursor 连接：内含 MCP、规则、技能与清晰的交接行为。",
      tags: ["自动捕获", "MCP", "引导检索"],
      status: "installed",
      prompt: `在 Cursor Settings -> MCP Servers 中配置 ArcRift / Nowledge Mem 服务。`,
    },
    {
      id: "codex",
      name: "Codex",
      icon: "🤖",
      version: "0.1.31",
      description: "Codex 连接：自动加载启动上下文、区分两类记忆、内含 MCP，并捕获真实会话。",
      tags: ["自动捕获", "MCP", "自动回忆"],
      status: "copy_prompt",
      prompt: `读取 https://mem.nowledge.co/SKILL.md，按其中说明为 Codex 安装或更新 Nowledge Mem。`,
    },
    {
      id: "copilot-cli",
      name: "Copilot CLI",
      icon: "🐙",
      version: "0.1.4",
      description: "GitHub Copilot CLI 连接：Working Memory、检索引导与自动会话捕获。",
      tags: ["自动捕获", "自动回忆"],
      status: "install",
      prompt: `读取 https://mem.nowledge.co/SKILL.md，按其中说明为 GitHub Copilot CLI 安装或更新 Nowledge Mem。`,
    },
    {
      id: "alma",
      name: "Alma",
      icon: "🌸",
      version: "0.7.4",
      description: "Alma 连接：让记忆在不同对话间保持可用。",
      tags: ["自动捕获", "自动回忆", "手动设置"],
      status: "guide",
      prompt: `读取 https://mem.nowledge.co/SKILL.md，按其中说明为 Alma 配置记忆。`,
    },
    {
      id: "openclaw",
      name: "OpenClaw",
      icon: "🦞",
      version: "0.8.31",
      description: "OpenClaw 连接：开源智能体上下文自动挂载与记忆同步。",
      tags: ["自动捕获", "MCP", "引导检索"],
      status: "install",
      prompt: `读取 https://mem.nowledge.co/SKILL.md，按其中说明为 OpenClaw 安装或更新 Nowledge Mem。`,
    },
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="nl-view-container nl-connect-view">
      {/* Top Title & Sub-tabs */}
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">连接</h1>
          <p className="nl-view-subtitle">先连接一个 AI 工具，需要时再加更多。</p>
        </div>

        <div className="nl-subtab-group">
          <button
            className={`nl-subtab-btn ${activeSubTab === "ai-tools" ? "active" : ""}`}
            onClick={() => setActiveSubTab("ai-tools")}
          >
            🤖 AI 工具
          </button>
          <button
            className={`nl-subtab-btn ${activeSubTab === "mcp" ? "active" : ""}`}
            onClick={() => setActiveSubTab("mcp")}
          >
            ⚙️ MCP
          </button>
          <button
            className={`nl-subtab-btn ${activeSubTab === "extension" ? "active" : ""}`}
            onClick={() => setActiveSubTab("extension")}
          >
            🌐 浏览器扩展
          </button>
          <button
            className={`nl-subtab-btn ${activeSubTab === "import" ? "active" : ""}`}
            onClick={() => setActiveSubTab("import")}
          >
            📄 会话导入
          </button>
        </div>
      </div>

      {/* Main Banner: 把一段提示词粘贴到你的 AI 工具里 */}
      <div className="nl-connect-banner">
        <div className="nl-connect-banner-header">
          <span className="nl-banner-tag">连接</span>
          <h2 className="nl-banner-title">把一段提示词粘贴到你的 AI 工具里</h2>
          <button
            className="nl-btn-secondary nl-banner-copy-btn"
            onClick={() => handleCopy(mainPrompt, "main")}
          >
            {copiedId === "main" ? "✓ 已复制提示词" : "📋 复制提示词"}
          </button>
        </div>

        <p className="nl-banner-desc">
          设置受支持的命令行 Agent 或桌面 AI 工具时，先用这一段。Agent 会读取实时指南，选择最安全的设置路径，并明确告诉你要求什么、确认什么。
        </p>

        <div className="nl-prompt-preview-box">
          <span className="nl-prompt-label">提示词</span>
          <p className="nl-prompt-text">{mainPrompt}</p>
        </div>

        <div className="nl-banner-footer">
          <span>📖 使用 Raft、Lody、Multica、Cumora、Paseo、Mirasim 或 Cindy？先连接它实际启动的 AI 工具。</span>
          <span className="nl-link-text">多 Agent 设置</span>
        </div>
      </div>

      {/* Section Title */}
      <div className="nl-tools-section-title">支持的 AI 工具</div>

      {/* Tools List */}
      <div className="nl-tools-list">
        {aiTools.map((tool) => (
          <div key={tool.id} className="nl-tool-card">
            <div className="nl-tool-avatar">{tool.icon}</div>
            <div className="nl-tool-info">
              <div className="nl-tool-name-row">
                <span className="nl-tool-name">{tool.name}</span>
                <span className="nl-tool-ver">可用版本: {tool.version}</span>
              </div>
              <p className="nl-tool-desc">{tool.description}</p>
              <div className="nl-tool-tag-row">
                {tool.tags.map((t) => (
                  <span key={t} className="nl-tool-tag">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="nl-tool-action-wrap">
              {tool.status === "installed" ? (
                <span className="nl-installed-badge">✓ 已安装</span>
              ) : tool.status === "copy_prompt" ? (
                <button
                  className="nl-btn-secondary nl-tool-btn"
                  onClick={() => handleCopy(tool.prompt, tool.id)}
                >
                  {copiedId === tool.id ? "✓ 已复制" : "📋 复制提示词"}
                </button>
              ) : tool.status === "guide" ? (
                <button
                  className="nl-btn-secondary nl-tool-btn"
                  onClick={() => handleCopy(tool.prompt, tool.id)}
                >
                  📖 指南
                </button>
              ) : (
                <button
                  className="nl-btn-secondary nl-tool-btn"
                  onClick={() => handleCopy(tool.prompt, tool.id)}
                >
                  安装
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
