import { useEffect, useState, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import { useAppStore } from '@/store/appStore'
import { statsApi, type StatsFilters } from '@/services/api'
import type { StatsSummary, SeverityCount } from '@/types'
import { SEVERITY_LABELS, SHIFT_TYPE_LABELS } from '@/types'
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Download,
  RefreshCw,
  AlertCircle,
  Calendar,
  User,
  Shield,
} from 'lucide-react'

const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#ef4444',
}

function getDefaultDateRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 29)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export default function StatsPage() {
  const { currentUser, notify, loadMasterData } = useAppStore()
  const [summary, setSummary] = useState<StatsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const defaultRange = getDefaultDateRange()
  const [filters, setFilters] = useState<StatsFilters>({
    dateFrom: defaultRange.from,
    dateTo: defaultRange.to,
    user: currentUser,
  })

  useEffect(() => {
    loadMasterData()
  }, [loadMasterData])

  useEffect(() => {
    setFilters((prev) => ({ ...prev, user: currentUser }))
  }, [currentUser])

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await statsApi.summary(filters)
      if (r.success && r.data) {
        setSummary(r.data)
      } else if (r.error) {
        setError(r.error.message || '加载失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    statsApi.log({
      user: currentUser,
      action: filters.dateFrom === defaultRange.from && filters.dateTo === defaultRange.to ? 'VIEW' : 'FILTER',
      filters: {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
    }).catch(() => {})
  }, [filters.dateFrom, filters.dateTo, currentUser, defaultRange.from, defaultRange.to])

  const handleExport = () => {
    const url = statsApi.csvUrl(filters)
    window.open(url, '_blank')
    statsApi.log({ user: currentUser, action: 'EXPORT', filters: { dateFrom: filters.dateFrom, dateTo: filters.dateTo } })
      .catch(() => {})
    notify('info', '正在导出统计 CSV')
  }

  const handleRetry = () => {
    loadStats()
  }

  const handleFilterChange = (key: keyof StatsFilters, value: string | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }))
  }

  const hasData = summary && summary.totalOrders > 0

  const pieData = summary?.severityCounts.filter((s) => s.count > 0) || []
  const pieTotal = pieData.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-700">筛选条件</h3>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {summary?.userRole === 'supervisor' ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
                <Shield className="w-3 h-3" />
                主管视角（全量数据）
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                <User className="w-3 h-3" />
                操作员视角（仅本人数据）
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <label className="text-sm text-slate-500 whitespace-nowrap">开始日期</label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <label className="text-sm text-slate-500 whitespace-nowrap">结束日期</label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 text-sm font-medium transition"
            >
              <Download className="w-4 h-4" />
              导出 CSV
            </button>
            <button
              onClick={loadStats}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 text-sm font-medium transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
            <div className="bg-blue-50/50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">总开单数（排除草稿）</p>
              <p className="text-2xl font-bold text-slate-900">{summary.totalOrders}</p>
            </div>
            <div className="bg-green-50/50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">已关闭数</p>
              <p className="text-2xl font-bold text-green-600">
                {summary.deviceCompletionRates.reduce((s, d) => s + d.closed, 0)}
              </p>
            </div>
            <div className="bg-yellow-50/50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">异常总数</p>
              <p className="text-2xl font-bold text-yellow-600">{summary.totalAnomalies}</p>
            </div>
            <div className="bg-purple-50/50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">整体完成率</p>
              <p className="text-2xl font-bold text-purple-600">
                {summary.totalOrders > 0
                  ? (
                      (summary.deviceCompletionRates.reduce((s, d) => s + d.closed, 0) / summary.totalOrders) *
                      100
                    ).toFixed(1)
                  : '0.0'}
                %
              </p>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
          <RefreshCw className="w-10 h-10 mx-auto text-slate-300 animate-spin mb-3" />
          <p className="text-slate-400">加载中...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-16 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-red-600 font-medium mb-2">加载失败</p>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-sm font-medium transition"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </button>
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 text-lg">该时段暂无数据</p>
          <p className="text-slate-300 text-sm mt-1">请尝试调整日期范围或创建点检单</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-slate-700">设备维度完成率</h4>
            </div>
            <div className="h-64 w-full flex items-center justify-center overflow-hidden">
              <BarChart width={380} height={220} data={summary.deviceCompletionRates} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="deviceName" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} unit="%" />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(2)}%`, '完成率']}
                    labelFormatter={(label) => `设备: ${label}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="rate" name="完成率" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              <h4 className="text-sm font-semibold text-slate-700">各班次异常率</h4>
            </div>
            <div className="h-64 w-full flex items-center justify-center overflow-hidden">
              <BarChart width={380} height={220} data={summary.shiftAnomalyRates} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="shiftName"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} unit="%" />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(2)}%`, '异常率']}
                    labelFormatter={(label) => `班次: ${label}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="rate" name="异常率" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon className="w-4 h-4 text-purple-500" />
              <h4 className="text-sm font-semibold text-slate-700">异常严重程度分布</h4>
            </div>
            <div className="h-64 w-full flex items-center justify-center overflow-hidden">
              {pieTotal === 0 ? (
                <div className="text-slate-400 text-sm">暂无异常数据</div>
              ) : (
                <PieChart width={380} height={220}>
                    <Pie
                      data={pieData}
                      dataKey="count"
                      nameKey="severity"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) =>
                        `${SEVERITY_LABELS[name] || name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {pieData.map((entry: SeverityCount, index: number) => (
                        <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.severity] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [value, '数量']}
                      labelFormatter={(label) => `严重程度: ${SEVERITY_LABELS[label] || label}`}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Legend
                      formatter={(value) => SEVERITY_LABELS[value] || value}
                    />
                  </PieChart>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <h4 className="text-sm font-semibold text-slate-700">异常趋势（近30天）</h4>
            </div>
            <div className="h-64 w-full flex items-center justify-center overflow-hidden">
              {summary.anomalyTrend.length === 0 ? (
                <div className="text-slate-400 text-sm">暂无趋势数据</div>
              ) : (
                <LineChart width={380} height={220} data={summary.anomalyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickFormatter={(value) => value.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number) => [value, '异常数']}
                      labelFormatter={(label) => `日期: ${label}`}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="异常数"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
