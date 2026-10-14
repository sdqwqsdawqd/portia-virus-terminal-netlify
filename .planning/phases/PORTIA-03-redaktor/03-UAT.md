---
status: complete
phase: PORTIA-03-Редактор
source: [03-VERIFICATION.md]
started: 2026-10-14T00:00:00Z
updated: 2026-10-14T09:02:03.647Z
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

## Summary

total: 10
passed: 6
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Строки едут по «дорожкам» при перетаскивании за ≡ на ПК и на телефоне; одно перетаскивание = один шаг ↶"
  status: failed
  reason: "User reported: its hard for phone to drag them down and up"
  severity: minor
  test: 2
  root_cause: ""     # possibly related to 03-REVIEW.md IN-05 (drag stops following the pointer after lost pointer capture)
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Панель форматирования (✎) на телефоне помещается на экран и пригодна к работе"
  status: failed
  reason: "User reported: РЕДАКТОР ОФОРМЛЕНИЯ is too big for phones, no need to remove functions but to make window smaller and allow to scroll it"
  severity: minor
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Длинный ник сотрудника в заголовке профиля не разрывается посреди слова в обычном и развёрнутом окне"
  status: failed
  reason: "User reported: this shows really weird when window is not fully open, and if it fully open nickname still shows weird"
  severity: cosmetic
  test: 10
  root_cause: ""
  artifacts:
    - path: "app/portia.css"
      issue: ".personnel-profile-identity h2 at 44px wraps mid-word (Kotik_p / lay1232)"
  missing: []
  debug_session: ""

- truth: "Во время одного перетаскивания за ≡ строку можно двигать и вверх, и вниз, пока палец/мышь не отпущены"
  status: failed
  reason: "User reported: still problems, after i move to up it cant move down until i stop holding"
  severity: major
  test: 9
  root_cause: ""     # likely 03-REVIEW.md IN-05 (pointer capture lost after the row moves in the DOM; drag stops following the pointer)
  artifacts:
    - path: "components/portia-editor.tsx"
      issue: "reorder drag handlers"
  missing: []
  debug_session: ""

- truth: "Перемещение строки при перетаскивании анимировано, чтобы было видно, куда она уехала"
  status: failed
  reason: "User reported: i need some kind of animations for moving to make sure"
  severity: minor
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
