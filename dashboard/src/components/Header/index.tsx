import React from "react";
import { useLocale } from "../../context/LocaleContext";

interface HeaderProps {
  activeMainTab: "graph" | "search" | "settings";
  setActiveMainTab: (tab: "graph" | "search" | "settings") => void;
  activeSideTab: "history" | "chat" | null;
  setActiveSideTab: (tab: "history" | "chat" | null) => void;
  isClosed: boolean;
  setIsClosed: (closed: boolean) => void;
  loadedToExtension: boolean;
  loadIntoExtension: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  activeMainTab, setActiveMainTab, activeSideTab, setActiveSideTab, 
  isClosed, setIsClosed, loadedToExtension, loadIntoExtension
}) => {
  const { locale, toggleLocale, t } = useLocale();

  return (
    <div style={{ position: "absolute", top: "16px", left: "264px", right: "24px", zIndex: 100, display: "flex", justifyContent: "space-between", padding: "6px 12px", background: "var(--surface)", border: "1px solid var(--border-main)", borderRadius: "12px", backdropFilter: "var(--surface-blur)", alignItems: "center" }}>
      {/* Left Tabs */}
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "12px" }}>
        <button className={`tab-btn ${loadedToExtension ? "active" : ""}`} onClick={loadIntoExtension}>
          {loadedToExtension ? t.header.loadedSession : t.header.loadSession}
        </button>
      </div>

      {/* Center Tabs */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
        <button
          className={`tab-btn ${activeMainTab === "graph" ? "active" : ""}`}
          onClick={() => setActiveMainTab("graph")}
        >
          {t.header.navGraph}
        </button>
        <button 
          className={`tab-btn ${!isClosed && activeSideTab === "history" && activeMainTab === "graph" ? "active" : ""}`} 
          onClick={() => { setActiveSideTab("history"); setIsClosed(false); setActiveMainTab("graph"); }}
          disabled={activeMainTab !== "graph"}
          style={activeMainTab !== "graph" ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
        >
          {t.header.navFacts}
        </button>
        <button 
          className={`tab-btn ${!isClosed && activeSideTab === "chat" && activeMainTab === "graph" ? "active" : ""}`} 
          onClick={() => { setActiveSideTab("chat"); setIsClosed(false); setActiveMainTab("graph"); }}
          disabled={activeMainTab !== "graph"}
          style={activeMainTab !== "graph" ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
        >
          {t.header.navChat}
        </button>
        <button
          className={`tab-btn ${activeMainTab === "search" ? "active" : ""}`}
          onClick={() => setActiveMainTab("search")}
        >
          {t.header.navSearch}
        </button>
        <button
          className={`tab-btn ${activeMainTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveMainTab("settings")}
        >
          {t.header.navSettings}
        </button>
      </div>

      {/* Right Tools & Language Toggle */}
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px" }}>
        <button
          className="tab-btn"
          onClick={toggleLocale}
          title={locale === "zh" ? "Switch to English" : "切换为中文"}
          style={{
            fontSize: "12px",
            fontWeight: 700,
            padding: "4px 10px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border-dim)",
            color: "var(--text-secondary)",
            borderRadius: "8px"
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span style={{ color: locale === "zh" ? "var(--primary)" : "inherit" }}>中</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span style={{ color: locale === "en" ? "var(--primary)" : "inherit" }}>EN</span>
        </button>
      </div>
    </div>
  );
};

export default Header;
