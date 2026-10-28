// 热力图：每天一格，按周排成列（每列从周日开始）。首页右栏的「写作记录」和「GitHub」共用。
export interface Day {
  date: string // YYYY-MM-DD
  count: number
  level: number // 0–4，决定颜色深浅
}

// 切出最后 weeks 列；第一天必须是周日，最后一列可能不满 7 天
export function toWeeks(days: Day[], weeks: number) {
  const lastWeekStart = Math.floor((days.length - 1) / 7) * 7
  const sliced = days.slice(Math.max(0, lastWeekStart - (weeks - 1) * 7))
  const result: Day[][] = []
  for (let i = 0; i < sliced.length; i += 7) result.push(sliced.slice(i, i + 7))
  return result
}

// 每个月第一次出现的那一列上方标月份，两个标签至少隔 3 列（和作品站的 ContributionsCard 一样）
export function monthLabels(weeks: Day[][]) {
  let lastAt = -Infinity
  return weeks.map((week, i) => {
    const month = Number(week[0]!.date.slice(5, 7))
    const prev = i ? Number(weeks[i - 1]![0]!.date.slice(5, 7)) : -1
    const nextMonthSoon =
      i === 0 && weeks.slice(1, 3).some((w) => Number(w[0]!.date.slice(5, 7)) !== month)
    if (month !== prev && !nextMonthSoon && i - lastAt >= 3 && i < weeks.length - 2) {
      lastAt = i
      return `${month}月`
    }
    return ''
  })
}

// 写作记录：从 weeks 周前的周日到今天，每天发了几篇。日期按 UTC 取（frontmatter 里没写时区的时间按 UTC 存）
export function writingDays(dates: Date[], weeks: number): Day[] {
  const counts = new Map<string, number>()
  for (const d of dates) {
    const key = d.toISOString().slice(0, 10)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const today = new Date()
  const start = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - today.getUTCDay() - (weeks - 1) * 7
    )
  )
  const days: Day[] = []
  for (const d = start; d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10)
    const count = counts.get(date) ?? 0
    days.push({ date, count, level: Math.min(count, 4) })
  }
  return days
}
