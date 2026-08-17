import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../api/client";
import { useLocale } from "../context/LocaleContext";

interface HealthData {
  storageMode: string;
  sessionCount: number;
  chunkCount: number;
  graphBackend: string;
  jobQueue: {
    pending: number;
    processing: number;
    failed: number;
    deadLettered: number;
  };
  ollama: {
    reachable: boolean;
    model: string;
  };
}

export function SystemHealth() {
  const { t, locale } = useLocale();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await apiClient.get("/api/health");
      setHealth(res.data as HealthData);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  useEffect(() => {
    const timer = setInterval(() => setLastUpdated(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [isCollapsed, setIsCollapsed] = useState(true);

  const storageBadgeColor = health?.storageMode === "sqlite" ? "#818CF8" : "#34D399";
  const storageLabel = health?.storageMode?.toLowerCase() === "sqlite" 
    ? (locale === "zh" ? "SQLite (本地)" : "SQLite (Local)") 
    : health?.storageMode?.toUpperCase() || "STORAGE";

  return (
    <div className="system-health-panel">
      <div className="health-header" onClick={() => setIsCollapsed(!isCollapsed)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isCollapsed ? 0 : "10px" }}>
        <div>
          <span className="health-title">{t.health.title}</span>
          {lastUpdated && !isCollapsed && (
            <span className="health-updated" style={{ marginLeft: "8px" }}>
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </span>
          )}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s ease-in-out", transformOrigin: "center" }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {!isCollapsed && (
        <>
          {loading && <div className="health-loading">{t.health.checking}</div>}

          {error && !loading && (
            <div className="health-error">
              <span className="health-indicator red" /> {t.health.backendUnreachable}
            </div>
          )}

          {health && !error && (
            <div className="health-metrics">
              {/* Storage Mode */}
              <div className="health-row">
                <span className="health-label">{t.health.storage}</span>
                <span className="health-badge" style={{ background: storageBadgeColor + "22", color: storageBadgeColor, border: `1px solid ${storageBadgeColor}44` }}>
                  {storageLabel}
                </span>
              </div>

              {/* Sessions */}
              <div className="health-row">
                <span className="health-label">{t.health.sessions}</span>
                <span className="health-value">{health.sessionCount}</span>
              </div>

              {/* Job Queue */}
              <div className="health-row">
                <span className="health-label">{t.health.jobQueue}</span>
                <span className="health-queue">
                  {health.jobQueue.pending > 0 && (
                    <span className="queue-pill pending">{health.jobQueue.pending} {t.health.pendingSuffix}</span>
                  )}
                  {health.jobQueue.processing > 0 && (
                    <span className="queue-pill processing">{health.jobQueue.processing} {t.health.activeSuffix}</span>
                  )}
                  {health.jobQueue.deadLettered > 0 && (
                    <span className="queue-pill failed">{health.jobQueue.deadLettered} {t.health.failedSuffix}</span>
                  )}
                  {health.jobQueue.pending === 0 && health.jobQueue.processing === 0 && health.jobQueue.deadLettered === 0 && (
                    <span className="queue-pill idle">{t.health.idle}</span>
                  )}
                </span>
              </div>

              {/* Graph Backend */}
              <div className="health-row">
                <span className="health-label">{t.health.graph}</span>
                <span className="health-value">{health.graphBackend}</span>
              </div>

              {/* AI Service & Model */}
              <div className="health-row">
                <span className="health-label">{t.health.aiService}</span>
                <span className="health-ollama">
                  <span className={`health-indicator ${health.ollama.reachable ? "green" : "red"}`} />
                  {health.ollama.reachable ? (health.ollama.model || t.health.online) : t.health.offline}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
