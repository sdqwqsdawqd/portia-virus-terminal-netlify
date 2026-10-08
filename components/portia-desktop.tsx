"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PortiaEditor } from "@/components/portia-editor";
import type { PortiaContent, Virus } from "@/lib/portia-content";

type AppId = "archive" | "search" | "info" | "settings" | "broadcasts" | "editor";
type WindowState = { open: boolean; minimized: boolean; maximized: boolean; z: number };
type SaveState = "idle" | "saving" | "saved" | "error";

const appMeta: Record<AppId, { label: string; path: string; icon: string }> = {
  archive: { label: "База вирусов", path: "PORTIA://VIRUS_ARCHIVE", icon: "/assets/app-virus.png" },
  search: { label: "Глобальный поиск", path: "PORTIA://GLOBAL_SEARCH", icon: "/assets/app-search.png" },
  info: { label: "Информация", path: "PORTIA://INFORMATION", icon: "/assets/app-info.png" },
  settings: { label: "Настройки", path: "PORTIA://DESKTOP_SETTINGS", icon: "/assets/app-settings.png" },
  broadcasts: { label: "Сводка", path: "PORTIA://BULLETIN", icon: "/assets/app-broadcasts.png" },
  editor: { label: "Редактор", path: "PORTIA://CONTENT_CONTROL", icon: "/assets/app-settings.png" },
};

const initialWindows: Record<AppId, WindowState> = {
  archive: { open: true, minimized: false, maximized: false, z: 11 },
  search: { open: false, minimized: false, maximized: false, z: 10 },
  info: { open: false, minimized: false, maximized: false, z: 10 },
  settings: { open: false, minimized: false, maximized: false, z: 10 },
  broadcasts: { open: false, minimized: false, maximized: false, z: 10 },
  editor: { open: false, minimized: false, maximized: false, z: 10 },
};

const escapeSearch = (value: string) => value.toLocaleLowerCase("ru").replace(/ё/g, "е");
const roman = (level: number) => ({ 1: "I", 2: "II", 3: "III", 4: "IV" })[level] ?? String(level);

export function PortiaDesktop({ initialContent }: { initialContent: PortiaContent }) {
  const [content, setContent] = useState<PortiaContent>(initialContent);
  const [canEdit, setCanEdit] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [booting, setBooting] = useState(true);
  const [clock, setClock] = useState("--:--:--");
  const [startOpen, setStartOpen] = useState(false);
  const [windows, setWindows] = useState<Record<AppId, WindowState>>(initialWindows);
  const [activeApp, setActiveApp] = useState<AppId>("archive");
  const [topZ, setTopZ] = useState(20);
  const [activeVirusId, setActiveVirusId] = useState(initialContent.viruses[0]?.id ?? "");
  const [virusQuery, setVirusQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [selectedInfoId, setSelectedInfoId] = useState(initialContent.infoSections[0]?.id ?? "");
  const [sessionSeed, setSessionSeed] = useState(0);
  const [desktopSettings, setDesktopSettings] = useState({ accent: "teal", wallpaper: "radar", iconSize: "standard" });

  const fetchContent = useCallback(async () => {
    try {
      const response = await fetch("/api/content", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { content?: PortiaContent; canEdit?: boolean; revision?: number };
      if (payload.content) {
        setContent(payload.content);
        setActiveVirusId((current) => payload.content!.viruses.some((virus) => virus.id === current) ? current : payload.content!.viruses[0]?.id ?? "");
        setSelectedInfoId((current) => payload.content!.infoSections.some((section) => section.id === current) ? current : payload.content!.infoSections[0]?.id ?? "");
      }
      setCanEdit(Boolean(payload.canEdit));
      setRevision(payload.revision ?? 0);
    } catch {
      // The bundled defaults keep the terminal usable if synchronization is briefly unavailable.
    }
  }, []);

  useEffect(() => {
    const bootTimer = window.setTimeout(() => setBooting(false), 1650);
    setSessionSeed(Math.floor(Math.random() * 100000) + 1);
    const tick = () => setClock(new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()));
    tick();
    const clockTimer = window.setInterval(tick, 1000);
    void fetchContent();
    const syncTimer = window.setInterval(fetchContent, 8000);
    return () => {
      window.clearTimeout(bootTimer);
      window.clearInterval(clockTimer);
      window.clearInterval(syncTimer);
    };
  }, [fetchContent]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("portia-desktop-settings-v1");
      if (saved) setDesktopSettings({ ...desktopSettings, ...JSON.parse(saved) });
    } catch {}
    // Read once after hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dataset.accent = desktopSettings.accent;
    document.documentElement.dataset.wallpaper = desktopSettings.wallpaper;
    document.documentElement.dataset.iconSize = desktopSettings.iconSize;
    try { window.localStorage.setItem("portia-desktop-settings-v1", JSON.stringify(desktopSettings)); } catch {}
  }, [desktopSettings]);

  const focusApp = (appId: AppId) => {
    setTopZ((current) => {
      const next = current + 1;
      setWindows((state) => ({ ...state, [appId]: { ...state[appId], z: next } }));
      return next;
    });
    setActiveApp(appId);
  };

  const openApp = (appId: AppId) => {
    setWindows((state) => ({ ...state, [appId]: { ...state[appId], open: true, minimized: false } }));
    focusApp(appId);
    setStartOpen(false);
  };

  const closeApp = (appId: AppId) => {
    setWindows((state) => ({ ...state, [appId]: { ...state[appId], open: false, minimized: false, maximized: false } }));
    if (activeApp === appId) setActiveApp("archive");
  };

  const minimizeApp = (appId: AppId) => {
    setWindows((state) => ({ ...state, [appId]: { ...state[appId], minimized: true } }));
  };

  const toggleMaximize = (appId: AppId) => {
    setWindows((state) => ({ ...state, [appId]: { ...state[appId], maximized: !state[appId].maximized } }));
    focusApp(appId);
  };

  const saveContent = async (next: PortiaContent) => {
    setSaveState("saving");
    try {
      const response = await fetch("/api/content", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: next }),
      });
      if (!response.ok) throw new Error("save failed");
      const payload = (await response.json()) as { revision?: number };
      setContent(next);
      setRevision(payload.revision ?? revision + 1);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("error");
      throw new Error("PORTIA content save failed");
    }
  };

  const activeVirus = content.viruses.find((virus) => virus.id === activeVirusId) ?? content.viruses[0];
  const filteredViruses = content.viruses.filter((virus) => escapeSearch(`${virus.name} ${virus.code} ${virus.status}`).includes(escapeSearch(virusQuery)));
  const selectedInfo = content.infoSections.find((section) => section.id === selectedInfoId) ?? content.infoSections[0];

  const unlockedLogIds = useMemo(() => {
    const map = new Map<string, string>();
    content.viruses.forEach((virus) => {
      if (!virus.scientistLogs.length) return;
      const hash = [...virus.id].reduce((sum, character) => sum + character.charCodeAt(0), sessionSeed);
      map.set(virus.id, virus.scientistLogs[hash % virus.scientistLogs.length].id);
    });
    return map;
  }, [content.viruses, sessionSeed]);

  const searchResults = useMemo(() => {
    const query = escapeSearch(globalQuery.trim());
    const items: Array<{ id: string; type: "virus" | "info" | "broadcast"; title: string; meta: string; body: string }> = [
      ...content.viruses.map((virus) => ({ id: virus.id, type: "virus" as const, title: virus.name, meta: virus.code, body: `${virus.status} ${virus.external} ${virus.physiology} ${Object.values(virus.classification).join(" ")} ${virus.mutations.map((mutation) => `${mutation.name} ${mutation.description}`).join(" ")}` })),
      ...content.infoSections.map((section) => ({ id: section.id, type: "info" as const, title: section.title, meta: "ИНФОРМАЦИЯ", body: section.body })),
      ...content.broadcasts.filter((item) => item.published).map((item) => ({ id: item.id, type: "broadcast" as const, title: item.title, meta: broadcastType(item.type), body: item.body })),
    ];
    if (!query) return items.slice(0, 8);
    return items.filter((item) => escapeSearch(`${item.title} ${item.meta} ${item.body}`).includes(query));
  }, [content, globalQuery]);

  const openSearchResult = (result: (typeof searchResults)[number]) => {
    if (result.type === "virus") {
      setActiveVirusId(result.id);
      setOpenLog(null);
      openApp("archive");
    } else if (result.type === "info") {
      setSelectedInfoId(result.id);
      openApp("info");
    } else {
      openApp("broadcasts");
    }
  };

  return (
    <>
      <BootScreen visible={booting} />
      <div className="desktop" id="desktop">
        <header className="system-bar">
          <div className="system-brand"><img src="/assets/portia-logo.png" alt="" /><span>PORTIA</span><span className="system-division">RESEARCH OS / NODE 04</span></div>
          <div className="system-status" aria-label="Состояние системы"><span className="status-item"><i className="status-dot" />КОНТУР ЗАКРЫТ</span><time>{clock}</time></div>
        </header>

        <main className={`workspace${windows[activeApp].open && !windows[activeApp].minimized ? " mobile-app-open" : ""}`}>
          <nav className="desktop-icons" aria-label="Рабочий стол PORTIA">
            <DesktopIcon app="search" onOpen={openApp} />
            <DesktopIcon app="archive" onOpen={openApp} />
            <DesktopIcon app="broadcasts" onOpen={openApp} />
            <DesktopIcon app="info" onOpen={openApp} />
            <DesktopIcon app="settings" onOpen={openApp} />
          </nav>

          <AppWindow app="archive" state={windows.archive} active={activeApp === "archive"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} className="archive-window" meta="ДОПУСК II">
            <div className="archive-grid">
              <aside className="archive-browser" aria-label="Список вирусов">
                <div className="browser-heading"><div><span className="eyebrow">ОБЩАЯ БАЗА</span><h1>База вирусов</h1></div><span className="record-count">{String(content.viruses.length).padStart(2, "0")}</span></div>
                <label className="search-box"><span aria-hidden="true">⌕</span><span className="sr-only">Поиск по базе</span><input value={virusQuery} onChange={(event) => setVirusQuery(event.target.value)} type="search" placeholder="Поиск по имени или коду" /></label>
                <div className="browser-labels" aria-hidden="true"><span>СУБЪЕКТ</span><span>СТАТУС</span></div>
                <div className="virus-list" role="listbox" aria-label="Записи вирусов">
                  {filteredViruses.map((virus, index) => (
                    <button key={virus.id} type="button" className={`virus-row${virus.id === activeVirus?.id ? " active" : ""}`} onClick={() => { setActiveVirusId(virus.id); setOpenLog(null); }}>
                      <span className="row-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="row-main"><strong>{virus.name}</strong><small>{virus.code}</small></span>
                      <span className="row-status">{virus.status}</span>
                    </button>
                  ))}
                  {!filteredViruses.length && <div className="list-empty">Совпадений в архиве нет</div>}
                </div>
                <div className="browser-footer"><span><i className="status-dot" />СИНХРОНИЗИРОВАНО</span><span>РЕВИЗИЯ {String(revision).padStart(2, "0")}</span></div>
              </aside>
              <article className="record-view" aria-live="polite">
                {activeVirus ? openLog ? <ScientistDocument virus={activeVirus} logId={openLog} unlockedId={unlockedLogIds.get(activeVirus.id)} onBack={() => setOpenLog(null)} /> : <VirusRecord virus={activeVirus} unlockedId={unlockedLogIds.get(activeVirus.id)} onOpenLog={setOpenLog} /> : <div className="record-empty">В базе пока нет записей.</div>}
              </article>
            </div>
          </AppWindow>

          <AppWindow app="search" state={windows.search} active={activeApp === "search"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} className="global-search-window" meta="ИНДЕКС АКТИВЕН">
            <div className="global-search-app">
              <header className="global-search-header"><span className="eyebrow">ЕДИНЫЙ ИНДЕКС PORTIA</span><h1>Глобальный поиск</h1><p>Поиск по вирусам, характеристикам, информации и сообщениям станции.</p></header>
              <label className="global-search-box"><span aria-hidden="true">⌕</span><span className="sr-only">Глобальный поиск</span><input value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} type="search" placeholder="Введите название, код или тему" /><kbd>Ctrl K</kbd></label>
              <div className="search-recommendations" aria-label="Рекомендации поиска"><span>РЕКОМЕНДАЦИИ</span><div>{content.searchRecommendations.slice(0, 6).map((item) => <button key={item} type="button" onClick={() => setGlobalQuery(item)}>{item}</button>)}</div></div>
              <div className="global-search-summary"><span>{globalQuery ? `Результаты для «${globalQuery}»` : "Доступные записи"}</span><strong>{String(searchResults.length).padStart(2, "0")}</strong></div>
              <div className="global-search-results">
                {searchResults.map((result) => (
                  <button key={`${result.type}-${result.id}`} type="button" className="global-result" onClick={() => openSearchResult(result)}>
                    <span className="global-result-mark">{result.type === "virus" ? "DB" : result.type === "info" ? "INF" : "MSG"}</span>
                    <span className="global-result-main"><span className="global-result-heading"><strong>{result.title || "БЕЗ НАЗВАНИЯ"}</strong><small>{result.meta}</small></span><span className="global-result-preview">{result.body}</span></span>
                  </button>
                ))}
                {!searchResults.length && <div className="global-search-empty"><strong>СОВПАДЕНИЙ НЕТ</strong><span>Измените запрос или выберите рекомендацию.</span></div>}
              </div>
            </div>
          </AppWindow>

          <AppWindow app="info" state={windows.info} active={activeApp === "info"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} className="utility-window info-window" meta="АРХИВ ЗНАНИЙ">
            <div className="info-library">
              <aside className="info-index"><span className="eyebrow">РАЗДЕЛЫ</span>{content.infoSections.map((section, index) => <button key={section.id} type="button" className={section.id === selectedInfo?.id ? "active" : ""} onClick={() => setSelectedInfoId(section.id)}><small>{String(index + 1).padStart(2, "0")}</small><span>{section.title}</span></button>)}</aside>
              <article className="info-document">{selectedInfo ? <><span className="eyebrow">ИНФОРМАЦИОННЫЙ КАНАЛ PORTIA</span><h1>{selectedInfo.title}</h1><div className="info-document-copy">{selectedInfo.body.split(/\n\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></> : <div className="editor-empty">Разделов пока нет.</div>}</article>
            </div>
          </AppWindow>

          <AppWindow app="broadcasts" state={windows.broadcasts} active={activeApp === "broadcasts"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} className="utility-window broadcasts-window" meta="КАНАЛ СТАНЦИИ">
            <div className="broadcasts-app">
              <header><span className="eyebrow">ОПЕРАТИВНЫЙ КАНАЛ PORTIA</span><h1>Сводка станции</h1><p>Еженедельные квесты, задачи и новости.</p></header>
              <div className="broadcast-grid">
                {content.broadcasts.filter((item) => item.published).map((item) => <article className={`broadcast-card ${item.type}`} key={item.id}><span>{broadcastType(item.type)}</span><h2>{item.title || "БЕЗ НАЗВАНИЯ"}</h2><div>{item.body.split(/\n\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></article>)}
                {!content.broadcasts.some((item) => item.published) && <div className="broadcast-empty"><strong>СООБЩЕНИЙ ПОКА НЕТ</strong><span>Новые квесты, задачи и новости появятся здесь.</span></div>}
              </div>
            </div>
          </AppWindow>

          <AppWindow app="settings" state={windows.settings} active={activeApp === "settings"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} className="utility-window settings-window" meta="ПРОФИЛЬ ЛОКАЛЬНЫЙ">
            <div className="settings-app">
              <header><span className="eyebrow">ПЕРСОНАЛИЗАЦИЯ PORTIA OS</span><h1>Настройки рабочего стола</h1><p>Оформление сохраняется на этом устройстве.</p></header>
              <SettingGroup title="Цвет интерфейса" values={[['teal','PORTIA'],['ice','Холодный'],['amber','Янтарный'],['red','Тревога']]} current={desktopSettings.accent} onSelect={(value) => setDesktopSettings((state) => ({ ...state, accent: value }))} />
              <SettingGroup title="Фон рабочего стола" values={[['radar','Радар'],['grid','Сетка'],['quiet','Чистый']]} current={desktopSettings.wallpaper} onSelect={(value) => setDesktopSettings((state) => ({ ...state, wallpaper: value }))} />
              <SettingGroup title="Размер ярлыков" values={[['compact','Компактный'],['standard','Стандартный'],['large','Крупный']]} current={desktopSettings.iconSize} onSelect={(value) => setDesktopSettings((state) => ({ ...state, iconSize: value }))} />
              <section className="settings-section content-control-entry"><div><h2>Содержимое сайта</h2><p>{canEdit ? "Редактируйте вирусы, информацию, сообщения и рекомендации поиска." : "Редактор закреплён за владельцем сайта."}</p></div><button type="button" disabled={!canEdit} onClick={() => openApp("editor")}>ОТКРЫТЬ РЕДАКТОР</button></section>
              <div className="settings-footer"><button className="factory-reset" type="button" onClick={() => setDesktopSettings({ accent: "teal", wallpaper: "radar", iconSize: "standard" })}>СБРОСИТЬ ДО ЗАВОДСКИХ</button><span>Настройки сохранены</span></div>
            </div>
          </AppWindow>

          <AppWindow app="editor" state={windows.editor} active={activeApp === "editor"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} className="editor-window" meta="ДОСТУП ВЛАДЕЛЬЦА">
            {canEdit ? <PortiaEditor content={content} saveState={saveState} onSave={saveContent} /> : <div className="editor-empty">Редактирование доступно только владельцу.</div>}
          </AppWindow>
        </main>

        <footer className="taskbar">
          <button className="start-button" type="button" onClick={() => setStartOpen((value) => !value)} aria-expanded={startOpen}><img src="/assets/portia-logo.png" alt="" /><span>PORTIA</span></button>
          <div className="taskbar-apps" aria-label="Открытые программы">
            {(Object.keys(appMeta) as AppId[]).filter((app) => windows[app].open).map((app) => <button key={app} className={`taskbar-app${activeApp === app && !windows[app].minimized ? " active" : ""}`} type="button" onClick={() => windows[app].minimized ? openApp(app) : activeApp === app ? minimizeApp(app) : focusApp(app)}><span className="mini-app-icon"><img src={appMeta[app].icon} alt="" /></span><span>{appMeta[app].label}</span></button>)}
          </div>
          <span className="taskbar-note">ВЫМЫШЛЕННЫЙ ИССЛЕДОВАТЕЛЬСКИЙ МАТЕРИАЛ</span>
        </footer>

        {startOpen && <div className="start-panel">
          <div className="start-panel-brand"><img src="/assets/portia-logo.png" alt="PORTIA" /><div><strong>PORTIA OS</strong><span>Научная станция</span></div></div>
          <button type="button" onClick={() => openApp("search")}><span className="start-panel-icon"><img src="/assets/app-search.png" alt="" /></span>Глобальный поиск</button>
          <button type="button" onClick={() => openApp("archive")}><span className="start-panel-icon"><img src="/assets/app-virus.png" alt="" /></span>База вирусов</button>
          <button type="button" onClick={() => openApp("settings")}><span className="start-panel-icon"><img src="/assets/app-settings.png" alt="" /></span>Настройки</button>
        </div>}
      </div>
    </>
  );
}

function BootScreen({ visible }: { visible: boolean }) {
  return <div className={`boot-screen${visible ? "" : " boot-complete"}`} aria-hidden={!visible}><div className="boot-core"><img src="/assets/portia-logo.png" alt="" /><span>PORTIA OS</span><strong>INITIALIZING RESEARCH NODE</strong><div className="boot-progress"><i /></div><div className="boot-lines"><small>ARCHIVE INDEX</small><small>SECURITY CONTOUR</small><small>CONTENT LINK</small></div></div></div>;
}

function DesktopIcon({ app, onOpen }: { app: AppId; onOpen: (app: AppId) => void }) {
  return <button className="desktop-icon" type="button" onClick={() => onOpen(app)}><span className="desktop-icon-symbol"><img src={appMeta[app].icon} alt="" /></span><span>{appMeta[app].label}</span></button>;
}

function AppWindow({ app, state, active, onFocus, onMinimize, onMaximize, onClose, className, meta, children }: {
  app: AppId; state: WindowState; active: boolean; onFocus: (app: AppId) => void; onMinimize: (app: AppId) => void; onMaximize: (app: AppId) => void; onClose: (app: AppId) => void; className: string; meta: string; children: React.ReactNode;
}) {
  if (!state.open) return null;
  return <section className={`app-window ${className}${active ? " is-active" : ""}${state.maximized ? " is-maximized" : ""}`} style={{ zIndex: state.z, display: state.minimized ? "none" : undefined }} onPointerDown={() => onFocus(app)} aria-label={appMeta[app].label}>
    <div className="window-titlebar"><div className="window-identity"><span className="window-app-mark"><img src={appMeta[app].icon} alt="" /></span><span>{appMeta[app].path}</span></div><div className="window-meta">{meta}</div><div className="window-controls"><button type="button" data-window-action="minimize" onClick={(event) => { event.stopPropagation(); onMinimize(app); }} aria-label={`Свернуть ${appMeta[app].label}`}>―</button><button type="button" data-window-action="maximize" onClick={(event) => { event.stopPropagation(); onMaximize(app); }} aria-label={`Развернуть ${appMeta[app].label}`}>□</button><button type="button" data-window-action="close" onClick={(event) => { event.stopPropagation(); onClose(app); }} aria-label={`Закрыть ${appMeta[app].label}`}>×</button></div></div>
    {children}
  </section>;
}

function VirusRecord({ virus, unlockedId, onOpenLog }: { virus: Virus; unlockedId?: string; onOpenLog: (id: string) => void }) {
  const classification = [
    ["Общий уровень опасности", virus.classification.danger, "danger"], ["Распространение", virus.classification.spread, "spread"], ["Способ распространения", virus.classification.transmission, "transmission"],
    ["Угроза и риск побега", virus.classification.escapeRisk, "escape"], ["Разум", virus.classification.mind, "mind"], ["Вид / внешность", virus.classification.appearance, "appearance"], ["Поведение", virus.classification.behavior, "behavior"],
  ];
  return <div className="record-transition-in" key={virus.id}>
    <header className="record-header"><div><span className="eyebrow">КАРТОЧКА ИНФИЦИРОВАННОГО / {virus.code}</span><h2>{virus.name}</h2></div><div className="record-status"><span />{virus.status}</div></header>
    <div className="record-document">
      <section className="record-hero"><MediaBlock src={virus.infectedImage} alt={`Субъект после заражения вирусом ${virus.name}`} label="Фото после заражения" /><div className="classification-panel"><div className="section-kicker"><span>01</span>КЛАССИФИКАЦИЯ</div><div className="classification-grid">{classification.map(([label, value, tone]) => <div className={`class-cell ${tone}`} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></div></section>
      <DossierSection index="02" title="ВНЕШНИЕ ХАРАКТЕРИСТИКИ"><p className="lead-copy">{virus.external}</p></DossierSection>
      <DossierSection index="03" title="ХАРАКТЕРИСТИКИ С PPU"><div className="metric-grid"><div><span>ЗДОРОВЬЕ</span><p>{virus.ppu.health}</p></div><div><span>СКОРОСТЬ</span><p>{virus.ppu.speed}</p></div><div><span>СПОСОБНОСТИ</span><p>{virus.ppu.abilities}</p></div></div></DossierSection>
      <DossierSection index="04" title="ФИЗИОЛОГИЯ"><p className="lead-copy">{virus.physiology}</p></DossierSection>
      <DossierSection index="05" title="МУТАЦИИ ВИРУСА"><div className="mutation-grid">{virus.mutations.map((mutation, index) => <section className="mutation-card" key={`${mutation.name}-${index}`}><div className="mutation-index">M-{String(index + 1).padStart(2, "0")}</div><MediaBlock src={mutation.image} alt={mutation.name} label="Скриншот мутации" /><div className="mutation-copy"><h4>{mutation.name}</h4><p>{mutation.description}</p></div></section>)}</div></DossierSection>
      <DossierSection index="06" title="ЗАПИСИ УЧЁНЫХ"><div className="access-summary"><span>ТЕКУЩИЙ УРОВЕНЬ ДОСТУПА</span><strong>II</strong></div><div className="scientist-log-list">{virus.scientistLogs.map((log, index) => { const isOpen = log.id === unlockedId; return <button className={`scientist-log-row ${isOpen ? "available" : "locked"}`} type="button" key={log.id} onClick={() => onOpenLog(log.id)}><span className="log-number">LOG-{String(index + 1).padStart(2, "0")}</span><span className="log-name"><strong>{log.title}</strong><small>{log.scientist}</small></span><span className="log-clearance">УРОВЕНЬ {isOpen ? "II" : roman(log.lockedLevel)}</span><span className="log-action">{isOpen ? "ОТКРЫТЬ" : "ЗАБЛОКИРОВАНО"}</span></button>; })}</div></DossierSection>
      <footer className="record-footer"><span>PORTIA / SCIENCE EXPEDITION</span><span>ЗАПИСЬ {virus.code}</span></footer>
    </div>
  </div>;
}

function ScientistDocument({ virus, logId, unlockedId, onBack }: { virus: Virus; logId: string; unlockedId?: string; onBack: () => void }) {
  const log = virus.scientistLogs.find((item) => item.id === logId);
  if (!log) return null;
  const isOpen = log.id === unlockedId;
  const level = isOpen ? 2 : log.lockedLevel;
  return <article className="archive-document-view"><header className="archive-document-bar"><button type="button" onClick={onBack}>ВЕРНУТЬСЯ К ДОСЬЕ</button><span>PORTIA / АРХИВ 2059 / УРОВЕНЬ {roman(level)}</span></header><div className="archive-document-paper"><div className="archive-document-stamp">{isOpen ? "ДОПУСК РАЗРЕШЁН" : "ДОПУСК ОТКЛОНЁН"}</div><div className="archive-document-code">PORTIA://VIRUS_ARCHIVE/{virus.code}/LOGS/{log.id}</div><h1>{log.title}</h1><dl className="archive-document-meta"><div><dt>ОБЪЕКТ</dt><dd>{virus.name} / {virus.code}</dd></div><div><dt>УЧЁНЫЙ</dt><dd>{log.scientist}</dd></div><div><dt>УРОВЕНЬ</dt><dd>{roman(level)}</dd></div></dl>{isOpen ? <section className="archive-document-section"><h2>ТЕКСТ ЗАПИСИ</h2>{log.content.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section> : <section className="archive-document-section restricted-document"><div className="restriction-mark">ДОСТУП ОГРАНИЧЕН</div><h2>НЕДОСТАТОЧНЫЙ УРОВЕНЬ ДОСТУПА</h2><p>Текущий уровень: II. Для чтения этого документа требуется уровень {roman(level)}.</p><div className="redaction-lines"><i /><i /><i /><i /></div></section>}<footer><span>ВНУТРЕННИЙ АРХИВ PORTIA</span><span>2059</span></footer></div></article>;
}

function DossierSection({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return <section className="dossier-section"><div className="section-kicker"><span>{index}</span>{title}</div>{children}</section>;
}

function MediaBlock({ src, alt, label }: { src: string; alt: string; label: string }) {
  if (src) return <figure className="subject-media"><img src={src} alt={alt} loading="lazy" /><figcaption>{label}</figcaption></figure>;
  return <figure className="subject-media media-empty"><img src="/assets/portia-logo.png" alt="" aria-hidden="true" /><div><span>ВИЗУАЛЬНЫЙ МАТЕРИАЛ</span><strong>ОЖИДАЕТ ЗАГРУЗКИ</strong><small>{label}</small></div></figure>;
}

function SettingGroup({ title, values, current, onSelect }: { title: string; values: [string, string][]; current: string; onSelect: (value: string) => void }) {
  return <section className="settings-section"><h2>{title}</h2><div className="setting-options">{values.map(([value, label]) => <button key={value} type="button" className={current === value ? "selected" : ""} onClick={() => onSelect(value)}>{title === "Цвет интерфейса" && <i className={`swatch ${value}`} />}<span>{label}</span></button>)}</div></section>;
}

function broadcastType(type: "quest" | "task" | "news") {
  return type === "quest" ? "ЕЖЕНЕДЕЛЬНЫЙ КВЕСТ" : type === "task" ? "ЗАДАЧА" : "НОВОСТЬ";
}
