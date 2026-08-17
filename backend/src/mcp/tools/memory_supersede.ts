import { memoryStore } from "../../services/storage";

export async function memorySupersede(args: { old_memory_id: string; new_memory_id: string; reason?: string }) {
  const { old_memory_id, new_memory_id, reason } = args || {};

  if (!old_memory_id || !new_memory_id) {
    throw new Error("old_memory_id and new_memory_id are required");
  }

  const res = await memoryStore.supersedeMemory(old_memory_id, new_memory_id, reason);

  return {
    status: res.status,
    superseded_memory_id: res.oldMemory.id,
    active_memory_id: res.newMemory.id,
    reason: reason || null,
  };
}
