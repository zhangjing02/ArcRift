import path from "path";
import fs from "fs";

let cachedAppRoot: string | null = null;

/**
 * Resolves the root directory of the application/project.
 * Detects workspace root or installation directory so data is stored locally.
 */
export function getAppRoot(): string {
  if (cachedAppRoot) return cachedAppRoot;

  if (process.env.APP_ROOT && fs.existsSync(process.env.APP_ROOT)) {
    cachedAppRoot = path.resolve(process.env.APP_ROOT);
    return cachedAppRoot;
  }

  // 1. Probe upwards from current working directory
  let current = process.cwd();
  for (let i = 0; i < 4; i++) {
    if (
      fs.existsSync(path.join(current, "backend")) ||
      fs.existsSync(path.join(current, "dashboard")) ||
      fs.existsSync(path.join(current, "NowledgeMem.bat")) ||
      fs.existsSync(path.join(current, "ArcRift.bat"))
    ) {
      cachedAppRoot = current;
      return cachedAppRoot;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // 2. Probe upwards from __dirname
  current = __dirname;
  for (let i = 0; i < 5; i++) {
    if (
      fs.existsSync(path.join(current, "backend")) ||
      fs.existsSync(path.join(current, "dashboard"))
    ) {
      cachedAppRoot = current;
      return cachedAppRoot;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  cachedAppRoot = process.cwd();
  return cachedAppRoot;
}

/**
 * Returns the directory for storing SQLite databases, backups, and local settings.
 * Guaranteed to be located within the program/workspace installation directory (or custom DATA_DIR).
 */
export function getDataDir(): string {
  // 1. Explicit DATA_DIR env
  if (process.env.DATA_DIR) {
    const customDir = path.resolve(process.env.DATA_DIR);
    if (!fs.existsSync(customDir)) {
      try { fs.mkdirSync(customDir, { recursive: true }); } catch {}
    }
    return customDir;
  }

  // 2. If SQLITE_DB_PATH is provided, use its containing folder
  if (process.env.SQLITE_DB_PATH && process.env.SQLITE_DB_PATH !== ":memory:") {
    const dir = path.dirname(path.resolve(process.env.SQLITE_DB_PATH));
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    }
    return dir;
  }

  // 3. Default: <AppRoot>/data
  const defaultDataDir = path.join(getAppRoot(), "data");
  if (!fs.existsSync(defaultDataDir)) {
    try { fs.mkdirSync(defaultDataDir, { recursive: true }); } catch {}
  }
  return defaultDataDir;
}

/**
 * Returns the absolute path to the SQLite database file.
 */
export function getDbPath(): string {
  if (process.env.SQLITE_DB_PATH) {
    return process.env.SQLITE_DB_PATH;
  }

  const backendDb = path.join(getAppRoot(), "backend", "ArcRift.db");
  if (fs.existsSync(backendDb)) {
    return backendDb;
  }

  const dataDir = getDataDir();
  const legacyDb = path.join(dataDir, "ArcRift.db");
  if (fs.existsSync(legacyDb)) {
    return legacyDb;
  }

  const nowledgeDb = path.join(dataDir, "NowledgeMem.db");
  if (fs.existsSync(nowledgeDb)) {
    return nowledgeDb;
  }

  return backendDb;
}

/**
 * Returns the path to the application settings JSON file.
 */
export function getSettingsPath(): string {
  return path.join(getDataDir(), "settings.json");
}
