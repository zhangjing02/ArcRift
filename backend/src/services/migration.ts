import { getSqlite } from "./sqlite";
import { getSettings, updateSettings } from "../utils/settings";
import { logger } from "../utils/logger";
import { getDbPath } from "../utils/paths";
import fs from "fs";

export interface FullBackupData {
  version: string;
  exportedAt: string;
  settings: any;
  sessions: any[];
  memories: any[];
  facts: any[];
  sources: any[];
  memoryRelations: any[];
  communities: any[];
  workingMemory: any[];
}

export class MigrationService {
  private get db() {
    return getSqlite();
  }

  // ── 1. 导出设置备份 ────────────────────────────────────────────────
  exportSettingsBackup(): any {
    const settings = getSettings();
    return {
      version: "1.6.3",
      exportedAt: new Date().toISOString(),
      type: "settings_backup",
      settings,
    };
  }

  // ── 2. 导出知识全库备份 ────────────────────────────────────────────
  exportKnowledgeBackup(): FullBackupData {
    const sessions = this.db.prepare("SELECT * FROM sessions").all();
    const memories = this.db.prepare("SELECT * FROM memories").all();
    const facts = this.db.prepare("SELECT * FROM facts").all();
    const sources = this.db.prepare("SELECT * FROM sources").all();
    const memoryRelations = this.db.prepare("SELECT * FROM memory_relations").all();
    const communities = this.db.prepare("SELECT * FROM communities").all();
    const workingMemory = this.db.prepare("SELECT * FROM working_memory").all();

    return {
      version: "1.6.3",
      exportedAt: new Date().toISOString(),
      settings: getSettings(),
      sessions,
      memories,
      facts,
      sources,
      memoryRelations,
      communities,
      workingMemory,
    };
  }

  // ── 3. 恢复设置 ────────────────────────────────────────────────────
  importSettingsBackup(data: any): boolean {
    if (!data || !data.settings) throw new Error("无效的设置备份文件格式");
    updateSettings(data.settings);
    logger.success("[Migration] Settings restored successfully");
    return true;
  }

  // ── 4. 恢复知识库数据 (支持 merge | skip | replace) ────────────────
  importKnowledgeBackup(data: FullBackupData, mode: "merge" | "skip" | "replace" = "merge"): {
    importedMemories: number;
    importedFacts: number;
    importedSources: number;
    importedRelations: number;
    importedCommunities: number;
  } {
    if (!data) throw new Error("无效的知识库备份文件");

    let memCount = 0;
    let factCount = 0;
    let srcCount = 0;
    let relCount = 0;
    let comCount = 0;

    const tx = this.db.transaction(() => {
      if (mode === "replace") {
        logger.warn("[Migration] Replace mode: clearing existing database tables...");
        this.db.prepare("DELETE FROM memory_relations").run();
        this.db.prepare("DELETE FROM communities").run();
        this.db.prepare("DELETE FROM sources").run();
        this.db.prepare("DELETE FROM facts").run();
        this.db.prepare("DELETE FROM fts_memories").run();
        this.db.prepare("DELETE FROM memories").run();
        this.db.prepare("DELETE FROM working_memory").run();
        this.db.prepare("DELETE FROM sessions WHERE projectName != 'default'").run();
      }

      // 1. Sessions
      if (Array.isArray(data.sessions)) {
        const stmt = this.db.prepare(`
          INSERT INTO sessions (id, projectName, platform, tripleCount, topicCount, hasFullChat, tokensSaved, retrievalCount, createdAt, updatedAt)
          VALUES (@id, @projectName, @platform, @tripleCount, @topicCount, @hasFullChat, @tokensSaved, @retrievalCount, @createdAt, @updatedAt)
          ON CONFLICT(id) DO UPDATE SET
            projectName = excluded.projectName,
            tripleCount = excluded.tripleCount,
            updatedAt = excluded.updatedAt
        `);
        for (const s of data.sessions) {
          try {
            stmt.run({
              ...s,
              id: s.id || s._id || "default",
            });
          } catch {}
        }
      }

      // 2. Memories
      if (Array.isArray(data.memories)) {
        const stmt = this.db.prepare(`
          INSERT INTO memories (id, sessionId, title, content, importance, category, unit_type, labels, tags, claim_status, evolves_from_id, evolves_relation, is_latest, source, source_app, temporal_context, createdAt, updatedAt)
          VALUES (@id, @sessionId, @title, @content, @importance, @category, @unit_type, @labels, @tags, @claim_status, @evolves_from_id, @evolves_relation, @is_latest, @source, @source_app, @temporal_context, @createdAt, @updatedAt)
          ON CONFLICT(id) DO ${mode === "skip" ? "NOTHING" : "UPDATE SET title = excluded.title, content = excluded.content, updatedAt = excluded.updatedAt"}
        `);
        const ftsStmt = this.db.prepare(`
          INSERT OR REPLACE INTO fts_memories (memory_id, title, content, labels)
          VALUES (?, ?, ?, ?)
        `);

        const ensureSessionStmt = this.db.prepare(`
          INSERT OR IGNORE INTO sessions (id, projectName, createdAt, updatedAt)
          VALUES (?, ?, ?, ?)
        `);

        for (const m of data.memories) {
          try {
            const sid = m.sessionId || "default";
            ensureSessionStmt.run(sid, sid, new Date().toISOString(), new Date().toISOString());

            const row = {
              id: m.id,
              sessionId: sid,
              title: m.title || "Untitled Memory",
              content: m.content || "",
              importance: m.importance ?? 0.5,
              category: m.category || "Note",
              unit_type: m.unit_type || "context",
              labels: Array.isArray(m.labels) ? JSON.stringify(m.labels) : (m.labels || null),
              tags: m.tags || null,
              claim_status: m.claim_status || "asserted",
              evolves_from_id: m.evolves_from_id || null,
              evolves_relation: m.evolves_relation || null,
              is_latest: m.is_latest ?? 1,
              source: m.source || "manual",
              source_app: m.source_app || null,
              temporal_context: m.temporal_context || "timeless",
              createdAt: m.createdAt || new Date().toISOString(),
              updatedAt: m.updatedAt || new Date().toISOString(),
            };

            const res = stmt.run(row);
            if (res.changes > 0) {
              memCount++;
              const labelsStr = Array.isArray(m.labels) ? m.labels.join(" ") : (m.labels || "");
              ftsStmt.run(m.id, m.title, m.content, labelsStr);
            }
          } catch (err) {
            logger.warn(`Failed to import memory item: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // 3. Facts (Triples)
      if (Array.isArray(data.facts)) {
        const stmt = this.db.prepare(`
          INSERT INTO facts (sessionId, subject, subjectType, relation, object, objectType, timestamp)
          VALUES (@sessionId, @subject, @subjectType, @relation, @object, @objectType, @timestamp)
        `);
        for (const f of data.facts) {
          try {
            stmt.run({
              sessionId: f.sessionId || "default",
              subject: f.subject,
              subjectType: f.subjectType || "Concept",
              relation: f.relation,
              object: f.object,
              objectType: f.objectType || "Concept",
              timestamp: f.timestamp || f.createdAt || new Date().toISOString(),
            });
            factCount++;
          } catch {}
        }
      }

      // 4. Sources
      if (Array.isArray(data.sources)) {
        const stmt = this.db.prepare(`
          INSERT INTO sources (id, sessionId, name, source_type, url, filePath, summary, rawContent, labels, lifecycle_state, metadata, createdAt, updatedAt)
          VALUES (@id, @sessionId, @name, @source_type, @url, @filePath, @summary, @rawContent, @labels, @lifecycle_state, @metadata, @createdAt, @updatedAt)
          ON CONFLICT(id) DO ${mode === "skip" ? "NOTHING" : "UPDATE SET summary = excluded.summary, updatedAt = excluded.updatedAt"}
        `);
        for (const s of data.sources) {
          try {
            const row = {
              id: s.id,
              sessionId: s.sessionId || "default",
              name: s.name || "Untitled Source",
              source_type: s.source_type || s.sourceType || "note",
              url: s.url || null,
              filePath: s.filePath || null,
              summary: s.summary || null,
              rawContent: s.rawContent || null,
              labels: Array.isArray(s.labels) ? JSON.stringify(s.labels) : (s.labels || null),
              lifecycle_state: s.lifecycle_state || "indexed",
              metadata: s.metadata ? (typeof s.metadata === "object" ? JSON.stringify(s.metadata) : s.metadata) : null,
              createdAt: s.createdAt || new Date().toISOString(),
              updatedAt: s.updatedAt || new Date().toISOString(),
            };
            const res = stmt.run(row);
            if (res.changes > 0) srcCount++;
          } catch {}
        }
      }

      // 5. Memory Relations
      if (Array.isArray(data.memoryRelations)) {
        const stmt = this.db.prepare(`
          INSERT INTO memory_relations (id, source_memory_id, target_memory_id, relation_type, reason, strength, confidence, bidirectional, status, createdAt, updatedAt)
          VALUES (@id, @source_memory_id, @target_memory_id, @relation_type, @reason, @strength, @confidence, @bidirectional, @status, @createdAt, @updatedAt)
          ON CONFLICT(id) DO NOTHING
        `);
        for (const r of data.memoryRelations) {
          try {
            const row = {
              id: r.id,
              source_memory_id: r.source_memory_id || r.sourceMemoryId,
              target_memory_id: r.target_memory_id || r.targetMemoryId,
              relation_type: r.relation_type || r.relationType || "relates_to",
              reason: r.reason || null,
              strength: r.strength ?? (r.weight ?? 1.0),
              confidence: r.confidence ?? 1.0,
              bidirectional: r.bidirectional ? 1 : 0,
              status: r.status || "active",
              createdAt: r.createdAt || new Date().toISOString(),
              updatedAt: r.updatedAt || new Date().toISOString(),
            };
            const res = stmt.run(row);
            if (res.changes > 0) relCount++;
          } catch {}
        }
      }

      // 6. Communities
      if (Array.isArray(data.communities)) {
        const stmt = this.db.prepare(`
          INSERT INTO communities (id, sessionId, name, summary, member_count, member_entities, createdAt, updatedAt)
          VALUES (@id, @sessionId, @name, @summary, @member_count, @member_entities, @createdAt, @updatedAt)
          ON CONFLICT(id) DO NOTHING
        `);
        for (const c of data.communities) {
          try {
            const row = {
              id: c.id,
              sessionId: c.sessionId || "default",
              name: c.name,
              summary: c.summary || null,
              member_count: c.member_count ?? (c.memberCount ?? 0),
              member_entities: Array.isArray(c.member_entities) ? JSON.stringify(c.member_entities) : (c.member_entities || c.memberEntities || null),
              createdAt: c.createdAt || new Date().toISOString(),
              updatedAt: c.updatedAt || new Date().toISOString(),
            };
            const res = stmt.run(row);
            if (res.changes > 0) comCount++;
          } catch {}
        }
      }
    });

    tx();

    logger.success(`[Migration] Import finished (${mode}): memories=${memCount}, facts=${factCount}, sources=${srcCount}`);
    return {
      importedMemories: memCount,
      importedFacts: factCount,
      importedSources: srcCount,
      importedRelations: relCount,
      importedCommunities: comCount,
    };
  }
}

export const migrationService = new MigrationService();
