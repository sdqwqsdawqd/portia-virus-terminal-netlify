# Quick 261104-m6g: desktop and Promotion polish

## Goal
Fix the reported mobile right gap after closing apps, make reviewer and qualification controls compact and consistent, preload assistant GIFs, remove spurious leading blank lines, and show the saved custom accent immediately.

## Tasks
1. Trace mobile viewport geometry and root scrolling during window transitions; fix the cause and verify open/close behavior.
2. Reposition nickname reset opposite request navigation; frame reviewer actions and align manual/random issue controls; make qualification question management faster to scan and reach.
3. Preload assistant GIFs from validated embedded media, suppress leading empty lines in assistant messages, and correct the custom accent swatch/persistence presentation.
4. Run focused checks and record evidence, then update GSD quick summary/state. Do not touch production data or protected owner paths.

## Verification
- TypeScript and focused unit tests.
- Browser viewport check across open/close transitions if available.
- No staging mutation required.
