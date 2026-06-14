import { useEffect, useState, useCallback, useRef } from 'react'
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
  ResponsiveContainer,
} from 'recharts'
import { useAppStore } from '@/store/appStore'
import { statsApi, type StatsFilters } from '@/services/api'
import type { StatsSummary, SeverityCount, OperatorStats } from '@/types'
import { SEVERITY_LABELS } from '@/types'
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
  RotateCcw,
  Monitor,
  FileJson,
  FileSpreadsheet,
  X,
  Check,
  Users,
  Table,
} from 'lucide-react'

const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#ef4444',
}

const STORAGE_KEY = 'stats_filters'
const EXPORT_WARNING_THRESHOLD = 500

type ExportFormat = 'csv' | 'json'
type StatsTab = 'overview' | 'operator'

function getDefaultDateRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 29)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

function loadFiltersFromStorage(): StatsFilters | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved) as StatsFilters
    }
  } catch {
    // ignore
  }
  return null
}

function saveFiltersToStorage(filters: StatsFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  } catch {
    // ignore
  }
}

function formatTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    '_' +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  )
}

export default function StatsPage() {
  const { currentUser, notify, devices, loadMasterData } = useAppStore()
  const [summary, setSummary] = useState<StatsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const defaultRange = getDefaultDateRange()
  const defaultRangeRef = useRef(defaultRange)
  const hasLoggedInitial = useRef(false)
  const [activeTab, setActiveTab] = useState<StatsTab>('overview')
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv')
  const [exportWarningShown, setExportWarningShown] = useState(false)

  const getInitialFilters = (): StatsFilters => {
    const saved = loadFiltersFromStorage()
    if (saved) {
      return saved
    }
    return {
      dateFrom: defaultRange.from,
      dateTo: defaultRange.to,
      user: currentUser,
    }
  }

  const [filters, setFilters] = useState<StatsFilters>(getInitialFilters)

  useEffect(() => {
    loadMasterData()
  }, [loadMasterData])

  useEffect(() => {
    setFilters((prev) => {
      const updated = { ...prev, user: currentUser }
      saveFiltersToStorage(updated)
      return updated
    })
  }, [currentUser])

  const resetAllState = useCallback(() => {
    setSummary(null)
    setError(null)
    setLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await statsApi.summary(filters)
      if (r.success && r.data) {
        setSummary(r.data)
      } else if (r.error) {
        setError(r.error.message || '加载失败')
        setSummary(null)
      } else {
        setError('加载失败')
        setSummary(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    resetAllState()
    loadStats()
  }, [filters, loadStats, resetAllState])

  useEffect(() => {
    if (!hasLoggedInitial.current && currentUser) {
      statsApi
        .log({
          user: currentUser,
          action: 'VIEW',
          filters: {
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
          },
        })
        .catch(() => {})
      hasLoggedInitial.current = true
    }
  }, [currentUser, filters.dateFrom, filters.dateTo])

  useEffect(() => {
    if (!hasLoggedInitial.current) return
    statsApi
      .log({
        user: currentUser,
        action: 'FILTER',
        filters: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        },
      })
      .catch(() => {})
  }, [filters.dateFrom, filters.dateTo, currentUser])

  const handleExport = () => {
    setExportWarningShown(false)
    setShowExportDialog(true)
  }

  const confirmExport = () => {
    const totalRecords = summary?.totalOrders || 0
    if (totalRecords > EXPORT_WARNING_THRESHOLD && !exportWarningShown) {
      setExportWarningShown(true)
      return
    }

    const ts = formatTimestamp()
    const datePart = `${filters.dateFrom || 'start'}_${filters.dateTo || 'end'}`
    const fileName = `stats_${datePart}_${ts}.${exportFormat}`

    let url: string
    if (exportFormat === 'csv') {
      url = statsApi.csvUrl(filters)
    } else {
      url = statsApi.jsonUrl(filters)
    }

    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    statsApi
      .log({
        user: currentUser,
        action: 'EXPORT',
        filters: { dateFrom: filters.dateFrom, dateTo: filters.dateTo },
      })
      .catch(() => {})

    notify('info', `正在导出统计 ${exportFormat.toUpperCase()} 格式`)
    setShowExportDialog(false)
  }

  const handleRetry = () => {
    loadStats()
  }

  const handleFilterChange = (key: keyof StatsFilters, value: string | undefined) => {
    setFilters((prev) => {
      const updated = { ...prev, [key]: value || undefined }
      saveFiltersToStorage(updated)
      return updated
    })
  }

  const handleResetDate = () => {
    const dr = defaultRangeRef.current
    setFilters((prev) => {
      const updated = { ...prev, dateFrom: dr.from, dateTo: dr.to }
      saveFiltersToStorage(updated)
      return updated
    })
  }

  const hasData = summary && summary.totalOrders > 0
  const hasOperatorData = summary && summary.operatorStats && summary.operatorStats.length > 0

  const pieData = summary?.severityCounts.filter((s) => s.count > 0) || []
  const pieTotal = pieData.reduce((sum, item) => sum + item.count, 0)

  const totalExportRecords = summary?.totalOrders || 0

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <label className="text-sm text-slate-500 whitespace-nowrap">设备</label>
            <select
              value={filters.deviceId || ''}
              onChange={(e) => handleFilterChange('deviceId', e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部设备</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
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
          <div className="flex items-center gap-2 justify-end flex-wrap">
            <button
              onClick={handleResetDate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 text-sm font-medium transition"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 text-sm font-medium transition"
            >
              <Download className="w-4 h-4" />
              导出
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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
              activeTab === 'overview'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            概览统计
          </button>
          <button
            onClick={() => setActiveTab('operator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
              activeTab === 'operator'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            按操作员
          </button>
        </div>
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
      ) : activeTab === 'operator' ? (
        <OperatorStatsSection hasData={hasOperatorData} operatorStats={summary?.operatorStats || []} />
      ) : !hasData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[
            { title: '设备维度完成率', icon: BarChart3, color: 'text-blue-600' },
            { title: '各班次异常率', icon: BarChart3, color: 'text-orange-500' },
            { title: '异常严重程度分布', icon: PieChartIcon, color: 'text-purple-500' },
            { title: `异常趋势（${filters.dateFrom} 至 ${filters.dateTo}）`, icon: TrendingUp, color: 'text-green-500' },
          ].map((item) => (
            <div key={item.title} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <h4 className="text-sm font-semibold text-slate-700">{item.title}</h4>
              </div>
              <div className="h-64 w-full flex flex-col items-center justify-center">
                <item.icon className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-slate-400 text-base">该时段暂无数据</p>
                <p className="text-slate-300 text-sm mt-1">请尝试调整日期范围或创建点检单</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-slate-700">设备维度完成率</h4>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.deviceCompletionRates} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="deviceName" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} unit="%" domain={[0, 100]} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(2)}%`, '完成率']}
                    labelFormatter={(label) => `设备: ${label}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="rate" name="完成率" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              <h4 className="text-sm font-semibold text-slate-700">各班次异常率</h4>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.shiftAnomalyRates} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="shiftName"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} unit="%" domain={[0, 'auto']} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(2)}%`, '异常率']}
                    labelFormatter={(label) => `班次: ${label}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="rate" name="异常率" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon className="w-4 h-4 text-purple-500" />
              <h4 className="text-sm font-semibold text-slate-700">异常严重程度分布</h4>
            </div>
            <div className="h-64 w-full">
              {pieTotal === 0 ? (
                <div className="h-full w-full flex flex-col items-center justify-center">
                  <PieChartIcon className="w-10 h-10 text-slate-200 mb-2" />
                  <div className="text-slate-400 text-sm">暂无异常数据</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
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
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <h4 className="text-sm font-semibold text-slate-700">
                异常趋势（{filters.dateFrom ? filters.dateFrom.slice(5) : ''} ~ {filters.dateTo ? filters.dateTo.slice(5) : ''}）
              </h4>
            </div>
            <div className="h-64 w-full">
              {summary.anomalyTrend.length === 0 ? (
                <div className="h-full w-full flex flex-col items-center justify-center">
                  <TrendingUp className="w-10 h-10 text-slate-200 mb-2" />
                  <div className="text-slate-400 text-sm">暂无趋势数据</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.anomalyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {showExportDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">导出统计数据</h3>
              <button
                onClick={() => setShowExportDialog(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">选择格式</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setExportFormat('csv')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                      exportFormat === 'csv'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <FileSpreadsheet className="w-8 h-8" />
                    <span className="text-sm font-medium">CSV</span>
                    <span className="text-xs opacity-70">表格格式</span>
                  </button>
                  <button
                    onClick={() => setExportFormat('json')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                      exportFormat === 'json'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <FileJson className="w-8 h-8" />
                    <span className="text-sm font-medium">JSON</span>
                    <span className="text-xs opacity-70">数据格式</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">导出范围</p>
                <p className="text-sm text-slate-700">
                  {filters.dateFrom || '开始'} ~ {filters.dateTo || '结束'}
                  {filters.deviceId && devices.find((d) => d.id === filters.deviceId)
                    ? ` · ${devices.find((d) => d.id === filters.deviceId)?.name}`
                    : ' · 全部设备'}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  共 <span className="font-semibold">{totalExportRecords}</span> 条点检单记录
                </p>
              </div>

              {exportWarningShown && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">数据量较大</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      共 {totalExportRecords} 条记录，超过 {EXPORT_WARNING_THRESHOLD} 条，导出可能较慢。确定要继续吗？
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowExportDialog(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-medium transition"
              >
                取消
              </button>
              <button
                onClick={confirmExport}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-500 text-white hover:bg-green-600 text-sm font-medium transition flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {exportWarningShown ? '确认导出' : '导出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OperatorStatsSection({
  hasData,
  operatorStats,
}: {
  hasData: boolean
  operatorStats: OperatorStats[]
}) {
  if (!hasData || operatorStats.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
        <Users className="w-12 h-12 mx-auto text-slate-200 mb-4" />
        <p className="text-slate-400">该时段暂无操作员数据</p>
      </div>
    )
  }

  const chartData = operatorStats.map((s) => ({
    operator: s.operator,
    总工单数: s.totalOrders,
    已关闭: s.closedOrders,
    异常数: s.totalAnomalies,
  }))

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-indigo-500" />
          <h4 className="text-sm font-semibold text-slate-700">操作员工作量对比</h4>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="operator" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              <Legend />
              <Bar dataKey="总工单数" name="总工单" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="已关闭" name="已关闭" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="异常数" name="异常数" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Table className="w-4 h-4 text-slate-500" />
          <h4 className="text-sm font-semibold text-slate-700">操作员详细统计</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  操作员
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  总工单数
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  已关闭
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  异常数
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  已复核
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  复核通过率
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {operatorStats.map((stat) => (
                <tr key={stat.operator} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="text-sm font-medium text-slate-900">{stat.operator}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700 font-medium">
                    {stat.totalOrders}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-green-600 font-medium">
                    {stat.closedOrders}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {stat.totalAnomalies > 0 ? (
                      <span className="text-orange-600 font-medium">{stat.totalAnomalies}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">
                    {stat.reviewedOrders}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${Math.min(stat.reviewPassRate, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-indigo-600 w-14 text-right">
                        {stat.reviewPassRate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
