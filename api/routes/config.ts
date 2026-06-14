import { Router, type Request, type Response } from 'express'
import {
  exportConfig,
  parseAndValidateConfig,
  precheckConfigImport,
  importConfig,
} from '../services/config.js'
import type { ConfigImportOptions, ConfigPayload } from '../types/index.js'
import { BusinessError } from '../services/validation.js'

const router = Router()

router.get('/export', (req: Request, res: Response): void => {
  try {
    const data = exportConfig()
    const filename = `config_export_${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(JSON.stringify(data, null, 2))
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '导出失败' } })
  }
})

router.post('/precheck', (req: Request, res: Response): void => {
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    const payload = parseAndValidateConfig(raw)
    const precheck = precheckConfigImport(payload)
    res.json({ success: true, data: { payload, precheck } })
  } catch (err) {
    if (err instanceof BusinessError) {
      res.status(400).json({ success: false, error: err.toAppError() })
      return
    }
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '预校验失败' } })
  }
})

router.post('/import', (req: Request, res: Response): void => {
  try {
    const { payload, options } = req.body as {
      payload: ConfigPayload
      options: ConfigImportOptions
    }
    if (!payload || !options) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'payload 和 options 必填' },
      })
      return
    }
    const result = importConfig(payload, options)
    res.json({ success: true, data: result })
  } catch (err) {
    if (err instanceof BusinessError) {
      res.status(400).json({ success: false, error: err.toAppError() })
      return
    }
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '导入失败' } })
  }
})

export default router
