import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { maintenanceApi } from '@/services/api'
import type { MaintenanceReminder, MaintenanceImportLog } from '@/types'
import { MAINTENANCE_STATUS_LABELS, MAINTENANCE_STATUS_COLORS } from '@/types'
import {
  Plus,
  Download,
  Upload,
  CheckCircle2,
  Undo2,
  Trash2,
  Edit3,
  X,
  Wrench,
  Calendar,
  User,
  FileText,
  AlertTriangle,
  Clock,
  CheckSquare,
  FileSpreadsheet,
} from 'lucide-react'

export default function MaintenancePage() {
  const { devices, loadMasterData, notify, currentUser } = useAppStore()
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([])
  const [importLogs, setImportLogs] = useState<MaintenanceImportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [deviceFilter, setDeviceFilter] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    deviceId: '',
    maintenanceDate: '',
    responsiblePerson: '',
    remark: '',
  })
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [showImportResult, setShowImportResult] = useState(false)
  const [latestImportLog, setLatestImportLog] = useState<MaintenanceImportLog | null>(null)

  useEffect(() => {
    loadMasterData()
    loadData()
  }, [loadMasterData])

  const loadData = async () => {
    setLoading(true)
    try {
      const filters: Record<string, string> = {}
      if (statusFilter) filters.status = statusFilter
      if (deviceFilter) filters.deviceId = deviceFilter
      const [res, logsRes] = await Promise.all([
        maintenanceApi.list(Object.keys(filters).length > 0 ? filters : undefined),
        maintenanceApi.importLogs(),
      ])
      if (res.success && res.data) {
        setReminders(res.data)
      }
      if (logsRes.success && logsRes.data) {
        setImportLogs(logsRes.data)
      }
    } catch (e) {
      notify('error', '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.deviceId || !formData.maintenanceDate || !formData.responsiblePerson.trim()) {
      notify('error', '请填写设备、保养日期和负责人')
      return
    }
    try {
      let res
      if (editingId) {
        res = await maintenanceApi.update(editingId, formData)
      } else {
        res = await maintenanceApi.create(formData)
      }
      if (res.success) {
        notify('success', editingId ? '修改成功' : '创建成功')
        setShowForm(false)
        setEditingId(null)
        resetForm()
        loadData()
      } else {
        notify('error', res.error?.message || '操作失败')
      }
    } catch (e) {
      notify('error', '操作失败')
    }
  }

  const handleComplete = async (id: string) => {
    try {
      const res = await maintenanceApi.complete(id, currentUser)
      if (res.success) {
        notify('success', '已标记为完成')
        loadData()
      } else {
        notify('error', res.error?.message || '操作失败')
      }
    } catch (e) {
      notify('error', '操作失败')
    }
  }

  const handleUndo = async (id: string) => {
    try {
      const res = await maintenanceApi.undo(id, currentUser)
      if (res.success) {
        notify('success', '已撤销完成')
        loadData()
      } else {
        notify('error', res.error?.message || '操作失败')
      }
    } catch (e) {
      notify('error', '操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条保养提醒吗？')) return
    try {
      const res = await maintenanceApi.remove(id)
      if (res.success) {
        notify('success', '删除成功')
        loadData()
      } else {
        notify('error', res.error?.message || '删除失败')
      }
    } catch (e) {
      notify('error', '删除失败')
    }
  }

  const handleEdit = (reminder: MaintenanceReminder) => {
    setEditingId(reminder.id)
    setFormData({
      deviceId: reminder.deviceId,
      maintenanceDate: reminder.maintenanceDate,
      responsiblePerson: reminder.responsiblePerson,
      remark: reminder.remark,
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      deviceId: '',
      maintenanceDate: '',
      responsiblePerson: '',
      remark: '',
    })
  }

  const handleExport = () => {
    window.open(maintenanceApi.exportCsv(), '_blank')
  }

  const handleImport = async () => {
    if (!importText.trim()) {
      notify('error', '请粘贴 CSV 内容')
      return
    }
    try {
      const res = await maintenanceApi.importCsv(importText, currentUser)
      if (res.success && res.data) {
        setLatestImportLog(res.data.log)
        setShowImportResult(true)
        setShowImport(false)
        setImportText('')
        notify(res.data.log.skipCount > 0 ? 'error' : 'success', `导入完成：成功 ${res.data.log.successCount} 条，跳过 ${res.data.log.skipCount} 条`)
        loadData()
      } else {
        notify('error', res.error?.message || '导入失败')
      }
    } catch (e) {
      notify('error', '导入失败')
    }
  }

  const getDeviceName = (deviceId: string) => {
    const dev = devices.find((d) => d.id === deviceId)
    return dev?.name || deviceId
  }

  const getDeviceCode = (deviceId: string) => {
    const dev = devices.find((d) => d.id === deviceId)
    return dev?.code || ''
  }

  const upcomingCount = reminders.filter((r) => r.status === 'UPCOMING').length
  const overdueCount = reminders.filter((r) => r.status === 'OVERDUE').length
  const completedCount = reminders.filter((r) => r.status === 'COMPLETED').length
  const pendingCount = reminders.filter((r) => r.status === 'PENDING').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-sm text-slate-500">待处理</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{pendingCount}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-slate-500">快到期</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{upcomingCount}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm text-slate-500">已逾期</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{overdueCount}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-slate-500">已完成</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{completedCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-slate-400" />
            设备保养提醒
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部状态</option>
              <option value="PENDING">待处理</option>
              <option value="UPCOMING">快到期</option>
              <option value="OVERDUE">已逾期</option>
              <option value="COMPLETED">已完成</option>
            </select>
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部设备</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button
              onClick={loadData}
              className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
            >
              刷新
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
            >
              <Download className="w-4 h-4" />
              导出 CSV
            </button>
            <button
              onClick={() => {
                setShowImport(true)
                setImportText('')
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              <Upload className="w-4 h-4" />
              导入 CSV
            </button>
            <button
              onClick={() => {
                resetForm()
                setEditingId(null)
                setShowForm(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              新增提醒
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400">加载中...</div>
        ) : reminders.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无保养提醒</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
            >
              创建第一条保养提醒 →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {reminders.map((reminder) => (
              <div key={reminder.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-slate-900 truncate">
                        {getDeviceName(reminder.deviceId)}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MAINTENANCE_STATUS_COLORS[reminder.status]}`}>
                        {MAINTENANCE_STATUS_LABELS[reminder.status]}
                      </span>
                      {getDeviceCode(reminder.deviceId) && (
                        <span className="text-xs text-slate-400">{getDeviceCode(reminder.deviceId)}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {reminder.maintenanceDate}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        {reminder.responsiblePerson}
                      </span>
                      {reminder.remark && (
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4" />
                          {reminder.remark}
                        </span>
                      )}
                      {reminder.completedAt && (
                        <span className="text-green-600 flex items-center gap-1.5">
                          <CheckSquare className="w-4 h-4" />
                          {reminder.completedBy} 于 {new Date(reminder.completedAt).toLocaleString('zh-CN')} 完成
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!reminder.completedAt ? (
                      <button
                        onClick={() => handleComplete(reminder.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="标记完成"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUndo(reminder.id)}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="撤销完成"
                      >
                        <Undo2 className="w-5 h-5" />
                      </button>
                    )}
                    {!reminder.completedAt && (
                      <button
                        onClick={() => handleEdit(reminder)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="编辑"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(reminder.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="删除"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {importLogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-slate-400" />
              最近导入记录
            </h2>
          </div>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {importLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-900">
                    {log.importedBy} 于 {new Date(log.importedAt).toLocaleString('zh-CN')} 导入
                  </span>
                  <span className="text-sm">
                    <span className="text-green-600">成功 {log.successCount}</span>
                    <span className="text-slate-400 mx-2">|</span>
                    <span className="text-red-600">跳过 {log.skipCount}</span>
                    <span className="text-slate-400 mx-2">|</span>
                    <span className="text-slate-500">共 {log.totalRows} 行</span>
                  </span>
                </div>
                {log.details.filter((d) => d.action === 'SKIPPED').length > 0 && (
                  <div className="text-xs text-slate-500 space-y-1">
                    {log.details.filter((d) => d.action === 'SKIPPED').slice(0, 3).map((d, i) => (
                      <div key={i} className="text-red-500">
                        第 {d.row} 行: {d.reason}
                      </div>
                    ))}
                    {log.details.filter((d) => d.action === 'SKIPPED').length > 3 && (
                      <div className="text-slate-400">
                        ...还有 {log.details.filter((d) => d.action === 'SKIPPED').length - 3} 条跳过记录
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                {editingId ? '编辑保养提醒' : '新增保养提醒'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  resetForm()
                }}
                className="p-1 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">设备</label>
                <select
                  value={formData.deviceId}
                  onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择设备</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">保养日期</label>
                <input
                  type="date"
                  value={formData.maintenanceDate}
                  onChange={(e) => setFormData({ ...formData, maintenanceDate: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">负责人</label>
                <input
                  type="text"
                  value={formData.responsiblePerson}
                  onChange={(e) => setFormData({ ...formData, responsiblePerson: e.target.value })}
                  placeholder="请输入负责人姓名"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">备注</label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  placeholder="可选：填写保养内容或注意事项"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  resetForm()
                }}
                className="px-5 py-2.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-5 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                {editingId ? '保存修改' : '创建提醒'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">导入保养提醒</h3>
              <button
                onClick={() => setShowImport(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-medium mb-1">CSV 格式要求：</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                  <li>必须包含列：<code className="bg-blue-100 px-1 rounded">设备编码</code>、<code className="bg-blue-100 px-1 rounded">保养日期</code>、<code className="bg-blue-100 px-1 rounded">负责人</code></li>
                  <li>可选列：<code className="bg-blue-100 px-1 rounded">设备名称</code>、<code className="bg-blue-100 px-1 rounded">备注</code></li>
                  <li>日期格式：YYYY-MM-DD</li>
                </ul>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">粘贴 CSV 内容</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`设备编码,设备名称,保养日期,负责人,备注\nDEV001,CNC加工中心,2025-01-15,张三,月度保养\nDEV002,数控车床,2025-01-20,李四,季度保养`}
                  rows={12}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowImport(false)}
                className="px-5 py-2.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                className="px-5 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                开始导入
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportResult && latestImportLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">导入结果</h3>
              <button
                onClick={() => setShowImportResult(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{latestImportLog.totalRows}</p>
                  <p className="text-sm text-slate-500">总行数</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{latestImportLog.successCount}</p>
                  <p className="text-sm text-slate-500">成功导入</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{latestImportLog.skipCount}</p>
                  <p className="text-sm text-slate-500">跳过</p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-slate-700">详细记录</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">行号</th>
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">设备</th>
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">日期</th>
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">结果</th>
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {latestImportLog.details.map((d, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-slate-500">{d.row}</td>
                          <td className="px-3 py-2 text-slate-700">{d.deviceCode || '-'}</td>
                          <td className="px-3 py-2 text-slate-500">{d.maintenanceDate || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={d.action === 'IMPORTED' ? 'text-green-600' : 'text-red-600'}>
                              {d.action === 'IMPORTED' ? '成功' : '跳过'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{d.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowImportResult(false)}
                className="px-5 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
