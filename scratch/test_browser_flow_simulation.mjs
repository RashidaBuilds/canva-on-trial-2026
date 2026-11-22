import { parseLeaderboardRows } from '../src/services/api.js';

// Mock browser client instance representing a real browser tab/device
class BrowserClient {
  constructor(name) {
    this.name = name;
    this.storage = {};
    this.baseUrl = 'http://localhost:3000/api';
    this.clientId = 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    this.storage['canva_trial_2026_client_id'] = this.clientId;
    this.playerScore = 0;
    this.isScoreConfirmedState = false;
  }

  getItem(k) { return this.storage[k] !== undefined ? this.storage[k] : null; }
  setItem(k, v) { this.storage[k] = String(v); }
  removeItem(k) { delete this.storage[k]; }

  async join() {
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    this.setItem('canva_trial_2026_request_id', requestId);
    this.setItem('canva_trial_2026_player_name', this.name);
    this.setItem('canva_trial_2026_player_score', '0');
    this.removeItem('canva_trial_2026_score_confirmed');
    this.removeItem('canva_trial_2026_question_history');

    const res = await fetch(`${this.baseUrl}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: this.clientId,
        requestId: requestId,
        name: this.name,
        timestamp: new Date().toISOString()
      })
    });

    const data = await res.json();
    if (!res.ok || data.status !== 'success') {
      throw new Error(`Join failed for ${this.name}: ` + JSON.stringify(data));
    }

    this.sessionId = data.sessionId;
    this.rowIndex = data.rowIndex;
    this.requestId = data.requestId;

    this.setItem('canva_trial_2026_session_id', this.sessionId);
    this.setItem('canva_trial_2026_row_index', String(this.rowIndex));
    this.setItem('canva_trial_2026_request_id', this.requestId);
    this.setItem('canva_trial_2026_start_time', String(data.lobbyStartTime));

    return data;
  }

  // Record an answer in question history and local running score
  answerQuestion(questionId, pointsEarned, unanswered = false) {
    this.playerScore += (pointsEarned || 0);
    this.setItem('canva_trial_2026_player_score', String(this.playerScore));

    const existingHistory = JSON.parse(this.getItem('canva_trial_2026_question_history') || '{}');
    existingHistory[questionId] = {
      pointsEarned: pointsEarned || 0,
      unanswered: !!unanswered,
      timestamp: Date.now()
    };
    this.setItem('canva_trial_2026_question_history', JSON.stringify(existingHistory));
  }

  // Execute the exact triggerFinalScoreSubmission logic from App.jsx
  async submitFinalScore() {
    const currentRow = this.rowIndex || parseInt(this.getItem('canva_trial_2026_row_index') || '0', 10) || null;

    // Calculate cumulative score from completed question history
    let calculatedScore = 0;
    try {
      const history = JSON.parse(this.getItem('canva_trial_2026_question_history') || '{}');
      const historyValues = Object.values(history);
      if (historyValues.length > 0) {
        calculatedScore = historyValues.reduce((sum, item) => sum + (Number(item?.pointsEarned) || 0), 0);
      }
    } catch (_) {}

    const storedScore = parseInt(this.getItem('canva_trial_2026_player_score') || '0', 10);
    if (!isNaN(storedScore)) {
      calculatedScore = Math.max(calculatedScore, storedScore);
    }
    if (typeof this.playerScore === 'number' && isFinite(this.playerScore)) {
      calculatedScore = Math.max(calculatedScore, this.playerScore);
    }

    const currentReqId = this.requestId || this.getItem('canva_trial_2026_request_id');
    const currentSessionId = this.sessionId || this.getItem('canva_trial_2026_session_id');

    const res = await fetch(`${this.baseUrl}/submit-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: this.clientId,
        sessionId: currentSessionId,
        requestId: currentReqId,
        rowIndex: currentRow,
        name: this.name,
        score: calculatedScore,
        timestamp: new Date().toISOString()
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'success' && data.updated) {
      this.setItem('canva_trial_2026_score_confirmed', 'true');
      this.isScoreConfirmedState = true;
    }
    return data;
  }

  async fetchLeaderboard() {
    const query = new URLSearchParams({
      t: String(Date.now()),
      sessionId: this.sessionId
    });
    const res = await fetch(`${this.baseUrl}/state?${query.toString()}`);
    const data = await res.json();
    const parsed = parseLeaderboardRows(data);
    return { raw: data, players: parsed };
  }

  // Exact LeaderboardScreen.jsx logic for personal view
  getPersonalView(leaderboardList) {
    const list = [...leaderboardList];
    const myRecord = list.find((p) => Number(p.rowIndex) === Number(this.rowIndex));
    const myRankIndex = list.findIndex((p) => Number(p.rowIndex) === Number(this.rowIndex));
    const myRank = myRankIndex !== -1 ? myRankIndex + 1 : null;
    const displayScore = myRecord && myRecord.hasScore ? myRecord.score : this.playerScore;

    return {
      name: this.name,
      myRank: myRank,
      displayScore: displayScore,
      hasScore: myRecord ? myRecord.hasScore : false,
      isPending: myRecord ? myRecord.isPending : true
    };
  }
}

async function runBrowserFlowVerification() {
  console.log('========================================================');
  console.log('REAL BROWSER-TO-SUPABASE GAMEPLAY FLOW VERIFICATION');
  console.log('========================================================\n');

  // 1. Reset game session cleanly first
  console.log('[STEP 1] Resetting game session via POST /api/reset...');
  const resetRes = await fetch('http://localhost:3000/api/reset', { method: 'POST' });
  const resetData = await resetRes.json();
  console.log('Reset result:', resetData);

  // 2. Instantiate 3 separate browser sessions
  console.log('\n[STEP 2] Launching 3 separate browser sessions (James, Sarah, Rashida)...');
  const james = new BrowserClient('James');
  const sarah = new BrowserClient('Sarah');
  const rashida = new BrowserClient('Rashida');

  // 3. Register all three in the same session
  console.log('\n[STEP 3] Registering players...');
  const jJoin = await james.join();
  console.log('James joined:', { sessionId: jJoin.sessionId, rowIndex: jJoin.rowIndex, requestId: jJoin.requestId });

  const sJoin = await sarah.join();
  console.log('Sarah joined:', { sessionId: sJoin.sessionId, rowIndex: sJoin.rowIndex, requestId: sJoin.requestId });

  const rJoin = await rashida.join();
  console.log('Rashida joined:', { sessionId: rJoin.sessionId, rowIndex: rJoin.rowIndex, requestId: rJoin.requestId });

  if (jJoin.sessionId !== sJoin.sessionId || sJoin.sessionId !== rJoin.sessionId) {
    throw new Error('Players registered into different sessions!');
  }
  console.log('[PASS] All 3 players registered in the SAME session:', jJoin.sessionId);

  // 4. Simulate gameplay answering rounds across 11 questions
  console.log('\n[STEP 4] Simulating actual gameplay rounds 1 through 11...');

  // James: high performer (answers correctly with speed bonuses -> 950 pts)
  james.answerQuestion('q1', 125);
  james.answerQuestion('q2', 120);
  james.answerQuestion('q3', 115);
  james.answerQuestion('q4', 110);
  james.answerQuestion('q5', 120);
  james.answerQuestion('q6', 125);
  james.answerQuestion('q7', 115);
  james.answerQuestion('q8', 120);
  // Total = 950 pts

  // Sarah: moderate performer (answers some correctly -> 210 pts)
  sarah.answerQuestion('q1', 110);
  sarah.answerQuestion('q2', 100);
  sarah.answerQuestion('q3', 0, true); // unanswered
  sarah.answerQuestion('q4', 0, false); // incorrect
  // Total = 210 pts

  // Rashida: answered nothing (all questions expired/unanswered -> 0 pts)
  for (let q = 1; q <= 11; q++) {
    rashida.answerQuestion(`q${q}`, 0, true);
  }
  // Total = 0 pts

  console.log(`James accumulated running score: ${james.playerScore} pts`);
  console.log(`Sarah accumulated running score: ${sarah.playerScore} pts`);
  console.log(`Rashida accumulated running score: ${rashida.playerScore} pts`);

  // 5. Submit final scores at compilation time
  console.log('\n[STEP 5] Final exhibit ends: Submitting scores from completed question history...');
  const jSub = await james.submitFinalScore();
  console.log('James submission response:', jSub);

  const sSub = await sarah.submitFinalScore();
  console.log('Sarah submission response:', sSub);

  const rSub = await rashida.submitFinalScore();
  console.log('Rashida submission response:', rSub);

  if (!jSub.updated || !sSub.updated || !rSub.updated) {
    throw new Error('One or more score submissions were not confirmed by server!');
  }
  console.log('[PASS] All 3 score submissions successfully confirmed by server.');

  // 6. Direct Supabase verification
  console.log('\n[STEP 6] Querying Supabase players table directly to confirm persistent storage...');
  const { getSupabaseClient } = await import('../api/lib/supabase.js');
  const supabase = getSupabaseClient();
  const { data: dbPlayers } = await supabase
    .from('players')
    .select('name, score, has_score, row_index, submitted_at')
    .eq('session_id', jJoin.sessionId)
    .order('row_index', { ascending: true });

  console.log('Supabase Database Records:', dbPlayers);

  const dbJames = dbPlayers.find((p) => p.name === 'James');
  const dbSarah = dbPlayers.find((p) => p.name === 'Sarah');
  const dbRashida = dbPlayers.find((p) => p.name === 'Rashida');

  if (dbJames.score !== 950 || dbJames.has_score !== true) {
    throw new Error(`Database score mismatch for James! Expected 950, got ${dbJames.score}`);
  }
  if (dbSarah.score !== 210 || dbSarah.has_score !== true) {
    throw new Error(`Database score mismatch for Sarah! Expected 210, got ${dbSarah.score}`);
  }
  if (dbRashida.score !== 0 || dbRashida.has_score !== true) {
    throw new Error(`Database score mismatch for Rashida! Expected 0, got ${dbRashida.score}`);
  }
  console.log('[PASS] Supabase verified: James = 950, Sarah = 210, Rashida = 0 (numeric 0 saved, has_score = true)');

  // 7. Verify leaderboard view across all browsers
  console.log('\n[STEP 7] Verifying leaderboard received by each browser...');
  const lbJames = await james.fetchLeaderboard();
  const lbSarah = await sarah.fetchLeaderboard();
  const lbRashida = await rashida.fetchLeaderboard();

  console.log('Global Leaderboard List:');
  lbJames.players.forEach((p, idx) => {
    console.log(`  Rank #${idx + 1}: ${p.name.padEnd(10)} - ${p.score} pts | hasScore: ${p.hasScore}`);
  });

  // Verify James's device view
  const vJames = james.getPersonalView(lbJames.players);
  console.log('\nJames Device Personal View:', vJames);

  // Verify Sarah's device view
  const vSarah = sarah.getPersonalView(lbSarah.players);
  console.log('Sarah Device Personal View:', vSarah);

  // Verify Rashida's device view
  const vRashida = rashida.getPersonalView(lbRashida.players);
  console.log('Rashida Device Personal View:', vRashida);

  // Assertions
  const checksPassed =
    vJames.myRank === 1 && vJames.displayScore === 950 &&
    vSarah.myRank === 2 && vSarah.displayScore === 210 &&
    vRashida.myRank === 3 && vRashida.displayScore === 0;

  console.log('\n========================================================');
  if (checksPassed) {
    console.log('[SUCCESS] ALL REAL BROWSER FLOW VERIFICATIONS PASSED!');
    console.log('1. James: Rank #1, Score: 950 pts');
    console.log('2. Sarah: Rank #2, Score: 210 pts');
    console.log('3. Rashida: Rank #3, Score: 0 pts (NOT Rank #1!)');
    console.log('========================================================');
    return true;
  } else {
    console.error('[FAIL] Personal view assertions failed!');
    console.log('========================================================');
    process.exit(1);
  }
}

runBrowserFlowVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
