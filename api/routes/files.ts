import { Router, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { saveEvidenceFile, exportAll, exportOrdersCsv } from '../services/inspection.js'
import { db } from '../services/db.js'
import { BusinessError } from '../services/validation.js'
import type { InspectionStatus } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

router.post('/evidence', (req: Request, res: Response): void => {
  try {
    const { fileName, base64 } = req.body
    if (!fileName || !base64) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'fileName 和 base64 必填' } })
      return
    }
    const urlPath = saveEvidenceFile(fileName, base64)
    res.json({ success: true, data: { path: urlPath } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '上传失败' } })
  }
})

router.get('/evidence/:fileName', (req: Request, res: Response): void => {
  const evidenceDir = db.getEvidenceDir()
  const filePath = path.join(evidenceDir, req.params.fileName)
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '文件不存在' } })
    return
  }
  res.sendFile(filePath)
})

router.get('/export/json', (req: Request, res: Response): void => {
  try {
    const data = exportAll()
    const filename = `inspection_export_${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(JSON.stringify(data, null, 2))
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '导出失败' } })
  }
})

router.get('/export/csv', (req: Request, res: Response): void => {
  try {
    const filters = {
      deviceId: req.query.deviceId as string | undefined,
      shiftId: req.query.shiftId as string | undefined,
      shiftDateFrom: req.query.shiftDateFrom as string | undefined,
      shiftDateTo: req.query.shiftDateTo as string | undefined,
      status: req.query.status as InspectionStatus | undefined,
    }
    const csv = exportOrdersCsv(filters)
    const filename = `inspection_orders_${new Date().toISOString().slice(0, 10)}.csv`
    const bom = '\uFEFF'
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(bom + csv)
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '导出失败' } })
  }
})

router.get('/export/order/:id/json', (req: Request, res: Response): void => {
  try {
    const orders = db.getInspectionOrders()
    const order = orders.find((o) => o.id === req.params.id)
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '点检单不存在' } })
      return
    }
    const filename = `order_${order.id}_${Date.now()}.json`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(JSON.stringify(order, null, 2))
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '导出失败' } })
  }
})

export default router
