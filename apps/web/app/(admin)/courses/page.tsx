"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BookOpen, Pencil, Plus, Users } from "lucide-react"
import { toast } from "sonner"

type Direction = { id: string; name: string }
type Teacher = { id: string; name: string; color: string }
type Course = {
  id: string
  name: string
  level?: string
  description?: string
  isActive: boolean
  teacher: Teacher
  direction: Direction
  _count?: { members: number }
  members: unknown[]
}

export default function CoursesPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Course | null>(null)
  const courses = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<Course[]>("/groups"),
  })
  const teachers = useQuery({
    queryKey: ["teachers"],
    queryFn: () => api<Teacher[]>("/teachers"),
  })
  const directions = useQuery({
    queryKey: ["directions"],
    queryFn: () => api<Direction[]>("/directions"),
  })
  const done = () => {
    qc.invalidateQueries({ queryKey: ["groups"] })
    qc.invalidateQueries({ queryKey: ["teachers"] })
    setAdding(false)
    setEditing(null)
  }
  const create = useMutation({
    mutationFn: (data: object) =>
      api("/groups", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      done()
      toast.success("Курс створено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api(`/groups/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      done()
      toast.success("Курс оновлено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const submit = (event: React.FormEvent<HTMLFormElement>, id?: string) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const data = {
      name: form.get("name"),
      level: form.get("level") || null,
      description: form.get("description") || null,
      teacherId: form.get("teacherId"),
      directionId: form.get("directionId"),
    }
    if (id) update.mutate({ id, data })
    else create.mutate(data)
  }
  return (
    <div>
      <PageHeader
        title="Курси"
        description="Каталог програм студії, описи, рівні та відповідальні викладачі."
        action={
          <Button onClick={() => setAdding((value) => !value)}>
            <Plus /> Новий курс
          </Button>
        }
      />
      {(adding || editing) && (
        <Card className="miles-card mb-5">
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? "Редагування курсу" : "Новий курс"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              onSubmit={(event) => submit(event, editing?.id)}
            >
              <Field label="Назва">
                <Input name="name" defaultValue={editing?.name} required />
              </Field>
              <Field label="Рівень">
                <Input name="level" defaultValue={editing?.level} />
              </Field>
              <Field label="Напрямок">
                <select
                  name="directionId"
                  defaultValue={editing?.direction.id}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  required
                >
                  <option value="">Оберіть напрямок</option>
                  {directions.data?.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Викладач">
                <select
                  name="teacherId"
                  defaultValue={editing?.teacher.id}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  required
                >
                  <option value="">Оберіть викладача</option>
                  {teachers.data?.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2 xl:col-span-4">
                <Field label="Опис і призначення курсу">
                  <Textarea
                    name="description"
                    defaultValue={editing?.description}
                    placeholder="Для кого курс, що вивчають і який очікуваний результат"
                    rows={4}
                  />
                </Field>
              </div>
              <div className="flex gap-2 sm:col-span-2 xl:col-span-4">
                <Button type="submit">Зберегти</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setAdding(false); setEditing(null) }}
                >
                  Скасувати
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {courses.data?.map((course) => (
          <Card key={course.id} className="miles-card overflow-hidden">
            <div className="h-1.5" style={{ background: course.teacher.color }} />
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg">{course.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{course.teacher.name}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditing(course)}>
                  <Pencil className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{course.direction.name}</Badge>
                {course.level && <Badge variant="outline">{course.level}</Badge>}
              </div>
              <p className="min-h-12 text-sm leading-relaxed text-muted-foreground">
                {course.description || "Додайте опис і призначення цього курсу."}
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/60 p-3 text-sm">
                <Users className="size-4 text-primary" />
                <strong>{course.members.length}</strong>
                <span className="text-muted-foreground">учнів навчаються</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}
