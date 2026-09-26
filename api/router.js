/**
 * Transport Ledger - Core API Request Router
 * Handles all REST endpoints seamlessly across Node.js standalone and Vercel serverless.
 */

import * as db from '../lib/db.js';

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

  // GET /api/status or /api/health
  if (pathname === '/api/status' || pathname === '/api/health') {
    const [dbInfo, trips, customers, vehicles, drivers] = await Promise.all([
      db.getDbStatus(),
      db.getTrips(),
      db.getCustomers(),
      db.getVehicles(),
      db.getDrivers()
    ]);

    sendJson(res, 200, {
      status: 'online',
      version: '2.0.0',
      database: dbInfo,
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
    const analytics = await db.getAnalytics();
    sendJson(res, 200, analytics);
    return true;
  }

  // TRIPS: /api/trips
  if (pathname === '/api/trips') {
    if (method === 'GET') {
      const trips = await db.getTrips();
      sendJson(res, 200, trips);
      return true;
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      if (!body.customerName || !body.fromLocation || !body.toLocation || body.amount === undefined) {
        sendError(res, 400, 'Missing required trip fields: customerName, fromLocation, toLocation, amount');
        return true;
      }
      const newTrip = await db.createTrip(body);
      sendJson(res, 201, newTrip);
      return true;
    }
  }

  const tripMatch = pathname.match(/^\/api\/trips\/([^\/]+)$/);
  if (tripMatch) {
    const tripId = tripMatch[1];
    if (method === 'GET') {
      const trip = await db.getTripById(tripId);
      if (!trip) {
        sendError(res, 404, `Trip ${tripId} not found`);
        return true;
      }
      sendJson(res, 200, trip);
      return true;
    }
    if (method === 'PUT') {
      const body = await parseBody(req);
      const updated = await db.updateTrip(tripId, body);
      if (!updated) {
        sendError(res, 404, `Trip ${tripId} not found`);
        return true;
      }
      sendJson(res, 200, updated);
      return true;
    }
    if (method === 'DELETE') {
      const success = await db.deleteTrip(tripId);
      sendJson(res, 200, { success });
      return true;
    }
  }

  // CUSTOMERS: /api/customers
  if (pathname === '/api/customers') {
    if (method === 'GET') {
      const customers = await db.getCustomers();
      sendJson(res, 200, customers);
      return true;
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const newCust = await db.createCustomer(body);
      sendJson(res, 201, newCust);
      return true;
    }
  }

  const custMatch = pathname.match(/^\/api\/customers\/([^\/]+)$/);
  if (custMatch) {
    const custId = custMatch[1];
    if (method === 'PUT') {
      const body = await parseBody(req);
      const updated = await db.updateCustomer(custId, body);
      if (!updated) {
        sendError(res, 404, `Customer ${custId} not found`);
        return true;
      }
      sendJson(res, 200, updated);
      return true;
    }
    if (method === 'DELETE') {
      const success = await db.deleteCustomer(custId);
      sendJson(res, 200, { success });
      return true;
    }
  }

  // VEHICLES: /api/vehicles
  if (pathname === '/api/vehicles') {
    if (method === 'GET') {
      const vehicles = await db.getVehicles();
      sendJson(res, 200, vehicles);
      return true;
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      try {
        const newVeh = await db.createVehicle(body);
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
      const updated = await db.updateVehicle(vehId, body);
      if (!updated) {
        sendError(res, 404, `Vehicle ${vehId} not found`);
        return true;
      }
      sendJson(res, 200, updated);
      return true;
    }
    if (method === 'DELETE') {
      const success = await db.deleteVehicle(vehId);
      sendJson(res, 200, { success });
      return true;
    }
  }

  // DRIVERS: /api/drivers
  if (pathname === '/api/drivers') {
    if (method === 'GET') {
      const drivers = await db.getDrivers();
      sendJson(res, 200, drivers);
      return true;
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      try {
        const newDriver = await db.createDriver(body);
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
      const updated = await db.recordDriverAdvance(drivId, amount, type);
      if (!updated) {
        sendError(res, 404, `Driver ${drivId} not found`);
        return true;
      }
      sendJson(res, 200, updated);
      return true;
    }

    if (method === 'PUT') {
      const body = await parseBody(req);
      const updated = await db.updateDriver(drivId, body);
      if (!updated) {
        sendError(res, 404, `Driver ${drivId} not found`);
        return true;
      }
      sendJson(res, 200, updated);
      return true;
    }

    if (method === 'DELETE') {
      const success = await db.deleteDriver(drivId);
      sendJson(res, 200, { success });
      return true;
    }
  }

  // SETTINGS: /api/settings
  if (pathname === '/api/settings') {
    if (method === 'GET') {
      const settings = await db.getSettings();
      sendJson(res, 200, settings);
      return true;
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const updated = await db.updateSettings(body);
      sendJson(res, 200, updated);
      return true;
    }
  }

  // BACKUP EXPORT & IMPORT & RESET
  if (pathname === '/api/export') {
    const data = await db.exportAll();
    const jsonStr = JSON.stringify(data, null, 2);
    const filename = `transport-ledger-backup-${new Date().toISOString().substring(0, 10)}.json`;
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
    await db.importAll(body);
    sendJson(res, 200, { success: true, message: 'Database restored successfully' });
    return true;
  }

  if (pathname === '/api/reset' && method === 'POST') {
    await db.resetToDefaults();
    sendJson(res, 200, { success: true, message: 'Reset to factory defaults complete' });
    return true;
  }

  return false;
}
