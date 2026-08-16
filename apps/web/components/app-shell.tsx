"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { api, SessionUser } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ActivityDrawer } from "@/components/activity-drawer"
import { NotificationCenter } from "@/components/notification-center"
import { ProfileMenu } from "@/components/profile-menu"
import {
  CalendarDays,
  ChartNoAxesCombined,
  CreditCard,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Users,
  UserRound,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const items = [
  ["/dashboard", "Головна", LayoutDashboard, "dashboard.read"],
  ["/calendar", "Календар", CalendarDays, "schedule.read"],
  ["/teachers", "Викладачі", UserRound, "teachers.read"],
  ["/clients", "Клієнти", Users, "clients.read"],
  ["/subscriptions", "Абонементи", TicketCheck, "subscriptions.read"],
  ["/payments", "Оплати", CreditCard, "payments.create"],
  ["/charges", "Збори", ReceiptText, "charges.write"],
  ["/statistics", "Статистика", ChartNoAxesCombined, "finances.read"],
  ["/users", "Ролі й доступи", ShieldCheck, "users.manage"],
  ["/settings", "Налаштування", Settings, "settings.manage"],
] as const

function Nav({
  user,
  onNavigate,
}: {
  user: SessionUser
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  return (
    <nav className="space-y-1">
      {items
        .filter((item) => user.permissions.includes(item[3]))
        .map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground",
              (pathname === href || pathname.startsWith(`${href}/`)) &&
                "bg-primary/10 text-primary"
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
    </nav>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: SessionUser }>("/auth/me"),
    retry: false,
  })
  if (me.isError) {
    router.replace("/")
    return null
  }
  if (!me.data)
    return (
      <div className="grid min-h-svh place-items-center">
        <div className="space-y-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    )
  const user = me.data.user
  if (user.mustChangePassword && pathname !== "/profile") {
    router.replace("/profile")
    return null
  }
  return (
    <div className="min-h-svh lg:p-3">
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-64 flex-col rounded-2xl border bg-card/95 p-3 shadow-sm backdrop-blur lg:flex">
        <Link
          href="/dashboard"
          className="mb-6 flex items-center gap-3 px-2 py-2"
        >
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Miles Dance Studio</p>
            <p className="text-xs text-muted-foreground">Керування студією</p>
          </div>
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Nav user={user} />
        </div>
      </aside>
      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:top-3 lg:mx-3 lg:rounded-2xl lg:border">
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet>
              <SheetTrigger render={<Button variant="outline" size="icon" />}>
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-[88vw] max-w-sm p-4">
                <SheetTitle className="mb-5 flex items-center gap-2">
                  <Sparkles className="text-primary" />
                  Miles Dance Studio
                </SheetTitle>
                <Nav user={user} />
              </SheetContent>
            </Sheet>
            <span className="font-semibold">Miles</span>
          </div>
          <div className="hidden items-center gap-2 text-sm lg:flex">
            <span className="font-medium">
              {items.find(([href]) => pathname === href)?.[1] ??
                "Miles Dance Studio"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ActivityDrawer />
            <NotificationCenter />
            <ProfileMenu user={user} />
          </div>
        </header>
        <main className="p-4 pb-24 sm:p-6 lg:p-7 lg:pb-8">{children}</main>
      </div>
      <nav className="fixed inset-x-2 bottom-2 z-30 grid grid-cols-5 rounded-2xl border bg-card/95 p-1.5 shadow-xl backdrop-blur lg:hidden">
        {items
          .filter((item) => user.permissions.includes(item[3]))
          .slice(0, 5)
          .map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] text-muted-foreground",
                (pathname === href || pathname.startsWith(`${href}/`)) &&
                  "bg-primary/10 text-primary"
              )}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          ))}
      </nav>
    </div>
  )
}
