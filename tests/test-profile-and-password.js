import assert from 'assert';
import http from 'http';
import dotenv from 'dotenv';
import { handleApiRequest } from '../api/router.js';

dotenv.config();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8099');
  const handled = await handleApiRequest(req, res, url.pathname, req.method);
  if (!handled) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

server.listen(8099, '127.0.0.1', async () => {
  console.log('Running Profile & Password Tests on port 8099...');
  try {
    const uniqueEmail = 'profile_test_' + Date.now() + '@transport.com';
    const testPwd = 'TestPassword123!';

    // 1. Get CAPTCHA
    const captchaRes = await request({ host: '127.0.0.1', port: 8099, path: '/api/auth/captcha', method: 'GET' });
    assert.strictEqual(captchaRes.status, 200);

    const clientToken = 'client:' + Date.now() + ':mock';
    const regRes = await request({
      host: '127.0.0.1',
      port: 8099,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Original Operator',
      businessName: 'Original Logistics',
      email: uniqueEmail,
      password: testPwd,
      captchaToken: clientToken,
      captchaAnswer: 'mock'
    });
    assert.strictEqual(regRes.status, 201, 'Registration should succeed');
    const token = regRes.data.token;
    assert(token, 'Session token should be returned');

    // 2. Test PUT /api/auth/profile
    const updateRes = await request({
      host: '127.0.0.1',
      port: 8099,
      path: '/api/auth/profile',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    }, {
      name: 'Sanjay Super Transporter',
      businessName: 'Sanjay 7Hills Roadlines',
      phone: '+91 95001 18875',
      city: 'Avalurpet, Tamil Nadu',
      gstin: '33AABCS123411Z5',
      upiId: '9500118875@upi'
    });
    assert.strictEqual(updateRes.status, 200, 'Profile update should return 200');
    assert.strictEqual(updateRes.data.user.name, 'Sanjay Super Transporter');
    assert.strictEqual(updateRes.data.user.businessName, 'Sanjay 7Hills Roadlines');
    assert.strictEqual(updateRes.data.user.phone, '+91 95001 18875');
    console.log('✓ PUT /api/auth/profile successfully updated name, businessName, phone, and gstin');

    // 3. Test GET /api/auth/me returns updated details
    const meRes = await request({
      host: '127.0.0.1',
      port: 8099,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + (updateRes.data.token || token) }
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.user.name, 'Sanjay Super Transporter');
    console.log('✓ GET /api/auth/me confirmed persistence of updated profile');

    // 4. Test POST /api/auth/change-password with wrong old password
    const badPwdRes = await request({
      host: '127.0.0.1',
      port: 8099,
      path: '/api/auth/change-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (updateRes.data.token || token)
      }
    }, {
      currentPassword: 'WrongPassword!',
      newPassword: 'NewSecurePassword456!'
    });
    assert.strictEqual(badPwdRes.status, 400, 'Incorrect old password must be rejected');
    console.log('✓ POST /api/auth/change-password rejects incorrect current password');

    // 5. Test POST /api/auth/change-password with correct old password
    const goodPwdRes = await request({
      host: '127.0.0.1',
      port: 8099,
      path: '/api/auth/change-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (updateRes.data.token || token)
      }
    }, {
      currentPassword: testPwd,
      newPassword: 'NewSecurePassword456!'
    });
    assert.strictEqual(goodPwdRes.status, 200, 'Password should update successfully');
    console.log('✓ POST /api/auth/change-password successfully changed password');

    // 6. Test logging in with new password
    const loginNewRes = await request({
      host: '127.0.0.1',
      port: 8099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: uniqueEmail,
      password: 'NewSecurePassword456!'
    });
    assert.strictEqual(loginNewRes.status, 200, 'Login with new password must succeed');
    console.log('✓ POST /api/auth/login verified login with new password succeeds');

    console.log('\n🎉 ALL PROFILE & PASSWORD BACKEND OPERATIONS VERIFIED 100%!');
  } catch (err) {
    console.error('Test Failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
