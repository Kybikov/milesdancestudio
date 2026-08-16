import { describe, expect, it } from "vitest";
import {
  derivedSubscriptionStatus,
  inclusiveEndDate,
  restoredSubscriptionState,
  subscriptionMatches,
} from "../src/domain/subscriptions.js";

describe("subscription business rules", () => {
  it("treats a 15 day subscription starting Aug 1 as valid through Aug 15", () => {
    const end = inclusiveEndDate(new Date("2026-08-01T09:00:00+03:00"), 15);
    expect(end.getDate()).toBe(15);
  });

  it("marks a subscription as expiring at the three day threshold", () => {
    expect(
      derivedSubscriptionStatus({
        remainingLessons: 2,
        endDate: new Date("2026-08-19T23:59:00Z"),
        now: new Date("2026-08-16T12:00:00Z"),
      }),
    ).toBe("EXPIRING");
  });

  it("supports a shared balance across allowed directions", () => {
    const subscription = {
      teacherIds: ["t1"],
      directionIds: ["jazz", "heels"],
      groupIds: [],
    };
    expect(
      subscriptionMatches(subscription, {
        teacherId: "t1",
        directionId: "heels",
      }),
    ).toBe(true);
    expect(
      subscriptionMatches(subscription, {
        teacherId: "t1",
        directionId: "latin",
      }),
    ).toBe(false);
  });
});

describe("restoring a deducted lesson", () => {
  it("reactivates a used subscription when it is still valid", () => {
    expect(
      restoredSubscriptionState({
        remainingLessons: 0,
        endDate: new Date("2026-08-30T23:59:59.999Z"),
        now: new Date("2026-08-16T10:00:00.000Z"),
      }),
    ).toEqual({ remainingLessons: 1, status: "ACTIVE", burnedLessons: 0 });
  });

  it("keeps a restored lesson expired after the validity period", () => {
    expect(
      restoredSubscriptionState({
        remainingLessons: 0,
        endDate: new Date("2026-08-10T23:59:59.999Z"),
        now: new Date("2026-08-16T10:00:00.000Z"),
      }),
    ).toEqual({ remainingLessons: 1, status: "EXPIRED", burnedLessons: 1 });
  });
});
