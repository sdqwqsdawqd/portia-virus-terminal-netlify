---
quick_id: 261122-ws3
status: complete
commit: 1eba1298, 3d2e90dd
---

# Quick 261122-ws3 — итог

- app/portia.css: `.workspace` и `.app-window` — `overflow: clip` (не прокручиваются программно).
- components/portia-desktop-documents.tsx: `portia-guide-folded-v4` хранит свёрнутые разделы; по умолчанию всё открыто.
- components/portia-editor.tsx: `guideFolded`/`guideOpenByDefault` — разделы и карточки «Справочника» открыты по умолчанию; запись реестра D-21 `PORTIA-Q261122-GUIDEOPEN` в lib/format-launch.test.ts.
- Тесты: lib/portia-desktop.test.ts (ключ, раскрытие, clip). tsc чистый; lib/*.test.ts 2810/2804, 3 известных падения; next build успешен.
- Проверка владельцем: ожидается (отправка на GitHub — после одобрения).
