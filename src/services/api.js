/**
 * Canva on Trial 2026 - Production API Service Adapter
 * Connected to Vercel Serverless Functions and Supabase Backend.
 * 
 * Endpoints:
 * - GET  /api/state: Shared session timer, countdown, compilation metrics & verified leaderboard
 * - POST /api/join: Atomic player registration with 0-5s stagger & idempotency
 * - POST /api/submit-score: Strict final score submission & verification
 * - POST /api/reset: Clean game session reset
 * 
 * Invariants Preserved:
 * - Unique session ID (sessionId)
 * - Authoritative lobbyStartTime established once by Player 1
 * - Unique request ID (requestId) per intentional registration attempt
 * - Row index (rowIndex) for player row identification
 * - Staggered initial join delay (0 to 5s) to flatten simultaneous QR spikes
 * - Staggered score submission (0 to 1.5s)
 * - Exponential backoff with random jitter on retries (max 3 retries)
 * - Clock skew synchronization via serverTimeOffset
 * - Strict score validation (numeric zero is valid!)
 * - Confirmation marked only upon explicit server verification
 */

export const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_BASE_URL : null) || '/api';

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

// Production: Dynamic roster populated from active backend participants
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
 * Parse rows from Supabase / Vercel API and extract valid leaderboard records.
 * Sorts in descending order of score.
 * Confirmed scores are ranked strictly above pending records.
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
      // Respect explicit backend flags
      const explicitHasScore = typeof row.hasScore === 'boolean'
        ? row.hasScore
        : (typeof row.isPending === 'boolean' ? !row.isPending : null);

      const rawScore = row.score !== undefined ? row.score : row.stoppedAt;
      const isBlank = rawScore === '' || rawScore === null || rawScore === undefined;
      let isValidNumeric = false;
      let scoreVal = null;

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

      // Final score status: must be explicitly confirmed by backend
      const hasScoreFinal = explicitHasScore !== null ? (explicitHasScore && isValidNumeric) : isValidNumeric;

      return {
        id: `row-${row.rowIndex || index + 2}`,
        rowIndex: row.rowIndex || index + 2,
        name: String(row.name).trim(),
        score: hasScoreFinal ? (scoreVal !== null ? scoreVal : 0) : 0,
        numericScore: hasScoreFinal ? scoreVal : null,
        hasScore: hasScoreFinal,
        isPending: !hasScoreFinal,
        timestamp: row.timestamp || ''
      };
    });

  // Sort descending by score (pending records placed after confirmed records)
  // Tiebreaker: earlier registration timestamp wins
  return valid.sort((a, b) => {
    if (a.hasScore !== b.hasScore) {
      return a.hasScore ? -1 : 1;
    }
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
 * Fetch current state or leaderboard from Supabase-backed API.
 * Extracts sessionId, shared session lobbyStartTime, and synchronises server clock.
 */
export async function fetchBackendData() {
  const clientSendTime = Date.now();
  try {
    const storedSession = localStorage.getItem(STORAGE_KEYS.SESSION_ID) || '';
    const queryParams = new URLSearchParams({
      t: String(clientSendTime)
    });
    if (storedSession) {
      queryParams.set('sessionId', storedSession);
    }

    const response = await fetch(`${API_BASE_URL}/state?${queryParams.toString()}`, {
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
 * Register a new player name with Supabase backend.
 * 1. Validates nickname
 * 2. Staggers initial request (0 to 5s random delay) to prevent QR burst contention
 * 3. Sends unique request ID (requestId) for retry idempotency
 * 4. Retries with exponential backoff and random jitter on transient failures
 */
export async function registerPlayer(nickname) {
  const trimmed = (nickname || '').trim();
  if (!trimmed) {
    return { success: false, error: 'Nickname is required' };
  }

  // 1. Stagger initial registration request: 0 to 5 seconds random delay per browser
  const staggerDelayMs = Math.floor(Math.random() * 5000);
  await sleep(staggerDelayMs);

  const clientId = getClientId();
  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem(STORAGE_KEYS.REQUEST_ID, requestId);
  localStorage.setItem(STORAGE_KEYS.PLAYER_SCORE, '0');
  localStorage.removeItem(STORAGE_KEYS.SCORE_CONFIRMED);
  localStorage.removeItem(STORAGE_KEYS.QUESTION_HISTORY);

  const payload = JSON.stringify({
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
      const response = await fetch(`${API_BASE_URL}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: payload
      });

      const clientRecvTime = Date.now();

      let resData = null;
      try {
        resData = await response.json();
      } catch (_) {}

      // Check if backend rejected late join
      if (resData && resData.status === 'error' && resData.code === 'LOBBY_CLOSED') {
        return {
          success: false,
          isLobbyClosed: true,
          error: resData.message || 'The investigation has already begun. Watch the main screen.'
        };
      }

      if (!response.ok) {
        const errorMsg = (resData && resData.message) || `Server returned HTTP ${response.status}`;
        throw new Error(errorMsg);
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
 * 2. Uses rowIndex and requestId to update player's existing row directly
 * 3. Retries with exponential backoff and jitter
 * 4. Confirms score only upon verified server confirmation
 */
export async function submitFinalScore(
  nickname,
  score,
  targetRowIndex = null,
  overrideRequestId = null,
  overrideSessionId = null
) {
  // Stagger score submission by 0 to 1500ms
  const staggerMs = Math.floor(Math.random() * 1500);
  await sleep(staggerMs);

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
      const response = await fetch(`${API_BASE_URL}/submit-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: payload
      });

      let resData = null;
      try {
        resData = await response.json();
      } catch (jsonErr) {
        throw new Error('Server returned non-JSON response: ' + jsonErr.message);
      }

      if (!response.ok || !resData || resData.status !== 'success' || !resData.updated) {
        const errMsg = (resData && (resData.message || resData.code)) || `Server returned HTTP ${response.status}`;
        console.warn('Backend rejected submitScore:', errMsg);
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
