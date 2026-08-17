import { Router, Request, Response } from "express";
import { sourceStore, sessionStore } from "../services/storage";
import { logger } from "../utils/logger";

const router = Router();

// GET /api/sources
router.get("/", async (req: Request, res: Response) => {
  const { sessionId, spaceId, sourceType, lifecycleState, query, limit } = req.query;

  try {
    const sId = typeof spaceId === "string" ? spaceId : (typeof sessionId === "string" ? sessionId : undefined);
    const sources = await sourceStore.getSources(sId, {
      sourceType: typeof sourceType === "string" ? sourceType : undefined,
      lifecycleState: typeof lifecycleState === "string" ? lifecycleState : undefined,
      query: typeof query === "string" ? query : undefined,
      limit: typeof limit === "string" ? parseInt(limit, 10) : undefined,
    });
    res.json({ success: true, sources });
  } catch (err: any) {
    logger.error("Failed to fetch sources:", err?.message);
    res.status(500).json({ error: "Failed to fetch sources" });
  }
});

// GET /api/sources/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const source = await sourceStore.getSource(req.params.id as string);
    if (!source) {
      res.status(404).json({ error: "Source not found" });
      return;
    }
    res.json({ success: true, source });
  } catch (err: any) {
    logger.error("Failed to get source:", err?.message);
    res.status(500).json({ error: "Failed to get source" });
  }
});

// POST /api/sources (Create or Upsert Source)
router.post("/", async (req: Request, res: Response) => {
  const {
    id,
    sessionId,
    space_id,
    spaceId,
    name,
    sourceType = "file",
    source_type,
    url,
    filePath,
    summary,
    rawContent,
    labels = [],
    lifecycleState = "indexed",
    metadata = {},
  } = req.body;

  const effectiveSessionId = space_id || spaceId || sessionId || "default";

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
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

    const created = await sourceStore.createSource({
      id: id || undefined,
      sessionId: session._id,
      name,
      sourceType: (source_type || sourceType) as any,
      url,
      filePath,
      summary,
      rawContent,
      labels: Array.isArray(labels) ? labels : [],
      lifecycleState,
      metadata,
    });

    res.json({ success: true, source: created });
  } catch (err: any) {
    logger.error("Failed to create source:", err?.message);
    res.status(500).json({ error: "Failed to create source" });
  }
});

// DELETE /api/sources/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const success = await sourceStore.deleteSource(req.params.id as string);
    if (!success) {
      res.status(404).json({ error: "Source not found" });
      return;
    }
    res.json({ success: true, message: "Source deleted" });
  } catch (err: any) {
    logger.error("Failed to delete source:", err?.message);
    res.status(500).json({ error: "Failed to delete source" });
  }
});

export default router;
