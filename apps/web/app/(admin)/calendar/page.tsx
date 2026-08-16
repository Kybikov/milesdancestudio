"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { dateTime } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { ScheduleManagement } from "@/components/schedule-management"
import {
  CalendarView,
  StudioCalendar,
  StudioEvent,
} from "@/components/studio-calendar"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings2,
  UserCheck,
  UserX,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

type Group = {
  id: string
  name: string
  teacher: { id: string; name: string }
  direction: { id: string; name: string }
}

const typeLabels: Record<string, string> = {
  GROUP: "Групове заняття",
  INDIVIDUAL: "Індивідуальне заняття",
  RENTAL: "Оренда",
  SHOOTING: "Зйомка",
  OTHER: "Інше",
}

const viewLabels: Record<CalendarView, string> = {
  month: "Місяць",
  week: "Тиждень",
  day: "День",
}

function localDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
}

export default function CalendarPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [managingSchedule, setManagingSchedule] = useState(false)
  const [selected, setSelected] = useState<StudioEvent | null>(null)
  const [type, setType] = useState("GROUP")
  const [groupId, setGroupId] = useState("")
  const [view, setView] = useState<CalendarView>("month")
  const [focusDate, setFocusDate] = useState(() => localDate(new Date()))
  const range = useMemo(() => {
    const focus = new Date(`${focusDate}T12:00:00`)
    if (view === "month") {
      const from = new Date(focus.getFullYear(), focus.getMonth(), 1)
      from.setDate(from.getDate() - ((from.getDay() + 6) % 7))
      const to = new Date(from)
      to.setDate(to.getDate() + 41)
      to.setHours(23, 59, 59, 999)
      return { from: from.toISOString(), to: to.toISOString() }
    }
    const from = new Date(`${focusDate}T00:00:00`)
    if (view === "week")
      from.setDate(from.getDate() - ((from.getDay() + 6) % 7))
    const to = new Date(from)
    to.setDate(to.getDate() + (view === "week" ? 6 : 0))
    to.setHours(23, 59, 59, 999)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [focusDate, view])
  const events = useQuery({
    queryKey: ["events", range],
    queryFn: () =>
      api<StudioEvent[]>(
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
      toast.success("Подію додано до календаря")
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
      setSelected(null)
      toast.success("Подію скасовано")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const complete = useMutation({
    mutationFn: (id: string) =>
      api(`/events/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] })
      setSelected(null)
      toast.success("Заняття завершено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const teacherAttendance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/events/${id}/teacher-attendance`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] })
      toast.success("Присутність викладача збережено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const freeSlots = useMemo(() => {
    if (view !== "day") return []
    const busy = (events.data ?? [])
      .filter((event) => event.status !== "CANCELLED")
      .map((event) => ({
        start: new Date(event.startsAt),
        end: new Date(event.endsAt),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
    const day = new Date(`${focusDate}T00:00:00`)
    const close = new Date(day)
    close.setHours(22)
    let cursor = new Date(day)
    cursor.setHours(8)
    const slots: string[] = []
    for (const item of busy) {
      if (item.start > cursor) slots.push(`${time(cursor)}–${time(item.start)}`)
      if (item.end > cursor) cursor = item.end
    }
    if (cursor < close) slots.push(`${time(cursor)}–22:00`)
    return slots
  }, [events.data, focusDate, view])
  const move = (direction: -1 | 1) => {
    const date = new Date(`${focusDate}T12:00:00`)
    if (view === "month") date.setMonth(date.getMonth() + direction)
    else date.setDate(date.getDate() + direction * (view === "week" ? 7 : 1))
    setFocusDate(localDate(date))
  }
  const title = new Intl.DateTimeFormat("uk-UA", {
    month: "long",
    year: "numeric",
    ...(view === "day" ? { day: "numeric", weekday: "long" } : {}),
  }).format(new Date(`${focusDate}T12:00:00`))

  return (
    <div>
      <PageHeader
        title="Календар"
        description="Розклад занять, оренди та зйомок у залі."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setManagingSchedule((value) => !value)}
            >
              <Settings2 />
              Регулярний розклад
            </Button>
            <Button onClick={() => setAdding((value) => !value)}>
              <CalendarPlus />
              Нова подія
            </Button>
          </div>
        }
      />
      {managingSchedule && (
        <div className="mb-5">
          <ScheduleManagement />
        </div>
      )}
      {adding && (
        <EventForm
          groups={groups.data ?? []}
          groupId={groupId}
          setGroupId={setGroupId}
          type={type}
          setType={setType}
          focusDate={focusDate}
          pending={create.isPending}
          onClose={() => setAdding(false)}
          onSubmit={(data) => create.mutate(data)}
        />
      )}
      <Card className="miles-card overflow-hidden">
        <CardHeader className="border-b p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => move(-1)}
                aria-label="Попередній період"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                onClick={() => setFocusDate(localDate(new Date()))}
              >
                Сьогодні
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => move(1)}
                aria-label="Наступний період"
              >
                <ChevronRight />
              </Button>
              <CardTitle className="ml-2 capitalize">{title}</CardTitle>
            </div>
            <div className="flex rounded-xl bg-muted p-1">
              {(Object.keys(viewLabels) as CalendarView[]).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={view === value ? "default" : "ghost"}
                  onClick={() => setView(value)}
                >
                  {viewLabels[value]}
                </Button>
              ))}
            </div>
          </div>
          {view === "day" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Вільні години:</span>
              {freeSlots.map((slot) => (
                <Badge key={slot} variant="outline">
                  {slot}
                </Badge>
              ))}
              {!freeSlots.length && (
                <Badge variant="secondary">Вільного часу немає</Badge>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <StudioCalendar
            events={events.data ?? []}
            focusDate={focusDate}
            view={view}
            onDateChange={(date) => {
              setFocusDate(date)
              if (view === "month") setView("day")
            }}
            onSelectEvent={setSelected}
          />
        </CardContent>
      </Card>
      {selected && (
        <EventDetails
          event={selected}
          onClose={() => setSelected(null)}
          onCancel={(reason) => cancel.mutate({ id: selected.id, reason })}
          onComplete={() => complete.mutate(selected.id)}
          onTeacherAttendance={(status) =>
            teacherAttendance.mutate({ id: selected.id, status })
          }
        />
      )}
    </div>
  )
}

function EventDetails({
  event,
  onClose,
  onCancel,
  onComplete,
  onTeacherAttendance,
}: {
  event: StudioEvent
  onClose: () => void
  onCancel: (reason: string) => void
  onComplete: () => void
  onTeacherAttendance: (status: string) => void
}) {
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState("")
  return (
    <Card className="miles-card fixed inset-x-3 bottom-20 z-40 max-h-[70vh] overflow-y-auto shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[420px] lg:bottom-6">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{event.title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {dateTime(event.startsAt)}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={event.status} />
          <Badge variant="outline">
            {typeLabels[event.type] ?? event.type}
          </Badge>
        </div>
        <div className="rounded-xl bg-muted/60 p-3 text-sm">
          <p className="font-medium">
            {event.teacher?.name ?? event.clientName ?? "Зала"}
          </p>
          {event.direction && (
            <p className="text-muted-foreground">{event.direction.name}</p>
          )}
        </div>
        {event.teacher && event.status !== "CANCELLED" && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Присутність викладача
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={
                  event.teacherAttendance?.status === "PRESENT"
                    ? "default"
                    : "outline"
                }
                onClick={() => onTeacherAttendance("PRESENT")}
              >
                <UserCheck /> Був
              </Button>
              <Button
                variant={
                  event.teacherAttendance?.status === "ABSENT"
                    ? "secondary"
                    : "outline"
                }
                onClick={() => onTeacherAttendance("ABSENT")}
              >
                <UserX /> Не був
              </Button>
            </div>
          </div>
        )}
        {event.status === "SCHEDULED" && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={onComplete}>
              <Check /> Завершити
            </Button>
            <Button variant="outline" onClick={() => setCancelling(true)}>
              <XCircle className="text-rose-500" /> Скасувати
            </Button>
          </div>
        )}
        {cancelling && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
            <Label htmlFor="cancel-reason">Причина скасування</Label>
            <Input
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 bg-background"
              autoFocus
            />
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={reason.trim().length < 3}
                onClick={() => onCancel(reason.trim())}
              >
                Підтвердити скасування
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCancelling(false)}
              >
                Назад
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EventForm({
  groups,
  groupId,
  setGroupId,
  type,
  setType,
  focusDate,
  pending,
  onClose,
  onSubmit,
}: {
  groups: Group[]
  groupId: string
  setGroupId: (value: string) => void
  type: string
  setType: (value: string) => void
  focusDate: string
  pending: boolean
  onClose: () => void
  onSubmit: (data: object) => void
}) {
  return (
    <Card className="miles-card mb-5">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Нова подія</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X />
        </Button>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const group = groups.find((item) => item.id === groupId)
            onSubmit({
              title: form.get("title"),
              type,
              startsAt: new Date(String(form.get("startsAt"))).toISOString(),
              endsAt: new Date(String(form.get("endsAt"))).toISOString(),
              groupId: groupId || undefined,
              teacherId: group?.teacher.id,
              directionId: group?.direction.id,
              clientName: form.get("clientName") || undefined,
              clientPhone: form.get("clientPhone") || undefined,
              priceCents: Number(form.get("price") || 0) * 100,
              paymentMethod: form.get("paymentMethod") || undefined,
              isPaid: form.get("isPaid") === "on",
              lightCount: Number(form.get("lightCount") || 0),
              comment: form.get("comment") || undefined,
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
                  <SelectItem key={value} value={value}>
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
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Початок">
            <Input
              name="startsAt"
              type="datetime-local"
              defaultValue={`${focusDate}T18:00`}
              required
            />
          </Field>
          <Field label="Завершення">
            <Input
              name="endsAt"
              type="datetime-local"
              defaultValue={`${focusDate}T19:00`}
              required
            />
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
                <input type="checkbox" name="isPaid" /> Оплату отримано
              </label>
            </>
          )}
          <Field label="Додаткове світло">
            <Input name="lightCount" type="number" min="0" defaultValue="0" />
          </Field>
          <Field label="Коментар">
            <Input name="comment" />
          </Field>
          <Button type="submit" disabled={pending}>
            <Plus /> Зберегти
          </Button>
        </form>
      </CardContent>
    </Card>
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

function time(value: Date) {
  return value.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  })
}
