# ArcRift 多 IDE MCP 集成配置与使用指南 (MCP Configuration Guide)

> **ArcRift** 提供了基于标准 **Model Context Protocol (MCP)** 的通用长期记忆服务。通过 MCP 集成，您可以将 ArcRift 作为跨平台、跨 IDE 的核心记忆层，直接接入 **Google Antigravity**、**Cursor**、**Claude Code / Codex**、**Windsurf**、**Claude Desktop** 等主流 AI 编程工具中。

---

## 目录
1. [核心能力与架构概览](#1-核心能力与架构概览)
2. [前置构建与编译](#2-前置构建与编译)
3. [多 IDE MCP 配置指南 (绝对路径示例)](#3-多-ide-mcp-配置指南-绝对路径示例)
   - [Google Antigravity](#31-google-antigravity)
   - [Cursor](#32-cursor)
   - [Claude Code / Codex](#33-claude-code--codex)
   - [Windsurf](#34-windsurf)
   - [Claude Desktop](#35-claude-desktop)
   - [VS Code (Cline / Roo Code / Continue)](#36-vs-code-cline--roo-code--continue)
4. [核心 MCP 工具使用场景与实战示例](#4-核心-mcp-工具使用场景与实战示例)
   - [`recall_context` (会话上下文精准召回)](#41-recall_context-会话上下文精准召回)
   - [`store_memory` (关键决策与记忆持久化)](#42-store_memory-关键决策与记忆持久化)
   - [`search_memory` (跨项目全局联想搜索)](#43-search_memory-跨项目全局联想搜索)
   - [`index_codebase` (本地代码库结构索引)](#44-index_codebase-本地代码库结构索引)
   - [辅助管理工具集](#45-辅助管理工具集)
5. [无 Ollama 运行模式与后端降级策略](#5-无-ollama-运行模式与后端降级策略)
6. [故障排查与诊断](#6-故障排查与诊断)

---

## 1. 核心能力与架构概览

ArcRift MCP Server 基于标准 `stdio` 传输协议实现，与浏览器插件共享底层统一数据库（SQLite / Chroma / Neo4j / MongoDB）。

```mermaid
flowchart TD
    subgraph IDE_Clients ["AI 编程环境 (MCP Clients)"]
        A1[Google Antigravity]
        A2[Cursor]
        A3[Claude Code / Codex]
        A4[Windsurf]
    end

    subgraph Browser ["浏览器插件 (Web Extension)"]
        B1[Claude / ChatGPT / Gemini / DeepSeek]
    end

    subgraph ArcRift_Core ["ArcRift 统一内核"]
        S[MCP Server (stdio)]
        HTTP[REST / WebSocket API]
        RAG[Hybrid RAG Engine (Vector + FTS5)]
        KG[Knowledge Graph Extractor]
    end

    subgraph Storage ["统一持久层"]
        DB[(ArcRift.db / SQLite + Vectors)]
        VEC[(Chroma / sqlite-vec)]
    end

    A1 & A2 & A3 & A4 -->|MCP stdio| S
    B1 -->|REST API| HTTP
    S --> RAG & KG
    HTTP --> RAG & KG
    RAG & KG --> DB & VEC
```

---

## 2. 前置构建与编译

在配置 IDE 前，请确保已编译 ArcRift 后端以生成 `dist/mcp/server.js`：

```bash
# 进入 backend 目录
cd d:\Devs\ArcRift\backend

# 安装依赖并打包
npm install
npm run build
```

打包成功后，`backend/dist/mcp/server.js` 即可作为通用的 stdio 可执行入口。

> 💡 **快速生成路径配置**：
> 运行 `npm run mcp:config` 可以自动检测当前系统的绝对路径，并输出格式化好的 JSON 配置块。

---

## 3. 多 IDE MCP 配置指南 (绝对路径示例)

> ⚠️ **路径规范提示**：在 Windows JSON 配置文件中，建议使用正斜杠 `/` 或双反斜杠 `\\`，避免单反斜杠转义失败。

### 3.1 Google Antigravity

Antigravity 原生支持 MCP 扩展规范。您可以在 Antigravity 项目或全局配置中注册 ArcRift。

#### 项目级配置 (`.gemini/mcp.json` 或 `.antigravity/mcp.json`)
在当前工作区根目录下创建或编辑配置文件：

```json
{
  "mcpServers": {
    "arcrift": {
      "command": "node",
      "args": ["d:/Devs/ArcRift/backend/dist/mcp/server.js"],
      "env": {
        "ARCRIFT_STORAGE_MODE": "sqlite",
        "SQLITE_DB_PATH": "d:/Devs/ArcRift/ArcRift.db",
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### 全局配置 (`%USERPROFILE%\.gemini\antigravity\mcp_config.json`)
```json
{
  "mcpServers": {
    "arcrift": {
      "command": "node",
      "args": ["d:/Devs/ArcRift/backend/dist/mcp/server.js"],
      "env": {
        "ARCRIFT_STORAGE_MODE": "sqlite",
        "SQLITE_DB_PATH": "d:/Devs/ArcRift/ArcRift.db",
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

### 3.2 Cursor

Cursor 支持在项目级别或全局设置中集成 MCP Servers。

#### 项目级配置 (`.cursor/mcp.json`)
在代码仓库根目录创建 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "arcrift": {
      "command": "node",
      "args": ["d:/Devs/ArcRift/backend/dist/mcp/server.js"],
      "env": {
        "ARCRIFT_STORAGE_MODE": "sqlite",
        "SQLITE_DB_PATH": "d:/Devs/ArcRift/ArcRift.db",
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### Cursor UI 配置
1. 打开 Cursor：`Settings` → `Features` → `MCP`
2. 点击 `+ Add New MCP Server`
3. 填入：
   - **Name**: `arcrift`
   - **Type**: `command`
   - **Command**: `node d:/Devs/ArcRift/backend/dist/mcp/server.js`

---

### 3.3 Claude Code / Codex

Claude Code (Anthropic 官方 CLI) 支持直接通过命令行命令或 `.mcp.json` 注册。

#### 方法一：命令行一键注册 (推荐)
```bash
claude mcp add arcrift node d:/Devs/ArcRift/backend/dist/mcp/server.js
```

#### 方法二：工作区 `.mcp.json`
在工程根目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "arcrift": {
      "command": "node",
      "args": ["d:/Devs/ArcRift/backend/dist/mcp/server.js"],
      "env": {
        "ARCRIFT_STORAGE_MODE": "sqlite",
        "SQLITE_DB_PATH": "d:/Devs/ArcRift/ArcRift.db"
      }
    }
  }
}
```

---

### 3.4 Windsurf

Windsurf (Codeium Cascade) 支持工作区级与用户级 MCP 配置。

#### 配置文件路径
- **用户全局**: `~/.codeium/windsurf/mcp_config.json`
- **项目工作区**: `.windsurf/mcp.json`

```json
{
  "mcpServers": {
    "arcrift": {
      "command": "node",
      "args": ["d:/Devs/ArcRift/backend/dist/mcp/server.js"],
      "env": {
        "ARCRIFT_STORAGE_MODE": "sqlite",
        "SQLITE_DB_PATH": "d:/Devs/ArcRift/ArcRift.db",
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

### 3.5 Claude Desktop

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "arcrift": {
      "command": "node",
      "args": ["d:/Devs/ArcRift/backend/dist/mcp/server.js"],
      "env": {
        "ARCRIFT_STORAGE_MODE": "sqlite",
        "SQLITE_DB_PATH": "d:/Devs/ArcRift/ArcRift.db"
      }
    }
  }
}
```

---

### 3.6 VS Code (Cline / Roo Code / Continue)

在 VS Code 的 Cline 或 Roo Code 插件设置中：
1. 点击插件面板的 `MCP Servers` 图标
2. 在 JSON 配置文件中添加：

```json
{
  "mcpServers": {
    "arcrift": {
      "command": "node",
      "args": ["d:/Devs/ArcRift/backend/dist/mcp/server.js"],
      "env": {
        "ARCRIFT_STORAGE_MODE": "sqlite",
        "SQLITE_DB_PATH": "d:/Devs/ArcRift/ArcRift.db"
      },
      "disabled": false,
      "autoApprove": [
        "recall_context",
        "search_memory",
        "list_projects",
        "get_project_summary"
      ]
    }
  }
}
```

---

## 4. 核心 MCP 工具使用场景与实战示例

ArcRift MCP 服务向 IDE 暴露了 8 个强大的记忆与上下文工具。以下为四大核心工具及常用辅助工具的详细解析：

### 4.1 `recall_context` (会话上下文精准召回)

#### 适用场景
- 在 IDE 会话启动或切换任务时，召回特定项目在先前开发、架构设计中的上下文。
- 解决大模型上下文窗口丢失、无法跨会话延续设计约定的痛点。

#### 参数定义
```typescript
{
  prompt: string;    // 当前任务描述或具体问题 (必填)
  project?: string;   // 项目 ID 或名称，若省略则自动匹配 (可选)
  topN?: number;      // 返回的相关记忆片段数 (默认 3，最大 6)
  debug?: boolean;    // 是否在返回结果中包含检索引擎标识 (默认 false)
}
```

#### 对话示例
> **开发者提问**: "请帮我继续实现用户认证模块中的 Token 刷新逻辑。"
> 
> **AI 调用 MCP**:
> ```json
> {
>   "name": "recall_context",
>   "arguments": {
>     "prompt": "用户认证 Token 刷新 与 Redis 白名单设计",
>     "project": "ArcRift"
>   }
> }
> ```
> 
> **ArcRift 返回结果**:
> ```text
> Recalled memory for "用户认证 Token 刷新 与 Redis 白名单设计" in project "ArcRift":
> 
> STRUCTURED FACTS:
> - User Auth USES Double_Token_Rotation
> - RefreshToken STORES_IN Redis_Sliding_Window
> - AccessToken EXPIRES_IN 15_Minutes
> 
> RELEVANT CONTEXT CHUNKS:
> [1] (Relevance: 92%)
> 我们决定使用双 Token 机制：Access Token 有效期 15 分钟，Refresh Token 有效期 7 天。当客户端请求刷新时，必须在 Redis 中验证 Refresh Token 的 JTI，并在换发后使旧 Token 立即失效。
> ```

---

### 4.2 `store_memory` (关键决策与记忆持久化)

#### 适用场景
- 当完成一次重要的架构决策、Bug 修复、技术选型或编写了通用工具类后，将经验持久化。
- 数据将同步写入知识图谱与向量库，并在 Web 控制台实时可见。

#### 参数定义
```typescript
{
  content: string;   // 需要持久化的事实、决策、代码模式或总结 (必填)
  project: string;   // 项目 ID 或项目名称 (若不存在将自动创建) (必填)
}
```

#### 对话示例
> **开发者指令**: "把刚才关于数据库连接池与重试机制的结论存入记忆库。"
> 
> **AI 调用 MCP**:
> ```json
> {
>   "name": "store_memory",
>   "arguments": {
>     "project": "ArcRift",
>     "content": "数据库连接池配置：采用 Better-SQLite3 WAL 模式，busyTimeout 设置为 5000ms。高并发写入必须使用 db.transaction() 包装以保证 ACID。"
>   }
> }
> ```
> 
> **ArcRift 返回结果**:
> ```text
> Successfully stored memory in project "ArcRift" (67b2d1...).
> - Visible in Dashboard: Yes
> - Facts extracted: 3
> - Context depth: 1 chunks
> ```

---

### 4.3 `search_memory` (跨项目全局联想搜索)

#### 适用场景
- 跨越所有历史项目、跨时间检索相似的技术方案、通用代码模板或踩坑记录。
- 适合 "我以前在哪个项目里写过类似的支付验签逻辑？" 或 "找一下关于 JWT 异常处理的代码" 等模糊查找。

#### 参数定义
```typescript
{
  query: string;    // 自然语言查询语句 (必填)
  topN?: number;    // 最大返回结果数量 (默认 5，最大 10)
}
```

#### 对话示例
> **开发者提问**: "检索我们在所有项目中关于 Docker Compose 部署 Lite 模式的配置。"
> 
> **AI 调用 MCP**:
> ```json
> {
>   "name": "search_memory",
>   "arguments": {
>     "query": "Docker Compose Lite profile 内存限制"
>   }
> }
> ```
> 
> **ArcRift 返回结果**:
> ```text
> Global search results for "Docker Compose Lite profile 内存限制":
> 
> STRUCTURED FACTS (from Knowledge Graph):
> - [67b2d1a] Docker Compose USES Profile_Lite
> - [67b2d1a] Lite Profile LIMITS_RAM 4GB
> 
> RELEVANT CONTEXT CHUNKS:
> [1] session="67b2d1a" | relevance=88%
> 低内存环境下（< 8GB RAM），启动脚本自动选择 lite profile，关闭 Neo4j，改用嵌入式 SQLite 图谱引擎，节省 2.5GB 内存占用。
> ```

---

### 4.4 `index_codebase` (本地代码库结构索引)

#### 适用场景
- 新接手一个本地项目或打开一个代码仓库时，让 AI 自动扫描并建立该仓库的完整结构与代码片段索引。
- 结合 `recall_context` 让 AI 具备对整个本地源码工程的深度上下文感知。

#### 参数定义
```typescript
{
  directoryPath: string;  // 本地源码目录的绝对路径 (必填)
  sessionId?: string;      // 绑定的项目会话 ID (可选，默认使用当前活动项目)
}
```

#### 对话示例
> **开发者指令**: "为当前目录 d:/Devs/ArcRift/backend 建立代码索引。"
> 
> **AI 调用 MCP**:
> ```json
> {
>   "name": "index_codebase",
>   "arguments": {
>     "directoryPath": "d:/Devs/ArcRift/backend"
>   }
> }
> ```
> 
> **ArcRift 返回结果**:
> ```text
> Successfully indexed codebase at d:\Devs\ArcRift\backend.
> Scanned and chunked 28 files. Skipped 112 files (ignored node_modules/dist or binary).
> ```

---

### 4.5 辅助管理工具集

| 工具名 | 入参 | 作用与使用场景 |
|---|---|---|
| `list_projects` | `{}` | 列出记忆库中所有的项目名称、会话 ID、切片数与更新时间。 |
| `get_project_summary` | `{"project": "项目名或ID"}` | 获取项目的结构化技术画像（技术栈、核心决策、特性列表与三元组）。 |
| `identify_active_project` | `{"path": "路径"}` | 根据当前工作区路径智能识别对应的 ArcRift 项目 ID。 |
| `prune_memory` | `{"prompt": "要遗忘的内容", "project": "项目ID"}` | 手动裁剪或修正过时/错误的记忆条目。 |

---

## 5. 无 Ollama 运行模式与后端降级策略

ArcRift 设计了**全硬件适配与分级降级机制**，即使在没有安装本地 Ollama 或离线环境下，MCP 依然能够稳定工作：

```mermaid
flowchart TD
    Q[MCP 请求发起] --> VCheck{本地 Ollama 是否在线?}
    VCheck -->|在线| LocalVec[Ollama nomic-embed-text 向量检索]
    VCheck -->|离线 / 未安装| FallbackFTS[SQLite FTS5 全文搜索 (BM25 分词)]

    Q --> GCheck{图谱抽取后端选择}
    GCheck --> E1[1. 优先检测 GRAPH_BACKEND 环境变量]
    E1 --> E2[2. 检测本地 Ollama llama3.1]
    E2 --> E3[3. 检测本地 LM Studio / LocalAI]
    E3 --> E4[4. 降级至云端 Groq API]
    E4 --> E5[5. 若无任何 LLM 则降级为纯文本存储]
```

### 1. 向量嵌入自动降级
- **有 Ollama**：使用 `nomic-embed-text` 进行 768 维高精度向量嵌入 + 句子级精确检索（Small-to-Big RAG）。
- **无 Ollama**：系统自动捕获连接异常，平滑降级至 **SQLite FTS5 原生全文检索**（前缀匹配与关键词打分），保证 `recall_context`、`store_memory`、`search_memory`、`index_codebase` 绝不抛出未捕获错误。

### 2. 知识图谱提取降级
- 支持在 `backend/.env` 中配置 `GROQ_API_KEY`，在无本地大模型时通过高速 Groq 云端 API 免费提取知识图谱。
- 支持在 `backend/ArcRift-settings.json` 中配置自定义 Ollama 模型或 LM Studio 兼容端口。

---

## 6. 故障排查与诊断

### Q1: AI 提示 "Cannot find module ... server.js"
- **原因**：尚未编译 TypeScript 源码。
- **解决**：在 `backend` 目录下执行 `npm run build`。

### Q2: Windows 下路径报错或转义失败
- **原因**：JSON 中使用了单个反斜杠 `\`。
- **解决**：统一使用正斜杠 `/`，例如 `"d:/Devs/ArcRift/backend/dist/mcp/server.js"`。

### Q3: 工具调用返回空结果 (No memory found)
- **原因**：新安装环境下数据库尚无记忆数据。
- **解决**：
  1. 使用浏览器插件在任一 AI 网页（如 ChatGPT / Claude / Gemini）中点击【保存当前会话】；
  2. 或在 IDE 中调用一次 `store_memory`，即可完成首次记忆沉淀。

### Q4: 如何验证 MCP Server 运行正常？
- 可以在终端中直接通过 node 启动测试：
  ```bash
  node d:/Devs/ArcRift/backend/dist/mcp/server.js
  ```
  控制台输出 `ArcRift MCP Server running on stdio` 即表示服务启动正常。

---

*ArcRift Universal Memory Layer · 持续进化的 AI 长期记忆系统*
