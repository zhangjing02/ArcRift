/**
 * mcp/server.ts — Nowledge Mem / ArcRift MCP Server (stdio transport)
 *
 * Exposes full Nowledge Mem standard MCP tool protocol + ArcRift coding tool integrations.
 * Compatible with Google Antigravity, Cursor, Windsurf, Claude Code, Claude Desktop, and VS Code.
 */
process.env.ARCRIFT_MCP_MODE = "true";
process.env.DOTENV_QUIET = "true";
process.env.DOTENV_CONFIG_QUIET = "true";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import fs from "fs";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  try {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["'](.*)["']$/, "$1");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {}
}

const envPaths = [
  path.resolve(__dirname, "../../../.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../../backend/.env"),
];
for (const p of envPaths) {
  loadEnvFile(p);
}

// ── Tool Handlers ───────────────────────────────────────────────────
import { memoryAdd } from "./tools/memory_add";
import { memorySearch } from "./tools/memory_search";
import { getMemoryById } from "./tools/get_memory_by_id";
import { memoryUpdate } from "./tools/memory_update";
import { memoryDelete } from "./tools/memory_delete";
import { memoryRelationAdd } from "./tools/memory_relation_add";
import { memoryRelationList } from "./tools/memory_relation_list";
import { memoryRelationDelete } from "./tools/memory_relation_delete";
import { memoryEvolvesChain } from "./tools/memory_evolves_chain";
import { memorySupersede } from "./tools/memory_supersede";
import { querySources } from "./tools/query_sources";
import { readSourceContent } from "./tools/read_source_content";
import { listCommunities } from "./tools/list_communities";
import { runCommunityDetection } from "./tools/run_community_detection";
import { getCommunityDetails } from "./tools/get_community_details";
import { readWorkingMemory } from "./tools/read_working_memory";
import { listSpaces } from "./tools/list_spaces";
import { getSpaceProfile } from "./tools/get_space_profile";
import { exploreGraph } from "./tools/explore_graph";
import { graphStats } from "./tools/graph_stats";
import { recall } from "./tools/recall";
import { prune } from "./tools/prune";
import { getSummary } from "./tools/summary";
import { identifyProject } from "./tools/detector";
import { indexCodebase } from "./tools/index_codebase";
import { updateWorkingMemoryTool } from "./tools/working_memory";
import { memFs } from "./tools/mem_fs";
import { checkClaims } from "./tools/check_claims";
import { listTimelineReviews } from "./tools/list_timeline_reviews";
import { resolveTimelineReview } from "./tools/resolve_timeline_review";
import { initStorage, sessionStore } from "../services/storage";
import { logger } from "../utils/logger";

// ── Standard Tool Definitions ───────────────────────────────────────
const TOOLS = [
  // 1. Nowledge Mem Standard: memory_add
  {
    name: "memory_add",
    description:
      "Save a decision, insight, procedure, learning, preference, or important context to the knowledge graph. " +
      "Use proactively when durable knowledge emerges. Pass an id to upsert. Supports labels, unit_type, importance, and EVOLVES relationships.",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "Memory content (plain text or markdown)" },
        title: { type: "string", description: "Optional title for the memory" },
        id: { type: "string", description: "Optional stable ID for upsert" },
        space_id: { type: "string", description: "Isolation space to store the memory in (default: 'default')" },
        importance: { type: "number", description: "Importance score (0.1=low, 0.5=medium, 0.8=high, 1.0=critical)" },
        unit_type: {
          type: "string",
          enum: ["fact", "preference", "decision", "plan", "procedure", "learning", "context", "event"],
          description: "Memory unit type (decision, procedure, fact, learning, etc.)",
        },
        labels: { type: "string", description: "Comma-separated labels (e.g. 'auth,architecture')" },
        claim_status: {
          type: "string",
          enum: ["asserted", "explored", "proposed", "planned", "unverified"],
          description: "Epistemic status of the memory",
        },
        evolves_from_id: { type: "string", description: "Existing memory ID this updates or replaces" },
        evolves_relation: {
          type: "string",
          enum: ["replaces", "enriches", "confirms"],
          description: "Relationship to evolves_from_id",
        },
      },
      required: ["content"],
    },
  },

  // 2. Nowledge Mem Standard: memory_search
  {
    name: "memory_search",
    description:
      "Search stored memories using hybrid semantic + BM25 keyword search, or list recent memories when query is omitted. " +
      "Ranked by relevance and importance. Supports label filtering and unit_type filtering.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Natural language search query" },
        limit: { type: "number", description: "Max results (1-20, default: 10)" },
        space_id: { type: "string", description: "Isolation space to search within" },
        filter_labels: { type: "string", description: "Comma-separated labels to filter results" },
        unit_type: { type: "string", description: "Comma-separated unit types to filter by" },
        confidence_threshold: { type: "number", description: "Minimum relevance score (0.0-1.0)" },
        mode: { type: "string", enum: ["normal", "deep"], description: "Search mode: 'normal' (fast) or 'deep' (graph-enhanced)" },
      },
      required: [],
    },
  },

  // 3. Nowledge Mem Standard: get_memory_by_id
  {
    name: "get_memory_by_id",
    description: "Retrieve a specific memory by its ID in full (content, metadata, importance, unit type, version info).",
    inputSchema: {
      type: "object" as const,
      properties: {
        memory_id: { type: "string", description: "ID of the memory to retrieve" },
      },
      required: ["memory_id"],
    },
  },

  // 4. Nowledge Mem Standard: memory_update
  {
    name: "memory_update",
    description: "Partially update an existing memory's content, title, importance, unit_type, or labels.",
    inputSchema: {
      type: "object" as const,
      properties: {
        memory_id: { type: "string", description: "ID of the memory to update" },
        content: { type: "string", description: "Updated content" },
        title: { type: "string", description: "Updated title" },
        importance: { type: "number", description: "Updated importance (0.1 - 1.0)" },
        unit_type: { type: "string", description: "Updated unit type" },
        labels: { type: "string", description: "Updated comma-separated labels" },
      },
      required: ["memory_id"],
    },
  },

  // 5. Nowledge Mem Standard: memory_delete
  {
    name: "memory_delete",
    description: "Permanently delete a memory by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        memory_id: { type: "string", description: "ID of the memory to delete" },
      },
      required: ["memory_id"],
    },
  },

  // 6. Nowledge Mem P1: memory_relation_add
  {
    name: "memory_relation_add",
    description:
      "Create or update an explicit semantic link between two memories (e.g. relates_to, supports, contradicts, depends_on, caused_by).",
    inputSchema: {
      type: "object" as const,
      properties: {
        source_memory_id: { type: "string", description: "Source memory ID" },
        target_memory_id: { type: "string", description: "Target memory ID" },
        relation_type: { type: "string", description: "Relation type (supports, contradicts, depends_on, relates_to, caused_by)" },
        reason: { type: "string", description: "Short explanation for why this link exists" },
        strength: { type: "number", description: "Weight 0..1 (default 1.0)" },
        confidence: { type: "number", description: "Confidence 0..1 (default 1.0)" },
        bidirectional: { type: "boolean", description: "Whether the link can be traversed both ways" },
      },
      required: ["source_memory_id", "target_memory_id", "relation_type"],
    },
  },

  // 7. Nowledge Mem P1: memory_relation_list
  {
    name: "memory_relation_list",
    description: "List explicit semantic Memory-to-Memory links around a given memory.",
    inputSchema: {
      type: "object" as const,
      properties: {
        memory_id: { type: "string", description: "Memory ID to inspect" },
        direction: { type: "string", enum: ["out", "in", "both"], description: "Traversal direction (default: both)" },
        relation_types: { type: "string", description: "Comma-separated relation types filter" },
        limit: { type: "number", description: "Maximum relations to return (default 50)" },
      },
      required: ["memory_id"],
    },
  },

  // 8. Nowledge Mem P1: memory_relation_delete
  {
    name: "memory_relation_delete",
    description: "Remove an explicit semantic Memory-to-Memory link by relation ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        relation_id: { type: "string", description: "Relation ID to delete" },
      },
      required: ["relation_id"],
    },
  },

  // 9. Nowledge Mem P2: memory_evolves_chain
  {
    name: "memory_evolves_chain",
    description: "Get the full version history (EVOLVES chain) for a memory, showing how knowledge evolved over time.",
    inputSchema: {
      type: "object" as const,
      properties: {
        memory_id: { type: "string", description: "Memory ID to get the version chain for" },
        max_depth: { type: "number", description: "Maximum chain traversal depth (default 10)" },
      },
      required: ["memory_id"],
    },
  },

  // 10. Nowledge Mem P2: memory_supersede
  {
    name: "memory_supersede",
    description: "Mark an older memory as replaced by a newer one. Records the version link and marks newer as active.",
    inputSchema: {
      type: "object" as const,
      properties: {
        old_memory_id: { type: "string", description: "ID of the outdated memory being replaced" },
        new_memory_id: { type: "string", description: "ID of the newer replacing memory" },
        reason: { type: "string", description: "Short explanation of why it was superseded" },
      },
      required: ["old_memory_id", "new_memory_id"],
    },
  },

  // 11. Nowledge Mem P1: query_sources
  {
    name: "query_sources",
    description: "Search or list Library sources (URL, PDF, documents, local files). Returns source IDs for reading full content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Text query to search source names and summaries" },
        source_type: { type: "string", description: "Optional source type filter ('file', 'url', 'document', 'note')" },
        lifecycle_state: { type: "string", description: "Lifecycle filter ('parsed', 'indexed', 'extracted', 'stale')" },
        labels: { type: "string", description: "Comma-separated label filters" },
        space_id: { type: "string", description: "Isolation space filter" },
        limit: { type: "number", description: "Maximum results (default 10)" },
      },
      required: [],
    },
  },

  // 12. Nowledge Mem P1: read_source_content
  {
    name: "read_source_content",
    description: "Read the full or paginated content of a Library source.",
    inputSchema: {
      type: "object" as const,
      properties: {
        source_id: { type: "string", description: "Source ID returned by query_sources" },
        offset: { type: "number", description: "Character offset for pagination (default: 0)" },
        limit: { type: "number", description: "Maximum characters to return (default: 8000)" },
      },
      required: ["source_id"],
    },
  },

  // 13. Nowledge Mem P2: list_communities
  {
    name: "list_communities",
    description: "List knowledge communities — clusters of related entities detected by graph clustering algorithms.",
    inputSchema: {
      type: "object" as const,
      properties: {
        space_id: { type: "string", description: "Optional space ID" },
        limit: { type: "number", description: "Maximum communities to return (default 20)" },
      },
      required: [],
    },
  },

  // 14. Nowledge Mem P2: run_community_detection
  {
    name: "run_community_detection",
    description: "Execute community detection algorithm to group knowledge graph entities into topical clusters.",
    inputSchema: {
      type: "object" as const,
      properties: {
        space_id: { type: "string", description: "Optional space ID" },
      },
      required: [],
    },
  },

  // 15. Nowledge Mem P2: get_community_details
  {
    name: "get_community_details",
    description: "Get detailed information about a knowledge community, including member entities and linked memories.",
    inputSchema: {
      type: "object" as const,
      properties: {
        community_id: { type: "string", description: "Community ID" },
      },
      required: ["community_id"],
    },
  },

  // 16. Nowledge Mem Standard: read_working_memory
  {
    name: "read_working_memory",
    description:
      "Read today's Working Memory briefing: current priorities, recent decisions, open questions, and active focus areas. " +
      "Call this once near the start of every session to understand current context.",
    inputSchema: {
      type: "object" as const,
      properties: {
        space_id: { type: "string", description: "Isolation space to read (defaults to active project)" },
      },
      required: [],
    },
  },

  // 17. Nowledge Mem Standard: update_working_memory
  {
    name: "update_working_memory",
    description: "Update the project's Working Memory daily briefing, priorities, decisions, or blockers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project: { type: "string", description: "Project/Space ID or name" },
        space_id: { type: "string", description: "Project/Space ID (alias)" },
        briefing: { type: "string", description: "Executive summary text of project state" },
        focusAreas: { type: "array", items: { type: "string" }, description: "List of immediate priority tasks" },
        activeDecisions: { type: "array", items: { type: "string" }, description: "List of active architecture decisions" },
        blockers: { type: "array", items: { type: "string" }, description: "List of open issues or gotchas" },
      },
      required: [],
    },
  },

  // 18. Nowledge Mem Standard: list_spaces
  {
    name: "list_spaces",
    description: "List all active spaces / projects with memory and graph statistics.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },

  // 19. Nowledge Mem Standard: get_space_profile
  {
    name: "get_space_profile",
    description: "Read one Space profile by id, key, or display name with detailed stats and current working memory.",
    inputSchema: {
      type: "object" as const,
      properties: {
        space_ref: { type: "string", description: "Space id, key, or display name to resolve." },
      },
      required: ["space_ref"],
    },
  },

  // 19. Nowledge Mem Standard: explore_graph
  {
    name: "explore_graph",
    description: "Explore the knowledge graph around memories or entities. Returns nodes and edges in a visualization-ready format.",
    inputSchema: {
      type: "object" as const,
      properties: {
        memory_ids: { type: "string", description: "Optional comma-separated memory IDs to explore around" },
        space_id: { type: "string", description: "Optional space ID to scope exploration" },
        limit: { type: "number", description: "Max nodes to return (default 20)" },
      },
      required: [],
    },
  },

  // 20. Nowledge Mem Standard: graph_stats
  {
    name: "graph_stats",
    description: "Get global statistics on spaces, memories, knowledge graph facts, and entities.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  // 21. Nowledge Mem Standard: mem_fs
  {
    name: "mem_fs",
    description:
      "Nowledge FS virtual filesystem interface. Supports 'capabilities', 'ls', 'stat' (low-overhead metadata inspection), 'cat' (windowed slice reading with --line and --lines), 'tree', and 'recall'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          enum: ["capabilities", "ls", "stat", "cat", "tree", "find", "recall"],
          description: "Filesystem command to execute",
        },
        path: { type: "string", description: "Virtual path (e.g. '/memories/by-id/xxx.memory.md', '/working-memory/working-memory.md')" },
        line: { type: "number", description: "Start line for cat (1-indexed, default 1)" },
        lines: { type: "number", description: "Max lines to read for cat (default 100)" },
        space_id: { type: "string", description: "Isolation space ID" },
        query: { type: "string", description: "Query for recall command" },
      },
      required: [],
    },
  },

  // 22. Nowledge Mem Standard: check_claims
  {
    name: "check_claims",
    description:
      "Pre-flight claim verification. Checks draft text statements against the knowledge base for contradictions, deprecated facts, or contested claims.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "The text content or draft report to analyze for factual conflicts" },
        space_id: { type: "string", description: "Optional isolation space ID" },
        confidence_threshold: { type: "number", description: "Confidence threshold for conflict detection (default: 0.5)" },
      },
      required: ["text"],
    },
  },

  // 23. Nowledge Mem Standard: list_timeline_reviews
  {
    name: "list_timeline_reviews",
    description: "List timeline conflict reviews in the inbox requiring human or agent adjudication.",
    inputSchema: {
      type: "object" as const,
      properties: {
        space_id: { type: "string", description: "Optional space ID filter" },
        status: {
          type: "string",
          enum: ["pending", "resolved", "dismissed", "all"],
          description: "Review status filter (default: 'pending')",
        },
        limit: { type: "number", description: "Max reviews to return" },
      },
      required: [],
    },
  },

  // 24. Nowledge Mem Standard: resolve_timeline_review
  {
    name: "resolve_timeline_review",
    description:
      "Adjudicate a timeline review conflict. Actions: 'keep_newer_as_latest', 'keep_older_as_latest', 'keep_both_linked', 'dismiss'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        review_id: { type: "string", description: "Timeline review ID" },
        action: {
          type: "string",
          enum: ["keep_newer_as_latest", "keep_older_as_latest", "keep_both_linked", "dismiss"],
          description: "Adjudication decision",
        },
        custom_note: { type: "string", description: "Optional explanation or audit note" },
      },
      required: ["review_id", "action"],
    },
  },

  // ── Backward Compatible / Coding Helper Tools ─────────────────────
  {
    name: "recall_context",
    description: "Retrieve the most relevant memory chunks wrapped in context delimiters for AI coders.",
    inputSchema: {
      type: "object" as const,
      properties: {
        prompt: { type: "string", description: "The current task or question" },
        project: { type: "string", description: "Project ID to scope the search (optional)" },
        topN: { type: "number", description: "Max chunks to return (default 3, max 6)" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "store_memory",
    description: "Backward compatible alias for memory_add.",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "Content to store" },
        project: { type: "string", description: "Target project/space" },
        title: { type: "string", description: "Title" },
        importance: { type: "string", description: "Importance level" },
        category: { type: "string", description: "Category" },
      },
      required: ["content"],
    },
  },
  {
    name: "search_memory",
    description: "Backward compatible alias for memory_search.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        topN: { type: "number", description: "Max results" },
      },
      required: ["query"],
    },
  },
  {
    name: "prune_memory",
    description: "Backward compatible alias for memory_delete or entity pruning.",
    inputSchema: {
      type: "object" as const,
      properties: {
        prompt: { type: "string", description: "What information should be removed?" },
        project: { type: "string", description: "Project ID to prune from" },
        memory_id: { type: "string", description: "Memory ID to delete" },
      },
      required: [],
    },
  },
  {
    name: "list_projects",
    description: "Backward compatible alias for list_spaces.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_working_memory",
    description: "Backward compatible alias for read_working_memory.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project: { type: "string", description: "Project ID" },
      },
      required: [],
    },
  },
  {
    name: "get_project_summary",
    description: "Get knowledge graph summary for a project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project: { type: "string", description: "Project ID" },
      },
      required: ["project"],
    },
  },
  {
    name: "identify_active_project",
    description: "Automatically identify the active project ID based on a folder path or CWD.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "The current working directory or folder path" },
      },
      required: ["path"],
    },
  },
  {
    name: "index_codebase",
    description: "Scans a local directory and indexes the raw source code files into memory graph.",
    inputSchema: {
      type: "object" as const,
      properties: {
        directoryPath: { type: "string", description: "Absolute directory path to index" },
        sessionId: { type: "string", description: "Target session ID" },
      },
      required: ["directoryPath"],
    },
  },
];

// ── Server setup ────────────────────────────────────────────────────
const server = new Server(
  { name: "nowledge-mem", version: "2.0.0" },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const sessions = await sessionStore.getSessions();
  return {
    resources: sessions.map(s => ({
      uri: `nowledgemem://spaces/${s._id}/graph`,
      name: `${s.projectName} Knowledge Graph`,
      mimeType: "text/markdown",
      description: `Structured knowledge graph facts for space ${s.projectName}`,
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/^nowledgemem:\/\/spaces\/([^/]+)\/graph$/);
  if (!match) {
    throw new Error(`Resource not found: ${uri}`);
  }
  const spaceId = match[1];
  const summary = await getSummary({ project: spaceId });
  return {
    contents: [
      {
        uri,
        mimeType: "text/markdown",
        text: summary.summary,
      },
    ],
  };
});

// ── Main Tool Call Dispatcher ───────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      // 1. memory_add / store_memory
      case "memory_add":
      case "store_memory": {
        const result = await memoryAdd(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 2. memory_search / search_memory
      case "memory_search":
      case "search_memory": {
        const query = (args as any).query || (args as any).prompt;
        const limit = (args as any).limit || (args as any).topN;
        const result = await memorySearch({ ...(args as any), query, limit });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 3. get_memory_by_id
      case "get_memory_by_id": {
        const result = await getMemoryById(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 4. memory_update
      case "memory_update": {
        const result = await memoryUpdate(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 5. memory_delete / prune_memory
      case "memory_delete": {
        const result = await memoryDelete(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }
      case "prune_memory": {
        if ((args as any).memory_id || (args as any).id) {
          const result = await memoryDelete(args as any);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        const result = await prune(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 6. memory_relation_add
      case "memory_relation_add": {
        const result = await memoryRelationAdd(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 7. memory_relation_list
      case "memory_relation_list": {
        const result = await memoryRelationList(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 8. memory_relation_delete
      case "memory_relation_delete": {
        const result = await memoryRelationDelete(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 9. memory_evolves_chain
      case "memory_evolves_chain": {
        const result = await memoryEvolvesChain(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 10. memory_supersede
      case "memory_supersede": {
        const result = await memorySupersede(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 11. query_sources
      case "query_sources": {
        const result = await querySources(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 12. read_source_content
      case "read_source_content": {
        const result = await readSourceContent(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 13. list_communities
      case "list_communities": {
        const result = await listCommunities(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 14. run_community_detection
      case "run_community_detection": {
        const result = await runCommunityDetection(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 15. get_community_details
      case "get_community_details": {
        const result = await getCommunityDetails(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 16. read_working_memory / get_working_memory
      case "read_working_memory":
      case "get_working_memory": {
        const result = await readWorkingMemory(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 17. update_working_memory
      case "update_working_memory": {
        const result = await updateWorkingMemoryTool(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 18. list_spaces / list_projects
      case "list_spaces":
      case "list_projects": {
        const result = await listSpaces();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 19. get_space_profile
      case "get_space_profile": {
        const result = await getSpaceProfile(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 19. explore_graph
      case "explore_graph": {
        const result = await exploreGraph(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 20. graph_stats
      case "graph_stats": {
        const result = await graphStats();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 21. mem_fs
      case "mem_fs": {
        const result = await memFs(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 22. check_claims
      case "check_claims": {
        const result = await checkClaims(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 23. list_timeline_reviews
      case "list_timeline_reviews": {
        const result = await listTimelineReviews(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 24. resolve_timeline_review
      case "resolve_timeline_review": {
        const result = await resolveTimelineReview(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 21. recall_context
      case "recall_context": {
        const result = await recall(args as any);
        return {
          content: [{ type: "text", text: result.context }],
        };
      }

      // 22. get_project_summary
      case "get_project_summary": {
        const result = await getSummary(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 23. identify_active_project
      case "identify_active_project": {
        const result = await identifyProject(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // 24. index_codebase
      case "index_codebase": {
        const result = await indexCodebase(args as any);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    logger.error(`MCP Tool Error in [${name}]:`, err?.message || err);
    return {
      isError: true,
      content: [{ type: "text", text: `Error executing ${name}: ${err?.message || String(err)}` }],
    };
  }
});

// ── Start MCP stdio server ──────────────────────────────────────────
async function run() {
  await initStorage();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("[MCP] Nowledge Mem MCP server running on stdio");
}

run().catch((err) => {
  logger.error("MCP Server fatal error:", err);
  process.exit(1);
});
