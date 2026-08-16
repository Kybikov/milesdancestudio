"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CalendarSync, Plus, Power } from "lucide-react"
import { toast } from "sonner"
type Group = { id: string; name: string }
type Schedule = {
  id: string
  weekday: number
  startMinute: number
  durationMin: number
  isActive: boolean
  group: Group
  teacher: { name: string }
  direction: { name: string }
}
const days = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
export function ScheduleManagement() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const schedules = useQuery({
    queryKey: ["schedules"],
    queryFn: () => api<Schedule[]>("/schedules"),
  })
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<Group[]>("/groups"),
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["schedules"] })
    qc.invalidateQueries({ queryKey: ["events"] })
  }
  const create = useMutation({
    mutationFn: (data: object) =>
      api<{ createdEvents: number }>("/schedules", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (result) => {
      refresh()
      setAdding(false)
      toast.success(
        `Розклад збережено, створено занять: ${result.createdEvents}`
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api(`/schedules/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      refresh()
      toast.success("Регулярний розклад оновлено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  return (
    <Card className="miles-card mb-5">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarSync className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Регулярний розклад</p>
            <p className="text-xs text-muted-foreground">
              Автоматично створює заняття на 90 днів.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding(!adding)}
          >
            <Plus />
            Додати
          </Button>
        </div>
        {adding && (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault()
              const f = new FormData(event.currentTarget)
              const [hours, minutes] = String(f.get("time"))
                .split(":")
                .map(Number)
              create.mutate({
                groupId: f.get("groupId"),
                weekday: Number(f.get("weekday")),
                startMinute: (hours ?? 0) * 60 + (minutes ?? 0),
                durationMin: Number(f.get("duration")),
              })
            }}
          >
            <select
              name="groupId"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              required
            >
              <option value="">Група</option>
              {groups.data?.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              name="weekday"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              required
            >
              <option value="">День</option>
              {days.map((day, index) => (
                <option value={index} key={day}>
                  {day}
                </option>
              ))}
            </select>
            <Input name="time" type="time" required />
            <Input
              name="duration"
              type="number"
              min="15"
              max="240"
              defaultValue="60"
            />
            <Button type="submit">Створити повторення</Button>
          </form>
        )}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {schedules.data?.map((item) => (
            <div
              key={item.id}
              className={`min-w-52 rounded-xl border bg-card p-3 ${item.isActive ? "" : "opacity-50"}`}
            >
              <div className="flex items-center justify-between">
                <Badge>{days[item.weekday]}</Badge>
                <div className="flex items-center">
                  <strong className="text-sm">
                    {String(Math.floor(item.startMinute / 60)).padStart(2, "0")}
                    :{String(item.startMinute % 60).padStart(2, "0")}
                  </strong>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      toggle.mutate({ id: item.id, isActive: !item.isActive })
                    }
                  >
                    <Power className="size-3" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 truncate text-sm font-medium">
                {item.group.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.teacher.name} · {item.durationMin} хв
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
