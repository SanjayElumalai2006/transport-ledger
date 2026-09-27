import assert from 'node:assert';
import { safeParseJsonResponse, loginWithGoogle, registerUser, loginUser, logoutUser } from '../js/storage.js';

// Setup Mock Window & LocalStorage
const localStorageMock = (function () {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

globalThis.localStorage = localStorageMock;
globalThis.window = {
  dispatchEvent: () => true
};

console.log('================================================================');
console.log('🧪 RUNNING SERVERLESS & GOOGLE LOGIN RESILIENCE TESTS');
console.log('================================================================\n');

async function runTests() {
  // Test 1: safeParseJsonResponse on HTML 500 string
  console.log('--- 1. Non-JSON Vercel 500 Error Parsing ---');
  const mock500HtmlResponse = {
    ok: false,
    status: 500,
    text: async () => 'A server error occurred on the serverless execution\nFUNCTION_INVOCATION_FAILED'
  };

  const parsed = await safeParseJsonResponse(mock500HtmlResponse);
  assert.strictEqual(parsed.ok, false);
  assert.strictEqual(parsed.status, 500);
  assert.strictEqual(parsed.data, null);
  assert.ok(parsed.rawText.startsWith('A server error'));
  console.log('  ✓ safeParseJsonResponse intercepts HTML 500 without throwing SyntaxError');

  // Test 2: safeParseJsonResponse on valid JSON
  console.log('\n--- 2. Valid JSON Parsing ---');
  const mockJsonResponse = {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true, message: 'OK' })
  };
  const parsedJson = await safeParseJsonResponse(mockJsonResponse);
  assert.strictEqual(parsedJson.ok, true);
  assert.strictEqual(parsedJson.data.success, true);
  console.log('  ✓ safeParseJsonResponse parses valid JSON correctly');

  // Test 3: Google Login fallback when server responds with 500 "A server error..."
  console.log('\n--- 3. Google Login Resilience (Vercel Serverless 500 simulation) ---');
  globalThis.fetch = async (url) => {
    return {
      ok: false,
      status: 500,
      text: async () => 'A server error occurred on the serverless execution'
    };
  };

  localStorage.clear();
  const googleRes = await loginWithGoogle({
    email: 'newuser@transporter.com',
    name: 'New Transporter',
    businessName: 'Express Cargo'
  });

  assert.strictEqual(googleRes.success, true);
  assert.strictEqual(googleRes.user.email, 'newuser@transporter.com');
  assert.strictEqual(googleRes.user.name, 'New Transporter');
  assert.ok(localStorage.getItem('transport_ledger_auth_token'));
  assert.ok(localStorage.getItem('transport_ledger_auth_user'));
  console.log('  ✓ Google Sign-in gracefully succeeded despite Vercel 500 response!');
  console.log('  ✓ User session token saved to localStorage: ' + localStorage.getItem('transport_ledger_auth_token').substring(0, 25) + '...');

  // Test 4: New User Registration fallback when server returns 500
  console.log('\n--- 4. New User Registration Resilience ---');
  const regRes = await registerUser({
    name: 'Sanjay Logistician',
    businessName: 'Sanjay Express Lines',
    email: 'sanjay.express@gmail.com',
    password: 'securepassword123'
  });

  assert.strictEqual(regRes.success, true);
  assert.strictEqual(regRes.user.email, 'sanjay.express@gmail.com');
  console.log('  ✓ New user enrolled successfully and session created even with 500 server!');

  // Test 5: Login with local credentials when server returns 500
  console.log('\n--- 5. Local User Login with Offline Engine ---');
  await logoutUser();
  assert.strictEqual(localStorage.getItem('transport_ledger_auth_token'), null);

  const loginRes = await loginUser('sanjay.express@gmail.com', 'securepassword123');
  assert.strictEqual(loginRes.success, true);
  assert.strictEqual(loginRes.user.email, 'sanjay.express@gmail.com');
  console.log('  ✓ User logged in successfully using local offline credentials!');

  console.log('\n================================================================');
  console.log('🎉 ALL SERVERLESS & GOOGLE LOGIN RESILIENCE TESTS PASSED (5/5)!');
  console.log('================================================================\n');
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
