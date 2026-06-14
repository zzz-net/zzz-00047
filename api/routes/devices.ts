import { Router, type Request, type Response } from 'express'
import { db, genId, nowIso } from '../services/db.js'
import type { Device } from '../types/index.js'
import { BusinessError } from '../services/validation.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  res.json({ success: true, data: db.getDevices() })
})

router.get('/:id', (req: Request, res: Response): void => {
  const device = db.getDevices().find((d) => d.id === req.params.id)
  if (!device) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '设备不存在' } })
    return
  }
  res.json({ success: true, data: device })
})

router.post('/', (req: Request, res: Response): void => {
  const { name, code, location, description } = req.body
  if (!name || !code) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '名称和编码必填' } })
    return
  }
  const now = nowIso()
  const device: Device = {
    id: genId('DEV_'),
    name,
    code,
    location: location || '',
    description: description || '',
    createdAt: now,
    updatedAt: now,
  }
  const list = db.getDevices()
  list.push(device)
  db.saveDevices(list)
  res.status(201).json({ success: true, data: device })
})

router.put('/:id', (req: Request, res: Response): void => {
  const list = db.getDevices()
  const idx = list.findIndex((d) => d.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '设备不存在' } })
    return
  }
  list[idx] = { ...list[idx], ...req.body, id: list[idx].id, createdAt: list[idx].createdAt, updatedAt: nowIso() }
  db.saveDevices(list)
  res.json({ success: true, data: list[idx] })
})

router.delete('/:id', (req: Request, res: Response): void => {
  const list = db.getDevices()
  const orders = db.getInspectionOrders()
  if (orders.some((o) => o.deviceId === req.params.id)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_OPERATION', message: '该设备已关联点检记录，无法删除' } })
    return
  }
  const filtered = list.filter((d) => d.id !== req.params.id)
  db.saveDevices(filtered)
  res.json({ success: true })
})

export default router
