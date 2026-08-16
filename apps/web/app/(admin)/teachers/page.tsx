"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Pencil, Plus, Users } from "lucide-react"
import { toast } from "sonner"

type Direction = { id: string; name: string }
type Teacher = {
  id: string
  name: string
  color: string
  phone?: string
  instagram?: string
  isActive: boolean
  directions: { direction: Direction }[]
  groups: {
    id: string
    name: string
    level: string
    direction: Direction
    _count: { members: number }
  }[]
}

export default function TeachersPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const teachers = useQuery({
    queryKey: ["teachers"],
    queryFn: () => api<Teacher[]>("/teachers"),
  })
  const directions = useQuery({
    queryKey: ["directions"],
    queryFn: () => api<Direction[]>("/directions"),
  })
  const create = useMutation({
    mutationFn: (data: object) =>
      api("/teachers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers"] })
      setEditingId(null)
      setAdding(false)
      toast.success("Викладача додано")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api(`/teachers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers"] })
      toast.success("Дані викладача оновлено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  return (
    <div>
      <PageHeader
        title="Викладачі"
        description="Команда, напрямки, групи та кількість учнів."
        action={
          <Button onClick={() => setAdding(!adding)}>
            <Plus />
            Додати
          </Button>
        }
      />
      {adding && (
        <Card className="miles-card mb-5">
          <CardHeader>
            <CardTitle className="text-base">Новий викладач</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                create.mutate({
                  name: form.get("name"),
                  color: form.get("color"),
                  phone: form.get("phone") || undefined,
                  instagram: form.get("instagram") || undefined,
                  directionIds:
                    directions.data
                      ?.filter((item) => form.get(`d-${item.id}`))
                      .map((item) => item.id) ?? [],
                })
              }}
            >
              <Field label="Ім’я">
                <Input name="name" required />
              </Field>
              <Field label="Колір">
                <Input
                  name="color"
                  type="color"
                  defaultValue="#d946ef"
                  className="h-10 p-1"
                />
              </Field>
              <Field label="Телефон">
                <Input name="phone" />
              </Field>
              <Field label="Instagram">
                <Input name="instagram" />
              </Field>
              <div className="sm:col-span-2 lg:col-span-4">
                <Label>Напрямки</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {directions.data?.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm"
                    >
                      <input type="checkbox" name={`d-${item.id}`} />
                      {item.name}
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={create.isPending}>
                Зберегти
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {teachers.data?.map((teacher) => (
          <Card key={teacher.id} className="miles-card overflow-hidden">
            <div className="h-1.5" style={{ background: teacher.color }} />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className="grid size-12 place-items-center rounded-full text-lg font-semibold"
                  style={{
                    background: `${teacher.color}18`,
                    color: teacher.color,
                  }}
                >
                  {teacher.name
                    .split(" ")
                    .map((word) => word[0])
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/teachers/${teacher.id}`}
                      className="hover:text-primary"
                    >
                      {teacher.name}
                    </Link>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {teacher.phone || teacher.instagram || "Контакт не вказано"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setEditingId(editingId === teacher.id ? null : teacher.id)
                  }
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {editingId === teacher.id && (
                <form
                  className="mb-4 space-y-3 rounded-xl border bg-muted/30 p-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const form = new FormData(event.currentTarget)
                    update.mutate({
                      id: teacher.id,
                      data: {
                        name: form.get("name"),
                        phone: form.get("phone") || null,
                        instagram: form.get("instagram") || null,
                      },
                    })
                  }}
                >
                  <Field label="Ім’я">
                    <Input name="name" defaultValue={teacher.name} required />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Телефон">
                      <Input name="phone" defaultValue={teacher.phone} />
                    </Field>
                    <Field label="Instagram">
                      <Input
                        name="instagram"
                        defaultValue={teacher.instagram}
                      />
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" type="submit">
                      Зберегти
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Скасувати
                    </Button>
                  </div>
                </form>
              )}
              <div className="mb-4 flex flex-wrap gap-1">
                {teacher.directions.map(({ direction }) => (
                  <Badge variant="secondary" key={direction.id}>
                    {direction.name}
                  </Badge>
                ))}
              </div>
              <div className="space-y-2">
                {teacher.groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between rounded-xl bg-muted/60 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.level}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-sm">
                      <Users className="size-4" />
                      {group._count.members}
                    </span>
                  </div>
                ))}
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
