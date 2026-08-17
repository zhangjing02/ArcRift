import { sessionStore, memoryStore } from "../../services/storage";

export async function listSpaces() {
  const sessions = await sessionStore.getSessions();
  const memories = await memoryStore.getMemories();

  const spaces = sessions.map((s) => {
    const spaceMems = memories.filter((m) => m.sessionId === s._id);
    return {
      id: s._id,
      key: s.projectName.toLowerCase().replace(/\s+/g, "-"),
      name: s.projectName,
      platform: s.platform,
      usage: {
        memories: spaceMems.length,
        triples: s.tripleCount || 0,
        chunks: s.topicCount || 0,
        hasWorkingMemory: !!s.summary,
      },
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  });

  return {
    status: "success",
    total_spaces: spaces.length,
    spaces,
  };
}
