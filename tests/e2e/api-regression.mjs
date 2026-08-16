const baseURL = process.env.E2E_API_URL ?? "http://localhost:4000";
const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
if (!ownerEmail || !ownerPassword || !adminEmail || !adminPassword)
  throw new Error("E2E owner and admin credentials are required");

async function login(email, password) {
  const response = await fetch(`${baseURL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}

async function call(cookie, path, init = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie, ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function ok(cookie, path, init) {
  const result = await call(cookie, path, init);
  if (!result.response.ok)
    throw new Error(
      `${init?.method ?? "GET"} ${path}: ${result.response.status} ${result.body.message ?? ""}`,
    );
  return result.body;
}

async function expectStatus(cookie, path, status, init) {
  const result = await call(cookie, path, init);
  if (result.response.status !== status)
    throw new Error(
      `${init?.method ?? "GET"} ${path}: expected ${status}, got ${result.response.status}`,
    );
  return result.body;
}

const anonymous = await fetch(`${baseURL}/dashboard`);
if (anonymous.status !== 401)
  throw new Error(`Anonymous dashboard: expected 401, got ${anonymous.status}`);

const ownerCookie = await login(ownerEmail, ownerPassword);
const adminCookie = await login(adminEmail, adminPassword);
for (const path of ["/statistics", "/settings/telegram", "/admin/users", "/audit"])
  await expectStatus(adminCookie, path, 403);
await expectStatus(
  adminCookie,
  "/payments/not-a-real-payment/cancel",
  403,
  { method: "POST", body: JSON.stringify({ reason: "Перевірка прав" }) },
);
await expectStatus(ownerCookie, "/clients/not-a-real-client", 404);

const [client] = await ok(ownerCookie, "/clients");
const [teacher] = await ok(ownerCookie, "/teachers");
const [group] = await ok(ownerCookie, "/groups");
const stamp = Date.now();
const startsAt = new Date("2035-01-01T10:00:00.000Z");
startsAt.setUTCMinutes(startsAt.getUTCMinutes() + (stamp % 500_000));
const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
const product = await ok(ownerCookie, "/products", {
  method: "POST",
  body: JSON.stringify({
    name: `Разове регресія ${stamp}`,
    lessonsCount: 1,
    validityDays: 3,
    priceCents: 50000,
    tariffGroup: 99,
    isDropIn: false,
  }),
});
const subscription = await ok(ownerCookie, "/subscriptions", {
  method: "POST",
  body: JSON.stringify({
    clientId: client.id,
    productId: product.id,
    startDate: startsAt.toISOString(),
    teacherIds: [teacher.id],
    directionIds: [],
    groupIds: [],
  }),
});
const event = await ok(ownerCookie, "/events", {
  method: "POST",
  body: JSON.stringify({
    title: `Регресійне заняття ${stamp}`,
    type: "GROUP",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    teacherId: teacher.id,
    directionId: group.directionId,
    groupId: group.id,
  }),
});
await ok(ownerCookie, `/events/${event.id}/attendance/${client.id}`, {
  method: "PUT",
  body: JSON.stringify({ status: "PRESENT" }),
});
let subscriptions = await ok(ownerCookie, "/subscriptions");
let current = subscriptions.find((item) => item.id === subscription.id);
if (current?.remainingLessons !== 0 || current.status !== "USED")
  throw new Error("A one-lesson attendance did not use the subscription");
await ok(ownerCookie, `/events/${event.id}/attendance/${client.id}`, {
  method: "PUT",
  body: JSON.stringify({ status: "ABSENT" }),
});
subscriptions = await ok(ownerCookie, "/subscriptions");
current = subscriptions.find((item) => item.id === subscription.id);
if (current?.remainingLessons !== 1 || !["ACTIVE", "EXPIRING"].includes(current.status))
  throw new Error("Refunded attendance did not reactivate the subscription");
await ok(ownerCookie, `/events/${event.id}/attendance/${client.id}`, {
  method: "PUT",
  body: JSON.stringify({ status: "PRESENT" }),
});
await ok(ownerCookie, `/events/${event.id}/cancel`, {
  method: "POST",
  body: JSON.stringify({ reason: "Регресійна перевірка" }),
});
subscriptions = await ok(ownerCookie, "/subscriptions");
current = subscriptions.find((item) => item.id === subscription.id);
if (current?.remainingLessons !== 1 || !["ACTIVE", "EXPIRING"].includes(current.status))
  throw new Error("Cancelling an event did not restore the subscription");
await expectStatus(ownerCookie, `/events/${event.id}/cancel`, 409, {
  method: "POST",
  body: JSON.stringify({ reason: "Повторна перевірка" }),
});
await expectStatus(
  ownerCookie,
  `/events/${event.id}/attendance/${client.id}`,
  409,
  { method: "PUT", body: JSON.stringify({ status: "ABSENT" }) },
);
await expectStatus(ownerCookie, `/events/${event.id}/teacher-attendance`, 409, {
  method: "PUT",
  body: JSON.stringify({ status: "PRESENT" }),
});

const paidStart = new Date(endsAt.getTime() + 60 * 60 * 1000);
const paidEvent = await ok(ownerCookie, "/events", {
  method: "POST",
  body: JSON.stringify({
    title: `Оплата регресія ${stamp}`,
    type: "RENTAL",
    startsAt: paidStart.toISOString(),
    endsAt: new Date(paidStart.getTime() + 60 * 60 * 1000).toISOString(),
    priceCents: 10000,
    paymentMethod: "CARD",
    isPaid: true,
  }),
});
const payments = await ok(ownerCookie, "/payments");
const eventPayment = payments.find((payment) => payment.purpose === paidEvent.title);
if (!eventPayment || Math.abs(new Date(eventPayment.paidAt).getTime() - Date.now()) > 60_000)
  throw new Error("Paid event did not store the actual payment time");

console.log("API authorization and business-rule regression test passed");
