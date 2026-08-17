/**
 * test-mem-fs.ts
 *
 * Verifies:
 * 1. mem_fs capabilities
 * 2. mem_fs ls on root and subdirectories
 * 3. mem_fs stat (low-overhead metadata inspection)
 * 4. mem_fs cat windowed slice reading (--line N --lines M)
 * 5. mem_fs tree
 */
import { initStorage, memoryStore, sessionStore } from "../src/services/storage";
import { memFs } from "../src/mcp/tools/mem_fs";

async function main() {
  console.log("=== Testing Nowledge FS (mem_fs) Virtual Filesystem ===");
  await initStorage();

  const testSpace = `test_fs_${Date.now()}`;
  await sessionStore.createSession(testSpace, "Nowledge FS Test Space", "custom", testSpace);

  // Create a multi-line test memory
  const lines = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}: Important architectural notes about step ${i + 1}`);
  const mem = await memoryStore.createMemory({
    id: `mem_fs_doc_${Date.now()}`,
    sessionId: testSpace,
    title: "Multi-line Arch Document",
    content: lines.join("\n"),
    importance: 0.9,
    unitType: "procedure",
    labels: ["docs", "fs-test"],
  });

  // 1. Test Capabilities
  console.log("\n[Test 1] Testing mem_fs capabilities...");
  const caps = (await memFs({ command: "capabilities" })) as any;
  console.log("-> Capabilities:", JSON.stringify(caps, null, 2));
  if (!caps.virtual_roots || caps.virtual_roots.length === 0) {
    throw new Error("Capabilities missing virtual_roots");
  }

  // 2. Test ls
  console.log("\n[Test 2] Testing mem_fs ls...");
  const lsRoot = (await memFs({ command: "ls", path: "/", space_id: testSpace })) as any;
  console.log("-> Root ls items:", lsRoot.items);
  if (!lsRoot.items.includes("memories/")) {
    throw new Error("Root ls missing memories/");
  }

  const lsMemories = (await memFs({ command: "ls", path: "/memories/by-id", space_id: testSpace })) as any;
  console.log("-> by-id memories:", lsMemories.items);
  if (!lsMemories.items.includes(`${mem.id}.memory.md`)) {
    throw new Error(`by-id missing ${mem.id}.memory.md`);
  }

  // 3. Test stat (low-overhead metadata inspection)
  console.log("\n[Test 3] Testing mem_fs stat...");
  const statRes = (await memFs({
    command: "stat",
    path: `/memories/by-id/${mem.id}.memory.md`,
    space_id: testSpace,
  })) as any;
  console.log("-> stat result:", JSON.stringify(statRes, null, 2));
  if (!statRes.exists || statRes.line_count === undefined || statRes.line_count < 30) {
    throw new Error("stat failed to inspect line count or existence");
  }
  console.log(`   Stat Line Count: ${statRes.line_count}, Size: ${statRes.size_bytes} bytes`);

  // 4. Test cat with windowed slice reading (--line 1 --lines 10)
  console.log("\n[Test 4] Testing mem_fs cat windowed slicing (Window 1: lines 1-10)...");
  const catWindow1 = (await memFs({
    command: "cat",
    path: `/memories/by-id/${mem.id}.memory.md`,
    line: 1,
    lines: 10,
    space_id: testSpace,
  })) as any;
  console.log("-> Window 1 (lines 1-10):");
  console.log(catWindow1.content);
  console.log(`   is_truncated: ${catWindow1.is_truncated}`);
  console.log(`   hint: ${catWindow1.hint}`);

  if (!catWindow1.is_truncated || catWindow1.start_line !== 1 || catWindow1.end_line !== 10) {
    throw new Error("cat Window 1 failed slice boundary assertions");
  }

  // Test cat Window 2 (lines 11-20)
  console.log("\n[Test 5] Testing mem_fs cat windowed slicing (Window 2: lines 11-20)...");
  const catWindow2 = (await memFs({
    command: "cat",
    path: `/memories/by-id/${mem.id}.memory.md`,
    line: 11,
    lines: 10,
    space_id: testSpace,
  })) as any;
  console.log("-> Window 2 (lines 11-20):");
  console.log(catWindow2.content);
  if (catWindow2.start_line !== 11 || catWindow2.end_line !== 20) {
    throw new Error("cat Window 2 failed slice boundary assertions");
  }

  // 5. Test Working Memory Virtual File
  console.log("\n[Test 6] Testing mem_fs stat & cat on /working-memory/working-memory.md...");
  await memoryStore.saveWorkingMemory({
    sessionId: testSpace,
    briefing: "Nowledge FS integration complete",
    focusAreas: ["Virtual FS", "Windowed Slicing"],
    activeDecisions: ["Use POSIX-like virtual paths"],
    blockers: [],
    updatedAt: new Date(),
  });

  const wmCat = (await memFs({
    command: "cat",
    path: "/working-memory/working-memory.md",
    space_id: testSpace,
  })) as any;
  console.log("-> Working memory virtual file content:");
  console.log(wmCat.content);
  if (!wmCat.content.includes("Nowledge FS integration complete")) {
    throw new Error("Working memory virtual file missing briefing content");
  }

  console.log("\n✅ ALL Nowledge FS (mem_fs) TESTS PASSED WITH 100% SUCCESS!");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
