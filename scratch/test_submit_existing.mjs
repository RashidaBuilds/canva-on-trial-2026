const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzFiVWrf8LemODgRwqw1vwB31zeArLwghK3cyuZ95Xw6SsvYMpIiq1jHCFAshokrqW2/exec';

async function testSubmitExisting() {
  console.log('--- Testing submitScore for existing player rasha (rowIndex: 2, score: 850) ---');
  
  // Try 1: with requestId
  const payload1 = JSON.stringify({
    action: 'submitScore',
    clientId: 'c_test_client',
    sessionId: 'sess_1795324663573_iuzvna',
    requestId: 'req_rasha_1',
    rowIndex: 2,
    name: 'rasha',
    score: 850,
    timestamp: new Date().toISOString()
  });

  const res1 = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: payload1
  });
  console.log('HTTP status:', res1.status);
  const text1 = await res1.text();
  console.log('Response body:', text1);
}

testSubmitExisting().catch(console.error);
