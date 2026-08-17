/**
 * mcp/tools/list_timeline_reviews.ts
 *
 * Handler for `list_timeline_reviews` MCP tool.
 */

import { claimsChecker } from "../../services/claims-checker";

export interface ListTimelineReviewsInput {
  space_id?: string;
  spaceId?: string;
  status?: "pending" | "resolved" | "dismissed" | "all";
  limit?: number;
}

export async function listTimelineReviews(input: ListTimelineReviewsInput) {
  const spaceId = input.space_id || input.spaceId;
  const reviews = await claimsChecker.listReviews({
    space_id: spaceId,
    status: input.status || "pending",
    limit: input.limit || 20,
  });

  return {
    total_reviews: reviews.length,
    status_filter: input.status || "pending",
    reviews,
  };
}
