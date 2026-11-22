import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// -------------------------------------------------------------
// 1. In-Memory Google Apps Script Mock Environment
// -------------------------------------------------------------
class MockRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row; // 1-based
    this.col = col; // 1-based
    this.numRows = numRows;
    this.numCols = numCols;
  }

  getValues() {
    const result = [];
    for (let r = 0; r < this.numRows; r++) {
      const rowArr = [];
      const rowIndex = this.row - 1 + r;
      for (let c = 0; c < this.numCols; c++) {
        const colIndex = this.col - 1 + c;
        if (this.sheet.grid[rowIndex] && this.sheet.grid[rowIndex][colIndex] !== undefined) {
          rowArr.push(this.sheet.grid[rowIndex][colIndex]);
        } else {
          rowArr.push('');
        }
      }
      result.push(rowArr);
    }
    return result;
  }

  getValue() {
    const vals = this.getValues();
    return vals[0] ? vals[0][0] : '';
  }

  setValues(values) {
    for (let r = 0; r < values.length; r++) {
      const rowIndex = this.row - 1 + r;
      if (!this.sheet.grid[rowIndex]) {
        this.sheet.grid[rowIndex] = [];
      }
      for (let c = 0; c < values[r].length; c++) {
        const colIndex = this.col - 1 + c;
        this.sheet.grid[rowIndex][colIndex] = values[r][c];
      }
    }
  }

  setValue(val) {
    this.setValues([[val]]);
  }

  clearContent() {
    for (let r = 0; r < this.numRows; r++) {
      const rowIndex = this.row - 1 + r;
      if (this.sheet.grid[rowIndex]) {
        for (let c = 0; c < this.numCols; c++) {
          const colIndex = this.col - 1 + c;
          this.sheet.grid[rowIndex][colIndex] = '';
        }
      }
    }
  }
}

class MockSheet {
  constructor(name) {
    this.name = name;
    this.grid = []; // 2D array of rows
  }

  getLastRow() {
    // Find the last row with any non-empty content
    for (let r = this.grid.length - 1; r >= 0; r--) {
      if (this.grid[r] && this.grid[r].some((cell) => cell !== '' && cell !== null && cell !== undefined)) {
        return r + 1; // 1-based
      }
    }
    return 0;
  }

  appendRow(rowArr) {
    const nextRow = this.getLastRow();
    this.grid[nextRow] = [...rowArr];
  }

  getRange(row, col, numRows = 1, numCols = 1) {
    return new MockRange(this, row, col, numRows, numCols);
  }

  getDataRange() {
    const lastRow = Math.max(1, this.getLastRow());
    let maxCols = 3;
    for (let r = 0; r < lastRow; r++) {
      if (this.grid[r]) {
        maxCols = Math.max(maxCols, this.grid[r].length);
      }
    }
    return new MockRange(this, 1, 1, lastRow, maxCols);
  }
}

class MockSpreadsheet {
  constructor() {
    this.sheets = {
      Players: new MockSheet('Players')
    };
  }

  getSheetByName(name) {
    return this.sheets[name] || null;
  }
}

class MockProperties {
  constructor() {
    this.props = {};
  }

  getProperty(key) {
    return this.props[key] !== undefined ? this.props[key] : null;
  }

  setProperty(key, val) {
    this.props[key] = String(val);
  }

  deleteAllProperties() {
    this.props = {};
  }
}

function createGASContext(ss, props) {
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      flush: () => {},
      getUi: () => ({
        alert: (msg) => { console.log('UI Alert:', msg); },
        createMenu: () => ({
          addItem: () => ({ addToUi: () => {} })
        })
      })
    },
    PropertiesService: {
      getScriptProperties: () => props
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => true,
        releaseLock: () => {}
      })
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (str) => ({
        setMimeType: () => JSON.parse(str)
      })
    },
    console: console,
    Date: Date,
    JSON: JSON,
    Number: Number,
    String: String,
    parseInt: parseInt,
    isNaN: isNaN,
    isFinite: isFinite,
    Math: Math
  };
  return vm.createContext(context);
}

// -------------------------------------------------------------
// 2. Load and evaluate Code.gs in VM
// -------------------------------------------------------------
const codePath = path.resolve('google-apps-script/Code.gs');
const codeContent = fs.readFileSync(codePath, 'utf8');

const mockSpreadsheet = new MockSpreadsheet();
const mockProperties = new MockProperties();
const gasContext = createGASContext(mockSpreadsheet, mockProperties);

vm.runInContext(codeContent, gasContext);

// GAS Functions under test
const { doPost, doGet, ensurePlayersHeaders, resetGameSession } = gasContext;

// -------------------------------------------------------------
// 3. Simulated Client localStorage & Frontend Service Adapter
// -------------------------------------------------------------
const STORAGE_KEYS = {
  CLIENT_ID: 'canva_trial_2026_client_id',
  SESSION_ID: 'canva_trial_2026_session_id',
  ROW_INDEX: 'canva_trial_2026_row_index',
  REQUEST_ID: 'canva_trial_2026_request_id',
  START_TIME: 'canva_trial_2026_start_time',
  PLAYER_NAME: 'canva_trial_2026_player_name',
  PLAYER_SCORE: 'canva_trial_2026_player_score',
  SCORE_CONFIRMED: 'canva_trial_2026_score_confirmed'
};

class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) { return this.store[k] !== undefined ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

// Frontend client functions mirroring src/services/api.js exactly
function clientJoin(nickname, clientStorage) {
  const trimmed = (nickname || '').trim();
  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  clientStorage.setItem(STORAGE_KEYS.REQUEST_ID, requestId);
  clientStorage.setItem(STORAGE_KEYS.PLAYER_NAME, trimmed);
  clientStorage.setItem(STORAGE_KEYS.PLAYER_SCORE, '0');
  clientStorage.removeItem(STORAGE_KEYS.SCORE_CONFIRMED);

  // Send join POST
  const postPayload = {
    contents: JSON.stringify({
      action: 'join',
      clientId: 'mock_client_' + Math.random().toString(36).substring(2, 8),
      requestId: requestId,
      name: trimmed,
      timestamp: new Date().toISOString()
    })
  };

  const res = doPost({ postData: postPayload });

  if (res && res.status === 'success') {
    if (res.sessionId) clientStorage.setItem(STORAGE_KEYS.SESSION_ID, res.sessionId);
    if (res.rowIndex) clientStorage.setItem(STORAGE_KEYS.ROW_INDEX, String(res.rowIndex));
    if (res.requestId) clientStorage.setItem(STORAGE_KEYS.REQUEST_ID, res.requestId);
    if (res.lobbyStartTime) clientStorage.setItem(STORAGE_KEYS.START_TIME, String(res.lobbyStartTime));
    return { success: true, res };
  }
  return { success: false, res };
}

function clientSubmitFinalScore(nickname, score, clientStorage, overrideRow = null, overrideReqId = null, overrideSessionId = null) {
  const rawRow = overrideRow || clientStorage.getItem(STORAGE_KEYS.ROW_INDEX);
  const savedRowIndex = rawRow ? parseInt(rawRow, 10) : null;
  const sessionId = (overrideSessionId || clientStorage.getItem(STORAGE_KEYS.SESSION_ID) || '').trim();
  const requestId = (overrideReqId || clientStorage.getItem(STORAGE_KEYS.REQUEST_ID) || '').trim();

  let numScore = null;
  if (typeof score === 'number' && isFinite(score)) {
    numScore = score;
  } else if (typeof score === 'string' && score.trim() !== '') {
    const p = Number(score.trim());
    if (!isNaN(p) && isFinite(p)) numScore = p;
  }

  const postPayload = {
    contents: JSON.stringify({
      action: 'submitScore',
      clientId: 'mock_client',
      sessionId: sessionId,
      requestId: requestId,
      rowIndex: savedRowIndex,
      name: nickname,
      score: numScore,
      timestamp: new Date().toISOString()
    })
  };

  const res = doPost({ postData: postPayload });

  if (res && res.status === 'success' && res.updated) {
    clientStorage.setItem(STORAGE_KEYS.SCORE_CONFIRMED, 'true');
    return { success: true, res };
  }
  return { success: false, res };
}

// -------------------------------------------------------------
// 4. Test Suite Execution
// -------------------------------------------------------------
console.log('========================================================');
console.log('CANVA ON TRIAL 2026 - COMPLETE BACKEND & FLOW VERIFICATION');
console.log('========================================================\n');

let allPassed = true;
function assert(desc, condition) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
  } else {
    console.error(`[FAIL] ${desc}`);
    allPassed = false;
  }
}

// -------------------------------------------------------------
// TEST 1: Canonical Headers Initialization
// -------------------------------------------------------------
console.log('--- TEST 1: Canonical Headers Initialization ---');
const sheet = mockSpreadsheet.getSheetByName('Players');
ensurePlayersHeaders(sheet);
assert('Row 1 contains exactly 3 canonical headers', sheet.getLastRow() === 1);
const headers = sheet.getRange(1, 1, 1, 3).getValues()[0];
assert('A1 is Timestamp', headers[0] === 'Timestamp');
assert('B1 is Name', headers[1] === 'Name');
assert('C1 is Score', headers[2] === 'Score');

// -------------------------------------------------------------
// TEST 2: Controlled Single Player Test (Alex)
// -------------------------------------------------------------
console.log('\n--- TEST 2: Controlled Single Player Registration & Submission ---');
const alexStorage = new MockLocalStorage();
const joinRes1 = clientJoin('Alex', alexStorage);

assert('Player Alex registration succeeded', joinRes1.success === true);
const alexRow = parseInt(alexStorage.getItem(STORAGE_KEYS.ROW_INDEX), 10);
const alexReqId = alexStorage.getItem(STORAGE_KEYS.REQUEST_ID);
const alexSessionId = alexStorage.getItem(STORAGE_KEYS.SESSION_ID);

assert('Alex assigned rowIndex is row 2', alexRow === 2);
assert('Alex requestId exists in client storage and starts with req_', !!alexReqId && alexReqId.startsWith('req_'));
assert('Alex sessionId exists in client storage', !!alexSessionId);

// Check Apps Script PropertiesService
const storedPropAlex = mockProperties.getProperty('REQ_' + alexReqId);
assert('Apps Script PropertiesService stores REQ_<alexReqId>', !!storedPropAlex);
const parsedPropAlex = JSON.parse(storedPropAlex);
assert('Stored mapping contains correct rowIndex', parsedPropAlex.rowIndex === 2);
assert('Stored mapping contains correct name Alex', parsedPropAlex.name === 'Alex');
assert('Stored mapping contains correct requestId', parsedPropAlex.requestId === alexReqId);
assert('Stored mapping contains correct sessionId', parsedPropAlex.sessionId === alexSessionId);

// Check Google Sheet data
assert('Row 2 Column B contains name Alex', sheet.getRange(2, 2).getValue() === 'Alex');
assert('Row 2 Column C is initially empty', sheet.getRange(2, 3).getValue() === '');

// Submit score 750 for Alex
const alexScoreRes = clientSubmitFinalScore('Alex', 750, alexStorage);
assert('submitFinalScore for Alex returned success and updated: true', alexScoreRes.success === true && alexScoreRes.res.updated === true);
assert('Client storage marks score confirmed ONLY upon success', alexStorage.getItem(STORAGE_KEYS.SCORE_CONFIRMED) === 'true');

// Verify Column C in sheet was updated
assert('Row 2 Column C now contains numeric score 750', sheet.getRange(2, 3).getValue() === 750);

// Perform doGet() and verify
const getRes1 = doGet({});
const alexGetRecord = getRes1.players.find((p) => p.name === 'Alex');
assert('doGet returns Alex in player list', !!alexGetRecord);
assert('Alex record has score 750', alexGetRecord.score === 750);
assert('Alex record has hasScore: true', alexGetRecord.hasScore === true);
assert('Alex record has isPending: false', alexGetRecord.isPending === false);
assert('getRes1 scoresSubmitted is at least 1', getRes1.scoresSubmitted >= 1);

// -------------------------------------------------------------
// TEST 3: Controlled Zero-Score Player Test (Jordan)
// -------------------------------------------------------------
console.log('\n--- TEST 3: Player Scoring 0 Points (Jordan) ---');
const jordanStorage = new MockLocalStorage();
const joinRes2 = clientJoin('Jordan', jordanStorage);
assert('Player Jordan registration succeeded', joinRes2.success === true);
const jordanRow = parseInt(jordanStorage.getItem(STORAGE_KEYS.ROW_INDEX), 10);
assert('Jordan assigned rowIndex is row 3', jordanRow === 3);

// Submit numeric 0
const jordanScoreRes = clientSubmitFinalScore('Jordan', 0, jordanStorage);
assert('submitFinalScore with score 0 succeeded', jordanScoreRes.success === true && jordanScoreRes.res.updated === true);
assert('Row 3 Column C contains numeric 0 (not blank)', sheet.getRange(3, 3).getValue() === 0);

const getRes2 = doGet({});
const jordanGetRecord = getRes2.players.find((p) => p.name === 'Jordan');
assert('Jordan has score 0 in doGet', jordanGetRecord.score === 0);
assert('Jordan hasScore is true (valid numeric zero)', jordanGetRecord.hasScore === true);
assert('Jordan isPending is false', jordanGetRecord.isPending === false);

// -------------------------------------------------------------
// TEST 4: Two Players with Identical Nicknames ("Jane" & "Jane")
// -------------------------------------------------------------
console.log('\n--- TEST 4: Two Players with Identical Nicknames ("Jane" & "Jane") ---');
const jane1Storage = new MockLocalStorage();
const jane2Storage = new MockLocalStorage();

const j1Join = clientJoin('Jane', jane1Storage);
const j2Join = clientJoin('Jane', jane2Storage);

assert('Jane 1 registration succeeded', j1Join.success === true);
assert('Jane 2 registration succeeded', j2Join.success === true);

const j1Row = parseInt(jane1Storage.getItem(STORAGE_KEYS.ROW_INDEX), 10);
const j2Row = parseInt(jane2Storage.getItem(STORAGE_KEYS.ROW_INDEX), 10);
const j1Req = jane1Storage.getItem(STORAGE_KEYS.REQUEST_ID);
const j2Req = jane2Storage.getItem(STORAGE_KEYS.REQUEST_ID);

assert('Jane 1 gets Row 4 and Jane 2 gets Row 5', j1Row === 4 && j2Row === 5);
assert('Jane 1 and Jane 2 have distinct requestIds', j1Req !== j2Req);

// Jane 1 submits score 900
const j1Score = clientSubmitFinalScore('Jane', 900, jane1Storage);
assert('Jane 1 submits score 900 successfully', j1Score.success === true);

// Jane 2 submits score 420
const j2Score = clientSubmitFinalScore('Jane', 420, jane2Storage);
assert('Jane 2 submits score 420 successfully', j2Score.success === true);

assert('Row 4 (Jane 1) Column C has score 900', sheet.getRange(4, 3).getValue() === 900);
assert('Row 5 (Jane 2) Column C has score 420', sheet.getRange(5, 3).getValue() === 420);

// Attack Scenario 1: Jane 1 attempts to overwrite Jane 2's row (Row 5) with Jane 1's requestId
const attack1 = clientSubmitFinalScore('Jane', 9999, jane1Storage, 5, j1Req);
assert('Overwriting another row with mismatched requestId is rejected (REQUEST_MISMATCH)',
  attack1.success === false && attack1.res.code === 'REQUEST_MISMATCH');

// Attack Scenario 2: Submit with fake/unknown requestId
const attack2 = clientSubmitFinalScore('Jane', 9999, jane1Storage, 4, 'fake_req_id');
assert('Submission with unknown requestId is rejected (UNKNOWN_REQUEST_ID)',
  attack2.success === false && attack2.res.code === 'UNKNOWN_REQUEST_ID');

// Attack Scenario 3: Submit with wrong sessionId
const attack3 = clientSubmitFinalScore('Jane', 9999, jane1Storage, 4, j1Req, 'fake_session');
assert('Submission with mismatched sessionId is rejected (SESSION_MISMATCH)',
  attack3.success === false && attack3.res.code === 'SESSION_MISMATCH');

// Verify scores were NOT tampered with
assert('Row 4 score remains 900', sheet.getRange(4, 3).getValue() === 900);
assert('Row 5 score remains 420', sheet.getRange(5, 3).getValue() === 420);

// Check doGet leaderboard ranking
const getRes3 = doGet({});
const janes = getRes3.players.filter((p) => p.name === 'Jane');
assert('doGet returns exactly two Jane records', janes.length === 2);
assert('First Jane has score 900 on row 4', janes[0].score === 900 && janes[0].rowIndex === 4);
assert('Second Jane has score 420 on row 5', janes[1].score === 420 && janes[1].rowIndex === 5);

// -------------------------------------------------------------
// TEST 5: Reset Game Session Preserves Row 1 Headers
// -------------------------------------------------------------
console.log('\n--- TEST 5: Reset Game Session Behavior ---');
resetGameSession();
assert('After reset, sheet has exactly 1 row (the header row)', sheet.getLastRow() === 1);
const resetHeaders = sheet.getRange(1, 1, 1, 3).getValues()[0];
assert('A1 remains Timestamp', resetHeaders[0] === 'Timestamp');
assert('B1 remains Name', resetHeaders[1] === 'Name');
assert('C1 remains Score', resetHeaders[2] === 'Score');
assert('All PropertiesService properties were cleared', Object.keys(mockProperties.props).length === 0);

console.log('\n========================================================');
if (allPassed) {
  console.log('ALL VERIFICATION CHECKS PASSED PERFECTLY!');
} else {
  console.error('SOME CHECKS FAILED!');
  process.exit(1);
}
console.log('========================================================');
