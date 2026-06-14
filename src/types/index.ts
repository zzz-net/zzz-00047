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

export type UndoResult = {
  success: boolean
  previousStatus: InspectionStatus
  currentStatus: InspectionStatus
  message: string
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

export const STATUS_TRANSITIONS: Record<InspectionStatus, InspectionStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['PENDING_REVIEW', 'COMPLETED', 'DRAFT'],
  PENDING_REVIEW: ['REVIEWED', 'SUBMITTED'],
  COMPLETED: ['SUBMITTED'],
  REVIEWED: ['CLOSED', 'PENDING_REVIEW'],
  CLOSED: ['REVIEWED'],
}

export const ERROR_CODES = {
  DUPLICATE_INSPECTION: 'DUPLICATE_INSPECTION',
  ANOMALY_MISSING_EVIDENCE: 'ANOMALY_MISSING_EVIDENCE',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_OPERATION: 'INVALID_OPERATION',
} as const
