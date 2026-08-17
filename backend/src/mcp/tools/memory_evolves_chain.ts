import { memoryStore } from "../../services/storage";

export async function memoryEvolvesChain(args: { memory_id: string; max_depth?: number }) {
  const { memory_id, max_depth = 10 } = args || {};

  if (!memory_id) {
    throw new Error("memory_id is required");
  }

  const res = await memoryStore.getEvolutionChain(memory_id, max_depth);

  return {
    memory_id,
    position: res.position,
    total_versions: res.totalVersions,
    chain: res.chain.map((c) => ({
      id: c.id,
      title: c.title,
      unit_type: c.unitType,
      is_latest: c.isLatest,
      created_at: c.createdAt,
      evolves_from_id: c.evolvesFromId,
      evolves_relation: c.evolvesRelation,
    })),
  };
}
