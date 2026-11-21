/**
 * Canva on Trial 2026 - Production Google Apps Script Backend
 * 
 * SPREADSHEET STRUCTURE: Exactly 3 columns
 * Column A: Timestamp
 * Column B: Name
 * Column C: Score
 * 
 * Features:
 * - Supports duplicate nicknames (each distinct join request receives its own row)
 * - Identifies players by their spreadsheet row index (no extra sheet columns)
 * - Idempotent retries via request ID in PropertiesService (never appends duplicate rows on retry)
 * - Shared 90s lobby countdown anchor established once by Player 1
 * - Individual server registration timestamp preserved in Column A
 * - Bounded write locks via LockService (5s); lock-free GET requests
 * - Authorized private reset menu for Google Sheets editors
 */

// Custom menu visible only to authorized Google Sheets editors
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Canva on Trial')
    .addItem('Reset Game Session', 'resetGameSession')
    .addToUi();
}

/**
 * Cleanly reset game session (Private to sheet editors):
 * 1. Clears player data rows below header row
 * 2. Clears shared lobby start time and request ID mappings in ScriptProperties
 */
function resetGameSession() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 3).clearContent();
  }
  PropertiesService.getScriptProperties().deleteAllProperties();
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert('Canva on Trial 2026: Game session reset cleanly. Ready for a new game!');
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
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var props = PropertiesService.getScriptProperties();
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var requestId = data.requestId || '';
    var name = (data.name || '').trim();
    var score = typeof data.score === 'number' ? data.score : 0;
    var now = new Date();
    var serverTime = now.getTime();

    // Ensure 3-column header exists if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Name', 'Score']);
    }

    // -------------------------------------------------------------
    // OPERATION 1: JOIN (Register new player)
    // -------------------------------------------------------------
    if (action === 'join') {
      var lobbyStartTime = props.getProperty('LOBBY_START_TIME');

      // Idempotency check: if this exact requestId was already processed, return original record
      if (requestId) {
        var existingRecordStr = props.getProperty('REQ_' + requestId);
        if (existingRecordStr) {
          var existing = JSON.parse(existingRecordStr);
          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            action: 'join',
            isRetry: true,
            player: existing,
            lobbyStartTime: Number(lobbyStartTime || existing.serverTimestamp),
            serverTime: serverTime
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      // First successful registration starts the shared 90s lobby countdown once
      if (!lobbyStartTime) {
        lobbyStartTime = serverTime.toString();
        props.setProperty('LOBBY_START_TIME', lobbyStartTime);
      }

      // Append new player record: [Timestamp, Name, Score (blank)]
      // Two players with identical nicknames are both appended as separate rows
      sheet.appendRow([now, name, '']);
      SpreadsheetApp.flush();

      var rowIndex = sheet.getLastRow();
      var playerObj = {
        rowIndex: rowIndex,
        name: name,
        timestamp: now.toISOString(),
        serverTimestamp: serverTime
      };

      // Save requestId mapping for safe retry idempotency
      if (requestId) {
        props.setProperty('REQ_' + requestId, JSON.stringify(playerObj));
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        action: 'join',
        player: playerObj,
        lobbyStartTime: Number(lobbyStartTime),
        serverTime: serverTime
      })).setMimeType(ContentService.MimeType.JSON);

    // -------------------------------------------------------------
    // OPERATION 2: SUBMIT SCORE (Update existing player row)
    // -------------------------------------------------------------
    } else if (action === 'submitScore') {
      var targetRow = data.rowIndex ? parseInt(data.rowIndex, 10) : null;

      // Update by rowIndex: allows duplicate nicknames to update their own row without collision
      if (targetRow && targetRow <= sheet.getLastRow() && targetRow > 1) {
        var existingName = sheet.getRange(targetRow, 2).getValue();
        // Update column 3 (Score) in the assigned row
        sheet.getRange(targetRow, 3).setValue(score);
        SpreadsheetApp.flush();

        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          action: 'submitScore',
          rowIndex: targetRow,
          score: score
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Fallback: match by name if rowIndex is missing
      var rows = sheet.getDataRange().getValues();
      var foundRow = -1;
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][1] === name) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow > 1) {
        sheet.getRange(foundRow, 3).setValue(score);
      } else {
        sheet.appendRow([now, name, score]);
        foundRow = sheet.getLastRow();
      }
      SpreadsheetApp.flush();

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        action: 'submitScore',
        rowIndex: foundRow,
        score: score
      })).setMimeType(ContentService.MimeType.JSON);
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
 * Handle GET requests (Lock-free state, player roster & leaderboard)
 * Automatic execution: no manual approval required.
 */
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var props = PropertiesService.getScriptProperties();
    var rows = sheet.getDataRange().getValues();
    var lobbyStartTime = props.getProperty('LOBBY_START_TIME');
    var players = [];

    // Filter out blank rows and header row
    for (var i = 0; i < rows.length; i++) {
      var ts = rows[i][0];
      var name = rows[i][1];
      var rawScore = rows[i][2];

      // Exclude empty rows and header row (Name === "Name")
      if (!name || name === 'Name' || String(name).trim() === '') {
        continue;
      }

      var scoreVal = 0;
      var hasScore = false;
      if (typeof rawScore === 'number') {
        scoreVal = rawScore;
        hasScore = true;
      } else if (rawScore !== '' && rawScore !== null && !isNaN(rawScore)) {
        scoreVal = parseInt(rawScore, 10);
        hasScore = true;
      }

      players.push({
        rowIndex: i + 1, // Exact 1-based spreadsheet row
        name: String(name).trim(),
        score: scoreVal,
        hasScore: hasScore,
        timestamp: ts ? (ts instanceof Date ? ts.toISOString() : ts.toString()) : ''
      });
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

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      serverTime: new Date().getTime(),
      lobbyStartTime: lobbyStartTime ? Number(lobbyStartTime) : null,
      players: players
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString(),
      players: []
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
