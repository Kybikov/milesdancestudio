const baseURL = process.env.E2E_API_URL ?? "http://localhost:4000";
const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;
if (!email || !password) throw new Error("E2E credentials are required");

async function request(path, init = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie, ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      `${init.method ?? "GET"} ${path}: ${response.status} ${body.message ?? ""}`,
    );
  return body;
}

const login = await fetch(`${baseURL}/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error(`Login failed: ${login.status}`);
const cookie = login.headers
  .getSetCookie()
  .map((value) => value.split(";", 1)[0])
  .join("; ");

const schedules = await request("/schedules");
const generatedEvents = await request(
  "/events?from=2026-08-16T00%3A00%3A00.000Z&to=2026-11-16T23%3A59%3A59.999Z",
);
const paymentsBefore = await request("/payments");
const stamp = Date.now();
const event = await request("/events", {
  method: "POST",
  body: JSON.stringify({
    title: `Оренда — перевірка ${stamp}`,
    type: "RENTAL",
    startsAt: "2031-01-15T10:00:00.000Z",
    endsAt: "2031-01-15T11:00:00.000Z",
    clientName: "Технічна перевірка",
    clientPhone: "+380000000000",
    priceCents: 75000,
    paymentMethod: "CARD",
    isPaid: true,
    lightCount: 1,
  }),
});
const paymentsAfter = await request("/payments");
const cancelled = await request(`/events/${event.id}/cancel`, {
  method: "POST",
  body: JSON.stringify({ reason: "Автоматична перевірка скасування" }),
});

if (!schedules.length) throw new Error("No regular schedules were seeded");
if (!generatedEvents.length)
  throw new Error("No recurring events were generated");
if (paymentsAfter.length !== paymentsBefore.length + 1)
  throw new Error("Paid event did not create a payment");
if (cancelled.status !== "CANCELLED")
  throw new Error("Event cancellation failed");
if (!cancelled.notification)
  throw new Error("Cancellation notification result is missing");

console.log(
  JSON.stringify({
    schedules: schedules.length,
    generatedEvents: generatedEvents.length,
    paidEventCreated: true,
    cancellationStatus: cancelled.status,
    telegram: cancelled.notification,
  }),
);
