import { db, genId, nowIso } from './db.js'
import type {
  InspectionOrder,
  StatsSummary,
  DeviceCompletionRate,
  ShiftAnomalyRate,
  SeverityCount,
  AnomalyTrendItem,
  StatsLog,
  Device,
  Shift,
} from '../types/index.js'

export interface StatsFilters {
  dateFrom?: string
  dateTo?: string
  user?: string
  userRole?: 'operator' | 'supervisor' | 'all'
}

function filterOrders(orders: InspectionOrder[], filters: StatsFilters): InspectionOrder[] {
  return orders.filter((o) => {
    if (filters.dateFrom && o.shiftDate < filters.dateFrom) return false
    if (filters.dateTo && o.shiftDate > filters.dateTo) return false
    if (filters.user && filters.userRole === 'operator' && o.operator !== filters.user) return false
    return true
  })
}

function isSupervisor(user: string, orders: InspectionOrder[]): boolean {
  return orders.some((o) => o.supervisor === user)
}

export function getUserRole(user: string): 'supervisor' | 'operator' {
  const orders = db.getInspectionOrders()
  return isSupervisor(user, orders) ? 'supervisor' : 'operator'
}

export interface StatsSummaryWithRole extends StatsSummary {
  userRole: 'supervisor' | 'operator'
}

export function getStatsSummary(filters: StatsFilters): StatsSummaryWithRole {
  const allOrders = db.getInspectionOrders()
  const devices = db.getDevices()
  const shifts = db.getShifts()

  const role = filters.user && filters.userRole
    ? filters.userRole
    : 'all'

  const effectiveFilters: StatsFilters = {
    ...filters,
    userRole: role as 'operator' | 'supervisor' | 'all',
  }

  const orders = filterOrders(allOrders, effectiveFilters)

  const nonDraftOrders = orders.filter((o) => o.status !== 'DRAFT')

  const deviceCompletionRates: DeviceCompletionRate[] = devices.map((d: Device) => {
    const deviceOrders = nonDraftOrders.filter((o) => o.deviceId === d.id)
    const total = deviceOrders.length
    const closed = deviceOrders.filter((o) => o.status === 'CLOSED').length
    const rate = total > 0 ? Math.round((closed / total) * 10000) / 100 : 0
    return {
      deviceId: d.id,
      deviceName: d.name,
      total,
      closed,
      rate,
    }
  })

  const shiftAnomalyRates: ShiftAnomalyRate[] = shifts.map((s: Shift) => {
    const shiftOrders = nonDraftOrders.filter((o) => o.shiftId === s.id)
    const total = shiftOrders.length
    const anomaly = shiftOrders.filter((o) => o.anomalies.length > 0).length
    const rate = total > 0 ? Math.round((anomaly / total) * 10000) / 100 : 0
    return {
      shiftId: s.id,
      shiftName: s.name,
      shiftType: s.type,
      total,
      anomaly,
      rate,
    }
  })

  const severityCounts: SeverityCount[] = []
  const sevMap = new Map<string, number>()
  sevMap.set('LOW', 0)
  sevMap.set('MEDIUM', 0)
  sevMap.set('HIGH', 0)
  for (const order of nonDraftOrders) {
    for (const a of order.anomalies) {
      sevMap.set(a.severity, (sevMap.get(a.severity) || 0) + 1)
    }
  }
  severityCounts.push({ severity: 'LOW', count: sevMap.get('LOW') || 0 })
  severityCounts.push({ severity: 'MEDIUM', count: sevMap.get('MEDIUM') || 0 })
  severityCounts.push({ severity: 'HIGH', count: sevMap.get('HIGH') || 0 })

  const anomalyTrend: AnomalyTrendItem[] = []
  if (filters.dateFrom && filters.dateTo) {
    const start = new Date(filters.dateFrom)
    const end = new Date(filters.dateTo)
    const cur = new Date(start)
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10)
      let count = 0
      for (const order of nonDraftOrders) {
        if (order.shiftDate === dateStr) {
          count += order.anomalies.length
        }
      }
      anomalyTrend.push({ date: dateStr, count })
      cur.setDate(cur.getDate() + 1)
    }
  }

  const totalOrders = nonDraftOrders.length
  let totalAnomalies = 0
  for (const o of nonDraftOrders) {
    totalAnomalies += o.anomalies.length
  }

  return {
    deviceCompletionRates,
    shiftAnomalyRates,
    severityCounts,
    anomalyTrend,
    totalOrders,
    totalAnomalies,
    userRole: (role as 'supervisor' | 'operator' | 'all') === 'all' ? 'supervisor' : (role as 'supervisor' | 'operator'),
  }
}

export function addStatsLog(log: Omit<StatsLog, 'id' | 'timestamp'>): void {
  const entry: StatsLog = {
    id: genId('STATS_LOG_'),
    ...log,
    timestamp: nowIso(),
  }
  db.addStatsLog(entry)
}

export function getStatsLogs(): StatsLog[] {
  return db.getStatsLogs()
}

export function buildStatsCsv(summary: StatsSummary): string {
  const lines: string[] = []

  lines.push('设备完成率统计')
  lines.push('设备名称,总开单数(排除草稿),已关闭数,完成率(%)')
  for (const d of summary.deviceCompletionRates) {
    lines.push(`${d.deviceName},${d.total},${d.closed},${d.rate.toFixed(2)}`)
  }

  lines.push('')
  lines.push('班次异常率统计')
  lines.push('班次名称,总开单数(排除草稿),异常单数,异常率(%)')
  for (const s of summary.shiftAnomalyRates) {
    lines.push(`${s.shiftName},${s.total},${s.anomaly},${s.rate.toFixed(2)}`)
  }

  lines.push('')
  lines.push('异常严重程度分布')
  lines.push('严重程度,数量')
  const sevLabels: Record<string, string> = { LOW: '低', MEDIUM: '中', HIGH: '高' }
  for (const s of summary.severityCounts) {
    lines.push(`${sevLabels[s.severity] || s.severity},${s.count}`)
  }

  lines.push('')
  lines.push('近30天异常趋势')
  lines.push('日期,异常数')
  for (const t of summary.anomalyTrend) {
    lines.push(`${t.date},${t.count}`)
  }

  return lines.join('\n')
}
