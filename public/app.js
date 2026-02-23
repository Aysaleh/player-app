let selectedPlayer = null;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error((data && data.error) || "Request failed");
  return data;
}

function htmlEscape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

async function loadPlayers() {
  const players = await api("/api/players");
  const container = document.getElementById("players");
  container.innerHTML = "";

  if (!players.length) {
    container.innerHTML = "<p>No players yet.</p>";
    return;
  }

  for (const p of players) {
    const div = document.createElement("div");
    div.className = "player-row";
    div.innerHTML = `
      <button class="select-btn">Select</button>
      <strong>${htmlEscape(p.full_name)}</strong>
      <span class="muted">(${htmlEscape(p.position || "—")})</span>
      <span class="muted">DOB: ${htmlEscape(p.birthdate || "—")}</span>
      <span class="muted">Created: ${htmlEscape(p.created_at || "")}</span>
    `;
    div.querySelector(".select-btn").onclick = () => selectPlayer(p);
    container.appendChild(div);
  }
}

async function createPlayer() {
  const full_name = document.getElementById("full_name").value.trim();
  const birthdate = document.getElementById("birthdate").value;
  const position = document.getElementById("position").value.trim();

  if (!full_name) {
    alert("Full name is required");
    return;
  }

  await api("/api/players", {
    method: "POST",
    body: JSON.stringify({ full_name, birthdate, position }),
  });

  document.getElementById("full_name").value = "";
  document.getElementById("birthdate").value = "";
  document.getElementById("position").value = "";

  await loadPlayers();
}

async function selectPlayer(p) {
  selectedPlayer = p;
  renderProfile();
}

function renderProfile() {
  const profile = document.getElementById("profile");
  if (!selectedPlayer) {
    profile.innerHTML = "<p>Select a player to view profile.</p>";
    return;
  }

  const imgPath = selectedPlayer.profile_image ? selectedPlayer.profile_image : "";

  profile.innerHTML = `
    <div class="profile-card">
      <div class="profile-left">
        ${imgPath ? `<img class="avatar" src="${imgPath}" alt="Profile" />` : `<div class="avatar placeholder">No Photo</div>`}
        <form id="photoForm">
          <label>Profile Photo</label>
          <input type="file" id="photoFile" accept="image/*" />
          <button type="submit">Upload Photo</button>
        </form>
      </div>

      <div class="profile-right">
        <h3>${htmlEscape(selectedPlayer.full_name)}</h3>

        <div class="grid">
          <label>Bio
            <textarea id="bio" rows="3">${htmlEscape(selectedPlayer.bio || "")}</textarea>
          </label>

          <label>Nationality
            <input id="nationality" value="${htmlEscape(selectedPlayer.nationality || "")}" />
          </label>

          <label>Dominant Foot
            <input id="dominant_foot" value="${htmlEscape(selectedPlayer.dominant_foot || "")}" placeholder="Right / Left" />
          </label>

          <label>Height (cm)
            <input id="height_cm" type="number" value="${htmlEscape(selectedPlayer.height_cm || "")}" />
          </label>

          <label>Weight (kg)
            <input id="weight_kg" type="number" value="${htmlEscape(selectedPlayer.weight_kg || "")}" />
          </label>

          <label>Club
            <input id="club" value="${htmlEscape(selectedPlayer.club || "")}" />
          </label>

          <label>Agent
            <input id="agent" value="${htmlEscape(selectedPlayer.agent || "")}" />
          </label>

          <label>Phone
            <input id="phone" value="${htmlEscape(selectedPlayer.phone || "")}" />
          </label>
        </div>

        <button id="saveProfileBtn">Save Profile</button>

        <hr />

        <h4>Player Files</h4>
        <form id="fileForm">
          <input type="file" id="attachFile" />
          <button type="submit">Upload File</button>
        </form>

        <div id="filesList" class="muted">Files list will be added next step.</div>
      </div>
    </div>
  `;

  document.getElementById("saveProfileBtn").onclick = saveProfile;

  document.getElementById("photoForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = document.getElementById("photoFile").files[0];
    if (!f) return alert("Choose a photo first.");

    const fd = new FormData();
    fd.append("profile", f);

    const res = await fetch(`/api/players/${selectedPlayer.id}/profile-image`, { method: "POST", body: fd });
    if (!res.ok) {
      const t = await res.text();
      alert("Upload failed: " + t);
      return;
    }
    await refreshSelectedPlayer();
  };

  document.getElementById("fileForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = document.getElementById("attachFile").files[0];
    if (!f) return alert("Choose a file first.");

    const fd = new FormData();
    fd.append("file", f);

    const res = await fetch(`/api/players/${selectedPlayer.id}/files`, { method: "POST", body: fd });
    if (!res.ok) {
      const t = await res.text();
      alert("Upload failed: " + t);
      return;
    }
    alert("Uploaded!");
  };
}

async function saveProfile() {
  const payload = {
    full_name: selectedPlayer.full_name,
    birthdate: selectedPlayer.birthdate,
    position: selectedPlayer.position,
    bio: document.getElementById("bio").value,
    nationality: document.getElementById("nationality").value,
    dominant_foot: document.getElementById("dominant_foot").value,
    height_cm: document.getElementById("height_cm").value ? Number(document.getElementById("height_cm").value) : null,
    weight_kg: document.getElementById("weight_kg").value ? Number(document.getElementById("weight_kg").value) : null,
    club: document.getElementById("club").value,
    agent: document.getElementById("agent").value,
    phone: document.getElementById("phone").value,
  };

  await api(`/api/players/${selectedPlayer.id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  await refreshSelectedPlayer();
  alert("Saved!");
}

async function refreshSelectedPlayer() {
  const players = await api("/api/players");
  const fresh = players.find((x) => x.id === selectedPlayer.id);
  if (fresh) selectedPlayer = fresh;
  renderProfile();
}

// Init
(async function init() {
  await loadPlayers();
  renderProfile();
})();
