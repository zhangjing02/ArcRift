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
        fontSize: 14,
        themeVariables: {
          darkMode: true,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: "14px",
          background: "#0c1017",
          primaryColor: "#6366f1",
          primaryTextColor: "#f8fafc",
          primaryBorderColor: "#818cf8",
          lineColor: "#38bdf8",
          secondaryColor: "#1e293b",
          tertiaryColor: "#0f172a",
          noteBkgColor: "#1e293b",
          noteTextColor: "#f8fafc",
          noteBorderColor: "#6366f1",
          actorBkg: "#1e293b",
          actorTextColor: "#f8fafc",
          actorBorder: "#6366f1",
          actorLineColor: "#64748b",
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
        sequence: {
          diagramMarginX: 32,
          diagramMarginY: 24,
          actorMargin: 56,
          width: 150,
          height: 54,
          boxMargin: 10,
          boxTextMargin: 6,
          noteMargin: 10,
          messageMargin: 36,
          messageAlign: "center",
          mirrorActors: false,
          bottomMarginAdj: 1,
          useMaxWidth: false,
        },
        flowchart: {
          useMaxWidth: false,
          htmlLabels: true,
          curve: "basis",
        },
        gantt: {
          useMaxWidth: false,
        },
        er: {
          useMaxWidth: false,
        },
        state: {
          useMaxWidth: false,
        },
        journey: {
          useMaxWidth: false,
        },
        class: {
          useMaxWidth: false,
        },
      });
      mermaidInitialized = true;
    } catch (e) {
      console.error("[Mermaid] Initialization failed:", e);
    }
  }
}

/**
 * Post-processes rendered SVG string to preserve intrinsic viewBox dimensions
 * and remove restrictive inline max-width styles.
 */
function postProcessSvg(rawSvg: string): string {
  if (!rawSvg) return "";

  const vbMatch = rawSvg.match(/viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
  let vbWidth = "";
  let vbHeight = "";
  if (vbMatch) {
    vbWidth = vbMatch[3];
    vbHeight = vbMatch[4];
  }

  let svg = rawSvg;
  if (vbWidth && vbHeight) {
    svg = svg.replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
      let newAttrs = attrs;
      // Clean max-width from inline style
      newAttrs = newAttrs.replace(/style=["']([^"']*)["']/i, (_unused: string, styleVal: string) => {
        const cleaned = styleVal.replace(/max-width:[^;]+;?/gi, "").trim();
        return cleaned ? `style="${cleaned}"` : "";
      });
      // Replace width with viewBox width
      if (/width=["'][^"']*["']/i.test(newAttrs)) {
        newAttrs = newAttrs.replace(/width=["'][^"']*["']/i, `width="${vbWidth}"`);
      } else {
        newAttrs = `width="${vbWidth}" ` + newAttrs;
      }
      // Replace height with viewBox height
      if (/height=["'][^"']*["']/i.test(newAttrs)) {
        newAttrs = newAttrs.replace(/height=["'][^"']*["']/i, `height="${vbHeight}"`);
      } else {
        newAttrs = `height="${vbHeight}" ` + newAttrs;
      }
      return `<svg ${newAttrs.trim()}>`;
    });
  }
  return svg;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code, className = "" }) => {
  const [activeTab, setActiveTab] = useState<"diagram" | "source">("diagram");
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fitMode, setFitMode] = useState<"actual" | "fit">("actual");
  const [zoom, setZoom] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const dragStartRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number }>({
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const viewportRef = useRef<HTMLDivElement>(null);
  const modalViewportRef = useRef<HTMLDivElement>(null);

  const trimmedCode = (code || "").trim();

  // Render diagram on code change
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setZoom(1.0);

    initMermaid();

    const uniqueId = `mermaid_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    const cleanupStray = () => {
      const stray = document.querySelectorAll(`[id^="d${uniqueId}"], [id^="${uniqueId}"]`);
      stray.forEach((el) => el.remove());
    };

    mermaid
      .render(uniqueId, trimmedCode)
      .then(({ svg }) => {
        if (isMounted) {
          setSvgHtml(postProcessSvg(svg));
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

  // Drag-to-Pan (Mouse Drag Scrolling)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, isModal = false) => {
    if (e.button !== 0) return; // Only left-click
    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;

    const target = isModal ? modalViewportRef.current : viewportRef.current;
    if (!target) return;

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: target.scrollLeft,
      scrollTop: target.scrollTop,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = isFullscreen ? modalViewportRef.current : viewportRef.current;
      if (!target) return;

      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;

      target.scrollLeft = dragStartRef.current.scrollLeft - dx;
      target.scrollTop = dragStartRef.current.scrollTop - dy;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isFullscreen]);

  // Non-passive Wheel listener for smooth Ctrl+Wheel Zoom
  useEffect(() => {
    const attachWheel = (el: HTMLDivElement | null) => {
      if (!el) return () => {};
      const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.12 : -0.12;
          setZoom((prev) => {
            const next = Math.min(3.0, Math.max(0.3, +(prev + delta).toFixed(2)));
            return next;
          });
          setFitMode("actual");
        }
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    };

    const cleanupMain = attachWheel(viewportRef.current);
    const cleanupModal = attachWheel(modalViewportRef.current);

    return () => {
      cleanupMain();
      cleanupModal();
    };
  }, [svgHtml, isFullscreen]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(trimmedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleZoomIn = () => {
    setFitMode("actual");
    setZoom((prev) => Math.min(3.0, +(prev + 0.15).toFixed(2)));
  };

  const handleZoomOut = () => {
    setFitMode("actual");
    setZoom((prev) => Math.max(0.3, +(prev - 0.15).toFixed(2)));
  };

  const handleZoomReset = () => {
    setFitMode("actual");
    setZoom(1.0);
  };

  const handleDownloadSvg = () => {
    if (!svgHtml) return;
    let exportCode = svgHtml;
    if (!exportCode.includes('xmlns="http://www.w3.org/2000/svg"')) {
      exportCode = exportCode.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
    }
    const blob = new Blob([exportCode], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mermaid-diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`nl-mermaid-card mode-${fitMode} ${className}`}>
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
              {/* Display Mode Toggle */}
              <div className="nl-mermaid-mode-group">
                <button
                  type="button"
                  className={`nl-mermaid-tool-btn ${fitMode === "actual" ? "active" : ""}`}
                  onClick={() => {
                    setFitMode("actual");
                    setZoom(1.0);
                  }}
                  title="100% 原始大画幅清晰展开（文字清晰，支持自由抓手拖拽平移）"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>100% 实际大小</span>
                </button>
                <button
                  type="button"
                  className={`nl-mermaid-tool-btn ${fitMode === "fit" ? "active" : ""}`}
                  onClick={() => {
                    setFitMode("fit");
                    setZoom(1.0);
                  }}
                  title="缩放以自适应当前容器宽度"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                  <span>适应宽度</span>
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="nl-mermaid-zoom-group">
                <button
                  type="button"
                  className="nl-mermaid-tool-btn"
                  onClick={handleZoomOut}
                  title="缩小"
                  disabled={zoom <= 0.3}
                >
                  −
                </button>
                <button
                  type="button"
                  className="nl-mermaid-tool-btn nl-mermaid-zoom-label"
                  onClick={handleZoomReset}
                  title="重置缩放 (100%)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  className="nl-mermaid-tool-btn"
                  onClick={handleZoomIn}
                  title="放大"
                  disabled={zoom >= 3.0}
                >
                  +
                </button>
              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                className="nl-mermaid-tool-btn"
                onClick={() => setIsFullscreen(true)}
                title="全屏大画幅交互预览"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
                <span>全屏预览</span>
              </button>

              {/* Export SVG Button */}
              <button
                type="button"
                className="nl-mermaid-tool-btn"
                onClick={handleDownloadSvg}
                title="导出 SVG 高清矢量图"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>导出 SVG</span>
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
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                <div
                  className={`nl-mermaid-viewport ${isDragging ? "is-dragging" : ""}`}
                  ref={viewportRef}
                  onMouseDown={(e) => handleMouseDown(e, false)}
                >
                  <div
                    className="nl-mermaid-svg-wrapper"
                    style={{
                      transform: fitMode === "actual" && zoom !== 1.0 ? `scale(${zoom})` : undefined,
                      transformOrigin: "center center",
                    }}
                    dangerouslySetInnerHTML={{ __html: svgHtml }}
                  />
                  <div className="nl-mermaid-canvas-hint">
                    <span>💡 拖拽平移 · Ctrl+滚轮缩放</span>
                  </div>
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
                <div className="nl-mermaid-mode-group">
                  <button
                    type="button"
                    className={`nl-mermaid-tool-btn ${fitMode === "actual" ? "active" : ""}`}
                    onClick={() => {
                      setFitMode("actual");
                      setZoom(1.0);
                    }}
                    title="100% 实际大小"
                  >
                    <span>100% 实际大小</span>
                  </button>
                  <button
                    type="button"
                    className={`nl-mermaid-tool-btn ${fitMode === "fit" ? "active" : ""}`}
                    onClick={() => {
                      setFitMode("fit");
                      setZoom(1.0);
                    }}
                    title="适应宽度"
                  >
                    <span>适应宽度</span>
                  </button>
                </div>

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
                    title="重置缩放 (100%)"
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>导出 SVG</span>
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

            <div
              className={`nl-mermaid-modal-viewport ${isDragging ? "is-dragging" : ""}`}
              ref={modalViewportRef}
              onMouseDown={(e) => handleMouseDown(e, true)}
            >
              <div
                className="nl-mermaid-svg-wrapper modal-mode"
                style={{
                  transform: fitMode === "actual" && zoom !== 1.0 ? `scale(${zoom})` : undefined,
                  transformOrigin: "center center",
                }}
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
              <div className="nl-mermaid-canvas-hint">
                <span>💡 拖拽平移 · Ctrl+滚轮缩放</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
