import React, { useState, useEffect } from "react";
import { NowledgeSidebar } from "./components/Nowledge/NowledgeSidebar";
import type { NavTab } from "./components/Nowledge/NowledgeSidebar";
import { TimelineView } from "./components/Nowledge/TimelineView";
import { MemoriesView } from "./components/Nowledge/MemoriesView";
import { ThreadsView } from "./components/Nowledge/ThreadsView";
import { NowledgeGraphView } from "./components/Nowledge/NowledgeGraphView";
import { AiNowView } from "./components/Nowledge/AiNowView";
import {
  LibraryView,
  KnowledgeTreeView,
  SkillsView,
  ContextView,
  StatsView,
} from "./components/Nowledge/OtherViews";
import SettingsView from "./components/SettingsView";

import type { Session } from "./types";
import { useSessions } from "./hooks/useSessions";
import { apiClient, extractErrorMessage } from "./api/ArcRift";
import { LocaleProvider } from "./context/LocaleContext";

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>("timeline");
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const {
    sessions,
    filteredSessions,
    loadSessions,
    handleDeleteSession,
  } = useSessions((deletedId) => {
    if (activeSession?._id === deletedId) {
      setActiveSession(sessions.find((s) => s._id !== deletedId) || null);
    }
  });

  useEffect(() => {
    if (!activeSession && sessions.length > 0) {
      setActiveSession(sessions[0]);
    }
  }, [sessions, activeSession]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        await apiClient.post("/api/session/import", data);
        await loadSessions();
      } catch (err) {
        setError(`导入失败: ${extractErrorMessage(err)}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="nl-app-layout">
      {/* 1. Global Left Sidebar */}
      <NowledgeSidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        sessions={sessions}
        activeSessionId={activeSession?._id}
        onSessionSelect={setActiveSession}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* 2. Main Workspace */}
      <main className="nl-main-workspace">
        {currentTab === "timeline" && (
          <TimelineView
            activeSession={activeSession || undefined}
            onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
          />
        )}

        {currentTab === "memories" && (
          <MemoriesView
            activeSession={activeSession || undefined}
            onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
          />
        )}

        {currentTab === "threads" && (
          <ThreadsView
            sessions={filteredSessions}
            activeSessionId={activeSession?._id}
            onSessionSelect={setActiveSession}
            onDeleteSession={handleDeleteSession}
            onImport={handleImport}
          />
        )}

        {currentTab === "ai-now" && (
          <AiNowView activeSession={activeSession || undefined} />
        )}

        {currentTab === "graph" && (
          <NowledgeGraphView sessionId={activeSession?._id} />
        )}

        {currentTab === "library" && (
          <LibraryView activeSession={activeSession || undefined} />
        )}

        {currentTab === "tree" && (
          <KnowledgeTreeView activeSession={activeSession || undefined} />
        )}

        {currentTab === "skills" && <SkillsView />}

        {currentTab === "context" && (
          <ContextView activeSession={activeSession || undefined} />
        )}

        {currentTab === "stats" && <StatsView sessions={sessions} />}

        {currentTab === "connect" && <SkillsView />}

        {currentTab === "feedback" && <StatsView sessions={sessions} />}

        {currentTab === "settings" && <SettingsView />}
      </main>

      {error && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "#ef4444",
            color: "#ffffff",
            padding: "10px 16px",
            borderRadius: 8,
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LocaleProvider>
      <AppContent />
    </LocaleProvider>
  );
};

export default App;
