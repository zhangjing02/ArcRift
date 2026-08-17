import { memoryStore } from "../../services/storage";

export interface MemoryRelationAddInput {
  source_memory_id: string;
  target_memory_id: string;
  relation_type: string;
  reason?: string;
  strength?: number;
  confidence?: number;
  bidirectional?: boolean;
  status?: "active" | "suggested";
}

export async function memoryRelationAdd(input: MemoryRelationAddInput) {
  const {
    source_memory_id,
    target_memory_id,
    relation_type,
    reason,
    strength = 1.0,
    confidence = 1.0,
    bidirectional = false,
    status = "active",
  } = input;

  if (!source_memory_id || !target_memory_id || !relation_type) {
    throw new Error("source_memory_id, target_memory_id, and relation_type are required");
  }

  const relation = await memoryStore.addRelation({
    sourceMemoryId: source_memory_id,
    targetMemoryId: target_memory_id,
    relationType: relation_type,
    reason,
    strength,
    confidence,
    bidirectional,
    status,
  });

  return {
    status: "created",
    relation: {
      id: relation.id,
      source_memory_id: relation.sourceMemoryId,
      target_memory_id: relation.targetMemoryId,
      relation_type: relation.relationType,
      reason: relation.reason,
      strength: relation.strength,
      confidence: relation.confidence,
      bidirectional: relation.bidirectional,
      created_at: relation.createdAt.toISOString(),
    },
  };
}
