import { sessionStore, memoryStore, graphStore } from "../../services/storage";

export async function graphStats() {
  const sessions = await sessionStore.getSessions();
  const memories = await memoryStore.getMemories();
  const totalTriples = sessions.reduce((acc, s) => acc + (s.tripleCount || 0), 0);
  const totalChunks = sessions.reduce((acc, s) => acc + (s.topicCount || 0), 0);

  const graphData = await graphStore.getGraphData({ limit: 1000 });

  return {
    status: "success",
    total_spaces: sessions.length,
    total_memories: memories.length,
    total_facts: totalTriples,
    total_chunks: totalChunks,
    total_entities: graphData.nodes.length,
    total_relations: graphData.links.length,
  };
}
