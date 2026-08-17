const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../ArcRift.db');
console.log('Connecting to database at:', dbPath);
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const projectId = 'ArcRift-Dev';
const projectName = 'ArcRift-Dev';
const now = new Date().toISOString();

const content = `# ArcRift 本地化与轻量化改造核心决策与技术架构

## 1. 项目背景与目标
- 用户电脑无独立显卡，彻底解除对本地重量级 Ollama (8B/14B) 和 Docker (MongoDB/Neo4j/Chroma) 的强制依赖。
- 实现纯轻量化运行环境：使用本地轻量 SQLite (带 WAL 模式与 sqlite-vec 向量扩展) 实现零 Docker 极速冷启动。
- 架构改造支持全功能云端与轻量 API（SiliconFlow 硅基流动、DeepSeek、Google Gemini、OpenAI、Groq 等），支持多模型与动态向量维度适配。

## 2. 核心架构与决策 (Architectural Decisions)
- 存储层架构：统一抽象 ISessionStore, IGraphStore, IVectorStore，由 SqliteSessionStore, SqliteGraphStore, SqliteVectorStore 提供底层支持，开启 SQLite WAL 模式，支持并发读写与 5000ms busy_timeout。
- API 与提取层：extractor.ts 支持标准 OpenAI 兼容的 Chat Completions 协议（如 DeepSeek-V3/R1），支持自动过滤 think 标签并提取结构化知识三元组；支持 Google Gemini 原生 API。
- 向量嵌入层：embeddings.ts 支持 SiliconFlow BGE-M3/BGE-Large、OpenAI text-embedding-3 及 Gemini text-embedding-004，支持 SQLite FTS5 智能回退。
- UI 国际化与控制中心：前端面板全中文汉化（支持中英即时切换），重构 SettingsView.tsx 为可视化模型与 API 配置中心，支持一键切换预设与实时连通性测试。
- 多平台与多 IDE 集成：浏览器端提供 Gemini 网页版插件支持；IDE 端为 Antigravity、Cursor、Codex 提供标准 MCP Server 协议支持。`;

// 1. Insert or update session
const existing = db.prepare('SELECT id FROM sessions WHERE id = ?').get(projectId);
if (!existing) {
  db.prepare(`
    INSERT INTO sessions (id, projectName, platform, summary, tripleCount, hasFullChat, topicCount, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 1, 3, ?, ?)
  `).run(
    projectId,
    projectName,
    'antigravity',
    'ArcRift 本地化与轻量化改造核心决策：全量中文化、多模型云端 API（SiliconFlow/DeepSeek/Gemini/OpenAI）适配、零 Docker SQLite 向量架构、多 IDE MCP 集成与浏览器插件支持。',
    12,
    now,
    now
  );
} else {
  db.prepare(`
    UPDATE sessions SET
      summary = ?,
      tripleCount = ?,
      hasFullChat = 1,
      updatedAt = ?
    WHERE id = ?
  `).run(
    'ArcRift 本地化与轻量化改造核心决策：全量中文化、多模型云端 API（SiliconFlow/DeepSeek/Gemini/OpenAI）适配、零 Docker SQLite 向量架构、多 IDE MCP 集成与浏览器插件支持。',
    12,
    now,
    projectId
  );
}

// 2. Insert or update full chat
db.prepare(`
  INSERT OR REPLACE INTO full_chats (sessionId, rawText, messageCount, platform, createdAt)
  VALUES (?, ?, 1, 'antigravity', ?)
`).run(projectId, content, now);

// 3. Clear old facts and insert rich facts for graph
db.prepare('DELETE FROM facts WHERE sessionId = ?').run(projectId);

const insertFact = db.prepare(`
  INSERT INTO facts (sessionId, subject, subjectType, relation, object, objectType, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const triples = [
  { s: "ArcRift", st: "Tech", r: "uses_storage", o: "SQLite (Zero-Docker)", ot: "Architecture" },
  { s: "ArcRift", st: "Tech", r: "supports_vector_search", o: "sqlite-vec / FTS5", ot: "Tech" },
  { s: "ArcRift", st: "Tech", r: "supports_chat_model", o: "DeepSeek-V3", ot: "Concept" },
  { s: "ArcRift", st: "Tech", r: "supports_chat_model", o: "DeepSeek-R1", ot: "Concept" },
  { s: "ArcRift", st: "Tech", r: "supports_embedding_provider", o: "SiliconFlow (硅基流动)", ot: "Tech" },
  { s: "ArcRift", st: "Tech", r: "supports_provider", o: "Google Gemini", ot: "Tech" },
  { s: "ArcRift", st: "Tech", r: "supports_ide", o: "Antigravity", ot: "Concept" },
  { s: "ArcRift", st: "Tech", r: "supports_ide", o: "Cursor", ot: "Concept" },
  { s: "ArcRift", st: "Tech", r: "supports_ide", o: "Codex", ot: "Concept" },
  { s: "ArcRift", st: "Tech", r: "has_protocol", o: "Model Context Protocol (MCP)", ot: "Architecture" },
  { s: "ArcRift", st: "Tech", r: "supports_platform", o: "Gemini Web Extension", ot: "Tech" },
  { s: "ArcRift", st: "Tech", r: "supports_language", o: "Chinese UI (i18n)", ot: "Concept" },
  { s: "ArcRift", st: "Tech", r: "implements_mode", o: "Zero-Docker Local Mode", ot: "Decision" }
];

for (const t of triples) {
  insertFact.run(projectId, t.s, t.st, t.r, t.o, t.ot, now);
}

// 4. Update active session singleton to ArcRift-Dev so it selects immediately!
db.prepare('UPDATE active_session SET sessionId = ? WHERE id = ?').run(projectId, 'singleton');

console.log(`SUCCESS: ArcRift-Dev recorded with ${triples.length} knowledge facts into ${dbPath}!`);
