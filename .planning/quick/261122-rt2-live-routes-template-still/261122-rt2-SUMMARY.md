---
quick_id: 261122-rt2
status: complete
commit: 1982b5a3
---

# Quick 261122-rt2 — итог

- components/portia-editor-live.tsx: LivePopover не закрывается от нажатий внутри `[data-floating-layer]`.
- components/portia-editor-dossier.tsx: панель путей помечена `data-floating-layer`.
- components/portia-virus-card.tsx: `staticRoutes` — пути как `span.route-item.is-still` (иконка + название); components/portia-template-builder.tsx передаёт его; класс `is-still` переносится в файл шаблона (lib/portia-template-export.ts).
- Тесты: lib/transmission-ui.test.ts (+1 тест, проверки обновлены). tsc чистый; lib/*.test.ts 2809/2803, 3 известных падения.
- Проверка глазами: BLOCKED.
- Решение 15 («кнопки путей в скачанном шаблоне — как есть») заменено решением владельца 2026-11-22: в шаблоне пути не нажимаются.
