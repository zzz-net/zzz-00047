import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { inspectionsApi, exportApi, type InspectionListFilters } from '@/services/api'
import { useNavigate } from 'react-router-dom'
import type { InspectionOrder, InspectionStatus } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import { Search, Download, FileJson, FileSpreadsheet, Eye } from 'lucide-react'

export default function HistoryPage() {
  const { devices, shifts, loadMasterData, notify } = useAppStore()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<InspectionOrder[]>([])
  const [filters, setFilters] = useState<InspectionListFilters>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadMasterData()
  }, [loadMasterData])

  useEffect(() => {
    searchOrders()
  }, [filters])

  const searchOrders = async () => {
    setLoading(true)
    try {
      const r = await inspectionsApi.list(filters)
      if (r.success && r.data) {
        setOrders(r.data)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleExportJson = () => {
    window.open(exportApi.jsonAll(), '_blank')
    notify('info', '正在导出全部数据为 JSON 格式')
  }

  const handleExportCsv = () => {
    window.open(exportApi.csvOrders(filters), '_blank')
    notify('info', '正在导出点检单为 CSV 格式')
  }

  const handleExportOrderJson = (id: string) => {
    window.open(exportApi.orderJson(id), '_blank')
  }

  const allStatuses: InspectionStatus[] = ['DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'COMPLETED', 'REVIEWED', 'CLOSED']

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Search className="w-4 h-4" />
          筛选条件
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <select
            value={filters.deviceId || ''}
            onChange={(e) => setFilters({ ...filters, deviceId: e.target.value || undefined })}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部设备</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={filters.shiftId || ''}
            onChange={(e) => setFilters({ ...filters, shiftId: e.target.value || undefined })}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部班次</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            {allStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <input
            type="date"
            value={filters.shiftDateFrom || ''}
            onChange={(e) => setFilters({ ...filters, shiftDateFrom: e.target.value || undefined })}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="起始日期"
          />
          <input
            type="date"
            value={filters.shiftDateTo || ''}
            onChange={(e) => setFilters({ ...filters, shiftDateTo: e.target.value || undefined })}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="截止日期"
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <span className="text-sm text-slate-500">共 {orders.length} 条记录</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-sm font-medium transition"
            >
              <FileJson className="w-4 h-4" />
              导出 JSON
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 text-sm font-medium transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              导出 CSV
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400">加载中...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
          <Search className="w-12 h-12 mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400">未找到匹配的点检记录</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">单号</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">设备</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">班次/日期</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">操作员</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">异常</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.map((order) => {
                const dev = devices.find((d) => d.id === order.deviceId)
                const shift = shifts.find((s) => s.id === order.shiftId)
                return (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-600">{order.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{dev?.name || '-'}</p>
                      <p className="text-xs text-slate-400">{dev?.code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-900">{order.shiftDate}</p>
                      <p className="text-xs text-slate-400">{shift?.name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{order.operator}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      {order.anomalies.length > 0 ? (
                        <span className="text-sm text-red-600 font-medium">{order.anomalies.length}</span>
                      ) : (
                        <span className="text-sm text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/execute?id=${order.id}`)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportOrderJson(order.id)}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition"
                          title="导出JSON"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
