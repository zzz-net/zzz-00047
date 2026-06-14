import { useEffect, useState, type Key, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import type { Device, Shift, CheckItem, InspectionPlan, ShiftType, ConfigPayload, ConfigImportPrecheck, ConfigImportResult, ConfigConflict } from '@/types'
import {
  Settings,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Cog,
  Clock,
  ListChecks,
  ClipboardList,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react'
import { configApi } from '@/services/api'

type TabType = 'devices' | 'shifts' | 'items' | 'plans'

type ImportStage = 'idle' | 'prechecking' | 'review' | 'importing' | 'result'

export default function ConfigPage() {
  const [tab, setTab] = useState<TabType>('devices')
  const store = useAppStore()
  const { loadMasterData, notify, setLoading } = store

  const [importStage, setImportStage] = useState<ImportStage>('idle')
  const [importPayload, setImportPayload] = useState<ConfigPayload | null>(null)
  const [precheck, setPrecheck] = useState<ConfigImportPrecheck | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ConfigImportResult | null>(null)
  const [conflictAction, setConflictAction] = useState<'SKIP' | 'OVERWRITE'>('SKIP')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadMasterData()
  }, [loadMasterData])

  const handleExport = () => {
    window.location.href = configApi.exportUrl()
    notify('success', '配置文件已开始下载')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    setImportStage('prechecking')
    setLoading(true)

    try {
      const text = await file.text()
      let parsed: ConfigPayload
      try {
        parsed = JSON.parse(text)
      } catch (err) {
        throw new Error(`JSON 格式错误：${err instanceof Error ? err.message : String(err)}`)
      }

      const r = await configApi.precheck(parsed)
      if (!r.success || !r.data) {
        throw new Error(r.error?.message || '预校验失败')
      }

      setImportPayload(r.data.payload)
      setPrecheck(r.data.precheck)
      setImportStage('review')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '未知错误')
      setImportStage('idle')
      notify('error', '导入文件校验失败')
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleConfirmImport = async () => {
    if (!importPayload) return
    setImportStage('importing')
    setLoading(true)

    try {
      const r = await configApi.doImport(importPayload, { conflictAction })
      if (!r.success || !r.data) {
        throw new Error(r.error?.message || '导入失败')
      }
      setImportResult(r.data)
      setImportStage('result')
      await loadMasterData()
      notify('success', '配置导入完成')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '未知错误')
      setImportStage('idle')
      notify('error', '导入失败')
    } finally {
      setLoading(false)
    }
  }

  const resetImport = () => {
    setImportStage('idle')
    setImportPayload(null)
    setPrecheck(null)
    setImportError(null)
    setImportResult(null)
    setConflictAction('SKIP')
  }

  const tabs: { key: TabType; label: string; icon: typeof Cog }[] = [
    { key: 'devices', label: '设备管理', icon: Cog },
    { key: 'shifts', label: '班次管理', icon: Clock },
    { key: 'items', label: '检查项管理', icon: ListChecks },
    { key: 'plans', label: '点检计划', icon: ClipboardList },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-white text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all"
          >
            <Download className="w-4 h-4" />
            导出配置
          </button>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/25 cursor-pointer hover:shadow-xl hover:shadow-emerald-600/30 transition-all">
            <Upload className="w-4 h-4" />
            导入配置
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {importStage !== 'idle' && (
        <ImportModal
          stage={importStage}
          precheck={precheck}
          result={importResult}
          error={importError}
          conflictAction={conflictAction}
          setConflictAction={setConflictAction}
          onConfirm={handleConfirmImport}
          onClose={resetImport}
        />
      )}

      {tab === 'devices' && <DevicesPanel />}
      {tab === 'shifts' && <ShiftsPanel />}
      {tab === 'items' && <CheckItemsPanel />}
      {tab === 'plans' && <PlansPanel />}
    </div>
  )
}

function ImportModal({
  stage,
  precheck,
  result,
  error,
  conflictAction,
  setConflictAction,
  onConfirm,
  onClose,
}: {
  stage: ImportStage
  precheck: ConfigImportPrecheck | null
  result: ConfigImportResult | null
  error: string | null
  conflictAction: 'SKIP' | 'OVERWRITE'
  setConflictAction: (v: 'SKIP' | 'OVERWRITE') => void
  onConfirm: () => void
  onClose: () => void
}) {
  if (stage === 'prechecking') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center animate-pulse">
            <Settings className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">正在校验配置文件...</h3>
          <p className="text-slate-500 text-sm">请稍候</p>
        </div>
      </div>
    )
  }

  if (stage === 'importing') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <Upload className="w-8 h-8 text-emerald-600 animate-bounce" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">正在导入配置...</h3>
          <p className="text-slate-500 text-sm">正在写入数据库</p>
        </div>
      </div>
    )
  }

  if (stage === 'result' && result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 my-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">导入完成</h3>
              <p className="text-sm text-slate-500">配置已成功写入数据库</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="新增设备" value={result.imported.devices} type="success" />
              <StatCard label="新增班次" value={result.imported.shifts} type="success" />
              <StatCard label="新增检查项" value={result.imported.checkItems} type="success" />
              <StatCard label="新增计划" value={result.imported.plans} type="success" />
            </div>
            {(result.skipped.devices > 0 || result.skipped.plans > 0 || result.overwritten.devices > 0) && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                {result.overwritten.devices > 0 && (
                  <StatCard label="覆盖设备" value={result.overwritten.devices} type="warning" />
                )}
                {result.skipped.devices > 0 && (
                  <StatCard label="跳过设备" value={result.skipped.devices} type="info" />
                )}
                {result.skipped.plans > 0 && (
                  <StatCard label="跳过计划" value={result.skipped.plans} type="info" />
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'review' && precheck) {
    const hasConflicts = precheck.conflicts.length > 0
    const hasMissingRefs =
      precheck.missingDeviceRefs.length > 0 ||
      precheck.missingShiftRefs.length > 0 ||
      precheck.missingCheckItemRefs.length > 0

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 my-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                hasMissingRefs ? 'bg-red-100' : hasConflicts ? 'bg-amber-100' : 'bg-emerald-100'
              }`}>
                {hasMissingRefs ? (
                  <XCircle className="w-6 h-6 text-red-600" />
                ) : hasConflicts ? (
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                ) : (
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">导入预览</h3>
                <p className="text-sm text-slate-500">
                  {hasMissingRefs ? '存在引用缺失，无法继续导入' : hasConflicts ? '检测到冲突，请选择处理方式' : '校验通过，可以导入'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-6">
            <StatCard label="设备" value={precheck.totalDevices} />
            <StatCard label="班次" value={precheck.totalShifts} />
            <StatCard label="检查项" value={precheck.totalCheckItems} />
            <StatCard label="计划" value={precheck.totalPlans} />
          </div>

          {hasConflicts && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-900 mb-2">设备编码冲突 ({precheck.conflicts.length} 项)</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {precheck.conflicts.map((c, i) => (
                      <ConflictRow key={i} conflict={c} />
                    ))}
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-amber-800 mb-2">请选择冲突处理方式：</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setConflictAction('SKIP')}
                        className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition ${
                          conflictAction === 'SKIP'
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-amber-300 text-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        跳过现有编码
                      </button>
                      <button
                        onClick={() => setConflictAction('OVERWRITE')}
                        className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition ${
                          conflictAction === 'OVERWRITE'
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-white border-amber-300 text-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        覆盖现有数据
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasMissingRefs && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-red-900 mb-2">引用缺失（无法导入）</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto text-sm text-red-800">
                    {precheck.missingDeviceRefs.map((r, i) => (
                      <div key={`md-${i}`} className="flex items-center gap-2">
                        <span className="text-red-500">→</span>
                        计划 "{r.planName}" 引用的设备不存在: {r.deviceId}
                      </div>
                    ))}
                    {precheck.missingShiftRefs.map((r, i) => (
                      <div key={`ms-${i}`} className="flex items-center gap-2">
                        <span className="text-red-500">→</span>
                        计划 "{r.planName}" 引用的班次不存在: {r.shiftId}
                      </div>
                    ))}
                    {precheck.missingCheckItemRefs.map((r, i) => (
                      <div key={`mc-${i}`} className="flex items-center gap-2">
                        <span className="text-red-500">→</span>
                        计划 "{r.planName}" 引用的检查项不存在: {r.checkItemIds.join(', ')}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-red-600">
                    请先在配置文件中修正这些引用，或确保缺失的配置项也在导入文件中。
                  </p>
                </div>
              </div>
            </div>
          )}

          {!hasMissingRefs && !hasConflicts && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <p className="text-emerald-800 text-sm font-medium">所有配置项校验通过，可直接导入</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              disabled={hasMissingRefs}
              className={`px-5 py-2 rounded-xl font-medium transition ${
                hasMissingRefs
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25'
              }`}
            >
              确认导入
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function StatCard({ label, value, type = 'default' }: { label: string; value: number; type?: 'default' | 'success' | 'warning' | 'info' }) {
  const colors = {
    default: 'bg-slate-50 text-slate-900',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    info: 'bg-blue-50 text-blue-700',
  }
  return (
    <div className={`p-3 rounded-xl text-center ${colors[type]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  )
}

function ConflictRow({ conflict }: { conflict: ConfigConflict }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-white rounded-lg text-sm">
      <span className="font-mono text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded">
        {conflict.code}
      </span>
      <span className="text-slate-700">{conflict.existingName}</span>
      <ArrowRight className="w-3 h-3 text-slate-400" />
      <span className="text-amber-700 font-medium">{conflict.importedName}</span>
    </div>
  )
}

function DevicesPanel() {
  const { devices, addDevice, removeDevice, updateDevice } = useAppStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', location: '', description: '' })

  const handleAdd = async () => {
    if (!form.name || !form.code) return
    const ok = await addDevice(form)
    if (ok) {
      setForm({ name: '', code: '', location: '', description: '' })
      setAdding(false)
    }
  }

  const handleUpdate = async (id: string) => {
    const ok = await updateDevice(id, form)
    if (ok) setEditing(null)
  }

  const startEdit = (d: Device) => {
    setForm({ name: d.name, code: d.code, location: d.location, description: d.description })
    setEditing(d.id)
  }

  return (
    <ConfigSection title="设备列表" onAdd={() => { setAdding(true); setForm({ name: '', code: '', location: '', description: '' }) }}>
      {adding && (
        <ItemForm
          form={form}
          setForm={setForm}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
          fields={[
            { key: 'name', label: '名称 *' },
            { key: 'code', label: '编码 *' },
            { key: 'location', label: '位置' },
            { key: 'description', label: '描述' },
          ]}
        />
      )}
      {devices.map((d) => (
        <div key={d.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition">
          {editing === d.id ? (
            <ItemForm
              form={form}
              setForm={setForm}
              onSave={() => handleUpdate(d.id)}
              onCancel={() => setEditing(null)}
              fields={[
                { key: 'name', label: '名称 *' },
                { key: 'code', label: '编码 *' },
                { key: 'location', label: '位置' },
                { key: 'description', label: '描述' },
              ]}
              inline
            />
          ) : (
            <>
              <div>
                <p className="font-semibold text-slate-900">{d.name}</p>
                <p className="text-xs text-slate-500">{d.code} · {d.location}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(d)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => removeDevice(d.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </ConfigSection>
  )
}

function ShiftsPanel() {
  const { shifts, addShift, removeShift, updateShift } = useAppStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'MORNING' as ShiftType, startTime: '08:00', endTime: '16:00', description: '' })

  const handleAdd = async () => {
    if (!form.name) return
    const ok = await addShift(form)
    if (ok) {
      setForm({ name: '', type: 'MORNING' as ShiftType, startTime: '08:00', endTime: '16:00', description: '' })
      setAdding(false)
    }
  }

  const handleUpdate = async (id: string) => {
    const ok = await updateShift(id, form)
    if (ok) setEditing(null)
  }

  const startEdit = (s: Shift) => {
    setForm({ name: s.name, type: s.type, startTime: s.startTime, endTime: s.endTime, description: s.description })
    setEditing(s.id)
  }

  const typeLabels = { MORNING: '早班', AFTERNOON: '中班', NIGHT: '夜班' }

  return (
    <ConfigSection title="班次列表" onAdd={() => { setAdding(true); setForm({ name: '', type: 'MORNING' as ShiftType, startTime: '08:00', endTime: '16:00', description: '' }) }}>
      {adding && (
        <div className="p-4 bg-slate-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="名称 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-200">取消</button>
            <button onClick={handleAdd} className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">保存</button>
          </div>
        </div>
      )}
      {shifts.map((s) => (
        <div key={s.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition">
          {editing === s.id ? (
            <div className="p-4 bg-slate-50 w-full space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-200">取消</button>
                <button onClick={() => handleUpdate(s.id)} className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">保存</button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="font-semibold text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500">{typeLabels[s.type]} · {s.startTime}-{s.endTime}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(s)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => removeShift(s.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            </>
          )}
        </div>
      ))}
    </ConfigSection>
  )
}

function CheckItemsPanel() {
  const { checkItems, addCheckItem, removeCheckItem, updateCheckItem, devices } = useAppStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', category: '', description: '', standard: '', deviceIds: [] as string[] })

  const handleAdd = async () => {
    if (!form.name || !form.code) return
    const ok = await addCheckItem(form)
    if (ok) {
      setForm({ name: '', code: '', category: '', description: '', standard: '', deviceIds: [] })
      setAdding(false)
    }
  }

  const handleUpdate = async (id: string) => {
    const ok = await updateCheckItem(id, form)
    if (ok) setEditing(null)
  }

  const startEdit = (c: CheckItem) => {
    setForm({ name: c.name, code: c.code, category: c.category, description: c.description, standard: c.standard, deviceIds: c.deviceIds })
    setEditing(c.id)
  }

  const toggleDevice = (devId: string) => {
    setForm((prev) => ({
      ...prev,
      deviceIds: prev.deviceIds.includes(devId) ? prev.deviceIds.filter((x) => x !== devId) : [...prev.deviceIds, devId],
    }))
  }

  const itemForm = (isEdit: boolean) => (
    <div className="p-4 bg-slate-50 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="名称 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input placeholder="编码 *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input placeholder="分类" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input placeholder="检查标准" value={form.standard} onChange={(e) => setForm({ ...form, standard: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <input placeholder="描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <div>
        <p className="text-sm text-slate-600 mb-1">适用设备</p>
        <div className="flex flex-wrap gap-2">
          {devices.map((d) => (
            <button key={d.id} onClick={() => toggleDevice(d.id)} className={`px-3 py-1 rounded-lg text-xs font-medium transition ${form.deviceIds.includes(d.id) ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-blue-50'}`}>
              {d.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => { setAdding(false); setEditing(null) }} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-200">取消</button>
        <button onClick={isEdit ? () => handleUpdate(editing!) : handleAdd} className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">保存</button>
      </div>
    </div>
  )

  return (
    <ConfigSection title="检查项列表" onAdd={() => { setAdding(true); setForm({ name: '', code: '', category: '', description: '', standard: '', deviceIds: [] }) }}>
      {adding && itemForm(false)}
      {checkItems.map((c) => (
        <div key={c.id} className="p-4 hover:bg-slate-50 transition">
          {editing === c.id ? (
            itemForm(true)
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{c.name} <span className="text-xs text-slate-400 font-normal">{c.code}</span></p>
                <p className="text-xs text-slate-500">{c.category} · {c.standard}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.deviceIds.map((did) => {
                    const d = devices.find((x) => x.id === did)
                    return <span key={did} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">{d?.name || did}</span>
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(c)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => removeCheckItem(c.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      ))}
    </ConfigSection>
  )
}

function PlansPanel() {
  const { plans, addPlan, removePlan, updatePlan, devices, shifts, checkItems } = useAppStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', deviceId: '', shiftId: '', checkItemIds: [] as string[], frequency: '每日每班次', description: '' })

  const handleAdd = async () => {
    if (!form.name || !form.deviceId || !form.shiftId || form.checkItemIds.length === 0) return
    const ok = await addPlan(form)
    if (ok) {
      setForm({ name: '', deviceId: '', shiftId: '', checkItemIds: [], frequency: '每日每班次', description: '' })
      setAdding(false)
    }
  }

  const handleUpdate = async (id: string) => {
    const ok = await updatePlan(id, form)
    if (ok) setEditing(null)
  }

  const startEdit = (p: InspectionPlan) => {
    setForm({ name: p.name, deviceId: p.deviceId, shiftId: p.shiftId, checkItemIds: p.checkItemIds, frequency: p.frequency, description: p.description })
    setEditing(p.id)
  }

  const toggleCheckItem = (ciId: string) => {
    setForm((prev) => ({
      ...prev,
      checkItemIds: prev.checkItemIds.includes(ciId) ? prev.checkItemIds.filter((x) => x !== ciId) : [...prev.checkItemIds, ciId],
    }))
  }

  const selectedDev = devices.find((d) => d.id === form.deviceId)
  const availableItems = selectedDev ? checkItems.filter((c) => c.deviceIds.includes(form.deviceId)) : checkItems

  const planForm = (isEdit: boolean) => (
    <div className="p-4 bg-slate-50 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="计划名称 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value, checkItemIds: [] })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">选择设备 *</option>
          {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">选择班次 *</option>
          {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input placeholder="频次" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <p className="text-sm text-slate-600 mb-1">检查项 *</p>
        <div className="flex flex-wrap gap-2">
          {availableItems.map((c) => (
            <button key={c.id} onClick={() => toggleCheckItem(c.id)} className={`px-3 py-1 rounded-lg text-xs font-medium transition ${form.checkItemIds.includes(c.id) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-indigo-50'}`}>
              {c.name}
            </button>
          ))}
          {availableItems.length === 0 && <span className="text-xs text-slate-400">请先选择设备或创建检查项</span>}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => { setAdding(false); setEditing(null) }} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-200">取消</button>
        <button onClick={isEdit ? () => handleUpdate(editing!) : handleAdd} className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">保存</button>
      </div>
    </div>
  )

  return (
    <ConfigSection title="点检计划列表" onAdd={() => { setAdding(true); setForm({ name: '', deviceId: '', shiftId: '', checkItemIds: [], frequency: '每日每班次', description: '' }) }}>
      {adding && planForm(false)}
      {plans.map((p) => {
        const dev = devices.find((d) => d.id === p.deviceId)
        const shift = shifts.find((s) => s.id === p.shiftId)
        return (
          <div key={p.id} className="p-4 hover:bg-slate-50 transition">
            {editing === p.id ? (
              planForm(true)
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{dev?.name} · {shift?.name} · {p.frequency}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.checkItemIds.map((ciId) => {
                      const ci = checkItems.find((c) => c.id === ciId)
                      return <span key={ciId} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded">{ci?.name || ciId}</span>
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(p)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => removePlan(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </ConfigSection>
  )
}

function ConfigSection({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-900">{title}</h3>
        <button onClick={onAdd} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition shadow-sm">
          <Plus className="w-4 h-4" />
          新增
        </button>
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  )
}

function ItemForm<T extends Record<string, string>>({ form, setForm, onSave, onCancel, fields, inline }: {
  form: T
  setForm: React.Dispatch<React.SetStateAction<T>>
  onSave: () => void
  onCancel: () => void
  fields: { key: string; label: string }[]
  inline?: boolean
}) {
  return (
    <div className={`p-4 bg-slate-50 ${inline ? '' : 'space-y-3'}`}>
      <div className={`grid ${inline ? 'grid-cols-2' : 'grid-cols-2'} gap-3`}>
        {fields.map(({ key, label }) => (
          <input
            key={key}
            placeholder={label}
            value={form[key as keyof T] || ''}
            onChange={(e) => setForm({ ...form, [key as string]: e.target.value } as T)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ))}
      </div>
      <div className="flex gap-2 justify-end mt-3">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-200">取消</button>
        <button onClick={onSave} className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">保存</button>
      </div>
    </div>
  )
}
