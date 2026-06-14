import { Router, type Request, type Response } from 'express'
import { db, genId, nowIso } from '../services/db.js'
import type { CheckItem } from '../types/index.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  res.json({ success: true, data: db.getCheckItems() })
})

router.post('/', (req: Request, res: Response): void => {
  const { name, code, category, description, standard, deviceIds } = req.body
  if (!name || !code) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '名称和编码必填' } })
    return
  }
  const now = nowIso()
  const item: CheckItem = {
    id: genId('CI_'),
    name,
    code,
    category: category || '通用',
    description: description || '',
    standard: standard || '',
    deviceIds: deviceIds || [],
    createdAt: now,
    updatedAt: now,
  }
  const list = db.getCheckItems()
  list.push(item)
  db.saveCheckItems(list)
  res.status(201).json({ success: true, data: item })
})

router.put('/:id', (req: Request, res: Response): void => {
  const list = db.getCheckItems()
  const idx = list.findIndex((d) => d.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '检查项不存在' } })
    return
  }
  list[idx] = { ...list[idx], ...req.body, id: list[idx].id, createdAt: list[idx].createdAt, updatedAt: nowIso() }
  db.saveCheckItems(list)
  res.json({ success: true, data: list[idx] })
})

router.delete('/:id', (req: Request, res: Response): void => {
  db.saveCheckItems(db.getCheckItems().filter((d) => d.id !== req.params.id))
  res.json({ success: true })
})

export default router
