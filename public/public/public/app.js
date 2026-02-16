let selectedPlayerId = null;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

async function loadDashboard() {
  const d = await api("/api/dashboard");
  const dash = document.getElementById("dashboard");
  dash.innerHTML = "";
  dash.appendChild(el(`<span class="pill">Players: ${d.players_count}</span>`));
  dash.appendChild(el(`<span class="pill">Evaluations: ${d.evals_count}</span>`));
  dash.appendChild(el(`<span class="pill">Avg score: ${d.avg_score ?? "—"}</span>`));
}

async function loadPlayers() {
  const players = await api("/api/players");
  const container = document.getElementById("players");
  container.innerHTML = "";

  if (players.length === 0) {
    container.appendChild(el(`<div class="muted">No players yet.</div>`));
    return;
  }

  players.forEach(p => {
    const row = el(`
      <div class="row">
        <div>
          <div><strong>${escapeHtml(p.full_name)}</strong></div>
          <div class="muted" style="font-size:12px">
            ${p.position || "—"} • ${p.birthdate || "No DOB"}
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button data-action="select">Select</button>
          <button class="danger" data-action="delete">Delete</button>
        </div>
      </div>
    `);

    row.querySelector('[data-action="select"]').onclick = () => selectPlayer(p);
    row.querySelector('[data-action="delete"]').onclick = () => deletePlayer(p.id);
    container.appendChild(row);
  });
}

async function selectPlayer(p) {
  selectedPlayerId = p.id;
  document.getElementById("selectedPlayer").innerHTML = `
    <div><strong>${escapeHtml(p.full_name)}</strong></div>
    <div class="muted" style="font-size:12px">ID: ${p.id}</div>
  `;
  document.getElementById("evalSection").classList.remove("hidden");
  await loadEvaluations();
}

async function loadEvaluations() {
  if (!selectedPlayerId) return;
  const evals = await api(`/api/players/${selectedPlayerId}/evaluations`);
  const container = document.getElementById("evals");
  container.innerHTML = "";

  if (evals.length === 0) {
    container.appendChild(el(`<div class="muted">No evaluations yet.</div>`));
    return;
  }

  evals.forEach(e => {
    container.appendChild(el(`
      <div class="row">
        <div>
          <div>
            <strong>${e.date}</strong>
            ${e.score !== null && e.score !== undefined ? `<span class="pill">Score: ${e.score}</span>` : ""}
          </div>
          <div class="muted" style="font-size:12px">
            ${escapeHtml(e.evaluator_name || "Unknown evaluator")}
          </div>
          ${e.notes ? `<div style="margin-top:6px">${escapeHtml(e.notes)}</div>` : ""}
        </div>
      </div>
    `));
  });
}

async function deletePlayer(id) {
  if (!confirm("Delete player and all evaluations?")) return;

  await api(`/api/players/${id}`, { method: "DELETE" });

  if (selectedPlayerId === id) {
    selectedPlayerId = null;
    document.getElementById("selectedPlayer").textContent =
      "Select a player to view/add evaluations.";
    document.getElementById("evalSection").classList.add("hidden");
  }

  await loadPlayers();
  await loadDashboard();
}

document.getElementById("playerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());

  await api("/api/players", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  form.reset();
  await loadPlayers();
  await loadDashboard();
});

document.getElementById("evalForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedPlayerId) return;

  const form = e.currentTarget;
  const raw = Object.fromEntries(new FormData(form).entries());

  const payload = {
    evaluator_name: raw.evaluator_name || "",
    date: raw.date,
    notes: raw.notes || "",
    score: raw.score === "" ? null : Number(raw.score)
  };

  await api(`/api/players/${selectedPlayerId}/evaluations`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  form.reset();
  await loadEvaluations();
  await loadDashboard();
});

(async function init() {
  await loadDashboard();
  await loadPlayers();
})();
