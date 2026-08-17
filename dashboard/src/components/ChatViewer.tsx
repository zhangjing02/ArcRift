/**
 * ChatViewer.tsx — v1.6.0
 *
 * Displays the full saved conversation as a scrollable chat view with i18n and copy support.
 */

import React, { useMemo, useState } from "react";
import { useLocale } from "../context/LocaleContext";

interface Props {
  rawText: string;
  messageCount: number;
  createdAt: string;
  platform?: string;
}

interface Turn {
  role: "user" | "assistant";
  text: string;
}

function parseTurns(rawText: string): Turn[] {
  const turns: Turn[] = [];
  const parts = rawText.split(/\n*\[(User|Assistant)\]:\s*/i);

  for (let i = 1; i < parts.length; i += 2) {
    const role = parts[i].toLowerCase() === "user" ? "user" : "assistant";
    const text = (parts[i + 1] || "").trim();
    if (text.length > 0) {
      turns.push({ role, text });
    }
  }

  if (turns.length === 0 && rawText.trim().length > 0) {
    turns.push({ role: "assistant", text: rawText.trim() });
  }

  return turns;
}

const ChatViewer: React.FC<Props> = ({ rawText, messageCount, createdAt, platform }) => {
  const { t, locale } = useLocale();
  const turns = useMemo(() => parseTurns(rawText), [rawText]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formattedDate = new Date(createdAt).toLocaleDateString(
    locale === "zh" ? "zh-CN" : "en-US",
    { year: "numeric", month: "short", day: "numeric" }
  );

  const turnsText = t.chat.metaTurns.replace("{turns}", String(turns.length));
  const msgText = t.chat.metaMessages.replace("{count}", String(messageCount));
  const savedText = t.chat.metaSaved.replace("{date}", formattedDate);

  return (
    <div className="chat-container">
      {/* Header bar */}
      <div className="chat-header">
        <div className="chat-header-meta">
          {turnsText} · {msgText} · {savedText}
        </div>
        <div className="chat-header-label">
          {t.chat.rawTitle}
        </div>
      </div>

      {/* Scrollable chat */}
      <div className="chat-scroll-area">
        {turns.map((turn, i) => {
          const isUser = turn.role === "user";
          return (
            <div key={i} className={`chat-turn ${isUser ? "user" : "assistant"}`}>
              {/* Role label */}
              <div className={`chat-role-label ${isUser ? "user" : "assistant"}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{isUser ? t.chat.you : (platform ? platform.toUpperCase() : t.chat.assistant)}</span>
                <button
                  onClick={() => handleCopy(turn.text, i)}
                  title={t.common.copy}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    opacity: 0.6,
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  {copiedIndex === i ? (
                    <span style={{ color: "var(--success)" }}>{t.common.copied}</span>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Message bubble */}
              <div className={`chat-bubble ${isUser ? "user" : "assistant"}`}>
                {turn.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChatViewer;
