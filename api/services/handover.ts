import { db, genId, nowIso } from './db.js'
import { BusinessError } from './validation.js'
import type {
  HandoverRecord,
  HandoverOperationLog,
  HandoverImportLog,
  HandoverImportResult,
  Device,
  Shift,
} from '../types/index.js'
import { ERROR_CODES } from '../types/index.js'

export const CSV_HEADERS = [
  '设备编码',
  '设备名称',
  '班次名称',
  '班次类型',
  '交接日期',
  '设备状态',
  '遗留问题',
  '备注',
  '交班人',
  '接班人',
  '是否已确认',
  '确认人',
  '确认时间',
  '创建时间',
  '更新时间',
] as const

export const SHIFT_TYPE_LABELS: Record<string, string> = {
  MORNING: '早班',
  AFTERNOON: '中班',
  NIGHT: '夜班',
}

export const HANDOVER_REQUIRED_FIELDS = [
  'deviceId',
  'shiftId',
  'handoverDate',
  'handoverPerson',
  'takeoverPerson',
] as const

export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false
  }
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  )
}

export function normalizeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function findDuplicateRecord(
  deviceId: string,
  shiftId: string,
  handoverDate: string,
  excludeId?: string,
): HandoverRecord | null {
  const normalizedDate = normalizeDate(handoverDate)
  const records = db.getHandoverRecords()
  return (
    records.find(
      (r) =>
        r.deviceId === deviceId &&
        r.shiftId === shiftId &&
        normalizeDate(r.handoverDate) === normalizedDate &&
        r.id !== excludeId,
    ) || null
  )
}

export function validateHandoverUniqueness(
  deviceId: string,
  shiftId: string,
  handoverDate: string,
  excludeId?: string,
): void {
  const duplicate = findDuplicateRecord(deviceId, shiftId, handoverDate, excludeId)
  if (duplicate) {
    const device = db.getDevices().find((d) => d.id === deviceId)
    const shift = db.getShifts().find((s) => s.id === shiftId)
    throw new BusinessError(
      ERROR_CODES.DUPLICATE_HANDOVER_RECORD,
      `设备 "${device?.name ?? deviceId}" 在 ${normalizeDate(handoverDate)} 的 ${shift?.name ?? shiftId} 已有交接班记录，同一设备同一天同一班次只能有一条记录。`,
      { existingId: duplicate.id },
    )
  }
}

export function validateDeviceExists(deviceId: string): Device {
  const device = db.getDevices().find((d) => d.id === deviceId)
  if (!device) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '设备不存在')
  }
  return device
}

export function validateShiftExists(shiftId: string): Shift {
  const shift = db.getShifts().find((s) => s.id === shiftId)
  if (!shift) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '班次不存在')
  }
  return shift
}

export function validateHandoverDate(handoverDate: string): string {
  if (!isValidDate(handoverDate)) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '交接日期格式无效')
  }
  return normalizeDate(handoverDate)
}

export function validateCreateInput(input: {
  deviceId: string
  shiftId: string
  handoverDate: string
  handoverPerson: string
  takeoverPerson: string
  operator: string
}): {
  deviceId: string
  shiftId: string
  handoverDate: string
  handoverPerson: string
  takeoverPerson: string
} {
  if (!input.deviceId || !input.shiftId || !input.handoverDate || !input.handoverPerson || !input.takeoverPerson || !input.operator) {
    throw new BusinessError(
      ERROR_CODES.VALIDATION_ERROR,
      '设备、班次、交接日期、交班人、接班人和操作人均为必填项',
    )
  }
  const device = validateDeviceExists(input.deviceId)
  validateShiftExists(input.shiftId)
  const normalizedDate = validateHandoverDate(input.handoverDate)
  validateHandoverUniqueness(input.deviceId, input.shiftId, normalizedDate)
  return {
    deviceId: device.id,
    shiftId: input.shiftId,
    handoverDate: normalizedDate,
    handoverPerson: input.handoverPerson.trim(),
    takeoverPerson: input.takeoverPerson.trim(),
  }
}

export function addOperationLog(
  record: HandoverRecord,
  action: HandoverOperationLog['action'],
  operator: string,
  remark?: string,
): void {
  const log: HandoverOperationLog = {
    id: genId('HLOG_'),
    handoverRecordId: record.id,
    action,
    operator: operator.trim(),
    timestamp: nowIso(),
    remark,
    snapshot: JSON.parse(JSON.stringify(record)),
  }
  record.operationLogs.push(log)
}

export function createHandoverRecord(input: {
  deviceId: string
  shiftId: string
  handoverDate: string
  equipmentStatus?: string
  remainingIssues?: string
  remark?: string
  handoverPerson: string
  takeoverPerson: string
  operator: string
}): HandoverRecord {
  const validated = validateCreateInput(input)
  const now = nowIso()
  const record: HandoverRecord = {
    id: genId('HND_'),
    ...validated,
    equipmentStatus: input.equipmentStatus || '',
    remainingIssues: input.remainingIssues || '',
    remark: input.remark || '',
    isConfirmed: false,
    operationLogs: [],
    createdAt: now,
    updatedAt: now,
  }
  addOperationLog(record, 'CREATE', input.operator, '创建交接班记录')
  db.addHandoverRecord(record)
  return record
}

export function updateHandoverRecord(
  id: string,
  input: {
    deviceId?: string
    shiftId?: string
    handoverDate?: string
    equipmentStatus?: string
    remainingIssues?: string
    remark?: string
    handoverPerson?: string
    takeoverPerson?: string
    operator: string
  },
): HandoverRecord {
  if (!input.operator) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '操作人必填')
  }
  const list = db.getHandoverRecords()
  const idx = list.findIndex((r) => r.id === id)
  if (idx === -1) {
    throw new BusinessError(ERROR_CODES.HANDOVER_RECORD_NOT_FOUND, '交接班记录不存在')
  }
  const existing = list[idx]
  if (existing.isConfirmed) {
    throw new BusinessError(
      ERROR_CODES.HANDOVER_RECORD_ALREADY_CONFIRMED,
      '已确认的交接班记录无法修改，请先撤销确认',
    )
  }

  const finalDeviceId = input.deviceId ?? existing.deviceId
  const finalShiftId = input.shiftId ?? existing.shiftId
  const finalDate = input.handoverDate ? validateHandoverDate(input.handoverDate) : existing.handoverDate

  if (input.deviceId) validateDeviceExists(input.deviceId)
  if (input.shiftId) validateShiftExists(input.shiftId)

  if (
    finalDeviceId !== existing.deviceId ||
    finalShiftId !== existing.shiftId ||
    finalDate !== normalizeDate(existing.handoverDate)
  ) {
    validateHandoverUniqueness(finalDeviceId, finalShiftId, finalDate, existing.id)
  }

  const updated: HandoverRecord = {
    ...existing,
    deviceId: finalDeviceId,
    shiftId: finalShiftId,
    handoverDate: finalDate,
    equipmentStatus: input.equipmentStatus ?? existing.equipmentStatus,
    remainingIssues: input.remainingIssues ?? existing.remainingIssues,
    remark: input.remark ?? existing.remark,
    handoverPerson: input.handoverPerson?.trim() ?? existing.handoverPerson,
    takeoverPerson: input.takeoverPerson?.trim() ?? existing.takeoverPerson,
    updatedAt: nowIso(),
  }
  addOperationLog(updated, 'UPDATE', input.operator, '更新交接班记录')
  list[idx] = updated
  db.saveHandoverRecords(list)
  return updated
}

export function confirmHandoverRecord(id: string, operator: string): HandoverRecord {
  if (!operator) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '确认人必填')
  }
  const list = db.getHandoverRecords()
  const idx = list.findIndex((r) => r.id === id)
  if (idx === -1) {
    throw new BusinessError(ERROR_CODES.HANDOVER_RECORD_NOT_FOUND, '交接班记录不存在')
  }
  const existing = list[idx]
  if (existing.isConfirmed) {
    throw new BusinessError(ERROR_CODES.HANDOVER_RECORD_ALREADY_CONFIRMED, '该交接班记录已确认')
  }
  const now = nowIso()
  const updated: HandoverRecord = {
    ...existing,
    isConfirmed: true,
    confirmedBy: operator.trim(),
    confirmedAt: now,
    updatedAt: now,
  }
  addOperationLog(updated, 'CONFIRM', operator, '确认交接班记录')
  list[idx] = updated
  db.saveHandoverRecords(list)
  return updated
}

export function undoConfirmHandoverRecord(id: string, operator: string): HandoverRecord {
  if (!operator) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '操作人必填')
  }
  const list = db.getHandoverRecords()
  const idx = list.findIndex((r) => r.id === id)
  if (idx === -1) {
    throw new BusinessError(ERROR_CODES.HANDOVER_RECORD_NOT_FOUND, '交接班记录不存在')
  }
  const existing = list[idx]
  if (!existing.isConfirmed) {
    throw new BusinessError(ERROR_CODES.HANDOVER_RECORD_NOT_CONFIRMED, '该交接班记录尚未确认，无法撤销')
  }
  const updated: HandoverRecord = {
    ...existing,
    isConfirmed: false,
    confirmedBy: undefined,
    confirmedAt: undefined,
    updatedAt: nowIso(),
  }
  addOperationLog(updated, 'UNDO_CONFIRM', operator, '撤销交接班记录确认')
  list[idx] = updated
  db.saveHandoverRecords(list)
  return updated
}

export function deleteHandoverRecord(id: string): void {
  const list = db.getHandoverRecords()
  const exists = list.find((r) => r.id === id)
  if (!exists) {
    throw new BusinessError(ERROR_CODES.HANDOVER_RECORD_NOT_FOUND, '交接班记录不存在')
  }
  const filtered = list.filter((r) => r.id !== id)
  db.saveHandoverRecords(filtered)
}

export function getHandoverRecordById(id: string): HandoverRecord {
  const record = db.getHandoverRecords().find((r) => r.id === id)
  if (!record) {
    throw new BusinessError(ERROR_CODES.HANDOVER_RECORD_NOT_FOUND, '交接班记录不存在')
  }
  return record
}

export function listHandoverRecords(filters?: {
  deviceId?: string
  shiftId?: string
  dateFrom?: string
  dateTo?: string
  isConfirmed?: string
}): HandoverRecord[] {
  let records = db.getHandoverRecords()
  if (filters?.deviceId) {
    records = records.filter((r) => r.deviceId === filters.deviceId)
  }
  if (filters?.shiftId) {
    records = records.filter((r) => r.shiftId === filters.shiftId)
  }
  if (filters?.dateFrom) {
    const from = normalizeDate(filters.dateFrom)
    records = records.filter((r) => normalizeDate(r.handoverDate) >= from)
  }
  if (filters?.dateTo) {
    const to = normalizeDate(filters.dateTo)
    records = records.filter((r) => normalizeDate(r.handoverDate) <= to)
  }
  if (filters?.isConfirmed !== undefined && filters.isConfirmed !== '') {
    const confirmed = filters.isConfirmed === 'true'
    records = records.filter((r) => r.isConfirmed === confirmed)
  }
  records.sort((a, b) => b.handoverDate.localeCompare(a.handoverDate) || b.createdAt.localeCompare(a.createdAt))
  return records
}

export function escapeCsv(val: string): string {
  const s = String(val || '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export function recordsToCsv(records: HandoverRecord[]): string {
  const devices = db.getDevices()
  const shifts = db.getShifts()
  const deviceMap = new Map(devices.map((d) => [d.id, d]))
  const shiftMap = new Map(shifts.map((s) => [s.id, s]))

  const rows = records.map((r) => {
    const dev = deviceMap.get(r.deviceId)
    const sh = shiftMap.get(r.shiftId)
    return [
      dev?.code || '',
      dev?.name || r.deviceId,
      sh?.name || r.shiftId,
      sh ? SHIFT_TYPE_LABELS[sh.type] || sh.type : '',
      r.handoverDate,
      r.equipmentStatus,
      r.remainingIssues,
      r.remark,
      r.handoverPerson,
      r.takeoverPerson,
      r.isConfirmed ? '是' : '否',
      r.confirmedBy || '',
      r.confirmedAt || '',
      r.createdAt,
      r.updatedAt,
    ]
  })

  return [CSV_HEADERS.join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\n')
}

export interface ImportCsvRowData {
  deviceCode: string
  deviceName: string
  shiftName: string
  handoverDate: string
  equipmentStatus: string
  remainingIssues: string
  remark: string
  handoverPerson: string
  takeoverPerson: string
}

export function importCsv(csv: string, operator: string): HandoverImportResult {
  if (!csv) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, 'CSV 内容不能为空')
  }
  if (!operator) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '操作人不能为空')
  }

  const devices = db.getDevices()
  const shifts = db.getShifts()
  const deviceByCode = new Map(devices.map((d) => [d.code, d]))
  const deviceByName = new Map(devices.map((d) => [d.name, d]))
  const shiftByName = new Map(shifts.map((s) => [s.name, s]))
  const records = db.getHandoverRecords()
  const imported: HandoverRecord[] = []
  const details: HandoverImportLog['details'] = []

  const lines = csv.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim())
  if (lines.length < 2) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, 'CSV 至少需要包含表头和一行数据')
  }

  const headerLine = lines[0]
  const dataLines = lines.slice(1)

  const headers = parseCsvLine(headerLine).map((h) => h.trim())
  const codeIdx = headers.findIndex((h) => h === '设备编码')
  const devNameIdx = headers.findIndex((h) => h === '设备名称')
  const shiftNameIdx = headers.findIndex((h) => h === '班次名称')
  const dateIdx = headers.findIndex((h) => h === '交接日期')
  const statusIdx = headers.findIndex((h) => h === '设备状态')
  const issuesIdx = headers.findIndex((h) => h === '遗留问题')
  const remarkIdx = headers.findIndex((h) => h === '备注')
  const handoverPersonIdx = headers.findIndex((h) => h === '交班人')
  const takeoverPersonIdx = headers.findIndex((h) => h === '接班人')

  if (dateIdx === -1 || handoverPersonIdx === -1 || takeoverPersonIdx === -1) {
    throw new BusinessError(
      ERROR_CODES.VALIDATION_ERROR,
      'CSV 必须包含"交接日期"、"交班人"和"接班人"列',
    )
  }
  if (codeIdx === -1 && devNameIdx === -1) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, 'CSV 必须包含"设备编码"或"设备名称"列')
  }
  if (shiftNameIdx === -1) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, 'CSV 必须包含"班次名称"列')
  }

  const now = nowIso()

  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = i + 2
    const row = parseCsvLine(dataLines[i])
    const deviceCode = codeIdx !== -1 ? row[codeIdx] || '' : ''
    const deviceName = devNameIdx !== -1 ? row[devNameIdx] || '' : ''
    const shiftName = row[shiftNameIdx] || ''
    const handoverDate = row[dateIdx] || ''
    const equipmentStatus = statusIdx !== -1 ? row[statusIdx] || '' : ''
    const remainingIssues = issuesIdx !== -1 ? row[issuesIdx] || '' : ''
    const remark = remarkIdx !== -1 ? row[remarkIdx] || '' : ''
    const handoverPerson = handoverPersonIdx !== -1 ? row[handoverPersonIdx] || '' : ''
    const takeoverPerson = takeoverPersonIdx !== -1 ? row[takeoverPersonIdx] || '' : ''

    const logEntry: HandoverImportLog['details'][0] = {
      row: rowNum,
      deviceCode,
      deviceName,
      shiftName,
      handoverDate,
      action: 'SKIPPED',
      reason: '',
    }

    if (!deviceCode && !deviceName) {
      logEntry.reason = '设备编码和设备名称均为空'
      details.push(logEntry)
      continue
    }
    if (!shiftName) {
      logEntry.reason = '班次名称为空'
      details.push(logEntry)
      continue
    }
    if (!handoverDate) {
      logEntry.reason = '交接日期为空'
      details.push(logEntry)
      continue
    }
    if (!handoverPerson) {
      logEntry.reason = '交班人为空'
      details.push(logEntry)
      continue
    }
    if (!takeoverPerson) {
      logEntry.reason = '接班人为空'
      details.push(logEntry)
      continue
    }
    if (!isValidDate(handoverDate)) {
      logEntry.reason = `交接日期格式无效: ${handoverDate}`
      details.push(logEntry)
      continue
    }

    let device = deviceCode ? deviceByCode.get(deviceCode) : undefined
    if (!device && deviceName) {
      device = deviceByName.get(deviceName)
    }
    if (!device) {
      logEntry.reason = `设备不存在: ${deviceCode || deviceName}`
      details.push(logEntry)
      continue
    }

    const shift = shiftByName.get(shiftName)
    if (!shift) {
      logEntry.reason = `班次不存在: ${shiftName}`
      details.push(logEntry)
      continue
    }

    const normalizedDate = normalizeDate(handoverDate)
    const duplicate = records.find(
      (r) =>
        r.deviceId === device!.id &&
        r.shiftId === shift.id &&
        normalizeDate(r.handoverDate) === normalizedDate,
    )
    if (duplicate) {
      logEntry.reason = `该设备在 ${normalizedDate} 的 ${shiftName} 已有交接班记录`
      details.push(logEntry)
      continue
    }

    const newRecord: HandoverRecord = {
      id: genId('HND_'),
      deviceId: device.id,
      shiftId: shift.id,
      handoverDate: normalizedDate,
      equipmentStatus,
      remainingIssues,
      remark,
      handoverPerson: handoverPerson.trim(),
      takeoverPerson: takeoverPerson.trim(),
      isConfirmed: false,
      operationLogs: [],
      createdAt: now,
      updatedAt: now,
    }
    addOperationLog(newRecord, 'CREATE', operator, 'CSV导入创建交接班记录')

    records.push(newRecord)
    imported.push(newRecord)
    logEntry.action = 'IMPORTED'
    logEntry.reason = '导入成功'
    details.push(logEntry)
  }

  db.saveHandoverRecords(records)

  const importLog: HandoverImportLog = {
    id: genId('HND_LOG_'),
    importedAt: now,
    importedBy: operator.trim(),
    totalRows: dataLines.length,
    successCount: imported.length,
    skipCount: details.filter((d) => d.action === 'SKIPPED').length,
    details,
  }
  db.addHandoverImportLog(importLog)

  return { log: importLog, imported }
}

export function listImportLogs(): HandoverImportLog[] {
  return db.getHandoverImportLogs()
}
