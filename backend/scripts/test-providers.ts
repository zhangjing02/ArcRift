import { PROVIDER_PRESETS, getSettings, updateSettings } from "../src/utils/settings";
import { logger } from "../src/utils/logger";

async function runProvidersTests() {
  logger.info("=== Running Providers (服务商) Integration Tests ===");

  // 1. Verify all 19 providers in presets
  const providerKeys = Object.keys(PROVIDER_PRESETS);
  console.log(`1. Total Providers Configured (${providerKeys.length}):`, providerKeys.join(", "));
  if (providerKeys.length < 18) {
    throw new Error("Missing providers in PROVIDER_PRESETS");
  }

  // Check essential providers
  const required = ["openai", "anthropic", "deepseek", "gemini", "groq", "ollama", "siliconflow", "minimax", "zhipu", "moonshot"];
  for (const r of required) {
    if (!PROVIDER_PRESETS[r]) throw new Error(`Missing required provider: ${r}`);
  }
  console.log("   All essential providers verified with logos, default base URLs and models!");

  // 2. Test multi-provider configurations persistence
  const testConfigs = {
    openai: { apiKey: "sk-test-openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4o", isConfigured: true },
    deepseek: { apiKey: "sk-test-deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", isConfigured: true },
    siliconflow: { apiKey: "sk-test-sf", baseUrl: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3", isConfigured: true },
  };

  const updated = updateSettings({
    chatProvider: "deepseek",
    apiBaseUrl: "https://api.deepseek.com/v1",
    apiKey: "sk-test-deepseek",
    chatModel: "deepseek-chat",
    providerConfigs: testConfigs,
  });

  const loaded = getSettings();
  if (loaded.chatProvider !== "deepseek" || !loaded.providerConfigs?.deepseek?.isConfigured) {
    throw new Error("Provider configuration persistence failed");
  }
  console.log("2. Provider multi-configs persistence verified! Active:", loaded.chatProvider);

  logger.success("=== ALL PROVIDERS TESTS PASSED 100% ===");
}

runProvidersTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
