import axios from "axios";
import { logger } from "../utils/logger";
import { getSettings, Settings, PROVIDER_PRESETS } from "../utils/settings";

const OLLAMA_DEFAULT_URL = process.env.OLLAMA_URL || "http://localhost:11434";

/**
 * Normalizes vector to target dimension (default 768 for sqlite-vec compatibility)
 * using Matryoshka truncation + L2 normalization or padding.
 */
export function normalizeAndFitDimension(vec: number[], targetDim = 768): number[] {
  if (!Array.isArray(vec) || vec.length === 0) {
    return new Array(targetDim).fill(0);
  }
  if (vec.length === targetDim) {
    return vec;
  }
  if (vec.length > targetDim) {
    const sliced = vec.slice(0, targetDim);
    const norm = Math.sqrt(sliced.reduce((sum, v) => sum + v * v, 0)) || 1;
    return sliced.map(v => v / norm);
  }
  // Zero-padding if smaller than targetDim
  const padded = new Array(targetDim).fill(0);
  for (let i = 0; i < vec.length; i++) {
    padded[i] = vec[i];
  }
  return padded;
}

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

// ── 1. OpenAI-Compatible & SiliconFlow Embeddings ─────────────────────
async function callOpenAICompatibleEmbedding(
  texts: string[],
  baseUrl: string,
  apiKey: string,
  model: string,
  targetDim = 768
): Promise<number[][]> {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  const endpoint = cleanBaseUrl.endsWith("/embeddings")
    ? cleanBaseUrl
    : `${cleanBaseUrl}/embeddings`;

  const payload: Record<string, any> = {
    model,
    input: texts.length === 1 ? texts[0] : texts,
  };

  // OpenAI text-embedding-3 supports dimensions parameter natively
  if (model.includes("text-embedding-3") && targetDim) {
    payload.dimensions = targetDim;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const proxy = getProxyConfig(endpoint);

  const response = await axios.post(endpoint, payload, {
    headers,
    timeout: 60000,
    ...(proxy ? { proxy } : {}),
  });

  if (response.data && Array.isArray(response.data.data)) {
    const sorted = [...response.data.data].sort(
      (a: any, b: any) => (a.index ?? 0) - (b.index ?? 0)
    );
    return sorted.map((d: any) => normalizeAndFitDimension(d.embedding, targetDim));
  }

  throw new Error("Invalid response format from OpenAI-compatible embeddings API");
}

// ── 2. Google Gemini Embeddings ────────────────────────────────────────
async function callGeminiEmbedding(
  texts: string[],
  apiKey: string,
  model: string,
  targetDim = 768
): Promise<number[][]> {
  const modelName = model.replace(/^models\//, "");

  if (texts.length === 1) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${apiKey}`;
    const proxy = getProxyConfig(url);
    const response = await axios.post(
      url,
      {
        content: { parts: [{ text: texts[0] }] },
      },
      { timeout: 30000, ...(proxy ? { proxy } : {}) }
    );
    const values = response.data?.embedding?.values;
    if (Array.isArray(values)) {
      return [normalizeAndFitDimension(values, targetDim)];
    }
    throw new Error("Invalid response from Gemini embedContent API");
  }

  // Batch embedding for Gemini
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:batchEmbedContents?key=${apiKey}`;
  const proxy = getProxyConfig(url);
  const requests = texts.map(text => ({
    model: `models/${modelName}`,
    content: { parts: [{ text }] },
  }));

  const response = await axios.post(url, { requests }, { timeout: 60000, ...(proxy ? { proxy } : {}) });
  if (response.data && Array.isArray(response.data.embeddings)) {
    return response.data.embeddings.map((e: any) =>
      normalizeAndFitDimension(e.values || [], targetDim)
    );
  }

  throw new Error("Invalid response from Gemini batchEmbedContents API");
}

// ── 3. Ollama Embeddings ───────────────────────────────────────────────
async function callOllamaEmbedding(
  text: string,
  ollamaUrl: string,
  model: string,
  task: "query" | "document" = "query",
  targetDim = 768
): Promise<number[]> {
  const cleanUrl = ollamaUrl.replace(/\/+$/, "");
  const prefix = model.includes("nomic-embed-text")
    ? task === "query"
      ? "search_query: "
      : "search_document: "
    : "";
  const prompt = `${prefix}${text}`;

  try {
    const response = await axios.post(
      `${cleanUrl}/api/embeddings`,
      {
        model,
        prompt,
      },
      { timeout: 60000 }
    );

    if (response.data && Array.isArray(response.data.embedding)) {
      return normalizeAndFitDimension(response.data.embedding, targetDim);
    }
  } catch (err: any) {
    // Try /api/embed (newer Ollama format)
    try {
      const altResp = await axios.post(
        `${cleanUrl}/api/embed`,
        {
          model,
          input: prompt,
        },
        { timeout: 60000 }
      );
      if (altResp.data && Array.isArray(altResp.data.embeddings?.[0])) {
        return normalizeAndFitDimension(altResp.data.embeddings[0], targetDim);
      }
    } catch {
      // Throw original error
    }
    throw err;
  }

  throw new Error(`Invalid response from Ollama embeddings for model: ${model}`);
}

// ── Unified Embedding Dispatcher ───────────────────────────────────────
async function executeEmbeddingBatch(
  texts: string[],
  task: "query" | "document" = "document"
): Promise<number[][]> {
  const settings = getSettings();
  const provider = settings.embeddingProvider || "openai-compatible";
  const model =
    settings.embeddingModel ||
    settings.ollamaEmbeddingModel ||
    process.env.EMBEDDING_MODEL ||
    "BAAI/bge-large-zh-v1.5";
  const targetDim = settings.embeddingDimension || 768;

  // 1. Google Gemini Provider
  if (provider === "gemini") {
    const apiKey = settings.embeddingApiKey || settings.apiKey || process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      throw new Error("Gemini API Key is missing. Please configure it in Settings or GEMINI_API_KEY env.");
    }
    return await callGeminiEmbedding(texts, apiKey, model || "text-embedding-004", targetDim);
  }

  // 2. Ollama Provider (Local)
  if (provider === "ollama") {
    const ollamaUrl = settings.embeddingBaseUrl || OLLAMA_DEFAULT_URL;
    const ollamaModel = model || settings.ollamaEmbeddingModel || "nomic-embed-text";

    try {
      const results: number[][] = [];
      for (const text of texts) {
        const vec = await callOllamaEmbedding(text, ollamaUrl, ollamaModel, task, targetDim);
        results.push(vec);
      }
      return results;
    } catch (err: any) {
      const isOllamaDown =
        err.code === "ECONNREFUSED" ||
        err.code === "ENOTFOUND" ||
        err.message?.includes("ECONNREFUSED");

      // Seamless fallback to cloud API if configured
      const cloudApiKey = settings.apiKey || process.env.SILICONFLOW_API_KEY || process.env.OPENAI_API_KEY;
      if (isOllamaDown && cloudApiKey) {
        logger.warn(
          `[ArcRift] Local Ollama is unreachable at ${ollamaUrl}. Falling back to configured cloud embedding provider.`
        );
        const cloudBaseUrl = settings.apiBaseUrl || "https://api.siliconflow.cn/v1";
        const cloudModel = "BAAI/bge-large-zh-v1.5";
        return await callOpenAICompatibleEmbedding(texts, cloudBaseUrl, cloudApiKey, cloudModel, targetDim);
      }

      if (isOllamaDown) {
        const errorMsg = `Ollama is not running (无法连接到本地 Ollama: ${ollamaUrl})。请先启动 Ollama (运行 'ollama serve')，或者在系统设置中切换为云端 API (如 SiliconFlow 硅基流动、OpenAI、Gemini 等)。`;
        logger.error(`[ArcRift] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      logger.error(`[ArcRift] Ollama embedding failed (${ollamaModel}): ${err.message}`);
      throw new Error(`Ollama embedding failed (${ollamaModel}). Please check if the model is pulled: 'ollama pull ${ollamaModel}'`);
    }
  }

  // 3. OpenAI-Compatible & SiliconFlow Provider (Default Cloud)
  const baseUrl =
    settings.embeddingBaseUrl ||
    settings.apiBaseUrl ||
    process.env.EMBEDDING_BASE_URL ||
    process.env.API_BASE_URL ||
    "https://api.siliconflow.cn/v1";
  const apiKey =
    settings.embeddingApiKey ||
    settings.apiKey ||
    process.env.EMBEDDING_API_KEY ||
    process.env.API_KEY ||
    process.env.SILICONFLOW_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";

  if (!apiKey && !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
    logger.warn("[ArcRift] No API key configured for embedding API. Calls might fail if authentication is required.");
  }

  return await callOpenAICompatibleEmbedding(texts, baseUrl, apiKey, model, targetDim);
}

/**
 * Generate a single vector embedding.
 */
export async function generateEmbedding(
  text: string,
  task: "query" | "document" = "query"
): Promise<number[]> {
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = attempt * 2000;
        logger.debug(`[ArcRift] Retrying embedding generation (attempt ${attempt + 1}/${MAX_RETRIES + 1}) in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
      }

      const results = await executeEmbeddingBatch([text], task);
      if (results && results.length > 0) {
        return results[0];
      }
      throw new Error("No embedding returned from provider");
    } catch (err: any) {
      if (attempt < MAX_RETRIES) {
        const isRateLimit = err?.response?.status === 429 || err?.message?.includes("429");
        const isTimeout = err.code === "ECONNABORTED" || err.message?.includes("timeout");
        if (isRateLimit || isTimeout) {
          logger.warn(`[ArcRift] Embedding temporary error (${err.message}), retrying...`);
          continue;
        }
      }
      throw err;
    }
  }

  throw new Error("Embedding generation failed after retries.");
}

/**
 * Generate embeddings for multiple texts in batches.
 * For cloud APIs, batches in groups of 16-32 for extreme speed.
 * For Ollama, processes in smaller batches with pauses.
 */
export async function generateEmbeddings(
  texts: string[],
  task: "query" | "document" = "document"
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const settings = getSettings();
  const provider = settings.embeddingProvider || "openai-compatible";
  const isLocalOllama = provider === "ollama";
  const BATCH_SIZE = isLocalOllama ? 3 : 16;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    logger.debug(`[ArcRift] Processing embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)} (${batch.length} items)...`);

    try {
      const batchResults = await executeEmbeddingBatch(batch, task);
      results.push(...batchResults);
    } catch (err: any) {
      logger.error(`[ArcRift] Batch embedding failed at index ${i}: ${err.message}`);
      throw err;
    }

    if (isLocalOllama && i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  return results;
}

/**
 * Health probe for active embedding service.
 */
export async function checkEmbeddingHealth(): Promise<{ ok: boolean; message: string; dimension?: number }> {
  try {
    const start = Date.now();
    const vec = await generateEmbedding("ArcRift Health Check", "query");
    const latency = Date.now() - start;
    return {
      ok: true,
      message: `Embedding service healthy (${latency}ms)`,
      dimension: vec.length,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || "Embedding check failed",
    };
  }
}

/**
 * Legacy Ollama health check for backward compatibility.
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const settings = getSettings();
    const url = settings.embeddingBaseUrl || OLLAMA_DEFAULT_URL;
    await axios.get(`${url.replace(/\/+$/, "")}/api/tags`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}
