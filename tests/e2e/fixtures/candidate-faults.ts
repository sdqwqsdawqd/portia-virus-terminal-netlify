import type { Page } from "@playwright/test";

export type CandidateFault = Readonly<{
  method: "GET";
  path: `/api/${string}`;
  mode: "abort" | "delay";
  delayMs?: number;
}>;

export type CandidateFaultRecord = CandidateFault & Readonly<{
  action: "continued" | "aborted";
}>;

export async function installCandidateFault(page: Page, fault: CandidateFault) {
  if (fault.mode === "delay" && (!Number.isInteger(fault.delayMs) || (fault.delayMs ?? 0) <= 0)) {
    throw new Error("[PORTIA_CANDIDATE_FAULT_DELAY_INVALID]");
  }
  const records: CandidateFaultRecord[] = [];
  await page.route(`**${fault.path}`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== new URL(page.url()).origin || request.method() !== fault.method) {
      throw new Error("[PORTIA_CANDIDATE_FAULT_SCOPE_REFUSED]");
    }
    if (fault.mode === "abort") {
      records.push(Object.freeze({ ...fault, action: "aborted" }));
      await route.abort("failed");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, fault.delayMs));
    records.push(Object.freeze({ ...fault, action: "continued" }));
    await route.continue();
  });
  return records;
}
