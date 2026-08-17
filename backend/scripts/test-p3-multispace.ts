import { initStorage, memoryStore, sourceStore, sessionStore, graphStore } from "../src/services/storage";
import { listSpaces } from "../src/mcp/tools/list_spaces";
import { getSpaceProfile } from "../src/mcp/tools/get_space_profile";
import { memorySearch } from "../src/mcp/tools/memory_search";

async function runP3Tests() {
  console.log("=== STARTING NOWLEDGE MEM P3 (MULTI-SPACE ISOLATION) TEST ===");
  await initStorage();

  const spaceA_id = "space-alpha-web";
  const spaceB_id = "space-beta-mobile";

  // Create two spaces
  await sessionStore.createSession("Alpha Web Portal", "web", undefined, spaceA_id);
  await sessionStore.createSession("Beta Mobile App", "mobile", undefined, spaceB_id);

  // Add memory to Space A
  const memA = await memoryStore.createMemory({
    id: "mem-react-router",
    sessionId: spaceA_id,
    title: "React Router Data Loading",
    content: "We use react-router loaders to pre-fetch space profile data on dashboard mount.",
    importance: 0.8,
    unitType: "procedure",
    labels: ["frontend", "react"],
  });

  // Add memory to Space B
  const memB = await memoryStore.createMemory({
    id: "mem-jetpack-compose",
    sessionId: spaceB_id,
    title: "Jetpack Compose Navigation",
    content: "Android app uses Navigation3 Compose scene transitions with viewModels.",
    importance: 0.85,
    unitType: "procedure",
    labels: ["mobile", "android"],
  });

  // Add working memory to Space A
  await memoryStore.saveWorkingMemory({
    sessionId: spaceA_id,
    briefing: "Alpha Web Portal is undergoing UI polish.",
    focusAreas: ["Navigation Bar", "Responsive Grid"],
  });

  // Add source to Space B
  const srcB = await sourceStore.createSource({
    id: "src-android-guide",
    sessionId: spaceB_id,
    name: "Android Architecture Blueprint",
    sourceType: "document",
    summary: "Official Android developer guidelines for multi-module projects.",
  });

  // 1. Test list_spaces
  console.log("\n[Test 1] Testing list_spaces...");
  const spacesRes = await listSpaces();
  console.log("-> Total active spaces:", spacesRes.total_spaces);
  const foundA = spacesRes.spaces.find((s) => s.id === spaceA_id);
  const foundB = spacesRes.spaces.find((s) => s.id === spaceB_id);
  if (!foundA || !foundB) throw new Error("Could not find both created spaces in list_spaces!");
  console.log("-> Space A usage:", foundA.usage);
  console.log("-> Space B usage:", foundB.usage);

  // 2. Test get_space_profile by ID
  console.log("\n[Test 2] Testing get_space_profile by space_id...");
  const profA = await getSpaceProfile({ space_ref: spaceA_id });
  console.log("-> Resolved Space A:", profA.name, "Stats:", profA.stats, "WorkingMem:", profA.working_memory?.briefing);
  if (profA.stats.total_memories !== 1) throw new Error("Expected exactly 1 memory in Space A");

  // 3. Test get_space_profile by display name
  console.log("\n[Test 3] Testing get_space_profile by display name...");
  const profB = await getSpaceProfile({ space_ref: "Beta Mobile App" });
  console.log("-> Resolved Space B:", profB.name, "Stats:", profB.stats);
  if (profB.stats.total_sources !== 1) throw new Error("Expected exactly 1 source in Space B");

  // 4. Test Search Isolation between spaces
  console.log("\n[Test 4] Testing Search Isolation between spaces...");
  const searchA = await memorySearch({ space_id: spaceA_id, query: "Navigation" });
  console.log("-> Search in Space A for 'Navigation':", searchA.total_found);
  const searchB = await memorySearch({ space_id: spaceB_id, query: "Navigation" });
  console.log("-> Search in Space B for 'Navigation':", searchB.total_found);

  if (searchA.total_found !== 0) throw new Error("Expected 0 results for Android navigation query in Space A!");
  if (searchB.total_found === 0) throw new Error("Expected at least 1 result for Android navigation query in Space B!");

  // Cleanup
  await memoryStore.deleteMemory(memA.id);
  await memoryStore.deleteMemory(memB.id);
  await sourceStore.deleteSource(srcB.id);
  await sessionStore.deleteSession(spaceA_id);
  await sessionStore.deleteSession(spaceB_id);

  console.log("\n=== ALL P3 TESTS (MULTI-SPACE ISOLATION) PASSED WITH 100% SUCCESS! ===");
}

runP3Tests().catch((err) => {
  console.error("P3 Test failed:", err);
  process.exit(1);
});
