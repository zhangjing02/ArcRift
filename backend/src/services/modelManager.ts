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
      "https://hf-mirror.com/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    ],
  },
  llm_gemma: {
    id: "llm_gemma",
    name: "Gemma-4 E2B IT UD-Q4_K_XL + vision projector",
    type: "llm",
    category: "在设备上驱动搜索、实体提取与记忆提炼",
    sizeText: "3.9 GB",
    approxBytes: 1.6 * 1024 * 1024 * 1024,
    filename: "gemma-2-2b-it-q4_k_m.gguf",
    downloadUrls: [
      "https://hf-mirror.com/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
      "https://modelscope.cn/models/LLM-Research/gemma-2-2b-it-GGUF/resolve/master/gemma-2-2b-it-Q4_K_M.gguf",
    ],
  },
};

// In-memory active downloads tracker
const activeDownloads = new Map<
  string,
  {
    progress: number;
    speed: string;
    downloadedBytes: number;
    totalBytes: number;
    abortController?: AbortController;
    error?: string;
  }
>();

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getModelFilePath(modelId: string): string | null {
  const meta = DEFINED_MODELS[modelId];
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
      isDownloading: !!active && (active.progress < 100 && !active.error),
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
  const meta = DEFINED_MODELS[modelId];
  if (!meta) {
    return { success: false, message: `未知模型: ${modelId}` };
  }

  if (isModelDownloaded(modelId)) {
    return { success: true, message: "模型已安装" };
  }

  if (activeDownloads.has(modelId) && activeDownloads.get(modelId)?.progress! < 100) {
    return { success: true, message: "模型正在下载中" };
  }

  const subDir = meta.type === "embedding" ? "embedding" : "llm";
  const targetDir = path.join(MODELS_BASE_DIR, subDir);
  ensureDir(targetDir);

  const destPath = path.join(targetDir, meta.filename);
  const tempPath = destPath + ".tmp";

  const abortController = new AbortController();
  activeDownloads.set(modelId, {
    progress: 1,
    speed: "0 MB/s",
    downloadedBytes: 0,
    totalBytes: meta.approxBytes,
    abortController,
  });

  logger.info(`[ModelManager] Starting real download for ${meta.name} -> ${destPath}`);

  // Background download runner
  (async () => {
    let lastTime = Date.now();
    let lastBytes = 0;
    let success = false;

    for (const url of meta.downloadUrls) {
      if (success) break;
      try {
        logger.info(`[ModelManager] Attempting download from: ${url}`);
        const response = await axios({
          method: "GET",
          url,
          responseType: "stream",
          signal: abortController.signal,
          timeout: 30000,
          maxRedirects: 5,
        });

        const totalBytes = parseInt(response.headers["content-length"] || String(meta.approxBytes), 10);
        let downloaded = 0;

        const writer = fs.createWriteStream(tempPath);

        response.data.on("data", (chunk: Buffer) => {
          downloaded += chunk.length;
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;

          if (timeDiff >= 0.5) {
            const bytesDiff = downloaded - lastBytes;
            const speedMbps = (bytesDiff / (1024 * 1024) / timeDiff).toFixed(1);
            const pct = Math.min(99, Math.round((downloaded / totalBytes) * 100));

            activeDownloads.set(modelId, {
              progress: pct,
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
          writer.on("finish", () => {
            fs.renameSync(tempPath, destPath);
            activeDownloads.set(modelId, {
              progress: 100,
              speed: "完成",
              downloadedBytes: totalBytes,
              totalBytes,
            });
            logger.success(`[ModelManager] Successfully downloaded ${meta.name} (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
            success = true;
            resolve();
          });
          writer.on("error", (err) => {
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
            reject(err);
          });
        });
      } catch (err: any) {
        logger.warn(`[ModelManager] Download from ${url} failed: ${err.message}`);
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
      }
    }

    if (!success) {
      activeDownloads.set(modelId, {
        progress: 0,
        speed: "",
        downloadedBytes: 0,
        totalBytes: meta.approxBytes,
        error: "所有镜像下载尝试均失败，请检查网络连接",
      });
      logger.error(`[ModelManager] All mirrors failed for ${meta.name}`);
    }
  })();

  return { success: true, message: "下载已启动" };
}

export function deleteModel(modelId: string): { success: boolean; message: string } {
  const filePath = getModelFilePath(modelId);
  if (!filePath || !fs.existsSync(filePath)) {
    return { success: false, message: "模型文件不存在" };
  }

  try {
    fs.unlinkSync(filePath);
    activeDownloads.delete(modelId);
    logger.info(`[ModelManager] Deleted model ${modelId}`);
    return { success: true, message: "模型已删除" };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
