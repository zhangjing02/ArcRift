const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.resolve(__dirname, "../ArcRift.db");
const db = new Database(dbPath);

const id = "mem_" + Date.now();
const sessionId = "BeBeBus";
const title = "OTA 升级接口参数改造与错误码定位";
const content = `# BeBeBus OTA 升级接口参数改造方案

## 1. OTA 开始升级接口传参改造 (POST /api/v2/device/ota/start)
- 在 AiMqttOtaChannel.java 中将 triggerUpgradeTask() 的 .postAsync(...) 改为 .postBodyAsync(...)，将 deviceId 作为 JSON Request Body ({"deviceId":"xxx"}) 提交。

## 2. OTA 错误码机制与协议定位
- 依据 BeBeBus 硬件通信协议文档 2026-08-03.md，设备通过 MQTT cmd=2020 (CMD_OTA_PROGRESS) 上报进度与错误 (status="failed", errorCode, errorMsg)；
- 记录了实测中捕获的硬件真实错误码：errorCode: 12 (安装校验失败) 与 errorCode: 8 (目标版本未升高)；
- 明确了“电量低”与“使用中”未抓取到实际码表的原因及双通道拦截流转机制。

## 3. OTA 状态判定与实时性优化沉淀
- 移除了 15 秒失败超时等待 (2ms 内即时反馈)；
- 根除了 installing 100% 假成功 Bug；
- 修复了重试按钮切回下载状态时文字颜色白色残留的 UI 缺陷。`;

const importance = "critical";
const category = "Architecture";
const tags = JSON.stringify(["OTA", "BLE", "MQTT", "Android"]);
const source = "mcp";
const now = new Date().toISOString();

// Insert Memory Card
db.prepare(`
  INSERT INTO memories (id, sessionId, title, content, importance, category, tags, source, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(id, sessionId, title, content, importance, category, tags, source, now, now);

// Insert Full Chat
db.prepare(`
  INSERT OR REPLACE INTO full_chats (sessionId, rawText, messageCount, platform, createdAt)
  VALUES (?, ?, ?, ?, ?)
`).run(sessionId, content, 1, "mcp", now);

// Update Sessions
db.prepare(`
  INSERT OR REPLACE INTO sessions (id, projectName, platform, summary, tripleCount, topicCount, hasFullChat, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(sessionId, sessionId, "mcp", content, 8, 1, 1, now, now);

console.log("Memory successfully stored directly into database!");
