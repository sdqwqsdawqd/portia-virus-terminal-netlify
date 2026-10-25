---
phase: PORTIA-09-tselostnost-kontenta
verified: 2026-10-25T20:00:00Z
status: passed
score: 6/6 roadmap success criteria verified
covered_files:
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-01-PLAN.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-01-SUMMARY.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-02-PLAN.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-02-SUMMARY.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-03-PLAN.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-03-SUMMARY.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-04-PLAN.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-04-SUMMARY.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-05-PLAN.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-05-SUMMARY.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-06-PLAN.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-06-SUMMARY.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-07-PLAN.md"
  - ".planning/phases/PORTIA-09-tselostnost-kontenta/09-07-SUMMARY.md"
  - "app/api/content/route.ts"
  - "app/portia.css"
  - "components/portia-desktop.tsx"
  - "components/portia-editor.tsx"
  - "components/portia-wallpaper-spider.tsx"
  - "components/portia-wallpaper.tsx"
  - "lib/broadcasts.ts"
  - "lib/content-limits.ts"
  - "lib/content-sync.ts"
  - "lib/editor-items.ts"
  - "lib/portia-content-normalize.ts"
  - "lib/wallpaper-web.ts"
covered_digest: "v3:sha256:d3f163300a0e297ef8c4d9c9c319a92f65680afcc4918272b963329a28dd8060"
behavior_unverified: 0
overrides_applied: 0
---

# Фаза 9: Целостность контента — отчёт о проверке

**Цель фазы:** Контент не теряется молча (опрос не сбрасывает отмену, лимиты не обрезают текст, удаление и смена типа не оставляют мусора, странные данные исправляются), фон рабочего стола анимируется плавно.
**Проверено:** 2026-10-25
**Статус:** passed
**Повторная проверка:** нет, первичная.

## Достижение цели

### Наблюдаемые истины (критерии успеха ROADMAP)

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | Опрос с той же ревизией не трогает редактор, отмена и повтор живы; новая ревизия доходит | VERIFIED | `lib/content-sync.ts` `acceptFetchedContent` принимает только `revision > known` и без сохранения «в полёте»; `components/portia-desktop.tsx:371` проверяет ревизию ДО `normalize`/`setContent`, поэтому объект контента не заменяется, и эффект синхронизации редактора (`portia-editor.tsx:574`, зависит от `content`) не срабатывает. Тесты в `lib/content-sync.test.ts` (равная, старая, после сохранения, сброс на -1 после конфликта). Опрос 10 с (`contentSyncMs`, строка 39). |
| 2 | Лимиты не режут текст, общие для редактора и сервера; «+» неактивна с подписью; повторное сохранение не меняет данные | VERIFIED | Единый `lib/content-limits.ts` (MAX_* подняты, `limitStatus/limitText` «МАКСИМУМ N»). Нормализатор сохраняет тексты целиком (`slice` остался только для ссылок 2048 и журналов учёных MAX_SCIENTIST_LOGS — сознательно, D-25). `app/api/content/route.ts` проверяет тело в байтах (5 МБ → 413), не урезает. Кнопки «+ ТЕКСТ/ТАБЛИЦА/ВИДЕО/ФОТО/СТРОКА/ПОДРАЗДЕЛ» `disabled` по лимиту + `LimitNote` (`portia-editor.tsx:1074-1096, 2360`). Тесты: «beyond the old caps are kept whole», идемпотентность. Скрипт `09-check-normalize-backup.mjs` на выгрузке владельца: счётчики и длины равны, `idempotent true` (по 09-03-SUMMARY). |
| 3 | Неверные типы полей, `title: {}`, кэш без `recycledViruses` не роняют сайт | VERIFIED | `normalizeBroadcasts`/`normalizeVirus` приводят поля (`at({title:{}}).title === ""`, `42 → "42"`); `portia-desktop.tsx:446-448` пропускает кэш через `normalizePortiaContent`, сеть — тоже (строка 372); `recycledViruses` по умолчанию `[]` (`portia-content-normalize.ts:254`), `editor-changes.ts:77` использует `?? []`. |
| 4 | Удаление из Корзины убирает форматирование, восстановление сохраняет; «ВАЖНО» только у новостей | VERIFIED | `lib/editor-items.ts:21-29` `removeRecycledVirus` (удаляет `virus:<id>:*`) и `removeRecycleFile`; оба вызываются только после диалога «УДАЛИТЬ НАВСЕГДА» (`portia-editor.tsx:1368, 1379`). Тесты `editor-items.test.ts:161-177` (включая «restoring keeps formatting»). «ВАЖНО»: смена типа сбрасывает флаг (`portia-editor.tsx:1130`), нормализатор `important: type==="news" && ...` (`:133`), рабочий стол `item.type==="news" && item.important` (`:1276`). |
| 5 | Отмена/повтор смены типа переключает «Сводку»; квест с концом раньше начала отмечен; статус квеста с первой отрисовки | VERIFIED | `categoryChange` (`lib/broadcasts.ts:30`, тест) вызывается в undo/redo (`portia-editor.tsx:628`) и вызывает `revealCard`; `questDateError` (`broadcasts.ts:25`, тест) подсвечивает поле «Окончание раньше начала» и блокирует сохранение (`portia-editor.tsx:533-537, 1143`); `today` инициализируется сразу `useState(() => localDateKey(new Date()))` (`portia-desktop.tsx:278`). |
| 6 | Фон плавный: спираль и паук без рывков, гель движется, клетки перемещаются и взаимодействуют; проверено владельцем на ПК и телефоне | VERIFIED | CSS: `helix-scroll 60s` на `translate3d(0, calc(100% / -3), 0)` + рисунок `HELIX_LOOP * 3` (2 вхождения); `gel-creep`/`gel-glow 8s`; `cell-drift 14s`/`cell-shape 8s`/`nucleus-wander`/`particle-drift`; всё под `html[data-motion="full"]`, под `reduce` анимации выключены (`portia.css:1293`). Паук: `lib/wallpaper-web.ts` + `components/portia-wallpaper-spider.tsx`, один rAF-цикл, `MutationObserver` на `data-motion`, остановка при скрытой вкладке и размонтировании; 13 тестов геометрии/хода/волн проходят. Владелец ответил «verified» на ПК и телефоне после двух раундов правок (d0884a7, 5a3d55f, 2b223a5), редактор (шаги 8-13) подтверждён в первом раунде (09-07-SUMMARY). CR-01 (волны не затухают) исправлен в 2994ab5 с тестом. |

**Счёт:** 6/6 критериев ROADMAP подтверждены; PRESENT_BEHAVIOR_UNVERIFIED: 0.

Допущение «60 fps на ПК и телефоне» (`verification: backstop`) закрыто явным свидетельством: ответ владельца «verified» после проверки на обоих устройствах. Автоматически (трассировкой Edge) плавность в этом проходе не перепроверялась.

### Отклонения от текста планов (приняты владельцем)

Формулировки 09-01 про гель (по-полосная ползучесть `--gel-from/--gel-to`, группы клеток-движения) и 09-02 про паука (размер 97.425 → 72, шаг ног) после проверки владельца изменились: гель теперь движется отдельным композитным слоем (`.wallpaper-gel-strip-track`, `gel-creep` на `translate3d(0, 50%, 0)`), края полос смягчены, паук меньше и с «пружинной» походкой. Это правки по просьбе владельца (09-07-SUMMARY, Deviations 1-3), цель критерия 6 они выполняют, поэтому как провал не засчитаны. Буквальные acceptance-grep из 09-01 по этим деталям (например `--gel-from`) устарели.

### Покрытие требований

| Требование | План | Статус | Доказательство |
|-----------|------|--------|----------------|
| BG-01 | 09-01, 09-02, 09-07 | SATISFIED | критерий 6 |
| SYNC-01 | 09-03, 09-04, 09-07 | SATISFIED | критерий 1 |
| CONT-01 | 09-03, 09-05, 09-07 | SATISFIED | критерий 2 |
| CONT-02 | 09-03, 09-04, 09-07 | SATISFIED | критерий 3 |
| CONT-03 | 09-05, 09-07 | SATISFIED | критерий 4 |
| CONT-04 | 09-03, 09-04, 09-06, 09-07 | SATISFIED | критерий 4 |
| CONT-05 | 09-06, 09-07 | SATISFIED | критерий 5 |
| CONT-06 | 09-06, 09-07 | SATISFIED | критерий 5 |
| CONT-07 | 09-04, 09-07 | SATISFIED | критерий 5 |
| CONT-08 | 09-03, 09-04, 09-07 | SATISFIED | критерий 3 |

Все 10 ID из запроса есть в `requirements:` планов и в REQUIREMENTS.md (отмечены `[x]`, трассировка «Phase 9 / Complete»). Осиротевших требований нет (CONT-09 привязано к фазе 12).

### Поведенческие проверки

| Проверка | Команда | Результат | Статус |
|----------|---------|-----------|--------|
| Весь набор | `npm test` | 285 pass, 0 fail | PASS |
| Типы | `npx tsc --noEmit` | пусто | PASS |
| Линт | `npx eslint app lib components` | 0 errors, 14 warnings (старые `<img>`) | PASS |
| Паук и волны | `node --experimental-strip-types --test lib/wallpaper-web.test.ts` | 13 pass | PASS |

Сборка (`npm run build`) и трассировки Edge в этом проходе не запускались; по данным оркестратора и SUMMARY, зелёные.

### Анти-паттерны

TBD/FIXME/XXX в изменённых файлах фазы не найдено. Блокирующих заглушек нет.

### Замечания (не блокируют)

| ID | Серьёзность | Суть | Состояние |
|----|-------------|------|-----------|
| WR-01 | warning | Нормализатор не чинит повторяющиеся реальные id, пустые id журналов учёных и файлов Корзины (общий `formattedText`-ключ) | open в 09-REVIEW-DISPOSITION.md; касается ручных/импортированных данных за пределами CONT-02 (неверные типы полей) |
| WR-02 | warning | Производные id не «только по позиции»: меняются при изменении соседей, форматирование под старым id осиротеет | open |
| IN-01..03 | info | мёртвые `!today`, тело читается до проверки размера, цвет ошибки захардкожен | open |

Рекомендация: закрыть WR-01/WR-02 в ближайшей фазе, трогающей нормализатор.

### Нужна ли проверка человеком

Нет. Владелец уже принял фон и редактор на ПК и телефоне. Оговорка из 09-07-SUMMARY: состояния лимитов на ~400 строках владелец не пробовал, они опираются на юнит-тесты и grep.

### Резюме

Цель фазы достигнута: все 6 критериев и 10 требований подтверждены кодом, тестами и приёмкой владельцем. Открытые WR-01/WR-02 — риск для нестандартных данных, а не провал критериев.

---

_Проверено: 2026-10-25_
_Проверяющий: Claude (gsd-verifier)_
