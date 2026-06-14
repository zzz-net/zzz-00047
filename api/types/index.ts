export type InspectionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_REVIEW'
  | 'COMPLETED'
  | 'REVIEWED'
  | 'CLOSED'

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

export interface Database {
  devices: Device[]
  shifts: Shift[]
  checkItems: CheckItem[]
  inspectionPlans: InspectionPlan[]
  inspectionOrders: InspectionOrder[]
  statsLogs: StatsLog[]
  backupConfig?: BackupConfig
}

export const STATUS_TRANSITIONS: Record<InspectionStatus, InspectionStatus[]> = {
  DRAFT: ['SUBMITTED', 'COMPLETED', 'PENDING_REVIEW'],
  SUBMITTED: ['PENDING_REVIEW', 'COMPLETED', 'DRAFT'],
  PENDING_REVIEW: ['REVIEWED', 'DRAFT', 'SUBMITTED'],
  COMPLETED: ['REVIEWED', 'DRAFT', 'SUBMITTED'],
  REVIEWED: ['CLOSED', 'DRAFT', 'PENDING_REVIEW', 'COMPLETED'],
  CLOSED: ['REVIEWED', 'DRAFT', 'PENDING_REVIEW'],
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
