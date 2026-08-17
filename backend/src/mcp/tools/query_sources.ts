import { sourceStore, sessionStore } from "../../services/storage";

export interface QuerySourcesInput {
  query?: string;
  source_type?: string;
  sourceType?: string;
  lifecycle_state?: string;
  labels?: string | string[];
  space_id?: string;
  spaceId?: string;
  limit?: number;
}

export async function querySources(input: QuerySourcesInput) {
  const { query, source_type, sourceType, lifecycle_state, labels, space_id, spaceId, limit = 10 } = input;

  let targetSpace = space_id || spaceId;
  if (targetSpace) {
    const session = (await sessionStore.getSession(targetSpace)) || (await sessionStore.getSessionByName(targetSpace));
    if (session) targetSpace = session._id;
  }

  let parsedLabels: string[] | undefined = undefined;
  if (typeof labels === "string") {
    parsedLabels = labels.split(/[,，\s]+/).filter(Boolean);
  } else if (Array.isArray(labels)) {
    parsedLabels = labels;
  }

  const sources = await sourceStore.getSources(targetSpace, {
    sourceType: source_type || sourceType,
    lifecycleState: lifecycle_state,
    labels: parsedLabels,
    query,
    limit: Math.min(30, Math.max(1, limit)),
  });

  return {
    query: query || null,
    total_sources: sources.length,
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      source_type: s.sourceType,
      url: s.url,
      filePath: s.filePath,
      summary: s.summary,
      labels: s.labels,
      lifecycle_state: s.lifecycleState,
      space_id: s.sessionId,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    })),
  };
}
