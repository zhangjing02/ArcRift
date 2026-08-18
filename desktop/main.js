/**
 * ChronosMind Electron Main Process
 * Manages background API lifecycle, system tray, and main dashboard window.
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

let mainWindow = null;
let tray = null;
let isQuitting = false;
let isPageLoaded = false;
let backendProcess = null;

const PORT = 3001;
const LOG_FILE = path.resolve(__dirname, "desktop.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
}

log("Starting ChronosMind Electron main.js...");

function startBackend() {
  const backendDir = path.resolve(__dirname, "../backend");
  const backendEntry = path.resolve(backendDir, "dist/index.js");

  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  delete cleanEnv.ELECTRON_NO_ASAR;
  delete cleanEnv.NODE_OPTIONS;
  delete cleanEnv.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
  cleanEnv.PORT = String(PORT);
  cleanEnv.NODE_ENV = "production";
  cleanEnv.ARCRIFT_STORAGE_MODE = "sqlite";
  cleanEnv.SQLITE_DB_PATH = path.resolve(backendDir, "ArcRift.db");

  log(`Spawning backend: node "${backendEntry}" (cwd: ${backendDir}) with DB: ${cleanEnv.SQLITE_DB_PATH}`);

  try {
    backendProcess = spawn("node", [backendEntry], {
      cwd: backendDir,
      env: cleanEnv,
      shell: true,
      windowsHide: true,
    });

    backendProcess.on("error", (err) => {
      log(`[Backend Spawn ERR] ${err?.message || String(err)}`);
    });

    backendProcess.stdout?.on("data", (chunk) => {
      const msg = chunk.toString();
      log("[Backend OUT] " + msg.trim());
      if (msg.includes("3001") || msg.includes("running on port")) {
        loadFrontendInWindow();
      }
    });

    backendProcess.stderr?.on("data", (chunk) => {
      log("[Backend ERR] " + chunk.toString().trim());
    });

    backendProcess.on("exit", (code, signal) => {
      log(`[Backend Exit] code=${code} signal=${signal}`);
      backendProcess = null;
    });
  } catch (err) {
    log(`[Backend Spawn Catch] ${err?.stack || err}`);
  }
}

function stopBackend() {
  if (backendProcess) {
    log("Stopping backend...");
    try {
      backendProcess.kill();
    } catch {}
    backendProcess = null;
  }
}

function loadFrontendInWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || isPageLoaded) return;
  const targetUrl = `http://127.0.0.1:${PORT}`;
  log("Loading frontend in window: " + targetUrl);
  mainWindow.loadURL(targetUrl).catch((err) => {
    log("loadURL error: " + err);
  });
}

function ensureBackendAndLoad() {
  // Check if backend is already listening
  const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
    if (res.statusCode === 200) {
      log("Backend already active on port 3001! Loading window.");
      loadFrontendInWindow();
    } else {
      startBackend();
    }
  });

  req.on("error", () => {
    log("Backend not active, starting new instance...");
    startBackend();
  });
  req.end();

  // Poll until backend is healthy, then load ONCE
  let attempts = 0;
  const maxAttempts = 60;
  const pollTimer = setInterval(() => {
    if (isPageLoaded) {
      clearInterval(pollTimer);
      return;
    }
    attempts++;
    const testReq = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
      if (res.statusCode === 200) {
        clearInterval(pollTimer);
        log(`Backend ready on attempt ${attempts}. Loading frontend.`);
        loadFrontendInWindow();
      }
    });
    testReq.on("error", () => {
      if (attempts >= maxAttempts) {
        clearInterval(pollTimer);
        log("Poll reached maxAttempts, attempting final load.");
        loadFrontendInWindow();
      }
    });
    testReq.end();
  }, 400);
}

function createWindow() {
  log("Creating BrowserWindow...");
  const iconPath = path.resolve(__dirname, "icon.ico");

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "ChronosMind",
    icon: iconPath,
    backgroundColor: "#0d0e12",
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.on("did-finish-load", () => {
    isPageLoaded = true;
    log("Renderer did-finish-load successfully! UI is live.");
  });

  mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
    log(`[Renderer Console] [${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    if (errorCode === -3) return; // Ignore net::ERR_ABORTED
    log(`did-fail-load: ${errorCode} ${errorDescription}, retrying in 1.5s...`);
    isPageLoaded = false;
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        loadFrontendInWindow();
      }
    }, 1500);
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  ensureBackendAndLoad();
}

function createTray() {
  const iconPath = path.resolve(__dirname, "icon.png");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("ChronosMind - AI Memory & Knowledge Graph");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示 ChronosMind (Show)",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "重新加载 (Reload)",
      click: () => {
        isPageLoaded = false;
        if (mainWindow) mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
      },
    },
    { type: "separator" },
    {
      label: "退出 (Quit)",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

log("Registering app lifecycle events...");

app.whenReady().then(() => {
  log("app.whenReady fired!");
  createTray();
  createWindow();

  try {
    globalShortcut.register("Alt+M", () => {
      if (mainWindow) {
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (e) {
    log("globalShortcut error: " + e.message);
  }
}).catch((err) => {
  log("app.whenReady catch error: " + err);
});

process.on("uncaughtException", (err) => {
  log("process uncaughtException: " + (err?.stack || err?.message || String(err)));
});

process.on("unhandledRejection", (reason) => {
  log("process unhandledRejection: " + reason);
});

app.on("before-quit", () => {
  isQuitting = true;
  stopBackend();
});

app.on("window-all-closed", () => {
  log("window-all-closed event (kept alive in tray)");
});
