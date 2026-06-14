const BASE = 'http://localhost:3001/api'
let passed = 0
let failed = 0

function assert(condition, msg) {
  if (condition) {
    passed++
    console.log(`  PASS: ${msg}`)
  } else {
    failed++
    console.error(`  FAIL: ${msg}`)
  }
  return condition
}

async function json(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  return res.json()
}

async function testSkipNoDuplicate() {
  console.log('\n=== Test 1: SKIP conflict should NOT duplicate devices ===')

  const cr = await json('/backups', { method: 'POST', body: JSON.stringify({ note: 'skip-test' }) })
  if (!assert(cr.success, 'Create backup for test')) return
  const backupId = cr.data.id
  const backupName = cr.data.name

  const before = await json('/devices')
  if (!assert(before.success, 'GET /devices succeeds')) return
  const beforeDevices = before.data
  const beforeCodes = beforeDevices.map((d) => d.code)
  console.log(`  Devices before restore: ${beforeDevices.length} — codes: ${beforeCodes.join(', ')}`)

  const rr = await json(`/backups/${backupId}/restore`, {
    method: 'POST',
    body: JSON.stringify({ options: { conflictAction: 'SKIP' } }),
  })
  if (!assert(rr.success, 'Restore succeeds')) return
  console.log(`  Restore result: skipped=${rr.data.skipped.devices}, overwritten=${rr.data.overwritten.devices}`)

  const after = await json('/devices')
  if (!assert(after.success, 'GET /devices after restore succeeds')) return
  const afterDevices = after.data
  const afterCodes = afterDevices.map((d) => d.code)
  console.log(`  Devices after restore: ${afterDevices.length} — codes: ${afterCodes.join(', ')}`)

  assert(
    afterDevices.length === beforeDevices.length,
    `Device count unchanged: ${afterDevices.length} === ${beforeDevices.length}`,
  )

  const uniqueCodes = new Set(afterCodes)
  assert(
    uniqueCodes.size === afterCodes.length,
    `No duplicate device codes: ${uniqueCodes.size} unique === ${afterCodes.length} total`,
  )

  assert(
    beforeCodes.every((c) => afterCodes.includes(c)),
    'All original device codes still present',
  )

  const snapshotId = rr.data.snapshotBackupId
  if (snapshotId) {
    await json(`/backups/${snapshotId}`, { method: 'DELETE' })
  }
  await json(`/backups/${backupId}`, { method: 'DELETE' })
  console.log('  Cleanup done')
}

async function testCorruptBackupRejected() {
  console.log('\n=== Test 2: Corrupt backup must be rejected, db.json untouched ===')

  const before = await json('/devices')
  const beforeCount = before.data.length

  const rr = await json(`/backups/BK_CORRUPT_FAKED/restore`, {
    method: 'POST',
    body: JSON.stringify({ options: { conflictAction: 'SKIP' } }),
  })
  assert(!rr.success, 'Restore of non-existent backup returns failure')
  assert(rr.error && rr.error.code === 'BACKUP_CORRUPTED', `Error code is BACKUP_CORRUPTED: ${rr.error?.code}`)

  const after = await json('/devices')
  assert(
    after.data.length === beforeCount,
    `db.json untouched: ${after.data.length} === ${beforeCount}`,
  )
}

async function testDeleteBackup() {
  console.log('\n=== Test 3: Delete backup ===')

  const cr = await json('/backups', { method: 'POST', body: JSON.stringify({ note: 'delete-test' }) })
  if (!assert(cr.success, 'Create backup for delete test')) return
  const backupId = cr.data.id

  const dl = await json(`/backups/${backupId}`, { method: 'DELETE' })
  assert(dl.success, 'Delete backup succeeds')

  const bl = await json('/backups')
  const found = bl.data.some((b) => b.id === backupId)
  assert(!found, 'Deleted backup no longer in list')
}

async function testBackupRestoreRoundtrip() {
  console.log('\n=== Test 4: Full roundtrip — backup -> modify -> restore -> verify ===')

  const cr = await json('/backups', { method: 'POST', body: JSON.stringify({ note: 'roundtrip-test' }) })
  if (!assert(cr.success, 'Create backup for roundtrip')) return
  const backupId = cr.data.id

  const origDevices = await json('/devices')
  const origCodes = origDevices.data.map((d) => d.code)
  const origCount = origDevices.data.length

  const addRes = await json('/devices', {
    method: 'POST',
    body: JSON.stringify({
      name: 'TEST-ROUNDTRIP',
      code: 'RND-001',
      location: 'test',
      description: 'temp device for roundtrip',
    }),
  })
  if (!assert(addRes.success, 'Added temp device RND-001')) return

  const midDevices = await json('/devices')
  assert(midDevices.data.length === origCount + 1, `Device count increased by 1: ${midDevices.data.length}`)

  const rr = await json(`/backups/${backupId}/restore`, {
    method: 'POST',
    body: JSON.stringify({ options: { conflictAction: 'SKIP' } }),
  })
  if (!assert(rr.success, 'Restore from roundtrip backup succeeds')) return

  const afterDevices = await json('/devices')
  const afterCodes = afterDevices.data.map((d) => d.code)
  assert(
    afterCodes.length === origCount,
    `Device count back to original: ${afterCodes.length} === ${origCount}`,
  )
  assert(
    !afterCodes.includes('RND-001'),
    'Temp device RND-001 no longer present after restore',
  )
  assert(
    origCodes.every((c) => afterCodes.includes(c)),
    'All original device codes present after restore',
  )

  const uniqueCodes = new Set(afterCodes)
  assert(
    uniqueCodes.size === afterCodes.length,
    `No duplicate device codes after roundtrip: ${uniqueCodes.size} unique === ${afterCodes.length} total`,
  )

  const snapshotId = rr.data.snapshotBackupId
  if (snapshotId) {
    await json(`/backups/${snapshotId}`, { method: 'DELETE' })
  }
  await json(`/backups/${backupId}`, { method: 'DELETE' })
  console.log('  Cleanup done')
}

async function testRestoreWithOverwriteConflict() {
  console.log('\n=== Test 5: OVERWRITE conflict should replace existing device data ===')

  const cr = await json('/backups', { method: 'POST', body: JSON.stringify({ note: 'overwrite-test' }) })
  if (!assert(cr.success, 'Create backup for overwrite test')) return
  const backupId = cr.data.id

  const origDevices = await json('/devices')
  const origFirst = origDevices.data[0]
  const origName = origFirst.name

  const updateRes = await json(`/devices/${origFirst.id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: 'MODIFIED-NAME', code: origFirst.code }),
  })
  if (!assert(updateRes.success, 'Modified first device name')) return

  const rr = await json(`/backups/${backupId}/restore`, {
    method: 'POST',
    body: JSON.stringify({ options: { conflictAction: 'OVERWRITE' } }),
  })
  if (!assert(rr.success, 'Restore with OVERWRITE succeeds')) return
  assert(rr.data.overwritten.devices >= 1, `At least 1 device overwritten: ${rr.data.overwritten.devices}`)

  const afterDevices = await json('/devices')
  const restored = afterDevices.data.find((d) => d.code === origFirst.code)
  assert(
    restored && restored.name === origName,
    `Device name restored to original "${origName}" (was "MODIFIED-NAME")`,
  )

  const uniqueCodes = new Set(afterDevices.data.map((d) => d.code))
  assert(
    uniqueCodes.size === afterDevices.data.length,
    `No duplicate device codes: ${uniqueCodes.size} unique === ${afterDevices.data.length} total`,
  )

  const snapshotId = rr.data.snapshotBackupId
  if (snapshotId) {
    await json(`/backups/${snapshotId}`, { method: 'DELETE' })
  }
  await json(`/backups/${backupId}`, { method: 'DELETE' })
  console.log('  Cleanup done')
}

async function main() {
  console.log('Backup/Restore E2E Test Suite')
  console.log('='.repeat(50))

  try {
    await testSkipNoDuplicate()
    await testCorruptBackupRejected()
    await testDeleteBackup()
    await testBackupRestoreRoundtrip()
    await testRestoreWithOverwriteConflict()
  } catch (err) {
    console.error('UNEXPECTED ERROR:', err)
    failed++
  }

  console.log('\n' + '='.repeat(50))
  console.log(`Results: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
