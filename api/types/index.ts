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

export interface Database {
  devices: Device[]
  shifts: Shift[]
  checkItems: CheckItem[]
  inspectionPlans: InspectionPlan[]
  inspectionOrders: InspectionOrder[]
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
