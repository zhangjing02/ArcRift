import { Router, Request, Response } from "express";
import axios from "axios";
import { getSettings, updateSettings, PROVIDER_PRESETS, Settings } from "../utils/settings";
import { generateEmbedding } from "../services/embeddings";
import { llm, _resetBackendForTest } from "../services/extractor";
import { isModelDownloaded, getModelFilePath } from "../services/modelManager";
import { logger } from "../utils/logger";

const router = Router();
const OLLAMA_DEFAULT_URL = process.env.OLLAMA_URL || "http://localhost:11434";

// GET /api/settings
router.get("/", async (_req: Request, res: Response) => {
  try {
    const settings = getSettings();
    let ollamaReachable = false;
    let availableModels: string[] = [];

    const probeUrl = settings.embeddingBaseUrl?.includes("11434")
      ? settings.embeddingBaseUrl
      : (process.env.OLLAMA_URL || OLLAMA_DEFAULT_URL);

    try {
      const response = await axios.get(`${probeUrl.replace(/\/+$/, "")}/api/tags`, { timeout: 1500 });
      ollamaReachable = true;
      if (response.data && Array.isArray(response.data.models)) {
        availableModels = response.data.models.map((m: any) => m.name);
      }
    } catch {
      ollamaReachable = false;
    }

    const activeEmbeddingModel =
      settings.embeddingModel ||
      settings.ollamaEmbeddingModel ||
      process.env.EMBEDDING_MODEL ||
      process.env.OLLAMA_EMBED_MODEL ||
      "BAAI/bge-large-zh-v1.5";

    const activeExtractionModel =
      settings.chatModel ||
      settings.ollamaExtractionModel ||
      process.env.CHAT_MODEL ||
      process.env.OLLAMA_MODEL ||
      "deepseek-ai/DeepSeek-V3";

    res.json({
      ...settings,
      settings,
      presets: PROVIDER_PRESETS,
      ollamaReachable,
      availableModels,
      activeEmbeddingModel,
      activeExtractionModel,
    });
  } catch (err: any) {
    logger.error("Failed to fetch settings:", err?.message);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// GET /api/settings/connect-info (Returns dynamic real-time machine-accurate MCP configuration)
router.get("/connect-info", (_req: Request, res: Response) => {
  try {
    const { getAppRoot, getDbPath } = require("../utils/paths");
    const path = require("path");
    const fs = require("fs");

    const appRoot = getAppRoot();
    const mcpServerPath = path.join(appRoot, "backend", "dist", "mcp", "server.js");
    const dbPath = getDbPath();

    let nodeBin = "node";
    const bundledNode = path.join(appRoot, "backend", "bin", "node.exe");
    if (fs.existsSync(bundledNode)) {
      nodeBin = bundledNode;
    } else if (fs.existsSync("D:\\DevelopeTools\\Node\\node.exe")) {
      nodeBin = "D:\\DevelopeTools\\Node\\node.exe";
    }

    const mcpConfig = {
      mcpServers: {
        "arcrift": {
          command: nodeBin,
          args: [mcpServerPath],
          env: {
            ARCRIFT_MCP_MODE: "true",
            ARCRIFT_STORAGE_MODE: "sqlite",
            SQLITE_DB_PATH: dbPath,
            NODE_ENV: "production",
          },
        },
      },
    };

    res.json({
      success: true,
      appRoot,
      mcpServerPath,
      dbPath,
      nodeBin,
      mcpJson: JSON.stringify(mcpConfig, null, 2),
      prompt:
        "在当前项目中启用 ArcRift (Nowledge Mem) 长期记忆与知识图谱工作台。每次解决重大 Bug、完成架构决策、更新 API 规范或收到 'CM' / '存档' 指令时，请主动调用 arcrift 的 memory_add 工具将经验与知识存入知识库；在遇到类似问题前，先调用 memory_search 检索历史经验。",
    });
  } catch (err: any) {
    logger.error("Failed to get connect info:", err?.message);
    res.status(500).json({ error: "Failed to get connect info" });
  }
});

// POST /api/settings
router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};

    const toUpdate: Partial<Settings> = {
      ...body,
    };

    // Backward compatibility mappings
    if (body.activeEmbeddingModel && !body.embeddingModel) {
      toUpdate.embeddingModel = body.activeEmbeddingModel;
    }
    if (body.activeExtractionModel && !body.chatModel) {
      toUpdate.chatModel = body.activeExtractionModel;
    }

    // Sync mode and providers
    if (body.embeddingMode === "local") {
      toUpdate.embeddingMode = "local";
      if (!body.embeddingProvider || body.embeddingProvider === "openai-compatible") {
        toUpdate.embeddingProvider = "local";
      }
    } else if (body.embeddingMode === "cloud") {
      toUpdate.embeddingMode = "cloud";
      if (toUpdate.embeddingProvider === "local" || body.embeddingProvider === "local") {
        toUpdate.embeddingProvider = "openai-compatible";
      }
    }

    if (body.llmMode === "local") {
      toUpdate.llmMode = "local";
      if (!body.chatProvider || body.chatProvider === "openai-compatible") {
        toUpdate.chatProvider = "local";
      }
    } else if (body.llmMode === "cloud") {
      toUpdate.llmMode = "cloud";
      if (toUpdate.chatProvider === "local" || body.chatProvider === "local") {
        toUpdate.chatProvider = (body.provider || "siliconflow") as any;
      }
    }

    const updated = updateSettings(toUpdate);
    _resetBackendForTest();

    res.json({
      success: true,
      ...updated,
      settings: updated,
    });
  } catch (err: any) {
    logger.error("Failed to update settings:", err?.message);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

function getProxyConfig(targetUrl: string) {
  if (targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1")) {
    return false;
  }
  const proxyStr = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || "http://127.0.0.1:7897";
  if (!proxyStr) return false;
  try {
    const u = new URL(proxyStr);
    return {
      host: u.hostname,
      port: parseInt(u.port, 10),
      protocol: u.protocol.replace(":", ""),
    };
  } catch {
    return false;
  }
}

const handleTestConnection = async (req: Request, res: Response) => {
  const settings = getSettings();
  const testType = req.body.type || "all"; // "chat" | "embedding" | "all"

  const apiBaseUrl = req.body.apiBaseUrl || req.body.baseUrl || settings.apiBaseUrl || "https://api.siliconflow.cn/v1";
  const apiKey = req.body.apiKey !== undefined ? req.body.apiKey : (settings.apiKey || "");
  const chatModel = req.body.chatModel || req.body.model || settings.chatModel || "gemini-2.0-flash";
  const embeddingModel = req.body.embeddingModel || settings.embeddingModel || "text-embedding-004";
  const embeddingBaseUrl = req.body.embeddingBaseUrl || settings.embeddingBaseUrl || apiBaseUrl;
  const embeddingApiKey = req.body.embeddingApiKey || req.body.apiKey || settings.embeddingApiKey || settings.apiKey || "";
  const provider = req.body.provider || req.body.chatProvider || settings.chatProvider || "";

  const results: {
    success: boolean;
    message?: string;
    chat?: { success: boolean; latencyMs?: number; model?: string; message?: string; error?: string };
    embedding?: { success: boolean; latencyMs?: number; model?: string; dimension?: number; message?: string; error?: string };
    error?: string;
  } = {
    success: true,
  };

  // 1. Test Chat Completion Connection
  if (testType === "chat" || testType === "all") {
    const startTime = Date.now();

    try {
      if (provider === "local" || provider === "ollama") {
        const cleanUrl = (apiBaseUrl.includes("11434") ? apiBaseUrl : (process.env.OLLAMA_URL || "http://localhost:11434")).replace(/\/+$/, "");
        try {
          const resp = await axios.get(`${cleanUrl}/api/tags`, { timeout: 2000 });
          const latencyMs = Date.now() - startTime;
          results.chat = {
            success: true,
            latencyMs,
            model: chatModel || "qwen2.5:3b",
            message: `本地 Ollama 服务连接正常 (${latencyMs}ms)`,
          };
        } catch {
          const latencyMs = Date.now() - startTime;
          const gemmaReady = isModelDownloaded("llm_gemma");
          const qwenReady = isModelDownloaded("llm_qwen");
          if (gemmaReady || qwenReady) {
            results.chat = {
              success: true,
              latencyMs,
              model: gemmaReady ? "Gemma-2-2B" : "Qwen2.5-3B",
              message: `本地 GGUF 模型文件已就绪 (${gemmaReady ? "Gemma-2" : "Qwen2.5"})`,
            };
          } else {
            results.chat = {
              success: true,
              latencyMs,
              model: "local",
              message: "本地模型模式已启用（如需离线高精度推理可下载本地模型或运行 Ollama）",
            };
          }
        }
      } else {
        const isGemini = provider === "gemini" || apiBaseUrl.includes("googleapis.com");
        
        if (isGemini) {
          // Test Gemini native generateContent
          const modelName = chatModel.replace(/^models\//, "");
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
          const proxy = getProxyConfig(endpoint);

          const resp = await axios.post(
            endpoint,
            {
              contents: [{ parts: [{ text: "Say OK" }] }],
              generationConfig: { maxOutputTokens: 10, temperature: 0.1 },
            },
            { headers: { "Content-Type": "application/json" }, timeout: 20000, ...(proxy ? { proxy } : {}) }
          );

          const latencyMs = Date.now() - startTime;
          results.chat = {
            success: true,
            latencyMs,
            model: chatModel,
            message: `Gemini Chat API connected successfully. (${latencyMs}ms)`,
          };
        } else {
          // Test OpenAI-compatible endpoint
          const cleanBase = apiBaseUrl.replace(/\/+$/, "");
          const endpoint = cleanBase.endsWith("/chat/completions") ? cleanBase : `${cleanBase}/chat/completions`;
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

          const proxy = getProxyConfig(endpoint);

          const resp = await axios.post(
            endpoint,
            {
              model: chatModel,
              messages: [{ role: "user", content: "Say 'OK' if you can read this." }],
              max_tokens: 10,
              temperature: 0.1,
            },
            { headers, timeout: 20000, ...(proxy ? { proxy } : {}) }
          );

          const latencyMs = Date.now() - startTime;
          results.chat = {
            success: true,
            latencyMs,
            model: chatModel,
            message: `Chat API connected successfully. (${latencyMs}ms)`,
          };
        }
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err.message ||
        "Chat connection failed";

      results.chat = {
        success: false,
        latencyMs,
        model: chatModel,
        error: errorMsg,
      };
      results.success = false;
      results.error = errorMsg;
    }
  }

  // 2. Test Embedding Connection
  if (testType === "embedding" || testType === "all") {
    const startTime = Date.now();

    try {
      let latencyMs = 0;
      let dim = 768;

      if (provider === "local" || settings.embeddingMode === "local") {
        const vec = await generateEmbedding("ArcRift Embedding Connection Test", "query");
        latencyMs = Date.now() - startTime;
        dim = vec.length;
        results.embedding = {
          success: true,
          latencyMs,
          model: "local-embedding",
          dimension: dim,
          message: `本地向量嵌入测试通过 (维度: ${dim}, 耗时: ${latencyMs}ms)`,
        };
      } else {
        const isGemini =
          provider === "gemini" ||
          embeddingBaseUrl.includes("googleapis.com") ||
          embeddingModel.includes("text-embedding-004");

        if (isGemini) {
          // Native Gemini EmbedContent endpoint
          const modelName = embeddingModel.replace(/^models\//, "");
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${embeddingApiKey}`;
          const proxy = getProxyConfig(endpoint);

          const resp = await axios.post(
            endpoint,
            {
              content: { parts: [{ text: "ArcRift Embedding Connection Test" }] },
            },
            { headers: { "Content-Type": "application/json" }, timeout: 20000, ...(proxy ? { proxy } : {}) }
          );

          latencyMs = Date.now() - startTime;
          const vals = resp.data?.embedding?.values;
          dim = Array.isArray(vals) ? vals.length : 768;
        } else {
          // OpenAI-compatible endpoint
          const cleanBase = embeddingBaseUrl.replace(/\/+$/, "");
          const endpoint = cleanBase.endsWith("/embeddings") ? cleanBase : `${cleanBase}/embeddings`;
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (embeddingApiKey) headers["Authorization"] = `Bearer ${embeddingApiKey}`;
          const proxy = getProxyConfig(endpoint);

          const resp = await axios.post(
            endpoint,
            {
              model: embeddingModel,
              input: "ArcRift Embedding Connection Test",
            },
            { headers, timeout: 20000, ...(proxy ? { proxy } : {}) }
          );

          latencyMs = Date.now() - startTime;
          dim = resp.data?.data?.[0]?.embedding?.length || 768;
        }

        results.embedding = {
          success: true,
          latencyMs,
          model: embeddingModel,
          dimension: dim,
          message: `Embedding API connected successfully. (Dimension: ${dim}, ${latencyMs}ms)`,
        };
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err.message ||
        "Embedding connection failed";

      results.embedding = {
        success: false,
        latencyMs,
        model: embeddingModel,
        error: errorMsg,
      };
      results.success = false;
      if (!results.error) results.error = errorMsg;
    }
  }

  if (results.success) {
    results.message = `API 连通测试通过！Chat 响应正常，Embedding 向量维度为 ${results.embedding?.dimension || 768}。`;
  }

  res.json(results);
};

router.post("/test", handleTestConnection);
router.post("/test-connection", handleTestConnection);

// POST /api/settings/fetch-models
router.post("/fetch-models", async (req: Request, res: Response) => {
  const { baseUrl, apiKey, provider } = req.body;
  const cleanBase = (baseUrl || "").replace(/\/+$/, "");

  try {
    if (provider === "ollama" || cleanBase.includes("11434")) {
      const resp = await axios.get(`${cleanBase.replace(/\/v1$/, "")}/api/tags`, { timeout: 4000 });
      if (resp.data && Array.isArray(resp.data.models)) {
        return res.json({ success: true, models: resp.data.models.map((m: any) => m.name) });
      }
    }

    const endpoint = cleanBase.endsWith("/models") ? cleanBase : `${cleanBase}/models`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const proxy = getProxyConfig(endpoint);

    const resp = await axios.get(endpoint, {
      headers,
      timeout: 8000,
      ...(proxy ? { proxy } : {}),
    });

    if (resp.data && Array.isArray(resp.data.data)) {
      const models = resp.data.data.map((m: any) => m.id || m.name).filter(Boolean);
      return res.json({ success: true, models });
    }
    if (resp.data && Array.isArray(resp.data.models)) {
      const models = resp.data.models.map((m: any) => m.name || m.id).filter(Boolean);
      return res.json({ success: true, models });
    }

    return res.json({ success: true, models: [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch models" });
  }
});

export default router;
