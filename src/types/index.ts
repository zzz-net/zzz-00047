export type InspectionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_REVIEW'
  | 'COMPLETED'
  | 'REVIEWED'
  | 'CLOSED'

export type MaintenanceReminderStatus = 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'UPCOMING'

export interface MaintenanceReminder {
  id: string
  deviceId: string
  maintenanceDate: string
  responsiblePerson: string
  remark: string
  status: MaintenanceReminderStatus
  completedAt?: string
  completedBy?: string
  createdAt: string
  updatedAt: string
}

export interface MaintenanceImportLog {
  id: string
  importedAt: string
  importedBy: string
  totalRows: number
  successCount: number
  skipCount: number
  details: {
    row: number
    deviceCode?: string
    deviceName?: string
    maintenanceDate?: string
    action: 'IMPORTED' | 'SKIPPED'
    reason: string
  }[]
}

export interface MaintenanceImportResult {
  log: MaintenanceImportLog
  imported: MaintenanceReminder[]
}

export interface MaintenanceSummary {
  total: number
  pending: number
  upcoming: number
  overdue: number
  completed: number
}

export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT'

export interface Device {
  id: string
  name: string
  code: string
  location: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface Shift {
  id: string
  name: string
  type: ShiftType
  startTime: string
  endTime: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface CheckItem {
  id: string
  name: string
  code: string
  category: string
  description: string
  standard: string
  deviceIds: string[]
  createdAt: string
  updatedAt: string
}

export interface InspectionPlan {
  id: string
  name: string
  deviceId: string
  shiftId: string
  checkItemIds: string[]
  frequency: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface AnomalyRecord {
  id: string
  inspectionOrderId: string
  checkItemId: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  evidencePaths: string[]
  reportedBy: string
  reportedAt: string
  resolvedAt?: string
  resolvedBy?: string
  resolution?: string
}

export interface InspectionItemResult {
  id: string
  checkItemId: string
  status: 'NORMAL' | 'ANOMALY'
  remark?: string
  anomalyId?: string
  checkedAt: string
  checkedBy: string
}

export interface OperationLog {
  id: string
  inspectionOrderId: string
  action: string
  fromStatus: InspectionStatus | null
  toStatus: InspectionStatus | null
  operator: string
  timestamp: string
  remark?: string
  snapshot?: unknown
}

export interface InspectionOrder {
  id: string
  planId: string
  deviceId: string
  shiftId: string
  shiftDate: string
  status: InspectionStatus
  operator: string
  supervisor?: string
  results: InspectionItemResult[]
  anomalies: AnomalyRecord[]
  operationLogs: OperationLog[]
  startedAt?: string
  submittedAt?: string
  reviewedAt?: string
  closedAt?: string
  createdAt: string
  updatedAt: string
}

export interface AppError {
  code: string
  message: string
  details?: unknown
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: AppError
}

export type UndoResult = {
  success: boolean
  previousStatus: InspectionStatus
  currentStatus: InspectionStatus
  message: string
}

export interface StatsLog {
  id: string
  user: string
  action: 'VIEW' | 'FILTER' | 'EXPORT'
  timestamp: string
  filters?: {
    dateFrom?: string
    dateTo?: string
  }
}

export interface DeviceCompletionRate {
  deviceId: string
  deviceName: string
  total: number
  closed: number
  rate: number
}

export interface ShiftAnomalyRate {
  shiftId: string
  shiftName: string
  shiftType: ShiftType
  total: number
  anomaly: number
  rate: number
}

export interface SeverityCount {
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  count: number
}

export interface AnomalyTrendItem {
  date: string
  count: number
}

export interface OperatorStats {
  operator: string
  totalOrders: number
  closedOrders: number
  totalAnomalies: number
  reviewedOrders: number
  reviewPassRate: number
}

export interface StatsSummary {
  deviceCompletionRates: DeviceCompletionRate[]
  shiftAnomalyRates: ShiftAnomalyRate[]
  severityCounts: SeverityCount[]
  anomalyTrend: AnomalyTrendItem[]
  operatorStats: OperatorStats[]
  totalOrders: number
  totalAnomalies: number
  userRole: 'supervisor' | 'operator'
}

export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  MORNING: '早班',
  AFTERNOON: '中班',
  NIGHT: '夜班',
}

export const STATUS_LABELS: Record<InspectionStatus, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  PENDING_REVIEW: '待复核',
  COMPLETED: '已完成',
  REVIEWED: '已复核',
  CLOSED: '已关闭',
}

export const STATUS_COLORS: Record<InspectionStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REVIEWED: 'bg-purple-100 text-purple-800',
  CLOSED: 'bg-slate-100 text-slate-800',
}

export const SEVERITY_LABELS: Record<string, string> = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
}

export const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-red-100 text-red-800',
}

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceReminderStatus, string> = {
  PENDING: '待处理',
  UPCOMING: '快到期',
  OVERDUE: '已逾期',
  COMPLETED: '已完成',
}

export const MAINTENANCE_STATUS_COLORS: Record<MaintenanceReminderStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  UPCOMING: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-green-100 text-green-700',
}

export interface HandoverOperationLog {
  id: string
  handoverRecordId: string
  action: 'CREATE' | 'UPDATE' | 'CONFIRM' | 'UNDO_CONFIRM' | 'DELETE'
  operator: string
  timestamp: string
  remark?: string
  snapshot?: unknown
}

export interface HandoverRecord {
  id: string
  deviceId: string
  shiftId: string
  handoverDate: string
  equipmentStatus: string
  remainingIssues: string
  remark: string
  handoverPerson: string
  takeoverPerson: string
  isConfirmed: boolean
  confirmedBy?: string
  confirmedAt?: string
  operationLogs: HandoverOperationLog[]
  createdAt: string
  updatedAt: string
}

export interface HandoverImportLog {
  id: string
  importedAt: string
  importedBy: string
  totalRows: number
  successCount: number
  skipCount: number
  details: {
    row: number
    deviceCode?: string
    deviceName?: string
    shiftName?: string
    handoverDate?: string
    action: 'IMPORTED' | 'SKIPPED'
    reason: string
  }[]
}

export interface HandoverImportResult {
  log: HandoverImportLog
  imported: HandoverRecord[]
}

export const HANDOVER_ACTION_LABELS: Record<HandoverOperationLog['action'], string> = {
  CREATE: '创建',
  UPDATE: '更新',
  CONFIRM: '确认',
  UNDO_CONFIRM: '撤销确认',
  DELETE: '删除',
}

export const STATUS_TRANSITIONS: Record<InspectionStatus, InspectionStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['PENDING_REVIEW', 'COMPLETED', 'DRAFT'],
  PENDING_REVIEW: ['REVIEWED', 'SUBMITTED'],
  COMPLETED: ['SUBMITTED'],
  REVIEWED: ['CLOSED', 'PENDING_REVIEW'],
  CLOSED: ['REVIEWED'],
}

export interface ConfigPayload {
  devices: Device[]
  shifts: Shift[]
  checkItems: CheckItem[]
  inspectionPlans: InspectionPlan[]
}

export interface ConfigConflict {
  type: 'device_code'
  code: string
  existingId: string
  importedId: string
  existingName: string
  importedName: string
}

export interface ConfigImportPrecheck {
  valid: boolean
  totalDevices: number
  totalShifts: number
  totalCheckItems: number
  totalPlans: number
  conflicts: ConfigConflict[]
  missingDeviceRefs: { planId: string; planName: string; deviceId: string }[]
  missingShiftRefs: { planId: string; planName: string; shiftId: string }[]
  missingCheckItemRefs: { planId: string; planName: string; checkItemIds: string[] }[]
}

export interface ConfigImportOptions {
  conflictAction: 'SKIP' | 'OVERWRITE'
}

export interface ConfigImportResult {
  imported: {
    devices: number
    shifts: number
    checkItems: number
    plans: number
  }
  skipped: {
    devices: number
    plans: number
  }
  overwritten: {
    devices: number
  }
}

export const ERROR_CODES = {
  DUPLICATE_INSPECTION: 'DUPLICATE_INSPECTION',
  ANOMALY_MISSING_EVIDENCE: 'ANOMALY_MISSING_EVIDENCE',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_OPERATION: 'INVALID_OPERATION',
  IMPORT_JSON_PARSE: 'IMPORT_JSON_PARSE',
  IMPORT_SCHEMA_ERROR: 'IMPORT_SCHEMA_ERROR',
  IMPORT_CONFLICT: 'IMPORT_CONFLICT',
  IMPORT_MISSING_REF: 'IMPORT_MISSING_REF',
  BACKUP_NOT_FOUND: 'BACKUP_NOT_FOUND',
  BACKUP_CORRUPTED: 'BACKUP_CORRUPTED',
  BACKUP_RESTORE_FAILED: 'BACKUP_RESTORE_FAILED',
  DUPLICATE_MAINTENANCE_REMINDER: 'DUPLICATE_MAINTENANCE_REMINDER',
  MAINTENANCE_REMINDER_NOT_FOUND: 'MAINTENANCE_REMINDER_NOT_FOUND',
  MAINTENANCE_REMINDER_ALREADY_COMPLETED: 'MAINTENANCE_REMINDER_ALREADY_COMPLETED',
  MAINTENANCE_REMINDER_NOT_COMPLETED: 'MAINTENANCE_REMINDER_NOT_COMPLETED',
  DUPLICATE_HANDOVER_RECORD: 'DUPLICATE_HANDOVER_RECORD',
  HANDOVER_RECORD_NOT_FOUND: 'HANDOVER_RECORD_NOT_FOUND',
  HANDOVER_RECORD_ALREADY_CONFIRMED: 'HANDOVER_RECORD_ALREADY_CONFIRMED',
  HANDOVER_RECORD_NOT_CONFIRMED: 'HANDOVER_RECORD_NOT_CONFIRMED',
} as const

export type BackupType = 'manual' | 'auto' | 'snapshot'

export interface BackupInfo {
  id: string
  name: string
  createdAt: string
  sizeBytes: number
  type: BackupType
  note?: string
}

export type AutoBackupMode = 'OFF' | 'DAILY' | 'STARTUP'

export interface BackupConfig {
  autoBackupMode: AutoBackupMode
  retentionCount: number
  lastBackupAt?: string
}

export interface BackupRestorePrecheck {
  valid: boolean
  errors: string[]
  conflicts: ConfigConflict[]
  backupInfo: BackupInfo
  snapshotBackupId?: string
}

export interface BackupRestoreOptions {
  conflictAction: 'SKIP' | 'OVERWRITE'
  individualOverrides?: Record<string, 'SKIP' | 'OVERWRITE'>
}

export interface BackupRestoreResult {
  success: boolean
  snapshotBackupId: string
  restored: {
    devices: number
    shifts: number
    checkItems: number
    inspectionPlans: number
    inspectionOrders: number
  }
  skipped: {
    devices: number
  }
  overwritten: {
    devices: number
  }
}
