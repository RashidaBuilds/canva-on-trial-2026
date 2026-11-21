/**
 * Google Apps Script Backend Service Adapter
 * Endpoint configured via VITE_APPS_SCRIPT_URL.
 * Supports logical operations: join, state, submitScore, leaderboard.
 * Includes local fallback simulation for reliable offline/development testing.
 */

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

// Mock active investigators list for initial lobby roster
export const INITIAL_INVESTIGATORS = [
  'PixelInspector',
  'DesignSleuth',
  'TemplateScout',
  'LayoutLens',
  'FontFinder',
  'ColorClue',
  'VectorVoyager',
  'BrandDetective',
  'CanvasCipher',
  'PalettePro',
  'KerningMarshal',
  'GridMaster'
];

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
    .filter(row => row && row.name && row.name !== 'Name' && row.name.trim() !== '')
    .map((row, index) => {
      // In the verified Apps Script output, column 3 (Score) is keyed as 'stoppedAt'
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
 * Register a new player name with the backend
 */
export async function registerPlayer(nickname) {
  if (!APPS_SCRIPT_URL) {
    return { success: true, localOnly: true };
  }

  try {
    // Submit via POST using text/plain to prevent CORS preflight blocking in Apps Script
    const payload = JSON.stringify({
      action: 'join',
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
 * Submit final score for a player
 */
export async function submitFinalScore(nickname, score) {
  if (!APPS_SCRIPT_URL) {
    return { success: true, localOnly: true };
  }

  try {
    const payload = JSON.stringify({
      action: 'submitScore',
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
