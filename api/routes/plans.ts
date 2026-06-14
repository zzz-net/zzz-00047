import { Router, type Request, type Response } from 'express'
import { db, genId, nowIso } from '../services/db.js'
import type { InspectionPlan } from '../types/index.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  res.json({ success: true, data: db.getInspectionPlans() })
})

router.get('/:id', (req: Request, res: Response): void => {
  const plan = db.getInspectionPlans().find((p) => p.id === req.params.id)
  if (!plan) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '点检计划不存在' } })
    return
  }
  res.json({ success: true, data: plan })
})

router.post('/', (req: Request, res: Response): void => {
  const { name, deviceId, shiftId, checkItemIds, frequency, description } = req.body
  if (!name || !deviceId || !shiftId || !Array.isArray(checkItemIds) || checkItemIds.length === 0) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '名称、设备、班次、检查项为必填' } })
    return
  }
  const now = nowIso()
  const plan: InspectionPlan = {
    id: genId('PLAN_'),
    name,
    deviceId,
    shiftId,
    checkItemIds,
    frequency: frequency || '每日每班次',
    description: description || '',
    createdAt: now,
    updatedAt: now,
  }
  const list = db.getInspectionPlans()
  list.push(plan)
  db.saveInspectionPlans(list)
  res.status(201).json({ success: true, data: plan })
})

router.put('/:id', (req: Request, res: Response): void => {
  const list = db.getInspectionPlans()
  const idx = list.findIndex((d) => d.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '点检计划不存在' } })
    return
  }
  list[idx] = { ...list[idx], ...req.body, id: list[idx].id, createdAt: list[idx].createdAt, updatedAt: nowIso() }
  db.saveInspectionPlans(list)
  res.json({ success: true, data: list[idx] })
})

router.delete('/:id', (req: Request, res: Response): void => {
  const orders = db.getInspectionOrders()
  if (orders.some((o) => o.planId === req.params.id)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_OPERATION', message: '该计划已关联点检记录，无法删除' } })
    return
  }
  db.saveInspectionPlans(db.getInspectionPlans().filter((d) => d.id !== req.params.id))
  res.json({ success: true })
})

export default router
