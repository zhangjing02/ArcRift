/**
 * mcp/tools/resolve_timeline_review.ts
 *
 * Handler for `resolve_timeline_review` MCP tool.
 */

import { claimsChecker } from "../../services/claims-checker";

export interface ResolveTimelineReviewInput {
  review_id: string;
  action: "keep_newer_as_latest" | "keep_older_as_latest" | "keep_both_linked" | "dismiss";
  custom_note?: string;
}

export async function resolveTimelineReview(input: ResolveTimelineReviewInput) {
  if (!input.review_id) {
    throw new Error("Missing required parameter: review_id");
  }
  if (!input.action) {
    throw new Error("Missing required parameter: action");
  }

  const result = await claimsChecker.resolveReview({
    review_id: input.review_id,
    action: input.action,
    custom_note: input.custom_note,
  });

  return result;
}
