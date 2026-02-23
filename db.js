const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./app.db");

// Helper: add a column if it doesn't exist (safe migration)
function addColumnIfMissing(table, column, ddl) {
  db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
    if (err) return;
    const exists = rows.some((r) => r.name === column);
    if (!exists) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  });
}

db.serialize(() => {
  // Core tables
  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      birthdate TEXT,
      position TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      evaluator_name TEXT,
      date TEXT NOT NULL,
      notes TEXT,
      score INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Attachments table (files under each player)
  db.run(`
    CREATE TABLE IF NOT EXISTS player_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      kind TEXT DEFAULT 'file',            -- 'photo' or 'file'
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      stored_path TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id)
    )
  `);

  // Migrations (safe, won’t break existing db)
  addColumnIfMissing("players", "profile_photo_path", "profile_photo_path TEXT");
  addColumnIfMissing("players", "bio", "bio TEXT");
  addColumnIfMissing("players", "club", "club TEXT");
  addColumnIfMissing("players", "nationality", "nationality TEXT");
  addColumnIfMissing("players", "height_cm", "height_cm INTEGER");
  addColumnIfMissing("players", "weight_kg", "weight_kg INTEGER");
});

module.exports = db;
