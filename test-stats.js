import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DB_FILE = path.resolve(__dirname, 'data', 'db.json')

const API_BASE = 'http://localhost:3001/api'
const SEED_LAST_ORDER_ID = 'ORD_SAMPLE_016'
const EXPECTED_TOTAL_ORDERS = 16

const RUN_ID = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const TEST_USER = `测试脚本_${RUN_ID}`

let exitCode = 0

function req(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path)
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    }
    const req = http.request(opts, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data })
        } catch {
          resolve({ status: res.statusCode, body: data, raw: data })
        }
      })
    })
    req.on('error', reject)
    if (options.body) req.write(JSON.stringify(options.body))
    req.end()
  })
}

async function reqWithRetry(path, options = {}, retries = 10, delayMs = 500) {
  let lastErr
  for (let i = 0; i < retries; i++) {
    try {
      const r = await req(path, options)
      if (r.status < 500) return r
      lastErr = new Error(`HTTP ${r.status}`)
    } catch (e) {
      lastErr = e
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  throw lastErr || new Error('请求失败')
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`  ❌ FAIL: ${msg}`)
    exitCode = 1
  } else {
    console.log(`  ✅ PASS: ${msg}`)
  }
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function section(name) {
  console.log(`\n=== ${name} ===`)
}

async function resetDatabase() {
  section('0. 重置数据库（强制使用最新种子数据）')
  console.log(`  当前 RUN_ID = ${RUN_ID}`)
  console.log(`  DB 文件路径 = ${DB_FILE}`)

  if (fs.existsSync(DB_FILE)) {
    try {
      fs.rmSync(DB_FILE, { force: true })
      console.log('  已删除旧的 db.json')
    } catch (e) {
      console.error(`  ⚠️ 删除 db.json 失败: ${e.message}`)
      console.error('     如果被进程占用，请先停止 npm run dev，再运行测试脚本')
      throw e
    }
  } else {
    console.log('  db.json 不存在，无需删除')
  }

  console.log('  等待后端自动重建数据库（每次请求从磁盘读取）...')
  const r = await reqWithRetry('/stats/summary?user=李主管', {}, 15, 800)
  const orders = r.body.data?.totalOrders ?? 0
  console.log(`  重建完成，当前总开单数 = ${orders}`)
  return r
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║        统计分析功能验证测试（带 DB 重置 + runId）       ║')
  console.log('╚══════════════════════════════════════════════════════╝')

  const today = new Date().toISOString().slice(0, 10)
  const day29 = daysAgo(29)

  const initialResp = await resetDatabase()

  section('1. 种子数据校验：确保 ORD_SAMPLE_016 已加载')
  assert(initialResp.status === 200, 'HTTP 200')
  assert(initialResp.body.success === true, 'success=true')
  assert(
    initialResp.body.data.totalOrders === EXPECTED_TOTAL_ORDERS,
    `总开单数 = ${EXPECTED_TOTAL_ORDERS} (实际: ${initialResp.body.data.totalOrders})，证明新种子已生效`,
  )

  section('2. 默认近30天日期范围 + 数据完整性')
  const r = await req(`/stats/summary?user=李主管`)
  assert(r.status === 200, 'HTTP 200')
  assert(r.body.success === true, 'success=true')
  const s = r.body.data
  assert(s.totalOrders === EXPECTED_TOTAL_ORDERS, `总开单数 = ${EXPECTED_TOTAL_ORDERS} (实际: ${s.totalOrders})`)
  assert(s.deviceCompletionRates.length === 3, `设备数量 = 3 (实际: ${s.deviceCompletionRates.length})`)
  assert(s.shiftAnomalyRates.length === 3, `班次数量 = 3 (实际: ${s.shiftAnomalyRates.length})`)
  assert(s.severityCounts.length === 3, `严重程度等级 = 3 (实际: ${s.severityCounts.length})`)
  assert(s.anomalyTrend.length === 30, `趋势天数 = 30 (实际: ${s.anomalyTrend.length})`)
  assert(s.userRole === 'supervisor', '李主管 → supervisor 视角')

  section('3. 权限隔离：主管全量 vs 操作员仅本人')
  const sup = await req(`/stats/summary?user=李主管`)
  const opZhang = await req(`/stats/summary?user=张工`)
  const opWang = await req(`/stats/summary?user=王工`)
  assert(
    sup.body.data.totalOrders > opZhang.body.data.totalOrders,
    `主管开单数(${sup.body.data.totalOrders}) > 张工开单数(${opZhang.body.data.totalOrders})`,
  )
  assert(opZhang.body.data.userRole === 'operator', '张工 → operator 视角')
  assert(
    opZhang.body.data.totalOrders !== opWang.body.data.totalOrders,
    `不同操作员各自统计(张工: ${opZhang.body.data.totalOrders}, 王工: ${opWang.body.data.totalOrders})`,
  )

  section('4. 日期筛选联动')
  const full = await req(`/stats/summary?user=李主管&dateFrom=${day29}&dateTo=${today}`)
  const narrow = await req(`/stats/summary?user=李主管&dateFrom=${today}&dateTo=${today}`)
  assert(
    full.body.data.totalOrders >= narrow.body.data.totalOrders,
    `全范围开单数(${full.body.data.totalOrders}) >= 单日开单数(${narrow.body.data.totalOrders})`,
  )
  const future = await req(`/stats/summary?user=李主管&dateFrom=2099-01-01&dateTo=2099-12-31`)
  assert(future.body.data.totalOrders === 0, `未来日期无数据 (实际: ${future.body.data.totalOrders})`)
  assert(future.body.data.totalAnomalies === 0, `未来日期异常=0 (实际: ${future.body.data.totalAnomalies})`)
  assert(future.body.data.anomalyTrend.length === 365, `未来趋势覆盖全年 365 天 (实际: ${future.body.data.anomalyTrend.length})`)

  section('5. 图表数据一致性校验')
  const s2 = (await req(`/stats/summary?user=李主管`)).body.data
  const totalSum = s2.deviceCompletionRates.reduce((a, b) => a + b.total, 0)
  assert(totalSum === s2.totalOrders, `设备总开单数之和(${totalSum}) = 汇总总开单数(${s2.totalOrders})`)
  const sevSum = s2.severityCounts.reduce((a, b) => a + b.count, 0)
  assert(sevSum === s2.totalAnomalies, `严重程度数量之和(${sevSum}) = 汇总异常总数(${s2.totalAnomalies})`)
  const trendSum = s2.anomalyTrend.reduce((a, b) => a + b.count, 0)
  assert(trendSum === s2.totalAnomalies, `趋势异常数之和(${trendSum}) = 汇总异常总数(${s2.totalAnomalies})`)
  for (const d of s2.deviceCompletionRates) {
    const expected = d.total > 0 ? Math.round((d.closed / d.total) * 10000) / 100 : 0
    assert(Math.abs(d.rate - expected) < 0.01, `${d.deviceName} 完成率 ${d.rate} ≈ ${expected}`)
  }
  for (const sh of s2.shiftAnomalyRates) {
    const expected = sh.total > 0 ? Math.round((sh.anomaly / sh.total) * 10000) / 100 : 0
    assert(Math.abs(sh.rate - expected) < 0.01, `${sh.shiftName} 异常率 ${sh.rate} ≈ ${expected}`)
  }

  section('6. CSV 导出：BOM + 中文列头 + 数值与图表严格对齐')
  const csvRes = await req(`/stats/csv?user=李主管`)
  const raw = csvRes.raw
  const hasBom = raw.charCodeAt(0) === 0xfeff || raw.startsWith('\uFEFF')
  assert(hasBom, 'CSV 含 UTF-8 BOM')
  const lines = raw.replace(/^\uFEFF/, '').split('\n')
  assert(lines.includes('设备完成率统计'), '含"设备完成率统计"标题')
  assert(lines.includes('班次异常率统计'), '含"班次异常率统计"标题')
  assert(lines.includes('异常严重程度分布'), '含"异常严重程度分布"标题')
  assert(lines.includes('近30天异常趋势'), '含"近30天异常趋势"标题')
  assert(lines.some((l) => l.includes('设备名称,总开单数')), '含中文列头"设备名称,总开单数"')
  const devIdx = lines.findIndex((l) => l === '设备完成率统计')
  let csvDevSum = 0
  for (let i = devIdx + 2; i < lines.length && lines[i] !== ''; i++) {
    const cols = lines[i].split(',')
    const name = cols[0]
    const total = parseInt(cols[1])
    const closed = parseInt(cols[2])
    const rate = parseFloat(cols[3])
    const match = s2.deviceCompletionRates.find((d) => d.deviceName === name)
    assert(match, `CSV 设备 ${name} 存在于图表数据`)
    if (match) {
      assert(match.total === total, `${name} CSV总开单=${total} = 图表=${match.total}`)
      assert(match.closed === closed, `${name} CSV已关闭=${closed} = 图表=${match.closed}`)
      assert(Math.abs(match.rate - rate) < 0.01, `${name} CSV完成率=${rate} ≈ 图表=${match.rate}`)
    }
    csvDevSum += total
  }
  assert(csvDevSum === s2.totalOrders, `CSV设备总开单之和(${csvDevSum}) = 图表汇总(${s2.totalOrders})`)
  const sevIdx = lines.findIndex((l) => l === '异常严重程度分布')
  let csvSevSum = 0
  for (let i = sevIdx + 2; i < lines.length && lines[i] !== ''; i++) {
    csvSevSum += parseInt(lines[i].split(',')[1])
  }
  assert(csvSevSum === s2.totalAnomalies, `CSV严重程度数量之和(${csvSevSum}) = 图表异常总数(${s2.totalAnomalies})`)

  section(`7. 操作日志写入：使用 runId=${RUN_ID} 精确隔离`)
  const beforeResp = await req('/stats/logs')
  const beforeThisRun = beforeResp.body.data.filter((l) => l.user === TEST_USER).length
  assert(beforeThisRun === 0, `写入前本 RUN_ID 无历史日志 (实际: ${beforeThisRun})`)

  await req('/stats/log', {
    method: 'POST',
    body: {
      user: TEST_USER,
      action: 'VIEW',
      filters: { dateFrom: '2026-01-01', dateTo: '2026-01-31', _runId: RUN_ID },
    },
  })
  await req('/stats/log', {
    method: 'POST',
    body: {
      user: TEST_USER,
      action: 'FILTER',
      filters: { dateFrom: '2026-02-01', dateTo: '2026-02-28', _runId: RUN_ID },
    },
  })
  await req('/stats/log', {
    method: 'POST',
    body: {
      user: TEST_USER,
      action: 'EXPORT',
      filters: { dateFrom: '2026-03-01', dateTo: '2026-03-31', _runId: RUN_ID },
    },
  })

  const afterResp = await req('/stats/logs')
  const thisRunLogs = afterResp.body.data.filter((l) => l.user === TEST_USER)
  assert(thisRunLogs.length === 3, `本次 RUN_ID 恰好写入 3 条日志 (实际: ${thisRunLogs.length})`)
  const actions = thisRunLogs.map((l) => l.action).sort()
  assert(actions.join(',') === 'EXPORT,FILTER,VIEW', `三条日志 action 齐全: ${actions.join(',')}`)
  for (const l of thisRunLogs) {
    assert(!!l.id, `日志 ${l.action} 有 id`)
    assert(!!l.timestamp, `日志 ${l.action} 有 timestamp`)
    assert(!!l.filters?.dateFrom, `日志 ${l.action} 有 filters.dateFrom`)
    assert(!!l.filters?.dateTo, `日志 ${l.action} 有 filters.dateTo`)
  }
  const otherLogs = afterResp.body.data.filter((l) => l.user !== TEST_USER)
  console.log(`  (其他历史日志共 ${otherLogs.length} 条，不会影响本次断言)`)

  section('8. 后端校验：必填参数缺失返回 400')
  const bad = await req('/stats/log', { method: 'POST', body: {} })
  assert(bad.status === 400, `缺少必填参数返回 400 (实际: ${bad.status})`)
  assert(!bad.body.success, 'success=false')

  section('9. 数据一致性二次确认：总开单数仍为种子值')
  const finalResp = await req(`/stats/summary?user=李主管`)
  assert(
    finalResp.body.data.totalOrders === EXPECTED_TOTAL_ORDERS,
    `测试结束后总开单数仍 = ${EXPECTED_TOTAL_ORDERS} (实际: ${finalResp.body.data.totalOrders})，证明日志写入未污染主数据`,
  )

  console.log('\n╔══════════════════════════════════════════════════════╗')
  if (exitCode === 0) {
    console.log('║              ✅ 全部测试通过！                         ║')
  } else {
    console.log('║              ❌ 存在失败断言，请查看上方日志            ║')
  }
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`\n提示：再次运行本脚本，会自动删除 db.json 重建种子数据，日志不会污染。`)
  process.exit(exitCode)
}

main().catch((e) => {
  console.error('\n❌ 测试运行异常:', e)
  process.exit(1)
})
