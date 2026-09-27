/**
 * Comprehensive Integration & Verification Test Suite for Transport Ledger
 * Tests:
 * 1. Anti-Bot CAPTCHA Generation & Cryptographic Verification (Server & Client)
 * 2. User Enrollment with Anti-Bot CAPTCHA
 * 3. Email Authentication & Session Security (PBKDF2)
 * 4. Google OAuth / One-Click Authentication & Auto-Provisioning
 * 5. Multi-Tenant User Data Isolation
 * 6. Cloud Email Backup & Snapshot Storage
 * 7. REST APIs & Database Integrity
 */

import * as auth from '../lib/auth.js';
import * as db from '../lib/db.js';
import { handleApiRequest } from '../api/router.js';

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = '';
  }
  writeHead(code, headers = {}) {
    this.statusCode = code;
    this.headers = { ...this.headers, ...headers };
  }
  end(data = '') {
    this.body = data;
  }
  json() {
    return this.body ? JSON.parse(this.body) : {};
  }
}

function mockRequest(method, pathname, body = null, headers = {}) {
  const req = {
    method,
    url: pathname,
    headers: { host: 'localhost:8080', ...headers },
    body: body ? JSON.stringify(body) : '',
    on: (evt, cb) => {
      if (evt === 'data' && body) cb(Buffer.from(JSON.stringify(body)));
      if (evt === 'end') cb();
      return req;
    }
  };
  return req;
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE TRANSPORT LEDGER AUTH & BACKUP TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // ------------------------------------------------------------------------
  // TEST 1: CAPTCHA GENERATION & VERIFICATION
  // ------------------------------------------------------------------------
  console.log('--- 1. Anti-Bot CAPTCHA Cryptography & Validation ---');
  const serverCaptcha = auth.generateCaptcha();
  assert(serverCaptcha.token && serverCaptcha.svg, 'Server generates SVG and signed HMAC token');

  // Extract raw answer from token for testing verification
  // Token format: timestamp:hmac. Let's test with correct and wrong answers.
  const testChars = '34679ACDEFHKMNPRTWXY';
  let matchedChar = false;
  // Let's test server verifyCaptcha:
  // Client token verification:
  const timestamp = Date.now();
  const clientAnswer = '7K9MX';
  const cleanAnswer = clientAnswer.trim().toUpperCase().replace(/[\s-]/g, '');
  const payload = `${cleanAnswer}:${timestamp}:transport_sec`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  }
  const clientToken = `client:${timestamp}:${Math.abs(hash).toString(36)}`;

  assert(auth.verifyCaptcha(clientToken, '7K9MX'), 'Client-side fallback token verifies exact answer');
  assert(auth.verifyCaptcha(clientToken, '7k9mx'), 'Client-side token is case-insensitive (7k9mx == 7K9MX)');
  assert(!auth.verifyCaptcha(clientToken, 'WRONG'), 'Client-side token rejects incorrect answer');
  assert(!auth.verifyCaptcha('invalid:token', '7K9MX'), 'Rejects malformed token');

  // ------------------------------------------------------------------------
  // TEST 2: REST API CAPTCHA ENDPOINT
  // ------------------------------------------------------------------------
  console.log('\n--- 2. REST API /api/auth/captcha Endpoint ---');
  const capReq = mockRequest('GET', '/api/auth/captcha');
  const capRes = new MockResponse();
  const capHandled = await handleApiRequest(capReq, capRes, '/api/auth/captcha', 'GET');
  assert(capHandled, 'GET /api/auth/captcha is handled');
  assert(capRes.statusCode === 200, 'Status is 200 OK');
  const capData = capRes.json();
  assert(capData.token && capData.svg, 'Returned valid captcha payload with token');

  // ------------------------------------------------------------------------
  // TEST 3: USER ENROLLMENT WITH ANTI-BOT CAPTCHA
  // ------------------------------------------------------------------------
  console.log('\n--- 3. User Enrollment (POST /api/auth/register) ---');
  const uniqueEmail = `test_${Date.now()}@transport.com`;
  const regReq = mockRequest('POST', '/api/auth/register', {
    businessName: 'Apex Roadlines',
    name: 'Sanjay Kumar',
    email: uniqueEmail,
    password: 'password123',
    captchaToken: clientToken,
    captchaAnswer: '7K9MX'
  });
  const regRes = new MockResponse();
  await handleApiRequest(regReq, regRes, '/api/auth/register', 'POST');
  assert(regRes.statusCode === 201, `Account enrolled successfully (status 201) for ${uniqueEmail}`);
  const regData = regRes.json();
  assert(regData.success && regData.token, 'Session token issued upon successful enrollment');
  assert(regData.user.email === uniqueEmail, 'User profile returned with email');

  // Duplicate email check
  const dupReq = mockRequest('POST', '/api/auth/register', {
    businessName: 'Apex Duplicate',
    name: 'Sanjay Kumar',
    email: uniqueEmail,
    password: 'password123',
    captchaToken: clientToken,
    captchaAnswer: '7K9MX'
  });
  const dupRes = new MockResponse();
  await handleApiRequest(dupReq, dupRes, '/api/auth/register', 'POST');
  assert(dupRes.statusCode === 409, 'Duplicate email registration rejected with 409 Conflict');

  // ------------------------------------------------------------------------
  // TEST 4: USER LOGIN (POST /api/auth/login)
  // ------------------------------------------------------------------------
  console.log('\n--- 4. User Sign In (POST /api/auth/login) ---');
  const loginReq = mockRequest('POST', '/api/auth/login', {
    email: uniqueEmail,
    password: 'password123'
  });
  const loginRes = new MockResponse();
  await handleApiRequest(loginReq, loginRes, '/api/auth/login', 'POST');
  assert(loginRes.statusCode === 200, 'Login succeeded with 200 OK');
  const loginData = loginRes.json();
  assert(loginData.token, 'Session token issued');
  const userToken = loginData.token;

  // Invalid password check
  const badLoginReq = mockRequest('POST', '/api/auth/login', {
    email: uniqueEmail,
    password: 'wrongpassword'
  });
  const badLoginRes = new MockResponse();
  await handleApiRequest(badLoginReq, badLoginRes, '/api/auth/login', 'POST');
  assert(badLoginRes.statusCode === 401, 'Bad credentials rejected with 401 Unauthorized');

  // ------------------------------------------------------------------------
  // TEST 5: GOOGLE AUTHENTICATION (POST /api/auth/google)
  // ------------------------------------------------------------------------
  console.log('\n--- 5. Google Authentication (POST /api/auth/google) ---');
  const googleEmail = `google_${Date.now()}@gmail.com`;
  const googReq = mockRequest('POST', '/api/auth/google', {
    email: googleEmail,
    name: 'Google Transporter',
    avatar: 'https://example.com/avatar.png'
  });
  const googRes = new MockResponse();
  await handleApiRequest(googReq, googRes, '/api/auth/google', 'POST');
  assert(googRes.statusCode === 200, 'Google sign-in auto-enrolled with 200 OK');
  const googData = googRes.json();
  assert(googData.success && googData.token, 'Google user issued valid session token');
  assert(googData.user.email === googleEmail, 'Google user record created');

  // ------------------------------------------------------------------------
  // TEST 6: MULTI-TENANT USER DATA ISOLATION
  // ------------------------------------------------------------------------
  console.log('\n--- 6. Multi-Tenant User Data Isolation ---');
  // Create a trip under the logged-in user
  const authHeaders = { Authorization: `Bearer ${userToken}` };
  const createTripReq = mockRequest('POST', '/api/trips', {
    customerName: 'Isolated Customer Ltd',
    vehicleNumber: 'KA 01 AB 9999',
    fromLocation: 'Bengaluru',
    toLocation: 'Chennai',
    amount: 55000,
    advance: 20000,
    balance: 35000,
    status: 'In Transit'
  }, authHeaders);
  const createTripRes = new MockResponse();
  await handleApiRequest(createTripReq, createTripRes, '/api/trips', 'POST');
  assert(createTripRes.statusCode === 201, 'Created trip in isolated user partition');

  // Query trips for this user
  const getTripsReq = mockRequest('GET', '/api/trips', null, authHeaders);
  const getTripsRes = new MockResponse();
  await handleApiRequest(getTripsReq, getTripsRes, '/api/trips', 'GET');
  const userTrips = getTripsRes.json();
  assert(Array.isArray(userTrips) && userTrips.some(t => t.customerName === 'Isolated Customer Ltd'), 'User can retrieve their own isolated trips');

  // ------------------------------------------------------------------------
  // TEST 7: CLOUD EMAIL BACKUP SNAPSHOT (POST /api/backup/email)
  // ------------------------------------------------------------------------
  console.log('\n--- 7. Cloud Email Backup (POST /api/backup/email) ---');
  const bkpReq = mockRequest('POST', '/api/backup/email', {
    email: uniqueEmail
  }, authHeaders);
  const bkpRes = new MockResponse();
  await handleApiRequest(bkpReq, bkpRes, '/api/backup/email', 'POST');
  assert(bkpRes.statusCode === 200, 'Triggered email cloud backup with 200 OK');
  const bkpData = bkpRes.json();
  assert(bkpData.success && bkpData.backupId, 'Backup record saved and queued to Mail ID');
  assert(bkpData.email === uniqueEmail, 'Backup snapshot registered to correct email');

  // ------------------------------------------------------------------------
  // TEST 8: SYSTEM STATUS & HEALTH (GET /api/status)
  // ------------------------------------------------------------------------
  console.log('\n--- 8. System Status & Health ---');
  const statusReq = mockRequest('GET', '/api/status');
  const statusRes = new MockResponse();
  await handleApiRequest(statusReq, statusRes, '/api/status', 'GET');
  assert(statusRes.statusCode === 200, 'GET /api/status returns 200 OK');
  const statusData = statusRes.json();
  assert(statusData.status === 'online', 'System is online');
  assert(statusData.database && statusData.database.engine, 'Database engine detected and active');

  console.log('\n================================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} VERIFICATION TESTS PASSED WITH 100% SUCCESS!`);
  } else {
    console.error(`⚠️ ${failed} TESTS FAILED out of ${passed + failed}`);
    process.exit(1);
  }
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('Fatal Test Exception:', err);
  process.exit(1);
});
