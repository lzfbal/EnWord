function registerIpcHandlers({ ipcMain, app, dbStore, aiService }) {
  const db = dbStore.getDb();
  const AI_STREAM_CHANNEL = "ai:stream";

  function emitAiStream(event, requestId, stage, text) {
    const rid = String(requestId || "").trim();
    if (!rid || !event?.sender) return;
    event.sender.send(AI_STREAM_CHANNEL, {
      requestId: rid,
      stage: String(stage || "delta"),
      text: String(text || ""),
      ts: Date.now(),
    });
  }

  function mapRow(row) {
    let tags = [];
    try {
      tags = JSON.parse(row.tags || "[]");
    } catch {
      tags = [];
    }
    if (!Array.isArray(tags)) tags = [];

    return {
      id: row.id,
      status: row.status,
      stage: row.stage,
      nextReviewAt: row.nextReviewAt,
      lastReviewedAt: row.lastReviewedAt,
      rightCount: row.rightCount,
      wrongCount: row.wrongCount,
      tags,
    };
  }

  const addSentenceFavorite = (_event, payload) => {
    const zhText = String(payload?.zhText || "").trim();
    const enText = String(payload?.enText || "").trim();
    const createdAt = Date.now();

    if (!zhText) {
      throw new Error("zhText is required");
    }
    if (!enText) {
      throw new Error("enText is required");
    }

    const info = db
      .prepare(
        `INSERT INTO sentence_favorites (zhText, enText, createdAt)
         VALUES (@zhText, @enText, @createdAt)`
      )
      .run({ zhText, enText, createdAt });

    return {
      ok: true,
      id: Number(info.lastInsertRowid),
    };
  };

  const listSentenceFavorites = () => {
    return db
      .prepare(
        `SELECT id, zhText, enText, createdAt
         FROM sentence_favorites
         ORDER BY createdAt DESC, id DESC`
      )
      .all();
  };

  const removeSentenceFavorite = (_event, payload) => {
    const id = Number(payload?.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Valid favorite id is required");
    }

    const info = db
      .prepare("DELETE FROM sentence_favorites WHERE id = @id")
      .run({ id });

    return {
      ok: true,
      deleted: info.changes > 0,
    };
  };

  const addCompareFavorite = (_event, payload) => {
    const title = String(payload?.title || "").trim();
    const words = Array.isArray(payload?.words) ? payload.words : [];
    const result = payload?.result;
    const createdAt = Date.now();

    if (!title) {
      throw new Error("title is required");
    }
    if (!words.length) {
      throw new Error("words is required");
    }
    if (!result || typeof result !== "object") {
      throw new Error("result is required");
    }

    const info = db
      .prepare(
        `INSERT INTO compare_favorites (title, wordsJson, resultJson, createdAt)
         VALUES (@title, @wordsJson, @resultJson, @createdAt)`
      )
      .run({
        title,
        wordsJson: JSON.stringify(words),
        resultJson: JSON.stringify(result),
        createdAt,
      });

    return {
      ok: true,
      id: Number(info.lastInsertRowid),
    };
  };

  const listCompareFavorites = () => {
    const rows = db
      .prepare(
        `SELECT id, title, wordsJson, resultJson, createdAt
         FROM compare_favorites
         ORDER BY createdAt DESC, id DESC`
      )
      .all();

    return rows.map((row) => {
      let words = [];
      let result = null;
      try {
        words = JSON.parse(row.wordsJson || "[]");
      } catch {
        words = [];
      }
      try {
        result = JSON.parse(row.resultJson || "null");
      } catch {
        result = null;
      }
      if (!Array.isArray(words)) words = [];
      if (!result || typeof result !== "object") result = null;
      return {
        id: row.id,
        title: row.title,
        words,
        result,
        createdAt: row.createdAt,
      };
    });
  };

  const removeCompareFavorite = (_event, payload) => {
    const id = Number(payload?.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Valid compare favorite id is required");
    }

    const info = db
      .prepare("DELETE FROM compare_favorites WHERE id = @id")
      .run({ id });

    return {
      ok: true,
      deleted: info.changes > 0,
    };
  };

  const addSynonymFavorite = (_event, payload) => {
    const title = String(payload?.title || "").trim();
    const word = String(payload?.word || "").trim();
    const result = payload?.result;
    const createdAt = Date.now();

    if (!title) {
      throw new Error("title is required");
    }
    if (!word) {
      throw new Error("word is required");
    }
    if (!result || typeof result !== "object") {
      throw new Error("result is required");
    }

    const info = db
      .prepare(
        `INSERT INTO synonym_favorites (title, word, resultJson, createdAt)
         VALUES (@title, @word, @resultJson, @createdAt)`
      )
      .run({
        title,
        word,
        resultJson: JSON.stringify(result),
        createdAt,
      });

    return {
      ok: true,
      id: Number(info.lastInsertRowid),
    };
  };

  const listSynonymFavorites = () => {
    const rows = db
      .prepare(
        `SELECT id, title, word, resultJson, createdAt
         FROM synonym_favorites
         ORDER BY createdAt DESC, id DESC`
      )
      .all();

    return rows.map((row) => {
      let result = null;
      try {
        result = JSON.parse(row.resultJson || "null");
      } catch {
        result = null;
      }
      if (!result || typeof result !== "object") result = null;
      return {
        id: row.id,
        title: row.title,
        word: row.word,
        result,
        createdAt: row.createdAt,
      };
    });
  };

  const removeSynonymFavorite = (_event, payload) => {
    const id = Number(payload?.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Valid synonym favorite id is required");
    }

    const info = db
      .prepare("DELETE FROM synonym_favorites WHERE id = @id")
      .run({ id });

    return {
      ok: true,
      deleted: info.changes > 0,
    };
  };

  ipcMain.handle("progress:getAll", () => {
    const rows = db
      .prepare(
        `SELECT id, status, stage, nextReviewAt, lastReviewedAt, rightCount, wrongCount, tags
         FROM word_progress
         ORDER BY id ASC`
      )
      .all();
    return rows.map(mapRow);
  });

  ipcMain.handle("progress:upsert", (_event, record) => {
    const safe = {
      id: Number(record?.id),
      status: String(record?.status ?? "new"),
      stage: Number(record?.stage ?? 0),
      nextReviewAt: Number(record?.nextReviewAt ?? 0),
      lastReviewedAt: Number(record?.lastReviewedAt ?? 0),
      rightCount: Number(record?.rightCount ?? 0),
      wrongCount: Number(record?.wrongCount ?? 0),
      tags: Array.isArray(record?.tags) ? record.tags : [],
    };

    if (!Number.isFinite(safe.id)) {
      throw new Error("Invalid id");
    }

    db.prepare(
      `INSERT INTO word_progress (
         id, status, stage, nextReviewAt, lastReviewedAt, rightCount, wrongCount, tags
       ) VALUES (
         @id, @status, @stage, @nextReviewAt, @lastReviewedAt, @rightCount, @wrongCount, @tags
       )
       ON CONFLICT(id) DO UPDATE SET
         status=excluded.status,
         stage=excluded.stage,
         nextReviewAt=excluded.nextReviewAt,
         lastReviewedAt=excluded.lastReviewedAt,
         rightCount=excluded.rightCount,
         wrongCount=excluded.wrongCount,
         tags=excluded.tags`
    ).run({
      ...safe,
      tags: JSON.stringify(safe.tags),
    });

    return { ok: true };
  });

  ipcMain.handle("progress:getDbPath", () => {
    return dbStore.resolveDbPath();
  });

  ipcMain.handle("app:getVersion", () => {
    if (app && typeof app.getVersion === "function") {
      return String(app.getVersion() || "").trim();
    }
    return "";
  });

  ipcMain.handle("sentenceFavorites:add", addSentenceFavorite);
  ipcMain.handle("sentenceFavorites:list", listSentenceFavorites);
  ipcMain.handle("sentenceFavorites:remove", removeSentenceFavorite);

  ipcMain.handle("favoriteSentences:add", addSentenceFavorite);
  ipcMain.handle("favoriteSentences:list", listSentenceFavorites);
  ipcMain.handle("favoriteSentences:remove", removeSentenceFavorite);

  ipcMain.handle("compareFavorites:add", addCompareFavorite);
  ipcMain.handle("compareFavorites:list", listCompareFavorites);
  ipcMain.handle("compareFavorites:remove", removeCompareFavorite);

  ipcMain.handle("synonymFavorites:add", addSynonymFavorite);
  ipcMain.handle("synonymFavorites:list", listSynonymFavorites);
  ipcMain.handle("synonymFavorites:remove", removeSynonymFavorite);

  ipcMain.handle("ai:getConfigMeta", () => {
    const cfg = aiService.readAiConfig();
    if (!cfg) {
      return { configured: false, reason: "missing-config" };
    }
    const key = String(cfg.apiKey || "").trim();
    return {
      configured: Boolean(key && key !== "YOUR_API_KEY_HERE"),
      provider: cfg.provider || "openai-compatible",
      model: cfg.model || "qwen-3.8-27b",
      configPath: aiService.resolveAiConfigPath(),
      reasoningEffort: cfg.reasoningEffort || "medium",
    };
  });

  ipcMain.handle("ai:evaluateSentence", async (event, payload) => {
    const requestId = String(payload?.requestId || "").trim();
    return aiService.evaluateSentenceViaModel(payload, {
      onStreamText: (_delta, fullText) => {
        emitAiStream(event, requestId, "delta", fullText);
      },
    });
  });

  ipcMain.handle("ai:generateSentencePrompt", async (event, payload) => {
    const requestId = String(payload?.requestId || "").trim();
    return aiService.generateSentencePromptViaModel(payload, {
      onStreamText: (_delta, fullText) => {
        emitAiStream(event, requestId, "delta", fullText);
      },
    });
  });

  ipcMain.handle("ai:generateExamples", async (event, payload) => {
    const requestId = String(payload?.requestId || "").trim();
    return aiService.generateExamplesViaModel(payload, {
      onStreamText: (_delta, fullText) => {
        emitAiStream(event, requestId, "delta", fullText);
      },
    });
  });

  ipcMain.handle("ai:getWordDetails", async (event, payload) => {
    const requestId = String(payload?.requestId || "").trim();
    return aiService.getWordDetailsViaModel(payload, {
      onStreamText: (_delta, fullText) => {
        emitAiStream(event, requestId, "delta", fullText);
      },
    });
  });

  ipcMain.handle("ai:compareWords", async (event, payload) => {
    const requestId = String(payload?.requestId || "").trim();
    return aiService.compareWordsViaModel(payload, {
      onStreamText: (_delta, fullText) => {
        emitAiStream(event, requestId, "delta", fullText);
      },
    });
  });

  ipcMain.handle("ai:analyzeSynonyms", async (event, payload) => {
    const requestId = String(payload?.requestId || "").trim();
    try {
      return await aiService.analyzeSynonymsViaModel(payload, {
        onStreamText: (_delta, fullText) => {
          emitAiStream(event, requestId, "delta", fullText);
        },
      });
    } catch (err) {
      const msg = String(err?.message || "");
      if (!/valid JSON/i.test(msg)) {
        throw err;
      }
      // Fallback to non-stream mode for providers that return non-standard SSE chunks.
      return aiService.analyzeSynonymsViaModel(payload);
    }
  });
}

module.exports = {
  registerIpcHandlers,
};