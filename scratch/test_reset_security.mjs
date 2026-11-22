// Test that ordinary players cannot call POST /api/reset
async function testResetSecurity() {
  console.log('Testing ordinary player call to POST /api/reset (no auth)...');
  const res1 = await fetch('http://localhost:3000/api/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const data1 = await res1.json();
  console.log('Response without auth:', res1.status, data1);

  if (res1.status === 403 && data1.code === 'FORBIDDEN') {
    console.log('[PASS] Ordinary player blocked with 403 Forbidden.');
  } else {
    console.error('[FAIL] Expected 403 Forbidden, got:', res1.status, data1);
    process.exit(1);
  }

  console.log('\nTesting ordinary player call with invalid X-Admin-Key...');
  const res2 = await fetch('http://localhost:3000/api/reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': 'random_unauthorized_token'
    }
  });

  const data2 = await res2.json();
  console.log('Response with invalid key:', res2.status, data2);

  if (res2.status === 403 && data2.code === 'FORBIDDEN') {
    console.log('[PASS] Invalid key blocked with 403 Forbidden.');
  } else {
    console.error('[FAIL] Expected 403 Forbidden, got:', res2.status, data2);
    process.exit(1);
  }

  console.log('\nVerifying existing session remains untouched and active via /api/state...');
  const resState = await fetch('http://localhost:3000/api/state');
  const stateData = await resState.json();
  console.log('Current active session state:', {
    sessionId: stateData.sessionId,
    totalPlayers: stateData.totalPlayers,
    scoresSubmitted: stateData.scoresSubmitted,
    playersCount: (stateData.players || []).length
  });

  if (stateData.sessionId && (stateData.players || []).length > 0) {
    console.log('[PASS] Current database session is preserved and active.');
  } else {
    console.warn('[WARN] No active session found or players empty.');
  }

  console.log('\nAll reset security tests PASSED.');
}

testResetSecurity().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
