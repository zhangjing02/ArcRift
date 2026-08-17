import { getSqlite } from "./sqlite";
import { v4 as uuidv4 } from "uuid";
import { graphStore, memoryStore } from "./storage";

export interface Community {
  id: string;
  sessionId: string;
  name: string;
  summary: string;
  memberCount: number;
  memberEntities: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class CommunityService {
  private get db() {
    return getSqlite();
  }

  private mapCommunity(row: any): Community {
    let members: string[] = [];
    try {
      if (row.member_entities) members = JSON.parse(row.member_entities);
    } catch {}

    return {
      id: row.id,
      sessionId: row.sessionId,
      name: row.name,
      summary: row.summary || "",
      memberCount: row.member_count || members.length,
      memberEntities: members,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async runCommunityDetection(sessionId?: string): Promise<Community[]> {
    const targetSession = sessionId || "default";
    const graphData = await graphStore.getGraphData({ sessionId: targetSession === "all" ? undefined : targetSession, limit: 500 });
    const { nodes, links } = graphData;

    if (nodes.length === 0) {
      return [];
    }

    // Build adjacency list
    const adj = new Map<string, Set<string>>();
    for (const n of nodes) {
      adj.set(n.id, new Set<string>());
    }
    for (const l of links) {
      if (!adj.has(l.source)) adj.set(l.source, new Set<string>());
      if (!adj.has(l.target)) adj.set(l.target, new Set<string>());
      adj.get(l.source)!.add(l.target);
      adj.get(l.target)!.add(l.source);
    }

    // Connected component clustering
    const visited = new Set<string>();
    const clusters: Array<{ name: string; summary: string; members: string[] }> = [];

    for (const [nodeId] of adj.entries()) {
      if (visited.has(nodeId)) continue;

      const clusterMembers: string[] = [];
      const queue: string[] = [nodeId];
      visited.add(nodeId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        clusterMembers.push(current);

        const neighbors = adj.get(current) || new Set();
        for (const nbr of neighbors) {
          if (!visited.has(nbr)) {
            visited.add(nbr);
            queue.push(nbr);
          }
        }
      }

      if (clusterMembers.length > 0) {
        const topEntity = clusterMembers[0];
        const secondEntity = clusterMembers.length > 1 ? clusterMembers[1] : "";
        const name = secondEntity ? `${topEntity} & ${secondEntity}` : `${topEntity} 知识聚类`;
        const summary = `包含 ${clusterMembers.length} 个实体主题（如 ${clusterMembers.slice(0, 3).join(", ")}）的核心关联知识社区。`;
        clusters.push({ name, summary, members: clusterMembers });
      }
    }

    // Clear old communities for this session and save new ones
    this.db.prepare("DELETE FROM communities WHERE sessionId = ?").run(targetSession);

    const now = new Date().toISOString();
    const results: Community[] = [];

    for (const c of clusters) {
      const id = `comm_${uuidv4()}`;
      this.db.prepare(`
        INSERT INTO communities (id, sessionId, name, summary, member_count, member_entities, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, targetSession, c.name, c.summary, c.members.length, JSON.stringify(c.members), now, now);

      results.push({
        id,
        sessionId: targetSession,
        name: c.name,
        summary: c.summary,
        memberCount: c.members.length,
        memberEntities: c.members,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
    }

    return results;
  }

  async listCommunities(sessionId?: string, limit: number = 20): Promise<Community[]> {
    let sql = "SELECT * FROM communities WHERE 1=1";
    const params: any[] = [];

    if (sessionId && sessionId !== "all") {
      sql += " AND (sessionId = ? OR sessionId = 'default')";
      params.push(sessionId);
    }

    sql += " ORDER BY member_count DESC LIMIT ?";
    params.push(limit);

    let rows = this.db.prepare(sql).all(...params) as any[];
    if (rows.length === 0) {
      // If empty, auto-run detection
      return this.runCommunityDetection(sessionId);
    }

    return rows.map(r => this.mapCommunity(r));
  }

  async getCommunityDetails(communityId: string): Promise<any | null> {
    const row = this.db.prepare("SELECT * FROM communities WHERE id = ?").get(communityId) as any;
    if (!row) return null;

    const comm = this.mapCommunity(row);
    // Find associated memories mentioning any community member entity
    const memories = await memoryStore.getMemories(comm.sessionId);
    const relatedMemories = memories.filter(m =>
      comm.memberEntities.some(entity =>
        m.title.includes(entity) || m.content.includes(entity) || m.labels.includes(entity)
      )
    );

    return {
      ...comm,
      relatedMemories: relatedMemories.map(m => ({
        id: m.id,
        title: m.title,
        unitType: m.unitType,
        importance: m.importance,
      })),
    };
  }
}

export const communityService = new CommunityService();
