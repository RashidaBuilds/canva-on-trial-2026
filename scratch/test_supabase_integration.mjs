import { getSupabaseClient, registerPlayerDB, submitScoreDB, getGameStateDB, resetGameSessionDB } from '../api/lib/supabase.js';

async function runIntegrationTest() {
  console.log('========================================================');
  console.log('CANVA ON TRIAL 2026 - SUPABASE INTEGRATION TEST SUITE');
  console.log('========================================================\n');

  let supabase;
  try {
    supabase = getSupabaseClient();
    console.log('[STEP 1] Supabase client initialized successfully.');
  } catch (err) {
    console.error('[FAIL] Supabase initialization failed:', err.message);
    process.exit(1);
  }

  // 1. Check if tables exist
  console.log('[STEP 2] Verifying database schema in Supabase...');
  const { error: sessionCheckErr } = await supabase.from('game_sessions').select('*').limit(1);
  if (sessionCheckErr && sessionCheckErr.code === 'PGRST205') {
    console.warn('\n[ACTION REQUIRED] The database tables have not been created yet in Supabase.');
    console.warn('Please run the complete SQL script in supabase/schema.sql in your Supabase SQL Editor.\n');
    console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/wzqywjtrqdxdnizuwlhn');
    console.log('2. Click on "SQL Editor" in the left sidebar.');
    console.log('3. Click "New query", paste the contents of supabase/schema.sql, and click "Run".');
    console.log('4. Once run, re-run this integration test!\n');
    return false;
  }

  console.log('[PASS] Database schema found in Supabase.\n');

  // 2. Clean session reset before test
  console.log('[STEP 3] Resetting any existing game session for a clean test...');
  await resetGameSessionDB();
  console.log('[PASS] Session cleanly reset.\n');

  // 3. Register Player 1 (High Scorer - James)
  console.log('[STEP 4] Registering Player 1: James (High score target: 950 pts)...');
  const reqId1 = 'req_test_james_' + Date.now();
  const res1 = await registerPlayerDB('James', reqId1, 'client_james');
  console.log('James Join Response:', {
    status: res1.status,
    sessionId: res1.sessionId,
    rowIndex: res1.rowIndex,
    lobbyStartTime: res1.lobbyStartTime
  });

  if (res1.status !== 'success') {
    console.error('[FAIL] Failed to register James:', res1);
    return false;
  }
  const sessionId = res1.sessionId;

  // 4. Register Player 2 (Low Scorer - Sarah)
  console.log('\n[STEP 5] Registering Player 2: Sarah (Low score target: 210 pts)...');
  const reqId2 = 'req_test_sarah_' + Date.now();
  const res2 = await registerPlayerDB('Sarah', reqId2, 'client_sarah');
  console.log('Sarah Join Response:', {
    status: res2.status,
    rowIndex: res2.rowIndex
  });

  if (res2.status !== 'success') {
    console.error('[FAIL] Failed to register Sarah:', res2);
    return false;
  }

  // 5. Register Player 3 (Zero Scorer - Rashida)
  console.log('\n[STEP 6] Registering Player 3: Rashida (Zero score target: 0 pts)...');
  const reqId3 = 'req_test_rashida_' + Date.now();
  const res3 = await registerPlayerDB('Rashida', reqId3, 'client_rashida');
  console.log('Rashida Join Response:', {
    status: res3.status,
    rowIndex: res3.rowIndex
  });

  if (res3.status !== 'success') {
    console.error('[FAIL] Failed to register Rashida:', res3);
    return false;
  }

  // Verify initial state shows 3 players pending
  console.log('\n[STEP 7] Verifying pre-submission game state...');
  const stateBefore = await getGameStateDB(sessionId);
  console.log('Pre-submission State:', {
    totalPlayers: stateBefore.totalPlayers,
    scoresSubmitted: stateBefore.scoresSubmitted,
    scoresPending: stateBefore.scoresPending,
    allScoresSubmitted: stateBefore.allScoresSubmitted
  });

  // 6. Submit scores: James = 950, Sarah = 210, Rashida = 0
  console.log('\n[STEP 8] Submitting final scores...');
  const sub1 = await submitScoreDB(sessionId, reqId1, 'James', 950, res1.rowIndex);
  console.log('James (950 pts) submission result:', sub1);

  const sub2 = await submitScoreDB(sessionId, reqId2, 'Sarah', 210, res2.rowIndex);
  console.log('Sarah (210 pts) submission result:', sub2);

  const sub3 = await submitScoreDB(sessionId, reqId3, 'Rashida', 0, res3.rowIndex);
  console.log('Rashida (0 pts) submission result:', sub3);

  if (!sub1.updated || !sub2.updated || !sub3.updated) {
    console.error('[FAIL] One or more score submissions failed to update.');
    return false;
  }

  // 7. Verify final game state and leaderboard
  console.log('\n[STEP 9] Fetching final authoritative leaderboard & compilation metrics...');
  const stateAfter = await getGameStateDB(sessionId);
  console.log('Final Game Metrics:', {
    totalPlayers: stateAfter.totalPlayers,
    scoresSubmitted: stateAfter.scoresSubmitted,
    scoresPending: stateAfter.scoresPending,
    allScoresSubmitted: stateAfter.allScoresSubmitted
  });

  console.log('\nOfficial Final Leaderboard Standings:');
  stateAfter.players.forEach((p, idx) => {
    console.log(`Rank #${idx + 1}: ${p.name.padEnd(12)} - ${String(p.score).padStart(4)} pts | hasScore: ${p.hasScore} | isPending: ${p.isPending} | Row: ${p.rowIndex}`);
  });

  // Assertions
  const p1 = stateAfter.players[0];
  const p2 = stateAfter.players[1];
  const p3 = stateAfter.players[2];

  const passChecks =
    stateAfter.totalPlayers === 3 &&
    stateAfter.scoresSubmitted === 3 &&
    stateAfter.allScoresSubmitted === true &&
    p1.name === 'James' && p1.score === 950 && p1.hasScore === true &&
    p2.name === 'Sarah' && p2.score === 210 && p2.hasScore === true &&
    p3.name === 'Rashida' && p3.score === 0 && p3.hasScore === true && p3.isPending === false;

  console.log('\n========================================================');
  if (passChecks) {
    console.log('[SUCCESS] ALL SUPABASE INTEGRATION TESTS PASSED!');
    console.log('- High score (950) correctly positioned at Rank #1');
    console.log('- Low score (210) correctly positioned at Rank #2');
    console.log('- Zero score (0) correctly saved as valid number at Rank #3 (NOT pending)');
    console.log('- All compilation metrics 100% complete');
    console.log('========================================================');
    return true;
  } else {
    console.error('[FAIL] Leaderboard assertions failed.');
    console.log('========================================================');
    return false;
  }
}

runIntegrationTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
