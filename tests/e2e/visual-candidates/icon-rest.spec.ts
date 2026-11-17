import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "../fixtures/test";
import { DesktopPage } from "../pages/desktop.page";
import type { Locator, Page } from "@playwright/test";

// Phase 19-09 (D-17): the resting frame of a shortcut icon equals the last frame of its cycle.
// Per icon and host the symbol is captured with every cycle animation parked on its last frame while `is-icon-animating`
// is still on, then again two frames after the class is gone. Candidates only: nothing here writes under tests/e2e/visual.

const icons = ["search", "virus", "employees", "broadcasts", "info", "guide", "promotion", "settings", "charter", "sheet", "trash", "editor"] as const;
type IconId = (typeof icons)[number];
type Host = "desktop-shortcut" | "start-panel";
const hosts: Host[] = ["desktop-shortcut", "start-panel"];

// Hosts that the public desktop really renders: all shortcuts but «editor» (not a shortcut), the start panel lists five apps.
const desktopShortcuts = new Set<IconId>(["search", "virus", "employees", "broadcasts", "info", "guide", "promotion", "settings", "charter", "sheet", "trash"]);
const startPanelButtons = new Set<IconId>(["search", "virus", "employees", "promotion", "settings"]);

// Mirror of the «editor» artwork in components/portia-icons.tsx (no host renders it): the synthetic host is built from these two paths.
const editorPaths = ["M5 4v16M5 7h3M5 12h5M5 17h3", "m19.5 6.5-7.8 7.8-.9 3.1 3.1-.9 7.8-7.8a1.6 1.6 0 0 0-2.2-2.2Z"];

const lanes = new Set(["chromium-desktop", "chromium-dpr125", "chromium-phone"]);
const resultRoot = path.resolve("tests/e2e/visual-candidates/.runs/icon-rest");

test.beforeEach(({}, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Icon rest candidates run on chromium-desktop, chromium-dpr125 and chromium-phone.");
});

function symbolOf(page: Page, host: Host, icon: IconId) {
  return host === "desktop-shortcut"
    ? page.locator(`.desktop-icon-symbol[data-icon="${icon}"]`)
    : page.locator(`.start-panel-icon[data-icon="${icon}"]`);
}

// The element carrying `is-icon-animating`: the shortcut button / the start-panel button around the symbol.
function ownerOf(symbol: Locator) {
  return symbol.locator("xpath=..");
}

// Counts the pixels that differ between two PNGs in the page itself (no image library in the repo).
async function diffPixels(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(async ([first, second]) => {
    const decode = async (base64: string) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }), { colorSpaceConversion: "none" });
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, bitmap.width, bitmap.height);
    };
    const [left, right] = await Promise.all([decode(first), decode(second)]);
    if (left.width !== right.width || left.height !== right.height) return { size: `${left.width}x${left.height} vs ${right.width}x${right.height}`, pixels: -1 };
    let pixels = 0;
    for (let offset = 0; offset < left.data.length; offset += 4) {
      if (left.data[offset] !== right.data[offset] || left.data[offset + 1] !== right.data[offset + 1] || left.data[offset + 2] !== right.data[offset + 2] || left.data[offset + 3] !== right.data[offset + 3]) pixels += 1;
    }
    return { size: `${left.width}x${left.height}`, pixels };
  }, [a.toString("base64"), b.toString("base64")] as const);
}

// «editor» has no shortcut or start-panel host: clone an existing host and swap in the artwork of the source.
async function addSyntheticEditorHost(page: Page, host: Host) {
  const source = readFileSync(path.resolve("components/portia-icons.tsx"), "utf8");
  for (const d of editorPaths) expect(source, "editorPaths mirror components/portia-icons.tsx").toContain(`d="${d}"`);
  await page.evaluate(([where, paths]) => {
    const template = document.querySelector(where === "desktop-shortcut" ? '.desktop-icon:has(.desktop-icon-symbol[data-icon="info"])' : ".start-panel > button:has(.start-panel-icon)")!;
    const clone = template.cloneNode(true) as HTMLElement;
    clone.classList.remove("is-icon-animating");
    clone.setAttribute("data-synthetic", "editor");
    const symbol = clone.querySelector("[data-icon]")!;
    symbol.setAttribute("data-icon", "editor");
    const svg = symbol.querySelector("svg")!;
    svg.replaceChildren(...paths.map((d) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      return path;
    }));
    if (where === "desktop-shortcut") {
      clone.style.setProperty("--shortcut-left", "234px");
      clone.style.setProperty("--shortcut-top", "20px");
    }
    template.parentElement!.appendChild(clone);
  }, [host, editorPaths] as const);
}

async function openDesktop(page: Page) {
  const desktop = new DesktopPage(page);
  // A static backdrop: the translucent corners of the rounded symbol would otherwise pick up the live wallpaper and spider and show as a diff.
  await page.addInitScript(() => {
    window.localStorage.setItem("portia-desktop-settings-v1", JSON.stringify({ accent: "teal", wallpaper: "quiet", iconSize: "standard", motion: "on", spider: "off", customAccent: "" }));
  });
  // The clock is parked before load so the 700ms class timer cannot fire while a capture runs; the desktop mounts from a 0ms timer, so step it.
  await page.clock.pauseAt(new Date(Date.parse("2026-10-30T09:00:00+03:00") + 5_000));
  await page.goto("/");
  await expect(async () => {
    await page.clock.runFor(50);
    await expect(desktop.desktop).toBeVisible({ timeout: 250 });
  }).toPass({ timeout: 20_000 });
  return desktop;
}

for (const icon of icons) {
  for (const host of hosts) {
    test(`[STAB-MOTION-05] icon-rest ${icon} / ${host}: last cycle frame equals the frame after is-icon-animating is gone`, async ({ page }, testInfo) => {
      const real = host === "desktop-shortcut" ? desktopShortcuts.has(icon) : startPanelButtons.has(icon);
      const synthetic = !real && icon === "editor";
      test.skip(!real && !synthetic, `${icon} has no ${host} host in the public desktop`);
      await openDesktop(page);
      if (host === "start-panel") {
        await page.getByRole("button", { name: "PORTIA", exact: true }).click();
        await expect(page.locator(".start-panel")).toBeVisible();
      }
      if (synthetic) await addSyntheticEditorHost(page, host);

      const symbol = synthetic ? page.locator(`[data-synthetic="editor"] [data-icon="editor"]`) : symbolOf(page, host, icon);
      const owner = ownerOf(symbol);
      await expect(symbol).toBeVisible();

      // Trigger. Real hosts play from the focus handler (the same class as hover and touch); the synthetic host has no React handler.
      if (synthetic) await owner.evaluate((element) => element.classList.add("is-icon-animating"));
      else await owner.focus();
      await expect(owner).toHaveClass(/is-icon-animating/);

      // Park every cycle animation of this symbol on its last frame (1/1000 ms before the end, so fill-less cycles are still in force).
      const parked = await symbol.evaluate((element) => {
        const animations = element.getAnimations({ subtree: true }).filter((animation): animation is CSSAnimation => animation instanceof CSSAnimation && animation.animationName.startsWith("icon-"));
        for (const animation of animations) {
          animation.pause();
          animation.currentTime = Number(animation.effect!.getComputedTiming().endTime) - 0.001;
        }
        return animations.map((animation) => animation.animationName);
      });
      expect(parked.length, "cycle animations found on the symbol").toBeGreaterThan(0);
      // Hover/focus transitions (130ms) run in real time, so let them settle before the first capture.
      await page.waitForTimeout(400);
      const last = await symbol.screenshot({ animations: "allow", caret: "hide" });

      if (synthetic) await owner.evaluate((element) => element.classList.remove("is-icon-animating"));
      else await page.clock.runFor(800);
      await expect(owner).not.toHaveClass(/is-icon-animating/);
      await page.waitForTimeout(100); // two frames and more
      const rest = await symbol.screenshot({ animations: "allow", caret: "hide" });

      const { pixels, size } = await diffPixels(page, last, rest);
      const row = {
        icon,
        host,
        project: testInfo.project.name,
        synthetic,
        animations: parked,
        size,
        diffPixels: pixels,
        bytesEqual: last.equals(rest),
      };
      mkdirSync(resultRoot, { recursive: true });
      writeFileSync(path.join(resultRoot, `${icon}--${host}--${testInfo.project.name}.json`), `${JSON.stringify(row, null, 2)}\n`);
      if (pixels !== 0) {
        writeFileSync(path.join(resultRoot, `${icon}--${host}--${testInfo.project.name}--last.png`), last);
        writeFileSync(path.join(resultRoot, `${icon}--${host}--${testInfo.project.name}--rest.png`), rest);
      }
      testInfo.annotations.push({ type: "diff", description: `${pixels} px (${size})` });
      expect(pixels, `${icon}/${host}: pixels that differ between the last cycle frame and the resting frame`).toBe(0);
    });
  }
}
