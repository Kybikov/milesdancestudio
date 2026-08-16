-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRING', 'USED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "public"."EventType" AS ENUM ('GROUP', 'INDIVIDUAL', 'RENTAL', 'SHOOTING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."EventStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PaymentCategory" AS ENUM ('SUBSCRIPTION', 'DROP_IN', 'INDIVIDUAL', 'RENTAL', 'LIGHT', 'SHOOTING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'CARD');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ChargeStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarPath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "public"."RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "public"."Teacher" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "avatarPath" TEXT,
    "phone" TEXT,
    "instagram" TEXT,
    "comment" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Direction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Direction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeacherDirection" (
    "teacherId" TEXT NOT NULL,
    "directionId" TEXT NOT NULL,

    CONSTRAINT "TeacherDirection_pkey" PRIMARY KEY ("teacherId","directionId")
);

-- CreateTable
CREATE TABLE "public"."DanceGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "teacherId" TEXT NOT NULL,
    "directionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DanceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "instagram" TEXT,
    "telegramChatId" TEXT,
    "comment" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GroupMember" (
    "groupId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","clientId")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lessonsCount" INTEGER,
    "validityDays" INTEGER,
    "priceCents" INTEGER NOT NULL,
    "isDropIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tariffGroup" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "totalLessons" INTEGER NOT NULL,
    "remainingLessons" INTEGER NOT NULL,
    "burnedLessons" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "teacherIds" TEXT[],
    "directionIds" TEXT[],
    "groupIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RegularSchedule" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "directionId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RegularSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "public"."EventType" NOT NULL,
    "status" "public"."EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "teacherId" TEXT,
    "directionId" TEXT,
    "groupId" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "priceCents" INTEGER,
    "paymentMethod" "public"."PaymentMethod",
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "lightCount" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "recurrenceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attendance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "status" "public"."AttendanceStatus" NOT NULL,
    "deducted" BOOLEAN NOT NULL DEFAULT false,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "subscriptionId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "category" "public"."PaymentCategory" NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "purpose" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdById" TEXT NOT NULL,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExtraCharge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientCharge" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."ChargeStatus" NOT NULL DEFAULT 'UNPAID',

    CONSTRAINT "ClientCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."TelegramLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "chatId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "public"."Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "public"."Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_name_key" ON "public"."Teacher"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Direction_name_key" ON "public"."Direction"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DanceGroup_name_teacherId_key" ON "public"."DanceGroup"("name", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_phone_key" ON "public"."Client"("phone");

-- CreateIndex
CREATE INDEX "Client_lastName_firstName_idx" ON "public"."Client"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "public"."Product"("name");

-- CreateIndex
CREATE INDEX "Subscription_clientId_status_idx" ON "public"."Subscription"("clientId", "status");

-- CreateIndex
CREATE INDEX "Subscription_endDate_idx" ON "public"."Subscription"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "RegularSchedule_groupId_weekday_startMinute_key" ON "public"."RegularSchedule"("groupId", "weekday", "startMinute");

-- CreateIndex
CREATE INDEX "CalendarEvent_startsAt_endsAt_status_idx" ON "public"."CalendarEvent"("startsAt", "endsAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_eventId_clientId_key" ON "public"."Attendance"("eventId", "clientId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_status_idx" ON "public"."Payment"("paidAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCharge_chargeId_clientId_key" ON "public"."ClientCharge"("chargeId", "clientId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "public"."AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherDirection" ADD CONSTRAINT "TeacherDirection_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherDirection" ADD CONSTRAINT "TeacherDirection_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "public"."Direction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DanceGroup" ADD CONSTRAINT "DanceGroup_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DanceGroup" ADD CONSTRAINT "DanceGroup_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "public"."Direction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."DanceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegularSchedule" ADD CONSTRAINT "RegularSchedule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."DanceGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegularSchedule" ADD CONSTRAINT "RegularSchedule_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegularSchedule" ADD CONSTRAINT "RegularSchedule_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "public"."Direction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CalendarEvent" ADD CONSTRAINT "CalendarEvent_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CalendarEvent" ADD CONSTRAINT "CalendarEvent_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "public"."Direction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CalendarEvent" ADD CONSTRAINT "CalendarEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."DanceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."CalendarEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientCharge" ADD CONSTRAINT "ClientCharge_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "public"."ExtraCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientCharge" ADD CONSTRAINT "ClientCharge_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TelegramLog" ADD CONSTRAINT "TelegramLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
