const { app, BrowserWindow, ipcMain } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const os = require("os");
const { initDB, isDev } = require("./db/init");
const { startSyncServer } = require("./sync-server");
const { setupIPC } = require("./ipc");
const { startCloudSyncListener, pullInventoryFromCloud, pullProductsFromCloud } = require("./cloud-sync");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

// Configure Logging
log.transports.file.level = "info";
autoUpdater.logger = log;
autoUpdater.forceDevUpdateConfig = false;
autoUpdater.autoDownload = false;

// Auto-Updater Events
autoUpdater.on("update-available", (info) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send("update-available", info);
  autoUpdater.downloadUpdate();
});
autoUpdater.on("download-progress", (progressObj) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send("download-progress", progressObj);
});
autoUpdater.on("update-downloaded", (info) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send("update-downloaded", info);
});

// IPC Handlers
ipcMain.handle("app:restart-install", () => autoUpdater.quitAndInstall());
ipcMain.handle("app:get-version", () => app.getVersion());
ipcMain.handle("app:open-external", async (event, url) => {
  const { shell } = require("electron");
  await shell.openExternal(url);
});
ipcMain.handle("app:get-hostname", () => os.hostname());
ipcMain.handle("app:check-updates", () => autoUpdater.checkForUpdates().catch(() => {}));

ipcMain.handle("app:get-machine-id", async () => {
  return new Promise((resolve) => {
    const platform = process.platform;
    let cmd = platform === "darwin" 
      ? "system_profiler SPHardwareDataType | grep 'Serial Number (system)' | awk '{print $4}'"
      : platform === "win32" ? "wmic bios get serialnumber" : "";

    if (!cmd) return resolve("HW-GENERIC-" + os.hostname());

    exec(cmd, (error, stdout) => {
      if (error) return resolve("HW-FALLBACK-" + os.hostname());
      let serial = stdout.trim();
      if (platform === "win32") serial = serial.replace("SerialNumber", "").trim();
      resolve(serial || "HW-UNKNOWN-" + os.hostname());
    });
  });
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev()) {
    mainWindow.loadURL("http://localhost:5176");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  initDB();
  setupIPC();
  
  // Start Services
  startSyncServer(4000, "NODE-TEMP-" + Math.floor(Math.random() * 1000));
  startCloudSyncListener();

  createWindow();

  // --- AUTOMATIC RESTORATION (SaaS) ---
  // Esperamos 2 segundos para asegurar estabilidad de red antes de jalar todo
  setTimeout(async () => {
    console.log("[SaaS] Iniciando sincronización masiva Dual...");
    try {
      const { fullSyncFromCloud } = require("./cloud-sync");
      await fullSyncFromCloud();
      
      console.log("[SaaS] Sincronización inicial exitosa.");
    } catch (e) {
      console.error("[SaaS] Error en sincronización inicial:", e);
    }
  }, 2000);

  if (!isDev()) autoUpdater.checkForUpdates().catch(() => {});

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
