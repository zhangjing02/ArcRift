import { Router, Request, Response } from "express";
import { sessionStore } from "../services/storage";
import { logger } from "../utils/logger";
import { getSettings } from "../utils/settings";

const router = Router();

// GET /api/health
// Returns live system metrics: chunk count, session count, job queue, storage mode, LLM & Ollama status
router.get("/", async (_req: Request, res: Response) => {
  try {
    const storageMode = (process.env.ARCRIFT_STORAGE_MODE || "sqlite").toLowerCase();

    // Session + chunk counts
    const sessions = await sessionStore.getSessions();
    const sessionCount = sessions.length;

    // Total chunk count — sum topicCount across all sessions as a quick proxy
    const chunkCount = sessions.reduce((acc, s) => acc + (s.topicCount || 0), 0);

    // Job queue status
    const jobStatus = await sessionStore.getJobStatus();

    const settings = getSettings();

    // Ollama reachability check (fast timeout)
    let ollamaReachable = false;
    try {
      const ollamaUrl = settings.embeddingBaseUrl?.includes("11434")
        ? settings.embeddingBaseUrl
        : (process.env.OLLAMA_URL || "http://localhost:11434");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const resp = await fetch(`${ollamaUrl.replace(/\/+$/, "")}/api/tags`, { signal: controller.signal });
      clearTimeout(timeout);
      ollamaReachable = resp.ok;
    } catch {
      ollamaReachable = false;
    }

    const activeExtractionModel =
      settings.chatModel || settings.ollamaExtractionModel || process.env.OLLAMA_MODEL || "deepseek-ai/DeepSeek-V3";
    const activeEmbeddingModel =
      settings.embeddingModel || settings.ollamaEmbeddingModel || process.env.OLLAMA_EMBED_MODEL || "BAAI/bge-large-zh-v1.5";

    res.json({
      storageMode,
      sessionCount,
      chunkCount,
      jobQueue: jobStatus,
      chatProvider: settings.chatProvider || "openai-compatible",
      embeddingProvider: settings.embeddingProvider || "openai-compatible",
      chatModel: activeExtractionModel,
      embeddingModel: activeEmbeddingModel,
      graphBackend: (settings.chatProvider || process.env.GRAPH_BACKEND || "openai-compatible").toUpperCase(),
      ollama: {
        reachable: ollamaReachable,
        model: activeExtractionModel,
      },
    });
  } catch (err: any) {
    logger.error("Health check failed:", err?.message);
    res.status(500).json({ error: "Health check failed" });
  }
});

export default router;
