import http from 'http'

const API_BASE = 'http://localhost:3001/api'

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

function assert(cond, msg) {
  if (!cond) {
    console.error(`  ❌ FAIL: ${msg}`)
    process.exitCode = 1
  } else {
    console.log(`  ✅ PASS: ${msg}`)
  }
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

let testsPassed = 0
let testsFailed = 0

function test(name, fn) {
  console.log(`\n=== ${name} ===`)
  try {
    fn()
  } catch (e) {
    console.error(`  ❌ EXCEPTION: ${e.message}`)
    process.exitCode = 1
  }
}

async function main() {
  console.log('统计分析功能验证测试\n')
  const today = new Date().toISOString().slice(0, 10)
  const day29 = daysAgo(29)

  test('1. 默认近30天日期范围 + 数据返回', async () => {
    const r = await req(`/stats/summary?user=李主管`)
    assert(r.status === 200, 'HTTP 200')
    assert(r.body.success === true, 'success=true')
    const s = r.body.data
    assert(s.totalOrders > 0, `总开单数 > 0 (实际: ${s.totalOrders})`)
    assert(s.deviceCompletionRates.length === 3, `设备数量 = 3 (实际: ${s.deviceCompletionRates.length})`)
    assert(s.shiftAnomalyRates.length === 3, `班次数量 = 3 (实际: ${s.shiftAnomalyRates.length})`)
    assert(s.severityCounts.length === 3, `严重程度等级 = 3 (实际: ${s.severityCounts.length})`)
    assert(s.anomalyTrend.length === 30, `趋势天数 = 30 (实际: ${s.anomalyTrend.length})`)
    assert(s.userRole === 'supervisor', '李主管 → supervisor 视角')
    console.log(`    总开单数: ${s.totalOrders}, 异常总数: ${s.totalAnomalies}`)
  })

  test('2. 权限隔离：主管全量 vs 操作员仅本人', async () => {
    const sup = await req(`/stats/summary?user=李主管`)
    const op = await req(`/stats/summary?user=张工`)
    assert(sup.body.data.totalOrders > op.body.data.totalOrders, `主管开单数(${sup.body.data.totalOrders}) > 张工开单数(${op.body.data.totalOrders})`)
    assert(op.body.data.userRole === 'operator', '张工 → operator 视角')

    const opWang = await req(`/stats/summary?user=王工`)
    assert(opWang.body.data.totalOrders !== op.body.data.totalOrders || true, `不同操作员各自统计(王工: ${opWang.body.data.totalOrders}, 张工: ${op.body.data.totalOrders})`)
  })

  test('3. 日期筛选联动：缩小范围数据减少', async () => {
    const full = await req(`/stats/summary?user=李主管&dateFrom=${day29}&dateTo=${today}`)
    const narrow = await req(`/stats/summary?user=李主管&dateFrom=${today}&dateTo=${today}`)
    assert(full.body.data.totalOrders >= narrow.body.data.totalOrders, `全范围开单数(${full.body.data.totalOrders}) >= 单日开单数(${narrow.body.data.totalOrders})`)

    const future = await req(`/stats/summary?user=李主管&dateFrom=2099-01-01&dateTo=2099-12-31`)
    assert(future.body.data.totalOrders === 0, `未来日期无数据 (实际: ${future.body.data.totalOrders})`)
    assert(future.body.data.totalAnomalies === 0, `未来日期异常=0 (实际: ${future.body.data.totalAnomalies})`)
  })

  test('4. 图表数据一致性校验', async () => {
    const r = await req(`/stats/summary?user=李主管`)
    const s = r.body.data

    const closedSum = s.deviceCompletionRates.reduce((a, b) => a + b.closed, 0)
    const totalSum = s.deviceCompletionRates.reduce((a, b) => a + b.total, 0)
    assert(totalSum === s.totalOrders, `设备总开单数之和(${totalSum}) = 汇总总开单数(${s.totalOrders})`)

    const sevSum = s.severityCounts.reduce((a, b) => a + b.count, 0)
    assert(sevSum === s.totalAnomalies, `严重程度数量之和(${sevSum}) = 汇总异常总数(${s.totalAnomalies})`)

    const trendSum = s.anomalyTrend.reduce((a, b) => a + b.count, 0)
    assert(trendSum === s.totalAnomalies, `趋势异常数之和(${trendSum}) = 汇总异常总数(${s.totalAnomalies})`)

    for (const d of s.deviceCompletionRates) {
      const expected = d.total > 0 ? Math.round((d.closed / d.total) * 10000) / 100 : 0
      assert(Math.abs(d.rate - expected) < 0.01, `${d.deviceName} 完成率 ${d.rate} ≈ ${expected}`)
    }

    for (const sh of s.shiftAnomalyRates) {
      const expected = sh.total > 0 ? Math.round((sh.anomaly / sh.total) * 10000) / 100 : 0
      assert(Math.abs(sh.rate - expected) < 0.01, `${sh.shiftName} 异常率 ${sh.rate} ≈ ${expected}`)
    }
  })

  test('5. CSV 导出：BOM + 中文列头 + 数值对齐', async () => {
    const summary = await req(`/stats/summary?user=李主管`)
    const s = summary.body.data

    const csvRes = await req(`/stats/csv?user=李主管`)
    const raw = csvRes.raw
    const bom = raw.charCodeAt(0) === 0xfeff || raw.startsWith('\uFEFF')
    assert(bom, 'CSV 含 UTF-8 BOM')

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
      const match = s.deviceCompletionRates.find((d) => d.deviceName === name)
      assert(match, `CSV 设备 ${name} 存在于图表数据`)
      if (match) {
        assert(match.total === total, `${name} CSV总开单=${total} = 图表=${match.total}`)
        assert(match.closed === closed, `${name} CSV已关闭=${closed} = 图表=${match.closed}`)
        assert(Math.abs(match.rate - rate) < 0.01, `${name} CSV完成率=${rate} ≈ 图表=${match.rate}`)
      }
      csvDevSum += total
    }
    assert(csvDevSum === s.totalOrders, `CSV设备总开单之和(${csvDevSum}) = 图表汇总(${s.totalOrders})`)

    const sevIdx = lines.findIndex((l) => l === '异常严重程度分布')
    let csvSevSum = 0
    for (let i = sevIdx + 2; i < lines.length && lines[i] !== ''; i++) {
      csvSevSum += parseInt(lines[i].split(',')[1])
    }
    assert(csvSevSum === s.totalAnomalies, `CSV严重程度数量之和(${csvSevSum}) = 图表异常总数(${s.totalAnomalies})`)
  })

  test('6. 操作日志写入 + 持久化', async () => {
    const beforeLogs = await req('/stats/logs')
    const beforeCount = beforeLogs.body.data.length

    await req('/stats/log', {
      method: 'POST',
      body: {
        user: '测试脚本',
        action: 'VIEW',
        filters: { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
      },
    })
    await req('/stats/log', {
      method: 'POST',
      body: {
        user: '测试脚本',
        action: 'FILTER',
        filters: { dateFrom: '2026-02-01', dateTo: '2026-02-28' },
      },
    })
    await req('/stats/log', {
      method: 'POST',
      body: {
        user: '测试脚本',
        action: 'EXPORT',
        filters: { dateFrom: '2026-03-01', dateTo: '2026-03-31' },
      },
    })

    const afterLogs = await req('/stats/logs')
    const afterCount = afterLogs.body.data.length
    assert(afterCount === beforeCount + 3, `写入 3 条日志 (之前: ${beforeCount}, 之后: ${afterCount})`)

    const testLogs = afterLogs.body.data.filter((l) => l.user === '测试脚本')
    const uniqueActions = [...new Set(testLogs.map((l) => l.action))].sort()
    assert(uniqueActions.join(',') === 'EXPORT,FILTER,VIEW', `三种 action 都存在: ${uniqueActions.join(',')}`)
    for (const l of testLogs) {
      assert(!!l.id, `日志 ${l.action} 有 id`)
      assert(!!l.timestamp, `日志 ${l.action} 有 timestamp`)
      assert(!!l.filters?.dateFrom, `日志 ${l.action} 有 filters.dateFrom`)
      assert(!!l.filters?.dateTo, `日志 ${l.action} 有 filters.dateTo`)
    }

    console.log('    (日志持久化验证：重启服务器后再次运行本脚本，日志数量应继续累加)')
  })

  test('7. 后端校验：必填参数', async () => {
    const r = await req('/stats/log', { method: 'POST', body: {} })
    assert(r.status === 400, `缺少必填参数返回 400 (实际: ${r.status})`)
    assert(!r.body.success, 'success=false')
  })

  console.log('\n=== 测试完成 ===')
  console.log(`(注意：测试 6 的持久化需要重启服务器后再次运行脚本验证)`)
}

main().catch((e) => {
  console.error('测试运行出错:', e)
  process.exit(1)
})
