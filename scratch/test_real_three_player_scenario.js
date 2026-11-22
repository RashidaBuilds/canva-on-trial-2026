import assert from 'assert';

/**
 * Simulation of Google Apps Script backend behavior
 * based directly on google-apps-script/Code.gs
 */
class GoogleSheetBackendMock {
  constructor() {
    this.EXPECTED_HEADERS = ['Timestamp', 'Name', 'Score'];
    this.sheet = []; // 2D array of rows
    this.properties = new Map();
  }

  ensurePlayersHeaders() {
    if (this.sheet.length === 0) {
      this.sheet.push([...this.EXPECTED_HEADERS]);
      return;
    }
    const row0 = this.sheet[0] || [];
    const h0 = String(row0[0] || '').trim();
    const h1 = String(row0[1] || '').trim();
    const h2 = String(row0[2] || '').trim();
    if (h0 !== this.EXPECTED_HEADERS[0] || h1 !== this.EXPECTED_HEADERS[1] || h2 !== this.EXPECTED_HEADERS[2]) {
      this.sheet[0] = [...this.EXPECTED_HEADERS];
    }
  }

  resetGameSession() {
    this.ensurePlayersHeaders();
    if (this.sheet.length > 1) {
      this.sheet = [this.sheet[0]]; // preserve row 0 (headers), clear row 1+
    }
    this.properties.clear();
  }

  doPost(postData) {
    this.ensurePlayersHeaders();
    const data = typeof postData === 'string' ? JSON.parse(postData) : postData;
    const action = data.action;
    const requestId = data.requestId || '';
    const name = (data.name || '').trim();
    const now = new Date();
    const serverTime = now.getTime();

    if (action === 'join') {
      let lobbyStartTime = this.properties.get('LOBBY_START_TIME');

      if (!requestId || String(requestId).trim() === '') {
        return { status: 'error', code: 'MISSING_REQUEST_ID', message: 'Missing required registration request identifier' };
      }

      if (!lobbyStartTime) {
        for (let r = 1; r < this.sheet.length; r++) {
          const existingTs = this.sheet[r][0];
          const existingName = this.sheet[r][1];
          if (existingName && existingName !== 'Name' && String(existingName).trim() !== '' && existingTs) {
            const parsed = new Date(existingTs).getTime();
            if (!isNaN(parsed) && parsed > 0) {
              lobbyStartTime = parsed.toString();
              break;
            }
          }
        }
        if (!lobbyStartTime) {
          lobbyStartTime = serverTime.toString();
        }
        this.properties.set('LOBBY_START_TIME', lobbyStartTime);
      }

      const sessionId = 'sess_' + lobbyStartTime;
      this.properties.set('SESSION_ID', sessionId);

      const existingRecordStr = this.properties.get('REQ_' + requestId);
      if (existingRecordStr) {
        const existing = JSON.parse(existingRecordStr);
        return {
          status: 'success',
          action: 'join',
          isRetry: true,
          sessionId,
          player: existing,
          rowIndex: existing.rowIndex,
          requestId: existing.requestId || requestId,
          lobbyStartTime: Number(lobbyStartTime),
          serverTime
        };
      }

      const elapsed = serverTime - Number(lobbyStartTime);
      if (elapsed >= 90000) {
        return {
          status: 'error',
          code: 'LOBBY_CLOSED',
          message: 'The investigation has already begun. Watch the main screen.',
          sessionId,
          lobbyStartTime: Number(lobbyStartTime),
          serverTime
        };
      }

      this.sheet.push([now, name, '']);
      const rowIndex = this.sheet.length; // 1-based index
      const playerObj = {
        rowIndex,
        name,
        requestId,
        sessionId,
        timestamp: now.toISOString(),
        serverTimestamp: serverTime
      };

      this.properties.set('REQ_' + requestId, JSON.stringify(playerObj));

      return {
        status: 'success',
        action: 'join',
        sessionId,
        player: playerObj,
        rowIndex,
        requestId,
        lobbyStartTime: Number(lobbyStartTime),
        serverTime
      };
    } else if (action === 'submitScore') {
      const targetRow = data.rowIndex ? parseInt(data.rowIndex, 10) : null;
      const clientSessionId = data.sessionId || '';
      let activeSessionId = this.properties.get('SESSION_ID');
      const clientRequestId = data.requestId || '';

      if (!activeSessionId) {
        let existingLobby = this.properties.get('LOBBY_START_TIME');
        if (!existingLobby && this.sheet.length > 1) {
          const fTs = this.sheet[1][0];
          if (fTs) {
            const fPt = new Date(fTs).getTime();
            if (!isNaN(fPt) && fPt > 0) existingLobby = fPt.toString();
          }
        }
        if (existingLobby) {
          activeSessionId = 'sess_' + existingLobby;
          this.properties.set('SESSION_ID', activeSessionId);
        }
      }

      if (activeSessionId && clientSessionId && clientSessionId !== activeSessionId) {
        return { status: 'error', code: 'SESSION_MISMATCH', message: 'Session expired or invalid.' };
      }

      if (!targetRow || isNaN(targetRow) || targetRow <= 1 || targetRow > this.sheet.length) {
        return { status: 'error', code: 'INVALID_ROW_INDEX', message: 'Invalid or missing rowIndex.' };
      }

      if (!clientRequestId || String(clientRequestId).trim() === '') {
        return { status: 'error', code: 'MISSING_REQUEST_ID', message: 'Missing original registration requestId.' };
      }

      const savedRecordStr = this.properties.get('REQ_' + clientRequestId);
      if (savedRecordStr) {
        const savedRecord = JSON.parse(savedRecordStr);
        const savedRow = Number(savedRecord.rowIndex);
        const reqName = String(savedRecord.name || '').trim().toLowerCase();
        if (!isNaN(savedRow) && (savedRow !== targetRow || reqName !== name.toLowerCase())) {
          return { status: 'error', code: 'REQUEST_MISMATCH', message: 'Registration requestId does not match.' };
        }
      }

      const rowName = this.sheet[targetRow - 1][1];
      if (!rowName || String(rowName).trim().toLowerCase() !== name.toLowerCase()) {
        return { status: 'error', code: 'PLAYER_MISMATCH', message: 'Target row does not match registered player name.' };
      }

      let scoreNum = null;
      if (typeof data.score === 'number' && isFinite(data.score)) {
        scoreNum = data.score;
      } else if (typeof data.score === 'string' && data.score.trim() !== '') {
        const parsed = Number(data.score.trim());
        if (!isNaN(parsed) && isFinite(parsed)) scoreNum = parsed;
      }

      if (scoreNum === null) {
        return { status: 'error', code: 'INVALID_SCORE', message: 'Score must be a valid finite number.' };
      }

      // Write score to Column C (index 2)
      this.sheet[targetRow - 1][2] = scoreNum;

      return {
        status: 'success',
        action: 'submitScore',
        rowIndex: targetRow,
        score: scoreNum,
        updated: true
      };
    }
  }

  doGet() {
    this.ensurePlayersHeaders();
    const rows = this.sheet;
    const serverTime = new Date().getTime();
    const players = [];
    let totalPlayers = 0;
    let scoresSubmitted = 0;
    let scoresPending = 0;

    for (let i = 0; i < rows.length; i++) {
      const ts = rows[i][0];
      const name = rows[i][1];
      const rawScore = rows[i][2];

      if (!name || name === 'Name' || String(name).trim() === '') continue;

      totalPlayers++;

      const isBlank = (rawScore === '' || rawScore === null || rawScore === undefined);
      let isValidNumeric = false;
      let scoreVal = 0;

      if (!isBlank) {
        if (typeof rawScore === 'number' && isFinite(rawScore)) {
          isValidNumeric = true;
          scoreVal = rawScore;
        } else if (typeof rawScore === 'string' && rawScore.trim() !== '') {
          const parsed = Number(rawScore.trim());
          if (!isNaN(parsed) && isFinite(parsed)) {
            isValidNumeric = true;
            scoreVal = parsed;
          }
        }
      }

      if (isValidNumeric) {
        scoresSubmitted++;
      } else {
        scoresPending++;
      }

      players.push({
        rowIndex: i + 1,
        name: String(name).trim(),
        score: scoreVal,
        stoppedAt: scoreVal,
        hasScore: isValidNumeric,
        isPending: !isValidNumeric,
        timestamp: ts ? (ts instanceof Date ? ts.toISOString() : ts.toString()) : ''
      });
    }

    const allScoresSubmitted = (totalPlayers > 0) && (scoresPending === 0);
    let sessionId = this.properties.get('SESSION_ID');
    let lobbyStartTime = this.properties.get('LOBBY_START_TIME');

    if (players.length > 0 && !lobbyStartTime && players[0].timestamp) {
      const anchorTime = new Date(players[0].timestamp).getTime();
      if (!isNaN(anchorTime) && anchorTime > 0) {
        lobbyStartTime = anchorTime.toString();
        this.properties.set('LOBBY_START_TIME', lobbyStartTime);
      }
    }
    if (players.length > 0 && !sessionId && lobbyStartTime) {
      sessionId = 'sess_' + lobbyStartTime;
      this.properties.set('SESSION_ID', sessionId);
    }

    players.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      if (tA !== tB) return tA - tB;
      return (a.rowIndex || 0) - (b.rowIndex || 0);
    });

    return {
      status: 'success',
      sessionId: sessionId || null,
      serverTime,
      lobbyStartTime: lobbyStartTime ? Number(lobbyStartTime) : null,
      isLobbyClosed: false,
      totalPlayers,
      scoresSubmitted,
      scoresPending,
      allScoresSubmitted,
      players
    };
  }
}

// RUN TESTS
console.log('--- Starting Canva on Trial 2026 Three-Player Test Suite ---');
const backend = new GoogleSheetBackendMock();

// Test 1: Header Initialization
backend.ensurePlayersHeaders();
assert.deepStrictEqual(backend.sheet[0], ['Timestamp', 'Name', 'Score'], 'Row 1 must be canonical headers');
console.log('✓ Test 1 Passed: Headers created at Row 1 (Timestamp, Name, Score)');

// Test 2: Player Registration
const join1 = backend.doPost({ action: 'join', name: 'James', requestId: 'req_james_1' });
assert.strictEqual(join1.status, 'success');
assert.strictEqual(join1.rowIndex, 2, 'James must register at Row 2');

const join2 = backend.doPost({ action: 'join', name: 'Sarah', requestId: 'req_sarah_1' });
assert.strictEqual(join2.status, 'success');
assert.strictEqual(join2.rowIndex, 3, 'Sarah must register at Row 3');

const join3 = backend.doPost({ action: 'join', name: 'Rashida', requestId: 'req_rashida_1' });
assert.strictEqual(join3.status, 'success');
assert.strictEqual(join3.rowIndex, 4, 'Rashida must register at Row 4');
console.log('✓ Test 2 Passed: James (row 2), Sarah (row 3), Rashida (row 4) registered successfully');

// Test 3: Score Submissions
// James scored 0
const scoreJames = backend.doPost({
  action: 'submitScore',
  rowIndex: 2,
  name: 'James',
  score: 0,
  requestId: 'req_james_1',
  sessionId: join1.sessionId
});
assert.strictEqual(scoreJames.status, 'success');
assert.strictEqual(scoreJames.updated, true);
assert.strictEqual(backend.sheet[1][2], 0, 'Row 2 Column C must be numeric 0');

// Sarah scored 850
const scoreSarah = backend.doPost({
  action: 'submitScore',
  rowIndex: 3,
  name: 'Sarah',
  score: 850,
  requestId: 'req_sarah_1',
  sessionId: join2.sessionId
});
assert.strictEqual(scoreSarah.status, 'success');
assert.strictEqual(scoreSarah.updated, true);
assert.strictEqual(backend.sheet[2][2], 850, 'Row 3 Column C must be 850');

// Rashida scored 500
const scoreRashida = backend.doPost({
  action: 'submitScore',
  rowIndex: 4,
  name: 'Rashida',
  score: 500,
  requestId: 'req_rashida_1',
  sessionId: join3.sessionId
});
assert.strictEqual(scoreRashida.status, 'success');
assert.strictEqual(scoreRashida.updated, true);
assert.strictEqual(backend.sheet[3][2], 500, 'Row 4 Column C must be 500');
console.log('✓ Test 3 Passed: All scores saved in Column C (James: 0, Sarah: 850, Rashida: 500)');

// Test 4: Leaderboard Authoritative Rankings
const leaderboard = backend.doGet();
assert.strictEqual(leaderboard.totalPlayers, 3);
assert.strictEqual(leaderboard.scoresSubmitted, 3);
assert.strictEqual(leaderboard.scoresPending, 0);
assert.strictEqual(leaderboard.allScoresSubmitted, true);

const ranking = leaderboard.players;
assert.strictEqual(ranking[0].name, 'Sarah', '1st place must be Sarah with 850 pts');
assert.strictEqual(ranking[0].score, 850);
assert.strictEqual(ranking[1].name, 'Rashida', '2nd place must be Rashida with 500 pts');
assert.strictEqual(ranking[1].score, 500);
assert.strictEqual(ranking[2].name, 'James', '3rd place must be James with 0 pts');
assert.strictEqual(ranking[2].score, 0);
console.log('✓ Test 4 Passed: Authoritative Rankings are correct: 1st Sarah (850), 2nd Rashida (500), 3rd James (0)');

// Test 5: James Device View does NOT elevate James to 1st
const jamesRank = ranking.findIndex(p => p.rowIndex === 2) + 1;
assert.strictEqual(jamesRank, 3, 'James viewing device must show Rank #3, NEVER Rank #1!');
console.log('✓ Test 5 Passed: James viewing device displays Rank #3 of 3 (never elevated to 1st)');

// Test 6: Reset Preserves Headers
backend.resetGameSession();
assert.deepStrictEqual(backend.sheet[0], ['Timestamp', 'Name', 'Score'], 'Headers preserved after reset');
assert.strictEqual(backend.sheet.length, 1, 'Only header row remains');
const restartJoin = backend.doPost({ action: 'join', name: 'Alice', requestId: 'req_alice_1' });
assert.strictEqual(restartJoin.rowIndex, 2, 'Fresh game restarts cleanly at Row 2');
console.log('✓ Test 6 Passed: Game session reset preserves headers and restarts next game at Row 2');

console.log('\n--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
