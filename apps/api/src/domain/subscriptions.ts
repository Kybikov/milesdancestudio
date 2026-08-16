import { addDays, endOfDay, startOfDay } from "date-fns";

export function inclusiveEndDate(startDate: Date, validityDays: number): Date {
  return endOfDay(addDays(startOfDay(startDate), validityDays - 1));
}

export function derivedSubscriptionStatus(input: {
  remainingLessons: number;
  endDate: Date;
  now?: Date;
}): "ACTIVE" | "EXPIRING" | "USED" | "EXPIRED" {
  const now = input.now ?? new Date();
  if (input.remainingLessons <= 0) return "USED";
  if (endOfDay(input.endDate).getTime() < now.getTime()) return "EXPIRED";
  const utcDay = (value: Date) =>
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  if ((utcDay(input.endDate) - utcDay(now)) / 86_400_000 <= 3)
    return "EXPIRING";
  return "ACTIVE";
}

export function subscriptionMatches(
  subscription: {
    teacherIds: string[];
    directionIds: string[];
    groupIds: string[];
  },
  event: {
    teacherId?: string | null;
    directionId?: string | null;
    groupId?: string | null;
  },
): boolean {
  const match = (allowed: string[], actual?: string | null) =>
    allowed.length === 0 || (!!actual && allowed.includes(actual));
  return (
    match(subscription.teacherIds, event.teacherId) &&
    match(subscription.directionIds, event.directionId) &&
    match(subscription.groupIds, event.groupId)
  );
}
