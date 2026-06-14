import { Router, type Request, type Response } from 'express'
import { db, genId, nowIso } from '../services/db.js'
import type { MaintenanceReminder, MaintenanceReminderStatus, MaintenanceImportLog } from '../types/index.js'
import { BusinessError } from '../services/validation.js'
import { ERROR_CODES } from '../types/index.js'

const router = Router()

function normalizeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr)
  return !isNaN(d.getTime())
}

function computeStatus(reminder: MaintenanceReminder): MaintenanceReminderStatus {
  if (reminder.completedAt) return 'COMPLETED'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maintenanceDate = new Date(reminder.maintenanceDate)
  maintenanceDate.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((maintenanceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'OVERDUE'
  if (diffDays <= 7) return 'UPCOMING'
  return 'PENDING'
}

function checkDuplicateReminder(deviceId: string, maintenanceDate: string, excludeId?: string): MaintenanceReminder | null {
  const normalizedDate = normalizeDate(maintenanceDate)
  const reminders = db.getMaintenanceReminders()
  return reminders.find(
    (r) =>
      r.deviceId === deviceId &&
      normalizeDate(r.maintenanceDate) === normalizedDate &&
      !r.completedAt &&
      r.id !== excludeId,
  ) || null
}

router.get('/', (req: Request, res: Response): void => {
  const { status, deviceId } = req.query
  let reminders = db.getMaintenanceReminders().map((r) => ({ ...r, status: computeStatus(r) }))
  if (status) {
    reminders = reminders.filter((r) => r.status === status)
  }
  if (deviceId) {
    reminders = reminders.filter((r) => r.deviceId === deviceId)
  }
  reminders.sort((a, b) => a.maintenanceDate.localeCompare(b.maintenanceDate))
  res.json({ success: true, data: reminders })
})

router.get('/summary', (req: Request, res: Response): void => {
  const reminders = db.getMaintenanceReminders().map((r) => ({ ...r, status: computeStatus(r) }))
  const summary = {
    total: reminders.length,
    pending: reminders.filter((r) => r.status === 'PENDING').length,
    upcoming: reminders.filter((r) => r.status === 'UPCOMING').length,
    overdue: reminders.filter((r) => r.status === 'OVERDUE').length,
    completed: reminders.filter((r) => r.status === 'COMPLETED').length,
  }
  res.json({ success: true, data: summary })
})

router.get('/:id', (req: Request, res: Response): void => {
  const reminder = db.getMaintenanceReminders().find((r) => r.id === req.params.id)
  if (!reminder) {
    res.status(404).json({
      success: false,
      error: { code: ERROR_CODES.MAINTENANCE_REMINDER_NOT_FOUND, message: '保养提醒不存在' },
    })
    return
  }
  res.json({ success: true, data: { ...reminder, status: computeStatus(reminder) } })
})

router.post('/', (req: Request, res: Response): void => {
  const { deviceId, maintenanceDate, responsiblePerson, remark } = req.body
  if (!deviceId || !maintenanceDate || !responsiblePerson) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '设备、保养日期和负责人必填' },
    })
    return
  }
  if (!isValidDate(maintenanceDate)) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '保养日期格式无效' },
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
  const duplicate = checkDuplicateReminder(deviceId, maintenanceDate)
  if (duplicate) {
    res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.DUPLICATE_MAINTENANCE_REMINDER,
        message: `设备 "${device.name}" 在 ${normalizeDate(maintenanceDate)} 已有未完成的保养提醒，同一设备同一天只能有一条未完成提醒。`,
        details: { existingId: duplicate.id },
      },
    })
    return
  }
  const now = nowIso()
  const reminder: MaintenanceReminder = {
    id: genId('MNT_'),
    deviceId,
    maintenanceDate: normalizeDate(maintenanceDate),
    responsiblePerson: responsiblePerson.trim(),
    remark: remark || '',
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  }
  db.addMaintenanceReminder(reminder)
  res.status(201).json({ success: true, data: { ...reminder, status: computeStatus(reminder) } })
})

router.put('/:id', (req: Request, res: Response): void => {
  const list = db.getMaintenanceReminders()
  const idx = list.findIndex((r) => r.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({
      success: false,
      error: { code: ERROR_CODES.MAINTENANCE_REMINDER_NOT_FOUND, message: '保养提醒不存在' },
    })
    return
  }
  const existing = list[idx]
  if (existing.completedAt) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.MAINTENANCE_REMINDER_ALREADY_COMPLETED, message: '已完成的保养提醒无法修改' },
    })
    return
  }
  const { deviceId, maintenanceDate, responsiblePerson, remark } = req.body
  if (deviceId !== undefined && !db.getDevices().find((d) => d.id === deviceId)) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '设备不存在' },
    })
    return
  }
  if (maintenanceDate !== undefined && !isValidDate(maintenanceDate)) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: '保养日期格式无效' },
    })
    return
  }
  const finalDeviceId = deviceId || existing.deviceId
  const finalDate = maintenanceDate ? normalizeDate(maintenanceDate) : existing.maintenanceDate
  if (finalDeviceId !== existing.deviceId || finalDate !== normalizeDate(existing.maintenanceDate)) {
    const duplicate = checkDuplicateReminder(finalDeviceId, finalDate, existing.id)
    if (duplicate) {
      const device = db.getDevices().find((d) => d.id === finalDeviceId)
      res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.DUPLICATE_MAINTENANCE_REMINDER,
          message: `设备 "${device?.name || finalDeviceId}" 在 ${finalDate} 已有未完成的保养提醒，同一设备同一天只能有一条未完成提醒。`,
          details: { existingId: duplicate.id },
        },
      })
      return
    }
  }
  list[idx] = {
    ...existing,
    deviceId: finalDeviceId,
    maintenanceDate: finalDate,
    responsiblePerson: responsiblePerson?.trim() ?? existing.responsiblePerson,
    remark: remark ?? existing.remark,
    updatedAt: nowIso(),
  }
  db.saveMaintenanceReminders(list)
  res.json({ success: true, data: { ...list[idx], status: computeStatus(list[idx]) } })
})

router.post('/:id/complete', (req: Request, res: Response): void => {
  const list = db.getMaintenanceReminders()
  const idx = list.findIndex((r) => r.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({
      success: false,
      error: { code: ERROR_CODES.MAINTENANCE_REMINDER_NOT_FOUND, message: '保养提醒不存在' },
    })
    return
  }
  const existing = list[idx]
  if (existing.completedAt) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.MAINTENANCE_REMINDER_ALREADY_COMPLETED, message: '该保养提醒已完成' },
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
  list[idx] = {
    ...existing,
    completedAt: nowIso(),
    completedBy: operator.trim(),
    updatedAt: nowIso(),
  }
  db.saveMaintenanceReminders(list)
  res.json({ success: true, data: { ...list[idx], status: computeStatus(list[idx]) } })
})

router.post('/:id/undo', (req: Request, res: Response): void => {
  const list = db.getMaintenanceReminders()
  const idx = list.findIndex((r) => r.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({
      success: false,
      error: { code: ERROR_CODES.MAINTENANCE_REMINDER_NOT_FOUND, message: '保养提醒不存在' },
    })
    return
  }
  const existing = list[idx]
  if (!existing.completedAt) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.MAINTENANCE_REMINDER_NOT_COMPLETED, message: '该保养提醒尚未完成，无法撤销' },
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
  list[idx] = {
    ...existing,
    completedAt: undefined,
    completedBy: undefined,
    updatedAt: nowIso(),
  }
  db.saveMaintenanceReminders(list)
  res.json({ success: true, data: { ...list[idx], status: computeStatus(list[idx]) } })
})

router.delete('/:id', (req: Request, res: Response): void => {
  const list = db.getMaintenanceReminders()
  const idx = list.findIndex((r) => r.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({
      success: false,
      error: { code: ERROR_CODES.MAINTENANCE_REMINDER_NOT_FOUND, message: '保养提醒不存在' },
    })
    return
  }
  const filtered = list.filter((r) => r.id !== req.params.id)
  db.saveMaintenanceReminders(filtered)
  res.json({ success: true })
})

router.get('/export/csv', (req: Request, res: Response): void => {
  const reminders = db.getMaintenanceReminders().map((r) => ({ ...r, status: computeStatus(r) }))
  const devices = db.getDevices()
  const deviceMap = new Map(devices.map((d) => [d.id, d]))

  const headers = ['设备编码', '设备名称', '保养日期', '负责人', '备注', '状态', '完成时间', '完成人', '创建时间']
  const statusLabels: Record<string, string> = {
    PENDING: '待处理',
    UPCOMING: '快到期',
    OVERDUE: '已逾期',
    COMPLETED: '已完成',
  }
  const rows = reminders.map((r) => {
    const dev = deviceMap.get(r.deviceId)
    return [
      dev?.code || '',
      dev?.name || r.deviceId,
      r.maintenanceDate,
      r.responsiblePerson,
      r.remark,
      statusLabels[r.status] || r.status,
      r.completedAt || '',
      r.completedBy || '',
      r.createdAt,
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
  res.setHeader('Content-Disposition', 'attachment; filename="maintenance_reminders.csv"')
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
  const deviceByCode = new Map(devices.map((d) => [d.code, d]))
  const reminders = db.getMaintenanceReminders()
  const imported: MaintenanceReminder[] = []
  const details: MaintenanceImportLog['details'] = []

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
  const nameIdx = headers.findIndex((h) => h === '设备名称')
  const dateIdx = headers.findIndex((h) => h === '保养日期')
  const personIdx = headers.findIndex((h) => h === '负责人')
  const remarkIdx = headers.findIndex((h) => h === '备注')

  if (codeIdx === -1 || dateIdx === -1 || personIdx === -1) {
    res.status(400).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'CSV 必须包含"设备编码"、"保养日期"和"负责人"列' },
    })
    return
  }

  const now = nowIso()

  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = i + 2
    const row = parseCsvLine(dataLines[i])
    const deviceCode = row[codeIdx] || ''
    const deviceName = nameIdx !== -1 ? row[nameIdx] : ''
    const maintenanceDate = row[dateIdx] || ''
    const responsiblePerson = row[personIdx] || ''
    const remark = remarkIdx !== -1 ? row[remarkIdx] : ''

    const logEntry: MaintenanceImportLog['details'][0] = {
      row: rowNum,
      deviceCode,
      deviceName,
      maintenanceDate,
      action: 'SKIPPED',
      reason: '',
    }

    if (!deviceCode) {
      logEntry.reason = '设备编码为空'
      details.push(logEntry)
      continue
    }
    if (!maintenanceDate) {
      logEntry.reason = '保养日期为空'
      details.push(logEntry)
      continue
    }
    if (!responsiblePerson) {
      logEntry.reason = '负责人为空'
      details.push(logEntry)
      continue
    }
    if (!isValidDate(maintenanceDate)) {
      logEntry.reason = `保养日期格式无效: ${maintenanceDate}`
      details.push(logEntry)
      continue
    }
    const device = deviceByCode.get(deviceCode)
    if (!device) {
      logEntry.reason = `设备不存在: ${deviceCode}`
      details.push(logEntry)
      continue
    }

    const normalizedDate = normalizeDate(maintenanceDate)
    const duplicate = reminders.find(
      (r) =>
        r.deviceId === device.id &&
        normalizeDate(r.maintenanceDate) === normalizedDate &&
        !r.completedAt,
    )
    if (duplicate) {
      logEntry.reason = `该设备在 ${normalizedDate} 已有未完成提醒`
      details.push(logEntry)
      continue
    }

    const newReminder: MaintenanceReminder = {
      id: genId('MNT_'),
      deviceId: device.id,
      maintenanceDate: normalizedDate,
      responsiblePerson: responsiblePerson.trim(),
      remark,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    }

    reminders.push(newReminder)
    imported.push(newReminder)
    logEntry.action = 'IMPORTED'
    logEntry.reason = '导入成功'
    details.push(logEntry)
  }

  db.saveMaintenanceReminders(reminders)

  const importLog: MaintenanceImportLog = {
    id: genId('MNT_LOG_'),
    importedAt: now,
    importedBy: operator.trim(),
    totalRows: dataLines.length,
    successCount: imported.length,
    skipCount: details.filter((d) => d.action === 'SKIPPED').length,
    details,
  }
  db.addMaintenanceImportLog(importLog)

  res.json({
    success: true,
    data: {
      log: importLog,
      imported: imported.map((r) => ({ ...r, status: computeStatus(r) })),
    },
  })
})

router.get('/import/logs', (req: Request, res: Response): void => {
  const logs = db.getMaintenanceImportLogs()
  res.json({ success: true, data: logs })
})

export default router
