const path = require("node:path");
const Database = require("better-sqlite3");

function createDbStore({ app, appRoot }) {
  let db = null;

  function resolveDbPath() {
    if (app.isPackaged) {
      return path.join(app.getPath("userData"), "enword.db");
    }
    return path.join(appRoot, "enword.db");
  }

  function init() {
    const dbPath = resolveDbPath();
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS word_progress (
        id INTEGER PRIMARY KEY,
        status TEXT NOT NULL,
        stage INTEGER NOT NULL DEFAULT 0,
        nextReviewAt INTEGER NOT NULL DEFAULT 0,
        lastReviewedAt INTEGER NOT NULL DEFAULT 0,
        rightCount INTEGER NOT NULL DEFAULT 0,
        wrongCount INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS sentence_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zhText TEXT NOT NULL,
        enText TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS compare_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        wordsJson TEXT NOT NULL,
        resultJson TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS synonym_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        word TEXT NOT NULL,
        resultJson TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
    `);
  }

  function close() {
    if (db) {
      db.close();
      db = null;
    }
  }

  function getDb() {
    if (!db) {
      throw new Error("Database is not initialized");
    }
    return db;
  }

  return {
    init,
    close,
    getDb,
    resolveDbPath,
  };
}

module.exports = {
  createDbStore,
};