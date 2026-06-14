import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { inspectionsApi, filesApi } from '@/services/api'
import { useNavigate } from 'react-router-dom'
import type { InspectionOrder } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import SeverityBadge from '@/components/SeverityBadge'
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Eye,
  Lock,
  Undo2,
  Image as ImageIcon,
} from 'lucide-react'

export default function ReviewPage() {
  const { devices, shifts, checkItems, loadMasterData, notify } = useAppStore()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<InspectionOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<InspectionOrder | null>(null)
  const [supervisor, setSupervisor] = useState(useAppStore.getState().currentUser)
  const [resolution, setResolution] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending')

  useEffect(() => {
    loadMasterData()
    loadReviewOrders()
  }, [loadMasterData])

  const loadReviewOrders = async () => {
    const r = await inspectionsApi.list()
    if (r.success && r.data) {
      setOrders(r.data)
    }
  }

  const pendingOrders = orders.filter((o) => o.status === 'PENDING_REVIEW')
  const reviewedOrders = orders.filter((o) => o.status === 'REVIEWED')
  const activeOrders = tab === 'pending' ? pendingOrders : reviewedOrders

  const handleReview = async (order: InspectionOrder) => {
    if (!supervisor.trim()) {
      notify('error', '请输入主管姓名')
      return
    }
    setActionLoading(true)
    try {
      const r = await inspectionsApi.review(order.id, supervisor.trim(), resolution || undefined)
      if (r.success && r.data) {
        notify('success', `点检单 ${order.id} 复核通过`)
        setSelectedOrder(null)
        setResolution('')
        loadReviewOrders()
      } else if (r.error) {
        notify('error', r.error.message)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleClose = async (order: InspectionOrder) => {
    if (!supervisor.trim()) {
      notify('error', '请输入操作员姓名')
      return
    }
    setActionLoading(true)
    try {
      const r = await inspectionsApi.close(order.id, supervisor.trim())
      if (r.success && r.data) {
        notify('success', `点检单 ${order.id} 已关闭`)
        setSelectedOrder(null)
        loadReviewOrders()
      } else if (r.error) {
        notify('error', r.error.message)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleUndo = async (order: InspectionOrder) => {
    if (!supervisor.trim()) return
    setActionLoading(true)
    try {
      const r = await inspectionsApi.undo(order.id, supervisor.trim())
      if (r.success && r.data) {
        notify('success', '已撤销上一步操作')
        setSelectedOrder(null)
        loadReviewOrders()
      } else if (r.error) {
        notify('error', r.error.message)
      }
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex bg-white rounded-xl border border-slate-200 p-1">
          <button
            onClick={() => setTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === 'pending' ? 'bg-yellow-500 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            待复核 ({pendingOrders.length})
          </button>
          <button
            onClick={() => setTab('reviewed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === 'reviewed' ? 'bg-purple-500 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            已复核待关闭 ({reviewedOrders.length})
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-slate-500">当前用户:</label>
          <input
            value={supervisor}
            onChange={(e) => setSupervisor(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {activeOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
          <FileCheck className="w-16 h-16 mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 text-lg">
            {tab === 'pending' ? '暂无待复核点检单' : '暂无已复核待关闭点检单'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            {activeOrders.map((order) => {
              const dev = devices.find((d) => d.id === order.deviceId)
              const shift = shifts.find((s) => s.id === order.shiftId)
              const isSelected = selectedOrder?.id === order.id
              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full text-left bg-white rounded-2xl border-2 p-5 transition-all ${
                    isSelected
                      ? 'border-blue-500 shadow-lg shadow-blue-500/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-slate-900">{dev?.name || order.deviceId}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {shift?.name || order.shiftId} · {order.shiftDate} · {order.operator}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {order.results.filter((r) => r.status === 'NORMAL').length}正常
                    </span>
                    {order.anomalies.length > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-3.5 h-3.5" />
                        {order.anomalies.length}异常
                      </span>
                    )}
                    <span className="text-slate-400 text-xs ml-auto">{order.id}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {selectedOrder && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-24">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-slate-400" />
                点检单详情
              </h3>

              <div className="space-y-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm text-slate-500">单号: <span className="font-mono text-slate-900">{selectedOrder.id}</span></p>
                  <p className="text-sm text-slate-500 mt-1">设备: <span className="font-medium text-slate-900">{devices.find((d) => d.id === selectedOrder.deviceId)?.name}</span></p>
                  <p className="text-sm text-slate-500 mt-1">操作员: <span className="font-medium text-slate-900">{selectedOrder.operator}</span></p>
                </div>

                {selectedOrder.anomalies.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">异常记录</h4>
                    <div className="space-y-3">
                      {selectedOrder.anomalies.map((anomaly) => {
                        const ci = checkItems.find((c) => c.id === anomaly.checkItemId)
                        return (
                          <div key={anomaly.id} className="border border-red-100 bg-red-50/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <SeverityBadge severity={anomaly.severity} />
                              <span className="font-medium text-slate-900">{ci?.name || anomaly.checkItemId}</span>
                            </div>
                            <p className="text-sm text-slate-700">{anomaly.description}</p>
                            {anomaly.evidencePaths.length > 0 ? (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {anomaly.evidencePaths.map((ep, idx) => (
                                  <img key={idx} src={filesApi.evidenceUrl(ep)} alt="" className="w-20 h-20 rounded-lg object-cover border border-slate-200" />
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> 缺少照片证据（无法通过复核）
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">处理意见</label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="可选：填写复核意见"
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  {selectedOrder.status === 'PENDING_REVIEW' && (
                    <button
                      onClick={() => handleReview(selectedOrder)}
                      disabled={actionLoading}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition shadow-lg shadow-purple-600/25"
                    >
                      {actionLoading ? '处理中...' : '复核通过'}
                    </button>
                  )}
                  {selectedOrder.status === 'REVIEWED' && (
                    <button
                      onClick={() => handleClose(selectedOrder)}
                      disabled={actionLoading}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition shadow-lg shadow-green-600/25"
                    >
                      {actionLoading ? '处理中...' : '关闭异常'}
                    </button>
                  )}
                  {selectedOrder.operationLogs && selectedOrder.operationLogs.length >= 2 && (
                    <button
                      onClick={() => handleUndo(selectedOrder)}
                      disabled={actionLoading}
                      className="px-4 py-2.5 rounded-xl font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-50 transition"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/execute?id=${selectedOrder.id}`)}
                    className="px-4 py-2.5 rounded-xl font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
                  >
                    查看详情
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
