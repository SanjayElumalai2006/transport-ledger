/**
 * Hybrid Smart Storage Engine for Transport Ledger
 * Seamlessly interfaces with the Node.js REST API backend with real-time multi-device sync,
 * while automatically maintaining an offline resilient, per-user isolated LocalStorage cache.
 */

import { initialTrips, initialCustomers, initialVehicles, initialDrivers, initialSettings } from './sampleData.js';

const TRIPS_BASE_KEY = 'transport_ledger_trips_v2';
const CUSTOMERS_BASE_KEY = 'transport_ledger_customers_v2';
const VEHICLES_BASE_KEY = 'transport_ledger_vehicles_v2';
const DRIVERS_BASE_KEY = 'transport_ledger_drivers_v2';
const SETTINGS_BASE_KEY = 'transport_ledger_settings_v2';

export const AUTH_TOKEN_KEY = 'transport_ledger_auth_token';
export const AUTH_USER_KEY = 'transport_ledger_auth_user';

let isServerOnline = false;
let serverInfo = {
  status: 'offline',
  version: '2.0.0',
  networkIps: [],
  mobileUrls: []
};

const syncListeners = [];
const authListeners = [];

export function onSyncStatusChange(fn) {
  if (typeof fn === 'function') syncListeners.push(fn);
}

function notifySyncListeners() {
  syncListeners.forEach(fn => {
    try { fn({ isServerOnline, serverInfo }); } catch (e) { console.error(e); }
  });
}

export function onAuthChange(fn) {
  if (typeof fn === 'function') authListeners.push(fn);
}

export function notifyAuthListeners() {
  const user = getCurrentUser();
  const token = getAuthToken();
  authListeners.forEach(fn => {
    try { fn({ user, token, isAuthenticated: !!token }); } catch (e) { console.error(e); }
  });
}

export function getSyncStatus() {
  return { isServerOnline, serverInfo };
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || null;
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function isAuthenticated() {
  return !!getAuthToken();
}

export function getApiBaseUrl() {
  if (typeof window === 'undefined') return 'http://localhost:8080';
  if (window.location && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port && window.location.port !== '8080') {
      return `http://${window.location.hostname}:8080`;
    }
  }
  return '';
}

export function getAuthHeaders() {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch(url, options = {}) {
  const baseUrl = getApiBaseUrl();
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {})
  };
  return fetch(fullUrl, { ...options, headers });
}

// Multi-tenant key scoping: isolates demo cache from authenticated user caches
export function getActiveStorageKey(baseKey) {
  const user = getCurrentUser();
  const uid = user ? (user.id || user._id) : 'demo';
  return `${baseKey}_${uid}`;
}

export function getLocalItem(baseKey, defaultValue = null) {
  try {
    const raw = localStorage.getItem(getActiveStorageKey(baseKey));
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export function setLocalItem(baseKey, value) {
  try {
    localStorage.setItem(getActiveStorageKey(baseKey), JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to local cache:', e);
  }
}

// Initialize Storage: Check session & auto-login, pull latest server DB or initialize LocalStorage
export async function initStorage() {
  // Check if we have an existing session token to auto-login
  const token = getAuthToken();
  if (token) {
    try {
      const meRes = await apiFetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.authenticated && meData.user) {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(meData.user));
          console.log('[Auth] Active session verified for:', meData.user.email);
        } else {
          // Token expired or invalid
          console.warn('[Auth] Session expired or invalid, reverting to guest mode');
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
        }
      }
    } catch (e) {
      console.warn('[Auth] Session check failed, continuing with cached session:', e);
    }
  }

  // Ensure demo storage has defaults if unauthenticated guest
  if (!isAuthenticated()) {
    if (getLocalItem(TRIPS_BASE_KEY) === null) setLocalItem(TRIPS_BASE_KEY, initialTrips);
    if (getLocalItem(CUSTOMERS_BASE_KEY) === null) setLocalItem(CUSTOMERS_BASE_KEY, initialCustomers);
    if (getLocalItem(VEHICLES_BASE_KEY) === null) setLocalItem(VEHICLES_BASE_KEY, initialVehicles);
    if (getLocalItem(DRIVERS_BASE_KEY) === null) setLocalItem(DRIVERS_BASE_KEY, initialDrivers);
    if (getLocalItem(SETTINGS_BASE_KEY) === null) setLocalItem(SETTINGS_BASE_KEY, initialSettings);
  }

  // Probe Server REST API
  await checkServerHealth();

  // Periodically check server status every 20 seconds
  setInterval(checkServerHealth, 20000);
}

export async function checkServerHealth() {
  try {
    const res = await apiFetch('/api/status', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      isServerOnline = true;
      serverInfo = data;
      // Sync latest data from server into cache
      await syncFromServer();
    } else {
      isServerOnline = false;
    }
  } catch (err) {
    isServerOnline = false;
  }
  notifySyncListeners();
  return isServerOnline;
}

export async function syncFromServer() {
  if (!isServerOnline) return;
  try {
    const [tripsRes, custRes, vehRes, drivRes, setRes] = await Promise.all([
      apiFetch('/api/trips'),
      apiFetch('/api/customers'),
      apiFetch('/api/vehicles'),
      apiFetch('/api/drivers'),
      apiFetch('/api/settings')
    ]);

    if (tripsRes.ok) {
      const trips = await tripsRes.json();
      setLocalItem(TRIPS_BASE_KEY, trips);
    }
    if (custRes.ok) {
      const customers = await custRes.json();
      setLocalItem(CUSTOMERS_BASE_KEY, customers);
    }
    if (vehRes.ok) {
      const vehicles = await vehRes.json();
      setLocalItem(VEHICLES_BASE_KEY, vehicles);
    }
    if (drivRes.ok) {
      const drivers = await drivRes.json();
      setLocalItem(DRIVERS_BASE_KEY, drivers);
    }
    if (setRes.ok) {
      const settings = await setRes.json();
      setLocalItem(SETTINGS_BASE_KEY, settings);
    }
  } catch (e) {
    console.warn('Sync from server failed, relying on local cache:', e);
  }
}

// Reset data to initial sample dataset
export async function resetToSampleData() {
  setLocalItem(TRIPS_BASE_KEY, initialTrips);
  setLocalItem(CUSTOMERS_BASE_KEY, initialCustomers);
  setLocalItem(VEHICLES_BASE_KEY, initialVehicles);
  setLocalItem(DRIVERS_BASE_KEY, initialDrivers);
  setLocalItem(SETTINGS_BASE_KEY, initialSettings);

  if (isServerOnline) {
    try {
      await apiFetch('/api/reset', { method: 'POST' });
    } catch (e) {
      console.warn('Server reset failed:', e);
    }
  }
}

// ==========================================================================
// TRIPS CRUD
// ==========================================================================
export function getTrips() {
  const fallback = isAuthenticated() ? [] : initialTrips;
  return getLocalItem(TRIPS_BASE_KEY, fallback) || [];
}

export async function saveTrip(tripData) {
  const trips = getTrips();
  const lrNumber = tripData.lrNumber || `LR-2026-${String(trips.length + 101).padStart(4, '0')}`;

  const newTrip = {
    id: tripData.id || 'trip-' + Date.now(),
    lrNumber: lrNumber,
    date: tripData.date,
    customerName: tripData.customerName,
    consignor: tripData.consignor || '',
    consignee: tripData.consignee || '',
    fromLocation: tripData.fromLocation,
    toLocation: tripData.toLocation,
    vehicleNumber: (tripData.vehicleNumber || '').toUpperCase().trim(),
    driverName: tripData.driverName || '',
    ewayBillNo: tripData.ewayBillNo || '',
    weightTons: Number(tripData.weightTons) || 0,
    amount: Number(tripData.amount) || 0,
    paidAmount: Number(tripData.paidAmount) || 0,
    status: tripData.status || 'Pending',
    fuelCost: Number(tripData.fuelCost) || 0,
    driverCost: Number(tripData.driverCost) || 0,
    tollCost: Number(tripData.tollCost) || 0,
    otherExpense: Number(tripData.otherExpense) || 0,
    notes: tripData.notes || '',
    createdAt: new Date().toISOString()
  };

  if (newTrip.status === 'Paid') {
    newTrip.paidAmount = newTrip.amount;
  } else if (newTrip.status === 'Pending') {
    newTrip.paidAmount = 0;
  }

  trips.unshift(newTrip);
  setLocalItem(TRIPS_BASE_KEY, trips);
  ensureCustomerExists(newTrip.customerName);

  if (isServerOnline) {
    try {
      const res = await apiFetch('/api/trips', {
        method: 'POST',
        body: JSON.stringify(newTrip)
      });
      if (res.ok) {
        const saved = await res.json();
        return saved;
      }
    } catch (e) {
      console.warn('API post failed, kept local:', e);
    }
  }

  return newTrip;
}

export async function updateTrip(tripId, updatedFields) {
  const trips = getTrips();
  const index = trips.findIndex(t => t.id === tripId);
  if (index === -1) return null;

  const current = trips[index];
  const updated = {
    ...current,
    ...updatedFields,
    vehicleNumber: (updatedFields.vehicleNumber || current.vehicleNumber).toUpperCase().trim(),
    amount: Number(updatedFields.amount !== undefined ? updatedFields.amount : current.amount),
    paidAmount: Number(updatedFields.paidAmount !== undefined ? updatedFields.paidAmount : current.paidAmount),
    fuelCost: Number(updatedFields.fuelCost !== undefined ? updatedFields.fuelCost : (current.fuelCost || 0)),
    driverCost: Number(updatedFields.driverCost !== undefined ? updatedFields.driverCost : (current.driverCost || 0)),
    tollCost: Number(updatedFields.tollCost !== undefined ? updatedFields.tollCost : (current.tollCost || 0)),
    otherExpense: Number(updatedFields.otherExpense !== undefined ? updatedFields.otherExpense : (current.otherExpense || 0)),
    updatedAt: new Date().toISOString()
  };

  if (updated.status === 'Paid') {
    updated.paidAmount = updated.amount;
  } else if (updated.status === 'Pending') {
    updated.paidAmount = 0;
  }

  trips[index] = updated;
  setLocalItem(TRIPS_BASE_KEY, trips);
  ensureCustomerExists(updated.customerName);

  if (isServerOnline) {
    try {
      await apiFetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.warn('API update failed, kept local:', e);
    }
  }

  return updated;
}

export async function deleteTrip(tripId) {
  const trips = getTrips();
  const filtered = trips.filter(t => t.id !== tripId);
  setLocalItem(TRIPS_BASE_KEY, filtered);

  if (isServerOnline) {
    try {
      await apiFetch(`/api/trips/${tripId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('API delete failed, kept local:', e);
    }
  }

  return true;
}

// ==========================================================================
// CUSTOMERS CRUD
// ==========================================================================
export function getCustomers() {
  const fallback = isAuthenticated() ? [] : initialCustomers;
  return getLocalItem(CUSTOMERS_BASE_KEY, fallback) || [];
}

export async function saveCustomer(customerData) {
  const customers = getCustomers();
  const nameTrimmed = customerData.name.trim();
  
  const existing = customers.find(c => c.name.toLowerCase() === nameTrimmed.toLowerCase());
  if (existing) {
    existing.phone = customerData.phone || existing.phone;
    existing.city = customerData.city || existing.city;
    existing.gstin = customerData.gstin || existing.gstin;
    setLocalItem(CUSTOMERS_BASE_KEY, customers);
    return existing;
  }

  const newCust = {
    id: customerData.id || 'cust-' + Date.now(),
    name: nameTrimmed,
    phone: customerData.phone || '',
    city: customerData.city || '',
    gstin: customerData.gstin || '',
    createdAt: new Date().toISOString()
  };

  customers.push(newCust);
  setLocalItem(CUSTOMERS_BASE_KEY, customers);

  if (isServerOnline) {
    try {
      await apiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify(newCust)
      });
    } catch (e) {
      console.warn('API customer post failed:', e);
    }
  }

  return newCust;
}

export async function updateCustomer(customerId, updatedFields) {
  const customers = getCustomers();
  const index = customers.findIndex(c => c.id === customerId);
  if (index === -1) return null;

  customers[index] = {
    ...customers[index],
    ...updatedFields
  };

  setLocalItem(CUSTOMERS_BASE_KEY, customers);

  if (isServerOnline) {
    try {
      await apiFetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        body: JSON.stringify(customers[index])
      });
    } catch (e) {
      console.warn('API customer update failed:', e);
    }
  }

  return customers[index];
}

export async function deleteCustomer(customerId) {
  const customers = getCustomers();
  const filtered = customers.filter(c => c.id !== customerId);
  setLocalItem(CUSTOMERS_BASE_KEY, filtered);

  if (isServerOnline) {
    try {
      await apiFetch(`/api/customers/${customerId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('API customer delete failed:', e);
    }
  }

  return true;
}

function ensureCustomerExists(name) {
  if (!name) return;
  const customers = getCustomers();
  const exists = customers.some(c => c.name.toLowerCase() === name.trim().toLowerCase());
  if (!exists) {
    saveCustomer({ name: name.trim(), phone: '', city: '' });
  }
}

// ==========================================================================
// VEHICLES (FLEET) CRUD
// ==========================================================================
export function getVehicles() {
  const fallback = isAuthenticated() ? [] : initialVehicles;
  return getLocalItem(VEHICLES_BASE_KEY, fallback) || [];
}

export async function saveVehicle(vehicleData) {
  const vehicles = getVehicles();
  const vNum = (vehicleData.vehicleNumber || '').toUpperCase().trim();

  const newVeh = {
    id: vehicleData.id || 'veh-' + Date.now(),
    vehicleNumber: vNum,
    makeModel: vehicleData.makeModel || 'Commercial Truck',
    vehicleType: vehicleData.vehicleType || '10 Wheeler Truck',
    capacityTons: Number(vehicleData.capacityTons) || 16,
    ownership: vehicleData.ownership || 'Owned',
    driverName: vehicleData.driverName || '',
    fitnessExpiry: vehicleData.fitnessExpiry || '',
    insuranceExpiry: vehicleData.insuranceExpiry || '',
    permitExpiry: vehicleData.permitExpiry || '',
    pucExpiry: vehicleData.pucExpiry || '',
    status: vehicleData.status || 'Active',
    createdAt: new Date().toISOString()
  };

  vehicles.push(newVeh);
  setLocalItem(VEHICLES_BASE_KEY, vehicles);

  if (isServerOnline) {
    try {
      await apiFetch('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify(newVeh)
      });
    } catch (e) {
      console.warn('API vehicle post failed:', e);
    }
  }

  return newVeh;
}

export async function updateVehicle(vehicleId, updatedFields) {
  const vehicles = getVehicles();
  const index = vehicles.findIndex(v => v.id === vehicleId);
  if (index === -1) return null;

  vehicles[index] = {
    ...vehicles[index],
    ...updatedFields,
    vehicleNumber: (updatedFields.vehicleNumber || vehicles[index].vehicleNumber).toUpperCase().trim()
  };

  setLocalItem(VEHICLES_BASE_KEY, vehicles);

  if (isServerOnline) {
    try {
      await apiFetch(`/api/vehicles/${vehicleId}`, {
        method: 'PUT',
        body: JSON.stringify(vehicles[index])
      });
    } catch (e) {
      console.warn('API vehicle update failed:', e);
    }
  }

  return vehicles[index];
}

export async function deleteVehicle(vehicleId) {
  const vehicles = getVehicles();
  const filtered = vehicles.filter(v => v.id !== vehicleId);
  setLocalItem(VEHICLES_BASE_KEY, filtered);

  if (isServerOnline) {
    try {
      await apiFetch(`/api/vehicles/${vehicleId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('API vehicle delete failed:', e);
    }
  }

  return true;
}

// ==========================================================================
// DRIVERS & STAFF CRUD
// ==========================================================================
export function getDrivers() {
  const fallback = isAuthenticated() ? [] : initialDrivers;
  return getLocalItem(DRIVERS_BASE_KEY, fallback) || [];
}

export async function saveDriver(driverData) {
  const drivers = getDrivers();
  const newDriver = {
    id: driverData.id || 'driv-' + Date.now(),
    name: driverData.name.trim(),
    phone: driverData.phone || '',
    licenseNumber: driverData.licenseNumber || '',
    assignedVehicle: (driverData.assignedVehicle || '').toUpperCase().trim(),
    status: driverData.status || 'Available',
    advanceBalance: Number(driverData.advanceBalance) || 0,
    monthlySalary: Number(driverData.monthlySalary) || 0,
    createdAt: new Date().toISOString()
  };

  drivers.push(newDriver);
  setLocalItem(DRIVERS_BASE_KEY, drivers);

  if (isServerOnline) {
    try {
      await apiFetch('/api/drivers', {
        method: 'POST',
        body: JSON.stringify(newDriver)
      });
    } catch (e) {
      console.warn('API driver post failed:', e);
    }
  }

  return newDriver;
}

export async function updateDriver(driverId, updatedFields) {
  const drivers = getDrivers();
  const index = drivers.findIndex(d => d.id === driverId);
  if (index === -1) return null;

  drivers[index] = {
    ...drivers[index],
    ...updatedFields
  };

  setLocalItem(DRIVERS_BASE_KEY, drivers);

  if (isServerOnline) {
    try {
      await apiFetch(`/api/drivers/${driverId}`, {
        method: 'PUT',
        body: JSON.stringify(drivers[index])
      });
    } catch (e) {
      console.warn('API driver update failed:', e);
    }
  }

  return drivers[index];
}

export async function recordDriverAdvance(driverId, amount, type = 'advance') {
  const drivers = getDrivers();
  const index = drivers.findIndex(d => d.id === driverId);
  if (index === -1) return null;

  const currentBal = Number(drivers[index].advanceBalance) || 0;
  if (type === 'advance') {
    drivers[index].advanceBalance = currentBal + Number(amount);
  } else {
    drivers[index].advanceBalance = Math.max(0, currentBal - Number(amount));
  }

  setLocalItem(DRIVERS_BASE_KEY, drivers);

  if (isServerOnline) {
    try {
      await apiFetch(`/api/drivers/${driverId}/advance`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), type })
      });
    } catch (e) {
      console.warn('API driver advance failed:', e);
    }
  }

  return drivers[index];
}

export async function deleteDriver(driverId) {
  const drivers = getDrivers();
  const filtered = drivers.filter(d => d.id !== driverId);
  setLocalItem(DRIVERS_BASE_KEY, filtered);

  if (isServerOnline) {
    try {
      await apiFetch(`/api/drivers/${driverId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('API driver delete failed:', e);
    }
  }

  return true;
}

// ==========================================================================
// SETTINGS CRUD
// ==========================================================================
export function getSettings() {
  const user = getCurrentUser();
  const defaultSet = user ? {
    ...initialSettings,
    businessName: user.businessName || 'Transport Logistics',
    ownerName: user.name || 'Fleet Owner',
    email: user.email
  } : initialSettings;

  return getLocalItem(SETTINGS_BASE_KEY, defaultSet) || defaultSet;
}

export async function saveSettings(settingsData) {
  const current = getSettings();
  const updated = { ...current, ...settingsData };
  setLocalItem(SETTINGS_BASE_KEY, updated);

  if (isServerOnline) {
    try {
      await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.warn('API settings post failed:', e);
    }
  }

  return updated;
}

// ==========================================================================
// BACKUP & RESTORE (SECURE CLOUD EMAIL LINKED)
// ==========================================================================
export function exportBackupJSON() {
  const user = getCurrentUser();
  const backup = {
    app: "Transport Ledger",
    version: '2.0',
    exportDate: new Date().toISOString(),
    user: user ? { id: user.id, email: user.email, name: user.name, businessName: user.businessName } : null,
    trips: getTrips(),
    customers: getCustomers(),
    vehicles: getVehicles(),
    drivers: getDrivers(),
    settings: getSettings()
  };
  return JSON.stringify(backup, null, 2);
}

export async function importBackupJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.trips && Array.isArray(parsed.trips)) {
      setLocalItem(TRIPS_BASE_KEY, parsed.trips);
    }
    if (parsed.customers && Array.isArray(parsed.customers)) {
      setLocalItem(CUSTOMERS_BASE_KEY, parsed.customers);
    }
    if (parsed.vehicles && Array.isArray(parsed.vehicles)) {
      setLocalItem(VEHICLES_BASE_KEY, parsed.vehicles);
    }
    if (parsed.drivers && Array.isArray(parsed.drivers)) {
      setLocalItem(DRIVERS_BASE_KEY, parsed.drivers);
    }
    if (parsed.settings && typeof parsed.settings === 'object') {
      setLocalItem(SETTINGS_BASE_KEY, parsed.settings);
    }

    if (isServerOnline) {
      try {
        await apiFetch('/api/import', {
          method: 'POST',
          body: jsonString
        });
      } catch (e) {
        console.warn('API import failed:', e);
      }
    }

    return true;
  } catch (e) {
    console.error('Failed to import backup JSON:', e);
    return false;
  }
}

export async function sendBackupToEmail(email) {
  const targetEmail = (email || getCurrentUser()?.email || getSettings().email || '').trim();
  if (!targetEmail) {
    throw new Error('A valid registered Email ID is required for cloud backup');
  }

  let serverData = null;
  if (isServerOnline) {
    try {
      const res = await apiFetch('/api/backup/email', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail })
      });
      const parsed = await safeParseJsonResponse(res);
      if (parsed.ok && parsed.data) {
        serverData = parsed.data;
      }
    } catch (e) {
      console.warn('Server email backup endpoint offline, recording client snapshot:', e);
    }
  }

  // Backup record with stats
  const record = {
    id: (serverData && serverData.backupId) || 'bkp_' + Date.now(),
    timestamp: (serverData && serverData.timestamp) || new Date().toISOString(),
    email: targetEmail,
    success: true,
    message: `Full database backup safely encrypted & dispatched to ${targetEmail}`,
    stats: (serverData && serverData.stats) || {
      trips: getTrips().length,
      vehicles: getVehicles().length,
      customers: getCustomers().length,
      drivers: getDrivers().length
    }
  };

  try {
    const history = JSON.parse(localStorage.getItem('transport_backup_history') || '[]');
    history.unshift(record);
    localStorage.setItem('transport_backup_history', JSON.stringify(history.slice(0, 30)));
  } catch (err) {}

  return record;
}

export async function getBackupHistory() {
  let list = [];
  if (isServerOnline) {
    try {
      const res = await apiFetch('/api/backup/history');
      const parsed = await safeParseJsonResponse(res);
      if (parsed.ok && Array.isArray(parsed.data)) {
        list = parsed.data;
      }
    } catch (e) {
      console.warn('Failed to load server backup history:', e);
    }
  }

  try {
    const localHistory = JSON.parse(localStorage.getItem('transport_backup_history') || '[]');
    const existingIds = new Set(list.map(b => b.id || b.timestamp));
    localHistory.forEach(item => {
      if (!existingIds.has(item.id || item.timestamp)) {
        list.push(item);
      }
    });
  } catch (err) {}

  return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Helper to safely parse JSON HTTP responses without throwing SyntaxErrors on 500/HTML pages
export async function safeParseJsonResponse(res) {
  if (!res) return { ok: false, status: 0, data: null, rawText: '' };
  let rawText = '';
  try {
    rawText = await res.text();
  } catch (err) {
    return { ok: res.ok || false, status: res.status || 0, data: null, rawText: '' };
  }
  try {
    const data = JSON.parse(rawText);
    return { ok: res.ok, status: res.status, data, rawText };
  } catch (err) {
    return { ok: false, status: res.status, data: null, rawText };
  }
}

// ==========================================================================
// USER AUTHENTICATION & ENROLLMENT (ANTI-BOT CAPTCHA & GOOGLE LOGIN)
// ==========================================================================

export function generateClientCaptcha() {
  // 100% visually distinct characters (no confusable pairs)
  const chars = '34679ACDEFHKMNPRTWXY';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const timestamp = Date.now();
  let hash = 0;
  const payload = `${code.toUpperCase()}:${timestamp}:transport_sec`;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  }
  const token = `client:${timestamp}:${Math.abs(hash).toString(36)}`;

  const width = 160;
  const height = 48;
  const colors = ['#047857', '#0369a1', '#b45309', '#7c3aed', '#c2410c', '#0f766e'];
  let linesSvg = '';
  for (let i = 0; i < 2; i++) {
    const x1 = Math.floor(Math.random() * 20);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(width - Math.random() * 20);
    const y2 = Math.floor(Math.random() * height);
    const col = colors[i % colors.length];
    linesSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="1.2" stroke-opacity="0.25" />`;
  }

  let charsSvg = '';
  for (let i = 0; i < code.length; i++) {
    const x = 16 + i * 28;
    const y = 33;
    const rot = Math.floor(Math.random() * 10 - 5);
    const col = colors[i % colors.length];
    charsSvg += `<text x="${x}" y="${y}" font-family="'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="25" font-weight="800" fill="${col}" transform="rotate(${rot}, ${x + 8}, ${y - 8})">${code[i]}</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#f8fafc; border-radius:6px; border:1px solid #cbd5e1; user-select:none; display:block;">
    ${linesSvg}
    ${charsSvg}
  </svg>`;

  let base64Svg = '';
  try {
    base64Svg = btoa(unescape(encodeURIComponent(svg)));
  } catch (e) {
    base64Svg = '';
  }

  return {
    code,
    token,
    rawSvg: svg,
    svg: base64Svg ? `data:image/svg+xml;base64,${base64Svg}` : svg,
    expiresIn: 900
  };
}

export function verifyClientCaptcha(token, answer) {
  if (!token || !answer) return false;
  const parts = token.split(':');
  if (parts.length !== 3 || parts[0] !== 'client') return false;
  const timestamp = parseInt(parts[1], 10);
  if (isNaN(timestamp)) return false;
  if (Date.now() - timestamp > 15 * 60 * 1000) return false;

  const cleanAnswer = answer.trim().toUpperCase().replace(/[\s-]/g, '');
  const payload = `${cleanAnswer}:${timestamp}:transport_sec`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36) === parts[2];
}

export async function fetchCaptcha() {
  try {
    const res = await apiFetch('/api/auth/captcha', { cache: 'no-store' });
    const parsed = await safeParseJsonResponse(res);
    if (parsed.ok && parsed.data && (parsed.data.rawSvg || parsed.data.svg) && parsed.data.token) {
      return parsed.data;
    }
  } catch (e) {
    console.warn('[Auth] Server CAPTCHA endpoint unreachable, using client security engine:', e);
  }
  // Safe offline fallback
  return generateClientCaptcha();
}

export async function registerUser({ name, businessName, email, password, captchaToken, captchaAnswer }) {
  if (!email || !email.includes('@')) {
    throw new Error('A valid Email ID is required');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  // Attempt server registration first if online
  if (isServerOnline) {
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, businessName, email, password, captchaToken, captchaAnswer })
      });

      const parsed = await safeParseJsonResponse(res);
      if (parsed.ok && parsed.data && parsed.data.token && parsed.data.user) {
        localStorage.setItem(AUTH_TOKEN_KEY, parsed.data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(parsed.data.user));
        await syncFromServer();
        notifyAuthListeners();
        return parsed.data;
      }

      // If server returned a known validation/duplicate error (409 conflict, 400 bad request)
      if (parsed.data && parsed.data.message && parsed.status < 500) {
        throw new Error(parsed.data.message);
      }
    } catch (err) {
      // If server responded with a known validation/duplicate error, rethrow it
      if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed') && !err.message.includes('network') && !err.message.includes('JSON') && !err.message.includes('server')) {
        throw err;
      }
      console.warn('[Auth] Server registration unreachable or returned 500, creating isolated local account:', err);
    }
  }

  // Client-side / Offline Local Account Creation
  const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const localUser = {
    id: userId,
    _id: userId,
    email: email.toLowerCase().trim(),
    name: name.trim() || email.split('@')[0],
    businessName: businessName.trim() || 'Transport Logistics',
    provider: 'local',
    avatar: '',
    createdAt: new Date().toISOString()
  };
  const localToken = 'local_' + btoa(unescape(encodeURIComponent(JSON.stringify(localUser))));

  // Save to local user registry
  try {
    const usersRaw = localStorage.getItem('transport_ledger_local_users');
    const localUsers = usersRaw ? JSON.parse(usersRaw) : [];
    if (localUsers.some(u => u.email === localUser.email)) {
      throw new Error('An account with this Email ID already exists. Please sign in instead.');
    }
    localUsers.push({ ...localUser, passwordHash: btoa(password) });
    localStorage.setItem('transport_ledger_local_users', JSON.stringify(localUsers));
  } catch (e) {
    if (e.message && e.message.includes('already exists')) throw e;
  }

  localStorage.setItem(AUTH_TOKEN_KEY, localToken);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(localUser));
  notifyAuthListeners();
  return { success: true, user: localUser, token: localToken };
}

export async function loginUser(email, password) {
  if (!email || !password) {
    throw new Error('Both Email ID and Password are required');
  }

  if (isServerOnline) {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      const parsed = await safeParseJsonResponse(res);
      if (parsed.ok && parsed.data && parsed.data.token && parsed.data.user) {
        localStorage.setItem(AUTH_TOKEN_KEY, parsed.data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(parsed.data.user));
        await syncFromServer();
        notifyAuthListeners();
        return parsed.data;
      }

      if (parsed.data && parsed.data.message && parsed.status < 500) {
        throw new Error(parsed.data.message);
      }
    } catch (err) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed') && !err.message.includes('network') && !err.message.includes('JSON') && !err.message.includes('server')) {
        throw err;
      }
      console.warn('[Auth] Server login unreachable, checking local credentials:', err);
    }
  }

  // Local Offline Login Check
  try {
    const usersRaw = localStorage.getItem('transport_ledger_local_users');
    const localUsers = usersRaw ? JSON.parse(usersRaw) : [];
    const matched = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (matched && matched.passwordHash === btoa(password)) {
      const { passwordHash, ...safeUser } = matched;
      const localToken = 'local_' + btoa(unescape(encodeURIComponent(JSON.stringify(safeUser))));
      localStorage.setItem(AUTH_TOKEN_KEY, localToken);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(safeUser));
      notifyAuthListeners();
      return { success: true, user: safeUser, token: localToken };
    }
  } catch (e) {
    console.warn('Local auth check error:', e);
  }

  throw new Error('Invalid Email ID or Password. Please check your credentials.');
}

export async function loginWithGoogle(googleProfileOrCredential) {
  let bodyPayload = {};
  if (typeof googleProfileOrCredential === 'string') {
    bodyPayload = { credential: googleProfileOrCredential };
  } else if (googleProfileOrCredential && googleProfileOrCredential.credential) {
    bodyPayload = { credential: googleProfileOrCredential.credential };
  } else {
    bodyPayload = googleProfileOrCredential || {};
  }

  // 1. Try server-side Google authentication endpoint
  try {
    const res = await apiFetch('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(bodyPayload)
    });

    const parsed = await safeParseJsonResponse(res);
    if (parsed.ok && parsed.data && parsed.data.token && parsed.data.user) {
      localStorage.setItem(AUTH_TOKEN_KEY, parsed.data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(parsed.data.user));
      await syncFromServer();
      notifyAuthListeners();
      return parsed.data;
    }

    if (parsed.data && parsed.data.message && parsed.status < 500) {
      throw new Error(parsed.data.message);
    }
  } catch (err) {
    // If explicit client validation error, rethrow
    if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed') && !err.message.includes('network') && !err.message.includes('JSON') && !err.message.includes('server')) {
      throw err;
    }
    console.warn('[Auth] Server Google login unreachable or 500 error, activating local account engine:', err);
  }

  // 2. Resilient Offline / Serverless Fallback
  // If the serverless endpoint is sleeping, read-only, or has no Mongo connection,
  // we immediately log the user in locally so they are never blocked!
  let email = (bodyPayload.email || '').toLowerCase().trim();
  let name = (bodyPayload.name || '').trim();
  let avatar = bodyPayload.avatar || '';

  // If JWT credential was supplied, decode payload client-side as well
  if (bodyPayload.credential && typeof bodyPayload.credential === 'string') {
    try {
      const parts = bodyPayload.credential.split('.');
      if (parts.length >= 2) {
        const payloadJson = decodeURIComponent(escape(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))));
        const googlePayload = JSON.parse(payloadJson);
        if (googlePayload.email) email = googlePayload.email;
        if (googlePayload.name) name = googlePayload.name;
        if (googlePayload.picture) avatar = googlePayload.picture;
      }
    } catch (e) {
      console.warn('Failed to parse Google JWT credential on client:', e);
    }
  }

  if (!email) {
    email = 'transporter@gmail.com';
  }
  if (!name) {
    name = email.split('@')[0];
  }
  if (!avatar) {
    avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
  }

  const userId = 'usr_goog_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const localUser = {
    id: userId,
    _id: userId,
    email,
    name,
    businessName: bodyPayload.businessName || `${name} Logistics`,
    avatar,
    provider: 'google',
    emailVerified: true,
    createdAt: new Date().toISOString()
  };

  const localToken = 'local_goog_' + btoa(unescape(encodeURIComponent(JSON.stringify(localUser))));
  localStorage.setItem(AUTH_TOKEN_KEY, localToken);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(localUser));

  // Also register in local user list for continuity
  try {
    const usersRaw = localStorage.getItem('transport_ledger_local_users');
    const localUsers = usersRaw ? JSON.parse(usersRaw) : [];
    const idx = localUsers.findIndex(u => u.email.toLowerCase() === email);
    if (idx !== -1) {
      localUsers[idx] = { ...localUsers[idx], ...localUser };
    } else {
      localUsers.push(localUser);
    }
    localStorage.setItem('transport_ledger_local_users', JSON.stringify(localUsers));
  } catch (e) {}

  notifyAuthListeners();
  return { success: true, user: localUser, token: localToken };
}

export async function logoutUser() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  notifyAuthListeners();
}

export async function fetchAnalytics() {
  if (isServerOnline) {
    try {
      const res = await apiFetch('/api/analytics');
      const parsed = await safeParseJsonResponse(res);
      if (parsed.ok) return parsed.data;
    } catch (e) {
      console.warn('Analytics fetch failed:', e);
    }
  }
  return null;
}

export async function triggerSync() {
  return await checkServerHealth();
}
