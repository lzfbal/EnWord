const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronProgress", {
  getAll: () => ipcRenderer.invoke("progress:getAll"),
  upsert: (record) => ipcRenderer.invoke("progress:upsert", record),
  getDbPath: () => ipcRenderer.invoke("progress:getDbPath"),
});

contextBridge.exposeInMainWorld("electronApp", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
});

contextBridge.exposeInMainWorld("electronAI", {
  getConfigMeta: () => ipcRenderer.invoke("ai:getConfigMeta"),
  evaluateSentence: (payload) => ipcRenderer.invoke("ai:evaluateSentence", payload),
  generateSentencePrompt: (payload) => ipcRenderer.invoke("ai:generateSentencePrompt", payload),
  generateExamples: (payload) => ipcRenderer.invoke("ai:generateExamples", payload),
  getWordDetails: (payload) => ipcRenderer.invoke("ai:getWordDetails", payload),
  compareWords: (payload) => ipcRenderer.invoke("ai:compareWords", payload),
  analyzeSynonyms: (payload) => ipcRenderer.invoke("ai:analyzeSynonyms", payload),
  onStream: (handler) => {
    if (typeof handler !== "function") {
      return () => {};
    }
    const listener = (_event, data) => {
      try {
        handler(data || {});
      } catch {
        // Ignore renderer-side handler errors.
      }
    };
    ipcRenderer.on("ai:stream", listener);
    return () => {
      ipcRenderer.removeListener("ai:stream", listener);
    };
  },
});

contextBridge.exposeInMainWorld("electronSentenceFavorites", {
  add: async (payload) => {
    try {
      return await ipcRenderer.invoke("sentenceFavorites:add", payload);
    } catch (err) {
      const message = String(err?.message || "");
      if (message.includes("No handler registered for 'sentenceFavorites:add'")) {
        return ipcRenderer.invoke("favoriteSentences:add", payload);
      }
      throw err;
    }
  },
  list: async () => {
    try {
      return await ipcRenderer.invoke("sentenceFavorites:list");
    } catch (err) {
      const message = String(err?.message || "");
      if (message.includes("No handler registered for 'sentenceFavorites:list'")) {
        return ipcRenderer.invoke("favoriteSentences:list");
      }
      throw err;
    }
  },
  remove: async (payload) => {
    try {
      return await ipcRenderer.invoke("sentenceFavorites:remove", payload);
    } catch (err) {
      const message = String(err?.message || "");
      if (message.includes("No handler registered for 'sentenceFavorites:remove'")) {
        return ipcRenderer.invoke("favoriteSentences:remove", payload);
      }
      throw err;
    }
  },
});

contextBridge.exposeInMainWorld("electronCompareFavorites", {
  add: (payload) => ipcRenderer.invoke("compareFavorites:add", payload),
  list: () => ipcRenderer.invoke("compareFavorites:list"),
  remove: (payload) => ipcRenderer.invoke("compareFavorites:remove", payload),
});

contextBridge.exposeInMainWorld("electronSynonymFavorites", {
  add: (payload) => ipcRenderer.invoke("synonymFavorites:add", payload),
  list: () => ipcRenderer.invoke("synonymFavorites:list"),
  remove: (payload) => ipcRenderer.invoke("synonymFavorites:remove", payload),
});
