import { chromium } from "file:///C:/Users/whoam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const apiURL = new URL(process.env.E2E_API_URL ?? "http://localhost:4000");
const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;
const screenshotDir = process.env.SCREENSHOT_DIR;
if (!email || !password) throw new Error("E2E credentials are required");
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function verify(viewport, name, storageState) {
  const context = await browser.newContext({ viewport, storageState });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const dashboardResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).host === apiURL.host &&
      new URL(response.url()).pathname === "/dashboard",
  );
  if (storageState) {
    await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
  } else {
    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Пароль").fill(password);
    await page.getByRole("button", { name: "Увійти" }).click();
    await page.waitForURL("**/dashboard");
  }
  const dashboard = await dashboardResponse;
  if (!dashboard.ok())
    throw new Error(`Dashboard API failed: ${dashboard.status()}`);
  await page.getByRole("heading", { name: "Сьогодні у студії" }).waitFor();
  await page.getByRole("heading", { name: "Викладачі" }).waitFor();
  await page.locator("section").first().getByText("Олександра Майлс").waitFor();
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, `${name}-dashboard.png`),
      fullPage: true,
    });
  const notificationTrigger = page.getByRole("button", {
    name: "Сповіщення",
  });
  await notificationTrigger.click();
  await page.locator('[role="menu"]').waitFor();
  await page.waitForTimeout(250);
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, `${name}-notifications.png`),
    });
  await page.keyboard.press("Escape");
  await page.locator('[role="menu"]').waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Активність" }).click();
  await page.getByRole("heading", { name: "Активність команди" }).waitFor();
  await page.waitForTimeout(250);
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, `${name}-activity.png`),
    });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Профіль користувача" }).click();
  await page.getByText(email, { exact: true }).waitFor();
  await page.getByRole("menuitem", { name: "Особистий профіль" }).waitFor();
  await page.keyboard.press("Escape");
  await page.goto(`${baseURL}/clients`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Клієнти" }).waitFor();
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, `${name}-clients.png`),
      fullPage: true,
    });
  await page.getByRole("button", { name: "Таблиця" }).click();
  await page.getByRole("table").waitFor();
  const firstClient = await page.locator('a[href^="/clients/"]').first().getAttribute("href");
  if (firstClient) {
    await page.goto(`${baseURL}${firstClient}`, { waitUntil: "networkidle" });
    await page.getByText("Динаміка відвідування", { exact: true }).waitFor();
    if (screenshotDir)
      await page.screenshot({
        path: join(screenshotDir, `${name}-client-details.png`),
        fullPage: true,
      });
  }
  await page.goto(`${baseURL}/courses`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Курси", exact: true }).waitFor();
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, `${name}-courses.png`),
      fullPage: true,
    });
  await page.goto(`${baseURL}/calendar`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Календар", exact: true }).waitFor();
  await page.getByRole("button", { name: "Місяць", exact: true }).waitFor();
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, `${name}-calendar-month.png`),
      fullPage: true,
    });
  await page.getByRole("button", { name: "День", exact: true }).click();
  await page.getByText("Вільні години:").waitFor();
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, `${name}-calendar.png`),
      fullPage: true,
    });
  await page.goto(`${baseURL}/subscriptions`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Абонементи" }).waitFor();
  await page.getByRole("heading", { name: "Завершуються" }).waitFor();
  await page.getByRole("heading", { name: "Активні" }).waitFor();
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, `${name}-subscriptions.png`),
      fullPage: true,
    });
  await page.goto(`${baseURL}/profile`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Особистий профіль" }).waitFor();
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, `${name}-profile.png`),
      fullPage: true,
    });
  await page.goto(`${baseURL}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Налаштування" }).waitFor();
  await page.getByText("Telegram-бот", { exact: true }).waitFor();
  if (errors.length)
    throw new Error(`${name} browser errors: ${errors.join(" | ")}`);
  const nextStorageState = await context.storageState();
  await context.close();
  return nextStorageState;
}

const storageState = await verify({ width: 1440, height: 1000 }, "desktop");
await verify({ width: 390, height: 844 }, "mobile", storageState);
await browser.close();
console.log("Desktop and mobile production smoke test passed");
