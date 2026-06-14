import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import StartInspection from '@/pages/StartInspection'
import ExecuteInspection from '@/pages/ExecuteInspection'
import ReviewPage from '@/pages/ReviewPage'
import HistoryPage from '@/pages/HistoryPage'
import ConfigPage from '@/pages/ConfigPage'
import StatsPage from '@/pages/StatsPage'
import BackupPage from '@/pages/BackupPage'
import MaintenancePage from '@/pages/MaintenancePage'
import HandoverPage from '@/pages/HandoverPage'

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/start" element={<StartInspection />} />
          <Route path="/execute" element={<ExecuteInspection />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/handover" element={<HandoverPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/backup" element={<BackupPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}
