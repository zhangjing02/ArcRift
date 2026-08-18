/**
 * ArcRift Electron Main Process
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
let backendProcess = null;

const PORT = 3001;
const LOG_FILE = path.resolve(__dirname, "desktop.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
}

log("Starting ArcRift Electron main.js...");

// Single Instance Lock: If user double clicks desktop icon again, focus the existing window!
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log("Another ArcRift instance is already running. Focusing primary instance and exiting.");
  app.quit();
} else {
  app.on("second-instance", () => {
    log("Second instance launched! Restoring and focusing mainWindow...");
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  function startBackend() {
    if (backendProcess) return;
    const backendDir = path.resolve(__dirname, "../backend");
    const backendEntry = path.resolve(backendDir, "dist/index.js");

    let nodeBin = "node";
    const bundledNode = path.resolve(backendDir, "bin/node.exe");
    if (fs.existsSync(bundledNode)) {
      nodeBin = bundledNode;
    } else if (fs.existsSync("D:\\DevelopeTools\\Node\\node.exe")) {
      nodeBin = "D:\\DevelopeTools\\Node\\node.exe";
    }

    const cleanEnv = { ...process.env };
    delete cleanEnv.ELECTRON_RUN_AS_NODE;
    delete cleanEnv.ELECTRON_NO_ASAR;
    delete cleanEnv.NODE_OPTIONS;
    delete cleanEnv.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
    cleanEnv.PORT = String(PORT);
    cleanEnv.NODE_ENV = "production";
    cleanEnv.ARCRIFT_STORAGE_MODE = "sqlite";

    log(`Spawning backend: "${nodeBin}" "${backendEntry}" (cwd: ${backendDir})`);

    try {
      backendProcess = spawn(nodeBin, [backendEntry], {
        cwd: backendDir,
        env: cleanEnv,
        shell: false,
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
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const targetUrl = `http://127.0.0.1:${PORT}`;
    log("Loading frontend URL: " + targetUrl);
    mainWindow.loadURL(targetUrl).catch((err) => {
      log("loadURL error: " + err);
    });
  }

  function ensureBackendAndLoad() {
    // Check if backend is already listening
    const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
      if (res.statusCode === 200) {
        log("Backend already active on port 3001! Loading window directly.");
        loadFrontendInWindow();
      } else {
        startBackend();
      }
    });

    req.on("error", () => {
      log("Backend not active on port 3001, starting backend process...");
      startBackend();
    });
    req.end();

    // Poll until backend is healthy
    let attempts = 0;
    const maxAttempts = 50;
    const pollTimer = setInterval(() => {
      attempts++;
      const testReq = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(pollTimer);
          log(`Backend healthy on attempt ${attempts}. Loading frontend.`);
          loadFrontendInWindow();
        }
      });
      testReq.on("error", () => {
        if (attempts >= maxAttempts) {
          clearInterval(pollTimer);
          log("Poll reached maxAttempts, attempting fallback load.");
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
      title: "ArcRift - AI 记忆与知识图谱工作台",
      icon: iconPath,
      backgroundColor: "#0d0e12",
      autoHideMenuBar: true,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
      },
    });

    // Ensure the window shows immediately and gains focus
    mainWindow.once("ready-to-show", () => {
      log("mainWindow ready-to-show fired!");
      mainWindow.show();
      mainWindow.focus();
    });

    // Immediately show as fallback
    mainWindow.show();
    mainWindow.focus();

    // Keyboard Shortcuts: F5 / Ctrl+R for smooth in-place reload, F12 for DevTools
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) {
        event.preventDefault();
        log("Shortcut reload triggered, calling reloadIgnoringCache()...");
        mainWindow.webContents.reloadIgnoringCache();
      }
      if (input.key === "F12" || (input.control && input.shift && input.key.toLowerCase() === "i")) {
        event.preventDefault();
        mainWindow.webContents.toggleDevTools();
      }
    });

    mainWindow.webContents.on("did-finish-load", () => {
      log("Renderer did-finish-load successfully! UI is live.");
      if (mainWindow && !mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
      log(`[Renderer Console] [${level}] ${message} (${sourceId}:${line})`);
    });

    mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
      if (errorCode === -3) return; // Ignore net::ERR_ABORTED
      log(`did-fail-load: ${errorCode} ${errorDescription}, retrying in 1.2s...`);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          loadFrontendInWindow();
        }
      }, 1200);
    });

    mainWindow.webContents.on("render-process-gone", (event, details) => {
      log(`Renderer process gone: ${details.reason}, auto reloading...`);
      loadFrontendInWindow();
    });

    mainWindow.on("close", (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
        log("Window close intercepted -> minimized to system tray.");
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
    tray.setToolTip("ArcRift - AI 记忆与知识图谱工作台");

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "显示应用 (Show)",
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: "重新加载 (Reload)",
        click: () => {
          log("Tray Reload clicked!");
          if (mainWindow) {
            mainWindow.webContents.reloadIgnoringCache();
          }
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

    tray.on("click", () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

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
            if (mainWindow.isMinimized()) mainWindow.restore();
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
}
