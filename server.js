const express = require("express");
const path = require("path");
const db = require("./db");

const fs = require("fs");
const multer = require("multer");

const session = require("express-session");

const bcrypt = require ("bcrypt");
const jwt = require ("jsonwebtoken");
const cookieParser = require ("cookie-parser");

const app = express();
app.use(express.json());
app.use (
    session({
      secret: "super-secret-key",
      resave: false,
      saveUninitialized: false,
    })
);
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Uploads setup ----------
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Serve uploaded files
app.use("/uploads", express.static(UPLOADS_DIR));

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeOriginal = String(file.originalname || "file").replace(/[^\w.\-]+/g, "_");
    cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}_${safeOriginal}`);
  },
});

const upload = multer({ storage });

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/players", (req, res) => {
  db.all(
    `SELECT id, full_name, birthdate, position, created_at FROM players ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/players", (req, res) => {
  const { full_name, birthdate = "", position = "" } = req.body || {};

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ error: "full_name is required" });
  }

  const created_at = new Date().toISOString();

  db.run(
    `INSERT INTO players (full_name, birthdate, position, created_at)
     VALUES (?, ?, ?, ?)`,
    [full_name.trim(), birthdate, position, created_at],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.status(201).json({
        id: this.lastID,
        full_name,
        birthdate,
        position,
        created_at
      });
    }
  );
});

app.delete("/api/players/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  db.run(`DELETE FROM evaluations WHERE player_id = ?`, [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    db.run(`DELETE FROM players WHERE id = ?`, [id], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });

      if (this.changes === 0) {
        return res.status(404).json({ error: "Player not found" });
      }

      res.json({ ok: true });
    });
  });
});

app.get("/api/players/:id/evaluations", (req, res) => {
  const player_id = Number(req.params.id);

  if (!Number.isFinite(player_id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  db.all(
    `SELECT id, player_id, evaluator_name, date, notes, score, created_at
     FROM evaluations
     WHERE player_id = ?
     ORDER BY date DESC, id DESC`,
    [player_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/players/:id/evaluations", (req, res) => {
  const player_id = Number(req.params.id);

  if (!Number.isFinite(player_id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const { evaluator_name = "", date, notes = "", score = null } = req.body || {};

  if (!date) {
    return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
  }

  const created_at = new Date().toISOString();

  db.run(
    `INSERT INTO evaluations
     (player_id, evaluator_name, date, notes, score, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [player_id, evaluator_name, date, notes, score, created_at],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.status(201).json({
        id: this.lastID,
        player_id,
        evaluator_name,
        date,
        notes,
        score,
        created_at
      });
    }
  );
});

app.get("/api/dashboard", (req, res) => {
  db.get(`SELECT COUNT(*) AS players_count FROM players`, [], (err, p) => {
    if (err) return res.status(500).json({ error: err.message });

    db.get(`SELECT COUNT(*) AS evals_count FROM evaluations`, [], (err2, e) => {
      if (err2) return res.status(500).json({ error: err2.message });

      db.get(
        `SELECT ROUND(AVG(score), 2) AS avg_score
         FROM evaluations
         WHERE score IS NOT NULL`,
        [],
        (err3, a) => {
          if (err3) return res.status(500).json({ error: err3.message });

          res.json({
            players_count: p.players_count,
            evals_count: e.evals_count,
            avg_score: a.avg_score ?? null
          });
        }
      );
    });
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
