import fs from "fs";
import path from "path";
import axios from "axios";
import { logger } from "../utils/logger";

export interface ModelMeta {
  id: string;
  name: string;
  type: "embedding" | "llm";
  category: string;
  sizeText: string;
  approxBytes: number;
  filename: string;
  downloadUrls: string[];
  isDownloaded: boolean;
  isDownloading: boolean;
  progress: number;
  speed: string;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
}

const MODELS_BASE_DIR = path.resolve(__dirname, "../../models");

const DEFINED_MODELS: Record<string, Omit<ModelMeta, "isDownloaded" | "isDownloading" | "progress" | "speed" | "downloadedBytes" | "totalBytes">> = {
  embedding_qwen: {
    id: "embedding_qwen",
    name: "Qwen2.5-Embedding / 0.5B Q4_K_M (Imatrix)",
    type: "embedding",
    category: "搜索与增强",
    sizeText: "396.0 MB",
    approxBytes: 396 * 1024 * 1024,
    filename: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    downloadUrls: [
      "https://modelscope.cn/models/qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/master/qwen2.5-0.5b-instruct-q4_k_m.gguf",
      "https://modelscope.cn/models/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/master/qwen2.5-0.5b-instruct-q4_k_m.gguf",
      "https://hf-mirror.com/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
      "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    ],
  },
  llm_gemma: {
    id: "llm_gemma",
    name: "Gemma-4 E2B IT UD-Q4_K_XL + vision projector",
    type: "llm",
    category: "在设备上驱动搜索、实体提取与记忆提炼",
    sizeText: "3.9 GB",
    approxBytes: 1.7 * 1024 * 1024 * 1024,
    filename: "gemma-2-2b-it-q4_k_m.gguf",
    downloadUrls: [
      "https://modelscope.cn/models/bartowski/gemma-2-2b-it-GGUF/resolve/master/gemma-2-2b-it-Q4_K_M.gguf",
      "https://modelscope.cn/models/QuantFactory/gemma-2-2b-it-GGUF/resolve/master/gemma-2-2b-it.Q4_K_M.gguf",
      "https://hf-mirror.com/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
      "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
    ],
  },
  llm_qwen: {
    id: "llm_qwen",
    name: "Qwen2.5-3B-Instruct Q4_K_M",
    type: "llm",
    category: "本地端侧轻量高精度 LLM",
    sizeText: "2.1 GB",
    approxBytes: 2.1 * 1024 * 1024 * 1024,
    filename: "qwen2.5-3b-instruct-q4_k_m.gguf",
    downloadUrls: [
      "https://modelscope.cn/models/qwen/Qwen2.5-3B-Instruct-GGUF/resolve/master/qwen2.5-3b-instruct-q4_k_m.gguf",
      "https://modelscope.cn/models/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/master/qwen2.5-3b-instruct-q4_k_m.gguf",
      "https://hf-mirror.com/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
      "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    ],
  },
};

// In-memory active downloads tracker
const activeDownloads = new Map<
  string,
  {
    isDownloading: boolean;
    progress: number;
    speed: string;
    downloadedBytes: number;
    totalBytes: number;
    abortController?: AbortController;
    error?: string;
  }
>();

function ensureDir(dir: string) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err: any) {
    logger.error(`[ModelManager] Failed to ensure directory ${dir}: ${err.message}`);
  }
}

// Ensure base directories on module load
ensureDir(MODELS_BASE_DIR);
ensureDir(path.join(MODELS_BASE_DIR, "embedding"));
ensureDir(path.join(MODELS_BASE_DIR, "llm"));

export function getModelFilePath(modelId: string): string | null {
  let targetId = modelId;
  if (!DEFINED_MODELS[targetId]) {
    if (modelId === "qwen" || modelId === "embedding") targetId = "embedding_qwen";
    else if (modelId === "gemma" || modelId === "llm") targetId = "llm_gemma";
  }

  const meta = DEFINED_MODELS[targetId];
  if (!meta) return null;
  const subDir = meta.type === "embedding" ? "embedding" : "llm";
  return path.join(MODELS_BASE_DIR, subDir, meta.filename);
}

export function isModelDownloaded(modelId: string): boolean {
  const filePath = getModelFilePath(modelId);
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    const stat = fs.statSync(filePath);
    return stat.size > 1024 * 1024; // > 1MB
  } catch {
    return false;
  }
}

export function getAllModelStatuses(): ModelMeta[] {
  const results: ModelMeta[] = [];

  for (const [id, def] of Object.entries(DEFINED_MODELS)) {
    const downloaded = isModelDownloaded(id);
    const active = activeDownloads.get(id);

    results.push({
      ...def,
      isDownloaded: downloaded,
      isDownloading: !!active?.isDownloading && !active?.error,
      progress: active ? active.progress : downloaded ? 100 : 0,
      speed: active ? active.speed : "",
      downloadedBytes: active ? active.downloadedBytes : downloaded ? def.approxBytes : 0,
      totalBytes: active ? active.totalBytes : def.approxBytes,
      error: active?.error,
    });
  }

  return results;
}

export async function startModelDownload(modelId: string): Promise<{ success: boolean; message: string }> {
  // Alias mapping
  let targetId = modelId;
  if (!DEFINED_MODELS[targetId]) {
    if (modelId === "qwen" || modelId === "embedding") targetId = "embedding_qwen";
    else if (modelId === "gemma" || modelId === "llm") targetId = "llm_gemma";
  }

  const meta = DEFINED_MODELS[targetId];
  if (!meta) {
    return { success: false, message: `未知模型: ${modelId}` };
  }

  if (isModelDownloaded(targetId)) {
    return { success: true, message: "模型已安装" };
  }

  const currentActive = activeDownloads.get(targetId);
  if (currentActive?.isDownloading && currentActive.progress < 100 && !currentActive.error) {
    return { success: true, message: "模型正在下载中" };
  }

  const subDir = meta.type === "embedding" ? "embedding" : "llm";
  const targetDir = path.join(MODELS_BASE_DIR, subDir);
  ensureDir(targetDir);

  const destPath = path.join(targetDir, meta.filename);
  const tempPath = destPath + ".tmp";

  // Clean up any stale temp file
  try {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  } catch {}

  const abortController = new AbortController();
  activeDownloads.set(targetId, {
    isDownloading: true,
    progress: 1,
    speed: "连接中...",
    downloadedBytes: 0,
    totalBytes: meta.approxBytes,
    abortController,
    error: undefined,
  });

  logger.info(`[ModelManager] Starting download for ${meta.name} -> ${destPath}`);

  // Background download runner
  (async () => {
    let success = false;

    for (const url of meta.downloadUrls) {
      if (success || abortController.signal.aborted) break;
      try {
        logger.info(`[ModelManager] Attempting download from mirror: ${url}`);
        
        let lastTime = Date.now();
        let lastBytes = 0;

        const response = await axios({
          method: "GET",
          url,
          responseType: "stream",
          signal: abortController.signal,
          timeout: 25000,
          maxRedirects: 10,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ArcRift-ModelManager/1.0",
            "Accept-Encoding": "identity",
          },
        });

        const rawLen = response.headers["content-length"];
        const headerLength = parseInt(typeof rawLen === "string" ? rawLen : typeof rawLen === "number" ? String(rawLen) : "0", 10);
        const totalBytes = headerLength > 0 ? headerLength : meta.approxBytes;
        let downloaded = 0;

        const writer = fs.createWriteStream(tempPath);

        response.data.on("data", (chunk: Buffer) => {
          downloaded += chunk.length;
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;

          if (timeDiff >= 0.4) {
            const bytesDiff = downloaded - lastBytes;
            const speedMbps = (bytesDiff / (1024 * 1024) / timeDiff).toFixed(1);
            const pct = Math.min(99, Math.round((downloaded / totalBytes) * 100));

            activeDownloads.set(targetId, {
              isDownloading: true,
              progress: Math.max(1, pct),
              speed: `${speedMbps} MB/s`,
              downloadedBytes: downloaded,
              totalBytes,
              abortController,
            });

            lastTime = now;
            lastBytes = downloaded;
          }
        });

        response.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          let finished = false;

          const cleanupAndReject = (err: any) => {
            if (finished) return;
            finished = true;
            try { writer.close(); } catch {}
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
            reject(err);
          };

          writer.on("finish", () => {
            if (finished) return;
            finished = true;

            try {
              if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
              }
              fs.renameSync(tempPath, destPath);
            } catch (moveErr) {
              try {
                fs.copyFileSync(tempPath, destPath);
                fs.unlinkSync(tempPath);
              } catch (copyErr) {
                cleanupAndReject(copyErr);
                return;
              }
            }

            activeDownloads.set(targetId, {
              isDownloading: false,
              progress: 100,
              speed: "完成",
              downloadedBytes: totalBytes,
              totalBytes,
            });
            logger.success(`[ModelManager] Successfully downloaded ${meta.name} (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
            success = true;
            resolve();
          });

          writer.on("error", cleanupAndReject);
          response.data.on("error", cleanupAndReject);

          abortController.signal.addEventListener("abort", () => {
            cleanupAndReject(new Error("Download aborted by user"));
          });
        });
      } catch (err: any) {
        if (abortController.signal.aborted) {
          logger.info(`[ModelManager] Download aborted for ${meta.name}`);
          break;
        }
        logger.warn(`[ModelManager] Download from ${url} failed: ${err.message}`);
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
      }
    }

    if (!success && !abortController.signal.aborted) {
      activeDownloads.set(targetId, {
        isDownloading: false,
        progress: 0,
        speed: "",
        downloadedBytes: 0,
        totalBytes: meta.approxBytes,
        error: "所有镜像源连接失败，请检查网络或点击重试",
      });
      logger.error(`[ModelManager] All mirrors failed for ${meta.name}`);
    }
  })();

  return { success: true, message: "下载已启动" };
}

export function deleteModel(modelId: string): { success: boolean; message: string } {
  let targetId = modelId;
  if (!DEFINED_MODELS[targetId]) {
    if (modelId === "qwen" || modelId === "embedding") targetId = "embedding_qwen";
    else if (modelId === "gemma" || modelId === "llm") targetId = "llm_gemma";
  }

  const active = activeDownloads.get(targetId);
  if (active?.abortController) {
    active.abortController.abort();
  }
  activeDownloads.delete(targetId);

  const filePath = getModelFilePath(targetId);
  if (!filePath) {
    return { success: false, message: "未知模型" };
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (fs.existsSync(filePath + ".tmp")) {
      fs.unlinkSync(filePath + ".tmp");
    }
    logger.info(`[ModelManager] Deleted model ${targetId}`);
    return { success: true, message: "模型已删除" };
  } catch (err: any) {
    logger.error(`[ModelManager] Failed to delete model ${targetId}:`, err);
    return { success: false, message: err.message };
  }
}

