import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { logger } from "../utils/logger";

const router = Router();

interface ToolStatus {
  id: string;
  name: string;
  avatar: string;
  detected: boolean;
  connected: boolean;
  statusText: string;
  configPath?: string;
}

function checkCommandInPath(cmd: string): boolean {
  try {
    const isWindows = process.platform === "win32";
    const checkCmd = isWindows ? `where.exe ${cmd}` : `which ${cmd}`;
    const out = require("child_process").execSync(checkCmd, {
      stdio: ["pipe", "pipe", "ignore"],
      encoding: "utf-8",
      timeout: 1500,
    });
    return !!(out && out.trim().length > 0);
  } catch {
    return false;
  }
}

function getSystemToolStatuses(): ToolStatus[] {
  const home = os.homedir();
  const appdata = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  const localappdata = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");

  const toolsDef = [
    {
      id: "antigravity",
      name: "Google Antigravity",
      avatar: "⚛️",
      cliName: "agy",
      detectPaths: [
        path.join(home, ".gemini", "antigravity"),
        path.join(home, ".gemini", "config", "mcp_config.json"),
      ],
      configPath: path.join(home, ".gemini", "config", "mcp_config.json"),
    },
    {
      id: "gemini_cli",
      name: "Gemini CLI",
      avatar: "✨",
      cliName: "gemini",
      detectPaths: [
        path.join(home, ".gemini"),
        path.join(home, ".gemini", "config", "mcp_config.json"),
      ],
      configPath: path.join(home, ".gemini", "config", "mcp_config.json"),
    },
    {
      id: "claude_code",
      name: "Claude Code",
      avatar: "⌨️",
      cliName: "claude",
      detectPaths: [
        path.join(home, ".claude"),
        path.join(home, ".claude.json"),
      ],
      configPath: path.join(home, ".claude.json"),
    },
    {
      id: "codex",
      name: "Codex",
      avatar: "📦",
      cliName: "codex",
      detectPaths: [
        path.join(home, ".codex"),
        path.join(home, ".codexbridge"),
      ],
      configPath: path.join(home, ".codex", "config.toml"),
    },
    {
      id: "claude_desktop",
      name: "Claude Desktop",
      avatar: "✳️",
      detectPaths: [
        path.join(appdata, "Claude"),
        path.join(appdata, "Claude", "claude_desktop_config.json"),
      ],
      configPath: path.join(appdata, "Claude", "claude_desktop_config.json"),
    },
    {
      id: "cursor",
      name: "Cursor",
      avatar: "▲",
      cliName: "cursor",
      detectPaths: [
        path.join(appdata, "Cursor"),
        path.join(localappdata, "Programs", "cursor"),
        path.join(home, ".cursor"),
      ],
      configPath: path.join(home, ".cursor", "mcp.json"),
    },
    {
      id: "windsurf",
      name: "Windsurf",
      avatar: "🏄",
      cliName: "windsurf",
      detectPaths: [
        path.join(appdata, "Windsurf"),
        path.join(home, ".windsurf"),
      ],
      configPath: path.join(home, ".windsurf", "mcp.json"),
    },
    {
      id: "vscode",
      name: "VS Code / Copilot",
      avatar: "💻",
      cliName: "code",
      detectPaths: [
        path.join(appdata, "Code"),
        path.join(home, ".vscode"),
      ],
      configPath: path.join(appdata, "Code", "User", "mcp.json"),
    },
    {
      id: "opencode",
      name: "OpenCode",
      avatar: "🔲",
      cliName: "opencode",
      detectPaths: [path.join(home, ".opencode")],
      configPath: path.join(home, ".opencode", "config.json"),
    },
    {
      id: "kiro_cli",
      name: "Kiro CLI",
      avatar: "📟",
      cliName: "kiro",
      detectPaths: [path.join(home, ".kiro")],
      configPath: path.join(home, ".kiro", "config.json"),
    },
    {
      id: "trae",
      name: "Trae",
      avatar: "⚡",
      cliName: "trae",
      detectPaths: [
        path.join(appdata, "Trae"),
        path.join(home, ".trae"),
      ],
      configPath: path.join(home, ".trae", "mcp.json"),
    },
    {
      id: "aider",
      name: "Aider",
      avatar: "🤖",
      cliName: "aider",
      detectPaths: [
        path.join(home, ".aider"),
        path.join(home, ".aider.conf.yml"),
      ],
      configPath: path.join(home, ".aider.conf.yml"),
    },
  ];

  const results: ToolStatus[] = [];

  for (const t of toolsDef) {
    const isPathDetected = t.detectPaths.some((p) => fs.existsSync(p));
    const isCliDetected = t.cliName ? checkCommandInPath(t.cliName) : false;
    const isDetected = isPathDetected || isCliDetected;

    let isConnected = false;

    if (t.id === "codex") {
      const codexSkillsDir = path.join(home, ".codex", "skills", "nowledge-mem");
      if (fs.existsSync(codexSkillsDir)) {
        isConnected = true;
      }
    }

    if (isDetected && t.configPath && fs.existsSync(t.configPath)) {
      try {
        const raw = fs.readFileSync(t.configPath, "utf-8");
        if (
          raw.includes("arcrift") ||
          raw.includes("ChronosMind") ||
          raw.includes("nowledge-mem") ||
          raw.includes("server.js")
        ) {
          isConnected = true;
        }
      } catch {
        isConnected = false;
      }
    }

    let statusText = "未安装";
    if (isConnected) {
      statusText = "已连接。开启一个技能后就会出现在这里。";
    } else if (isDetected) {
      statusText = "已检测到";
    }

    results.push({
      id: t.id,
      name: t.name,
      avatar: t.avatar,
      detected: isDetected,
      connected: isConnected,
      statusText,
      configPath: t.configPath,
    });
  }

  return results;
}

// GET /api/tools/detect
router.get("/detect", (_req: Request, res: Response) => {
  try {
    const tools = getSystemToolStatuses();
    const activeTools = tools.filter((t) => t.connected);
    const activeCount = activeTools.length;
    const detectedCount = tools.filter((t) => t.detected).length;

    res.json({
      success: true,
      tools,
      activeCount,
      detectedCount,
      activeSummary: activeTools.map((t) => t.name).join(", ") || "无",
    });
  } catch (err) {
    logger.error("Failed to detect tools:", err);
    res.status(500).json({ error: "Failed to detect tools" });
  }
});

// POST /api/tools/connect
router.post("/connect", (req: Request, res: Response) => {
  const { toolId } = req.body;
  if (!toolId) {
    res.status(400).json({ error: "toolId is required" });
    return;
  }

  try {
    const home = os.homedir();
    const appdata = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    const serverPath = path.resolve(__dirname, "../mcp/server.js");
    const nodePath = process.execPath;

    let targetConfig = "";

    if (toolId === "cursor") {
      const cursorDir = path.join(home, ".cursor");
      if (!fs.existsSync(cursorDir)) fs.mkdirSync(cursorDir, { recursive: true });
      targetConfig = path.join(cursorDir, "mcp.json");
    } else if (toolId === "antigravity" || toolId === "gemini_cli") {
      const geminiConfigDir = path.join(home, ".gemini", "config");
      if (!fs.existsSync(geminiConfigDir)) fs.mkdirSync(geminiConfigDir, { recursive: true });
      targetConfig = path.join(geminiConfigDir, "mcp_config.json");
    } else if (toolId === "claude_desktop") {
      const claudeDir = path.join(appdata, "Claude");
      if (!fs.existsSync(claudeDir)) fs.mkdirSync(claudeDir, { recursive: true });
      targetConfig = path.join(claudeDir, "claude_desktop_config.json");
    } else if (toolId === "claude_code") {
      targetConfig = path.join(home, ".claude.json");
    } else if (toolId === "windsurf") {
      const windsurfDir = path.join(home, ".windsurf");
      if (!fs.existsSync(windsurfDir)) fs.mkdirSync(windsurfDir, { recursive: true });
      targetConfig = path.join(windsurfDir, "mcp.json");
    } else if (toolId === "vscode") {
      const codeDir = path.join(appdata, "Code", "User");
      if (!fs.existsSync(codeDir)) fs.mkdirSync(codeDir, { recursive: true });
      targetConfig = path.join(codeDir, "mcp.json");
    } else if (toolId === "codex") {
      const codexSkillsDir = path.join(home, ".codex", "skills", "nowledge-mem");
      if (!fs.existsSync(codexSkillsDir)) fs.mkdirSync(codexSkillsDir, { recursive: true });
      fs.writeFileSync(
        path.join(codexSkillsDir, "SKILL.md"),
        `---\nname: nowledge-mem\ndescription: ArcRift / Nowledge Mem Continuous Knowledge Sync\n---\n\n# Nowledge Mem Integration\nConnected to ArcRift MCP & Workspace.\n`
      );
      res.json({ success: true, message: `已成功连接 Codex`, configPath: codexSkillsDir });
      return;
    } else if (toolId === "kiro_cli") {
      const kiroSkillsDir = path.join(home, ".kiro", "skills", "nowledge-mem");
      if (!fs.existsSync(kiroSkillsDir)) fs.mkdirSync(kiroSkillsDir, { recursive: true });
      fs.writeFileSync(
        path.join(kiroSkillsDir, "SKILL.md"),
        `---\nname: nowledge-mem\ndescription: ArcRift / Nowledge Mem Continuous Knowledge Sync\n---\n\n# Nowledge Mem Integration\nConnected to ArcRift MCP & Workspace.\n`
      );
      res.json({ success: true, message: `已成功连接 Kiro CLI`, configPath: kiroSkillsDir });
      return;
    }

    if (targetConfig) {
      let configData: any = { mcpServers: {} };
      if (fs.existsSync(targetConfig)) {
        try {
          configData = JSON.parse(fs.readFileSync(targetConfig, "utf-8"));
          if (!configData.mcpServers) configData.mcpServers = {};
        } catch {
          configData = { mcpServers: {} };
        }
      }

      configData.mcpServers["arcrift"] = {
        command: nodePath,
        args: [serverPath],
        env: {},
      };

      fs.writeFileSync(targetConfig, JSON.stringify(configData, null, 2));
      logger.success(`MCP configuration injected into ${targetConfig}`);

      res.json({ success: true, message: `已成功连接 ${toolId}`, configPath: targetConfig });
      return;
    }

    res.status(404).json({ error: `Tool ${toolId} auto-connect not supported yet` });
  } catch (err) {
    logger.error("Failed to connect tool:", err);
    res.status(500).json({ error: "Failed to connect tool" });
  }
});

// POST /api/tools/disconnect
router.post("/disconnect", (req: Request, res: Response) => {
  const { toolId } = req.body;
  if (!toolId) {
    res.status(400).json({ error: "toolId is required" });
    return;
  }

  try {
    const home = os.homedir();
    const appdata = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    let targetConfig = "";

    if (toolId === "antigravity" || toolId === "gemini_cli") {
      targetConfig = path.join(home, ".gemini", "config", "mcp_config.json");
    } else if (toolId === "cursor") {
      targetConfig = path.join(home, ".cursor", "mcp.json");
    } else if (toolId === "claude_desktop") {
      targetConfig = path.join(appdata, "Claude", "claude_desktop_config.json");
    } else if (toolId === "claude_code") {
      targetConfig = path.join(home, ".claude.json");
    } else if (toolId === "codex") {
      const codexSkillsDir = path.join(home, ".codex", "skills", "nowledge-mem");
      if (fs.existsSync(codexSkillsDir)) {
        fs.rmSync(codexSkillsDir, { recursive: true, force: true });
      }
      res.json({ success: true, message: `已断开 Codex` });
      return;
    } else if (toolId === "kiro_cli") {
      const kiroSkillsDir = path.join(home, ".kiro", "skills", "nowledge-mem");
      if (fs.existsSync(kiroSkillsDir)) {
        fs.rmSync(kiroSkillsDir, { recursive: true, force: true });
      }
      res.json({ success: true, message: `已断开 Kiro CLI` });
      return;
    }

    if (targetConfig && fs.existsSync(targetConfig)) {
      try {
        const configData = JSON.parse(fs.readFileSync(targetConfig, "utf-8"));
        if (configData.mcpServers) {
          delete configData.mcpServers["arcrift"];
          delete configData.mcpServers["nowledge-mem"];
          delete configData.mcpServers["ChronosMind"];
          fs.writeFileSync(targetConfig, JSON.stringify(configData, null, 2));
        }
      } catch {}
    }

    res.json({ success: true, message: `已断开 ${toolId}` });
  } catch (err) {
    logger.error("Failed to disconnect tool:", err);
    res.status(500).json({ error: "Failed to disconnect tool" });
  }
});

export default router;

