import { CURRENT_ACCESS_LEVEL, viruses } from "./data/viruses.js";

const listElement = document.querySelector("#virusList");
const viewElement = document.querySelector("#recordView");
const searchElement = document.querySelector("#virusSearch");
const countElement = document.querySelector("#recordCount");
const clockElement = document.querySelector("#systemClock");
const archiveWindow = document.querySelector("#archiveWindow");
const startButton = document.querySelector("#startButton");
const startPanel = document.querySelector("#startPanel");
const scientistLogDialog = document.querySelector("#scientistLogDialog");
const scientistLogTitle = document.querySelector("#scientistLogTitle");
const scientistLogPath = document.querySelector("#scientistLogPath");
const scientistLogBody = document.querySelector("#scientistLogBody");

let activeId = viruses[0]?.id ?? null;

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

  viewElement.scrollTo({ top: 0, behavior: "smooth" });
}

function openScientistLog(virus, logId) {
  const log = (virus.scientistLogs ?? []).find((item) => item.id === logId);
  if (!log) return;

  const isOpen = unlockedLogByVirus.get(virus.id) === log.id;
  const requiredLevel = isOpen ? CURRENT_ACCESS_LEVEL : log.lockedLevel;
  scientistLogPath.textContent = `PORTIA://VIRUS_ARCHIVE/${virus.code}/LOGS/${log.id}`;
  scientistLogTitle.textContent = log.title;

  if (isOpen) {
    scientistLogBody.innerHTML = `
      <div class="dialog-access granted"><span>ДОСТУП РАЗРЕШЁН</span><strong>УРОВЕНЬ ${accessLevelLabel(requiredLevel)}</strong></div>
      <div class="dialog-scientist"><span>УЧЁНЫЙ</span><strong>${escapeHtml(log.scientist)}</strong></div>
      <div class="dialog-copy">${log.content.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div>`;
  } else {
    scientistLogBody.innerHTML = `
      <div class="dialog-access denied"><span>ДОСТУП ОТКЛОНЁН</span><strong>УРОВЕНЬ ${accessLevelLabel(requiredLevel)}</strong></div>
      <div class="denied-message"><strong>НЕДОСТАТОЧНЫЙ УРОВЕНЬ ДОСТУПА</strong><p>Текущий уровень: II. Для открытия записи требуется уровень ${accessLevelLabel(requiredLevel)}.</p></div>`;
  }

  scientistLogDialog.showModal();
}

function selectVirus(id) {
  const virus = viruses.find((item) => item.id === id);
  if (!virus) return;
  activeId = id;
  renderList(searchElement.value);
  renderRecord(virus);
  if (window.innerWidth < 760) {
    viewElement.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
startButton.addEventListener("click", () => toggleStart());
document.querySelector("#menuArchive").addEventListener("click", () => {
  toggleStart(false);
  archiveWindow.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelector("#focusArchive").addEventListener("click", () => {
  archiveWindow.classList.remove("window-flash");
  requestAnimationFrame(() => archiveWindow.classList.add("window-flash"));
});
document.addEventListener("click", (event) => {
  if (!startPanel.hidden && !startPanel.contains(event.target) && !startButton.contains(event.target)) toggleStart(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") toggleStart(false);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchElement.focus();
  }
});

renderList();
if (viruses[0]) renderRecord(viruses[0]);
updateClock();
setInterval(updateClock, 1000);
