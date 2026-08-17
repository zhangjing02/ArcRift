import path from "path";
import fs from "fs";
import os from "os";
import { logger } from "./logger";

export type ChatProvider =
  | "openai-compatible"
  | "siliconflow"
  | "deepseek"
  | "gemini"
  | "groq"
  | "ollama"
  | "custom";

export type EmbeddingProvider =
  | "openai-compatible"
  | "siliconflow"
  | "gemini"
  | "ollama"
  | "custom";

export interface ProviderPreset {
  name: string;
  label: string;
  chatBaseUrl?: string;
  embeddingBaseUrl?: string;
  defaultChatModel?: string;
  defaultEmbeddingModel?: string;
  description?: string;
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  siliconflow: {
    name: "siliconflow",
    label: "SiliconFlow (硅基流动)",
    chatBaseUrl: "https://api.siliconflow.cn/v1",
    embeddingBaseUrl: "https://api.siliconflow.cn/v1",
    defaultChatModel: "deepseek-ai/DeepSeek-V3",
    defaultEmbeddingModel: "BAAI/bge-large-zh-v1.5",
    description: "国内超高性价比/支持免费额度，支持 DeepSeek-V3/R1 及 BAAI Embedding 系列",
  },
  deepseek: {
    name: "deepseek",
    label: "DeepSeek 官方",
    chatBaseUrl: "https://api.deepseek.com/v1",
    defaultChatModel: "deepseek-chat",
    description: "DeepSeek 官方 API（支持 DeepSeek-V3 与 DeepSeek-R1）",
  },
  openai: {
    name: "openai-compatible",
    label: "OpenAI 官方",
    chatBaseUrl: "https://api.openai.com/v1",
    embeddingBaseUrl: "https://api.openai.com/v1",
    defaultChatModel: "gpt-4o-mini",
    defaultEmbeddingModel: "text-embedding-3-small",
    description: "OpenAI 官方接口（支持 GPT-4o-mini 及 text-embedding-3）",
  },
  gemini: {
    name: "gemini",
    label: "Google Gemini",
    chatBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    embeddingBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultChatModel: "gemini-1.5-flash",
    defaultEmbeddingModel: "text-embedding-004",
    description: "Google Gemini API（速度极快、免费额度充足）",
  },
  groq: {
    name: "groq",
    label: "Groq Cloud",
    chatBaseUrl: "https://api.groq.com/openai/v1",
    defaultChatModel: "llama-3.3-70b-versatile",
    description: "超低延迟推理（免费 Llama-3.3-70b）",
  },
  ollama: {
    name: "ollama",
    label: "Ollama (本地离线)",
    chatBaseUrl: "http://localhost:11434/v1",
    embeddingBaseUrl: "http://localhost:11434",
    defaultChatModel: "qwen2.5:3b",
    defaultEmbeddingModel: "nomic-embed-text",
    description: "完全本地离线运行（需安装并启动 Ollama）",
  },
};

export interface Settings {
  // LLM Chat & Extraction Configuration
  chatProvider?: ChatProvider;
  apiBaseUrl?: string;
  apiKey?: string;
  chatModel?: string;
  llmMode?: "local" | "cloud";

  // Vector Embedding Configuration
  embeddingProvider?: EmbeddingProvider;
  embeddingBaseUrl?: string;
  embeddingApiKey?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  embeddingMode?: "local" | "cloud";

  // Context retrieval mode
  contextMode?: "raw" | "summarized";

  // Legacy / Ollama-specific backwards compatibility
  ollamaEmbeddingModel?: string;
  ollamaExtractionModel?: string;
}

import { getDataDir } from "./paths";

// Canonical settings file paths (checked in order)
function getSettingsFilePaths(): string[] {
  const dataDir = getDataDir();
  return [
    path.join(dataDir, "settings.json"),
    path.join(dataDir, "NowledgeMem-settings.json"),
    path.resolve(__dirname, "../../ArcRift-settings.json"),
    path.join(process.cwd(), "ArcRift-settings.json"),
  ];
}

let cachedSettings: Settings | null = null;

function detectDefaultChatProvider(): ChatProvider {
  if (process.env.CHAT_PROVIDER) return process.env.CHAT_PROVIDER as ChatProvider;
  if (process.env.GRAPH_BACKEND === "groq") return "groq";
  if (process.env.GRAPH_BACKEND === "ollama") return "ollama";
  if (process.env.SILICONFLOW_API_KEY) return "siliconflow";
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.OPENAI_API_KEY) return "openai-compatible";
  return "openai-compatible";
}

function detectDefaultEmbeddingProvider(): EmbeddingProvider {
  if (process.env.EMBEDDING_PROVIDER) return process.env.EMBEDDING_PROVIDER as EmbeddingProvider;
  if (process.env.SILICONFLOW_API_KEY) return "siliconflow";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai-compatible";
  return "openai-compatible";
}

export function getSettings(): Settings {
  if (cachedSettings) return cachedSettings;

  let fileSettings: Partial<Settings> = {};
  const paths = getSettingsFilePaths();

  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        if (raw.trim()) {
          fileSettings = JSON.parse(raw);
          logger.info(`[ChronosMind] Settings loaded from ${p}`);
          break;
        }
      }
    } catch {}
  }

  const chatProvider = fileSettings.chatProvider || detectDefaultChatProvider();
  const embeddingProvider = fileSettings.embeddingProvider || detectDefaultEmbeddingProvider();
  const chatPreset = PROVIDER_PRESETS[chatProvider] || PROVIDER_PRESETS.siliconflow;
  const embeddingPreset = PROVIDER_PRESETS[embeddingProvider] || PROVIDER_PRESETS.siliconflow;

  // Resolve Chat Base URL
  const apiBaseUrl =
    fileSettings.apiBaseUrl ||
    process.env.API_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    process.env.OPENAI_API_BASE ||
    chatPreset.chatBaseUrl ||
    "https://api.siliconflow.cn/v1";

  // Resolve Chat API Key
  const apiKey =
    fileSettings.apiKey ||
    process.env.API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.SILICONFLOW_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GROQ_API_KEY ||
    "";

  // Resolve Chat Model
  const chatModel =
    fileSettings.chatModel ||
    process.env.CHAT_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.DEEPSEEK_MODEL ||
    process.env.GROQ_MODEL ||
    fileSettings.ollamaExtractionModel ||
    process.env.OLLAMA_MODEL ||
    chatPreset.defaultChatModel ||
    "deepseek-ai/DeepSeek-V3";

  // Resolve Embedding Base URL
  const embeddingBaseUrl =
    fileSettings.embeddingBaseUrl ||
    process.env.EMBEDDING_BASE_URL ||
    (embeddingProvider === "ollama" ? (process.env.OLLAMA_URL || "http://localhost:11434") : undefined) ||
    embeddingPreset.embeddingBaseUrl ||
    apiBaseUrl;

  // Resolve Embedding API Key
  const embeddingApiKey =
    fileSettings.embeddingApiKey ||
    process.env.EMBEDDING_API_KEY ||
    apiKey ||
    process.env.API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.SILICONFLOW_API_KEY ||
    "";

  // Resolve Embedding Model
  const embeddingModel =
    fileSettings.embeddingModel ||
    process.env.EMBEDDING_MODEL ||
    fileSettings.ollamaEmbeddingModel ||
    process.env.OLLAMA_EMBED_MODEL ||
    embeddingPreset.defaultEmbeddingModel ||
    "BAAI/bge-large-zh-v1.5";

  // Context mode
  const contextMode = (fileSettings.contextMode || process.env.CONTEXT_MODE || "raw") as
    | "raw"
    | "summarized";

  cachedSettings = {
    chatProvider,
    apiBaseUrl,
    apiKey,
    chatModel,
    llmMode: fileSettings.llmMode || "cloud",
    embeddingProvider,
    embeddingBaseUrl,
    embeddingApiKey,
    embeddingModel,
    embeddingDimension: fileSettings.embeddingDimension || (embeddingModel.includes("bge-m3") ? 1024 : 768),
    embeddingMode: fileSettings.embeddingMode || "cloud",
    contextMode,
    ollamaEmbeddingModel: fileSettings.ollamaEmbeddingModel || process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
    ollamaExtractionModel: fileSettings.ollamaExtractionModel || process.env.OLLAMA_MODEL || "qwen2.5:3b",
  };

  return cachedSettings;
}

export function updateSettings(settings: Partial<Settings>): Settings {
  const current = getSettings();
  const updated: Settings = { ...current, ...settings };

  // Synchronize legacy fields if updated
  if (settings.embeddingModel) {
    updated.ollamaEmbeddingModel = settings.embeddingModel;
  }
  if (settings.chatModel) {
    updated.ollamaExtractionModel = settings.chatModel;
  }

  cachedSettings = updated;
  const paths = getSettingsFilePaths();

  for (const p of paths) {
    try {
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, JSON.stringify(updated, null, 2), "utf-8");
      logger.success(`[ChronosMind] Settings permanently written to ${p}`);
    } catch (err: any) {
      logger.error(`[ChronosMind] Failed to write settings to ${p}: ${err.message}`);
    }
  }

  return updated;
}

export function resetSettingsCache(): void {
  cachedSettings = null;
}
