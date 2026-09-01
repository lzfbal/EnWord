const path = require("node:path");

function createMainWindow({ BrowserWindow, appRoot }) {
  const win = new BrowserWindow({
    width: 760,
    height: 940,
    minWidth: 550,
    minHeight: 500,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(appRoot, "preload.js"),
    },
  });

  win.loadFile(path.join(appRoot, "index.html"));
}

module.exports = {
  createMainWindow,
};