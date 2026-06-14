import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import StartInspection from '@/pages/StartInspection'
import ExecuteInspection from '@/pages/ExecuteInspection'
import ReviewPage from '@/pages/ReviewPage'
import HistoryPage from '@/pages/HistoryPage'
import ConfigPage from '@/pages/ConfigPage'

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
          <Route path="/config" element={<ConfigPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}
