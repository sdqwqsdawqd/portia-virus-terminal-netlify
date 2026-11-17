import type { Locator, Page } from "@playwright/test";
import { DesktopPage } from "./desktop.page";

export class PromotionPage {
  readonly page: Page;
  readonly desktop: DesktopPage;
  readonly window: Locator;
  readonly nickname: Locator;
  readonly checkNickname: Locator;

  constructor(page: Page) {
    this.page = page;
    this.desktop = new DesktopPage(page);
    this.window = page.getByLabel("Повышение", { exact: true });
    this.nickname = page.getByRole("textbox", {
      name: "Ник Roblox, указанный в таблице",
    });
    this.checkNickname = page.getByRole("button", { name: "ПРОВЕРИТЬ НИК" });
  }

  async open() {
    await this.desktop.openApp("Повышение");
  }

  heading(name: string | RegExp) {
    return this.window.getByRole("heading", { name });
  }

  alert() {
    return this.window.getByRole("alert");
  }
}
