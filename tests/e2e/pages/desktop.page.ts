import type { Locator, Page } from "@playwright/test";

export class DesktopPage {
  readonly page: Page;
  readonly desktop: Locator;
  readonly systemStatus: Locator;
  readonly assistant: Locator;
  readonly assistantShell: Locator;
  readonly spider: Locator;
  readonly spiderFrontLegs: Locator;
  readonly spiderRearLegs: Locator;
  readonly web: Locator;
  readonly webPulses: Locator;

  constructor(page: Page) {
    this.page = page;
    this.desktop = page.getByRole("navigation", { name: "Рабочий стол PORTIA" });
    this.systemStatus = page.getByLabel("Состояние системы");
    this.assistant = page.getByRole("button", { name: "Получить совет Вивьян" });
    this.assistantShell = page.locator(".desktop-assistant");
    this.spider = page.locator(".wallpaper-spider");
    this.spiderFrontLegs = this.spider.locator('[data-leg="L4"], [data-leg="R4"]');
    this.spiderRearLegs = this.spider.locator('[data-leg="L1"], [data-leg="R1"]');
    this.web = page.locator(".wallpaper-web");
    this.webPulses = page.locator(".wallpaper-web-pulses path");
  }

  async goto() {
    await this.page.goto("/");
    await this.desktop.waitFor();
  }

  shortcut(name: string) {
    return this.desktop.getByRole("button", { name, exact: true });
  }

  window(name: string) {
    return this.page.getByLabel(name, { exact: true });
  }

  async openApp(name: string) {
    await this.shortcut(name).click();
    await this.window(name).waitFor();
  }

  async closeApp(name: string) {
    await this.page.getByRole("button", { name: `Закрыть ${name}` }).click();
  }

  settingsGroup(name: string) {
    return this.window("Настройки").getByRole("heading", { name, exact: true }).locator("..");
  }

  setting(name: string, value: string) {
    return this.settingsGroup(name).getByRole("button", { name: value, exact: true });
  }

  async chooseSetting(name: string, value: string) {
    await this.setting(name, value).click();
  }
}
