import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const styles: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  EXPIRING: "border-amber-200 bg-amber-50 text-amber-700",
  USED: "border-rose-200 bg-rose-50 text-rose-700",
  EXPIRED: "border-rose-200 bg-rose-50 text-rose-700",
  CANCELLED: "border-stone-200 bg-stone-100 text-stone-600",
  SCHEDULED: "border-violet-200 bg-violet-50 text-violet-700",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPLETED: "border-sky-200 bg-sky-50 text-sky-700",
  FAILED: "border-rose-200 bg-rose-50 text-rose-700",
  PRESENT: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ABSENT: "border-stone-200 bg-stone-50 text-stone-600",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PARTIAL: "border-amber-200 bg-amber-50 text-amber-700",
  UNPAID: "border-rose-200 bg-rose-50 text-rose-700",
}
const labels: Record<string, string> = {
  ACTIVE: "Активний",
  EXPIRING: "Скоро завершиться",
  USED: "Заняття використані",
  EXPIRED: "Завершився",
  CANCELLED: "Скасовано",
  SCHEDULED: "Заплановано",
  CONFIRMED: "Підтверджено",
  COMPLETED: "Завершено",
  FAILED: "Неуспішна",
  PRESENT: "Був",
  ABSENT: "Не був",
  PAID: "Оплачено",
  PARTIAL: "Частково",
  UNPAID: "Не оплачено",
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap", styles[status])}
    >
      {labels[status] ?? status}
    </Badge>
  )
}
