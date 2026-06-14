import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type {
  BackupInfo,
  BackupType,
  BackupConfig,
  AutoBackupMode,
  BackupRestorePrecheck,
  BackupRestoreOptions,
  BackupRestoreResult,
  ConfigConflict,
  Database,
  Device,
} from '../types/index.js'
import { db, nowIso } from './db.js'
import { BusinessError } from './validation.js'
import { ERROR_CODES } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.resolve(__dirname, '../../data')
const DATA_FILE = path.join(DATA_DIR, 'db.json')
const EVIDENCE_DIR = path.join(DATA_DIR, 'evidence')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')

const DEFAULT_CONFIG: BackupConfig = {
  autoBackupMode: 'OFF',
  retentionCount: 10,
}

const MANIFEST_FILENAME = 'manifest.json'
const DB_FILENAME = 'db.json'
const EVIDENCE_DIRNAME = 'evidence'

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '_' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}

function formatName(type: BackupType, ts: string): string {
  const prefix =
    type === 'manual' ? 'manual' : type === 'auto' ? 'auto' : 'snapshot'
  return `backup_${prefix}_${ts}`
}

function dirSize(dirPath: string): number {
  let total = 0
  if (!fs.existsSync(dirPath)) return 0
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      total += dirSize(full)
    } else if (entry.isFile()) {
      try {
        total += fs.statSync(full).size
      } catch {
        /* ignore */
      }
    }
  }
  return total
}

function readManifest(backupDir: string): BackupInfo | null {
  const manifestPath = path.join(backupDir, MANIFEST_FILENAME)
  if (!fs.existsSync(manifestPath)) return null
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8')
    return JSON.parse(raw) as BackupInfo
  } catch {
    return null
  }
}

function writeManifest(backupDir: string, info: BackupInfo): void {
  const manifestPath = path.join(backupDir, MANIFEST_FILENAME)
  fs.writeFileSync(manifestPath, JSON.stringify(info, null, 2), 'utf-8')
}

function copyDir(src: string, dest: string): void {
  ensureDir(dest)
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function removeDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      removeDir(full)
    } else if (entry.isFile()) {
      fs.unlinkSync(full)
    }
  }
  fs.rmdirSync(dirPath)
}

export function getBackupConfig(): BackupConfig {
  const data = db.getData()
  return data.backupConfig || { ...DEFAULT_CONFIG }
}

export function saveBackupConfig(config: BackupConfig): void {
  const data = db.getData()
  data.backupConfig = config
  db.save(data)
}

export function createBackup(
  type: BackupType = 'manual',
  note?: string,
): BackupInfo {
  ensureDir(BACKUP_DIR)
  const ts = timestamp()
  const id = `BK_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const name = formatName(type, ts)
  const backupDir = path.join(BACKUP_DIR, name)

  if (fs.existsSync(backupDir)) {
    throw new BusinessError(ERROR_CODES.BACKUP_RESTORE_FAILED, '备份目录已存在，请稍后重试')
  }
  ensureDir(backupDir)

  try {
    if (fs.existsSync(DATA_FILE)) {
      fs.copyFileSync(DATA_FILE, path.join(backupDir, DB_FILENAME))
    }
    if (fs.existsSync(EVIDENCE_DIR)) {
      copyDir(EVIDENCE_DIR, path.join(backupDir, EVIDENCE_DIRNAME))
    }

    const sizeBytes = dirSize(backupDir)
    const createdAt = new Date().toISOString()
    const info: BackupInfo = { id, name, createdAt, sizeBytes, type, note }
    writeManifest(backupDir, info)

    const cfg = getBackupConfig()
    cfg.lastBackupAt = createdAt
    saveBackupConfig(cfg)

    applyRetention(cfg.retentionCount)

    return info
  } catch (err) {
    if (fs.existsSync(backupDir)) {
      try {
        removeDir(backupDir)
      } catch {
        /* ignore */
      }
    }
    if (err instanceof BusinessError) throw err
    const msg = err instanceof Error ? err.message : String(err)
    throw new BusinessError(ERROR_CODES.BACKUP_RESTORE_FAILED, `创建备份失败：${msg}`)
  }
}

export function listBackups(): BackupInfo[] {
  ensureDir(BACKUP_DIR)
  const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
  const result: BackupInfo[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const backupDir = path.join(BACKUP_DIR, entry.name)
    const manifest = readManifest(backupDir)
    if (!manifest) {
      // Legacy backup without manifest, compute on the fly
      const stat = fs.statSync(backupDir)
      result.push({
        id: entry.name,
        name: entry.name,
        createdAt: stat.mtime.toISOString(),
        sizeBytes: dirSize(backupDir),
        type: entry.name.startsWith('backup_auto')
          ? 'auto'
          : entry.name.startsWith('backup_snapshot')
            ? 'snapshot'
            : 'manual',
      })
    } else {
      result.push(manifest)
    }
  }
  result.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return result
}

export function deleteBackup(id: string): void {
  ensureDir(BACKUP_DIR)
  const list = listBackups()
  const match = list.find((b) => b.id === id)
  if (!match) {
    throw new BusinessError(ERROR_CODES.BACKUP_NOT_FOUND, '备份不存在：' + id)
  }
  const backupDir = path.join(BACKUP_DIR, match.name)
  if (!fs.existsSync(backupDir)) {
    throw new BusinessError(ERROR_CODES.BACKUP_NOT_FOUND, '备份目录不存在：' + match.name)
  }
  removeDir(backupDir)
}

function applyRetention(retentionCount: number): void {
  if (retentionCount <= 0) return
  const list = listBackups()
  const keep = list.filter((b) => b.type !== 'snapshot').slice(0, retentionCount)
  const keepIds = new Set(keep.map((b) => b.id))
  for (const b of list) {
    if (b.type === 'snapshot') continue
    if (!keepIds.has(b.id)) {
      try {
        removeDir(path.join(BACKUP_DIR, b.name))
      } catch {
        /* ignore */
      }
    }
  }
}

function validateBackupDb(backupDb: unknown): backupDb is Database {
  if (!backupDb || typeof backupDb !== 'object') return false
  const d = backupDb as Record<string, unknown>
  return (
    Array.isArray(d.devices) &&
    Array.isArray(d.shifts) &&
    Array.isArray(d.checkItems) &&
    Array.isArray(d.inspectionPlans) &&
    Array.isArray(d.inspectionOrders)
  )
}

export function loadBackupDatabase(backupId: string): {
  info: BackupInfo
  data: Database
  backupDir: string
} {
  ensureDir(BACKUP_DIR)
  const list = listBackups()
  const info = list.find((b) => b.id === backupId)
  if (!info) {
    throw new BusinessError(ERROR_CODES.BACKUP_NOT_FOUND, '备份不存在：' + backupId)
  }
  const backupDir = path.join(BACKUP_DIR, info.name)
  const dbPath = path.join(backupDir, DB_FILENAME)
  if (!fs.existsSync(dbPath)) {
    throw new BusinessError(ERROR_CODES.BACKUP_CORRUPTED, '备份损坏：缺少 db.json')
  }
  let parsed: unknown
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8')
    parsed = JSON.parse(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new BusinessError(ERROR_CODES.BACKUP_CORRUPTED, `备份损坏：db.json 解析失败 - ${msg}`)
  }
  if (!validateBackupDb(parsed)) {
    throw new BusinessError(ERROR_CODES.BACKUP_CORRUPTED, '备份损坏：db.json 结构不合法')
  }
  return { info, data: parsed as Database, backupDir }
}

function detectConflicts(existing: Device[], backup: Device[]): ConfigConflict[] {
  const conflicts: ConfigConflict[] = []
  const existingByCode = new Map(existing.map((d) => [d.code, d]))
  for (const bd of backup) {
    const existingDev = existingByCode.get(bd.code)
    if (existingDev && existingDev.id !== bd.id) {
      conflicts.push({
        type: 'device_code',
        code: bd.code,
        existingId: existingDev.id,
        importedId: bd.id,
        existingName: existingDev.name,
        importedName: bd.name,
      })
    }
  }
  return conflicts
}

export function precheckRestore(backupId: string): BackupRestorePrecheck {
  const errors: string[] = []
  let backupInfo: BackupInfo | null = null
  let backupData: Database | null = null
  try {
    const loaded = loadBackupDatabase(backupId)
    backupInfo = loaded.info
    backupData = loaded.data
  } catch (err) {
    if (err instanceof BusinessError) {
      errors.push(err.message)
    } else {
      errors.push(err instanceof Error ? err.message : String(err))
    }
    return {
      valid: false,
      errors,
      conflicts: [],
      backupInfo:
        backupInfo ||
        ({
          id: backupId,
          name: '未知备份',
          createdAt: new Date().toISOString(),
          sizeBytes: 0,
          type: 'manual',
        } as BackupInfo),
    }
  }

  const existing = db.getData()
  const conflicts = detectConflicts(existing.devices, backupData.devices)

  return {
    valid: errors.length === 0,
    errors,
    conflicts,
    backupInfo,
  }
}

export function restoreBackup(
  backupId: string,
  options: BackupRestoreOptions,
): BackupRestoreResult {
  const precheck = precheckRestore(backupId)
  if (!precheck.valid) {
    throw new BusinessError(
      ERROR_CODES.BACKUP_CORRUPTED,
      '备份损坏或不合法：' + precheck.errors.join('；'),
    )
  }

  const snapshot = createBackup('snapshot', '恢复前自动快照')

  const loaded = loadBackupDatabase(backupId)
  const backupData = loaded.data
  const backupEvidenceDir = path.join(loaded.backupDir, EVIDENCE_DIRNAME)

  const existing = db.getData()
  const result: BackupRestoreResult = {
    success: true,
    snapshotBackupId: snapshot.id,
    restored: { devices: 0, shifts: 0, checkItems: 0, inspectionPlans: 0, inspectionOrders: 0 },
    skipped: { devices: 0 },
    overwritten: { devices: 0 },
  }

  const individualOverrides = options.individualOverrides || {}
  const existingDeviceByCode = new Map(existing.devices.map((d) => [d.code, d]))

  const devicesFinal: Device[] = []
  for (const backupDev of backupData.devices) {
    const existingDev = existingDeviceByCode.get(backupDev.code)
    if (existingDev) {
      const override = individualOverrides[backupDev.code]
      const action = override || options.conflictAction
      if (action === 'SKIP') {
        devicesFinal.push(existingDev)
        result.skipped.devices++
      } else {
        const merged: Device = {
          ...backupDev,
          id: existingDev.id,
          createdAt: existingDev.createdAt,
          updatedAt: nowIso(),
        }
        devicesFinal.push(merged)
        result.overwritten.devices++
      }
    } else {
      devicesFinal.push({ ...backupDev, updatedAt: nowIso() })
      result.restored.devices++
    }
  }

  const restoredData: Database = {
    devices: devicesFinal,
    shifts: backupData.shifts,
    checkItems: backupData.checkItems,
    inspectionPlans: backupData.inspectionPlans,
    inspectionOrders: backupData.inspectionOrders,
    statsLogs: backupData.statsLogs || existing.statsLogs || [],
    backupConfig: existing.backupConfig,
  }

  result.restored.shifts = restoredData.shifts.length
  result.restored.checkItems = restoredData.checkItems.length
  result.restored.inspectionPlans = restoredData.inspectionPlans.length
  result.restored.inspectionOrders = restoredData.inspectionOrders.length

  const tmpFile = DATA_FILE + '.tmp'
  const fd = fs.openSync(tmpFile, 'w')
  fs.writeFileSync(fd, JSON.stringify(restoredData, null, 2), 'utf-8')
  fs.fsyncSync(fd)
  fs.closeSync(fd)
  try {
    fs.copyFileSync(tmpFile, DATA_FILE)
  } catch {
    fs.writeFileSync(DATA_FILE, JSON.stringify(restoredData, null, 2), 'utf-8')
  }
  try {
    fs.unlinkSync(tmpFile)
  } catch {
    /* ignore */
  }

  // Restore evidence directory - remove existing evidence then copy backup
  if (fs.existsSync(EVIDENCE_DIR)) {
    removeDir(EVIDENCE_DIR)
  }
  if (fs.existsSync(backupEvidenceDir)) {
    copyDir(backupEvidenceDir, EVIDENCE_DIR)
  }

  return result
}

// ---- Scheduler ----

let dailyTimer: ReturnType<typeof setInterval> | null = null
const ONE_DAY_MS = 24 * 60 * 60 * 1000

async function maybeDailyBackup(): Promise<void> {
  try {
    const cfg = getBackupConfig()
    if (cfg.autoBackupMode !== 'DAILY') return
    const last = cfg.lastBackupAt ? new Date(cfg.lastBackupAt) : null
    const now = new Date()
    if (!last || now.getTime() - last.getTime() >= ONE_DAY_MS) {
      createBackup('auto', '每日自动备份')
    }
  } catch (err) {
    console.error('[Backup] Daily auto backup failed:', err)
  }
}

export function startAutoBackupScheduler(): void {
  if (dailyTimer) return
  dailyTimer = setInterval(() => {
    void maybeDailyBackup()
  }, 60 * 60 * 1000) // Check hourly
  setTimeout(() => void maybeDailyBackup(), 5000) // Initial check after 5s
}

export function handleStartupBackup(): void {
  try {
    const cfg = getBackupConfig()
    if (cfg.autoBackupMode === 'STARTUP') {
      createBackup('auto', '启动时自动备份')
    }
  } catch (err) {
    console.error('[Backup] Startup auto backup failed:', err)
  }
}

export function stopAutoBackupScheduler(): void {
  if (dailyTimer) {
    clearInterval(dailyTimer)
    dailyTimer = null
  }
}

export function updateAutoBackupMode(mode: AutoBackupMode): BackupConfig {
  const cfg = getBackupConfig()
  cfg.autoBackupMode = mode
  saveBackupConfig(cfg)
  if (mode === 'DAILY') {
    startAutoBackupScheduler()
  } else if (dailyTimer) {
    stopAutoBackupScheduler()
  }
  return cfg
}

export function updateRetentionCount(count: number): BackupConfig {
  if (!Number.isFinite(count) || count < 1 || count > 100) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '保留数量必须在 1-100 之间')
  }
  const cfg = getBackupConfig()
  cfg.retentionCount = count
  saveBackupConfig(cfg)
  applyRetention(count)
  return cfg
}
