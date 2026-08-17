import { Router, Request, Response } from "express";
import {
  getAllModelStatuses,
  startModelDownload,
  deleteModel,
} from "../services/modelManager";
import { logger } from "../utils/logger";

const router = Router();

// GET /api/models/status
router.get("/status", (_req: Request, res: Response) => {
  try {
    const models = getAllModelStatuses();
    res.json({ success: true, models });
  } catch (err: any) {
    logger.error("Failed to get model statuses:", err);
    res.status(500).json({ error: "Failed to get model statuses" });
  }
});

// POST /api/models/download
router.post("/download", async (req: Request, res: Response) => {
  const { modelId } = req.body;
  if (!modelId) {
    res.status(400).json({ error: "modelId is required" });
    return;
  }

  try {
    const result = await startModelDownload(modelId);
    res.json(result);
  } catch (err: any) {
    logger.error(`Failed to start download for ${modelId}:`, err);
    res.status(500).json({ error: err.message || "Failed to start download" });
  }
});

// DELETE /api/models/:id
router.delete("/:id", (req: Request, res: Response) => {
  const modelId = req.params.id;
  try {
    const result = deleteModel(modelId);
    res.json(result);
  } catch (err: any) {
    logger.error(`Failed to delete model ${modelId}:`, err);
    res.status(500).json({ error: err.message || "Failed to delete model" });
  }
});

export default router;
