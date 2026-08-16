"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export type CalendarView = "month" | "week" | "day"

export type StudioEvent = {
  id: string
  title: string
  type: string
  status: string
  startsAt: string
  endsAt: string
  teacher?: { id?: string; name: string; color?: string }
  direction?: { name: string }
  group?: { members: unknown[] }
  clientName?: string
  cancelReason?: string
  teacherAttendance?: { status: string } | null
}

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]
const hours = Array.from({ length: 15 }, (_, index) => index + 8)

function dayKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function startOfWeek(value: Date) {
  const result = new Date(value)
  result.setHours(0, 0, 0, 0)
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return result
}

function eventColor(event: StudioEvent) {
  if (event.status === "CANCELLED") return "#94a3b8"
  return event.teacher?.color ?? "#c026d3"
}

function EventPill({
  event,
  compact = false,
  onSelect,
}: {
  event: StudioEvent
  compact?: boolean
  onSelect: (event: StudioEvent) => void
}) {
  const start = new Date(event.startsAt)
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={cn(
        "w-full overflow-hidden rounded-lg border-l-4 bg-card/95 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        compact ? "px-2 py-1" : "p-2",
        event.status === "CANCELLED" && "opacity-60"
      )}
      style={{ borderLeftColor: eventColor(event) }}
    >
      <p
        className={cn(
          "truncate font-medium",
          compact ? "text-[11px]" : "text-xs"
        )}
      >
        {start.toLocaleTimeString("uk-UA", {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        {event.title}
      </p>
      {!compact && (
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {event.teacher?.name ?? event.clientName ?? "Зала"}
        </p>
      )}
    </button>
  )
}

export function StudioCalendar({
  events,
  focusDate,
  view,
  onDateChange,
  onSelectEvent,
}: {
  events: StudioEvent[]
  focusDate: string
  view: CalendarView
  onDateChange: (date: string) => void
  onSelectEvent: (event: StudioEvent) => void
}) {
  const focus = new Date(`${focusDate}T12:00:00`)
  if (view === "month")
    return (
      <MonthCalendar
        focus={focus}
        events={events}
        onDateChange={onDateChange}
        onSelectEvent={onSelectEvent}
      />
    )
  if (view === "week")
    return (
      <TimeCalendar
        days={Array.from({ length: 7 }, (_, index) => {
          const date = startOfWeek(focus)
          date.setDate(date.getDate() + index)
          return date
        })}
        events={events}
        onDateChange={onDateChange}
        onSelectEvent={onSelectEvent}
      />
    )
  return (
    <TimeCalendar
      days={[focus]}
      events={events}
      onDateChange={onDateChange}
      onSelectEvent={onSelectEvent}
    />
  )
}

function MonthCalendar({
  focus,
  events,
  onDateChange,
  onSelectEvent,
}: {
  focus: Date
  events: StudioEvent[]
  onDateChange: (date: string) => void
  onSelectEvent: (event: StudioEvent) => void
}) {
  const first = new Date(focus.getFullYear(), focus.getMonth(), 1)
  const gridStart = startOfWeek(first)
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return date
  })
  const today = dayKey(new Date())
  return (
    <div>
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {weekdays.map((weekday) => (
          <div
            key={weekday}
            className="px-3 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const key = dayKey(date)
          const dayEvents = events.filter(
            (event) => dayKey(event.startsAt) === key
          )
          const outside = date.getMonth() !== focus.getMonth()
          return (
            <div
              key={key}
              className={cn(
                "min-h-20 border-r border-b p-1 last:border-r-0 sm:min-h-32 sm:p-2",
                outside && "bg-muted/25 text-muted-foreground"
              )}
            >
              <button
                type="button"
                onClick={() => onDateChange(key)}
                className={cn(
                  "mb-2 grid size-7 place-items-center rounded-full text-xs font-medium hover:bg-accent",
                  key === today &&
                    "bg-primary text-primary-foreground hover:bg-primary"
                )}
              >
                {date.getDate()}
              </button>
              <div className="hidden space-y-1 sm:block">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventPill
                    key={event.id}
                    event={event}
                    compact
                    onSelect={onSelectEvent}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <Badge variant="secondary" className="text-[10px]">
                    +{dayEvents.length - 3} ще
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1 sm:hidden">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    aria-label={event.title}
                    onClick={() => onSelectEvent(event)}
                    className="size-2 rounded-full"
                    style={{ background: eventColor(event) }}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[8px] text-muted-foreground">
                    +{dayEvents.length - 3}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimeCalendar({
  days,
  events,
  onDateChange,
  onSelectEvent,
}: {
  days: Date[]
  events: StudioEvent[]
  onDateChange: (date: string) => void
  onSelectEvent: (event: StudioEvent) => void
}) {
  const columnWidth = days.length === 1 ? "min-w-[320px]" : "min-w-[980px]"
  return (
    <div className="overflow-x-auto">
      <div className={columnWidth}>
        <div
          className="grid border-b bg-muted/40"
          style={{
            gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          <div />
          {days.map((day) => (
            <button
              key={dayKey(day)}
              type="button"
              onClick={() => onDateChange(dayKey(day))}
              className="border-l px-2 py-3 text-center hover:bg-accent"
            >
              <span className="block text-xs text-muted-foreground">
                {weekdays[(day.getDay() + 6) % 7]}
              </span>
              <span
                className={cn(
                  "mt-1 inline-grid size-8 place-items-center rounded-full text-sm font-semibold",
                  dayKey(day) === dayKey(new Date()) &&
                    "bg-primary text-primary-foreground"
                )}
              >
                {day.getDate()}
              </span>
            </button>
          ))}
        </div>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          <div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-16 border-b pt-1 pr-2 text-right text-[10px] text-muted-foreground"
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((day) => {
            const dayEvents = events.filter(
              (event) => dayKey(event.startsAt) === dayKey(day)
            )
            return (
              <div key={dayKey(day)} className="relative border-l">
                {hours.map((hour) => (
                  <div key={hour} className="h-16 border-b" />
                ))}
                {dayEvents.map((event) => {
                  const starts = new Date(event.startsAt)
                  const ends = new Date(event.endsAt)
                  const startMinute =
                    starts.getHours() * 60 + starts.getMinutes()
                  const duration = Math.max(
                    30,
                    (ends.getTime() - starts.getTime()) / 60_000
                  )
                  return (
                    <div
                      key={event.id}
                      className="absolute inset-x-1 z-10"
                      style={{
                        top: `${((startMinute - 8 * 60) / 60) * 64}px`,
                        height: `${Math.max(34, (duration / 60) * 64 - 4)}px`,
                      }}
                    >
                      <EventPill event={event} onSelect={onSelectEvent} />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
