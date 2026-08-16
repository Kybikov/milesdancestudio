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
import { Check, Plus } from "lucide-react"
import { toast } from "sonner"
type Client = { id: string; firstName: string; lastName: string }
type Charge = {
  id: string
  title: string
  eventDate: string
  amountCents: number
  comment?: string
  clients: {
    id: string
    amountCents: number
    paidCents: number
    status: string
    client: Client
  }[]
}
export default function ChargesPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const charges = useQuery({
    queryKey: ["charges"],
    queryFn: () => api<Charge[]>("/extra-charges"),
  })
  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: () => api<Client[]>("/clients"),
  })
  const create = useMutation({
    mutationFn: (data: object) =>
      api("/extra-charges", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["charges"] })
      setAdding(false)
      toast.success("Нарахування створено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const pay = useMutation({
    mutationFn: ({ id, paidCents }: { id: string; paidCents: number }) =>
      api(`/client-charges/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ paidCents }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["charges"] })
      toast.success("Оплату збору оновлено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  return (
    <div>
      <PageHeader
        title="Додаткові збори"
        description="Зйомки та інші групові витрати без списання абонемента."
        action={
          <Button onClick={() => setAdding(!adding)}>
            <Plus />
            Створити
          </Button>
        }
      />
      {adding && (
        <Card className="miles-card mb-5">
          <CardHeader>
            <CardTitle className="text-base">Нове нарахування</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault()
                const f = new FormData(event.currentTarget)
                create.mutate({
                  title: f.get("title"),
                  eventDate: new Date(String(f.get("eventDate"))).toISOString(),
                  amountCents: Number(f.get("amount")) * 100,
                  comment: f.get("comment") || undefined,
                  clientIds:
                    clients.data
                      ?.filter((item) => f.get(`c-${item.id}`))
                      .map((item) => item.id) ?? [],
                })
              }}
            >
              <Field label="Назва">
                <Input name="title" required />
              </Field>
              <Field label="Дата">
                <Input name="eventDate" type="date" required />
              </Field>
              <Field label="Сума з людини, грн">
                <Input name="amount" type="number" min="1" required />
              </Field>
              <Field label="Коментар">
                <Input name="comment" />
              </Field>
              <div className="sm:col-span-2 xl:col-span-4">
                <Label>Учасники</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {clients.data?.map((item) => (
                    <label
                      className="flex items-center gap-2 rounded-xl border bg-card p-3 text-sm"
                      key={item.id}
                    >
                      <input type="checkbox" name={`c-${item.id}`} />
                      {item.firstName} {item.lastName}
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit">Створити нарахування</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {charges.data?.map((charge) => (
          <Card className="miles-card" key={charge.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{charge.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {date(charge.eventDate)} · {money(charge.amountCents)} з
                    людини
                  </p>
                </div>
                <strong>
                  {money(
                    charge.clients.reduce(
                      (sum, item) => sum + item.paidCents,
                      0
                    )
                  )}
                </strong>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {charge.clients.map((item) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/60 p-3"
                  key={item.id}
                >
                  <span className="text-sm">
                    {item.client.firstName} {item.client.lastName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {money(item.paidCents)} / {money(item.amountCents)}
                    </span>
                    <StatusBadge status={item.status} />
                    {item.status !== "PAID" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          pay.mutate({
                            id: item.id,
                            paidCents: item.amountCents,
                          })
                        }
                      >
                        <Check />
                        Сплачено
                      </Button>
                    )}
                  </div>
                </div>
              ))}
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
