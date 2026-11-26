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
let currentAudioData = "";
let activeFilter = "all";

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

let memoryCandidates = [];
let memoryIndex = 0;

const ringsCountEl = document.getElementById("ringsCount");
const levelNumEl = document.getElementById("levelNum");
const levelNameEl = document.getElementById("levelName");
const streakCountEl = document.getElementById("streakCount");
const xpFillEl = document.getElementById("xpFill");

const avatarInput = document.getElementById("avatarInput");
const avatarImg = document.getElementById("avatarImg");
const avatarPlaceholder = document.getElementById("avatarPlaceholder");

const notifBellBtn = document.getElementById("notifBellBtn");
const notifPanel = document.getElementById("notifPanel");
const reminderTimeInput = document.getElementById("reminderTimeInput");
const enableNotifBtn = document.getElementById("enableNotifBtn");
const notifStatusText = document.getElementById("notifStatusText");

const streakWarningBanner = document.getElementById("streakWarningBanner");
const warningStreakDays = document.getElementById("warningStreakDays");

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

const audioBtn = document.getElementById("audioBtn");
const audioPreviewWrap = document.getElementById("audioPreviewWrap");
const audioPreview = document.getElementById("audioPreview");
const removeAudioBtn = document.getElementById("removeAudioBtn");

const searchInput = document.getElementById("searchInput");
const entriesList = document.getElementById("entriesList");

const memoryCard = document.getElementById("memoryCard");
const memoryLabel = document.getElementById("memoryLabel");
const memoryContent = document.getElementById("memoryContent");
const nextMemoryBtn = document.getElementById("nextMemoryBtn");
const hideMemoryBtn = document.getElementById("hideMemoryBtn");

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        rings: parsed.rings || 0,
        streak: parsed.streak || 0,
        lastEntryDate: parsed.lastEntryDate || null,
        avatarData: parsed.avatarData || "",
        reminderTime: parsed.reminderTime || "20:00",
        reminderEnabled: Boolean(parsed.reminderEnabled),
        lastNotifiedDate: parsed.lastNotifiedDate || null,
        entries: Array.isArray(parsed.entries) ? parsed.entries : []
      };
    }
  } catch (err) {
    console.error("Error cargando datos:", err);
  }
  return {
    rings: 0,
    streak: 0,
    lastEntryDate: null,
    avatarData: "",
    reminderTime: "20:00",
    reminderEnabled: false,
    lastNotifiedDate: null,
    entries: []
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error("Error guardando en localStorage:", err);
    alert("No se pudo guardar (posiblemente por falta de espacio al incluir foto o audio). Intenta quitar la foto/audio o borrar entradas viejas.");
    return false;
  }
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEntryDateKey(entry) {
  if (entry.dateKey) return entry.dateKey;
  const d = new Date(Number(entry.id));
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDateKeyDaysAgo(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isStreakAtRisk() {
  return state.streak > 0 && state.lastEntryDate !== getTodayKey();
}

function updateStreakWarning() {
  if (!streakWarningBanner || !warningStreakDays) return;
  if (isStreakAtRisk()) {
    warningStreakDays.textContent = state.streak;
    streakWarningBanner.hidden = false;
  } else {
    streakWarningBanner.hidden = true;
  }
}

function updateAvatarUi() {
  if (!avatarImg) return;
  if (state.avatarData) {
    avatarImg.src = state.avatarData;
    avatarImg.hidden = false;
    if (avatarPlaceholder) avatarPlaceholder.hidden = true;
  } else {
    avatarImg.hidden = true;
    if (avatarPlaceholder) avatarPlaceholder.hidden = false;
  }
}

function updateReminderUi() {
  if (!reminderTimeInput || !notifStatusText) return;
  reminderTimeInput.value = state.reminderTime || "20:00";
  if (state.reminderEnabled && "Notification" in window && Notification.permission === "granted") {
    notifStatusText.textContent = `Activo (${state.reminderTime})`;
  } else if (state.reminderEnabled) {
    notifStatusText.textContent = "Permiso pendiente";
  } else {
    notifStatusText.textContent = "Desactivado";
  }
}

function sendStreakNotification(bodyText) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification("🔥 Diario Zona Veloz", {
    body: bodyText
  });
}

function checkScheduledReminder() {
  if (!state.reminderEnabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const today = getTodayKey();
  if (state.lastEntryDate === today || state.lastNotifiedDate === today) return;

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const currentTime = `${hh}:${mm}`;

  if (currentTime >= state.reminderTime) {
    const msg = state.streak > 0
      ? `¡Tu racha de ${state.streak} días está en peligro! Escribe hoy para no perderla.`
      : "¡Hoy es un buen día para sumar un anillo en tu diario!";
    sendStreakNotification(msg);
    state.lastNotifiedDate = today;
    saveState();
    updateReminderUi();
  }
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

  updateStreakWarning();
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

function buildMemoryCandidates() {
  const todayKey = getTodayKey();
  const pastEntries = state.entries.filter((e) => {
    const k = getEntryDateKey(e);
    return k && k !== todayKey;
  });

  if (pastEntries.length === 0) return [];

  const milestones = [
    { days: 7, label: "🕰️ HACE 1 SEMANA" },
    { days: 14, label: "🕰️ HACE 2 SEMANAS" },
    { days: 30, label: "🕰️ HACE ~1 MES" },
    { days: 90, label: "🕰️ HACE ~3 MESES" },
    { days: 180, label: "🕰️ HACE ~6 MESES" },
    { days: 365, label: "🕰️ HACE 1 AÑO" }
  ];

  const exactMatches = [];
  for (const m of milestones) {
    const targetKey = getDateKeyDaysAgo(m.days);
    pastEntries.forEach((entry) => {
      if (getEntryDateKey(entry) === targetKey) {
        exactMatches.push({ entry, label: m.label });
      }
    });
  }

  if (exactMatches.length > 0) return exactMatches;

  const shuffled = [...pastEntries].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5).map((entry) => ({
    entry,
    label: "✨ RECUERDO DE DÍAS PASADOS"
  }));
}

function renderMemoryCard() {
  if (!memoryCard || !memoryContent || !memoryLabel) return;

  memoryCandidates = buildMemoryCandidates();
  if (memoryCandidates.length === 0) {
    memoryCard.hidden = true;
    return;
  }

  memoryIndex = memoryIndex % memoryCandidates.length;
  const { entry, label } = memoryCandidates[memoryIndex];
  const canShowMedia = !entry.locked || entry.unlockedTemp;

  memoryLabel.textContent = label;
  const bodyText = entry.locked && !entry.unlockedTemp
    ? "🔒 Entrada protegida con contraseña. Búscala en la lista para desbloquearla."
    : escapeHtml(entry.body || "");

  const photoHtml =
    entry.photo && canShowMedia
      ? `<img src="${entry.photo}" alt="Foto del recuerdo" class="entry-photo" />`
      : "";

  const audioHtml =
    entry.audio && canShowMedia
      ? `<audio src="${entry.audio}" controls class="entry-audio"></audio>`
      : "";

  memoryContent.innerHTML = `
    <div class="memory-sub">${escapeHtml(entry.dateLabel || "")}</div>
    <h3 class="entry-title">${escapeHtml(entry.mood || "😄")} ${escapeHtml(entry.title || "Sin título")}</h3>
    ${bodyText ? `<p class="entry-body">${bodyText}</p>` : ""}
    ${photoHtml}
    ${audioHtml}
  `;

  memoryCard.hidden = false;
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

      const canShowMedia = !entry.locked || entry.unlockedTemp;

      const bodyText = entry.locked && !entry.unlockedTemp
        ? "🔒 Entrada protegida con contraseña. Pulsa 'Desbloquear' para leerla."
        : escapeHtml(entry.body);

      const photoHtml =
        entry.photo && canShowMedia
          ? `<img src="${entry.photo}" alt="Foto de entrada" class="entry-photo" />`
          : "";

      const audioHtml =
        entry.audio && canShowMedia
          ? `<audio src="${entry.audio}" controls class="entry-audio"></audio>`
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
          ${audioHtml}
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

avatarInput?.addEventListener("change", () => {
  const file = avatarInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    state.avatarData = String(reader.result || "");
    updateAvatarUi();
    saveState();
  };
  reader.readAsDataURL(file);
});

notifBellBtn?.addEventListener("click", () => {
  if (!notifPanel) return;
  const nextHidden = !notifPanel.hidden;
  notifPanel.hidden = nextHidden;
  notifBellBtn.setAttribute("aria-expanded", String(!nextHidden));
});

enableNotifBtn?.addEventListener("click", async () => {
  state.reminderTime = reminderTimeInput?.value || "20:00";

  if (!("Notification" in window)) {
    if (notifStatusText) notifStatusText.textContent = "No compatible aquí";
    state.reminderEnabled = true;
    saveState();
    return;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission === "granted") {
    state.reminderEnabled = true;
    saveState();
    updateReminderUi();
    sendStreakNotification(`Recordatorio configurado a las ${state.reminderTime}.`);
  } else {
    state.reminderEnabled = false;
    saveState();
    if (notifStatusText) notifStatusText.textContent = "Permiso bloqueado";
  }
});

nextMemoryBtn?.addEventListener("click", () => {
  if (memoryCandidates.length === 0) return;
  memoryIndex = (memoryIndex + 1) % memoryCandidates.length;
  renderMemoryCard();
});

hideMemoryBtn?.addEventListener("click", () => {
  if (memoryCard) memoryCard.hidden = true;
});

saveBtn.addEventListener("click", () => {
  if (isRecording) {
    alert("Detén la grabación de audio antes de guardar.");
    return;
  }

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title && !body && !currentPhotoData && !currentAudioData) {
    alert("Escribe algo, agrega una foto o graba un audio antes de guardar.");
    return;
  }

  const newEntry = {
    id: Date.now().toString(),
    dateKey: getTodayKey(),
    title: title || "Entrada del día",
    body,
    tags: parseTags(tagsInput.value),
    mood: selectedMood,
    photo: currentPhotoData,
    audio: currentAudioData,
    favorite: false,
    locked: false,
    unlockedTemp: false,
    dateLabel: new Date().toLocaleString("es-CR", {
      dateStyle: "medium",
      timeStyle: "short"
    })
  };

  const previousRings = state.rings;
  const previousStreak = state.streak;
  const previousLastDate = state.lastEntryDate;

  state.entries.unshift(newEntry);
  state.rings += 1;
  updateStreakOnSave();

  if (!saveState()) {
    state.entries.shift();
    state.rings = previousRings;
    state.streak = previousStreak;
    state.lastEntryDate = previousLastDate;
    return;
  }

  titleInput.value = "";
  bodyInput.value = "";
  tagsInput.value = "";
  currentPhotoData = "";
  photoInput.value = "";
  photoPreviewWrap.hidden = true;

  currentAudioData = "";
  if (audioPreview) audioPreview.src = "";
  if (audioPreviewWrap) audioPreviewWrap.hidden = true;

  updateHud();
  renderEntries();
  renderMemoryCard();
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

audioBtn?.addEventListener("click", async () => {
  if (!isRecording) {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      alert("Tu navegador no soporta grabación de audio aquí.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          currentAudioData = String(reader.result || "");
          if (audioPreview) audioPreview.src = currentAudioData;
          if (audioPreviewWrap) audioPreviewWrap.hidden = false;
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      isRecording = true;
      audioBtn.textContent = "⏹️ DETENER";
      audioBtn.classList.add("recording");
    } catch (err) {
      alert("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;
    audioBtn.textContent = "🎤 AUDIO";
    audioBtn.classList.remove("recording");
  }
});

removeAudioBtn?.addEventListener("click", () => {
  currentAudioData = "";
  if (audioPreview) audioPreview.src = "";
  if (audioPreviewWrap) audioPreviewWrap.hidden = true;
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
    renderMemoryCard();
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
    renderMemoryCard();
  }
});

updateAvatarUi();
updateReminderUi();
updateHud();
renderEntries();
renderMemoryCard();
checkScheduledReminder();
setInterval(checkScheduledReminder, 60000);