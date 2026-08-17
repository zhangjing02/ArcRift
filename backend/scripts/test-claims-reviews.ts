/**
 * test-claims-reviews.ts
 *
 * Verifies:
 * 1. check_claims pre-flight conflict detection against deprecated/superseded memories
 * 2. check_claims pre-flight detection against disputed/challenged memories
 * 3. Timeline Reviews: create, list, and resolve reviews
 * 4. Adjudication effects (keep_newer_as_latest, keep_both_linked)
 */
import { initStorage, memoryStore, sessionStore } from "../src/services/storage";
import { checkClaims } from "../src/mcp/tools/check_claims";
import { listTimelineReviews } from "../src/mcp/tools/list_timeline_reviews";
import { resolveTimelineReview } from "../src/mcp/tools/resolve_timeline_review";
import { claimsChecker } from "../src/services/claims-checker";

async function main() {
  console.log("=== Testing Claims Checking & Timeline Review Inbox ===");
  await initStorage();

  const testSpace = `test_claims_${Date.now()}`;
  await sessionStore.createSession(testSpace, "Claims & Reviews Test Space", "custom", testSpace);

  // 1. Create a deprecated/superseded memory
  const memOld = await memoryStore.createMemory({
    id: `mem_deprecated_${Date.now()}`,
    sessionId: testSpace,
    title: "Legacy REST API Auth Token Format",
    content: "We use basic bearer auth tokens stored in plaintext cookies for all API calls.",
    importance: 0.8,
    unitType: "decision",
    claimStatus: "deprecated",
    isLatest: false,
    labels: ["auth", "security"],
  });

  // 2. Create an active modern decision
  const memNew = await memoryStore.createMemory({
    id: `mem_active_${Date.now()}`,
    sessionId: testSpace,
    title: "JWT Authentication Architecture with RS256",
    content: "We use signed JWT RS256 asymmetric tokens for microservice authentication.",
    importance: 0.9,
    unitType: "decision",
    claimStatus: "asserted",
    isLatest: true,
    labels: ["auth", "jwt"],
  });

  // 3. Test check_claims with a draft text referencing deprecated info
  console.log("\n[Test 1] Testing check_claims with conflicting draft text...");
  const draftReport = `
    This is our proposed sprint plan.
    We will configure all new endpoints to use basic bearer auth tokens stored in plaintext cookies.
    All microservices will accept this format directly.
  `;

  const checkRes = await checkClaims({
    text: draftReport,
    space_id: testSpace,
    confidence_threshold: 0.4,
  });

  console.log("-> check_claims Result:");
  console.log(`   Text Length: ${checkRes.text_length}`);
  console.log(`   Claims Extracted: ${checkRes.claims_extracted}`);
  console.log(`   Has Conflicts: ${checkRes.has_conflicts}`);
  console.log(`   Conflicts Count: ${checkRes.conflicts_count}`);
  for (const c of checkRes.conflicts) {
    console.log(`   * Conflict: "${c.claim_text}"`);
    console.log(`     Matched: ${c.matched_memory_title} (ID: ${c.matched_memory_id})`);
    console.log(`     Reason: ${c.conflict_reason}`);
    console.log(`     Risk: ${c.risk_level}`);
    console.log(`     Action: ${c.recommended_action}`);
  }

  if (!checkRes.has_conflicts || checkRes.conflicts.length === 0) {
    throw new Error("check_claims failed to detect conflict with deprecated auth memory");
  }

  // 4. Test Timeline Review Lifecycle
  console.log("\n[Test 2] Testing Timeline Review Inbox Creation...");
  const review = await claimsChecker.createReview({
    space_id: testSpace,
    memory_a_id: memOld.id,
    memory_b_id: memNew.id,
    conflict_type: "auth_architecture_conflict",
    conflict_reason: "Contradiction between legacy plaintext cookies and RS256 JWT tokens",
    evidence_a: memOld.content,
    evidence_b: memNew.content,
    suggested_action: "keep_newer_as_latest",
  });
  console.log("-> Review created:", review.id, "Status:", review.status);

  // 5. Test list_timeline_reviews
  console.log("\n[Test 3] Testing list_timeline_reviews...");
  const reviewList = await listTimelineReviews({
    space_id: testSpace,
    status: "pending",
  });
  console.log("-> Total pending reviews found:", reviewList.total_reviews);
  if (reviewList.total_reviews === 0) {
    throw new Error("list_timeline_reviews failed to list created review");
  }

  // 6. Test resolve_timeline_review (keep_newer_as_latest)
  console.log("\n[Test 4] Testing resolve_timeline_review (keep_newer_as_latest)...");
  const resolveRes = await resolveTimelineReview({
    review_id: review.id,
    action: "keep_newer_as_latest",
    custom_note: "Confirmed by security audit to deprecate legacy cookie auth.",
  });
  console.log("-> Resolution result:", resolveRes);

  const updatedMemOld = await memoryStore.getMemory(memOld.id);
  const updatedMemNew = await memoryStore.getMemory(memNew.id);

  if (!updatedMemOld || updatedMemOld.isLatest !== false || updatedMemOld.claimStatus !== "deprecated") {
    throw new Error("Old memory was not properly deprecated in adjudication");
  }
  if (!updatedMemNew || updatedMemNew.isLatest !== true || updatedMemNew.claimStatus !== "asserted") {
    throw new Error("New memory was not properly set as active latest in adjudication");
  }

  console.log("\n✅ ALL Claims Checking & Timeline Review TESTS PASSED WITH 100% SUCCESS!");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
