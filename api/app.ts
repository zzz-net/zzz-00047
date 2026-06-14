/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import deviceRoutes from './routes/devices.js'
import shiftRoutes from './routes/shifts.js'
import checkItemRoutes from './routes/checkItems.js'
import planRoutes from './routes/plans.js'
import inspectionRoutes from './routes/inspections.js'
import fileRoutes from './routes/files.js'
import configRoutes from './routes/config.js'
import statsRoutes from './routes/stats.js'
import backupRoutes from './routes/backup.js'
import maintenanceRoutes from './routes/maintenance.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/devices', deviceRoutes)
app.use('/api/shifts', shiftRoutes)
app.use('/api/check-items', checkItemRoutes)
app.use('/api/plans', planRoutes)
app.use('/api/inspections', inspectionRoutes)
app.use('/api', fileRoutes)
app.use('/api/config', configRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/backups', backupRoutes)
app.use('/api/maintenance', maintenanceRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[SERVER ERROR]', error)
  console.error(error.stack)
  res.status(500).json({
    success: false,
    error: 'Server internal error: ' + error.message,
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
