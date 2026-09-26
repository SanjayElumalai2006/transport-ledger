/**
 * Transport Ledger - Core API Request Router
 * Handles all REST endpoints seamlessly across Node.js standalone and Vercel serverless.
 * Features: Anti-Bot CAPTCHA, Email & Google Authentication, User Data Isolation, and Cloud Email Backups.
 */

import * as db from '../lib/db.js';
import * as auth from '../lib/auth.js';

// Parse JSON request body helper
export function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    if (req.body && typeof req.body === 'string') {
      try {
        return resolve(JSON.parse(req.body));
      } catch (e) {
        return reject(new Error('Invalid JSON'));
      }
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) reject(new Error('Body payload too large'));
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON format: ' + err.message));
      }
    });
    req.on('error', reject);
  });
}

// Send standard JSON response helper
export function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(jsonStr);
}

export function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: true, message });
}

// Helper to extract authenticated user from Authorization header
export function getAuthenticatedUser(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = auth.verifySessionToken(token);
    if (payload && payload.userId) return payload;
  }
  return null;
}

// Main API request handler
export async function handleApiRequest(req, res, pathname, method, networkIps = [], port = 8080) {
  // CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return true;
  }

  // Extract authenticated user if available
  const authUser = getAuthenticatedUser(req);
  const userId = authUser ? authUser.userId : null;

  // ------------------------------------------------------------------------
  // AUTHENTICATION & SECURITY ENDPOINTS
  // ------------------------------------------------------------------------

  // GET /api/auth/captcha -> Generate Anti-Bot visual CAPTCHA for new user registration
  if (pathname === '/api/auth/captcha' && method === 'GET') {
    const captcha = auth.generateCaptcha();
    sendJson(res, 200, captcha);
    return true;
  }

  // POST /api/auth/register -> Enroll new user with CAPTCHA validation
  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await parseBody(req);
    const { name, businessName, email, password, captchaToken, captchaAnswer } = body;

    if (!email || !email.includes('@')) {
      sendError(res, 400, 'A valid Email ID is required');
      return true;
    }
    if (!password || password.length < 6) {
      sendError(res, 400, 'Password must be at least 6 characters long');
      return true;
    }
    if (!captchaToken || !captchaAnswer) {
      sendError(res, 400, 'Anti-Bot Security Code verification is required');
      return true;
    }

    // Verify Anti-Bot CAPTCHA code
    const isCaptchaValid = auth.verifyCaptcha(captchaToken, captchaAnswer);
    if (!isCaptchaValid) {
      sendError(res, 400, 'Invalid or expired Anti-Bot Security Code. Please refresh and try again.');
      return true;
    }

    // Check if email already registered
    const existing = await db.getUserByEmail(email);
    if (existing) {
      sendError(res, 409, 'An account with this Email ID already exists. Please sign in instead.');
      return true;
    }

    // Secure password hashing with PBKDF2
    const { salt, hash } = auth.hashPassword(password);
    const newUser = await db.createUser({
      name: name || '',
      businessName: businessName || '',
      email,
      passwordHash: hash,
      salt,
      provider: 'email'
    });

    const token = auth.createSessionToken(newUser);
    sendJson(res, 201, {
      success: true,
      message: 'Account successfully registered and secure ledger created',
      user: newUser,
      token
    });
    return true;
  }

  // POST /api/auth/login -> Sign in with Email ID & Password
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const { email, password } = body;

    if (!email || !password) {
      sendError(res, 400, 'Both Email ID and Password are required');
      return true;
    }

    const user = await db.getUserByEmail(email);
    if (!user || !user.passwordHash || !user.salt) {
      sendError(res, 401, 'Invalid Email ID or Password. Please check your credentials.');
      return true;
    }

    const isValid = auth.verifyPassword(password, user.salt, user.passwordHash);
    if (!isValid) {
      sendError(res, 401, 'Invalid Email ID or Password. Please check your credentials.');
      return true;
    }

    await db.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
    const { passwordHash, salt, ...safeUser } = user;
    const token = auth.createSessionToken(safeUser);

    sendJson(res, 200, {
      success: true,
      message: 'Signed in successfully',
      user: safeUser,
      token
    });
    return true;
  }

  // POST /api/auth/google -> Sign in or Enroll with Google
  if (pathname === '/api/auth/google' && method === 'POST') {
    const body = await parseBody(req);
    const { email, name, googleId, avatar } = body;

    if (!email || !email.includes('@')) {
      sendError(res, 400, 'Valid Google Email ID is required');
      return true;
    }

    let user = await db.getUserByEmail(email);
    if (!user) {
      // Auto-enroll Google user
      user = await db.createUser({
        email,
        name: name || email.split('@')[0],
        businessName: name ? `${name} Logistics` : 'Transport Logistics',
        provider: 'google',
        googleId: googleId || `goog_${Date.now()}`,
        avatar: avatar || ''
      });
    } else {
      await db.updateUser(user.id, {
        lastLoginAt: new Date().toISOString(),
        avatar: avatar || user.avatar
      });
    }

    const token = auth.createSessionToken(user);
    sendJson(res, 200, {
      success: true,
      message: 'Signed in with Google successfully',
      user: {
        id: user.id || user._id,
        email: user.email,
        name: user.name,
        businessName: user.businessName,
        avatar: user.avatar
      },
      token
    });
    return true;
  }

  // GET /api/auth/me -> Current authenticated user session
  if (pathname === '/api/auth/me' && method === 'GET') {
    if (!authUser) {
      sendJson(res, 200, { authenticated: false, user: null });
      return true;
    }
    const user = await db.getUserById(authUser.userId);
    sendJson(res, 200, {
      authenticated: true,
      user: user || authUser
    });
    return true;
  }

  // POST /api/backup/email -> Trigger full encrypted backup snapshot to user's registered Email ID
  if (pathname === '/api/backup/email' && method === 'POST') {
    const body = await parseBody(req);
    const targetEmail = (body.email || (authUser && authUser.email) || '').trim();

    if (!targetEmail || !targetEmail.includes('@')) {
      sendError(res, 400, 'A valid registered Email ID is required for cloud backup');
      return true;
    }

    const effectiveId = userId || body.userId || 'demo-user';
    const backupSnapshot = await db.exportAll(effectiveId);
    const backupRecord = await db.recordEmailBackup(effectiveId, targetEmail, backupSnapshot);

    sendJson(res, 200, {
      success: true,
      message: `Full database backup safely encrypted & dispatched to ${targetEmail}`,
      backupId: backupRecord.id,
      timestamp: backupRecord.timestamp,
      email: targetEmail,
      stats: {
        trips: backupSnapshot.trips.length,
        vehicles: backupSnapshot.vehicles.length,
        customers: backupSnapshot.customers.length,
        drivers: backupSnapshot.drivers.length
      }
    });
    return true;
  }

  // GET /api/backup/history -> Get recent cloud backup records for user
  if (pathname === '/api/backup/history' && method === 'GET') {
    const backups = await db.getUserBackups(userId);
    sendJson(res, 200, backups);
    return true;
  }

  // ------------------------------------------------------------------------
  // STATUS & HEALTH
  // ------------------------------------------------------------------------
  if (pathname === '/api/status' || pathname === '/api/health') {
    const [dbInfo, trips, customers, vehicles, drivers] = await Promise.all([
      db.getDbStatus(),
      db.getTrips(userId),
      db.getCustomers(userId),
      db.getVehicles(userId),
      db.getDrivers(userId)
    ]);

    sendJson(res, 200, {
      status: 'online',
      version: '2.0.0',
      database: dbInfo,
      authenticated: !!authUser,
      currentUser: authUser ? { id: authUser.userId, email: authUser.email, name: authUser.name } : null,
      uptime: Math.floor(process.uptime()),
      port,
      networkIps,
      mobileUrls: networkIps.map(ip => `http://${ip}:${port}/`),
      totalTrips: trips.length,
      totalCustomers: customers.length,
      totalVehicles: vehicles.length,
      totalDrivers: drivers.length,
      timestamp: new Date().toISOString()
    });
    return true;
  }

  // GET /api/analytics
  if (pathname === '/api/analytics') {
    const analytics = await db.getAnalytics(userId);
    sendJson(res, 200, analytics);
    return true;
  }

  // ------------------------------------------------------------------------
  // TRIPS: /api/trips
  // ------------------------------------------------------------------------
  if (pathname === '/api/trips') {
    if (method === 'GET') {
      const trips = await db.getTrips(userId);
      sendJson(res, 200, trips);
      return true;
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      if (!body.customerName || !body.fromLocation || !body.toLocation || body.amount === undefined) {
        sendError(res, 400, 'Missing required trip fields: customerName, fromLocation, toLocation, amount');
        return true;
      }
      const newTrip = await db.createTrip(body, userId);
      sendJson(res, 201, newTrip);
      return true;
    }
  }

  const tripMatch = pathname.match(/^\/api\/trips\/([^\/]+)$/);
  if (tripMatch) {
    const tripId = tripMatch[1];
    if (method === 'GET') {
      const trip = await db.getTripById(tripId, userId);
      if (!trip) {
        sendError(res, 404, `Trip ${tripId} not found`);
        return true;
      }
      sendJson(res, 200, trip);
      return true;
    }
    if (method === 'PUT') {
      const body = await parseBody(req);
      const updated = await db.updateTrip(tripId, body, userId);
      if (!updated) {
        sendError(res, 404, `Trip ${tripId} not found`);
        return true;
      }
      sendJson(res, 200, updated);
      return true;
    }
    if (method === 'DELETE') {
      const success = await db.deleteTrip(tripId, userId);
      sendJson(res, 200, { success });
      return true;
    }
  }

  // ------------------------------------------------------------------------
  // CUSTOMERS: /api/customers
  // ------------------------------------------------------------------------
  if (pathname === '/api/customers') {
    if (method === 'GET') {
      const customers = await db.getCustomers(userId);
      sendJson(res, 200, customers);
      return true;
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const newCust = await db.createCustomer(body, userId);
      sendJson(res, 201, newCust);
      return true;
    }
  }

  const custMatch = pathname.match(/^\/api\/customers\/([^\/]+)$/);
  if (custMatch) {
    const custId = custMatch[1];
    if (method === 'PUT') {
      const body = await parseBody(req);
      const updated = await db.updateCustomer(custId, body, userId);
      if (!updated) {
        sendError(res, 404, `Customer ${custId} not found`);
        return true;
      }
      sendJson(res, 200, updated);
      return true;
    }
    if (method === 'DELETE') {
      const success = await db.deleteCustomer(custId, userId);
      sendJson(res, 200, { success });
      return true;
    }
  }

  // ------------------------------------------------------------------------
  // VEHICLES: /api/vehicles
  // ------------------------------------------------------------------------
  if (pathname === '/api/vehicles') {
    if (method === 'GET') {
      const vehicles = await db.getVehicles(userId);
      sendJson(res, 200, vehicles);
      return true;
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      try {
        const newVeh = await db.createVehicle(body, userId);
        sendJson(res, 201, newVeh);
      } catch (err) {
        sendError(res, 400, err.message);
      }
      return true;
    }
  }

  const vehMatch = pathname.match(/^\/api\/vehicles\/([^\/]+)$/);
  if (vehMatch) {
    const vehId = vehMatch[1];
    if (method === 'PUT') {
      const body = await parseBody(req);
      const updated = await db.updateVehicle(vehId, body, userId);
      if (!updated) {
        sendError(res, 404, `Vehicle ${vehId} not found`);
        return true;
      }
      sendJson(res, 200, updated);
      return true;
    }
    if (method === 'DELETE') {
      const success = await db.deleteVehicle(vehId, userId);
      sendJson(res, 200, { success });
      return true;
    }
  }

  // ------------------------------------------------------------------------
  // DRIVERS: /api/drivers
  // ------------------------------------------------------------------------
  if (pathname === '/api/drivers') {
    if (method === 'GET') {
      const drivers = await db.getDrivers(userId);
      sendJson(res, 200, drivers);
      return true;
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      try {
        const newDriver = await db.createDriver(body, userId);
        sendJson(res, 201, newDriver);
      } catch (err) {
        sendError(res, 400, err.message);
      }
      return true;
    }
  }

  const drivMatch = pathname.match(/^\/api\/drivers\/([^\/]+)(\/advance)?$/);
  if (drivMatch) {
    const drivId = drivMatch[1];
    const isAdvance = drivMatch[2] === '/advance';

    if (isAdvance && method === 'POST') {
      const body = await parseBody(req);
      const amount = Number(body.amount) || 0;
      const type = body.type || 'advance';
      const updated = await db.recordDriverAdvance(drivId, amount, type, userId);
      if (!updated) {
        sendError(res, 404, `Driver ${drivId} not found`);
        return true;
      }
      sendJson(res, 200, updated);
      return true;
    }

    if (method === 'PUT') {
      const body = await parseBody(req);
      const updated = await db.updateDriver(drivId, body, userId);
      if (!updated) {
        sendError(res, 404, `Driver ${drivId} not found`);
        return true;
      }
      sendJson(res, 200, updated);
      return true;
    }

    if (method === 'DELETE') {
      const success = await db.deleteDriver(drivId, userId);
      sendJson(res, 200, { success });
      return true;
    }
  }

  // ------------------------------------------------------------------------
  // SETTINGS: /api/settings
  // ------------------------------------------------------------------------
  if (pathname === '/api/settings') {
    if (method === 'GET') {
      const settings = await db.getSettings(userId);
      sendJson(res, 200, settings);
      return true;
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const updated = await db.updateSettings(body, userId);
      sendJson(res, 200, updated);
      return true;
    }
  }

  // ------------------------------------------------------------------------
  // BACKUP EXPORT & IMPORT & RESET
  // ------------------------------------------------------------------------
  if (pathname === '/api/export') {
    const data = await db.exportAll(userId);
    const jsonStr = JSON.stringify(data, null, 2);
    const userPrefix = authUser?.email ? authUser.email.split('@')[0] + '-' : '';
    const filename = `transport-ledger-${userPrefix}backup-${new Date().toISOString().substring(0, 10)}.json`;
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(jsonStr);
    return true;
  }

  if (pathname === '/api/import' && method === 'POST') {
    const body = await parseBody(req);
    await db.importAll(body, userId);
    sendJson(res, 200, { success: true, message: 'Database restored successfully' });
    return true;
  }

  if (pathname === '/api/reset' && method === 'POST') {
    await db.resetToDefaults(userId);
    sendJson(res, 200, { success: true, message: 'Reset to factory defaults complete' });
    return true;
  }

  return false;
}
