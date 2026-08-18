import React, { useState, useEffect } from "react";

interface AiToolItem {
  id: string;
  name: string;
  icon: string;
  version: string;
  description: string;
  tags: string[];
  status: "installed" | "copy_prompt" | "copy_mcp" | "guide";
  prompt: string;
  mcpJson?: string;
}

export const ConnectView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<"ai-tools" | "mcp" | "prompt-rules" | "extension">("ai-tools");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mcpConfig, setMcpConfig] = useState<string>("");
  const [promptText, setPromptText] = useState<string>(
    "在当前项目中启用 ArcRift (Nowledge Mem) 长期记忆与知识图谱工作台。每次解决重大 Bug、完成架构决策、更新 API 规范或收到 'CM' / '存档' 指令时，请主动调用 arcrift 的 memory_add 工具将经验存入知识库；在遇到类似问题前，先调用 memory_search 检索历史经验。"
  );

  useEffect(() => {
    fetch("/api/settings/connect-info")
      .then((res) => res.json())
      .then((data) => {
        if (data.mcpJson) {
          setMcpConfig(data.mcpJson);
        }
        if (data.prompt) {
          setPromptText(data.prompt);
        }
      })
      .catch(() => {
        // Fallback default
        const fallbackConfig = {
          mcpServers: {
            arcrift: {
              command: "node",
              args: ["./backend/dist/mcp/server.js"],
              env: {
                ARCRIFT_MCP_MODE: "true",
                ARCRIFT_STORAGE_MODE: "sqlite",
                NODE_ENV: "production",
              },
            },
          },
        };
        setMcpConfig(JSON.stringify(fallbackConfig, null, 2));
      });
  }, []);

  const aiTools: AiToolItem[] = [
    {
      id: "google-antigravity",
      name: "Google Antigravity",
      icon: "⚛️",
      version: "2.0.0",
      description: "原生 stdio MCP 深度互联：全自动阶段性任务落盘、全局快捷指令（CM / 存档）、多 Space 空间自动隔离。",
      tags: ["自动落盘", "原生 MCP", "工作记忆"],
      status: "installed",
      prompt: `你已连接本地 ArcRift 智能记忆知识库。在编码过程中，只要解决重大 Bug、完成架构决策或收到 'CM' / '存档' 指令，请立即调用 arcrift 的 memory_add 工具持久化到当前项目空间。`,
      mcpJson: mcpConfig,
    },
    {
      id: "cursor",
      name: "Cursor",
      icon: "▲",
      version: "2.0.0",
      description: "Cursor IDE 强力插件连接：支持通过 .cursorrules 和 MCP 自动在会话间回忆上下文与架构规范。",
      tags: ["Cursor Rules", "原生 MCP", "自动回忆"],
      status: "installed",
      prompt: `已连接 ArcRift 记忆工作台。请在完成重要编码后，自动使用 arcrift:memory_add 记录问题根因与解决方案。在开发前调用 memory_search 检索相关知识。`,
      mcpJson: mcpConfig,
    },
    {
      id: "windsurf",
      name: "Windsurf (Codeium Cascade)",
      icon: "🏄‍♂️",
      version: "2.0.0",
      description: "Cascade 深度接入：通过 Cascade MCP 配置无缝桥接项目知识库与三元组图谱。",
      tags: ["Cascade MCP", "知识图谱", "智能检索"],
      status: "copy_mcp",
      prompt: `你已接入 ArcRift 知识库。在开发当前工程时，请主动沉淀关键技术决策并利用 arcrift:memory_search 辅助排障。`,
      mcpJson: mcpConfig,
    },
    {
      id: "claude-code",
      name: "Claude Code / Codex",
      icon: "✳️",
      version: "2.0.0",
      description: "CLI 智能体全功能记忆：无缝支持命令行模式下的记忆提取、Working Memory 注入与上下文恢复。",
      tags: ["CLI 工具", "Working Memory", "自动捕获"],
      status: "copy_prompt",
      prompt: `启用 ArcRift 记忆工作台。在当前终端工程中，通过 stdio MCP 自动维护每日工作简报与关键技术决策。`,
      mcpJson: mcpConfig,
    },
    {
      id: "claude-desktop",
      name: "Claude Desktop",
      icon: "🖥️",
      version: "2.0.0",
      description: "Claude Desktop 桌面端连接：让日常深度讨论能随时回忆起各个项目的技术规范与 Bug 记录。",
      tags: ["桌面端", "原生 MCP", "跨项目检索"],
      status: "copy_mcp",
      prompt: `已加载 ArcRift MCP 知识库。请在需要时调用 arcrift:memory_search 检索项目历史背景。`,
      mcpJson: mcpConfig,
    },
    {
      id: "vs-code",
      name: "VS Code (Cline / Roo / Continue)",
      icon: "💻",
      version: "2.0.0",
      description: "VS Code 生态主流 AI 插件通用适配，提供开箱即用的 JSON 配置与工具集成。",
      tags: ["Cline", "Roo Code", "Continue"],
      status: "copy_mcp",
      prompt: `连接 ArcRift 记忆库。在任务完成时保存关键决策，遇到未知报错先检索历史解决方案。`,
      mcpJson: mcpConfig,
    },
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="nl-connect-layout">
      {/* Top Banner Header */}
      <div className="nl-connect-hero-card">
        <div className="nl-connect-hero-left">
          <span className="nl-hero-icon">🔗</span>
          <div>
            <h1 className="nl-hero-title">连接你的 AI 编程智能体</h1>
            <p className="nl-hero-desc">
              让 <strong>Google Antigravity</strong>、<strong>Cursor</strong>、<strong>Windsurf</strong>、<strong>Claude Code</strong> 等主流 AI 工具无缝沉淀上下文与经验到 ArcRift 本地知识库。
            </p>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="nl-connect-subtabs">
        <button
          className={`nl-subtab-btn ${activeSubTab === "ai-tools" ? "active" : ""}`}
          onClick={() => setActiveSubTab("ai-tools")}
        >
          🤖 常用 AI 工具
        </button>
        <button
          className={`nl-subtab-btn ${activeSubTab === "mcp" ? "active" : ""}`}
          onClick={() => setActiveSubTab("mcp")}
        >
          🔌 实时本机 MCP 配置 (JSON)
        </button>
        <button
          className={`nl-subtab-btn ${activeSubTab === "prompt-rules" ? "active" : ""}`}
          onClick={() => setActiveSubTab("prompt-rules")}
        >
          📜 智能体提示词与规则
        </button>
      </div>

      {/* 1. AI Tools Grid Subtab */}
      {activeSubTab === "ai-tools" && (
        <div className="nl-connect-panel">
          <div className="nl-tool-cards-grid">
            {aiTools.map((tool) => (
              <div key={tool.id} className="nl-tool-card">
                <div className="nl-tool-card-top">
                  <div className="nl-tool-identity">
                    <span className="nl-tool-icon">{tool.icon}</span>
                    <div>
                      <h3 className="nl-tool-name">{tool.name}</h3>
                      <span className="nl-tool-version">v{tool.version}</span>
                    </div>
                  </div>
                  {tool.status === "installed" ? (
                    <span className="nl-pill-status-green">✓ 开箱即用</span>
                  ) : (
                    <span className="nl-pill-status-blue">● 可连接</span>
                  )}
                </div>

                <p className="nl-tool-desc">{tool.description}</p>

                <div className="nl-tool-tags-row">
                  {tool.tags.map((t) => (
                    <span key={t} className="nl-tool-tag-chip">
                      {t}
                    </span>
                  ))}
                </div>

                <div className="nl-tool-card-footer">
                  {tool.mcpJson && (
                    <button
                      className="nl-btn-secondary"
                      onClick={() => handleCopy(tool.mcpJson!, `${tool.id}_mcp`)}
                    >
                      {copiedId === `${tool.id}_mcp` ? "✓ 已复制本机 MCP 配置" : "📋 复制 MCP 配置"}
                    </button>
                  )}
                  <button
                    className="nl-btn-primary"
                    onClick={() => handleCopy(tool.prompt, `${tool.id}_prompt`)}
                  >
                    {copiedId === `${tool.id}_prompt` ? "✓ 已复制提示词" : "💬 复制提示词"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Standard MCP Config Subtab */}
      {activeSubTab === "mcp" && (
        <div className="nl-connect-panel">
          <div className="nl-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>ArcRift 本机动态识别 stdio MCP 配置</h3>
                <p style={{ fontSize: 13, color: "var(--nl-text-muted)", marginTop: 4 }}>
                  已自动为你填入当前电脑的真实绝对路径。直接复制并粘贴到 Antigravity（<code>mcp_config.json</code>）、Cursor（<code>~/.cursor/mcp.json</code>）或 Claude Desktop（<code>claude_desktop_config.json</code>）中。
                </p>
              </div>
              <button
                className="nl-btn-primary"
                onClick={() => handleCopy(mcpConfig, "global_mcp")}
              >
                {copiedId === "global_mcp" ? "✓ 已复制 JSON" : "📋 一键复制本机配置"}
              </button>
            </div>

            <pre className="nl-code-block" style={{ maxHeight: 260, overflowY: "auto" }}>
              {mcpConfig}
            </pre>
          </div>
        </div>
      )}

      {/* 3. Prompt Rules Subtab */}
      {activeSubTab === "prompt-rules" && (
        <div className="nl-connect-panel">
          <div className="nl-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>全局智能体系统提示词规则 (System Prompt)</h3>
                <p style={{ fontSize: 13, color: "var(--nl-text-muted)", marginTop: 4 }}>
                  可粘贴到任意项目的 <code>.cursorrules</code>、<code>GEMINI.md</code>、<code>CLAUDE.md</code> 或全局 Rules 中，AI 即可全自动为你归档知识。
                </p>
              </div>
              <button
                className="nl-btn-primary"
                onClick={() => handleCopy(promptText, "global_prompt")}
              >
                {copiedId === "global_prompt" ? "✓ 已复制提示词" : "📋 复制规则提示词"}
              </button>
            </div>

            <div className="nl-prompt-preview-box">
              {promptText}
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>极简快捷指令口令列表：</h4>
              <ul style={{ fontSize: 13, color: "var(--nl-text-secondary)", lineHeight: 1.8, paddingLeft: 18 }}>
                <li><code>CM</code> 或 <code>cm</code>：极简双字母，立即提炼当前上下文沉淀到当前项目空间</li>
                <li><code>/cm</code> 或 <code>/save</code>：斜杠命令风格</li>
                <li><code>存档</code> 或 <code>保存记忆</code>：中文自然口令</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
