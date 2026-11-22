import assert from 'assert';

/**
 * Direct emulation of Code.gs doPost and doGet
 */
class AppsScriptBackend {
  constructor() {
    this.EXPECTED_HEADERS = ['Timestamp', 'Name', 'Score'];
    this.sheet = [['Timestamp', 'Name', 'Score']];
    this.props = new Map();
  }

  ensurePlayersHeaders() {
    if (this.sheet.length === 0) {
      this.sheet.push([...this.EXPECTED_HEADERS]);
      return;
    }
    const row0 = this.sheet[0] || [];
    if (row0[0] !== 'Timestamp' || row0[1] !== 'Name' || row0[2] !== 'Score') {
      this.sheet[0] = [...this.EXPECTED_HEADERS];
    }
  }

  doPost(payload) {
    this.ensurePlayersHeaders();
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const action = data.action;
    const requestId = data.requestId || '';
    const name = (data.name || '').trim();
    const now = new Date();
    const serverTime = now.getTime();

    if (action === 'join') {
      let lobbyStartTime = this.props.get('LOBBY_START_TIME');
      if (!requestId || String(requestId).trim() === '') {
        return { status: 'error', code: 'MISSING_REQUEST_ID', message: 'Missing requestId' };
      }

      if (!lobbyStartTime) {
        lobbyStartTime = serverTime.toString();
        this.props.set('LOBBY_START_TIME', lobbyStartTime);
      }
      const sessionId = 'sess_' + lobbyStartTime;
      this.props.set('SESSION_ID', sessionId);

      this.sheet.push([now, name, '']);
      const rowIndex = this.sheet.length;
      const playerObj = {
        rowIndex,
        name,
        requestId,
        sessionId,
        timestamp: now.toISOString(),
        serverTimestamp: serverTime
      };
      this.props.set('REQ_' + requestId, JSON.stringify(playerObj));

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
      let activeSessionId = this.props.get('SESSION_ID');
      const clientRequestId = data.requestId || '';

      if (!activeSessionId) {
        let existingLobby = this.props.get('LOBBY_START_TIME');
        if (existingLobby) {
          activeSessionId = 'sess_' + existingLobby;
          this.props.set('SESSION_ID', activeSessionId);
        }
      }

      // 1. Session validation
      if (activeSessionId && clientSessionId && clientSessionId !== activeSessionId) {
        return { status: 'error', code: 'SESSION_MISMATCH', message: 'Session expired or invalid.' };
      }

      // 2. Row index validation
      if (!targetRow || isNaN(targetRow) || targetRow <= 1 || targetRow > this.sheet.length) {
        return { status: 'error', code: 'INVALID_ROW_INDEX', message: 'Invalid or missing rowIndex.' };
      }

      // 3. Player name validation
      const rowName = this.sheet[targetRow - 1][1];
      if (!rowName || String(rowName).trim().toLowerCase() !== name.toLowerCase()) {
        return { status: 'error', code: 'PLAYER_MISMATCH', message: 'Target row does not match registered player name.' };
      }

      // 4. Request ID validation
      if (clientRequestId && String(clientRequestId).trim() !== '') {
        const savedRecordStr = this.props.get('REQ_' + clientRequestId);
        if (savedRecordStr) {
          const savedRecord = JSON.parse(savedRecordStr);
          const savedRow = Number(savedRecord.rowIndex);
          const reqName = String(savedRecord.name || '').trim().toLowerCase();
          if (!isNaN(savedRow) && (savedRow !== targetRow || reqName !== name.toLowerCase())) {
            return { status: 'error', code: 'REQUEST_MISMATCH', message: 'Registration requestId does not match.' };
          }
        } else {
          this.props.set('REQ_' + clientRequestId, JSON.stringify({
            rowIndex: targetRow,
            name,
            requestId: clientRequestId,
            sessionId: activeSessionId || clientSessionId
          }));
        }
      }

      // 5. Score validation (finite number, including numeric zero)
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

      // 6. Write to Column C
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
    const sessionId = this.props.get('SESSION_ID');
    const lobbyStartTime = this.props.get('LOBBY_START_TIME');

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

// SIMULATE 3 PLAYERS
console.log('--- Tracing 3 Player Score Submissions & Leaderboard ---');
const backend = new AppsScriptBackend();

// 1. Registrations
const p1Join = backend.doPost({ action: 'join', name: 'High_Scorer', requestId: 'req_high' });
const p2Join = backend.doPost({ action: 'join', name: 'Mid_Scorer', requestId: 'req_mid' });
const p3Join = backend.doPost({ action: 'join', name: 'Zero_Scorer', requestId: 'req_zero' });

console.log('Registrations:');
console.log(' High_Scorer at Row', p1Join.rowIndex);
console.log(' Mid_Scorer at Row', p2Join.rowIndex);
console.log(' Zero_Scorer at Row', p3Join.rowIndex);

// 2. Score Submissions
console.log('\nSubmitting Scores:');
const p1ScoreRes = backend.doPost({
  action: 'submitScore',
  rowIndex: p1Join.rowIndex,
  name: 'High_Scorer',
  score: 950,
  sessionId: p1Join.sessionId,
  requestId: 'req_high'
});
console.log(' High_Scorer (950 pts) response:', p1ScoreRes);
assert.strictEqual(p1ScoreRes.status, 'success');
assert.strictEqual(p1ScoreRes.updated, true);

const p2ScoreRes = backend.doPost({
  action: 'submitScore',
  rowIndex: p2Join.rowIndex,
  name: 'Mid_Scorer',
  score: 400,
  sessionId: p2Join.sessionId,
  requestId: 'req_mid'
});
console.log(' Mid_Scorer (400 pts) response:', p2ScoreRes);
assert.strictEqual(p2ScoreRes.status, 'success');
assert.strictEqual(p2ScoreRes.updated, true);

const p3ScoreRes = backend.doPost({
  action: 'submitScore',
  rowIndex: p3Join.rowIndex,
  name: 'Zero_Scorer',
  score: 0,
  sessionId: p3Join.sessionId,
  requestId: 'req_zero'
});
console.log(' Zero_Scorer (0 pts) response:', p3ScoreRes);
assert.strictEqual(p3ScoreRes.status, 'success');
assert.strictEqual(p3ScoreRes.updated, true);

// 3. Inspect Sheet Column C
console.log('\nGoogle Sheet Content:');
console.log(' Row 1 (Headers):', backend.sheet[0]);
console.log(' Row 2 (High_Scorer):', backend.sheet[1]);
console.log(' Row 3 (Mid_Scorer):', backend.sheet[2]);
console.log(' Row 4 (Zero_Scorer):', backend.sheet[3]);

assert.strictEqual(backend.sheet[1][2], 950, 'Row 2 Column C must be 950');
assert.strictEqual(backend.sheet[2][2], 400, 'Row 3 Column C must be 400');
assert.strictEqual(backend.sheet[3][2], 0, 'Row 4 Column C must be numeric 0 (never blank)');

// 4. Fetch GET / Leaderboard
const getRes = backend.doGet();
console.log('\nLeaderboard GET Response:');
console.log(' Total Players:', getRes.totalPlayers);
console.log(' Scores Submitted:', getRes.scoresSubmitted);
console.log(' Scores Pending:', getRes.scoresPending);
console.log(' All Scores Submitted:', getRes.allScoresSubmitted);

assert.strictEqual(getRes.totalPlayers, 3);
assert.strictEqual(getRes.scoresSubmitted, 3);
assert.strictEqual(getRes.scoresPending, 0);
assert.strictEqual(getRes.allScoresSubmitted, true);

// 5. Ranking Verification
const ranking = getRes.players;
console.log('\nAuthoritative Global Ranking:');
ranking.forEach((p, idx) => console.log(` Rank #${idx + 1}: ${p.name} - ${p.score} pts`));

assert.strictEqual(ranking[0].name, 'High_Scorer', '1st place must be High_Scorer');
assert.strictEqual(ranking[0].score, 950);
assert.strictEqual(ranking[1].name, 'Mid_Scorer', '2nd place must be Mid_Scorer');
assert.strictEqual(ranking[1].score, 400);
assert.strictEqual(ranking[2].name, 'Zero_Scorer', '3rd place must be Zero_Scorer');
assert.strictEqual(ranking[2].score, 0);

// 6. Device-Level Personal Rank Verification (LeaderboardScreen simulation)
function getPlayerRankOnDevice(playerName, playerRowIndex) {
  const isCurrentPlayer = (p) => p.rowIndex === playerRowIndex;
  const rankIdx = ranking.findIndex(isCurrentPlayer);
  return rankIdx !== -1 ? rankIdx + 1 : null;
}

const zeroRank = getPlayerRankOnDevice('Zero_Scorer', 4);
console.log('\nPersonal Rank on Zero_Scorer Device:', zeroRank);
assert.strictEqual(zeroRank, 3, 'Zero_Scorer must see Rank #3, NEVER Rank #1');

const midRank = getPlayerRankOnDevice('Mid_Scorer', 3);
console.log('Personal Rank on Mid_Scorer Device:', midRank);
assert.strictEqual(midRank, 2, 'Mid_Scorer must see Rank #2');

const highRank = getPlayerRankOnDevice('High_Scorer', 2);
console.log('Personal Rank on High_Scorer Device:', highRank);
assert.strictEqual(highRank, 1, 'High_Scorer must see Rank #1');

console.log('\n=== ALL TRACE AND PERSISTENCE TESTS PASSED FLAWLESSLY ===');
