<div align="center">

# ArcRift — 本地化 AI 记忆与知识管理系统

### 让 AI 工具不再失忆。跨会话、跨工具的持久记忆层。

**一个面向开发者的本地优先记忆引擎——捕获 AI 会话、构建可搜索的知识图谱，并自动将最相关的上下文注入每一个新 Prompt。无需云端，无需订阅，无需重复解释背景。**

<br/>

[![Version](https://img.shields.io/badge/version-1.6.3-6366F1?style=for-the-badge&labelColor=0B0E14)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-F8FAFC?style=for-the-badge&labelColor=0B0E14)](LICENSE)
[![Storage](https://img.shields.io/badge/存储-本地SQLite-10B981?style=for-the-badge&labelColor=0B0E14)]()
[![MCP](https://img.shields.io/badge/协议-MCP-F97316?style=for-the-badge&labelColor=0B0E14)]()

<br/>

</div>

---

## 项目简介

本项目基于开源项目 [ArcRift](https://github.com/Eshaan-Nair/ArcRift) 改造而来，目标是复刻并增强 **Nowledge Mem** 的风格与功能体系，形成一套完整的本地 AI 记忆管理平台。

项目保留了 ArcRift 的核心技术架构（RAG 检索、知识图谱提取、MCP Server），并在此基础上重构了整个前端界面、扩展了记忆管理功能、优化了国产 API 适配（硅基流动、DeepSeek 等），使其更贴近 Nowledge Mem 的产品形态与中文使用场景。

---

## 核心功能

### 🧠 持久记忆层
- **Memory Card（记忆卡片）**：将 AI 对话中的关键信息（架构决策、技术方案、踩坑经验）手动或自动结构化保存，支持重要程度（critical / high / medium / low）和分类（Architecture / Decision / Gotcha / Rule / Tech / Note）标记。
- **Working Memory（工作记忆）**：每个项目维护一份动态简报，包含当前聚焦点、活跃决策、已知障碍，可通过 AI 自动生成或手动维护。
- **Timeline（时间线）**：以时间轴形式浏览项目的记忆与事件演化历史。

### 🕸️ 知识图谱
- 自动从对话文本中提取主谓宾三元组（Subject → Relation → Object），构建项目级知识图谱。
- 支持 D3.js 交互式可视化，可右键重命名节点、剪除边、删除节点。
- 支持跨会话全局搜索（Hybrid Search：向量检索 + FTS5 关键词检索融合）。

### 🔌 MCP Server（模型上下文协议）
支持接入主流 AI 编程工具，暴露以下 MCP 工具：

| 工具 | 说明 |
|------|------|
| `get_working_memory` | 获取项目工作记忆简报（焦点、决策、障碍） |
| `update_working_memory` | 更新工作记忆 |
| `recall_context` | 混合检索最相关的记忆片段，注入到当前 Prompt |
| `store_memory` | 保存文本/决策到长期记忆（自动提取知识图谱三元组 + 向量存储） |
| `prune_memory` | 外科式删除过时或错误的记忆 |
| `search_memory` | 跨项目全局语义搜索 |
| `list_projects` | 列出所有项目/空间 |
| `get_project_summary` | 获取项目知识图谱摘要 |
| `identify_active_project` | 根据工作目录自动匹配项目 ID |
| `index_codebase` | 扫描并索引本地代码目录到记忆图谱 |

**支持接入的 AI 工具：**
- Google Antigravity（反重力）
- Cursor
- Gemini CLI
- Claude Desktop
- Claude Code
- Windsurf
- VS Code / Copilot

### 🌐 浏览器扩展
自动捕获以下平台的 AI 会话内容，并同步到本地记忆库：
- Claude、ChatGPT、Gemini、DeepSeek、Grok/X、Copilot、Mistral

### 🖥️ 桌面客户端（Tauri）
- 基于 Tauri（Rust）+ React + Vite 构建的原生桌面应用
- 常驻系统托盘，后台静默运行
- Nowledge Mem 风格的侧边栏导航界面（中文化）

---

## 项目结构

```
ArcRift/
├── backend/                 # 后端核心服务（Node.js + TypeScript + Express 5）
│   ├── src/
│   │   ├── index.ts         # 应用入口，路由注册，中间件配置
│   │   ├── routes/          # API 路由层（12个路由模块）
│   │   │   ├── memories.ts      # 记忆卡片 CRUD
│   │   │   ├── workingMemory.ts # 工作记忆管理 + AI自动生成
│   │   │   ├── rag.ts           # RAG检索 (向量+图谱混合)
│   │   │   ├── graph.ts         # 知识图谱操作
│   │   │   ├── chat.ts          # 对话存储
│   │   │   ├── session.ts       # 项目/空间管理
│   │   │   ├── context.ts       # 上下文注入
│   │   │   ├── settings.ts      # 系统设置
│   │   │   ├── tools.ts         # AI工具检测与MCP自动连接
│   │   │   ├── models.ts        # 模型切换管理
│   │   │   ├── health.ts        # 系统健康检查
│   │   │   └── jobs.ts          # 后台任务队列
│   │   ├── services/        # 业务逻辑层
│   │   │   ├── storage.ts       # 统一存储门面（SQLite/Docker双模式）
│   │   │   ├── storage.types.ts # 类型定义（Memory, Session, Triple, WorkingMemory等）
│   │   │   ├── sqlite.ts        # SQLite数据库初始化
│   │   │   ├── sqlite-memory.ts # 记忆卡片存储层
│   │   │   ├── sqlite-session.ts# 会话/项目存储层
│   │   │   ├── sqlite-graph.ts  # 知识图谱三元组存储层
│   │   │   ├── sqlite-vector.ts # 向量检索层（sqlite-vec）
│   │   │   ├── extractor.ts     # LLM三元组提取（支持多Provider）
│   │   │   ├── embeddings.ts    # 向量嵌入（OpenAI兼容接口）
│   │   │   ├── jobs.ts          # 后台任务Worker
│   │   │   ├── modelManager.ts  # AI模型配置管理器
│   │   │   ├── chunker.ts       # 滑动窗口文本分块
│   │   │   ├── hyde.ts          # HyDE假设文档嵌入
│   │   │   ├── indexer.ts       # 本地代码目录索引
│   │   │   └── backup.ts        # 自动备份（每周SQLite快照）
│   │   ├── mcp/             # MCP Server（stdio传输）
│   │   │   ├── server.ts        # MCP服务入口，工具注册
│   │   │   └── tools/           # 各MCP工具实现（10个工具）
│   │   ├── middleware/      # 中间件（Prompt注入防御 + PII脱敏）
│   │   └── utils/           # 工具函数（logger, validators等）
│   ├── .env.example         # 环境变量配置模板
│   └── ArcRift-settings.json # 运行时设置持久化文件
│
├── dashboard/               # 桌面客户端前端（React + Vite + Tauri）
│   ├── src/
│   │   ├── App.tsx          # 应用根组件，路由控制
│   │   ├── index.css        # 全局样式（Nowledge Mem主题）
│   │   ├── components/
│   │   │   └── Nowledge/    # Nowledge Mem风格组件库
│   │   │       ├── NowledgeSidebar.tsx   # 侧边栏导航（中文化）
│   │   │       ├── TimelineView.tsx      # 时间线视图
│   │   │       ├── MemoriesView.tsx      # 记忆管理视图
│   │   │       ├── ThreadsView.tsx       # 会话记录视图
│   │   │       ├── AiNowView.tsx         # AI Now实时对话视图
│   │   │       ├── NowledgeGraphView.tsx # 知识图谱可视化（D3.js）
│   │   │       ├── SkillsView.tsx        # 技能管理视图
│   │   │       ├── NowledgeSettingsView.tsx # 设置面板
│   │   │       ├── ConnectView.tsx       # AI工具连接管理
│   │   │       └── OtherViews.tsx        # 资料库/知识树/统计/上下文等视图
│   │   ├── api/             # API客户端（ArcRift.ts）
│   │   ├── hooks/           # React Hooks（useSessions等）
│   │   ├── context/         # LocaleContext（国际化）
│   │   └── types/           # TypeScript类型定义
│   └── src-tauri/           # Tauri Rust壳（桌面应用打包）
│
├── extension/               # 浏览器扩展（Chrome/Firefox，Manifest V3）
│   ├── manifest.json        # 扩展清单（支持7个AI平台）
│   ├── src/                 # 扩展核心逻辑
│   └── popup/               # 扩展弹出界面
│
├── docker-compose.yml       # Docker模式（Neo4j + MongoDB + ChromaDB）
├── start.bat / start.sh     # 一键启动脚本
└── install.bat / install.sh # 一键安装脚本
```

---

## 技术架构

### 数据流

```
[浏览器扩展 / MCP工具 / 手动输入]
         │
         ▼
POST /api/memories 或 /api/chat/save
         │
    ┌────┴─────────────────────┐
    │                          │
    ▼                          ▼
向量轨道（RAG）           图谱轨道（知识图谱）
slidingWindowChunks()    extractTriples() → LLM
→ generateEmbeddings()   → SQLite facts表
→ sqlite-vec 存储        → 更新 tripleCount
```

```
[AI工具 / 扩展发起Prompt]
         │
         ▼
POST /api/rag/retrieve 或 MCP recall_context
         │
    HyDE假设文档嵌入
    → sqlite-vec 向量检索（相似度 ≥ 0.30）
    → FTS5 关键词检索
    → 混合融合排序
    → 注入Prompt上下文
```

### 技术栈

| 层次 | 技术 |
|------|------|
| 后端框架 | Node.js + TypeScript + Express 5 + Esbuild |
| 本地存储（默认） | better-sqlite3 + sqlite-vec（零Docker依赖） |
| 向量检索 | sqlite-vec（默认）/ ChromaDB（Docker模式） |
| 知识图谱 | SQLite facts表（默认）/ Neo4j（Docker模式） |
| 会话存储 | SQLite sessions表 / MongoDB（Docker模式） |
| LLM接口 | OpenAI兼容（Ollama/硅基流动/DeepSeek/OpenAI/Gemini/Groq） |
| 桌面客户端 | Tauri 2（Rust）+ React 18 + Vite |
| 浏览器扩展 | Manifest V3，TypeScript |
| MCP协议 | @modelcontextprotocol/sdk（stdio传输） |
| 安全防护 | helmet + CORS + 速率限制 + PII脱敏 + Prompt注入防御 |

---

## 安装与启动

### 前置依赖

- **Node.js** >= 18
- **Ollama**（本地模式）或任意 OpenAI 兼容 API

### 快速启动（开发模式）

**1. 安装依赖并配置环境变量**

```bash
cd backend
npm install
copy .env.example .env
# 编辑 .env 填写LLM和Embedding配置
```

**2. 启动后端**

```bash
cd backend
npm run dev
# 后端运行在 http://localhost:3001
```

**3. 启动前端（可选）**

```bash
cd dashboard
npm install
npm run dev
# 前端运行在 http://localhost:5173
```

> **提示**：将前端构建后（`npm run build`），后端会自动托管 Dashboard，直接访问 `http://localhost:3001` 即可。

### 环境变量配置

**方案一：硅基流动（国内推荐）**
```env
API_BASE_URL=https://api.siliconflow.cn/v1
API_KEY=sk-your-key
CHAT_MODEL=deepseek-ai/DeepSeek-V3
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_API_KEY=sk-your-key
EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5
```

**方案二：本地 Ollama（离线）**
```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

**方案三：DeepSeek 官方**
```env
API_BASE_URL=https://api.deepseek.com/v1
API_KEY=sk-your-deepseek-key
CHAT_MODEL=deepseek-chat
```

---

## MCP 接入配置

### 一键生成配置

```bash
cd backend && npm run mcp:config
```

### Google Antigravity / Gemini CLI

`~/.gemini/config/mcp_config.json`：

```json
{
  "mcpServers": {
    "arcrift": {
      "command": "node",
      "args": ["C:/path/to/ArcRift/backend/dist/mcp/server.js"],
      "env": {}
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "arcrift": {
      "command": "node",
      "args": ["/path/to/ArcRift/backend/dist/mcp/server.js"]
    }
  }
}
```

### Claude Desktop（Windows）

`%APPDATA%\Claude\claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "arcrift": {
      "command": "node",
      "args": ["C:/path/to/ArcRift/backend/dist/mcp/server.js"]
    }
  }
}
```

> 也可在 Dashboard → **连接** 页面点击「一键连接」自动写入配置。

---

## 浏览器扩展安装

### Chrome / Edge / Brave

```bash
cd extension
npm install && npm run build
```
然后在 `chrome://extensions` 中开启开发者模式，加载 `extension/` 目录。

### Firefox

将 `extension/ArcRift.xpi` 拖入 Firefox 窗口直接安装。

---

## 当前开发进度

### ✅ 已完成

- [x] 后端核心架构（Express 5 + TypeScript + Esbuild）
- [x] SQLite 零依赖存储（sessions / facts / vectors / memories / working_memory）
- [x] Docker 扩展存储模式（Neo4j + MongoDB + ChromaDB）
- [x] RAG 检索流程（HyDE + 混合检索 + 语义阈值过滤）
- [x] 知识图谱三元组自动提取（LLM）
- [x] MCP Server（10个工具，含 Working Memory 支持）
- [x] Memory Card 记忆卡片 API（CRUD + 向量 + 图谱联动）
- [x] Working Memory 工作记忆 API（AI自动生成简报）
- [x] AI 工具自动检测与一键 MCP 连接
- [x] 国产 API 适配（硅基流动、DeepSeek）
- [x] 浏览器扩展（Chrome/Firefox，支持7个平台）
- [x] Dashboard 前端（Nowledge Mem 风格重构，中文化）
  - [x] NowledgeSidebar / TimelineView / MemoriesView
  - [x] ThreadsView / AiNowView / NowledgeGraphView
  - [x] SkillsView / ConnectView / NowledgeSettingsView
- [x] Tauri 桌面应用打包（.exe / .dmg / .AppImage）
- [x] 自动 SQLite 备份（每周快照）

### 🚧 待开发（对齐 Nowledge Mem 功能）

- [ ] Communities（知识社区/聚类发现）
- [ ] Memory Evolution（记忆演化链，版本管理）
- [ ] Memory Relations（记忆关系图谱）
- [ ] Source Management（信源追踪：URL/PDF/文件）
- [ ] Artifact Support（产出物结构化存储）
- [ ] Multi-Space（多空间/团队隔离）
- [ ] Daily Review（每日工作记忆推送）
- [ ] 完整对齐 Nowledge Mem MCP 工具接口规范

---

## 安全说明

| 控制项 | 实现 |
|--------|------|
| CORS 限制 | 仅允许 localhost / chrome-extension:// 来源 |
| 速率限制 | 全局 200次/分；保存接口 10次/分 |
| 安全响应头 | helmet 中间件 |
| PII 脱敏 | 发送前在浏览器端脱敏 |
| Prompt注入防御 | 10种模式扫描 + 分隔符保护 |
| 完全本地化 | 数据仅存储在本机 SQLite，不上传云端 |

---

## 致谢

本项目基于 [ArcRift](https://github.com/Eshaan-Nair/ArcRift)（MIT License）开源项目二次开发，向原作者 Eshaan Nair 致谢。

---

## License

[MIT](LICENSE)
