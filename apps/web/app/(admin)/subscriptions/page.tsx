"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { date, money } from "@/lib/format"
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
import {
  CalendarClock,
  CheckCircle2,
  Plus,
  RefreshCw,
  TicketCheck,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

type Product = {
  id: string
  name: string
  lessonsCount: number
  validityDays: number
  priceCents: number
  isActive: boolean
}
type Client = { id: string; firstName: string; lastName: string }
type Teacher = { id: string; name: string }
type Direction = { id: string; name: string }
type Subscription = {
  id: string
  productName: string
  priceCents: number
  totalLessons: number
  remainingLessons: number
  burnedLessons: number
  startDate: string
  endDate: string
  status: string
  client: Client
}

export default function SubscriptionsPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [clientId, setClientId] = useState("")
  const [productId, setProductId] = useState("")
  const [teacherId, setTeacherId] = useState("")
  const [directionId, setDirectionId] = useState("")
  const [method, setMethod] = useState("CARD")
  const [renewingId, setRenewingId] = useState<string | null>(null)
  const [renewalMethod, setRenewalMethod] = useState("CARD")
  const subscriptions = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => api<Subscription[]>("/subscriptions"),
  })
  const products = useQuery({
    queryKey: ["products"],
    queryFn: () => api<Product[]>("/products"),
  })
  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: () => api<Client[]>("/clients"),
  })
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
      api("/subscriptions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] })
      setAdding(false)
      toast.success("Абонемент оформлено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const renew = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api(`/subscriptions/${id}/renew`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] })
      qc.invalidateQueries({ queryKey: ["notifications"] })
      setRenewingId(null)
      toast.success("Абонемент продовжено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const columns = [
    {
      id: "expiring",
      title: "Завершуються",
      icon: CalendarClock,
      tone: "text-amber-600 bg-amber-50",
      items:
        subscriptions.data?.filter((item) => item.status === "EXPIRING") ?? [],
    },
    {
      id: "active",
      title: "Активні",
      icon: CheckCircle2,
      tone: "text-emerald-600 bg-emerald-50",
      items:
        subscriptions.data?.filter((item) => item.status === "ACTIVE") ?? [],
    },
    {
      id: "used",
      title: "Використані",
      icon: TicketCheck,
      tone: "text-sky-600 bg-sky-50",
      items: subscriptions.data?.filter((item) => item.status === "USED") ?? [],
    },
    {
      id: "closed",
      title: "Завершені",
      icon: XCircle,
      tone: "text-rose-600 bg-rose-50",
      items:
        subscriptions.data?.filter((item) =>
          ["EXPIRED", "CANCELLED"].includes(item.status)
        ) ?? [],
    },
  ]
  return (
    <div>
      <PageHeader
        title="Абонементи"
        description="Статус кожного абонемента, залишок занять і дата завершення."
        action={
          <Button onClick={() => setAdding(!adding)}>
            <Plus />
            Оформити
          </Button>
        }
      />
      {adding && (
        <Card className="miles-card mb-5">
          <CardHeader>
            <CardTitle className="text-base">Новий абонемент</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault()
                const f = new FormData(event.currentTarget)
                const product = products.data?.find(
                  (item) => item.id === productId
                )
                create.mutate({
                  clientId,
                  productId,
                  startDate: new Date(String(f.get("startDate"))).toISOString(),
                  teacherIds: teacherId ? [teacherId] : [],
                  directionIds: directionId ? [directionId] : [],
                  groupIds: [],
                  payment: { method, amountCents: product?.priceCents ?? 0 },
                })
              }}
            >
              <Field label="Клієнт">
                <Select
                  value={clientId}
                  onValueChange={(value) => value && setClientId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть клієнта" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.data?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.firstName} {item.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Продукт">
                <Select
                  value={productId}
                  onValueChange={(value) => value && setProductId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть продукт" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.data
                      ?.filter((item) => item.isActive && item.lessonsCount)
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} · {money(item.priceCents)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Дата початку">
                <Input
                  name="startDate"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </Field>
              <Field label="Викладач (необов’язково)">
                <Select
                  value={teacherId}
                  onValueChange={(value) => setTeacherId(value ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Будь-який" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.data?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Напрямок (необов’язково)">
                <Select
                  value={directionId}
                  onValueChange={(value) => setDirectionId(value ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Будь-який" />
                  </SelectTrigger>
                  <SelectContent>
                    {directions.data?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Оплата">
                <Select
                  value={method}
                  onValueChange={(value) => value && setMethod(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CARD">Картка / термінал</SelectItem>
                    <SelectItem value="CASH">Готівка</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Button
                type="submit"
                className="self-end"
                disabled={!clientId || !productId || create.isPending}
              >
                <TicketCheck />
                Оформити й оплатити
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div className="grid min-w-max auto-cols-[minmax(280px,85vw)] grid-flow-col items-start gap-4 lg:min-w-[1120px] lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-4">
          {columns.map((column) => (
            <section
              key={column.id}
              className="rounded-2xl border bg-muted/25 p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`grid size-8 place-items-center rounded-lg ${column.tone}`}
                  >
                    <column.icon className="size-4" />
                  </div>
                  <h2 className="text-sm font-semibold">{column.title}</h2>
                </div>
                <span className="rounded-full border bg-background px-2 py-0.5 text-xs">
                  {column.items.length}
                </span>
              </div>
              <div className="space-y-3">
                {column.items.map((item) => (
                  <Card key={item.id} className="border bg-card shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/clients/${item.client.id}`}
                            className="font-semibold hover:text-primary"
                          >
                            {item.client.firstName} {item.client.lastName}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.productName}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="my-3 rounded-xl bg-muted/60 p-3">
                        <div className="flex items-end justify-between">
                          <p className="text-2xl font-semibold">
                            {item.remainingLessons}
                            <span className="text-sm font-normal text-muted-foreground">
                              {" "}
                              / {item.totalLessons}
                            </span>
                          </p>
                          <span className="text-xs text-muted-foreground">
                            занять
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.max(0, (item.remainingLessons / item.totalLessons) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        До {date(item.endDate)} · {daysUntil(item.endDate)}
                      </p>
                      <p className="mt-1 text-xs font-medium">
                        {money(item.priceCents)}
                      </p>
                      {item.burnedLessons > 0 && (
                        <p className="mt-2 text-xs text-rose-600">
                          Згоріло занять: {item.burnedLessons}
                        </p>
                      )}
                      {item.status !== "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 w-full"
                          onClick={() =>
                            setRenewingId(
                              renewingId === item.id ? null : item.id
                            )
                          }
                        >
                          <RefreshCw /> Продовжити
                        </Button>
                      )}
                      {renewingId === item.id && (
                        <form
                          className="mt-3 space-y-3 rounded-xl border bg-muted/40 p-3"
                          onSubmit={(event) => {
                            event.preventDefault()
                            const form = new FormData(event.currentTarget)
                            const paid = form.get("paid") === "on"
                            renew.mutate({
                              id: item.id,
                              data: {
                                startDate: new Date(
                                  String(form.get("startDate"))
                                ).toISOString(),
                                payment: paid
                                  ? {
                                      method: renewalMethod,
                                      amountCents: item.priceCents,
                                    }
                                  : undefined,
                              },
                            })
                          }}
                        >
                          <Field label="Початок нового абонемента">
                            <Input
                              name="startDate"
                              type="date"
                              defaultValue={new Date()
                                .toISOString()
                                .slice(0, 10)}
                              required
                            />
                          </Field>
                          <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" name="paid" defaultChecked />
                            Оплату отримано
                          </label>
                          <Select
                            value={renewalMethod}
                            onValueChange={(value) =>
                              value && setRenewalMethod(value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CARD">
                                Картка / термінал
                              </SelectItem>
                              <SelectItem value="CASH">Готівка</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              type="submit"
                              disabled={renew.isPending}
                            >
                              Підтвердити
                            </Button>
                            <Button
                              size="sm"
                              type="button"
                              variant="ghost"
                              onClick={() => setRenewingId(null)}
                            >
                              Назад
                            </Button>
                          </div>
                        </form>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {!column.items.length && (
                  <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                    Немає абонементів
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function daysUntil(value: string) {
  const diff = Math.ceil(
    (new Date(value).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000
  )
  if (diff < 0) return `${Math.abs(diff)} дн. тому`
  if (diff === 0) return "сьогодні"
  return `${diff} дн.`
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
