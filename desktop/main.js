const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

let mainWindow = null;
let tray = null;
let backendProcess = null;
let isQuitting = false;

const BACKEND_DIR = path.resolve(__dirname, "../backend");
const BACKEND_SCRIPT = path.resolve(BACKEND_DIR, "dist/index.js");
const DB_PATH = path.resolve(BACKEND_DIR, "ArcRift.db");
const PORT = 3001;

function startBackend() {
  if (backendProcess) return;

  const env = {
    ...process.env,
    PORT: String(PORT),
    ARCRIFT_STORAGE_MODE: "sqlite",
    SQLITE_DB_PATH: DB_PATH,
    NODE_ENV: "production",
  };

  backendProcess = spawn("node", [BACKEND_SCRIPT], {
    cwd: BACKEND_DIR,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  backendProcess.stdout?.on("data", (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr?.on("data", (data) => {
    console.error(`[Backend ERR] ${data.toString().trim()}`);
  });

  backendProcess.on("exit", (code) => {
    console.log(`[Backend] Exited with code ${code}`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function checkServerReady(callback) {
  const req = http.get(`http://localhost:${PORT}/health`, (res) => {
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
        onReady();
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
        onReady(); // Try loading anyway
      }
    });
  }, interval);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Nowledge Mem",
    backgroundColor: "#0d0e12",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.resolve(__dirname, "../dashboard/public/favicon.png");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("Nowledge Mem - AI Working Memory Engine");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示主界面 (Show)",
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

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    startBackend();
    createTray();

    // Register Alt+M global shortcut to toggle app window
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

    waitForServer(20, 200, () => {
      createWindow();
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
    stopBackend();
  });

  app.on("window-all-closed", (event) => {
    // Keep app running in tray on Windows/macOS
    event.preventDefault();
  });
}
