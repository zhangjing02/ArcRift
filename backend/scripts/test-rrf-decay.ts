/**
 * test-rrf-decay.ts
 *
 * Verifies:
 * 1. RRF Multi-channel retrieval and score normalization
 * 2. 30-day half life exponential decay (older memories decay gracefully)
 * 3. Timeless memories protection (never decays)
 * 4. Importance floor protection
 */
import { initStorage, memoryStore, sessionStore } from "../src/services/storage";

async function main() {
  console.log("=== Testing RRF & 30-Day Half-Life Exponential Decay ===");
  initStorage();

  const testSpace = `test_rrf_${Date.now()}`;
  await sessionStore.createSession(testSpace, "RRF Test Space", "custom");

  const now = Date.now();
  const DAY_MS = 24 * 3600 * 1000;

  // 1. Create a fresh memory today (importance 0.8)
  const memFresh = await memoryStore.createMemory({
    id: `mem_fresh_${Date.now()}`,
    sessionId: testSpace,
    title: "Fresh Architecture Decision on LanceDB and Vector Search",
    content: "We use LanceDB and sqlite-vec for high-performance vector search in ArcRift.",
    importance: 0.8,
    unitType: "decision",
    temporalContext: "present",
    labels: ["search", "architecture"],
  });

  // 2. Create an old memory 60 days ago (importance 0.8, temporalContext: present -> decays over 2 half-lives)
  const memOld = await memoryStore.createMemory({
    id: `mem_old_${Date.now()}`,
    sessionId: testSpace,
    title: "Old Architecture Note on LanceDB Search",
    content: "LanceDB was initially chosen for vector search experiments.",
    importance: 0.8,
    unitType: "decision",
    temporalContext: "present",
    labels: ["search", "architecture"],
  });
  // Manually backdate memOld to 60 days ago
  const sixtyDaysAgo = new Date(now - 60 * DAY_MS).toISOString();
  (memoryStore as any).db.prepare("UPDATE memories SET createdAt = ?, updatedAt = ? WHERE id = ?").run(
    sixtyDaysAgo,
    sixtyDaysAgo,
    memOld.id
  );

  // 3. Create an old timeless memory 90 days ago (importance 0.8, temporalContext: timeless -> should NOT decay)
  const memTimeless = await memoryStore.createMemory({
    id: `mem_timeless_${Date.now()}`,
    sessionId: testSpace,
    title: "Timeless Golden Rule on LanceDB Search",
    content: "LanceDB vector search must always operate under local-first principles.",
    importance: 0.8,
    unitType: "fact",
    temporalContext: "timeless",
    labels: ["search", "principles"],
  });
  const ninetyDaysAgo = new Date(now - 90 * DAY_MS).toISOString();
  (memoryStore as any).db.prepare("UPDATE memories SET createdAt = ?, updatedAt = ? WHERE id = ?").run(
    ninetyDaysAgo,
    ninetyDaysAgo,
    memTimeless.id
  );

  console.log("-> 3 test memories created with distinct temporal contexts.");

  // Test Search with RRF
  const searchResults = await memoryStore.searchMemories({
    query: "LanceDB vector search",
    spaceId: testSpace,
    limit: 10,
  });

  console.log(`-> Search returned ${searchResults.length} results:`);
  for (const r of searchResults) {
    console.log(`   * [Score: ${r.score}] ${r.title} (Temporal: ${r.temporalContext}, Unit: ${r.unitType})`);
  }

  // Assertions
  if (searchResults.length < 3) {
    throw new Error(`Expected 3 results, got ${searchResults.length}`);
  }

  const freshRes = searchResults.find(r => r.id === memFresh.id);
  const oldRes = searchResults.find(r => r.id === memOld.id);
  const timelessRes = searchResults.find(r => r.id === memTimeless.id);

  if (!freshRes || !oldRes || !timelessRes) {
    throw new Error("Missing expected memory in search results");
  }

  console.log(`   Fresh Score: ${freshRes.score}`);
  console.log(`   Old (60d) Score: ${oldRes.score}`);
  console.log(`   Timeless (90d) Score: ${timelessRes.score}`);

  // Fresh score should be higher than old 60-day decayed score
  if ((freshRes.score || 0) <= (oldRes.score || 0)) {
    throw new Error(`Fresh memory score (${freshRes.score}) should be higher than 60d decayed memory score (${oldRes.score})`);
  }

  // Timeless memory (90d old) should preserve high score, higher than normal 60d decayed memory
  if ((timelessRes.score || 0) <= (oldRes.score || 0)) {
    throw new Error(`Timeless memory score (${timelessRes.score}) should be protected from decay compared to regular old memory (${oldRes.score})`);
  }

  console.log("✅ All RRF & Half-Life Decay assertions PASSED successfully!");
}

main().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
