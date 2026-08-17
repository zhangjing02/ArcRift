import { communityService } from "../../services/community";
import { sessionStore } from "../../services/storage";

export async function runCommunityDetection(args: { space_id?: string }) {
  const { space_id } = args || {};

  let targetSpace = space_id;
  if (targetSpace) {
    const session = (await sessionStore.getSession(targetSpace)) || (await sessionStore.getSessionByName(targetSpace));
    if (session) targetSpace = session._id;
  }

  const communities = await communityService.runCommunityDetection(targetSpace);

  return {
    status: "completed",
    detected_count: communities.length,
    communities: communities.map((c) => ({
      id: c.id,
      name: c.name,
      summary: c.summary,
      member_count: c.memberCount,
      member_entities: c.memberEntities,
      space_id: c.sessionId,
    })),
  };
}
