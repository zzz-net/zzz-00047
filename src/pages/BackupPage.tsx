import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import {
  DatabaseBackup,
  Play,
  Trash2,
  RotateCcw,
  Save,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  HardDrive,
  Archive,
  Settings,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react'
import { backupApi } from '@/services/api'
import type {
  BackupInfo,
  BackupConfig,
  BackupRestorePrecheck,
  BackupRestoreResult,
  ConfigConflict,
  AutoBackupMode,
} from '@/types'

type RestoreStage = 'idle' | 'prechecking' | 'confirm' | 'restoring' | 'result'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch {
    return iso
  }
}

const AUTO_MODE_LABELS: Record<AutoBackupMode, string> = {
  OFF: '关闭',
  DAILY: '每天一次',
  STARTUP: '每次启动时',
}

const BACKUP_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  manual: { label: '手动', color: 'bg-blue-100 text-blue-700' },
  auto: { label: '自动', color: 'bg-emerald-100 text-emerald-700' },
  snapshot: { label: '快照', color: 'bg-amber-100 text-amber-700' },
}

export default function BackupPage() {
  const store = useAppStore()
  const { loadMasterData, loadOrders, notify, setLoading } = store

  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [config, setConfig] = useState<BackupConfig | null>(null)
  const [retentionInput, setRetentionInput] = useState<string>('10')
  const [autoMode, setAutoMode] = useState<AutoBackupMode>('OFF')

  const [restoreStage, setRestoreStage] = useState<RestoreStage>('idle')
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null)
  const [precheck, setPrecheck] = useState<BackupRestorePrecheck | null>(null)
  const [restoreResult, setRestoreResult] = useState<BackupRestoreResult | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [defaultAction, setDefaultAction] = useState<'SKIP' | 'OVERWRITE'>('SKIP')
  const [individualOverrides, setIndividualOverrides] = useState<Record<string, 'SKIP' | 'OVERWRITE'>>({})

  const [configDirty, setConfigDirty] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const [bl, cl] = await Promise.all([backupApi.list(), backupApi.getConfig()])
      if (bl.success && bl.data) setBackups(bl.data)
      if (cl.success && cl.data) setConfig(cl.data)
    } finally {
      setLoading(false)
    }
  }, [setLoading])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (config) {
      setRetentionInput(String(config.retentionCount))
      setAutoMode(config.autoBackupMode)
      setConfigDirty(false)
    }
  }, [config])

  useEffect(() => {
    if (!config) return
    setConfigDirty(
      autoMode !== config.autoBackupMode ||
      Number(retentionInput) !== config.retentionCount,
    )
  }, [autoMode, retentionInput, config])

  async function handleCreateBackup(): Promise<void> {
    setLoading(true)
    try {
      const r = await backupApi.create()
      if (!r.success || !r.data) {
        throw new Error(r.error?.message || '创建备份失败')
      }
      notify('success', `备份已创建：${r.data.name}`)
      await refresh()
    } catch (err) {
      notify('error', err instanceof Error ? err.message : '创建备份失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveConfig(): Promise<void> {
    const retentionNum = Number(retentionInput)
    if (!Number.isFinite(retentionNum) || retentionNum < 1 || retentionNum > 100) {
      notify('error', '保留数量必须是 1-100 之间的整数')
      return
    }
    setLoading(true)
    try {
      const r = await backupApi.updateConfig({
        autoBackupMode: autoMode,
        retentionCount: retentionNum,
      })
      if (!r.success || !r.data) {
        throw new Error(r.error?.message || '保存配置失败')
      }
      setConfig(r.data)
      notify('success', '备份配置已保存')
    } catch (err) {
      notify('error', err instanceof Error ? err.message : '保存配置失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string): Promise<void> {
    if (!window.confirm(`确定要删除备份 "${name}" 吗？此操作不可恢复。`)) return
    setLoading(true)
    try {
      const r = await backupApi.remove(id)
      if (!r.success) {
        throw new Error(r.error?.message || '删除备份失败')
      }
      notify('success', `备份 "${name}" 已删除`)
      await refresh()
    } catch (err) {
      notify('error', err instanceof Error ? err.message : '删除备份失败')
    } finally {
      setLoading(false)
    }
  }

  function resetRestore(): void {
    setRestoreStage('idle')
    setRestoreTarget(null)
    setPrecheck(null)
    setRestoreResult(null)
    setRestoreError(null)
    setDefaultAction('SKIP')
    setIndividualOverrides({})
  }

  async function handleStartRestore(info: BackupInfo): Promise<void> {
    setRestoreTarget(info)
    setRestoreStage('prechecking')
    setRestoreError(null)
    try {
      const r = await backupApi.precheck(info.id)
      if (!r.success || !r.data) {
        throw new Error(r.error?.message || '预校验失败')
      }
      setPrecheck(r.data)
      setRestoreStage('confirm')
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : '预校验失败')
      setRestoreStage('confirm')
    }
  }

  async function handleConfirmRestore(): Promise<void> {
    if (!restoreTarget) return
    setRestoreStage('restoring')
    setRestoreError(null)
    try {
      const r = await backupApi.restore(restoreTarget.id, {
        conflictAction: defaultAction,
        individualOverrides,
      })
      if (!r.success || !r.data) {
        throw new Error(r.error?.message || '恢复失败')
      }
      setRestoreResult(r.data)
      setRestoreStage('result')
      await loadMasterData()
      await loadOrders()
      await refresh()
      notify('success', '数据已恢复')
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : '恢复失败')
      setRestoreStage('confirm')
    }
  }

  function toggleOverride(code: string, action: 'SKIP' | 'OVERWRITE'): void {
    setIndividualOverrides((prev) => {
      const next = { ...prev }
      if (next[code] === action) {
        delete next[code]
      } else {
        next[code] = action
      }
      return next
    })
  }

  const isCorrupted = precheck && !precheck.valid
  const hasConflicts = precheck && precheck.conflicts.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-600/30">
            <DatabaseBackup className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">备份与恢复</h2>
            <p className="text-sm text-slate-500">保护点检数据，防止误操作和文件损坏</p>
          </div>
        </div>
        <button
          onClick={handleCreateBackup}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/25 hover:shadow-xl hover:shadow-violet-600/30 transition-all"
        >
          <Play className="w-4 h-4" />
          立即备份
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-500" />
              <h3 className="font-bold text-slate-900">备份设置</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">自动备份</label>
              <div className="space-y-2">
                {(Object.keys(AUTO_MODE_LABELS) as AutoBackupMode[]).map((mode) => (
                  <label
                    key={mode}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      autoMode === mode
                        ? 'bg-violet-50 border-violet-300 text-violet-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="autoMode"
                      checked={autoMode === mode}
                      onChange={() => setAutoMode(mode)}
                      className="w-4 h-4 accent-violet-600"
                    />
                    <span className="text-sm font-medium">{AUTO_MODE_LABELS[mode]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">保留最近备份数</label>
              <input
                type="number"
                min={1}
                max={100}
                value={retentionInput}
                onChange={(e) => setRetentionInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <p className="text-xs text-slate-500 mt-1">范围 1-100，自动备份将超出数量的旧备份清理掉</p>
            </div>

            {config?.lastBackupAt && (
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>上次备份：{formatDate(config.lastBackupAt)}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleSaveConfig}
              disabled={!configDirty}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                configDirty
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow hover:shadow-lg'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              保存设置
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-slate-500" />
                <h3 className="font-bold text-slate-900">备份历史</h3>
                <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-100 rounded-full">
                  {backups.length} 份
                </span>
              </div>
              <button
                onClick={() => void refresh()}
                className="text-sm text-slate-500 hover:text-violet-600 transition"
              >
                刷新
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {backups.length === 0 ? (
                <div className="p-12 text-center">
                  <HardDrive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">暂无备份，点击右上角"立即备份"创建第一份备份</p>
                </div>
              ) : (
                backups.map((b) => {
                  const typeInfo = BACKUP_TYPE_LABELS[b.type] || BACKUP_TYPE_LABELS.manual
                  return (
                    <div
                      key={b.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          b.type === 'snapshot' ? 'bg-amber-50' : b.type === 'auto' ? 'bg-emerald-50' : 'bg-blue-50'
                        }`}>
                          <Archive className={`w-5 h-5 ${
                            b.type === 'snapshot' ? 'text-amber-600' : b.type === 'auto' ? 'text-emerald-600' : 'text-blue-600'
                          }`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                            <p className="font-semibold text-slate-900 text-sm truncate">{b.name}</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(b.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {formatBytes(b.sizeBytes)}
                            </span>
                            {b.note && <span className="text-slate-400">· {b.note}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleStartRestore(b)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          恢复
                        </button>
                        <button
                          onClick={() => handleDelete(b.id, b.name)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          删除
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {restoreStage !== 'idle' && (
        <RestoreModal
          stage={restoreStage}
          target={restoreTarget}
          precheck={precheck}
          result={restoreResult}
          error={restoreError}
          defaultAction={defaultAction}
          setDefaultAction={setDefaultAction}
          individualOverrides={individualOverrides}
          onToggleOverride={toggleOverride}
          onConfirm={handleConfirmRestore}
          onClose={resetRestore}
          isCorrupted={!!isCorrupted}
          hasConflicts={!!hasConflicts}
        />
      )}
    </div>
  )
}

function RestoreModal({
  stage,
  target,
  precheck,
  result,
  error,
  defaultAction,
  setDefaultAction,
  individualOverrides,
  onToggleOverride,
  onConfirm,
  onClose,
  isCorrupted,
  hasConflicts,
}: {
  stage: RestoreStage
  target: BackupInfo | null
  precheck: BackupRestorePrecheck | null
  result: BackupRestoreResult | null
  error: string | null
  defaultAction: 'SKIP' | 'OVERWRITE'
  setDefaultAction: (v: 'SKIP' | 'OVERWRITE') => void
  individualOverrides: Record<string, 'SKIP' | 'OVERWRITE'>
  onToggleOverride: (code: string, action: 'SKIP' | 'OVERWRITE') => void
  onConfirm: () => void
  onClose: () => void
  isCorrupted: boolean
  hasConflicts: boolean
}) {
  if (stage === 'prechecking') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-100 flex items-center justify-center animate-pulse">
            <DatabaseBackup className="w-8 h-8 text-violet-600 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">正在校验备份...</h3>
          <p className="text-slate-500 text-sm">请稍候</p>
        </div>
      </div>
    )
  }

  if (stage === 'restoring') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <RotateCcw className="w-8 h-8 text-emerald-600 animate-bounce" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">正在恢复数据...</h3>
          <p className="text-slate-500 text-sm">系统将先自动创建快照以保护当前数据</p>
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
              <h3 className="text-xl font-bold text-slate-900">恢复成功</h3>
              <p className="text-sm text-slate-500">
                已自动创建安全快照（ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{result.snapshotBackupId.slice(0, 16)}...</code>）
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="设备" value={result.restored.devices} type="success" />
              <StatCard label="班次" value={result.restored.shifts} type="success" />
              <StatCard label="检查项" value={result.restored.checkItems} type="success" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="点检计划" value={result.restored.inspectionPlans} type="success" />
              <StatCard label="点检工单" value={result.restored.inspectionOrders} type="success" />
            </div>
            {(result.skipped.devices > 0 || result.overwritten.devices > 0) && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                {result.overwritten.devices > 0 && (
                  <StatCard label="覆盖设备" value={result.overwritten.devices} type="warning" />
                )}
                {result.skipped.devices > 0 && (
                  <StatCard label="保留设备" value={result.skipped.devices} type="info" />
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'confirm') {
    if (error && !precheck) {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 my-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-1">无法恢复</h3>
                <p className="text-sm text-slate-500">备份文件校验失败</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
              <p className="text-sm text-red-800 whitespace-pre-wrap">{error}</p>
              <p className="text-xs text-red-600 mt-2">
                当前数据未受影响。请选择其他备份或检查备份文件完整性。
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 my-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                isCorrupted ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                {isCorrupted ? (
                  <XCircle className="w-6 h-6 text-red-600" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-amber-600" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">确认恢复备份</h3>
                <p className="text-sm text-slate-500">
                  备份：{target?.name} · {target ? formatDate(target.createdAt) : ''}
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

          {isCorrupted && precheck ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-red-900 mb-2">备份损坏，无法恢复</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto text-sm text-red-800">
                    {precheck.errors.map((e, i) => (
                      <div key={i}>· {e}</div>
                    ))}
                  </div>
                  <p className="text-xs text-red-600 mt-2">
                    此备份的 db.json 缺失或已损坏。不会写入任何数据，请选择其他备份。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-900 mb-1">操作警告</h4>
                    <p className="text-sm text-amber-800">
                      恢复将<strong>覆盖当前 db.json 和 evidence 目录</strong>中的数据。
                      为防止误操作，系统会在恢复前自动创建一份当前数据的快照，可在备份列表中找到并回滚。
                    </p>
                  </div>
                </div>
              </div>

              {hasConflicts && precheck && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-2">
                        检测到设备编码冲突（{precheck.conflicts.length} 项）
                      </h4>
                      <p className="text-xs text-blue-800 mb-3">
                        以下设备编码在备份与当前数据中重复存在。请逐条选择处理方式，或设置默认策略：
                      </p>

                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => setDefaultAction('SKIP')}
                          className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition ${
                            defaultAction === 'SKIP'
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-white border-blue-300 text-blue-800 hover:bg-blue-100'
                          }`}
                        >
                          默认：保留现有
                        </button>
                        <button
                          onClick={() => setDefaultAction('OVERWRITE')}
                          className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition ${
                            defaultAction === 'OVERWRITE'
                              ? 'bg-red-600 border-red-600 text-white'
                              : 'bg-white border-blue-300 text-blue-800 hover:bg-blue-100'
                          }`}
                        >
                          默认：覆盖现有
                        </button>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {precheck.conflicts.map((c) => (
                          <ConflictChoiceRow
                            key={c.code}
                            conflict={c}
                            override={individualOverrides[c.code]}
                            defaultAction={defaultAction}
                            onToggle={onToggleOverride}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!hasConflicts && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <p className="text-sm text-emerald-800 font-medium">
                      未检测到冲突，可直接恢复
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition"
            >
              取消
            </button>
            {!isCorrupted && (
              <button
                onClick={onConfirm}
                className="px-5 py-2 rounded-xl font-medium bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-600/25 transition"
              >
                确认恢复
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}

function ConflictChoiceRow({
  conflict,
  override,
  defaultAction,
  onToggle,
}: {
  conflict: ConfigConflict
  override?: 'SKIP' | 'OVERWRITE'
  defaultAction: 'SKIP' | 'OVERWRITE'
  onToggle: (code: string, action: 'SKIP' | 'OVERWRITE') => void
}) {
  const effective = override || defaultAction
  return (
    <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-blue-100">
      <span className="font-mono text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded flex-shrink-0">
        {conflict.code}
      </span>
      <div className="flex-1 min-w-0 text-sm flex items-center gap-1.5">
        <span className="text-slate-700 truncate">{conflict.existingName}</span>
        <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
        <span className="text-blue-700 font-medium truncate">{conflict.importedName}</span>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => onToggle(conflict.code, 'SKIP')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
            effective === 'SKIP'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          保留
        </button>
        <button
          onClick={() => onToggle(conflict.code, 'OVERWRITE')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
            effective === 'OVERWRITE'
              ? 'bg-red-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          覆盖
        </button>
      </div>
    </div>
  )
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
