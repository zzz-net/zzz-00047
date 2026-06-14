import type { InspectionStatus, InspectionOrder, AnomalyRecord, AppError } from '../types/index.js'
import { STATUS_TRANSITIONS, ERROR_CODES } from '../types/index.js'
import { db } from './db.js'

export class BusinessError extends Error {
  code: string
  details?: unknown
  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.code = code
    this.details = details
  }
  toAppError(): AppError {
    return { code: this.code, message: this.message, details: this.details }
  }
}

export function isValidTransition(
  from: InspectionStatus,
  to: InspectionStatus,
): boolean {
  const allowed = STATUS_TRANSITIONS[from] ?? []
  return allowed.includes(to)
}

export function validateStatusTransition(
  from: InspectionStatus,
  to: InspectionStatus,
): void {
  if (!isValidTransition(from, to)) {
    throw new BusinessError(
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      `非法状态流转：不允许从 "${from}" 变更到 "${to}"。允许的目标状态：${STATUS_TRANSITIONS[from].join(', ') || '无'}`,
      { from, to, allowed: STATUS_TRANSITIONS[from] },
    )
  }
}

export function checkDuplicateInspection(
  deviceId: string,
  shiftId: string,
  shiftDate: string,
  excludeOrderId?: string,
): void {
  const orders = db.getInspectionOrders()
  const duplicate = orders.find(
    (o) =>
      o.deviceId === deviceId &&
      o.shiftId === shiftId &&
      o.shiftDate === shiftDate &&
      o.id !== excludeOrderId,
  )
  if (duplicate) {
    const device = db.getDevices().find((d) => d.id === deviceId)
    const shift = db.getShifts().find((s) => s.id === shiftId)
    throw new BusinessError(
      ERROR_CODES.DUPLICATE_INSPECTION,
      `重复开单：设备 "${device?.name ?? deviceId}" 在 ${shiftDate} ${shift?.name ?? shiftId} 已存在点检单 (单号: ${duplicate.id})，同一设备同一班次只能开一张点检单。`,
      {
        deviceId,
        shiftId,
        shiftDate,
        existingOrderId: duplicate.id,
        existingStatus: duplicate.status,
      },
    )
  }
}

export function validateAnomaliesHaveEvidence(anomalies: AnomalyRecord[]): void {
  const missing = anomalies.filter((a) => !a.evidencePaths || a.evidencePaths.length === 0)
  if (missing.length > 0) {
    const codes = missing.map((a) => a.checkItemId).join(', ')
    throw new BusinessError(
      ERROR_CODES.ANOMALY_MISSING_EVIDENCE,
      `异常缺少证据：共 ${missing.length} 条异常记录未上传照片证据 (检查项: ${codes})。提交前请为每条异常上传至少一张照片。`,
      {
        missingAnomalyIds: missing.map((a) => a.id),
        missingCheckItemIds: missing.map((a) => a.checkItemId),
      },
    )
  }
}

export function validateOrderForReview(order: InspectionOrder): void {
  if (order.status !== 'PENDING_REVIEW') {
    throw new BusinessError(
      ERROR_CODES.INVALID_OPERATION,
      `复核失败：当前点检单状态为 "${order.status}"，只有 "PENDING_REVIEW(待复核)" 状态的点检单才能进行主管复核。`,
      { currentStatus: order.status, requiredStatus: 'PENDING_REVIEW' },
    )
  }
  validateAnomaliesHaveEvidence(order.anomalies)
}

export function validateOrderForClose(order: InspectionOrder): void {
  if (order.status !== 'REVIEWED') {
    throw new BusinessError(
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      `关闭失败：当前点检单状态为 "${order.status}"，只有 "REVIEWED(已复核)" 状态的点检单才能关闭异常。请先由主管完成复核。`,
      { currentStatus: order.status, requiredStatus: 'REVIEWED' },
    )
  }
}

export function validateOrderForSubmit(order: InspectionOrder): void {
  if (order.status !== 'DRAFT') {
    throw new BusinessError(
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      `提交失败：当前点检单状态为 "${order.status}"，只有 "DRAFT(草稿)" 状态的点检单才能提交。`,
      { currentStatus: order.status, requiredStatus: 'DRAFT' },
    )
  }
  if (!order.results || order.results.length === 0) {
    throw new BusinessError(
      ERROR_CODES.VALIDATION_ERROR,
      '提交失败：尚未填写任何检查项结果，请至少完成一项检查。',
    )
  }
  if (order.anomalies && order.anomalies.length > 0) {
    validateAnomaliesHaveEvidence(order.anomalies)
  }
}

export function validateCanUndo(order: InspectionOrder): void {
  if (!order.operationLogs || order.operationLogs.length < 2) {
    throw new BusinessError(
      ERROR_CODES.INVALID_OPERATION,
      '撤销失败：当前点检单没有足够的操作历史可供撤销（至少需要一次创建加一次状态变更）。',
      { logCount: order.operationLogs?.length ?? 0 },
    )
  }
}
