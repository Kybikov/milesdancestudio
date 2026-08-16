"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, SessionUser } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { LayoutGrid, List, Plus, Search, Smartphone, TicketCheck } from "lucide-react"
import { toast } from "sonner"

type Client = {
  id: string
  firstName: string
  lastName: string
  phone: string
  instagram?: string
  telegramChatId?: string
  groups: {
    group: {
      name: string
      teacher: { name: string }
      direction: { name: string }
    }
  }[]
  subscriptions: {
    id: string
    productName: string
    remainingLessons: number
    totalLessons: number
    status: string
  }[]
  _count: { payments: number; attendances: number }
}

export default function ClientsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [adding, setAdding] = useState(false)
  const [view, setView] = useState<"cards" | "table">("cards")
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: SessionUser }>("/auth/me"),
  })
  const canWrite = me.data?.user.permissions.includes("clients.write")
  const clients = useQuery({
    queryKey: ["clients", search],
    queryFn: () =>
      api<Client[]>(
        `/clients${search ? `?search=${encodeURIComponent(search)}` : ""}`
      ),
  })
  const create = useMutation({
    mutationFn: (data: object) =>
      api("/clients", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] })
      setAdding(false)
      toast.success("Клієнта додано")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  return (
    <div>
      <PageHeader
        title="Клієнти"
        description="База клієнтів, групи, абонементи та контакти."
        action={canWrite ? (
          <Button onClick={() => setAdding(!adding)}>
            <Plus />
            Новий клієнт
          </Button>
        ) : undefined}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-10"
            placeholder="Пошук за ім’ям або телефоном"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex rounded-xl border bg-card p-1">
          <Button
            size="sm"
            variant={view === "cards" ? "secondary" : "ghost"}
            onClick={() => setView("cards")}
          >
            <LayoutGrid /> Картки
          </Button>
          <Button
            size="sm"
            variant={view === "table" ? "secondary" : "ghost"}
            onClick={() => setView("table")}
          >
            <List /> Таблиця
          </Button>
        </div>
      </div>
      {adding && (
        <Card className="miles-card mb-5">
          <CardHeader>
            <CardTitle className="text-base">Новий клієнт</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault()
                const f = new FormData(event.currentTarget)
                create.mutate({
                  firstName: f.get("firstName"),
                  lastName: f.get("lastName"),
                  phone: f.get("phone"),
                  instagram: f.get("instagram") || undefined,
                  telegramChatId: f.get("telegramChatId") || undefined,
                  comment: f.get("comment") || undefined,
                })
              }}
            >
              <Field label="Ім’я">
                <Input name="firstName" required />
              </Field>
              <Field label="Прізвище">
                <Input name="lastName" required />
              </Field>
              <Field label="Телефон">
                <Input name="phone" required />
              </Field>
              <Field label="Instagram">
                <Input name="instagram" />
              </Field>
              <Field label="Telegram chat ID">
                <Input name="telegramChatId" />
              </Field>
              <Field label="Коментар">
                <Input name="comment" />
              </Field>
              <Button type="submit" disabled={create.isPending}>
                Зберегти
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      {view === "table" ? (
        <Card className="miles-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Клієнт</th>
                  <th className="px-4 py-3 font-medium">Телефон</th>
                  <th className="px-4 py-3 font-medium">Курс</th>
                  <th className="px-4 py-3 font-medium">Абонемент</th>
                  <th className="px-4 py-3 text-right font-medium">Відвідувань</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.data?.map((client) => {
                  const subscription = client.subscriptions.find((item) =>
                    ["ACTIVE", "EXPIRING"].includes(item.status)
                  )
                  return (
                    <tr key={client.id} className="transition hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link className="font-semibold hover:text-primary" href={`/clients/${client.id}`}>
                          {client.firstName} {client.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{client.phone}</td>
                      <td className="px-4 py-3">{client.groups[0]?.group.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {subscription ? (
                          <div className="flex items-center gap-2">
                            <StatusBadge status={subscription.status} />
                            <span>{subscription.remainingLessons}/{subscription.totalLessons}</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{client._count.attendances}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {clients.data?.map((client) => {
          const subscription = client.subscriptions.find((item) =>
            ["ACTIVE", "EXPIRING"].includes(item.status)
          )
          return (
            <Link href={`/clients/${client.id}`} key={client.id}>
              <Card className="miles-card h-full transition hover:-translate-y-0.5 hover:border-primary/40">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                      {client.firstName[0]}
                      {client.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {client.firstName} {client.lastName}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Smartphone className="size-3" />
                        {client.phone}
                      </p>
                    </div>
                    {subscription && (
                      <StatusBadge status={subscription.status} />
                    )}
                  </div>
                  <div className="mt-4 rounded-xl bg-muted/60 p-3">
                    {subscription ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {subscription.productName}
                          </p>
                          <p className="mt-1 font-semibold">
                            {subscription.remainingLessons} з{" "}
                            {subscription.totalLessons} занять
                          </p>
                        </div>
                        <TicketCheck className="size-5 text-primary" />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Немає активного абонемента
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {client.groups.slice(0, 3).map(({ group }) => (
                      <Badge key={group.name} variant="outline">
                        {group.direction.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
      )}
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
