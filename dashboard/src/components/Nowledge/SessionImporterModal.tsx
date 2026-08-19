import React, { useState } from "react";

interface SessionImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

interface DiscoveredAgentSession {
  id: string;
  platform: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  path?: string;
  snippet?: string;
}

export const SessionImporterModal: React.FC<SessionImporterModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredSessions, setDiscoveredSessions] = useState<DiscoveredAgentSession[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleScanAgents = async () => {
    setIsScanning(true);
    setStatusText("正在扫描本机 AI 助手会话 (Antigravity, Codex, Claude Code, Cursor)...");
    try {
      const res = await fetch("http://localhost:3001/api/session/scan-agents");
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        setDiscoveredSessions(data.sessions);
        // Select all by default
        const allIds = new Set<string>(data.sessions.map((s: DiscoveredAgentSession) => s.id));
        setSelectedIds(allIds);
        setStatusText(`扫描完成！发现 ${data.sessions.length} 个智能体会话。`);
      } else {
        setStatusText("未发现新的本地 AI 会话记录。");
      }
    } catch (err: any) {
      console.error("Failed to scan agent sessions:", err);
      setStatusText("扫描过程发生错误，请确认后端服务正常运行。");
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleImportSelected = async () => {
    if (selectedIds.size === 0 || isImporting) return;
    setIsImporting(true);
    setStatusText(`正在导入选中的 ${selectedIds.size} 个会话...`);
    try {
      const toImport = discoveredSessions.filter((s) => selectedIds.has(s.id));
      const res = await fetch("http://localhost:3001/api/session/import-agent-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions: toImport }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusText(`成功导入 ${data.importedCount} 个会话！`);
        setTimeout(() => {
          onImportSuccess?.();
          onClose();
        }, 1200);
      } else {
        setStatusText("导入失败：" + (data.error || "未知错误"));
      }
    } catch (err: any) {
      setStatusText("导入发生异常：" + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "single" | "batch") => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsImporting(true);
    setStatusText(`正在读取并解析上传的 ${files.length} 个文件...`);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const text = await file.text();
        const projectName = file.name.replace(/\.[^/.]+$/, "");

        // Save session
        const sessRes = await fetch("http://localhost:3001/api/session/import-markdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectName,
            platform: type === "single" ? "markdown" : "batch_import",
            rawText: text,
          }),
        });
        await sessRes.json();
      }

      setStatusText(`文件导入完成！`);
      setTimeout(() => {
        onImportSuccess?.();
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusText("文件导入失败：" + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#12141a",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "580px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "28px 32px",
          color: "#e2e8f0",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "transparent",
            border: "none",
            color: "#64748b",
            fontSize: "20px",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px 0" }}>
            导入会话
          </h2>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            扫描本机助手、使用各应用官方导出，或拖入 Markdown 会话。
          </p>
        </div>

        {/* Section 1: Scan AI Agents */}
        <div
          onClick={handleScanAgents}
          style={{
            backgroundColor: "rgba(30, 27, 75, 0.4)",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            borderRadius: "12px",
            padding: "18px 20px",
            marginBottom: "20px",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.6)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)")}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "rgba(139, 92, 246, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#c084fc",
                fontSize: "20px",
                flexShrink: 0,
              }}
            >
              ⛶
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#f8fafc", margin: "0 0 4px 0" }}>
                  查找 AI 会话
                </h3>
                {isScanning && (
                  <span style={{ fontSize: "12px", color: "#a855f7" }}>扫描中...</span>
                )}
              </div>
              <p style={{ fontSize: "12px", color: "#cbd5e1", margin: 0, lineHeight: 1.4 }}>
                扫描本机的 Google Antigravity、Claude Code、Cursor、Codex、OpenCode 会话，导入前由你勾选。
              </p>
            </div>
          </div>

          {/* Badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginLeft: "54px" }}>
            <span style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: "12px", color: "#e2e8f0" }}>
              ⚡ Google Antigravity
            </span>
            <span style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: "12px", color: "#e2e8f0" }}>
              💥 Claude Code
            </span>
            <span style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: "12px", color: "#e2e8f0" }}>
              🛡️ Cursor
            </span>
            <span style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: "12px", color: "#e2e8f0" }}>
              ⚙️ Codex
            </span>
            <span style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: "12px", color: "#e2e8f0" }}>
              📱 OpenCode
            </span>
          </div>
        </div>

        {/* Scanned Sessions List (if discovered) */}
        {discoveredSessions.length > 0 && (
          <div
            style={{
              backgroundColor: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "20px",
              maxHeight: "200px",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", fontSize: "12px", color: "#94a3b8" }}>
              <span>发现 {discoveredSessions.length} 个会话 (已选 {selectedIds.size})</span>
              <button
                style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: "12px" }}
                onClick={() => {
                  if (selectedIds.size === discoveredSessions.length) setSelectedIds(new Set());
                  else setSelectedIds(new Set(discoveredSessions.map(s => s.id)));
                }}
              >
                {selectedIds.size === discoveredSessions.length ? "取消全选" : "全选"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {discoveredSessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleToggleSelect(s.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    backgroundColor: selectedIds.has(s.id) ? "rgba(99, 102, 241, 0.15)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${selectedIds.has(s.id) ? "rgba(99, 102, 241, 0.4)" : "transparent"}`,
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => {}}
                    style={{ cursor: "pointer" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      {s.platform} · {s.messageCount} 条消息 · {s.updatedAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleImportSelected}
              disabled={isImporting || selectedIds.size === 0}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "8px",
                borderRadius: "6px",
                backgroundColor: "#6366f1",
                color: "#fff",
                border: "none",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                opacity: isImporting || selectedIds.size === 0 ? 0.6 : 1,
              }}
            >
              {isImporting ? "导入中..." : `导入选中的 ${selectedIds.size} 个会话`}
            </button>
          </div>
        )}

        {/* Section 2: Local Files */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "#94a3b8", marginBottom: "10px" }}>
            本机文件
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {/* Single Session */}
            <label
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "10px",
                padding: "16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)")}
            >
              <input
                type="file"
                accept=".md,.markdown"
                style={{ display: "none" }}
                onChange={(e) => handleFileUpload(e, "single")}
              />
              <div style={{ fontSize: "20px", color: "#94a3b8" }}>📄</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>单个会话</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>会话 Markdown (.md)</div>
              </div>
            </label>

            {/* Batch Import */}
            <label
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "10px",
                padding: "16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)")}
            >
              <input
                type="file"
                accept=".json,.zip,.md"
                multiple
                style={{ display: "none" }}
                onChange={(e) => handleFileUpload(e, "batch")}
              />
              <div style={{ fontSize: "20px", color: "#94a3b8" }}>📂</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>批量导入</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>ChatGPT、Takeout、Claude 导出</div>
              </div>
            </label>
          </div>
        </div>

        {/* Section 3: Guideline banner */}
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "10px",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "16px", color: "#64748b" }}>📖</span>
            <span style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.4 }}>
              这里没有你的 agent，或要同步到远程 Mem？导入说明会列出支持的导出格式，以及应在会话所在机器上运行的连接器补录命令。
            </span>
          </div>
          <a
            href="https://mem.nowledge.co/zh/docs/integrations/google-antigravity"
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: "12px",
              color: "#818cf8",
              textDecoration: "none",
              whiteSpace: "nowrap",
              padding: "4px 8px",
              backgroundColor: "rgba(129, 140, 248, 0.1)",
              borderRadius: "6px",
            }}
          >
            查看导入说明 ↗
          </a>
        </div>

        {/* Status text if any */}
        {statusText && (
          <div style={{ fontSize: "12px", color: "#38bdf8", textAlign: "center", marginBottom: "12px" }}>
            {statusText}
          </div>
        )}

        {/* Footer Hints */}
        <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ fontSize: "11px", color: "#64748b" }}>
            单条 .md 需使用 <code style={{ color: "#94a3b8" }}>## User</code> / <code style={{ color: "#94a3b8" }}>### Assistant</code> 标签。Markdown 格式
          </div>
          <div style={{ fontSize: "11px", color: "#64748b" }}>
            浏览器扩展记录的是你配合使用的那段会话，不是整套账号历史。扩展如何工作
          </div>
        </div>
      </div>
    </div>
  );
};
