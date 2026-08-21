import { getSqlite } from "./sqlite";
import { getSettings, updateSettings } from "../utils/settings";
import { logger } from "../utils/logger";
import AdmZip from "adm-zip";
import crypto from "crypto";

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
  skills?: any[];
}

export interface MigrationImportResult {
  importedMemories: number;
  importedThreads: number;
  importedMessages: number;
  importedFacts: number;
  importedSources: number;
  importedRelations: number;
  importedCommunities: number;
  importedSkills: number;
}

function parseJsonLines(content: string): any[] {
  if (!content) return [];
  const lines = content.split("\n");
  const items: any[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      items.push(JSON.parse(trimmed));
    } catch {}
  }
  return items;
}

function toJsonLines(items: any[]): string {
  if (!items || items.length === 0) return "";
  return items.map((it) => JSON.stringify(it)).join("\n") + "\n";
}

export class MigrationService {
  private get db() {
    return getSqlite();
  }

  // ── 1. 导出设置备份 (Settings JSON) ──────────────────────────────────
  exportSettingsBackup(): any {
    const settings = getSettings();
    return {
      version: "1.6.3",
      exportedAt: new Date().toISOString(),
      type: "settings_backup",
      settings,
    };
  }

  // ── 2. 导出单文件 JSON 全库备份 ──────────────────────────────────────
  exportKnowledgeBackup(): FullBackupData {
    const sessions = this.db.prepare("SELECT * FROM sessions").all();
    const memories = this.db.prepare("SELECT * FROM memories").all();
    const facts = this.db.prepare("SELECT * FROM facts").all();
    const sources = this.db.prepare("SELECT * FROM sources").all();
    const memoryRelations = this.db.prepare("SELECT * FROM memory_relations").all();
    const communities = this.db.prepare("SELECT * FROM communities").all();
    const workingMemory = this.db.prepare("SELECT * FROM working_memory").all();
    let skills: any[] = [];
    try {
      skills = this.db.prepare("SELECT * FROM skills").all();
    } catch {}

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
      skills,
    };
  }

  // ── 3. 导出标准 NowledgeMem 规范 ZIP 压缩归档 ─────────────────────────
  exportKnowledgeZip(): Buffer {
    const zip = new AdmZip();
    const nowIso = new Date().toISOString();
    const exportId = crypto.randomBytes(4).toString("hex");

    // 1. Fetch data from SQLite
    const sessions = this.db.prepare("SELECT * FROM sessions").all() as any[];
    const memories = this.db.prepare("SELECT * FROM memories").all() as any[];
    const facts = this.db.prepare("SELECT * FROM facts").all() as any[];
    const sources = this.db.prepare("SELECT * FROM sources").all() as any[];
    const memoryRelations = this.db.prepare("SELECT * FROM memory_relations").all() as any[];
    const communities = this.db.prepare("SELECT * FROM communities").all() as any[];
    const fullChats = this.db.prepare("SELECT * FROM full_chats").all() as any[];
    let skills: any[] = [];
    try {
      skills = this.db.prepare("SELECT * FROM skills").all() as any[];
    } catch {}
    const settings = getSettings();

    // 2. Build Nodes Data
    const labelSet = new Set<string>();
    const entityMap = new Map<string, { id: string; name: string; entity_type: string }>();

    // Process Memory Nodes
    const memoryNodes = memories.map((m) => {
      let parsedLabels: string[] = [];
      try {
        if (m.labels) parsedLabels = JSON.parse(m.labels);
      } catch {
        if (typeof m.labels === "string") parsedLabels = m.labels.split(/[, ]+/).filter(Boolean);
      }
      parsedLabels.forEach((l) => labelSet.add(l));

      return {
        id: m.id,
        title: m.title || "Untitled Memory",
        content: m.content || "",
        importance: typeof m.importance === "number" ? m.importance : parseFloat(m.importance) || 0.5,
        confidence: 0.5,
        unit_type: m.unit_type || "context",
        claim_status: m.claim_status || "asserted",
        space_id: m.sessionId || "default",
        source: m.source || "manual",
        source_app: m.source_app || null,
        temporal_context: m.temporal_context || "timeless",
        is_latest: m.is_latest === 1 || m.is_latest === true,
        version: 1,
        created_at: m.createdAt || nowIso,
        updated_at: m.updatedAt || nowIso,
        metadata: JSON.stringify({
          source_app: m.source_app || "desktop",
          tags: m.tags,
          is_pinned: m.is_pinned === 1,
        }),
      };
    });

    // Process Thread Nodes
    const threadNodes = sessions.map((s) => ({
      id: s.id,
      thread_id: s.id,
      title: s.projectName || s.id,
      project: s.projectName || s.id,
      space_id: s.id,
      summary: s.summary || "",
      message_count: s.topicCount || 0,
      source: s.platform || "desktop",
      created_at: s.createdAt || nowIso,
      updated_at: s.updatedAt || nowIso,
    }));

    const threadIdentityNodes = sessions.map((s) => ({
      id: `tid_${s.id}`,
      thread_id: s.id,
      thread_node_id: s.id,
      space_id: s.id,
      source: s.platform || "desktop",
      created_at: s.createdAt || nowIso,
      updated_at: s.updatedAt || nowIso,
    }));

    // Process Facts as Entities & Relationships
    facts.forEach((f) => {
      if (f.subject) {
        entityMap.set(f.subject, { id: `ent_${crypto.createHash("md5").update(f.subject).digest("hex").slice(0, 16)}`, name: f.subject, entity_type: f.subjectType || "Concept" });
      }
      if (f.object) {
        entityMap.set(f.object, { id: `ent_${crypto.createHash("md5").update(f.object).digest("hex").slice(0, 16)}`, name: f.object, entity_type: f.objectType || "Concept" });
      }
    });

    const entityNodes = Array.from(entityMap.values()).map((e) => ({
      id: e.id,
      name: e.name,
      entity_type: e.entity_type,
      created_at: nowIso,
      updated_at: nowIso,
    }));

    // Process Label Nodes
    const labelNodes = Array.from(labelSet).map((l) => ({
      id: `lbl_${crypto.createHash("md5").update(l).digest("hex").slice(0, 16)}`,
      name: l,
      canonical_name: l.toLowerCase(),
      created_at: nowIso,
      updated_at: nowIso,
    }));

    // Process Source Nodes
    const sourceNodes = sources.map((s) => ({
      id: s.id,
      space_id: s.sessionId || "default",
      original_name: s.name,
      source_type: s.source_type || "note",
      source_url: s.url || null,
      file_path: s.filePath || null,
      summary: s.summary || null,
      created_at: s.createdAt || nowIso,
      updated_at: s.updatedAt || nowIso,
    }));

    // Process Skill Nodes
    const skillNodes = skills.map((sk) => ({
      id: sk.id,
      name: sk.name,
      title: sk.name,
      description: sk.description || "",
      kind: sk.category || "workflow",
      bundle_path: sk.sourcePath || "",
      created_at: sk.createdAt || nowIso,
      updated_at: sk.updatedAt || nowIso,
    }));

    // Process Community Nodes
    const communityNodes = communities.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.summary || "",
      member_count: c.member_count || 0,
      created_at: c.createdAt || nowIso,
      updated_at: c.updatedAt || nowIso,
    }));

    // 3. Build Relationships Data
    const hasLabelEdges: any[] = [];
    memories.forEach((m) => {
      let parsedLabels: string[] = [];
      try {
        if (m.labels) parsedLabels = JSON.parse(m.labels);
      } catch {}
      parsedLabels.forEach((l) => {
        hasLabelEdges.push({
          source_id: m.id,
          target_id: `lbl_${crypto.createHash("md5").update(l).digest("hex").slice(0, 16)}`,
          created_at: m.createdAt || nowIso,
        });
      });
    });

    const evolvesEdges = memories
      .filter((m) => !!m.evolves_from_id)
      .map((m) => ({
        source_id: m.id,
        target_id: m.evolves_from_id,
        content_relation: m.evolves_relation || "replaces",
        created_at: m.createdAt || nowIso,
      }));

    const memoryRelatesEdges = memoryRelations.map((r) => ({
      id: r.id,
      source_id: r.source_memory_id,
      target_id: r.target_memory_id,
      relation_type: r.relation_type || "relates_to",
      reason: r.reason || null,
      strength: r.strength ?? 1.0,
      confidence: r.confidence ?? 1.0,
      created_at: r.createdAt || nowIso,
    }));

    const relatesEdges = facts.map((f) => ({
      source_id: entityMap.get(f.subject)?.id || f.subject,
      target_id: entityMap.get(f.object)?.id || f.object,
      relation_type: f.relation || "RELATES_TO",
      space_id: f.sessionId || "default",
      created_at: f.timestamp || nowIso,
    }));

    // 4. Build Content Store (Thread Messages)
    const threadMessages: any[] = [];
    const contentDocs: any[] = [];

    fullChats.forEach((chat) => {
      contentDocs.push({
        content_doc_id: `doc_${chat.sessionId}`,
        owner_kind: "thread",
        owner_id: chat.sessionId,
        space_id: chat.sessionId,
        media_type: "text/plain",
        size_bytes: Buffer.byteLength(chat.rawText || "", "utf-8"),
        created_at: chat.createdAt || nowIso,
      });

      let msgs: any[] = [];
      try {
        msgs = JSON.parse(chat.rawText);
      } catch {
        msgs = [{ role: "user", content: chat.rawText || "" }];
      }

      if (Array.isArray(msgs)) {
        msgs.forEach((msg, idx) => {
          threadMessages.push({
            content_message_id: `msg_${chat.sessionId}_${idx}`,
            message_id: `msg_${chat.sessionId}_${idx}`,
            thread_id: chat.sessionId,
            space_id: chat.sessionId,
            order_index: idx,
            role: msg.role || (idx % 2 === 0 ? "user" : "assistant"),
            content: typeof msg === "string" ? msg : (msg.content || msg.text || JSON.stringify(msg)),
            timestamp: msg.timestamp || chat.createdAt || nowIso,
            created_at: chat.createdAt || nowIso,
            updated_at: chat.createdAt || nowIso,
          });
        });
      }
    });

    // 5. Build Manifest.json
    const manifest = {
      format: "nowledge-mem-export",
      format_version: 3,
      export_id: exportId,
      exported_at: nowIso,
      included: {
        memories: true,
        threads: true,
        messages: true,
        entities: true,
        labels: true,
        sources: true,
        communities: true,
        skills: true,
        edges: true,
        working_memory: true,
        working_memory_archive: true,
        feed_events: true,
        source_files: true,
        ai_now_sessions: false,
        settings: {
          agent_profiles: true,
          rules: true,
          memory_policy: true,
          ontology: true,
        },
      },
      counts: {
        nodes: {
          Thread: threadNodes.length,
          Memory: memoryNodes.length,
          Entity: entityNodes.length,
          Community: communityNodes.length,
          Label: labelNodes.length,
          ThreadIdentity: threadIdentityNodes.length,
          Source: sourceNodes.length,
          Skill: skillNodes.length,
        },
        relationships: {
          EXTRACTED_FROM: 0,
          SYNTHESIZED_FROM: 0,
          HAS_LABEL: hasLabelEdges.length,
          CONTAINS: 0,
          COMPACTS_TO: 0,
          MENTIONS: 0,
          BELONGS_TO: 0,
          EVOLVES: evolvesEdges.length,
          CRYSTALLIZED_FROM: 0,
          RELATES_TO: relatesEdges.length,
          MEMORY_RELATES_TO: memoryRelatesEdges.length,
          SOURCED_FROM: 0,
          REVISED_AS: 0,
        },
        content_store: {
          content_documents: contentDocs.length,
          thread_messages: threadMessages.length,
          content_anchors: 0,
        },
        feed_events: {
          files: 1,
          events: memoryNodes.length,
        },
        skills: {
          bundles: skillNodes.length,
          files: skillNodes.length,
          bytes: 0,
        },
        settings: {
          agent_profiles: 1,
          rules: 1,
          memory_policy: true,
          ontology: true,
        },
      },
    };

    // 6. Build README.md
    const readme = `# Nowledge Mem / ChronosMind Export Archive

Export ID: ${exportId}
Exported At: ${nowIso}
Version: 1.6.3

Contents:
- manifest.json (format version 3 metadata & record counts)
- nodes/*.jsonl (Graph Nodes: Memory, Thread, Entity, Community, Source, Skill, Label)
- relationships/*.jsonl (Graph Edges: EVOLVES, MEMORY_RELATES_TO, RELATES_TO, HAS_LABEL)
- content_store/thread_messages.jsonl (${threadMessages.length} full conversational message turns)
- settings/*.json (Rules, Profiles, Memory Policy, Ontology)
- feed_events/ (Timeline event activities)

Notes:
- Search indexes (FTS5) and vector embeddings are not exported to keep size minimal. Local indexes are automatically generated upon import.
- Compatible with ChronosMind, Nowledge Mem, ArcRift, and all MCP-compliant knowledge engines.
`;

    // 7. Assemble Zip Archive Entries
    zip.addFile("README.md", Buffer.from(readme, "utf-8"));
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));

    // Nodes
    zip.addFile("nodes/Memory.jsonl", Buffer.from(toJsonLines(memoryNodes), "utf-8"));
    zip.addFile("nodes/Thread.jsonl", Buffer.from(toJsonLines(threadNodes), "utf-8"));
    zip.addFile("nodes/ThreadIdentity.jsonl", Buffer.from(toJsonLines(threadIdentityNodes), "utf-8"));
    zip.addFile("nodes/Entity.jsonl", Buffer.from(toJsonLines(entityNodes), "utf-8"));
    zip.addFile("nodes/Label.jsonl", Buffer.from(toJsonLines(labelNodes), "utf-8"));
    zip.addFile("nodes/Community.jsonl", Buffer.from(toJsonLines(communityNodes), "utf-8"));
    zip.addFile("nodes/Source.jsonl", Buffer.from(toJsonLines(sourceNodes), "utf-8"));
    zip.addFile("nodes/Skill.jsonl", Buffer.from(toJsonLines(skillNodes), "utf-8"));

    // Relationships
    zip.addFile("relationships/HAS_LABEL.jsonl", Buffer.from(toJsonLines(hasLabelEdges), "utf-8"));
    zip.addFile("relationships/EVOLVES.jsonl", Buffer.from(toJsonLines(evolvesEdges), "utf-8"));
    zip.addFile("relationships/MEMORY_RELATES_TO.jsonl", Buffer.from(toJsonLines(memoryRelatesEdges), "utf-8"));
    zip.addFile("relationships/RELATES_TO.jsonl", Buffer.from(toJsonLines(relatesEdges), "utf-8"));
    zip.addFile("relationships/EXTRACTED_FROM.jsonl", Buffer.from("", "utf-8"));
    zip.addFile("relationships/SYNTHESIZED_FROM.jsonl", Buffer.from("", "utf-8"));
    zip.addFile("relationships/CONTAINS.jsonl", Buffer.from("", "utf-8"));
    zip.addFile("relationships/COMPACTS_TO.jsonl", Buffer.from("", "utf-8"));
    zip.addFile("relationships/MENTIONS.jsonl", Buffer.from("", "utf-8"));
    zip.addFile("relationships/BELONGS_TO.jsonl", Buffer.from("", "utf-8"));
    zip.addFile("relationships/CRYSTALLIZED_FROM.jsonl", Buffer.from("", "utf-8"));
    zip.addFile("relationships/SOURCED_FROM.jsonl", Buffer.from("", "utf-8"));
    zip.addFile("relationships/REVISED_AS.jsonl", Buffer.from("", "utf-8"));

    // Content Store
    const contentStoreManifest = {
      format: "nowledge-mem-content-store",
      format_version: 1,
      exported_at: nowIso,
      counts: {
        content_documents: contentDocs.length,
        thread_messages: threadMessages.length,
        content_anchors: 0,
      },
    };
    zip.addFile("content_store/manifest.json", Buffer.from(JSON.stringify(contentStoreManifest, null, 2), "utf-8"));
    zip.addFile("content_store/thread_messages.jsonl", Buffer.from(toJsonLines(threadMessages), "utf-8"));
    zip.addFile("content_store/content_documents.jsonl", Buffer.from(toJsonLines(contentDocs), "utf-8"));
    zip.addFile("content_store/content_anchors.jsonl", Buffer.from("", "utf-8"));

    // Settings
    zip.addFile("settings/agent_profiles.json", Buffer.from(JSON.stringify(settings?.agentProfiles || {}, null, 2), "utf-8"));
    zip.addFile("settings/rules.json", Buffer.from(JSON.stringify(settings?.rules || {}, null, 2), "utf-8"));
    zip.addFile("settings/ontology.json", Buffer.from(JSON.stringify(settings?.ontology || [], null, 2), "utf-8"));
    zip.addFile("settings/memory_policy.json", Buffer.from(JSON.stringify(settings?.memoryPolicy || {}, null, 2), "utf-8"));

    // Feed Events (Year / Month partition)
    const year = nowIso.slice(0, 4);
    const month = nowIso.slice(5, 7);
    const feedEvents = memoryNodes.map((m) => ({
      event_id: `ev_${m.id}`,
      event_type: "memory_created",
      target_id: m.id,
      title: m.title,
      timestamp: m.created_at,
    }));
    zip.addFile(`feed_events/${year}/${month}/feed_events.jsonl`, Buffer.from(toJsonLines(feedEvents), "utf-8"));

    logger.success(`[Migration] Knowledge ZIP archive generated (${memoryNodes.length} memories, ${threadNodes.length} threads, ${threadMessages.length} messages)`);
    return zip.toBuffer();
  }

  // ── 4. 恢复设置 ────────────────────────────────────────────────────
  importSettingsBackup(data: any): boolean {
    if (!data || !data.settings) throw new Error("无效的设置备份文件格式");
    updateSettings(data.settings);
    logger.success("[Migration] Settings restored successfully");
    return true;
  }

  // ── 5. 恢复知识全库 (JSON 格式) ────────────────────────────────────
  importKnowledgeBackup(data: FullBackupData, mode: "merge" | "skip" | "replace" = "merge"): MigrationImportResult {
    if (!data) throw new Error("无效的知识库备份文件");

    let memCount = 0;
    let threadCount = 0;
    let factCount = 0;
    let srcCount = 0;
    let relCount = 0;
    let comCount = 0;
    let skillCount = 0;

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
        try { this.db.prepare("DELETE FROM skills").run(); } catch {}
        this.db.prepare("DELETE FROM sessions WHERE projectName != 'default'").run();
      }

      // 1. Sessions / Threads
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
              projectName: s.projectName || s.title || s.id,
              platform: s.platform || "desktop",
              tripleCount: s.tripleCount || 0,
              topicCount: s.topicCount || 0,
              hasFullChat: s.hasFullChat ? 1 : 0,
              tokensSaved: s.tokensSaved || 0,
              retrievalCount: s.retrievalCount || 0,
              createdAt: s.createdAt || new Date().toISOString(),
              updatedAt: s.updatedAt || new Date().toISOString(),
            });
            threadCount++;
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
            const sid = m.sessionId || m.space_id || "default";
            ensureSessionStmt.run(sid, sid, new Date().toISOString(), new Date().toISOString());

            const row = {
              id: m.id,
              sessionId: sid,
              title: m.title || "Untitled Memory",
              content: m.content || "",
              importance: typeof m.importance === "number" ? m.importance : parseFloat(m.importance) || 0.5,
              category: m.category || "Note",
              unit_type: m.unit_type || "context",
              labels: Array.isArray(m.labels) ? JSON.stringify(m.labels) : (m.labels || null),
              tags: m.tags || null,
              claim_status: m.claim_status || "asserted",
              evolves_from_id: m.evolves_from_id || m.evolvesFromId || null,
              evolves_relation: m.evolves_relation || m.evolvesRelation || null,
              is_latest: m.is_latest === false ? 0 : 1,
              source: m.source || "manual",
              source_app: m.source_app || null,
              temporal_context: m.temporal_context || "timeless",
              createdAt: m.createdAt || m.created_at || new Date().toISOString(),
              updatedAt: m.updatedAt || m.updated_at || new Date().toISOString(),
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
              name: s.name || s.original_name || "Untitled Source",
              source_type: s.source_type || s.sourceType || "note",
              url: s.url || s.source_url || null,
              filePath: s.filePath || s.file_path || null,
              summary: s.summary || null,
              rawContent: s.rawContent || null,
              labels: Array.isArray(s.labels) ? JSON.stringify(s.labels) : (s.labels || null),
              lifecycle_state: s.lifecycle_state || "indexed",
              metadata: s.metadata ? (typeof s.metadata === "object" ? JSON.stringify(s.metadata) : s.metadata) : null,
              createdAt: s.createdAt || s.created_at || new Date().toISOString(),
              updatedAt: s.updatedAt || s.updated_at || new Date().toISOString(),
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
              source_memory_id: r.source_memory_id || r.sourceMemoryId || r.source_id,
              target_memory_id: r.target_memory_id || r.targetMemoryId || r.target_id,
              relation_type: r.relation_type || r.relationType || "relates_to",
              reason: r.reason || null,
              strength: r.strength ?? (r.weight ?? 1.0),
              confidence: r.confidence ?? 1.0,
              bidirectional: r.bidirectional ? 1 : 0,
              status: r.status || "active",
              createdAt: r.createdAt || r.created_at || new Date().toISOString(),
              updatedAt: r.updatedAt || r.updated_at || new Date().toISOString(),
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
              summary: c.summary || c.description || null,
              member_count: c.member_count ?? (c.memberCount ?? 0),
              member_entities: Array.isArray(c.member_entities) ? JSON.stringify(c.member_entities) : (c.member_entities || c.memberEntities || null),
              createdAt: c.createdAt || c.created_at || new Date().toISOString(),
              updatedAt: c.updatedAt || c.updated_at || new Date().toISOString(),
            };
            const res = stmt.run(row);
            if (res.changes > 0) comCount++;
          } catch {}
        }
      }

      // 7. Skills
      if (Array.isArray(data.skills)) {
        try {
          const stmt = this.db.prepare(`
            INSERT INTO skills (id, name, description, trigger, steps, sourceTool, sourcePath, enabled, tools, category, rawMarkdown, createdAt, updatedAt)
            VALUES (@id, @name, @description, @trigger, @steps, @sourceTool, @sourcePath, @enabled, @tools, @category, @rawMarkdown, @createdAt, @updatedAt)
            ON CONFLICT(id) DO UPDATE SET description = excluded.description, updatedAt = excluded.updatedAt
          `);
          for (const sk of data.skills) {
            stmt.run({
              id: sk.id,
              name: sk.name || sk.title || "Untitled Skill",
              description: sk.description || "",
              trigger: sk.trigger || null,
              steps: sk.steps || null,
              sourceTool: sk.sourceTool || null,
              sourcePath: sk.sourcePath || sk.bundle_path || null,
              enabled: sk.enabled === 0 ? 0 : 1,
              tools: Array.isArray(sk.tools) ? JSON.stringify(sk.tools) : (sk.tools || null),
              category: sk.category || sk.kind || "workflow",
              rawMarkdown: sk.rawMarkdown || null,
              createdAt: sk.createdAt || sk.created_at || new Date().toISOString(),
              updatedAt: sk.updatedAt || sk.updated_at || new Date().toISOString(),
            });
            skillCount++;
          }
        } catch {}
      }
    });

    tx();

    logger.success(`[Migration] JSON Import finished (${mode}): memories=${memCount}, threads=${threadCount}, facts=${factCount}`);
    return {
      importedMemories: memCount,
      importedThreads: threadCount,
      importedMessages: 0,
      importedFacts: factCount,
      importedSources: srcCount,
      importedRelations: relCount,
      importedCommunities: comCount,
      importedSkills: skillCount,
    };
  }

  // ── 6. 恢复标准 NowledgeMem 规范 ZIP 压缩归档 ─────────────────────────
  importKnowledgeZip(zipBuffer: Buffer, mode: "merge" | "skip" | "replace" = "merge"): MigrationImportResult {
    if (!zipBuffer || zipBuffer.length === 0) {
      throw new Error("无效或空的 Zip 备份文件");
    }

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    const entryMap = new Map<string, AdmZip.IZipEntry>();
    entries.forEach((e) => entryMap.set(e.entryName.replace(/\\/g, "/"), e));

    // Check if it is a single-file JSON backup packaged in zip
    const backupJsonEntry = entryMap.get("nowledge-mem-backup.json") || entryMap.get("nowledge-mem-knowledge-backup.json");
    if (backupJsonEntry && !entryMap.has("manifest.json")) {
      const jsonContent = backupJsonEntry.getData().toString("utf-8");
      return this.importKnowledgeBackup(JSON.parse(jsonContent), mode);
    }

    // NowledgeMem standard manifest
    const manifestEntry = entryMap.get("manifest.json");
    if (!manifestEntry) {
      // Look for any root json file
      const rootJson = entries.find((e) => e.entryName.endsWith(".json") && !e.entryName.includes("/"));
      if (rootJson) {
        const jsonContent = rootJson.getData().toString("utf-8");
        return this.importKnowledgeBackup(JSON.parse(jsonContent), mode);
      }
      throw new Error("Zip 文件中未找到 manifest.json 规范清单");
    }

    let memCount = 0;
    let threadCount = 0;
    let msgCount = 0;
    let factCount = 0;
    let srcCount = 0;
    let relCount = 0;
    let comCount = 0;
    let skillCount = 0;

    // Parse nodes
    const memoryNodes = parseJsonLines(entryMap.get("nodes/Memory.jsonl")?.getData().toString("utf-8") || "");
    const threadNodes = parseJsonLines(entryMap.get("nodes/Thread.jsonl")?.getData().toString("utf-8") || "");
    const sourceNodes = parseJsonLines(entryMap.get("nodes/Source.jsonl")?.getData().toString("utf-8") || "");
    const skillNodes = parseJsonLines(entryMap.get("nodes/Skill.jsonl")?.getData().toString("utf-8") || "");
    const communityNodes = parseJsonLines(entryMap.get("nodes/Community.jsonl")?.getData().toString("utf-8") || "");
    const entityNodes = parseJsonLines(entryMap.get("nodes/Entity.jsonl")?.getData().toString("utf-8") || "");

    // Parse relationships
    const memoryRelations = parseJsonLines(entryMap.get("relationships/MEMORY_RELATES_TO.jsonl")?.getData().toString("utf-8") || "");
    const evolvesRelations = parseJsonLines(entryMap.get("relationships/EVOLVES.jsonl")?.getData().toString("utf-8") || "");
    const relatesRelations = parseJsonLines(entryMap.get("relationships/RELATES_TO.jsonl")?.getData().toString("utf-8") || "");

    // Parse content store
    const threadMessages = parseJsonLines(entryMap.get("content_store/thread_messages.jsonl")?.getData().toString("utf-8") || "");

    const entityNameMap = new Map<string, string>();
    entityNodes.forEach((e) => entityNameMap.set(e.id, e.name || e.id));

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
        this.db.prepare("DELETE FROM full_chats").run();
        try { this.db.prepare("DELETE FROM skills").run(); } catch {}
        this.db.prepare("DELETE FROM sessions WHERE projectName != 'default'").run();
      }

      // 1. Threads -> Sessions
      const sessionStmt = this.db.prepare(`
        INSERT INTO sessions (id, projectName, platform, tripleCount, topicCount, hasFullChat, tokensSaved, retrievalCount, createdAt, updatedAt)
        VALUES (@id, @projectName, @platform, @tripleCount, @topicCount, @hasFullChat, @tokensSaved, @retrievalCount, @createdAt, @updatedAt)
        ON CONFLICT(id) DO UPDATE SET
          projectName = excluded.projectName,
          updatedAt = excluded.updatedAt
      `);

      for (const t of threadNodes) {
        try {
          sessionStmt.run({
            id: t.id || t.thread_id || "default",
            projectName: t.project || t.title || t.id,
            platform: t.source || "desktop",
            tripleCount: 0,
            topicCount: t.message_count || 0,
            hasFullChat: 1,
            tokensSaved: 0,
            retrievalCount: 0,
            createdAt: t.created_at || new Date().toISOString(),
            updatedAt: t.updated_at || new Date().toISOString(),
          });
          threadCount++;
        } catch {}
      }

      // 2. Memory Nodes -> Memories + FTS5
      const memStmt = this.db.prepare(`
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

      for (const m of memoryNodes) {
        try {
          const sid = m.space_id || m.sessionId || "default";
          ensureSessionStmt.run(sid, sid, new Date().toISOString(), new Date().toISOString());

          let labelsArr: string[] = [];
          if (Array.isArray(m.labels)) labelsArr = m.labels;
          else if (typeof m.labels === "string") {
            try { labelsArr = JSON.parse(m.labels); } catch { labelsArr = [m.labels]; }
          }

          const row = {
            id: m.id,
            sessionId: sid,
            title: m.title || "Untitled Memory",
            content: m.content || "",
            importance: typeof m.importance === "number" ? m.importance : parseFloat(m.importance) || 0.5,
            category: m.category || "Note",
            unit_type: m.unit_type || "context",
            labels: JSON.stringify(labelsArr),
            tags: JSON.stringify(labelsArr),
            claim_status: m.claim_status || "asserted",
            evolves_from_id: m.evolves_from_id || null,
            evolves_relation: m.evolves_relation || null,
            is_latest: m.is_latest === false ? 0 : 1,
            source: m.source || "manual",
            source_app: m.source_app || null,
            temporal_context: m.temporal_context || "timeless",
            createdAt: m.created_at || m.createdAt || new Date().toISOString(),
            updatedAt: m.updated_at || m.updatedAt || new Date().toISOString(),
          };

          const res = memStmt.run(row);
          if (res.changes > 0) {
            memCount++;
            ftsStmt.run(m.id, m.title, m.content, labelsArr.join(" "));
          }
        } catch (err) {
          logger.warn(`Failed to import memory node: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 3. Thread Messages -> full_chats
      if (threadMessages.length > 0) {
        const messagesByThread = new Map<string, any[]>();
        for (const msg of threadMessages) {
          const tid = msg.thread_id || msg.space_id || "default";
          if (!messagesByThread.has(tid)) messagesByThread.set(tid, []);
          messagesByThread.get(tid)!.push(msg);
          msgCount++;
        }

        const chatStmt = this.db.prepare(`
          INSERT INTO full_chats (sessionId, rawText, processedText, messageCount, platform, createdAt)
          VALUES (@sessionId, @rawText, @processedText, @messageCount, @platform, @createdAt)
          ON CONFLICT(sessionId) DO UPDATE SET rawText = excluded.rawText, messageCount = excluded.messageCount
        `);

        for (const [tid, msgs] of messagesByThread.entries()) {
          try {
            ensureSessionStmt.run(tid, tid, new Date().toISOString(), new Date().toISOString());
            chatStmt.run({
              sessionId: tid,
              rawText: JSON.stringify(msgs),
              processedText: msgs.map((m) => `${m.role || 'user'}: ${m.content}`).join("\n\n"),
              messageCount: msgs.length,
              platform: "desktop",
              createdAt: msgs[0]?.created_at || new Date().toISOString(),
            });
          } catch {}
        }
      }

      // 4. Relationships -> memory_relations & facts
      const relStmt = this.db.prepare(`
        INSERT INTO memory_relations (id, source_memory_id, target_memory_id, relation_type, reason, strength, confidence, bidirectional, status, createdAt, updatedAt)
        VALUES (@id, @source_memory_id, @target_memory_id, @relation_type, @reason, @strength, @confidence, @bidirectional, @status, @createdAt, @updatedAt)
        ON CONFLICT(id) DO NOTHING
      `);
      for (const r of memoryRelations) {
        try {
          relStmt.run({
            id: r.id || `rel_${crypto.randomUUID()}`,
            source_memory_id: r.source_id || r.source_memory_id,
            target_memory_id: r.target_id || r.target_memory_id,
            relation_type: r.relation_type || "relates_to",
            reason: r.reason || null,
            strength: r.strength ?? 1.0,
            confidence: r.confidence ?? 1.0,
            bidirectional: r.bidirectional ? 1 : 0,
            status: "active",
            createdAt: r.created_at || new Date().toISOString(),
            updatedAt: r.updated_at || new Date().toISOString(),
          });
          relCount++;
        } catch {}
      }

      const factStmt = this.db.prepare(`
        INSERT INTO facts (sessionId, subject, subjectType, relation, object, objectType, timestamp)
        VALUES (@sessionId, @subject, @subjectType, @relation, @object, @objectType, @timestamp)
      `);
      for (const rel of relatesRelations) {
        try {
          const subName = entityNameMap.get(rel.source_id) || rel.source_id;
          const objName = entityNameMap.get(rel.target_id) || rel.target_id;
          factStmt.run({
            sessionId: rel.space_id || "default",
            subject: subName,
            subjectType: "Concept",
            relation: rel.relation_type || "RELATES_TO",
            object: objName,
            objectType: "Concept",
            timestamp: rel.created_at || new Date().toISOString(),
          });
          factCount++;
        } catch {}
      }

      // 5. Sources
      const srcStmt = this.db.prepare(`
        INSERT INTO sources (id, sessionId, name, source_type, url, filePath, summary, rawContent, labels, lifecycle_state, metadata, createdAt, updatedAt)
        VALUES (@id, @sessionId, @name, @source_type, @url, @filePath, @summary, @rawContent, @labels, @lifecycle_state, @metadata, @createdAt, @updatedAt)
        ON CONFLICT(id) DO ${mode === "skip" ? "NOTHING" : "UPDATE SET summary = excluded.summary, updatedAt = excluded.updatedAt"}
      `);
      for (const s of sourceNodes) {
        try {
          srcStmt.run({
            id: s.id,
            sessionId: s.space_id || "default",
            name: s.original_name || s.name || "Untitled Source",
            source_type: s.source_type || "note",
            url: s.source_url || null,
            filePath: s.file_path || null,
            summary: s.summary || null,
            rawContent: null,
            labels: null,
            lifecycle_state: "indexed",
            metadata: null,
            createdAt: s.created_at || new Date().toISOString(),
            updatedAt: s.updated_at || new Date().toISOString(),
          });
          srcCount++;
        } catch {}
      }

      // 6. Skills
      try {
        const skillStmt = this.db.prepare(`
          INSERT INTO skills (id, name, description, trigger, steps, sourceTool, sourcePath, enabled, tools, category, rawMarkdown, createdAt, updatedAt)
          VALUES (@id, @name, @description, @trigger, @steps, @sourceTool, @sourcePath, @enabled, @tools, @category, @rawMarkdown, @createdAt, @updatedAt)
          ON CONFLICT(id) DO UPDATE SET description = excluded.description, updatedAt = excluded.updatedAt
        `);
        for (const sk of skillNodes) {
          try {
            skillStmt.run({
              id: sk.id,
              name: sk.name || sk.title || "Untitled Skill",
              description: sk.description || "",
              trigger: null,
              steps: null,
              sourceTool: null,
              sourcePath: sk.bundle_path || null,
              enabled: 1,
              tools: null,
              category: sk.kind || "workflow",
              rawMarkdown: null,
              createdAt: sk.created_at || new Date().toISOString(),
              updatedAt: sk.updated_at || new Date().toISOString(),
            });
            skillCount++;
          } catch {}
        }
      } catch {}

      // 7. Communities
      const comStmt = this.db.prepare(`
        INSERT INTO communities (id, sessionId, name, summary, member_count, member_entities, createdAt, updatedAt)
        VALUES (@id, @sessionId, @name, @summary, @member_count, @member_entities, @createdAt, @updatedAt)
        ON CONFLICT(id) DO NOTHING
      `);
      for (const c of communityNodes) {
        try {
          comStmt.run({
            id: c.id,
            sessionId: "default",
            name: c.name || "Community",
            summary: c.description || null,
            member_count: c.member_count || 0,
            member_entities: null,
            createdAt: c.created_at || new Date().toISOString(),
            updatedAt: c.updated_at || new Date().toISOString(),
          });
          comCount++;
        } catch {}
      }
    });

    tx();

    logger.success(
      `[Migration] ZIP Archive restored (${mode}): memories=${memCount}, threads=${threadCount}, messages=${msgCount}, facts=${factCount}, sources=${srcCount}, skills=${skillCount}`
    );

    return {
      importedMemories: memCount,
      importedThreads: threadCount,
      importedMessages: msgCount,
      importedFacts: factCount,
      importedSources: srcCount,
      importedRelations: relCount,
      importedCommunities: comCount,
      importedSkills: skillCount,
    };
  }
}

export const migrationService = new MigrationService();
