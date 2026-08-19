import React, { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";

interface MermaidDiagramProps {
  code: string;
  className?: string;
}

let mermaidInitialized = false;

function initMermaid() {
  if (!mermaidInitialized) {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        themeVariables: {
          darkMode: true,
          background: "#121620",
          primaryColor: "#6366f1",
          primaryTextColor: "#f8fafc",
          primaryBorderColor: "#818cf8",
          lineColor: "#38bdf8",
          secondaryColor: "#1e293b",
          tertiaryColor: "#0f172a",
          noteBkgColor: "#1e293b",
          noteTextColor: "#f8fafc",
          actorBkg: "#1e293b",
          actorTextColor: "#f8fafc",
          actorBorder: "#6366f1",
          signalColor: "#38bdf8",
          signalTextColor: "#f8fafc",
          labelBoxBkgColor: "#1e293b",
          labelBoxBorderColor: "#818cf8",
          labelTextColor: "#f8fafc",
          loopTextColor: "#f8fafc",
          activationBorderColor: "#6366f1",
          activationBkgColor: "#312e81",
          sequenceNumberColor: "#f8fafc",
          sectionBkgColor: "#1e293b",
          altSectionBkgColor: "#0f172a",
          sectionBkgColor2: "#1e293b",
          taskBorderColor: "#6366f1",
          taskBkgColor: "#4f46e5",
          taskTextColor: "#ffffff",
          activeTaskBorderColor: "#38bdf8",
          activeTaskBkgColor: "#0284c7",
          activeTaskTextColor: "#ffffff",
          gridColor: "rgba(255,255,255,0.08)",
          classText: "#f8fafc",
          git0: "#6366f1",
          git1: "#38bdf8",
          git2: "#a855f7",
          git3: "#ec4899",
        },
      });
      mermaidInitialized = true;
    } catch (e) {
      console.error("[Mermaid] Initialization failed:", e);
    }
  }
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code, className = "" }) => {
  const [activeTab, setActiveTab] = useState<"diagram" | "source">("diagram");
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmedCode = (code || "").trim();

  // Render diagram on code change
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setZoom(1.0);

    initMermaid();

    const uniqueId = `mermaid_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    // Clean up previous error SVGs if any
    const cleanupStray = () => {
      const stray = document.querySelectorAll(`[id^="d${uniqueId}"], [id^="${uniqueId}"]`);
      stray.forEach((el) => el.remove());
    };

    mermaid
      .render(uniqueId, trimmedCode)
      .then(({ svg }) => {
        if (isMounted) {
          setSvgHtml(svg);
          setError(null);
          setIsLoading(false);
        }
        cleanupStray();
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const errMsg = err instanceof Error ? err.message : String(err);
          setError(errMsg);
          setIsLoading(false);
        }
        cleanupStray();
      });

    return () => {
      isMounted = false;
      cleanupStray();
    };
  }, [trimmedCode]);

  // Handle ESC key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(trimmedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(2.5, +(prev + 0.15).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.4, +(prev - 0.15).toFixed(2)));
  };

  const handleZoomReset = () => {
    setZoom(1.0);
  };

  const handleDownloadSvg = () => {
    if (!svgHtml) return;
    const blob = new Blob([svgHtml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chronosmind-diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`nl-mermaid-card ${className}`}>
      {/* Top Action Bar */}
      <div className="nl-mermaid-header">
        <div className="nl-mermaid-tabs">
          <button
            type="button"
            className={`nl-mermaid-tab-btn ${activeTab === "diagram" ? "active" : ""}`}
            onClick={() => setActiveTab("diagram")}
          >
            <span className="nl-mermaid-tab-icon">📊</span>
            <span>图表视图</span>
          </button>
          <button
            type="button"
            className={`nl-mermaid-tab-btn ${activeTab === "source" ? "active" : ""}`}
            onClick={() => setActiveTab("source")}
          >
            <span className="nl-mermaid-tab-icon">💻</span>
            <span>查看源码</span>
          </button>
        </div>

        <div className="nl-mermaid-actions">
          {activeTab === "diagram" && !error && (
            <>
              {/* Zoom Controls */}
              <div className="nl-mermaid-zoom-group">
                <button
                  type="button"
                  className="nl-mermaid-tool-btn"
                  onClick={handleZoomOut}
                  title="缩小"
                  disabled={zoom <= 0.4}
                >
                  −
                </button>
                <button
                  type="button"
                  className="nl-mermaid-tool-btn nl-mermaid-zoom-label"
                  onClick={handleZoomReset}
                  title="重置缩放"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  className="nl-mermaid-tool-btn"
                  onClick={handleZoomIn}
                  title="放大"
                  disabled={zoom >= 2.5}
                >
                  +
                </button>
              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                className="nl-mermaid-tool-btn"
                onClick={() => setIsFullscreen(true)}
                title="全屏交互查看"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
                <span>全屏</span>
              </button>

              {/* Export SVG Button */}
              <button
                type="button"
                className="nl-mermaid-tool-btn"
                onClick={handleDownloadSvg}
                title="导出 SVG 矢量图"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>导出</span>
              </button>
            </>
          )}

          {/* Copy Source Button */}
          <button
            type="button"
            className="nl-mermaid-tool-btn nl-mermaid-copy-btn"
            onClick={handleCopyCode}
            title="复制 Mermaid 源码"
          >
            {copied ? (
              <span className="nl-mermaid-copied-text">✓ 已复制</span>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>复制代码</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="nl-mermaid-body">
        {activeTab === "diagram" ? (
          <>
            {isLoading && (
              <div className="nl-mermaid-loading">
                <div className="nl-mermaid-spinner" />
                <span>正在渲染 Mermaid 矢量图表...</span>
              </div>
            )}

            {error ? (
              <div className="nl-mermaid-error-container">
                <div className="nl-mermaid-error-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Mermaid 语法解析异常</span>
                </div>
                <p className="nl-mermaid-error-msg">{error}</p>
                <div className="nl-mermaid-error-actions">
                  <button
                    type="button"
                    className="nl-mermaid-error-switch-btn"
                    onClick={() => setActiveTab("source")}
                  >
                    查看源码以排查问题
                  </button>
                </div>
              </div>
            ) : (
              !isLoading && (
                <div className="nl-mermaid-viewport" ref={containerRef}>
                  <div
                    className="nl-mermaid-svg-wrapper"
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: "top center",
                      transition: "transform 0.15s ease-out",
                    }}
                    dangerouslySetInnerHTML={{ __html: svgHtml }}
                  />
                </div>
              )
            )}
          </>
        ) : (
          <div className="nl-mermaid-source-view">
            <pre className="nl-mermaid-source-pre">
              <code>{trimmedCode}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Fullscreen Interactive Modal */}
      {isFullscreen && (
        <div className="nl-mermaid-modal-overlay" onClick={() => setIsFullscreen(false)}>
          <div className="nl-mermaid-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="nl-mermaid-modal-header">
              <div className="nl-mermaid-modal-title">
                <span className="nl-mermaid-tab-icon">📊</span>
                <span>Mermaid 图表全屏交互视图</span>
              </div>
              <div className="nl-mermaid-modal-tools">
                <div className="nl-mermaid-zoom-group">
                  <button
                    type="button"
                    className="nl-mermaid-tool-btn"
                    onClick={handleZoomOut}
                    title="缩小"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="nl-mermaid-tool-btn nl-mermaid-zoom-label"
                    onClick={handleZoomReset}
                    title="重置缩放"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    className="nl-mermaid-tool-btn"
                    onClick={handleZoomIn}
                    title="放大"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className="nl-mermaid-tool-btn"
                  onClick={handleDownloadSvg}
                  title="导出 SVG"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>导出</span>
                </button>

                <button
                  type="button"
                  className="nl-mermaid-tool-btn nl-mermaid-close-btn"
                  onClick={() => setIsFullscreen(false)}
                  title="关闭 (ESC)"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="nl-mermaid-modal-viewport">
              <div
                className="nl-mermaid-svg-wrapper modal-mode"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease-out",
                }}
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
