import { memoryStore, sessionStore, graphStore, vectorStore } from "../../services/storage";
import { extractTriples } from "../../services/extractor";
import { slidingWindowChunks } from "../../services/chunker";
import { logger } from "../../utils/logger";

export interface MemoryAddInput {
  content: string;
  title?: string;
  id?: string;
  space_id?: string;
  spaceId?: string;
  project?: string;
  importance?: number | string;
  unit_type?: string;
  unitType?: string;
  labels?: string | string[];
  tags?: string | string[];
  claim_status?: string;
  evolves_from_id?: string;
  evolves_relation?: string;
  source?: string;
  source_app?: string;
  temporal_context?: string;
}

export async function memoryAdd(input: MemoryAddInput) {
  const {
    content,
    title,
    id,
    space_id,
    spaceId,
    project,
    importance,
    unit_type,
    unitType,
    labels,
    tags,
    claim_status,
    evolves_from_id,
    evolves_relation,
    source,
    source_app,
    temporal_context,
  } = input;

  if (!content || typeof content !== "string" || !content.trim()) {
    throw new Error("content is required");
  }

  // 1. Resolve Space / Session ID
  let targetSpaceName = space_id || spaceId || project || "default";
  let session = await sessionStore.getSession(targetSpaceName);
  if (!session) {
    session = await sessionStore.getSessionByName(targetSpaceName);
  }
  if (!session) {
    session = await sessionStore.createSession(targetSpaceName, "mcp", undefined, targetSpaceName);
  }

  // Parse labels
  let parsedLabels: string[] = [];
  if (typeof labels === "string") {
    parsedLabels = labels.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(labels)) {
    parsedLabels = labels;
  } else if (typeof tags === "string") {
    parsedLabels = tags.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(tags)) {
    parsedLabels = tags;
  }

  // 2. Create/Upsert Memory Card in SQLite
  const memory = await memoryStore.createMemory({
    id: id || undefined,
    sessionId: session._id,
    title: title || (content.slice(0, 40) + (content.length > 40 ? "..." : "")),
    content,
    importance: importance as any,
    unitType: (unit_type || unitType || "context") as any,
    labels: parsedLabels,
    tags: parsedLabels,
    claimStatus: (claim_status || "asserted") as any,
    evolvesFromId: evolves_from_id,
    evolvesRelation: evolves_relation as any,
    source: source || "mcp",
    sourceApp: source_app || undefined,
    temporalContext: temporal_context || "timeless",
  });

  // 3. Extract Triples for Knowledge Graph (if meaningful content)
  let triplesExtracted = 0;
  if (content.length >= 20) {
    try {
      const { triples } = await extractTriples(content);
      for (const t of triples) {
        await graphStore.saveTriple({
          ...t,
          sessionId: session._id,
          timestamp: new Date().toISOString(),
        });
      }
      triplesExtracted = triples.length;

      if (triplesExtracted > 0) {
        await sessionStore.updateSession(session._id, {
          tripleCount: (session.tripleCount || 0) + triplesExtracted,
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      logger.warn("Non-fatal graph triple extraction error in MCP memoryAdd:", err);
    }
  }

  // 4. Store sliding window vector chunks
  try {
    const chunks = slidingWindowChunks(content, session._id, 150, 50);
    await vectorStore.storeChunks(chunks);
  } catch (err) {
    logger.warn("Non-fatal vector chunk storage error in MCP memoryAdd:", err);
  }

  return {
    id: memory.id,
    reference_uri: `nowledgemem://memory/${memory.id}`,
    title: memory.title,
    assigned_labels: memory.labels,
    status: "created",
    action: id ? "upserted" : "created",
    importance: memory.importance,
    unit_type: memory.unitType,
    triples_extracted: triplesExtracted,
    evolves: evolves_from_id
      ? {
          older_memory_id: evolves_from_id,
          newer_memory_id: memory.id,
          relation: evolves_relation || "replaces",
          linked: true,
        }
      : undefined,
  };
}
