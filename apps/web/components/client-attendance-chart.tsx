"use client"

import { useEffect, useMemo, useRef } from "react"
import * as echarts from "echarts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Attendance = {
  id: string
  status: "PRESENT" | "ABSENT"
  event: { startsAt: string }
}

export function ClientAttendanceChart({ attendances }: { attendances: Attendance[] }) {
  const chartRef = useRef<HTMLDivElement>(null)
  const stats = useMemo(() => {
    const present = attendances.filter((item) => item.status === "PRESENT").length
    const absent = attendances.length - present
    const monthly = new Map<string, { label: string; present: number; absent: number }>()
    for (const item of attendances) {
      const value = new Date(item.event.startsAt)
      const key = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`
      const current = monthly.get(key) ?? {
        label: new Intl.DateTimeFormat("uk-UA", { month: "short" }).format(value),
        present: 0,
        absent: 0,
      }
      current[item.status === "PRESENT" ? "present" : "absent"] += 1
      monthly.set(key, current)
    }
    return { present, absent, monthly: [...monthly.entries()].sort().slice(-6).map(([, value]) => value) }
  }, [attendances])

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current)
    chart.setOption({
      animationDuration: 500,
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { color: "#766b79" } },
      grid: { left: 36, right: 18, top: 34, bottom: 56 },
      xAxis: {
        type: "category",
        data: stats.monthly.map((item) => item.label),
        axisLine: { lineStyle: { color: "#e6dfe7" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: "#f0eaf1" } },
      },
      series: [
        {
          name: "Був/ла",
          type: "bar",
          stack: "attendance",
          data: stats.monthly.map((item) => item.present),
          itemStyle: { color: "#bd32cc", borderRadius: [6, 6, 0, 0] },
          barMaxWidth: 34,
        },
        {
          name: "Не був/ла",
          type: "bar",
          stack: "attendance",
          data: stats.monthly.map((item) => item.absent),
          itemStyle: { color: "#f2b6c8", borderRadius: [6, 6, 0, 0] },
          barMaxWidth: 34,
        },
      ],
    })
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(chartRef.current)
    return () => {
      observer.disconnect()
      chart.dispose()
    }
  }, [stats])

  const rate = attendances.length ? Math.round((stats.present / attendances.length) * 100) : 0
  return (
    <Card className="miles-card mb-5">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Динаміка відвідування</CardTitle>
          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
              Відвідуваність {rate}%
            </span>
            <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">
              {stats.present} з {attendances.length}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {attendances.length ? (
          <div ref={chartRef} className="h-72 w-full" aria-label="Діаграма відвідування клієнта" />
        ) : (
          <div className="grid h-40 place-items-center rounded-2xl bg-muted/40 text-sm text-muted-foreground">
            Дані для діаграми з’являться після першого заняття
          </div>
        )}
      </CardContent>
    </Card>
  )
}
