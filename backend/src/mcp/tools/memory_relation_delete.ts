import { memoryStore } from "../../services/storage";

export async function memoryRelationDelete(args: { relation_id: string }) {
  if (!args.relation_id) {
    throw new Error("relation_id is required");
  }

  const success = await memoryStore.deleteRelation(args.relation_id);
  if (!success) {
    return {
      status: "not_found",
      message: `Relation ${args.relation_id} not found`,
    };
  }

  return {
    status: "deleted",
    message: `Relation ${args.relation_id} successfully deleted`,
  };
}
