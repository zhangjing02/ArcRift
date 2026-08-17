/**
 * mcp/config-gen.ts — MCP Configuration Generator
 * 
 * Automatically detects absolute paths and generates the JSON config
 * needed for Antigravity, Cursor, Claude Code, Windsurf, and other MCP clients.
 */

import path from "path";
import fs from "fs";

import { getDbPath, getDataDir, getAppRoot } from "../utils/paths";

function generateConfig() {
  const rootDir = getAppRoot();
  const backendDir = path.resolve(__dirname, "../..");
  // Normalize paths to forward slashes for JSON compatibility
  const serverJs = path.join(backendDir, "dist", "mcp", "server.js").replace(/\\/g, "/");
  const dbPath = getDbPath().replace(/\\/g, "/");
  const dataDir = getDataDir().replace(/\\/g, "/");
  const envPath = path.join(backendDir, ".env").replace(/\\/g, "/");

  console.log("\n=======================================================");
  console.log("       ArcRift 多 IDE MCP 自动配置生成器              ");
  console.log("=======================================================");
  console.log("检测到的系统绝对路径：");
  console.log(`- MCP Server 脚本 : ${serverJs}`);
  console.log(`- SQLite 数据库路径: ${dbPath}`);
  console.log(`- 环境配置文件路径: ${envPath}`);
  console.log("");

  if (!fs.existsSync(path.join(backendDir, "dist", "mcp", "server.js"))) {
    console.warn("⚠️ 提示: 未检测到 backend/dist/mcp/server.js，请先在 backend 目录运行 'npm run build'");
  }

  const standardMcpConfig = {
    mcpServers: {
      arcrift: {
        command: "node",
        args: [serverJs],
        env: {
          ARCRIFT_STORAGE_MODE: "sqlite",
          SQLITE_DB_PATH: dbPath,
          NODE_ENV: "production"
        }
      }
    }
  };

  console.log("【1. Antigravity / Cursor / Windsurf / Claude Desktop 配置】");
  console.log("复制以下内容粘贴到各 IDE 的 MCP 配置文件中：");
  console.log("-------------------------------------------------------");
  console.log(JSON.stringify(standardMcpConfig, null, 2));
  console.log("-------------------------------------------------------");

  console.log("\n【2. Claude Code 命令行一键添加】");
  console.log(`claude mcp add arcrift node "${serverJs}"`);

  console.log("\n【3. 运行模式说明】");
  console.log("- 默认采用 Zero-Docker (SQLite) 本地嵌入式模式，零外部依赖。");
  console.log("- 若本地运行有 Ollama，将自动启用本地向量嵌入与图谱提取。");
  console.log("- 若无 Ollama，系统将自动降级至 SQLite FTS5 全文搜索与云端 LLM (如 Groq API) 提取。");
  console.log("=======================================================\n");
}

generateConfig();
