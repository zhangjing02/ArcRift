import React, { useState } from "react";
import { marked } from "marked";
import { IconMemories } from "./Icons";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  showSummaryCard?: boolean;
}

// Robust single-pass syntax highlighter for code blocks
function highlightCode(code: string, lang?: string): string {
  const l = (lang || "").toLowerCase();
  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  if (!code) return "";

  const lines = code.split("\n");
  const highlightedLines = lines.map((line) => {
    if (l === "json") {
      return line.replace(
        /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,
        (match, p1, p2, p3) => {
          if (p1) {
            if (p2) {
              return `<span class="token-key">${escapeHtml(p1)}</span>${p2}`;
            }
            return `<span class="token-string">${escapeHtml(p1)}</span>`;
          }
          if (p3) {
            return `<span class="token-boolean">${p3}</span>`;
          }
          return `<span class="token-number">${match}</span>`;
        }
      );
    }

    if (l === "log") {
      return escapeHtml(line)
        .replace(/(\d{2}:\d{2}:\d{2}\.\d{3})/g, '<span class="token-timestamp">$1</span>')
        .replace(/\b(GET|POST|PUT|DELETE|PATCH)\b/g, '<span class="token-method">$1</span>')
        .replace(/\b(200|201|204)\b/g, '<span class="token-status-ok">$1</span>')
        .replace(/\b(400|401|403|404|500|502|503)\b/g, '<span class="token-status-err">$1</span>');
    }

    // General programming languages (Kotlin, Java, TS, JS, etc.)
    const commentIdx = line.indexOf("//");
    let codePart = line;
    let commentPart = "";
    if (commentIdx !== -1) {
      codePart = line.substring(0, commentIdx);
      commentPart = `<span class="token-comment">${escapeHtml(line.substring(commentIdx))}</span>`;
    }

    const tokenized = escapeHtml(codePart).replace(
      /("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|`[^`]*`)|(\b(?:fun|val|var|class|interface|object|enum|override|private|public|protected|internal|import|package|if|else|when|switch|case|default|for|while|do|return|break|continue|try|catch|finally|throw|new|const|let|async|await|function|export|from|type)\b)|(\b(?:String|Int|Long|Float|Double|Boolean|List|Map|Set|Array|Unit|Any|void|Promise|Response|Request|StateFlow|MutableStateFlow)\b)|(\b\d+\b)/g,
      (_match, str, kw, type, num) => {
        if (str) return `<span class="token-string">${str}</span>`;
        if (kw) return `<span class="token-keyword">${kw}</span>`;
        if (type) return `<span class="token-type">${type}</span>`;
        if (num) return `<span class="token-number">${num}</span>`;
        return _match;
      }
    );

    return tokenized + commentPart;
  });

  return highlightedLines.join("\n");
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "",
  showSummaryCard = true,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // 0. Unescape literal \n and \t if present in raw string
  const processedRaw = (content || "")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "");

  // 1. Strip duplicate top H1 title from body content if it exists
  let bodyContent = processedRaw.trim();
  if (bodyContent.startsWith("# ")) {
    const firstNewline = bodyContent.indexOf("\n");
    if (firstNewline !== -1) {
      bodyContent = bodyContent.substring(firstNewline + 1).trim();
    }
  }

  // 2. Intelligent High-Quality Summary Extractor (no code lines!)
  let summaryText = "";
  
  const lines = processedRaw.split("\n");
  const candidates: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (
      trimmed.startsWith("```") ||
      trimmed.startsWith("val ") ||
      trimmed.startsWith("var ") ||
      trimmed.startsWith("fun ") ||
      trimmed.startsWith("class ") ||
      trimmed.startsWith("private ") ||
      trimmed.startsWith("import ") ||
      trimmed.startsWith("{") ||
      trimmed.startsWith("}") ||
      trimmed.includes("coroutine") ||
      trimmed.startsWith("<?xml")
    ) {
      continue;
    }
    if (trimmed.startsWith("#")) continue;

    const cleanLine = trimmed.replace(/^[-*>\d.]+\s+/, "").replace(/[*`_]/g, "").trim();
    if (cleanLine.length > 15 && !cleanLine.includes("{") && !cleanLine.includes("=") && !cleanLine.includes("(")) {
      candidates.push(cleanLine);
      if (candidates.length >= 2) break;
    }
  }

  if (candidates.length > 0) {
    summaryText = candidates.join(" ");
    if (summaryText.length > 240) {
      summaryText = summaryText.slice(0, 240) + "...";
    }
  }

  // 3. Parse code blocks vs markdown sections
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts: { type: "markdown" | "code"; lang?: string; code?: string; html?: string }[] = [];

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(bodyContent)) !== null) {
    if (match.index > lastIndex) {
      const mdChunk = bodyContent.substring(lastIndex, match.index);
      parts.push({
        type: "markdown",
        html: marked.parse(mdChunk, { breaks: true, gfm: true }) as string,
      });
    }

    parts.push({
      type: "code",
      lang: match[1] || "text",
      code: match[2],
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < bodyContent.length) {
    const mdChunk = bodyContent.substring(lastIndex);
    parts.push({
      type: "markdown",
      html: marked.parse(mdChunk, { breaks: true, gfm: true }) as string,
    });
  }

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className={`nl-rich-markdown-container ${className}`}>
      {/* 1. Top Summary Card (Nowledge Mem Style Abstract) */}
      {showSummaryCard && summaryText && (
        <div className="nl-memory-summary-card">
          <div className="nl-summary-header">
            <div className="nl-summary-title">
              <IconMemories size={14} className="nl-summary-svg" />
              <span>核心摘要 / Summary</span>
            </div>
            <span className="nl-summary-badge">AI 提炼</span>
          </div>
          <p className="nl-summary-text">{summaryText}</p>
        </div>
      )}

      {/* 2. Structured Markdown Body */}
      <div className="nl-markdown-body">
        {parts.map((part, idx) => {
          if (part.type === "markdown") {
            return (
              <div
                key={idx}
                className="nl-markdown-html"
                dangerouslySetInnerHTML={{ __html: part.html || "" }}
              />
            );
          }

          const lang = part.lang?.toUpperCase() || "CODE";
          const rawCode = part.code || "";
          const highlightedHtml = highlightCode(rawCode, part.lang);

          return (
            <div key={idx} className="nl-code-block-card">
              <div className="nl-code-block-header">
                <div className="nl-code-lang-tag">
                  <span className="nl-code-dot" />
                  <span>{lang}</span>
                </div>
                <button
                  type="button"
                  className="nl-btn-copy-code"
                  onClick={() => handleCopyCode(rawCode, idx)}
                  title="复制代码"
                >
                  {copiedIndex === idx ? "✓ 已复制" : "复制"}
                </button>
              </div>
              <div className="nl-code-content-wrapper">
                <pre className="nl-code-pre">
                  <code
                    className={`language-${part.lang}`}
                    dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                  />
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
