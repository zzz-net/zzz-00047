import type {
  ConfigPayload,
  ConfigImportPrecheck,
  ConfigImportOptions,
  ConfigImportResult,
  ConfigConflict,
  Device,
  Shift,
  CheckItem,
  InspectionPlan,
  Database,
} from '../types/index.js'
import { db, nowIso, genId } from './db.js'
import { BusinessError } from './validation.js'
import { ERROR_CODES } from '../types/index.js'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function validateDevice(obj: unknown, index: number): Device {
  if (!obj || typeof obj !== 'object') {
    throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `devices[${index}] 不是合法对象`)
  }
  const d = obj as Record<string, unknown>
  if (!isNonEmptyString(d.id)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `devices[${index}].id 缺失或为空`)
  if (!isNonEmptyString(d.name)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `devices[${index}].name 缺失或为空`)
  if (!isNonEmptyString(d.code)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `devices[${index}].code 缺失或为空`)
  return {
    id: d.id,
    name: d.name,
    code: d.code,
    location: typeof d.location === 'string' ? d.location : '',
    description: typeof d.description === 'string' ? d.description : '',
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : nowIso(),
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : nowIso(),
  }
}

function validateShift(obj: unknown, index: number): Shift {
  if (!obj || typeof obj !== 'object') {
    throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `shifts[${index}] 不是合法对象`)
  }
  const s = obj as Record<string, unknown>
  if (!isNonEmptyString(s.id)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `shifts[${index}].id 缺失或为空`)
  if (!isNonEmptyString(s.name)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `shifts[${index}].name 缺失或为空`)
  if (!isNonEmptyString(s.type) || !['MORNING', 'AFTERNOON', 'NIGHT'].includes(s.type)) {
    throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `shifts[${index}].type 缺失或非法，必须是 MORNING/AFTERNOON/NIGHT`)
  }
  if (!isNonEmptyString(s.startTime)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `shifts[${index}].startTime 缺失或为空`)
  if (!isNonEmptyString(s.endTime)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `shifts[${index}].endTime 缺失或为空`)
  return {
    id: s.id,
    name: s.name,
    type: s.type as Shift['type'],
    startTime: s.startTime,
    endTime: s.endTime,
    description: typeof s.description === 'string' ? s.description : '',
    createdAt: typeof s.createdAt === 'string' ? s.createdAt : nowIso(),
    updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : nowIso(),
  }
}

function validateCheckItem(obj: unknown, index: number): CheckItem {
  if (!obj || typeof obj !== 'object') {
    throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `checkItems[${index}] 不是合法对象`)
  }
  const c = obj as Record<string, unknown>
  if (!isNonEmptyString(c.id)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `checkItems[${index}].id 缺失或为空`)
  if (!isNonEmptyString(c.name)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `checkItems[${index}].name 缺失或为空`)
  if (!isNonEmptyString(c.code)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `checkItems[${index}].code 缺失或为空`)
  if (!isStringArray(c.deviceIds)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `checkItems[${index}].deviceIds 缺失或不是字符串数组`)
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    category: typeof c.category === 'string' ? c.category : '',
    description: typeof c.description === 'string' ? c.description : '',
    standard: typeof c.standard === 'string' ? c.standard : '',
    deviceIds: c.deviceIds,
    createdAt: typeof c.createdAt === 'string' ? c.createdAt : nowIso(),
    updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : nowIso(),
  }
}

function validatePlan(obj: unknown, index: number): InspectionPlan {
  if (!obj || typeof obj !== 'object') {
    throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `inspectionPlans[${index}] 不是合法对象`)
  }
  const p = obj as Record<string, unknown>
  if (!isNonEmptyString(p.id)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `inspectionPlans[${index}].id 缺失或为空`)
  if (!isNonEmptyString(p.name)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `inspectionPlans[${index}].name 缺失或为空`)
  if (!isNonEmptyString(p.deviceId)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `inspectionPlans[${index}].deviceId 缺失或为空`)
  if (!isNonEmptyString(p.shiftId)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `inspectionPlans[${index}].shiftId 缺失或为空`)
  if (!isStringArray(p.checkItemIds) || p.checkItemIds.length === 0) {
    throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, `inspectionPlans[${index}].checkItemIds 缺失或为空数组`)
  }
  return {
    id: p.id,
    name: p.name,
    deviceId: p.deviceId,
    shiftId: p.shiftId,
    checkItemIds: p.checkItemIds,
    frequency: typeof p.frequency === 'string' ? p.frequency : '每日每班次',
    description: typeof p.description === 'string' ? p.description : '',
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : nowIso(),
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : nowIso(),
  }
}

export function parseAndValidateConfig(raw: string): ConfigPayload {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new BusinessError(ERROR_CODES.IMPORT_JSON_PARSE, `JSON 解析失败：${msg}`)
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, '配置文件顶层必须是对象')
  }
  const root = parsed as Record<string, unknown>
  if (!Array.isArray(root.devices)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, '缺少 devices 数组字段')
  if (!Array.isArray(root.shifts)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, '缺少 shifts 数组字段')
  if (!Array.isArray(root.checkItems)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, '缺少 checkItems 数组字段')
  if (!Array.isArray(root.inspectionPlans)) throw new BusinessError(ERROR_CODES.IMPORT_SCHEMA_ERROR, '缺少 inspectionPlans 数组字段')

  const devices = root.devices.map((d, i) => validateDevice(d, i))
  const shifts = root.shifts.map((s, i) => validateShift(s, i))
  const checkItems = root.checkItems.map((c, i) => validateCheckItem(c, i))
  const inspectionPlans = root.inspectionPlans.map((p, i) => validatePlan(p, i))

  return { devices, shifts, checkItems, inspectionPlans }
}

export function exportConfig(): ConfigPayload {
  const data = db.getData()
  return {
    devices: JSON.parse(JSON.stringify(data.devices)),
    shifts: JSON.parse(JSON.stringify(data.shifts)),
    checkItems: JSON.parse(JSON.stringify(data.checkItems)),
    inspectionPlans: JSON.parse(JSON.stringify(data.inspectionPlans)),
  }
}

function remapIds(
  payload: ConfigPayload,
  existingData: Database,
): {
  payload: ConfigPayload
  idMap: { oldId: string; newId: string; type: string }[]
} {
  const idMap: { oldId: string; newId: string; type: string }[] = []
  const now = nowIso()

  const deviceIdMap = new Map<string, string>()
  for (const d of payload.devices) {
    const newId = genId('DEV_')
    deviceIdMap.set(d.id, newId)
    idMap.push({ oldId: d.id, newId, type: 'device' })
    d.id = newId
    d.createdAt = now
    d.updatedAt = now
  }

  const shiftIdMap = new Map<string, string>()
  for (const s of payload.shifts) {
    const newId = genId('SHIFT_')
    shiftIdMap.set(s.id, newId)
    idMap.push({ oldId: s.id, newId, type: 'shift' })
    s.id = newId
    s.createdAt = now
    s.updatedAt = now
  }

  const checkItemIdMap = new Map<string, string>()
  for (const c of payload.checkItems) {
    const newId = genId('CI_')
    checkItemIdMap.set(c.id, newId)
    idMap.push({ oldId: c.id, newId, type: 'checkItem' })
    c.id = newId
    c.deviceIds = c.deviceIds.map((did) => deviceIdMap.get(did) || did)
    c.createdAt = now
    c.updatedAt = now
  }

  for (const p of payload.inspectionPlans) {
    const newId = genId('PLAN_')
    idMap.push({ oldId: p.id, newId, type: 'plan' })
    p.id = newId
    p.deviceId = deviceIdMap.get(p.deviceId) || p.deviceId
    p.shiftId = shiftIdMap.get(p.shiftId) || p.shiftId
    p.checkItemIds = p.checkItemIds.map((cid) => checkItemIdMap.get(cid) || cid)
    p.createdAt = now
    p.updatedAt = now
  }

  return { payload, idMap }
}

export function precheckConfigImport(
  payload: ConfigPayload,
): ConfigImportPrecheck {
  const existing = db.getData()
  const conflicts: ConfigConflict[] = []
  const missingDeviceRefs: { planId: string; planName: string; deviceId: string }[] = []
  const missingShiftRefs: { planId: string; planName: string; shiftId: string }[] = []
  const missingCheckItemRefs: { planId: string; planName: string; checkItemIds: string[] }[] = []

  const { payload: remapped, idMap } = remapIds(
    JSON.parse(JSON.stringify(payload)),
    existing,
  )

  const importedDeviceIds = new Set(remapped.devices.map((d) => d.id))
  const importedShiftIds = new Set(remapped.shifts.map((s) => s.id))
  const importedCheckItemIds = new Set(remapped.checkItems.map((c) => c.id))

  const existingDeviceByCode = new Map(existing.devices.map((d) => [d.code, d]))
  const originalDeviceIdMap = new Map(idMap.filter((m) => m.type === 'device').map((m) => [m.newId, m.oldId]))

  for (const d of remapped.devices) {
    const originalId = originalDeviceIdMap.get(d.id) || d.id
    const originalImport = payload.devices.find((x) => x.id === originalId)
    const existingDevice = existingDeviceByCode.get(d.code)
    if (existingDevice) {
      conflicts.push({
        type: 'device_code',
        code: d.code,
        existingId: existingDevice.id,
        importedId: d.id,
        existingName: existingDevice.name,
        importedName: originalImport?.name || d.name,
      })
    }
  }

  const allDeviceIds = new Set([...existing.devices.map((d) => d.id), ...importedDeviceIds])
  const allShiftIds = new Set([...existing.shifts.map((s) => s.id), ...importedShiftIds])
  const allCheckItemIds = new Set([...existing.checkItems.map((c) => c.id), ...importedCheckItemIds])

  for (const p of remapped.inspectionPlans) {
    if (!allDeviceIds.has(p.deviceId)) {
      missingDeviceRefs.push({
        planId: p.id,
        planName: p.name,
        deviceId: p.deviceId,
      })
    }
    if (!allShiftIds.has(p.shiftId)) {
      missingShiftRefs.push({
        planId: p.id,
        planName: p.name,
        shiftId: p.shiftId,
      })
    }
    const missing = p.checkItemIds.filter((cid) => !allCheckItemIds.has(cid))
    if (missing.length > 0) {
      missingCheckItemRefs.push({
        planId: p.id,
        planName: p.name,
        checkItemIds: missing,
      })
    }
  }

  const hasErrors =
    missingDeviceRefs.length > 0 ||
    missingShiftRefs.length > 0 ||
    missingCheckItemRefs.length > 0

  return {
    valid: !hasErrors,
    totalDevices: payload.devices.length,
    totalShifts: payload.shifts.length,
    totalCheckItems: payload.checkItems.length,
    totalPlans: payload.inspectionPlans.length,
    conflicts,
    missingDeviceRefs,
    missingShiftRefs,
    missingCheckItemRefs,
  }
}

export function importConfig(
  payload: ConfigPayload,
  options: ConfigImportOptions,
): ConfigImportResult {
  const existing = db.getData()
  const { payload: remapped } = remapIds(
    JSON.parse(JSON.stringify(payload)),
    existing,
  )

  const result: ConfigImportResult = {
    imported: { devices: 0, shifts: 0, checkItems: 0, plans: 0 },
    skipped: { devices: 0, plans: 0 },
    overwritten: { devices: 0 },
  }

  const existingDeviceByCode = new Map(existing.devices.map((d) => [d.code, d]))
  const importedDeviceCodes = new Set(remapped.devices.map((d) => d.code))

  const devicesToWrite = [...existing.devices]
  const deviceImportedMap = new Map<string, Device>()

  for (const d of remapped.devices) {
    const existingDevice = existingDeviceByCode.get(d.code)
    if (existingDevice) {
      if (options.conflictAction === 'SKIP') {
        result.skipped.devices++
        deviceImportedMap.set(d.id, existingDevice)
      } else {
        const idx = devicesToWrite.findIndex((x) => x.id === existingDevice.id)
        if (idx !== -1) {
          const merged: Device = {
            ...d,
            id: existingDevice.id,
            createdAt: existingDevice.createdAt,
            updatedAt: nowIso(),
          }
          devicesToWrite[idx] = merged
          deviceImportedMap.set(d.id, merged)
          result.overwritten.devices++
        }
      }
    } else {
      devicesToWrite.push(d)
      deviceImportedMap.set(d.id, d)
      result.imported.devices++
    }
  }

  const existingShiftByName = new Map(existing.shifts.map((s) => [`${s.name}|${s.type}|${s.startTime}|${s.endTime}`, s]))
  const shiftsToWrite = [...existing.shifts]
  const shiftImportedMap = new Map<string, Shift>()

  for (const s of remapped.shifts) {
    const key = `${s.name}|${s.type}|${s.startTime}|${s.endTime}`
    const existingShift = existingShiftByName.get(key)
    if (existingShift) {
      shiftImportedMap.set(s.id, existingShift)
    } else {
      shiftsToWrite.push(s)
      shiftImportedMap.set(s.id, s)
      result.imported.shifts++
    }
  }

  const existingCheckItemByCode = new Map(existing.checkItems.map((c) => [c.code, c]))
  const checkItemsToWrite = [...existing.checkItems]
  const checkItemImportedMap = new Map<string, CheckItem>()

  for (const c of remapped.checkItems) {
    const existingItem = existingCheckItemByCode.get(c.code)
    if (existingItem) {
      const remappedDeviceIds = c.deviceIds
        .map((did) => deviceImportedMap.get(did)?.id || did)
      const merged: CheckItem = {
        ...c,
        id: existingItem.id,
        deviceIds: remappedDeviceIds,
        createdAt: existingItem.createdAt,
        updatedAt: nowIso(),
      }
      const idx = checkItemsToWrite.findIndex((x) => x.id === existingItem.id)
      if (idx !== -1) {
        checkItemsToWrite[idx] = merged
      }
      checkItemImportedMap.set(c.id, merged)
    } else {
      const remappedDeviceIds = c.deviceIds
        .map((did) => deviceImportedMap.get(did)?.id || did)
      const newItem: CheckItem = {
        ...c,
        deviceIds: remappedDeviceIds,
      }
      checkItemsToWrite.push(newItem)
      checkItemImportedMap.set(c.id, newItem)
      result.imported.checkItems++
    }
  }

  const allDeviceIds = new Set([...existing.devices.map((d) => d.id), ...devicesToWrite.map((d) => d.id)])
  const allShiftIds = new Set([...existing.shifts.map((s) => s.id), ...shiftsToWrite.map((s) => s.id)])
  const allCheckItemIds = new Set([...existing.checkItems.map((c) => c.id), ...checkItemsToWrite.map((c) => c.id)])

  const plansToWrite = [...existing.inspectionPlans]

  for (const p of remapped.inspectionPlans) {
    const resolvedDeviceId = deviceImportedMap.get(p.deviceId)?.id || p.deviceId
    const resolvedShiftId = shiftImportedMap.get(p.shiftId)?.id || p.shiftId
    const resolvedCheckItemIds = p.checkItemIds
      .map((cid) => checkItemImportedMap.get(cid)?.id || cid)

    if (!allDeviceIds.has(resolvedDeviceId) || !allShiftIds.has(resolvedShiftId)) {
      result.skipped.plans++
      continue
    }
    const missingCIs = resolvedCheckItemIds.filter((cid) => !allCheckItemIds.has(cid))
    if (missingCIs.length > 0) {
      result.skipped.plans++
      continue
    }

    const existingPlanByDeviceShift = existing.inspectionPlans.find(
      (ep) => ep.deviceId === resolvedDeviceId && ep.shiftId === resolvedShiftId && ep.name === p.name,
    )

    if (existingPlanByDeviceShift) {
      result.skipped.plans++
      continue
    }

    const newPlan: InspectionPlan = {
      ...p,
      deviceId: resolvedDeviceId,
      shiftId: resolvedShiftId,
      checkItemIds: resolvedCheckItemIds,
    }
    plansToWrite.push(newPlan)
    result.imported.plans++
  }

  const newDb: Database = {
    ...existing,
    devices: devicesToWrite,
    shifts: shiftsToWrite,
    checkItems: checkItemsToWrite,
    inspectionPlans: plansToWrite,
  }
  db.save(newDb)

  return result
}
