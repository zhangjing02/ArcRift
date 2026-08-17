import React from "react";
import ChatViewer from "../ChatViewer";
import type { Triple, ChatData, Session } from "../../types";
import { useLocale } from "../../context/LocaleContext";

interface FloatingPanelProps {
  isClosed: boolean;
  setIsClosed: (closed: boolean) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  activeTab: "history" | "chat" | null;
  loadingSession: boolean;
  pagedTriples: Triple[];
  factsPage: number;
  setFactsPage: (page: number | ((p: number) => number)) => void;
  totalPages: number;
  chatData: ChatData | null;
  activeSession: Session | null;
  factSearch: string;
  setFactSearch: (val: string) => void;
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
  isClosed,
  setIsClosed,
  isExpanded,
  setIsExpanded,
  activeTab,
  loadingSession,
  pagedTriples,
  factsPage,
  setFactsPage,
  totalPages,
  chatData,
  activeSession,
  factSearch,
  setFactSearch,
}) => {
  const { t, getNodeTypeLabel, locale } = useLocale();

  return (
    <aside className={`floating-side-content ${isClosed ? "closed" : ""} ${isExpanded ? "expanded" : ""}`}>
      <div className="expand-handle-group" style={{ left: "-28px", top: "40px", borderRadius: "8px 0 0 8px" }}>
        <button
          className="handle-btn"
          onClick={() => {
            if (isClosed) {
              setIsClosed(false);
              setIsExpanded(false);
            } else if (!isExpanded) {
              setIsExpanded(true);
            }
          }}
          title={t.drawer.expand}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <button
          className="handle-btn"
          onClick={() => {
            if (isExpanded) {
              setIsExpanded(false);
            } else if (!isClosed) {
              setIsClosed(true);
            }
          }}
          title={t.drawer.collapse}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "20px" }}>
        {activeTab === "history" && (
          <div className="history-list">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ fontFamily: "Outfit", fontSize: "18px", margin: 0 }}>
                {t.drawer.capturedFacts}
              </h3>
            </div>

            <div style={{ position: "relative", marginBottom: "20px" }}>
              <input
                type="text"
                placeholder={t.drawer.searchFactsPlaceholder}
                value={factSearch}
                onChange={(e) => {
                  setFactSearch(e.target.value);
                  setFactsPage(0);
                }}
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 36px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "white",
                  fontSize: "13px",
                  outline: "none"
                }}
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </svg>
            </div>

            {loadingSession ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="skeleton-box" style={{ height: "80px", borderRadius: "12px", opacity: 0.1 }} />
                ))}
              </div>
            ) : pagedTriples.length === 0 ? (
              <div className="empty-state" style={{ height: "100%", justifyContent: "center" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.2, marginBottom: "20px" }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                {t.drawer.noFacts}
              </div>
            ) : (
              <>
                {pagedTriples.map((tItem, i) => (
                  <div key={i} className="history-item">
                    <div className="history-item-subject">
                      <span className="history-item-type" title={tItem.subjectType}>{getNodeTypeLabel(tItem.subjectType)}</span> {tItem.subject}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      {tItem.relation} → <span style={{ color: "var(--secondary)", fontWeight: "600" }}>{tItem.object}</span> <span style={{ opacity: 0.7 }}>({getNodeTypeLabel(tItem.objectType)})</span>
                    </div>
                    <div style={{ fontSize: "9px", opacity: 0.3 }}>
                      {new Date(tItem.timestamp).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
                    </div>
                  </div>
                ))}
                
                {totalPages > 1 && (
                  <div className="pagination" style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "center", alignItems: "center" }}>
                    <button className="tab-btn" disabled={factsPage === 0} onClick={() => setFactsPage(p => p - 1)}>
                      {t.common.prev}
                    </button>
                    <span style={{ fontSize: "12px", opacity: 0.5 }}>{factsPage + 1} / {totalPages}</span>
                    <button className="tab-btn" disabled={factsPage >= totalPages - 1} onClick={() => setFactsPage(p => p + 1)}>
                      {t.common.next}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "chat" && (
          <div style={{ flex: 1, overflow: "hidden" }}>
            {chatData ? (
              <ChatViewer
                rawText={chatData.rawText}
                messageCount={chatData.messageCount}
                createdAt={chatData.createdAt}
                platform={activeSession?.platform}
              />
            ) : (
              <div className="empty-state">{t.drawer.noChat}</div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default FloatingPanel;
