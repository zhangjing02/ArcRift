import { graphStore, memoryStore } from "../../services/storage";

export async function exploreGraph(args: { memory_ids?: string; sessionId?: string; space_id?: string; limit?: number }) {
  const { memory_ids, sessionId, space_id, limit = 20 } = args;
  const targetSpace = space_id || sessionId;

  let entities: string[] = [];
  if (memory_ids) {
    const ids = memory_ids.split(",").map((s) => s.trim()).filter(Boolean);
    for (const id of ids) {
      const mem = await memoryStore.getMemory(id);
      if (mem) {
        entities.push(mem.title);
        entities.push(...mem.labels);
      }
    }
  }

  let graphData;
  if (entities.length > 0) {
    const triples = targetSpace
      ? await graphStore.findRelatedTriples(entities, targetSpace)
      : await graphStore.findRelatedTriplesGlobal(entities);
    
    const nodes = new Map<string, any>();
    const links: any[] = [];

    for (const t of triples) {
      if (!nodes.has(t.subject)) nodes.set(t.subject, { id: t.subject, type: t.subjectType || "Entity" });
      if (!nodes.has(t.object)) nodes.set(t.object, { id: t.object, type: t.objectType || "Entity" });
      links.push({
        source: t.subject,
        target: t.object,
        relation: t.relation,
        timestamp: t.timestamp,
      });
    }

    graphData = { nodes: Array.from(nodes.values()), links };
  } else {
    graphData = await graphStore.getGraphData({ sessionId: targetSpace, limit });
  }

  return {
    status: "success",
    node_count: graphData.nodes.length,
    edge_count: graphData.links.length,
    nodes: graphData.nodes,
    edges: graphData.links,
  };
}
