---
phase: PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo
plan: 09
subsystem: desktop
tags: [placeholder, selection, focus, guide, info, archive, access-levels]
requires:
  - phase: PORTIA-24-01
    provides: ContentRedaction, mergePlaceholders, RedactedPlaceholder (row), levelCopy
  - phase: PORTIA-24-02
    provides: формы index/tile/bar/block, reconcileSelection и цепочки slot
  - phase: PORTIA-24-04
    provides: принятие ответа fetchContent по номеру запроса и зрителю
  - phase: PORTIA-24-05
    provides: серверная вырезка закрытого и места заглушек
provides:
  - «База вирусов»: пустое состояние «Доступных записей нет», блок вместо закрывшегося досье
  - «Информация»: index-заглушки разделов и подразделов (NN, NN.k), маркер считает заглушки, блок вместо закрывшейся статьи, «Доступных разделов нет»
  - «Справочник»: bar на месте закрытого раздела, tile на месте закрытой карточки, блок под полосой «Назад» при потере карточки
  - одна проводка reconcileSelection для трёх окон в ответе сервера и в чтении кэша устройства (D-20, D-22)
  - перенос фокуса при закрытии строки или части записи (UI-SPEC §4)
affects: [PORTIA-24-10, PORTIA-24-11]
requirements-completed: []
actuals:
  tokens: 21000
  tasks: 2
  commits: 2
plan_head_before: 7e28d4a127de0116e2267c8cd6836cfa7ed5ef78
plan_head_after: 017f506bcb0dccd9a79400397944c8cb37c0bfc1
tech-stack:
  added: []
  patterns: [потерянный выбор действует, только пока id окна пуст — клик по любой строке снимает его без второго сеттера, ref с копией и выбором читается в асинхронных обработчиках, слияние заглушек по месту]
key-files:
  created: []
  modified:
    - components/portia-desktop.tsx
    - components/portia-desktop-documents.tsx
    - lib/level-ui.test.ts
key-decisions:
  - "Потерянный выбор хранится как { slot, level } в отдельном состоянии (virusLost, infoLost, guideLost) и действует только при пустом id окна: любой клик или результат поиска задаёт непустой id и тем самым сбрасывает потерю. Состояния activeVirusId, selectedInfoId, guideCardId остались прежними (закреплены lib/window-open.test.ts)."
  - "Три вызова reconcileSelection собраны в функции reconcileVirusSelection, reconcileInfoSelection, reconcileGuideSelection; fetchContent и чтение кэша вызывают общий applySelections(previous, next) до setContent, прошлая копия берётся из contentRef."
  - "appViewState считает записи вместе с заглушками: копия только из заглушек не «пуста», окно говорит «нет доступных», а «нет записей» остаётся только для базы без записей совсем."
  - "Закрытый подраздел при потере открывает на рабочем столе родительский раздел (infoLostParentId), чтобы заглушка была видна на своём месте."
patterns-established:
  - "Фокус: captureRedactionFocus до setContent, восстановление в двойном requestAnimationFrame; элемент, оставшийся в документе, не трогается."
status: complete
completed: 2026-11-15
---

# Phase 24 Plan 09: заглушки в окнах записей и переключение выбранного Summary

Три окна записей («База вирусов», «Информация», «Справочник») рисуют закрытое заглушками на своих местах, а открытая у посетителя запись при следующем обновлении данных сама сменяется блоком «ЗАСЕКРЕЧЕНО · нужен допуск N» или, если снова открылась, молча возвращается.

## Что сделано

**Задача 1, коммит `3b9e0c0`: «База вирусов» и «Информация».**
- `components/portia-desktop.tsx`: состояния `virusLost`, `infoLost`, `guideLost`; `contentRef` и `selectionRef` (ref, синхронизируется эффектом и пишется в обработчиках); `applySelections` заменяет три функции «оставить или первый» в `fetchContent` и в чтении кэша. Результат без id и без lostSlot — прежний автовыбор первой открытой записи.
- Досье: при потере вместо записи `variant="block"`, `activeVirus` без подстановки первого; при записях только из заглушек — `levelCopy.archiveNoOpen`.
- «Информация»: оглавление строится из `mergePlaceholders(infoSections, redaction.infoSections)`; закрытый раздел — `index` без маркера и `aria-expanded`; подразделы — `mergePlaceholders` по `infoSubsections[section.id]`, номер `NN.k`; маркер «▸ N» считает заглушки; кнопки с `hitAttrs("info", section.id)` и `hitAttrs("info", sub.id)` не менялись. Статья при потере — блок (стрелка «Назад к разделам» на телефоне остаётся); без открытых разделов — `levelCopy.sectionsNoOpen`.
- Фокус: `captureRedactionFocus()` перед `setContent`; если сфокусированный элемент выпал из документа — следующая открытая строка списка, иначе поле поиска списка (у «Базы вирусов»), иначе заголовок окна (`.window-identity`), а если фокус был в области записи — `.access-redacted-block`. Фокус вне затронутых окон и всё, что осталось на экране, не трогается.

**Задача 2, коммит `017f506`: «Справочник».**
- `GuideApp`: пропсы `placeholders` и `lostLevel`; `bar` в обёртке `section.guide-section` без кнопки, фото, шеврона и сетки; `tile` в сетке на месте карточки; при потере открытой карточки — полоса «Назад» и под ней блок; без открытых разделов при заглушках — `levelCopy.sectionsNoOpen` над барами; «нет карточек» считает и заглушки. Тегов картинок в файл не добавлено.
- Рабочий стол передаёт `placeholders={{ sections, cards }}` и `lostLevel`; `openGuideCard` задаёт id и снимает потерю (в том числе кнопка «Назад»).

## Проверка

- PASS: `node --experimental-strip-types --test --test-skip-pattern="matrix freshness: the real matrix commit" lib/*.test.ts` — 2083 теста, 0 fail, 3 skipped. Тест «matrix freshness: the real matrix commit» пропущен по имени, красный до плана 24-11, не засчитан как PASS.
- PASS: тесты задач (`level-ui`, `level-placeholders`, `portia-desktop`, `window-open`, `info-phone-nav`, `app-state`, `image-framing-crop`) — 0 fail.
- PASS: `node node_modules/typescript/bin/tsc --noEmit` — 0 ошибок; ESLint по репозиторию — 0 ошибок, 17 предупреждений (те же, что в 24-02).
- Новые тесты исходников в `lib/level-ui.test.ts`: проводка в ответе и кэше (порядок относительно `setContent`), блок вместо первой записи (T-24-30), заглушки index и маркер (D-10), пустые состояния (S1), перенос фокуса, bar/tile/block в `GuideApp`, проводка пропсов рабочим столом.
- BLOCKED (не доказано, не PASS): живая смена уровня в браузере (понижение и повышение), фактический перенос фокуса и озвучивание `role=status`, прокрутка и сохранение поиска при замене, внешний вид заглушек в окнах, телефон. Это backstop S6 плана 24-11; тесты проверяют текст исходников, а не поведение в браузере.

## Requirements

- LVL-04 уже отмечено выполненным (24-02), здесь добавлены оставшиеся поверхности.
- LVL-09 остаётся Pending: клиентская проводка трёх окон готова, но окна «Корзина» и «Устав» (план 24-10) и живая проверка смены уровня в браузере (S6, план 24-11) ещё не сделаны; отмечать выполненным до этого нельзя.

## Deviations from Plan

### Отклонения по форме

- Вызовы `reconcileSelection(` собраны в три функции уровня модуля, а `fetchContent` и чтение кэша вызывают общий `applySelections`; критерий «не меньше двух строк `reconcileSelection(`» выполнен (три в функциях), тест проверяет вызов `applySelections` до `setContent` в обоих местах.
- Вместо условия `infoView === "empty"` для «Информации» (и вместо подсчёта по открытым для архива) в `appViewState` передаётся число записей вместе с заглушками; результат тот же, но «устаревшая» полоса и «ошибка» работают и для копии только из заглушек.
- `npm exec tsc` и `npm run lint` не запускаются под временным Node; типы и ESLint запущены прямым вызовом `node node_modules/...`.

### Auto-fixed Issues

Нет.

## Known Stubs

Заглушек данных нет. Записи в `.planning/WINDOWS.md` не добавлялись.

## Threat Flags

Новой сетевой поверхности и границ доверия нет. Митигации: T-24-29 (заглушка получает только уровень и номер, ключ React — slot), T-24-30 (потерянный выбор хранит только slot и уровень заглушки, окно показывает блок; тест исходников).

## Open Items

- Двойной `requestAnimationFrame` для переноса фокуса не проверен в браузере (S6).
- При тихом возврате карточки «Справочника» (D-22) существующий эффект открытия страницы ставит фокус на страницу; на практике это то же окно, где был блок, но поведение подтвердит только S6.

## Self-Check: PASSED

- FOUND: components/portia-desktop.tsx, components/portia-desktop-documents.tsx, lib/level-ui.test.ts
- FOUND commits: 3b9e0c0, 017f506 (`git rev-list --count` от базы = 2)
