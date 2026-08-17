import { memoryStore } from "../../services/storage";

export interface MemoryUpdateInput {
  memory_id?: string;
  id?: string;
  title?: string;
  content?: string;
  importance?: number | string;
  unit_type?: string;
  labels?: string | string[];
  claim_status?: string;
}

export async function memoryUpdate(input: MemoryUpdateInput) {
  const memId = input.memory_id || input.id;
  if (!memId) {
    throw new Error("memory_id is required");
  }

  let parsedLabels: string[] | undefined = undefined;
  if (typeof input.labels === "string") {
    parsedLabels = input.labels.split(/[,，\s]+/).filter(Boolean);
  } else if (Array.isArray(input.labels)) {
    parsedLabels = input.labels;
  }

  const updated = await memoryStore.updateMemory(memId, {
    title: input.title,
    content: input.content,
    importance: input.importance as any,
    unitType: input.unit_type as any,
    labels: parsedLabels,
    claimStatus: input.claim_status as any,
  });

  if (!updated) {
    throw new Error(`Memory ${memId} not found`);
  }

  return {
    id: updated.id,
    title: updated.title,
    status: "updated",
    unit_type: updated.unitType,
    importance: updated.importance,
    labels: updated.labels,
    updated_at: updated.updatedAt.toISOString(),
  };
}
