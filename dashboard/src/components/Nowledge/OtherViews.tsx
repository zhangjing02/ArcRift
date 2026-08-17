import React, { useState } from "react";
import type { Session } from "../../types";

// 📚 资料库 (Library)
export const LibraryView: React.FC<{ activeSession?: Session }> = () => {
  const [folderPath, setFolderPath] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexedFiles, setIndexedFiles] = useState<string[]>([
    "src/mcp/server.ts (MCP 协议服务定义)",
    "src/services/sqlite.ts (SQLite 向量存储与表定义)",
    "src/services/extractor.ts (实体三元组提取引擎)",
  ]);

  return (
    <div className="nl-view-container">
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">资料库</h1>
          <p className="nl-view-subtitle">管理本地源码库索引、技术文档与外部资料</p>
        </div>
      </div>

      <div className="nl-card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>📁 索引本地源码库到项目图谱</h3>
        <p style={{ color: "#8b909a", fontSize: 13, marginBottom: 16 }}>
          输入本地代码库的绝对路径，ArcRift 将扫描并提取 AST 结构、类型定义与架构依赖，自动融合进知识图谱。
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="text"
            placeholder="例如: d:\Devs\BeBeBus_Android002"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            className="nl-input"
            style={{ flex: 1 }}
          />
          <button
            className="nl-btn-primary"
            disabled={!folderPath.trim() || isIndexing}
            onClick={() => {
              setIsIndexing(true);
              setTimeout(() => {
                setIndexedFiles((prev) => [...prev, `${folderPath} (已建立索引)`]);
                setFolderPath("");
                setIsIndexing(false);
              }, 1200);
            }}
          >
            {isIndexing ? "正在索引..." : "开始索引"}
          </button>
        </div>
      </div>

      <div className="nl-card">
        <h3 style={{ marginBottom: 14 }}>已索引的代码库与资料</h3>
        <div className="nl-list">
          {indexedFiles.map((file, idx) => (
            <div key={idx} className="nl-list-item" style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ marginRight: 10 }}>📄</span>
              <span style={{ flex: 1 }}>{file}</span>
              <span className="nl-tag-pill">已同步</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 🌲 知识树 (Knowledge Tree)
export const KnowledgeTreeView: React.FC<{ activeSession?: Session }> = () => {
  return (
    <div className="nl-view-container">
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">知识树</h1>
          <p className="nl-view-subtitle">按主题与认知层级自动分类的多维知识树</p>
        </div>
      </div>

      <div className="nl-tree-grid">
        <div className="nl-tree-branch">
          <h3>🏛️ 架构设计 (Architecture)</h3>
          <ul>
            <li>BLE + 4G MQTT 混合双通道流转</li>
            <li>Zero-Docker 极轻量 SQLite 架构</li>
            <li>MCP (Model Context Protocol) 跨 IDE 协议</li>
          </ul>
        </div>

        <div className="nl-tree-branch">
          <h3>⚖️ 技术决策 (Decisions)</h3>
          <ul>
            <li>OTA 接口重构：POST Body JSON 提交</li>
            <li>错误码 12/8 双通道即时反馈机制</li>
            <li>桌面端 Electron 静默拉起与托盘常驻</li>
          </ul>
        </div>

        <div className="nl-tree-branch">
          <h3>⚠️ 避坑记录 (Gotchas)</h3>
          <ul>
            <li>消除 15s 假成功超时等待</li>
            <li>避免 Windows GUI 环境变量丢失 node 绝对路径</li>
            <li>保留本地三元组中文提取结构化</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// ❖ 技能 (Skills)
export const SkillsView: React.FC = () => {
  const skills = [
    { name: "get_working_memory", desc: "读取当前项目今日态势与工作记忆简报", status: "已激活" },
    { name: "update_working_memory", desc: "更新工作记忆的焦点、决策与阻塞风险", status: "已激活" },
    { name: "store_memory", desc: "将关键事实、架构结论存入知识图谱与向量库", status: "已激活" },
    { name: "recall_context", desc: "基于当前任务精准召回多维上下文片段", status: "已激活" },
    { name: "search_memory", desc: "跨项目与全局混合检索历史记忆与事实", status: "已激活" },
    { name: "index_codebase", desc: "深度扫描本地源码库并建立知识节点", status: "已激活" },
  ];

  return (
    <div className="nl-view-container">
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">技能 (MCP Agent Skills)</h1>
          <p className="nl-view-subtitle">为 Antigravity、Cursor、Claude Code 赋能的 10 个核心能力</p>
        </div>
      </div>

      <div className="nl-skills-grid">
        {skills.map((s) => (
          <div key={s.name} className="nl-skill-card">
            <div className="nl-skill-header">
              <span className="nl-skill-name">{s.name}</span>
              <span className="nl-skill-status">● {s.status}</span>
            </div>
            <p className="nl-skill-desc">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ⊘ 上下文 (Context)
export const ContextView: React.FC<{ activeSession?: Session }> = ({ activeSession }) => {
  return (
    <div className="nl-view-container">
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">实时上下文</h1>
          <p className="nl-view-subtitle">AI 智能体在当前项目中可读取的上下文束 (Context Bundle)</p>
        </div>
      </div>

      <div className="nl-card">
        <h3 style={{ marginBottom: 12 }}>当前注入上下文预览</h3>
        <pre className="nl-context-bundle-code">
{`<ARCRIFT_retrieved_context>
[项目]: ${activeSession?.projectName || "ArcRift"}
[协议]: MCP Zero-Docker Local Mode
[知识节点]: ${activeSession?.tripleCount || 0} 个实体事实已就绪
[工作记忆]: ${activeSession?.summary?.slice(0, 150) || "已连接本地向量库"}...
</ARCRIFT_retrieved_context>`}
        </pre>
      </div>
    </div>
  );
};

// 📊 统计 (Stats)
export const StatsView: React.FC<{ sessions: Session[] }> = ({ sessions }) => {
  const totalTriples = sessions.reduce((acc, s) => acc + (s.tripleCount || 0), 0);
  const totalTopics = sessions.reduce((acc, s) => acc + (s.topicCount || 0), 0);

  return (
    <div className="nl-view-container">
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">记忆统计</h1>
          <p className="nl-view-subtitle">全脑记忆存储、知识沉淀与命中效率大盘</p>
        </div>
      </div>

      <div className="nl-stats-grid-large">
        <div className="nl-stat-card-lg">
          <div className="nl-stat-lg-num">{sessions.length}</div>
          <div className="nl-stat-lg-title">项目空间总数</div>
        </div>
        <div className="nl-stat-card-lg">
          <div className="nl-stat-lg-num">{totalTriples}</div>
          <div className="nl-stat-lg-title">图谱知识三元组</div>
        </div>
        <div className="nl-stat-card-lg">
          <div className="nl-stat-lg-num">{totalTopics}</div>
          <div className="nl-stat-lg-title">会话切片与文档</div>
        </div>
        <div className="nl-stat-card-lg">
          <div className="nl-stat-lg-num">100%</div>
          <div className="nl-stat-lg-title">本地隐私掌控度</div>
        </div>
      </div>
    </div>
  );
};
