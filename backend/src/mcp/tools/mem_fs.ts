/**
 * mcp/tools/mem_fs.ts
 *
 * Handler for the standard `mem_fs` MCP tool.
 * Enables AI Agents to browse, stat, window-read, and recall from the virtual filesystem.
 */

import { nowledgeFs } from "../../services/nowledge-fs";

export interface MemFsInput {
  command?: "capabilities" | "ls" | "stat" | "cat" | "tree" | "find" | "recall";
  path?: string;
  line?: number;
  lines?: number;
  space_id?: string;
  spaceId?: string;
  query?: string;
}

export async function memFs(input: MemFsInput) {
  const command = input.command || (input.query ? "recall" : "ls");
  const path = input.path || "/";
  const spaceId = input.space_id || input.spaceId || "default";

  switch (command) {
    case "capabilities":
      return nowledgeFs.getCapabilities();

    case "stat": {
      const statRes = await nowledgeFs.stat(path, spaceId);
      return statRes;
    }

    case "cat": {
      const catRes = await nowledgeFs.cat(path, {
        line: input.line || 1,
        lines: input.lines || 100,
        spaceId,
      });
      return catRes;
    }

    case "ls": {
      const items = await nowledgeFs.ls(path, spaceId);
      return {
        path,
        space_id: spaceId,
        count: items.length,
        items,
      };
    }

    case "tree": {
      const roots = await nowledgeFs.ls("/", spaceId);
      const tree: Record<string, string[]> = {};
      for (const r of roots) {
        const sub = await nowledgeFs.ls(`/${r.replace(/\/$/, "")}`, spaceId);
        tree[r] = sub;
      }
      return {
        space_id: spaceId,
        tree,
      };
    }

    case "recall": {
      if (!input.query) {
        throw new Error("Missing 'query' parameter for recall command");
      }
      return {
        query: input.query,
        hint: `To read recalled nodes, use mem_fs with command: 'cat', path: '/memories/by-id/<id>.memory.md'`,
      };
    }

    default:
      throw new Error(`Unsupported mem_fs command: ${command}`);
  }
}
