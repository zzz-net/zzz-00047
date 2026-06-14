import { Router, type Request, type Response } from 'express'
import { db, genId, nowIso } from '../services/db.js'
import type { Shift } from '../types/index.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  res.json({ success: true, data: db.getShifts() })
})

router.post('/', (req: Request, res: Response): void => {
  const { name, type, startTime, endTime, description } = req.body
  if (!name || !type || !startTime || !endTime) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '名称、类型、起止时间必填' } })
    return
  }
  const now = nowIso()
  const shift: Shift = {
    id: genId('SHFT_'),
    name,
    type,
    startTime,
    endTime,
    description: description || '',
    createdAt: now,
    updatedAt: now,
  }
  const list = db.getShifts()
  list.push(shift)
  db.saveShifts(list)
  res.status(201).json({ success: true, data: shift })
})

router.put('/:id', (req: Request, res: Response): void => {
  const list = db.getShifts()
  const idx = list.findIndex((d) => d.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '班次不存在' } })
    return
  }
  list[idx] = { ...list[idx], ...req.body, id: list[idx].id, createdAt: list[idx].createdAt, updatedAt: nowIso() }
  db.saveShifts(list)
  res.json({ success: true, data: list[idx] })
})

router.delete('/:id', (req: Request, res: Response): void => {
  const list = db.getShifts()
  const orders = db.getInspectionOrders()
  if (orders.some((o) => o.shiftId === req.params.id)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_OPERATION', message: '该班次已关联点检记录，无法删除' } })
    return
  }
  db.saveShifts(list.filter((d) => d.id !== req.params.id))
  res.json({ success: true })
})

export default router
