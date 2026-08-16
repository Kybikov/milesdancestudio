import { PrismaClient, PaymentCategory, PaymentMethod } from "@prisma/client";
import argon2 from "argon2";
import { addDays, startOfDay } from "date-fns";
import { env } from "../src/env.js";
import { inclusiveEndDate } from "../src/domain/subscriptions.js";
import { generateScheduleEvents } from "../src/domain/schedules.js";

const db = new PrismaClient();

const permissionDefinitions = [
  ["dashboard.read", "Перегляд операційної головної"],
  ["clients.read", "Перегляд клієнтів"],
  ["clients.write", "Створення та зміна клієнтів"],
  ["teachers.read", "Перегляд викладачів і груп"],
  ["teachers.write", "Керування викладачами, напрямками та групами"],
  ["schedule.read", "Перегляд календаря"],
  ["schedule.write", "Керування календарем і скасуваннями"],
  ["subscriptions.read", "Перегляд абонементів"],
  ["subscriptions.write", "Оформлення абонементів"],
  ["attendance.write", "Відмітка відвідувань"],
  ["payments.create", "Створення платежів"],
  ["finances.read", "Перегляд повної фінансової статистики"],
  ["payments.cancel", "Скасування платежів"],
  ["charges.write", "Керування додатковими зборами"],
  ["settings.manage", "Керування системними налаштуваннями"],
  ["users.manage", "Керування користувачами, ролями й дозволами"],
  ["audit.read", "Перегляд журналу аудиту"],
] as const;

const adminPermissionCodes = permissionDefinitions
  .map(([code]) => code)
  .filter(
    (code) =>
      ![
        "finances.read",
        "payments.cancel",
        "settings.manage",
        "users.manage",
        "audit.read",
      ].includes(code),
  );

async function main() {
  for (const [code, description] of permissionDefinitions) {
    await db.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description },
    });
  }

  const ownerRole = await db.role.upsert({
    where: { code: "OWNER" },
    update: { name: "Власниця", isSystem: true },
    create: {
      code: "OWNER",
      name: "Власниця",
      description: "Повний доступ",
      isSystem: true,
    },
  });
  const adminRole = await db.role.upsert({
    where: { code: "ADMIN" },
    update: { name: "Адміністратор", isSystem: true },
    create: {
      code: "ADMIN",
      name: "Адміністратор",
      description: "Щоденна операційна робота",
      isSystem: true,
    },
  });

  const permissions = await db.permission.findMany();
  await db.rolePermission.deleteMany({
    where: { roleId: { in: [ownerRole.id, adminRole.id] } },
  });
  await db.rolePermission.createMany({
    data: [
      ...permissions.map((permission) => ({
        roleId: ownerRole.id,
        permissionId: permission.id,
      })),
      ...permissions
        .filter((permission) =>
          adminPermissionCodes.includes(permission.code as never),
        )
        .map((permission) => ({
          roleId: adminRole.id,
          permissionId: permission.id,
        })),
    ],
    skipDuplicates: true,
  });

  const owner = await db.user.upsert({
    where: { email: env.OWNER_EMAIL.toLowerCase() },
    update: {
      displayName: "Олександра Майлс",
      avatarPath: "/owner-avatar.png",
      isActive: true,
    },
    create: {
      email: env.OWNER_EMAIL.toLowerCase(),
      displayName: "Олександра Майлс",
      avatarPath: "/owner-avatar.png",
      passwordHash: await argon2.hash(env.OWNER_PASSWORD, {
        type: argon2.argon2id,
      }),
    },
  });
  const admin = await db.user.upsert({
    where: { email: env.ADMIN_EMAIL.toLowerCase() },
    update: { displayName: "Адміністратор Miles", isActive: true },
    create: {
      email: env.ADMIN_EMAIL.toLowerCase(),
      displayName: "Адміністратор Miles",
      passwordHash: await argon2.hash(env.ADMIN_PASSWORD, {
        type: argon2.argon2id,
      }),
    },
  });
  await db.userRole.createMany({
    data: [
      { userId: owner.id, roleId: ownerRole.id },
      { userId: admin.id, roleId: adminRole.id },
    ],
    skipDuplicates: true,
  });

  const directionNames = [
    "Latina Solo",
    "K-Pop",
    "Stretching",
    "Contemporary",
    "Jazz Funk & Choreo",
    "High Heels",
  ];
  const directionMap = new Map<string, string>();
  for (const name of directionNames) {
    const direction = await db.direction.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    directionMap.set(name, direction.id);
  }

  const teacherDefinitions = [
    ["Вероніка Межуєва", "#ec4899", ["Latina Solo"]],
    ["Юлія Боднар", "#8b5cf6", ["K-Pop"]],
    ["Ольга Мільто", "#38bdf8", ["Stretching"]],
    ["Віта Терпак", "#f59e0b", ["Contemporary"]],
    ["Софія Якименко", "#a855f7", ["Jazz Funk & Choreo", "High Heels"]],
    ["Катя Самойлова", "#fb7185", ["Jazz Funk & Choreo"]],
    ["Олександра Майлс", "#e11d48", ["Jazz Funk & Choreo", "High Heels"]],
  ] as const;
  const teacherMap = new Map<string, string>();
  for (const [name, color, teacherDirections] of teacherDefinitions) {
    const teacher = await db.teacher.upsert({
      where: { name },
      update: {
        color,
        avatarPath:
          name === "Олександра Майлс" ? "/owner-avatar.png" : undefined,
      },
      create: {
        name,
        color,
        avatarPath:
          name === "Олександра Майлс" ? "/owner-avatar.png" : undefined,
      },
    });
    teacherMap.set(name, teacher.id);
    for (const directionName of teacherDirections) {
      await db.teacherDirection.upsert({
        where: {
          teacherId_directionId: {
            teacherId: teacher.id,
            directionId: directionMap.get(directionName)!,
          },
        },
        update: {},
        create: {
          teacherId: teacher.id,
          directionId: directionMap.get(directionName)!,
        },
      });
    }
  }

  const schedules = [
    [
      "Latina Solo — Початківці",
      "Початківці",
      "Latina Solo",
      "Вероніка Межуєва",
      [2, 4],
      "18:00",
    ],
    ["K-Pop", "Не вказано", "K-Pop", "Юлія Боднар", [1, 5], "17:00"],
    [
      "Stretching — Усі рівні",
      "Усі рівні",
      "Stretching",
      "Ольга Мільто",
      [2, 4],
      "09:00",
    ],
    [
      "Contemporary — Початківці",
      "Початківці",
      "Contemporary",
      "Віта Терпак",
      [2, 4],
      "16:00",
    ],
    [
      "Jazz Funk — Софія",
      "Початківці",
      "Jazz Funk & Choreo",
      "Софія Якименко",
      [2, 4],
      "17:00",
    ],
    [
      "Jazz Funk — Катя",
      "Початківці",
      "Jazz Funk & Choreo",
      "Катя Самойлова",
      [1, 3],
      "20:00",
    ],
    [
      "Jazz Funk — Pro",
      "Середній",
      "Jazz Funk & Choreo",
      "Олександра Майлс",
      [1, 3],
      "19:00",
    ],
    [
      "High Heels — З нуля",
      "З нуля",
      "High Heels",
      "Софія Якименко",
      [3, 5],
      "18:00",
    ],
    [
      "High Heels — Ранкова",
      "Початківці від 3 міс.",
      "High Heels",
      "Олександра Майлс",
      [2, 4],
      "11:00",
    ],
    [
      "High Heels — Вечірня",
      "Початківці від 3 міс.",
      "High Heels",
      "Олександра Майлс",
      [2, 4],
      "19:00",
    ],
    [
      "High Heels — Pro",
      "Середній / pro від 1 року",
      "High Heels",
      "Олександра Майлс",
      [2, 4],
      "20:10",
    ],
  ] as const;
  const groupMap = new Map<string, string>();
  for (const [
    name,
    level,
    directionName,
    teacherName,
    weekdays,
    time,
  ] of schedules) {
    const group = await db.danceGroup.upsert({
      where: {
        name_teacherId: { name, teacherId: teacherMap.get(teacherName)! },
      },
      update: { level, directionId: directionMap.get(directionName)! },
      create: {
        name,
        level,
        teacherId: teacherMap.get(teacherName)!,
        directionId: directionMap.get(directionName)!,
      },
    });
    groupMap.set(name, group.id);
    const [hours, minutes] = time.split(":").map(Number);
    for (const weekday of weekdays) {
      await db.regularSchedule.upsert({
        where: {
          groupId_weekday_startMinute: {
            groupId: group.id,
            weekday,
            startMinute: hours! * 60 + minutes!,
          },
        },
        update: {},
        create: {
          groupId: group.id,
          teacherId: teacherMap.get(teacherName)!,
          directionId: directionMap.get(directionName)!,
          weekday,
          startMinute: hours! * 60 + minutes!,
          durationMin: 60,
        },
      });
    }
  }

  const products = [
    ["Разове заняття — тариф 1", 1, 1, 35000, 1, true],
    ["4 заняття / 15 днів — тариф 1", 4, 15, 110000, 1, false],
    ["8 занять / 30 днів — тариф 1", 8, 30, 210000, 1, false],
    ["Разове заняття — тариф 2", 1, 1, 40000, 2, true],
    ["4 заняття / 15 днів — тариф 2", 4, 15, 125000, 2, false],
    ["8 занять / 30 днів — тариф 2", 8, 30, 230000, 2, false],
  ] as const;
  const productMap = new Map<
    string,
    Awaited<ReturnType<typeof db.product.upsert>>
  >();
  for (const [
    name,
    lessonsCount,
    validityDays,
    priceCents,
    tariffGroup,
    isDropIn,
  ] of products) {
    const product = await db.product.upsert({
      where: { name },
      update: { lessonsCount, validityDays, priceCents, tariffGroup, isDropIn },
      create: {
        name,
        lessonsCount,
        validityDays,
        priceCents,
        tariffGroup,
        isDropIn,
      },
    });
    productMap.set(name, product);
  }

  const clientDefinitions = [
    ["Дар’я", "Коваленко", "+380671110101", "@daria.k"],
    ["Аліна", "Шевченко", "+380671110102", "@alina.moves"],
    ["Вікторія", "Мельник", "+380671110103", "@vika.dance"],
    ["Ілля", "Бондаренко", "+380671110104", "@illia.b"],
    ["Марія", "Іваненко", "+380671110105", "@maria.i"],
    ["Ларина", "Сокол", "+380671110106", "@larina.s"],
    ["Ірина", "Петренко", "+380671110107", "@iryna.p"],
    ["Олена", "Кравчук", "+380671110108", "@olena.k"],
  ] as const;
  const clients = [];
  for (const [firstName, lastName, phone, instagram] of clientDefinitions) {
    clients.push(
      await db.client.upsert({
        where: { phone },
        update: { firstName, lastName, instagram },
        create: { firstName, lastName, phone, instagram },
      }),
    );
  }

  const primaryGroupId = groupMap.get("Jazz Funk — Софія")!;
  await db.groupMember.createMany({
    data: clients
      .slice(0, 6)
      .map((client) => ({ groupId: primaryGroupId, clientId: client.id })),
    skipDuplicates: true,
  });

  const product = productMap.get("8 занять / 30 днів — тариф 1")!;
  for (let index = 0; index < 5; index++) {
    const client = clients[index]!;
    const exists = await db.subscription.findFirst({
      where: { clientId: client.id, productId: product.id },
    });
    if (!exists) {
      const startDate = addDays(startOfDay(new Date()), -7 - index);
      await db.subscription.create({
        data: {
          clientId: client.id,
          productId: product.id,
          productName: product.name,
          priceCents: product.priceCents,
          totalLessons: 8,
          remainingLessons: [6, 2, 1, 3, 7][index]!,
          startDate,
          endDate: inclusiveEndDate(startDate, 30),
          teacherIds: [teacherMap.get("Софія Якименко")!],
          directionIds: [
            directionMap.get("Jazz Funk & Choreo")!,
            directionMap.get("High Heels")!,
          ],
          groupIds: [],
        },
      });
    }
  }

  const regularSchedules = await db.regularSchedule.findMany({
    where: { isActive: true },
  });
  for (const schedule of regularSchedules)
    await generateScheduleEvents(schedule.id, 90);

  const existingPayment = await db.payment.findFirst({
    where: { purpose: "Абонемент Jazz Funk — Дар’я Коваленко" },
  });
  if (!existingPayment) {
    await db.payment.create({
      data: {
        clientId: clients[0]!.id,
        amountCents: 210000,
        category: PaymentCategory.SUBSCRIPTION,
        method: PaymentMethod.CARD,
        purpose: "Абонемент Jazz Funk — Дар’я Коваленко",
        paidAt: addDays(new Date(), -5),
        createdById: admin.id,
      },
    });
  }

  await db.setting.upsert({
    where: { key: "studio.timezone" },
    update: { value: "Europe/Kyiv" },
    create: { key: "studio.timezone", value: "Europe/Kyiv" },
  });
  await db.setting.upsert({
    where: { key: "studio.name" },
    update: { value: "Miles Dance Studio" },
    create: { key: "studio.name", value: "Miles Dance Studio" },
  });
}

main()
  .then(() => console.log("Miles Dance Studio seed completed"))
  .finally(async () => db.$disconnect());
