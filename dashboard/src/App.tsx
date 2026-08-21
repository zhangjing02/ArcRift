import React, { useState } from "react";
import { NowledgeSidebar } from "./components/Nowledge/NowledgeSidebar";
import type { NavTab } from "./components/Nowledge/NowledgeSidebar";
import { TimelineView } from "./components/Nowledge/TimelineView";
import { MemoriesView } from "./components/Nowledge/MemoriesView";
import { ThreadsView } from "./components/Nowledge/ThreadsView";
import { NowledgeGraphView } from "./components/Nowledge/NowledgeGraphView";
import { AiNowView } from "./components/Nowledge/AiNowView";
import { ConnectView } from "./components/Nowledge/ConnectView";
import { NowledgeSettingsView } from "./components/Nowledge/NowledgeSettingsView";
import { SkillsView } from "./components/Nowledge/SkillsView";
import { KnowledgeTreeView } from "./components/Nowledge/KnowledgeTreeView";
import {
  LibraryView,
  ContextView,
  StatsView,
} from "./components/Nowledge/OtherViews";

import type { Session, Memory } from "./types";
import { useSessions } from "./hooks/useSessions";
import { apiClient, extractErrorMessage, getMemories } from "./api/ArcRift";
import { LocaleProvider } from "./context/LocaleContext";
import { ThemeProvider } from "./context/ThemeContext";
import { NowledgeTopHeader } from "./components/Nowledge/NowledgeTopHeader";

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>("timeline");
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [selectedMemoryTitle, setSelectedMemoryTitle] = useState<string | null>(null);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [pinnedMemories, setPinnedMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadPinnedMemories = async () => {
    try {
      const res = await getMemories();
      const list = Array.isArray(res) ? res : (res?.memories || []);
      setPinnedMemories(list.filter((m: Memory) => !!m.isPinned));
    } catch (e) {
      console.error("Failed to load pinned memories", e);
    }
  };

  React.useEffect(() => {
    loadPinnedMemories();
  }, []);

  const {
    sessions,
    filteredSessions,
    loadSessions,
    handleDeleteSession,
  } = useSessions((deletedId) => {
    if (activeSession?._id === deletedId) {
      setActiveSession(null);
    }
  });

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
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setSelectedMemoryTitle(null);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        threadsCount={sessions.length}
        pinnedMemories={pinnedMemories}
        onSelectPinnedMemory={(m) => {
          setCurrentTab("memories");
          setSelectedMemoryId(m.id);
        }}
      />

      {/* 2. Main Workspace */}
      <main className="nl-main-workspace">
        {/* Global Top Header Bar with Space Selector */}
        <NowledgeTopHeader
          currentTab={currentTab}
          activeSession={activeSession}
          sessions={sessions}
          onSessionSelect={setActiveSession}
          selectedMemoryTitle={selectedMemoryTitle}
        />

        <div className="nl-workspace-content-body">
          {currentTab === "timeline" && (
            <TimelineView
              activeSession={activeSession || undefined}
              onNavigateTab={(tab) => {
                setCurrentTab(tab as NavTab);
                setSelectedMemoryTitle(null);
              }}
            />
          )}

          {currentTab === "memories" && (
            <MemoriesView
              activeSession={activeSession || undefined}
              onNavigateTab={(tab) => {
                setCurrentTab(tab as NavTab);
                setSelectedMemoryTitle(null);
              }}
              onSelectedMemoryChange={(mem) => setSelectedMemoryTitle(mem ? mem.title : null)}
              onPinnedChange={loadPinnedMemories}
              initialSelectedMemoryId={selectedMemoryId}
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
          <KnowledgeTreeView
            activeSession={activeSession || undefined}
            onNavigateTab={(tab) => setCurrentTab(tab as any)}
          />
        )}

        {currentTab === "skills" && (
          <SkillsView onNavigateTab={(tab) => setCurrentTab(tab as any)} />
        )}

        {currentTab === "context" && (
          <ContextView activeSession={activeSession || undefined} />
        )}

        {currentTab === "stats" && <StatsView sessions={sessions} />}

        {currentTab === "connect" && <ConnectView />}

        {currentTab === "feedback" && <StatsView sessions={sessions} />}

        {currentTab === "settings" && <NowledgeSettingsView />}
        </div>
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
    <ThemeProvider>
      <LocaleProvider>
        <AppContent />
      </LocaleProvider>
    </ThemeProvider>
  );
};

export default App;
