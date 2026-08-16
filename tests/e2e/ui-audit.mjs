import { chromium } from "file:///C:/Users/whoam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const apiURL = process.env.E2E_API_URL ?? "http://localhost:4000";
const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;
if (!email || !password) throw new Error("E2E credentials are required");

const routes = [
  "/dashboard",
  "/calendar",
  "/teachers",
  "/courses",
  "/clients",
  "/subscriptions",
  "/payments",
  "/charges",
  "/users",
  "/settings",
  "/profile",
];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const authContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const authPage = await authContext.newPage();
await authPage.goto(baseURL, { waitUntil: "networkidle" });
await authPage.getByLabel("Email").fill(email);
await authPage.getByLabel("Пароль").fill(password);
await authPage.getByRole("button", { name: "Увійти" }).click();
await authPage.waitForURL("**/dashboard");
const storageState = await authContext.storageState();
await authContext.close();

for (const viewport of [
  { width: 1440, height: 1000, name: "desktop" },
  { width: 390, height: 844, name: "mobile" },
]) {
  const context = await browser.newContext({ viewport, storageState });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(apiURL) && response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  for (const route of routes) {
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    if (page.url().endsWith("/"))
      throw new Error(
        `${viewport.name} ${route} redirected to ${page.url()}: ${errors.join(" | ")}`,
      );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1)
      throw new Error(`${viewport.name} ${route} has ${overflow}px body overflow`);
  }
  await page.goto(`${baseURL}/teachers`, { waitUntil: "networkidle" });
  const firstTeacher = await page
    .locator('a[href^="/teachers/"]')
    .first()
    .getAttribute("href");
  await page.goto(`${baseURL}/clients`, { waitUntil: "networkidle" });
  const firstClient = await page
    .locator('a[href^="/clients/"]')
    .first()
    .getAttribute("href");
  await page.goto(`${baseURL}/courses`, { waitUntil: "networkidle" });
  const firstCourse = await page
    .locator('a[href^="/courses/"]')
    .first()
    .getAttribute("href");
  for (const route of [firstTeacher, firstClient, firstCourse].filter(Boolean)) {
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1)
      throw new Error(`${viewport.name} ${route} has ${overflow}px body overflow`);
  }
  if (errors.length) throw new Error(`${viewport.name}: ${errors.join(" | ")}`);
  await context.close();
}

await browser.close();
console.log("All owner routes passed desktop and mobile UI audit");
