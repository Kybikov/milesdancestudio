"use client"

import Link from "next/link"
import { use, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { money } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  Banknote,
  CalendarCheck,
  Pencil,
  TicketCheck,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

type Direction = { id: string; name: string }
type Teacher = { id: string; name: string; color: string }
type Overview = {
  group: {
    id: string
    name: string
    level: string | null
    description: string | null
    isActive: boolean
    teacher: Teacher
    direction: Direction
    members: {
      client: {
        id: string
        firstName: string
        lastName: string
        phone: string | null
        subscriptions: { id: string; productName: string }[]
      }
    }[]
  }
  metrics: {
    students: number
    activeSubscriptions: number
    events: number
    completed: number
    cancelled: number
    present: number
    absent: number
    attendanceRate: number
    revenueCents: number
    payments: number
    revenuePerStudentCents: number
  }
  trend: {
    date: string
    events: number
    present: number
    absent: number
    revenueCents: number
  }[]
  events: {
    id: string
    title: string
    startsAt: string
    status: string
    attendances: { status: string }[]
  }[]
}

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const initialFrom = new Date()
  initialFrom.setDate(initialFrom.getDate() - 90)
  const [from, setFrom] = useState(initialFrom.toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const overview = useQuery({
    queryKey: ["group-overview", id, from, to],
    queryFn: () =>
      api<Overview>(
        `/groups/${id}/overview?from=${encodeURIComponent(new Date(`${from}T00:00:00`).toISOString())}&to=${encodeURIComponent(new Date(`${to}T23:59:59`).toISOString())}`
      ),
  })
  const teachers = useQuery({
    queryKey: ["teachers"],
    queryFn: () => api<Teacher[]>("/teachers"),
  })
  const directions = useQuery({
    queryKey: ["directions"],
    queryFn: () => api<Direction[]>("/directions"),
  })
  const update = useMutation({
    mutationFn: (data: object) =>
      api(`/groups/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group-overview", id] })
      qc.invalidateQueries({ queryKey: ["groups"] })
      setEditing(false)
      toast.success("Курс оновлено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    update.mutate({
      name: form.get("name"),
      level: form.get("level") || null,
      description: form.get("description") || null,
      teacherId: form.get("teacherId"),
      directionId: form.get("directionId"),
    })
  }
  const data = overview.data
  const group = data?.group

  return (
    <div>
      <PageHeader
        title={group?.name ?? "Курс"}
        description="Статистика, відвідуваність, прибутковість і налаштування курсу."
        action={
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/courses" />}>
              <ArrowLeft /> Курси
            </Button>
            <Button onClick={() => setEditing((value) => !value)}>
              <Pencil /> {editing ? "Закрити" : "Редагувати"}
            </Button>
          </div>
        }
      />

      {editing && group && (
        <Card className="miles-card mb-5">
          <CardHeader><CardTitle className="text-base">Редагування курсу</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={submit}>
              <Field label="Назва"><Input name="name" defaultValue={group.name} required /></Field>
              <Field label="Рівень"><Input name="level" defaultValue={group.level ?? ""} /></Field>
              <Field label="Напрямок">
                <select name="directionId" defaultValue={group.direction.id} className="h-10 w-full rounded-xl border bg-background px-3 text-sm" required>
                  {directions.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Викладач">
                <select name="teacherId" defaultValue={group.teacher.id} className="h-10 w-full rounded-xl border bg-background px-3 text-sm" required>
                  {teachers.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2 xl:col-span-4">
                <Field label="Опис і призначення курсу"><Textarea name="description" defaultValue={group.description ?? ""} rows={4} /></Field>
              </div>
              <div className="flex gap-2 sm:col-span-2 xl:col-span-4">
                <Button type="submit" disabled={update.isPending}>Зберегти</Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Скасувати</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {group && (
        <Card className="miles-card mb-5 overflow-hidden">
          <div className="h-1.5" style={{ background: group.teacher.color }} />
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{group.direction.name}</Badge>
              {group.level && <Badge variant="outline">{group.level}</Badge>}
              <Badge variant="secondary">{group.teacher.name}</Badge>
            </div>
            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted-foreground">
              {group.description || "Опис курсу ще не додано."}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-medium">Період статистики</p>
          <p className="text-xs text-muted-foreground">Прибутковість рахується за підтвердженими оплатами учнів курсу.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="min-w-0" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="min-w-0" />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Metric icon={Users} label="Учнів" value={data?.metrics.students ?? 0} />
        <Metric icon={UserCheck} label="Відвідуваність" value={`${data?.metrics.attendanceRate ?? 0}%`} note={`${data?.metrics.present ?? 0} були · ${data?.metrics.absent ?? 0} не були`} />
        <Metric icon={CalendarCheck} label="Проведено" value={data?.metrics.completed ?? 0} note={`${data?.metrics.events ?? 0} заплановано`} />
        <Metric icon={Banknote} label="Прибутковість" value={money(data?.metrics.revenueCents)} note={`${data?.metrics.payments ?? 0} оплат`} />
        <Metric icon={TicketCheck} label="Абонементів" value={data?.metrics.activeSubscriptions ?? 0} />
        <Metric icon={TrendingUp} label="Дохід на учня" value={money(data?.metrics.revenuePerStudentCents)} />
      </div>

      <Card className="miles-card mb-5">
        <CardHeader><CardTitle className="text-base">Відвідуваність і дохід</CardTitle></CardHeader>
        <CardContent className="h-80 px-1 sm:px-6">
          {data?.trend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(value) => String(value).slice(5)} />
              <YAxis yAxisId="visits" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="income" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value, name) => name === "Дохід" ? money(Number(value)) : Number(value)} />
              <Bar yAxisId="visits" dataKey="present" name="Були" fill="var(--primary)" radius={[5, 5, 0, 0]} />
              <Bar yAxisId="visits" dataKey="absent" name="Не були" fill="#fda4af" radius={[5, 5, 0, 0]} />
              <Line yAxisId="income" type="monotone" dataKey="revenueCents" name="Дохід" stroke="#0ea5e9" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center rounded-2xl bg-muted/30 px-6 text-center text-sm text-muted-foreground">
              Після перших занять і оплат тут з’явиться динаміка курсу.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="miles-card">
          <CardHeader><CardTitle className="text-base">Учні курсу</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {group?.members.map(({ client }) => (
              <Link key={client.id} href={`/clients/${client.id}`} className="flex items-center justify-between rounded-xl bg-muted/50 p-3 transition hover:bg-muted">
                <div className="min-w-0">
                  <p className="truncate font-medium">{client.firstName} {client.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{client.phone || "Контакт не вказано"}</p>
                </div>
                <Badge variant="outline">{client.subscriptions.length} абон.</Badge>
              </Link>
            ))}
            {!group?.members.length && <p className="text-sm text-muted-foreground">До курсу ще не додано учнів.</p>}
          </CardContent>
        </Card>
        <Card className="miles-card">
          <CardHeader><CardTitle className="text-base">Останні заняття</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data?.events.slice(0, 10).map((event) => {
              const present = event.attendances.filter((item) => item.status === "PRESENT").length
              return (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(event.startsAt))}</p>
                  </div>
                  <Badge variant="secondary">{present}/{event.attendances.length}</Badge>
                </div>
              )
            })}
            {!data?.events.length && <p className="text-sm text-muted-foreground">За цей період занять немає.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof Users; label: string; value: string | number; note?: string }) {
  return (
    <Card className="miles-card">
      <CardContent className="p-4">
        <div className="mb-3 grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-semibold sm:text-xl">{value}</p>
        {note && <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  )
}
