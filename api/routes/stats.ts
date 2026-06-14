import { Router, type Request, type Response } from 'express'
import {
  getStatsSummary,
  addStatsLog,
  getStatsLogs,
  buildStatsCsv,
  buildStatsJson,
  getUserRole,
  type StatsFilters,
} from '../services/stats.js'
import { BusinessError } from '../services/validation.js'

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
  '/summary',
  wrap((req: Request, res: Response): void => {
    const user = req.query.user as string | undefined
    const dateFrom = req.query.dateFrom as string | undefined
    const dateTo = req.query.dateTo as string | undefined
    const deviceId = req.query.deviceId as string | undefined

    let userRole: 'operator' | 'supervisor' | 'all' = 'all'
    if (user) {
      userRole = getUserRole(user) === 'supervisor' ? 'all' : 'operator'
    }

    const filters: StatsFilters = {
      dateFrom,
      dateTo,
      user,
      userRole,
      deviceId,
    }

    const summary = getStatsSummary(filters)
    res.json({ success: true, data: summary })
  }),
)

router.post(
  '/log',
  wrap((req: Request, res: Response): void => {
    const { user, action, filters } = req.body
    if (!user || !action) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'user, action 为必填' },
      })
      return
    }
    addStatsLog({ user, action, filters })
    res.json({ success: true })
  }),
)

router.get(
  '/logs',
  wrap((_req: Request, res: Response): void => {
    res.json({ success: true, data: getStatsLogs() })
  }),
)

router.get(
  '/csv',
  wrap((req: Request, res: Response): void => {
    const user = req.query.user as string | undefined
    const dateFrom = req.query.dateFrom as string | undefined
    const dateTo = req.query.dateTo as string | undefined
    const deviceId = req.query.deviceId as string | undefined

    let userRole: 'operator' | 'supervisor' | 'all' = 'all'
    if (user) {
      userRole = getUserRole(user) === 'supervisor' ? 'all' : 'operator'
    }

    const filters: StatsFilters = {
      dateFrom,
      dateTo,
      user,
      userRole,
      deviceId,
    }

    const summary = getStatsSummary(filters)
    const csv = buildStatsCsv(summary)

    const BOM = '\uFEFF'
    const content = BOM + csv

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="stats_${dateFrom || 'start'}_${dateTo || 'end'}.csv"`)
    res.send(content)
  }),
)

router.get(
  '/json',
  wrap((req: Request, res: Response): void => {
    const user = req.query.user as string | undefined
    const dateFrom = req.query.dateFrom as string | undefined
    const dateTo = req.query.dateTo as string | undefined
    const deviceId = req.query.deviceId as string | undefined

    let userRole: 'operator' | 'supervisor' | 'all' = 'all'
    if (user) {
      userRole = getUserRole(user) === 'supervisor' ? 'all' : 'operator'
    }

    const filters: StatsFilters = {
      dateFrom,
      dateTo,
      user,
      userRole,
      deviceId,
    }

    const summary = getStatsSummary(filters)
    const json = buildStatsJson(summary)

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="stats_${dateFrom || 'start'}_${dateTo || 'end'}.json"`)
    res.send(json)
  }),
)

export default router
