"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { dateTime } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { CalendarPlus, Clock3, Plus, Users, XCircle } from "lucide-react"
import { toast } from "sonner"
import { ScheduleManagement } from "@/components/schedule-management"

type Group = {
  id: string
  name: string
  teacher: { id: string; name: string }
  direction: { id: string; name: string }
}
type Event = {
  id: string
  title: string
  type: string
  status: string
  startsAt: string
  endsAt: string
  teacher?: { name: string }
  direction?: { name: string }
  group?: { members: unknown[] }
  clientName?: string
  priceCents?: number
  cancelReason?: string
}

const typeLabels: Record<string, string> = {
  GROUP: "Групове",
  INDIVIDUAL: "Індивідуальне",
  RENTAL: "Оренда",
  SHOOTING: "Зйомка",
  OTHER: "Інше",
}

export default function CalendarPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [type, setType] = useState("GROUP")
  const [groupId, setGroupId] = useState("")
  const [view, setView] = useState<"day" | "week">("week")
  const [focusDate, setFocusDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const range = useMemo(() => {
    const from = new Date(`${focusDate}T00:00:00`)
    if (view === "week") {
      const mondayOffset = (from.getDay() + 6) % 7
      from.setDate(from.getDate() - mondayOffset)
    }
    const to = new Date(from)
    to.setDate(to.getDate() + (view === "week" ? 6 : 0))
    to.setHours(23, 59, 59, 999)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [focusDate, view])
  const events = useQuery({
    queryKey: ["events", range],
    queryFn: () =>
      api<Event[]>(
        `/events?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
      ),
  })
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<Group[]>("/groups"),
  })
  const create = useMutation({
    mutationFn: (data: object) =>
      api("/events", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] })
      setAdding(false)
      toast.success("Подію додано")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/events/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] })
      toast.success("Заняття скасовано, час звільнено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const freeSlots = useMemo(() => {
    if (view !== "day") return []
    const busy = (events.data ?? [])
      .filter((item) => item.status === "SCHEDULED")
      .map((item) => ({
        start: new Date(item.startsAt),
        end: new Date(item.endsAt),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
    const day = new Date(`${focusDate}T00:00:00`)
    const open = new Date(day)
    open.setHours(8)
    const close = new Date(day)
    close.setHours(22)
    let cursor = open
    const slots: string[] = []
    for (const item of busy) {
      if (item.start > cursor)
        slots.push(
          `${cursor.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}–${item.start.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}`
        )
      if (item.end > cursor) cursor = item.end
    }
    if (cursor < close)
      slots.push(
        `${cursor.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}–22:00`
      )
    return slots
  }, [events.data, focusDate, view])
  return (
    <div>
      <PageHeader
        title="Календар залу"
        description="Групи, індивідуальні заняття, оренда та зйомки."
        action={
          <Button onClick={() => setAdding(!adding)}>
            <CalendarPlus />
            Додати подію
          </Button>
        }
      />
      <ScheduleManagement />
      <Card className="miles-card mb-5">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex rounded-lg bg-muted p-1">
            <Button
              size="sm"
              variant={view === "day" ? "default" : "ghost"}
              onClick={() => setView("day")}
            >
              День
            </Button>
            <Button
              size="sm"
              variant={view === "week" ? "default" : "ghost"}
              onClick={() => setView("week")}
            >
              Тиждень
            </Button>
          </div>
          <Input
            type="date"
            className="w-auto"
            value={focusDate}
            onChange={(event) => setFocusDate(event.target.value)}
          />
          {view === "day" && (
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 text-sm sm:w-auto sm:flex-1">
              <span className="text-muted-foreground">Вільно:</span>
              {freeSlots.length ? (
                freeSlots.map((slot) => (
                  <Badge variant="outline" key={slot}>
                    {slot}
                  </Badge>
                ))
              ) : (
                <Badge variant="secondary">Немає вільних вікон</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {adding && (
        <Card className="miles-card mb-5">
          <CardHeader>
            <CardTitle className="text-base">Нова подія</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault()
                const f = new FormData(event.currentTarget)
                const group = groups.data?.find((item) => item.id === groupId)
                create.mutate({
                  title: f.get("title"),
                  type,
                  startsAt: new Date(String(f.get("startsAt"))).toISOString(),
                  endsAt: new Date(String(f.get("endsAt"))).toISOString(),
                  groupId: groupId || undefined,
                  teacherId: group?.teacher.id,
                  directionId: group?.direction.id,
                  clientName: f.get("clientName") || undefined,
                  clientPhone: f.get("clientPhone") || undefined,
                  priceCents: Number(f.get("price") || 0) * 100,
                  paymentMethod: f.get("paymentMethod") || undefined,
                  isPaid: f.get("isPaid") === "on",
                  lightCount: Number(f.get("lightCount") || 0),
                  comment: f.get("comment") || undefined,
                })
              }}
            >
              <Field label="Тип">
                <Select
                  value={type}
                  onValueChange={(value) => value && setType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <SelectItem value={value} key={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Назва">
                <Input name="title" required />
              </Field>
              {type === "GROUP" && (
                <Field label="Група">
                  <Select
                    value={groupId}
                    onValueChange={(value) => value && setGroupId(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Оберіть групу" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.data?.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Початок">
                <Input name="startsAt" type="datetime-local" required />
              </Field>
              <Field label="Завершення">
                <Input name="endsAt" type="datetime-local" required />
              </Field>
              {type !== "GROUP" && (
                <>
                  <Field label="Клієнт / орендар">
                    <Input name="clientName" />
                  </Field>
                  <Field label="Телефон">
                    <Input name="clientPhone" />
                  </Field>
                  <Field label="Сума, грн">
                    <Input name="price" type="number" min="0" />
                  </Field>
                  <Field label="Спосіб оплати">
                    <select
                      name="paymentMethod"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">Не оплачено</option>
                      <option value="CASH">Готівка</option>
                      <option value="CARD">Картка</option>
                    </select>
                  </Field>
                  <label className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm">
                    <input type="checkbox" name="isPaid" />
                    Оплату отримано
                  </label>
                </>
              )}
              <Field label="Додаткове світло">
                <Input
                  name="lightCount"
                  type="number"
                  min="0"
                  defaultValue="0"
                />
              </Field>
              <Field label="Коментар">
                <Input name="comment" />
              </Field>
              <Button type="submit" disabled={create.isPending}>
                <Plus />
                Зберегти
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3 xl:grid-cols-2">
        {events.data?.map((event) => (
          <Card
            key={event.id}
            className={`miles-card ${event.status === "CANCELLED" ? "opacity-60" : ""}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Clock3 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={
                        event.status === "CANCELLED"
                          ? "font-semibold line-through"
                          : "font-semibold"
                      }
                    >
                      {event.title}
                    </p>
                    <StatusBadge status={event.status} />
                    <Badge variant="outline">{typeLabels[event.type]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dateTime(event.startsAt)} —{" "}
                    {new Intl.DateTimeFormat("uk-UA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(event.endsAt))}
                  </p>
                  <p className="mt-2 text-sm">
                    {event.teacher?.name || event.clientName || "Студія"}
                    {event.direction && ` · ${event.direction.name}`}
                  </p>
                  {event.group && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3" />
                      {event.group.members.length} учнів
                    </p>
                  )}
                  {event.cancelReason && (
                    <p className="mt-2 text-xs text-rose-600">
                      Причина: {event.cancelReason}
                    </p>
                  )}
                </div>
                {event.status === "SCHEDULED" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const reason = window.prompt("Причина скасування")
                      if (reason) cancel.mutate({ id: event.id, reason })
                    }}
                  >
                    <XCircle className="size-5 text-rose-500" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
