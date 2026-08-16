import type { NotificationType } from "@prisma/client";
import webPush from "web-push";
import { db } from "./db.js";
import { env } from "./env.js";

type NotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  dedupeKey: string;
};

export async function notifyActiveUsers(input: NotificationInput) {
  const users = await db.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  if (!users.length) return;
  const existing = await db.notification.findMany({
    where: {
      dedupeKey: input.dedupeKey,
      recipientId: { in: users.map((user) => user.id) },
    },
    select: { recipientId: true },
  });
  const existingRecipients = new Set(existing.map((item) => item.recipientId));
  const recipients = users.filter((user) => !existingRecipients.has(user.id));
  if (!recipients.length) return;
  const created = await db.notification.createMany({
    data: recipients.map((user) => ({ ...input, recipientId: user.id })),
    skipDuplicates: true,
  });
  if (created.count)
    await sendWebPush(
      recipients.map((user) => user.id),
      input,
    );
}

export async function syncSubscriptionNotifications(recipientId: string) {
  const now = new Date();
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() + 3);
  const subscriptions = await db.subscription.findMany({
    where: {
      status: { notIn: ["CANCELLED", "USED"] },
      remainingLessons: { gt: 0 },
      endDate: { lte: threshold },
    },
    include: { client: { select: { firstName: true, lastName: true } } },
    orderBy: { endDate: "asc" },
  });
  if (!subscriptions.length) return;
  const inputs = subscriptions.map((subscription) => {
    const expired = subscription.endDate < now;
    const clientName = `${subscription.client.firstName} ${subscription.client.lastName}`;
    return {
      recipientId,
      type: expired
        ? ("SUBSCRIPTION_EXPIRED" as const)
        : ("SUBSCRIPTION_EXPIRING" as const),
      title: expired ? "Абонемент завершився" : "Абонемент завершується",
      message: `${clientName} · ${subscription.productName}`,
      link: `/clients/${subscription.clientId}`,
      dedupeKey: `subscription:${subscription.id}:${expired ? "expired" : "expiring"}`,
    };
  });
  const existing = await db.notification.findMany({
    where: {
      recipientId,
      dedupeKey: { in: inputs.map((input) => input.dedupeKey) },
    },
    select: { dedupeKey: true },
  });
  const existingKeys = new Set(existing.map((item) => item.dedupeKey));
  const newInputs = inputs.filter(
    (input) => !existingKeys.has(input.dedupeKey),
  );
  if (!newInputs.length) return;
  const created = await db.notification.createMany({
    data: newInputs,
    skipDuplicates: true,
  });
  if (created.count)
    for (const input of newInputs) await sendWebPush([recipientId], input);
}

export async function syncAllSubscriptionNotifications() {
  const users = await db.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  for (const user of users) await syncSubscriptionNotifications(user.id);
}

async function sendWebPush(userIds: string[], input: NotificationInput) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  webPush.setVapidDetails(
    "mailto:admin@wtmelon.store",
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: input.title,
            body: input.message,
            link: input.link ?? "/dashboard",
            type: input.type,
          }),
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410)
          await db.pushSubscription.delete({ where: { id: subscription.id } });
      }
    }),
  );
}
