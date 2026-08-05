/**
 * LocalStorage Data Storage Engine for Transport Ledger
 * Manages Trips, Customers, and Settings persistence.
 */

import { initialTrips, initialCustomers, initialSettings } from './sampleData.js';

const TRIPS_KEY = 'transport_ledger_trips_v1';
const CUSTOMERS_KEY = 'transport_ledger_customers_v1';
const SETTINGS_KEY = 'transport_ledger_settings_v1';

// Initialize LocalStorage with sample data if empty
export function initStorage() {
  if (!localStorage.getItem(TRIPS_KEY)) {
    localStorage.setItem(TRIPS_KEY, JSON.stringify(initialTrips));
  }
  if (!localStorage.getItem(CUSTOMERS_KEY)) {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(initialCustomers));
  }
  if (!localStorage.getItem(SETTINGS_KEY)) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(initialSettings));
  }
}

// Reset data to initial sample dataset
export function resetToSampleData() {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(initialTrips));
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(initialCustomers));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(initialSettings));
}

// --- TRIPS CRUD ---
export function getTrips() {
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading trips from localStorage:', e);
    return [];
  }
}

export function saveTrip(tripData) {
  const trips = getTrips();
  const newTrip = {
    id: tripData.id || 'trip-' + Date.now(),
    date: tripData.date,
    customerName: tripData.customerName,
    fromLocation: tripData.fromLocation,
    toLocation: tripData.toLocation,
    vehicleNumber: (tripData.vehicleNumber || '').toUpperCase().trim(),
    amount: Number(tripData.amount) || 0,
    paidAmount: Number(tripData.paidAmount) || 0,
    status: tripData.status || 'Pending', // Paid, Pending, Partial
    fuelCost: Number(tripData.fuelCost) || 0,
    driverCost: Number(tripData.driverCost) || 0,
    tollCost: Number(tripData.tollCost) || 0,
    otherExpense: Number(tripData.otherExpense) || 0,
    notes: tripData.notes || '',
    createdAt: new Date().toISOString()
  };

  // Adjust paidAmount if status is Paid or Pending
  if (newTrip.status === 'Paid') {
    newTrip.paidAmount = newTrip.amount;
  } else if (newTrip.status === 'Pending') {
    newTrip.paidAmount = 0;
  }

  trips.unshift(newTrip); // Add to beginning
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  
  // Ensure customer exists in Customer directory
  ensureCustomerExists(newTrip.customerName);
  
  return newTrip;
}

export function updateTrip(tripId, updatedFields) {
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

  return updated;
}


export function deleteTrip(tripId) {
  const trips = getTrips();
  const filtered = trips.filter(t => t.id !== tripId);
  localStorage.setItem(TRIPS_KEY, JSON.stringify(filtered));
  return true;
}

// --- CUSTOMERS CRUD ---
export function getCustomers() {
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading customers:', e);
    return [];
  }
}

export function saveCustomer(customerData) {
  const customers = getCustomers();
  const nameTrimmed = customerData.name.trim();
  
  // Check if exists
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
  return newCust;
}

export function updateCustomer(customerId, updatedFields) {
  const customers = getCustomers();
  const index = customers.findIndex(c => c.id === customerId);
  if (index === -1) return null;

  customers[index] = {
    ...customers[index],
    ...updatedFields
  };

  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
  return customers[index];
}

export function deleteCustomer(customerId) {
  const customers = getCustomers();
  const filtered = customers.filter(c => c.id !== customerId);
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(filtered));
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

// --- SETTINGS CRUD ---
export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : initialSettings;
  } catch (e) {
    return initialSettings;
  }
}

export function saveSettings(settingsData) {
  const current = getSettings();
  const updated = { ...current, ...settingsData };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

// --- BACKUP & RESTORE ---
export function exportBackupJSON() {
  const backup = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    trips: getTrips(),
    customers: getCustomers(),
    settings: getSettings()
  };
  return JSON.stringify(backup, null, 2);
}

export function importBackupJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.trips && Array.isArray(parsed.trips)) {
      localStorage.setItem(TRIPS_KEY, JSON.stringify(parsed.trips));
    }
    if (parsed.customers && Array.isArray(parsed.customers)) {
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(parsed.customers));
    }
    if (parsed.settings && typeof parsed.settings === 'object') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed.settings));
    }
    return true;
  } catch (e) {
    console.error('Failed to import backup JSON:', e);
    return false;
  }
}
