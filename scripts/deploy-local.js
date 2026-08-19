const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const targetDir = "D:\\ComputerTool\\AI-tool\\ArcRift";

console.log("=== Installing ArcRift to:", targetDir, "===");

// 1. Create target directory
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 2. Install backend
console.log("[1/6] Copying backend runtime and dependencies...");
const targetBackend = path.join(targetDir, "backend");
fs.mkdirSync(targetBackend, { recursive: true });

// Copy dist
fs.cpSync(path.join(rootDir, "backend", "dist"), path.join(targetBackend, "dist"), { recursive: true });
// Copy package.json
fs.copyFileSync(path.join(rootDir, "backend", "package.json"), path.join(targetBackend, "package.json"));
// Copy node_modules
if (fs.existsSync(path.join(rootDir, "backend", "node_modules"))) {
  console.log("Copying backend node_modules (this may take a few seconds)...");
  try {
    fs.cpSync(path.join(rootDir, "backend", "node_modules"), path.join(targetBackend, "node_modules"), { recursive: true, force: true });
  } catch (err) {
    console.warn("Warning during copying backend node_modules:", err.message);
  }
}
// Copy env and settings (only on first install if not existing, preserving user settings)
if (fs.existsSync(path.join(rootDir, "backend", ".env.example")) && !fs.existsSync(path.join(targetBackend, ".env"))) {
  fs.copyFileSync(path.join(rootDir, "backend", ".env.example"), path.join(targetBackend, ".env.example"));
}
if (fs.existsSync(path.join(rootDir, "backend", "ArcRift-settings.json")) && !fs.existsSync(path.join(targetBackend, "ArcRift-settings.json"))) {
  fs.copyFileSync(path.join(rootDir, "backend", "ArcRift-settings.json"), path.join(targetBackend, "ArcRift-settings.json"));
}
if (fs.existsSync(path.join(rootDir, "backend", "ChronosMind-settings.json")) && !fs.existsSync(path.join(targetBackend, "ChronosMind-settings.json"))) {
  fs.copyFileSync(path.join(rootDir, "backend", "ChronosMind-settings.json"), path.join(targetBackend, "ChronosMind-settings.json"));
}

// 3. Install dashboard prebuilt dist
console.log("[2/6] Copying dashboard Web UI bundle...");
const targetDashboard = path.join(targetDir, "dashboard");
fs.mkdirSync(targetDashboard, { recursive: true });
fs.cpSync(path.join(rootDir, "dashboard", "dist"), path.join(targetDashboard, "dist"), { recursive: true });

// 4. Install extension
console.log("[3/6] Copying Chrome/Edge browser extension...");
const targetExtension = path.join(targetDir, "extension");
fs.mkdirSync(targetExtension, { recursive: true });
fs.cpSync(path.join(rootDir, "extension"), targetExtension, { recursive: true });

// 5. Install desktop
console.log("[4/6] Copying desktop launcher...");
const targetDesktop = path.join(targetDir, "desktop");
fs.mkdirSync(targetDesktop, { recursive: true });
try {
  // Copy main desktop files
  const desktopFiles = fs.readdirSync(path.join(rootDir, "desktop"));
  for (const file of desktopFiles) {
    if (file === "node_modules") {
      if (!fs.existsSync(path.join(targetDesktop, "node_modules"))) {
        fs.cpSync(path.join(rootDir, "desktop", "node_modules"), path.join(targetDesktop, "node_modules"), { recursive: true });
      }
    } else {
      fs.cpSync(path.join(rootDir, "desktop", file), path.join(targetDesktop, file), { recursive: true });
    }
  }
} catch (err) {
  console.warn("Warning during desktop copy:", err.message);
}

// 6. Ensure data directory
const targetData = path.join(targetDir, "data");
if (!fs.existsSync(targetData)) {
  fs.mkdirSync(targetData, { recursive: true });
}

// Copy documentation & scripts
console.log("[5/6] Generating launch scripts and documentation...");
fs.copyFileSync(path.join(rootDir, "README.md"), path.join(targetDir, "README.md"));
fs.copyFileSync(path.join(rootDir, "LICENSE"), path.join(targetDir, "LICENSE"));
if (fs.existsSync(path.join(rootDir, "ArcRift.vbs"))) {
  fs.copyFileSync(path.join(rootDir, "ArcRift.vbs"), path.join(targetDir, "ArcRift.vbs"));
}
if (fs.existsSync(path.join(rootDir, "ArcRift-settings.json")) && !fs.existsSync(path.join(targetDir, "ArcRift-settings.json"))) {
  fs.copyFileSync(path.join(rootDir, "ArcRift-settings.json"), path.join(targetDir, "ArcRift-settings.json"));
}
if (fs.existsSync(path.join(rootDir, "icon.ico"))) {
  fs.copyFileSync(path.join(rootDir, "icon.ico"), path.join(targetDir, "icon.ico"));
}
if (fs.existsSync(path.join(rootDir, "backend", "bin"))) {
  try {
    fs.cpSync(path.join(rootDir, "backend", "bin"), path.join(targetBackend, "bin"), { recursive: true });
  } catch (err) {
    console.warn("Notice: llama-server binary in use, skipping binary overwrite.");
  }
}

// Create custom Chinese one-click launcher
const batContent = `@echo off
chcp 65001 >nul
title ArcRift - 本地优先 AI 记忆与知识管理系统
echo ========================================================
echo    ArcRift (Nowledge Mem Pure SQLite) 正在启动...
echo ========================================================
echo.

cd /d "%~dp0"

:: 检查 Node.js 环境
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js (https://nodejs.org/)
    pause
    exit /b 1
)

:: 设置生产环境变量
set NODE_ENV=production
set PORT=3001
set ARCRIFT_STORAGE_MODE=sqlite

echo [1/2] 正在启动 Pure SQLite 本地引擎与 MCP Server...
start "" /b node "%~dp0backend\\dist\\index.js"

echo [2/2] 正在打开可视化控制台...
timeout /t 2 /nobreak >nul
start "" "http://localhost:3001"

echo.
echo ========================================================
echo  * 控制台网址: http://localhost:3001
echo  * MCP Server: %~dp0backend\\dist\\mcp\\server.js
echo  * 数据存储目录: %~dp0data\\NowledgeMem.db
echo ========================================================
echo.
echo 服务正在后台运行，关闭此窗口可继续在托盘/后台保持运行。
echo.
`;
fs.writeFileSync(path.join(targetDir, "启动-ArcRift.bat"), batContent, "utf8");

// Create silent VBS launcher
const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "node backend\\dist\\index.js", 0, False
WScript.Sleep 2000
WshShell.Run "http://localhost:3001"
`;
fs.writeFileSync(path.join(targetDir, "后台静默启动.vbs"), vbsContent, "utf8");

// Create MCP config template
const mcpJson = {
  mcpServers: {
    "nowledge-mem": {
      command: "node",
      args: [path.join(targetDir, "backend", "dist", "mcp", "server.js")],
    },
  },
};
fs.writeFileSync(path.join(targetDir, "MCP配置说明.json"), JSON.stringify(mcpJson, null, 2), "utf8");

// Create quick guide
const guideMd = `# ArcRift 本地安装成功指引

## 📍 安装目录
\`${targetDir}\`

---

## 🚀 如何启动应用？

### 方式 A：普通启动 (推荐)
直接双击运行：
👉 **\`启动-ArcRift.bat\`**
- 自动拉起 Pure SQLite 本地引擎
- 自动在默认浏览器中打开控制台：\`http://localhost:3001\`

### 方式 B：后台静默启动 (无黑框)
直接双击运行：
👉 **\`后台静默启动.vbs\`**
- 静默在后台运行引擎，并在浏览器中打开控制台。

---

## 🔌 在 Antigravity / Cursor / Claude Code 中接入 MCP

复制以下 JSON 配置到你的 IDE MCP 配置文件中：

\`\`\`json
{
  "mcpServers": {
    "nowledge-mem": {
      "command": "node",
      "args": ["${path.join(targetDir, "backend", "dist", "mcp", "server.js").replace(/\\/g, "\\\\")}"]
    }
  }
}
\`\`\`

---

## 🧩 浏览器插件安装 (Chrome / Edge)
1. 打开浏览器访问 \`chrome://extensions/\`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择目录：\`${path.join(targetDir, "extension")}\`
`;
fs.writeFileSync(path.join(targetDir, "安装与使用指引.md"), guideMd, "utf8");

console.log("[6/6] Installation completed successfully!");
console.log("\n🎉 ArcRift has been successfully installed to:", targetDir);
