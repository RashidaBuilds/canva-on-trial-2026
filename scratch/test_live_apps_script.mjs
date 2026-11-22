// Global fetch is built into Node.js 18+
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzFiVWrf8LemODgRwqw1vwB31zeArLwghK3cyuZ95Xw6SsvYMpIiq1jHCFAshokrqW2/exec';

async function run() {
  console.log('--- 1. Testing GET on live deployed Apps Script ---');
  const getRes1 = await fetch(APPS_SCRIPT_URL + '?t=' + Date.now(), {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  console.log('GET status:', getRes1.status);
  const getJson1 = await getRes1.json();
  console.log('GET response:', JSON.stringify(getJson1, null, 2));

  console.log('\n--- 2. Testing POST join for Test_James ---');
  const reqIdJames = 'req_test_james_' + Date.now();
  const joinPayloadJames = JSON.stringify({
    action: 'join',
    clientId: 'c_test_james',
    requestId: reqIdJames,
    name: 'Test_James',
    timestamp: new Date().toISOString()
  });
  const joinResJames = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: joinPayloadJames
  });
  console.log('Join James HTTP status:', joinResJames.status);
  const joinTextJames = await joinResJames.text();
  console.log('Join James response body:', joinTextJames);

  let joinJsonJames = null;
  try {
    joinJsonJames = JSON.parse(joinTextJames);
  } catch (e) {
    console.error('Failed to parse Join James response as JSON');
  }

  const sessionId = joinJsonJames?.sessionId;
  const rowIndexJames = joinJsonJames?.rowIndex || joinJsonJames?.player?.rowIndex;
  console.log(`Extracted: sessionId=${sessionId}, rowIndexJames=${rowIndexJames}`);

  console.log('\n--- 3. Testing POST submitScore for Test_James (score: 0) ---');
  const scorePayloadJames = JSON.stringify({
    action: 'submitScore',
    clientId: 'c_test_james',
    sessionId: sessionId,
    requestId: reqIdJames,
    rowIndex: rowIndexJames,
    name: 'Test_James',
    score: 0,
    timestamp: new Date().toISOString()
  });
  const scoreResJames = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: scorePayloadJames
  });
  console.log('SubmitScore James HTTP status:', scoreResJames.status);
  const scoreTextJames = await scoreResJames.text();
  console.log('SubmitScore James response body:', scoreTextJames);

  console.log('\n--- 4. Testing GET after score submission ---');
  const getRes2 = await fetch(APPS_SCRIPT_URL + '?t=' + Date.now(), {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  const getJson2 = await getRes2.json();
  console.log('GET response after submission:', JSON.stringify(getJson2, null, 2));
}

run().catch(console.error);
