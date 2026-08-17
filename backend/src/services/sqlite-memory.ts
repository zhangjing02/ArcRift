import { getSqlite } from "./sqlite";
import { IMemoryStore, Memory, WorkingMemory, ImportanceLevel, MemoryCategory } from "./storage.types";
import { v4 as uuidv4 } from "uuid";

export class SqliteMemoryStore implements IMemoryStore {
  private get db() {
    return getSqlite();
  }

  private mapMemory(row: any): Memory {
    return {
      id: row.id,
      sessionId: row.sessionId,
      title: row.title,
      content: row.content,
      importance: (row.importance || "medium") as ImportanceLevel,
      category: (row.category || "Note") as MemoryCategory,
      tags: row.tags ? JSON.parse(row.tags) : [],
      source: row.source || "manual",
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async createMemory(memory: Omit<Memory, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Memory> {
    const id = memory.id || `mem_${uuidv4()}`;
    const now = new Date().toISOString();
    const tagsJson = JSON.stringify(memory.tags || []);

    this.db.prepare(`
      INSERT INTO memories (id, sessionId, title, content, importance, category, tags, source, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      memory.sessionId,
      memory.title || "Untitled Memory",
      memory.content,
      memory.importance || "medium",
      memory.category || "Note",
      tagsJson,
      memory.source || "manual",
      now,
      now
    );

    const created = await this.getMemory(id);
    return created!;
  }

  async getMemories(sessionId?: string, filters?: { importance?: ImportanceLevel; category?: string; query?: string }): Promise<Memory[]> {
    let sql = "SELECT * FROM memories WHERE 1=1";
    const params: any[] = [];

    if (sessionId) {
      sql += " AND sessionId = ?";
      params.push(sessionId);
    }

    if (filters?.importance) {
      sql += " AND importance = ?";
      params.push(filters.importance);
    }

    if (filters?.category) {
      sql += " AND category = ?";
      params.push(filters.category);
    }

    if (filters?.query) {
      sql += " AND (title LIKE ? OR content LIKE ?)";
      params.push(`%${filters.query}%`, `%${filters.query}%`);
    }

    sql += " ORDER BY CASE importance WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END, updatedAt DESC";

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapMemory(r));
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
    const importance = update.importance !== undefined ? update.importance : existing.importance;
    const category = update.category !== undefined ? update.category : existing.category;
    const tagsJson = update.tags !== undefined ? JSON.stringify(update.tags) : JSON.stringify(existing.tags);
    const source = update.source !== undefined ? update.source : existing.source;

    this.db.prepare(`
      UPDATE memories SET
        title = ?,
        content = ?,
        importance = ?,
        category = ?,
        tags = ?,
        source = ?,
        updatedAt = ?
      WHERE id = ?
    `).run(title, content, importance, category, tagsJson, source, now, id);

    return this.getMemory(id);
  }

  async deleteMemory(id: string): Promise<boolean> {
    const result = this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
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
    const lastGeneratedAt = workingMemory.lastGeneratedAt ? workingMemory.lastGeneratedAt.toISOString() : (existing?.lastGeneratedAt ? existing.lastGeneratedAt.toISOString() : now);

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
}
