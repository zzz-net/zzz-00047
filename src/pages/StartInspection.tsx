import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { inspectionsApi } from '@/services/api'
import { useNavigate } from 'react-router-dom'
import { PlayCircle, ChevronRight } from 'lucide-react'

export default function StartInspection() {
  const { plans, devices, shifts, loadMasterData } = useAppStore()
  const navigate = useNavigate()
  const [selectedPlan, setSelectedPlan] = useState('')
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().slice(0, 10))
  const [operator, setOperator] = useState(useAppStore.getState().currentUser)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadMasterData()
  }, [loadMasterData])

  const plan = plans.find((p) => p.id === selectedPlan)
  const dev = plan ? devices.find((d) => d.id === plan.deviceId) : null
  const shift = plan ? shifts.find((s) => s.id === plan.shiftId) : null

  const handleCreate = async () => {
    if (!plan || !shiftDate || !operator.trim()) return
    setSubmitting(true)
    try {
      const r = await inspectionsApi.create({
        planId: plan.id,
        deviceId: plan.deviceId,
        shiftId: plan.shiftId,
        shiftDate,
        operator: operator.trim(),
      })
      if (r.success && r.data) {
        navigate(`/execute?id=${r.data.id}`)
      } else if (r.error) {
        useAppStore.getState().notify('error', r.error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <PlayCircle className="w-5 h-5" />
            创建点检单
          </h2>
          <p className="text-blue-100 text-sm mt-1">选择计划、日期和操作员，开始新的点检任务</p>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">选择点检计划 *</label>
            <div className="space-y-2">
              {plans.map((p) => {
                const d = devices.find((x) => x.id === p.deviceId)
                const s = shifts.find((x) => x.id === p.shiftId)
                const isSelected = selectedPlan === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlan(p.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {d?.name || p.deviceId} · {s?.name || p.shiftId} · {p.checkItemIds.length}项检查
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 ${isSelected ? 'text-blue-500' : 'text-slate-300'}`} />
                    </div>
                  </button>
                )
              })}
            </div>
            {plans.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">
                暂无点检计划，请先到
                <a href="/config" className="text-blue-600">计划配置</a>
                中创建
              </p>
            )}
          </div>

          {plan && dev && shift && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">计划详情</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">设备：</span>
                  <span className="font-medium text-slate-900">{dev.name}</span>
                  <span className="text-slate-400 ml-1">({dev.code})</span>
                </div>
                <div>
                  <span className="text-slate-500">班次：</span>
                  <span className="font-medium text-slate-900">{shift.name}</span>
                  <span className="text-slate-400 ml-1">({shift.startTime}-{shift.endTime})</span>
                </div>
                <div>
                  <span className="text-slate-500">位置：</span>
                  <span className="font-medium text-slate-900">{dev.location}</span>
                </div>
                <div>
                  <span className="text-slate-500">频次：</span>
                  <span className="font-medium text-slate-900">{plan.frequency}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-sm">检查项：</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {plan.checkItemIds.map((ciId) => {
                    const ci = useAppStore.getState().checkItems.find((c) => c.id === ciId)
                    return (
                      <span key={ciId} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700">
                        {ci?.name || ciId}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">班次日期 *</label>
            <input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">操作员 *</label>
            <input
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="输入操作员姓名"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={!selectedPlan || !shiftDate || !operator.trim() || submitting}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
          >
            <PlayCircle className="w-5 h-5" />
            {submitting ? '创建中...' : '创建点检单并开始'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            注意：同一设备同一班次日期只能创建一张点检单，重复创建将被拦截
          </p>
        </div>
      </div>
    </div>
  )
}
