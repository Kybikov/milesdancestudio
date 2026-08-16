"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { money } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Banknote,
  CreditCard,
  TicketCheck,
  UserCheck,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type Stats = {
  payments: { _sum: { amountCents: number | null }; _count: number }
  categories: {
    category: string
    _sum: { amountCents: number | null }
    _count: number
  }[]
  methods: {
    method: string
    _sum: { amountCents: number | null }
    _count: number
  }[]
  subscriptions: { status: string; _count: number }[]
  attendance: { status: string; _count: number }[]
  trend: { date: string; incomeCents: number; events: number; visits: number }[]
  teacherStats: {
    id: string
    name: string
    color: string
    students: number
    events: number
    completed: number
    present: number
    absent: number
    clientVisits: number
    collectedCents: number
  }[]
  clientStats: {
    id: string
    name: string
    present: number
    absent: number
    paidCents: number
    activeSubscriptions: number
  }[]
  collectorStats: {
    id: string
    name: string
    payments: number
    amountCents: number
  }[]
}

const categoryNames: Record<string, string> = {
  SUBSCRIPTION: "Абонементи",
  DROP_IN: "Разові",
  INDIVIDUAL: "Індивідуальні",
  RENTAL: "Оренда",
  LIGHT: "Світло",
  SHOOTING: "Зйомки",
  OTHER: "Інше",
}

export default function StatisticsPage() {
  const initialFrom = new Date()
  initialFrom.setDate(initialFrom.getDate() - 30)
  const [from, setFrom] = useState(initialFrom.toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const query = useQuery({
    queryKey: ["statistics", from, to],
    queryFn: () =>
      api<Stats>(
        `/statistics?from=${encodeURIComponent(new Date(`${from}T00:00:00`).toISOString())}&to=${encodeURIComponent(new Date(`${to}T23:59:59`).toISOString())}`
      ),
  })
  const data = query.data
  const categories =
    data?.categories.map((item) => ({
      name: categoryNames[item.category] ?? item.category,
      value: (item._sum.amountCents ?? 0) / 100,
    })) ?? []
  const present =
    data?.attendance.find((item) => item.status === "PRESENT")?._count ?? 0
  const absent =
    data?.attendance.find((item) => item.status === "ABSENT")?._count ?? 0
  return (
    <div>
      <PageHeader
        title="Статистика"
        description="Фінанси, заняття, відвідування та робота викладачів."
        action={
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
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Banknote}
          label="Отримано"
          value={money(data?.payments._sum.amountCents)}
        />
        <Metric
          icon={CreditCard}
          label="Безготівково"
          value={money(
            data?.methods.find((item) => item.method === "CARD")?._sum
              .amountCents
          )}
        />
        <Metric
          icon={TicketCheck}
          label="Платежів"
          value={data?.payments._count ?? 0}
        />
        <Metric
          icon={UserCheck}
          label="Відвідуваність"
          value={`${present + absent ? Math.round((present / (present + absent)) * 100) : 0}%`}
          note={`${present} відвідано · ${absent} пропущено`}
        />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
        <Card className="miles-card">
          <CardHeader>
            <CardTitle className="text-base">Динаміка за період</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => String(value).slice(5)}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === "incomeCents"
                      ? money(Number(value))
                      : Number(value)
                  }
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="incomeCents"
                  name="Дохід"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="visits"
                  name="Відвідування"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="miles-card">
          <CardHeader>
            <CardTitle className="text-base">Дохід за категоріями</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={90}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip formatter={(value) => money(Number(value) * 100)} />
                <Bar
                  dataKey="value"
                  fill="var(--primary)"
                  radius={[0, 8, 8, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card className="miles-card mb-5">
        <CardHeader>
          <CardTitle className="text-base">Викладачі</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Викладач</th>
                  <th className="p-3">Учні</th>
                  <th className="p-3">Заняття</th>
                  <th className="p-3">Проведено</th>
                  <th className="p-3">Присутність</th>
                  <th className="p-3">Відвідування учнів</th>
                  <th className="p-3 text-right">Оплати</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.teacherStats.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <Link
                        href={`/teachers/${teacher.id}`}
                        className="flex items-center gap-2 font-medium hover:text-primary"
                      >
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: teacher.color }}
                        />
                        {teacher.name}
                      </Link>
                    </td>
                    <td className="p-3">{teacher.students}</td>
                    <td className="p-3">{teacher.events}</td>
                    <td className="p-3">{teacher.completed}</td>
                    <td className="p-3">
                      <Badge variant="outline">
                        {teacher.present}/{teacher.present + teacher.absent}
                      </Badge>
                    </td>
                    <td className="p-3">{teacher.clientVisits}</td>
                    <td className="p-3 text-right font-semibold">
                      {money(teacher.collectedCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card className="miles-card mb-5">
        <CardHeader>
          <CardTitle className="text-base">Хто приймав оплати</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data?.collectorStats.map((collector) => (
            <div
              key={collector.id}
              className="flex items-center justify-between rounded-xl bg-muted/60 p-4"
            >
              <div>
                <p className="font-medium">{collector.name}</p>
                <p className="text-xs text-muted-foreground">
                  {collector.payments} операцій
                </p>
              </div>
              <p className="font-semibold">{money(collector.amountCents)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="miles-card">
        <CardHeader>
          <CardTitle className="text-base">Клієнти</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Клієнт</th>
                  <th className="p-3">Відвідано</th>
                  <th className="p-3">Пропущено</th>
                  <th className="p-3">Активні абонементи</th>
                  <th className="p-3 text-right">Сплачено</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.clientStats.map((client) => (
                  <tr key={client.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="p-3">{client.present}</td>
                    <td className="p-3">{client.absent}</td>
                    <td className="p-3">{client.activeSubscriptions}</td>
                    <td className="p-3 text-right font-semibold">
                      {money(client.paidCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
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
