import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";
import { getSqlite } from "./sqlite";
import { getDbPath, getDataDir } from "../utils/paths";

const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // Check every 12 hours
const BACKUP_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_BACKUPS = 4; // Keep roughly a month of backups

export async function runBackupCheck() {
  const dbPath = getDbPath();
  if (dbPath === ":memory:") return; // Don't backup in-memory DBs

  const backupDir = path.join(getDataDir(), "backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  try {
    // Check existing backups
    const files = fs.readdirSync(backupDir)
      .filter(f => (f.startsWith("NowledgeMem-backup-") || f.startsWith("ArcRift-backup-")) && f.endsWith(".sqlite"))
      .map(f => path.join(backupDir, f));

    // Get stats to sort by modification time (newest first)
    const fileStats = files.map(file => ({
      file,
      mtime: fs.statSync(file).mtimeMs
    })).sort((a, b) => b.mtime - a.mtime);

    let needsBackup = false;
    
    if (fileStats.length === 0) {
      needsBackup = true;
    } else {
      const newestBackup = fileStats[0];
      const timeSinceBackup = Date.now() - newestBackup.mtime;
      if (timeSinceBackup > BACKUP_THRESHOLD_MS) {
        needsBackup = true;
      }
    }

    if (needsBackup) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(backupDir, `NowledgeMem-backup-${timestamp}.sqlite`);
      
      logger.info(`Starting automatic SQLite backup to ${backupPath}...`);
      
      const db = getSqlite();
      
      // better-sqlite3 native async backup. Safely copies even while WAL is active.
      await db.backup(backupPath);
      
      logger.success(`Backup completed successfully: ${backupPath}`);
      
      // Add the new backup to the list for cleanup processing
      fileStats.unshift({ file: backupPath, mtime: Date.now() });
    }

    // Cleanup old backups
    if (fileStats.length > MAX_BACKUPS) {
      const toDelete = fileStats.slice(MAX_BACKUPS);
      for (const { file } of toDelete) {
        try {
          fs.unlinkSync(file);
          logger.info(`Deleted old backup to save space: ${path.basename(file)}`);
        } catch {}
      }
    }

  } catch (error) {
    logger.error("Failed to run SQLite auto-backup:");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}

export function startAutoBackup() {
  // Run an immediate check on startup
  runBackupCheck().catch(err => {
    logger.error("Initial backup check failed", err);
  });

  // Schedule recurring checks
  setInterval(() => {
    runBackupCheck().catch(err => {
      logger.error("Scheduled backup check failed", err);
    });
  }, BACKUP_INTERVAL_MS);
  
  logger.info("Auto-backup service started (checks every 12h)");
}
