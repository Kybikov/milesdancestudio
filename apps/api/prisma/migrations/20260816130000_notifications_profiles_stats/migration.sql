ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'FAILED';

CREATE TYPE "TeacherAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');
CREATE TYPE "NotificationType" AS ENUM (
  'SUBSCRIPTION_EXPIRING',
  'SUBSCRIPTION_EXPIRED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'ACTIVITY',
  'SYSTEM'
);

ALTER TABLE "Payment" ADD COLUMN "teacherId" TEXT;

CREATE TABLE "TeacherAttendance" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "status" "TeacherAttendanceStatus" NOT NULL,
  "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherAttendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "link" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherAttendance_eventId_key" ON "TeacherAttendance"("eventId");
CREATE INDEX "TeacherAttendance_teacherId_markedAt_idx" ON "TeacherAttendance"("teacherId", "markedAt");
CREATE UNIQUE INDEX "Notification_recipientId_dedupeKey_key" ON "Notification"("recipientId", "dedupeKey");
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
