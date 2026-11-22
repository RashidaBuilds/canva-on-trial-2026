/**
 * Google Apps Script Backend Service Adapter
 * Endpoint configured via VITE_APPS_SCRIPT_URL.
 * Supports logical operations: join, state, submitScore, leaderboard.
 * Concurrency & Synchronisation protections:
 * - Unique session ID (sessionId) to distinguish fresh sessions from in-session page refreshes
 * - Shared authoritative lobbyStartTime anchored to Player 1's server registration
 * - Fallback anchor: derives lobbyStartTime from first player's timestamp in Google Sheet
 * - Unique request ID (requestId) per intentional join attempt for retry idempotency
 * - Spreadsheet row index (rowIndex) player identification (strictly 3 columns: Timestamp, Name, Score)
 * - Staggered initial join delay (~0.5s) and staggered score submissions (0-1.5s)
 * - Exponential backoff with random jitter on transient failures (max 3 retries)
 * - Clock skew synchronization via serverTimeOffset
 */

export const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

export const STORAGE_KEYS = {
  CLIENT_ID: 'canva_trial_2026_client_id',
  SESSION_ID: 'canva_trial_2026_session_id',
  ROW_INDEX: 'canva_trial_2026_row_index',
  REQUEST_ID: 'canva_trial_2026_request_id',
  START_TIME: 'canva_trial_2026_start_time',
  PLAYER_NAME: 'canva_trial_2026_player_name',
  PLAYER_SCORE: 'canva_trial_2026_player_score',
  SCORE_CONFIRMED: 'canva_trial_2026_score_confirmed',
  QUESTION_HISTORY: 'canva_trial_2026_question_history',
  ROSTER: 'canva_trial_2026_roster',
  TIME_OFFSET: 'canva_trial_2026_server_offset'
};

/**
 * Check if the player's final score submission has been confirmed by the server
 */
export function isScoreConfirmed() {
  return localStorage.getItem(STORAGE_KEYS.SCORE_CONFIRMED) === 'true';
}

/**
 * Mark player's final score as confirmed
 */
export function markScoreConfirmed() {
  localStorage.setItem(STORAGE_KEYS.SCORE_CONFIRMED, 'true');
}

// Production: No hardcoded mock users. Populates with actual registered players from backend.
export const INITIAL_INVESTIGATORS = [];

/**
 * Utility: promise-based sleep
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate or retrieve persistent unique client session / idempotency key
 */
export function getClientId() {
  let id = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
  if (!id) {
    id = 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, id);
  }
  return id;
}

/**
 * Parse rows from Apps Script and extract valid leaderboard records.
 * Sorts in descending order of score.
 * Tiebreaker: earlier registration timestamp wins the tie.
 */
export function parseLeaderboardRows(rawInput) {
  let list = [];

  if (rawInput && Array.isArray(rawInput.players)) {
    list = rawInput.players;
  } else if (Array.isArray(rawInput)) {
    list = rawInput;
  } else {
    return [];
  }

  const valid = list
    .filter((row) => row && row.name && row.name !== 'Name' && String(row.name).trim() !== '')
    .map((row, index) => {
      // Column 3 (Score) is keyed as 'score' or legacy 'stoppedAt' in Apps Script output
      // A blank score is pending; only valid numeric scores count as submitted
      const rawScore = row.score !== undefined ? row.score : row.stoppedAt;
      const isBlank = rawScore === '' || rawScore === null || rawScore === undefined;
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

      return {
        id: `row-${row.rowIndex || index + 2}`,
        rowIndex: row.rowIndex || index + 2,
        name: String(row.name).trim(),
        score: scoreVal,
        hasScore: isValidNumeric,
        isPending: !isValidNumeric,
        timestamp: row.timestamp || ''
      };
    });

  // Sort descending by score, tiebreak by earlier registration timestamp
  return valid.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return (a.rowIndex || 0) - (b.rowIndex || 0);
  });
}

/**
 * Fetch current state or leaderboard from Google Apps Script.
 * Extracts sessionId, shared session lobbyStartTime, and synchronises server clock.
 */
export async function fetchBackendData() {
  if (!APPS_SCRIPT_URL) {
    return null;
  }

  const clientSendTime = Date.now();
  try {
    // Append cache-busting timestamp to prevent stale browser/proxy responses
    const separator = APPS_SCRIPT_URL.includes('?') ? '&' : '?';
    const url = `${APPS_SCRIPT_URL}${separator}t=${clientSendTime}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const clientRecvTime = Date.now();
    const parsedPlayers = parseLeaderboardRows(data);

    let serverTimeOffset = 0;
    let lobbyStartTime = null;
    let sessionId = null;
    let totalPlayers = parsedPlayers.length;
    let scoresSubmitted = parsedPlayers.filter((p) => p.hasScore).length;
    let scoresPending = totalPlayers - scoresSubmitted;
    let allScoresSubmitted = (totalPlayers > 0) && (scoresPending === 0);

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (typeof data.serverTime === 'number') {
        const roundTripEstimate = (clientRecvTime - clientSendTime) / 2;
        serverTimeOffset = Math.round(data.serverTime - (clientSendTime + roundTripEstimate));
        localStorage.setItem(STORAGE_KEYS.TIME_OFFSET, String(serverTimeOffset));
      }
      if (data.lobbyStartTime) {
        lobbyStartTime = typeof data.lobbyStartTime === 'number'
          ? data.lobbyStartTime
          : new Date(data.lobbyStartTime).getTime();
      }
      if (data.sessionId) {
        sessionId = data.sessionId;
      }
      if (typeof data.totalPlayers === 'number') {
        totalPlayers = data.totalPlayers;
      }
      if (typeof data.scoresSubmitted === 'number') {
        scoresSubmitted = data.scoresSubmitted;
      }
      if (typeof data.scoresPending === 'number') {
        scoresPending = data.scoresPending;
      }
      if (typeof data.allScoresSubmitted === 'boolean') {
        allScoresSubmitted = data.allScoresSubmitted;
      }
    }

    // CRITICAL FAIL-SAFE FOR SHARED COUNTDOWN:
    // If backend did not return top-level lobbyStartTime (e.g. running older Apps Script or legacy array),
    // derive lobbyStartTime directly from the first registered player in the spreadsheet!
    if (!lobbyStartTime && parsedPlayers.length > 0 && parsedPlayers[0].timestamp) {
      const firstPlayerTs = new Date(parsedPlayers[0].timestamp).getTime();
      if (!isNaN(firstPlayerTs) && firstPlayerTs > 0) {
        lobbyStartTime = firstPlayerTs;
      }
    }

    return {
      raw: data,
      players: parsedPlayers,
      lobbyStartTime: lobbyStartTime,
      serverTimeOffset: serverTimeOffset,
      sessionId: sessionId,
      totalPlayers: totalPlayers,
      scoresSubmitted: scoresSubmitted,
      scoresPending: scoresPending,
      allScoresSubmitted: allScoresSubmitted
    };
  } catch (error) {
    console.warn('Backend fetch error (falling back to local state):', error.message);
    return null;
  }
}

/**
 * Register a new player name with the backend.
 * 1. Validates nickname
 * 2. Staggers initial request (~0.5s random delay) to prevent QR-scan request bursts
 * 3. Sends unique request ID (requestId) for retry idempotency
 * 4. Retries with exponential backoff and random jitter on transient failures (max 3 retries)
 */
export async function registerPlayer(nickname) {
  const trimmed = (nickname || '').trim();
  if (!trimmed) {
    return { success: false, error: 'Nickname is required' };
  }

  // 1. Stagger initial registration request: 0 to 5 seconds random delay per browser
  // Flattens the request arrival curve so simultaneous QR code join spikes do not overwhelm Google Apps Script
  const staggerDelayMs = Math.floor(Math.random() * 5000);
  await sleep(staggerDelayMs);

  if (!APPS_SCRIPT_URL) {
    const localReqId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(STORAGE_KEYS.REQUEST_ID, localReqId);
    localStorage.setItem(STORAGE_KEYS.PLAYER_SCORE, '0');
    localStorage.removeItem(STORAGE_KEYS.SCORE_CONFIRMED);
    localStorage.removeItem(STORAGE_KEYS.QUESTION_HISTORY);
    return {
      success: true,
      localOnly: true,
      sessionId: 'sess_local_' + Date.now(),
      lobbyStartTime: Date.now(),
      rowIndex: 1,
      requestId: localReqId
    };
  }

  const clientId = getClientId();
  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem(STORAGE_KEYS.REQUEST_ID, requestId);
  localStorage.setItem(STORAGE_KEYS.PLAYER_SCORE, '0');
  localStorage.removeItem(STORAGE_KEYS.SCORE_CONFIRMED);
  localStorage.removeItem(STORAGE_KEYS.QUESTION_HISTORY);

  const payload = JSON.stringify({
    action: 'join',
    clientId: clientId,
    requestId: requestId,
    name: trimmed,
    timestamp: new Date().toISOString()
  });

  // Retry schedule: attempt 1 (1-2s), attempt 2 (2-4s), attempt 3 (4-7s)
  const retryDelays = [
    1000 + Math.floor(Math.random() * 1000),
    2000 + Math.floor(Math.random() * 2000),
    4000 + Math.floor(Math.random() * 3000)
  ];

  let lastError = null;

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      const clientSendTime = Date.now();
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: payload
      });

      const clientRecvTime = Date.now();

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      let resData = null;
      try {
        resData = await response.json();
      } catch (e) {
        // Response succeeded without parseable JSON
      }

      // Check if backend rejected late join
      if (resData && resData.status === 'error' && resData.code === 'LOBBY_CLOSED') {
        return {
          success: false,
          isLobbyClosed: true,
          error: resData.message || 'The investigation has already begun. Watch the main screen.'
        };
      }

      let lobbyStartTime = null;
      let rowIndex = null;
      let serverTimeOffset = 0;
      let sessionId = null;
      let savedRequestId = requestId;

      if (resData && typeof resData === 'object') {
        if (resData.sessionId) {
          sessionId = resData.sessionId;
        }
        if (resData.lobbyStartTime) {
          lobbyStartTime = typeof resData.lobbyStartTime === 'number'
            ? resData.lobbyStartTime
            : new Date(resData.lobbyStartTime).getTime();
        }
        if (resData.player && resData.player.rowIndex) {
          rowIndex = resData.player.rowIndex;
        } else if (resData.rowIndex) {
          rowIndex = resData.rowIndex;
        }
        if (resData.player && resData.player.requestId) {
          savedRequestId = resData.player.requestId;
        } else if (resData.requestId) {
          savedRequestId = resData.requestId;
        }
        if (typeof resData.serverTime === 'number') {
          const rtt = (clientRecvTime - clientSendTime) / 2;
          serverTimeOffset = Math.round(resData.serverTime - (clientSendTime + rtt));
        }
      }

      if (sessionId) {
        localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
      }
      if (rowIndex) {
        localStorage.setItem(STORAGE_KEYS.ROW_INDEX, String(rowIndex));
      }
      if (savedRequestId) {
        localStorage.setItem(STORAGE_KEYS.REQUEST_ID, savedRequestId);
      }
      if (lobbyStartTime) {
        localStorage.setItem(STORAGE_KEYS.START_TIME, String(lobbyStartTime));
      }
      if (serverTimeOffset) {
        localStorage.setItem(STORAGE_KEYS.TIME_OFFSET, String(serverTimeOffset));
      }

      return {
        success: true,
        sessionId: sessionId,
        lobbyStartTime: lobbyStartTime,
        rowIndex: rowIndex,
        requestId: savedRequestId,
        serverTimeOffset: serverTimeOffset
      };
    } catch (err) {
      lastError = err;
      if (attempt < retryDelays.length) {
        const waitMs = retryDelays[attempt];
        console.warn(`Registration attempt ${attempt + 1} failed (${err.message}). Retrying in ${waitMs}ms...`);
        await sleep(waitMs);
      }
    }
  }

  console.error('All registration retries exhausted:', lastError);
  return {
    success: false,
    error: 'The investigation registry is momentarily busy. Please tap Join again.'
  };
}

/**
 * Submit final score for a player with concurrency protection:
 * 1. Staggers submission across a 0-1.5s window to avoid simultaneous spikes
 * 2. Uses rowIndex to update player's existing row directly without appending
 * 3. Retries with exponential backoff and jitter
 */
export async function submitFinalScore(
  nickname,
  score,
  targetRowIndex = null,
  overrideRequestId = null,
  overrideSessionId = null
) {
  // If already confirmed by server, avoid redundant requests
  if (isScoreConfirmed()) {
    const confirmedRowIndex = targetRowIndex || parseInt(localStorage.getItem(STORAGE_KEYS.ROW_INDEX) || '0', 10) || null;
    return { success: true, rowIndex: confirmedRowIndex, alreadyConfirmed: true };
  }

  // Stagger score submission by 0 to 1500ms
  const staggerMs = Math.floor(Math.random() * 1500);
  await sleep(staggerMs);

  if (!APPS_SCRIPT_URL) {
    markScoreConfirmed();
    return { success: true, localOnly: true };
  }

  const clientId = getClientId();
  const rawRow = targetRowIndex || localStorage.getItem(STORAGE_KEYS.ROW_INDEX);
  const savedRowIndex = rawRow ? parseInt(rawRow, 10) : null;
  const sessionId = (overrideSessionId || localStorage.getItem(STORAGE_KEYS.SESSION_ID) || '').trim();
  const requestId = (overrideRequestId || localStorage.getItem(STORAGE_KEYS.REQUEST_ID) || '').trim();

  // Strict validation: never attempt score submission without a valid assigned rowIndex
  if (!savedRowIndex || isNaN(savedRowIndex) || savedRowIndex <= 1) {
    console.error('Cannot submit score: missing or invalid assigned rowIndex for player', nickname);
    return { success: false, error: 'Missing or invalid assigned row identifier' };
  }

  // Strict score validation: must be a valid finite number (numeric zero is accepted)
  let numScore = null;
  if (typeof score === 'number' && isFinite(score)) {
    numScore = score;
  } else if (typeof score === 'string' && score.trim() !== '') {
    const parsed = Number(score.trim());
    if (!isNaN(parsed) && isFinite(parsed)) {
      numScore = parsed;
    }
  }

  if (numScore === null) {
    console.error('Cannot submit score: score must be a finite number, received', score);
    return { success: false, error: 'Score must be a valid finite number' };
  }

  // Strict identity token validation: original registration requestId must be present
  if (!requestId) {
    console.error('Cannot submit score: missing original registration requestId for player', nickname);
    return { success: false, error: 'Missing registration request identifier' };
  }

  const payload = JSON.stringify({
    action: 'submitScore',
    clientId: clientId,
    sessionId: sessionId,
    requestId: requestId,
    rowIndex: savedRowIndex,
    name: nickname,
    score: numScore,
    timestamp: new Date().toISOString()
  });

  const retryDelays = [
    1000 + Math.floor(Math.random() * 1000),
    2000 + Math.floor(Math.random() * 2000),
    4000 + Math.floor(Math.random() * 3000)
  ];

  let lastError = null;

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: payload
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      let resData = null;
      try {
        resData = await response.json();
      } catch (jsonErr) {
        throw new Error('Apps Script returned non-JSON response: ' + jsonErr.message);
      }

      if (!resData || resData.status !== 'success' || !resData.updated) {
        const errMsg = (resData && (resData.message || resData.code)) || 'Score submission was not confirmed by server';
        console.warn('Apps Script rejected submitScore:', errMsg);
        throw new Error(errMsg);
      }

      // Mark score confirmed locally ONLY upon verified server confirmation
      markScoreConfirmed();
      return { success: true, rowIndex: savedRowIndex, score: numScore, updated: true };
    } catch (err) {
      lastError = err;
      if (attempt < retryDelays.length) {
        const waitMs = retryDelays[attempt];
        console.warn(`Score submission attempt ${attempt + 1} failed (${err.message}). Retrying in ${waitMs}ms...`);
        await sleep(waitMs);
      }
    }
  }

  console.warn('Final score submission encountered network issue after retries:', lastError);
  return { success: false, error: lastError ? lastError.message : 'Unknown error' };
}
