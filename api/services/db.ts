import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { Database, Device, Shift, CheckItem, InspectionPlan, InspectionOrder } from '../types/index.js'
import { getInitialData } from './seed.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.resolve(__dirname, '../../data')
const DATA_FILE = path.join(DATA_DIR, 'db.json')
const EVIDENCE_DIR = path.join(DATA_DIR, 'evidence')

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  }
}

function loadDatabase(): Database {
  ensureDirs()
  if (!fs.existsSync(DATA_FILE)) {
    const initial = getInitialData()
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8')
    return initial
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw) as Database
  } catch {
    const initial = getInitialData()
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8')
    return initial
  }
}

function saveDatabase(db: Database): void {
  ensureDirs()
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

export const db = {
  getData(): Database {
    return loadDatabase()
  },
  save(data: Database): void {
    saveDatabase(data)
  },
  getDevices(): Device[] {
    return this.getData().devices
  },
  saveDevices(devices: Device[]): void {
    const data = this.getData()
    data.devices = devices
    this.save(data)
  },
  getShifts(): Shift[] {
    return this.getData().shifts
  },
  saveShifts(shifts: Shift[]): void {
    const data = this.getData()
    data.shifts = shifts
    this.save(data)
  },
  getCheckItems(): CheckItem[] {
    return this.getData().checkItems
  },
  saveCheckItems(items: CheckItem[]): void {
    const data = this.getData()
    data.checkItems = items
    this.save(data)
  },
  getInspectionPlans(): InspectionPlan[] {
    return this.getData().inspectionPlans
  },
  saveInspectionPlans(plans: InspectionPlan[]): void {
    const data = this.getData()
    data.inspectionPlans = plans
    this.save(data)
  },
  getInspectionOrders(): InspectionOrder[] {
    return this.getData().inspectionOrders
  },
  saveInspectionOrders(orders: InspectionOrder[]): void {
    const data = this.getData()
    data.inspectionOrders = orders
    this.save(data)
  },
  getEvidenceDir(): string {
    ensureDirs()
    return EVIDENCE_DIR
  },
  getDataDir(): string {
    ensureDirs()
    return DATA_DIR
  },
}

export function genId(prefix = ''): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}${ts}_${rand}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
