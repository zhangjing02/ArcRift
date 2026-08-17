import { Router, Request, Response } from "express";
import { memoryStore, graphStore, vectorStore, sessionStore } from "../services/storage";
import { extractTriples } from "../services/extractor";
import { slidingWindowChunks } from "../services/chunker";
import { logger } from "../utils/logger";
import { isValidObjectId } from "../utils/validators";

const router = Router();

// GET /api/memories
router.get("/", async (req: Request, res: Response) => {
  const { sessionId, importance, category, query } = req.query;

  try {
    const sId = typeof sessionId === "string" ? sessionId : undefined;
    const imp = typeof importance === "string" ? (importance as any) : undefined;
    const cat = typeof category === "string" ? category : undefined;
    const q = typeof query === "string" ? query : undefined;

    const memories = await memoryStore.getMemories(sId, { importance: imp, category: cat, query: q });
    res.json({ success: true, memories });
  } catch (err: any) {
    logger.error("Failed to fetch memories:", err?.message);
    res.status(500).json({ error: "Failed to fetch memories" });
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

// POST /api/memories
router.post("/", async (req: Request, res: Response) => {
  const { sessionId, title, content, importance = "medium", category = "Note", tags = [], source = "manual" } = req.body;

  if (!sessionId || !content) {
    res.status(400).json({ error: "sessionId and content are required" });
    return;
  }

  if (!isValidObjectId(sessionId)) {
    res.status(400).json({ error: "Invalid sessionId format" });
    return;
  }

  try {
    // Ensure session exists
    let session = await sessionStore.getSession(sessionId);
    if (!session) {
      session = await sessionStore.getSessionByName(sessionId);
      if (!session) {
        session = await sessionStore.createSession(sessionId, "manual", undefined, sessionId);
      }
    }

    const effectiveSessionId = session._id;

    // 1. Create Memory Card
    const memory = await memoryStore.createMemory({
      sessionId: effectiveSessionId,
      title: title || (content.slice(0, 40) + (content.length > 40 ? "..." : "")),
      content,
      importance,
      category,
      tags: Array.isArray(tags) ? tags : [],
      source,
    });

    // 2. Extract Triples for Knowledge Graph (if meaningful content)
    let triplesCount = 0;
    if (content.length >= 20) {
      try {
        const { triples } = await extractTriples(content);
        for (const t of triples) {
          await graphStore.saveTriple({
            ...t,
            sessionId: effectiveSessionId,
            timestamp: new Date().toISOString(),
          });
        }
        triplesCount = triples.length;

        if (triplesCount > 0) {
          await sessionStore.updateSession(effectiveSessionId, {
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
      const chunks = slidingWindowChunks(content, effectiveSessionId, 150, 50);
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

export default router;
