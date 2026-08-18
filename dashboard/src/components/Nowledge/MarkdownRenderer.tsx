import React, { useState } from "react";
import { marked } from "marked";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  showSummaryCard?: boolean;
}

// Simple syntax highlighter for code blocks
function highlightCode(code: string, lang?: string): string {
  let safeCode = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const l = (lang || "").toLowerCase();

  if (l === "json") {
    // JSON syntax highlighting
    safeCode = safeCode
      .replace(/"([^"]+)":/g, '<span class="token-key">"$1"</span>:')
      .replace(/:\s*"([^"]*)"/g, ': <span class="token-string">"$1"</span>')
      .replace(/:\s*(\b\d+(\.\d+)?\b)/g, ': <span class="token-number">$1</span>')
      .replace(/:\s*(true|false|null)\b/g, ': <span class="token-boolean">$1</span>');
  } else if (l === "kotlin" || l === "java" || l === "typescript" || l === "javascript" || l === "ts" || l === "js") {
    // Keywords
    const keywords = /\b(fun|val|var|class|interface|object|enum|override|private|public|protected|internal|import|package|if|else|when|switch|case|default|for|while|do|return|break|continue|try|catch|finally|throw|new|const|let|async|await|function|export|from|type)\b/g;
    safeCode = safeCode.replace(keywords, '<span class="token-keyword">$1</span>');

    // Types
    const types = /\b(String|Int|Long|Float|Double|Boolean|List|Map|Set|Array|Unit|Any|void|Promise|Response|Request|StateFlow|MutableStateFlow)\b/g;
    safeCode = safeCode.replace(types, '<span class="token-type">$1</span>');

    // Strings
    safeCode = safeCode.replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="token-string">$1</span>');

    // Comments
    safeCode = safeCode.replace(/(\/\/.*$)/gm, '<span class="token-comment">$1</span>');
  } else if (l === "log") {
    safeCode = safeCode
      .replace(/(\d{2}:\d{2}:\d{2}\.\d{3})/g, '<span class="token-timestamp">$1</span>')
      .replace(/\b(GET|POST|PUT|DELETE|PATCH)\b/g, '<span class="token-method">$1</span>')
      .replace(/\b(200|201|204)\b/g, '<span class="token-status-ok">$1</span>')
      .replace(/\b(400|401|403|404|500|502|503)\b/g, '<span class="token-status-err">$1</span>');
  }

  return safeCode;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "",
  showSummaryCard = true,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Extract Summary if present
  let summaryText = "";
  let bodyContent = content;

  // Check if content starts with or contains a Summary section
  const summaryMatch = content.match(/^(?:#+\s*.*?\n+)?(?:>+\s*(?:\[!NOTE\]|\[!IMPORTANT\]|\[!SUMMARY\])?\s*|\*\*摘要[：:]\*\*|\*\*Summary[：:]\*\*|###?\s*摘要|###?\s*一、问题背景与现象描述\n)([\s\S]*?)(?=\n##|\n###|\n---|$)/i);

  if (summaryMatch && summaryMatch[1]?.trim().length > 10) {
    const rawSum = summaryMatch[1].trim();
    // Keep first 200 chars or lines
    summaryText = rawSum.replace(/^[-*>\s]+/gm, "").slice(0, 300);
  } else {
    // Extract first meaningful paragraph
    const paragraphs = content.split(/\n\s*\n/).filter((p) => !p.trim().startsWith("#") && p.trim().length > 15);
    if (paragraphs.length > 0) {
      summaryText = paragraphs[0].replace(/^[-*>\s]+/gm, "").slice(0, 250);
    }
  }

  // Parse code blocks vs markdown sections
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
              <span className="nl-summary-icon">💡</span>
              <span>核心摘要 / Summary</span>
            </div>
            <span className="nl-summary-badge">AI 提炼</span>
          </div>
          <p className="nl-summary-text">{summaryText}...</p>
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
                  {copiedIndex === idx ? "✓ 已复制" : "📋 复制"}
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
