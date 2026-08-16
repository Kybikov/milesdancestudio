"use client"

import Link from "next/link"
import { use, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { dateTime, money } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Banknote,
  CalendarCheck,
  Clock3,
  GraduationCap,
  UserCheck,
  Users,
} from "lucide-react"

type Overview = {
  teacher: {
    id: string
    name: string
    color: string
    phone?: string
    instagram?: string
    directions: { direction: { id: string; name: string } }[]
    groups: { id: string; name: string; members: unknown[] }[]
  }
  metrics: {
    students: number
    scheduled: number
    completed: number
    cancelled: number
    hours: number
    present: number
    absent: number
    attendanceRate: number
    collectedCents: number
    clientVisits: number
  }
  events: {
    id: string
    title: string
    startsAt: string
    endsAt: string
    status: string
    direction?: { name: string }
    group?: { name: string }
    attendances: { status: string }[]
    teacherAttendance?: { status: string }
  }[]
}

export default function TeacherProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const initialFrom = new Date()
  initialFrom.setDate(initialFrom.getDate() - 90)
  const [from, setFrom] = useState(initialFrom.toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const query = useQuery({
    queryKey: ["teacher-overview", id, from, to],
    queryFn: () =>
      api<Overview>(
        `/teachers/${id}/overview?from=${encodeURIComponent(new Date(`${from}T00:00:00`).toISOString())}&to=${encodeURIComponent(new Date(`${to}T23:59:59`).toISOString())}`
      ),
  })
  const data = query.data
  if (!data) return null
  return (
    <div>
      <PageHeader
        title={data.teacher.name}
        description="Заняття, присутність, учні та пов’язані оплати."
        action={
          <Button variant="outline" render={<Link href="/teachers" />}>
            <ArrowLeft /> До викладачів
          </Button>
        }
      />
      <Card className="miles-card mb-5">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div
            className="grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-semibold"
            style={{
              background: `${data.teacher.color}18`,
              color: data.teacher.color,
            }}
          >
            {data.teacher.name
              .split(" ")
              .map((part) => part[0])
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {data.teacher.phone ||
                data.teacher.instagram ||
                "Контакти не вказані"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {data.teacher.directions.map(({ direction }) => (
                <Badge key={direction.id} variant="secondary">
                  {direction.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-auto"
            />
            <span className="text-muted-foreground">—</span>
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-auto"
            />
          </div>
        </CardContent>
      </Card>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Users}
          label="Учнів у групах"
          value={data.metrics.students}
        />
        <Metric
          icon={CalendarCheck}
          label="Проведено занять"
          value={data.metrics.completed}
          note={`${data.metrics.scheduled} заплановано`}
        />
        <Metric
          icon={Clock3}
          label="Годин проведено"
          value={data.metrics.hours.toFixed(1)}
        />
        <Metric
          icon={Banknote}
          label="Пов’язані оплати"
          value={money(data.metrics.collectedCents)}
        />
        <Metric
          icon={UserCheck}
          label="Присутність викладача"
          value={`${data.metrics.attendanceRate}%`}
          note={`${data.metrics.present} був(ла) · ${data.metrics.absent} не був(ла)`}
        />
        <Metric
          icon={GraduationCap}
          label="Відвідувань учнів"
          value={data.metrics.clientVisits}
        />
        <Metric
          icon={CalendarCheck}
          label="Скасовано"
          value={data.metrics.cancelled}
        />
        <Metric icon={Users} label="Груп" value={data.teacher.groups.length} />
      </div>
      <Card className="miles-card">
        <CardHeader>
          <CardTitle className="text-base">Заняття за період</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.events.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{event.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateTime(event.startsAt)} ·{" "}
                    {event.group?.name ?? event.direction?.name ?? "Без групи"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {
                      event.attendances.filter(
                        (item) => item.status === "PRESENT"
                      ).length
                    }{" "}
                    учнів
                  </Badge>
                  {event.teacherAttendance && (
                    <Badge
                      variant={
                        event.teacherAttendance.status === "PRESENT"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {event.teacherAttendance.status === "PRESENT"
                        ? "Викладач був"
                        : "Викладач відсутній"}
                    </Badge>
                  )}
                  <StatusBadge status={event.status} />
                </div>
              </div>
            ))}
            {!data.events.length && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                За вибраний період занять немає
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Users
  label: string
  value: string | number
  note?: string
}) {
  return (
    <Card className="miles-card">
      <CardContent className="flex gap-3 p-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
          {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
