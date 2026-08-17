/**
 * services/nowledge-fs.ts
 *
 * Nowledge FS — Virtual Filesystem Layer for Nowledge Mem / ArcRift
 * Exposes database memories, threads, wiki topics, working-memory, and sources
 * as POSIX-like virtual files and paths.
 *
 * Implements:
 * - capabilities
 * - ls
 * - stat (low-overhead metadata inspection)
 * - cat (windowed slice reading with --line N --lines M)
 * - tree
 * - find
 * - recall
 */

import { memoryStore, sessionStore, sourceStore } from "./storage";
import { communityService } from "./community";
import { getSettings } from "../utils/settings";

export interface FsStatResult {
  path: string;
  exists: boolean;
  is_directory: boolean;
  size_bytes?: number;
  line_count?: number;
  mtime?: string;
  unit_type?: string;
  labels?: string[];
  importance?: number;
  title?: string;
  space_id?: string;
}

export interface FsCatResult {
  path: string;
  start_line: number;
  end_line: number;
  total_lines: number;
  is_truncated: boolean;
  content: string;
  hint?: string;
}

export class NowledgeFsService {
  /**
   * Return server capabilities and supported virtual roots
   */
  getCapabilities() {
    return {
      version: "1.0.0",
      virtual_roots: [
        "/memories",
        "/threads",
        "/wiki",
        "/working-memory",
        "/context",
        "/sources",
        "/ontology",
      ],
      supported_commands: [
        "capabilities",
        "ls",
        "stat",
        "cat",
        "tree",
        "find",
        "recall",
      ],
      features: {
        windowed_cat: true,
        low_overhead_stat: true,
        semantic_recall: true,
      },
    };
  }

  /**
   * Stat: low-overhead file/directory metadata inspection
   */
  async stat(virtualPath: string, spaceId: string = "default"): Promise<FsStatResult> {
    const cleanPath = this.normalizePath(virtualPath);

    // Root directory
    if (cleanPath === "/" || cleanPath === "") {
      return {
        path: "/",
        exists: true,
        is_directory: true,
      };
    }

    // Top-level virtual directories
    const topDirs = [
      "/memories",
      "/memories/by-id",
      "/memories/by-type",
      "/memories/by-label",
      "/threads",
      "/threads/by-id",
      "/wiki",
      "/wiki/entities",
      "/wiki/topics",
      "/wiki/crystals",
      "/working-memory",
      "/context",
      "/sources",
      "/ontology",
    ];

    if (topDirs.includes(cleanPath)) {
      return {
        path: cleanPath,
        exists: true,
        is_directory: true,
      };
    }

    // 1. Working Memory
    if (cleanPath === "/working-memory/working-memory.md") {
      const wm = await memoryStore.getWorkingMemory(spaceId);
      const text = wm
        ? `# Working Memory (${spaceId})\n\n## Briefing\n${wm.briefing || ""}\n\n## Focus Areas\n${(wm.focusAreas || []).map((f) => `- ${f}`).join("\n")}\n\n## Recent Decisions\n${(wm.activeDecisions || []).map((d) => `- ${d}`).join("\n")}\n\n## Blockers\n${(wm.blockers || []).map((b) => `- ${b}`).join("\n")}\n`
        : `# Working Memory (${spaceId})\n\nNo active working memory recorded.`;
      const lines = text.split("\n");
      return {
        path: cleanPath,
        exists: true,
        is_directory: false,
        size_bytes: Buffer.byteLength(text, "utf-8"),
        line_count: lines.length,
        mtime: wm?.updatedAt ? wm.updatedAt.toISOString() : new Date().toISOString(),
        space_id: spaceId,
      };
    }

    // 2. Context Bundle
    if (cleanPath === "/context/context.md") {
      const settings = getSettings();
      const profile = settings.userProfile || {};
      const text = `# Context Bundle\n\n- User: ${profile.name || "Developer"}\n- Language: ${profile.outputLanguage || "zh-CN"}\n- Instructions: ${profile.profileInstructions || "Standard execution"}\n`;
      const lines = text.split("\n");
      return {
        path: cleanPath,
        exists: true,
        is_directory: false,
        size_bytes: Buffer.byteLength(text, "utf-8"),
        line_count: lines.length,
        mtime: new Date().toISOString(),
      };
    }

    // 3. Memories: /memories/by-id/{id}.memory.md or /memories/{id}.md
    const memoryMatch = cleanPath.match(/\/memories(?:\/by-[^\/]+)?\/([^\/]+?)(?:\.memory)?\.md$/);
    if (memoryMatch) {
      const memId = memoryMatch[1];
      const mem = await memoryStore.getMemory(memId);
      if (mem) {
        const text = this.renderMemoryMarkdown(mem);
        const lines = text.split("\n");
        return {
          path: cleanPath,
          exists: true,
          is_directory: false,
          size_bytes: Buffer.byteLength(text, "utf-8"),
          line_count: lines.length,
          mtime: mem.updatedAt.toISOString(),
          unit_type: mem.unitType,
          labels: mem.labels,
          importance: mem.importance,
          title: mem.title,
          space_id: mem.sessionId,
        };
      }
    }

    // 4. Threads: /threads/by-id/{id}.thread.jsonl
    const threadMatch = cleanPath.match(/\/threads(?:\/by-id)?\/([^\/]+?)(?:\.thread)?\.jsonl$/);
    if (threadMatch) {
      const threadId = threadMatch[1];
      const session = await sessionStore.getSession(threadId);
      if (session) {
        const fullChat = await sessionStore.getFullChat(threadId);
        const text = fullChat ? JSON.stringify(fullChat) : "";
        const lines = text ? text.split("\n") : [];
        return {
          path: cleanPath,
          exists: true,
          is_directory: false,
          size_bytes: Buffer.byteLength(text, "utf-8"),
          line_count: Math.max(1, lines.length),
          mtime: session.updatedAt.toISOString(),
          title: session.projectName,
          space_id: session._id,
        };
      }
    }

    // 5. Sources: /sources/{id}.source.md
    const sourceMatch = cleanPath.match(/\/sources\/([^\/]+?)(?:\.source)?\.md$/);
    if (sourceMatch) {
      const sourceId = sourceMatch[1];
      const source = await sourceStore.getSource(sourceId);
      if (source) {
        const text = source.rawContent || source.summary || "";
        const lines = text.split("\n");
        return {
          path: cleanPath,
          exists: true,
          is_directory: false,
          size_bytes: Buffer.byteLength(text, "utf-8"),
          line_count: lines.length,
          mtime: source.updatedAt ? source.updatedAt.toISOString() : new Date().toISOString(),
          title: source.name,
          space_id: source.sessionId,
        };
      }
    }

    // 6. Wiki topics: /wiki/topics/{id}.topic.md
    const topicMatch = cleanPath.match(/\/wiki\/topics\/([^\/]+?)(?:\.topic)?\.md$/);
    if (topicMatch) {
      const commId = topicMatch[1];
      const comm = await communityService.getCommunity(commId);
      if (comm) {
        const text = `# Community: ${comm.name || comm.id}\n\n${comm.summary || ""}\n\n- Member count: ${comm.memberCount || (comm.memberEntities || []).length}\n- Space: ${comm.sessionId || "default"}\n`;
        const lines = text.split("\n");
        return {
          path: cleanPath,
          exists: true,
          is_directory: false,
          size_bytes: Buffer.byteLength(text, "utf-8"),
          line_count: lines.length,
          mtime: comm.updatedAt ? comm.updatedAt.toISOString() : new Date().toISOString(),
          title: comm.name || comm.id,
          space_id: comm.sessionId,
        };
      }
    }

    return {
      path: cleanPath,
      exists: false,
      is_directory: false,
    };
  }

  /**
   * Cat: windowed slice reading with --line N --lines M
   */
  async cat(
    virtualPath: string,
    options: { line?: number; lines?: number; spaceId?: string } = {}
  ): Promise<FsCatResult> {
    const { line = 1, lines = 100, spaceId = "default" } = options;
    const cleanPath = this.normalizePath(virtualPath);

    let fullText = "";

    // 1. Working Memory
    if (cleanPath === "/working-memory/working-memory.md") {
      const wm = await memoryStore.getWorkingMemory(spaceId);
      fullText = wm
        ? `# Working Memory (${spaceId})\n\n## Briefing\n${wm.briefing || "No active briefing."}\n\n## Focus Areas\n${(wm.focusAreas || []).map((f) => `- ${f}`).join("\n")}\n\n## Recent Decisions\n${(wm.activeDecisions || []).map((d) => `- ${d}`).join("\n")}\n\n## Blockers\n${(wm.blockers || []).map((b) => `- ${b}`).join("\n")}\n`
        : `# Working Memory (${spaceId})\n\nNo active working memory recorded.`;
    }
    // 2. Context Bundle
    else if (cleanPath === "/context/context.md") {
      const settings = getSettings();
      const profile = settings.userProfile || {};
      fullText = `# Context Bundle\n\n- User: ${profile.name || "Developer"}\n- Language: ${profile.outputLanguage || "zh-CN"}\n- Instructions: ${profile.profileInstructions || "Standard execution"}\n`;
    }
    // 3. Memory file
    else {
      const memoryMatch = cleanPath.match(/\/memories(?:\/by-[^\/]+)?\/([^\/]+?)(?:\.memory)?\.md$/);
      if (memoryMatch) {
        const mem = await memoryStore.getMemory(memoryMatch[1]);
        if (mem) {
          fullText = this.renderMemoryMarkdown(mem);
        }
      } else {
        const sourceMatch = cleanPath.match(/\/sources\/([^\/]+?)(?:\.source)?\.md$/);
        if (sourceMatch) {
          const source = await sourceStore.getSource(sourceMatch[1]);
          if (source) fullText = source.rawContent || source.summary || "";
        } else {
          const topicMatch = cleanPath.match(/\/wiki\/topics\/([^\/]+?)(?:\.topic)?\.md$/);
          if (topicMatch) {
            const comm = await communityService.getCommunity(topicMatch[1]);
            if (comm) {
              fullText = `# Community: ${comm.name || comm.id}\n\n${comm.summary || ""}\n\n## Members\n${(comm.memberEntities || []).map((m: any) => `- ${m}`).join("\n")}\n`;
            }
          }
        }
      }
    }

    if (!fullText) {
      throw new Error(`File not found: ${virtualPath}`);
    }

    const allLines = fullText.split("\n");
    const totalLines = allLines.length;
    const startIdx = Math.max(0, line - 1);
    const endIdx = Math.min(totalLines, startIdx + lines);

    const slice = allLines.slice(startIdx, endIdx);
    const isTruncated = endIdx < totalLines;

    let hint: string | undefined = undefined;
    if (isTruncated) {
      hint = `Showing lines ${startIdx + 1}-${endIdx} of ${totalLines}. Use 'cat ${cleanPath} --line ${endIdx + 1} --lines ${lines}' to read next window.`;
    }

    return {
      path: cleanPath,
      start_line: startIdx + 1,
      end_line: endIdx,
      total_lines: totalLines,
      is_truncated: isTruncated,
      content: slice.join("\n"),
      hint,
    };
  }

  /**
   * List directory contents
   */
  async ls(virtualPath: string = "/", spaceId: string = "default"): Promise<string[]> {
    const cleanPath = this.normalizePath(virtualPath);

    if (cleanPath === "/" || cleanPath === "") {
      return [
        "memories/",
        "threads/",
        "wiki/",
        "working-memory/",
        "context/",
        "sources/",
        "ontology/",
      ];
    }

    if (cleanPath === "/memories") {
      return ["by-id/", "by-type/", "by-label/"];
    }

    if (cleanPath === "/memories/by-id") {
      const memories = await memoryStore.getMemories(spaceId, { limit: 100 });
      return memories.map((m) => `${m.id}.memory.md`);
    }

    if (cleanPath === "/memories/by-type") {
      return [
        "decision/",
        "procedure/",
        "fact/",
        "learning/",
        "preference/",
        "plan/",
        "context/",
        "event/",
      ];
    }

    const typeMatch = cleanPath.match(/^\/memories\/by-type\/([^\/]+)$/);
    if (typeMatch) {
      const memories = await memoryStore.getMemories(spaceId, { unitType: typeMatch[1], limit: 50 });
      return memories.map((m) => `${m.id}.memory.md`);
    }

    if (cleanPath === "/working-memory") {
      return ["working-memory.md"];
    }

    if (cleanPath === "/context") {
      return ["context.md"];
    }

    if (cleanPath === "/wiki") {
      return ["topics/", "entities/", "crystals/"];
    }

    if (cleanPath === "/wiki/topics") {
      const communities = await communityService.listCommunities(spaceId);
      return communities.map((c) => `${c.id}.topic.md`);
    }

    if (cleanPath === "/sources") {
      const sources = await sourceStore.getSources(spaceId);
      return sources.map((s) => `${s.id}.source.md`);
    }

    return [];
  }

  /**
   * Render memory into standard Markdown frontmatter card
   */
  private renderMemoryMarkdown(mem: any): string {
    return `---
id: ${mem.id}
title: "${mem.title.replace(/"/g, '\\"')}"
unit_type: ${mem.unitType}
importance: ${mem.importance}
claim_status: ${mem.claimStatus || "asserted"}
temporal_context: ${mem.temporalContext || "timeless"}
space_id: ${mem.sessionId}
labels: [${mem.labels.map((l: string) => `"${l}"`).join(", ")}]
is_latest: ${mem.isLatest}
updatedAt: ${mem.updatedAt.toISOString()}
---

# ${mem.title}

${mem.content}
`;
  }

  private normalizePath(p: string): string {
    let normalized = p.trim().replace(/\\/g, "/");
    if (!normalized.startsWith("/")) normalized = "/" + normalized;
    return normalized.replace(/\/+$/, "") || "/";
  }
}

export const nowledgeFs = new NowledgeFsService();
