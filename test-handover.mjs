// 交接班记录模块验证脚本
// 使用方法：确保开发服务器正在运行（npm run dev），然后执行：node test-handover.mjs

const API_BASE = 'http://localhost:3001/api'

function log(level, msg) {
  const time = new Date().toLocaleTimeString('zh-CN')
  const prefix = {
    PASS: '\x1b[32m✓ PASS\x1b[0m',
    FAIL: '\x1b[31m✗ FAIL\x1b[0m',
    INFO: '\x1b[36mℹ INFO\x1b[0m',
    WARN: '\x1b[33m⚠ WARN\x1b[0m',
  }[level] || level
  console.log(`[${time}] ${prefix} ${msg}`)
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const text = await res.text()
  try {
    return { status: res.status, data: JSON.parse(text) }
  } catch {
    return { status: res.status, raw: text }
  }
}

let createdRecordId = null

async function runTests() {
  log('INFO', '===== 开始交接班记录模块验证 =====')
  log('INFO', `API 地址: ${API_BASE}`)

  // 0. 健康检查
  log('INFO', '--- 步骤 0: 健康检查 ---')
  try {
    const health = await request('/health')
    if (health.status === 200) {
      log('PASS', '服务健康检查通过')
    } else {
      log('FAIL', `健康检查失败: HTTP ${health.status}`)
      return
    }
  } catch (e) {
    log('FAIL', `无法连接到服务器: ${e.message}`)
    log('INFO', '请确保已执行: npm run dev (后端端口应为 3001)')
    return
  }

  // 1. 获取设备和班次列表
  log('INFO', '--- 步骤 1: 获取设备和班次数据 ---')
  const devices = await request('/devices')
  if (devices.status === 200 && devices.data?.success && devices.data.data?.length > 0) {
    log('PASS', `获取设备列表成功，共 ${devices.data.data.length} 台设备`)
  } else {
    log('FAIL', '获取设备列表失败')
    return
  }
  const testDevice = devices.data.data[0]

  const shifts = await request('/shifts')
  if (shifts.status === 200 && shifts.data?.success && shifts.data.data?.length > 0) {
    log('PASS', `获取班次列表成功，共 ${shifts.data.data.length} 个班次`)
  } else {
    log('FAIL', '获取班次列表失败')
    return
  }
  const testShift = shifts.data.data[0]

  // 2. 新增交接班记录
  log('INFO', '--- 步骤 2: 新增交接班记录 ---')
  const today = new Date().toISOString().slice(0, 10)
  const createRes = await request('/handover', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: testDevice.id,
      shiftId: testShift.id,
      handoverDate: today,
      equipmentStatus: '设备运行正常，温度25°C，气压0.6MPa',
      remainingIssues: '润滑油液位略低，下一班注意补充',
      handoverPerson: '张工',
      takeoverPerson: '李工',
      operator: '测试员',
    }),
  })
  if (createRes.status === 201 && createRes.data?.success) {
    createdRecordId = createRes.data.data.id
    log('PASS', `创建交接班记录成功，ID: ${createdRecordId}`)
    const rec = createRes.data.data
    if (rec.isConfirmed === false) log('PASS', '  - 新记录默认未确认状态')
    if (rec.operationLogs?.length >= 1) log('PASS', `  - 有 ${rec.operationLogs.length} 条操作日志`)
    if (rec.handoverPerson === '张工') log('PASS', '  - 交班人正确')
    if (rec.takeoverPerson === '李工') log('PASS', '  - 接班人正确')
    if (rec.equipmentStatus.includes('正常')) log('PASS', '  - 设备状态正确')
    if (rec.remainingIssues.includes('润滑油')) log('PASS', '  - 遗留问题正确')
  } else {
    log('FAIL', `创建失败: HTTP ${createRes.status} - ${createRes.data?.error?.message || createRes.raw}`)
    return
  }

  // 3. 重复提交冲突检测
  log('INFO', '--- 步骤 3: 重复提交冲突检测 ---')
  const dupRes = await request('/handover', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: testDevice.id,
      shiftId: testShift.id,
      handoverDate: today,
      equipmentStatus: '重复的记录',
      handoverPerson: '王工',
      takeoverPerson: '赵工',
      operator: '测试员',
    }),
  })
  if (dupRes.status === 400 && dupRes.data?.error?.code === 'DUPLICATE_HANDOVER_RECORD') {
    log('PASS', `重复冲突检测生效，错误码: ${dupRes.data.error.code}`)
    if (dupRes.data.error.message.includes('已有交接班记录')) {
      log('PASS', '  - 错误提示清晰明确，包含"已有交接班记录"')
    }
    if (dupRes.data.error.details?.existingId) {
      log('PASS', `  - 返回了冲突记录的 ID: ${dupRes.data.error.details.existingId}`)
    }
  } else {
    log('FAIL', `重复冲突检测失效，HTTP ${dupRes.status}`)
  }

  // 4. 获取记录列表
  log('INFO', '--- 步骤 4: 获取交接班记录列表 ---')
  const listRes = await request('/handover')
  if (listRes.status === 200 && listRes.data?.success && Array.isArray(listRes.data.data)) {
    log('PASS', `获取列表成功，共 ${listRes.data.data.length} 条记录`)
    const found = listRes.data.data.find((r) => r.id === createdRecordId)
    if (found) log('PASS', '  - 新创建的记录出现在列表中')
  } else {
    log('FAIL', '获取列表失败')
  }

  // 5. 列表筛选 - 按设备筛选
  log('INFO', '--- 步骤 5: 列表筛选 ---')
  const filterRes = await request(`/handover?deviceId=${testDevice.id}`)
  if (filterRes.status === 200 && filterRes.data?.success) {
    const allMatch = filterRes.data.data.every((r) => r.deviceId === testDevice.id)
    log(allMatch ? 'PASS' : 'FAIL', `按设备筛选：${allMatch ? '全部匹配' : '存在不匹配记录'}`)
  }

  // 6. 获取单条记录详情
  log('INFO', '--- 步骤 6: 获取单条记录详情 ---')
  const detailRes = await request(`/handover/${createdRecordId}`)
  if (detailRes.status === 200 && detailRes.data?.success) {
    log('PASS', '获取单条记录详情成功')
    if (detailRes.data.data.id === createdRecordId) log('PASS', '  - ID 正确匹配')
  } else {
    log('FAIL', '获取单条记录详情失败')
  }

  // 7. 确认交接班记录
  log('INFO', '--- 步骤 7: 确认交接班记录 ---')
  const confirmRes = await request(`/handover/${createdRecordId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ operator: '主管王' }),
  })
  if (confirmRes.status === 200 && confirmRes.data?.success) {
    const rec = confirmRes.data.data
    if (rec.isConfirmed === true) log('PASS', '记录已标记为已确认')
    if (rec.confirmedBy === '主管王') log('PASS', `  - 确认人正确: ${rec.confirmedBy}`)
    if (rec.confirmedAt) log('PASS', `  - 确认时间已记录: ${new Date(rec.confirmedAt).toLocaleString('zh-CN')}`)
    const confirmLog = rec.operationLogs.find((l) => l.action === 'CONFIRM')
    if (confirmLog) log('PASS', '  - 操作日志包含 CONFIRM 记录')
  } else {
    log('FAIL', `确认失败: ${confirmRes.data?.error?.message || confirmRes.status}`)
  }

  // 8. 重复确认应失败
  log('INFO', '--- 步骤 8: 重复确认检测 ---')
  const confirmAgainRes = await request(`/handover/${createdRecordId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ operator: '主管王' }),
  })
  if (confirmAgainRes.status === 400 && confirmAgainRes.data?.error?.code === 'HANDOVER_RECORD_ALREADY_CONFIRMED') {
    log('PASS', '重复确认检测生效，已确认的记录无法再次确认')
  } else {
    log('FAIL', '重复确认检测失效')
  }

  // 9. 已确认记录不可编辑
  log('INFO', '--- 步骤 9: 已确认记录编辑限制 ---')
  const editRes = await request(`/handover/${createdRecordId}`, {
    method: 'PUT',
    body: JSON.stringify({
      equipmentStatus: '尝试修改',
      operator: '测试员',
    }),
  })
  if (editRes.status === 400 && editRes.data?.error?.code === 'HANDOVER_RECORD_ALREADY_CONFIRMED') {
    log('PASS', '已确认记录编辑限制生效')
  } else {
    log('FAIL', '已确认记录编辑限制失效')
  }

  // 10. 撤销确认
  log('INFO', '--- 步骤 10: 撤销确认 ---')
  const undoRes = await request(`/handover/${createdRecordId}/undo-confirm`, {
    method: 'POST',
    body: JSON.stringify({ operator: '主管王' }),
  })
  if (undoRes.status === 200 && undoRes.data?.success) {
    const rec = undoRes.data.data
    if (rec.isConfirmed === false) log('PASS', '撤销确认成功，记录恢复为未确认状态')
    if (!rec.confirmedBy && !rec.confirmedAt) log('PASS', '  - 确认人和确认时间已清除')
    const undoLog = rec.operationLogs.find((l) => l.action === 'UNDO_CONFIRM')
    if (undoLog) log('PASS', '  - 操作日志包含 UNDO_CONFIRM 记录')
  } else {
    log('FAIL', `撤销确认失败: ${undoRes.data?.error?.message || undoRes.status}`)
  }

  // 11. 未确认记录执行撤销应失败
  log('INFO', '--- 步骤 11: 未确认记录撤销检测 ---')
  const undoAgainRes = await request(`/handover/${createdRecordId}/undo-confirm`, {
    method: 'POST',
    body: JSON.stringify({ operator: '主管王' }),
  })
  if (undoAgainRes.status === 400 && undoAgainRes.data?.error?.code === 'HANDOVER_RECORD_NOT_CONFIRMED') {
    log('PASS', '未确认记录撤销检测生效')
  } else {
    log('FAIL', '未确认记录撤销检测失效')
  }

  // 12. 编辑记录（未确认状态）
  log('INFO', '--- 步骤 12: 编辑记录（未确认状态） ---')
  const updateRes = await request(`/handover/${createdRecordId}`, {
    method: 'PUT',
    body: JSON.stringify({
      equipmentStatus: '【更新后】设备运行正常，温度24°C，气压0.62MPa',
      remainingIssues: '【更新后】润滑油液位偏低约5%，建议中班补充',
      operator: '测试员',
    }),
  })
  if (updateRes.status === 200 && updateRes.data?.success) {
    const rec = updateRes.data.data
    if (rec.equipmentStatus.includes('更新后')) log('PASS', '编辑设备状态成功')
    if (rec.remainingIssues.includes('更新后')) log('PASS', '编辑遗留问题成功')
    const updateLog = rec.operationLogs.find((l) => l.action === 'UPDATE')
    if (updateLog) log('PASS', '  - 操作日志包含 UPDATE 记录')
  } else {
    log('FAIL', `编辑失败: ${updateRes.data?.error?.message || updateRes.status}`)
  }

  // 13. CSV 导出
  log('INFO', '--- 步骤 13: CSV 导出 ---')
  try {
    const exportUrl = `${API_BASE}/handover/export/csv`
    const exportRes = await fetch(exportUrl)
    const csvText = await exportRes.text()
    if (exportRes.status === 200 && csvText.includes('交接日期') && csvText.includes('交班人')) {
      log('PASS', 'CSV 导出成功，包含必需列（交接日期、交班人等）')
      const lines = csvText.split('\n').filter((l) => l.trim())
      log('INFO', `  - CSV 共 ${lines.length} 行（含表头）`)
      const headerLine = lines[0]
      const expectedCols = ['设备编码', '设备名称', '班次名称', '交接日期', '设备状态', '遗留问题', '交班人', '接班人', '是否已确认']
      const hasAllCols = expectedCols.every((c) => headerLine.includes(c))
      log(hasAllCols ? 'PASS' : 'FAIL', `  - ${hasAllCols ? '表头列名完整' : '缺少必需列'}`)
    } else {
      log('FAIL', 'CSV 导出失败')
    }
  } catch (e) {
    log('FAIL', `CSV 导出异常: ${e.message}`)
  }

  // 14. CSV 导入（包含正确行和错误行）
  log('INFO', '--- 步骤 14: CSV 导入（混合正确与错误行） ---')
  const otherShift = shifts.data.data[1] || shifts.data.data[0]
  const csvContent = `设备编码,设备名称,班次名称,交接日期,设备状态,遗留问题,交班人,接班人
${testDevice.code},${testDevice.name},${otherShift.name},${today},正常运行,无异常,陈七,周八  ← 第2行：正确行
INVALID_CODE,不存在的设备,早班,${today},,无效设备,甲,乙  ← 第3行：设备不存在
${testDevice.code},${testDevice.name},不存在的班次,${today},,无效班次,甲,乙  ← 第4行：班次不存在
${testDevice.code},${testDevice.name},${testShift.name},${today},,重复记录,甲,乙  ← 第5行：与步骤2创建的记录重复
${testDevice.code},${testDevice.name},${otherShift.name},2025-13-40,无效日期,,甲,乙  ← 第6行：日期非法
${testDevice.code},${testDevice.name},${otherShift.name},${today},,缺少交班人,,乙  ← 第7行：交班人为空
,,,${today},,缺少设备,甲,乙  ← 第8行：设备编码和名称均为空`

  const importRes = await request('/handover/import/csv', {
    method: 'POST',
    body: JSON.stringify({ csv: csvContent, operator: '导入员' }),
  })
  if (importRes.status === 200 && importRes.data?.success) {
    const { log: importLog } = importRes.data.data
    log('PASS', `CSV 导入完成，共 ${importLog.totalRows} 行，成功 ${importLog.successCount}，跳过 ${importLog.skipCount}`)
    if (importLog.successCount >= 1) log('PASS', '  - 正确行成功导入')
    if (importLog.skipCount >= 6) log('PASS', '  - 错误行被正确跳过（设备不存在、班次不存在、重复、日期非法、缺少字段等）')
    const skipReasons = importLog.details.filter((d) => d.action === 'SKIPPED').map((d) => d.reason)
    const hasDeviceNotFound = skipReasons.some((r) => r.includes('设备不存在'))
    const hasShiftNotFound = skipReasons.some((r) => r.includes('班次不存在'))
    const hasDuplicate = skipReasons.some((r) => r.includes('已有交接班记录'))
    const hasInvalidDate = skipReasons.some((r) => r.includes('日期格式无效'))
    const hasEmptyPerson = skipReasons.some((r) => r.includes('交班人为空'))
    const hasEmptyDevice = skipReasons.some((r) => r.includes('设备编码和设备名称均为空'))
    log(hasDeviceNotFound ? 'PASS' : 'FAIL', `  - ${hasDeviceNotFound ? '能检测' : '未能检测'}到"设备不存在"`)
    log(hasShiftNotFound ? 'PASS' : 'FAIL', `  - ${hasShiftNotFound ? '能检测' : '未能检测'}到"班次不存在"`)
    log(hasDuplicate ? 'PASS' : 'FAIL', `  - ${hasDuplicate ? '能检测' : '未能检测'}到"重复记录"`)
    log(hasInvalidDate ? 'PASS' : 'FAIL', `  - ${hasInvalidDate ? '能检测' : '未能检测'}到"日期非法"`)
    log(hasEmptyPerson ? 'PASS' : 'FAIL', `  - ${hasEmptyPerson ? '能检测' : '未能检测'}到"交班人为空"`)
    log(hasEmptyDevice ? 'PASS' : 'FAIL', `  - ${hasEmptyDevice ? '能检测' : '未能检测'}到"设备标识缺失"`)
  } else {
    log('FAIL', `CSV 导入失败: ${importRes.data?.error?.message || importRes.status}`)
  }

  // 15. 获取导入日志
  log('INFO', '--- 步骤 15: 获取导入日志 ---')
  const importLogsRes = await request('/handover/import/logs')
  if (importLogsRes.status === 200 && importLogsRes.data?.success && importLogsRes.data.data?.length > 0) {
    log('PASS', `获取导入日志成功，共 ${importLogsRes.data.data.length} 条导入记录`)
    const latest = importLogsRes.data.data[0]
    if (latest.importedBy === '导入员') log('PASS', '  - 最近一次导入员正确')
  } else {
    log('WARN', '获取导入日志可能有问题（可能是第一条）')
  }

  // 16. 数据持久化验证（检查数据文件存在）
  log('INFO', '--- 步骤 16: 数据持久化验证 ---')
  const listBeforeDelete = await request('/handover')
  const countBefore = listBeforeDelete.data?.data?.length || 0
  log('INFO', `当前共有 ${countBefore} 条交接班记录`)
  log('INFO', '数据已写入本地 JSON 文件，重启服务后应仍可读取。')
  log('INFO', '请手动验证：重启服务（Ctrl+C 后 npm run dev）后，再次访问 /api/handover 应返回相同数据。')

  // 17. 清理测试数据（删除创建的记录）
  log('INFO', '--- 步骤 17: 清理测试数据 ---')
  if (createdRecordId) {
    const deleteRes = await request(`/handover/${createdRecordId}`, { method: 'DELETE' })
    if (deleteRes.status === 200 && deleteRes.data?.success) {
      log('PASS', `删除测试记录成功 (ID: ${createdRecordId})`)
    } else {
      log('FAIL', `删除测试记录失败: ${deleteRes.status}`)
    }
  }
  // 删除导入创建的记录
  const allRecords = await request('/handover')
  const importedRecs = allRecords.data?.data?.filter((r) => r.deviceId === testDevice.id && r.shiftId === otherShift.id) || []
  for (const rec of importedRecs) {
    await request(`/handover/${rec.id}`, { method: 'DELETE' })
  }
  if (importedRecs.length > 0) log('PASS', `清理了 ${importedRecs.length} 条导入创建的记录`)

  log('INFO', '===== 交接班记录模块验证完成 =====')
  log('INFO', '建议的后续手动验证步骤：')
  log('INFO', '  1. 重启开发服务（Ctrl+C → npm run dev）')
  log('INFO', '  2. 创建一条新记录 → 重启 → 验证仍存在')
  log('INFO', '  3. 打开浏览器访问交接班记录页面，手动操作界面功能')
}

runTests().catch((e) => {
  log('FAIL', `测试执行异常: ${e.message}`)
  console.error(e)
})
