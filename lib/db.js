/**
 * Transport Ledger - Hybrid Database Engine (MongoDB Atlas + Atomic File Fallback)
 * Provides high-performance, enterprise-grade persistence with full MongoDB clustering support,
 * automated collection seeding, Vercel Serverless connection caching, and offline file fallback.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load .env variables if present
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Seed default sample data for Indian Transport Businesses
export const DEFAULT_DATABASE = {
  settings: {
    businessName: "Jai Hanuman Transport Co.",
    ownerName: "Ramesh Sharma",
    phone: "+91 98200 12345",
    altPhone: "+91 98200 54321",
    email: "contact@jaihanumantransport.com",
    city: "Mumbai, Maharashtra",
    address: "Shop No. 12, Transport Nagar, Kalamboli, Navi Mumbai - 410218",
    gstin: "27AABCS123411Z5",
    pan: "AABCS1234F",
    upiId: "9820012345@upi",
    bankName: "State Bank of India",
    accountNumber: "38920192831",
    ifscCode: "SBIN0001234",
    lrPrefix: "LR-2026-",
    terms: "1. Goods carried strictly at owner's risk.\n2. Demurrage charged @ Rs. 1500/day after 24 hours of arrival.\n3. Reverse Charge Mechanism (RCM) applicable under GST as per GTA norms."
  },
  customers: [
    {
      id: "cust-1",
      name: "Sharma Freight Carriers",
      phone: "+91 98200 12345",
      city: "Mumbai, Maharashtra",
      gstin: "27AABCS123411Z5",
      createdAt: "2026-01-10T10:00:00Z"
    },
    {
      id: "cust-2",
      name: "Gupta Logistics Pvt Ltd",
      phone: "+91 98110 54321",
      city: "Delhi NCR",
      gstin: "07AAACG987621Z2",
      createdAt: "2026-01-15T11:00:00Z"
    },
    {
      id: "cust-3",
      name: "Rajasthan Marble & Transport",
      phone: "+91 94140 88990",
      city: "Jaipur, Rajasthan",
      gstin: "08AABCR554431Z9",
      createdAt: "2026-02-01T09:00:00Z"
    },
    {
      id: "cust-4",
      name: "Patel Agro Products",
      phone: "+91 98980 77665",
      city: "Ahmedabad, Gujarat",
      gstin: "24AABCP332211Z1",
      createdAt: "2026-02-12T14:30:00Z"
    },
    {
      id: "cust-5",
      name: "Deccan Industrial Goods",
      phone: "+91 90000 44332",
      city: "Hyderabad, Telangana",
      gstin: "36AABCD778891Z4",
      createdAt: "2026-03-05T16:00:00Z"
    }
  ],
  vehicles: [
    {
      id: "veh-1",
      vehicleNumber: "MH 12 AB 1234",
      makeModel: "Tata Signa 2823.K",
      vehicleType: "10 Wheeler Truck",
      capacityTons: 16,
      ownership: "Owned",
      driverName: "Rajesh Yadav",
      fitnessExpiry: "2027-04-10",
      insuranceExpiry: "2027-01-15",
      permitExpiry: "2027-08-20",
      pucExpiry: "2026-12-05",
      status: "Active",
      createdAt: "2026-01-01T00:00:00Z"
    },
    {
      id: "veh-2",
      vehicleNumber: "GJ 01 CD 5678",
      makeModel: "Ashok Leyland 1618",
      vehicleType: "6 Wheeler Truck",
      capacityTons: 10,
      ownership: "Owned",
      driverName: "Dilip Patel",
      fitnessExpiry: "2026-10-15",
      insuranceExpiry: "2027-03-22",
      permitExpiry: "2027-05-18",
      pucExpiry: "2026-10-05",
      status: "Active",
      createdAt: "2026-01-05T00:00:00Z"
    },
    {
      id: "veh-3",
      vehicleNumber: "RJ 14 EF 9012",
      makeModel: "BharatBenz 3528R",
      vehicleType: "12 Wheeler Heavy",
      capacityTons: 25,
      ownership: "Owned",
      driverName: "Suresh Gurjar",
      fitnessExpiry: "2027-06-30",
      insuranceExpiry: "2026-09-15",
      permitExpiry: "2027-09-10",
      pucExpiry: "2027-02-14",
      status: "Active",
      createdAt: "2026-01-10T00:00:00Z"
    },
    {
      id: "veh-4",
      vehicleNumber: "DL 01 GH 3456",
      makeModel: "Tata 407 SFC",
      vehicleType: "Mini Truck",
      capacityTons: 4,
      ownership: "Attached",
      driverName: "Mahendra Singh",
      fitnessExpiry: "2027-11-20",
      insuranceExpiry: "2027-07-05",
      permitExpiry: "2026-12-01",
      pucExpiry: "2027-01-10",
      status: "Active",
      createdAt: "2026-02-01T00:00:00Z"
    },
    {
      id: "veh-5",
      vehicleNumber: "TS 09 IJ 7890",
      makeModel: "Mahindra Blazo X 49",
      vehicleType: "Multi-Axle Trailer",
      capacityTons: 35,
      ownership: "Owned",
      driverName: "Balwinder Singh",
      fitnessExpiry: "2027-08-14",
      insuranceExpiry: "2027-05-19",
      permitExpiry: "2027-10-25",
      pucExpiry: "2027-04-02",
      status: "Active",
      createdAt: "2026-02-15T00:00:00Z"
    }
  ],
  drivers: [
    {
      id: "driv-1",
      name: "Rajesh Yadav",
      phone: "+91 98221 11223",
      licenseNumber: "MH-1420150001234",
      assignedVehicle: "MH 12 AB 1234",
      status: "On Trip",
      advanceBalance: 3500,
      monthlySalary: 22000,
      createdAt: "2026-01-01T00:00:00Z"
    },
    {
      id: "driv-2",
      name: "Suresh Gurjar",
      phone: "+91 94142 33445",
      licenseNumber: "RJ-1420160005678",
      assignedVehicle: "RJ 14 EF 9012",
      status: "Available",
      advanceBalance: 0,
      monthlySalary: 24000,
      createdAt: "2026-01-05T00:00:00Z"
    },
    {
      id: "driv-3",
      name: "Dilip Patel",
      phone: "+91 98981 55667",
      licenseNumber: "GJ-0120180009101",
      assignedVehicle: "GJ 01 CD 5678",
      status: "On Trip",
      advanceBalance: 2000,
      monthlySalary: 20000,
      createdAt: "2026-01-10T00:00:00Z"
    },
    {
      id: "driv-4",
      name: "Mahendra Singh",
      phone: "+91 90001 77889",
      licenseNumber: "TS-0920190002345",
      assignedVehicle: "DL 01 GH 3456",
      status: "Available",
      advanceBalance: 1200,
      monthlySalary: 18000,
      createdAt: "2026-02-01T00:00:00Z"
    }
  ],
  trips: [
    {
      id: "trip-101",
      lrNumber: "LR-2026-0101",
      date: "2026-08-01",
      customerName: "Sharma Freight Carriers",
      consignor: "Tata Steel Yard, Mumbai",
      consignee: "Delhi Metro Project Phase 4",
      fromLocation: "Mumbai",
      toLocation: "Delhi",
      vehicleNumber: "MH 12 AB 1234",
      driverName: "Rajesh Yadav",
      ewayBillNo: "241088992211",
      weightTons: 15,
      amount: 45000,
      paidAmount: 45000,
      status: "Paid",
      fuelCost: 18000,
      driverCost: 4500,
      tollCost: 2200,
      otherExpense: 1000,
      notes: "15 Tons TMT Steel Bars & Beams",
      createdAt: "2026-08-01T08:30:00Z"
    },
    {
      id: "trip-102",
      lrNumber: "LR-2026-0102",
      date: "2026-08-01",
      customerName: "Patel Agro Products",
      consignor: "Gujarat Cotton Corporation, Ahmedabad",
      consignee: "Jaipur Textile Mills",
      fromLocation: "Ahmedabad",
      toLocation: "Jaipur",
      vehicleNumber: "GJ 01 CD 5678",
      driverName: "Dilip Patel",
      ewayBillNo: "241088992212",
      weightTons: 10,
      amount: 28000,
      paidAmount: 0,
      status: "Pending",
      fuelCost: 11000,
      driverCost: 3000,
      tollCost: 1400,
      otherExpense: 600,
      notes: "10 Tons Raw Cotton Bales",
      createdAt: "2026-08-01T09:15:00Z"
    },
    {
      id: "trip-103",
      lrNumber: "LR-2026-0103",
      date: "2026-07-28",
      customerName: "Rajasthan Marble & Transport",
      consignor: "RK Marbles, Kishangarh",
      consignee: "DLF Cybercity Towers, Gurugram",
      fromLocation: "Kishangarh",
      toLocation: "Gurugram",
      vehicleNumber: "RJ 14 EF 9012",
      driverName: "Suresh Gurjar",
      ewayBillNo: "241088992213",
      weightTons: 22,
      amount: 38500,
      paidAmount: 20000,
      status: "Partial",
      fuelCost: 14000,
      driverCost: 3800,
      tollCost: 1800,
      otherExpense: 900,
      notes: "Italian Marble Slabs & Polished Tiles",
      createdAt: "2026-07-28T14:20:00Z"
    },
    {
      id: "trip-104",
      lrNumber: "LR-2026-0104",
      date: "2026-07-24",
      customerName: "Gupta Logistics Pvt Ltd",
      consignor: "Havells India, Faridabad",
      consignee: "Kanpur Electrical Wholesalers",
      fromLocation: "Faridabad",
      toLocation: "Kanpur",
      vehicleNumber: "DL 01 GH 3456",
      driverName: "Mahendra Singh",
      ewayBillNo: "241088992214",
      weightTons: 4,
      amount: 14500,
      paidAmount: 14500,
      status: "Paid",
      fuelCost: 5200,
      driverCost: 1500,
      tollCost: 800,
      otherExpense: 400,
      notes: "Consumer Electronics & Cable Drums",
      createdAt: "2026-07-24T11:00:00Z"
    },
    {
      id: "trip-105",
      lrNumber: "LR-2026-0105",
      date: "2026-07-20",
      customerName: "Deccan Industrial Goods",
      consignor: "Bharat Heavy Electricals, Hyderabad",
      consignee: "NTPC Ramagundam Power Plant",
      fromLocation: "Hyderabad",
      toLocation: "Ramagundam",
      vehicleNumber: "TS 09 IJ 7890",
      driverName: "Balwinder Singh",
      ewayBillNo: "241088992215",
      weightTons: 32,
      amount: 52000,
      paidAmount: 25000,
      status: "Partial",
      fuelCost: 21000,
      driverCost: 5000,
      tollCost: 2600,
      otherExpense: 1200,
      notes: "Heavy Transformer Coils & Fabrication",
      createdAt: "2026-07-20T10:10:00Z"
    },
    {
      id: "trip-106",
      lrNumber: "LR-2026-0106",
      date: "2026-07-15",
      customerName: "Sharma Freight Carriers",
      consignor: "JNPT Port Nhava Sheva",
      consignee: "Mahindra & Mahindra, Pune",
      fromLocation: "Navi Mumbai",
      toLocation: "Pune",
      vehicleNumber: "MH 12 AB 1234",
      driverName: "Rajesh Yadav",
      ewayBillNo: "241088992216",
      weightTons: 16,
      amount: 34000,
      paidAmount: 34000,
      status: "Paid",
      fuelCost: 13500,
      driverCost: 3500,
      tollCost: 1600,
      otherExpense: 800,
      notes: "Imported Auto Spare Parts in Wooden Crates",
      createdAt: "2026-07-15T09:00:00Z"
    },
    {
      id: "trip-107",
      lrNumber: "LR-2026-0107",
      date: "2026-07-10",
      customerName: "Patel Agro Products",
      consignor: "Amul Federation Anand",
      consignee: "Bhiwandi Cold Storage",
      fromLocation: "Surat",
      toLocation: "Bhiwandi",
      vehicleNumber: "GJ 01 CD 5678",
      driverName: "Dilip Patel",
      ewayBillNo: "241088992217",
      weightTons: 9,
      amount: 19500,
      paidAmount: 0,
      status: "Pending",
      fuelCost: 7800,
      driverCost: 2000,
      tollCost: 1200,
      otherExpense: 500,
      notes: "Refined Agro Oil & Organic Spices",
      createdAt: "2026-07-10T13:30:00Z"
    }
  ]
};

// Global cached MongoDB client for Serverless function lifecycle reuse
let cachedMongoClient = null;
let cachedDb = null;
let mongoConnectionFailed = false;

// Connect to MongoDB
async function getMongoDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    return null;
  }

  if (cachedDb) {
    return cachedDb;
  }

  if (mongoConnectionFailed) {
    return null;
  }

  try {
    if (!cachedMongoClient) {
      cachedMongoClient = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000
      });
      await cachedMongoClient.connect();
    }

    const dbName = process.env.MONGODB_DB_NAME || 'transport_ledger';
    cachedDb = cachedMongoClient.db(dbName);
    console.log(`[MongoDB] Successfully connected to database: ${dbName}`);

    // Auto-seed collections if empty
    await seedMongoIfEmpty(cachedDb);
    return cachedDb;
  } catch (err) {
    console.warn('[MongoDB] Connection failed, switching to local file database fallback:', err.message);
    mongoConnectionFailed = true;
    return null;
  }
}

// Seed MongoDB collections from defaults if empty
async function seedMongoIfEmpty(db) {
  try {
    const settingsCount = await db.collection('settings').countDocuments();
    if (settingsCount === 0) {
      await db.collection('settings').insertOne({ ...DEFAULT_DATABASE.settings, _id: 'main_settings' });
    }

    const customersCount = await db.collection('customers').countDocuments();
    if (customersCount === 0) {
      await db.collection('customers').insertMany(DEFAULT_DATABASE.customers.map(c => ({ ...c, _id: c.id })));
    }

    const vehiclesCount = await db.collection('vehicles').countDocuments();
    if (vehiclesCount === 0) {
      await db.collection('vehicles').insertMany(DEFAULT_DATABASE.vehicles.map(v => ({ ...v, _id: v.id })));
    }

    const driversCount = await db.collection('drivers').countDocuments();
    if (driversCount === 0) {
      await db.collection('drivers').insertMany(DEFAULT_DATABASE.drivers.map(d => ({ ...d, _id: d.id })));
    }

    const tripsCount = await db.collection('trips').countDocuments();
    if (tripsCount === 0) {
      await db.collection('trips').insertMany(DEFAULT_DATABASE.trips.map(t => ({ ...t, _id: t.id })));
    }
  } catch (err) {
    console.warn('[MongoDB] Seeding check failed:', err.message);
  }
}

// ==========================================================================
// File-based Storage Engine (Zero-dependency fallback)
// ==========================================================================
class FileDbEngine {
  constructor() {
    this.ensureDirs();
    this.data = this.load();
  }

  ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          settings: { ...DEFAULT_DATABASE.settings, ...(parsed.settings || {}) },
          customers: Array.isArray(parsed.customers) ? parsed.customers : DEFAULT_DATABASE.customers,
          vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : DEFAULT_DATABASE.vehicles,
          drivers: Array.isArray(parsed.drivers) ? parsed.drivers : DEFAULT_DATABASE.drivers,
          trips: Array.isArray(parsed.trips) ? parsed.trips : DEFAULT_DATABASE.trips
        };
      }
    } catch (err) {
      console.warn('[FileDB] Parsing error, resetting to defaults:', err.message);
    }

    this.saveDirect(DEFAULT_DATABASE);
    return JSON.parse(JSON.stringify(DEFAULT_DATABASE));
  }

  save() {
    this.saveDirect(this.data);
  }

  saveDirect(dataObj) {
    this.ensureDirs();
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(dataObj, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  }

  createBackup() {
    this.ensureDirs();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `database_backup_${stamp}.json`);
    fs.copyFileSync(DB_FILE, backupPath);
    return backupPath;
  }
}

const fileDb = new FileDbEngine();

// ==========================================================================
// UNIFIED DATA ACCESS LAYER (MongoDB Atlas <---> Local File DB)
// ==========================================================================

export async function getDbStatus() {
  const mongo = await getMongoDb();
  const uriConfigured = !!(process.env.MONGODB_URI && process.env.MONGODB_URI.trim());
  return {
    engine: mongo ? 'MongoDB Atlas' : 'Local File Engine',
    isMongo: !!mongo,
    isConnected: !!mongo || true,
    mongoConfigured: uriConfigured,
    dbName: mongo ? (process.env.MONGODB_DB_NAME || 'transport_ledger') : 'database.json',
    storageLocation: mongo ? 'Cloud (MongoDB)' : DB_FILE
  };
}

// --------------------------------------------------------------------------
// TRIPS
// --------------------------------------------------------------------------
export async function getTrips() {
  const mongo = await getMongoDb();
  if (mongo) {
    const list = await mongo.collection('trips').find({}).sort({ date: -1, createdAt: -1 }).toArray();
    return list.map(t => {
      const { _id, ...rest } = t;
      return { id: _id, ...rest };
    });
  }
  return fileDb.data.trips;
}

export async function getTripById(id) {
  const mongo = await getMongoDb();
  if (mongo) {
    const trip = await mongo.collection('trips').findOne({ _id: id });
    if (!trip) return null;
    const { _id, ...rest } = trip;
    return { id: _id, ...rest };
  }
  return fileDb.data.trips.find(t => t.id === id) || null;
}

export async function createTrip(tripData) {
  const newId = tripData.id || 'trip-' + Date.now();
  const tripsCount = (await getTrips()).length;
  const lrNumber = tripData.lrNumber || `LR-2026-${String(tripsCount + 101).padStart(4, '0')}`;

  const newTrip = {
    id: newId,
    lrNumber,
    date: tripData.date || new Date().toISOString().substring(0, 10),
    customerName: (tripData.customerName || '').trim(),
    consignor: tripData.consignor || '',
    consignee: tripData.consignee || '',
    fromLocation: (tripData.fromLocation || '').trim(),
    toLocation: (tripData.toLocation || '').trim(),
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

  const mongo = await getMongoDb();
  if (mongo) {
    await mongo.collection('trips').insertOne({ ...newTrip, _id: newId });
    // Auto register customer if doesn't exist
    const custExists = await mongo.collection('customers').findOne({ name: new RegExp(`^${newTrip.customerName}$`, 'i') });
    if (!custExists && newTrip.customerName) {
      const cId = 'cust-' + Date.now();
      await mongo.collection('customers').insertOne({
        _id: cId,
        id: cId,
        name: newTrip.customerName,
        phone: '',
        city: newTrip.fromLocation,
        gstin: '',
        createdAt: new Date().toISOString()
      });
    }
  } else {
    fileDb.data.trips.unshift(newTrip);
    const custExists = fileDb.data.customers.find(c => c.name.toLowerCase() === newTrip.customerName.toLowerCase());
    if (!custExists && newTrip.customerName) {
      fileDb.data.customers.push({
        id: 'cust-' + Date.now(),
        name: newTrip.customerName,
        phone: '',
        city: newTrip.fromLocation,
        gstin: '',
        createdAt: new Date().toISOString()
      });
    }
    fileDb.save();
  }

  return newTrip;
}

export async function updateTrip(tripId, fields) {
  const current = await getTripById(tripId);
  if (!current) return null;

  const updated = {
    ...current,
    ...fields,
    id: tripId,
    vehicleNumber: (fields.vehicleNumber || current.vehicleNumber || '').toUpperCase().trim(),
    amount: Number(fields.amount !== undefined ? fields.amount : current.amount),
    paidAmount: Number(fields.paidAmount !== undefined ? fields.paidAmount : current.paidAmount),
    fuelCost: Number(fields.fuelCost !== undefined ? fields.fuelCost : current.fuelCost),
    driverCost: Number(fields.driverCost !== undefined ? fields.driverCost : current.driverCost),
    tollCost: Number(fields.tollCost !== undefined ? fields.tollCost : current.tollCost),
    otherExpense: Number(fields.otherExpense !== undefined ? fields.otherExpense : current.otherExpense),
    updatedAt: new Date().toISOString()
  };

  if (updated.status === 'Paid') {
    updated.paidAmount = updated.amount;
  } else if (updated.status === 'Pending') {
    updated.paidAmount = 0;
  }

  const mongo = await getMongoDb();
  if (mongo) {
    const { id, ...mongoDoc } = updated;
    await mongo.collection('trips').updateOne({ _id: tripId }, { $set: mongoDoc });
  } else {
    const idx = fileDb.data.trips.findIndex(t => t.id === tripId);
    if (idx !== -1) {
      fileDb.data.trips[idx] = updated;
      fileDb.save();
    }
  }

  return updated;
}

export async function deleteTrip(tripId) {
  const mongo = await getMongoDb();
  if (mongo) {
    const res = await mongo.collection('trips').deleteOne({ _id: tripId });
    return res.deletedCount > 0;
  }
  const idx = fileDb.data.trips.findIndex(t => t.id === tripId);
  if (idx !== -1) {
    fileDb.data.trips.splice(idx, 1);
    fileDb.save();
    return true;
  }
  return false;
}

// --------------------------------------------------------------------------
// CUSTOMERS
// --------------------------------------------------------------------------
export async function getCustomers() {
  const [customers, trips] = await Promise.all([
    (async () => {
      const mongo = await getMongoDb();
      if (mongo) {
        const list = await mongo.collection('customers').find({}).sort({ name: 1 }).toArray();
        return list.map(c => {
          const { _id, ...rest } = c;
          return { id: _id, ...rest };
        });
      }
      return fileDb.data.customers;
    })(),
    getTrips()
  ]);

  // Augment with calculated ledger stats
  const stats = {};
  trips.forEach(t => {
    const name = (t.customerName || '').toLowerCase().trim();
    if (!stats[name]) stats[name] = { total: 0, paid: 0, pending: 0, trips: 0 };
    const amt = Number(t.amount) || 0;
    const paid = Number(t.paidAmount) || (t.status === 'Paid' ? amt : 0);
    stats[name].total += amt;
    stats[name].paid += paid;
    stats[name].pending += (amt - paid);
    stats[name].trips += 1;
  });

  return customers.map(c => {
    const s = stats[c.name.toLowerCase().trim()] || { total: 0, paid: 0, pending: 0, trips: 0 };
    return {
      ...c,
      totalBusiness: s.total,
      paidAmount: s.paid,
      pendingBalance: s.pending,
      totalTrips: s.trips
    };
  });
}

export async function createCustomer(custData) {
  const cleanName = (custData.name || '').trim();
  if (!cleanName) throw new Error('Customer name is required');

  const newCust = {
    id: custData.id || 'cust-' + Date.now(),
    name: cleanName,
    phone: custData.phone || '',
    city: custData.city || '',
    gstin: custData.gstin || '',
    createdAt: new Date().toISOString()
  };

  const mongo = await getMongoDb();
  if (mongo) {
    const existing = await mongo.collection('customers').findOne({ name: new RegExp(`^${cleanName}$`, 'i') });
    if (existing) {
      await mongo.collection('customers').updateOne({ _id: existing._id }, { $set: { phone: newCust.phone, city: newCust.city, gstin: newCust.gstin } });
      return { id: existing._id, ...newCust };
    }
    await mongo.collection('customers').insertOne({ ...newCust, _id: newCust.id });
  } else {
    const existing = fileDb.data.customers.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      existing.phone = newCust.phone;
      existing.city = newCust.city;
      existing.gstin = newCust.gstin;
      fileDb.save();
      return existing;
    }
    fileDb.data.customers.push(newCust);
    fileDb.save();
  }

  return newCust;
}

export async function updateCustomer(customerId, fields) {
  const mongo = await getMongoDb();
  if (mongo) {
    await mongo.collection('customers').updateOne({ _id: customerId }, { $set: fields });
    const updated = await mongo.collection('customers').findOne({ _id: customerId });
    if (!updated) return null;
    const { _id, ...rest } = updated;
    return { id: _id, ...rest };
  }

  const idx = fileDb.data.customers.findIndex(c => c.id === customerId);
  if (idx === -1) return null;
  fileDb.data.customers[idx] = { ...fileDb.data.customers[idx], ...fields };
  fileDb.save();
  return fileDb.data.customers[idx];
}

export async function deleteCustomer(customerId) {
  const mongo = await getMongoDb();
  if (mongo) {
    const res = await mongo.collection('customers').deleteOne({ _id: customerId });
    return res.deletedCount > 0;
  }
  const idx = fileDb.data.customers.findIndex(c => c.id === customerId);
  if (idx !== -1) {
    fileDb.data.customers.splice(idx, 1);
    fileDb.save();
    return true;
  }
  return false;
}

// --------------------------------------------------------------------------
// VEHICLES (FLEET MANAGEMENT & DOCUMENT COMPLIANCE)
// --------------------------------------------------------------------------
export async function getVehicles() {
  const [vehicles, trips] = await Promise.all([
    (async () => {
      const mongo = await getMongoDb();
      if (mongo) {
        const list = await mongo.collection('vehicles').find({}).sort({ vehicleNumber: 1 }).toArray();
        return list.map(v => {
          const { _id, ...rest } = v;
          return { id: _id, ...rest };
        });
      }
      return fileDb.data.vehicles;
    })(),
    getTrips()
  ]);

  // Augment with financial performance
  const stats = {};
  trips.forEach(t => {
    const vNum = (t.vehicleNumber || '').toUpperCase().trim();
    if (!stats[vNum]) stats[vNum] = { trips: 0, revenue: 0, fuel: 0, driver: 0, toll: 0, other: 0 };
    stats[vNum].trips += 1;
    stats[vNum].revenue += (Number(t.amount) || 0);
    stats[vNum].fuel += (Number(t.fuelCost) || 0);
    stats[vNum].driver += (Number(t.driverCost) || 0);
    stats[vNum].toll += (Number(t.tollCost) || 0);
    stats[vNum].other += (Number(t.otherExpense) || 0);
  });

  return vehicles.map(v => {
    const num = (v.vehicleNumber || '').toUpperCase().trim();
    const s = stats[num] || { trips: 0, revenue: 0, fuel: 0, driver: 0, toll: 0, other: 0 };
    const totalExp = s.fuel + s.driver + s.toll + s.other;
    return {
      ...v,
      totalTrips: s.trips,
      totalRevenue: s.revenue,
      totalExpenses: totalExp,
      netProfit: s.revenue - totalExp,
      fuelExpenses: s.fuel
    };
  });
}

export async function createVehicle(vehData) {
  const vNum = (vehData.vehicleNumber || '').toUpperCase().trim();
  if (!vNum) throw new Error('Vehicle registration number is required');

  const newVeh = {
    id: vehData.id || 'veh-' + Date.now(),
    vehicleNumber: vNum,
    makeModel: vehData.makeModel || 'Commercial Truck',
    vehicleType: vehData.vehicleType || '10 Wheeler Truck',
    capacityTons: Number(vehData.capacityTons) || 16,
    ownership: vehData.ownership || 'Owned',
    driverName: vehData.driverName || '',
    fitnessExpiry: vehData.fitnessExpiry || '',
    insuranceExpiry: vehData.insuranceExpiry || '',
    permitExpiry: vehData.permitExpiry || '',
    pucExpiry: vehData.pucExpiry || '',
    status: vehData.status || 'Active',
    createdAt: new Date().toISOString()
  };

  const mongo = await getMongoDb();
  if (mongo) {
    const existing = await mongo.collection('vehicles').findOne({ vehicleNumber: vNum });
    if (existing) throw new Error(`Vehicle ${vNum} is already registered`);
    await mongo.collection('vehicles').insertOne({ ...newVeh, _id: newVeh.id });
  } else {
    const existing = fileDb.data.vehicles.find(v => v.vehicleNumber.toUpperCase().trim() === vNum);
    if (existing) throw new Error(`Vehicle ${vNum} is already registered`);
    fileDb.data.vehicles.push(newVeh);
    fileDb.save();
  }

  return newVeh;
}

export async function updateVehicle(vehicleId, fields) {
  const mongo = await getMongoDb();
  if (mongo) {
    if (fields.vehicleNumber) fields.vehicleNumber = fields.vehicleNumber.toUpperCase().trim();
    await mongo.collection('vehicles').updateOne({ _id: vehicleId }, { $set: fields });
    const updated = await mongo.collection('vehicles').findOne({ _id: vehicleId });
    if (!updated) return null;
    const { _id, ...rest } = updated;
    return { id: _id, ...rest };
  }

  const idx = fileDb.data.vehicles.findIndex(v => v.id === vehicleId);
  if (idx === -1) return null;
  fileDb.data.vehicles[idx] = {
    ...fileDb.data.vehicles[idx],
    ...fields,
    vehicleNumber: (fields.vehicleNumber || fileDb.data.vehicles[idx].vehicleNumber).toUpperCase().trim()
  };
  fileDb.save();
  return fileDb.data.vehicles[idx];
}

export async function deleteVehicle(vehicleId) {
  const mongo = await getMongoDb();
  if (mongo) {
    const res = await mongo.collection('vehicles').deleteOne({ _id: vehicleId });
    return res.deletedCount > 0;
  }
  const idx = fileDb.data.vehicles.findIndex(v => v.id === vehicleId);
  if (idx !== -1) {
    fileDb.data.vehicles.splice(idx, 1);
    fileDb.save();
    return true;
  }
  return false;
}

// --------------------------------------------------------------------------
// DRIVERS & TRIP KHARACHA / ADVANCE LEDGER
// --------------------------------------------------------------------------
export async function getDrivers() {
  const mongo = await getMongoDb();
  if (mongo) {
    const list = await mongo.collection('drivers').find({}).sort({ name: 1 }).toArray();
    return list.map(d => {
      const { _id, ...rest } = d;
      return { id: _id, ...rest };
    });
  }
  return fileDb.data.drivers;
}

export async function createDriver(driverData) {
  const name = (driverData.name || '').trim();
  if (!name) throw new Error('Driver name is required');

  const newDriver = {
    id: driverData.id || 'driv-' + Date.now(),
    name,
    phone: driverData.phone || '',
    licenseNumber: driverData.licenseNumber || '',
    assignedVehicle: (driverData.assignedVehicle || '').toUpperCase().trim(),
    status: driverData.status || 'Available',
    advanceBalance: Number(driverData.advanceBalance) || 0,
    monthlySalary: Number(driverData.monthlySalary) || 0,
    createdAt: new Date().toISOString()
  };

  const mongo = await getMongoDb();
  if (mongo) {
    await mongo.collection('drivers').insertOne({ ...newDriver, _id: newDriver.id });
  } else {
    fileDb.data.drivers.push(newDriver);
    fileDb.save();
  }

  return newDriver;
}

export async function updateDriver(driverId, fields) {
  const mongo = await getMongoDb();
  if (mongo) {
    await mongo.collection('drivers').updateOne({ _id: driverId }, { $set: fields });
    const updated = await mongo.collection('drivers').findOne({ _id: driverId });
    if (!updated) return null;
    const { _id, ...rest } = updated;
    return { id: _id, ...rest };
  }

  const idx = fileDb.data.drivers.findIndex(d => d.id === driverId);
  if (idx === -1) return null;
  fileDb.data.drivers[idx] = { ...fileDb.data.drivers[idx], ...fields };
  fileDb.save();
  return fileDb.data.drivers[idx];
}

export async function recordDriverAdvance(driverId, amount, type = 'advance') {
  const amt = Number(amount) || 0;
  const mongo = await getMongoDb();
  if (mongo) {
    const driv = await mongo.collection('drivers').findOne({ _id: driverId });
    if (!driv) return null;
    let newBal = (Number(driv.advanceBalance) || 0) + (type === 'advance' ? amt : -amt);
    newBal = Math.max(0, newBal);
    await mongo.collection('drivers').updateOne({ _id: driverId }, { $set: { advanceBalance: newBal } });
    return { id: driv._id, ...driv, advanceBalance: newBal };
  }

  const idx = fileDb.data.drivers.findIndex(d => d.id === driverId);
  if (idx === -1) return null;
  const curBal = Number(fileDb.data.drivers[idx].advanceBalance) || 0;
  const newBal = type === 'advance' ? curBal + amt : Math.max(0, curBal - amt);
  fileDb.data.drivers[idx].advanceBalance = newBal;
  fileDb.save();
  return fileDb.data.drivers[idx];
}

export async function deleteDriver(driverId) {
  const mongo = await getMongoDb();
  if (mongo) {
    const res = await mongo.collection('drivers').deleteOne({ _id: driverId });
    return res.deletedCount > 0;
  }
  const idx = fileDb.data.drivers.findIndex(d => d.id === driverId);
  if (idx !== -1) {
    fileDb.data.drivers.splice(idx, 1);
    fileDb.save();
    return true;
  }
  return false;
}

// --------------------------------------------------------------------------
// SETTINGS
// --------------------------------------------------------------------------
export async function getSettings() {
  const mongo = await getMongoDb();
  if (mongo) {
    const settingsDoc = await mongo.collection('settings').findOne({ _id: 'main_settings' });
    if (settingsDoc) {
      const { _id, ...rest } = settingsDoc;
      return rest;
    }
    return DEFAULT_DATABASE.settings;
  }
  return fileDb.data.settings;
}

export async function updateSettings(newSettings) {
  const mongo = await getMongoDb();
  if (mongo) {
    await mongo.collection('settings').updateOne(
      { _id: 'main_settings' },
      { $set: newSettings },
      { upsert: true }
    );
    return getSettings();
  }
  fileDb.data.settings = { ...fileDb.data.settings, ...newSettings };
  fileDb.save();
  return fileDb.data.settings;
}

// --------------------------------------------------------------------------
// ANALYTICS & METRICS
// --------------------------------------------------------------------------
export async function getAnalytics() {
  const [trips, customers, vehicles, drivers, dbInfo] = await Promise.all([
    getTrips(),
    getCustomers(),
    getVehicles(),
    getDrivers(),
    getDbStatus()
  ]);

  let totalRevenue = 0, totalFuel = 0, totalDriver = 0, totalToll = 0, totalOther = 0;
  let totalPaid = 0, totalPending = 0;

  trips.forEach(t => {
    const amt = Number(t.amount) || 0;
    const paid = Number(t.paidAmount) || (t.status === 'Paid' ? amt : 0);
    totalRevenue += amt;
    totalPaid += paid;
    totalPending += (amt - paid);

    totalFuel += Number(t.fuelCost) || 0;
    totalDriver += Number(t.driverCost) || 0;
    totalToll += Number(t.tollCost) || 0;
    totalOther += Number(t.otherExpense) || 0;
  });

  const totalExpenses = totalFuel + totalDriver + totalToll + totalOther;
  const netProfit = totalRevenue - totalExpenses;

  // Check vehicle document expiries (< 30 days or expired)
  const now = new Date();
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  let expiringDocsCount = 0;
  const expiringVehicles = [];

  vehicles.forEach(v => {
    const dates = [
      { doc: 'Fitness', date: v.fitnessExpiry },
      { doc: 'Insurance', date: v.insuranceExpiry },
      { doc: 'Permit', date: v.permitExpiry },
      { doc: 'PUC', date: v.pucExpiry }
    ];
    dates.forEach(({ doc, date }) => {
      if (date) {
        const d = new Date(date);
        if (d <= thirtyDaysAhead) {
          expiringDocsCount++;
          expiringVehicles.push({
            vehicleNumber: v.vehicleNumber,
            document: doc,
            expiryDate: date,
            isExpired: d < now
          });
        }
      }
    });
  });

  return {
    database: dbInfo,
    totalRevenue,
    totalPaid,
    totalPending,
    totalExpenses,
    netProfit,
    profitMargin: totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0,
    expensesBreakdown: {
      fuel: totalFuel,
      driver: totalDriver,
      toll: totalToll,
      other: totalOther
    },
    tripsCount: trips.length,
    customersCount: customers.length,
    vehiclesCount: vehicles.length,
    driversCount: drivers.length,
    expiringDocsCount,
    expiringVehicles
  };
}

// --------------------------------------------------------------------------
// BACKUP & RESTORE
// --------------------------------------------------------------------------
export async function exportAll() {
  const [settings, customers, vehicles, drivers, trips, dbStatus] = await Promise.all([
    getSettings(),
    getCustomers(),
    getVehicles(),
    getDrivers(),
    getTrips(),
    getDbStatus()
  ]);

  return {
    app: "Transport Ledger",
    version: "2.0.0",
    exportDate: new Date().toISOString(),
    databaseEngine: dbStatus.engine,
    settings,
    customers,
    vehicles,
    drivers,
    trips
  };
}

export async function importAll(backupData) {
  if (!backupData || typeof backupData !== 'object') {
    throw new Error('Invalid backup file');
  }

  const mongo = await getMongoDb();
  if (mongo) {
    if (backupData.settings) {
      await mongo.collection('settings').updateOne({ _id: 'main_settings' }, { $set: backupData.settings }, { upsert: true });
    }
    if (Array.isArray(backupData.customers)) {
      await mongo.collection('customers').deleteMany({});
      if (backupData.customers.length > 0) {
        await mongo.collection('customers').insertMany(backupData.customers.map(c => ({ ...c, _id: c.id })));
      }
    }
    if (Array.isArray(backupData.vehicles)) {
      await mongo.collection('vehicles').deleteMany({});
      if (backupData.vehicles.length > 0) {
        await mongo.collection('vehicles').insertMany(backupData.vehicles.map(v => ({ ...v, _id: v.id })));
      }
    }
    if (Array.isArray(backupData.drivers)) {
      await mongo.collection('drivers').deleteMany({});
      if (backupData.drivers.length > 0) {
        await mongo.collection('drivers').insertMany(backupData.drivers.map(d => ({ ...d, _id: d.id })));
      }
    }
    if (Array.isArray(backupData.trips)) {
      await mongo.collection('trips').deleteMany({});
      if (backupData.trips.length > 0) {
        await mongo.collection('trips').insertMany(backupData.trips.map(t => ({ ...t, _id: t.id })));
      }
    }
  } else {
    fileDb.createBackup();
    if (backupData.settings) fileDb.data.settings = backupData.settings;
    if (Array.isArray(backupData.customers)) fileDb.data.customers = backupData.customers;
    if (Array.isArray(backupData.vehicles)) fileDb.data.vehicles = backupData.vehicles;
    if (Array.isArray(backupData.drivers)) fileDb.data.drivers = backupData.drivers;
    if (Array.isArray(backupData.trips)) fileDb.data.trips = backupData.trips;
    fileDb.save();
  }

  return { success: true };
}

export async function resetToDefaults() {
  const mongo = await getMongoDb();
  if (mongo) {
    await mongo.collection('settings').updateOne({ _id: 'main_settings' }, { $set: DEFAULT_DATABASE.settings }, { upsert: true });
    await mongo.collection('customers').deleteMany({});
    await mongo.collection('customers').insertMany(DEFAULT_DATABASE.customers.map(c => ({ ...c, _id: c.id })));
    await mongo.collection('vehicles').deleteMany({});
    await mongo.collection('vehicles').insertMany(DEFAULT_DATABASE.vehicles.map(v => ({ ...v, _id: v.id })));
    await mongo.collection('drivers').deleteMany({});
    await mongo.collection('drivers').insertMany(DEFAULT_DATABASE.drivers.map(d => ({ ...d, _id: d.id })));
    await mongo.collection('trips').deleteMany({});
    await mongo.collection('trips').insertMany(DEFAULT_DATABASE.trips.map(t => ({ ...t, _id: t.id })));
  } else {
    fileDb.createBackup();
    fileDb.data = JSON.parse(JSON.stringify(DEFAULT_DATABASE));
    fileDb.save();
  }
  return { success: true };
}
