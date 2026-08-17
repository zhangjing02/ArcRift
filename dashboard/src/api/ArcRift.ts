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

export const getMemories = fetchMemories;
export const getWorkingMemory = fetchWorkingMemory;

export async function getGraphData(sessionId?: string): Promise<{ nodes: any[]; links: any[] }> {
  try {
    if (sessionId) {
      const data = await fetchGraphBySession(sessionId);
      if (data && data.nodes && data.nodes.length > 0) return data;
    }
    const res = await apiClient.get("/api/graph/all");
    return res.data || { nodes: [], links: [] };
  } catch {
    return { nodes: [], links: [] };
  }
}

export async function detectSystemTools(): Promise<{
  tools: Array<{
    id: string;
    name: string;
    avatar: string;
    detected: boolean;
    connected: boolean;
    statusText: string;
    configPath?: string;
  }>;
  activeCount: number;
  detectedCount: number;
  activeSummary: string;
}> {
  try {
    const res = await apiClient.get("/api/tools/detect");
    return res.data;
  } catch {
    return {
      tools: [],
      activeCount: 0,
      detectedCount: 0,
      activeSummary: "",
    };
  }
}

export async function connectToolById(toolId: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await apiClient.post("/api/tools/connect", { toolId });
    return res.data;
  } catch (err: any) {
    return { success: false, message: err?.response?.data?.error || "连接失败" };
  }
}

export async function getModelStatuses(): Promise<{
  success: boolean;
  models: Array<{
    id: string;
    name: string;
    type: "embedding" | "llm";
    category: string;
    sizeText: string;
    isDownloaded: boolean;
    isDownloading: boolean;
    progress: number;
    speed: string;
    downloadedBytes: number;
    totalBytes: number;
    error?: string;
  }>;
}> {
  try {
    const res = await apiClient.get("/api/models/status");
    return res.data;
  } catch {
    return { success: false, models: [] };
  }
}

export async function downloadModel(modelId: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await apiClient.post("/api/models/download", { modelId });
    return res.data;
  } catch (err: any) {
    return { success: false, message: err?.response?.data?.error || "下载请求失败" };
  }
}

export async function deleteModelById(modelId: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await apiClient.delete(`/api/models/${modelId}`);
    return res.data;
  } catch (err: any) {
    return { success: false, message: err?.response?.data?.error || "删除失败" };
  }
}

export async function fetchAppSettings(): Promise<any> {
  try {
    const res = await apiClient.get("/api/settings");
    return res.data;
  } catch {
    return null;
  }
}

export async function saveAppSettings(data: any): Promise<any> {
  try {
    const res = await apiClient.post("/api/settings", data);
    return res.data;
  } catch (err: any) {
    throw new Error(err?.response?.data?.error || "保存失败");
  }
}

export async function getFullChat(sessionId: string): Promise<import("../types").FullChat | null> {
  try {
    const res = await apiClient.get(`/api/chat/${sessionId}`);
    if (res.data?.found) {
      return {
        rawText: res.data.rawText,
        messageCount: res.data.messageCount,
        createdAt: res.data.createdAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchSources(sessionId?: string, query?: string): Promise<{ success: boolean; sources: any[] }> {
  try {
    const res = await apiClient.get("/api/sources", { params: { sessionId, query } });
    return res.data;
  } catch {
    return { success: false, sources: [] };
  }
}

export async function createSource(data: { name: string; sessionId?: string; sourceType?: string; url?: string; filePath?: string; summary?: string; rawContent?: string; labels?: string[] }): Promise<{ success: boolean; source?: any }> {
  const res = await apiClient.post("/api/sources", data);
  return res.data;
}

export async function deleteSource(id: string): Promise<{ success: boolean }> {
  const res = await apiClient.delete(`/api/sources/${id}`);
  return res.data;
}

export async function addMemoryRelation(data: { sourceMemoryId: string; targetMemoryId: string; relationType: string; reason?: string }): Promise<{ success: boolean; relation?: any }> {
  const res = await apiClient.post("/api/memories/relations", data);
  return res.data;
}

export async function fetchMemoryRelations(memoryId: string): Promise<{ success: boolean; relations: any[] }> {
  try {
    const res = await apiClient.get(`/api/memories/${memoryId}/relations`);
    return res.data;
  } catch {
    return { success: false, relations: [] };
  }
}

export async function deleteMemoryRelation(relationId: string): Promise<{ success: boolean }> {
  const res = await apiClient.delete(`/api/memories/relations/${relationId}`);
  return res.data;
}

// ── Intelligence / Smart Processing APIs ────────────────────────────
export async function fetchIntelligenceStats(): Promise<{ success: boolean; stats?: any }> {
  try {
    const res = await apiClient.get("/api/intelligence/stats");
    return res.data;
  } catch {
    return { success: false };
  }
}

export async function optimizeDatabase(): Promise<{ success: boolean; freedBytes: number; message: string }> {
  const res = await apiClient.post("/api/intelligence/optimize");
  return res.data;
}

export async function rebuildSearchIndex(): Promise<{ success: boolean; indexedCount: number; message: string }> {
  const res = await apiClient.post("/api/intelligence/rebuild-index");
  return res.data;
}

export async function cleanSessions(): Promise<{ success: boolean; cleanedEmptySessions: number; repairedOrphans: number; message: string }> {
  const res = await apiClient.post("/api/intelligence/clean-sessions");
  return res.data;
}

export async function fetchOntology(): Promise<{ success: boolean; ontology: any[] }> {
  try {
    const res = await apiClient.get("/api/intelligence/ontology");
    return res.data;
  } catch {
    return { success: false, ontology: [] };
  }
}

export async function saveOntology(ontology: any[]): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post("/api/intelligence/ontology", { ontology });
  return res.data;
}

export async function fetchMemoryPolicy(): Promise<{ success: boolean; policy?: any }> {
  try {
    const res = await apiClient.get("/api/intelligence/policy");
    return res.data;
  } catch {
    return { success: false };
  }
}

export async function saveMemoryPolicy(policy: any): Promise<{ success: boolean; policy?: any }> {
  const res = await apiClient.post("/api/intelligence/policy", policy);
  return res.data;
}

export async function fetchTokenUsage(): Promise<{ success: boolean; usage?: any }> {
  try {
    const res = await apiClient.get("/api/intelligence/token-usage");
    return res.data;
  } catch {
    return { success: false };
  }
}

export async function updateIntelligenceSettings(data: { searchRamLimit?: string; bgSmartActive?: boolean; monthlyTokenBudget?: number }): Promise<{ success: boolean }> {
  const res = await apiClient.post("/api/intelligence/settings", data);
  return res.data;
}

export { extractErrorMessage, apiClient };

