/**
 * Google Apps Script Backend Service Adapter
 * Endpoint configured via VITE_APPS_SCRIPT_URL.
 * Supports logical operations: join, state, submitScore, leaderboard.
 * Concurrency protections:
 * - Client-side request IDs & persistent client idempotency keys
 * - Staggered initial join delay (~0.5s per browser) to prevent request bursts
 * - Staggered final score submissions (0-1.5s delay)
 * - Exponential backoff with random jitter for transient errors (1-2s, 2-4s, 4-7s; max 3 retries)
 * - Synchronises client clock with server timestamp
 * - 3-column Google Sheet structure: [Timestamp, Name, Score]
 */

export const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

export const STORAGE_KEYS = {
  CLIENT_ID: 'canva_trial_2026_client_id',
  ROW_INDEX: 'canva_trial_2026_row_index',
  START_TIME: 'canva_trial_2026_start_time',
  PLAYER_NAME: 'canva_trial_2026_player_name',
  PLAYER_SCORE: 'canva_trial_2026_player_score',
  ROSTER: 'canva_trial_2026_roster',
  TIME_OFFSET: 'canva_trial_2026_server_offset'
};

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
      // Column 3 (Score) is keyed as 'stoppedAt' or 'score' in Apps Script output
      const rawScore = row.score !== undefined ? row.score : row.stoppedAt;
      const score = typeof rawScore === 'number'
        ? rawScore
        : rawScore === '' || rawScore === null || rawScore === undefined
          ? 0
          : parseInt(String(rawScore), 10) || 0;

      return {
        id: `row-${row.rowIndex || index}`,
        rowIndex: row.rowIndex || null,
        name: String(row.name).trim(),
        score: score,
        hasScore: rawScore !== '' && rawScore !== null && rawScore !== undefined,
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
    return timeA - timeB;
  });
}

/**
 * Fetch current state or leaderboard from Google Apps Script.
 * Synchronises server time and extracts the shared session lobbyStartTime.
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

    // Check if response contains serverTime for clock synchronization
    let serverTimeOffset = 0;
    let lobbyStartTime = null;

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
    }

    return {
      raw: data,
      players: parseLeaderboardRows(data),
      lobbyStartTime: lobbyStartTime,
      serverTimeOffset: serverTimeOffset
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
 * 3. Sends unique request ID with client idempotency key
 * 4. Retries with exponential backoff and random jitter on transient failures (max 3 retries)
 */
export async function registerPlayer(nickname) {
  const trimmed = (nickname || '').trim();
  if (!trimmed) {
    return { success: false, error: 'Nickname is required' };
  }

  // 1. Stagger initial registration request: 300ms to 700ms (~0.5s average) per browser
  const staggerDelayMs = Math.floor(300 + Math.random() * 400);
  await sleep(staggerDelayMs);

  if (!APPS_SCRIPT_URL) {
    return {
      success: true,
      localOnly: true,
      lobbyStartTime: Date.now(),
      rowIndex: 1
    };
  }

  const clientId = getClientId();
  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

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

      let lobbyStartTime = null;
      let rowIndex = null;
      let serverTimeOffset = 0;

      if (resData && typeof resData === 'object') {
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
        if (typeof resData.serverTime === 'number') {
          const rtt = (clientRecvTime - clientSendTime) / 2;
          serverTimeOffset = Math.round(resData.serverTime - (clientSendTime + rtt));
        }
      }

      if (rowIndex) {
        localStorage.setItem(STORAGE_KEYS.ROW_INDEX, String(rowIndex));
      }
      if (lobbyStartTime) {
        localStorage.setItem(STORAGE_KEYS.START_TIME, String(lobbyStartTime));
      }
      if (serverTimeOffset) {
        localStorage.setItem(STORAGE_KEYS.TIME_OFFSET, String(serverTimeOffset));
      }

      return {
        success: true,
        lobbyStartTime: lobbyStartTime,
        rowIndex: rowIndex,
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
export async function submitFinalScore(nickname, score, targetRowIndex = null) {
  // Stagger score submission by 0 to 1500ms
  const staggerMs = Math.floor(Math.random() * 1500);
  await sleep(staggerMs);

  if (!APPS_SCRIPT_URL) {
    return { success: true, localOnly: true };
  }

  const clientId = getClientId();
  const savedRowIndex = targetRowIndex || parseInt(localStorage.getItem(STORAGE_KEYS.ROW_INDEX) || '0', 10) || null;

  const payload = JSON.stringify({
    action: 'submitScore',
    clientId: clientId,
    rowIndex: savedRowIndex,
    name: nickname,
    score: typeof score === 'number' ? score : 0,
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

      return { success: true };
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
