const STORAGE_KEY = "diario_zona_veloz_data_v1";

const PROMPTS = [
  "¿De qué estás orgulloso hoy?",
  "¿Qué avanzaste hoy aunque fuera poco?",
  "¿Qué momento de hoy te sacó una sonrisa?",
  "¿Qué reto superaste o qué aprendiste hoy?"
];

const IDEAS = [
  {
    title: "Avance en mi proyecto personal",
    body: "Hoy dediqué tiempo a mejorar mi proyecto y probar ideas nuevas. Cada pequeño avance suma.",
    tags: "#proyectos #enfoque"
  },
  {
    title: "Buena partida y desconexión",
    body: "Me tomé un buen rato para jugar, despejar la mente y recargar energía para lo que sigue.",
    tags: "#juegos #descanso"
  },
  {
    title: "Día de aprendizaje",
    body: "Hoy resolví un detalle técnico que me estaba costando trabajo y entendí mejor cómo funciona.",
    tags: "#aprender #codigo"
  }
];

let state = loadState();
let selectedMood = "😄";
let currentPhotoData = "";
let activeFilter = "all";

const ringsCountEl = document.getElementById("ringsCount");
const levelNumEl = document.getElementById("levelNum");
const levelNameEl = document.getElementById("levelName");
const streakCountEl = document.getElementById("streakCount");
const xpFillEl = document.getElementById("xpFill");

const promptBarText = document.querySelector(".prompt-bar span");
const randomPromptBtn = document.getElementById("randomPromptBtn");
const titleInput = document.getElementById("entryTitle");
const bodyInput = document.getElementById("entryBody");
const tagsInput = document.getElementById("entryTags");
const moodPicker = document.getElementById("moodPicker");

const saveBtn = document.getElementById("saveBtn");
const ideaBtn = document.getElementById("ideaBtn");
const photoBtn = document.getElementById("photoBtn");
const photoInput = document.getElementById("photoInput");
const photoPreviewWrap = document.getElementById("photoPreviewWrap");
const photoPreview = document.getElementById("photoPreview");
const removePhotoBtn = document.getElementById("removePhotoBtn");

const searchInput = document.getElementById("searchInput");
const entriesList = document.getElementById("entriesList");

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error("Error cargando datos:", err);
  }
  return {
    rings: 0,
    streak: 0,
    lastEntryDate: null,
    entries: []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getTodayKey() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function updateHud() {
  ringsCountEl.textContent = state.rings;
  streakCountEl.textContent = state.streak;

  const level = Math.floor(state.rings / 5) + 1;
  const progressInLevel = ((state.rings % 5) / 5) * 100;

  let rank = "Novato";
  if (level >= 6) rank = "Leyenda Veloz";
  else if (level >= 4) rank = "Corredor";
  else if (level >= 2) rank = "Aventurero";

  levelNumEl.textContent = level;
  levelNameEl.textContent = rank;
  xpFillEl.style.width = `${progressInLevel}%`;
}

function parseTags(rawTags) {
  return rawTags
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderEntries() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = state.entries.filter((entry) => {
    if (activeFilter === "favorites" && !entry.favorite) return false;
    if (activeFilter === "lock" && !entry.locked) return false;

    if (!query) return true;
    const haystack = [
      entry.title,
      entry.body,
      entry.mood,
      ...(entry.tags || [])
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  if (filtered.length === 0) {
    entriesList.innerHTML = `<div class="empty-state">No hay entradas aquí. ¡Consigue un anillo!</div>`;
    return;
  }

  entriesList.innerHTML = filtered
    .map((entry) => {
      const tagsHtml = (entry.tags || [])
        .map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
        .join("");

      const bodyText = entry.locked && !entry.unlockedTemp
        ? "🔒 Entrada protegida con contraseña. Pulsa 'Desbloquear' para leerla."
        : escapeHtml(entry.body);

      const photoHtml =
        entry.photo && (!entry.locked || entry.unlockedTemp)
          ? `<img src="${entry.photo}" alt="Foto de entrada" class="entry-photo" />`
          : "";

      return `
        <article class="entry-card" data-id="${entry.id}">
          <div class="entry-top">
            <h3 class="entry-title">${escapeHtml(entry.mood)} ${escapeHtml(entry.title || "Sin título")}</h3>
            <span>${entry.favorite ? "⭐" : "☆"}</span>
          </div>
          <div class="entry-meta">${escapeHtml(entry.dateLabel)}</div>
          <p class="entry-body">${bodyText}</p>
          ${photoHtml}
          ${tagsHtml ? `<div class="entry-tags">${tagsHtml}</div>` : ""}
          <div class="entry-actions">
            <button type="button" class="small-action" data-action="fav">
              ${entry.favorite ? "Quitar favorita" : "Favorita"}
            </button>
            <button type="button" class="small-action" data-action="lock">
              ${entry.locked ? (entry.unlockedTemp ? "Bloquear" : "Desbloquear") : "🔒 Contraseña"}
            </button>
            <button type="button" class="small-action" data-action="delete">Eliminar</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateStreakOnSave() {
  const today = getTodayKey();
  if (state.lastEntryDate === today) return;

  if (state.lastEntryDate) {
    const prev = new Date(`${state.lastEntryDate}T00:00:00`);
    const curr = new Date(`${today}T00:00:00`);
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    state.streak = diffDays === 1 ? state.streak + 1 : 1;
  } else {
    state.streak = 1;
  }

  state.lastEntryDate = today;
}

saveBtn.addEventListener("click", () => {
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title && !body) {
    alert("Escribe un título o algo sobre tu día antes de guardar.");
    return;
  }

  const newEntry = {
    id: Date.now().toString(),
    title: title || "Entrada del día",
    body,
    tags: parseTags(tagsInput.value),
    mood: selectedMood,
    photo: currentPhotoData,
    favorite: false,
    locked: false,
    unlockedTemp: false,
    dateLabel: new Date().toLocaleString("es-CR", {
      dateStyle: "medium",
      timeStyle: "short"
    })
  };

  state.entries.unshift(newEntry);
  state.rings += 1;
  updateStreakOnSave();
  saveState();

  titleInput.value = "";
  bodyInput.value = "";
  tagsInput.value = "";
  currentPhotoData = "";
  photoInput.value = "";
  photoPreviewWrap.hidden = true;

  updateHud();
  renderEntries();
});

ideaBtn.addEventListener("click", () => {
  const pick = IDEAS[Math.floor(Math.random() * IDEAS.length)];
  titleInput.value = pick.title;
  bodyInput.value = pick.body;
  tagsInput.value = pick.tags;
});

randomPromptBtn.addEventListener("click", () => {
  const current = promptBarText.textContent;
  const candidates = PROMPTS.filter((p) => !current.includes(p));
  const next = candidates[Math.floor(Math.random() * candidates.length)] || PROMPTS[0];
  promptBarText.textContent = `💡 ${next}`;
});

moodPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".mood-btn");
  if (!btn) return;
  moodPicker.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  selectedMood = btn.dataset.mood;
});

photoBtn.addEventListener("click", () => photoInput.click());

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    currentPhotoData = String(reader.result || "");
    photoPreview.src = currentPhotoData;
    photoPreviewWrap.hidden = false;
  };
  reader.readAsDataURL(file);
});

removePhotoBtn.addEventListener("click", () => {
  currentPhotoData = "";
  photoInput.value = "";
  photoPreviewWrap.hidden = true;
});

document.querySelectorAll(".tab-btn").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeFilter = tab.dataset.filter;
    renderEntries();
  });
});

searchInput.addEventListener("input", renderEntries);

entriesList.addEventListener("click", (e) => {
  const btn = e.target.closest(".small-action");
  if (!btn) return;

  const card = btn.closest(".entry-card");
  const entry = state.entries.find((item) => item.id === card?.dataset.id);
  if (!entry) return;

  const action = btn.dataset.action;

  if (action === "fav") {
    entry.favorite = !entry.favorite;
    saveState();
    renderEntries();
  } else if (action === "delete") {
    state.entries = state.entries.filter((item) => item.id !== entry.id);
    saveState();
    renderEntries();
  } else if (action === "lock") {
    if (!entry.locked) {
      const pin = prompt("Crea una contraseña para esta entrada:");
      if (!pin) return;
      entry.pin = pin;
      entry.locked = true;
      entry.unlockedTemp = false;
    } else if (!entry.unlockedTemp) {
      const attempt = prompt("Ingresa la contraseña:");
      if (attempt === entry.pin) {
        entry.unlockedTemp = true;
      } else {
        alert("Contraseña incorrecta.");
      }
    } else {
      entry.unlockedTemp = false;
    }
    saveState();
    renderEntries();
  }
});

updateHud();
renderEntries();