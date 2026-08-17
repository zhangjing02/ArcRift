import { getSqlite } from "./sqlite";
import { ISourceStore, Source } from "./storage.types";
import { v4 as uuidv4 } from "uuid";

export class SqliteSourceStore implements ISourceStore {
  private get db() {
    return getSqlite();
  }

  private mapSource(row: any): Source {
    let parsedLabels: string[] = [];
    try {
      if (row.labels) parsedLabels = JSON.parse(row.labels);
    } catch {}

    let parsedMeta: any = {};
    try {
      if (row.metadata) parsedMeta = JSON.parse(row.metadata);
    } catch {}

    return {
      id: row.id,
      sessionId: row.sessionId,
      name: row.name,
      sourceType: (row.source_type || "file") as any,
      url: row.url || undefined,
      filePath: row.filePath || undefined,
      summary: row.summary || undefined,
      rawContent: row.rawContent || undefined,
      labels: parsedLabels,
      lifecycleState: (row.lifecycle_state || "indexed") as any,
      metadata: parsedMeta,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async createSource(source: Partial<Source> & { name: string; sessionId?: string; spaceId?: string; sourceType?: string }): Promise<Source> {
    const id = source.id || `src_${uuidv4()}`;
    const now = new Date().toISOString();
    const sessionId = source.sessionId || source.spaceId || "default";
    const sourceType = source.sourceType || "file";
    const labelsJson = JSON.stringify(source.labels || []);
    const metaJson = JSON.stringify(source.metadata || {});

    // Ensure session exists to satisfy Foreign Key
    const sessionExists = this.db.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId);
    if (!sessionExists) {
      this.db.prepare(`
        INSERT OR IGNORE INTO sessions (id, projectName, platform, createdAt, updatedAt)
        VALUES (?, ?, 'default', ?, ?)
      `).run(sessionId, sessionId, now, now);
    }

    // Upsert support
    const existing = await this.getSource(id);
    if (existing) {
      this.db.prepare(`
        UPDATE sources SET
          name = ?,
          source_type = ?,
          url = ?,
          filePath = ?,
          summary = ?,
          rawContent = ?,
          labels = ?,
          lifecycle_state = ?,
          metadata = ?,
          updatedAt = ?
        WHERE id = ?
      `).run(
        source.name,
        sourceType,
        source.url || null,
        source.filePath || null,
        source.summary || null,
        source.rawContent || null,
        labelsJson,
        source.lifecycleState || "indexed",
        metaJson,
        now,
        id
      );
      return (await this.getSource(id))!;
    }

    this.db.prepare(`
      INSERT INTO sources (
        id, sessionId, name, source_type, url, filePath, summary,
        rawContent, labels, lifecycle_state, metadata, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sessionId,
      source.name,
      sourceType,
      source.url || null,
      source.filePath || null,
      source.summary || null,
      source.rawContent || null,
      labelsJson,
      source.lifecycleState || "indexed",
      metaJson,
      now,
      now
    );

    return (await this.getSource(id))!;
  }

  async getSources(
    sessionId?: string,
    filters?: {
      sourceType?: string;
      lifecycleState?: string;
      labels?: string[];
      query?: string;
      limit?: number;
    }
  ): Promise<Source[]> {
    let sql = "SELECT * FROM sources WHERE 1=1";
    const params: any[] = [];

    if (sessionId && sessionId !== "all") {
      sql += " AND (sessionId = ? OR sessionId = 'default')";
      params.push(sessionId);
    }

    if (filters?.sourceType) {
      sql += " AND source_type = ?";
      params.push(filters.sourceType);
    }

    if (filters?.lifecycleState) {
      sql += " AND lifecycle_state = ?";
      params.push(filters.lifecycleState);
    }

    if (filters?.query) {
      sql += " AND (name LIKE ? OR summary LIKE ? OR rawContent LIKE ?)";
      params.push(`%${filters.query}%`, `%${filters.query}%`, `%${filters.query}%`);
    }

    sql += " ORDER BY updatedAt DESC";

    if (filters?.limit) {
      sql += " LIMIT ?";
      params.push(filters.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapSource(r));
  }

  async getSource(id: string): Promise<Source | null> {
    const row = this.db.prepare("SELECT * FROM sources WHERE id = ?").get(id) as any;
    if (!row) return null;
    return this.mapSource(row);
  }

  async deleteSource(id: string): Promise<boolean> {
    const res = this.db.prepare("DELETE FROM sources WHERE id = ?").run(id);
    return res.changes > 0;
  }
}
