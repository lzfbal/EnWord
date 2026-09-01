const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");

const { createAiService } = require("./src/main/aiService");
const { createDbStore } = require("./src/main/dbStore");
const { registerIpcHandlers } = require("./src/main/ipcHandlers");
const { createMainWindow } = require("./src/main/window");

const appRoot = __dirname;
const aiService = createAiService({ appRoot });
const dbStore = createDbStore({ app, appRoot: path.resolve(appRoot) });

app.whenReady().then(() => {
  dbStore.init();

  registerIpcHandlers({
    ipcMain,
    dbStore,
    aiService,
  });

  createMainWindow({
    BrowserWindow,
    appRoot,
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow({ BrowserWindow, appRoot });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  dbStore.close();
});