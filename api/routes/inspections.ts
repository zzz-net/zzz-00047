import { Router, type Request, type Response } from 'express'
import {
  getOrders,
  getOrderById,
  createOrder,
  updateResults,
  submitOrder,
  reviewOrder,
  closeOrder,
  undoLastStep,
} from '../services/inspection.js'
import { BusinessError } from '../services/validation.js'
import type { InspectionStatus } from '../types/index.js'

const router = Router()

function wrap(handler: (req: Request, res: Response) => void | Promise<void>) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await handler(req, res)
    } catch (err) {
      if (err instanceof BusinessError) {
        res.status(400).json({ success: false, error: err.toAppError() })
        return
      }
      console.error(err)
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: err instanceof Error ? err.message : '服务器错误' },
      })
    }
  }
}

router.get(
  '/',
  wrap((req: Request, res: Response): void => {
    const filters = {
      deviceId: req.query.deviceId as string | undefined,
      shiftId: req.query.shiftId as string | undefined,
      shiftDateFrom: req.query.shiftDateFrom as string | undefined,
      shiftDateTo: req.query.shiftDateTo as string | undefined,
      status: req.query.status as InspectionStatus | undefined,
    }
    res.json({ success: true, data: getOrders(filters) })
  }),
)

router.get(
  '/:id',
  wrap((req: Request, res: Response): void => {
    res.json({ success: true, data: getOrderById(req.params.id) })
  }),
)

router.post(
  '/',
  wrap((req: Request, res: Response): void => {
    const { planId, deviceId, shiftId, shiftDate, operator } = req.body
    if (!planId || !deviceId || !shiftId || !shiftDate || !operator) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'planId, deviceId, shiftId, shiftDate, operator 为必填' },
      })
      return
    }
    const order = createOrder({ planId, deviceId, shiftId, shiftDate, operator })
    res.status(201).json({ success: true, data: order })
  }),
)

router.put(
  '/:id/results',
  wrap((req: Request, res: Response): void => {
    const { results, anomalies, operator } = req.body
    if (!Array.isArray(results) || !Array.isArray(anomalies) || !operator) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'results, anomalies, operator 为必填' },
      })
      return
    }
    const order = updateResults(req.params.id, results, anomalies, operator)
    res.json({ success: true, data: order })
  }),
)

router.post(
  '/:id/submit',
  wrap((req: Request, res: Response): void => {
    const { operator } = req.body
    if (!operator) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'operator 必填' } })
      return
    }
    const order = submitOrder(req.params.id, operator)
    res.json({ success: true, data: order })
  }),
)

router.post(
  '/:id/review',
  wrap((req: Request, res: Response): void => {
    const { supervisor, resolution } = req.body
    if (!supervisor) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'supervisor 必填' } })
      return
    }
    const order = reviewOrder(req.params.id, supervisor, resolution)
    res.json({ success: true, data: order })
  }),
)

router.post(
  '/:id/close',
  wrap((req: Request, res: Response): void => {
    const { operator } = req.body
    if (!operator) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'operator 必填' } })
      return
    }
    const order = closeOrder(req.params.id, operator)
    res.json({ success: true, data: order })
  }),
)

router.post(
  '/:id/undo',
  wrap((req: Request, res: Response): void => {
    const { operator } = req.body
    if (!operator) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'operator 必填' } })
      return
    }
    const order = undoLastStep(req.params.id, operator)
    res.json({ success: true, data: order })
  }),
)

export default router
