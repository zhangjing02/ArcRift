import { getSettings, updateSettings } from "../src/utils/settings";
import { logger } from "../src/utils/logger";

async function runPreferencesTests() {
  logger.info("=== Running Preferences (偏好设置) Integration Tests ===");

  // 1. Update Preferences
  const updated = updateSettings({
    preferences: {
      themeMode: "dark",
      uiLanguage: "zh-CN",
      fontSizeScale: "normal",
      launchAtLogin: true,
      enableMultiSpaces: true,
      shortcutLauncher: true,
      shortcutSummary: true,
      shortcutHints: false,
    },
  });

  // 2. Load and verify
  const loaded = getSettings();
  if (
    loaded.preferences?.themeMode !== "dark" ||
    loaded.preferences?.uiLanguage !== "zh-CN" ||
    loaded.preferences?.fontSizeScale !== "normal" ||
    loaded.preferences?.launchAtLogin !== true ||
    loaded.preferences?.enableMultiSpaces !== true
  ) {
    throw new Error("Preferences persistence test failed");
  }

  console.log("1. Preferences configuration persistence verified:", loaded.preferences);
  logger.success("=== ALL PREFERENCES TESTS PASSED 100% ===");
}

runPreferencesTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
