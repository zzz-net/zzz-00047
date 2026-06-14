import { Router, type Request, type Response } from 'express'
import {
  createBackup,
  listBackups,
  deleteBackup,
  getBackupConfig,
  precheckRestore,
  restoreBackup,
  updateAutoBackupMode,
  updateRetentionCount,
} from '../services/backup.js'
import type { BackupRestoreOptions, AutoBackupMode } from '../types/index.js'
import { BusinessError } from '../services/validation.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const list = listBackups()
    res.json({ success: true, data: list })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '获取备份列表失败' } })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const info = createBackup('manual', req.body?.note)
    res.json({ success: true, data: info })
  } catch (err) {
    if (err instanceof BusinessError) {
      res.status(400).json({ success: false, error: err.toAppError() })
      return
    }
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '创建备份失败' } })
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    deleteBackup(req.params.id)
    res.json({ success: true })
  } catch (err) {
    if (err instanceof BusinessError) {
      res.status(400).json({ success: false, error: err.toAppError() })
      return
    }
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '删除备份失败' } })
  }
})

router.get('/config', (req: Request, res: Response): void => {
  try {
    const cfg = getBackupConfig()
    res.json({ success: true, data: cfg })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '获取备份配置失败' } })
  }
})

router.put('/config', (req: Request, res: Response): void => {
  try {
    const { autoBackupMode, retentionCount } = req.body as {
      autoBackupMode?: AutoBackupMode
      retentionCount?: number
    }
    let cfg = getBackupConfig()
    if (autoBackupMode !== undefined) {
      if (!['OFF', 'DAILY', 'STARTUP'].includes(autoBackupMode)) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'autoBackupMode 必须是 OFF/DAILY/STARTUP' },
        })
        return
      }
      cfg = updateAutoBackupMode(autoBackupMode)
    }
    if (retentionCount !== undefined) {
      cfg = updateRetentionCount(retentionCount)
    }
    res.json({ success: true, data: cfg })
  } catch (err) {
    if (err instanceof BusinessError) {
      res.status(400).json({ success: false, error: err.toAppError() })
      return
    }
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '更新备份配置失败' } })
  }
})

router.post('/:id/precheck', (req: Request, res: Response): void => {
  try {
    const precheck = precheckRestore(req.params.id)
    res.json({ success: true, data: precheck })
  } catch (err) {
    if (err instanceof BusinessError) {
      res.status(400).json({ success: false, error: err.toAppError() })
      return
    }
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '预校验失败' } })
  }
})

router.post('/:id/restore', (req: Request, res: Response): void => {
  try {
    const options = (req.body?.options || { conflictAction: 'SKIP' }) as BackupRestoreOptions
    if (!options.conflictAction || !['SKIP', 'OVERWRITE'].includes(options.conflictAction)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'conflictAction 必须是 SKIP 或 OVERWRITE' },
      })
      return
    }
    const result = restoreBackup(req.params.id, options)
    res.json({ success: true, data: result })
  } catch (err) {
    if (err instanceof BusinessError) {
      res.status(400).json({ success: false, error: err.toAppError() })
      return
    }
    console.error(err)
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '恢复失败' } })
  }
})

export default router
