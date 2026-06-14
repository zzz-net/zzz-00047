import type {
  Device,
  Shift,
  CheckItem,
  InspectionPlan,
  InspectionOrder,
  InspectionItemResult,
  AnomalyRecord,
  ApiResponse,
} from '@/types'

const API_BASE = '/api'

async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const text = await res.text()
  try {
    return JSON.parse(text) as ApiResponse<T>
  } catch {
    return { success: false, error: { code: 'PARSE_ERROR', message: text || '响应解析失败' } }
  }
}

export const devicesApi = {
  list: () => request<Device[]>('/devices'),
  create: (data: Partial<Device>) => request<Device>('/devices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Device>) => request<Device>(`/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request<void>(`/devices/${id}`, { method: 'DELETE' }),
}

export const shiftsApi = {
  list: () => request<Shift[]>('/shifts'),
  create: (data: Partial<Shift>) => request<Shift>('/shifts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Shift>) => request<Shift>(`/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request<void>(`/shifts/${id}`, { method: 'DELETE' }),
}

export const checkItemsApi = {
  list: () => request<CheckItem[]>('/check-items'),
  create: (data: Partial<CheckItem>) => request<CheckItem>('/check-items', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CheckItem>) => request<CheckItem>(`/check-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request<void>(`/check-items/${id}`, { method: 'DELETE' }),
}

export const plansApi = {
  list: () => request<InspectionPlan[]>('/plans'),
  get: (id: string) => request<InspectionPlan>(`/plans/${id}`),
  create: (data: Partial<InspectionPlan>) => request<InspectionPlan>('/plans', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<InspectionPlan>) => request<InspectionPlan>(`/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request<void>(`/plans/${id}`, { method: 'DELETE' }),
}

export interface InspectionListFilters {
  deviceId?: string
  shiftId?: string
  shiftDateFrom?: string
  shiftDateTo?: string
  status?: string
}

export const inspectionsApi = {
  list: (filters?: InspectionListFilters) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v)
      })
    }
    const qs = params.toString()
    return request<InspectionOrder[]>(`/inspections${qs ? `?${qs}` : ''}`)
  },
  get: (id: string) => request<InspectionOrder>(`/inspections/${id}`),
  create: (data: { planId: string; deviceId: string; shiftId: string; shiftDate: string; operator: string }) =>
    request<InspectionOrder>('/inspections', { method: 'POST', body: JSON.stringify(data) }),
  updateResults: (id: string, data: { results: Omit<InspectionItemResult, 'id' | 'checkedAt'>[]; anomalies: Omit<AnomalyRecord, 'id' | 'inspectionOrderId' | 'reportedAt'>[]; operator: string }) =>
    request<InspectionOrder>(`/inspections/${id}/results`, { method: 'PUT', body: JSON.stringify(data) }),
  submit: (id: string, operator: string) =>
    request<InspectionOrder>(`/inspections/${id}/submit`, { method: 'POST', body: JSON.stringify({ operator }) }),
  review: (id: string, supervisor: string, resolution?: string) =>
    request<InspectionOrder>(`/inspections/${id}/review`, { method: 'POST', body: JSON.stringify({ supervisor, resolution }) }),
  close: (id: string, operator: string) =>
    request<InspectionOrder>(`/inspections/${id}/close`, { method: 'POST', body: JSON.stringify({ operator }) }),
  undo: (id: string, operator: string) =>
    request<InspectionOrder>(`/inspections/${id}/undo`, { method: 'POST', body: JSON.stringify({ operator }) }),
}

export const filesApi = {
  uploadEvidence: async (file: File): Promise<ApiResponse<{ path: string }>> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result as string
        const res = await request<{ path: string }>('/evidence', {
          method: 'POST',
          body: JSON.stringify({ fileName: file.name, base64 }),
        })
        resolve(res)
      }
      reader.onerror = () => resolve({ success: false, error: { code: 'READ_ERROR', message: '文件读取失败' } })
      reader.readAsDataURL(file)
    })
  },
  evidenceUrl: (path: string) => `${API_BASE}${path}`,
}

export const exportApi = {
  jsonAll: () => `${API_BASE}/export/json`,
  csvOrders: (filters?: InspectionListFilters) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v)
      })
    }
    const qs = params.toString()
    return `${API_BASE}/export/csv${qs ? `?${qs}` : ''}`
  },
  orderJson: (id: string) => `${API_BASE}/export/order/${id}/json`,
}
