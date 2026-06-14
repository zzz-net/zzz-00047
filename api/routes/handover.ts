import { Router, type Request, type Response } from 'express'
import type { HandoverRecord, HandoverImportLog } from '../types/index.js'
import {
  listHandoverRecords,
  getHandoverRecordById,
  createHandoverRecord,
  updateHandoverRecord,
  confirmHandoverRecord,
  undoConfirmHandoverRecord,
  deleteHandoverRecord,
  recordsToCsv,
  importCsv,
  listImportLogs,
} from '../services/handover.js'
import { BusinessError } from '../services/validation.js'

const router = Router()

function handleServiceError(res: Response, error: unknown): void {
  if (error instanceof BusinessError) {
    const isNotFound = error.code.endsWith('_NOT_FOUND')
    const statusCode = isNotFound ? 404 : 400
    res.status(statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    })
    return
  }
  console.error('Handover API error:', error)
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
  })
}

router.get('/', (req: Request, res: Response): void => {
  try {
    const { deviceId, shiftId, dateFrom, dateTo, isConfirmed } = req.query
    const records = listHandoverRecords({
      deviceId: deviceId as string | undefined,
      shiftId: shiftId as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      isConfirmed: isConfirmed as string | undefined,
    })
    res.json({ success: true, data: records })
  } catch (e) {
    handleServiceError(res, e)
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const record = getHandoverRecordById(req.params.id)
    res.json({ success: true, data: record })
  } catch (e) {
    handleServiceError(res, e)
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const record = createHandoverRecord(req.body)
    res.status(201).json({ success: true, data: record })
  } catch (e) {
    handleServiceError(res, e)
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const updated = updateHandoverRecord(req.params.id, req.body)
    res.json({ success: true, data: updated })
  } catch (e) {
    handleServiceError(res, e)
  }
})

router.post('/:id/confirm', (req: Request, res: Response): void => {
  try {
    const updated = confirmHandoverRecord(req.params.id, req.body.operator)
    res.json({ success: true, data: updated })
  } catch (e) {
    handleServiceError(res, e)
  }
})

router.post('/:id/undo-confirm', (req: Request, res: Response): void => {
  try {
    const updated = undoConfirmHandoverRecord(req.params.id, req.body.operator)
    res.json({ success: true, data: updated })
  } catch (e) {
    handleServiceError(res, e)
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    deleteHandoverRecord(req.params.id)
    res.json({ success: true })
  } catch (e) {
    handleServiceError(res, e)
  }
})

router.get('/export/csv', (req: Request, res: Response): void => {
  try {
    const records = listHandoverRecords()
    const csv = recordsToCsv(records)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="handover_records.csv"')
    res.send('\uFEFF' + csv)
  } catch (e) {
    handleServiceError(res, e)
  }
})

router.post('/import/csv', (req: Request, res: Response): void => {
  try {
    const { csv, operator } = req.body
    const result = importCsv(csv, operator)
    res.json({ success: true, data: result })
  } catch (e) {
    handleServiceError(res, e)
  }
})

router.get('/import/logs', (req: Request, res: Response): void => {
  try {
    const logs = listImportLogs()
    res.json({ success: true, data: logs })
  } catch (e) {
    handleServiceError(res, e)
  }
})

export default router
