import { getSqlite } from "./sqlite";
import {
  IMemoryStore,
  Memory,
  WorkingMemory,
  MemorySearchFilters,
  UnitType,
  ClaimStatus,
  EvolvesRelation,
} from "./storage.types";
import { v4 as uuidv4 } from "uuid";

function normalizeImportance(val: any): number {
  if (typeof val === "number") {
    return Math.max(0.1, Math.min(1.0, val));
  }
  if (typeof val === "string") {
    switch (val.toLowerCase()) {
      case "critical":
        return 1.0;
      case "high":
        return 0.8;
      case "medium":
        return 0.5;
      case "low":
        return 0.2;
      default:
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0.5 : Math.max(0.1, Math.min(1.0, parsed));
    }
  }
  return 0.5;
}

export class SqliteMemoryStore implements IMemoryStore {
  private get db() {
    return getSqlite();
  }

  private mapMemory(row: any): Memory {
    let parsedLabels: string[] = [];
    try {
      if (row.labels) parsedLabels = JSON.parse(row.labels);
    } catch {}

    let parsedTags: string[] = [];
    try {
      if (row.tags) parsedTags = JSON.parse(row.tags);
    } catch {}

    const mergedLabels = Array.from(new Set([...parsedLabels, ...parsedTags]));

    // Auto-detect project tag from bracket prefix in title [Project]
    const titleMatch = (row.title || "").match(/^\[([^\]]+)\]/);
    if (titleMatch) {
      const pTag = titleMatch[1].trim();
      if (pTag && !mergedLabels.some(l => l.toLowerCase() === pTag.toLowerCase())) {
        mergedLabels.unshift(pTag);
      }
    }

    if (row.sessionId && row.sessionId !== "default" && row.sessionId !== "singleton") {
      const sTag = row.sessionId.replace(/^(test_|sess_)/, "");
      if (sTag && !mergedLabels.some(l => l.toLowerCase() === sTag.toLowerCase())) {
        mergedLabels.unshift(sTag);
      }
    }

    return {
      id: row.id,
      sessionId: row.sessionId,
      title: row.title,
      content: row.content,
      importance: typeof row.importance === "number" ? row.importance : normalizeImportance(row.importance),
      category: row.category || "Note",
      unitType: (row.unit_type || "context") as UnitType,
      labels: mergedLabels,
      tags: mergedLabels,
      claimStatus: (row.claim_status || "asserted") as ClaimStatus,
      evolvesFromId: row.evolves_from_id || undefined,
      evolvesRelation: row.evolves_relation ? (row.evolves_relation as EvolvesRelation) : undefined,
      isLatest: row.is_latest === 1 || row.is_latest === true,
      source: row.source || "manual",
      sourceApp: row.source_app || undefined,
      temporalContext: row.temporal_context || "timeless",
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async createMemory(memory: Partial<Memory> & { content: string; sessionId?: string; spaceId?: string }): Promise<Memory> {
    const id = memory.id || `mem_${uuidv4()}`;
    const now = new Date().toISOString();
    const sessionId = memory.sessionId || memory.spaceId || "default";
    const importance = normalizeImportance(memory.importance);
    const category = memory.category || "Note";
    const unitType = memory.unitType || "context";
    // Auto-detect and prepend Project label (First-order priority)
    const rawLabels = Array.isArray(memory.labels)
      ? memory.labels
      : Array.isArray(memory.tags)
      ? memory.tags
      : [];

    const detectedProjectLabels: string[] = [];
    if ((memory as any).project) {
      detectedProjectLabels.push(String((memory as any).project).trim());
    }

    if (sessionId && sessionId !== "default") {
      const cleanName = sessionId.replace(/^(test_|sess_)/, "");
      detectedProjectLabels.push(cleanName);
    }

    const sessionRow = this.db.prepare("SELECT projectName FROM sessions WHERE id = ?").get(sessionId) as any;
    if (sessionRow && sessionRow.projectName && sessionRow.projectName !== "default" && sessionRow.projectName !== "singleton") {
      detectedProjectLabels.push(sessionRow.projectName);
    }

    const titleMatch = (memory.title || "").match(/^\[([^\]]+)\]/);
    if (titleMatch) {
      detectedProjectLabels.push(titleMatch[1].trim());
    }

    const labels = [...rawLabels];
    for (const pLabel of detectedProjectLabels) {
      if (pLabel && !labels.some(l => l.toLowerCase() === pLabel.toLowerCase())) {
        labels.unshift(pLabel);
      }
    }

    const labelsJson = JSON.stringify(labels);
    const claimStatus = memory.claimStatus || "asserted";
    const evolvesFromId = memory.evolvesFromId || null;
    const evolvesRelation = memory.evolvesRelation || null;
    const isLatest = memory.isLatest !== false ? 1 : 0;
    const source = memory.source || "manual";
    const sourceApp = memory.sourceApp || null;
    const temporalContext = memory.temporalContext || "timeless";
    const title = memory.title || (memory.content.slice(0, 50) + (memory.content.length > 50 ? "..." : ""));

    // Ensure session exists to satisfy Foreign Key
    const sessionExists = this.db.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId);
    if (!sessionExists) {
      this.db.prepare(`
        INSERT OR IGNORE INTO sessions (id, projectName, platform, createdAt, updatedAt)
        VALUES (?, ?, 'default', ?, ?)
      `).run(sessionId, sessionId, now, now);
    }

    // Check if memory already exists (Upsert support)
    const existing = await this.getMemory(id);
    if (existing) {
      await this.updateMemory(id, {
        title,
        content: memory.content,
        importance,
        category,
        unitType,
        labels,
        claimStatus,
        evolvesFromId: evolvesFromId || undefined,
        evolvesRelation: evolvesRelation || undefined,
        source,
        sourceApp: sourceApp || undefined,
        temporalContext,
      });
      return (await this.getMemory(id))!;
    }

    // Insert into memories table
    this.db.prepare(`
      INSERT INTO memories (
        id, sessionId, title, content, importance, category, unit_type,
        labels, tags, claim_status, evolves_from_id, evolves_relation,
        is_latest, source, source_app, temporal_context, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sessionId,
      title,
      memory.content,
      importance,
      category,
      unitType,
      labelsJson,
      labelsJson,
      claimStatus,
      evolvesFromId,
      evolvesRelation,
      isLatest,
      source,
      sourceApp,
      temporalContext,
      now,
      now
    );

    // If this memory replaces another memory, mark the older one as not latest
    if (evolvesFromId && evolvesRelation === "replaces") {
      this.db.prepare("UPDATE memories SET is_latest = 0 WHERE id = ?").run(evolvesFromId);
    }

    // Synchronize to FTS5
    try {
      this.db.prepare(`
        INSERT INTO fts_memories (memory_id, title, content, labels)
        VALUES (?, ?, ?, ?)
      `).run(id, title, memory.content, labels.join(" "));
    } catch {}

    const created = await this.getMemory(id);
    return created!;
  }

  async getMemories(
    sessionId?: string,
    filters?: {
      importance?: string | number;
      category?: string;
      query?: string;
      unitType?: string;
      labels?: string[];
      limit?: number;
    }
  ): Promise<Memory[]> {
    let sql = "SELECT * FROM memories WHERE 1=1";
    const params: any[] = [];

    if (sessionId && sessionId !== "all") {
      sql += " AND sessionId = ?";
      params.push(sessionId);
    }

    if (filters?.unitType) {
      sql += " AND unit_type = ?";
      params.push(filters.unitType);
    }

    if (filters?.category) {
      sql += " AND category = ?";
      params.push(filters.category);
    }

    if (filters?.importance !== undefined) {
      const minImp = normalizeImportance(filters.importance);
      sql += " AND importance >= ?";
      params.push(minImp);
    }

    if (filters?.query) {
      sql += " AND (title LIKE ? OR content LIKE ? OR labels LIKE ?)";
      params.push(`%${filters.query}%`, `%${filters.query}%`, `%${filters.query}%`);
    }

    sql += " ORDER BY importance DESC, updatedAt DESC";

    if (filters?.limit) {
      sql += " LIMIT ?";
      params.push(filters.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapMemory(r));
  }

  // --- RRF & Half-life Scoring Utilities ---
  private computeDecayFactor(createdAt: Date, temporalContext?: string): number {
    if (temporalContext === "timeless") return 1.0;
    
    const now = Date.now();
    const createdMs = createdAt.getTime();
    const deltaMs = Math.max(0, now - createdMs);
    
    // 30 days half life = 2,592,000,000 ms
    const HALF_LIFE_MS = 30 * 24 * 3600 * 1000;
    const lambda = Math.LN2 / HALF_LIFE_MS;
    
    if (temporalContext === "temporary") {
      // 7-day half life for temporary memories
      const tempLambda = Math.LN2 / (7 * 24 * 3600 * 1000);
      return Math.exp(-tempLambda * deltaMs);
    }
    
    return Math.exp(-lambda * deltaMs);
  }

  private computeEffectiveImportance(importance: number, createdAt: Date, temporalContext?: string): number {
    const base = normalizeImportance(importance);
    const decay = this.computeDecayFactor(createdAt, temporalContext);
    const floor = Math.max(0.15, base * 0.35);
    return Math.max(base * decay, floor);
  }

  async searchMemories(filters: MemorySearchFilters): Promise<Array<Memory & { score?: number }>> {
    const {
      query,
      spaceId,
      sessionId,
      filterLabels,
      unitType,
      category,
      limit = 10,
      confidenceThreshold = 0,
      mode = "normal",
    } = filters;
    const targetSpace = spaceId || sessionId;

    // 1. If no query string, sort by effective importance and recency
    if (!query || !query.trim()) {
      const regularMemories = await this.getMemories(targetSpace, {
        unitType,
        category,
        limit: limit * 2,
      });

      return regularMemories
        .map((m) => {
          const effectiveImp = this.computeEffectiveImportance(m.importance, m.createdAt, m.temporalContext);
          return {
            ...m,
            score: parseFloat(effectiveImp.toFixed(3)),
          };
        })
        .filter((m) => (m.score || 0) >= confidenceThreshold)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit);
    }

    // 2. Multi-Channel Retrieval for RRF
    const candidateMap = new Map<string, { memory: Memory; ftsRank?: number; textSimScore?: number }>();
    const ftsRankList: string[] = [];
    const textSimRankList: string[] = [];

    // --- Channel 1: FTS5 BM25 Search ---
    const cleanQuery = query.replace(/[^\w\s\u4e00-\u9fa5]/g, " ").trim();
    const ftsTokens = cleanQuery
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t}"*`)
      .join(" OR ");

    if (ftsTokens) {
      try {
        let ftsSql = `
          SELECT m.*, fts.rank as fts_rank
          FROM fts_memories fts
          JOIN memories m ON m.id = fts.memory_id
          WHERE fts_memories MATCH ?
        `;
        const params: any[] = [ftsTokens];

        if (targetSpace && targetSpace !== "all") {
          ftsSql += " AND m.sessionId = ?";
          params.push(targetSpace);
        }
        if (unitType) {
          ftsSql += " AND m.unit_type = ?";
          params.push(unitType);
        }
        if (category) {
          ftsSql += " AND m.category = ?";
          params.push(category);
        }

        ftsSql += " ORDER BY fts.rank ASC LIMIT 50";

        const rows = this.db.prepare(ftsSql).all(...params) as any[];
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const mem = this.mapMemory(r);
          ftsRankList.push(mem.id);
          candidateMap.set(mem.id, {
            memory: mem,
            ftsRank: i + 1,
          });
        }
      } catch (err) {
        // Fallback to LIKE if FTS expression parsing fails
      }
    }

    // --- Channel 2: Exact & Token Overlap Semantic Channel ---
    let fallbackSql = `SELECT * FROM memories WHERE 1=1`;
    const fallbackParams: any[] = [];

    if (targetSpace && targetSpace !== "all") {
      fallbackSql += " AND sessionId = ?";
      fallbackParams.push(targetSpace);
    }
    if (unitType) {
      fallbackSql += " AND unit_type = ?";
      fallbackParams.push(unitType);
    }
    if (category) {
      fallbackSql += " AND category = ?";
      fallbackParams.push(category);
    }
    fallbackSql += " ORDER BY createdAt DESC LIMIT 100";

    const allCandidates = (this.db.prepare(fallbackSql).all(...fallbackParams) as any[]).map((r) => this.mapMemory(r));
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(Boolean);

    const scoredFallback = allCandidates.map((m) => {
      let sim = 0;
      const titleLower = m.title.toLowerCase();
      const contentLower = m.content.toLowerCase();
      const labelsLower = m.labels.map((l) => l.toLowerCase());

      if (titleLower.includes(queryLower)) sim += 3.0;
      if (contentLower.includes(queryLower)) sim += 2.0;
      if (labelsLower.some((l) => l.includes(queryLower))) sim += 2.5;

      for (const w of queryWords) {
        if (titleLower.includes(w)) sim += 0.8;
        if (contentLower.includes(w)) sim += 0.4;
        if (labelsLower.some((l) => l.includes(w))) sim += 0.6;
      }

      return { memory: m, sim };
    });

    scoredFallback.sort((a, b) => b.sim - a.sim);

    for (let i = 0; i < scoredFallback.length; i++) {
      const item = scoredFallback[i];
      if (item.sim > 0) {
        textSimRankList.push(item.memory.id);
        const existing = candidateMap.get(item.memory.id);
        if (existing) {
          existing.textSimScore = item.sim;
        } else {
          candidateMap.set(item.memory.id, {
            memory: item.memory,
            textSimScore: item.sim,
          });
        }
      }
    }

    // --- Channel 3: RRF (Reciprocal Rank Fusion) Scoring ---
    const RRF_K = 60; // Standard IR constant
    const W_FTS = 1.0;
    const W_SIM = 1.0;
    const maxTheoreticalRRF = W_FTS / (RRF_K + 1) + W_SIM / (RRF_K + 1); // ~ 0.03278

    const scoredResults: Array<Memory & { score: number }> = [];

    for (const [id, entry] of candidateMap.entries()) {
      const m = entry.memory;

      // Label filter if requested
      if (filterLabels && filterLabels.length > 0) {
        const memLabelsLower = m.labels.map((l) => l.toLowerCase());
        const hasAllLabels = filterLabels.every((reqLabel) =>
          memLabelsLower.includes(reqLabel.toLowerCase())
        );
        if (!hasAllLabels) continue;
      }

      // Calculate RRF score across channels
      let rrfScore = 0;
      const ftsRankIdx = ftsRankList.indexOf(id);
      if (ftsRankIdx !== -1) {
        rrfScore += W_FTS / (RRF_K + (ftsRankIdx + 1));
      }

      const simRankIdx = textSimRankList.indexOf(id);
      if (simRankIdx !== -1) {
        rrfScore += W_SIM / (RRF_K + (simRankIdx + 1));
      }

      // Normalized RRF score in [0.1, 1.0]
      const normalizedRRF = Math.min(1.0, rrfScore / maxTheoreticalRRF);

      // Compute 30-day half life exponential decay with importance floor
      const effectiveImportance = this.computeEffectiveImportance(m.importance, m.createdAt, m.temporalContext);

      // Final composite score (60% RRF retrieval relevance + 40% time-decayed effective importance)
      let finalScore = normalizedRRF * 0.65 + effectiveImportance * 0.35;
      if (ftsRankIdx === 0 && simRankIdx === 0) {
        finalScore = Math.min(1.0, finalScore * 1.15); // Top exact match bonus
      }

      finalScore = parseFloat(Math.min(1.0, Math.max(0.01, finalScore)).toFixed(3));

      if (finalScore >= confidenceThreshold) {
        scoredResults.push({
          ...m,
          score: finalScore,
        });
      }
    }

    // Sort descending by composite score
    scoredResults.sort((a, b) => (b.score || 0) - (a.score || 0));

    return scoredResults.slice(0, limit);
  }

  async getMemory(id: string): Promise<Memory | null> {
    const row = this.db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as any;
    if (!row) return null;
    return this.mapMemory(row);
  }

  async updateMemory(id: string, update: Partial<Memory>): Promise<Memory | null> {
    const existing = await this.getMemory(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const title = update.title !== undefined ? update.title : existing.title;
    const content = update.content !== undefined ? update.content : existing.content;
    const importance = update.importance !== undefined ? normalizeImportance(update.importance) : existing.importance;
    const category = update.category !== undefined ? update.category : existing.category;
    const unitType = update.unitType !== undefined ? update.unitType : existing.unitType;
    const labels = update.labels !== undefined ? update.labels : (update.tags !== undefined ? update.tags : existing.labels);
    const labelsJson = JSON.stringify(labels);
    const claimStatus = update.claimStatus !== undefined ? update.claimStatus : existing.claimStatus;
    const evolvesFromId = update.evolvesFromId !== undefined ? update.evolvesFromId : existing.evolvesFromId;
    const evolvesRelation = update.evolvesRelation !== undefined ? update.evolvesRelation : existing.evolvesRelation;
    const isLatest = update.isLatest !== undefined ? (update.isLatest ? 1 : 0) : (existing.isLatest ? 1 : 0);
    const source = update.source !== undefined ? update.source : existing.source;
    const sourceApp = update.sourceApp !== undefined ? update.sourceApp : existing.sourceApp;
    const temporalContext = update.temporalContext !== undefined ? update.temporalContext : existing.temporalContext;

    this.db.prepare(`
      UPDATE memories SET
        title = ?,
        content = ?,
        importance = ?,
        category = ?,
        unit_type = ?,
        labels = ?,
        tags = ?,
        claim_status = ?,
        evolves_from_id = ?,
        evolves_relation = ?,
        is_latest = ?,
        source = ?,
        source_app = ?,
        temporal_context = ?,
        updatedAt = ?
      WHERE id = ?
    `).run(
      title,
      content,
      importance,
      category,
      unitType,
      labelsJson,
      labelsJson,
      claimStatus,
      evolvesFromId || null,
      evolvesRelation || null,
      isLatest,
      source,
      sourceApp || null,
      temporalContext,
      now,
      id
    );

    // Update FTS5 entry
    try {
      this.db.prepare("DELETE FROM fts_memories WHERE memory_id = ?").run(id);
      this.db.prepare(`
        INSERT INTO fts_memories (memory_id, title, content, labels)
        VALUES (?, ?, ?, ?)
      `).run(id, title, content, labels.join(" "));
    } catch {}

    return this.getMemory(id);
  }

  async deleteMemory(id: string): Promise<boolean> {
    const result = this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    try {
      this.db.prepare("DELETE FROM fts_memories WHERE memory_id = ?").run(id);
    } catch {}
    return result.changes > 0;
  }

  async getWorkingMemory(sessionId: string): Promise<WorkingMemory | null> {
    const row = this.db.prepare("SELECT * FROM working_memory WHERE sessionId = ?").get(sessionId) as any;
    if (!row) return null;

    return {
      sessionId: row.sessionId,
      briefing: row.briefing || "",
      focusAreas: row.focusAreas ? JSON.parse(row.focusAreas) : [],
      activeDecisions: row.activeDecisions ? JSON.parse(row.activeDecisions) : [],
      blockers: row.blockers ? JSON.parse(row.blockers) : [],
      lastGeneratedAt: new Date(row.lastGeneratedAt || row.updatedAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async saveWorkingMemory(workingMemory: Partial<WorkingMemory> & { sessionId: string }): Promise<WorkingMemory> {
    const now = new Date().toISOString();
    const existing = await this.getWorkingMemory(workingMemory.sessionId);

    const briefing = workingMemory.briefing !== undefined ? workingMemory.briefing : (existing?.briefing || "");
    const focusAreas = JSON.stringify(workingMemory.focusAreas !== undefined ? workingMemory.focusAreas : (existing?.focusAreas || []));
    const activeDecisions = JSON.stringify(workingMemory.activeDecisions !== undefined ? workingMemory.activeDecisions : (existing?.activeDecisions || []));
    const blockers = JSON.stringify(workingMemory.blockers !== undefined ? workingMemory.blockers : (existing?.blockers || []));
    const lastGeneratedAt = workingMemory.lastGeneratedAt
      ? workingMemory.lastGeneratedAt.toISOString()
      : existing?.lastGeneratedAt
      ? existing.lastGeneratedAt.toISOString()
      : now;

    this.db.prepare(`
      INSERT INTO working_memory (sessionId, briefing, focusAreas, activeDecisions, blockers, lastGeneratedAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sessionId) DO UPDATE SET
        briefing = excluded.briefing,
        focusAreas = excluded.focusAreas,
        activeDecisions = excluded.activeDecisions,
        blockers = excluded.blockers,
        lastGeneratedAt = excluded.lastGeneratedAt,
        updatedAt = excluded.updatedAt
    `).run(workingMemory.sessionId, briefing, focusAreas, activeDecisions, blockers, lastGeneratedAt, now);

    const saved = await this.getWorkingMemory(workingMemory.sessionId);
    return saved!;
  }

  // ── Memory Relations (P1) ──────────────────────────────────────────
  private mapRelation(row: any) {
    return {
      id: row.id,
      sourceMemoryId: row.source_memory_id,
      targetMemoryId: row.target_memory_id,
      relationType: row.relation_type,
      reason: row.reason || undefined,
      strength: typeof row.strength === "number" ? row.strength : 1.0,
      confidence: typeof row.confidence === "number" ? row.confidence : 1.0,
      bidirectional: row.bidirectional === 1,
      status: (row.status || "active") as any,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async addRelation(relation: {
    sourceMemoryId: string;
    targetMemoryId: string;
    relationType: string;
    reason?: string;
    strength?: number;
    confidence?: number;
    bidirectional?: boolean;
    status?: "active" | "suggested";
  }) {
    const id = `rel_${uuidv4()}`;
    const now = new Date().toISOString();
    const strength = relation.strength !== undefined ? relation.strength : 1.0;
    const confidence = relation.confidence !== undefined ? relation.confidence : 1.0;
    const bidirectional = relation.bidirectional ? 1 : 0;
    const status = relation.status || "active";

    this.db.prepare(`
      INSERT INTO memory_relations (
        id, source_memory_id, target_memory_id, relation_type,
        reason, strength, confidence, bidirectional, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      relation.sourceMemoryId,
      relation.targetMemoryId,
      relation.relationType,
      relation.reason || null,
      strength,
      confidence,
      bidirectional,
      status,
      now,
      now
    );

    const row = this.db.prepare("SELECT * FROM memory_relations WHERE id = ?").get(id) as any;
    return this.mapRelation(row);
  }

  async listRelations(
    memoryId: string,
    options?: { direction?: "out" | "in" | "both"; relationTypes?: string[]; status?: string; limit?: number }
  ) {
    const direction = options?.direction || "both";
    const status = options?.status || "active";
    const limit = options?.limit || 50;

    let sql = "SELECT * FROM memory_relations WHERE status = ?";
    const params: any[] = [status];

    if (direction === "out") {
      sql += " AND source_memory_id = ?";
      params.push(memoryId);
    } else if (direction === "in") {
      sql += " AND (target_memory_id = ? OR (source_memory_id = ? AND bidirectional = 1))";
      params.push(memoryId, memoryId);
    } else {
      sql += " AND (source_memory_id = ? OR target_memory_id = ?)";
      params.push(memoryId, memoryId);
    }

    if (options?.relationTypes && options.relationTypes.length > 0) {
      const placeholders = options.relationTypes.map(() => "?").join(",");
      sql += ` AND relation_type IN (${placeholders})`;
      params.push(...options.relationTypes);
    }

    sql += " ORDER BY strength DESC, updatedAt DESC LIMIT ?";
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRelation(r));
  }

  async deleteRelation(relationId: string): Promise<boolean> {
    const res = this.db.prepare("DELETE FROM memory_relations WHERE id = ?").run(relationId);
    return res.changes > 0;
  }

  // ── Memory Evolution Chain & Supersede (P2) ────────────────────────
  async getEvolutionChain(memoryId: string, maxDepth: number = 10): Promise<{
    chain: Array<{
      id: string;
      title: string;
      unitType: string;
      isLatest: boolean;
      createdAt: string;
      evolvesFromId?: string;
      evolvesRelation?: string;
    }>;
    position: number;
    totalVersions: number;
  }> {
    const root = await this.getMemory(memoryId);
    if (!root) throw new Error(`Memory ${memoryId} not found`);

    // 1. Trace backwards (ancestors)
    const ancestors: any[] = [];
    let currentId = root.evolvesFromId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const ancestor = await this.getMemory(currentId);
      if (!ancestor) break;
      ancestors.unshift(ancestor);
      currentId = ancestor.evolvesFromId;
      depth++;
    }

    // 2. Trace forwards (descendants)
    const descendants: any[] = [];
    currentId = root.id;
    depth = 0;

    while (currentId && depth < maxDepth) {
      const row = this.db.prepare("SELECT * FROM memories WHERE evolves_from_id = ?").get(currentId) as any;
      if (!row) break;
      const descendant = this.mapMemory(row);
      descendants.push(descendant);
      currentId = descendant.id;
      depth++;
    }

    const fullChain = [...ancestors, root, ...descendants];
    const position = ancestors.length;

    return {
      chain: fullChain.map(m => ({
        id: m.id,
        title: m.title,
        unitType: m.unitType,
        isLatest: m.isLatest || false,
        createdAt: m.createdAt.toISOString(),
        evolvesFromId: m.evolvesFromId,
        evolvesRelation: m.evolvesRelation,
      })),
      position,
      totalVersions: fullChain.length,
    };
  }

  async supersedeMemory(oldMemoryId: string, newMemoryId: string, reason?: string): Promise<{
    status: string;
    oldMemory: { id: string; isLatest: boolean };
    newMemory: { id: string; isLatest: boolean; evolvesFromId: string };
  }> {
    const oldMem = await this.getMemory(oldMemoryId);
    const newMem = await this.getMemory(newMemoryId);

    if (!oldMem) throw new Error(`Old memory ${oldMemoryId} not found`);
    if (!newMem) throw new Error(`New memory ${newMemoryId} not found`);

    // Mark old as outdated
    await this.updateMemory(oldMemoryId, { isLatest: false });

    // Link new memory to old memory
    await this.updateMemory(newMemoryId, {
      evolvesFromId: oldMemoryId,
      evolvesRelation: "replaces",
      isLatest: true,
    });

    // Record semantic link
    await this.addRelation({
      sourceMemoryId: newMemoryId,
      targetMemoryId: oldMemoryId,
      relationType: "replaces",
      reason: reason || "Memory superseded by newer version",
      strength: 1.0,
      confidence: 1.0,
      bidirectional: false,
    });

    return {
      status: "superseded",
      oldMemory: { id: oldMemoryId, isLatest: false },
      newMemory: { id: newMemoryId, isLatest: true, evolvesFromId: oldMemoryId },
    };
  }
}
