import { registerPlayerDB, submitScoreDB, getGameStateDB, resetGameSessionDB } from '../api/lib/supabase.js';

async function testDuplicates() {
  console.log('Testing duplicate nicknames on live Supabase...');
  await resetGameSessionDB();

  // Jane 1
  const req1 = 'req_dup_j1_' + Date.now();
  const j1 = await registerPlayerDB('Jane', req1, 'c1');
  console.log('Jane 1 registered:', { rowIndex: j1.rowIndex, sessionId: j1.sessionId });

  // Jane 2
  const req2 = 'req_dup_j2_' + Date.now();
  const j2 = await registerPlayerDB('Jane', req2, 'c2');
  console.log('Jane 2 registered:', { rowIndex: j2.rowIndex, sessionId: j2.sessionId });

  if (j1.rowIndex === j2.rowIndex) {
    throw new Error('Duplicate nicknames received same rowIndex!');
  }

  // Submit score for Jane 1: 880
  const sub1 = await submitScoreDB(j1.sessionId, req1, 'Jane', 880, j1.rowIndex);
  console.log('Jane 1 score submission:', sub1);

  // Submit score for Jane 2: 440
  const sub2 = await submitScoreDB(j2.sessionId, req2, 'Jane', 440, j2.rowIndex);
  console.log('Jane 2 score submission:', sub2);

  // Attack: Try Jane 1 overwriting Jane 2's row with Jane 1's requestId
  const attack = await submitScoreDB(j1.sessionId, req1, 'Jane', 9999, j2.rowIndex);
  console.log('Attack attempt result (should be error):', attack);

  // Fetch state
  const state = await getGameStateDB(j1.sessionId);
  console.log('Leaderboard:');
  state.players.forEach((p, idx) => {
    console.log(`Rank #${idx + 1}: ${p.name} - ${p.score} pts (Row ${p.rowIndex})`);
  });

  const p1 = state.players[0];
  const p2 = state.players[1];

  if (p1.score === 880 && p1.rowIndex === j1.rowIndex &&
      p2.score === 440 && p2.rowIndex === j2.rowIndex &&
      attack.status === 'error') {
    console.log('[SUCCESS] Duplicate nickname isolation and security verified!');
  } else {
    throw new Error('Duplicate verification failed!');
  }
}

testDuplicates().catch((err) => {
  console.error(err);
  process.exit(1);
});
