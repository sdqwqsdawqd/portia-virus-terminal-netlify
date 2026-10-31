import type { Page } from "@playwright/test";

export const deterministicContract = Object.freeze({
  revision: "phase15-public-2026-10-30",
  seed: 15_103_013,
  now: "2026-10-30T09:00:00+03:00",
  settings: Object.freeze({
    accent: "teal",
    wallpaper: "radar",
    iconSize: "standard",
    motion: "on",
    spider: "on",
    customAccent: "",
  }),
});

export async function installDeterminism(page: Page) {
  const fixedTime = new Date(deterministicContract.now);
  await page.clock.install({ time: fixedTime });
  await page.clock.setFixedTime(fixedTime);
  await page.addInitScript((contract) => {
    let state = contract.seed >>> 0;
    let cryptoState = (contract.seed ^ 0x9e3779b9) >>> 0;
    let probeState = state;
    const randomProbe = Array.from({ length: 3 }, () => {
      probeState = (Math.imul(probeState, 1_664_525) + 1_013_904_223) >>> 0;
      return probeState / 0x1_0000_0000;
    });
    Math.random = () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
    Object.defineProperty(window.crypto, "getRandomValues", {
      configurable: true,
      value: <T extends ArrayBufferView | null>(array: T): T => {
        if (!array) throw new TypeError("Expected an integer typed array");
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let index = 0; index < bytes.length; index += 1) {
          cryptoState = (Math.imul(cryptoState, 1_664_525) + 1_013_904_223) >>> 0;
          bytes[index] = cryptoState >>> 24;
        }
        return array;
      },
    });
    if (!window.localStorage.getItem("portia-desktop-settings-v1")) {
      window.localStorage.setItem(
        "portia-desktop-settings-v1",
        JSON.stringify(contract.settings),
      );
    }
    window.sessionStorage.setItem("portia-boot-seen-v1", "1");
    window.sessionStorage.setItem("portia-e2e-fixture-revision", contract.revision);
    window.sessionStorage.setItem("portia-e2e-random-probe", JSON.stringify(randomProbe));
  }, deterministicContract);
}
