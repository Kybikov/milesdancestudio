"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { dateTime } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { History } from "lucide-react"
type Log = {
  id: string
  action: string
  entityType: string
  entityId?: string
  createdAt: string
  ip?: string
  actor?: { displayName: string; email: string }
  metadata?: unknown
}
export default function AuditPage() {
  const query = useQuery({
    queryKey: ["audit"],
    queryFn: () => api<Log[]>("/audit"),
  })
  return (
    <div>
      <PageHeader
        title="Історія дій"
        description="Незмінний журнал критичних і операційних змін."
      />
      <Card className="miles-card">
        <CardContent className="divide-y p-0">
          {query.data?.map((log) => (
            <div className="flex gap-3 p-4" key={log.id}>
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <History className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{log.action}</Badge>
                  <strong className="text-sm">{log.entityType}</strong>
                  {log.entityId && (
                    <span className="truncate font-mono text-[10px] text-muted-foreground">
                      {log.entityId}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {log.actor?.displayName ?? "Система"} ·{" "}
                  {dateTime(log.createdAt)} · {log.ip ?? "—"}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
