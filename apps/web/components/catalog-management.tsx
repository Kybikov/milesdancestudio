"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
type Direction = { id: string; name: string }
type Teacher = { id: string; name: string }
type Group = { id: string; name: string; level?: string }
export function CatalogManagement() {
  const qc = useQueryClient()
  const [mode, setMode] = useState<"direction" | "group" | null>(null)
  const [editing, setEditing] = useState<{
    kind: "direction" | "group"
    id: string
    name: string
  } | null>(null)
  const directions = useQuery({
    queryKey: ["directions"],
    queryFn: () => api<Direction[]>("/directions"),
  })
  const teachers = useQuery({
    queryKey: ["teachers"],
    queryFn: () => api<Teacher[]>("/teachers"),
  })
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<Group[]>("/groups"),
  })
  const done = () => {
    qc.invalidateQueries({ queryKey: ["directions"] })
    qc.invalidateQueries({ queryKey: ["teachers"] })
    qc.invalidateQueries({ queryKey: ["groups"] })
  }
  const createDirection = useMutation({
    mutationFn: (name: string) =>
      api("/directions", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      done()
      setEditing(null)
      setMode(null)
      toast.success("Напрямок додано")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const createGroup = useMutation({
    mutationFn: (data: object) =>
      api("/groups", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      done()
      setEditing(null)
      setMode(null)
      toast.success("Групу додано")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const editDirection = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api(`/directions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      done()
      setEditing(null)
      toast.success("Напрямок оновлено")
    },
  })
  const editGroup = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api(`/groups/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      done()
      setEditing(null)
      toast.success("Групу оновлено")
    },
  })
  return (
    <Card className="miles-card mb-5">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm font-medium">Каталог студії</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode(mode === "direction" ? null : "direction")}
          >
            <Plus />
            Напрямок
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode(mode === "group" ? null : "group")}
          >
            <Plus />
            Група
          </Button>
        </div>
        {mode === "direction" && (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              createDirection.mutate(
                String(new FormData(event.currentTarget).get("name"))
              )
            }}
          >
            <Input name="name" placeholder="Назва напрямку" required />
            <Button type="submit">Створити</Button>
          </form>
        )}
        {mode === "group" && (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault()
              const f = new FormData(event.currentTarget)
              createGroup.mutate({
                name: f.get("name"),
                level: f.get("level") || undefined,
                teacherId: f.get("teacherId"),
                directionId: f.get("directionId"),
              })
            }}
          >
            <Field label="Назва">
              <Input name="name" required />
            </Field>
            <Field label="Рівень">
              <Input name="level" />
            </Field>
            <Field label="Викладач">
              <select
                name="teacherId"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                required
              >
                <option value="">Оберіть</option>
                {teachers.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Напрямок">
              <select
                name="directionId"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                required
              >
                <option value="">Оберіть</option>
                {directions.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit">Створити групу</Button>
          </form>
        )}
        {editing && (
          <form
            className="mt-4 flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              const name = String(new FormData(event.currentTarget).get("name"))
              if (editing.kind === "direction")
                editDirection.mutate({ id: editing.id, name })
              else editGroup.mutate({ id: editing.id, name })
            }}
          >
            <Input name="name" defaultValue={editing.name} required autoFocus />
            <Button type="submit">Зберегти</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(null)}
            >
              Скасувати
            </Button>
          </form>
        )}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {directions.data?.map((item) => (
            <Button
              size="sm"
              variant="secondary"
              key={item.id}
              onClick={() =>
                setEditing({ kind: "direction", id: item.id, name: item.name })
              }
            >
              {item.name}
              <Pencil className="size-3" />
            </Button>
          ))}
          {groups.data?.map((item) => (
            <Button
              size="sm"
              variant="outline"
              key={item.id}
              onClick={() =>
                setEditing({ kind: "group", id: item.id, name: item.name })
              }
            >
              {item.name}
              <Pencil className="size-3" />
            </Button>
          ))}
        </div>
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
