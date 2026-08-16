const baseURL = process.env.E2E_API_URL ?? "http://localhost:4000";
const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
if (!ownerEmail || !ownerPassword) throw new Error("E2E owner credentials are required");

async function login(email, password) {
  const response = await fetch(`${baseURL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
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
    throw new Error(`${init?.method ?? "GET"} ${path}: ${result.response.status}`);
  return result.body;
}

const ownerCookie = await login(ownerEmail, ownerPassword);
const roles = await ok(ownerCookie, "/admin/roles");
const teacherRole = roles.roles.find((role) => role.code === "TEACHER");
const teachers = await ok(ownerCookie, "/teachers");
if (!teacherRole || teachers.length < 2) throw new Error("Teacher access fixtures are missing");
const existingUsers = await ok(ownerCookie, "/admin/users");
for (const user of existingUsers.filter((item) => item.email.startsWith("teacher-access-")))
  await ok(ownerCookie, `/admin/users/${user.id}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive: false, teacherId: null }),
  });
const linkedTeacherIds = new Set(
  existingUsers.filter((user) => !user.email.startsWith("teacher-access-")).map((user) => user.teacherId),
);
const selectedTeacher = teachers.find((teacher) => !linkedTeacherIds.has(teacher.id));
if (!selectedTeacher) throw new Error("No unlinked teacher profile is available");

const stamp = Date.now();
const email = `teacher-access-${stamp}@miles.local`;
const password = `Teacher-${stamp}-Access!`;
const createdUser = await ok(ownerCookie, "/admin/users", {
  method: "POST",
  body: JSON.stringify({
    email,
    password,
    displayName: selectedTeacher.name,
    teacherId: selectedTeacher.id,
    roleIds: [teacherRole.id],
  }),
});

const teacherCookie = await login(email, password);
const { user: me } = await ok(teacherCookie, "/auth/me");
if (me.teacherId !== selectedTeacher.id || !me.roles.includes("TEACHER"))
  throw new Error("Teacher account is not linked to the teacher profile");

for (const path of ["/statistics", "/settings/telegram", "/admin/users", "/audit", "/payments"])
  if ((await call(teacherCookie, path)).response.status !== 403)
    throw new Error(`Teacher unexpectedly has access to ${path}`);

const groups = await ok(teacherCookie, "/groups");
if (groups.some((group) => group.teacherId !== selectedTeacher.id))
  throw new Error("Teacher received another teacher's course");
const events = await ok(teacherCookie, "/events");
if (events.some((event) => event.teacherId !== selectedTeacher.id))
  throw new Error("Teacher received another teacher's event");
if (JSON.stringify(events).includes("priceCents"))
  throw new Error("Teacher event payload contains subscription prices");
const clients = await ok(teacherCookie, "/clients");
if (clients.some((client) => client.groups.some(({ group }) => group.teacherId !== selectedTeacher.id)))
  throw new Error("Teacher received another teacher's client group");
if (clients.some((client) => client._count.payments !== 0))
  throw new Error("Teacher received client payment counts");
const overview = await ok(teacherCookie, `/teachers/${selectedTeacher.id}/overview`);
if (overview.metrics.collectedCents !== 0)
  throw new Error("Teacher overview contains financial totals");
if (clients[0]) {
  const details = await ok(teacherCookie, `/clients/${clients[0].id}`);
  if (details.payments.length || details.charges.length || JSON.stringify(details).includes("priceCents"))
    throw new Error("Teacher client payload contains financial data");
}

const foreignEvent = (await ok(ownerCookie, "/events")).find(
  (event) => event.teacherId && event.teacherId !== selectedTeacher.id,
);
if (foreignEvent) {
  const result = await call(teacherCookie, `/events/${foreignEvent.id}/teacher-attendance`, {
    method: "PUT",
    body: JSON.stringify({ status: "PRESENT" }),
  });
  if (result.response.status !== 403)
    throw new Error(`Foreign attendance expected 403, got ${result.response.status}`);
}

await ok(ownerCookie, `/admin/users/${createdUser.id}`, {
  method: "PATCH",
  body: JSON.stringify({ isActive: false, teacherId: null }),
});

console.log("Teacher role scope and financial privacy test passed");
