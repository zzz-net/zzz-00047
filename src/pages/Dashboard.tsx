import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { Link } from 'react-router-dom'
import {
  PlayCircle,
  CheckSquare,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'

export default function Dashboard() {
  const { orders, devices, plans, loadMasterData, loadOrders } = useAppStore()

  useEffect(() => {
    loadMasterData()
    loadOrders()
  }, [loadMasterData, loadOrders])

  const draftCount = orders.filter((o) => o.status === 'DRAFT').length
  const pendingCount = orders.filter((o) => o.status === 'PENDING_REVIEW').length
  const reviewedCount = orders.filter((o) => o.status === 'REVIEWED').length
  const completedCount = orders.filter((o) => o.status === 'COMPLETED' || o.status === 'CLOSED').length

  const recentOrders = orders.slice(0, 8)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <PlayCircle className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-slate-500">草稿中</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{draftCount}</p>
          <Link to="/start" className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-flex items-center gap-1">
            开始点检 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <span className="text-sm text-slate-500">待复核</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{pendingCount}</p>
          <Link to="/review" className="text-xs text-yellow-600 hover:text-yellow-800 mt-1 inline-flex items-center gap-1">
            去复核 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-slate-500">已复核待关闭</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{reviewedCount}</p>
          <Link to="/review" className="text-xs text-purple-600 hover:text-purple-800 mt-1 inline-flex items-center gap-1">
            去关闭 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-slate-500">已完成</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{completedCount}</p>
          <Link to="/history" className="text-xs text-green-600 hover:text-green-800 mt-1 inline-flex items-center gap-1">
            查看历史 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              最近点检单
            </h2>
            <Link to="/history" className="text-sm text-blue-600 hover:text-blue-800">
              查看全部 →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无点检记录</p>
              <Link to="/start" className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block">
                开始第一次点检 →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentOrders.map((order) => {
                const dev = devices.find((d) => d.id === order.deviceId)
                return (
                  <Link
                    key={order.id}
                    to={`/execute?id=${order.id}`}
                    className="flex items-center justify-between p-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {dev?.name || order.deviceId}
                        </p>
                        <p className="text-xs text-slate-500">
                          {order.shiftDate} · {order.operator}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {order.anomalies.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <XCircle className="w-3.5 h-3.5" />
                          {order.anomalies.length}异常
                        </span>
                      )}
                      <StatusBadge status={order.status} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-slate-400" />
              点检计划
            </h2>
          </div>
          {plans.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <p>暂无计划</p>
              <Link to="/config" className="text-blue-600 text-sm mt-2 inline-block">去配置 →</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {plans.slice(0, 6).map((plan) => {
                const dev = devices.find((d) => d.id === plan.deviceId)
                return (
                  <div key={plan.id} className="p-4">
                    <p className="text-sm font-medium text-slate-900">{plan.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {dev?.name || plan.deviceId} · {plan.checkItemIds.length}项 · {plan.frequency}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
