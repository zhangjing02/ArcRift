import { Router, Request, Response } from "express";
import { migrationService } from "../services/migration";
import { logger } from "../utils/logger";

const router = Router();

// GET /api/migration/export/settings
router.get("/export/settings", (_req: Request, res: Response) => {
  try {
    const data = migrationService.exportSettingsBackup();
    res.setHeader("Content-Disposition", 'attachment; filename="nowledge-mem-settings.json"');
    res.setHeader("Content-Type", "application/json");
    res.json(data);
  } catch (err: any) {
    logger.error("Failed to export settings:", err);
    res.status(500).json({ error: "Failed to export settings" });
  }
});

// GET /api/migration/export/knowledge
router.get("/export/knowledge", (_req: Request, res: Response) => {
  try {
    const data = migrationService.exportKnowledgeBackup();
    res.setHeader("Content-Disposition", 'attachment; filename="nowledge-mem-backup.json"');
    res.setHeader("Content-Type", "application/json");
    res.json(data);
  } catch (err: any) {
    logger.error("Failed to export knowledge:", err);
    res.status(500).json({ error: "Failed to export knowledge" });
  }
});

// POST /api/migration/import/settings
router.post("/import/settings", (req: Request, res: Response) => {
  try {
    migrationService.importSettingsBackup(req.body);
    res.json({ success: true, message: "设置恢复成功" });
  } catch (err: any) {
    logger.error("Failed to import settings:", err);
    res.status(500).json({ error: err.message || "Failed to import settings" });
  }
});

// POST /api/migration/import/knowledge
router.post("/import/knowledge", (req: Request, res: Response) => {
  const { data, mode } = req.body;
  try {
    const result = migrationService.importKnowledgeBackup(data, mode || "merge");
    res.json({ success: true, message: "知识库恢复成功", result });
  } catch (err: any) {
    logger.error("Failed to import knowledge:", err);
    res.status(500).json({ error: err.message || "Failed to import knowledge" });
  }
});

export default router;
