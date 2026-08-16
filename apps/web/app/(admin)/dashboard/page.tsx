"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { money, time } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/status-badge"
import {
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  TicketCheck,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"

type Teacher = {
  id: string
  name: string
  color: string
  avatarPath: string | null
  directions: { direction: { name: string } }[]
  groups: { _count: { members: number } }[]
  events: unknown[]
}
type Dashboard = {
  teachers: Teacher[]
  events: {
    id: string
    title: string
    startsAt: string
    teacher: Teacher | null
    direction: { name: string } | null
    group: { _count: { members: number } } | null
  }[]
  metrics: {
    clients: number
    activeSubscriptions: number
    monthlyIncomeCents: number
  }
}
type Subscription = {
  id: string
  productName: string
  remainingLessons: number
  totalLessons: number
  endDate: string
  status: string
}
type Event = {
  id: string
  title: string
  startsAt: string
  group: {
    members: {
      client: {
        id: string
        firstName: string
        lastName: string
        subscriptions: Subscription[]
      }
    }[]
  } | null
  attendances: { clientId: string; status: string }[]
}

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard"),
  })
  const today = useMemo(() => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date()
    to.setHours(23, 59, 59, 999)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [])
  const events = useQuery({
    queryKey: ["events", today],
    queryFn: () =>
      api<Event[]>(
        `/events?from=${encodeURIComponent(today.from)}&to=${encodeURIComponent(today.to)}`
      ),
  })
  const selected =
    events.data?.find((event) => event.id === selectedId) ?? events.data?.[0]
  const mark = useMutation({
    mutationFn: ({
      eventId,
      clientId,
      status,
    }: {
      eventId: string
      clientId: string
      status: string
    }) =>
      api(`/events/${eventId}/attendance/${clientId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Відвідування збережено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const data = dashboard.data
  return (
    <div>
      <PageHeader
        title="Сьогодні у студії"
        description={new Intl.DateTimeFormat("uk-UA", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date())}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric
          icon={Users}
          label="Клієнтів"
          value={data?.metrics.clients ?? 0}
        />
        <Metric
          icon={TicketCheck}
          label="Активних абонементів"
          value={data?.metrics.activeSubscriptions ?? 0}
        />
        <Metric
          icon={CreditCard}
          label="Отримано за місяць"
          value={money(data?.metrics.monthlyIncomeCents)}
        />
      </div>
      <section className="mb-7">
        <h2 className="mb-3 text-lg font-semibold">Викладачі</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data?.teachers.map((teacher) => (
            <Card key={teacher.id} className="miles-card overflow-hidden">
              <div className="h-1.5" style={{ background: teacher.color }} />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {teacher.avatarPath ? (
                    <Image
                      src={teacher.avatarPath}
                      alt={teacher.name}
                      width={52}
                      height={52}
                      className="size-13 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="grid size-13 place-items-center rounded-full text-lg font-semibold"
                      style={{
                        background: `${teacher.color}18`,
                        color: teacher.color,
                      }}
                    >
                      {teacher.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{teacher.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {teacher.groups.reduce(
                        (sum, group) => sum + group._count.members,
                        0
                      )}{" "}
                      учнів · {teacher.events.length} сьогодні
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {teacher.directions.map(({ direction }) => (
                    <Badge key={direction.name} variant="secondary">
                      {direction.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Заняття та відвідування</h2>
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {events.data?.length ? (
              events.data.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedId(event.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${selected?.id === event.id ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "bg-card hover:border-primary/40"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{event.title}</p>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock3 className="size-4" />
                        {time(event.startsAt)}
                      </p>
                    </div>
                    <Badge>{event.group?.members.length ?? 0} учнів</Badge>
                  </div>
                </button>
              ))
            ) : (
              <Card className="miles-card">
                <CardContent className="p-5 text-sm text-muted-foreground">
                  На сьогодні занять немає.
                </CardContent>
              </Card>
            )}
          </div>
          <Card className="miles-card overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-5 text-primary" />
                {selected?.title ?? "Оберіть заняття"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {selected?.group?.members.map(({ client }) => {
                const active = client.subscriptions.find((sub) =>
                  ["ACTIVE", "EXPIRING"].includes(sub.status)
                )
                const attendance = selected.attendances.find(
                  (item) => item.clientId === client.id
                )
                return (
                  <div
                    key={client.id}
                    className="flex flex-col gap-3 border-b p-4 last:border-0 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {client.firstName} {client.lastName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {active ? (
                          <>
                            <span>{active.productName}</span>
                            <span>
                              {active.remainingLessons}/{active.totalLessons}
                            </span>
                            <StatusBadge status={active.status} />
                          </>
                        ) : (
                          <StatusBadge status="EXPIRED" />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={
                          attendance?.status === "PRESENT"
                            ? "default"
                            : "outline"
                        }
                        className="touch-target"
                        onClick={() =>
                          mark.mutate({
                            eventId: selected.id,
                            clientId: client.id,
                            status: "PRESENT",
                          })
                        }
                      >
                        <Check />
                        Був
                      </Button>
                      <Button
                        variant={
                          attendance?.status === "ABSENT"
                            ? "secondary"
                            : "outline"
                        }
                        className="touch-target"
                        onClick={() =>
                          mark.mutate({
                            eventId: selected.id,
                            clientId: client.id,
                            status: "ABSENT",
                          })
                        }
                      >
                        <X />
                        Не був
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: string | number
}) {
  return (
    <Card className="miles-card">
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
