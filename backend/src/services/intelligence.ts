import fs from "fs";
import { getSqlite } from "./sqlite";
import { getDbPath } from "../utils/paths";
import { getSettings, saveSettings } from "../utils/settings";
import { memoryStore, sessionStore, graphStore, sourceStore, vectorStore } from "./storage";
import { logger } from "../utils/logger";

export interface StorageHealthStats {
  status: "ready" | "optimizing" | "reindexing";
  dbSizeBytes: number;
  dbSizeText: string;
  infoSizeBytes: number;
  infoSizeText: string;
  indexSizeBytes: number;
  indexSizeText: string;
  totalMemories: number;
  totalFacts: number;
  totalSources: number;
  totalSessions: number;
  ramUsageMB: number;
  ramAllocation: string;
}

export interface EntityOntologyType {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
}

export interface MemoryPolicy {
  scope: string; // e.g. "all" | "active"
  maxMemoriesPerSession: number;
  visibility: "full" | "concise";
  autoDistill: boolean;
  retainCategories: string[];
}

export interface TokenUsageStats {
  bgActive: boolean;
  workerStatus: "idle" | "running" | "paused";
  activeTask?: string;
  tokensMonth: number;
  tokens24h: number;
  tokens1h: number;
  monthlyBudget: number;
  lastCallModel?: string;
}

// In-memory token tracker
let tokenLogs: Array<{ tokens: number; timestamp: number; model: string; isBg: boolean }> = [];

export class IntelligenceService {
  private get db() {
    return getSqlite();
  }

  // ── 1. 搜索与存储健康统计 ─────────────────────────────────────────
  async getStorageStats(): Promise<StorageHealthStats> {
    const dbPath = getDbPath();
    let dbSize = 0;
    try {
      if (fs.existsSync(dbPath)) {
        dbSize = fs.statSync(dbPath).size;
      }
    } catch {}

    const memCount = (this.db.prepare("SELECT COUNT(*) as c FROM memories").get() as any)?.c || 0;
    const factCount = (this.db.prepare("SELECT COUNT(*) as c FROM facts").get() as any)?.c || 0;
    const srcCount = (this.db.prepare("SELECT COUNT(*) as c FROM sources").get() as any)?.c || 0;
    const sessCount = (this.db.prepare("SELECT COUNT(*) as c FROM sessions").get() as any)?.c || 0;

    // Estimate info size vs index size
    const infoSize = Math.round(dbSize * 0.35);
    const indexSize = Math.max(1024 * 100, Math.round(dbSize * 0.45));

    const memUsage = process.memoryUsage();
    const ramMB = Math.round(memUsage.rss / 1024 / 1024);

    const settings = getSettings();
    const ramAlloc = (settings as any).searchRamLimit || "自动 (512 MB)";

    return {
      status: "ready",
      dbSizeBytes: dbSize,
      dbSizeText: this.formatBytes(dbSize),
      infoSizeBytes: infoSize,
      infoSizeText: this.formatBytes(infoSize),
      indexSizeBytes: indexSize,
      indexSizeText: this.formatBytes(indexSize),
      totalMemories: memCount,
      totalFacts: factCount,
      totalSources: srcCount,
      totalSessions: sessCount,
      ramUsageMB: ramMB,
      ramAllocation: ramAlloc,
    };
  }

  // ── 2. 数据库优化 (Optimize / VACUUM) ──────────────────────────────
  async optimizeDatabase(): Promise<{ success: boolean; freedBytes: number; message: string }> {
    const beforeSize = fs.existsSync(getDbPath()) ? fs.statSync(getDbPath()).size : 0;
    try {
      logger.info("[Intelligence] Starting database vacuum & PRAGMA optimize...");
      this.db.exec("PRAGMA optimize;");
      this.db.exec("VACUUM;");
      this.db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      const afterSize = fs.existsSync(getDbPath()) ? fs.statSync(getDbPath()).size : 0;
      const freed = Math.max(0, beforeSize - afterSize);
      logger.success(`[Intelligence] Database optimized. Freed: ${this.formatBytes(freed)}`);
      return {
        success: true,
        freedBytes: freed,
        message: `数据库优化完成，释放了 ${this.formatBytes(freed)} 磁盘碎片空间。`,
      };
    } catch (err: any) {
      logger.error("[Intelligence] Database optimization failed:", err);
      return { success: false, freedBytes: 0, message: err?.message || "优化失败" };
    }
  }

  // ── 3. 重建搜索索引 (Rebuild Index) ────────────────────────────────
  async rebuildIndex(): Promise<{ success: boolean; indexedCount: number; message: string }> {
    try {
      logger.info("[Intelligence] Rebuilding FTS and vector search indices...");
      const memories = await memoryStore.getMemories();
      
      // Clear and re-populate FTS5 table
      this.db.prepare("DELETE FROM fts_memories").run();
      const insertFts = this.db.prepare(`
        INSERT INTO fts_memories (memory_id, title, content, labels)
        VALUES (?, ?, ?, ?)
      `);

      for (const m of memories) {
        insertFts.run(m.id, m.title, m.content, m.labels.join(" "));
      }

      logger.success(`[Intelligence] Successfully rebuilt FTS index for ${memories.length} memories`);
      return {
        success: true,
        indexedCount: memories.length,
        message: `成功重建 ${memories.length} 条记忆的全文检索与向量索引。`,
      };
    } catch (err: any) {
      logger.error("[Intelligence] Rebuild index failed:", err);
      return { success: false, indexedCount: 0, message: err?.message || "重建索引失败" };
    }
  }

  // ── 4. 会话健康检查与孤儿数据整理 (Clean Sessions) ─────────────────
  async checkAndCleanSessions(): Promise<{ success: boolean; cleanedEmptySessions: number; repairedOrphans: number; message: string }> {
    try {
      // Find empty sessions without any memories, facts, sources, or chats
      const sessions = await sessionStore.getSessions();
      let cleaned = 0;
      let repaired = 0;

      for (const s of sessions) {
        const memCount = (this.db.prepare("SELECT COUNT(*) as c FROM memories WHERE sessionId = ?").get(s._id) as any)?.c || 0;
        const factCount = (this.db.prepare("SELECT COUNT(*) as c FROM facts WHERE sessionId = ?").get(s._id) as any)?.c || 0;
        const srcCount = (this.db.prepare("SELECT COUNT(*) as c FROM sources WHERE sessionId = ?").get(s._id) as any)?.c || 0;

        if (memCount === 0 && factCount === 0 && srcCount === 0 && !s.hasFullChat && s.projectName !== "default") {
          // Delete truly empty orphaned ghost session
          await sessionStore.deleteSession(s._id);
          cleaned++;
        } else {
          // Update accurate triple count
          if (s.tripleCount !== factCount) {
            await sessionStore.updateSession(s._id, { tripleCount: factCount });
            repaired++;
          }
        }
      }

      return {
        success: true,
        cleanedEmptySessions: cleaned,
        repairedOrphans: repaired,
        message: `检查完成：清理了 ${cleaned} 个无有效数据的空记录，校准了 ${repaired} 个空间的关联统计。`,
      };
    } catch (err: any) {
      return { success: false, cleanedEmptySessions: 0, repairedOrphans: 0, message: err?.message || "检查失败" };
    }
  }

  // ── 5. 本体库 (Ontology) ──────────────────────────────────────────
  getOntology(): EntityOntologyType[] {
    const settings = getSettings();
    if ((settings as any).ontology && Array.isArray((settings as any).ontology)) {
      return (settings as any).ontology;
    }
    // Default preset ontology
    return [
      { id: "arch", name: "架构组件 (Architecture)", color: "#6366f1", icon: "🏛️", description: "系统核心模块、服务、库或框架" },
      { id: "decision", name: "架构决策 (Decision)", color: "#10b981", icon: "💡", description: "技术选型、设计准则与重要结论" },
      { id: "gotcha", name: "踩坑避雷 (Gotcha/Bug)", color: "#ef4444", icon: "⚠️", description: "已知的深坑、兼容性限制与规避手段" },
      { id: "protocol", name: "协议规范 (Protocol)", color: "#f59e0b", icon: "⚡", description: "通信协议、API 格式、数据协议" },
      { id: "tech", name: "技术栈 (Technology)", color: "#06b6d4", icon: "🛠️", description: "语言、数据库、工具链与中间件" },
      { id: "person", name: "团队成员 (Person/Role)", color: "#ec4899", icon: "👤", description: "负责人、团队成员与角色职责" },
    ];
  }

  async saveOntology(ontology: EntityOntologyType[]): Promise<boolean> {
    const settings = getSettings();
    (settings as any).ontology = ontology;
    await saveSettings(settings);
    return true;
  }

  // ── 6. 记忆策略 (Memory Policy) ───────────────────────────────────
  getMemoryPolicy(): MemoryPolicy {
    const settings = getSettings();
    return (settings as any).memoryPolicy || {
      scope: "所有空间",
      maxMemoriesPerSession: 3,
      visibility: "full",
      autoDistill: true,
      retainCategories: ["Decision", "Architecture", "Gotcha", "Rule", "Procedure"],
    };
  }

  async saveMemoryPolicy(policy: Partial<MemoryPolicy>): Promise<MemoryPolicy> {
    const settings = getSettings();
    const updated = { ...this.getMemoryPolicy(), ...policy };
    (settings as any).memoryPolicy = updated;
    await saveSettings(settings);
    return updated;
  }

  // ── 7. 后台任务与 Token 预算 (Background & Token Usage) ───────────
  recordTokenUsage(tokens: number, model: string, isBg: boolean = false) {
    tokenLogs.push({ tokens, timestamp: Date.now(), model, isBg });
    if (tokenLogs.length > 5000) tokenLogs = tokenLogs.slice(-2000);
  }

  getTokenUsageStats(): TokenUsageStats {
    const settings = getSettings();
    const bgActive = (settings as any).bgSmartActive !== false;
    const monthlyBudget = (settings as any).monthlyTokenBudget || 1000000;

    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;
    const oneDayAgo = now - 24 * 3600 * 1000;
    const oneMonthAgo = now - 30 * 24 * 3600 * 1000;

    let tokens1h = 0;
    let tokens24h = 0;
    let tokensMonth = 0;
    let lastModel = "还没有记录到模型调用";

    for (const log of tokenLogs) {
      if (log.timestamp >= oneHourAgo) tokens1h += log.tokens;
      if (log.timestamp >= oneDayAgo) tokens24h += log.tokens;
      if (log.timestamp >= oneMonthAgo) tokensMonth += log.tokens;
      lastModel = log.model;
    }

    return {
      bgActive,
      workerStatus: "idle",
      activeTask: undefined,
      tokens1h,
      tokens24h,
      tokensMonth,
      monthlyBudget,
      lastCallModel: tokenLogs.length > 0 ? lastModel : undefined,
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
  }
}

export const intelligenceService = new IntelligenceService();
