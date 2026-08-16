import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import { db } from "../db.js";

export async function generateScheduleEvents(
  scheduleId: string,
  horizonDays = 90,
) {
  const schedule = await db.regularSchedule.findUniqueOrThrow({
    where: { id: scheduleId },
    include: { group: true, teacher: true, direction: true },
  });
  if (!schedule.isActive) return 0;
  const today = startOfDay(new Date());
  let created = 0;
  for (let offset = 0; offset <= horizonDays; offset++) {
    const day = addDays(today, offset);
    if (day.getDay() !== schedule.weekday) continue;
    const startsAt = setMinutes(
      setHours(day, Math.floor(schedule.startMinute / 60)),
      schedule.startMinute % 60,
    );
    const endsAt = new Date(startsAt.getTime() + schedule.durationMin * 60_000);
    const recurrenceKey = `${schedule.id}:${startsAt.toISOString()}`;
    const existing = await db.calendarEvent.findUnique({
      where: { recurrenceKey },
    });
    if (!existing) {
      const conflict = await db.calendarEvent.findFirst({
        where: {
          status: "SCHEDULED",
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
      if (!conflict) {
        await db.calendarEvent.create({
          data: {
            title: schedule.group.name,
            type: "GROUP",
            startsAt,
            endsAt,
            teacherId: schedule.teacherId,
            directionId: schedule.directionId,
            groupId: schedule.groupId,
            recurrenceKey,
          },
        });
        created++;
      }
    }
  }
  return created;
}
