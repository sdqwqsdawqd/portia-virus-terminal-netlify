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

// install() leaves the fake clock running at real speed, so a limit counted in fake seconds (the 15 s image and frame limits) keeps ticking while
// the test waits for a window or a response. A test that needs the limit to move ONLY through runFor parks the clock first. Parking does not make
// runFor cheap: runFor spends real time (about 1:1 on WebKit, about 3:1 on Chromium), so a test with 15 s steps also needs test.slow().
// Park AFTER the desktop mounted and after every step that needs a timer (a window minimize or restore finishes from a timer). The fake time now
// is the install time plus performance.now(); the 1 s margin keeps pauseAt from asking for a moment that already passed.
export async function parkClock(page: Page) {
  const elapsed = await page.evaluate(() => performance.now());
  await page.clock.pauseAt(new Date(Date.parse(deterministicContract.now) + elapsed + 1_000));
}

// D-69 (G3, 20-62): parkClock after the load leaves the spider a real-time dependent head start (its animation loop already ran 277-323 ms of the
// install clock in three runs), so its legs and route differ between identical runs. Parking BEFORE the load fixes the start: the clock stands at
// exactly 1000 ms, performance.now() at mount is the same in every run, and every frame of the loop comes only from runFor.
// The page is empty here, so the load itself never moves the clock; the scene then steps with runFor until the desktop has mounted.
export async function parkClockBeforeLoad(page: Page) {
  const elapsed = await page.evaluate(() => performance.now());
  if (elapsed > 500) throw new Error(`[PORTIA_MOTION_PARK_LATE] the install clock already ran ${Math.round(elapsed)} ms; the park would not start at the same moment`);
  await page.clock.pauseAt(new Date(Date.parse(deterministicContract.now) + 1_000));
}

// D-69 (G3, 20-62): the new document runs 25-29 ms of real time before the parked state reaches it, and the fake animation frames fall on multiples of
// 16 ms of performance.now(); with a head start of 28 ms or more the same 100 ms of runFor held one frame more (the spider legs differed by 0.02 degrees,
// its body by 0.85 px). Stepping to the next multiple of 16 ms right after the load removes that phase, the same frames fall on the same moments in every run.
export async function alignParkedClock(page: Page) {
  const now = await page.evaluate(() => performance.now());
  await page.clock.runFor(16 - (now % 16));
}

// D-69 (G3, 20-62): CSS animations and transitions run on the document timeline in real time, parkClock only stops timers; a frame taken at a random moment
// of a transition differs between runs. This brings the finite ones in `scope` to their end and holds the endless ones at phase `phaseMs`; nothing is hidden.
export async function settleAnimations(
  page: Page,
  scope: string | readonly string[],
  options: { limitMs?: number; phaseMs?: number } = {},
) {
  const limitMs = options.limitMs ?? 5_000;
  const selectors = typeof scope === "string" ? [scope] : [...scope];
  const timeout = () => new Error(`[PORTIA_MOTION_SETTLE_TIMEOUT] animations in ${selectors.join(", ")} did not settle in ${limitMs} ms`);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(timeout()), limitMs);
  });
  const work = page.evaluate(
    async ({ selectors: roots, phaseMs }) => {
      const scopes = roots.map((selector) => document.querySelector(selector)).filter((root): root is Element => root !== null);
      for (let round = 0; round < 8; round += 1) {
        const live = scopes.flatMap((root) => root.getAnimations({ subtree: true }));
        const unfinished = live.filter(
          (animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Number.POSITIVE_INFINITY) && animation.playState !== "finished",
        );
        for (const animation of live) {
          if (!Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Number.POSITIVE_INFINITY)) {
            animation.pause();
            animation.currentTime = phaseMs;
          }
        }
        if (unfinished.length === 0) return true;
        await Promise.all(unfinished.map((animation) => animation.finished.catch(() => undefined)));
      }
      return false;
    },
    { selectors, phaseMs: options.phaseMs ?? 0 },
  );
  work.catch(() => undefined);
  try {
    if (!(await Promise.race([work, limit]))) throw timeout();
  } finally {
    clearTimeout(timer);
  }
}
