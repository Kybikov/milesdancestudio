"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { api, SessionUser } from "@/lib/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings, UserRound } from "lucide-react"

export function ProfileMenu({ user }: { user: SessionUser }) {
  const router = useRouter()
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSettled: () => router.replace("/"),
  })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Профіль користувача"
        className="rounded-full ring-primary/30 outline-none focus-visible:ring-4"
      >
        <Avatar className="size-9">
          <AvatarImage src={user.avatarPath ?? undefined} />
          <AvatarFallback>{user.displayName.slice(0, 2)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl">
        <div className="px-3 py-2.5 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{user.displayName}</p>
          <p className="mt-0.5 truncate font-normal">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          <UserRound /> Особистий профіль
        </DropdownMenuItem>
        {user.permissions.includes("settings.manage") && (
          <DropdownMenuItem render={<Link href="/settings" />}>
            <Settings /> Налаштування
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => logout.mutate()}>
          <LogOut /> Вийти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
