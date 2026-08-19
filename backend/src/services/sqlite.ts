import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import path from "path";
import fs from "fs";
import { logger } from "../utils/logger";
import { getDbPath } from "../utils/paths";

let db: Database.Database;

export function initSqlite() {
  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  if (dbPath !== ":memory:" && !fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000"); // Wait up to 5s if DB is locked
  
  // Load sqlite-vec extension
  try {
    sqliteVec.load(db);
    logger.success("sqlite-vec extension loaded");
  } catch (err) {
    logger.error("Failed to load sqlite-vec extension. Vector search will be disabled.", err);
  }
  
  logger.success(`SQLite initialized at ${dbPath}`);
  
  createTables();
}

function createTables() {
  // Sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      projectName TEXT NOT NULL,
      platform TEXT,
      summary TEXT,
      tripleCount INTEGER DEFAULT 0,
      topicCount INTEGER DEFAULT 0,
      hasFullChat INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT,
      externalChatId TEXT UNIQUE
    )
  `);

  // Migration: Add externalChatId column if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as any[];
    const hasCol = tableInfo.some(col => col.name === "externalChatId");
    if (!hasCol) {
      // SQLite does NOT allow adding a UNIQUE column via ALTER TABLE
      // We must add it normally and then create a UNIQUE INDEX
      db.exec("ALTER TABLE sessions ADD COLUMN externalChatId TEXT");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_externalChatId ON sessions(externalChatId) WHERE externalChatId IS NOT NULL");
      logger.info("Database migration: Added externalChatId column and unique index");
    }

    // Ensure index allows multiple nulls if already exists
    try {
      db.exec("DROP INDEX IF EXISTS idx_sessions_externalChatId");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_externalChatId ON sessions(externalChatId) WHERE externalChatId IS NOT NULL");
    } catch {}

    const hasTokens = tableInfo.some(col => col.name === "tokensSaved");
    if (!hasTokens) {
      db.exec("ALTER TABLE sessions ADD COLUMN tokensSaved INTEGER DEFAULT 0");
      db.exec("ALTER TABLE sessions ADD COLUMN retrievalCount INTEGER DEFAULT 0");
      logger.info("Database migration: Added analytics columns to sessions (v1.5.5)");
    }
  } catch (e) {
    logger.warn(`Database migration warning: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Full Chats
  db.exec(`
    CREATE TABLE IF NOT EXISTS full_chats (
      sessionId TEXT PRIMARY KEY,
      rawText TEXT NOT NULL,
      processedText TEXT,
      messageCount INTEGER DEFAULT 0,
      platform TEXT,
      createdAt TEXT,
      FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Migration: Add processedText to full_chats if missing (v1.4.7)
  try {
    const tableInfo = db.prepare("PRAGMA table_info(full_chats)").all() as any[];
    if (!tableInfo.some(col => col.name === "processedText")) {
      db.exec("ALTER TABLE full_chats ADD COLUMN processedText TEXT");
      logger.info("Database migration: Added processedText to full_chats");
    }
  } catch (e) {
    logger.warn(`FullChat migration warning: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Active Session
  db.exec(`
    CREATE TABLE IF NOT EXISTS active_session (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      sessionId TEXT,
      FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE SET NULL
    )
  `);
  db.exec("INSERT OR IGNORE INTO active_session (id, sessionId) VALUES ('singleton', NULL)");

  // Jobs
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      deadLettered INTEGER DEFAULT 0,
      failedAt TEXT,
      error TEXT,
      attempts INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, createdAt)");

  // Facts (Knowledge Graph)
  db.exec(`
    CREATE TABLE IF NOT EXISTS facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL,
      subject TEXT NOT NULL,
      subjectType TEXT,
      relation TEXT NOT NULL,
      object TEXT NOT NULL,
      objectType TEXT,
      timestamp TEXT,
      FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_facts_session ON facts(sessionId)");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_facts_unique ON facts(sessionId, subject, relation, object)");

  // Vectors (RAG)
  // sqlite-vec uses virtual tables for vector search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
      chunk_id TEXT PRIMARY KEY,
      embedding float[768]
    )
  `);
  
  // Metadata for chunks (since vec0 is just for search)
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunk_metadata (
      chunk_id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      chunkIndex INTEGER,
      content TEXT NOT NULL,
      filePath TEXT,
      fileHash TEXT,
      FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);
  
  // Migration: Add filePath and fileHash to chunk_metadata (v1.5.6)
  try {
    const tableInfo = db.prepare("PRAGMA table_info(chunk_metadata)").all() as any[];
    if (!tableInfo.some(col => col.name === "filePath")) {
      db.exec("ALTER TABLE chunk_metadata ADD COLUMN filePath TEXT");
      db.exec("ALTER TABLE chunk_metadata ADD COLUMN fileHash TEXT");
      logger.info("Database migration: Added filePath and fileHash to chunk_metadata (v1.5.6)");
    }
  } catch (e) {
    logger.warn(`chunk_metadata migration warning: ${e instanceof Error ? e.message : String(e)}`);
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_chunks_session ON chunk_metadata(sessionId)");

  // High-precision Sentence Vectors (Small-to-Big Retrieval)
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_sentences USING vec0(
      sentence_id TEXT PRIMARY KEY,
      embedding float[768]
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sentence_metadata (
      sentence_id TEXT PRIMARY KEY,
      chunk_id TEXT NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY(chunk_id) REFERENCES chunk_metadata(chunk_id) ON DELETE CASCADE
    )
  `);

  // Hybrid Search (FTS5)
  // Indices text for fast keyword matching
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5(
      chunk_id UNINDEXED,
      content,
      tokenize='porter'
    )
  `);

  // Nowledge Mem: Structured Memories Stream
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      importance REAL DEFAULT 0.5,
      category TEXT DEFAULT 'Note',
      unit_type TEXT DEFAULT 'context',
      labels TEXT,
      tags TEXT,
      claim_status TEXT DEFAULT 'asserted',
      evolves_from_id TEXT,
      evolves_relation TEXT,
      is_latest INTEGER DEFAULT 1,
      source TEXT DEFAULT 'manual',
      source_app TEXT,
      temporal_context TEXT DEFAULT 'timeless',
      is_pinned INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Migration for memories columns
  try {
    const memInfo = db.prepare("PRAGMA table_info(memories)").all() as any[];
    const cols = memInfo.map(c => c.name);
    if (!cols.includes("unit_type")) {
      db.exec("ALTER TABLE memories ADD COLUMN unit_type TEXT DEFAULT 'context'");
      db.exec("ALTER TABLE memories ADD COLUMN labels TEXT");
      db.exec("ALTER TABLE memories ADD COLUMN claim_status TEXT DEFAULT 'asserted'");
      db.exec("ALTER TABLE memories ADD COLUMN evolves_from_id TEXT");
      db.exec("ALTER TABLE memories ADD COLUMN evolves_relation TEXT");
      db.exec("ALTER TABLE memories ADD COLUMN is_latest INTEGER DEFAULT 1");
      db.exec("ALTER TABLE memories ADD COLUMN source_app TEXT");
      db.exec("ALTER TABLE memories ADD COLUMN temporal_context TEXT DEFAULT 'timeless'");
      logger.info("Database migration: Added Nowledge Mem columns to memories table");
    }
    if (!cols.includes("is_pinned")) {
      db.exec("ALTER TABLE memories ADD COLUMN is_pinned INTEGER DEFAULT 0");
      logger.info("Database migration: Added is_pinned column to memories table");
    }
  } catch (e) {
    logger.warn(`Memories migration warning: ${e instanceof Error ? e.message : String(e)}`);
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(sessionId)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_memories_unit_type ON memories(unit_type)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_memories_latest ON memories(is_latest)");

  // Memories FTS5 Virtual Table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_memories USING fts5(
      memory_id UNINDEXED,
      title,
      content,
      labels,
      tokenize='porter'
    )
  `);

  // Nowledge Mem: Working Memory / Daily Briefing
  db.exec(`
    CREATE TABLE IF NOT EXISTS working_memory (
      sessionId TEXT PRIMARY KEY,
      briefing TEXT,
      focusAreas TEXT,
      activeDecisions TEXT,
      blockers TEXT,
      lastGeneratedAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Nowledge Mem P1: Memory Relations (Memory-to-Memory Links)
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_relations (
      id TEXT PRIMARY KEY,
      source_memory_id TEXT NOT NULL,
      target_memory_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      reason TEXT,
      strength REAL DEFAULT 1.0,
      confidence REAL DEFAULT 1.0,
      bidirectional INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(source_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      FOREIGN KEY(target_memory_id) REFERENCES memories(id) ON DELETE CASCADE
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_memrel_source ON memory_relations(source_memory_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_memrel_target ON memory_relations(target_memory_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_memrel_type ON memory_relations(relation_type)");

  // Nowledge Mem P1: Library Sources Management (URL, PDF, File Tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      url TEXT,
      filePath TEXT,
      summary TEXT,
      rawContent TEXT,
      labels TEXT,
      lifecycle_state TEXT DEFAULT 'indexed',
      metadata TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);
  // Nowledge Mem P2: Knowledge Communities (Louvain / Cluster Detection)
  db.exec(`
    CREATE TABLE IF NOT EXISTS communities (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      name TEXT NOT NULL,
      summary TEXT,
      member_count INTEGER DEFAULT 0,
      member_entities TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);
  // Nowledge Mem P3: Timeline Review Inbox & Conflict Governance
  db.exec(`
    CREATE TABLE IF NOT EXISTS timeline_reviews (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      memory_a_id TEXT NOT NULL,
      memory_b_id TEXT NOT NULL,
      conflict_type TEXT DEFAULT 'contradiction',
      conflict_reason TEXT,
      evidence_a TEXT,
      evidence_b TEXT,
      suggested_action TEXT DEFAULT 'keep_newer_as_latest',
      status TEXT DEFAULT 'pending',
      resolution_action TEXT,
      resolution_note TEXT,
      createdAt TEXT,
      resolvedAt TEXT,
      FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);
  // ChronosMind / Nowledge Mem: Skills (Agent Workflows & Best Practices)
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      trigger TEXT,
      steps TEXT,
      sourceTool TEXT,
      sourcePath TEXT,
      enabled INTEGER DEFAULT 1,
      tools TEXT,
      category TEXT,
      rawMarkdown TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_skills_enabled ON skills(enabled)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_skills_sourceTool ON skills(sourceTool)");

  logger.success("All SQLite tables initialized successfully");
}

export function getSqlite(): Database.Database {
  if (!db) initSqlite();
  return db;
}
