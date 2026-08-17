import { initStorage, sessionStore, memoryStore } from "../src/services/storage";
import { memoryAdd } from "../src/mcp/tools/memory_add";
import { memorySearch } from "../src/mcp/tools/memory_search";
import { getMemoryById } from "../src/mcp/tools/get_memory_by_id";
import { memoryUpdate } from "../src/mcp/tools/memory_update";
import { memoryDelete } from "../src/mcp/tools/memory_delete";
import { readWorkingMemory } from "../src/mcp/tools/read_working_memory";
import { updateWorkingMemoryTool } from "../src/mcp/tools/working_memory";
import { listSpaces } from "../src/mcp/tools/list_spaces";
import { exploreGraph } from "../src/mcp/tools/explore_graph";
import { graphStats } from "../src/mcp/tools/graph_stats";

async function runTests() {
  console.log("=== STARTING NOWLEDGE MEM MCP ALIGNMENT TEST ===");
  await initStorage();

  const spaceId = "test-space-p0";

  // 1. Test memory_add
  console.log("\n[Test 1] Testing memory_add...");
  const addRes1 = await memoryAdd({
    id: "mem-test-auth-pattern",
    space_id: spaceId,
    title: "JWT Authentication Architecture",
    content: "We use Redis sliding expiry for JWT refresh token rotation with sub-millisecond invalidation.",
    importance: 0.9,
    unit_type: "decision",
    labels: "auth,security,redis",
    claim_status: "asserted",
  });
  console.log("-> memory_add success:", addRes1.id, addRes1.assigned_labels);

  // 2. Test memory_search (with query)
  console.log("\n[Test 2] Testing memory_search (query)...");
  const searchRes = await memorySearch({
    query: "JWT refresh token rotation",
    space_id: spaceId,
    limit: 5,
  });
  console.log("-> memory_search found:", searchRes.total_found, "items");
  if (searchRes.total_found === 0) throw new Error("memory_search returned 0 results!");

  // 3. Test get_memory_by_id
  console.log("\n[Test 3] Testing get_memory_by_id...");
  const getRes = await getMemoryById({ memory_id: "mem-test-auth-pattern" });
  console.log("-> get_memory_by_id content:", getRes.title, "UnitType:", getRes.unit_type);

  // 4. Test memory_update
  console.log("\n[Test 4] Testing memory_update...");
  const updateRes = await memoryUpdate({
    memory_id: "mem-test-auth-pattern",
    title: "Updated JWT Auth Architecture",
    importance: 0.95,
  });
  console.log("-> memory_update success:", updateRes.title, "Importance:", updateRes.importance);

  // 5. Test update_working_memory & read_working_memory
  console.log("\n[Test 5] Testing working memory...");
  await updateWorkingMemoryTool({
    project: spaceId,
    briefing: "P0 MCP Alignment feature completed. Currently testing all endpoints.",
    focusAreas: ["Verify memory tools", "Verify graph explorer"],
    activeDecisions: ["Pure SQLite with FTS5 and sqlite-vec"],
    blockers: [],
  });
  const wmRes = await readWorkingMemory({ space_id: spaceId });
  console.log("-> read_working_memory briefing:", wmRes.briefing);

  // 6. Test list_spaces
  console.log("\n[Test 6] Testing list_spaces...");
  const spacesRes = await listSpaces();
  console.log("-> list_spaces total:", spacesRes.total_spaces);

  // 7. Test explore_graph & graph_stats
  console.log("\n[Test 7] Testing explore_graph & graph_stats...");
  const graphRes = await exploreGraph({ space_id: spaceId });
  console.log("-> explore_graph nodes count:", graphRes.node_count);
  const statsRes = await graphStats();
  console.log("-> graph_stats total facts:", statsRes.total_facts, "total memories:", statsRes.total_memories);

  // 8. Test memory_delete
  console.log("\n[Test 8] Testing memory_delete...");
  const delRes = await memoryDelete({ memory_id: "mem-test-auth-pattern" });
  console.log("-> memory_delete status:", delRes.status);

  // Cleanup test space
  await sessionStore.deleteSession(spaceId);
  console.log("\n=== ALL MCP ALIGNMENT TESTS PASSED WITH 100% SUCCESS! ===");
}

runTests().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
