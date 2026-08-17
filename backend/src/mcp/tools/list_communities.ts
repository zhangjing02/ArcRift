import { communityService } from "../../services/community";
import { sessionStore } from "../../services/storage";

export async function listCommunities(args: { space_id?: string; limit?: number }) {
  const { space_id, limit = 20 } = args || {};

  let targetSpace = space_id;
  if (targetSpace) {
    const session = (await sessionStore.getSession(targetSpace)) || (await sessionStore.getSessionByName(targetSpace));
    if (session) targetSpace = session._id;
  }

  const communities = await communityService.listCommunities(targetSpace, limit);

  return {
    total_communities: communities.length,
    communities: communities.map((c) => ({
      id: c.id,
      name: c.name,
      summary: c.summary,
      member_count: c.memberCount,
      member_entities: c.memberEntities,
      space_id: c.sessionId,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
    })),
  };
}
