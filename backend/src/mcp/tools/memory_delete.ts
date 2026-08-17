import { memoryStore } from "../../services/storage";

export async function memoryDelete(args: { memory_id?: string; id?: string }) {
  const memId = args.memory_id || args.id;
  if (!memId) {
    throw new Error("memory_id is required");
  }

  const success = await memoryStore.deleteMemory(memId);
  if (!success) {
    return {
      status: "not_found",
      message: `Memory ${memId} not found`,
    };
  }

  return {
    id: memId,
    status: "deleted",
    message: `Memory ${memId} successfully deleted`,
  };
}
