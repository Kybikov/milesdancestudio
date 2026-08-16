"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { money } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Banknote, CreditCard, TicketCheck, Users } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  events: { type: string; _count: number }[]
}
const names: Record<string, string> = {
  SUBSCRIPTION: "Абонементи",
  DROP_IN: "Разові",
  INDIVIDUAL: "Персональні",
  RENTAL: "Оренда",
  LIGHT: "Світло",
  SHOOTING: "Зйомки",
  OTHER: "Інше",
}
export default function StatisticsPage() {
  const query = useQuery({
    queryKey: ["statistics"],
    queryFn: () => api<Stats>("/statistics"),
  })
  const data = query.data
  const chart =
    data?.categories.map((item) => ({
      name: names[item.category] ?? item.category,
      value: (item._sum.amountCents ?? 0) / 100,
    })) ?? []
  return (
    <div>
      <PageHeader
        title="Статистика"
        description="Фактично отримані кошти за поточний місяць."
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Banknote}
          label="Загальний дохід"
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
          icon={Banknote}
          label="Готівка"
          value={money(
            data?.methods.find((item) => item.method === "CASH")?._sum
              .amountCents
          )}
        />
        <Metric
          icon={TicketCheck}
          label="Операцій"
          value={data?.payments._count ?? 0}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
        <Card className="miles-card">
          <CardHeader>
            <CardTitle className="text-base">Дохід за категоріями</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => money(Number(value) * 100)} />
                <Bar
                  dataKey="value"
                  fill="var(--primary)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card className="miles-card">
            <CardHeader>
              <CardTitle className="text-base">Абонементи</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.subscriptions.map((item) => (
                <div className="flex justify-between text-sm" key={item.status}>
                  <span>{item.status}</span>
                  <strong>{item._count}</strong>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="miles-card">
            <CardHeader>
              <CardTitle className="text-base">Відвідування</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.attendance.map((item) => (
                <div className="flex justify-between text-sm" key={item.status}>
                  <span>{item.status === "PRESENT" ? "Були" : "Не були"}</span>
                  <strong>{item._count}</strong>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
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
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
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
