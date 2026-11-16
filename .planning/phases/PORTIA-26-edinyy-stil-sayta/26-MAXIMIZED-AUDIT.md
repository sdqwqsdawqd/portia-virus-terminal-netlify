# Phase 26 — аудит окон в развёрнутом виде (D-04, UI-06)

План 26-05. Каждое окно рабочего стола проверено в развёрнутом виде по рецептам UI-SPEC «Maximized window» (R1–R5) и решениям D-01 … D-04, D-19.
Доказательство — исходные тесты в `lib/ui-unify.test.ts` (селекторы и значения в каскаде `app/portia.css` + `app/portia-promotion-editor.css`)
и закреплённые тесты D-43 / D-15 в `lib/portia-desktop.test.ts`. Пиксельный вид в браузере не снимался: строка про пиксели — `BLOCKED (ENV)`.

Общие правила (для всех строк):

- Хук один — `.app-window.is-maximized` (отступ 8px и радиус окна `var(--radius-window)` не менялись, D-03). Все новые правила под ним стоят в `@media (min-width: 901px)` (R3 — в `@media (min-width: 1281px)`), обычное окно и телефон не затронуты; `container-type` на окне и `.workspace` не ставится. Тест: `UI-06 / D-03: the maximized hook is unchanged, the only one, and never a container`.
- Кнопки не растягиваются (D-02): ни одно правило под хуком не задаёт `width: 100%` или `flex: 1`; потолки только 640px (`var(--field-max)`), 820px и 1320px. Тесты: `UI-06 / D-02: no maximized rule stretches a control and the caps are 640/820/1320px` и охрана 26-03 `UI-03 / D-02: no button of the family is stretched, in either stylesheet`.
- R5 (панели на всё окно с внутренней прокруткой): корневая панель каждого окна уже `height: calc(100% - 46px)` и `min-height: 0` — проверяется в каждой строке (`assertFillsWindow`).
- Перечень окон сверяется с `appMeta` (12 окон): тест `UI-06 / D-04: the audit list names every window of the desktop once`.

| Окно | Правило | Исход | Проверка |
|------|---------|-------|----------|
| Глобальный поиск (`search`) | «Доступные записи» и результаты — сетка R1 (до 4 колонок по 360px, зазор 8px); шапка и строка поиска до 640px (R2); «Совпадений нет» на всю ширину сетки по центру; стрелки только Вверх/Вниз по DOM | fixed | `UI-06 / D-01: «Доступные записи» are a card grid…`, `UI-06 / D-02 (R2): the search box and the header…`, `UI-06: keyboard order over the result grid stays the DOM order…`, `UI-06 / D-04: maximized search follows the UI-SPEC recipe (fixed)` |
| База вирусов (`archive`) | колонка списка `clamp(270px, 24%, 340px)`; запись — общий лист 1060px (D-55, тот же у конструктора шаблонов), документ учёного — лист 820px: это меры, окно их не меняет, правил внутрь листа нет | fixed | `UI-06 / D-04: maximized archive follows the UI-SPEC recipe (fixed)` |
| Сотрудники (`employees`) | колонка списка `clamp(270px, 24%, 340px)`; профиль — R3 с 1281px: шапка и биография на две колонки, «Звание/Ранг» и оценки рядом, до 1320px | fixed | `UI-06 / D-04: maximized employees follows the UI-SPEC recipe (fixed)`, `UI-06 / D-19: two columns only for flat forms…` |
| Информация (`info`) | индекс без изменений (`minmax(210px, 28%)`); документ — колонка чтения 820px (R4) | fixed | `UI-06 / D-04: maximized info follows the UI-SPEC recipe (fixed)` |
| Справочник (`guide`) | плитки — R1 с минимумом 220px, зазор 8px (до 4 колонок); открытая статья уже 820px (R4) | fixed | `UI-06 / D-04: maximized guide follows the UI-SPEC recipe (fixed)`, `window tiles keep their own size… (D-43)` |
| Повышение (`promotion`) | окно соискателя — колонка теста 680px (мера, без изменений); рабочее место проверяющего (вкладка «Повышение» редактора): список запросов 280px (был), список банков 230px → 280px, карточки вопросов банка и сведения заявки — R1. R3 к формам проверяющего не применяется (D-19: только плоские формы) | fixed | `UI-06 / D-04: maximized promotion follows the UI-SPEC recipe (fixed)` |
| Настройки (`settings`) | группы в две колонки по 648px с зазором 24px (= форма 1320px, R3 с 1281px); заголовок, «Содержимое сайта» и подвал — на обе колонки; варианты внутри группы — сегменты своей ячейки, кнопка сброса по содержимому | fixed | `UI-06 / D-04: maximized settings follows the UI-SPEC recipe (fixed)` |
| Сводка (`broadcasts`) | карточки объявлений — R1 (до 4 колонок по 360px, зазор 8px); пустое состояние на всю ширину; в обычном окне по-прежнему плитки 340px (D-43) | fixed | `UI-06 / D-04: maximized broadcasts follows the UI-SPEC recipe (fixed)`, `window tiles keep their own size… (D-43)` |
| Корзина (`trash`) | список-таблица с заголовком столбцов в карточки не превращается: столбцы `fr` уже заполняют ширину; просмотр файла перекрывает список, документы 760/800px (R4) | already conformant | `UI-06 / D-04: maximized trash follows the UI-SPEC recipe (already conformant)` |
| Таблица (`sheet`) | панель документа на всё окно, область просмотра `inset: 0`, iframe по масштабу задаётся из кода (100% при 100%) — R5 уже выполнен | already conformant | `UI-06 / D-04: maximized sheet follows the UI-SPEC recipe (already conformant)` |
| Устав (`charter`) | открытый — как «Таблица»; закрытый блок `.access-redacted-block` растянут на окно под полосой, содержимое по центру (только раскладка, данные не показываются, T-26-09) | fixed | `UI-06 / D-04: maximized charter follows the UI-SPEC recipe (fixed)`, `the access-levels block exists once…` (`lib/level-ui.test.ts`) |
| Редактор (`editor`) | карточки форм (`.editor-card-columns`, `.editor-section-columns`) — только больше колонок по 340px, без `1fr` (D-19); форма вируса — R3 с 1281px (группы попарно, вкладки досье и одиночные «Мутации»/«Записи учёных» на обе колонки), форма сотрудника — до 1320px (поля уже в две колонки); раскладка вкладок — план 26-06 | fixed | `UI-06 / D-04: maximized editor follows the UI-SPEC recipe (fixed)`, `UI-06 / D-19: two columns only for flat forms…`, `editor form cards keep one fixed width… (D-15)` |
| Все окна — пиксели | Отсутствие горизонтальной прокрутки и пустых полос на 1366×768, 1920×1080, 2560×1440 — BLOCKED (ENV): линия Playwright без препфлайта не запускалась | BLOCKED (ENV) | нет (нужна линия Playwright с препфлайтом); физический ПК — Phase 27 |

Допущения, сообщаемые владельцу:

- A6 UI-SPEC: колонка чтения 820px («Информация», статья «Справочника», документы корзины) и листы записи вируса (1060px / 820px) — это мера строки; по краям широкого окна остаётся фон. Владелец может назвать это «пустым местом».
- Корзина остаётся таблицей со столбцами (не карточками).
- «Повышение»: окно соискателя — колонка теста 680px; сетки и список 280px относятся к рабочему месту проверяющего во вкладке редактора.
