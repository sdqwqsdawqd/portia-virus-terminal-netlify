import type { Locator, Page } from "@playwright/test";
import { DesktopPage } from "./desktop.page";

export class EditorPage {
  readonly page: Page;
  readonly desktop: DesktopPage;
  readonly settingsWindow: Locator;
  readonly openEditor: Locator;
  readonly signIn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.desktop = new DesktopPage(page);
    this.settingsWindow = page.getByLabel("Настройки", { exact: true });
    this.openEditor = this.settingsWindow.getByRole("button", {
      name: "ОТКРЫТЬ РЕДАКТОР",
    });
    this.signIn = this.settingsWindow.getByRole("link", {
      name: "ВОЙТИ В РЕДАКТОР",
    });
  }

  async openSettings() {
    await this.desktop.openApp("Настройки");
  }

  async gotoLogin() {
    await this.page.goto("/owner-login");
  }

  editorHeading() {
    return this.page.getByRole("heading", { name: "Редактор PORTIA" });
  }

  editorNavigation() {
    return this.page.getByRole("navigation", { name: "Разделы редактора" });
  }
}
