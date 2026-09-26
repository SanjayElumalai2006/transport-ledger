/**
 * Hybrid Smart Storage Engine for Transport Ledger
 * Seamlessly interfaces with the Node.js REST API backend with real-time multi-device sync,
 * while automatically maintaining an offline resilient LocalStorage cache.
 */

import { initialTrips, initialCustomers, initialVehicles, initialDrivers, initialSettings } from './sampleData.js';

const TRIPS_KEY = 'transport_ledger_trips_v2';
const CUSTOMERS_KEY = 'transport_ledger_customers_v2';
const VEHICLES_KEY = 'transport_ledger_vehicles_v2';
const DRIVERS_KEY = 'transport_ledger_drivers_v2';
const SETTINGS_KEY = 'transport_ledger_settings_v2';

let isServerOnline = false;
let serverInfo = {
  status: 'offline',
  version: '2.0.0',
  networkIps: [],
  mobileUrls: []
};

const syncListeners = [];

export function onSyncStatusChange(fn) {
  if (typeof fn === 'function') syncListeners.push(fn);
}

function notifySyncListeners() {
  syncListeners.forEach(fn => {
    try { fn({ isServerOnline, serverInfo }); } catch (e) { console.error(e); }
  });
}

export function getSyncStatus() {
  return { isServerOnline, serverInfo };
}

// Initialize Storage: Check API availability, pull latest server DB or initialize LocalStorage
export async function initStorage() {
  // Ensure local storage has basic defaults first as fallback
  if (!localStorage.getItem(TRIPS_KEY)) {
    localStorage.setItem(TRIPS_KEY, JSON.stringify(initialTrips));
  }
  if (!localStorage.getItem(CUSTOMERS_KEY)) {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(initialCustomers));
  }
  if (!localStorage.getItem(VEHICLES_KEY)) {
    localStorage.setItem(VEHICLES_KEY, JSON.stringify(initialVehicles));
  }
  if (!localStorage.getItem(DRIVERS_KEY)) {
    localStorage.setItem(DRIVERS_KEY, JSON.stringify(initialDrivers));
  }
  if (!localStorage.getItem(SETTINGS_KEY)) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(initialSettings));
  }

  // Probe Server REST API
  await checkServerHealth();

  // Periodically check server status every 20 seconds
  setInterval(checkServerHealth, 20000);
}

export async function checkServerHealth() {
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
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

async function syncFromServer() {
  if (!isServerOnline) return;
  try {
    const [tripsRes, custRes, vehRes, drivRes, setRes] = await Promise.all([
      fetch('/api/trips'),
      fetch('/api/customers'),
      fetch('/api/vehicles'),
      fetch('/api/drivers'),
      fetch('/api/settings')
    ]);

    if (tripsRes.ok) {
      const trips = await tripsRes.json();
      localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
    }
    if (custRes.ok) {
      const customers = await custRes.json();
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
    }
    if (vehRes.ok) {
      const vehicles = await vehRes.json();
      localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
    }
    if (drivRes.ok) {
      const drivers = await drivRes.json();
      localStorage.setItem(DRIVERS_KEY, JSON.stringify(drivers));
    }
    if (setRes.ok) {
      const settings = await setRes.json();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  } catch (e) {
    console.warn('Sync from server failed, relying on local cache:', e);
  }
}

// Reset data to initial sample dataset
export async function resetToSampleData() {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(initialTrips));
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(initialCustomers));
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(initialVehicles));
  localStorage.setItem(DRIVERS_KEY, JSON.stringify(initialDrivers));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(initialSettings));

  if (isServerOnline) {
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch (e) {
      console.warn('Server reset failed:', e);
    }
  }
}

// ==========================================================================
// TRIPS CRUD
// ==========================================================================
export function getTrips() {
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
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
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  ensureCustomerExists(newTrip.customerName);

  if (isServerOnline) {
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  ensureCustomerExists(updated.customerName);

  if (isServerOnline) {
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
  localStorage.setItem(TRIPS_KEY, JSON.stringify(filtered));

  if (isServerOnline) {
    try {
      await fetch(`/api/trips/${tripId}`, { method: 'DELETE' });
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
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function saveCustomer(customerData) {
  const customers = getCustomers();
  const nameTrimmed = customerData.name.trim();
  
  const existing = customers.find(c => c.name.toLowerCase() === nameTrimmed.toLowerCase());
  if (existing) {
    existing.phone = customerData.phone || existing.phone;
    existing.city = customerData.city || existing.city;
    existing.gstin = customerData.gstin || existing.gstin;
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
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
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));

  if (isServerOnline) {
    try {
      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));

  if (isServerOnline) {
    try {
      await fetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(filtered));

  if (isServerOnline) {
    try {
      await fetch(`/api/customers/${customerId}`, { method: 'DELETE' });
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
  try {
    const raw = localStorage.getItem(VEHICLES_KEY);
    return raw ? JSON.parse(raw) : initialVehicles;
  } catch (e) {
    return initialVehicles;
  }
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
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));

  if (isServerOnline) {
    try {
      await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));

  if (isServerOnline) {
    try {
      await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(filtered));

  if (isServerOnline) {
    try {
      await fetch(`/api/vehicles/${vehicleId}`, { method: 'DELETE' });
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
  try {
    const raw = localStorage.getItem(DRIVERS_KEY);
    return raw ? JSON.parse(raw) : initialDrivers;
  } catch (e) {
    return initialDrivers;
  }
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
  localStorage.setItem(DRIVERS_KEY, JSON.stringify(drivers));

  if (isServerOnline) {
    try {
      await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  localStorage.setItem(DRIVERS_KEY, JSON.stringify(drivers));

  if (isServerOnline) {
    try {
      await fetch(`/api/drivers/${driverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

  localStorage.setItem(DRIVERS_KEY, JSON.stringify(drivers));

  if (isServerOnline) {
    try {
      await fetch(`/api/drivers/${driverId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  localStorage.setItem(DRIVERS_KEY, JSON.stringify(filtered));

  if (isServerOnline) {
    try {
      await fetch(`/api/drivers/${driverId}`, { method: 'DELETE' });
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
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : initialSettings;
  } catch (e) {
    return initialSettings;
  }
}

export async function saveSettings(settingsData) {
  const current = getSettings();
  const updated = { ...current, ...settingsData };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));

  if (isServerOnline) {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.warn('API settings post failed:', e);
    }
  }

  return updated;
}

// ==========================================================================
// BACKUP & RESTORE
// ==========================================================================
export function exportBackupJSON() {
  const backup = {
    version: '2.0',
    exportDate: new Date().toISOString(),
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
      localStorage.setItem(TRIPS_KEY, JSON.stringify(parsed.trips));
    }
    if (parsed.customers && Array.isArray(parsed.customers)) {
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(parsed.customers));
    }
    if (parsed.vehicles && Array.isArray(parsed.vehicles)) {
      localStorage.setItem(VEHICLES_KEY, JSON.stringify(parsed.vehicles));
    }
    if (parsed.drivers && Array.isArray(parsed.drivers)) {
      localStorage.setItem(DRIVERS_KEY, JSON.stringify(parsed.drivers));
    }
    if (parsed.settings && typeof parsed.settings === 'object') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed.settings));
    }

    if (isServerOnline) {
      try {
        await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

export async function fetchAnalytics() {
  if (isServerOnline) {
    try {
      const res = await fetch('/api/analytics');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Analytics fetch failed:', e);
    }
  }
  return null;
}

export async function triggerSync() {
  return await checkServerHealth();
}
