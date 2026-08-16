"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { dateTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Bell,
  BellRing,
  Check,
  CircleAlert,
  CreditCard,
  TicketCheck,
} from "lucide-react"

type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  link?: string
  readAt?: string
  createdAt: string
}

type NotificationResponse = {
  unread: number
  notifications: NotificationItem[]
}

type PushConfig = {
  enabled: boolean
  publicKey: string | null
  subscriptions: number
}

const icons: Record<string, typeof Bell> = {
  SUBSCRIPTION_EXPIRING: TicketCheck,
  SUBSCRIPTION_EXPIRED: CircleAlert,
  PAYMENT_SUCCESS: CreditCard,
  PAYMENT_FAILED: CircleAlert,
  ACTIVITY: BellRing,
  SYSTEM: Bell,
}

export function NotificationCenter() {
  const qc = useQueryClient()
  const initialized = useRef(false)
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | "unsupported"
  >("default")
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<NotificationResponse>("/notifications"),
    refetchInterval: 15_000,
  })
  const pushConfig = useQuery({
    queryKey: ["push-config"],
    queryFn: () => api<PushConfig>("/push/config"),
  })
  const read = useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/${id}/read`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  })
  const readAll = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  })

  useEffect(() => {
    const newest = query.data?.notifications.find((item) => !item.readAt)
    if (!newest || typeof window === "undefined") return
    const seen = window.localStorage.getItem("miles:last-browser-notification")
    if (!initialized.current) {
      initialized.current = true
      if (!seen)
        window.localStorage.setItem(
          "miles:last-browser-notification",
          newest.id
        )
      return
    }
    if (seen === newest.id || window.Notification?.permission !== "granted")
      return
    new window.Notification(newest.title, {
      body: newest.message,
      tag: newest.id,
    })
    window.localStorage.setItem("miles:last-browser-notification", newest.id)
  }, [query.data])

  const enableBrowserNotifications = async () => {
    if (
      typeof window === "undefined" ||
      !window.Notification ||
      !pushConfig.data?.publicKey ||
      !("serviceWorker" in navigator)
    )
      return
    try {
      const permission = await window.Notification.requestPermission()
      setBrowserPermission(permission)
      if (permission !== "granted") {
        toast.error("Дозвіл на сповіщення не надано")
        return
      }
      const registration = await navigator.serviceWorker.register("/sw.js")
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            pushConfig.data.publicKey
          ),
        }))
      await api("/push/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      })
      await qc.invalidateQueries({ queryKey: ["push-config"] })
      toast.success("Push-сповіщення увімкнено")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не вдалося увімкнути сповіщення"
      )
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" />}
      >
        {query.data?.unread ? <BellRing /> : <Bell />}
        {!!query.data?.unread && (
          <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] leading-4 text-white">
            {Math.min(query.data.unread, 99)}
          </span>
        )}
        <span className="sr-only">Сповіщення</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(390px,calc(100vw-24px))] rounded-2xl p-0"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Сповіщення</p>
          <div className="flex gap-1">
            {pushConfig.data?.enabled &&
              !pushConfig.data.subscriptions &&
              browserPermission !== "denied" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={enableBrowserNotifications}
                >
                  Увімкнути push
                </Button>
              )}
            {!!query.data?.unread && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => readAll.mutate()}
              >
                <Check /> Прочитати всі
              </Button>
            )}
          </div>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[440px] overflow-y-auto">
          {query.data?.notifications.map((item) => {
            const Icon = icons[item.type] ?? Bell
            const content = (
              <div
                className={`flex gap-3 border-b p-4 transition hover:bg-accent/60 ${item.readAt ? "opacity-65" : "bg-primary/[.035]"}`}
                onClick={() => !item.readAt && read.mutate(item.id)}
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    {!item.readAt && (
                      <span className="size-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.message}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {dateTime(item.createdAt)}
                  </p>
                </div>
              </div>
            )
            return item.link ? (
              <Link key={item.id} href={item.link}>
                {content}
              </Link>
            ) : (
              <div key={item.id}>{content}</div>
            )
          })}
          {!query.data?.notifications.length && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Нових сповіщень немає
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)))
}
