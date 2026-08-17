import { memoryStore } from "../../services/storage";

export interface MemoryRelationListInput {
  memory_id: string;
  direction?: "out" | "in" | "both";
  relation_types?: string;
  status?: string;
  limit?: number;
}

export async function memoryRelationList(input: MemoryRelationListInput) {
  const { memory_id, direction = "both", relation_types, status = "active", limit = 50 } = input;

  if (!memory_id) {
    throw new Error("memory_id is required");
  }

  const types = relation_types ? relation_types.split(/[,，\s]+/).filter(Boolean) : undefined;
  const relations = await memoryStore.listRelations(memory_id, {
    direction,
    relationTypes: types,
    status,
    limit,
  });

  return {
    memory_id,
    total_relations: relations.length,
    relations: relations.map((r) => ({
      id: r.id,
      source_memory_id: r.sourceMemoryId,
      target_memory_id: r.targetMemoryId,
      relation_type: r.relationType,
      reason: r.reason,
      strength: r.strength,
      confidence: r.confidence,
      bidirectional: r.bidirectional,
      status: r.status,
      created_at: r.createdAt.toISOString(),
    })),
  };
}
