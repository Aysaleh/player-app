const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});// ---------- Auth helpers ----------
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

// ---------- Auth routes ----------
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const created_at = new Date().toISOString();

    db.run(
      `INSERT INTO users (email, password, created_at) VALUES (?, ?, ?)`,
      [String(email).trim().toLowerCase(), hashed, created_at],
      function (err) {
        if (err) {
          return res.status(400).json({ error: "Email already exists" });
        }
        req.session.userId = this.lastID;
        res.json({ ok: true });
      }
    );
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  db.get(
    `SELECT id, email, password FROM users WHERE email = ?`,
    [String(email).trim().toLowerCase()],
    async (err, user) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (!user) return res.status(401).json({ error: "Invalid email or password" });

      const ok = await bcrypt.compare(String(password), user.password);
      if (!ok) return res.status(401).json({ error: "Invalid email or password" });

      req.session.userId = user.id;
      res.json({ ok: true });
    }
  );
});

app.post("/api/logout", (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ authenticated: false });
  }
  res.json({ authenticated: true, userId: req.session.userId });
});

app.get("/api/players", requireAuth, (req, res) => {
  db.all(
    `SELECT id, full_name, birthdate, position, created_at FROM players ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/players", requireAuth, (req, res) => {
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

app.delete("/api/players/:id", requireAuth, (req, res) => {
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
