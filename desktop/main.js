const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");

const logFile = path.resolve(__dirname, "desktop.log");
function log(msg) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

log("Starting Electron main.js...");

let mainWindow = null;
let tray = null;
let backendProcess = null;
let isQuitting = false;

const BACKEND_DIR = path.resolve(__dirname, "../backend");
const BACKEND_SCRIPT = path.resolve(BACKEND_DIR, "dist/index.js");
const DB_PATH = path.resolve(BACKEND_DIR, "ArcRift.db");
const PORT = 3001;

function getNodePath() {
  const candidates = [
    "C:\\Program Files\\nodejs\\node.exe",
    "C:\\Program Files (x86)\\nodejs\\node.exe",
    path.resolve(process.env.APPDATA || "", "npm/node.exe"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "node";
}

function startBackend() {
  if (backendProcess) return;
  const nodeBin = getNodePath();
  log("Spawning backend with node: " + nodeBin + " -> " + BACKEND_SCRIPT);

  const env = {
    ...process.env,
    PORT: String(PORT),
    ARCRIFT_STORAGE_MODE: "sqlite",
    SQLITE_DB_PATH: DB_PATH,
    NODE_ENV: "production",
  };

  try {
    backendProcess = spawn(nodeBin, [BACKEND_SCRIPT], {
      cwd: BACKEND_DIR,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    backendProcess.on("error", (err) => {
      log(`[Backend Spawn ERR] ${err?.message || String(err)}`);
    });

    backendProcess.stdout?.on("data", (data) => {
      log(`[Backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr?.on("data", (data) => {
      log(`[Backend ERR] ${data.toString().trim()}`);
    });

    backendProcess.on("exit", (code) => {
      log(`[Backend] Exited with code ${code}`);
      backendProcess = null;
    });
  } catch (err) {
    log(`[Backend Spawn Catch] ${err?.message || String(err)}`);
  }
}

function stopBackend() {
  if (backendProcess) {
    log("Stopping backend...");
    backendProcess.kill();
    backendProcess = null;
  }
}

function checkServerReady(callback) {
  const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
    if (res.statusCode === 200) {
      callback(true);
    } else {
      callback(false);
    }
  });

  req.on("error", () => callback(false));
  req.end();
}

function waitForServer(maxAttempts, interval, onReady) {
  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    checkServerReady((ready) => {
      if (ready) {
        clearInterval(timer);
        log(`Server became ready after ${attempts} attempts`);
        onReady();
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
        log(`Server wait timed out after ${attempts} attempts, loading window anyway`);
        onReady();
      }
    });
  }, interval);
}

function createWindow() {
  log("Creating BrowserWindow immediately...");
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "ChronosMind",
    backgroundColor: "#0d0e12",
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const targetUrl = `http://127.0.0.1:${PORT}`;
  log("Loading URL: " + targetUrl);
  mainWindow.loadURL(targetUrl).catch(() => {
    log("Initial loadURL failed, retrying in 1s...");
    setTimeout(() => {
      mainWindow?.loadURL(targetUrl).catch(() => {});
    }, 1500);
  });

  // Handle load failure (e.g. backend still booting up)
  mainWindow.webContents.on("did-fail-load", () => {
    log("did-fail-load, retrying in 1.5s...");
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(targetUrl).catch(() => {});
      }
    }, 1500);
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
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
  tray.setToolTip("ChronosMind - AI Memory & Knowledge Graph Engine");

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
      label: "重启服务 (Restart Server)",
      click: () => {
        stopBackend();
        setTimeout(() => {
          startBackend();
          if (mainWindow) mainWindow.reload();
        }, 1000);
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
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

log("Registering app lifecycle events...");

app.whenReady().then(() => {
  log("app.whenReady fired!");
  try {
    startBackend();
  } catch (e) {
    log("startBackend error: " + e.message);
  }

  try {
    createTray();
    log("createTray done");
  } catch (e) {
    log("createTray error: " + e.message);
  }

  try {
    createWindow();
    log("createWindow done");
  } catch (e) {
    log("createWindow error: " + e.message);
  }

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
  // Don't call app.quit(), keep alive in tray
});
