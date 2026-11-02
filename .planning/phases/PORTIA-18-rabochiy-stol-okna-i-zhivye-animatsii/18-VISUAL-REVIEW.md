# Phase 18: реестр кандидатов и вердиктов владельца (STAB-MOTION-08)

- **Набор кандидатов:** `phase18-b9403654a03f` (папка `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/`, в git не входит)
- **Source commit:** `b9403654a03f7536543408c7ca9bd0d50f6fe1cd` (HEAD после 18-06)
- **Дата:** 2026-11-02
- **Проект съёмки:** chromium-desktop (Chromium, Windows)

## Правила

- Кадры снимаются с `animations: "allow"`, часть CSS-анимаций (рисование паутины, паук) идёт по реальному времени, а не по `page.clock`. Поэтому PNG побайтно не воспроизводятся между прогонами (проверено: три прогона дали три разных хэша для start). Хэш в таблице относится к PNG, лежащему в папке набора на момент записи; повторный прогон с тем же `PORTIA_VISUAL_SET_ID` перезапишет файлы, и хэши надо записывать заново. Побайтное равенство end == rest проверяется внутри одного прогона на снимках элемента.

- Phase 18 не меняет подписанные PNG (`tests/e2e/visual/__screenshots__`) и evidence Phase 15. Режим `--verify` манифеста не запускался.
- Вердикты ставит только владелец. Колонка «Вердикт» остаётся `PENDING`, пока владелец не ответил по этому хэшу; `PENDING` и `BLOCKED` не считаются одобренными.
- Перенос одобренных хэшей в эталон (`tests/e2e/visual/__screenshots__`) в Phase 18 не выполняется (см. раздел «Перенос в эталон»).

## 1. Замена отклонённых motion-кадров Phase 15 (shortcut)

| Section | id | project | новый хэш (SHA-256) | PNG (.runs) | заменяет строку Phase 15 | Вердикт | комментарий |
|---------|----|---------|---------------------|-------------|--------------------------|---------|-------------|
| Motion | `motion-shortcut-start` | chromium-desktop | `c087c734aad7411b0f5b67331b9b84798731d53958605730db04facff2971c74` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-shortcut-start--chromium-desktop.png` | REJECTED `ec34dd765177` | PENDING |  |
| Motion | `motion-shortcut-key` | chromium-desktop | `f6e799c4e7ab343fc737d223ba6f662140923d4a470342d15d200f63d49900af` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-shortcut-key--chromium-desktop.png` | REJECTED `58f619642516` | PENDING |  |
| Motion | `motion-shortcut-interruption` | chromium-desktop | `fb9542bcd3be876f906251077eb154b8af53bf03b380f35fe5b057d0400f565b` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-shortcut-interruption--chromium-desktop.png` | REJECTED `131a826a981f` | PENDING |  |
| Motion | `motion-shortcut-end` | chromium-desktop | `fcd55399dfc6c786e3105dbc98d4a72e75675db5da8c2f34867eefcda35eb526` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-shortcut-end--chromium-desktop.png` | REJECTED `0a988de21d76` | PENDING |  |
| Motion | `motion-shortcut-rest` | chromium-desktop | `46cb22d0c01bfe4325424ae7e43ac88e7b98fffacf6874b0d95a7683ceaeb63e` | `tests/e2e/visual-candidates/.runs/phase18-b9403654a03f/motion-shortcut-rest--chromium-desktop.png` | REJECTED `a7830c0171c8` | PENDING |  |

Проверено тестом при съёмке (chromium-desktop, `--retries=0`, 1 passed): рамка ярлыка (`boundingBox`) одинакова на start, key, interruption, end и rest (D-03); кадр `shortcut.screenshot({ animations: "allow" })` на end и на rest равен побайтно (D-02). Цикл: key на 280ms, класс `is-icon-animating` снят к 760ms.

Остальные строки (паук, волна, заставка, обои, phone-окна) добавляет Task 2 этого плана.
