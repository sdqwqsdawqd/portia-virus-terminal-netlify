# Deferred items (Phase 20)

Найдено при выполнении 20-08. Не вызвано изменениями CSP, в область плана не входит.

- `media-states.spec.ts` "[STAB-MEDIA-03] a portrait that never answers gives up after 15s" на `webkit-phone` падает в полном прогоне файла (получает `failed` вместо `loading`), в одиночном запуске проходит. Падение воспроизводится и с временно отключённым Report-Only заголовком, то есть существовало до 20-08.
- `app-states.spec.ts:227` (chromium-desktop): диагностики `requestfailed ERR_FAILED` и `Failed to load resource` по изображению.
- `app-states.spec.ts:204` (firefox-desktop): консольная ошибка `Image corrupt or truncated`.
- `media-offscreen.spec.ts:54` (firefox-desktop): `requestfailed NS_BINDING_ABORTED` по удержанному хосту фрейма.
  Три последних: ни одной записи `csp`; это шум диагностик от намеренно сломанных внешних запросов в чужих спеках.
