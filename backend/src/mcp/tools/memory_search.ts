import { memoryStore, sessionStore } from "../../services/storage";

export interface MemorySearchInput {
  query?: string;
  limit?: number;
  space_id?: string;
  spaceId?: string;
  project?: string;
  filter_labels?: string;
  unit_type?: string;
  confidence_threshold?: number;
  mode?: "normal" | "deep";
}

export async function memorySearch(input: MemorySearchInput) {
  const {
    query,
    limit = 10,
    space_id,
    spaceId,
    project,
    filter_labels,
    unit_type,
    confidence_threshold = 0,
    mode = "normal",
  } = input;

  let targetSpaceId: string | undefined = space_id || spaceId || project;
  if (targetSpaceId) {
    const session = (await sessionStore.getSession(targetSpaceId)) || (await sessionStore.getSessionByName(targetSpaceId));
    if (session) targetSpaceId = session._id;
  }

  const labels = filter_labels ? filter_labels.split(/[,，\s]+/).filter(Boolean) : undefined;

  const results = await memoryStore.searchMemories({
    query,
    spaceId: targetSpaceId,
    filterLabels: labels,
    unitType: unit_type,
    limit: Math.min(20, Math.max(1, limit)),
    confidenceThreshold: confidence_threshold,
    mode,
  });

  return {
    query: query || null,
    total_found: results.length,
    memories: results.map((m) => ({
      id: m.id,
      reference_uri: `nowledgemem://memory/${m.id}`,
      title: m.title,
      content: m.content,
      importance: m.importance,
      unit_type: m.unitType,
      labels: m.labels,
      space_id: m.sessionId,
      is_latest: m.isLatest,
      score: m.score !== undefined ? parseFloat(m.score.toFixed(3)) : 1.0,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
  };
}
