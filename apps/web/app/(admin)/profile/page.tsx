"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, SessionUser } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound, Save, ShieldCheck, UserRound } from "lucide-react"
import { toast } from "sonner"

export default function ProfilePage() {
  const qc = useQueryClient()
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: SessionUser }>("/auth/me"),
  })
  const update = useMutation({
    mutationFn: (data: object) =>
      api("/auth/profile", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] })
      toast.success("Профіль оновлено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const password = useMutation({
    mutationFn: (data: object) =>
      api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] })
      toast.success("Пароль змінено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const user = me.data?.user
  if (!user) return null
  return (
    <div>
      <PageHeader
        title="Особистий профіль"
        description="Ваші дані та безпека входу."
      />
      {user.mustChangePassword && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Змініть тимчасовий пароль перед початком роботи.
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[.7fr_1.3fr]">
        <Card className="miles-card">
          <CardContent className="flex flex-col items-center p-6 text-center">
            <Avatar className="size-24">
              <AvatarImage src={user.avatarPath ?? undefined} />
              <AvatarFallback className="text-2xl">
                {user.displayName.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-xl font-semibold">{user.displayName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {user.roles.map((role) => (
                <Badge key={role} variant="secondary">
                  <ShieldCheck />{" "}
                  {role === "OWNER" ? "Власниця" : "Адміністратор"}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card className="miles-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="text-primary" /> Дані профілю
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const form = new FormData(event.currentTarget)
                  update.mutate({ displayName: form.get("displayName") })
                }}
              >
                <Field label="Ім’я">
                  <Input
                    name="displayName"
                    defaultValue={user.displayName}
                    required
                  />
                </Field>
                <Field label="Email">
                  <Input value={user.email} disabled />
                </Field>
                <Button
                  type="submit"
                  className="sm:col-span-2 sm:w-fit"
                  disabled={update.isPending}
                >
                  <Save /> Зберегти
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card className="miles-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="text-primary" /> Зміна пароля
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const form = new FormData(event.currentTarget)
                  const currentPassword = String(form.get("currentPassword"))
                  const newPassword = String(form.get("newPassword"))
                  const confirmPassword = String(form.get("confirmPassword"))
                  if (newPassword !== confirmPassword)
                    return toast.error("Нові паролі не збігаються")
                  password.mutate({ currentPassword, newPassword })
                  event.currentTarget.reset()
                }}
              >
                <Field label="Поточний пароль">
                  <Input
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </Field>
                <div className="hidden sm:block" />
                <Field label="Новий пароль">
                  <Input
                    name="newPassword"
                    type="password"
                    minLength={12}
                    autoComplete="new-password"
                    required
                  />
                </Field>
                <Field label="Повторіть пароль">
                  <Input
                    name="confirmPassword"
                    type="password"
                    minLength={12}
                    autoComplete="new-password"
                    required
                  />
                </Field>
                <Button
                  type="submit"
                  className="sm:col-span-2 sm:w-fit"
                  disabled={password.isPending}
                >
                  <KeyRound /> Змінити пароль
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
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
