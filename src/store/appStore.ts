import { create } from 'zustand'
import type {
  Device,
  Shift,
  CheckItem,
  InspectionPlan,
  InspectionOrder,
  AppError,
} from '@/types'
import {
  devicesApi,
  shiftsApi,
  checkItemsApi,
  plansApi,
  inspectionsApi,
  type InspectionListFilters,
} from '@/services/api'

interface UiState {
  currentUser: string
  loading: boolean
  lastError: AppError | null
  notification: { type: 'success' | 'error' | 'info'; message: string } | null
}

interface AppState extends UiState {
  devices: Device[]
  shifts: Shift[]
  checkItems: CheckItem[]
  plans: InspectionPlan[]
  orders: InspectionOrder[]
  currentOrder: InspectionOrder | null

  setCurrentUser: (name: string) => void
  setLoading: (v: boolean) => void
  setError: (err: AppError | null) => void
  notify: (type: 'success' | 'error' | 'info', message: string) => void
  clearNotification: () => void

  loadMasterData: () => Promise<void>
  loadOrders: (filters?: InspectionListFilters) => Promise<void>
  loadOrder: (id: string) => Promise<void>
  setCurrentOrder: (order: InspectionOrder | null) => void

  addDevice: (d: Partial<Device>) => Promise<boolean>
  updateDevice: (id: string, d: Partial<Device>) => Promise<boolean>
  removeDevice: (id: string) => Promise<boolean>

  addShift: (s: Partial<Shift>) => Promise<boolean>
  updateShift: (id: string, s: Partial<Shift>) => Promise<boolean>
  removeShift: (id: string) => Promise<boolean>

  addCheckItem: (c: Partial<CheckItem>) => Promise<boolean>
  updateCheckItem: (id: string, c: Partial<CheckItem>) => Promise<boolean>
  removeCheckItem: (id: string) => Promise<boolean>

  addPlan: (p: Partial<InspectionPlan>) => Promise<boolean>
  updatePlan: (id: string, p: Partial<InspectionPlan>) => Promise<boolean>
  removePlan: (id: string) => Promise<boolean>
}

function handleApiResult<T>(
  result: { success: boolean; data?: T; error?: AppError },
  set: (s: Partial<AppState>) => void,
  successMsg?: string,
): T | null {
  if (result.success && result.data !== undefined) {
    if (successMsg) set({ notification: { type: 'success', message: successMsg } })
    return result.data
  }
  set({
    lastError: result.error || { code: 'UNKNOWN', message: '未知错误' },
    notification: {
      type: 'error',
      message: result.error?.message || '操作失败',
    },
  })
  return null
}

const LS_USER_KEY = 'inspection_current_user'
const savedUser = typeof window !== 'undefined' ? localStorage.getItem(LS_USER_KEY) || '张工' : '张工'

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: savedUser,
  loading: false,
  lastError: null,
  notification: null,

  devices: [],
  shifts: [],
  checkItems: [],
  plans: [],
  orders: [],
  currentOrder: null,

  setCurrentUser: (name: string) => {
    localStorage.setItem(LS_USER_KEY, name)
    set({ currentUser: name })
  },
  setLoading: (v: boolean) => set({ loading: v }),
  setError: (err: AppError | null) => set({ lastError: err }),
  notify: (type, message) => set({ notification: { type, message } }),
  clearNotification: () => set({ notification: null }),

  loadMasterData: async () => {
    set({ loading: true })
    try {
      const [dr, sr, cr, pr] = await Promise.all([
        devicesApi.list(),
        shiftsApi.list(),
        checkItemsApi.list(),
        plansApi.list(),
      ])
      set({
        devices: (dr.data as Device[]) || [],
        shifts: (sr.data as Shift[]) || [],
        checkItems: (cr.data as CheckItem[]) || [],
        plans: (pr.data as InspectionPlan[]) || [],
      })
    } finally {
      set({ loading: false })
    }
  },

  loadOrders: async (filters) => {
    set({ loading: true })
    try {
      const r = await inspectionsApi.list(filters)
      set({ orders: (r.data as InspectionOrder[]) || [] })
    } finally {
      set({ loading: false })
    }
  },

  loadOrder: async (id) => {
    set({ loading: true })
    try {
      const r = await inspectionsApi.get(id)
      if (r.success && r.data) {
        set({ currentOrder: r.data })
      } else if (r.error) {
        set({ notification: { type: 'error', message: r.error.message } })
      }
    } finally {
      set({ loading: false })
    }
  },

  setCurrentOrder: (order) => set({ currentOrder: order }),

  addDevice: async (d) => {
    const r = await devicesApi.create(d)
    const ok = handleApiResult(r, set, '设备已创建') !== null
    if (ok) await get().loadMasterData()
    return ok
  },
  updateDevice: async (id, d) => {
    const r = await devicesApi.update(id, d)
    const ok = handleApiResult(r, set, '设备已更新') !== null
    if (ok) await get().loadMasterData()
    return ok
  },
  removeDevice: async (id) => {
    const r = await devicesApi.remove(id)
    const ok = handleApiResult(r, set, '设备已删除') !== null
    if (ok) await get().loadMasterData()
    return ok
  },

  addShift: async (s) => {
    const r = await shiftsApi.create(s)
    const ok = handleApiResult(r, set, '班次已创建') !== null
    if (ok) await get().loadMasterData()
    return ok
  },
  updateShift: async (id, s) => {
    const r = await shiftsApi.update(id, s)
    const ok = handleApiResult(r, set, '班次已更新') !== null
    if (ok) await get().loadMasterData()
    return ok
  },
  removeShift: async (id) => {
    const r = await shiftsApi.remove(id)
    const ok = handleApiResult(r, set, '班次已删除') !== null
    if (ok) await get().loadMasterData()
    return ok
  },

  addCheckItem: async (c) => {
    const r = await checkItemsApi.create(c)
    const ok = handleApiResult(r, set, '检查项已创建') !== null
    if (ok) await get().loadMasterData()
    return ok
  },
  updateCheckItem: async (id, c) => {
    const r = await checkItemsApi.update(id, c)
    const ok = handleApiResult(r, set, '检查项已更新') !== null
    if (ok) await get().loadMasterData()
    return ok
  },
  removeCheckItem: async (id) => {
    const r = await checkItemsApi.remove(id)
    const ok = handleApiResult(r, set, '检查项已删除') !== null
    if (ok) await get().loadMasterData()
    return ok
  },

  addPlan: async (p) => {
    const r = await plansApi.create(p)
    const ok = handleApiResult(r, set, '点检计划已创建') !== null
    if (ok) await get().loadMasterData()
    return ok
  },
  updatePlan: async (id, p) => {
    const r = await plansApi.update(id, p)
    const ok = handleApiResult(r, set, '点检计划已更新') !== null
    if (ok) await get().loadMasterData()
    return ok
  },
  removePlan: async (id) => {
    const r = await plansApi.remove(id)
    const ok = handleApiResult(r, set, '点检计划已删除') !== null
    if (ok) await get().loadMasterData()
    return ok
  },
}))
