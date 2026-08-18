import { getSqlite } from "./sqlite";
import { IGraphStore, Triple } from "./storage.types";

export class SqliteGraphStore implements IGraphStore {
  private db = getSqlite();

  async saveTriple(triple: Triple): Promise<void> {
    const sessionExists = this.db.prepare("SELECT id FROM sessions WHERE id = ?").get(triple.sessionId);
    if (!sessionExists) {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT OR IGNORE INTO sessions (id, projectName, platform, createdAt, updatedAt)
        VALUES (?, ?, 'default', ?, ?)
      `).run(triple.sessionId, triple.sessionId, now, now);
    }

    this.db.prepare(`
      INSERT OR IGNORE INTO facts (sessionId, subject, subjectType, relation, object, objectType, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      triple.sessionId,
      triple.subject,
      triple.subjectType,
      triple.relation,
      triple.object,
      triple.objectType,
      triple.timestamp || new Date().toISOString()
    );
  }

  async getTripleCountBySession(sessionId: string): Promise<number> {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM facts WHERE sessionId = ?").get(sessionId) as any;
    return row?.count || 0;
  }

  async getTriplesBySession(sessionId: string): Promise<Triple[]> {
    const rows = this.db.prepare(`
      SELECT * FROM facts WHERE sessionId = ? ORDER BY timestamp ASC
    `).all(sessionId) as any[];

    return rows.map(row => ({
      subject: row.subject,
      subjectType: row.subjectType,
      relation: row.relation,
      object: row.object,
      objectType: row.objectType,
      sessionId: row.sessionId,
      timestamp: row.timestamp
    }));
  }
  async getGraphData(filters: { sessionId?: string; type?: string; relation?: string; limit?: number }): Promise<{ nodes: any[]; links: any[] }> {
    const nodes = new Map<string, any>();
    const links: any[] = [];
    const linkKeys = new Set<string>();

    const addLink = (source: string, target: string, relation: string, timestamp?: string) => {
      if (!source || !target || source === target) return;
      const key = `${source}->${relation}->${target}`;
      if (linkKeys.has(key)) return;
      linkKeys.add(key);
      links.push({ source, target, relation, timestamp: timestamp || new Date().toISOString() });
    };

    // 1. Fetch memories and create memory nodes + project/tag nodes & links
    try {
      let memQuery = "SELECT id, title, content, unit_type, labels, importance, createdAt, evolves_from_id, evolves_relation FROM memories WHERE 1=1";
      const memParams: any[] = [];
      if (filters.sessionId) {
        memQuery += " AND sessionId = ?";
        memParams.push(filters.sessionId);
      }
      memQuery += " ORDER BY createdAt DESC";
      if (filters.limit) {
        memQuery += " LIMIT ?";
        memParams.push(filters.limit);
      }
      const memories = this.db.prepare(memQuery).all(...memParams) as any[];

      for (const m of memories) {
        const id = m.id;
        const title = m.title || "Untitled Memory";
        const unitType = m.unit_type || "fact";
        const ts = m.createdAt;

        // Add memory node
        if (!nodes.has(id)) {
          nodes.set(id, {
            id,
            label: title,
            type: unitType,
            category: "memory",
            importance: m.importance,
            firstSeen: ts,
          });
        }

        // Parse labels and connect to tag/concept nodes
        let labelList: string[] = [];
        try {
          if (m.labels) labelList = typeof m.labels === "string" ? JSON.parse(m.labels) : m.labels;
        } catch {
          if (typeof m.labels === "string") labelList = m.labels.split(/[,，\s]+/);
        }

        for (const label of labelList) {
          const cleanLabel = label.trim();
          if (!cleanLabel) continue;
          const tagId = `tag:${cleanLabel}`;

          if (!nodes.has(tagId)) {
            const isProject = ["ArcRift", "NowledgeMem", "WechatBot", "BeBeBus", "ChronosMind"].includes(cleanLabel);
            nodes.set(tagId, {
              id: tagId,
              label: cleanLabel,
              type: isProject ? "project" : "concept",
              category: isProject ? "project" : "concept",
              firstSeen: ts,
            });
          }

          addLink(id, tagId, "tagged_with", ts);
        }

        // Evolves relation
        if (m.evolves_from_id) {
          addLink(id, m.evolves_from_id, m.evolves_relation || "evolves_from", ts);
        }
      }
    } catch (err: any) {
      // ignore memory table missing if any
    }

    // 2. Fetch explicit memory relations from memory_relations table if present
    try {
      const relRows = this.db.prepare("SELECT source_id, target_id, relation_type, created_at FROM memory_relations").all() as any[];
      for (const r of relRows) {
        addLink(r.source_id, r.target_id, r.relation_type, r.created_at);
      }
    } catch {}

    // 3. Fetch explicit facts / triples from facts table
    try {
      let query = "SELECT * FROM facts WHERE 1=1";
      const params: any[] = [];
      if (filters.sessionId) {
        query += " AND sessionId = ?";
        params.push(filters.sessionId);
      }
      if (filters.type) {
        query += " AND (subjectType = ? OR objectType = ?)";
        params.push(filters.type, filters.type);
      }
      if (filters.relation) {
        query += " AND relation = ?";
        params.push(filters.relation);
      }
      query += " ORDER BY timestamp DESC";
      if (filters.limit) {
        query += " LIMIT ?";
        params.push(filters.limit);
      }

      const rows = this.db.prepare(query).all(...params) as any[];
      for (const row of rows) {
        const ts = row.timestamp;
        if (!nodes.has(row.subject)) {
          nodes.set(row.subject, { id: row.subject, label: row.subject, type: row.subjectType || "entity", firstSeen: ts });
        }
        if (!nodes.has(row.object)) {
          nodes.set(row.object, { id: row.object, label: row.object, type: row.objectType || "entity", firstSeen: ts });
        }
        addLink(row.subject, row.object, row.relation, ts);
      }
    } catch {}

    // 4. Community detection using adjacency list (O(V + E))
    const adj = new Map<string, string[]>();
    for (const link of links) {
      if (!adj.has(link.source)) adj.set(link.source, []);
      if (!adj.has(link.target)) adj.set(link.target, []);
      adj.get(link.source)!.push(link.target);
      adj.get(link.target)!.push(link.source);
    }

    const visited = new Set<string>();
    let communityCounter = 0;
    const nodeIds = Array.from(nodes.keys());

    for (const startId of nodeIds) {
      if (visited.has(startId)) continue;
      communityCounter++;
      const queue = [startId];
      visited.add(startId);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const node = nodes.get(currentId);
        if (node) node.community = communityCounter;

        const neighbors = adj.get(currentId) || [];
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        }
      }
    }

    return { nodes: Array.from(nodes.values()), links };
  }
  async findRelatedTriples(entities: string[], sessionId: string): Promise<Triple[]> {
    if (entities.length === 0) return [];
    
    // Create placeholders (?, ?, ?)
    const placeholders = entities.map(() => "?").join(",");
    const query = `
      SELECT * FROM facts 
      WHERE sessionId = ? 
      AND (subject IN (${placeholders}) OR object IN (${placeholders}))
      LIMIT 15
    `;
    
    const rows = this.db.prepare(query).all(sessionId, ...entities, ...entities) as any[];
    
    return rows.map(row => ({
      subject: row.subject,
      subjectType: row.subjectType,
      relation: row.relation,
      object: row.object,
      objectType: row.objectType,
      sessionId: row.sessionId,
      timestamp: row.timestamp
    }));
  }
  async findRelatedTriplesGlobal(entities: string[]): Promise<Triple[]> {
    if (entities.length === 0) return [];
    
    const placeholders = entities.map(() => "?").join(",");
    const query = `
      SELECT * FROM facts 
      WHERE subject IN (${placeholders}) OR object IN (${placeholders})
      LIMIT 20
    `;
    
    const rows = this.db.prepare(query).all(...entities, ...entities) as any[];
    
    return rows.map(row => ({
      subject: row.subject,
      subjectType: row.subjectType,
      relation: row.relation,
      object: row.object,
      objectType: row.objectType,
      sessionId: row.sessionId,
      timestamp: row.timestamp
    }));
  }

  async deleteTriples(entities: string[], sessionId: string): Promise<number> {
    if (entities.length === 0) return 0;
    
    const placeholders = entities.map(() => "?").join(",");
    const query = `
      DELETE FROM facts 
      WHERE sessionId = ? 
      AND (subject IN (${placeholders}) OR object IN (${placeholders}))
    `;
    
    const result = this.db.prepare(query).run(sessionId, ...entities, ...entities);
    return result.changes;
  }

  async renameNode(oldName: string, newName: string, sessionId?: string): Promise<number> {
    if (!oldName || !newName) return 0;
    
    let totalChanges = 0;
    this.db.transaction(() => {
      if (sessionId) {
        totalChanges += this.db.prepare("UPDATE facts SET subject = ? WHERE subject = ? AND sessionId = ?").run(newName, oldName, sessionId).changes;
        totalChanges += this.db.prepare("UPDATE facts SET object = ? WHERE object = ? AND sessionId = ?").run(newName, oldName, sessionId).changes;
      } else {
        totalChanges += this.db.prepare("UPDATE facts SET subject = ? WHERE subject = ?").run(newName, oldName).changes;
        totalChanges += this.db.prepare("UPDATE facts SET object = ? WHERE object = ?").run(newName, oldName).changes;
      }
    })();
    return totalChanges;
  }

  async deleteEdge(source: string, target: string, relation: string, sessionId?: string): Promise<number> {
    if (!source || !target || !relation) return 0;
    
    if (sessionId) {
      return this.db.prepare("DELETE FROM facts WHERE subject = ? AND object = ? AND relation = ? AND sessionId = ?").run(source, target, relation, sessionId).changes;
    } else {
      return this.db.prepare("DELETE FROM facts WHERE subject = ? AND object = ? AND relation = ?").run(source, target, relation).changes;
    }
  }

  async mergeSession(sourceId: string, targetId: string): Promise<void> {
    // We update session_id of facts. If a duplicate fact (same subject, relation, object, sessionId)
    // arises because both sessions had it, INSERT/UPDATE OR IGNORE will skip the duplicate.
    this.db.transaction(() => {
      this.db.prepare("UPDATE OR IGNORE facts SET sessionId = ? WHERE sessionId = ?").run(targetId, sourceId);
      this.db.prepare("DELETE FROM facts WHERE sessionId = ?").run(sourceId);
    })();
  }
}
