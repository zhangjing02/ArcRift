import { apiClient, extractErrorMessage } from "./client";

export interface SettingsResponse {
  ollamaReachable: boolean;
  availableModels: string[];
  activeEmbeddingModel: string;
  activeExtractionModel: string;
  chatProvider?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  chatModel?: string;
  embeddingProvider?: string;
  embeddingBaseUrl?: string;
  embeddingApiKey?: string;
  embeddingModel?: string;
  contextMode?: "raw" | "summarized";
}

export async function fetchGraphBySession(sessionId: string) {
  const res = await apiClient.get(`/api/graph/session/${sessionId}`);
  return res.data as {
    nodes: { id: string; type: string }[];
    links: { source: string; target: string; relation: string }[];
  };
}

export async function fetchContext(sessionId: string) {
  const res = await apiClient.get(`/api/context/retrieve/${sessionId}`);
  return res.data;
}

export async function fetchSessions() {
  const res = await apiClient.get(`/api/context/sessions`);
  return res.data as {
    sessions: {
      _id: string;
      projectName: string;
      platform: string;
      tripleCount: number;
      topicCount?: number;
      hasFullChat?: boolean;
      tokensSaved?: number;
      retrievalCount?: number;
      createdAt: string;
      updatedAt: string;
    }[];
  };
}

export async function setActiveSession(sessionId: string) {
  const res = await apiClient.post(`/api/context/active`, { sessionId });
  return res.data;
}

export async function deleteSession(sessionId: string) {
  const res = await apiClient.delete(`/api/context/session/${sessionId}`);
  return res.data;
}

export async function exportSession(sessionId: string) {
  // Use direct URL for download - assumes API_URL is correct in apiClient
  const baseUrl = apiClient.defaults.baseURL || "http://localhost:3001";
  const url = new URL(`${baseUrl}/api/session/export/${sessionId}`);
  window.open(url.toString(), "_blank");
}

export async function importSession(data: any) {
  const res = await apiClient.post(`/api/session/import`, { data });
  return res.data;
}

export async function searchGlobal(prompt: string) {
  const res = await apiClient.post(`/api/rag/global`, { prompt, topN: 10 });
  return res.data as {
    found: boolean;
    chunks: { content: string; projectName?: string }[];
    graphFacts: { subject: string; relation: string; object: string; sessionId?: string }[];
    scores?: number[];
  };
}

export async function pruneGraphNode(nodeId: string, sessionId?: string) {
  const res = await apiClient.post(`/api/graph/prune`, { nodeId, sessionId });
  return res.data;
}

export async function renameGraphNode(oldName: string, newName: string, sessionId?: string) {
  const res = await apiClient.post(`/api/graph/rename-node`, { oldName, newName, sessionId });
  return res.data;
}

export async function deleteGraphEdge(source: string, target: string, relation: string, sessionId?: string) {
  const res = await apiClient.post(`/api/graph/delete-edge`, { source, target, relation, sessionId });
  return res.data;
}

export async function fetchSettings(): Promise<SettingsResponse> {
  const res = await apiClient.get("/api/settings");
  return res.data;
}

export async function updateSettings(data: {
  activeEmbeddingModel?: string;
  activeExtractionModel?: string;
  chatProvider?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  chatModel?: string;
  embeddingProvider?: string;
  embeddingBaseUrl?: string;
  embeddingApiKey?: string;
  embeddingModel?: string;
  contextMode?: "raw" | "summarized";
}) {
  const res = await apiClient.post("/api/settings", data);
  return res.data;
}

export async function testSettingsConnection(data: {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  embeddingModel?: string;
}) {
  const res = await apiClient.post("/api/settings/test", data);
  return res.data as { success: boolean; message: string; error?: string };
}

export async function mergeSessions(sourceId: string, targetId: string) {
  const res = await apiClient.post("/api/session/merge", { sourceId, targetId });
  return res.data;
}

// ── Nowledge Mem API: Discrete Memories ──────────────────────────────
export async function fetchMemories(params?: {
  sessionId?: string;
  importance?: string;
  category?: string;
  query?: string;
}) {
  const res = await apiClient.get("/api/memories", { params });
  return res.data as { success: boolean; memories: import("../types").Memory[] };
}

export async function createMemory(data: {
  sessionId: string;
  title?: string;
  content: string;
  importance?: string;
  category?: string;
  tags?: string[];
  source?: string;
}) {
  const res = await apiClient.post("/api/memories", data);
  return res.data as { success: boolean; memory: import("../types").Memory; triplesExtracted?: number };
}

export async function updateMemory(id: string, data: Partial<import("../types").Memory>) {
  const res = await apiClient.patch(`/api/memories/${id}`, data);
  return res.data as { success: boolean; memory: import("../types").Memory };
}

export async function deleteMemory(id: string) {
  const res = await apiClient.delete(`/api/memories/${id}`);
  return res.data as { success: boolean };
}

// ── Nowledge Mem API: Working Memory Briefing ─────────────────────────
export async function fetchWorkingMemory(sessionId: string) {
  const res = await apiClient.get(`/api/working-memory/${sessionId}`);
  return res.data as { success: boolean; workingMemory: import("../types").WorkingMemory };
}

export async function saveWorkingMemory(sessionId: string, data: {
  briefing?: string;
  focusAreas?: string[];
  activeDecisions?: string[];
  blockers?: string[];
}) {
  const res = await apiClient.put(`/api/working-memory/${sessionId}`, data);
  return res.data as { success: boolean; workingMemory: import("../types").WorkingMemory };
}

export async function generateWorkingMemory(sessionId: string) {
  const res = await apiClient.post("/api/working-memory/generate", { sessionId });
  return res.data as { success: boolean; workingMemory: import("../types").WorkingMemory };
}

export { extractErrorMessage, apiClient };
