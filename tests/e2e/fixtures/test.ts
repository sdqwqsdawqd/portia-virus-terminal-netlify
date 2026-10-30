import { test as base, expect } from "@playwright/test";
import {
  actorAvailability,
  type ActorAvailability,
  type ActorRole,
} from "./actors";
import {
  assertDiagnosticsClean,
  DiagnosticLedger,
  installDiagnostics,
} from "./diagnostics";
import {
  assertNoOwnApiFulfilled,
  ExternalRouteLedger,
  installExternalRoutes,
} from "./external-routes";
import { deterministicContract, installDeterminism } from "./determinism";

type PortiaFixtures = {
  actorRole: ActorRole;
  actor: ActorAvailability;
  diagnostics: DiagnosticLedger;
  externalRoutes: ExternalRouteLedger;
  determinism: typeof deterministicContract;
};

export const test = base.extend<PortiaFixtures>({
  actorRole: ["visitor", { option: true }],
  actor: async ({ actorRole }, use, testInfo) => {
    const actor = actorAvailability(actorRole);
    testInfo.skip(
      actor.status === "BLOCKED",
      actor.status === "BLOCKED" ? `BLOCKED: ${actor.reason}` : undefined,
    );
    await use(actor);
  },
  determinism: [
    async ({ page }, use) => {
      await installDeterminism(page);
      await use(deterministicContract);
    },
    { auto: true },
  ],
  externalRoutes: [
    async ({ page }, use) => {
      const ledger = new ExternalRouteLedger();
      await installExternalRoutes(page, ledger);
      await use(ledger);
      assertNoOwnApiFulfilled(ledger.entries);
    },
    { auto: true },
  ],
  diagnostics: [
    async ({ page }, use, testInfo) => {
      const ledger = new DiagnosticLedger();
      await installDiagnostics(page, ledger);
      await use(ledger);
      await assertDiagnosticsClean(ledger.entries, testInfo);
    },
    { auto: true },
  ],
});

export { expect };
