"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
type Role = {
  id: string
  code: string
  name: string
  description?: string
  isSystem: boolean
  permissions: {
    permission: { id: string; code: string; description: string }
  }[]
  _count: { users: number }
}
type Permission = { id: string; code: string; description: string }
type User = {
  id: string
  email: string
  displayName: string
  isActive: boolean
  mustChangePassword: boolean
  roles: { role: Role }[]
}
export default function UsersPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [roleId, setRoleId] = useState("")
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api<User[]>("/admin/users"),
  })
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: () =>
      api<{ roles: Role[]; permissions: Permission[] }>("/admin/roles"),
  })
  const create = useMutation({
    mutationFn: (data: object) =>
      api("/admin/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] })
      setAdding(false)
      toast.success("Користувача створено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const savePermissions = useMutation({
    mutationFn: ({
      id,
      permissionIds,
    }: {
      id: string
      permissionIds: string[]
    }) =>
      api(`/admin/roles/${id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissionIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] })
      toast.success("Дозволи оновлено")
    },
    onError: (error: Error) => toast.error(error.message),
  })
  return (
    <div>
      <PageHeader
        title="Ролі й доступи"
        description="Дозволи перевіряються і в інтерфейсі, і на кожному API endpoint."
        action={
          <Button onClick={() => setAdding(!adding)}>
            <Plus />
            Користувач
          </Button>
        }
      />
      {adding && (
        <Card className="miles-card mb-5">
          <CardHeader>
            <CardTitle className="text-base">Новий користувач</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault()
                const f = new FormData(event.currentTarget)
                create.mutate({
                  displayName: f.get("name"),
                  email: f.get("email"),
                  password: f.get("password"),
                  roleIds: [roleId],
                })
              }}
            >
              <Field label="Ім’я">
                <Input name="name" required />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" required />
              </Field>
              <Field label="Початковий пароль">
                <Input
                  name="password"
                  type="password"
                  minLength={12}
                  required
                />
              </Field>
              <div className="space-y-2">
                <Label>Роль</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                  required
                >
                  <option value="">Оберіть</option>
                  {roles.data?.roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={!roleId}>
                Створити
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {users.data?.map((user) => (
          <Card key={user.id} className="miles-card">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid size-11 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                {user.displayName.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{user.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <div className="text-right">
                {user.roles.map(({ role }) => (
                  <Badge key={role.id}>{role.name}</Badge>
                ))}
                {user.mustChangePassword && (
                  <p className="mt-1 text-[10px] text-amber-600">
                    Змінити пароль
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 text-lg font-semibold">Матриця дозволів</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        {roles.data?.roles.map((role) => (
          <Card key={role.id} className="miles-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <CardTitle className="text-base">{role.name}</CardTitle>
                <Badge variant="outline">
                  {role._count.users} користувачів
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  const f = new FormData(event.currentTarget)
                  savePermissions.mutate({
                    id: role.id,
                    permissionIds:
                      roles.data?.permissions
                        .filter((item) => f.get(`p-${item.id}`))
                        .map((item) => item.id) ?? [],
                  })
                }}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {roles.data?.permissions.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex items-start gap-2 rounded-xl border p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        name={`p-${permission.id}`}
                        defaultChecked={role.permissions.some(
                          (item) => item.permission.id === permission.id
                        )}
                        disabled={role.code === "OWNER"}
                      />
                      <span>
                        <strong className="block text-xs">
                          {permission.code}
                        </strong>
                        <span className="text-xs text-muted-foreground">
                          {permission.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {role.code !== "OWNER" && (
                  <Button type="submit" className="mt-3">
                    Зберегти дозволи
                  </Button>
                )}
              </form>
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
