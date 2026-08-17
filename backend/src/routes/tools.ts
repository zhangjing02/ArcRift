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

function getSystemToolStatuses(): ToolStatus[] {
  const home = os.homedir();
  const appdata = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  const localappdata = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");

  const toolsDef = [
    {
      id: "antigravity",
      name: "Google Antigravity",
      avatar: "⚛️",
      detectPaths: [
        path.join(home, ".gemini", "antigravity"),
        path.join(home, ".gemini", "config", "mcp_config.json"),
      ],
      configPath: path.join(home, ".gemini", "config", "mcp_config.json"),
    },
    {
      id: "cursor",
      name: "Cursor",
      avatar: "▲",
      detectPaths: [
        path.join(appdata, "Cursor"),
        path.join(localappdata, "Programs", "cursor"),
        path.join(home, ".cursor"),
      ],
      configPath: path.join(home, ".cursor", "mcp.json"),
    },
    {
      id: "gemini_cli",
      name: "Gemini CLI",
      avatar: "✨",
      detectPaths: [path.join(home, ".gemini")],
      configPath: path.join(home, ".gemini", "config", "mcp_config.json"),
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
      id: "claude_code",
      name: "Claude Code",
      avatar: "⌨️",
      detectPaths: [path.join(home, ".claude"), path.join(home, ".claude.json")],
      configPath: path.join(home, ".claude.json"),
    },
    {
      id: "windsurf",
      name: "Windsurf",
      avatar: "🏄",
      detectPaths: [path.join(appdata, "Windsurf"), path.join(home, ".windsurf")],
      configPath: path.join(home, ".windsurf", "mcp.json"),
    },
    {
      id: "vscode",
      name: "VS Code / Copilot",
      avatar: "💻",
      detectPaths: [path.join(appdata, "Code"), path.join(home, ".vscode")],
      configPath: path.join(appdata, "Code", "User", "mcp.json"),
    },
  ];

  const results: ToolStatus[] = [];

  for (const t of toolsDef) {
    const isDetected = t.detectPaths.some((p) => fs.existsSync(p));
    let isConnected = false;

    if (isDetected && t.configPath && fs.existsSync(t.configPath)) {
      try {
        const raw = fs.readFileSync(t.configPath, "utf-8");
        if (raw.includes("arcrift") || raw.includes("ChronosMind") || raw.includes("server.js")) {
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
    const activeCount = tools.filter((t) => t.connected).length;
    const detectedCount = tools.filter((t) => t.detected).length;

    res.json({
      success: true,
      tools,
      activeCount,
      detectedCount,
      activeSummary: tools
        .filter((t) => t.connected)
        .map((t) => t.name)
        .join(", "),
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

      configData.mcpServers.arcrift = {
        command: nodePath,
        args: [serverPath],
        env: {},
      };

      fs.writeFileSync(targetConfig, JSON.stringify(configData, null, 2));
      logger.success(`MCP configuration injected into ${targetConfig}`);

      res.json({ success: true, message: `已成功连接 ${toolId}`, configPath: targetConfig });
      return;
    }

    res.status(404).json({ error: `Tool ${toolId} auto-connect not supported` });
  } catch (err) {
    logger.error("Failed to connect tool:", err);
    res.status(500).json({ error: "Failed to connect tool" });
  }
});

export default router;
