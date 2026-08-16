"use client"

import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const login = useMutation({
    mutationFn: () =>
      api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: () => router.replace("/dashboard"),
    onError: (error: Error) => toast.error(error.message),
  })
  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_.9fr]">
      <section className="relative hidden overflow-hidden bg-stone-950 lg:block">
        <Image
          src="/owner-avatar.png"
          alt="Олександра Майлс"
          fill
          priority
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/15 to-transparent" />
        <div className="absolute bottom-12 left-12 max-w-lg text-white">
          <p className="mb-3 text-sm font-medium tracking-[.3em] text-pink-200 uppercase">
            Miles Dance Studio
          </p>
          <h1 className="text-5xl leading-tight font-semibold">
            Ритм студії — в одному місці
          </h1>
          <p className="mt-4 text-lg text-white/70">
            Абонементи, заняття, клієнти та фінанси без ручних таблиць.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-10">
        <Card className="miles-card w-full max-w-md border-0 sm:border">
          <CardHeader className="space-y-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
              M
            </div>
            <div>
              <CardTitle className="text-2xl">Вхід до Miles</CardTitle>
              <CardDescription>
                Введіть дані власниці або адміністратора.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault()
                login.mutate()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="h-12"
                />
              </div>
              <Button
                type="submit"
                className="h-12 w-full"
                disabled={login.isPending}
              >
                {login.isPending ? "Входимо…" : "Увійти"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
