import { memoryStore } from "../../services/storage";

export async function getMemoryById(args: { memory_id?: string; id?: string }) {
  const memId = args.memory_id || args.id;
  if (!memId) {
    throw new Error("memory_id required");
  }

  const memory = await memoryStore.getMemory(memId);
  if (!memory) {
    throw new Error(`Memory ${memId} not found`);
  }

  return {
    id: memory.id,
    reference_uri: `nowledgemem://memory/${memory.id}`,
    title: memory.title,
    content: memory.content,
    unit_type: memory.unitType,
    importance: memory.importance,
    is_latest: memory.isLatest,
    labels: memory.labels,
    claim_status: memory.claimStatus,
    evolves_from_id: memory.evolvesFromId || null,
    evolves_relation: memory.evolvesRelation || null,
    source: memory.source,
    space_id: memory.sessionId,
    created_at: memory.createdAt.toISOString(),
    updated_at: memory.updatedAt.toISOString(),
  };
}
