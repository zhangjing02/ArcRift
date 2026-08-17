import { Router, Request, Response } from "express";
import { intelligenceService } from "../services/intelligence";
import { logger } from "../utils/logger";
import { getSettings, saveSettings } from "../utils/settings";

const router = Router();

// GET /api/intelligence/stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await intelligenceService.getStorageStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    logger.error("Failed to get storage stats:", err);
    res.status(500).json({ error: "Failed to get storage stats" });
  }
});

// POST /api/intelligence/optimize
router.post("/optimize", async (_req: Request, res: Response) => {
  try {
    const result = await intelligenceService.optimizeDatabase();
    res.json(result);
  } catch (err: any) {
    logger.error("Failed to optimize database:", err);
    res.status(500).json({ error: "Failed to optimize database" });
  }
});

// POST /api/intelligence/rebuild-index
router.post("/rebuild-index", async (_req: Request, res: Response) => {
  try {
    const result = await intelligenceService.rebuildIndex();
    res.json(result);
  } catch (err: any) {
    logger.error("Failed to rebuild index:", err);
    res.status(500).json({ error: "Failed to rebuild index" });
  }
});

// POST /api/intelligence/clean-sessions
router.post("/clean-sessions", async (_req: Request, res: Response) => {
  try {
    const result = await intelligenceService.checkAndCleanSessions();
    res.json(result);
  } catch (err: any) {
    logger.error("Failed to clean sessions:", err);
    res.status(500).json({ error: "Failed to clean sessions" });
  }
});

// GET /api/intelligence/ontology
router.get("/ontology", (_req: Request, res: Response) => {
  try {
    const ontology = intelligenceService.getOntology();
    res.json({ success: true, ontology });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get ontology" });
  }
});

// POST /api/intelligence/ontology
router.post("/ontology", async (req: Request, res: Response) => {
  try {
    const { ontology } = req.body;
    if (!Array.isArray(ontology)) {
      res.status(400).json({ error: "ontology array is required" });
      return;
    }
    await intelligenceService.saveOntology(ontology);
    res.json({ success: true, message: "Ontology saved successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save ontology" });
  }
});

// GET /api/intelligence/policy
router.get("/policy", (_req: Request, res: Response) => {
  try {
    const policy = intelligenceService.getMemoryPolicy();
    res.json({ success: true, policy });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get policy" });
  }
});

// POST /api/intelligence/policy
router.post("/policy", async (req: Request, res: Response) => {
  try {
    const updated = await intelligenceService.saveMemoryPolicy(req.body);
    res.json({ success: true, policy: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save policy" });
  }
});

// GET /api/intelligence/token-usage
router.get("/token-usage", (_req: Request, res: Response) => {
  try {
    const usage = intelligenceService.getTokenUsageStats();
    res.json({ success: true, usage });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get token usage" });
  }
});

// POST /api/intelligence/settings (e.g. RAM limit, bg toggle)
router.post("/settings", async (req: Request, res: Response) => {
  try {
    const settings = getSettings();
    const { searchRamLimit, bgSmartActive, monthlyTokenBudget } = req.body;
    if (searchRamLimit !== undefined) (settings as any).searchRamLimit = searchRamLimit;
    if (bgSmartActive !== undefined) (settings as any).bgSmartActive = bgSmartActive;
    if (monthlyTokenBudget !== undefined) (settings as any).monthlyTokenBudget = monthlyTokenBudget;
    await saveSettings(settings);
    res.json({ success: true, message: "Intelligence settings updated" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
