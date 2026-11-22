/**
 * Canva on Trial 2026 - Production Google Apps Script Backend
 * 
 * SPREADSHEET STRUCTURE: Exactly 3 columns on sheet tab "Players"
 * Column A: Timestamp
 * Column B: Name
 * Column C: Score
 * 
 * Features:
 * - Reads and writes to specific "Players" sheet tab via getPlayersSheet()
 * - Unique session ID (SESSION_ID) to distinguish fresh sessions from page refreshes
 * - Shared authoritative lobbyStartTime established once by Player 1
 * - Preserves individual server-side join timestamps in Column A
 * - Supports duplicate nicknames (separate rows, separate row indexes)
 * - Identifies players strictly by their spreadsheet row index (rowIndex)
 * - Player ownership token: original registration requestId stored in PropertiesService
 * - Score submission verifies: sessionId, rowIndex, requestId existence, and exact row/name mapping
 * - Score submission ONLY updates the assigned row; never matches by nickname or creates new rows
 * - Complete compilation metrics: totalPlayers, scoresSubmitted, scoresPending, allScoresSubmitted
 * - Idempotent retries via unique request ID in PropertiesService
 * - Rejects late join registrations once the 90s lobby closes
 * - Clean session reset restricted strictly to authorized resetGameSession() menu
 * - Bounded write locks via LockService (5s); lock-free GET requests
 */

// Canonical 3-column headers on sheet tab "Players"
var EXPECTED_HEADERS = ['Timestamp', 'Name', 'Score'];

/**
 * Target the specific "Players" sheet tab.
 * Throws a clear error if the Players tab does not exist (never silently uses another tab).
 */
function getPlayersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Players');
  if (!sheet) {
    throw new Error("Sheet tab 'Players' not found. Please ensure a tab named 'Players' exists in the spreadsheet.");
  }
  return sheet;
}

/**
 * Ensure the exact 3-column headers exist on row 1 of the 'Players' sheet tab:
 * A1: Timestamp
 * B1: Name
 * C1: Score
 * 
 * Replaces any title, missing headings, or incorrect labels in row 1 with the canonical headers.
 * Preserves all player data rows from row 2 downwards.
 */
function ensurePlayersHeaders(sheet) {
  var lastRow = sheet.getLastRow();

  if (lastRow === 0) {
    sheet.appendRow(EXPECTED_HEADERS);
    SpreadsheetApp.flush();
    return;
  }

  var currentHeaderRange = sheet.getRange(1, 1, 1, 3);
  var currentHeaders = currentHeaderRange.getValues()[0];

  var h0 = String(currentHeaders[0] || '').trim();
  var h1 = String(currentHeaders[1] || '').trim();
  var h2 = String(currentHeaders[2] || '').trim();

  // If row 1 does not exactly match ['Timestamp', 'Name', 'Score'], restore the canonical headers
  if (h0 !== EXPECTED_HEADERS[0] || h1 !== EXPECTED_HEADERS[1] || h2 !== EXPECTED_HEADERS[2]) {
    currentHeaderRange.setValues([EXPECTED_HEADERS]);
    SpreadsheetApp.flush();
  }
}

// Custom menu visible only to authorized Google Sheets editors
function onOpen() {
  try {
    var sheet = getPlayersSheet();
    ensurePlayersHeaders(sheet);
  } catch (_) {}

  SpreadsheetApp.getUi()
    .createMenu('Canva on Trial')
    .addItem('Reset Game Session', 'resetGameSession')
    .addToUi();
}

/**
 * Cleanly reset game session (Private to sheet editors):
 * 1. Restores canonical headers in row 1 if missing or altered
 * 2. Clears player data rows below header row on the Players sheet (row 2 downwards ONLY)
 *    NEVER clears or replaces the header row!
 * 3. Clears shared lobby start time, session ID, and request ID mappings in ScriptProperties
 */
function resetGameSession() {
  try {
    var sheet = getPlayersSheet();
    ensurePlayersHeaders(sheet);
    var lastRow = sheet.getLastRow();
    // Only clear player rows from row 2 downwards; NEVER clear or replace row 1 (header row)
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 3).clearContent();
    }
    PropertiesService.getScriptProperties().deleteAllProperties();
    SpreadsheetApp.flush();
    SpreadsheetApp.getUi().alert('Canva on Trial 2026: Game session reset cleanly on Players tab. Headers preserved and ready for a new game!');
  } catch (err) {
    SpreadsheetApp.getUi().alert('Reset Error: ' + err.message);
  }
}

/**
 * Handle POST requests (Player registration & score submission)
 * Automatic execution: no manual approval required.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = lock.tryLock(5000); // 5-second bounded lock for write operations

  if (!hasLock) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Server busy, please retry'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var sheet = getPlayersSheet();
    ensurePlayersHeaders(sheet);
    var props = PropertiesService.getScriptProperties();
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var requestId = data.requestId || '';
    var name = (data.name || '').trim();
    var now = new Date();
    var serverTime = now.getTime();

    // -------------------------------------------------------------
    // OPERATION 1: JOIN (Register new player)
    // -------------------------------------------------------------
    if (action === 'join') {
      var sessionId = props.getProperty('SESSION_ID');
      var lobbyStartTime = props.getProperty('LOBBY_START_TIME');

      // Require a valid, non-empty requestId for new registrations
      if (!requestId || String(requestId).trim() === '') {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          code: 'MISSING_REQUEST_ID',
          message: 'Missing required registration request identifier'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Idempotency check: if this exact requestId was already processed, return original record
      var existingRecordStr = props.getProperty('REQ_' + requestId);
      if (existingRecordStr) {
        var existing = JSON.parse(existingRecordStr);
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          action: 'join',
          isRetry: true,
          sessionId: sessionId || existing.sessionId || ('sess_' + (lobbyStartTime || serverTime)),
          player: existing,
          rowIndex: existing.rowIndex,
          requestId: existing.requestId || requestId,
          lobbyStartTime: Number(lobbyStartTime || existing.serverTimestamp),
          serverTime: serverTime
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Check if session ID is set; if not, generate a fresh session ID
      if (!sessionId) {
        sessionId = 'sess_' + serverTime + '_' + Math.random().toString(36).substring(2, 8);
        props.setProperty('SESSION_ID', sessionId);
      }

      // Check if lobby start time is already established
      if (!lobbyStartTime) {
        // Inspect if sheet already has an earlier registered player
        var existingRows = sheet.getDataRange().getValues();
        for (var r = 1; r < existingRows.length; r++) {
          var existingTs = existingRows[r][0];
          var existingName = existingRows[r][1];
          // Exclude headers and blank rows
          if (existingName && existingName !== 'Name' && String(existingName).trim() !== '' && existingTs) {
            var parsedTime = new Date(existingTs).getTime();
            if (!isNaN(parsedTime) && parsedTime > 0) {
              lobbyStartTime = parsedTime.toString();
              break;
            }
          }
        }
        // If no earlier player in sheet, THIS registration is Player 1 and establishes the clock
        if (!lobbyStartTime) {
          lobbyStartTime = serverTime.toString();
        }
        props.setProperty('LOBBY_START_TIME', lobbyStartTime);
      }

      // Late Join Check: If the 90-second lobby has already closed, reject new player registration
      var elapsedSinceLobbyStart = serverTime - Number(lobbyStartTime);
      if (elapsedSinceLobbyStart >= 90000) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          code: 'LOBBY_CLOSED',
          message: 'The investigation has already begun. Watch the main screen.',
          sessionId: sessionId,
          lobbyStartTime: Number(lobbyStartTime),
          serverTime: serverTime
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Append new player record: [Timestamp, Name, Score (blank)]
      // Two players with identical nicknames are both appended as separate rows
      sheet.appendRow([now, name, '']);
      SpreadsheetApp.flush();

      var rowIndex = sheet.getLastRow();
      var playerObj = {
        rowIndex: rowIndex,
        name: name,
        requestId: requestId,
        sessionId: sessionId,
        timestamp: now.toISOString(),
        serverTimestamp: serverTime
      };

      // Save requestId mapping for safe retry idempotency and score submission verification
      props.setProperty('REQ_' + requestId, JSON.stringify(playerObj));

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        action: 'join',
        sessionId: sessionId,
        player: playerObj,
        rowIndex: rowIndex,
        requestId: requestId,
        lobbyStartTime: Number(lobbyStartTime),
        serverTime: serverTime
      })).setMimeType(ContentService.MimeType.JSON);

    // -------------------------------------------------------------
    // OPERATION 2: SUBMIT SCORE (Update existing player row by rowIndex & requestId)
    // -------------------------------------------------------------
    } else if (action === 'submitScore') {
      var targetRow = data.rowIndex ? parseInt(data.rowIndex, 10) : null;
      var clientSessionId = data.sessionId || '';
      var activeSessionId = props.getProperty('SESSION_ID');
      var clientRequestId = data.requestId || '';

      // If activeSessionId is missing from properties, safely derive from lobbyStartTime or first player
      if (!activeSessionId) {
        var existingLobby = props.getProperty('LOBBY_START_TIME');
        if (!existingLobby && sheet.getLastRow() > 1) {
          var fTs = sheet.getRange(2, 1).getValue();
          if (fTs) {
            var fPt = new Date(fTs).getTime();
            if (!isNaN(fPt) && fPt > 0) existingLobby = fPt.toString();
          }
        }
        if (existingLobby) {
          activeSessionId = 'sess_' + existingLobby;
          props.setProperty('SESSION_ID', activeSessionId);
        }
      }

      // 1. Session validation: verify browser sessionId matches active session
      if (!clientSessionId || !activeSessionId || clientSessionId !== activeSessionId) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          code: 'SESSION_MISMATCH',
          message: 'Session expired or invalid. Score submission rejected.'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 2. Row index validation: must be a valid existing data row (> 1 and <= lastRow)
      if (!targetRow || isNaN(targetRow) || targetRow <= 1 || targetRow > sheet.getLastRow()) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          code: 'INVALID_ROW_INDEX',
          message: 'Invalid or missing rowIndex. Score submission rejected.'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 3. Request ID validation: original registration requestId must be present and exist in PropertiesService
      if (!clientRequestId || String(clientRequestId).trim() === '') {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          code: 'MISSING_REQUEST_ID',
          message: 'Missing original registration requestId. Score submission rejected.'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var savedRecordStr = props.getProperty('REQ_' + clientRequestId);
      if (!savedRecordStr) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          code: 'UNKNOWN_REQUEST_ID',
          message: 'Registration requestId not found in active session properties. Score submission rejected.'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 4. Verification that requestId maps to the exact submitted row Index and player
      var savedRecord = JSON.parse(savedRecordStr);
      var savedRow = Number(savedRecord.rowIndex);
      var reqName = String(savedRecord.name || '').trim().toLowerCase();
      if (isNaN(savedRow) || savedRow !== targetRow || reqName !== name.toLowerCase()) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          code: 'REQUEST_MISMATCH',
          message: 'Registration requestId does not match submitted rowIndex or player name. Score submission rejected.'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 5. Verification that target spreadsheet row contains the registered player name
      var rowName = sheet.getRange(targetRow, 2).getValue();
      if (!rowName || String(rowName).trim().toLowerCase() !== name.toLowerCase()) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          code: 'PLAYER_MISMATCH',
          message: 'Target row does not match registered player name. Score submission rejected.'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 5. Validate score: must be a valid, finite number (numeric zero is valid)
      var scoreNum = null;
      if (typeof data.score === 'number' && isFinite(data.score)) {
        scoreNum = data.score;
      } else if (typeof data.score === 'string' && data.score.trim() !== '') {
        var parsedScore = Number(data.score.trim());
        if (!isNaN(parsedScore) && isFinite(parsedScore)) {
          scoreNum = parsedScore;
        }
      }

      if (scoreNum === null) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          code: 'INVALID_SCORE',
          message: 'Score must be a valid finite number. Missing or invalid score rejected.'
        })).setMimeType(ContentService.MimeType.JSON);
      }
      var score = scoreNum;

      // 6. Strictly update Column C (Score) for the assigned row
      sheet.getRange(targetRow, 3).setValue(score);
      SpreadsheetApp.flush();

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        action: 'submitScore',
        rowIndex: targetRow,
        score: score,
        updated: true
      })).setMimeType(ContentService.MimeType.JSON);

    // -------------------------------------------------------------
    // OPERATION 3: STATE / LEADERBOARD (Backward-compatibility for legacy POST callers)
    // -------------------------------------------------------------
    } else if (action === 'state' || action === 'leaderboard') {
      return doGet(e);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Unknown action'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

/**
 * Handle GET requests (Lock-free state, player roster & compilation leaderboard)
 * Automatic execution: no manual approval required.
 */
function doGet(e) {
  try {
    var sheet = getPlayersSheet();
    ensurePlayersHeaders(sheet);
    var props = PropertiesService.getScriptProperties();
    var rows = sheet.getDataRange().getValues();
    var serverTime = new Date().getTime();
    var players = [];

    var totalPlayers = 0;
    var scoresSubmitted = 0;
    var scoresPending = 0;

    // Filter out blank rows and header row
    for (var i = 0; i < rows.length; i++) {
      var ts = rows[i][0];
      var name = rows[i][1];
      var rawScore = rows[i][2];

      // Exclude empty rows and header row (Name === "Name")
      if (!name || name === 'Name' || String(name).trim() === '') {
        continue;
      }

      totalPlayers++;

      // A blank score is pending; only valid numeric scores count as submitted
      // Invalid nonempty values (e.g. text errors, symbols) are NOT counted as submitted and remain pending
      var isBlank = (rawScore === '' || rawScore === null || rawScore === undefined);
      var isValidNumeric = false;
      var scoreVal = 0;

      if (!isBlank) {
        if (typeof rawScore === 'number' && isFinite(rawScore)) {
          isValidNumeric = true;
          scoreVal = rawScore;
        } else if (typeof rawScore === 'string' && rawScore.trim() !== '') {
          var parsed = Number(rawScore.trim());
          if (!isNaN(parsed) && isFinite(parsed)) {
            isValidNumeric = true;
            scoreVal = parsed;
          }
        }
      }

      var hasScore = isValidNumeric;
      var isPending = !isValidNumeric;

      if (hasScore) {
        scoresSubmitted++;
      } else {
        scoresPending++;
      }

      players.push({
        rowIndex: i + 1, // Exact 1-based spreadsheet row
        name: String(name).trim(),
        score: scoreVal,
        stoppedAt: scoreVal, // Backward-compatible alias for legacy frontend
        hasScore: hasScore,
        isPending: isPending,
        timestamp: ts ? (ts instanceof Date ? ts.toISOString() : ts.toString()) : ''
      });
    }

    var allScoresSubmitted = (totalPlayers > 0) && (scoresPending === 0);

    var sessionId = props.getProperty('SESSION_ID');
    var lobbyStartTime = props.getProperty('LOBBY_START_TIME');

    // If players exist in sheet but lobbyStartTime was missing in properties,
    // safely derive anchor from the first player's registration timestamp:
    if (players.length > 0 && !lobbyStartTime && players[0].timestamp) {
      var anchorTime = new Date(players[0].timestamp).getTime();
      if (!isNaN(anchorTime) && anchorTime > 0) {
        lobbyStartTime = anchorTime.toString();
        props.setProperty('LOBBY_START_TIME', lobbyStartTime);
      }
    }
    if (players.length > 0 && !sessionId && lobbyStartTime) {
      sessionId = 'sess_' + lobbyStartTime;
      props.setProperty('SESSION_ID', sessionId);
    }

    // Sort descending by score, tiebreak by earlier registration timestamp
    players.sort(function(a, b) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      var tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      var tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tA - tB;
    });

    var isClosed = lobbyStartTime ? (serverTime - Number(lobbyStartTime) >= 90000) : false;

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      sessionId: sessionId || null,
      serverTime: serverTime,
      lobbyStartTime: lobbyStartTime ? Number(lobbyStartTime) : null,
      isLobbyClosed: isClosed,
      totalPlayers: totalPlayers,
      scoresSubmitted: scoresSubmitted,
      scoresPending: scoresPending,
      allScoresSubmitted: allScoresSubmitted,
      players: players
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString(),
      totalPlayers: 0,
      scoresSubmitted: 0,
      scoresPending: 0,
      allScoresSubmitted: false,
      players: []
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
