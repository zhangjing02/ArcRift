import express, { Router, Request, Response } from "express";
import { migrationService } from "../services/migration";
import { logger } from "../utils/logger";

const router = Router();

// GET /api/migration/export/settings
router.get("/export/settings", (_req: Request, res: Response) => {
  try {
    const data = migrationService.exportSettingsBackup();
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="nowledge-mem-settings-${dateStr}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(data);
  } catch (err: any) {
    logger.error("Failed to export settings:", err);
    res.status(500).json({ error: "Failed to export settings" });
  }
});

// GET /api/migration/export/knowledge (Single JSON)
router.get("/export/knowledge", (_req: Request, res: Response) => {
  try {
    const data = migrationService.exportKnowledgeBackup();
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="nowledge-mem-knowledge-backup-${dateStr}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(data);
  } catch (err: any) {
    logger.error("Failed to export knowledge:", err);
    res.status(500).json({ error: "Failed to export knowledge" });
  }
});

// GET /api/migration/export/zip (NowledgeMem Standard ZIP)
router.get("/export/zip", (_req: Request, res: Response) => {
  try {
    const zipBuffer = migrationService.exportKnowledgeZip();
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="nowledge-mem-export-${dateStr}.zip"`);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", zipBuffer.length.toString());
    res.send(zipBuffer);
  } catch (err: any) {
    logger.error("Failed to export knowledge zip:", err);
    res.status(500).json({ error: "Failed to export knowledge zip: " + (err.message || String(err)) });
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

// POST /api/migration/import/knowledge (Single JSON)
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

// POST /api/migration/import/zip (Standard ZIP / JSON fallback)
router.post(
  "/import/zip",
  express.raw({ type: ["application/zip", "application/x-zip-compressed", "application/octet-stream", "application/x-zip"], limit: "300mb" }),
  (req: Request, res: Response) => {
    try {
      const mode = (req.query.mode as any) || req.body?.mode || "merge";
      let buffer: Buffer | null = null;

      if (Buffer.isBuffer(req.body)) {
        buffer = req.body;
      } else if (req.body?.zipBase64) {
        buffer = Buffer.from(req.body.zipBase64, "base64");
      }

      if (!buffer || buffer.length === 0) {
        return res.status(400).json({ error: "请上传有效的 Zip 数据" });
      }

      const result = migrationService.importKnowledgeZip(buffer, mode);
      res.json({ success: true, message: "知识库恢复成功", result });
    } catch (err: any) {
      logger.error("Failed to import knowledge zip:", err);
      res.status(500).json({ error: err.message || "Failed to import knowledge zip" });
    }
  }
);

export default router;

