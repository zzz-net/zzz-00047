import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { handoverApi } from '@/services/api'
import type { HandoverRecord, HandoverImportLog, HandoverOperationLog } from '@/types'
import { SHIFT_TYPE_LABELS, HANDOVER_ACTION_LABELS } from '@/types'
import {
  Plus,
  Download,
  Upload,
  CheckCircle2,
  Undo2,
  Trash2,
  Edit3,
  X,
  ArrowRightLeft,
  Calendar,
  User,
  FileText,
  Clock,
  CheckSquare,
  FileSpreadsheet,
  Cpu,
  AlertCircle,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

export default function HandoverPage() {
  const { devices, shifts, loadMasterData, notify, currentUser } = useAppStore()
  const [records, setRecords] = useState<HandoverRecord[]>([])
  const [importLogs, setImportLogs] = useState<HandoverImportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [deviceFilter, setDeviceFilter] = useState<string>('')
  const [shiftFilter, setShiftFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [confirmedFilter, setConfirmedFilter] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    deviceId: '',
    shiftId: '',
    handoverDate: '',
    equipmentStatus: '',
    remainingIssues: '',
    handoverPerson: '',
    takeoverPerson: '',
  })
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [showImportResult, setShowImportResult] = useState(false)
  const [latestImportLog, setLatestImportLog] = useState<HandoverImportLog | null>(null)
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadMasterData()
    loadData()
  }, [loadMasterData])

  const loadData = async () => {
    setLoading(true)
    try {
      const filters: Record<string, string> = {}
      if (deviceFilter) filters.deviceId = deviceFilter
      if (shiftFilter) filters.shiftId = shiftFilter
      if (dateFrom) filters.dateFrom = dateFrom
      if (dateTo) filters.dateTo = dateTo
      if (confirmedFilter !== '') filters.isConfirmed = confirmedFilter
      const [res, logsRes] = await Promise.all([
        handoverApi.list(Object.keys(filters).length > 0 ? filters : undefined),
        handoverApi.importLogs(),
      ])
      if (res.success && res.data) {
        setRecords(res.data)
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
    if (
      !formData.deviceId ||
      !formData.shiftId ||
      !formData.handoverDate ||
      !formData.handoverPerson.trim() ||
      !formData.takeoverPerson.trim()
    ) {
      notify('error', '请填写设备、班次、交接日期、交班人和接班人')
      return
    }
    try {
      let res
      if (editingId) {
        res = await handoverApi.update(editingId, { ...formData, operator: currentUser })
      } else {
        res = await handoverApi.create({ ...formData, operator: currentUser })
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

  const handleConfirm = async (id: string) => {
    try {
      const res = await handoverApi.confirm(id, currentUser)
      if (res.success) {
        notify('success', '已确认交接')
        loadData()
      } else {
        notify('error', res.error?.message || '操作失败')
      }
    } catch (e) {
      notify('error', '操作失败')
    }
  }

  const handleUndoConfirm = async (id: string) => {
    try {
      const res = await handoverApi.undoConfirm(id, currentUser)
      if (res.success) {
        notify('success', '已撤销确认')
        loadData()
      } else {
        notify('error', res.error?.message || '操作失败')
      }
    } catch (e) {
      notify('error', '操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条交接班记录吗？删除操作会记录到日志中。')) return
    try {
      const res = await handoverApi.remove(id)
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

  const handleEdit = (record: HandoverRecord) => {
    setEditingId(record.id)
    setFormData({
      deviceId: record.deviceId,
      shiftId: record.shiftId,
      handoverDate: record.handoverDate,
      equipmentStatus: record.equipmentStatus,
      remainingIssues: record.remainingIssues,
      handoverPerson: record.handoverPerson,
      takeoverPerson: record.takeoverPerson,
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      deviceId: '',
      shiftId: '',
      handoverDate: '',
      equipmentStatus: '',
      remainingIssues: '',
      handoverPerson: '',
      takeoverPerson: '',
    })
  }

  const handleExport = () => {
    window.open(handoverApi.exportCsv(), '_blank')
  }

  const handleImport = async () => {
    if (!importText.trim()) {
      notify('error', '请粘贴 CSV 内容')
      return
    }
    try {
      const res = await handoverApi.importCsv(importText, currentUser)
      if (res.success && res.data) {
        setLatestImportLog(res.data.log)
        setShowImportResult(true)
        setShowImport(false)
        setImportText('')
        notify(
          res.data.log.skipCount > 0 ? 'error' : 'success',
          `导入完成：成功 ${res.data.log.successCount} 条，跳过 ${res.data.log.skipCount} 条`,
        )
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

  const getShift = (shiftId: string) => {
    return shifts.find((s) => s.id === shiftId)
  }

  const toggleLogs = (id: string) => {
    setExpandedLogs((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const totalCount = records.length
  const confirmedCount = records.filter((r) => r.isConfirmed).length
  const pendingCount = records.filter((r) => !r.isConfirmed).length
  const withIssuesCount = records.filter((r) => r.remainingIssues.trim()).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-sm text-slate-500">总记录</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{totalCount}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-slate-500">待确认</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-slate-500">已确认</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{confirmedCount}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm text-slate-500">有遗留问题</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{withIssuesCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-slate-400" />
            交接班记录
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部设备</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部班次</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="起始日期"
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="结束日期"
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={confirmedFilter}
              onChange={(e) => setConfirmedFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部状态</option>
              <option value="false">待确认</option>
              <option value="true">已确认</option>
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
              新增记录
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400">加载中...</div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无交接班记录</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
            >
              创建第一条交接班记录 →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {records.map((record) => {
              const shift = getShift(record.shiftId)
              const logsExpanded = expandedLogs[record.id]
              const sortedLogs = [...record.operationLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
              return (
                <div key={record.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <h3 className="font-medium text-slate-900 truncate flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-slate-400" />
                          {getDeviceName(record.deviceId)}
                        </h3>
                        {record.isConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckSquare className="w-3 h-3" />
                            已确认
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" />
                            待确认
                          </span>
                        )}
                        {getDeviceCode(record.deviceId) && (
                          <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                            {getDeviceCode(record.deviceId)}
                          </span>
                        )}
                        {shift && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {shift.name} · {SHIFT_TYPE_LABELS[shift.type]}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 mb-3">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {record.handoverDate}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <User className="w-4 h-4" />
                          交班：{record.handoverPerson}
                          <ArrowRightLeft className="w-3 h-3 text-slate-300 mx-1" />
                          接班：{record.takeoverPerson}
                        </span>
                        {record.confirmedAt && (
                          <span className="text-green-600 flex items-center gap-1.5">
                            <CheckSquare className="w-4 h-4" />
                            {record.confirmedBy} 于 {new Date(record.confirmedAt).toLocaleString('zh-CN')} 确认
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        {record.equipmentStatus && (
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-xs text-slate-500 mb-1 font-medium">设备状态</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{record.equipmentStatus}</p>
                          </div>
                        )}
                        {record.remainingIssues && (
                          <div className="bg-red-50 rounded-lg p-3">
                            <p className="text-xs text-red-500 mb-1 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              遗留问题
                            </p>
                            <p className="text-sm text-red-700 whitespace-pre-wrap">{record.remainingIssues}</p>
                          </div>
                        )}
                      </div>
                      {record.operationLogs.length > 0 && (
                        <div>
                          <button
                            onClick={() => toggleLogs(record.id)}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition"
                          >
                            <History className="w-3.5 h-3.5" />
                            操作日志 ({record.operationLogs.length} 条)
                            {logsExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {logsExpanded && (
                            <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="px-3 py-1.5 text-left text-slate-600 font-medium">时间</th>
                                    <th className="px-3 py-1.5 text-left text-slate-600 font-medium">操作</th>
                                    <th className="px-3 py-1.5 text-left text-slate-600 font-medium">操作人</th>
                                    <th className="px-3 py-1.5 text-left text-slate-600 font-medium">备注</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {sortedLogs.map((log: HandoverOperationLog) => (
                                    <tr key={log.id}>
                                      <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleString('zh-CN')}
                                      </td>
                                      <td className="px-3 py-1.5">
                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                          {HANDOVER_ACTION_LABELS[log.action]}
                                        </span>
                                      </td>
                                      <td className="px-3 py-1.5 text-slate-700">{log.operator}</td>
                                      <td className="px-3 py-1.5 text-slate-500">{log.remark || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      {!record.isConfirmed ? (
                        <button
                          onClick={() => handleConfirm(record.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="确认交接"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUndoConfirm(record.id)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="撤销确认"
                        >
                          <Undo2 className="w-5 h-5" />
                        </button>
                      )}
                      {!record.isConfirmed && (
                        <button
                          onClick={() => handleEdit(record)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="编辑"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="删除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
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
                    {log.details
                      .filter((d) => d.action === 'SKIPPED')
                      .slice(0, 3)
                      .map((d, i) => (
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-slate-900">
                {editingId ? '编辑交接班记录' : '新增交接班记录'}
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
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">设备</label>
                  <select
                    value={formData.deviceId}
                    onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择设备</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">班次</label>
                  <select
                    value={formData.shiftId}
                    onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择班次</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({SHIFT_TYPE_LABELS[s.type]} · {s.startTime}-{s.endTime})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">交接日期</label>
                  <input
                    type="date"
                    value={formData.handoverDate}
                    onChange={(e) => setFormData({ ...formData, handoverDate: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">交班人</label>
                  <input
                    type="text"
                    value={formData.handoverPerson}
                    onChange={(e) => setFormData({ ...formData, handoverPerson: e.target.value })}
                    placeholder="请输入交班人姓名"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">接班人</label>
                  <input
                    type="text"
                    value={formData.takeoverPerson}
                    onChange={(e) => setFormData({ ...formData, takeoverPerson: e.target.value })}
                    placeholder="请输入接班人姓名"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  设备状态
                  <span className="text-slate-400 font-normal ml-1">（可选）</span>
                </label>
                <textarea
                  value={formData.equipmentStatus}
                  onChange={(e) => setFormData({ ...formData, equipmentStatus: e.target.value })}
                  placeholder="描述本班次设备运行状态，如：正常运行、已停机、部分故障等"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-red-600 mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  遗留问题
                  <span className="text-slate-400 font-normal ml-1">（可选，若有问题必填）</span>
                </label>
                <textarea
                  value={formData.remainingIssues}
                  onChange={(e) => setFormData({ ...formData, remainingIssues: e.target.value })}
                  placeholder="描述需要下一班次跟进处理的遗留问题，如：报警未消除、备件待更换等"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none bg-red-50/30"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
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
                {editingId ? '保存修改' : '创建记录'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">导入交接班记录</h3>
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
                  <li>
                    必须包含列：<code className="bg-blue-100 px-1 rounded">交接日期</code>、
                    <code className="bg-blue-100 px-1 rounded">交班人</code>、
                    <code className="bg-blue-100 px-1 rounded">接班人</code>
                  </li>
                  <li>
                    设备标识列：<code className="bg-blue-100 px-1 rounded">设备编码</code>或
                    <code className="bg-blue-100 px-1 rounded">设备名称</code>（至少一个）
                  </li>
                  <li>
                    班次列：<code className="bg-blue-100 px-1 rounded">班次名称</code>
                  </li>
                  <li>
                    可选列：<code className="bg-blue-100 px-1 rounded">设备状态</code>、
                    <code className="bg-blue-100 px-1 rounded">遗留问题</code>
                  </li>
                  <li>日期格式：YYYY-MM-DD</li>
                </ul>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">粘贴 CSV 内容</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`设备编码,设备名称,班次名称,交接日期,设备状态,遗留问题,交班人,接班人
DEV001,CNC加工中心,早班,2025-01-15,正常运行,,张三,李四
DEV002,数控车床,中班,2025-01-15,有异响待检查,冷却液不足,王五,赵六`}
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
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">班次</th>
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">日期</th>
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">结果</th>
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {latestImportLog.details.map((d, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-slate-500">{d.row}</td>
                          <td className="px-3 py-2 text-slate-700">{d.deviceCode || d.deviceName || '-'}</td>
                          <td className="px-3 py-2 text-slate-700">{d.shiftName || '-'}</td>
                          <td className="px-3 py-2 text-slate-500">{d.handoverDate || '-'}</td>
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
