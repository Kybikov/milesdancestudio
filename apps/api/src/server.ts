import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "./db.js";
import { env } from "./env.js";
import { authPlugin, getSessionUser } from "./auth.js";
import { audit } from "./audit.js";
import { decryptSecret, encryptSecret } from "./security/crypto.js";
import {
  derivedSubscriptionStatus,
  inclusiveEndDate,
  subscriptionMatches,
} from "./domain/subscriptions.js";
import { generateScheduleEvents } from "./domain/schedules.js";
import {
  notifyActiveUsers,
  syncAllSubscriptionNotifications,
  syncSubscriptionNotifications,
} from "./notifications.js";

const app = Fastify({
  logger: { level: env.NODE_ENV === "production" ? "info" : "warn" },
  trustProxy: true,
});

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, {
  origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
  credentials: true,
});
await app.register(cookie);
await app.register(jwt, {
  secret: env.JWT_SECRET,
  cookie: { cookieName: "miles_session", signed: false },
});
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
await app.register(authPlugin);

const sessionCookie = {
  path: "/",
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  domain: env.COOKIE_DOMAIN || undefined,
  maxAge: 60 * 60 * 12,
};

app.get("/health", async () => ({
  status: "ok",
  service: "miles-api",
  timestamp: new Date().toISOString(),
}));
app.get("/ready", async (_request, reply) => {
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: "ready" };
  } catch {
    return reply.code(503).send({ status: "not-ready" });
  }
});

app.post(
  "/auth/login",
  { config: { rateLimit: { max: 8, timeWindow: "10 minutes" } } },
  async (request, reply) => {
    const input = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(request.body);
    const user = await db.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    const valid =
      user?.isActive &&
      (await argon2.verify(user.passwordHash, input.password));
    if (!valid || !user)
      return reply.code(401).send({ message: "Невірний email або пароль" });
    const token = await reply.jwtSign({ sub: user.id }, { expiresIn: "12h" });
    reply.setCookie("miles_session", token, sessionCookie);
    const sessionUser = await getSessionUser(user.id);
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "AUTH_LOGIN",
        entityType: "User",
        entityId: user.id,
        ip: request.ip,
      },
    });
    return { user: sessionUser, mustChangePassword: user.mustChangePassword };
  },
);

app.post(
  "/auth/logout",
  { preHandler: app.authenticate },
  async (request, reply) => {
    reply.clearCookie("miles_session", sessionCookie);
    await audit(request, "AUTH_LOGOUT", "User", request.sessionUser!.id);
    return { ok: true };
  },
);

app.get("/auth/me", { preHandler: app.authenticate }, async (request) => ({
  user: request.sessionUser,
}));

app.post(
  "/auth/change-password",
  { preHandler: app.authenticate },
  async (request, reply) => {
    const input = z
      .object({ currentPassword: z.string(), newPassword: z.string().min(12) })
      .parse(request.body);
    const user = await db.user.findUniqueOrThrow({
      where: { id: request.sessionUser!.id },
    });
    if (!(await argon2.verify(user.passwordHash, input.currentPassword)))
      return reply.code(400).send({ message: "Поточний пароль неправильний" });
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await argon2.hash(input.newPassword, {
          type: argon2.argon2id,
        }),
        mustChangePassword: false,
      },
    });
    await audit(request, "PASSWORD_CHANGED", "User", user.id);
    return { ok: true };
  },
);

app.patch(
  "/auth/profile",
  { preHandler: app.authenticate },
  async (request) => {
    const input = z
      .object({ displayName: z.string().trim().min(2).max(80) })
      .parse(request.body);
    const user = await db.user.update({
      where: { id: request.sessionUser!.id },
      data: input,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarPath: true,
        mustChangePassword: true,
      },
    });
    await audit(request, "UPDATE_PROFILE", "User", user.id, input);
    return user;
  },
);

app.get(
  "/dashboard",
  { preHandler: app.requirePermission("dashboard.read") },
  async () => {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [teachers, events, clients, activeSubscriptions, payments] =
      await Promise.all([
        db.teacher.findMany({
          where: { isActive: true },
          include: {
            directions: { include: { direction: true } },
            groups: { include: { _count: { select: { members: true } } } },
            events: {
              where: {
                startsAt: { gte: dayStart, lte: dayEnd },
                status: "SCHEDULED",
              },
            },
          },
          orderBy: { name: "asc" },
        }),
        db.calendarEvent.findMany({
          where: {
            startsAt: { gte: dayStart, lte: dayEnd },
            status: "SCHEDULED",
          },
          include: {
            teacher: true,
            direction: true,
            group: { include: { _count: { select: { members: true } } } },
          },
          orderBy: { startsAt: "asc" },
        }),
        db.client.count({ where: { isActive: true } }),
        db.subscription.count({
          where: { status: { in: ["ACTIVE", "EXPIRING"] } },
        }),
        db.payment.aggregate({
          where: { status: "CONFIRMED", paidAt: { gte: monthStart } },
          _sum: { amountCents: true },
        }),
      ]);
    return {
      teachers,
      events,
      metrics: {
        clients,
        activeSubscriptions,
        monthlyIncomeCents: payments._sum.amountCents ?? 0,
      },
    };
  },
);

app.get(
  "/teachers",
  { preHandler: app.requirePermission("teachers.read") },
  async () =>
    db.teacher.findMany({
      include: {
        directions: { include: { direction: true } },
        groups: {
          include: { direction: true, _count: { select: { members: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),
);
app.get(
  "/teachers/:id/overview",
  { preHandler: app.requirePermission("teachers.read") },
  async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const query = z
      .object({
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
      .parse(request.query);
    const from =
      query.from ?? new Date(new Date().setDate(new Date().getDate() - 90));
    const to = query.to ?? new Date();
    const [teacher, events, payments] = await Promise.all([
      db.teacher.findUniqueOrThrow({
        where: { id },
        include: {
          directions: { include: { direction: true } },
          groups: {
            include: {
              direction: true,
              members: { include: { client: true } },
            },
          },
        },
      }),
      db.calendarEvent.findMany({
        where: { teacherId: id, startsAt: { gte: from, lte: to } },
        include: {
          direction: true,
          group: true,
          attendances: true,
          teacherAttendance: true,
        },
        orderBy: { startsAt: "desc" },
      }),
      db.payment.findMany({
        where: {
          status: "CONFIRMED",
          paidAt: { gte: from, lte: to },
          OR: [
            { teacherId: id },
            { subscription: { teacherIds: { has: id } } },
          ],
        },
        select: { amountCents: true },
      }),
    ]);
    const students = new Set(
      teacher.groups.flatMap((group) =>
        group.members.map(({ client }) => client.id),
      ),
    );
    const completed = events.filter((event) => event.status === "COMPLETED");
    const present = events.filter(
      (event) => event.teacherAttendance?.status === "PRESENT",
    ).length;
    const absent = events.filter(
      (event) => event.teacherAttendance?.status === "ABSENT",
    ).length;
    return {
      teacher,
      range: { from, to },
      metrics: {
        students: students.size,
        scheduled: events.filter((event) => event.status === "SCHEDULED")
          .length,
        completed: completed.length,
        cancelled: events.filter((event) => event.status === "CANCELLED")
          .length,
        hours: completed.reduce(
          (sum, event) =>
            sum +
            (event.endsAt.getTime() - event.startsAt.getTime()) / 3_600_000,
          0,
        ),
        present,
        absent,
        attendanceRate:
          present + absent
            ? Math.round((present / (present + absent)) * 100)
            : 0,
        collectedCents: payments.reduce(
          (sum, payment) => sum + payment.amountCents,
          0,
        ),
        clientVisits: events.reduce(
          (sum, event) =>
            sum +
            event.attendances.filter((item) => item.status === "PRESENT")
              .length,
          0,
        ),
      },
      events: events.slice(0, 30),
    };
  },
);
app.post(
  "/teachers",
  { preHandler: app.requirePermission("teachers.write") },
  async (request) => {
    const input = z
      .object({
        name: z.string().min(2),
        color: z.string(),
        phone: z.string().optional(),
        instagram: z.string().optional(),
        comment: z.string().optional(),
        directionIds: z.array(z.string()).default([]),
      })
      .parse(request.body);
    const teacher = await db.teacher.create({
      data: {
        name: input.name,
        color: input.color,
        phone: input.phone,
        instagram: input.instagram,
        comment: input.comment,
        directions: {
          createMany: {
            data: input.directionIds.map((directionId) => ({ directionId })),
          },
        },
      },
    });
    await audit(request, "CREATE", "Teacher", teacher.id, input);
    return teacher;
  },
);
app.patch(
  "/teachers/:id",
  { preHandler: app.requirePermission("teachers.write") },
  async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z
      .object({
        name: z.string().min(2).optional(),
        color: z.string().optional(),
        phone: z.string().nullable().optional(),
        instagram: z.string().nullable().optional(),
        comment: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        directionIds: z.array(z.string()).optional(),
      })
      .parse(request.body);
    const { directionIds, ...data } = input;
    const teacher = await db.$transaction(async (tx) => {
      if (directionIds) {
        await tx.teacherDirection.deleteMany({ where: { teacherId: id } });
        await tx.teacherDirection.createMany({
          data: directionIds.map((directionId) => ({
            teacherId: id,
            directionId,
          })),
        });
      }
      return tx.teacher.update({ where: { id }, data });
    });
    await audit(request, "UPDATE", "Teacher", id, input);
    return teacher;
  },
);

app.get(
  "/directions",
  { preHandler: app.requirePermission("teachers.read") },
  async () =>
    db.direction.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
);
app.post(
  "/directions",
  { preHandler: app.requirePermission("teachers.write") },
  async (request) => {
    const input = z.object({ name: z.string().min(2) }).parse(request.body);
    const result = await db.direction.create({ data: input });
    await audit(request, "CREATE", "Direction", result.id, input);
    return result;
  },
);
app.patch(
  "/directions/:id",
  { preHandler: app.requirePermission("teachers.write") },
  async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z
      .object({
        name: z.string().min(2).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(request.body);
    const result = await db.direction.update({ where: { id }, data: input });
    await audit(request, "UPDATE", "Direction", id, input);
    return result;
  },
);

app.get(
  "/groups",
  { preHandler: app.requirePermission("teachers.read") },
  async () =>
    db.danceGroup.findMany({
      include: {
        teacher: true,
        direction: true,
        members: { include: { client: true } },
        schedules: true,
      },
      orderBy: { name: "asc" },
    }),
);
app.post(
  "/groups",
  { preHandler: app.requirePermission("teachers.write") },
  async (request) => {
    const input = z
      .object({
        name: z.string().min(2),
        level: z.string().optional(),
        teacherId: z.string(),
        directionId: z.string(),
      })
      .parse(request.body);
    const result = await db.danceGroup.create({ data: input });
    await audit(request, "CREATE", "DanceGroup", result.id, input);
    return result;
  },
);
app.patch(
  "/groups/:id",
  { preHandler: app.requirePermission("teachers.write") },
  async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z
      .object({
        name: z.string().min(2).optional(),
        level: z.string().nullable().optional(),
        teacherId: z.string().optional(),
        directionId: z.string().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(request.body);
    const result = await db.danceGroup.update({ where: { id }, data: input });
    await audit(request, "UPDATE", "DanceGroup", id, input);
    return result;
  },
);
app.post(
  "/groups/:id/members",
  { preHandler: app.requirePermission("clients.write") },
  async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({ clientId: z.string() }).parse(request.body);
    const result = await db.groupMember.upsert({
      where: { groupId_clientId: { groupId: id, clientId: input.clientId } },
      update: {},
      create: { groupId: id, clientId: input.clientId },
    });
    await audit(request, "ADD_MEMBER", "DanceGroup", id, input);
    return result;
  },
);
app.delete(
  "/groups/:id/members/:clientId",
  { preHandler: app.requirePermission("clients.write") },
  async (request) => {
    const { id, clientId } = z
      .object({ id: z.string(), clientId: z.string() })
      .parse(request.params);
    await db.groupMember.deleteMany({ where: { groupId: id, clientId } });
    await audit(request, "REMOVE_MEMBER", "DanceGroup", id, { clientId });
    return { ok: true };
  },
);

app.get(
  "/clients",
  { preHandler: app.requirePermission("clients.read") },
  async (request) => {
    const { search } = z
      .object({ search: z.string().optional() })
      .parse(request.query);
    return db.client.findMany({
      where: search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : undefined,
      include: {
        groups: {
          include: { group: { include: { teacher: true, direction: true } } },
        },
        subscriptions: { orderBy: { createdAt: "desc" } },
        _count: { select: { payments: true, attendances: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  },
);
app.get(
  "/clients/:id",
  { preHandler: app.requirePermission("clients.read") },
  async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return db.client.findUniqueOrThrow({
      where: { id },
      include: {
        groups: {
          include: { group: { include: { teacher: true, direction: true } } },
        },
        subscriptions: {
          include: {
            attendances: { include: { event: true } },
            payments: true,
          },
          orderBy: { createdAt: "desc" },
        },
        attendances: {
          include: {
            event: {
              include: {
                teacher: { select: { id: true, name: true } },
                direction: { select: { name: true } },
              },
            },
          },
          orderBy: { markedAt: "desc" },
        },
        payments: { orderBy: { paidAt: "desc" } },
        charges: { include: { charge: true } },
      },
    });
  },
);
app.post(
  "/clients",
  { preHandler: app.requirePermission("clients.write") },
  async (request) => {
    const input = z
      .object({
        firstName: z.string().min(2),
        lastName: z.string().min(2),
        phone: z.string().min(7),
        instagram: z.string().optional(),
        telegramChatId: z.string().optional(),
        comment: z.string().optional(),
      })
      .parse(request.body);
    const result = await db.client.create({ data: input });
    await audit(request, "CREATE", "Client", result.id, input);
    return result;
  },
);
app.patch(
  "/clients/:id",
  { preHandler: app.requirePermission("clients.write") },
  async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z
      .object({
        firstName: z.string().min(2).optional(),
        lastName: z.string().min(2).optional(),
        phone: z.string().min(7).optional(),
        instagram: z.string().nullable().optional(),
        telegramChatId: z.string().nullable().optional(),
        comment: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(request.body);
    const result = await db.client.update({ where: { id }, data: input });
    await audit(request, "UPDATE", "Client", id, input);
    return result;
  },
);

app.get(
  "/products",
  { preHandler: app.requirePermission("subscriptions.read") },
  async () =>
    db.product.findMany({
      orderBy: [{ tariffGroup: "asc" }, { priceCents: "asc" }],
    }),
);
app.post(
  "/products",
  { preHandler: app.requirePermission("settings.manage") },
  async (request) => {
    const input = z
      .object({
        name: z.string().min(2),
        lessonsCount: z.number().int().positive().nullable(),
        validityDays: z.number().int().positive().nullable(),
        priceCents: z.number().int().nonnegative(),
        tariffGroup: z.number().int().nullable().optional(),
        isDropIn: z.boolean().default(false),
        description: z.string().optional(),
      })
      .parse(request.body);
    const result = await db.product.create({ data: input });
    await audit(request, "CREATE", "Product", result.id, input);
    return result;
  },
);
app.patch(
  "/products/:id",
  { preHandler: app.requirePermission("settings.manage") },
  async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z
      .object({
        name: z.string().min(2).optional(),
        lessonsCount: z.number().int().positive().nullable().optional(),
        validityDays: z.number().int().positive().nullable().optional(),
        priceCents: z.number().int().nonnegative().optional(),
        isActive: z.boolean().optional(),
        description: z.string().nullable().optional(),
      })
      .parse(request.body);
    const result = await db.product.update({ where: { id }, data: input });
    await audit(request, "UPDATE", "Product", id, input);
    return result;
  },
);

app.get(
  "/subscriptions",
  { preHandler: app.requirePermission("subscriptions.read") },
  async () => {
    const subscriptions = await db.subscription.findMany({
      include: { client: true, product: true },
      orderBy: { createdAt: "desc" },
    });
    await Promise.all(
      subscriptions.map(async (subscription) => {
        const status = derivedSubscriptionStatus(subscription);
        const burnedLessons =
          status === "EXPIRED"
            ? subscription.remainingLessons
            : subscription.burnedLessons;
        if (
          status !== subscription.status ||
          burnedLessons !== subscription.burnedLessons
        )
          await db.subscription.update({
            where: { id: subscription.id },
            data: { status, burnedLessons },
          });
        Object.assign(subscription, { status, burnedLessons });
      }),
    );
    return subscriptions;
  },
);
app.post(
  "/subscriptions",
  { preHandler: app.requirePermission("subscriptions.write") },
  async (request, reply) => {
    const input = z
      .object({
        clientId: z.string(),
        productId: z.string(),
        startDate: z.coerce.date(),
        teacherIds: z.array(z.string()).default([]),
        directionIds: z.array(z.string()).default([]),
        groupIds: z.array(z.string()).default([]),
        payment: z
          .object({
            method: z.enum(["CASH", "CARD"]),
            amountCents: z.number().int().nonnegative(),
          })
          .optional(),
      })
      .parse(request.body);
    const product = await db.product.findUniqueOrThrow({
      where: { id: input.productId },
    });
    if (!product.lessonsCount || !product.validityDays)
      return reply.code(400).send({ message: "Продукт не є абонементом" });
    const result = await db.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          clientId: input.clientId,
          productId: product.id,
          productName: product.name,
          priceCents: product.priceCents,
          totalLessons: product.lessonsCount!,
          remainingLessons: product.lessonsCount!,
          startDate: input.startDate,
          endDate: inclusiveEndDate(input.startDate, product.validityDays!),
          teacherIds: input.teacherIds,
          directionIds: input.directionIds,
          groupIds: input.groupIds,
        },
      });
      if (input.payment)
        await tx.payment.create({
          data: {
            clientId: input.clientId,
            subscriptionId: subscription.id,
            teacherId:
              input.teacherIds.length === 1 ? input.teacherIds[0] : undefined,
            amountCents: input.payment.amountCents,
            category: product.isDropIn ? "DROP_IN" : "SUBSCRIPTION",
            method: input.payment.method,
            purpose: product.name,
            paidAt: new Date(),
            createdById: request.sessionUser!.id,
          },
        });
      return subscription;
    });
    await audit(request, "CREATE", "Subscription", result.id, input);
    const client = await db.client.findUniqueOrThrow({
      where: { id: input.clientId },
      select: { firstName: true, lastName: true },
    });
    await notifyActiveUsers({
      type: "ACTIVITY",
      title: "Абонемент оформлено",
      message: `${request.sessionUser!.displayName} оформив(ла) ${product.name} для ${client.firstName} ${client.lastName}`,
      link: `/clients/${input.clientId}`,
      dedupeKey: `subscription-created:${result.id}`,
    });
    if (input.payment)
      await notifyActiveUsers({
        type: "PAYMENT_SUCCESS",
        title: "Оплата успішна",
        message: `${client.firstName} ${client.lastName} · ${product.name}`,
        link: `/clients/${input.clientId}`,
        dedupeKey: `subscription-payment:${result.id}`,
      });
    return result;
  },
);

app.post(
  "/subscriptions/:id/renew",
  { preHandler: app.requirePermission("subscriptions.write") },
  async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z
      .object({
        startDate: z.coerce.date().default(() => new Date()),
        payment: z
          .object({
            method: z.enum(["CASH", "CARD"]),
            amountCents: z.number().int().nonnegative(),
          })
          .optional(),
      })
      .parse(request.body);
    const previous = await db.subscription.findUniqueOrThrow({
      where: { id },
      include: { product: true, client: true },
    });
    if (!previous.product?.lessonsCount || !previous.product.validityDays)
      return reply
        .code(400)
        .send({ message: "Для абонемента не знайдено активний продукт" });
    const product = previous.product;
    const result = await db.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          clientId: previous.clientId,
          productId: product.id,
          productName: product.name,
          priceCents: product.priceCents,
          totalLessons: product.lessonsCount!,
          remainingLessons: product.lessonsCount!,
          startDate: input.startDate,
          endDate: inclusiveEndDate(input.startDate, product.validityDays!),
          teacherIds: previous.teacherIds,
          directionIds: previous.directionIds,
          groupIds: previous.groupIds,
        },
      });
      if (input.payment)
        await tx.payment.create({
          data: {
            clientId: previous.clientId,
            subscriptionId: subscription.id,
            teacherId:
              previous.teacherIds.length === 1
                ? previous.teacherIds[0]
                : undefined,
            amountCents: input.payment.amountCents,
            category: product.isDropIn ? "DROP_IN" : "SUBSCRIPTION",
            method: input.payment.method,
            purpose: `Продовження · ${product.name}`,
            paidAt: new Date(),
            createdById: request.sessionUser!.id,
          },
        });
      return subscription;
    });
    await audit(request, "RENEW", "Subscription", result.id, {
      previousSubscriptionId: id,
      paid: Boolean(input.payment),
    });
    const clientName = `${previous.client.firstName} ${previous.client.lastName}`;
    await notifyActiveUsers({
      type: "ACTIVITY",
      title: "Абонемент продовжено",
      message: `${request.sessionUser!.displayName} продовжив(ла) ${product.name} для ${clientName}`,
      link: `/clients/${previous.clientId}`,
      dedupeKey: `subscription-renewed:${result.id}`,
    });
    if (input.payment)
      await notifyActiveUsers({
        type: "PAYMENT_SUCCESS",
        title: "Оплата успішна",
        message: `${clientName} · продовження ${product.name}`,
        link: `/clients/${previous.clientId}`,
        dedupeKey: `subscription-renewal-payment:${result.id}`,
      });
    return result;
  },
);

app.get(
  "/events",
  { preHandler: app.requirePermission("schedule.read") },
  async (request) => {
    const query = z
      .object({
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
      .parse(request.query);
    return db.calendarEvent.findMany({
      where:
        query.from || query.to
          ? { startsAt: { gte: query.from, lte: query.to } }
          : undefined,
      include: {
        teacher: true,
        direction: true,
        group: {
          include: {
            members: {
              include: { client: { include: { subscriptions: true } } },
            },
          },
        },
        attendances: true,
        teacherAttendance: true,
      },
      orderBy: { startsAt: "asc" },
    });
  },
);
app.get(
  "/schedules",
  { preHandler: app.requirePermission("schedule.read") },
  async () =>
    db.regularSchedule.findMany({
      include: { group: true, teacher: true, direction: true },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    }),
);
app.post(
  "/schedules",
  { preHandler: app.requirePermission("schedule.write") },
  async (request, reply) => {
    const input = z
      .object({
        groupId: z.string(),
        weekday: z.number().int().min(0).max(6),
        startMinute: z.number().int().min(0).max(1439),
        durationMin: z.number().int().min(15).max(240).default(60),
      })
      .parse(request.body);
    const group = await db.danceGroup.findUniqueOrThrow({
      where: { id: input.groupId },
    });
    const schedule = await db.regularSchedule.create({
      data: {
        ...input,
        teacherId: group.teacherId,
        directionId: group.directionId,
      },
    });
    const createdEvents = await generateScheduleEvents(schedule.id);
    await audit(request, "CREATE", "RegularSchedule", schedule.id, {
      ...input,
      createdEvents,
    });
    return reply.code(201).send({ ...schedule, createdEvents });
  },
);
app.patch(
  "/schedules/:id",
  { preHandler: app.requirePermission("schedule.write") },
  async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z
      .object({
        weekday: z.number().int().min(0).max(6).optional(),
        startMinute: z.number().int().min(0).max(1439).optional(),
        durationMin: z.number().int().min(15).max(240).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(request.body);
    const result = await db.regularSchedule.update({
      where: { id },
      data: input,
    });
    if (result.isActive) await generateScheduleEvents(result.id);
    await audit(request, "UPDATE", "RegularSchedule", id, input);
    return result;
  },
);
app.post(
  "/events",
  { preHandler: app.requirePermission("schedule.write") },
  async (request, reply) => {
    const input = z
      .object({
        title: z.string().min(2),
        type: z.enum(["GROUP", "INDIVIDUAL", "RENTAL", "SHOOTING", "OTHER"]),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date(),
        teacherId: z.string().optional(),
        directionId: z.string().optional(),
        groupId: z.string().optional(),
        clientName: z.string().optional(),
        clientPhone: z.string().optional(),
        priceCents: z.number().int().nonnegative().optional(),
        paymentMethod: z.enum(["CASH", "CARD"]).optional(),
        isPaid: z.boolean().default(false),
        lightCount: z.number().int().nonnegative().default(0),
        comment: z.string().optional(),
      })
      .parse(request.body);
    if (input.endsAt <= input.startsAt)
      return reply
        .code(400)
        .send({ message: "Час завершення має бути пізніше початку" });
    const conflict = await db.calendarEvent.findFirst({
      where: {
        status: "SCHEDULED",
        startsAt: { lt: input.endsAt },
        endsAt: { gt: input.startsAt },
      },
    });
    if (conflict)
      return reply
        .code(409)
        .send({ message: "Цей час уже зайнятий", conflict });
    if (input.isPaid && (!input.paymentMethod || !input.priceCents))
      return reply
        .code(400)
        .send({ message: "Для оплаченої події вкажіть суму та спосіб оплати" });
    const result = await db.$transaction(async (tx) => {
      const event = await tx.calendarEvent.create({ data: input });
      if (input.isPaid && input.paymentMethod && input.priceCents) {
        const category =
          input.type === "INDIVIDUAL"
            ? "INDIVIDUAL"
            : input.type === "RENTAL"
              ? "RENTAL"
              : input.type === "SHOOTING"
                ? "SHOOTING"
                : "OTHER";
        await tx.payment.create({
          data: {
            amountCents: input.priceCents,
            teacherId: input.teacherId,
            category,
            method: input.paymentMethod,
            purpose: input.title,
            paidAt: input.startsAt,
            createdById: request.sessionUser!.id,
          },
        });
      }
      return event;
    });
    await audit(request, "CREATE", "CalendarEvent", result.id, input);
    if (input.isPaid)
      await notifyActiveUsers({
        type: "PAYMENT_SUCCESS",
        title: "Оплата успішна",
        message: `${input.title} · оплату за подію отримано`,
        link: "/payments",
        dedupeKey: `event-payment:${result.id}`,
      });
    return result;
  },
);
app.post(
  "/events/:id/cancel",
  { preHandler: app.requirePermission("schedule.write") },
  async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({ reason: z.string().min(3) }).parse(request.body);
    const result = await db.$transaction(async (tx) => {
      const attendances = await tx.attendance.findMany({
        where: { eventId: id, deducted: true, subscriptionId: { not: null } },
      });
      for (const attendance of attendances) {
        await tx.subscription.update({
          where: { id: attendance.subscriptionId! },
          data: { remainingLessons: { increment: 1 } },
        });
        await tx.attendance.update({
          where: { id: attendance.id },
          data: { deducted: false },
        });
      }
      return tx.calendarEvent.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelReason: input.reason,
          cancelledAt: new Date(),
        },
        include: {
          group: { include: { members: { include: { client: true } } } },
        },
      });
    });
    const notification = await notifyCancelledEvent(
      result,
      input.reason,
      request.sessionUser!.id,
    );
    await audit(request, "CANCEL", "CalendarEvent", id, {
      ...input,
      telegram: notification,
    });
    await notifyActiveUsers({
      type: "ACTIVITY",
      title: "Заняття скасовано",
      message: `${result.title} · ${input.reason}`,
      link: "/calendar",
      dedupeKey: `event-cancelled:${id}`,
    });
    return { ...result, notification };
  },
);

app.post(
  "/events/:id/complete",
  { preHandler: app.requirePermission("attendance.write") },
  async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const event = await db.calendarEvent.findUniqueOrThrow({ where: { id } });
    if (event.status === "CANCELLED")
      return reply
        .code(409)
        .send({ message: "Скасоване заняття не можна завершити" });
    const result = await db.calendarEvent.update({
      where: { id },
      data: { status: "COMPLETED" },
    });
    await audit(request, "COMPLETE", "CalendarEvent", id);
    return result;
  },
);

app.put(
  "/events/:eventId/teacher-attendance",
  { preHandler: app.requirePermission("attendance.write") },
  async (request, reply) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const input = z
      .object({ status: z.enum(["PRESENT", "ABSENT"]) })
      .parse(request.body);
    const event = await db.calendarEvent.findUniqueOrThrow({
      where: { id: eventId },
      select: { teacherId: true, title: true },
    });
    if (!event.teacherId)
      return reply
        .code(409)
        .send({ message: "У події не призначено викладача" });
    const result = await db.teacherAttendance.upsert({
      where: { eventId },
      update: { status: input.status, markedAt: new Date() },
      create: { eventId, teacherId: event.teacherId, status: input.status },
    });
    await audit(
      request,
      "MARK_TEACHER_ATTENDANCE",
      "TeacherAttendance",
      result.id,
      {
        ...input,
        eventId,
      },
    );
    return result;
  },
);

app.put(
  "/events/:eventId/attendance/:clientId",
  { preHandler: app.requirePermission("attendance.write") },
  async (request, reply) => {
    const params = z
      .object({ eventId: z.string(), clientId: z.string() })
      .parse(request.params);
    const input = z
      .object({ status: z.enum(["PRESENT", "ABSENT"]) })
      .parse(request.body);
    const result = await db.$transaction(async (tx) => {
      const event = await tx.calendarEvent.findUniqueOrThrow({
        where: { id: params.eventId },
      });
      const existing = await tx.attendance.findUnique({
        where: { eventId_clientId: params },
      });
      if (existing?.status === input.status) return existing;
      if (existing?.deducted && existing.subscriptionId)
        await tx.subscription.update({
          where: { id: existing.subscriptionId },
          data: { remainingLessons: { increment: 1 } },
        });
      let subscriptionId: string | null = null;
      let deducted = false;
      if (input.status === "PRESENT") {
        const subscriptions = await tx.subscription.findMany({
          where: {
            clientId: params.clientId,
            status: { in: ["ACTIVE", "EXPIRING"] },
            remainingLessons: { gt: 0 },
            startDate: { lte: event.startsAt },
            endDate: { gte: event.startsAt },
          },
          orderBy: { endDate: "asc" },
        });
        const subscription = subscriptions.find((candidate) =>
          subscriptionMatches(candidate, event),
        );
        if (!subscription) return { error: "NO_SUBSCRIPTION" as const };
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            remainingLessons: { decrement: 1 },
            status: subscription.remainingLessons === 1 ? "USED" : undefined,
          },
        });
        subscriptionId = subscription.id;
        deducted = true;
      }
      return tx.attendance.upsert({
        where: { eventId_clientId: params },
        update: {
          status: input.status,
          subscriptionId,
          deducted,
          markedAt: new Date(),
        },
        create: { ...params, status: input.status, subscriptionId, deducted },
      });
    });
    if ("error" in result)
      return reply.code(409).send({
        message: "Немає відповідного активного абонемента",
        code: result.error,
      });
    await audit(request, "MARK_ATTENDANCE", "Attendance", result.id, input);
    return result;
  },
);

app.get(
  "/payments",
  { preHandler: app.requirePermission("payments.create") },
  async (request) => {
    const canSeeAll =
      request.sessionUser!.permissions.includes("finances.read");
    return db.payment.findMany({
      include: {
        client: true,
        createdBy: { select: { displayName: true } },
        cancelledBy: { select: { displayName: true } },
      },
      orderBy: { paidAt: "desc" },
      take: canSeeAll ? 500 : 100,
    });
  },
);
app.post(
  "/payments",
  { preHandler: app.requirePermission("payments.create") },
  async (request) => {
    const input = z
      .object({
        clientId: z.string().optional(),
        teacherId: z.string().optional(),
        amountCents: z.number().int().positive(),
        category: z.enum([
          "SUBSCRIPTION",
          "DROP_IN",
          "INDIVIDUAL",
          "RENTAL",
          "LIGHT",
          "SHOOTING",
          "OTHER",
        ]),
        method: z.enum(["CASH", "CARD"]),
        status: z.enum(["CONFIRMED", "FAILED"]).default("CONFIRMED"),
        purpose: z.string().min(2),
        paidAt: z.coerce.date().default(() => new Date()),
      })
      .parse(request.body);
    const result = await db.payment.create({
      data: { ...input, createdById: request.sessionUser!.id },
    });
    await audit(request, "CREATE", "Payment", result.id, input);
    const client = input.clientId
      ? await db.client.findUnique({
          where: { id: input.clientId },
          select: { firstName: true, lastName: true },
        })
      : null;
    await notifyActiveUsers({
      type: input.status === "CONFIRMED" ? "PAYMENT_SUCCESS" : "PAYMENT_FAILED",
      title:
        input.status === "CONFIRMED" ? "Оплата успішна" : "Оплата неуспішна",
      message: `${client ? `${client.firstName} ${client.lastName} · ` : ""}${input.purpose}`,
      link: "/payments",
      dedupeKey: `payment:${result.id}:${input.status}`,
    });
    return result;
  },
);
app.post(
  "/payments/:id/cancel",
  { preHandler: app.requirePermission("payments.cancel") },
  async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({ reason: z.string().min(3) }).parse(request.body);
    const payment = await db.payment.findUniqueOrThrow({ where: { id } });
    if (payment.status === "CANCELLED")
      return reply.code(409).send({ message: "Платіж уже скасовано" });
    const result = await db.payment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelReason: input.reason,
        cancelledAt: new Date(),
        cancelledById: request.sessionUser!.id,
      },
    });
    await audit(request, "CANCEL", "Payment", id, input);
    await notifyActiveUsers({
      type: "PAYMENT_FAILED",
      title: "Оплату скасовано",
      message: `${payment.purpose} · ${input.reason}`,
      link: "/payments",
      dedupeKey: `payment-cancelled:${id}`,
    });
    return result;
  },
);

app.get(
  "/statistics",
  { preHandler: app.requirePermission("finances.read") },
  async (request) => {
    const query = z
      .object({
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
      .parse(request.query);
    const from =
      query.from ??
      new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = query.to ?? new Date();
    const where = {
      status: "CONFIRMED" as const,
      paidAt: { gte: from, lte: to },
    };
    const [
      payments,
      categories,
      methods,
      subscriptions,
      attendance,
      events,
      paymentRows,
      eventRows,
      teachers,
      clients,
    ] = await Promise.all([
      db.payment.aggregate({
        where,
        _sum: { amountCents: true },
        _count: true,
      }),
      db.payment.groupBy({
        by: ["category"],
        where,
        _sum: { amountCents: true },
        _count: true,
      }),
      db.payment.groupBy({
        by: ["method"],
        where,
        _sum: { amountCents: true },
        _count: true,
      }),
      db.subscription.groupBy({ by: ["status"], _count: true }),
      db.attendance.groupBy({ by: ["status"], _count: true }),
      db.calendarEvent.groupBy({
        by: ["type"],
        where: { startsAt: { gte: from, lte: to } },
        _count: true,
      }),
      db.payment.findMany({
        where,
        include: {
          subscription: { select: { teacherIds: true } },
          createdBy: { select: { id: true, displayName: true } },
        },
      }),
      db.calendarEvent.findMany({
        where: { startsAt: { gte: from, lte: to } },
        include: { attendances: true, teacherAttendance: true },
      }),
      db.teacher.findMany({
        where: { isActive: true },
        include: {
          groups: { include: { members: { select: { clientId: true } } } },
        },
        orderBy: { name: "asc" },
      }),
      db.client.findMany({
        where: { isActive: true },
        include: { subscriptions: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);
    const dayMap = new Map<
      string,
      { date: string; incomeCents: number; events: number; visits: number }
    >();
    const ensureDay = (value: Date) => {
      const date = value.toISOString().slice(0, 10);
      const current = dayMap.get(date) ?? {
        date,
        incomeCents: 0,
        events: 0,
        visits: 0,
      };
      dayMap.set(date, current);
      return current;
    };
    for (const payment of paymentRows)
      ensureDay(payment.paidAt).incomeCents += payment.amountCents;
    for (const event of eventRows) {
      const day = ensureDay(event.startsAt);
      day.events += event.status !== "CANCELLED" ? 1 : 0;
      day.visits += event.attendances.filter(
        (item) => item.status === "PRESENT",
      ).length;
    }
    const teacherStats = teachers.map((teacher) => {
      const ownEvents = eventRows.filter(
        (event) => event.teacherId === teacher.id,
      );
      const present = ownEvents.filter(
        (event) => event.teacherAttendance?.status === "PRESENT",
      ).length;
      const absent = ownEvents.filter(
        (event) => event.teacherAttendance?.status === "ABSENT",
      ).length;
      return {
        id: teacher.id,
        name: teacher.name,
        color: teacher.color,
        students: new Set(
          teacher.groups.flatMap((group) =>
            group.members.map((member) => member.clientId),
          ),
        ).size,
        events: ownEvents.filter((event) => event.status !== "CANCELLED")
          .length,
        completed: ownEvents.filter((event) => event.status === "COMPLETED")
          .length,
        present,
        absent,
        clientVisits: ownEvents.reduce(
          (sum, event) =>
            sum +
            event.attendances.filter((item) => item.status === "PRESENT")
              .length,
          0,
        ),
        collectedCents: paymentRows
          .filter(
            (payment) =>
              payment.teacherId === teacher.id ||
              payment.subscription?.teacherIds.includes(teacher.id),
          )
          .reduce((sum, payment) => sum + payment.amountCents, 0),
      };
    });
    const clientStats = clients.map((client) => {
      const visits = eventRows.flatMap((event) =>
        event.attendances.filter((item) => item.clientId === client.id),
      );
      const confirmedPayments = paymentRows.filter(
        (payment) => payment.clientId === client.id,
      );
      return {
        id: client.id,
        name: `${client.firstName} ${client.lastName}`,
        present: visits.filter((item) => item.status === "PRESENT").length,
        absent: visits.filter((item) => item.status === "ABSENT").length,
        paidCents: confirmedPayments.reduce(
          (sum, payment) => sum + payment.amountCents,
          0,
        ),
        activeSubscriptions: client.subscriptions.filter((subscription) =>
          ["ACTIVE", "EXPIRING"].includes(subscription.status),
        ).length,
      };
    });
    const collectorMap = new Map<
      string,
      { id: string; name: string; payments: number; amountCents: number }
    >();
    for (const payment of paymentRows) {
      const current = collectorMap.get(payment.createdBy.id) ?? {
        id: payment.createdBy.id,
        name: payment.createdBy.displayName,
        payments: 0,
        amountCents: 0,
      };
      current.payments += 1;
      current.amountCents += payment.amountCents;
      collectorMap.set(current.id, current);
    }
    return {
      range: { from, to },
      payments,
      categories,
      methods,
      subscriptions,
      attendance,
      events,
      trend: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      teacherStats,
      clientStats,
      collectorStats: [...collectorMap.values()].sort(
        (a, b) => b.amountCents - a.amountCents,
      ),
    };
  },
);

app.get(
  "/extra-charges",
  { preHandler: app.requirePermission("charges.write") },
  async () =>
    db.extraCharge.findMany({
      include: { clients: { include: { client: true } } },
      orderBy: { eventDate: "desc" },
    }),
);
app.post(
  "/extra-charges",
  { preHandler: app.requirePermission("charges.write") },
  async (request) => {
    const input = z
      .object({
        title: z.string().min(2),
        eventDate: z.coerce.date(),
        amountCents: z.number().int().positive(),
        comment: z.string().optional(),
        clientIds: z.array(z.string()).min(1),
      })
      .parse(request.body);
    const result = await db.extraCharge.create({
      data: {
        title: input.title,
        eventDate: input.eventDate,
        amountCents: input.amountCents,
        comment: input.comment,
        clients: {
          createMany: {
            data: input.clientIds.map((clientId) => ({
              clientId,
              amountCents: input.amountCents,
            })),
          },
        },
      },
    });
    await audit(request, "CREATE", "ExtraCharge", result.id, input);
    return result;
  },
);
app.patch(
  "/client-charges/:id",
  { preHandler: app.requirePermission("charges.write") },
  async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z
      .object({ paidCents: z.number().int().nonnegative() })
      .parse(request.body);
    const current = await db.clientCharge.findUniqueOrThrow({ where: { id } });
    const status =
      input.paidCents <= 0
        ? "UNPAID"
        : input.paidCents >= current.amountCents
          ? "PAID"
          : "PARTIAL";
    const result = await db.clientCharge.update({
      where: { id },
      data: { paidCents: input.paidCents, status },
    });
    await audit(request, "UPDATE", "ClientCharge", id, input);
    return result;
  },
);

app.get(
  "/admin/users",
  { preHandler: app.requirePermission("users.manage") },
  async () =>
    db.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarPath: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        roles: { include: { role: true } },
      },
      orderBy: { displayName: "asc" },
    }),
);
app.post(
  "/admin/users",
  { preHandler: app.requirePermission("users.manage") },
  async (request) => {
    const input = z
      .object({
        email: z.string().email(),
        displayName: z.string().min(2),
        password: z.string().min(12),
        roleIds: z.array(z.string()).min(1),
      })
      .parse(request.body);
    const result = await db.user.create({
      data: {
        email: input.email.toLowerCase(),
        displayName: input.displayName,
        passwordHash: await argon2.hash(input.password, {
          type: argon2.argon2id,
        }),
        roles: {
          createMany: { data: input.roleIds.map((roleId) => ({ roleId })) },
        },
      },
    });
    await audit(request, "CREATE", "User", result.id, input);
    return { id: result.id };
  },
);
app.get(
  "/admin/roles",
  { preHandler: app.requirePermission("users.manage") },
  async () => ({
    roles: await db.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    }),
    permissions: await db.permission.findMany({ orderBy: { code: "asc" } }),
  }),
);
app.put(
  "/admin/roles/:id/permissions",
  { preHandler: app.requirePermission("users.manage") },
  async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z
      .object({ permissionIds: z.array(z.string()) })
      .parse(request.body);
    const role = await db.role.findUniqueOrThrow({ where: { id } });
    if (role.code === "OWNER")
      return reply
        .code(400)
        .send({ message: "Системні дозволи OWNER не можна звужувати" });
    await db.$transaction([
      db.rolePermission.deleteMany({ where: { roleId: id } }),
      db.rolePermission.createMany({
        data: input.permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      }),
    ]);
    await audit(request, "UPDATE_PERMISSIONS", "Role", id, input);
    return { ok: true };
  },
);

app.get(
  "/settings/telegram",
  { preHandler: app.requirePermission("settings.manage") },
  async () => {
    const [token, defaultChat] = await Promise.all([
      db.setting.findUnique({ where: { key: "telegram.botToken" } }),
      db.setting.findUnique({ where: { key: "telegram.defaultChatId" } }),
    ]);
    return {
      configured: !!token,
      maskedToken: token
        ? "••••••••" + decryptSecret(token.value).slice(-6)
        : null,
      defaultChatId: defaultChat?.value ?? "",
    };
  },
);
app.put(
  "/settings/telegram",
  { preHandler: app.requirePermission("settings.manage") },
  async (request) => {
    const input = z
      .object({
        token: z.string().min(20).optional(),
        defaultChatId: z.string().optional(),
      })
      .parse(request.body);
    if (input.token)
      await db.setting.upsert({
        where: { key: "telegram.botToken" },
        update: { value: encryptSecret(input.token), encrypted: true },
        create: {
          key: "telegram.botToken",
          value: encryptSecret(input.token),
          encrypted: true,
        },
      });
    if (input.defaultChatId !== undefined)
      await db.setting.upsert({
        where: { key: "telegram.defaultChatId" },
        update: { value: input.defaultChatId },
        create: { key: "telegram.defaultChatId", value: input.defaultChatId },
      });
    await audit(request, "UPDATE", "Setting", "telegram", {
      defaultChatId: input.defaultChatId,
      tokenChanged: !!input.token,
    });
    return { ok: true };
  },
);
app.delete(
  "/settings/telegram/token",
  { preHandler: app.requirePermission("settings.manage") },
  async (request) => {
    await db.setting.deleteMany({ where: { key: "telegram.botToken" } });
    await audit(request, "DELETE", "Setting", "telegram.botToken");
    return { ok: true };
  },
);
app.post(
  "/settings/telegram/test",
  { preHandler: app.requirePermission("settings.manage") },
  async (request, reply) => {
    const input = z
      .object({ chatId: z.string().optional() })
      .parse(request.body ?? {});
    const [tokenSetting, chatSetting] = await Promise.all([
      db.setting.findUnique({ where: { key: "telegram.botToken" } }),
      db.setting.findUnique({ where: { key: "telegram.defaultChatId" } }),
    ]);
    if (!tokenSetting)
      return reply
        .code(400)
        .send({ message: "Токен Telegram не налаштований" });
    const chatId = input.chatId || chatSetting?.value;
    if (!chatId) return reply.code(400).send({ message: "Вкажіть chat ID" });
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${decryptSecret(tokenSetting.value)}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Miles Dance Studio: Telegram успішно підключено ✅",
          }),
        },
      );
      if (!response.ok) throw new Error(`Telegram API ${response.status}`);
      await db.telegramLog.create({
        data: { actorId: request.sessionUser!.id, chatId, success: true },
      });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Telegram error";
      await db.telegramLog.create({
        data: {
          actorId: request.sessionUser!.id,
          chatId,
          success: false,
          error: message,
        },
      });
      return reply.code(502).send({ message });
    }
  },
);

app.get(
  "/audit",
  { preHandler: app.requirePermission("audit.read") },
  async () =>
    db.auditLog.findMany({
      include: { actor: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
);

app.get("/activity", { preHandler: app.authenticate }, async () =>
  db.auditLog.findMany({
    include: { actor: { select: { displayName: true, avatarPath: true } } },
    orderBy: { createdAt: "desc" },
    take: 80,
  }),
);

app.get("/notifications", { preHandler: app.authenticate }, async (request) => {
  await syncSubscriptionNotifications(request.sessionUser!.id);
  const notifications = await db.notification.findMany({
    where: { recipientId: request.sessionUser!.id },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return {
    unread: notifications.filter((notification) => !notification.readAt).length,
    notifications,
  };
});

app.put(
  "/notifications/:id/read",
  { preHandler: app.authenticate },
  async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return db.notification.updateMany({
      where: { id, recipientId: request.sessionUser!.id },
      data: { readAt: new Date() },
    });
  },
);

app.post(
  "/notifications/read-all",
  { preHandler: app.authenticate },
  async (request) =>
    db.notification.updateMany({
      where: { recipientId: request.sessionUser!.id, readAt: null },
      data: { readAt: new Date() },
    }),
);

app.get("/push/config", { preHandler: app.authenticate }, async (request) => ({
  enabled: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
  publicKey: env.VAPID_PUBLIC_KEY || null,
  subscriptions: await db.pushSubscription.count({
    where: { userId: request.sessionUser!.id },
  }),
}));

app.post(
  "/push/subscribe",
  { preHandler: app.authenticate },
  async (request, reply) => {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY)
      return reply.code(503).send({ message: "Web Push ще не налаштовано" });
    const input = z
      .object({
        endpoint: z.string().url(),
        keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
      })
      .parse(request.body);
    await db.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      update: {
        userId: request.sessionUser!.id,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
      create: {
        userId: request.sessionUser!.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
    });
    return { ok: true };
  },
);

app.delete(
  "/push/subscriptions",
  { preHandler: app.authenticate },
  async (request) => {
    await db.pushSubscription.deleteMany({
      where: { userId: request.sessionUser!.id },
    });
    return { ok: true };
  },
);

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof z.ZodError)
    return reply
      .code(400)
      .send({ message: "Перевірте введені дані", issues: error.issues });
  app.log.error(error);
  return reply
    .code((error as { statusCode?: number }).statusCode ?? 500)
    .send({ message: "Не вдалося виконати операцію" });
});

const notificationTimer = setInterval(
  () => {
    syncAllSubscriptionNotifications().catch((error) => app.log.error(error));
  },
  15 * 60 * 1000,
);
notificationTimer.unref();
syncAllSubscriptionNotifications().catch((error) => app.log.error(error));

const close = async () => {
  clearInterval(notificationTimer);
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", close);
process.on("SIGINT", close);

async function notifyCancelledEvent(
  event: {
    title: string;
    startsAt: Date;
    group: { members: { client: { telegramChatId: string | null } }[] } | null;
  },
  reason: string,
  actorId: string,
) {
  const recipients = [
    ...new Set(
      event.group?.members
        .map(({ client }) => client.telegramChatId)
        .filter((chatId): chatId is string => Boolean(chatId)) ?? [],
    ),
  ];
  if (!recipients.length)
    return { sent: 0, failed: 0, skipped: "no-recipients" };
  const tokenSetting = await db.setting.findUnique({
    where: { key: "telegram.botToken" },
  });
  if (!tokenSetting) return { sent: 0, failed: 0, skipped: "not-configured" };
  const token = decryptSecret(tokenSetting.value);
  const when = new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Kyiv",
  }).format(event.startsAt);
  const message = `Miles Dance Studio\nЗаняття «${event.title}» ${when} скасовано.\nПричина: ${reason}`;
  const results = await Promise.all(
    recipients.map(async (chatId) => {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: message }),
          },
        );
        if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
        await db.telegramLog.create({
          data: { actorId, chatId, success: true },
        });
        return true;
      } catch (error) {
        await db.telegramLog.create({
          data: {
            actorId,
            chatId,
            success: false,
            error: error instanceof Error ? error.message : "Telegram error",
          },
        });
        return false;
      }
    }),
  );
  return {
    sent: results.filter(Boolean).length,
    failed: results.filter((result) => !result).length,
  };
}

await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
