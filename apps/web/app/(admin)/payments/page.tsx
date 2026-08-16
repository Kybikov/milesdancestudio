"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, SessionUser } from "@/lib/api"
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
import { Banknote, CreditCard, Plus, RotateCcw } from "lucide-react"
import { toast } from "sonner"

type Client = { id: string; firstName: string; lastName: string }
type Payment = {
  id: string
  amountCents: number
  category: string
  method: string
  purpose: string
  paidAt: string
  status: string
  cancelReason?: string
  client?: Client
  createdBy: { displayName: string }
}
const categories: Record<string, string> = {
  SUBSCRIPTION: "Абонемент",
  DROP_IN: "Разове",
  INDIVIDUAL: "Персональне",
  RENTAL: "Оренда",
  LIGHT: "Світло",
  SHOOTING: "Зйомка",
  OTHER: "Інше",
}

export default function PaymentsPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [clientId, setClientId] = useState("")
  const [category, setCategory] = useState("SUBSCRIPTION")
  const [method, setMethod] = useState("CARD")
  const [resultStatus, setResultStatus] = useState("CONFIRMED")
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const payments = useQuery({
    queryKey: ["payments"],
    queryFn: () => api<Payment[]>("/payments"),
  })
  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: () => api<Client[]>("/clients"),
  })
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: SessionUser }>("/auth/me"),
  })
  const create = useMutation({
    mutationFn: (data: object) =>
      api("/payments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] })
      setCancellingId(null)
      setCancelReason("")
      setAdding(false)
      toast.success(
        resultStatus === "CONFIRMED"
          ? "Оплату підтверджено"
          : "Невдалу оплату зафіксовано"
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/payments/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] })
      toast.success("Платіж скасовано, оригінал збережено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const canCancel = me.data?.user.permissions.includes("payments.cancel")
  return (
    <div>
      <PageHeader
        title="Оплати"
        description="Підтверджені операції не видаляються і не переписуються."
        action={
          <Button onClick={() => setAdding(!adding)}>
            <Plus />
            Додати оплату
          </Button>
        }
      />
      {adding && (
        <Card className="miles-card mb-5">
          <CardHeader>
            <CardTitle className="text-base">Нова оплата</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault()
                const f = new FormData(event.currentTarget)
                create.mutate({
                  clientId: clientId || undefined,
                  amountCents: Number(f.get("amount")) * 100,
                  category,
                  method,
                  status: resultStatus,
                  purpose: f.get("purpose"),
                  paidAt: new Date(String(f.get("paidAt"))).toISOString(),
                })
              }}
            >
              <Field label="Клієнт">
                <Select
                  value={clientId}
                  onValueChange={(value) => setClientId(value ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Необов’язково" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.data?.map((item) => (
                      <SelectItem value={item.id} key={item.id}>
                        {item.firstName} {item.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Категорія">
                <Select
                  value={category}
                  onValueChange={(value) => value && setCategory(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categories).map(([value, label]) => (
                      <SelectItem value={value} key={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Спосіб">
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
              <Field label="Сума, грн">
                <Input name="amount" type="number" min="1" required />
              </Field>
              <Field label="Результат">
                <Select
                  value={resultStatus}
                  onValueChange={(value) => value && setResultStatus(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONFIRMED">Успішна</SelectItem>
                    <SelectItem value="FAILED">Неуспішна</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Призначення">
                <Input name="purpose" required />
              </Field>
              <Field label="Дата">
                <Input
                  name="paidAt"
                  type="datetime-local"
                  defaultValue={new Date(
                    new Date().getTime() -
                      new Date().getTimezoneOffset() * 60000
                  )
                    .toISOString()
                    .slice(0, 16)}
                  required
                />
              </Field>
              <Button
                type="submit"
                className="self-end"
                disabled={create.isPending}
              >
                Підтвердити
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card className="miles-card overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y">
            {payments.data?.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <div
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.method === "CASH" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}
                >
                  {item.method === "CASH" ? (
                    <Banknote className="size-5" />
                  ) : (
                    <CreditCard className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.purpose}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.client
                      ? `${item.client.firstName} ${item.client.lastName} · `
                      : ""}
                    {date(item.paidAt)} · {item.createdBy.displayName}
                  </p>
                  {item.cancelReason && (
                    <p className="mt-1 text-xs text-rose-600">
                      Причина: {item.cancelReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="text-right">
                    <p className="font-semibold">{money(item.amountCents)}</p>
                    <p className="text-xs text-muted-foreground">
                      {categories[item.category]}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                  {canCancel && item.status === "CONFIRMED" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCancellingId(item.id)}
                    >
                      <RotateCcw className="size-4 text-rose-500" />
                    </Button>
                  )}
                </div>
                {cancellingId === item.id && (
                  <div className="flex w-full flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50/50 p-3 sm:flex-row sm:items-end">
                    <Field label="Причина скасування">
                      <Input
                        value={cancelReason}
                        onChange={(event) =>
                          setCancelReason(event.target.value)
                        }
                        className="bg-background"
                        autoFocus
                      />
                    </Field>
                    <Button
                      variant="destructive"
                      disabled={
                        cancelReason.trim().length < 3 || cancel.isPending
                      }
                      onClick={() =>
                        cancel.mutate({
                          id: item.id,
                          reason: cancelReason.trim(),
                        })
                      }
                    >
                      Скасувати платіж
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setCancellingId(null)}
                    >
                      Назад
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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
