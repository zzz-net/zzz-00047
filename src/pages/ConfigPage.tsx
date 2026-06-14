import { useEffect, useState, type Key } from 'react'
import { useAppStore } from '@/store/appStore'
import type { Device, Shift, CheckItem, InspectionPlan, ShiftType } from '@/types'
import {
  Settings,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Cog,
  Clock,
  ListChecks,
  ClipboardList,
} from 'lucide-react'

type TabType = 'devices' | 'shifts' | 'items' | 'plans'

export default function ConfigPage() {
  const [tab, setTab] = useState<TabType>('devices')
  const store = useAppStore()
  const { loadMasterData } = store

  useEffect(() => {
    loadMasterData()
  }, [loadMasterData])

  const tabs: { key: TabType; label: string; icon: typeof Cog }[] = [
    { key: 'devices', label: '设备管理', icon: Cog },
    { key: 'shifts', label: '班次管理', icon: Clock },
    { key: 'items', label: '检查项管理', icon: ListChecks },
    { key: 'plans', label: '点检计划', icon: ClipboardList },
  ]

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === key
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-white text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'devices' && <DevicesPanel />}
      {tab === 'shifts' && <ShiftsPanel />}
      {tab === 'items' && <CheckItemsPanel />}
      {tab === 'plans' && <PlansPanel />}
    </div>
  )
}

function DevicesPanel() {
  const { devices, addDevice, removeDevice, updateDevice } = useAppStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', location: '', description: '' })

  const handleAdd = async () => {
    if (!form.name || !form.code) return
    const ok = await addDevice(form)
    if (ok) {
      setForm({ name: '', code: '', location: '', description: '' })
      setAdding(false)
    }
  }

  const handleUpdate = async (id: string) => {
    const ok = await updateDevice(id, form)
    if (ok) setEditing(null)
  }

  const startEdit = (d: Device) => {
    setForm({ name: d.name, code: d.code, location: d.location, description: d.description })
    setEditing(d.id)
  }

  return (
    <ConfigSection title="设备列表" onAdd={() => { setAdding(true); setForm({ name: '', code: '', location: '', description: '' }) }}>
      {adding && (
        <ItemForm
          form={form}
          setForm={setForm}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
          fields={[
            { key: 'name', label: '名称 *' },
            { key: 'code', label: '编码 *' },
            { key: 'location', label: '位置' },
            { key: 'description', label: '描述' },
          ]}
        />
      )}
      {devices.map((d) => (
        <div key={d.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition">
          {editing === d.id ? (
            <ItemForm
              form={form}
              setForm={setForm}
              onSave={() => handleUpdate(d.id)}
              onCancel={() => setEditing(null)}
              fields={[
                { key: 'name', label: '名称 *' },
                { key: 'code', label: '编码 *' },
                { key: 'location', label: '位置' },
                { key: 'description', label: '描述' },
              ]}
              inline
            />
          ) : (
            <>
              <div>
                <p className="font-semibold text-slate-900">{d.name}</p>
                <p className="text-xs text-slate-500">{d.code} · {d.location}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(d)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => removeDevice(d.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </ConfigSection>
  )
}

function ShiftsPanel() {
  const { shifts, addShift, removeShift, updateShift } = useAppStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'MORNING' as ShiftType, startTime: '08:00', endTime: '16:00', description: '' })

  const handleAdd = async () => {
    if (!form.name) return
    const ok = await addShift(form)
    if (ok) {
      setForm({ name: '', type: 'MORNING' as ShiftType, startTime: '08:00', endTime: '16:00', description: '' })
      setAdding(false)
    }
  }

  const handleUpdate = async (id: string) => {
    const ok = await updateShift(id, form)
    if (ok) setEditing(null)
  }

  const startEdit = (s: Shift) => {
    setForm({ name: s.name, type: s.type, startTime: s.startTime, endTime: s.endTime, description: s.description })
    setEditing(s.id)
  }

  const typeLabels = { MORNING: '早班', AFTERNOON: '中班', NIGHT: '夜班' }

  return (
    <ConfigSection title="班次列表" onAdd={() => { setAdding(true); setForm({ name: '', type: 'MORNING' as ShiftType, startTime: '08:00', endTime: '16:00', description: '' }) }}>
      {adding && (
        <div className="p-4 bg-slate-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="名称 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-200">取消</button>
            <button onClick={handleAdd} className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">保存</button>
          </div>
        </div>
      )}
      {shifts.map((s) => (
        <div key={s.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition">
          {editing === s.id ? (
            <div className="p-4 bg-slate-50 w-full space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-200">取消</button>
                <button onClick={() => handleUpdate(s.id)} className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">保存</button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="font-semibold text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500">{typeLabels[s.type]} · {s.startTime}-{s.endTime}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(s)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => removeShift(s.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            </>
          )}
        </div>
      ))}
    </ConfigSection>
  )
}

function CheckItemsPanel() {
  const { checkItems, addCheckItem, removeCheckItem, updateCheckItem, devices } = useAppStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', category: '', description: '', standard: '', deviceIds: [] as string[] })

  const handleAdd = async () => {
    if (!form.name || !form.code) return
    const ok = await addCheckItem(form)
    if (ok) {
      setForm({ name: '', code: '', category: '', description: '', standard: '', deviceIds: [] })
      setAdding(false)
    }
  }

  const handleUpdate = async (id: string) => {
    const ok = await updateCheckItem(id, form)
    if (ok) setEditing(null)
  }

  const startEdit = (c: CheckItem) => {
    setForm({ name: c.name, code: c.code, category: c.category, description: c.description, standard: c.standard, deviceIds: c.deviceIds })
    setEditing(c.id)
  }

  const toggleDevice = (devId: string) => {
    setForm((prev) => ({
      ...prev,
      deviceIds: prev.deviceIds.includes(devId) ? prev.deviceIds.filter((x) => x !== devId) : [...prev.deviceIds, devId],
    }))
  }

  const itemForm = (isEdit: boolean) => (
    <div className="p-4 bg-slate-50 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="名称 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input placeholder="编码 *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input placeholder="分类" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input placeholder="检查标准" value={form.standard} onChange={(e) => setForm({ ...form, standard: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <input placeholder="描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <div>
        <p className="text-sm text-slate-600 mb-1">适用设备</p>
        <div className="flex flex-wrap gap-2">
          {devices.map((d) => (
            <button key={d.id} onClick={() => toggleDevice(d.id)} className={`px-3 py-1 rounded-lg text-xs font-medium transition ${form.deviceIds.includes(d.id) ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-blue-50'}`}>
              {d.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => { setAdding(false); setEditing(null) }} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-200">取消</button>
        <button onClick={isEdit ? () => handleUpdate(editing!) : handleAdd} className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">保存</button>
      </div>
    </div>
  )

  return (
    <ConfigSection title="检查项列表" onAdd={() => { setAdding(true); setForm({ name: '', code: '', category: '', description: '', standard: '', deviceIds: [] }) }}>
      {adding && itemForm(false)}
      {checkItems.map((c) => (
        <div key={c.id} className="p-4 hover:bg-slate-50 transition">
          {editing === c.id ? (
            itemForm(true)
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{c.name} <span className="text-xs text-slate-400 font-normal">{c.code}</span></p>
                <p className="text-xs text-slate-500">{c.category} · {c.standard}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.deviceIds.map((did) => {
                    const d = devices.find((x) => x.id === did)
                    return <span key={did} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">{d?.name || did}</span>
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(c)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => removeCheckItem(c.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      ))}
    </ConfigSection>
  )
}

function PlansPanel() {
  const { plans, addPlan, removePlan, updatePlan, devices, shifts, checkItems } = useAppStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', deviceId: '', shiftId: '', checkItemIds: [] as string[], frequency: '每日每班次', description: '' })

  const handleAdd = async () => {
    if (!form.name || !form.deviceId || !form.shiftId || form.checkItemIds.length === 0) return
    const ok = await addPlan(form)
    if (ok) {
      setForm({ name: '', deviceId: '', shiftId: '', checkItemIds: [], frequency: '每日每班次', description: '' })
      setAdding(false)
    }
  }

  const handleUpdate = async (id: string) => {
    const ok = await updatePlan(id, form)
    if (ok) setEditing(null)
  }

  const startEdit = (p: InspectionPlan) => {
    setForm({ name: p.name, deviceId: p.deviceId, shiftId: p.shiftId, checkItemIds: p.checkItemIds, frequency: p.frequency, description: p.description })
    setEditing(p.id)
  }

  const toggleCheckItem = (ciId: string) => {
    setForm((prev) => ({
      ...prev,
      checkItemIds: prev.checkItemIds.includes(ciId) ? prev.checkItemIds.filter((x) => x !== ciId) : [...prev.checkItemIds, ciId],
    }))
  }

  const selectedDev = devices.find((d) => d.id === form.deviceId)
  const availableItems = selectedDev ? checkItems.filter((c) => c.deviceIds.includes(form.deviceId)) : checkItems

  const planForm = (isEdit: boolean) => (
    <div className="p-4 bg-slate-50 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="计划名称 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value, checkItemIds: [] })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">选择设备 *</option>
          {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">选择班次 *</option>
          {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input placeholder="频次" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <p className="text-sm text-slate-600 mb-1">检查项 *</p>
        <div className="flex flex-wrap gap-2">
          {availableItems.map((c) => (
            <button key={c.id} onClick={() => toggleCheckItem(c.id)} className={`px-3 py-1 rounded-lg text-xs font-medium transition ${form.checkItemIds.includes(c.id) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-indigo-50'}`}>
              {c.name}
            </button>
          ))}
          {availableItems.length === 0 && <span className="text-xs text-slate-400">请先选择设备或创建检查项</span>}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => { setAdding(false); setEditing(null) }} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-200">取消</button>
        <button onClick={isEdit ? () => handleUpdate(editing!) : handleAdd} className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">保存</button>
      </div>
    </div>
  )

  return (
    <ConfigSection title="点检计划列表" onAdd={() => { setAdding(true); setForm({ name: '', deviceId: '', shiftId: '', checkItemIds: [], frequency: '每日每班次', description: '' }) }}>
      {adding && planForm(false)}
      {plans.map((p) => {
        const dev = devices.find((d) => d.id === p.deviceId)
        const shift = shifts.find((s) => s.id === p.shiftId)
        return (
          <div key={p.id} className="p-4 hover:bg-slate-50 transition">
            {editing === p.id ? (
              planForm(true)
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{dev?.name} · {shift?.name} · {p.frequency}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.checkItemIds.map((ciId) => {
                      const ci = checkItems.find((c) => c.id === ciId)
                      return <span key={ciId} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded">{ci?.name || ciId}</span>
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(p)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => removePlan(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </ConfigSection>
  )
}

function ConfigSection({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-900">{title}</h3>
        <button onClick={onAdd} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition shadow-sm">
          <Plus className="w-4 h-4" />
          新增
        </button>
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  )
}

function ItemForm<T extends Record<string, string>>({ form, setForm, onSave, onCancel, fields, inline }: {
  form: T
  setForm: React.Dispatch<React.SetStateAction<T>>
  onSave: () => void
  onCancel: () => void
  fields: { key: string; label: string }[]
  inline?: boolean
}) {
  return (
    <div className={`p-4 bg-slate-50 ${inline ? '' : 'space-y-3'}`}>
      <div className={`grid ${inline ? 'grid-cols-2' : 'grid-cols-2'} gap-3`}>
        {fields.map(({ key, label }) => (
          <input
            key={key}
            placeholder={label}
            value={form[key as keyof T] || ''}
            onChange={(e) => setForm({ ...form, [key as string]: e.target.value } as T)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ))}
      </div>
      <div className="flex gap-2 justify-end mt-3">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-200">取消</button>
        <button onClick={onSave} className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">保存</button>
      </div>
    </div>
  )
}
