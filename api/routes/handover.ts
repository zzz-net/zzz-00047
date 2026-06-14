import { Router, type Request, type Response } from 'express'
import { db, genId, nowIso } from '../services/db.js'
import type { HandoverRecord, HandoverImportLog, HandoverOperationLog } from '../types/index.js'
import { ERROR_CODES } from '../types/index.js'

const router = Router()

function normalizeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isValidDate(dateStr: string): boolean {
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

function checkDuplicateRecord(
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

function addOperationLog(
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

router.get('/', (req: Request, res: Response): void => {
  const { deviceId, shiftId, dateFrom, dateTo, isConfirmed } = req.query
  let records = db.getHandoverRecords()
  if (deviceId) {
    records = records.filter((r) => r.deviceId === deviceId)
  }
  if (shiftId) {
    records = records.filter((r) => r.shiftId === shiftId)
  }
  if (dateFrom) {
    const from = normalizeDate(dateFrom as string)
    records = records.filter((r) => normalizeDate(r.handoverDate) >= from)
  }
  if (dateTo) {
    const to = normalizeDate(dateTo as string)
    records = records.filter((r) => normalizeDate(r.handoverDate) <= to)
  }
  if (isConfirmed !== undefined && isConfirmed !== '') {
    const confirmed = isConfirmed === 'true'
    records = records.filter((r) => r.isConfirmed === confirmed)
  }
  records.sort((a, b) => b.handoverDate.localeCompare(a.handoverDate) || b.createdAt.localeCompare(a.createdAt))
  res.json({ success: true, data: records })
})

router.get('/:id', (req: Request, res: Response): void => {
  const record = db.getHandoverRecords().find((r) => r.id === req.params.id)
  if (!record) {
    res.status(404).json({
      success: false,
      error: { code: ERROR_CODES.HANDOVER_RECORD_NOT_FOUND, message: '交接班记录不存在' },
    })
    return
  }
  res.json({ success: true, data: record })
})

router.post('/', (req: Request, res: Response): void => {
  const {
    deviceId,
    shiftId,
    handoverDate,
    equipmentStatus,
    remainingIssues,
    remark,
    handoverPerson,
    takeoverPerson,
    operator,
  } = req.body
  if (!deviceId || !shiftId || !handoverDate || !handoverPerson || !takeoverPerson || !operator) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '设备、班次、交接日期、交班人、接班人和操作人均为必填项' },
    })
    return
  }
  if (!isValidDate(handoverDate)) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '交接日期格式无效' },
    })
    return
  }
  const device = db.getDevices().find((d) => d.id === deviceId)
  if (!device) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '设备不存在' },
    })
    return
  }
  const shift = db.getShifts().find((s) => s.id === shiftId)
  if (!shift) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '班次不存在' },
    })
    return
  }
  const duplicate = checkDuplicateRecord(deviceId, shiftId, handoverDate)
  if (duplicate) {
    res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.DUPLICATE_HANDOVER_RECORD,
        message: `设备 "${device.name}" 在 ${normalizeDate(handoverDate)} 的 ${shift.name} 已有交接班记录，同一设备同一天同一班次只能有一条记录。`,
        details: { existingId: duplicate.id },
      },
    })
    return
  }
  const now = nowIso()
  const record: HandoverRecord = {
    id: genId('HND_'),
    deviceId,
    shiftId,
    handoverDate: normalizeDate(handoverDate),
    equipmentStatus: equipmentStatus || '',
    remainingIssues: remainingIssues || '',
    remark: remark || '',
    handoverPerson: handoverPerson.trim(),
    takeoverPerson: takeoverPerson.trim(),
    isConfirmed: false,
    operationLogs: [],
    createdAt: now,
    updatedAt: now,
  }
  addOperationLog(record, 'CREATE', operator, '创建交接班记录')
  db.addHandoverRecord(record)
  res.status(201).json({ success: true, data: record })
})

router.put('/:id', (req: Request, res: Response): void => {
  const list = db.getHandoverRecords()
  const idx = list.findIndex((r) => r.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({
      success: false,
      error: { code: ERROR_CODES.HANDOVER_RECORD_NOT_FOUND, message: '交接班记录不存在' },
    })
    return
  }
  const existing = list[idx]
  if (existing.isConfirmed) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.HANDOVER_RECORD_ALREADY_CONFIRMED, message: '已确认的交接班记录无法修改，请先撤销确认' },
    })
    return
  }
  const { deviceId, shiftId, handoverDate, equipmentStatus, remainingIssues, remark, handoverPerson, takeoverPerson, operator } =
    req.body
  if (!operator) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '操作人必填' },
    })
    return
  }
  if (deviceId !== undefined && !db.getDevices().find((d) => d.id === deviceId)) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '设备不存在' },
    })
    return
  }
  if (shiftId !== undefined && !db.getShifts().find((s) => s.id === shiftId)) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '班次不存在' },
    })
    return
  }
  if (handoverDate !== undefined && !isValidDate(handoverDate)) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '交接日期格式无效' },
    })
    return
  }
  const finalDeviceId = deviceId || existing.deviceId
  const finalShiftId = shiftId || existing.shiftId
  const finalDate = handoverDate ? normalizeDate(handoverDate) : existing.handoverDate
  if (
    finalDeviceId !== existing.deviceId ||
    finalShiftId !== existing.shiftId ||
    finalDate !== normalizeDate(existing.handoverDate)
  ) {
    const duplicate = checkDuplicateRecord(finalDeviceId, finalShiftId, finalDate, existing.id)
    if (duplicate) {
      const dev = db.getDevices().find((d) => d.id === finalDeviceId)
      const sh = db.getShifts().find((s) => s.id === finalShiftId)
      res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.DUPLICATE_HANDOVER_RECORD,
          message: `设备 "${dev?.name || finalDeviceId}" 在 ${finalDate} 的 ${sh?.name || finalShiftId} 已有交接班记录，同一设备同一天同一班次只能有一条记录。`,
          details: { existingId: duplicate.id },
        },
      })
      return
    }
  }
  const updated: HandoverRecord = {
    ...existing,
    deviceId: finalDeviceId,
    shiftId: finalShiftId,
    handoverDate: finalDate,
    equipmentStatus: equipmentStatus ?? existing.equipmentStatus,
    remainingIssues: remainingIssues ?? existing.remainingIssues,
    remark: remark ?? existing.remark,
    handoverPerson: handoverPerson?.trim() ?? existing.handoverPerson,
    takeoverPerson: takeoverPerson?.trim() ?? existing.takeoverPerson,
    updatedAt: nowIso(),
  }
  addOperationLog(updated, 'UPDATE', operator, '更新交接班记录')
  list[idx] = updated
  db.saveHandoverRecords(list)
  res.json({ success: true, data: updated })
})

router.post('/:id/confirm', (req: Request, res: Response): void => {
  const list = db.getHandoverRecords()
  const idx = list.findIndex((r) => r.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({
      success: false,
      error: { code: ERROR_CODES.HANDOVER_RECORD_NOT_FOUND, message: '交接班记录不存在' },
    })
    return
  }
  const existing = list[idx]
  if (existing.isConfirmed) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.HANDOVER_RECORD_ALREADY_CONFIRMED, message: '该交接班记录已确认' },
    })
    return
  }
  const { operator } = req.body
  if (!operator) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '确认人必填' },
    })
    return
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
  res.json({ success: true, data: updated })
})

router.post('/:id/undo-confirm', (req: Request, res: Response): void => {
  const list = db.getHandoverRecords()
  const idx = list.findIndex((r) => r.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({
      success: false,
      error: { code: ERROR_CODES.HANDOVER_RECORD_NOT_FOUND, message: '交接班记录不存在' },
    })
    return
  }
  const existing = list[idx]
  if (!existing.isConfirmed) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.HANDOVER_RECORD_NOT_CONFIRMED, message: '该交接班记录尚未确认，无法撤销' },
    })
    return
  }
  const { operator } = req.body
  if (!operator) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '操作人必填' },
    })
    return
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
  res.json({ success: true, data: updated })
})

router.delete('/:id', (req: Request, res: Response): void => {
  const list = db.getHandoverRecords()
  const idx = list.findIndex((r) => r.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({
      success: false,
      error: { code: ERROR_CODES.HANDOVER_RECORD_NOT_FOUND, message: '交接班记录不存在' },
    })
    return
  }
  const filtered = list.filter((r) => r.id !== req.params.id)
  db.saveHandoverRecords(filtered)
  res.json({ success: true })
})

router.get('/export/csv', (req: Request, res: Response): void => {
  const records = db.getHandoverRecords()
  const devices = db.getDevices()
  const shifts = db.getShifts()
  const deviceMap = new Map(devices.map((d) => [d.id, d]))
  const shiftMap = new Map(shifts.map((s) => [s.id, s]))

  const headers = [
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
  ]
  const shiftTypeLabels: Record<string, string> = {
    MORNING: '早班',
    AFTERNOON: '中班',
    NIGHT: '夜班',
  }
  const rows = records.map((r) => {
    const dev = deviceMap.get(r.deviceId)
    const sh = shiftMap.get(r.shiftId)
    return [
      dev?.code || '',
      dev?.name || r.deviceId,
      sh?.name || r.shiftId,
      sh ? shiftTypeLabels[sh.type] || sh.type : '',
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

  const escapeCsv = (val: string): string => {
    const s = String(val || '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="handover_records.csv"')
  res.send('\uFEFF' + csv)
})

router.post('/import/csv', (req: Request, res: Response): void => {
  const { csv, operator } = req.body
  if (!csv) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'CSV 内容不能为空' },
    })
    return
  }
  if (!operator) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '操作人不能为空' },
    })
    return
  }

  const devices = db.getDevices()
  const shifts = db.getShifts()
  const deviceByCode = new Map(devices.map((d) => [d.code, d]))
  const deviceByName = new Map(devices.map((d) => [d.name, d]))
  const shiftByName = new Map(shifts.map((s) => [s.name, s]))
  const records = db.getHandoverRecords()
  const imported: HandoverRecord[] = []
  const details: HandoverImportLog['details'] = []

  const lines = csv.replace(/\r\n/g, '\n').split('\n').filter((l: string) => l.trim())
  if (lines.length < 2) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'CSV 至少需要包含表头和一行数据' },
    })
    return
  }

  const headerLine = lines[0]
  const dataLines = lines.slice(1)

  const parseCsvLine = (line: string): string[] => {
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
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'CSV 必须包含"交接日期"、"交班人"和"接班人"列' },
    })
    return
  }
  if (codeIdx === -1 && devNameIdx === -1) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'CSV 必须包含"设备编码"或"设备名称"列' },
    })
    return
  }
  if (shiftNameIdx === -1) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'CSV 必须包含"班次名称"列' },
    })
    return
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

  res.json({
    success: true,
    data: {
      log: importLog,
      imported,
    },
  })
})

router.get('/import/logs', (req: Request, res: Response): void => {
  const logs = db.getHandoverImportLogs()
  res.json({ success: true, data: logs })
})

export default router
