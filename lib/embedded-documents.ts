// Server only: the addresses of the department documents do not reach client code; the documents themselves are public
// (SEC-07, .planning/PROJECT.md). This module is read by lib/content-response.ts, which hands an address to a visitor only
// when his level opens the app (D-11). No file of components/ or app/ (outside app/api) may import it.
// O-1 (assumption): only the «Устав» is leveled. The «Таблица» address stays where it is; adding it later is one line in
// LEVELED_APP_IDS (lib/portia-content.ts) and one line here.
import type { DocumentLink, LeveledAppId } from "./portia-content.ts";

export const embeddedDocuments: Record<LeveledAppId, DocumentLink> = {
  charter: { src: "https://sdqwqsdawqd.github.io/S.E-Portia/", external: "https://sdqwqsdawqd.github.io/S.E-Portia/" },
};
