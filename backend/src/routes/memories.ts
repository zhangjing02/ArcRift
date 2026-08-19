import { Router, Request, Response } from "express";
import { memoryStore, graphStore, vectorStore, sessionStore } from "../services/storage";
import { extractTriples } from "../services/extractor";
import { slidingWindowChunks } from "../services/chunker";
import { logger } from "../utils/logger";
import { analyzeMemoryDimensions } from "../services/memoryEvaluator";
import { getSqlite } from "../services/sqlite";
import { getAutoEvaluatorState, runMemorySelfEvaluation } from "../services/memoryAutoEvaluator";
import { generateEmbeddings } from "../services/embeddings";

const router = Router();

// GET /api/memories
router.get("/", async (req: Request, res: Response) => {
  const { sessionId, spaceId, importance, category, unitType, query, limit } = req.query;

  try {
    const sId = typeof spaceId === "string" ? spaceId : (typeof sessionId === "string" ? sessionId : undefined);
    const imp = typeof importance === "string" ? importance : undefined;
    const cat = typeof category === "string" ? category : undefined;
    const uType = typeof unitType === "string" ? unitType : undefined;
    const q = typeof query === "string" ? query : undefined;
    const lim = typeof limit === "string" ? parseInt(limit, 10) : undefined;

    const memories = await memoryStore.getMemories(sId, {
      importance: imp,
      category: cat,
      unitType: uType,
      query: q,
      limit: lim,
    });
    res.json({ success: true, memories });
  } catch (err: any) {
    logger.error("Failed to fetch memories:", err?.message);
    res.status(500).json({ error: "Failed to fetch memories" });
  }
});

// POST /api/memories/search (Hybrid search matching Nowledge Mem memory_search)
router.post("/search", async (req: Request, res: Response) => {
  const { query, space_id, spaceId, sessionId, filter_labels, filterLabels, unit_type, unitType, category, limit, confidence_threshold, confidenceThreshold, mode } = req.body;

  try {
    const targetSpace = space_id || spaceId || sessionId;
    const labels = filter_labels ? filter_labels.split(",").map((s: string) => s.trim()) : filterLabels;
    const results = await memoryStore.searchMemories({
      query,
      spaceId: targetSpace,
      filterLabels: labels,
      unitType: unit_type || unitType,
      category,
      limit: limit ? parseInt(limit, 10) : 10,
      confidenceThreshold: confidence_threshold !== undefined ? parseFloat(confidence_threshold) : (confidenceThreshold !== undefined ? parseFloat(confidenceThreshold) : 0),
      mode: mode || "normal",
    });

    res.json({ success: true, results, count: results.length });
  } catch (err: any) {
    logger.error("Failed to search memories:", err?.message);
    res.status(500).json({ error: "Failed to search memories" });
  }
});

// GET /api/memories/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const memory = await memoryStore.getMemory(req.params.id as string);
    if (!memory) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    res.json({ success: true, memory });
  } catch (err: any) {
    logger.error("Failed to get memory:", err?.message);
    res.status(500).json({ error: "Failed to get memory" });
  }
});

// POST /api/memories (Create or Upsert Memory)
router.post("/", async (req: Request, res: Response) => {
  const {
    id,
    sessionId,
    space_id,
    spaceId,
    title,
    content,
    importance = 0.5,
    category = "Note",
    unit_type,
    unitType = "context",
    labels = [],
    tags = [],
    claim_status,
    claimStatus = "asserted",
    evolves_from_id,
    evolvesFromId,
    evolves_relation,
    evolvesRelation,
    source = "manual",
    source_app,
    sourceApp,
    temporal_context,
    temporalContext = "timeless",
  } = req.body;

  const effectiveSessionId = space_id || spaceId || sessionId || "default";

  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  try {
    // Ensure session exists
    let session = await sessionStore.getSession(effectiveSessionId);
    if (!session) {
      session = await sessionStore.getSessionByName(effectiveSessionId);
      if (!session) {
        session = await sessionStore.createSession(effectiveSessionId, "manual", undefined, effectiveSessionId);
      }
    }

    const mergedLabels = Array.isArray(labels) ? labels : (Array.isArray(tags) ? tags : []);
    const evalRes = analyzeMemoryDimensions(title || "", content);
    const effectiveImportance = req.body.importance !== undefined ? importance : evalRes.finalScore;

    // 1. Create/Upsert Memory Card in SQLite
    const memory = await memoryStore.createMemory({
      id: id || undefined,
      sessionId: session._id,
      title: title || (content.slice(0, 40) + (content.length > 40 ? "..." : "")),
      content,
      importance: effectiveImportance,
      category,
      unitType: (unit_type || unitType) as any,
      labels: mergedLabels,
      tags: mergedLabels,
      claimStatus: (claim_status || claimStatus) as any,
      evolvesFromId: evolves_from_id || evolvesFromId,
      evolvesRelation: (evolves_relation || evolvesRelation) as any,
      source,
      sourceApp: source_app || sourceApp,
      temporalContext: temporal_context || temporalContext,
    });

    // 2. Extract Triples for Knowledge Graph (if meaningful content)
    let triplesCount = 0;
    if (content.length >= 20) {
      try {
        const { triples } = await extractTriples(content);
        for (const t of triples) {
          await graphStore.saveTriple({
            ...t,
            sessionId: session._id,
            timestamp: new Date().toISOString(),
          });
        }
        triplesCount = triples.length;

        if (triplesCount > 0) {
          await sessionStore.updateSession(session._id, {
            tripleCount: (session.tripleCount || 0) + triplesCount,
            updatedAt: new Date(),
          });
        }
      } catch (e) {
        logger.warn("Memory triple extraction non-fatal warning:", e);
      }
    }

    // 3. Store vector chunks
    try {
      const chunks = slidingWindowChunks(content, session._id, 150, 50);
      await vectorStore.storeChunks(chunks);
    } catch (e) {
      logger.warn("Memory vector storage non-fatal warning:", e);
    }

    res.json({
      success: true,
      memory,
      triplesExtracted: triplesCount,
    });
  } catch (err: any) {
    logger.error("Failed to create memory:", err?.message);
    res.status(500).json({ error: "Failed to create memory" });
  }
});

// PATCH /api/memories/:id
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const updated = await memoryStore.updateMemory(req.params.id as string, req.body);
    if (!updated) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    res.json({ success: true, memory: updated });
  } catch (err: any) {
    logger.error("Failed to update memory:", err?.message);
    res.status(500).json({ error: "Failed to update memory" });
  }
});

// DELETE /api/memories/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const success = await memoryStore.deleteMemory(req.params.id as string);
    if (!success) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    res.json({ success: true, message: "Memory deleted" });
  } catch (err: any) {
    logger.error("Failed to delete memory:", err?.message);
    res.status(500).json({ error: "Failed to delete memory" });
  }
});

// ── Memory Relations Endpoints (P1) ─────────────────────────────────

// POST /api/memories/relations
router.post("/relations", async (req: Request, res: Response) => {
  const { source_memory_id, sourceMemoryId, target_memory_id, targetMemoryId, relation_type, relationType, reason, strength, confidence, bidirectional, status } = req.body;
  const src = source_memory_id || sourceMemoryId;
  const tgt = target_memory_id || targetMemoryId;
  const rel = relation_type || relationType;

  if (!src || !tgt || !rel) {
    res.status(400).json({ error: "sourceMemoryId, targetMemoryId, and relationType are required" });
    return;
  }

  try {
    const relation = await memoryStore.addRelation({
      sourceMemoryId: src,
      targetMemoryId: tgt,
      relationType: rel,
      reason,
      strength,
      confidence,
      bidirectional,
      status,
    });
    res.json({ success: true, relation });
  } catch (err: any) {
    logger.error("Failed to add relation:", err?.message);
    res.status(500).json({ error: "Failed to add relation" });
  }
});

// GET /api/memories/:id/relations
router.get("/:id/relations", async (req: Request, res: Response) => {
  const { direction, relationTypes, status, limit } = req.query;

  try {
    const types = typeof relationTypes === "string" ? relationTypes.split(",") : undefined;
    const relations = await memoryStore.listRelations(req.params.id as string, {
      direction: direction as any,
      relationTypes: types,
      status: typeof status === "string" ? status : undefined,
      limit: typeof limit === "string" ? parseInt(limit, 10) : undefined,
    });
    res.json({ success: true, relations });
  } catch (err: any) {
    logger.error("Failed to list relations:", err?.message);
    res.status(500).json({ error: "Failed to list relations" });
  }
});

// DELETE /api/memories/relations/:relationId
router.delete("/relations/:relationId", async (req: Request, res: Response) => {
  try {
    const success = await memoryStore.deleteRelation(req.params.relationId as string);
    if (!success) {
      res.status(404).json({ error: "Relation not found" });
      return;
    }
    res.json({ success: true, message: "Relation deleted" });
  } catch (err: any) {
    logger.error("Failed to delete relation:", err?.message);
    res.status(500).json({ error: "Failed to delete relation" });
  }
});

// ── Memory Evolution Endpoints (P2) ─────────────────────────────────

// GET /api/memories/:id/evolves-chain
router.get("/:id/evolves-chain", async (req: Request, res: Response) => {
  const { maxDepth } = req.query;

  try {
    const chainData = await memoryStore.getEvolutionChain(
      req.params.id as string,
      typeof maxDepth === "string" ? parseInt(maxDepth, 10) : 10
    );
    res.json({ success: true, ...chainData });
  } catch (err: any) {
    logger.error("Failed to get evolution chain:", err?.message);
    res.status(500).json({ error: "Failed to get evolution chain" });
  }
});

// POST /api/memories/supersede
router.post("/supersede", async (req: Request, res: Response) => {
  const { old_memory_id, oldMemoryId, new_memory_id, newMemoryId, reason } = req.body;
  const oldId = old_memory_id || oldMemoryId;
  const newId = new_memory_id || newMemoryId;

  if (!oldId || !newId) {
    res.status(400).json({ error: "oldMemoryId and newMemoryId are required" });
    return;
  }

  try {
    const result = await memoryStore.supersedeMemory(oldId, newId, reason);
    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error("Failed to supersede memory:", err?.message);
    res.status(500).json({ error: "Failed to supersede memory" });
  }
});

// POST /api/memories/re-evaluate (Re-score all memories with dynamic multi-dimensional evaluation)
router.post("/re-evaluate", async (_req: Request, res: Response) => {
  try {
    const memories = await memoryStore.getMemories();
    const results: any[] = [];
    const db = getSqlite();
    const updateStmt = db.prepare("UPDATE memories SET importance = ?, updatedAt = ? WHERE id = ?");

    for (const m of memories) {
      const evalRes = analyzeMemoryDimensions(m.title, m.content);
      updateStmt.run(evalRes.finalScore, new Date().toISOString(), m.id);
      results.push({
        id: m.id,
        title: m.title,
        oldScore: m.importance,
        newScore: evalRes.finalScore,
        starRating: evalRes.starRating,
        level: evalRes.level,
        dimensions: {
          importance: evalRes.importance,
          knowledgeDensity: evalRes.knowledgeDensity,
          actionability: evalRes.actionability,
          impactScope: evalRes.impactScope,
          timelessness: evalRes.timelessness,
        },
        reason: evalRes.reason,
      });
    }

    res.json({
      success: true,
      totalEvaluated: results.length,
      results,
    });
  } catch (err: any) {
    logger.error("Failed to re-evaluate memories:", err?.message);
    res.status(500).json({ error: "Failed to re-evaluate memories" });
  }
});

// GET /api/memories/auto-evaluator/status
router.get("/auto-evaluator/status", async (_req: Request, res: Response) => {
  try {
    const status = getAutoEvaluatorState();
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get auto-evaluator status" });
  }
});

// POST /api/memories/auto-evaluator/trigger
router.post("/auto-evaluator/trigger", async (_req: Request, res: Response) => {
  try {
    const result = await runMemorySelfEvaluation();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to trigger auto-evaluation" });
  }
});

// POST /api/memories/reindex (Rebuild FTS5 and Vector embeddings for selected or all memories)
router.post("/reindex", async (req: Request, res: Response) => {
  const { ids } = req.body;
  try {
    const db = getSqlite();
    let targetMemories: any[] = [];
    if (Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      targetMemories = db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`).all(...ids) as any[];
    } else {
      targetMemories = db.prepare("SELECT * FROM memories").all() as any[];
    }

    let reindexedCount = 0;
    for (const mem of targetMemories) {
      let labels: string[] = [];
      try {
        if (mem.labels) labels = JSON.parse(mem.labels);
      } catch {}

      // 1. Refresh FTS5 full-text index
      try {
        db.prepare("DELETE FROM fts_memories WHERE memory_id = ?").run(mem.id);
        db.prepare("INSERT INTO fts_memories (memory_id, title, content, labels) VALUES (?, ?, ?, ?)").run(
          mem.id,
          mem.title || "",
          mem.content || "",
          labels.join(" ")
        );
      } catch (ftsErr) {
        logger.warn(`[Reindex] FTS5 error for ${mem.id}:`, ftsErr);
      }

      // 2. Refresh Vector Embeddings index
      try {
        const textToEmbed = `${mem.title}\n${mem.content}`;
        const [vec] = await generateEmbeddings([textToEmbed], "document");
        if (vec && vec.length > 0) {
          const chunkId = `mem_chunk_${mem.id}`;
          await vectorStore.saveChunk(chunkId, mem.sessionId || "default", mem.content, vec, {
            memoryId: mem.id,
            title: mem.title,
            category: mem.category,
            unitType: mem.unit_type,
          });
        }
      } catch (vecErr) {
        logger.debug(`[Reindex] Vector embedding skipped for ${mem.id}:`, vecErr);
      }

      reindexedCount++;
    }

    logger.success(`[Reindex] Successfully re-indexed ${reindexedCount} memory item(s)`);
    res.json({ success: true, count: reindexedCount, message: `成功重建 ${reindexedCount} 条记忆索引` });
  } catch (err: any) {
    logger.error("Failed to reindex memories:", err?.message);
    res.status(500).json({ error: "Failed to reindex memories" });
  }
});

// POST /api/memories/batch-delete
router.post("/batch-delete", async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids array is required" });
    return;
  }

  try {
    const db = getSqlite();
    let deletedCount = 0;
    for (const id of ids) {
      db.prepare("DELETE FROM memories WHERE id = ?").run(id);
      try {
        db.prepare("DELETE FROM fts_memories WHERE memory_id = ?").run(id);
        db.prepare("DELETE FROM memory_relations WHERE source_memory_id = ? OR target_memory_id = ?").run(id, id);
      } catch {}
      deletedCount++;
    }

    logger.success(`[Memories] Batch deleted ${deletedCount} memory item(s)`);
    res.json({ success: true, deletedCount });
  } catch (err: any) {
    logger.error("Failed to batch delete memories:", err?.message);
    res.status(500).json({ error: "Failed to batch delete memories" });
  }
});

// POST /api/memories/batch-move
router.post("/batch-move", async (req: Request, res: Response) => {
  const { ids, spaceId } = req.body;
  if (!Array.isArray(ids) || !spaceId) {
    res.status(400).json({ error: "ids and spaceId are required" });
    return;
  }

  try {
    const db = getSqlite();
    let movedCount = 0;
    for (const id of ids) {
      db.prepare("UPDATE memories SET sessionId = ?, updatedAt = ? WHERE id = ?").run(spaceId, new Date().toISOString(), id);
      movedCount++;
    }

    res.json({ success: true, movedCount });
  } catch (err: any) {
    logger.error("Failed to batch move memories:", err?.message);
    res.status(500).json({ error: "Failed to batch move memories" });
  }
});

export default router;
