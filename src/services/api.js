/**
 * Google Apps Script Backend Service Adapter
 * Endpoint configured via VITE_APPS_SCRIPT_URL.
 * Supports logical operations: join, state, submitScore, leaderboard.
 * Includes client idempotency keys to protect against duplicate registrations on retries.
 */

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

// Production: No hardcoded mock users. Populates with actual registered players from backend.
export const INITIAL_INVESTIGATORS = [];

/**
 * Generate or retrieve persistent unique client session / idempotency key
 */
export function getClientId() {
  const KEY = 'canva_trial_2026_client_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * Fetch current state or leaderboard from Google Apps Script
 */
export async function fetchBackendData() {
  if (!APPS_SCRIPT_URL) {
    return null;
  }
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('Backend fetch error (falling back to local state):', error.message);
    return null;
  }
}

/**
 * Parse rows from Apps Script and extract valid leaderboard records
 */
export function parseLeaderboardRows(rawRows) {
  if (!Array.isArray(rawRows)) return [];

  return rawRows
    .filter(row => row && row.name && row.name !== 'Name' && String(row.name).trim() !== '')
    .map((row, index) => {
      // In the verified Apps Script output, column 3 (Score) is keyed as 'stoppedAt' or 'score'
      const rawScore = row.stoppedAt ?? row.score ?? 0;
      const score = typeof rawScore === 'number' ? rawScore : parseInt(String(rawScore), 10) || 0;
      return {
        id: `row-${index}`,
        name: String(row.name).trim(),
        score: score,
        timestamp: row.timestamp || ''
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Register a new player name with the backend (with client idempotency key)
 */
export async function registerPlayer(nickname) {
  if (!APPS_SCRIPT_URL) {
    return { success: true, localOnly: true };
  }

  try {
    const clientId = getClientId();
    // Submit via POST using text/plain to prevent CORS preflight blocking in Apps Script
    const payload = JSON.stringify({
      action: 'join',
      clientId: clientId,
      name: nickname,
      timestamp: new Date().toISOString()
    });

    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: payload
    });

    return { success: true };
  } catch (err) {
    console.warn('Registration network issue (continuing with local player state):', err);
    return { success: true, localOnly: true };
  }
}

/**
 * Submit final score for a player (with client idempotency key)
 */
export async function submitFinalScore(nickname, score) {
  if (!APPS_SCRIPT_URL) {
    return { success: true, localOnly: true };
  }

  try {
    const clientId = getClientId();
    const payload = JSON.stringify({
      action: 'submitScore',
      clientId: clientId,
      name: nickname,
      score: score,
      timestamp: new Date().toISOString()
    });

    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: payload
    });

    return { success: true };
  } catch (err) {
    console.warn('Score submission network issue (recorded locally):', err);
    return { success: true, localOnly: true };
  }
}
