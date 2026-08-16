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
  const dashboardResponse = page.waitForResponse((response) =>
    new URL(response.url()).host === apiURL.host &&
    new URL(response.url()).pathname === "/dashboard"
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
  await page
    .locator("section")
    .first()
    .getByText("Олександра Майлс")
    .waitFor();
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, `${name}-dashboard.png`),
      fullPage: true,
    });
  await page.goto(`${baseURL}/clients`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Клієнти" }).waitFor();
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, `${name}-clients.png`),
      fullPage: true,
    });
  await page.goto(`${baseURL}/calendar`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Календар залу" }).waitFor();
  await page.getByRole("button", { name: "День", exact: true }).click();
  await page.getByText("Вільно:").waitFor();
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, `${name}-calendar.png`),
      fullPage: true,
    });
  await page.goto(`${baseURL}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Налаштування" }).waitFor();
  await page.getByText("Telegram-бот").waitFor();
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
