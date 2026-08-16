"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { dateTime } from "@/lib/format"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Activity } from "lucide-react"

type ActivityItem = {
  id: string
  action: string
  entityType: string
  createdAt: string
  actor?: { displayName: string; avatarPath?: string }
}

const actionLabels: Record<string, string> = {
  CREATE: "створив(ла)",
  UPDATE: "оновив(ла)",
  CANCEL: "скасував(ла)",
  COMPLETE: "завершив(ла)",
  RENEW: "продовжив(ла)",
  MARK_ATTENDANCE: "відмітив(ла) відвідування",
  MARK_TEACHER_ATTENDANCE: "відмітив(ла) викладача",
  ADD_MEMBER: "додав(ла) клієнта до групи",
  REMOVE_MEMBER: "вилучив(ла) клієнта з групи",
  PASSWORD_CHANGED: "змінив(ла) пароль",
  UPDATE_PROFILE: "оновив(ла) профіль",
  AUTH_LOGIN: "увійшов(ла) до системи",
  AUTH_LOGOUT: "вийшов(ла) із системи",
}

const entityLabels: Record<string, string> = {
  Subscription: "абонемент",
  Payment: "оплату",
  Client: "клієнта",
  Teacher: "викладача",
  CalendarEvent: "подію",
  RegularSchedule: "регулярний розклад",
  Product: "послугу",
  DanceGroup: "групу",
  User: "користувача",
  ExtraCharge: "додатковий збір",
  Attendance: "відвідування",
  TeacherAttendance: "присутність викладача",
}

export function ActivityDrawer() {
  const query = useQuery({
    queryKey: ["activity"],
    queryFn: () => api<ActivityItem[]>("/activity"),
    refetchInterval: 30_000,
  })
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" aria-label="Активність" />}
      >
        <Activity />
        <span className="sr-only">Активність</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Активність команди</SheetTitle>
          <SheetDescription>Останні зміни в системі</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {query.data?.map((item) => (
            <div key={item.id} className="flex gap-3 border-b p-4">
              <Avatar className="size-9">
                <AvatarImage src={item.actor?.avatarPath} />
                <AvatarFallback>
                  {(item.actor?.displayName ?? "С").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <strong>{item.actor?.displayName ?? "Система"}</strong>{" "}
                  {actionLabels[item.action] ?? item.action.toLowerCase()}{" "}
                  {entityLabels[item.entityType] ??
                    item.entityType.toLowerCase()}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {dateTime(item.createdAt)}
                  </span>
                  <Badge variant="outline" className="text-[9px]">
                    {item.entityType}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
