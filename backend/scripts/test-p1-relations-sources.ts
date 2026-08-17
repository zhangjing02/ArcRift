import { initStorage, memoryStore, sourceStore, sessionStore } from "../src/services/storage";
import { memoryRelationAdd } from "../src/mcp/tools/memory_relation_add";
import { memoryRelationList } from "../src/mcp/tools/memory_relation_list";
import { memoryRelationDelete } from "../src/mcp/tools/memory_relation_delete";
import { querySources } from "../src/mcp/tools/query_sources";
import { readSourceContent } from "../src/mcp/tools/read_source_content";

async function runP1Tests() {
  console.log("=== STARTING NOWLEDGE MEM P1 (RELATIONS & SOURCES) TEST ===");
  await initStorage();

  const spaceId = "test-space-p1";

  // Create two memories
  const mem1 = await memoryStore.createMemory({
    id: "mem-sqlite-architecture",
    sessionId: spaceId,
    title: "Pure SQLite Architecture Decision",
    content: "We replaced Neo4j, Mongo, and Chroma with pure SQLite for 10x lower latency and zero-docker simplicity.",
    importance: 0.9,
    unitType: "decision",
    labels: ["sqlite", "architecture"],
  });

  const mem2 = await memoryStore.createMemory({
    id: "mem-performance-benchmark",
    sessionId: spaceId,
    title: "Sub-millisecond Query Latency Benchmark",
    content: "Local SQLite in-memory C-bindings achieve sub-millisecond query responses under 100 concurrent requests.",
    importance: 0.85,
    unitType: "learning",
    labels: ["performance", "benchmark"],
  });

  console.log("Created test memories:", mem1.id, mem2.id);

  // 1. Test memoryRelationAdd
  console.log("\n[Test 1] Testing memoryRelationAdd...");
  const relRes = await memoryRelationAdd({
    source_memory_id: mem1.id,
    target_memory_id: mem2.id,
    relation_type: "supports",
    reason: "Benchmark results directly validate the latency claims of the SQLite architecture decision.",
    strength: 0.95,
    bidirectional: true,
  });
  console.log("-> memoryRelationAdd success, rel ID:", relRes.relation.id, "Type:", relRes.relation.relation_type);

  // 2. Test memoryRelationList
  console.log("\n[Test 2] Testing memoryRelationList...");
  const listRes1 = await memoryRelationList({ memory_id: mem1.id, direction: "out" });
  console.log("-> Outgoing relations from mem1:", listRes1.total_relations);
  if (listRes1.total_relations !== 1) throw new Error("Expected 1 outgoing relation from mem1");

  const listRes2 = await memoryRelationList({ memory_id: mem2.id, direction: "in" });
  console.log("-> Incoming relations to mem2:", listRes2.total_relations);
  if (listRes2.total_relations !== 1) throw new Error("Expected 1 incoming relation to mem2");

  // 3. Test Library Sources (Source Management)
  console.log("\n[Test 3] Testing Library Source Management...");
  const src = await sourceStore.createSource({
    id: "src-sqlite-whitepaper",
    sessionId: spaceId,
    name: "SQLite Architecture & Benchmarks Whitepaper",
    sourceType: "document",
    url: "https://sqlite.org/arch.pdf",
    summary: "Detailed whitepaper describing SQLite internal B-tree structures and WAL performance.",
    rawContent: "Section 1: B-Tree Indexes\nSQLite uses B-tree structures for tables and indexes, allowing O(log N) lookup times. In WAL mode, readers do not block writers and writers do not block readers.\nSection 2: Vector Search Extensions\nNative sqlite-vec extension runs SIMD vector similarity inside SQLite.",
    labels: ["whitepaper", "sqlite", "rag"],
    lifecycleState: "indexed",
  });
  console.log("-> Created source:", src.id, src.name);

  // 4. Test querySources
  console.log("\n[Test 4] Testing querySources...");
  const queryRes = await querySources({
    space_id: spaceId,
    query: "Whitepaper",
    source_type: "document",
  });
  console.log("-> querySources found:", queryRes.total_sources, "sources");
  if (queryRes.total_sources === 0) throw new Error("querySources returned 0 results!");

  // 5. Test readSourceContent (with offset and limit)
  console.log("\n[Test 5] Testing readSourceContent...");
  const readRes = await readSourceContent({
    source_id: src.id,
    offset: 0,
    limit: 80,
  });
  console.log("-> readSourceContent snippet:", JSON.stringify(readRes.content), "has_more:", readRes.has_more);
  if (!readRes.has_more) throw new Error("Expected has_more to be true for paginated slice");

  // 6. Test memoryRelationDelete
  console.log("\n[Test 6] Testing memoryRelationDelete...");
  const delRelRes = await memoryRelationDelete({ relation_id: relRes.relation.id });
  console.log("-> memoryRelationDelete status:", delRelRes.status);

  // Cleanup
  await sourceStore.deleteSource(src.id);
  await memoryStore.deleteMemory(mem1.id);
  await memoryStore.deleteMemory(mem2.id);
  await sessionStore.deleteSession(spaceId);

  console.log("\n=== ALL P1 TESTS (RELATIONS & SOURCES) PASSED WITH 100% SUCCESS! ===");
}

runP1Tests().catch((err) => {
  console.error("P1 Test failed:", err);
  process.exit(1);
});
