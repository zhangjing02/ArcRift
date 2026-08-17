import { communityService } from "../../services/community";

export async function getCommunityDetails(args: { community_id: string }) {
  if (!args.community_id) {
    throw new Error("community_id is required");
  }

  const details = await communityService.getCommunityDetails(args.community_id);
  if (!details) {
    throw new Error(`Community ${args.community_id} not found`);
  }

  return {
    id: details.id,
    name: details.name,
    summary: details.summary,
    member_count: details.memberCount,
    member_entities: details.memberEntities,
    space_id: details.sessionId,
    related_memories: details.relatedMemories,
  };
}
