"use client"

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
import { Plus, TicketCheck } from "lucide-react"
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
  return (
    <div>
      <PageHeader
        title="Абонементи"
        description="Залишки, строки, спільні напрямки та згорання."
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {subscriptions.data?.map((item) => (
          <Card key={item.id} className="miles-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {item.client.firstName} {item.client.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.productName}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="my-4 rounded-xl bg-muted/60 p-4">
                <p className="text-xs text-muted-foreground">Залишилося</p>
                <p className="text-3xl font-semibold">
                  {item.remainingLessons}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    / {item.totalLessons}
                  </span>
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.max(0, (item.remainingLessons / item.totalLessons) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {date(item.startDate)} — {date(item.endDate)}
                </span>
                <span>{money(item.priceCents)}</span>
              </div>
              {item.burnedLessons > 0 && (
                <p className="mt-2 text-xs text-rose-600">
                  Не використано та згоріло: {item.burnedLessons}
                </p>
              )}
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
