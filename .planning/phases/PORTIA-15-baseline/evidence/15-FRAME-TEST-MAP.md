# Phase 15 Frame-to-Test Map

- Figma: [PORTIA OS — Phase 15 Baseline](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ)
- File key: `GEf7NB9v2GZN80cMzRvUVQ`
- Figma revision locator: MCP session `77cd90e1-9022-4a59-8906-de90227ad904`, validated 2026-10-30
- Candidate set: `phase15-current-efbc1401080d`
- Source commit: `efbc1401080d6b65ba1f4916ad0343b783c62bb8`
- Coverage: 84 rows — 51 CAPTURED, 33 BLOCKED
- Authority: CURRENT evidence only; baseline approval remains pending and `02 APPROVED FOR BASELINE` is empty.

Figma Starter limits the file to three pages. All CURRENT areas below are named sections on `00 CURRENT BASELINE`; PROPOSED and APPROVED remain separate pages.

| Requirement | Surface | Actor / state | Project | Candidate identity | Figma section / node | Intended snapshot |
|---|---|---|---|---|---|---|
| STAB-BASE-03 | Desktop and window shell | visitor — active maximized window; motion off | chromium-desktop | `fa6dfd31cb01b0f38aad26efe16291e2f9b52dd58c309f225600a7d74593577d` | `02 Desktop CURRENT` / [`3:74`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-74) | `tests/e2e/visual/__screenshots__/window-search-maximized--chromium-desktop.png` |
| STAB-BASE-03 | Desktop and window shell | visitor — active restored window; motion off | chromium-desktop | `70b54d1424a34237273f61122e5bd60db90c6afd9ce493c12bf3ab9222fe2aa7` | `02 Desktop CURRENT` / [`3:80`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-80) | `tests/e2e/visual/__screenshots__/window-search-restored--chromium-desktop.png` |
| STAB-BASE-03 | Desktop and window shell | visitor — clean desktop; boot complete; taskbar and start closed; motion off | chromium-desktop | `efa78461ec525efd74c6549308409ad5bb680acf6bbb87bb9892d8ef9a4968c0` | `02 Desktop CURRENT` / [`3:86`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-86) | `tests/e2e/visual/__screenshots__/desktop-clean--chromium-desktop.png` |
| STAB-BASE-03 | Desktop and window shell | visitor — start panel open; motion off | chromium-desktop | `8bc6e2f22c8916e8ea86128dc0edc1f50a7b1b0f8b4ef9c1b6d9f6cabd25a14c` | `02 Desktop CURRENT` / [`3:92`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-92) | `tests/e2e/visual/__screenshots__/desktop-start-open--chromium-desktop.png` |
| STAB-BASE-03 | Desktop and window shell | visitor — window minimized to taskbar; motion off | chromium-desktop | `0aa0b20562d135233c897cfbe576e18115ee988da8fd77545c9edfdbaa7f5474` | `02 Desktop CURRENT` / [`3:98`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-98) | `tests/e2e/visual/__screenshots__/window-search-minimized--chromium-desktop.png` |
| STAB-BASE-03 | Editor | editor — dirty, saving and saved | chromium-desktop | `BLOCKED:dirty, saving and saved` | `04 Editor CURRENT` / [`3:200`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-200) | `tests/e2e/visual/__screenshots__/editor-dirty-saving-saved--chromium-desktop.png` |
| STAB-BASE-03 | Editor | editor — long list/internal scroll and dialogs | chromium-desktop | `BLOCKED:long list/internal scroll and dialogs` | `04 Editor CURRENT` / [`3:206`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-206) | `tests/e2e/visual/__screenshots__/editor-long-list-dialog--chromium-desktop.png` |
| STAB-BASE-03 | Editor | owner — owner access and editor management | chromium-desktop | `BLOCKED:owner access and editor management` | `04 Editor CURRENT` / [`3:212`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-212) | `tests/e2e/visual/__screenshots__/owner-editor-access--chromium-desktop.png` |
| STAB-BASE-03 | Editor | editor — phone keyboard and touch | chromium-desktop | `BLOCKED:phone keyboard and touch` | `04 Editor CURRENT` / [`3:218`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-218) | `tests/e2e/visual/__screenshots__/editor-phone-keyboard--chromium-desktop.png` |
| STAB-BASE-03 | Editor | promo-reviewer — Promotion reviewer editor access | chromium-desktop | `BLOCKED:Promotion reviewer editor access` | `04 Editor CURRENT` / [`3:224`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-224) | `tests/e2e/visual/__screenshots__/promotion-reviewer-editor--chromium-desktop.png` |
| STAB-BASE-03 | Editor | editor — revision conflict and save error | chromium-desktop | `BLOCKED:revision conflict and save error` | `04 Editor CURRENT` / [`3:230`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-230) | `tests/e2e/visual/__screenshots__/editor-conflict-error--chromium-desktop.png` |
| STAB-BASE-03 | Editor | visitor — settings entry; editor action denied; sign-in route offered | chromium-desktop | `f8de1966f34a78ab698f188f3d8bf3d1d5fc674b7d23e7d50f2ef87ba791927b` | `04 Editor CURRENT` / [`3:236`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-236) | `tests/e2e/visual/__screenshots__/editor-visitor-denied--chromium-desktop.png` |
| STAB-BASE-03 | Editor | visitor — signed-out owner/editor login | chromium-desktop | `bc02c956de7f45838f82e1434a2550d5495146359aa0e02922b1568556463f3e` | `04 Editor CURRENT` / [`3:242`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-242) | `tests/e2e/visual/__screenshots__/editor-signed-out-login--chromium-desktop.png` |
| STAB-BASE-03 | Editor | editor — tab available; clean | chromium-desktop | `BLOCKED:tab available; clean` | `04 Editor CURRENT` / [`3:248`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-248) | `tests/e2e/visual/__screenshots__/editor-role-clean--chromium-desktop.png` |
| STAB-BASE-03 | Editor | editor — tab closed/revoked | chromium-desktop | `BLOCKED:tab closed/revoked` | `04 Editor CURRENT` / [`3:254`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-254) | `tests/e2e/visual/__screenshots__/editor-role-closed--chromium-desktop.png` |
| STAB-BASE-03 | Editor | editor — WYSIWYG selection and format panel | chromium-desktop | `BLOCKED:WYSIWYG selection and format panel` | `04 Editor CURRENT` / [`3:260`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-260) | `tests/e2e/visual/__screenshots__/editor-wysiwyg--chromium-desktop.png` |
| STAB-BASE-03 | Motion CURRENT | visitor — boot start, transition and complete | chromium-desktop | `BLOCKED:boot start, transition and complete` | `06 Motion CURRENT` / [`3:344`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-344) | `tests/e2e/visual/__screenshots__/motion-boot--chromium-desktop.png` |
| STAB-BASE-03 | Motion CURRENT | visitor — PNG spider spawn, front-leg step, hunting signal and route | chromium-desktop | `BLOCKED:PNG spider spawn, front-leg step, hunting signal and route` | `06 Motion CURRENT` / [`3:350`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-350) | `tests/e2e/visual/__screenshots__/motion-spider--chromium-desktop.png` |
| STAB-BASE-03 | Motion CURRENT | visitor — pointer exited at 260ms; animation continues without moving the shortcut | chromium-desktop | `7c3aaea21a215cd9de11a879a5ad7dd8d7c51db099dc2d0d610f1c26e77615d7` | `06 Motion CURRENT` / [`3:356`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-356) | `tests/e2e/visual/__screenshots__/motion-shortcut-interruption--chromium-desktop.png` |
| STAB-BASE-03 | Motion CURRENT | visitor — shortcut animation completed at 760ms; static geometry restored | chromium-desktop | `a3815a493391d81735cbb96cae9eddd8f489abf07806bc05436a7cd799fbeb93` | `06 Motion CURRENT` / [`3:362`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-362) | `tests/e2e/visual/__screenshots__/motion-shortcut-end--chromium-desktop.png` |
| STAB-BASE-03 | Motion CURRENT | visitor — shortcut animation key frame; fixed clock 260ms | chromium-desktop | `39db04f366b4041d0567b434709522449013655c99ad526863191088faee9d0c` | `06 Motion CURRENT` / [`3:368`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-368) | `tests/e2e/visual/__screenshots__/motion-shortcut-key--chromium-desktop.png` |
| STAB-BASE-03 | Motion CURRENT | visitor — shortcut animation start; fixed clock 0ms | chromium-desktop | `74c068291d4fd7b4e6c7510d8ec0d1338ad23f26d85f7f78c4923597a836748f` | `06 Motion CURRENT` / [`3:374`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-374) | `tests/e2e/visual/__screenshots__/motion-shortcut-start--chromium-desktop.png` |
| STAB-BASE-03 | Motion CURRENT | visitor — shortcut stable rest frame after completion | chromium-desktop | `91975cc93273f2aad3b6a3de7883f45c83e486664ffb1c9f6e801474183d0cc8` | `06 Motion CURRENT` / [`3:380`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-380) | `tests/e2e/visual/__screenshots__/motion-shortcut-rest--chromium-desktop.png` |
| STAB-BASE-03 | Motion CURRENT | visitor — Vivian idle, click/activity/offended and bubble | chromium-desktop | `BLOCKED:Vivian idle, click/activity/offended and bubble` | `06 Motion CURRENT` / [`3:386`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-386) | `tests/e2e/visual/__screenshots__/motion-vivian--chromium-desktop.png` |
| STAB-BASE-03 | Motion CURRENT | visitor — wallpaper movement and switching | chromium-desktop | `BLOCKED:wallpaper movement and switching` | `06 Motion CURRENT` / [`3:392`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-392) | `tests/e2e/visual/__screenshots__/motion-wallpapers--chromium-desktop.png` |
| STAB-BASE-03 | Motion CURRENT | visitor — web rest and wave response | chromium-desktop | `BLOCKED:web rest and wave response` | `06 Motion CURRENT` / [`3:398`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-398) | `tests/e2e/visual/__screenshots__/motion-web-wave--chromium-desktop.png` |
| STAB-BASE-03 | Motion CURRENT | participant — window drag/resize and qualification lock | chromium-desktop | `BLOCKED:window drag/resize and qualification lock` | `06 Motion CURRENT` / [`3:404`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-404) | `tests/e2e/visual/__screenshots__/motion-window-lock--chromium-desktop.png` |
| STAB-BASE-03 | Promotion | participant — active ordinary/qualification request | chromium-desktop | `BLOCKED:active ordinary/qualification request` | `05 Promotion CURRENT` / [`3:269`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-269) | `tests/e2e/visual/__screenshots__/promotion-active-request--chromium-desktop.png` |
| STAB-BASE-03 | Promotion | participant — active qualification lock and question types | chromium-desktop | `BLOCKED:active qualification lock and question types` | `05 Promotion CURRENT` / [`3:275`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-275) | `tests/e2e/visual/__screenshots__/promotion-qualification-lock--chromium-desktop.png` |
| STAB-BASE-03 | Promotion | participant — assigned task or qualification | chromium-desktop | `BLOCKED:assigned task or qualification` | `05 Promotion CURRENT` / [`3:281`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-281) | `tests/e2e/visual/__screenshots__/promotion-assigned--chromium-desktop.png` |
| STAB-BASE-03 | Promotion | promo-reviewer — bank list/editor/count/preview/save | chromium-desktop | `BLOCKED:bank list/editor/count/preview/save` | `05 Promotion CURRENT` / [`3:287`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-287) | `tests/e2e/visual/__screenshots__/promotion-question-bank--chromium-desktop.png` |
| STAB-BASE-03 | Promotion | promo-reviewer — claimed and unclaimed reviewer queue | chromium-desktop | `BLOCKED:claimed and unclaimed reviewer queue` | `05 Promotion CURRENT` / [`3:293`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-293) | `tests/e2e/visual/__screenshots__/promotion-reviewer-queue--chromium-desktop.png` |
| STAB-BASE-03 | Promotion | participant — cooldown | chromium-desktop | `BLOCKED:cooldown` | `05 Promotion CURRENT` / [`3:299`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-299) | `tests/e2e/visual/__screenshots__/promotion-cooldown--chromium-desktop.png` |
| STAB-BASE-03 | Promotion | participant — eligible action | chromium-desktop | `BLOCKED:eligible action` | `05 Promotion CURRENT` / [`3:305`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-305) | `tests/e2e/visual/__screenshots__/promotion-eligible--chromium-desktop.png` |
| STAB-BASE-03 | Promotion | participant — phone qualification variant | chromium-desktop | `BLOCKED:phone qualification variant` | `05 Promotion CURRENT` / [`3:311`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-311) | `tests/e2e/visual/__screenshots__/promotion-phone--chromium-desktop.png` |
| STAB-BASE-03 | Promotion | participant — qualification deadline and terminal state | chromium-desktop | `BLOCKED:qualification deadline and terminal state` | `05 Promotion CURRENT` / [`3:317`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-317) | `tests/e2e/visual/__screenshots__/promotion-deadline--chromium-desktop.png` |
| STAB-BASE-03 | Promotion | participant — safe first-party failure | chromium-desktop | `BLOCKED:safe first-party failure` | `05 Promotion CURRENT` / [`3:323`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-323) | `tests/e2e/visual/__screenshots__/promotion-safe-error--chromium-desktop.png` |
| STAB-BASE-03 | Promotion | participant-unbound — safe participant lookup; no nickname or private projection captured | chromium-desktop | `93c31d3533bdb670e1b0e27571981bd15f4f9bf9e6b5596e9af352194d3a84f3` | `05 Promotion CURRENT` / [`3:329`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-329) | `tests/e2e/visual/__screenshots__/promotion-participant-lookup--chromium-desktop.png` |
| STAB-BASE-03 | Promotion | participant — safe pass/fail result | chromium-desktop | `BLOCKED:safe pass/fail result` | `05 Promotion CURRENT` / [`3:335`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-335) | `tests/e2e/visual/__screenshots__/promotion-result--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — applicable applications: empty | chromium-desktop | `BLOCKED:applicable applications: empty` | `03 Applications CURRENT` / [`3:107`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-107) | `tests/e2e/visual/__screenshots__/applications-empty--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — applicable applications: fatal error | chromium-desktop | `BLOCKED:applicable applications: fatal error` | `03 Applications CURRENT` / [`3:113`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-113) | `tests/e2e/visual/__screenshots__/applications-fatal error--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — applicable applications: loading | chromium-desktop | `BLOCKED:applicable applications: loading` | `03 Applications CURRENT` / [`3:119`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-119) | `tests/e2e/visual/__screenshots__/applications-loading--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — applicable applications: permission denied | chromium-desktop | `BLOCKED:applicable applications: permission denied` | `03 Applications CURRENT` / [`3:125`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-125) | `tests/e2e/visual/__screenshots__/applications-permission denied--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — applicable applications: stale/degraded | chromium-desktop | `BLOCKED:applicable applications: stale/degraded` | `03 Applications CURRENT` / [`3:131`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-131) | `tests/e2e/visual/__screenshots__/applications-stale-degraded--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — База вирусов; current safe public state; unstable/private pixels masked where applicable | chromium-desktop | `ca2c97c738164f9b815a92d7979a7e19268aac3ea1fb3539df208b2f286f5f49` | `03 Applications CURRENT` / [`3:137`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-137) | `tests/e2e/visual/__screenshots__/application-virus-archive--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — Глобальный поиск; current safe public state; unstable/private pixels masked where applicable | chromium-desktop | `fdf7ce13a328647e78fea401b6e6a4882b06c39f7f47b3bf7c880ec98775d17b` | `03 Applications CURRENT` / [`3:143`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-143) | `tests/e2e/visual/__screenshots__/application-search--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — Информация; current safe public state; unstable/private pixels masked where applicable | chromium-desktop | `4840d4d3bac4ce21ce625108e3aaa532fe21fb8a32c57c5f6c061f3bab805077` | `03 Applications CURRENT` / [`3:149`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-149) | `tests/e2e/visual/__screenshots__/application-information--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — Корзина; current safe public state; unstable/private pixels masked where applicable | chromium-desktop | `8476c87c86382c4635b8ec13a6d9f15e4331ba6115f456349fbbc3088f8145f9` | `03 Applications CURRENT` / [`3:155`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-155) | `tests/e2e/visual/__screenshots__/application-trash--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — Настройки; current safe public state; unstable/private pixels masked where applicable | chromium-desktop | `f45cd7e80f2ec133217b3de3b42e69ac9ebd1ee338f51a87fcf8591e442b34e5` | `03 Applications CURRENT` / [`3:161`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-161) | `tests/e2e/visual/__screenshots__/application-settings--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — Сводка; current safe public state; unstable/private pixels masked where applicable | chromium-desktop | `cb7b5c7c74cb2422968b88de5a813cedab047fb371bca934f46eb2c13a34d44b` | `03 Applications CURRENT` / [`3:167`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-167) | `tests/e2e/visual/__screenshots__/application-broadcasts--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — Сотрудники; current safe public state; unstable/private pixels masked where applicable | chromium-desktop | `d8f2dedc57c7a4928a9fd0492919954ab24411633747152c03ea559a55d48f93` | `03 Applications CURRENT` / [`3:173`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-173) | `tests/e2e/visual/__screenshots__/application-employees--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — Справочник; current safe public state; unstable/private pixels masked where applicable | chromium-desktop | `18d228c74bdfad4a973ce6ddb19f6ac4221e24e6c952a47fa2fe0fe36f63273c` | `03 Applications CURRENT` / [`3:179`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-179) | `tests/e2e/visual/__screenshots__/application-guide--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — Таблица; current safe public state; unstable/private pixels masked where applicable | chromium-desktop | `79a7ef87fc5f57646a8fcd9953c5a6000220a2846192ccaf169c3c99a85c2433` | `03 Applications CURRENT` / [`3:185`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-185) | `tests/e2e/visual/__screenshots__/application-table--chromium-desktop.png` |
| STAB-BASE-03 | Public applications | visitor — Устав; current safe public state; unstable/private pixels masked where applicable | chromium-desktop | `cc0d4d63162742de23aa8123dd11f6a1c3a93ce19bc741d129c55b1f87d29078` | `03 Applications CURRENT` / [`3:191`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-191) | `tests/e2e/visual/__screenshots__/application-charter--chromium-desktop.png` |
| STAB-BASE-03 | Viewport, device and DPR matrix | visitor — Android Chromium layout/touch; target project chromium-phone | chromium-desktop | `BLOCKED:Android Chromium layout/touch; target project chromium-phone` | `00 Evidence` / [`3:47`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-47) | `tests/e2e/visual/__screenshots__/phone-chromium--chromium-phone.png` |
| STAB-BASE-03 | Viewport, device and DPR matrix | visitor — Firefox behavior/accessibility smoke; target project firefox-desktop | chromium-desktop | `BLOCKED:Firefox behavior/accessibility smoke; target project firefox-desktop` | `00 Evidence` / [`3:53`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-53) | `tests/e2e/visual/__screenshots__/desktop-firefox--firefox-desktop.png` |
| STAB-BASE-03 | Viewport, device and DPR matrix | visitor — owner-PC DPR 1.25 desktop geometry; target project chromium-dpr125 | chromium-desktop | `BLOCKED:owner-PC DPR 1.25 desktop geometry; target project chromium-dpr125` | `00 Evidence` / [`3:59`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-59) | `tests/e2e/visual/__screenshots__/desktop-dpr125--chromium-dpr125.png` |
| STAB-BASE-03 | Viewport, device and DPR matrix | visitor — representative iPhone layout/touch; target project webkit-phone | chromium-desktop | `BLOCKED:representative iPhone layout/touch; target project webkit-phone` | `00 Evidence` / [`3:65`](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ?node-id=3-65) | `tests/e2e/visual/__screenshots__/phone-webkit--webkit-phone.png` |

## Approval Boundary

### 15-09 machine identity index

These new read-only/device candidates are not mapped to Figma nodes or approved.
The index exists only so the verifier can prove that no generated row disappeared
before Plan 15-11 performs the real frame synchronization.

```text
0a9ee525ab49ff6ae94effb8ce93d84e0186051a253ea4fc0ed081e077852e7e
609aea8d4208a3c1b1f627a76fc0f56d2bb610b70fd4fb12be56913e7a2ae079
64713baecd8f463bc4fc8f23cbc0d4214b855434f3a20c9244d90663884ba04c
b142513eea6fdc6f9bdf1000b230ff2308629d0502612c5de1df4be9c4351824
c3faba44ba0cfc905f2fafb4b29a1250644d2a218fd397c8174cc3b53118ae42
2ee480db5705a4c532d0f88f128dc3707b60eee6746942496baaa9ca83e4c504
e2647c79186b24679e15d4b65167fec614452c8149e68a60dea686b8ed0c05b1
8130ffe1a1134e88f749f936e1d799eba968a8d7290079f58b015384811ce93b
a281adc8b7dcc79182e329206fbbebd24ca5bca950d363988fa22d1b94831058
f83cc77e3c7336ff9f3a72e459aa23d83f2cccca2238555bd0a41755fbb19000
ee1ba475b89334dae18db3af11da3b3130525f4f2bb3752c17dac34bc139f24a
3118262410fc72451c8ddf4370978580ed1c89af7b0919091ec51aa6374a2cff
fd164a283aea8d7bfe4166bca77eebdbc67319a484a38e98916e3102937c9a64
4029973dce3fc666c2c7d8926ddfe91e52c0e34545b0df267306bdca2b7ed6ca
bf9342a14ec61087f31e6abe6f5c24158b889ae5d63e27a34d2bd52981888e8f
5a749a329190a4a1a4c9e1286e0e13e398bffccc2aaeaeedfcb06bf55702f678
9365bd1391aec9fd0348402661cedb8586164119ed7d5775c07b570bd0519279
6eefc48de3a0a237f15d9e7fe6a07691a2872fd2f6f5ec509f75152189369a24
d0ff7a90b8ea406f322db121da38efb4f32c225fb4ee4318d4a01afc51ce0fb8
98d78f1868656967d513aa14de0e93bcd8516722e22b5394d0cdacaf6f8fbdaa
a74fa19ba66f932119dceffed5b5eefc4bcb3ffc9ace1ec2ba3912b8720eaa0d
b8c66fac133d59513f9ebf684a93d87a147480eb124703f13d67e970bdf8be91
62f01b97255560a43f199c3de29f0087ee00be10ac3d8e36cf20f0de6c1fdefc
8b0c74abab1059810ededa151e81a6f97f3fea88ead7216911d708f05da3c388
c3aeb4a7d852fc01ad717b284b0e3bcc92cd95ac54f06e0855f3316993958639
71a0b467061ab240579f32824a97e0357ebe5ed237358a6794ac3064c11b5a3d
989fb4ba7f002015af6f7927a6365517fd06cff61d5a73985109a812b814de0c
e5d700d0c4c48bf26ad61444b655dccf73bc05df9317e446a48dcbacf27b4b62
f3c3312ef4769c31444e22da185b686915f0989573da6e820c36a5794e001cad
f5c10592a328320c50c262c81aa209bf93cde6c8a28857e33d8ba455666f0a44
d84ee10602116e65cf4a7fc6602aabfb7299041a2ef5fd915b130df277e286c2
054fccc5f86ca0b8c7a126a4427b985eaf7fb0a1c92777b49c103c603712c002
ccf89983a44da11eb25ecc18bfde77f3d192b1a95f344000df34a868b4ac2015
d865464346fe13892bffe6ea24ddbc143ac721bf7e5ce3e6025b375ea8d78968
fe0ba2a7c948d531a5fb3714e730e62f9d76ca29faea3da28d8330b5e5f7634d
a463b379146084c9550b40d4228f95148ce73e9e3b8f806ea6aa054cea7ed1c5
c48f035e6ae751de1558f1dc6541dc4d6cb0c14cb98c860ce6257d2f9355948e
e284cd49dac04a259d21f267b1f0d57bc4dce435e8038c114ac89b113511bda1
66f292a060b053227756bede368f1002c46e97cca8bf5869363b897c0f5e7df0
8e6a8d99999ec4cef796b664233201b81b9c5570bd2ae2d6937397cec5e44383
3b2385a97116f96b7a517334ba0cfc4d47daa1b7d9fd8feb26ddaabbcea2822c
131a01819f2ca7d2f561f5770a77ec7fab0d43e8c59203aeba837a84e06c1657
a107ac61640f33add74e34d7991b4b0be3876406441f2c64aaee8ca4d1623b8e
1f226f689e1089b051988a51fafff69b04417f398eba0984a7ce72dd1b30e343
020a7365e888b45a826a229161addc1cf93350b83705ea42bb2c26bf56111710
19148e6053e06387022bb200e378a6dbd000c329572f4d79e1bc09448d0b3bd6
e115c46f22e1e2ad2ffe11f765abf3714f69a60eb5abedb19f9f9524336f22c5
33dcb763e767f39369f9e6771608bd350445abd7efd1c7d6fcaa5a8133b4cd8b
a82eaf1b2316ff6fab265c8ba684c06839814d7a4c5553be5c51800eabafd564
2ab71c1d84500ee827353780b5c302a1893d489b518853d6ed273fa2ac282df6
40ffbaeb04775253e1f638353ba56f73aa9042e238ac22507a70b7c3f5a7416a
213bd616c4f8f4cfaafd3ff43017740df2a053e732d41c5eee12f01eae8045e4
c5ff585e39b1b7dbb7909a1d2bcddf7cb7841e8e58becc25593ac78fb0533c47
BLOCKED:separate maximized control; chromium-phone
BLOCKED:separate maximized control; webkit-phone
c6ab768376dbfaf8fef2fc174fd020357bbb1e06887a645ef3cf3a40f1472301
BLOCKED:separate minimized control; chromium-phone
BLOCKED:separate minimized control; webkit-phone
9a4d209387c69458f46c07bebc21dfd7ea1dfd7de58e404a4b18a74e6882d386
f7120d4f6deb9379b46a9db429571e3c7752e5a6baa5b2452d67ba32822098c5
```

- `01 PROPOSED` contains only typography hierarchy, three-mode motion and deterministic-evidence proposals marked **NOT APPROVED**.
- `02 APPROVED FOR BASELINE` contained zero child nodes at validation.
- No candidate hash in this map is an approved golden until Plan 15-05 records named owner approval.

### 15-10 strict machine identity index

This index is the complete machine-verifiable row set for Plan 15-10. Existing
Figma node mappings above remain historical CURRENT references; no candidate is
promoted or owner-approved by inclusion here.

```text
b314d6be9b42d6b5d5695eea45bd9207db964ad3daa7843a60710d8f2041bdf5
fcde3e3dc431e177710ea223cbb11ee8354eeb66aae0f5870fe43a952ccd7f7e
7616d567b522ff7b1f5873e008af27c22d2e26fd810b0b3d19ebce66f1d33fd3
bbe2e065e67d55ca2842c49c92aa5aa17bda0dae9f20317407a4277bb64ca83a
2c95613f64296a671ff781ae87d1eb6c32811b1a514aeb70082ef69f862181a5
7fdcaf5d14c1d8be15f834d7bd5a7a3d2f8f7ae70720c8717474dca4c0deeb63
005bc62cbc1160040ad8a62ecbc532171c0e46f09ac3f2ea66a777c1060a9e61
dd5989e4c81db628a4bed8968544b77ee1c85f49f84f40b6427ec4d4d9ef4073
1465c070f626396724239817801f35812c999e6aa3b7f95b1eccc1b90ede8619
83582e367f1d9eaa274a9610c5225667b896e73be2ad0f01b7152274b6169226
BLOCKED:applications-system-empty
BLOCKED:applications-system-fatal error
BLOCKED:applications-system-loading
BLOCKED:applications-system-permission denied
BLOCKED:applications-system-stale/degraded
3b10ee74ca67423b452afb17290fe54525b1f7c36f7890573895b1755d42d72b
c0b524e77b351ef695377b767a40720b98cf71ccc79da76552fcdb3a92b799a3
BLOCKED:editor-conflict-error
BLOCKED:editor-dirty-saving-saved
BLOCKED:editor-long-list-dialog
BLOCKED:editor-phone-keyboard
BLOCKED:editor-role-clean
BLOCKED:editor-role-closed
bc02c956de7f45838f82e1434a2550d5495146359aa0e02922b1568556463f3e
3f118d1816303a095453c0ac0d3b624e872afd868762b35e5969f1d0b19d0101
BLOCKED:editor-wysiwyg
BLOCKED:motion-boot
0a988de21d7685dbe4dc3e812287a93b002eae778f4ac1bd5e8151f338f003b5
131a826a981f544feb1bc4b6cdbafc233a5c5589ff74850fcf91aa8e62558b93
58f6196425161c7656d7e767ac657198e823e879152fa5674b1544d7b38d2c39
a7830c0171c86766e2a2ba30e846463854cfb81f58cfa552f3b8fb7e5e4d4f08
ec34dd765177fc5316cfa711537d948c15627866dd1d630144c92e31a7381ce2
28605e9a525fdb0dc9308a308bb7560d36762f0f4657d96e51a1ce251121bbbe
ac599c280835691b38b88814ddcf74e783c8dde04cd25fec1761c5cba06f8075
99b50cc57d50bf2e505f870d8d0350817bc4eb8121edd6c52dd23fd868ee29ab
bcc8f283cd7db2b2801389988a7539e29922dfbb159c5c8048092dc94b3ed81a
954878cd14f7f2277d838bca697966884f15aabf750e2c41556c785ede547b2a
f042c262e5913daee42317b1b3e1bf2a824ece7d038dd1486d3ebb3cdc5681b8
fc39b8c67f8aa6b4e033b03307a34e5c17d04c01eb91a47f98190f499d397c65
BLOCKED:motion-wallpapers
5a2a82e8eaef44181c040c7f1aed50f7f27c930d5677253a85e397d4642bb752
c17356eb2cf8a409ac51fe5c2662f5ea803e0116d3bebe5a0801cffb609fef88
BLOCKED:motion-window-lock
BLOCKED:owner-editor-access
BLOCKED:promotion-active-request
BLOCKED:promotion-assigned
BLOCKED:promotion-cooldown
BLOCKED:promotion-deadline
BLOCKED:promotion-eligible
bfe7bba30de45c11c4abb57a9585387e3212e0c7aedab0977dbd8c6346509508
BLOCKED:promotion-phone
BLOCKED:promotion-qualification-lock
BLOCKED:promotion-question-bank
BLOCKED:promotion-result
BLOCKED:promotion-reviewer-editor
BLOCKED:promotion-reviewer-queue
BLOCKED:promotion-safe-error
583c0ebe01eac2fc10d3852da1b754b504e27ef21b09c64f1e2b8e24999e4049
e48deba8fb257fc0658c906662bde9b5e5b4b002fa7284ba0fae0b0da2126275
a93e855594b058a22aa664513104c41eb9ea5db1f4664df60acba219bdb98bee
392929a3b606fe9a278a84f11ffc850c995a457f50ae2196f0aa5ccc51f36c02
d38c7043ecd15abef2bb3196ac457e7581ea498a9d247cd4a53ce586afb1383b
0e1cae7fbc20e7080f653f1bc5a20e0747be5d4a682ff659650f7ba9dc2aa2c7
c5ff585e39b1b7dbb7909a1d2bcddf7cb7841e8e58becc25593ac78fb0533c47
32e8d045f437ab2f8a100588d757f4749e48eb06b15c7bc1faaa5c8984114fd7
b4c04244175e8085087af30c3ea619c8b9aec4cf79c1c27b7c0e76c1dbd86c17
ad428349748fb41068cc5210493407e24ea77c0387e0374fa1194da6f2181c02
2f01992b92484100635276a90dcb7032d54323d6d6db1d77ef25f20d8115e129
2e4945364dac6a944c925cf966dbd451861148601230fd5ef8979244dd8d4f20
BLOCKED:window-search-maximized
BLOCKED:window-search-minimized
f7120d4f6deb9379b46a9db429571e3c7752e5a6baa5b2452d67ba32822098c5
27122e44710feee6c694b3be50ecba151b86eb7e2849e0bd25846e0a5d0ef664
BLOCKED:desktop-firefox
8670df147c9e3cfb439f63bb21ebe1d39c1daa3581e28d73b76369eb5e3219b4
bfdaa1f95ee71db0285c15605b3fe998eff7d8c887de6d16b5cd866e74d1e209
d5513ffd650954cb8f7b4dd2eb6f7b0abbdd88e847d0f364e2f230619c5e5f8c
b46ff7eb8bab242bdca1e133abf4710440f2ca6a4c50a0bd8c57051f2730ecad
ccf89983a44da11eb25ecc18bfde77f3d192b1a95f344000df34a868b4ac2015
c48f035e6ae751de1558f1dc6541dc4d6cb0c14cb98c860ce6257d2f9355948e
6eefc48de3a0a237f15d9e7fe6a07691a2872fd2f6f5ec509f75152189369a24
```
