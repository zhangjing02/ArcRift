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
  id: string;
  name: string;
  label: string;
  icon: string;
  chatBaseUrl: string;
  embeddingBaseUrl?: string;
  defaultChatModel: string;
  defaultEmbeddingModel?: string;
  description: string;
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  openai: {
    id: "openai",
    name: "openai",
    label: "OpenAI",
    icon: "🟢",
    chatBaseUrl: "https://api.openai.com/v1",
    embeddingBaseUrl: "https://api.openai.com/v1",
    defaultChatModel: "gpt-4o-mini",
    defaultEmbeddingModel: "text-embedding-3-small",
    description: "OpenAI 官方接口（支持 GPT-4o, GPT-4o-mini 及 text-embedding-3）",
  },
  chatgpt: {
    id: "chatgpt",
    name: "chatgpt",
    label: "ChatGPT Subscription",
    icon: "💬",
    chatBaseUrl: "https://api.openai.com/v1",
    defaultChatModel: "gpt-4o",
    description: "ChatGPT Plus/Team 订阅通道与 Codex 服务",
  },
  anthropic: {
    id: "anthropic",
    name: "anthropic",
    label: "Anthropic",
    icon: "🟧",
    chatBaseUrl: "https://api.anthropic.com/v1",
    defaultChatModel: "claude-3-5-sonnet-20241022",
    description: "Anthropic 官方 Claude 3.5 Sonnet / Haiku 顶尖模型",
  },
  xai: {
    id: "xai",
    name: "xai",
    label: "xAI",
    icon: "✖️",
    chatBaseUrl: "https://api.x.ai/v1",
    defaultChatModel: "grok-2-1212",
    description: "Elon Musk 旗下 xAI 平台 Grok-2 / Grok-3 大模型",
  },
  supergrok: {
    id: "supergrok",
    name: "supergrok",
    label: "SuperGrok",
    icon: "⚡",
    chatBaseUrl: "https://api.x.ai/v1",
    defaultChatModel: "grok-beta",
    description: "SuperGrok 高速推理专属通道",
  },
  deepseek: {
    id: "deepseek",
    name: "deepseek",
    label: "DeepSeek",
    icon: "🐳",
    chatBaseUrl: "https://api.deepseek.com/v1",
    defaultChatModel: "deepseek-chat",
    description: "DeepSeek 官方 API（支持 DeepSeek-V3 与 DeepSeek-R1 深度思考）",
  },
  minimax: {
    id: "minimax",
    name: "minimax",
    label: "MiniMax",
    icon: "🟣",
    chatBaseUrl: "https://api.minimax.chat/v1",
    defaultChatModel: "MiniMax-Text-01",
    description: "MiniMax 稀宇科技中文大模型系列（abab6.5s / Text-01）",
  },
  zhipu: {
    id: "zhipu",
    name: "zhipu",
    label: "Z.AI",
    icon: "⚡",
    chatBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultChatModel: "glm-4-flash",
    description: "智谱 AI (Z.AI) GLM-4-Plus / GLM-4-Flash 清言大模型",
  },
  moonshot: {
    id: "moonshot",
    name: "moonshot",
    label: "Moonshot AI",
    icon: "🌙",
    chatBaseUrl: "https://api.moonshot.cn/v1",
    defaultChatModel: "moonshot-v1-8k",
    description: "月之暗面 Kimi 开放平台长上下文大模型",
  },
  ollama: {
    id: "ollama",
    name: "ollama",
    label: "Ollama",
    icon: "🦙",
    chatBaseUrl: "http://localhost:11434/v1",
    embeddingBaseUrl: "http://localhost:11434",
    defaultChatModel: "qwen2.5:3b",
    defaultEmbeddingModel: "nomic-embed-text",
    description: "完全本地离线运行（需安装并启动本地 Ollama 实例）",
  },
  lemonade: {
    id: "lemonade",
    name: "lemonade",
    label: "Lemonade",
    icon: "🍋",
    chatBaseUrl: "https://api.lemonade.io/v1",
    defaultChatModel: "lemonade-v1",
    description: "Lemonade AI 智能服务通道",
  },
  lmstudio: {
    id: "lmstudio",
    name: "lmstudio",
    label: "LM Studio",
    icon: "🖥️",
    chatBaseUrl: "http://localhost:1234/v1",
    defaultChatModel: "local-model",
    description: "LM Studio 本地桌面模型运行服务（端口 1234）",
  },
  xiaomi: {
    id: "xiaomi",
    name: "xiaomi",
    label: "Xiaomi MiMo",
    icon: "📱",
    chatBaseUrl: "https://api.mimo.xiaomi.com/v1",
    defaultChatModel: "mimo-v1",
    description: "小米 MiMo / 小爱大模型开发者平台",
  },
  poe: {
    id: "poe",
    name: "poe",
    label: "Poe",
    icon: "🦅",
    chatBaseUrl: "https://api.poe.com/v1",
    defaultChatModel: "Claude-3.5-Sonnet",
    description: "Quora Poe 聚合 AI 模型 API 服务",
  },
  jina: {
    id: "jina",
    name: "jina",
    label: "Jina AI",
    icon: "🔍",
    chatBaseUrl: "https://api.jina.ai/v1",
    embeddingBaseUrl: "https://api.jina.ai/v1",
    defaultChatModel: "jina-embeddings-v3",
    defaultEmbeddingModel: "jina-embeddings-v3",
    description: "Jina AI 多语言高性能 Embedding 与 Rerank 引擎",
  },
  siliconflow: {
    id: "siliconflow",
    name: "siliconflow",
    label: "SiliconFlow",
    icon: "🌊",
    chatBaseUrl: "https://api.siliconflow.cn/v1",
    embeddingBaseUrl: "https://api.siliconflow.cn/v1",
    defaultChatModel: "deepseek-ai/DeepSeek-V3",
    defaultEmbeddingModel: "BAAI/bge-large-zh-v1.5",
    description: "国内超高性价比/含免费额度，支持 DeepSeek-V3/R1 及 BAAI Embedding 系列",
  },
  gemini: {
    id: "gemini",
    name: "gemini",
    label: "Google Gemini",
    icon: "✨",
    chatBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    embeddingBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultChatModel: "gemini-1.5-flash",
    defaultEmbeddingModel: "text-embedding-004",
    description: "Google Gemini 原生 API（超快响应速度与超长上下文）",
  },
  groq: {
    id: "groq",
    name: "groq",
    label: "Groq Cloud",
    icon: "⚡",
    chatBaseUrl: "https://api.groq.com/openai/v1",
    defaultChatModel: "llama-3.3-70b-versatile",
    description: "LPU 超低延迟推理服务（免费 Llama-3.3-70b）",
  },
  custom: {
    id: "custom",
    name: "custom",
    label: "自定义 (OpenAI 兼容)",
    icon: "⚙️",
    chatBaseUrl: "https://api.openai.com/v1",
    defaultChatModel: "custom-model",
    description: "支持任意兼容 OpenAI /chat/completions 规范的第三方中转或自建网关",
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

  // Provider-specific saved configs (key is provider ID)
  providerConfigs?: Record<
    string,
    {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      isConfigured?: boolean;
      reasoning?: boolean;
      headers?: Record<string, string>;
      timeout?: number;
    }
  >;

  // 个人资料 (User Profile)
  userProfile?: {
    name?: string;
    aliases?: string;
    outputLanguage?: string;
    aboutYou?: string;
    profileInstructions?: string;
  };

  // 随处访问 (Remote & LAN Access)
  remoteAccess?: {
    allowLan?: boolean;
    lanPort?: number;
    requireLocalAuth?: boolean;
    apiKey?: string;
    tunnelType?: "quick" | "named";
    tunnelStatus?: "idle" | "running" | "stopped";
    publicUrl?: string;
    ipWhitelist?: string;
  };

  // 偏好设置 (Preferences)
  preferences?: {
    themeMode?: "light" | "dark" | "system";
    uiLanguage?: string;
    fontSizeScale?: "small" | "normal" | "medium" | "large";
    launchAtLogin?: boolean;
    enableMultiSpaces?: boolean;
    shortcutLauncher?: boolean;
    shortcutSummary?: boolean;
    shortcutHints?: boolean;
  };

  // Context mode
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
    providerConfigs: fileSettings.providerConfigs || {},
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

export const saveSettings = updateSettings;

export function resetSettingsCache(): void {
  cachedSettings = null;
}
