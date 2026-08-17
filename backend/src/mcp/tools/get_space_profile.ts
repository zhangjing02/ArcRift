import { sessionStore, memoryStore, graphStore, sourceStore } from "../../services/storage";
import { communityService } from "../../services/community";

export async function getSpaceProfile(args: { space_ref: string }) {
  const { space_ref } = args || {};

  if (!space_ref) {
    throw new Error("space_ref is required");
  }

  const sessions = await sessionStore.getSessions();
  const session =
    sessions.find((s) => s._id === space_ref) ||
    sessions.find((s) => s.projectName.toLowerCase() === space_ref.toLowerCase()) ||
    sessions.find((s) => s.projectName.toLowerCase().replace(/\s+/g, "-") === space_ref.toLowerCase());

  if (!session) {
    throw new Error(`Space '${space_ref}' not found`);
  }

  const [memories, triples, sources, communities, workingMem] = await Promise.all([
    memoryStore.getMemories(session._id),
    graphStore.getTriplesBySession(session._id),
    sourceStore.getSources(session._id),
    communityService.listCommunities(session._id),
    memoryStore.getWorkingMemory(session._id),
  ]);

  return {
    id: session._id,
    key: session.projectName.toLowerCase().replace(/\s+/g, "-"),
    name: session.projectName,
    platform: session.platform,
    stats: {
      total_memories: memories.length,
      total_facts: triples.length,
      total_sources: sources.length,
      total_communities: communities.length,
    },
    working_memory: workingMem ? {
      briefing: workingMem.briefing,
      focus_areas: workingMem.focusAreas,
      active_decisions: workingMem.activeDecisions,
      blockers: workingMem.blockers,
      last_generated_at: workingMem.lastGeneratedAt.toISOString(),
    } : null,
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
  };
}
