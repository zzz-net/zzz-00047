import fs from 'fs'
import path from 'path'
import type {
  InspectionOrder,
  InspectionItemResult,
  AnomalyRecord,
  OperationLog,
  InspectionStatus,
  Database,
} from '../types/index.js'
import { db, genId, nowIso } from './db.js'
import {
  BusinessError,
  checkDuplicateInspection,
  validateStatusTransition,
  validateOrderForSubmit,
  validateOrderForReview,
  validateOrderForClose,
  validateCanUndo,
  validateAnomaliesHaveEvidence,
} from './validation.js'
import { ERROR_CODES } from '../types/index.js'

function makeLog(
  orderId: string,
  action: string,
  fromStatus: InspectionStatus | null,
  toStatus: InspectionStatus | null,
  operator: string,
  remark?: string,
  snapshot?: unknown,
): OperationLog {
  return {
    id: genId('LOG_'),
    inspectionOrderId: orderId,
    action,
    fromStatus,
    toStatus,
    operator,
    timestamp: nowIso(),
    remark,
    snapshot,
  }
}

export function getOrders(
  filters?: {
    deviceId?: string
    shiftId?: string
    shiftDateFrom?: string
    shiftDateTo?: string
    status?: InspectionStatus
  },
): InspectionOrder[] {
  let orders = db.getInspectionOrders()
  if (filters?.deviceId) {
    orders = orders.filter((o) => o.deviceId === filters.deviceId)
  }
  if (filters?.shiftId) {
    orders = orders.filter((o) => o.shiftId === filters.shiftId)
  }
  if (filters?.shiftDateFrom) {
    orders = orders.filter((o) => o.shiftDate >= filters.shiftDateFrom!)
  }
  if (filters?.shiftDateTo) {
    orders = orders.filter((o) => o.shiftDate <= filters.shiftDateTo!)
  }
  if (filters?.status) {
    orders = orders.filter((o) => o.status === filters.status)
  }
  return orders.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
}

export function getOrderById(id: string): InspectionOrder {
  const order = db.getInspectionOrders().find((o) => o.id === id)
  if (!order) {
    throw new BusinessError(ERROR_CODES.NOT_FOUND, `点检单不存在: ${id}`, { id })
  }
  return order
}

export function createOrder(params: {
  planId: string
  deviceId: string
  shiftId: string
  shiftDate: string
  operator: string
}): InspectionOrder {
  const plans = db.getInspectionPlans()
  const plan = plans.find((p) => p.id === params.planId)
  if (!plan) {
    throw new BusinessError(ERROR_CODES.NOT_FOUND, `点检计划不存在: ${params.planId}`)
  }

  checkDuplicateInspection(params.deviceId, params.shiftId, params.shiftDate)

  const id = genId('ORD_')
  const now = nowIso()
  const order: InspectionOrder = {
    id,
    planId: params.planId,
    deviceId: params.deviceId,
    shiftId: params.shiftId,
    shiftDate: params.shiftDate,
    status: 'DRAFT',
    operator: params.operator,
    results: [],
    anomalies: [],
    operationLogs: [
      makeLog(id, 'CREATE', null, 'DRAFT', params.operator, '创建点检单'),
    ],
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  const orders = db.getInspectionOrders()
  orders.push(order)
  db.saveInspectionOrders(orders)
  return order
}

export function updateResults(
  orderId: string,
  results: (Omit<InspectionItemResult, 'id' | 'checkedAt' | 'checkedBy'> & { id?: string; checkedBy?: string })[],
  anomalies: (Omit<AnomalyRecord, 'id' | 'inspectionOrderId' | 'reportedAt'> & { id?: string })[],
  operator: string,
): InspectionOrder {
  const orders = db.getInspectionOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx === -1) {
    throw new BusinessError(ERROR_CODES.NOT_FOUND, `点检单不存在: ${orderId}`)
  }
  const order = orders[idx]
  if (order.status !== 'DRAFT') {
    throw new BusinessError(
      ERROR_CODES.INVALID_OPERATION,
      `无法修改：当前点检单状态为 "${order.status}"，只有草稿状态可以修改检查项。`,
      { status: order.status },
    )
  }

  const now = nowIso()
  order.results = results.map((r) => ({
    ...r,
    id: r.id && String(r.id).startsWith('R_') ? r.id : genId('R_'),
    checkedAt: now,
    checkedBy: r.checkedBy || operator,
  }))

  order.anomalies = anomalies.map((a) => ({
    ...a,
    id: a.id || genId('ANOM_'),
    inspectionOrderId: orderId,
    reportedAt: now,
  }))

  order.operationLogs.push(
    makeLog(
      orderId,
      'UPDATE_RESULTS',
      order.status,
      order.status,
      operator,
      `更新了 ${results.length} 项检查结果，${anomalies.length} 条异常记录`,
    ),
  )
  order.updatedAt = now
  orders[idx] = order
  db.saveInspectionOrders(orders)
  return order
}

export function submitOrder(orderId: string, operator: string): InspectionOrder {
  const orders = db.getInspectionOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx === -1) {
    throw new BusinessError(ERROR_CODES.NOT_FOUND, `点检单不存在: ${orderId}`)
  }
  const order = orders[idx]

  validateOrderForSubmit(order)

  const hasAnomalies = order.anomalies && order.anomalies.length > 0
  const targetStatus: InspectionStatus = hasAnomalies ? 'PENDING_REVIEW' : 'COMPLETED'
  validateStatusTransition(order.status, targetStatus)

  const fromStatus = order.status
  order.status = targetStatus
  order.submittedAt = nowIso()
  order.operationLogs.push(
    makeLog(
      orderId,
      hasAnomalies ? 'SUBMIT_WITH_ANOMALY' : 'SUBMIT',
      fromStatus,
      targetStatus,
      operator,
      hasAnomalies ? '提交点检单，存在异常记录，进入待复核状态' : '提交点检单，全部正常，已完成',
      JSON.parse(JSON.stringify({ results: order.results, anomalies: order.anomalies })),
    ),
  )
  order.updatedAt = nowIso()
  orders[idx] = order
  db.saveInspectionOrders(orders)
  return order
}

export function reviewOrder(
  orderId: string,
  supervisor: string,
  resolution?: string,
): InspectionOrder {
  const orders = db.getInspectionOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx === -1) {
    throw new BusinessError(ERROR_CODES.NOT_FOUND, `点检单不存在: ${orderId}`)
  }
  const order = orders[idx]
  validateOrderForReview(order)

  const fromStatus = order.status
  order.status = 'REVIEWED'
  order.supervisor = supervisor
  order.reviewedAt = nowIso()

  if (resolution) {
    order.anomalies = order.anomalies.map((a) => ({
      ...a,
      resolvedAt: nowIso(),
      resolvedBy: supervisor,
      resolution: resolution || a.resolution || '主管已复核确认',
    }))
  }

  order.operationLogs.push(
    makeLog(orderId, 'REVIEW', fromStatus, 'REVIEWED', supervisor, resolution || '主管复核通过'),
  )
  order.updatedAt = nowIso()
  orders[idx] = order
  db.saveInspectionOrders(orders)
  return order
}

export function closeOrder(orderId: string, operator: string): InspectionOrder {
  const orders = db.getInspectionOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx === -1) {
    throw new BusinessError(ERROR_CODES.NOT_FOUND, `点检单不存在: ${orderId}`)
  }
  const order = orders[idx]
  validateOrderForClose(order)

  const fromStatus = order.status
  order.status = 'CLOSED'
  order.closedAt = nowIso()
  order.operationLogs.push(
    makeLog(orderId, 'CLOSE', fromStatus, 'CLOSED', operator, '关闭点检单，异常已处理完毕'),
  )
  order.updatedAt = nowIso()
  orders[idx] = order
  db.saveInspectionOrders(orders)
  return order
}

export function undoLastStep(orderId: string, operator: string): InspectionOrder {
  const orders = db.getInspectionOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx === -1) {
    throw new BusinessError(ERROR_CODES.NOT_FOUND, `点检单不存在: ${orderId}`)
  }
  const order = orders[idx]
  validateCanUndo(order)

  const logs = [...order.operationLogs].sort(
    (a, b) => (a.timestamp > b.timestamp ? 1 : -1),
  )
  const lastAction = logs[logs.length - 1]

  if (lastAction.action === 'CREATE') {
    throw new BusinessError(
      ERROR_CODES.INVALID_OPERATION,
      '撤销失败：已经是最初的创建状态，无法再撤销。',
    )
  }

  const fromStatus = order.status
  const toStatus = lastAction.fromStatus
  if (!toStatus) {
    throw new BusinessError(ERROR_CODES.INVALID_OPERATION, '撤销失败：无法回退到空状态。')
  }

  validateStatusTransition(fromStatus, toStatus)

  order.status = toStatus
  if (toStatus === 'DRAFT') {
    order.submittedAt = undefined
  }
  if (toStatus !== 'REVIEWED') {
    order.reviewedAt = undefined
  }
  if (toStatus !== 'CLOSED') {
    order.closedAt = undefined
  }

  order.operationLogs.push(
    makeLog(
      orderId,
      'UNDO',
      fromStatus,
      toStatus,
      operator,
      `撤销操作：回退 "${lastAction.action}"，状态从 "${fromStatus}" 到 "${toStatus}"`,
      { undoAction: lastAction },
    ),
  )
  order.updatedAt = nowIso()
  orders[idx] = order
  db.saveInspectionOrders(orders)
  return order
}

export function saveEvidenceFile(
  fileName: string,
  base64Data: string,
): string {
  const evidenceDir = db.getEvidenceDir()
  const safeName = `${Date.now()}_${fileName.replace(/[^\w.\-]/g, '_')}`
  const fullPath = path.join(evidenceDir, safeName)
  const data = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
  const buffer = Buffer.from(data, 'base64')
  fs.writeFileSync(fullPath, buffer)
  return `/api/evidence/${safeName}`
}

export function exportAll(): Database {
  return db.getData()
}

export function exportOrdersCsv(
  filters?: Parameters<typeof getOrders>[0],
): string {
  const orders = getOrders(filters)
  const devices = Object.fromEntries(db.getDevices().map((d) => [d.id, d]))
  const shifts = Object.fromEntries(db.getShifts().map((s) => [s.id, s]))
  const plans = Object.fromEntries(db.getInspectionPlans().map((p) => [p.id, p]))
  const headers = [
    '单号',
    '计划名称',
    '设备名称',
    '设备编号',
    '班次',
    '班次日期',
    '状态',
    '操作员',
    '主管',
    '正常项数',
    '异常项数',
    '创建时间',
    '提交时间',
    '复核时间',
    '关闭时间',
  ]
  const rows = orders.map((o) => [
    o.id,
    plans[o.planId]?.name ?? o.planId,
    devices[o.deviceId]?.name ?? o.deviceId,
    devices[o.deviceId]?.code ?? '',
    shifts[o.shiftId]?.name ?? o.shiftId,
    o.shiftDate,
    o.status,
    o.operator,
    o.supervisor ?? '',
    String(o.results.filter((r) => r.status === 'NORMAL').length),
    String(o.anomalies.length),
    o.createdAt,
    o.submittedAt ?? '',
    o.reviewedAt ?? '',
    o.closedAt ?? '',
  ])
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  return [headers.map(escape), ...rows.map((r) => r.map(escape))]
    .map((r) => r.join(','))
    .join('\r\n')
}
