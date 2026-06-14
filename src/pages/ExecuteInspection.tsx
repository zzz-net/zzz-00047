import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { inspectionsApi, filesApi } from '@/services/api'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { InspectionItemResult, AnomalyRecord, InspectionOrder } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import SeverityBadge from '@/components/SeverityBadge'
import {
  CheckCircle2,
  AlertTriangle,
  Camera,
  Undo2,
  Send,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react'

export default function ExecuteInspection() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const orderId = params.get('id')
  const {
    devices, shifts, checkItems, loadMasterData,
    currentOrder, loadOrder, notify,
  } = useAppStore()

  const [order, setOrder] = useState<InspectionOrder | null>(null)
  const [results, setResults] = useState<Map<string, { status: 'NORMAL' | 'ANOMALY'; remark: string; anomalyDesc: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; evidencePaths: string[] }>>(new Map())
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [undoing, setUndoing] = useState(false)

  useEffect(() => {
    loadMasterData()
  }, [loadMasterData])

  useEffect(() => {
    if (orderId) loadOrder(orderId)
  }, [orderId, loadOrder])

  useEffect(() => {
    if (currentOrder) {
      setOrder(currentOrder)
      const m = new Map<string, typeof results extends Map<string, infer V> ? V : never>()
      currentOrder.results.forEach((r) => {
        const anomaly = currentOrder.anomalies.find((a) => a.checkItemId === r.checkItemId)
        m.set(r.checkItemId, {
          status: r.status,
          remark: r.remark || '',
          anomalyDesc: anomaly?.description || '',
          severity: anomaly?.severity || 'MEDIUM',
          evidencePaths: anomaly?.evidencePaths || [],
        })
      })
      setResults(m)
    }
  }, [currentOrder])

  const getItemInfo = useCallback(
    (itemId: string) => checkItems.find((c) => c.id === itemId),
    [checkItems],
  )

  const dev = order ? devices.find((d) => d.id === order.deviceId) : null
  const shift = order ? shifts.find((s) => s.id === order.shiftId) : null

  if (!orderId) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p>请从工作台或"开始点检"选择点检单</p>
        <button onClick={() => navigate('/start')} className="mt-4 text-blue-600 text-sm hover:underline">
          去创建点检单 →
        </button>
      </div>
    )
  }

  if (!order) {
    return <div className="text-center py-20 text-slate-400">加载中...</div>
  }

  const planCheckItems = (() => {
    const plan = useAppStore.getState().plans.find((p) => p.id === order.planId)
    if (!plan) return checkItems
    return plan.checkItemIds.map((id) => checkItems.find((c) => c.id === id)).filter(Boolean) as typeof checkItems
  })()

  const setItemStatus = (itemId: string, status: 'NORMAL' | 'ANOMALY') => {
    setResults((prev) => {
      const next = new Map(prev)
      const existing = next.get(itemId) || { status: 'NORMAL' as const, remark: '', anomalyDesc: '', severity: 'MEDIUM' as const, evidencePaths: [] as string[] }
      next.set(itemId, { ...existing, status })
      return next
    })
    if (status === 'ANOMALY') setExpandedItem(itemId)
  }

  const updateItemField = (itemId: string, field: string, value: string) => {
    setResults((prev) => {
      const next = new Map(prev)
      const existing = next.get(itemId) || { status: 'ANOMALY' as const, remark: '', anomalyDesc: '', severity: 'MEDIUM' as const, evidencePaths: [] as string[] }
      next.set(itemId, { ...existing, [field]: value })
      return next
    })
  }

  const handleUpload = async (itemId: string, files: FileList) => {
    setUploading(itemId)
    for (const file of Array.from(files)) {
      const r = await filesApi.uploadEvidence(file)
      if (r.success && r.data) {
        setResults((prev) => {
          const next = new Map(prev)
          const existing = next.get(itemId) || { status: 'ANOMALY' as const, remark: '', anomalyDesc: '', severity: 'MEDIUM' as const, evidencePaths: [] as string[] }
          next.set(itemId, { ...existing, evidencePaths: [...existing.evidencePaths, r.data!.path] })
          return next
        })
      } else {
        notify('error', `上传失败: ${r.error?.message || '未知错误'}`)
      }
    }
    setUploading(null)
  }

  const removeEvidence = (itemId: string, idx: number) => {
    setResults((prev) => {
      const next = new Map(prev)
      const existing = next.get(itemId)
      if (!existing) return prev
      const paths = [...existing.evidencePaths]
      paths.splice(idx, 1)
      next.set(itemId, { ...existing, evidencePaths: paths })
      return next
    })
  }

  const handleSave = async () => {
    if (!order) return
    setSaving(true)
    try {
      const resultArr: (Omit<InspectionItemResult, 'id' | 'checkedAt'> & { id?: string })[] = []
      const anomalyArr: (Omit<AnomalyRecord, 'id' | 'inspectionOrderId' | 'reportedAt'> & { id?: string })[] = []

      results.forEach((val, checkItemId) => {
        resultArr.push({
          checkItemId,
          status: val.status,
          remark: val.remark || undefined,
          checkedBy: order.operator,
        })
        if (val.status === 'ANOMALY') {
          anomalyArr.push({
            checkItemId,
            description: val.anomalyDesc || '异常',
            severity: val.severity,
            evidencePaths: val.evidencePaths,
            reportedBy: order.operator,
          })
        }
      })

      const r = await inspectionsApi.updateResults(order.id, {
        results: resultArr,
        anomalies: anomalyArr,
        operator: useAppStore.getState().currentUser,
      })
      if (r.success && r.data) {
        setOrder(r.data)
        notify('success', '检查结果已保存')
      } else if (r.error) {
        notify('error', r.error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!order) return
    setSubmitting(true)
    try {
      await handleSave()
      const r = await inspectionsApi.submit(order.id, useAppStore.getState().currentUser)
      if (r.success && r.data) {
        setOrder(r.data)
        notify('success', '点检单已提交')
      } else if (r.error) {
        notify('error', r.error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleUndo = async () => {
    if (!order) return
    setUndoing(true)
    try {
      const r = await inspectionsApi.undo(order.id, useAppStore.getState().currentUser)
      if (r.success && r.data) {
        setOrder(r.data)
        const m = new Map<string, typeof results extends Map<string, infer V> ? V : never>()
        r.data.results.forEach((res) => {
          const anomaly = r.data!.anomalies.find((a) => a.checkItemId === res.checkItemId)
          m.set(res.checkItemId, {
            status: res.status,
            remark: res.remark || '',
            anomalyDesc: anomaly?.description || '',
            severity: anomaly?.severity || 'MEDIUM',
            evidencePaths: anomaly?.evidencePaths || [],
          })
        })
        setResults(m)
        notify('success', '已撤销上一步操作')
      } else if (r.error) {
        notify('error', r.error.message)
      }
    } finally {
      setUndoing(false)
    }
  }

  const isDraft = order.status === 'DRAFT'
  const canUndo = order.operationLogs && order.operationLogs.length >= 2 && order.operationLogs[order.operationLogs.length - 1].action !== 'CREATE'
  const filledCount = results.size
  const totalItems = planCheckItems.length
  const anomalyCount = Array.from(results.values()).filter((r) => r.status === 'ANOMALY').length

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{dev?.name || order.deviceId}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {shift?.name || order.shiftId} · {order.shiftDate} · 操作员: {order.operator}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{filledCount}/{totalItems}</p>
            <p className="text-xs text-slate-500">已检查</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{filledCount - anomalyCount}</p>
            <p className="text-xs text-green-600">正常</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{anomalyCount}</p>
            <p className="text-xs text-red-600">异常</p>
          </div>
        </div>

        <div className="flex gap-2">
          {isDraft && (
            <>
              <button
                onClick={handleSave}
                disabled={saving || filledCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 text-sm font-medium transition"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存草稿'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || filledCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-sm font-medium transition shadow-lg shadow-blue-600/25"
              >
                <Send className="w-4 h-4" />
                {submitting ? '提交中...' : '提交点检单'}
              </button>
            </>
          )}
          {canUndo && (
            <button
              onClick={handleUndo}
              disabled={undoing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 disabled:opacity-50 text-sm font-medium transition"
            >
              <Undo2 className="w-4 h-4" />
              {undoing ? '撤销中...' : '撤销上一步'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {planCheckItems.map((item) => {
          const val = results.get(item.id)
          const status = val?.status || null
          const isExpanded = expandedItem === item.id

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border-2 shadow-sm transition-all ${
                status === 'ANOMALY' ? 'border-red-200' : status === 'NORMAL' ? 'border-green-200' : 'border-slate-200'
              }`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">{item.code}</span>
                      <span className="text-xs text-slate-400">{item.category}</span>
                    </div>
                    <p className="font-semibold text-slate-900 mt-1">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.standard}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {isDraft ? (
                      <>
                        <button
                          onClick={() => setItemStatus(item.id, 'NORMAL')}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${
                            status === 'NORMAL'
                              ? 'bg-green-500 text-white shadow-md shadow-green-500/30'
                              : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          正常
                        </button>
                        <button
                          onClick={() => setItemStatus(item.id, 'ANOMALY')}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${
                            status === 'ANOMALY'
                              ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                              : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4" />
                          异常
                        </button>
                      </>
                    ) : (
                      <span className={`flex items-center gap-1 text-sm font-medium ${status === 'NORMAL' ? 'text-green-600' : 'text-red-600'}`}>
                        {status === 'NORMAL' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {status === 'NORMAL' ? '正常' : '异常'}
                      </span>
                    )}

                    {status === 'ANOMALY' && (
                      <button
                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                        className="p-2 rounded-lg hover:bg-slate-100 transition"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </button>
                    )}
                  </div>
                </div>

                {status === 'ANOMALY' && isExpanded && isDraft && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">严重程度</label>
                      <div className="flex gap-2">
                        {(['LOW', 'MEDIUM', 'HIGH'] as const).map((sev) => (
                          <button
                            key={sev}
                            onClick={() => updateItemField(item.id, 'severity', sev)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                              val?.severity === sev
                                ? sev === 'HIGH' ? 'bg-red-500 text-white' : sev === 'MEDIUM' ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {sev === 'LOW' ? '低' : sev === 'MEDIUM' ? '中' : '高'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">异常描述 *</label>
                      <textarea
                        value={val?.anomalyDesc || ''}
                        onChange={(e) => updateItemField(item.id, 'anomalyDesc', e.target.value)}
                        placeholder="请详细描述异常情况..."
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">照片证据 *</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {val?.evidencePaths.map((ep, idx) => (
                          <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                            <img src={filesApi.evidenceUrl(ep)} alt="" className="w-full h-full object-cover" />
                            {isDraft && (
                              <button
                                onClick={() => removeEvidence(item.id, idx)}
                                className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                        <label className={`w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition ${uploading === item.id ? 'opacity-50 pointer-events-none' : ''}`}>
                          <Camera className="w-5 h-5 text-slate-400" />
                          <span className="text-xs text-slate-400 mt-1">
                            {uploading === item.id ? '上传中' : '上传'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => e.target.files && handleUpload(item.id, e.target.files)}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-slate-400">异常项必须上传至少一张照片证据，否则提交时将被拦截</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
                      <input
                        value={val?.remark || ''}
                        onChange={(e) => updateItemField(item.id, 'remark', e.target.value)}
                        placeholder="可选备注"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {!isDraft && status === 'ANOMALY' && val && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <SeverityBadge severity={val.severity} />
                      <span className="text-sm text-slate-700">{val.anomalyDesc}</span>
                    </div>
                    {val.evidencePaths.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {val.evidencePaths.map((ep, idx) => (
                          <img key={idx} src={filesApi.evidenceUrl(ep)} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {order.operationLogs && order.operationLogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-slate-400" />
            操作记录
          </h3>
          <div className="space-y-2">
            {order.operationLogs.map((log, idx) => (
              <div key={log.id} className="flex items-center gap-3 text-sm py-1.5">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-slate-500">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-slate-700 font-medium">{log.action}</span>
                  {log.fromStatus && log.toStatus && (
                    <span className="text-slate-400 ml-2">
                      {log.fromStatus} → {log.toStatus}
                    </span>
                  )}
                  {log.remark && <span className="text-slate-400 ml-2">- {log.remark}</span>}
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{log.operator}</span>
                <span className="text-xs text-slate-300 flex-shrink-0">{new Date(log.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
