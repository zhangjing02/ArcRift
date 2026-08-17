import { ISessionStore, IGraphStore, IVectorStore, IMemoryStore } from "./storage.types";
import { SqliteSessionStore } from "./sqlite-session";
import { SqliteGraphStore } from "./sqlite-graph";
import { SqliteVectorStore } from "./sqlite-vector";
import { SqliteMemoryStore } from "./sqlite-memory";
import { initSqlite } from "./sqlite";
import { logger } from "../utils/logger";
import { getDbPath } from "../utils/paths";

// Pure SQLite Single-File Architecture (Zero-Docker)
const sessionStore: ISessionStore = new SqliteSessionStore();
const graphStore: IGraphStore = new SqliteGraphStore();
const vectorStore: IVectorStore = new SqliteVectorStore();
const memoryStore: IMemoryStore = new SqliteMemoryStore();

/**
 * Initializes the unified SQLite database, vector extension, and schemas.
 */
export async function initStorage(): Promise<void> {
  logger.info(`[Storage] Initializing Pure SQLite database at: \x1b[1;96m${getDbPath()}\x1b[0m`);
  initSqlite();
  logger.success("[Storage] SQLite database and vector search initialized successfully");
}

export * from "./storage.types";
export { sessionStore, graphStore, vectorStore, memoryStore };
