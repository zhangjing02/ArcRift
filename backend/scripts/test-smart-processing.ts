import { intelligenceService } from "../src/services/intelligence";
import { logger } from "../src/utils/logger";

async function runSmartProcessingTests() {
  logger.info("=== Running Smart Processing (智能处理) Integration Tests ===");

  // 1. Storage & Search Health Stats
  const stats = await intelligenceService.getStorageStats();
  console.log("1. Storage Stats:", {
    dbSize: stats.dbSizeText,
    infoSize: stats.infoSizeText,
    indexSize: stats.indexSizeText,
    totalMemories: stats.totalMemories,
    totalFacts: stats.totalFacts,
    ramMB: stats.ramUsageMB,
  });
  if (!stats.dbSizeText || stats.ramUsageMB === 0) {
    throw new Error("Stats failed validation");
  }

  // 2. Rebuild Search Index
  const rebuildRes = await intelligenceService.rebuildIndex();
  console.log("2. Rebuild Search Index:", rebuildRes);
  if (!rebuildRes.success) throw new Error("Rebuild index failed");

  // 3. Optimize Database (VACUUM & PRAGMA optimize)
  const optRes = await intelligenceService.optimizeDatabase();
  console.log("3. Optimize Database:", optRes);
  if (!optRes.success) throw new Error("Optimize failed");

  // 4. Session Health Check & Cleanup
  const cleanRes = await intelligenceService.checkAndCleanSessions();
  console.log("4. Session Health Check:", cleanRes);
  if (!cleanRes.success) throw new Error("Clean sessions failed");

  // 5. Ontology (本体库)
  const ontology = intelligenceService.getOntology();
  console.log(`5. Ontology items loaded (${ontology.length}):`, ontology.map(o => `${o.icon} ${o.name}`));
  if (ontology.length === 0) throw new Error("Ontology is empty");

  // Add custom ontology
  await intelligenceService.saveOntology([
    ...ontology,
    { id: "test_robotics", name: "具身智能 (Robotics)", color: "#10b981", icon: "🤖", description: "机器人与自动化控制" }
  ]);
  const updatedOntology = intelligenceService.getOntology();
  if (!updatedOntology.some(o => o.id === "test_robotics")) {
    throw new Error("Custom ontology save failed");
  }
  console.log("   Custom ontology saved and verified!");

  // 6. Memory Policy (记忆策略)
  const policy = intelligenceService.getMemoryPolicy();
  console.log("6. Memory Policy:", policy);
  const updatedPolicy = await intelligenceService.saveMemoryPolicy({
    maxMemoriesPerSession: 5,
    visibility: "full",
  });
  if (updatedPolicy.maxMemoriesPerSession !== 5) {
    throw new Error("Memory policy update failed");
  }
  console.log("   Memory policy updated and verified!");

  // 7. Token Usage & Budget Tracking
  intelligenceService.recordTokenUsage(1500, "deepseek-ai/DeepSeek-V3", true);
  intelligenceService.recordTokenUsage(850, "qwen2.5-coder-0.5b", false);
  const tokenStats = intelligenceService.getTokenUsageStats();
  console.log("7. Token Usage Stats:", tokenStats);
  if (tokenStats.tokens1h < 2350) {
    throw new Error("Token tracking failed");
  }

  logger.success("=== ALL SMART PROCESSING TESTS PASSED 100% ===");
}

runSmartProcessingTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
