# 🚛 Transport Ledger (ट्रांसपोर्ट लेजर)
### Enterprise Indian Transport Business Ledger, Fleet Management & Freight Accounting System

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20Ready-brightgreen.svg)](https://www.mongodb.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise-grade, high-performance web application designed specifically for Indian commercial fleet owners, transport contractors, truck brokers, and logistics operators. Built with modern, responsive aesthetics (Emerald green, mint, and warm orange palette), zero bloatware, offline resilience, and hybrid persistence supporting both **MongoDB Atlas** and **local atomic file databases**.

---

## 🌟 Key Features

### 1. 📋 Trip Register & Commercial Bilty Management
- **Trip Recording**: Full route details (Origin ➔ Destination), Consignor, Consignee, Vehicle Registration, Driver, E-Way Bill Number, and Weight in Metric Tons.
- **Freight Financials**: Freight amount, Advance paid, and Balance due with real-time balance calculations.
- **Trip Expense Breakdown**: Track diesel/fuel expenses, driver daily bhatta/allowances, toll taxes, and enroute maintenance costs to calculate net trip profit margin automatically.
- **Instant Search & Filters**: Search trips by LR number, customer, truck number, route, or filter by payment status (Paid, Partial, Pending) and date range.

### 2. 🚛 Fleet Management & Vehicle Document Compliance
- **Vehicle Profiles**: Register 10-wheelers, 6-wheelers, 12-wheelers, multi-axle trailers, and mini-trucks. Distinguish between owned fleet and attached/market vehicles.
- **Statutory Document Expiry Tracking**: Visual status badges for:
  - Fitness Certificate
  - Commercial Vehicle Insurance
  - National Permit
  - PUC (Pollution Under Control)
- **Early Warning System**: Automated warnings when documents are expiring within 30 days or expired, with an urgent compliance alert banner on the dashboard.
- **Vehicle Profitability**: Track trips completed, gross revenue generated, diesel burned, and net profit per truck.

### 3. 👨‍✈️ Driver & Staff Kharacha (Advance) Ledger
- **Driver Profiles**: Contact numbers, driving license numbers, assigned vehicles, monthly salary, and trip status (Available, On Trip, On Leave).
- **Trip Kharacha / Advance Tracking**: Record enroute driver advances and easily settle advances against trip settlements or monthly salary.
- **One-Click WhatsApp & Call**: Directly launch WhatsApp chats or dial drivers from the dashboard.

### 4. 👥 Customer Accounts & Party Ledgers
- **Customer Directory**: Track all logistics clients, consignors, cities, phone numbers, and GSTIN.
- **Customer Statements**: Instant statements showing total freight business volume, total payments cleared, and outstanding balances.
- **WhatsApp Payment Reminders**: Auto-generates polite, professional WhatsApp reminders formatted with trip summary, balance due, bank transfer details, and instant UPI payment link.

### 5. ⚡ Dynamic UPI QR Code & Printable Lorry Receipts (LR)
- **Printable Lorry Receipt (Bilty)**: Indian transport standard consignment note with company details, GSTIN, PAN, consignor/consignee boxes, goods description, terms, and signature boxes.
- **Dynamic UPI QR Code**: Generates on-the-fly UPI QR codes (compatible with PhonePe, Google Pay, and Paytm) encoded with the exact outstanding balance and invoice reference for direct scanning.
- **Print-to-PDF**: Clean, paperless print styling that hides navigation bars and prints formatted consignment notes.

### 6. 📊 Reports & GST / RCM Analytics
- **Turnover & Profit/Loss**: Visual breakdown of gross collections, operating expenses, and net profit margins.
- **GST GTA & RCM Tracker**: Calculates Reverse Charge Mechanism (5% GTA RCM) liability payable by consignor/consignee.
- **Export to CSV**: One-click CSV and Excel export for trips, fleet vehicles, and driver ledgers.

### 7. ☁️ MongoDB Atlas Cloud & Hybrid Storage
- **MongoDB Atlas**: High-availability cloud persistence for multiple branch offices and multi-device coordination.
- **Automatic Fallback**: If no MongoDB connection is configured or the network is offline, the app seamlessly runs using the local atomic JSON file database (`data/database.json`) and browser LocalStorage.
- **LAN Mobile Access**: Built-in WiFi pairing QR code and local network IP display for operating the application from mobile phones or tablets in the transport yard.

### 8. 🔐 Safe & Secure Multi-Tenant Authentication (Email & Google Login)
- **Dual Authentication**: Support for both standard Email ID + password login and 1-click **Google Sign-In**.
- **Cryptographic Security**: Salted PBKDF2 password hashing (10,000 rounds) and HMAC-SHA256 signed stateless session tokens with 30-day persistence.
- **Strict Data Isolation**: All fleet records, trips, customer ledgers, and drivers are scoped per user account (`userId`), ensuring private transport data remains strictly confidential and secure.

### 9. 🛡️ Anti-Bot CAPTCHA Enrollment & Cloud Email Backup
- **Anti-Bot Security Challenge**: High-entropy visual SVG CAPTCHA challenge with randomized distortion lines, noise dots, and HMAC token validation required for new user enrollment.
- **Cloud Mail ID Backup System**: Replaces manual backups with a direct, encrypted snapshot backup linked to the owner's verified Mail ID.
- **One-Click Email Dispatch**: Instantly triggers cloud backups and maintains an auditable backup ledger with timestamps, snapshot sizes, and record statistics in MongoDB.

---

## 🚀 Quick Start (Running Locally)

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### 1. Clone & Install
```bash
git clone https://github.com/SanjayElumalai2006/transport-ledger.git
cd transport-ledger
npm install
```

### 2. Configure Environment (Optional for MongoDB)
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

To connect to MongoDB Atlas, add your connection string:
```env
PORT=8080
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/transport_ledger?retryWrites=true&w=majority
MONGODB_DB_NAME=transport_ledger
```
*(Note: If `MONGODB_URI` is left blank, the app will automatically use the local file database in `./data/database.json`)*.

### 3. Start Server
```bash
npm start
```
Or with automatic reload during development:
```bash
npm run dev
```

Open your browser at:
```
http://localhost:8080/
```

On Windows, you can also launch the server directly with PowerShell:
```powershell
.\server.ps1
```

---

## 🌐 Deploying to Vercel (Permanent Cloud Hosting)

Transport Ledger is pre-configured with `vercel.json` and a serverless API handler in `api/index.js` for instant deployment on Vercel.

### Option A: Deploy via GitHub & Vercel Dashboard
1. Push your repository to GitHub (`origin main`).
2. Log in to [Vercel](https://vercel.com/) and click **"Add New Project"**.
3. Import your GitHub repository `transport-ledger`.
4. In **Environment Variables**, add:
   - `MONGODB_URI`: Your MongoDB Atlas connection string.
   - `MONGODB_DB_NAME`: `transport_ledger` (optional).
5. Click **"Deploy"**.
6. Your transport ledger web application is live permanently with high-speed CDN and automated backups!

### Option B: Deploy via Vercel CLI
```bash
npx vercel
```
Follow the interactive prompts and add your `MONGODB_URI` when asked for environment variables.

---

## 🛠️ REST API Specification

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Server uptime, LAN network IPs, and MongoDB connection status |
| `GET` | `/api/trips` | Retrieve all trips |
| `POST` | `/api/trips` | Record a new trip |
| `PUT` | `/api/trips/:id` | Update an existing trip |
| `DELETE` | `/api/trips/:id` | Delete a trip record |
| `GET` | `/api/vehicles` | List fleet vehicles with compliance expiries & profit stats |
| `POST` | `/api/vehicles` | Register a new vehicle |
| `PUT` | `/api/vehicles/:id` | Update vehicle or document expiry dates |
| `DELETE` | `/api/vehicles/:id` | Delete vehicle profile |
| `GET` | `/api/drivers` | List drivers with Kharacha balances |
| `POST` | `/api/drivers` | Register a new driver |
| `POST` | `/api/drivers/:id/advance` | Disburse or settle driver trip advances |
| `GET` | `/api/customers` | List customer accounts with ledger balances |
| `POST` | `/api/customers` | Add or update a customer |
| `GET` | `/api/analytics` | High-level turnover, expense breakdown, and profit margins |
| `GET` | `/api/export` | Download complete database backup JSON |
| `POST` | `/api/import` | Restore database from JSON backup |
| `POST` | `/api/reset` | Reset to factory default sample data |

---

## 📁 Project Structure

```
transport-ledger/
├── api/
│   ├── index.js          # Vercel serverless function entrypoint
│   └── router.js         # Unified REST API router
├── css/
│   └── styles.css        # Enterprise design system, dark mode & print styles
├── data/
│   ├── database.json     # Atomic JSON file database (fallback)
│   └── backups/          # Automated database recovery points
├── js/
│   ├── app.js            # Main view controller, events, and UI logic
│   ├── charts.js         # Income trend, top customers & payment status charts
│   ├── sampleData.js     # Default Indian transport sample dataset
│   ├── storage.js        # Hybrid storage client (REST API + LocalStorage cache)
│   └── utils.js          # Currency, date, UPI QR, WhatsApp & CSV exporter
├── lib/
│   └── db.js             # Hybrid MongoDB Atlas + File Database Engine
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore rules for node_modules and backups
├── index.html            # Main web application interface
├── package.json          # Node.js project manifest & dependencies
├── server.js             # Standalone Node.js HTTP server
├── server.ps1            # Windows PowerShell launcher
├── vercel.json           # Vercel deployment & routing configuration
└── README.md             # Documentation
```

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

Developed with ❤️ for the Indian Commercial Transport Community.
