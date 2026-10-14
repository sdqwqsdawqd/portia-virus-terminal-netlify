---
status: diagnosed
phase: PORTIA-03-Редактор
source: [03-VERIFICATION.md]
started: 2026-10-14T00:00:00Z
updated: 2026-10-14T10:23:46.625Z
---

## Current Test

[testing complete]

## Tests

### 1. Нет горизонтальной прокрутки на 375px на всех экранах редактора
expected: Список → запись → «← К списку» работает; поля 16px; нет горизонтальной прокрутки ни на одном экране редактора
result: pass

### 2. Перетаскивание за ≡ на ПК и на телефоне
expected: Строки едут по «дорожкам», край экрана автопрокручивает, стрелки ↑/↓ на сфокусированной ≡ двигают строку; одно перетаскивание = один шаг ↶
result: issue
reported: "its hard for phone to drag them down and up"
severity: minor

### 3. Панель форматирования (✎) на телефоне
expected: Клавиатура скрыта, пока открыта панель; выделение подсвечено; стиль применяется; ГОТОВО возвращает полосу сохранения
result: issue
reported: "РЕДАКТОР ОФОРМЛЕНИЯ is too big for phones, no need to remove functions but to make window smaller and allow to scroll it"
severity: minor

### 4. Полоса несохранённых изменений на телефоне
expected: Полоса закреплена над таскбаром 44px, называет изменённые разделы, не перекрывает последнее поле; при открытой панели форматирования скрыта, после ГОТОВО возвращается
result: pass

### 5. Ctrl+S на русской раскладке и Ctrl+Z / Ctrl+Y в окне редактора
expected: Сохраняет без диалога браузера «Сохранить страницу»; при другом активном окне не реагирует
result: pass

### 6. Предупреждение браузера при перезагрузке с несохранёнными правками
expected: Стандартное предупреждение появляется только при несохранённых правках
result: pass

### 7. Выбор в Корзине после отмены, удаления и восстановления (исправления WR-01)
expected: Выбранный файл или вирус в Корзине остаётся выбранным после Ctrl+Z / Ctrl+Y / ↶ и «Отменить изменения»; после удаления последнего файла или восстановления последнего вируса показывается первая оставшаяся запись, а не «Корзина пуста» рядом с непустым списком
result: pass

### 8. Сохранить и закрыть (исправления WR-02 / WR-03)
expected: В диалоге закрытия СОХРАНИТЬ: пока идёт сохранение, обе кнопки СОХРАНИТЬ и НЕ СОХРАНЯТЬ неактивны; окно закрывается только после успешного сохранения; ОТМЕНА во время сохранения оставляет окно открытым; картинка, загруженная в момент сохранения, не теряется (после закрытия и повторного открытия она на месте или окно не закрылось)
result: pass

### 9. Перетаскивание не «залипает» (исправление WR-03 первого раунда)
expected: Отпустить мышь/палец вне ручки ≡ или переключиться на другое окно во время перетаскивания — перетаскивание заканчивается; следующая правка — отдельный шаг ↶, а не часть перетаскивания; второй палец и правая кнопка не начинают перетаскивание
result: issue
reported: "still problems, after i move to up it cant move down until i stop holding. Also i need some kind  of animations for moving to make sure"
severity: major

### 10. Ник в карточке сотрудника (PORTIA://PERSONNEL) — замечание владельца во время теста 5
expected: Длинный ник в заголовке профиля не разрывается посреди слова и выглядит нормально и в обычном, и в развёрнутом окне
result: issue
reported: "this shows really weird when window is not fully open, and if it fully open nickname still shows weird" (screenshot: h2 «Kotik_play1232» в .personnel-profile-identity ломается на «Kotik_p / lay1232», 44px)
severity: cosmetic

### 11. Повторная проверка: перетаскивание вверх и вниз за одно удержание (после 03-05)
expected: На ПК и на телефоне строку за ≡ можно увести вверх и вернуть вниз, не отпуская палец/мышь; соседние строки плавно съезжают (≈0,16 с); с выключенными «Анимациями» строки переставляются мгновенно; одно перетаскивание = один шаг ↶
result: pass

### 12. Повторная проверка: панель форматирования на телефоне (после 03-06)
expected: Панель ✎ занимает чуть больше трети экрана и стоит на таскбаре; заголовок «РЕДАКТОР ОФОРМЛЕНИЯ» и кнопки СБРОСИТЬ / ГОТОВО видны всё время, прокручиваются только настройки между ними; все настройки и выбор цвета на месте; ГОТОВО возвращает полосу сохранения
result: issue
reported: "When i trying to select editor is closing so i need to open again, also if in document color is different i can only notice if i select the category"
severity: major

### 13. Повторная проверка: ник в карточке сотрудника (после 03-06)
expected: «Kotik_play1232» в одну строку в обычном и развёрнутом окне, на телефоне и на планшете; в узком окне и на телефоне аватар над ником
result: pass

## Summary

total: 13
passed: 8
issues: 5
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Строки едут по «дорожкам» при перетаскивании за ≡ на ПК и на телефоне; одно перетаскивание = один шаг ↶"
  gap_id: uat-03-t2-drag
  status: resolved
  resolved_by: "03-05-PLAN.md"
  resolved_at: "2026-10-14"
  reason: "User reported: its hard for phone to drag them down and up"
  severity: minor
  test: 2
  root_cause: "OrderDragHandle tracks the drag only via the handle button's onPointerMove, which needs pointer capture. When a row moves down React re-inserts the dragged row's DOM node (keyed list placement), pointer capture is lost and later moves go elsewhere, so the drag stops following until release (03-REVIEW IN-05, reproduced in headless Edge)"
  artifacts:
    - path: "components/portia-editor.tsx"
      issue: "OrderDragHandle: onPointerMove on the button (~237-240); window listener effect (~173-185) only ends the drag"
  missing:
    - "Window-level pointermove listener (isPrimary && active) that updates pointer.current and calls moveTo; remove the button's onPointerMove"
  debug_session: ".planning/debug/reorder-drag-one-direction.md"

- truth: "Панель форматирования (✎) на телефоне помещается на экран и пригодна к работе"
  gap_id: uat-03-t3-format-panel
  status: resolved
  resolved_by: "03-06-PLAN.md"
  resolved_at: "2026-10-14"
  reason: "User reported: РЕДАКТОР ОФОРМЛЕНИЯ is too big for phones, no need to remove functions but to make window smaller and allow to scroll it"
  severity: minor
  test: 3
  root_cause: "Phone cap max-height min(44svh,340px) covers about half the screen, content (~471px) is twice the cap, and the whole section scrolls so the header and the reset/done footer scroll away"
  artifacts:
    - path: "app/portia.css"
      issue: "@media 900px .floating-text-format (~1022), padding-bottom (~1031), toolbar (~1032), <=430px rules (~1110-1121)"
  missing:
    - "Smaller cap min(38svh,300px), bottom 44px, flex column with pinned header/footer, scroll only .rich-text-toolbar, tighter <=430px paddings; keep all controls"
  debug_session: ".planning/debug/format-panel-too-big-phone.md"

- truth: "Длинный ник сотрудника в заголовке профиля не разрывается посреди слова в обычном и развёрнутом окне"
  gap_id: uat-03-t10-nickname
  status: resolved
  resolved_by: "03-06-PLAN.md"
  resolved_at: "2026-10-14"
  reason: "User reported: this shows really weird when window is not fully open, and if it fully open nickname still shows weird"
  severity: cosmetic
  test: 10
  root_cause: "Nick h2 font is viewport-based clamp(27px,4vw,44px) with max-width 12ch and overflow-wrap:anywhere, while the avatar track minmax(190px,238px) squeezes the name column in a non-maximized window; phone rule (~1002) is also too big. Predates phase 3 (commit 890b651)"
  artifacts:
    - path: "app/portia.css"
      issue: ".personnel-profile-head grid (~341), h2 (~363), phone rules (~999-1002)"
  missing:
    - "container-type inline-size on .personnel-profile and identity; h2 font clamp(24px,8cqi,44px); drop 12ch; overflow-wrap break-word; @container (max-width:680px) stacks the head; delete the phone h2 font rule"
  debug_session: ".planning/debug/personnel-nickname-midword-break.md"

- truth: "Во время одного перетаскивания за ≡ строку можно двигать и вверх, и вниз, пока палец/мышь не отпущены"
  gap_id: uat-03-t9-drag
  status: resolved
  resolved_by: "03-05-PLAN.md"
  resolved_at: "2026-10-14"
  reason: "User reported: still problems, after i move to up it cant move down until i stop holding"
  severity: major
  test: 9
  root_cause: "OrderDragHandle tracks the drag only via the handle button's onPointerMove, which needs pointer capture. When a row moves down React re-inserts the dragged row's DOM node (keyed list placement), pointer capture is lost and later moves go elsewhere, so the drag stops following until release (03-REVIEW IN-05, reproduced in headless Edge)"
  artifacts:
    - path: "components/portia-editor.tsx"
      issue: "OrderDragHandle: onPointerMove on the button (~237-240); window listener effect (~173-185) only ends the drag"
  missing:
    - "Window-level pointermove listener (isPrimary && active) that updates pointer.current and calls moveTo; remove the button's onPointerMove"
  debug_session: ".planning/debug/reorder-drag-one-direction.md"

- truth: "Перемещение строки при перетаскивании анимировано, чтобы было видно, куда она уехала"
  gap_id: uat-03-t9-anim
  status: resolved
  resolved_by: "03-05-PLAN.md"
  resolved_at: "2026-10-14"
  reason: "User reported: i need some kind of animations for moving to make sure"
  severity: minor
  test: 9
  root_cause: "No move animation exists; rows jump instantly (portia.css only highlights the dragged row)"
  artifacts:
    - path: "components/portia-editor.tsx"
      issue: "OrderDragHandle has no FLIP/transition"
  missing:
    - "FLIP in OrderDragHandle via useLayoutEffect + row.animate translateY, 160ms --ease-out, skipped when data-motion=reduce"
  debug_session: ".planning/debug/reorder-drag-one-direction.md"

- truth: "On a phone, selecting text while the format panel is open keeps the panel open"
  gap_id: uat-03-t12-panel-closes-on-select
  status: failed
  reason: "User reported: When i trying to select editor is closing so i need to open again"
  severity: major
  test: 12
  root_cause: "Deliberate 03-03 behaviour (commit 6583baf): FloatingTextFormatPanel's phone effect adds a document focusin listener that closes the panel when the field gets focus, and any tap/long-press to select focuses the field. Owner rejects that reading of D-06 (D-06 only requires the keyboard to stay hidden)"
  artifacts:
    - path: "components/portia-editor.tsx"
      issue: "FloatingTextFormatPanel phone effect ~1528-1554 (blur at ~1533, focusin close at ~1545-1547); FormattedTextarea ~1453-1500; ActiveFormatContext ~49/823; ✎ onClick ~856"
  missing:
    - "Remove the focusin close listener"
    - "inputMode=\"none\" on the field while its panel is open, phones only (<=900px; owner decision)"
    - "Blur once from the ✎ onClick on phones instead of on every panel re-mount"
    - "Update the 03-03 truth / line ~1526 comment"
  debug_session: ".planning/debug/format-panel-select-closes.md"

- truth: "The format panel shows the current text colour of the selection without opening the colour control"
  gap_id: uat-03-t12-color-not-shown
  status: failed
  reason: "User reported: if in document color is different i can only notice if i select the category"
  severity: minor
  test: 12
  root_cause: "Owner meant the text field. portia.css:507 forces idle rich fields (not focused, not editor-active) to neutral grey with !important, hiding run colours; ::selection (portia.css:68) turns selected text near-white. The panel itself already shows the colour in the «Цвет текста» card title"
  artifacts:
    - path: "app/portia.css"
      issue: "~507 idle .formatted-rich-input > span colour override; ~68 ::selection colour"
  missing:
    - "Owner decision: draw idle rich fields on the preview background and show real run colours (drop the grey override)"
    - "Selection inside .formatted-rich-input sets background only, keeps the text colour"
  debug_session: ".planning/debug/format-panel-select-closes.md"

- truth: "A broadcast (news/quest/task) created and saved in the editor stays after saving, polling and reload"
  gap_id: uat-03-owner-broadcast-vanishes
  status: failed
  reason: "User reported (owner note after test 13): when I create a post, like a forum thread or a news item, it gets deleted for some reason"
  severity: blocker
  test: 13
  root_cause: "fetchContent (portia-desktop.tsx ~320-342, polled every 30 s) accepts any GET without a revision check: an older answer (in-flight poll or stale Netlify CDN copy, s-maxage=300 + SWR, never purged from next dev) reverts content and revision, and the clean editor syncs to it; a second editor's poll bumps revision so its stale draft passes the 409 check and overwrites the post. Pre-existing (25bcbb2/5001944)"
  artifacts:
    - path: "components/portia-desktop.tsx"
      issue: "fetchContent ~320-342, poll ~421, saveContent ~801-833 sends the latest revision, not the draft's base revision"
    - path: "components/portia-editor.tsx"
      issue: "sync effect ~571-578 adopts whatever the desktop stores"
    - path: "lib/portia-cdn.ts"
      issue: "cached GET; purge fails silently locally"
  missing:
    - "Drop GET answers with a revision lower than the latest known (incl. the one from saveContent) and polls in flight when a save started"
    - "PUT sends the revision the draft was built on (kept with the baseline), so a stale draft gets 409"
    - "Sync decision as a pure lib/ function with a test"
  debug_session: ".planning/debug/forum-news-posts-vanish-duplicate.md"

- truth: "Adding a new broadcast creates exactly one post and later formatting never writes into another post"
  gap_id: uat-03-owner-broadcast-duplicates
  status: failed
  reason: "User reported: when I create a new post in the forum, it gets duplicated"
  severity: major
  test: 13
  root_cause: "Broadcast handlers address posts by array index (portia-editor.tsx ~968-972) while «+ НОВОЕ СООБЩЕНИЕ» unshifts at the top (~975); the format panel's stored onCommit (~1427/1441, called ~1572) keeps the old index and is not cleared on add/delete, so the next ✎ change writes the old post's text into the new post (or a wrong/missing index after delete). Deleting a post also leaves its formatted text behind"
  artifacts:
    - path: "components/portia-editor.tsx"
      issue: "index-based broadcast/info handlers ~966-975, format target ~1423-1442/1569-1573"
  missing:
    - "Address broadcasts and info sections by id, including the format panel's commit callback (or clear the format target on add/delete/reorder)"
    - "Remove a post's formatting on delete"
    - "Id-based updates as pure lib/ functions with a test"
  debug_session: ".planning/debug/forum-news-posts-vanish-duplicate.md"
