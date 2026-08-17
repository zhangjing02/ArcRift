# ArcRift v2.0.0 — Pure SQLite Local-First AI Memory & Knowledge Management

### 🎉 欢迎使用 ArcRift v2.0.0 重大里程碑版本！
本版本对原有 ArcRift 架构进行了全面的重构升级，100% 对齐 **Nowledge Mem** 官方规范与协议体系，彻底拥抱 **Zero-Docker Pure SQLite 单文件零依赖架构**，为开发者和 AI Agent 提供极速、私密、跨工具的持久记忆与知识图谱管理。

---

## 🌟 核心特性与架构升级 (What's New)

### 1. ⚡ 100% Pure SQLite 单文件架构 (Zero-Docker)
- 彻底摒弃 Neo4j、MongoDB 和 ChromaDB 外部容器依赖。
- 单文件数据库 `<AppRoot>/data/NowledgeMem.db` 收敛存储所有会话、记忆卡片、实体三元组、768 维向量索引（`sqlite-vec`）与 FTS5 BM25 全文索引，读写延迟降低至亚毫秒级（<1ms）。
- 数据路径与盘符解耦，严禁污染系统 C 盘，数据完全私有本地掌控。

### 2. 🌲 知识树 (Knowledge Tree) & 🚀 项目第一顺位分类体系
- **项目第一顺位 (By Project)**：专为 Coding 场景设计，Agent 自动推断当前项目并打上首要标签，知识树置顶展示项目分类。
- **5 大多维记忆子树**：
  - `💡 全部记忆 (All Memories)`：扁平精选流与抽屉详情探查。
  - `🚀 按项目 (By Project)`：按 Coding 仓库一键穿透项目记忆。
  - `📅 按日期 (By Date)`：内嵌 30 天 5 级活动热力月历，按天追溯沉淀。
  - `🏷️ 标签 (Tags)`：项目标签置顶高亮 + 概念技术标签 2 列卡片网格。
  - `💎 结晶 (Crystals)`：高重要度（Critical/High）关键架构决策与技术结晶。
  - `💡 按类型 (By Type)`：8 大认知类型（事实、偏好、决策、计划、流程、学习、上下文、事件）分类专页。

### 3. 📅 现代化时间线、记忆详情与会话记录
- **时间线 (Timeline)**：快速捕获输入框、6 大筛选 Pill、连续记忆折叠聚合卡片、右侧知识概览看板与 30 天活动日历。
- **记忆 (Memories)**：普通/深度搜索、五星交互评级、2-Column 面包屑全屏详情页与图谱直达。
- **会话记录 (Threads)**：智能体会话切换、平台彩色图标、对话气泡流与一键提炼记忆。

### 4. 🔌 完整 Nowledge Mem MCP 工具协议 (20+ Tools)
- 涵盖 `memory_add`, `memory_search`, `get_memory_by_id`, `memory_update`, `memory_delete`, `read_working_memory`, `update_working_memory`, `list_spaces`, `get_space_profile`, `explore_graph`, `graph_stats`, `memory_relation_add/list/delete`, `query_sources`, `read_source_content`, `list_communities`, `run_community_detection`, `get_community_details`, `memory_evolves_chain`, `memory_supersede`, `mem_fs`, `check_claims`, `list_timeline_reviews`, `resolve_timeline_review` 等。

---

## 📦 下载与安装指引

### 方式一：Windows 绿色免安装版 (推荐)
1. 下载 **`ArcRift-Windows-Portable-v2.0.0.zip`**；
2. 解压到任意目录（如 `D:\ArcRift`）；
3. 双击运行 **`NowledgeMem.bat`** 即可一键拉起后端引擎并在浏览器中打开控制台！
4. 在 Antigravity / Cursor / Claude Code 中配置本地 MCP 连接：
```json
{
  "mcpServers": {
    "nowledge-mem": {
      "command": "node",
      "args": ["<你的解压目录>/backend/dist/mcp/index.js"]
    }
  }
}
```

### 方式二：浏览器扩展插件 (Chrome / Edge)
1. 下载 **`ArcRift-Browser-Extension-v2.0.0.zip`** 并解压；
2. 打开 Chrome 或 Edge 浏览器，访问 `chrome://extensions/` 或 `edge://extensions/`；
3. 开启右上角的 **「开发者模式」**；
4. 点击 **「加载已解压的扩展程序」**，选择刚才解压的 `ArcRift-Browser-Extension-v2.0.0` 文件夹即可！
