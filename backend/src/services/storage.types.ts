import { WindowChunk } from "./chunker";

export interface Session {
  _id: string;
  projectName: string;
  platform: string;
  summary?: string;
  tripleCount: number;
  hasFullChat: boolean;
  topicCount: number;
  externalChatId?: string;
  tokensSaved?: number;
  retrievalCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FullChat {
  sessionId: string;
  rawText: string;
  processedText?: string; // v1.4.7: Track what has already been extracted for triples
  messageCount: number;
  platform: string;
  createdAt: Date;
}

export interface Job {
  _id: string;
  type: "triple_extraction";
  payload: any;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  deadLettered: boolean;
  failedAt?: Date;
  error?: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Triple {
  subject: string;
  subjectType: string;
  relation: string;
  object: string;
  objectType: string;
  sessionId: string;
  timestamp: string;
}

export interface RetrievedChunk {
  chunkIndex: number;
  content: string;
  score: number;
  engines?: string[];
  [key: string]: any;
}

export interface ISessionStore {
  // Session
  createSession(projectName: string, platform: string, externalChatId?: string, customId?: string): Promise<Session>;
  getSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session | null>;
  getSessionByName(projectName: string): Promise<Session | null>;
  getSessionByExternalId(externalChatId: string): Promise<Session | null>;
  updateSession(id: string, update: Partial<Session>): Promise<void>;
  deleteSession(id: string): Promise<void>;
  mergeSession(sourceId: string, targetId: string): Promise<void>;

  // Active Session
  getActiveSessionId(): Promise<string | null>;
  setActiveSessionId(sessionId: string | null): Promise<void>;

  // Full Chat
  saveFullChat(sessionId: string, rawText: string, messageCount: number, platform: string): Promise<void>;
  updateFullChat(sessionId: string, update: Partial<FullChat>): Promise<void>;
  getFullChat(sessionId: string): Promise<FullChat | null>;

  // Jobs
  createJob(type: string, payload: any): Promise<Job>;
  getNextJob(): Promise<Job | null>;
  updateJob(id: string, update: Partial<Job>): Promise<void>;
  getJobStatus(): Promise<{ pending: number; processing: number; deadLettered: number }>;
  getJobStatusBySession(sessionId: string): Promise<{ pending: number; processing: number; deadLettered: number }>;
  resetGhostJobs(): Promise<void>;
  clearJobs(): Promise<void>;
}

export interface IGraphStore {
  saveTriple(triple: Triple): Promise<void>;
  getTripleCountBySession(sessionId: string): Promise<number>;
  getTriplesBySession(sessionId: string): Promise<Triple[]>;
  getGraphData(filters: { sessionId?: string; type?: string; relation?: string; limit?: number }): Promise<{ nodes: any[]; links: any[] }>;
  findRelatedTriples(entities: string[], sessionId: string): Promise<Triple[]>;
  findRelatedTriplesGlobal(entities: string[]): Promise<Triple[]>;
  deleteTriples(entities: string[], sessionId: string): Promise<number>;
  renameNode(oldName: string, newName: string, sessionId?: string): Promise<number>;
  deleteEdge(source: string, target: string, relation: string, sessionId?: string): Promise<number>;
  mergeSession(sourceId: string, targetId: string): Promise<void>;
}

export interface IVectorStore {
  storeChunks(chunks: WindowChunk[]): Promise<void>;
  storeFileChunks(chunks: WindowChunk[]): Promise<void>;
  retrieveRelevantChunks(query: string, sessionId: string, topN?: number, keywords?: string[]): Promise<RetrievedChunk[]>;
  retrieveGlobalChunks(query: string, topN?: number, keywords?: string[]): Promise<RetrievedChunk[]>;
  hybridSearch(query: string, sessionId: string, topN?: number): Promise<RetrievedChunk[]>;
  deleteChunksBySession(sessionId: string): Promise<void>;
  deleteChunksByFile(filePath: string, sessionId: string): Promise<number>;
  deleteChunksByQuery(query: string, sessionId: string): Promise<number>;
  mergeSession(sourceId: string, targetId: string): Promise<void>;
}

export type ImportanceLevel = "critical" | "high" | "medium" | "low";
export type MemoryCategory = "Architecture" | "Decision" | "Gotcha" | "Rule" | "Tech" | "Note";
export type UnitType = "fact" | "preference" | "decision" | "plan" | "procedure" | "learning" | "context" | "event";
export type ClaimStatus = "asserted" | "explored" | "proposed" | "planned" | "unverified";
export type EvolvesRelation = "replaces" | "enriches" | "confirms";

export interface Memory {
  id: string;
  sessionId: string; // Space ID or Session ID
  title: string;
  content: string;
  importance: number; // Normalized 0.1 - 1.0 (supports "critical" -> 1.0, "high" -> 0.8, "medium" -> 0.5, "low" -> 0.1)
  category: string;
  unitType: UnitType;
  labels: string[];
  tags: string[];
  claimStatus?: ClaimStatus;
  evolvesFromId?: string;
  evolvesRelation?: EvolvesRelation;
  isLatest?: boolean;
  source?: string;
  sourceApp?: string;
  temporalContext?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkingMemory {
  sessionId: string;
  briefing: string;
  focusAreas: string[];
  activeDecisions: string[];
  blockers: string[];
  lastGeneratedAt: Date;
  updatedAt: Date;
}

export interface MemorySearchFilters {
  spaceId?: string;
  sessionId?: string;
  filterLabels?: string[];
  unitType?: string;
  category?: string;
  importanceMin?: number;
  confidenceThreshold?: number;
  limit?: number;
  mode?: "normal" | "deep";
  query?: string;
}

export interface MemoryRelation {
  id: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  relationType: string;
  reason?: string;
  strength: number;
  confidence: number;
  bidirectional: boolean;
  status: "active" | "suggested";
  createdAt: Date;
  updatedAt: Date;
}

export interface Source {
  id: string;
  sessionId: string;
  name: string;
  sourceType: "url" | "file" | "document" | "note";
  url?: string;
  filePath?: string;
  summary?: string;
  rawContent?: string;
  labels: string[];
  lifecycleState: "parsed" | "indexed" | "extracted" | "stale" | "error";
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISourceStore {
  createSource(source: Partial<Source> & { name: string; sessionId?: string; spaceId?: string; sourceType?: string }): Promise<Source>;
  getSources(sessionId?: string, filters?: { sourceType?: string; lifecycleState?: string; labels?: string[]; query?: string; limit?: number }): Promise<Source[]>;
  getSource(id: string): Promise<Source | null>;
  deleteSource(id: string): Promise<boolean>;
}

export interface IMemoryStore {
  createMemory(memory: Partial<Memory> & { content: string; sessionId?: string; spaceId?: string }): Promise<Memory>;
  getMemories(sessionId?: string, filters?: { importance?: string | number; category?: string; query?: string; unitType?: string; labels?: string[]; limit?: number }): Promise<Memory[]>;
  searchMemories(filters: MemorySearchFilters): Promise<Array<Memory & { score?: number }>>;
  getMemory(id: string): Promise<Memory | null>;
  updateMemory(id: string, update: Partial<Memory>): Promise<Memory | null>;
  deleteMemory(id: string): Promise<boolean>;

  // Memory Relations
  addRelation(relation: {
    sourceMemoryId: string;
    targetMemoryId: string;
    relationType: string;
    reason?: string;
    strength?: number;
    confidence?: number;
    bidirectional?: boolean;
    status?: "active" | "suggested";
  }): Promise<MemoryRelation>;
  listRelations(memoryId: string, options?: { direction?: "out" | "in" | "both"; relationTypes?: string[]; status?: string; limit?: number }): Promise<MemoryRelation[]>;
  deleteRelation(relationId: string): Promise<boolean>;

  // Memory Evolution (P2)
  getEvolutionChain(memoryId: string, maxDepth?: number): Promise<{
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
  }>;
  supersedeMemory(oldMemoryId: string, newMemoryId: string, reason?: string): Promise<{
    status: string;
    oldMemory: { id: string; isLatest: boolean };
    newMemory: { id: string; isLatest: boolean; evolvesFromId: string };
  }>;

  // Working Memory
  getWorkingMemory(sessionId: string): Promise<WorkingMemory | null>;
  saveWorkingMemory(workingMemory: Partial<WorkingMemory> & { sessionId: string }): Promise<WorkingMemory>;
}
