---
phase: PORTIA-26
review: 26-REVIEW.md
scope: incremental, gap plans 26-15..26-20 (28fdbce..HEAD)
critical: 0
warning: 3
info: 3
open: 6
fixed: 0
---

# Phase 26: судьба замечаний ревью кода (инкрементальное ревью 26-15…26-20)

Ревью справочное, фазу не блокирует. Прежняя таблица (WR-01…WR-06 исправлены, IN-01…IN-03 открыты, ревью 26-01…26-14) осталась в истории git, коммит перед `112d896`. Все замечания этого ревью пока `open`. Исправить их можно через `/gsd-code-review PORTIA-26 --fix`.

| ID | Важность | Файл | Суть | Судьба |
|----|----------|------|------|--------|
| WR-01 | warning | components/portia-editor.tsx:1390, :1448 | Ручка перетаскивания у карточки активного раздела в `.editor-section-single` не перетаскивает: в обёртке одна карточка, свопать не с чем. Работают только стрелки | open |
| WR-02 | warning | components/portia-editor.tsx:288-291, components/portia-editor-dossier.tsx:187-212 | Ручка вкладки раздела в горизонтальной полосе: клавиши только ArrowUp/Down, автоскролл вертикальный, у каждого раздела два tab-стопа. Кнопки ←/→ убраны | open |
| WR-03 | warning | components/portia-level-picker.tsx:25-48 | Список уровней закрывается по `onBlur`/`relatedTarget`. В Safari и Firefox на macOS он не закрывается кликом вне, а при фокусе внутри выбор теряется. Нужно закрывать по pointerdown вне, как в `lib/start-menu.ts` | open |
| IN-01 | info | app/portia.css:1169, :1367 | `100cqw` уже считается от content-box, а формула ещё раз вычитает padding. Шрифт названий классов мельче возможного | open |
| IN-02 | info | app/portia.css | Мёртвые и дублирующие объявления: двойной `gap`, `border-color` после `border: 0`, дубли `.template-card-preview .class-cell*` | open |
| IN-03 | info | app/portia.css:2688-2689 | В развёрнутом «Повышении» строка загрузки оставляет пустую колонку 72px слева | open |
