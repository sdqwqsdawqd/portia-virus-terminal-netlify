import { CURRENT_ACCESS_LEVEL, viruses } from "./data/viruses.js";

const listElement = document.querySelector("#virusList");
const viewElement = document.querySelector("#recordView");
const searchElement = document.querySelector("#virusSearch");
const countElement = document.querySelector("#recordCount");
const clockElement = document.querySelector("#systemClock");
const desktopArea = document.querySelector("#desktopArea");
const archiveWindow = document.querySelector("#archiveWindow");
const globalSearchWindow = document.querySelector("#globalSearchWindow");
const globalSearchInput = document.querySelector("#globalSearchInput");
const globalSearchResults = document.querySelector("#globalSearchResults");
const globalSearchStatus = document.querySelector("#globalSearchStatus");
const globalSearchCount = document.querySelector("#globalSearchCount");
const infoWindow = document.querySelector("#infoWindow");
const settingsWindow = document.querySelector("#settingsWindow");
const trashWindow = document.querySelector("#trashWindow");
const settingsStatus = document.querySelector("#settingsStatus");
const trashFileList = document.querySelector("#trashFileList");
const trashEditor = document.querySelector("#trashEditor");
const trashEditorName = document.querySelector("#trashEditorName");
const trashFileContent = document.querySelector("#trashFileContent");
const trashStatus = document.querySelector("#trashStatus");
const startButton = document.querySelector("#startButton");
const startPanel = document.querySelector("#startPanel");

let activeId = viruses[0]?.id ?? null;
let switchTimer = null;
let activeApp = "archive";
let topWindowLayer = 50;

const mobileLayout = window.matchMedia("(max-width: 900px)");
const appStates = new Map([
  ["archive", { window: archiveWindow, task: document.querySelector('[data-task-app="archive"]'), open: true, minimized: false }],
  ["search", { window: globalSearchWindow, task: document.querySelector('[data-task-app="search"]'), open: false, minimized: false }],
  ["info", { window: infoWindow, task: document.querySelector('[data-task-app="info"]'), open: false, minimized: false }],
  ["settings", { window: settingsWindow, task: document.querySelector('[data-task-app="settings"]'), open: false, minimized: false }],
  ["trash", { window: trashWindow, task: document.querySelector('[data-task-app="trash"]'), open: false, minimized: false }]
]);

// Для каждого вируса одна случайная запись доступна до перезагрузки страницы.
const unlockedLogByVirus = new Map(
  viruses.map((virus) => {
    const logs = virus.scientistLogs ?? [];
    const selected = logs.length ? logs[Math.floor(Math.random() * logs.length)].id : null;
    return [virus.id, selected];
  })
);

const accessLevelLabel = (level) => ({ 2: "II", 3: "III", 4: "IV" })[level] ?? String(level);

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeText = (value = "") => String(value).toLocaleLowerCase("ru").replaceAll("ё", "е");

const SETTINGS_STORAGE_KEY = "portia-desktop-settings-v1";
const TRASH_STORAGE_KEY = "portia-trash-files-v1";
const defaultDesktopSettings = { accent: "teal", wallpaper: "radar", iconSize: "standard" };

function readLocalData(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

let desktopSettings = { ...defaultDesktopSettings, ...readLocalData(SETTINGS_STORAGE_KEY, {}) };

const defaultTrashFiles = viruses.map((virus) => ({
  id: virus.id,
  name: `${virus.name}_${virus.code}.virus`,
  location: "C:\\PORTIA\\VIRUS_ARCHIVE",
  type: "Документ вируса",
  content: [
    "PORTIA / ЛОКАЛЬНАЯ КОПИЯ",
    `ОБЪЕКТ: ${virus.name}`,
    `КОД: ${virus.code}`,
    `СТАТУС: ${virus.status}`,
    "",
    "ВНЕШНИЕ ХАРАКТЕРИСТИКИ:",
    virus.external,
    "",
    "ФИЗИОЛОГИЯ:",
    virus.physiology
  ].join("\n")
}));

const storedTrashFiles = readLocalData(TRASH_STORAGE_KEY, []);
let trashFiles = defaultTrashFiles.map((defaultFile) => {
  const storedFile = Array.isArray(storedTrashFiles) ? storedTrashFiles.find((file) => file.id === defaultFile.id) : null;
  return storedFile ? { ...defaultFile, content: storedFile.content } : defaultFile;
});
let activeTrashFileId = null;

function applyDesktopSettings(announce = false) {
  const root = document.documentElement;
  root.dataset.accent = desktopSettings.accent;
  root.dataset.wallpaper = desktopSettings.wallpaper;
  root.dataset.iconSize = desktopSettings.iconSize;

  document.querySelectorAll("[data-setting]").forEach((button) => {
    const selected = desktopSettings[button.dataset.setting] === button.dataset.value;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  if (announce) {
    const saved = writeLocalData(SETTINGS_STORAGE_KEY, desktopSettings);
    settingsStatus.textContent = saved ? "Настройки сохранены" : "Не удалось сохранить настройки";
  }
}

function renderTrashFiles() {
  trashFileList.replaceChildren();
  trashFiles.forEach((file) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `trash-file-row${file.id === activeTrashFileId ? " active" : ""}`;
    button.innerHTML = `
      <span class="trash-file-name"><img src="assets/app-virus.png" alt="" /><strong>${escapeHtml(file.name)}</strong></span>
      <span>${escapeHtml(file.location)}</span>
      <span>${escapeHtml(file.type)}</span>`;
    button.addEventListener("click", () => openTrashFile(file.id));
    trashFileList.append(button);
  });
}

function openTrashFile(fileId) {
  const file = trashFiles.find((item) => item.id === fileId);
  if (!file) return;
  activeTrashFileId = fileId;
  trashEditor.hidden = false;
  trashEditorName.textContent = file.name;
  trashFileContent.value = file.content;
  trashStatus.textContent = "";
  renderTrashFiles();
  if (mobileLayout.matches) trashEditor.scrollIntoView({ block: "start", behavior: "smooth" });
}

function saveTrashFile() {
  const file = trashFiles.find((item) => item.id === activeTrashFileId);
  if (!file) return;
  file.content = trashFileContent.value;
  const saved = writeLocalData(TRASH_STORAGE_KEY, trashFiles.map(({ id, content }) => ({ id, content })));
  trashStatus.textContent = saved ? "Файл сохранён" : "Не удалось сохранить файл";
}

function restoreTrashFile() {
  const original = defaultTrashFiles.find((item) => item.id === activeTrashFileId);
  const file = trashFiles.find((item) => item.id === activeTrashFileId);
  if (!original || !file) return;
  file.content = original.content;
  trashFileContent.value = original.content;
  writeLocalData(TRASH_STORAGE_KEY, trashFiles.map(({ id, content }) => ({ id, content })));
  trashStatus.textContent = "Исходный текст восстановлен";
}

function syncWindows() {
  let visibleMobileApp = false;

  appStates.forEach((state, appId) => {
    const visible = state.open && !state.minimized && (!mobileLayout.matches || appId === activeApp);
    state.window.hidden = !visible;
    state.task.hidden = !state.open;
    state.task.classList.toggle("active", visible && appId === activeApp);
    state.task.classList.toggle("minimized", state.minimized);
    if (mobileLayout.matches && visible) visibleMobileApp = true;
  });

  desktopArea.classList.toggle("mobile-app-open", visibleMobileApp);
}

function focusApp(appId) {
  const state = appStates.get(appId);
  if (!state || !state.open || state.minimized) return;
  activeApp = appId;
  topWindowLayer += 1;
  state.window.style.zIndex = String(topWindowLayer);
  appStates.forEach((item, id) => item.window.classList.toggle("is-active", id === appId));
  syncWindows();
}

function openApp(appId) {
  const state = appStates.get(appId);
  if (!state) return;
  state.open = true;
  state.minimized = false;
  focusApp(appId);
  toggleStart(false);

  if (appId === "search") {
    renderGlobalSearch(globalSearchInput.value);
    setTimeout(() => globalSearchInput.focus(), 0);
  }
  if (appId === "settings") applyDesktopSettings();
  if (appId === "trash") renderTrashFiles();
}

function activateAnotherApp(excludedId) {
  const fallback = [...appStates.entries()].find(([id, state]) => id !== excludedId && state.open && !state.minimized);
  activeApp = fallback?.[0] ?? null;
  if (activeApp) focusApp(activeApp);
  else syncWindows();
}

function minimizeApp(appId) {
  const state = appStates.get(appId);
  if (!state) return;
  state.minimized = true;
  activateAnotherApp(appId);
}

function closeApp(appId) {
  const state = appStates.get(appId);
  if (!state) return;
  state.open = false;
  state.minimized = false;
  state.window.classList.remove("is-maximized");
  activateAnotherApp(appId);
}

function toggleMaximize(appId) {
  const state = appStates.get(appId);
  if (!state || mobileLayout.matches) return;
  const isMaximized = state.window.classList.toggle("is-maximized");
  const button = state.window.querySelector('[data-window-action="maximize"]');
  button.setAttribute("aria-label", isMaximized ? "Восстановить размер окна" : "Развернуть окно");
  focusApp(appId);
}

function enableWindowDragging(state, appId) {
  const handle = state.window.querySelector("[data-drag-handle]");
  let drag = null;

  handle.addEventListener("pointerdown", (event) => {
    if (mobileLayout.matches || state.window.classList.contains("is-maximized") || event.target.closest(".window-controls")) return;
    const areaRect = desktopArea.getBoundingClientRect();
    const windowRect = state.window.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - windowRect.left,
      offsetY: event.clientY - windowRect.top,
      areaRect,
      width: windowRect.width,
      height: windowRect.height
    };
    state.window.style.transform = "none";
    state.window.style.right = "auto";
    state.window.style.bottom = "auto";
    state.window.style.width = `${windowRect.width}px`;
    state.window.style.height = `${windowRect.height}px`;
    handle.setPointerCapture(event.pointerId);
    focusApp(appId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const maxLeft = Math.max(8, drag.areaRect.width - drag.width - 8);
    const maxTop = Math.max(8, drag.areaRect.height - 46);
    const left = Math.min(maxLeft, Math.max(8, event.clientX - drag.areaRect.left - drag.offsetX));
    const top = Math.min(maxTop, Math.max(8, event.clientY - drag.areaRect.top - drag.offsetY));
    state.window.style.left = `${left}px`;
    state.window.style.top = `${top}px`;
  });

  const endDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
  };
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
}

const mediaBlock = (src, alt, label) => {
  if (src) {
    return `<figure class="subject-media"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" /><figcaption>${escapeHtml(label)}</figcaption></figure>`;
  }

  return `<figure class="subject-media media-empty">
    <img src="assets/portia-logo.png" alt="" aria-hidden="true" />
    <div><span>ВИЗУАЛЬНЫЙ МАТЕРИАЛ</span><strong>ОЖИДАЕТ ЗАГРУЗКИ</strong><small>${escapeHtml(label)}</small></div>
  </figure>`;
};

function renderList(query = "") {
  const normalized = query.trim().toLocaleLowerCase("ru");
  const filtered = viruses.filter((virus) =>
    `${virus.name} ${virus.code} ${virus.status}`.toLocaleLowerCase("ru").includes(normalized)
  );

  countElement.textContent = String(viruses.length).padStart(2, "0");
  listElement.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "list-empty";
    empty.textContent = "Совпадений в архиве нет";
    listElement.append(empty);
    return;
  }

  filtered.forEach((virus, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `virus-row${virus.id === activeId ? " active" : ""}`;
    button.dataset.virusId = virus.id;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(virus.id === activeId));
    button.innerHTML = `
      <span class="row-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="row-main"><strong>${escapeHtml(virus.name)}</strong><small>${escapeHtml(virus.code)}</small></span>
      <span class="row-status">${escapeHtml(virus.status)}</span>`;
    button.addEventListener("click", () => selectVirus(virus.id));
    listElement.append(button);
  });
}

function searchableGroups(virus) {
  return [
    {
      label: "ОСНОВНЫЕ ДАННЫЕ",
      text: [virus.name, virus.code, virus.status]
    },
    {
      label: "КЛАССИФИКАЦИЯ",
      text: Object.values(virus.classification ?? {})
    },
    {
      label: "ХАРАКТЕРИСТИКИ",
      text: [virus.external, virus.physiology, ...Object.values(virus.ppu ?? {})]
    },
    {
      label: "МУТАЦИИ",
      text: (virus.mutations ?? []).flatMap((mutation) => [mutation.name, mutation.description])
    },
    {
      label: "УЧЁНЫЕ",
      text: (virus.scientistLogs ?? []).flatMap((log) => [log.title, log.scientist])
    }
  ].map((group) => ({ ...group, haystack: normalizeText(group.text.filter(Boolean).join(" ")) }));
}

function renderGlobalSearch(query = "") {
  const normalized = normalizeText(query.trim());
  const terms = normalized.split(/\s+/).filter(Boolean);
  const matches = viruses
    .map((virus) => {
      const groups = searchableGroups(virus);
      const completeIndex = groups.map((group) => group.haystack).join(" ");
      const isMatch = terms.length === 0 || terms.every((term) => completeIndex.includes(term));
      const matchedGroups = terms.length
        ? groups.filter((group) => terms.some((term) => group.haystack.includes(term))).map((group) => group.label)
        : ["КАРТОЧКА ВИРУСА"];
      return { virus, isMatch, matchedGroups };
    })
    .filter((result) => result.isMatch);

  globalSearchCount.textContent = String(matches.length).padStart(2, "0");
  globalSearchStatus.textContent = normalized ? `Результаты для «${query.trim()}»` : "Все записи базы";
  globalSearchResults.replaceChildren();

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "global-search-empty";
    empty.innerHTML = "<strong>СОВПАДЕНИЙ НЕТ</strong><span>Измените запрос или проверьте написание.</span>";
    globalSearchResults.append(empty);
    return;
  }

  matches.forEach(({ virus, matchedGroups }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "global-result";
    button.innerHTML = `
      <span class="global-result-mark" aria-hidden="true">DB</span>
      <span class="global-result-main">
        <span class="global-result-heading"><strong>${escapeHtml(virus.name)}</strong><small>${escapeHtml(virus.code)}</small></span>
        <span class="global-result-matches">${matchedGroups.map((label) => `<i>${escapeHtml(label)}</i>`).join("")}</span>
      </span>
      <span class="global-result-status">${escapeHtml(virus.status)}</span>`;
    button.addEventListener("click", () => {
      openApp("archive");
      if (virus.id === activeId) renderRecord(virus);
      else selectVirus(virus.id);
    });
    globalSearchResults.append(button);
  });
}

function renderRecord(virus) {
  const classification = [
    ["Общий уровень опасности", virus.classification.danger, "danger"],
    ["Распространение", virus.classification.spread, "spread"],
    ["Способ распространения", virus.classification.transmission, "transmission"],
    ["Угроза и риск побега", virus.classification.escapeRisk, "escape"],
    ["Разум", virus.classification.mind, "mind"],
    ["Вид / внешность", virus.classification.appearance, "appearance"],
    ["Поведение", virus.classification.behavior, "behavior"]
  ];

  const mutations = virus.mutations
    .map(
      (mutation, index) => `<section class="mutation-card">
        <div class="mutation-index">M-${String(index + 1).padStart(2, "0")}</div>
        ${mediaBlock(mutation.image, mutation.name, "Скриншот мутации")}
        <div class="mutation-copy"><h4>${escapeHtml(mutation.name)}</h4><p>${escapeHtml(mutation.description)}</p></div>
      </section>`
    )
    .join("");

  const unlockedLogId = unlockedLogByVirus.get(virus.id);
  const scientistLogs = (virus.scientistLogs ?? [])
    .map((log, index) => {
      const isOpen = log.id === unlockedLogId;
      const shownLevel = isOpen ? CURRENT_ACCESS_LEVEL : log.lockedLevel;
      return `<button class="scientist-log-row ${isOpen ? "available" : "locked"}" type="button" data-log-id="${escapeHtml(log.id)}">
        <span class="log-number">LOG-${String(index + 1).padStart(2, "0")}</span>
        <span class="log-name"><strong>${escapeHtml(log.title)}</strong><small>${escapeHtml(log.scientist)}</small></span>
        <span class="log-clearance">УРОВЕНЬ ${accessLevelLabel(shownLevel)}</span>
        <span class="log-action">${isOpen ? "ОТКРЫТЬ" : "ЗАБЛОКИРОВАНО"}</span>
      </button>`;
    })
    .join("");

  viewElement.innerHTML = `
    <header class="record-header">
      <div>
        <span class="eyebrow">КАРТОЧКА ИНФИЦИРОВАННОГО / ${escapeHtml(virus.code)}</span>
        <h2>${escapeHtml(virus.name)}</h2>
      </div>
      <div class="record-status"><span></span>${escapeHtml(virus.status)}</div>
    </header>

    <div class="record-document">
      <section class="record-hero">
        ${mediaBlock(virus.infectedImage, `Субъект после заражения вирусом ${virus.name}`, "Фото после заражения")}
        <div class="classification-panel">
          <div class="section-kicker"><span>01</span>КЛАССИФИКАЦИЯ</div>
          <div class="classification-grid">
            ${classification
              .map(
                ([label, value, tone]) => `<div class="class-cell ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
              )
              .join("")}
          </div>
        </div>
      </section>

      <section class="dossier-section">
        <div class="section-kicker"><span>02</span>ВНЕШНИЕ ХАРАКТЕРИСТИКИ</div>
        <p class="lead-copy">${escapeHtml(virus.external)}</p>
      </section>

      <section class="dossier-section">
        <div class="section-kicker"><span>03</span>ХАРАКТЕРИСТИКИ С PPU</div>
        <div class="metric-grid">
          <div><span>ЗДОРОВЬЕ</span><p>${escapeHtml(virus.ppu.health)}</p></div>
          <div><span>СКОРОСТЬ</span><p>${escapeHtml(virus.ppu.speed)}</p></div>
          <div><span>СПОСОБНОСТИ</span><p>${escapeHtml(virus.ppu.abilities)}</p></div>
        </div>
      </section>

      <section class="dossier-section">
        <div class="section-kicker"><span>04</span>ФИЗИОЛОГИЯ</div>
        <p class="lead-copy">${escapeHtml(virus.physiology)}</p>
      </section>

      <section class="dossier-section mutation-section">
        <div class="section-kicker"><span>05</span>МУТАЦИИ ВИРУСА</div>
        <div class="mutation-grid">${mutations}</div>
      </section>

      <section class="dossier-section scientist-log-section">
        <div class="section-kicker"><span>06</span>ЗАПИСИ УЧЁНЫХ</div>
        <div class="access-summary"><span>ТЕКУЩИЙ УРОВЕНЬ ДОСТУПА</span><strong>II</strong></div>
        <div class="scientist-log-list">${scientistLogs}</div>
      </section>

      <footer class="record-footer"><span>PORTIA / SCIENCE EXPEDITION</span><span>ЗАПИСЬ ${escapeHtml(virus.code)}</span></footer>
    </div>`;

  viewElement.querySelectorAll("[data-log-id]").forEach((button) => {
    button.addEventListener("click", () => openScientistLog(virus, button.dataset.logId));
  });

  viewElement.scrollTo({ top: 0, behavior: "auto" });
}

function openScientistLog(virus, logId) {
  const log = (virus.scientistLogs ?? []).find((item) => item.id === logId);
  if (!log) return;

  const isOpen = unlockedLogByVirus.get(virus.id) === log.id;
  const requiredLevel = isOpen ? CURRENT_ACCESS_LEVEL : log.lockedLevel;
  const documentBody = isOpen
    ? `<section class="archive-document-section">
        <h2>ТЕКСТ ЗАПИСИ</h2>
        ${log.content.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      </section>`
    : `<section class="archive-document-section restricted-document">
        <div class="restriction-mark">ДОСТУП ОГРАНИЧЕН</div>
        <h2>НЕДОСТАТОЧНЫЙ УРОВЕНЬ ДОСТУПА</h2>
        <p>Текущий уровень: II. Для чтения этого документа требуется уровень ${accessLevelLabel(requiredLevel)}.</p>
        <div class="redaction-lines" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      </section>`;

  viewElement.innerHTML = `
    <article class="archive-document-view">
      <header class="archive-document-bar">
        <button type="button" id="backToDossier">ВЕРНУТЬСЯ К ДОСЬЕ</button>
        <span>PORTIA / АРХИВ 2059 / УРОВЕНЬ ${accessLevelLabel(requiredLevel)}</span>
      </header>
      <div class="archive-document-paper">
        <div class="archive-document-stamp">${isOpen ? "ДОПУСК РАЗРЕШЁН" : "ДОПУСК ОТКЛОНЁН"}</div>
        <div class="archive-document-code">PORTIA://VIRUS_ARCHIVE/${escapeHtml(virus.code)}/LOGS/${escapeHtml(log.id)}</div>
        <h1>${escapeHtml(log.title)}</h1>
        <dl class="archive-document-meta">
          <div><dt>ОБЪЕКТ</dt><dd>${escapeHtml(virus.name)} / ${escapeHtml(virus.code)}</dd></div>
          <div><dt>УЧЁНЫЙ</dt><dd>${escapeHtml(log.scientist)}</dd></div>
          <div><dt>УРОВЕНЬ</dt><dd>${accessLevelLabel(requiredLevel)}</dd></div>
        </dl>
        ${documentBody}
        <footer><span>ВНУТРЕННИЙ АРХИВ PORTIA</span><span>2059</span></footer>
      </div>
    </article>`;

  viewElement.querySelector("#backToDossier").addEventListener("click", () => renderRecord(virus));
  viewElement.scrollTo({ top: 0, behavior: "auto" });
  if (mobileLayout.matches) {
    viewElement.scrollIntoView({ behavior: "auto", block: "start" });
  }
}

function selectVirus(id) {
  const virus = viruses.find((item) => item.id === id);
  if (!virus) return;
  if (id === activeId) return;

  clearTimeout(switchTimer);
  viewElement.classList.remove("record-transition-in");
  viewElement.classList.add("record-transition-out");
  switchTimer = setTimeout(() => {
    activeId = id;
    renderList(searchElement.value);
    renderRecord(virus);
    viewElement.classList.remove("record-transition-out");
    viewElement.classList.add("record-transition-in");
    setTimeout(() => viewElement.classList.remove("record-transition-in"), 190);
    if (mobileLayout.matches) {
      viewElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 85);
}

function updateClock() {
  const now = new Date();
  clockElement.textContent = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(now);
  clockElement.dateTime = now.toISOString();
}

function toggleStart(force) {
  const shouldOpen = typeof force === "boolean" ? force : startPanel.hidden;
  startPanel.hidden = !shouldOpen;
  startButton.setAttribute("aria-expanded", String(shouldOpen));
}

searchElement.addEventListener("input", (event) => renderList(event.target.value));
globalSearchInput.addEventListener("input", (event) => renderGlobalSearch(event.target.value));
startButton.addEventListener("click", () => toggleStart());
document.querySelector("#menuArchive").addEventListener("click", () => {
  openApp("archive");
});
document.querySelector("#menuSearch").addEventListener("click", () => openApp("search"));
document.querySelector("#menuInfo").addEventListener("click", () => openApp("info"));
document.querySelector("#menuSettings").addEventListener("click", () => openApp("settings"));
document.querySelector("#menuTrash").addEventListener("click", () => openApp("trash"));

document.querySelectorAll("[data-setting]").forEach((button) => {
  button.addEventListener("click", () => {
    desktopSettings = { ...desktopSettings, [button.dataset.setting]: button.dataset.value };
    applyDesktopSettings(true);
  });
});

document.querySelector("#factoryReset").addEventListener("click", () => {
  desktopSettings = { ...defaultDesktopSettings };
  applyDesktopSettings(true);
  settingsStatus.textContent = "Заводские настройки восстановлены";
});

document.querySelector("#saveTrashFile").addEventListener("click", saveTrashFile);
document.querySelector("#restoreTrashFile").addEventListener("click", restoreTrashFile);
document.querySelector("#closeTrashEditor").addEventListener("click", () => {
  activeTrashFileId = null;
  trashEditor.hidden = true;
  renderTrashFiles();
});

document.querySelectorAll("[data-open-app]").forEach((button) => {
  button.addEventListener("click", () => openApp(button.dataset.openApp));
});

appStates.forEach((state, appId) => {
  state.window.addEventListener("pointerdown", () => focusApp(appId));
  state.task.addEventListener("click", () => {
    if (state.open && !state.minimized && activeApp === appId) minimizeApp(appId);
    else openApp(appId);
  });
  state.window.querySelectorAll("[data-window-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const action = button.dataset.windowAction;
      if (action === "minimize") minimizeApp(appId);
      if (action === "maximize") toggleMaximize(appId);
      if (action === "close") closeApp(appId);
    });
  });
  enableWindowDragging(state, appId);
});

document.addEventListener("click", (event) => {
  if (!startPanel.hidden && !startPanel.contains(event.target) && !startButton.contains(event.target)) toggleStart(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") toggleStart(false);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openApp("search");
  }
});

mobileLayout.addEventListener("change", () => {
  if (mobileLayout.matches) {
    appStates.forEach((state) => state.window.classList.remove("is-maximized"));
  }
  syncWindows();
});

renderList();
renderGlobalSearch();
renderTrashFiles();
applyDesktopSettings();
if (viruses[0]) renderRecord(viruses[0]);
focusApp("archive");
updateClock();
setInterval(updateClock, 1000);
