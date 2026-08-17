import { initStorage, memoryStore, graphStore, sessionStore } from "../src/services/storage";
import { runCommunityDetection } from "../src/mcp/tools/run_community_detection";
import { listCommunities } from "../src/mcp/tools/list_communities";
import { getCommunityDetails } from "../src/mcp/tools/get_community_details";
import { memoryEvolvesChain } from "../src/mcp/tools/memory_evolves_chain";
import { memorySupersede } from "../src/mcp/tools/memory_supersede";

async function runP2Tests() {
  console.log("=== STARTING NOWLEDGE MEM P2 (COMMUNITIES & EVOLUTION) TEST ===");
  await initStorage();

  const spaceId = "test-space-p2";

  // Create session
  await sessionStore.createSession("P2 Test Space", "test", undefined, spaceId);

  // 1. Insert Graph Triples for Community Detection
  console.log("\n[Test 1] Populating test knowledge graph triples...");
  const facts = [
    { sessionId: spaceId, subject: "SqliteEngine", subjectType: "Database", relation: "implements", object: "WALMode", objectType: "Feature", timestamp: new Date().toISOString() },
    { sessionId: spaceId, subject: "SqliteEngine", subjectType: "Database", relation: "loads", object: "SqliteVecExtension", objectType: "Plugin", timestamp: new Date().toISOString() },
    { sessionId: spaceId, subject: "SqliteVecExtension", subjectType: "Plugin", relation: "provides", object: "VectorSimilaritySearch", objectType: "Capability", timestamp: new Date().toISOString() },
    { sessionId: spaceId, subject: "JWTAuth", subjectType: "Security", relation: "validates", object: "BearerToken", objectType: "Credential", timestamp: new Date().toISOString() },
    { sessionId: spaceId, subject: "JWTAuth", subjectType: "Security", relation: "stores_in", object: "RedisSessionStore", objectType: "Cache", timestamp: new Date().toISOString() },
  ];
  for (const f of facts) {
    await graphStore.saveTriple(f);
  }

  // 2. Test runCommunityDetection
  console.log("\n[Test 2] Testing runCommunityDetection...");
  const detectRes = await runCommunityDetection({ space_id: spaceId });
  console.log("-> Detected communities count:", detectRes.detected_count);
  if (detectRes.detected_count < 2) throw new Error("Expected at least 2 distinct clusters");

  // 3. Test listCommunities
  console.log("\n[Test 3] Testing listCommunities...");
  const commsList = await listCommunities({ space_id: spaceId });
  console.log("-> listCommunities total:", commsList.total_communities);
  if (commsList.total_communities === 0) throw new Error("No communities returned");

  // 4. Test getCommunityDetails
  console.log("\n[Test 4] Testing getCommunityDetails...");
  const firstComm = commsList.communities[0];
  const commDetails = await getCommunityDetails({ community_id: firstComm.id });
  console.log("-> Community details name:", commDetails.name, "members:", commDetails.member_entities);

  // 5. Test Memory Evolution & Supersede
  console.log("\n[Test 5] Testing Memory Evolution & Version Supersede...");
  const v1 = await memoryStore.createMemory({
    id: "mem-v1-database-design",
    sessionId: spaceId,
    title: "Database Design v1 (Neo4j + Mongo)",
    content: "Initial plan using Docker with Neo4j and MongoDB.",
    importance: 0.7,
    unitType: "decision",
    isLatest: true,
  });

  const v2 = await memoryStore.createMemory({
    id: "mem-v2-database-design",
    sessionId: spaceId,
    title: "Database Design v2 (Pure SQLite)",
    content: "Migrated to Pure SQLite for embedded single-file architecture.",
    importance: 0.95,
    unitType: "decision",
    isLatest: true,
  });

  // Supersede v1 with v2
  const supRes = await memorySupersede({
    old_memory_id: v1.id,
    new_memory_id: v2.id,
    reason: "Zero-docker architecture upgrade",
  });
  console.log("-> memorySupersede status:", supRes.status, "active ID:", supRes.active_memory_id);

  // 6. Test memoryEvolvesChain
  console.log("\n[Test 6] Testing memoryEvolvesChain...");
  const chainRes = await memoryEvolvesChain({ memory_id: v2.id });
  console.log("-> Evolution Chain length:", chainRes.total_versions, "Position:", chainRes.position);
  console.log("-> Chain versions:", chainRes.chain.map(c => `${c.title} (latest: ${c.is_latest})`));

  if (chainRes.total_versions !== 2) throw new Error("Expected chain to have 2 versions");
  if (chainRes.position !== 1) throw new Error("Expected queried v2 memory to be at position 1 (newest)");

  // Cleanup
  await memoryStore.deleteMemory(v1.id);
  await memoryStore.deleteMemory(v2.id);
  await sessionStore.deleteSession(spaceId);

  console.log("\n=== ALL P2 TESTS (COMMUNITIES & EVOLUTION) PASSED WITH 100% SUCCESS! ===");
}

runP2Tests().catch((err) => {
  console.error("P2 Test failed:", err);
  process.exit(1);
});
