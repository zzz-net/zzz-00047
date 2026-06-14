import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  ClipboardList,
  Settings,
  PlayCircle,
  CheckSquare,
  Search,
  FileSpreadsheet,
  User,
  Bell,
  X,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useEffect, useState } from 'react'

const navItems = [
  { to: '/', label: '工作台', icon: ClipboardList },
  { to: '/start', label: '开始点检', icon: PlayCircle },
  { to: '/execute', label: '执行点检', icon: CheckSquare },
  { to: '/review', label: '主管复核', icon: FileSpreadsheet },
  { to: '/history', label: '历史查询', icon: Search },
  { to: '/config', label: '计划配置', icon: Settings },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const notification = useAppStore((s) => s.notification)
  const clearNotification = useAppStore((s) => s.clearNotification)
  const currentUser = useAppStore((s) => s.currentUser)
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const location = useLocation()
  const [userEdit, setUserEdit] = useState(false)
  const [userName, setUserName] = useState(currentUser)

  useEffect(() => {
    if (notification) {
      const t = setTimeout(clearNotification, 4000)
      return () => clearTimeout(t)
    }
  }, [notification, clearNotification])

  const pageTitle = navItems.find((n) => n.to === location.pathname)?.label || '设备点检工作台'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">离线设备点检工作台</h1>
              <p className="text-xs text-slate-500">{pageTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {userEdit ? (
              <div className="flex items-center gap-2">
                <input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="px-3 py-1 text-sm border border-slate-300 rounded-lg w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入当前用户"
                />
                <button
                  onClick={() => {
                    if (userName.trim()) {
                      setCurrentUser(userName.trim())
                      setUserEdit(false)
                    }
                  }}
                  className="text-sm px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  确认
                </button>
                <button
                  onClick={() => {
                    setUserName(currentUser)
                    setUserEdit(false)
                  }}
                  className="text-sm px-3 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setUserEdit(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
              >
                <User className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">{currentUser}</span>
                <span className="text-xs text-slate-400">点击切换</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <nav className="mb-6">
          <ul className="flex flex-wrap gap-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 scale-[1.02]'
                        : 'bg-white text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {notification && (
          <div
            className={`mb-4 p-4 rounded-xl shadow-lg flex items-start gap-3 border animate-[fadeIn_0.2s_ease] ${
              notification.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-900'
                : notification.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <Bell className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium flex-1 whitespace-pre-wrap">{notification.message}</p>
            <button onClick={clearNotification} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <main>{children}</main>
      </div>
    </div>
  )
}
