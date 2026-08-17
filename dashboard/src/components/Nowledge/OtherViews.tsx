import React, { useState, useEffect } from "react";
import type { Session } from "../../types";
import { fetchSources, createSource, deleteSource } from "../../api/ArcRift";

// 📚 资料库 (Library / Source Management)
export const LibraryView: React.FC<{ activeSession?: Session }> = ({ activeSession }) => {
  const [sources, setSources] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"url" | "file" | "document" | "note">("document");
  const [url, setUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSource, setSelectedSource] = useState<any | null>(null);

  useEffect(() => {
    loadSources();
  }, [activeSession?._id]);

  const loadSources = async () => {
    try {
      const res = await fetchSources(activeSession?._id);
      if (res.success) {
        setSources(res.sources);
      }
    } catch (e) {
      console.error("Failed to load sources", e);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await createSource({
        sessionId: activeSession?._id,
        name: name.trim(),
        sourceType,
        url: url.trim() || undefined,
        summary: summary.trim() || undefined,
        rawContent: rawContent.trim() || undefined,
        labels: [sourceType],
      });
      if (res.success) {
        setName("");
        setUrl("");
        setSummary("");
        setRawContent("");
        setIsAdding(false);
        loadSources();
      }
    } catch (err) {
      console.error("Failed to add source", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此信源资料吗？")) return;
    try {
      await deleteSource(id);
      loadSources();
      if (selectedSource?.id === id) setSelectedSource(null);
    } catch (e) {
      console.error("Delete source error", e);
    }
  };

  return (
    <div className="nl-view-container">
      <div className="nl-view-header">
        <div className="nl-view-title-group">
          <h1 className="nl-view-title">资料库</h1>
          <p className="nl-view-subtitle">管理本地源码库索引、技术文档、网页信源与外部资料</p>
        </div>
        <button
          className="nl-btn-primary"
          onClick={() => setIsAdding(!isAdding)}
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          {isAdding ? "取消" : "+ 新增信源资料"}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddSubmit} className="nl-card" style={{ marginBottom: 20, animation: "fadeIn 0.2s ease" }}>
          <h3 style={{ marginBottom: 14 }}>📥 添加新信源 / 文档资料</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#8b909a", marginBottom: 4 }}>资料名称 *</label>
              <input
                type="text"
                placeholder="例如: OAuth2 架构白皮书 / API 设计指南"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="nl-input"
                style={{ width: "100%" }}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#8b909a", marginBottom: 4 }}>信源类型</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as any)}
                className="nl-input"
                style={{ width: "100%" }}
              >
                <option value="document">技术文档 / Markdown (document)</option>
                <option value="url">网页链接 / URL (url)</option>
                <option value="file">本地代码库 / 源码 (file)</option>
                <option value="note">参考备忘 (note)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "#8b909a", marginBottom: 4 }}>URL 或文件路径（可选）</label>
            <input
              type="text"
              placeholder="https://... 或 D:\Workspace\Project"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="nl-input"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "#8b909a", marginBottom: 4 }}>概要摘要（可选）</label>
            <input
              type="text"
              placeholder="一两句话说明该信源的核心要点"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="nl-input"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "#8b909a", marginBottom: 4 }}>正文内容（可选，供大模型检索与引用）</label>
            <textarea
              placeholder="在此粘贴文档全文、Markdown 或核心内容..."
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              className="nl-input"
              style={{ width: "100%", height: 100, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="nl-btn-secondary" onClick={() => setIsAdding(false)}>取消</button>
            <button type="submit" className="nl-btn-primary">保存入库</button>
          </div>
        </form>
      )}

      <div className="nl-card">
        <h3 style={{ marginBottom: 14 }}>已归档的信源与资料清单 ({sources.length})</h3>
        {sources.length === 0 ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "#8b909a" }}>
            暂无信源资料。点击右上角「+ 新增信源资料」添加文档、URL 或源码索引。
          </div>
        ) : (
          <div className="nl-list">
            {sources.map((src) => (
              <div
                key={src.id}
                className="nl-list-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 10px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  cursor: "pointer",
                  borderRadius: 6,
                  transition: "background 0.15s ease",
                }}
                onClick={() => setSelectedSource(src)}
              >
                <span style={{ fontSize: 18, marginRight: 12 }}>
                  {src.sourceType === "url" ? "🌐" : src.sourceType === "file" ? "📁" : "📄"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 500, fontSize: 14, color: "#f8fafc" }}>{src.name}</span>
                    <span className="nl-tag-pill" style={{ fontSize: 11 }}>{src.sourceType}</span>
                    <span style={{ fontSize: 11, color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "1px 6px", borderRadius: 4 }}>
                      {src.lifecycleState || "indexed"}
                    </span>
                  </div>
                  {src.summary && <p style={{ fontSize: 12, color: "#8b909a", marginTop: 2 }}>{src.summary}</p>}
                </div>
                <button
                  className="nl-btn-icon"
                  style={{ color: "#ef4444", padding: "4px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(src.id);
                  }}
                  title="删除信源"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedSource && (
        <div className="nl-modal-backdrop" onClick={() => setSelectedSource(null)}>
          <div className="nl-modal-card" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3>📄 信源详情: {selectedSource.name}</h3>
              <button className="nl-btn-icon" onClick={() => setSelectedSource(null)}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: "#8b909a", marginBottom: 12 }}>
              <div>类型: <strong>{selectedSource.sourceType}</strong> | 状态: <strong>{selectedSource.lifecycleState}</strong></div>
              {selectedSource.url && <div style={{ marginTop: 4 }}>地址: <a href={selectedSource.url} target="_blank" rel="noreferrer" style={{ color: "#6366f1" }}>{selectedSource.url}</a></div>}
            </div>
            {selectedSource.summary && (
              <div style={{ background: "rgba(255,255,255,0.03)", padding: 10, borderRadius: 6, marginBottom: 12 }}>
                <strong>摘要:</strong> {selectedSource.summary}
              </div>
            )}
            <div style={{ maxHeight: 250, overflowY: "auto", background: "#0b0e14", padding: 12, borderRadius: 6, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>
              {selectedSource.rawContent || "（无原始正文内容）"}
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button className="nl-btn-secondary" onClick={() => setSelectedSource(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
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
