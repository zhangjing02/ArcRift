import { migrationService } from "../src/services/migration";
import { getSettings, updateSettings } from "../src/utils/settings";
import { logger } from "../src/utils/logger";

async function runMigrationRemoteTests() {
  logger.info("=== Running Migration & Remote Access Integration Tests ===");

  // 1. Test Settings Export
  const exportedSettings = migrationService.exportSettingsBackup();
  if (!exportedSettings || exportedSettings.type !== "settings_backup" || !exportedSettings.settings) {
    throw new Error("Settings export failed");
  }
  console.log("1. Settings backup export verified:", JSON.stringify(exportedSettings.settings.chatProvider));

  // 2. Test Full Knowledge Export
  const exportedKnowledge = migrationService.exportKnowledgeBackup();
  if (!exportedKnowledge || !Array.isArray(exportedKnowledge.memories) || !Array.isArray(exportedKnowledge.facts)) {
    throw new Error("Knowledge export failed");
  }
  console.log(`2. Knowledge backup export verified: ${exportedKnowledge.memories.length} memories, ${exportedKnowledge.facts.length} facts`);

  // 3. Test Knowledge Import (Merge Mode)
  const mockKnowledge = {
    ...exportedKnowledge,
    memories: [
      {
        id: "mem_test_migration_001",
        sessionId: "default",
        title: "迁移测试记忆",
        content: "这是一条用于测试数据迁移与导入导出的记忆卡片。",
        importance: 0.8,
        category: "Decision",
        labels: "Test Migration",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        isLatest: 1,
        supersededBy: null,
      },
    ],
  };

  const importResult = migrationService.importKnowledgeBackup(mockKnowledge as any, "merge");
  if (importResult.importedMemories < 1) {
    throw new Error("Knowledge import failed");
  }
  console.log("3. Knowledge import (Merge) verified! Imported memories:", importResult.importedMemories);

  // 4. Test User Profile & Remote Access Settings persistence
  const updated = updateSettings({
    userProfile: {
      name: "Neo",
      aliases: "@neo, The One",
      outputLanguage: "zh-CN",
      aboutYou: "AI & Fullstack Engineer",
      profileInstructions: "Follow TypeScript Strict and Clean Architecture",
    },
    remoteAccess: {
      allowLan: true,
      requireLocalAuth: false,
      apiKey: "ak_live_test_123456",
      tunnelType: "quick",
      tunnelStatus: "running",
      publicUrl: "https://mem-test.trycloudflare.com",
      ipWhitelist: "192.168.1.*",
    },
  });

  const loaded = getSettings();
  if (loaded.userProfile?.name !== "Neo" || loaded.remoteAccess?.apiKey !== "ak_live_test_123456") {
    throw new Error("User profile or remote access persistence failed");
  }
  console.log("4. User profile & Remote access settings persistence verified!");

  logger.success("=== ALL MIGRATION & REMOTE ACCESS TESTS PASSED 100% ===");
}

runMigrationRemoteTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
