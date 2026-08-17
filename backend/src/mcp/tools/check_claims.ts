/**
 * mcp/tools/check_claims.ts
 *
 * Handler for `check_claims` MCP tool.
 * Pre-flight validation of statements against knowledge base to avoid hallucinations and outdated info.
 */

import { claimsChecker } from "../../services/claims-checker";

export interface CheckClaimsInput {
  text: string;
  space_id?: string;
  spaceId?: string;
  confidence_threshold?: number;
}

export async function checkClaims(input: CheckClaimsInput) {
  if (!input.text) {
    throw new Error("Missing required parameter: text");
  }

  const spaceId = input.space_id || input.spaceId || "default";
  const result = await claimsChecker.checkClaims({
    text: input.text,
    space_id: spaceId,
    confidence_threshold: input.confidence_threshold || 0.5,
  });

  return result;
}
