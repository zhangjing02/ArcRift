import React, { useState, useEffect } from "react";
import { searchGlobal } from "../api/ArcRift";
import { useLocale } from "../context/LocaleContext";

export const GlobalSearchView: React.FC = () => {
  const { t } = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ chunks: any[]; facts: any[]; scores?: number[] }>({ chunks: [], facts: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "facts" | "chunks">("all");

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true);
        try {
          const res = await searchGlobal(searchQuery);
          setSearchResults({
            chunks: res.found ? res.chunks : [],
            facts: res.graphFacts || [],
            scores: res.scores
          });
        } catch (err) {
          console.error("Search failed:", err);
          setSearchResults({ chunks: [], facts: [] });
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults({ chunks: [], facts: [] });
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const hasResults = searchResults.chunks.length > 0 || searchResults.facts.length > 0;

  return (
    <div style={{ 
      position: "relative",
      minHeight: "calc(100vh - 64px)", 
      width: "100%", 
      overflow: "hidden",
      backgroundColor: "var(--background)"
    }}>
      {/* Background Effects */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: "radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 60%)",
        pointerEvents: "none"
      }} />
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        maskImage: "linear-gradient(to bottom, black 10%, transparent 80%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 10%, transparent 80%)",
        pointerEvents: "none"
      }} />

      {/* Content */}
      <div style={{ 
        position: "relative",
        padding: "32px", 
        maxWidth: "840px", 
        margin: "0 auto", 
        color: "var(--text-primary)", 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center",
        zIndex: 1
      }}>
        <div style={{ width: "100%", marginTop: !hasResults && searchQuery.length < 3 ? "22vh" : "40px", transition: "margin-top 0.4s cubic-bezier(0.16, 1, 0.3, 1)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h2 style={{ fontFamily: "Outfit", fontSize: "32px", marginBottom: "8px", textAlign: "center" }}>
            {t.search.title}
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px", textAlign: "center", maxWidth: "600px" }}>
            {t.search.subtitle}
          </p>

          <div style={{ position: "relative", width: "100%" }}>
            <input
              type="text"
              placeholder={t.search.placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "16px 24px 16px 50px",
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-dim)",
                borderRadius: "14px",
                color: "var(--text-primary)",
                fontSize: "18px",
                outline: "none",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)"
              }}
            />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: "absolute", left: "18px", top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "18px"
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Filter Mode Selector */}
          {hasResults && (
            <div style={{ display: "flex", gap: "8px", marginTop: "16px", alignSelf: "flex-start" }}>
              <button
                onClick={() => setFilterMode("all")}
                className={`tab-btn ${filterMode === "all" ? "active" : ""}`}
                style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "20px" }}
              >
                {t.common.all} ({searchResults.facts.length + searchResults.chunks.length})
              </button>
              <button
                onClick={() => setFilterMode("facts")}
                className={`tab-btn ${filterMode === "facts" ? "active" : ""}`}
                style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "20px" }}
              >
                {t.search.factsSection} ({searchResults.facts.length})
              </button>
              <button
                onClick={() => setFilterMode("chunks")}
                className={`tab-btn ${filterMode === "chunks" ? "active" : ""}`}
                style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "20px" }}
              >
                {t.search.contextSection} ({searchResults.chunks.length})
              </button>
            </div>
          )}
          
          <div style={{ marginTop: "24px", width: "100%" }}>
            {isSearching ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "40px", color: "var(--text-secondary)" }}>
                <div className="processing-dot" />
                <span>{t.search.searching}</span>
              </div>
            ) : hasResults ? (
              <>
                {(filterMode === "all" || filterMode === "facts") && searchResults.facts.length > 0 && (
                  <div style={{ marginBottom: "24px" }}>
                    <h3 style={{ color: "var(--primary)", marginBottom: "12px", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>{t.search.factsSection}</span>
                      <span style={{ fontSize: "12px", opacity: 0.5 }}>({searchResults.facts.length})</span>
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {searchResults.facts.map((fact, i) => (
                        <div key={`fact-${i}`} style={{ padding: "14px", background: "var(--surface-elevated)", borderRadius: "8px", borderLeft: "4px solid var(--secondary)", border: "1px solid var(--border-dim)", borderLeftWidth: "4px" }}>
                          <span style={{ color: "var(--secondary)", fontWeight: "600" }}>{fact.subject}</span>{" "}
                          <span style={{ color: "var(--text-secondary)", padding: "2px 6px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "4px", margin: "0 4px", fontSize: "12px" }}>{fact.relation}</span>{" "}
                          <span style={{ color: "var(--primary)", fontWeight: "600" }}>{fact.object}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(filterMode === "all" || filterMode === "chunks") && searchResults.chunks.length > 0 && (
                  <div>
                    <h3 style={{ color: "var(--primary)", marginBottom: "12px", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>{t.search.contextSection}</span>
                      <span style={{ fontSize: "12px", opacity: 0.5 }}>({searchResults.chunks.length})</span>
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {searchResults.chunks.map((result, i) => {
                        const score = searchResults.scores?.[i];
                        const similarityPercent = score ? Math.round(score * 100) : null;

                        return (
                          <div key={`chunk-${i}`} style={{ padding: "16px", background: "var(--surface-elevated)", borderRadius: "8px", borderLeft: "4px solid var(--primary)", border: "1px solid var(--border-dim)", borderLeftWidth: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                              <div style={{ color: "var(--primary)", fontWeight: "700", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {result.projectName || t.search.unknownProject}
                              </div>
                              {similarityPercent !== null && (
                                <div style={{ fontSize: "11px", color: "var(--success)", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: "2px 8px", borderRadius: "12px", fontWeight: 600 }}>
                                  {similarityPercent}% 匹配度
                                </div>
                              )}
                            </div>
                            <div style={{ color: "var(--text-primary)", lineHeight: "1.6", fontSize: "13px", whiteSpace: "pre-wrap" }}>
                              {result.content}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : searchQuery.trim().length > 2 ? (
              <div className="empty-state" style={{ padding: "60px 0" }}>
                {t.search.noResults}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-dim)", padding: "40px 0", fontSize: "14px" }}>
                {t.search.minChars}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
