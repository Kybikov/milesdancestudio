"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { date, money } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  AtSign as Instagram,
  Pencil,
  Phone,
  Plus,
  Send,
  X,
} from "lucide-react"
import { toast } from "sonner"

type ClientDetailsData = {
  firstName: string
  lastName: string
  phone: string
  instagram?: string
  telegramChatId?: string
  comment?: string
  groups: {
    group: {
      id: string
      name: string
      teacher: { name: string }
      direction: { name: string }
    }
  }[]
  subscriptions: {
    id: string
    productName: string
    totalLessons: number
    remainingLessons: number
    burnedLessons: number
    startDate: string
    endDate: string
    status: string
  }[]
  payments: {
    id: string
    purpose: string
    amountCents: number
    paidAt: string
    status: string
    method: string
  }[]
  charges: {
    id: string
    amountCents: number
    paidCents: number
    status: string
    charge: { title: string; eventDate: string }
  }[]
}
type Group = { id: string; name: string }

export function ClientDetails({ id }: { id: string }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const query = useQuery({
    queryKey: ["client", id],
    queryFn: () => api<ClientDetailsData>(`/clients/${id}`),
  })
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<Group[]>("/groups"),
  })
  const update = useMutation({
    mutationFn: (data: object) =>
      api(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", id] })
      setEditing(false)
      toast.success("Картку клієнта оновлено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const addGroup = useMutation({
    mutationFn: (groupId: string) =>
      api(`/groups/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ clientId: id }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", id] })
      toast.success("Клієнта додано до групи")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const removeGroup = useMutation({
    mutationFn: (groupId: string) =>
      api(`/groups/${groupId}/members/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", id] })
      toast.success("Клієнта вилучено з групи")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const client = query.data
  if (!client)
    return <p className="text-sm text-muted-foreground">Завантаження…</p>
  return (
    <div>
      <PageHeader
        title={`${client.firstName} ${client.lastName}`}
        description="Повна картка клієнта"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(!editing)}>
              <Pencil />
              Редагувати
            </Button>
            <Button variant="outline" render={<Link href="/clients" />}>
              <ArrowLeft />
              До списку
            </Button>
          </div>
        }
      />
      {editing && (
        <Card className="miles-card mb-5">
          <CardContent className="p-4">
            <form
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault()
                const f = new FormData(event.currentTarget)
                update.mutate({
                  firstName: f.get("firstName"),
                  lastName: f.get("lastName"),
                  phone: f.get("phone"),
                  instagram: f.get("instagram") || null,
                  telegramChatId: f.get("telegramChatId") || null,
                  comment: f.get("comment") || null,
                })
              }}
            >
              <Input
                name="firstName"
                defaultValue={client.firstName}
                required
              />
              <Input name="lastName" defaultValue={client.lastName} required />
              <Input name="phone" defaultValue={client.phone} required />
              <Input name="instagram" defaultValue={client.instagram} />
              <Input
                name="telegramChatId"
                defaultValue={client.telegramChatId}
                placeholder="Telegram chat ID"
              />
              <Input
                name="comment"
                defaultValue={client.comment}
                placeholder="Коментар"
              />
              <Button type="submit">Зберегти зміни</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="mb-5 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <Card className="miles-card">
          <CardHeader>
            <CardTitle className="text-base">Контакти</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-2">
              <Phone className="size-4 text-primary" />
              {client.phone}
            </p>
            {client.instagram && (
              <p className="flex items-center gap-2">
                <Instagram className="size-4 text-primary" />
                {client.instagram}
              </p>
            )}
            <p className="flex items-center gap-2">
              <Send className="size-4 text-primary" />
              {client.telegramChatId || "Telegram не підключено"}
            </p>
            {client.comment && (
              <p className="rounded-xl bg-muted p-3 text-muted-foreground">
                {client.comment}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="miles-card">
          <CardHeader>
            <CardTitle className="text-base">Групи</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="mb-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const groupId = String(
                  new FormData(event.currentTarget).get("groupId")
                )
                if (groupId) addGroup.mutate(groupId)
              }}
            >
              <select
                name="groupId"
                className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Додати до групи…</option>
                {groups.data
                  ?.filter(
                    (group) =>
                      !client.groups.some((item) => item.group.id === group.id)
                  )
                  .map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
              </select>
              <Button type="submit" size="icon" variant="outline">
                <Plus />
              </Button>
            </form>
            <div className="grid gap-2 sm:grid-cols-2">
              {client.groups.map(({ group }) => (
                <div
                  className="flex items-start rounded-xl border p-3"
                  key={group.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.teacher.name}
                    </p>
                    <Badge variant="secondary" className="mt-2">
                      {group.direction.name}
                    </Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeGroup.mutate(group.id)}
                  >
                    <X className="size-4 text-rose-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="miles-card mb-5">
        <CardHeader>
          <CardTitle className="text-base">Абонементи</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {client.subscriptions.map((item) => (
            <div key={item.id} className="rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {date(item.startDate)} — {date(item.endDate)}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <p className="text-2xl font-semibold">
                  {item.remainingLessons}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {item.totalLessons}
                  </span>
                </p>
                {item.burnedLessons > 0 && (
                  <p className="text-xs text-rose-600">
                    Згоріло: {item.burnedLessons}
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="miles-card">
          <CardHeader>
            <CardTitle className="text-base">Оплати</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.payments.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-muted/60 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{item.purpose}</p>
                  <p className="text-xs text-muted-foreground">
                    {date(item.paidAt)} ·{" "}
                    {item.method === "CASH" ? "Готівка" : "Картка"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(item.amountCents)}</p>
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="miles-card">
          <CardHeader>
            <CardTitle className="text-base">Додаткові збори</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.charges.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-muted/60 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{item.charge.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {date(item.charge.eventDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {money(item.paidCents)} / {money(item.amountCents)}
                  </p>
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
