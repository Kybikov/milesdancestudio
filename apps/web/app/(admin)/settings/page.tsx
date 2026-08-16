"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Bot,
  CheckCircle2,
  PackagePlus,
  Save,
  Send,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
type Telegram = {
  configured: boolean
  maskedToken: string | null
  defaultChatId: string
}
type Product = {
  id: string
  name: string
  lessonsCount: number | null
  validityDays: number | null
  priceCents: number
  isDropIn: boolean
  isActive: boolean
  tariffGroup: number | null
}
export default function SettingsPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const telegram = useQuery({
    queryKey: ["telegram-settings"],
    queryFn: () => api<Telegram>("/settings/telegram"),
  })
  const products = useQuery({
    queryKey: ["products"],
    queryFn: () => api<Product[]>("/products"),
  })
  const saveTelegram = useMutation({
    mutationFn: (data: object) =>
      api("/settings/telegram", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["telegram-settings"] })
      toast.success("Налаштування Telegram збережено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const test = useMutation({
    mutationFn: (chatId: string) =>
      api("/settings/telegram/test", {
        method: "POST",
        body: JSON.stringify({ chatId }),
      }),
    onSuccess: () => toast.success("Тестове повідомлення надіслано"),
    onError: (error: Error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: () => api("/settings/telegram/token", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["telegram-settings"] })
      toast.success("Токен видалено")
    },
  })
  const createProduct = useMutation({
    mutationFn: (data: object) =>
      api("/products", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] })
      setAdding(false)
      toast.success("Продукт додано")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const updateProduct = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api(`/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] })
      toast.success("Продукт оновлено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  return (
    <div>
      <PageHeader
        title="Налаштування"
        description="Продукти, тарифи та захищені інтеграції."
      />
      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Card className="miles-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-sky-50 text-sky-600">
                <Bot />
              </div>
              <div>
                <CardTitle className="text-base">Telegram-бот</CardTitle>
                <CardDescription>Доступ має лише власниця.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                const f = new FormData(event.currentTarget)
                saveTelegram.mutate({
                  token: f.get("token") || undefined,
                  defaultChatId: f.get("chatId") || "",
                })
              }}
            >
              <Field label="Bot token">
                <Input
                  name="token"
                  type="password"
                  placeholder={
                    telegram.data?.maskedToken ?? "Вставте токен від BotFather"
                  }
                />
              </Field>
              <Field label="Chat ID за замовчуванням">
                <Input
                  name="chatId"
                  defaultValue={telegram.data?.defaultChatId}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">
                  <Save />
                  Зберегти
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>(
                      'input[name="chatId"]'
                    )
                    test.mutate(input?.value ?? "")
                  }}
                  disabled={!telegram.data?.configured}
                >
                  <Send />
                  Надіслати тест
                </Button>
                {telegram.data?.configured && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => remove.mutate()}
                  >
                    <Trash2 className="text-rose-500" />
                    Видалити токен
                  </Button>
                )}
              </div>
              {telegram.data?.configured && (
                <p className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="size-4" />
                  Токен зашифрований і налаштований
                </p>
              )}
            </form>
          </CardContent>
        </Card>
        <Card className="miles-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Товари та послуги</CardTitle>
                <CardDescription>
                  Ціни й строки не зашиті в код.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setAdding(!adding)}>
                <PackagePlus />
                Додати
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {adding && (
              <form
                className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const f = new FormData(event.currentTarget)
                  createProduct.mutate({
                    name: f.get("name"),
                    lessonsCount: Number(f.get("lessons")) || null,
                    validityDays: Number(f.get("days")) || null,
                    priceCents: Number(f.get("price")) * 100,
                    tariffGroup: Number(f.get("tariff")) || null,
                    isDropIn: Number(f.get("lessons")) === 1,
                  })
                }}
              >
                <Input name="name" placeholder="Назва" required />
                <Input
                  name="price"
                  type="number"
                  placeholder="Ціна, грн"
                  required
                />
                <Input
                  name="lessons"
                  type="number"
                  placeholder="Кількість занять"
                />
                <Input name="days" type="number" placeholder="Днів дії" />
                <Input
                  name="tariff"
                  type="number"
                  placeholder="Тарифна група"
                />
                <Button type="submit">Створити</Button>
              </form>
            )}
            {products.data?.map((item) => (
              <form
                key={item.id}
                className="grid items-center gap-2 rounded-xl bg-muted/60 p-3 sm:grid-cols-[1fr_110px_auto]"
                onSubmit={(event) => {
                  event.preventDefault()
                  const f = new FormData(event.currentTarget)
                  updateProduct.mutate({
                    id: item.id,
                    data: {
                      name: f.get("name"),
                      priceCents: Number(f.get("price")) * 100,
                    },
                  })
                }}
              >
                <div>
                  <Input
                    name="name"
                    defaultValue={item.name}
                    className="border-0 bg-transparent px-0 font-medium shadow-none"
                  />
                  <div className="flex gap-1 text-xs text-muted-foreground">
                    {item.lessonsCount && (
                      <Badge variant="outline">
                        {item.lessonsCount} занять
                      </Badge>
                    )}
                    {item.validityDays && (
                      <Badge variant="outline">{item.validityDays} днів</Badge>
                    )}
                  </div>
                </div>
                <Input
                  name="price"
                  type="number"
                  defaultValue={item.priceCents / 100}
                />
                <Button type="submit" size="icon" variant="ghost">
                  <Save className="size-4" />
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
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
