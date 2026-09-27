/**
 * Transport Ledger - Main Application Logic & View Controller
 * Enterprise Indian Transport Business Ledger, Fleet Management & Freight Accounting System
 * With MongoDB Atlas cloud sync, vehicle document compliance tracking,
 * driver Kharacha advance ledger, dynamic UPI QR payments, and printable LR receipts.
 */

import {
  initStorage,
  getTrips,
  saveTrip,
  updateTrip,
  deleteTrip,
  getCustomers,
  saveCustomer,
  updateCustomer,
  deleteCustomer,
  getVehicles,
  saveVehicle,
  updateVehicle,
  deleteVehicle,
  getDrivers,
  saveDriver,
  updateDriver,
  deleteDriver,
  recordDriverAdvance,
  getSettings,
  saveSettings,
  exportBackupJSON,
  importBackupJSON,
  resetToSampleData,
  getSyncStatus,
  onSyncStatusChange,
  triggerSync,
  fetchAnalytics,
  getCurrentUser,
  isAuthenticated,
  onAuthChange,
  registerUser,
  loginUser,
  logoutUser,
  loginWithGoogle,
  generateClientCaptcha,
  verifyClientCaptcha,
  fetchCaptcha,
  sendBackupToEmail,
  getBackupHistory
} from './storage.js';

import {
  formatRupee,
  formatDate,
  formatDateInput,
  getTodayString,
  checkDocumentExpiry,
  generateLRNumber,
  generateUpiPayLink,
  generateUpiQrCodeUrl,
  generateWhatsAppReminderLink,
  exportTripsToCSV,
  exportCustomerLedgerToCSV,
  exportVehiclesToCSV,
  exportDriversToCSV
} from './utils.js';

import {
  renderMonthlyIncomeChart,
  renderTopCustomersChart,
  renderPaymentStatusChart
} from './charts.js';

// Application State
const state = {
  currentTab: 'dashboard',
  trips: [],
  customers: [],
  vehicles: [],
  drivers: [],
  settings: {},
  tripFilter: {
    search: '',
    customer: 'all',
    status: 'all',
    dateRange: 'all' // all, today, month, year
  },
  vehicleFilter: {
    search: '',
    ownership: 'all'
  },
  driverFilter: {
    search: '',
    status: 'all'
  },
  editingTripId: null,
  editingCustomerId: null,
  editingVehicleId: null,
  editingDriverId: null,
  viewingCustomerStatement: null
};

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  await initStorage();
  loadState();
  setupNavigation();
  setupGlobalEvents();
  setupSyncMonitoring();
  renderCurrentTab();

  onAuthChange(() => {
    loadState();
    renderCurrentTab();
  });
});

function loadState() {
  state.trips = getTrips();
  state.customers = getCustomers();
  state.vehicles = getVehicles();
  state.drivers = getDrivers();
  state.settings = getSettings();
  updateHeaderInfo();
}

function updateHeaderInfo() {
  const user = getCurrentUser();
  const bizNameEls = document.querySelectorAll('.biz-name-text');
  const ownerEls = document.querySelectorAll('.biz-owner-text');
  const avatarEls = document.querySelectorAll('.business-avatar');

  const displayName = user ? user.name : (state.settings.ownerName || 'Demo Transport');
  const displayBiz = user ? (user.businessName || state.settings.businessName) : (state.settings.businessName || 'Demo Ledger');

  bizNameEls.forEach(el => el.textContent = displayBiz);
  ownerEls.forEach(el => el.textContent = user ? `${displayName} (Cloud)` : `${displayName} (Guest)`);

  avatarEls.forEach(el => {
    if (user && user.avatar) {
      el.innerHTML = `<img src="${user.avatar}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" />`;
    } else {
      const initials = displayName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'TL';
      el.textContent = initials;
    }
  });

  // Header quick Sign In button
  const authBtn = document.getElementById('btn-header-auth');
  if (authBtn) {
    if (user) {
      authBtn.style.display = 'none';
    } else {
      authBtn.style.display = 'inline-flex';
      authBtn.onclick = () => switchTab('login');
    }
  }

  // Sidebar and mobile nav labels
  const navLoginLabel = document.getElementById('nav-login-label');
  const mobileLoginLabel = document.getElementById('mobile-nav-login-label');
  if (navLoginLabel) {
    navLoginLabel.textContent = user ? `${user.name.split(' ')[0]} (Cloud)` : 'Login / Account';
  }
  if (mobileLoginLabel) {
    mobileLoginLabel.textContent = user ? 'Account' : 'Login';
  }

  const bizPills = document.querySelectorAll('.business-pill');
  bizPills.forEach(pill => {
    pill.classList.add('clickable');
    pill.title = user ? `Logged in as ${user.email} (Click for Account)` : 'Click to Sign In or Enroll';
    pill.onclick = () => {
      if (user) {
        openProfileModal();
      } else {
        switchTab('login');
      }
    };
  });
}

// Setup Nav Links & Buttons
function setupNavigation() {
  const navLinks = document.querySelectorAll('[data-tab]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = link.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // Global Add Trip Buttons
  const addTripBtns = document.querySelectorAll('.action-add-trip');
  addTripBtns.forEach(btn => {
    btn.addEventListener('click', () => openTripModal());
  });
}

export function switchTab(tabName) {
  state.currentTab = tabName;

  // Update Nav Active States
  document.querySelectorAll('[data-tab]').forEach(el => {
    if (el.getAttribute('data-tab') === tabName) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Update Page Title & Subtitle
  const titleEl = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');

  const titles = {
    dashboard: { title: 'Dashboard', subtitle: 'Overview of daily trips, collections & fleet compliance' },
    trips: { title: 'Trip Register', subtitle: 'All transport trips, route details, and payment statuses' },
    vehicles: { title: 'Fleet & Vehicles', subtitle: 'Vehicle compliance, document expiry dates & profitability' },
    drivers: { title: 'Drivers & Kharacha', subtitle: 'Driver profiles, vehicle assignments & trip advance ledger' },
    customers: { title: 'Customer Directory', subtitle: 'Manage customer accounts, total business & pending dues' },
    reports: { title: 'Financial Reports', subtitle: 'Turnover, GST/RCM summary, diesel expenses & profit analytics' },
    settings: { title: 'Business Settings', subtitle: 'Business profile, bank details, MongoDB cloud sync & backups' },
    login: { title: 'Account & Cloud Storage', subtitle: 'Sign in or enroll to manage your isolated cloud ledger' }
  };

  if (titles[tabName]) {
    if (titleEl) titleEl.textContent = titles[tabName].title;
    if (subtitleEl) subtitleEl.textContent = titles[tabName].subtitle;
  }

  renderCurrentTab();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.switchTab = switchTab;

function setupSyncMonitoring() {
  const syncPill = document.getElementById('header-sync-pill');
  const syncText = document.getElementById('sync-status-text');
  const mobileSync = document.getElementById('mobile-sync-indicator');

  const updateUI = ({ isServerOnline, serverInfo }) => {
    if (isServerOnline) {
      const isMongo = serverInfo.database && serverInfo.database.isMongo;
      const label = isMongo ? 'MongoDB: Cloud Connected' : 'Server: Local Synced';

      if (syncPill) {
        syncPill.className = 'sync-pill online';
        syncPill.title = isMongo ? 'Connected to MongoDB Atlas Database' : 'Connected to Local File Database';
      }
      if (syncText) syncText.textContent = label;
      if (mobileSync) {
        mobileSync.className = 'sync-pill online';
        mobileSync.title = label;
      }
    } else {
      if (syncPill) {
        syncPill.className = 'sync-pill offline';
        syncPill.title = 'Offline mode: operating from local browser cache';
      }
      if (syncText) syncText.textContent = 'Offline: Local Cache';
      if (mobileSync) {
        mobileSync.className = 'sync-pill offline';
        mobileSync.title = 'Offline Cache';
      }
    }
  };

  onSyncStatusChange(updateUI);
  updateUI(getSyncStatus());
}

function setupGlobalEvents() {
  // Theme Toggle Button
  const themeToggle = document.getElementById('btn-theme-toggle');
  const mobileThemeToggle = document.getElementById('btn-mobile-theme');

  const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('transport_ledger_theme', newTheme);
  };

  const savedTheme = localStorage.getItem('transport_ledger_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  if (mobileThemeToggle) mobileThemeToggle.addEventListener('click', toggleTheme);

  // LAN Access & Diagnostics Button
  const mobileAccessBtn = document.getElementById('btn-mobile-access');
  if (mobileAccessBtn) {
    mobileAccessBtn.addEventListener('click', openDiagnosticsModal);
  }

  const syncPill = document.getElementById('header-sync-pill');
  if (syncPill) {
    syncPill.addEventListener('click', openDiagnosticsModal);
    syncPill.style.cursor = 'pointer';
  }
}

function renderCurrentTab() {
  const viewContainer = document.getElementById('view-container');
  if (!viewContainer) return;

  switch (state.currentTab) {
    case 'dashboard':
      viewContainer.innerHTML = renderDashboardView();
      initDashboardCharts();
      attachDashboardEvents();
      break;
    case 'trips':
      viewContainer.innerHTML = renderTripsView();
      attachTripEvents();
      break;
    case 'vehicles':
      viewContainer.innerHTML = renderVehiclesView();
      attachVehicleEvents();
      break;
    case 'drivers':
      viewContainer.innerHTML = renderDriversView();
      attachDriverEvents();
      break;
    case 'customers':
      viewContainer.innerHTML = renderCustomersView();
      attachCustomerEvents();
      break;
    case 'reports':
      viewContainer.innerHTML = renderReportsView();
      initReportCharts();
      attachReportsEvents();
      break;
    case 'settings':
      viewContainer.innerHTML = renderSettingsView();
      attachSettingsEvents();
      break;
    case 'login':
      viewContainer.innerHTML = renderLoginView();
      attachLoginEvents();
      break;
    default:
      viewContainer.innerHTML = renderDashboardView();
      initDashboardCharts();
      attachDashboardEvents();
  }
}

/* ==========================================================================
   1. DASHBOARD VIEW
   ========================================================================== */
function renderDashboardView() {
  const todayStr = getTodayString();
  const currentMonthStr = todayStr.substring(0, 7);
  const currentYearStr = todayStr.substring(0, 4);
  const user = getCurrentUser();

  // Calculations
  let todayAmt = 0, todayTrips = 0;
  let monthAmt = 0, monthTrips = 0, monthExpenses = 0;
  let yearAmt = 0, yearTrips = 0;
  let pendingAmt = 0;

  state.trips.forEach(t => {
    const amt = Number(t.amount) || 0;
    const paid = Number(t.paidAmount) || (t.status === 'Paid' ? amt : 0);
    const pend = amt - paid;
    const exp = (Number(t.fuelCost) || 0) + (Number(t.driverCost) || 0) + (Number(t.tollCost) || 0) + (Number(t.otherExpense) || 0);

    pendingAmt += pend;

    if (t.date === todayStr) {
      todayAmt += amt;
      todayTrips += 1;
    }

    if (t.date && t.date.startsWith(currentMonthStr)) {
      monthAmt += amt;
      monthExpenses += exp;
      monthTrips += 1;
    }

    if (t.date && t.date.startsWith(currentYearStr)) {
      yearAmt += amt;
      yearTrips += 1;
    }
  });

  const monthProfit = monthAmt - monthExpenses;
  const activeCustCount = state.customers.length;
  const totalVehiclesCount = state.vehicles.length;
  const activeVehiclesCount = state.vehicles.filter(v => (v.status || 'Active').toLowerCase() === 'active').length;

  // Scan expiring vehicle compliance documents
  const expiringDocs = [];
  state.vehicles.forEach(v => {
    const checks = [
      { doc: 'Fitness', date: v.fitnessExpiry },
      { doc: 'Insurance', date: v.insuranceExpiry },
      { doc: 'Permit', date: v.permitExpiry },
      { doc: 'PUC', date: v.pucExpiry }
    ];
    checks.forEach(({ doc, date }) => {
      if (date) {
        const info = checkDocumentExpiry(date);
        if (info.status === 'expired' || info.status === 'expiring') {
          expiringDocs.push({
            vehicleNumber: v.vehicleNumber,
            doc,
            date,
            status: info.status,
            label: info.label
          });
        }
      }
    });
  });

  const recentTrips = [...state.trips].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return `
    ${!user ? `
      <!-- Demo Guest Mode Banner -->
      <div class="demo-alert-banner">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:1.4rem;">🔔</span>
          <div>
            <strong>Previewing Demo Transport Ledger</strong>
            <div style="font-size:0.82rem; margin-top:2px;">Sign in with Email ID or Google to save your real trips, vehicles &amp; customers permanently in your private cloud.</div>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary btn-sm" onclick="window.switchTab('login')">
            Sign In / Auto Login
          </button>
          <button class="btn btn-outline btn-sm" onclick="window.openAuthModal('register')">
            New User Enroll
          </button>
        </div>
      </div>
    ` : ''}

    <!-- Top Metric Cards -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Today's Freight</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
        <div class="metric-value">${formatRupee(todayAmt)}</div>
        <div class="metric-sub">${todayTrips} trip${todayTrips !== 1 ? 's' : ''} recorded today</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">This Month Profit</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
        </div>
        <div class="metric-value" style="color: #047857;">${formatRupee(monthProfit)}</div>
        <div class="metric-sub">Gross: ${formatRupee(monthAmt)} • Exp: ${formatRupee(monthExpenses)}</div>
      </div>

      <div class="metric-card card-blue">
        <div class="metric-header">
          <span class="metric-title">Fleet Strength</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
          </div>
        </div>
        <div class="metric-value">${activeVehiclesCount} / ${totalVehiclesCount}</div>
        <div class="metric-sub">Active trucks running on routes</div>
      </div>

      <div class="metric-card card-orange">
        <div class="metric-header">
          <span class="metric-title">Pending Payment</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
        </div>
        <div class="metric-value text-pending">${formatRupee(pendingAmt)}</div>
        <div class="metric-sub">${activeCustCount} active customer accounts</div>
      </div>
    </div>

    <!-- Expiring Documents Alert Banner (If Any) -->
    ${expiringDocs.length > 0 ? `
      <div style="background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: var(--radius-md); padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: #ea580c; color: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div>
            <h4 style="font-size: 1rem; font-weight: 700; color: #9a3412;">Document Compliance Alert: ${expiringDocs.length} Action${expiringDocs.length > 1 ? 's' : ''} Needed</h4>
            <p style="font-size: 0.84rem; color: #c2410c; margin-top: 2px;">
              ${expiringDocs.slice(0, 3).map(d => `<strong>${d.vehicleNumber}</strong> (${d.doc}: ${d.label})`).join(' • ')}
              ${expiringDocs.length > 3 ? ` and ${expiringDocs.length - 3} more...` : ''}
            </p>
          </div>
        </div>
        <button class="btn btn-orange btn-sm" onclick="window.switchTab('vehicles')">
          View Fleet Compliance
        </button>
      </div>
    ` : ''}

    <!-- Quick Action Banner -->
    <div class="quick-action-banner">
      <div class="qa-text">
        <h3>Enterprise Transport Operations</h3>
        <p>Record daily lorry receipts, track diesel and toll expenses, disburse driver Kharacha advances, and share instant UPI invoices.</p>
      </div>
      <div class="qa-buttons" style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn btn-orange action-add-trip">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Add Trip
        </button>
        <button class="btn btn-secondary action-add-vehicle" style="background:#ffffff; color:var(--slate-800);">
          + Add Truck
        </button>
        <button class="btn btn-secondary action-add-driver" style="background:#ffffff; color:var(--slate-800);">
          + Add Driver
        </button>
      </div>
    </div>

    <!-- Dashboard Grid: Charts & Top Customers -->
    <div class="dashboard-grid-2">
      <div class="section-card">
        <div class="section-card-header">
          <div class="section-title-group">
            <h3>Monthly Collection Trend</h3>
            <p>Total freight business per month</p>
          </div>
        </div>
        <div id="chart-monthly-trend"></div>
      </div>

      <div class="section-card">
        <div class="section-card-header">
          <div class="section-title-group">
            <h3>Top Customers</h3>
            <p>Customer business volume & pending balance</p>
          </div>
        </div>
        <div id="chart-top-customers"></div>
      </div>
    </div>

    <!-- Payment Breakdown & Recent Trips -->
    <div class="dashboard-grid-2">
      <div class="section-card">
        <div class="section-card-header">
          <div class="section-title-group">
            <h3>Payment Status</h3>
            <p>Recovered vs Pending Collections</p>
          </div>
        </div>
        <div id="chart-payment-status"></div>
      </div>

      <div class="section-card">
        <div class="section-card-header">
          <div class="section-title-group">
            <h3>Recent Trips</h3>
            <p>Latest recorded transport entries</p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.switchTab('trips')">View All</button>
        </div>
        ${renderRecentTripsTable(recentTrips)}
      </div>
    </div>
  `;
}

function attachDashboardEvents() {
  const addVehBtn = document.querySelector('.action-add-vehicle');
  if (addVehBtn) addVehBtn.addEventListener('click', () => openVehicleModal());

  const addDrivBtn = document.querySelector('.action-add-driver');
  if (addDrivBtn) addDrivBtn.addEventListener('click', () => openDriverModal());
}

function initDashboardCharts() {
  setTimeout(() => {
    renderMonthlyIncomeChart(document.getElementById('chart-monthly-trend'), state.trips);
    renderTopCustomersChart(document.getElementById('chart-top-customers'), state.trips, 5);
    renderPaymentStatusChart(document.getElementById('chart-payment-status'), state.trips);
  }, 50);
}

function renderRecentTripsTable(trips) {
  if (trips.length === 0) {
    return `<div style="padding: 20px; text-align: center; color: var(--slate-500);">No trips recorded yet</div>`;
  }

  let rows = trips.map(t => `
    <tr>
      <td><strong>${formatDate(t.date)}</strong></td>
      <td class="trip-customer-name">${escapeHtml(t.customerName)}</td>
      <td>
        <div class="trip-route">
          <span>${escapeHtml(t.fromLocation)}</span>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          <span>${escapeHtml(t.toLocation)}</span>
        </div>
      </td>
      <td><span class="vehicle-tag">${escapeHtml(t.vehicleNumber)}</span></td>
      <td><strong>${formatRupee(t.amount)}</strong></td>
      <td><span class="badge-status badge-${t.status.toLowerCase()}">${t.status}</span></td>
    </tr>
  `).join('');

  return `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer</th>
            <th>Route</th>
            <th>Vehicle No</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ==========================================================================
   2. TRIPS REGISTER VIEW
   ========================================================================== */
function renderTripsView() {
  const filtered = filterTrips(state.trips, state.tripFilter);

  let totalAmt = 0, paidAmt = 0, pendingAmt = 0, totalExp = 0;
  filtered.forEach(t => {
    const amt = Number(t.amount) || 0;
    const paid = Number(t.paidAmount) || (t.status === 'Paid' ? amt : 0);
    const exp = (Number(t.fuelCost) || 0) + (Number(t.driverCost) || 0) + (Number(t.tollCost) || 0) + (Number(t.otherExpense) || 0);

    totalAmt += amt;
    paidAmt += paid;
    pendingAmt += (amt - paid);
    totalExp += exp;
  });

  const netProfit = totalAmt - totalExp;

  const customerOptions = state.customers.map(c =>
    `<option value="${escapeHtml(c.name)}" ${state.tripFilter.customer === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('');

  return `
    <!-- Filter Toolbar -->
    <div class="toolbar-card">
      <div class="search-box">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input type="text" id="trip-search-input" placeholder="Search customer, vehicle number, route, LR no..." value="${escapeHtml(state.tripFilter.search)}" />
      </div>

      <div class="filter-group">
        <select id="trip-customer-filter" class="filter-select">
          <option value="all">All Customers</option>
          ${customerOptions}
        </select>

        <select id="trip-status-filter" class="filter-select">
          <option value="all" ${state.tripFilter.status === 'all' ? 'selected' : ''}>All Statuses</option>
          <option value="Paid" ${state.tripFilter.status === 'Paid' ? 'selected' : ''}>Paid</option>
          <option value="Pending" ${state.tripFilter.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Partial" ${state.tripFilter.status === 'Partial' ? 'selected' : ''}>Partial</option>
        </select>

        <select id="trip-date-filter" class="filter-select">
          <option value="all" ${state.tripFilter.dateRange === 'all' ? 'selected' : ''}>All Time</option>
          <option value="today" ${state.tripFilter.dateRange === 'today' ? 'selected' : ''}>Today</option>
          <option value="month" ${state.tripFilter.dateRange === 'month' ? 'selected' : ''}>This Month</option>
          <option value="year" ${state.tripFilter.dateRange === 'year' ? 'selected' : ''}>This Year</option>
        </select>

        <button id="btn-export-csv" class="btn btn-secondary btn-sm">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export CSV
        </button>

        <button class="btn btn-orange action-add-trip">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Add Trip
        </button>
      </div>
    </div>

    <!-- Summary Pill Bar -->
    <div style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; background: var(--card-bg); padding: 14px 20px; border-radius: var(--radius-md); border: 1px solid var(--slate-200);">
      <div style="font-size: 0.9rem; font-weight: 600; color: var(--slate-700);">
        Showing <strong>${filtered.length}</strong> trip${filtered.length !== 1 ? 's' : ''}
      </div>
      <div style="display: flex; gap: 16px; font-size: 0.88rem; flex-wrap: wrap;">
        <div>Freight Total: <strong>${formatRupee(totalAmt)}</strong></div>
        <div style="color: #64748b;">Expenses: <strong>${formatRupee(totalExp)}</strong></div>
        <div style="color: #047857;">Net Profit: <strong>${formatRupee(netProfit)}</strong></div>
        <div style="color: #c2410c;">Pending: <strong>${formatRupee(pendingAmt)}</strong></div>
      </div>
    </div>

    <!-- Full Trips Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date & LR No</th>
            <th>Customer & Consignee</th>
            <th>Route</th>
            <th>Vehicle & Driver</th>
            <th>Freight & Expenses</th>
            <th>Status</th>
            <th>Goods / Notes</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${renderTripTableRows(filtered)}
        </tbody>
      </table>
    </div>
  `;
}

function renderTripTableRows(trips) {
  if (trips.length === 0) {
    return `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px 20px; color: var(--slate-500);">
          No matching trips found. Try clearing search filters or record a new trip.
        </td>
      </tr>
    `;
  }

  return trips.map(t => {
    const cust = state.customers.find(c => c.name.toLowerCase() === t.customerName.toLowerCase());
    const phone = cust ? cust.phone : '';
    const pending = t.amount - (t.paidAmount || (t.status === 'Paid' ? t.amount : 0));
    const totalExp = (Number(t.fuelCost) || 0) + (Number(t.driverCost) || 0) + (Number(t.tollCost) || 0) + (Number(t.otherExpense) || 0);

    const waUrl = pending > 0 ? generateWhatsAppReminderLink(phone, t.customerName, pending, t, state.settings) : null;

    return `
      <tr>
        <td>
          <strong>${formatDate(t.date)}</strong>
          <div style="font-family: monospace; font-size: 0.78rem; color: var(--slate-500);">${escapeHtml(t.lrNumber || '-')}</div>
        </td>
        <td class="trip-customer-name">
          <strong>${escapeHtml(t.customerName)}</strong>
          ${t.consignee ? `<div style="font-size: 0.76rem; color: var(--slate-500);">To: ${escapeHtml(t.consignee)}</div>` : ''}
        </td>
        <td>
          <div class="trip-route">
            <span>${escapeHtml(t.fromLocation)}</span>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            <span>${escapeHtml(t.toLocation)}</span>
          </div>
        </td>
        <td>
          <span class="vehicle-tag">${escapeHtml(t.vehicleNumber)}</span>
          ${t.driverName ? `<div style="font-size: 0.76rem; color: var(--slate-500); margin-top: 2px;">${escapeHtml(t.driverName)}</div>` : ''}
        </td>
        <td>
          <div><strong>${formatRupee(t.amount)}</strong></div>
          ${totalExp > 0 ? `<div style="font-size:0.75rem; color:#64748b;">Exp: ${formatRupee(totalExp)} (Profit: ${formatRupee(t.amount - totalExp)})</div>` : ''}
        </td>
        <td>
          <span class="badge-status badge-${t.status.toLowerCase()}">${t.status}</span>
          ${pending > 0 ? `<div style="font-size:0.75rem; color:#c2410c; margin-top:2px;">Due: ${formatRupee(pending)}</div>` : ''}
        </td>
        <td style="max-width: 180px; font-size: 0.82rem; color: var(--slate-600);">${escapeHtml(t.notes || '-')}</td>
        <td style="text-align: right; white-space: nowrap;">
          ${waUrl ? `<a href="${waUrl}" target="_blank" class="btn btn-whatsapp btn-sm" style="margin-right: 4px; padding: 5px 8px;" title="Send WhatsApp Bill & Reminder">WA</a>` : ''}
          <button class="btn btn-secondary btn-sm btn-print-lr" data-id="${t.id}" style="margin-right: 4px;" title="Print LR & Invoice">LR</button>
          <button class="btn btn-secondary btn-sm btn-edit-trip" data-id="${t.id}" style="margin-right: 4px;">Edit</button>
          <button class="btn btn-secondary btn-sm btn-delete-trip" data-id="${t.id}" style="color: #dc2626;">Del</button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterTrips(trips, filter) {
  const todayStr = getTodayString();
  const currentMonthStr = todayStr.substring(0, 7);
  const currentYearStr = todayStr.substring(0, 4);

  return trips.filter(t => {
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const matchCust = (t.customerName || '').toLowerCase().includes(q);
      const matchVeh = (t.vehicleNumber || '').toLowerCase().includes(q);
      const matchRoute = `${t.fromLocation} ${t.toLocation}`.toLowerCase().includes(q);
      const matchLR = (t.lrNumber || '').toLowerCase().includes(q);
      const matchNotes = (t.notes || '').toLowerCase().includes(q);
      if (!matchCust && !matchVeh && !matchRoute && !matchLR && !matchNotes) return false;
    }

    if (filter.customer !== 'all' && t.customerName !== filter.customer) return false;
    if (filter.status !== 'all' && t.status !== filter.status) return false;
    if (filter.dateRange === 'today' && t.date !== todayStr) return false;
    if (filter.dateRange === 'month' && (!t.date || !t.date.startsWith(currentMonthStr))) return false;
    if (filter.dateRange === 'year' && (!t.date || !t.date.startsWith(currentYearStr))) return false;

    return true;
  });
}

function attachTripEvents() {
  const searchInput = document.getElementById('trip-search-input');
  const custSelect = document.getElementById('trip-customer-filter');
  const statusSelect = document.getElementById('trip-status-filter');
  const dateSelect = document.getElementById('trip-date-filter');
  const exportBtn = document.getElementById('btn-export-csv');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.tripFilter.search = e.target.value;
      renderCurrentTab();
    });
  }
  if (custSelect) {
    custSelect.addEventListener('change', (e) => {
      state.tripFilter.customer = e.target.value;
      renderCurrentTab();
    });
  }
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      state.tripFilter.status = e.target.value;
      renderCurrentTab();
    });
  }
  if (dateSelect) {
    dateSelect.addEventListener('change', (e) => {
      state.tripFilter.dateRange = e.target.value;
      renderCurrentTab();
    });
  }
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const filtered = filterTrips(state.trips, state.tripFilter);
      exportTripsToCSV(filtered);
      showToast('Trips exported to CSV successfully!', 'success');
    });
  }

  // Print LR Receipt Listeners
  document.querySelectorAll('.btn-print-lr').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openPrintReceiptModal(id);
    });
  });

  // Edit / Delete Listeners
  document.querySelectorAll('.btn-edit-trip').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openTripModal(id);
    });
  });

  document.querySelectorAll('.btn-delete-trip').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this trip record?')) {
        await deleteTrip(id);
        loadState();
        renderCurrentTab();
        showToast('Trip record deleted', 'success');
      }
    });
  });
}

/* ==========================================================================
   3. FLEET & VEHICLES VIEW
   ========================================================================== */
function renderVehiclesView() {
  const totalVehicles = state.vehicles.length;
  const ownedCount = state.vehicles.filter(v => (v.ownership || 'Owned').toLowerCase() === 'owned').length;
  const attachedCount = state.vehicles.filter(v => (v.ownership || '').toLowerCase() === 'attached').length;

  let expiringDocsCount = 0;
  state.vehicles.forEach(v => {
    const dates = [v.fitnessExpiry, v.insuranceExpiry, v.permitExpiry, v.pucExpiry];
    dates.forEach(d => {
      if (d) {
        const info = checkDocumentExpiry(d);
        if (info.status === 'expired' || info.status === 'expiring') expiringDocsCount++;
      }
    });
  });

  // Filter vehicles
  const filtered = state.vehicles.filter(v => {
    if (state.vehicleFilter.search) {
      const q = state.vehicleFilter.search.toLowerCase();
      const matchNum = (v.vehicleNumber || '').toLowerCase().includes(q);
      const matchModel = (v.makeModel || '').toLowerCase().includes(q);
      const matchDriver = (v.driverName || '').toLowerCase().includes(q);
      if (!matchNum && !matchModel && !matchDriver) return false;
    }
    if (state.vehicleFilter.ownership !== 'all' && (v.ownership || 'Owned') !== state.vehicleFilter.ownership) {
      return false;
    }
    return true;
  });

  const cards = filtered.map(v => {
    const fit = checkDocumentExpiry(v.fitnessExpiry);
    const ins = checkDocumentExpiry(v.insuranceExpiry);
    const per = checkDocumentExpiry(v.permitExpiry);
    const puc = checkDocumentExpiry(v.pucExpiry);

    // Calculate vehicle trip performance
    const vTrips = state.trips.filter(t => (t.vehicleNumber || '').toUpperCase().trim() === v.vehicleNumber.toUpperCase().trim());
    let vRevenue = 0, vExpenses = 0;
    vTrips.forEach(t => {
      vRevenue += (Number(t.amount) || 0);
      vExpenses += ((Number(t.fuelCost) || 0) + (Number(t.driverCost) || 0) + (Number(t.tollCost) || 0) + (Number(t.otherExpense) || 0));
    });
    const vProfit = vRevenue - vExpenses;

    return `
      <div class="vehicle-card">
        <div class="vehicle-card-top">
          <div>
            <div class="vehicle-plate">${escapeHtml(v.vehicleNumber)}</div>
            <div class="vehicle-model-text">${escapeHtml(v.makeModel || 'Commercial Truck')} • ${escapeHtml(v.vehicleType || 'Truck')}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <span class="badge-status" style="background: var(--slate-100); color: var(--slate-700);">${escapeHtml(v.ownership || 'Owned')}</span>
            <span class="badge-status badge-${(v.status || 'Active').toLowerCase()}">${escapeHtml(v.status || 'Active')}</span>
          </div>
        </div>

        <div style="font-size: 0.82rem; color: var(--slate-600); display: flex; justify-content: space-between;">
          <span>Capacity: <strong>${v.capacityTons || 16} Tons</strong></span>
          <span>Driver: <strong>${escapeHtml(v.driverName || 'Not Assigned')}</strong></span>
        </div>

        <!-- Compliance Document Expiries -->
        <div class="doc-compliance-grid">
          <div class="doc-item">
            <span class="doc-name">Fitness</span>
            <span class="badge-status ${fit.badgeClass}" style="font-size: 0.72rem; padding: 2px 6px;">${fit.label}</span>
          </div>
          <div class="doc-item">
            <span class="doc-name">Insurance</span>
            <span class="badge-status ${ins.badgeClass}" style="font-size: 0.72rem; padding: 2px 6px;">${ins.label}</span>
          </div>
          <div class="doc-item">
            <span class="doc-name">National Permit</span>
            <span class="badge-status ${per.badgeClass}" style="font-size: 0.72rem; padding: 2px 6px;">${per.label}</span>
          </div>
          <div class="doc-item">
            <span class="doc-name">PUC (Pollution)</span>
            <span class="badge-status ${puc.badgeClass}" style="font-size: 0.72rem; padding: 2px 6px;">${puc.label}</span>
          </div>
        </div>

        <!-- Financial Performance Row -->
        <div class="vehicle-stats-row">
          <div>Trips: <strong>${vTrips.length}</strong></div>
          <div>Rev: <strong>${formatRupee(vRevenue)}</strong></div>
          <div style="color: #047857;">Profit: <strong>${formatRupee(vProfit)}</strong></div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: auto;">
          <button class="btn btn-secondary btn-sm btn-edit-vehicle" data-id="${v.id}" style="flex: 1;">Edit Truck & Docs</button>
          <button class="btn btn-outline btn-sm btn-delete-vehicle" data-id="${v.id}" style="color: #dc2626;">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!-- Top Fleet Counters -->
    <div class="metrics-grid" style="margin-bottom: 24px;">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Total Fleet</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
          </div>
        </div>
        <div class="metric-value">${totalVehicles}</div>
        <div class="metric-sub">Commercial registered vehicles</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Owned vs Attached</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
        <div class="metric-value" style="color: #047857;">${ownedCount} Owned</div>
        <div class="metric-sub">${attachedCount} Market / Attached trucks</div>
      </div>

      <div class="metric-card card-orange">
        <div class="metric-header">
          <span class="metric-title">Expiring Documents</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
        </div>
        <div class="metric-value text-pending">${expiringDocsCount}</div>
        <div class="metric-sub">Fitness, Insurance, Permit or PUC &lt; 30d</div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar-card">
      <div class="search-box">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input type="text" id="veh-search-input" placeholder="Search by vehicle registration plate, model, driver..." value="${escapeHtml(state.vehicleFilter.search)}" />
      </div>

      <div class="filter-group">
        <select id="veh-ownership-filter" class="filter-select">
          <option value="all" ${state.vehicleFilter.ownership === 'all' ? 'selected' : ''}>All Ownership</option>
          <option value="Owned" ${state.vehicleFilter.ownership === 'Owned' ? 'selected' : ''}>Owned</option>
          <option value="Attached" ${state.vehicleFilter.ownership === 'Attached' ? 'selected' : ''}>Attached</option>
        </select>

        <button id="btn-export-vehicles-csv" class="btn btn-secondary btn-sm">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export CSV
        </button>

        <button id="btn-add-vehicle-modal" class="btn btn-primary">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Add New Vehicle
        </button>
      </div>
    </div>

    <!-- Vehicles Cards Grid -->
    <div class="vehicles-grid">
      ${cards || '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--slate-500);">No vehicles matching the criteria. Click "+ Add New Vehicle" to register your fleet.</div>'}
    </div>
  `;
}

function attachVehicleEvents() {
  const addVehBtn = document.getElementById('btn-add-vehicle-modal');
  if (addVehBtn) addVehBtn.addEventListener('click', () => openVehicleModal());

  const searchInput = document.getElementById('veh-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.vehicleFilter.search = e.target.value;
      renderCurrentTab();
    });
  }

  const ownerSelect = document.getElementById('veh-ownership-filter');
  if (ownerSelect) {
    ownerSelect.addEventListener('change', (e) => {
      state.vehicleFilter.ownership = e.target.value;
      renderCurrentTab();
    });
  }

  const exportBtn = document.getElementById('btn-export-vehicles-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportVehiclesToCSV(state.vehicles);
      showToast('Vehicles exported to CSV successfully', 'success');
    });
  }

  document.querySelectorAll('.btn-edit-vehicle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openVehicleModal(id);
    });
  });

  document.querySelectorAll('.btn-delete-vehicle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to remove this vehicle from your fleet?')) {
        await deleteVehicle(id);
        loadState();
        renderCurrentTab();
        showToast('Vehicle deleted successfully', 'success');
      }
    });
  });
}

/* ==========================================================================
   4. DRIVERS & STAFF KHARACHA LEDGER VIEW
   ========================================================================== */
function renderDriversView() {
  const totalDrivers = state.drivers.length;
  const onTripCount = state.drivers.filter(d => (d.status || '').toLowerCase() === 'on trip').length;
  const availableCount = state.drivers.filter(d => (d.status || '').toLowerCase() === 'available').length;

  let totalAdvancePending = 0;
  state.drivers.forEach(d => {
    totalAdvancePending += (Number(d.advanceBalance) || 0);
  });

  const filtered = state.drivers.filter(d => {
    if (state.driverFilter.search) {
      const q = state.driverFilter.search.toLowerCase();
      const matchName = (d.name || '').toLowerCase().includes(q);
      const matchPhone = (d.phone || '').toLowerCase().includes(q);
      const matchLic = (d.licenseNumber || '').toLowerCase().includes(q);
      const matchTruck = (d.assignedVehicle || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchLic && !matchTruck) return false;
    }
    if (state.driverFilter.status !== 'all' && (d.status || 'Available') !== state.driverFilter.status) {
      return false;
    }
    return true;
  });

  const cards = filtered.map(d => {
    const adv = Number(d.advanceBalance) || 0;
    const initials = (d.name || 'D').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    let cleanPhone = (d.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    const waDriverUrl = cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone}` : null;

    return `
      <div class="driver-card">
        <div class="driver-header">
          <div class="driver-avatar">${initials}</div>
          <div class="driver-info">
            <h4>${escapeHtml(d.name)}</h4>
            <p>${escapeHtml(d.phone || 'No phone')} • Lic: ${escapeHtml(d.licenseNumber || 'N/A')}</p>
          </div>
          <span class="badge-status badge-${(d.status || 'available').toLowerCase().replace(' ', '')}" style="margin-left: auto;">
            ${escapeHtml(d.status || 'Available')}
          </span>
        </div>

        <div style="font-size: 0.85rem; color: var(--slate-600); display: flex; justify-content: space-between; background: var(--slate-50); padding: 8px 12px; border-radius: var(--radius-sm);">
          <span>Assigned Truck: <strong>${escapeHtml(d.assignedVehicle || 'None')}</strong></span>
          <span>Salary: <strong>${formatRupee(d.monthlySalary || 0)}/mo</strong></span>
        </div>

        <!-- Advance Kharacha Chip -->
        <div class="advance-balance-chip">
          <div>
            <div style="font-size: 0.72rem; color: var(--accent-orange); text-transform: uppercase; font-weight: 700;">Trip Advance / Kharacha Due</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #9a3412;">${formatRupee(adv)}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-orange btn-sm btn-driver-advance" data-id="${d.id}" data-type="advance" style="padding: 4px 10px; font-size: 0.78rem;">
              + Advance
            </button>
            ${adv > 0 ? `
              <button class="btn btn-secondary btn-sm btn-driver-settle" data-id="${d.id}" data-type="settle" style="padding: 4px 10px; font-size: 0.78rem;">
                Settle
              </button>
            ` : ''}
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: auto;">
          ${waDriverUrl ? `
            <a href="${waDriverUrl}" target="_blank" class="btn btn-whatsapp btn-sm" style="flex: 1; text-align: center;">WhatsApp</a>
          ` : ''}
          <button class="btn btn-secondary btn-sm btn-edit-driver" data-id="${d.id}" style="flex: 1;">Edit Driver</button>
          <button class="btn btn-outline btn-sm btn-delete-driver" data-id="${d.id}" style="color: #dc2626;">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!-- Top Driver Counters -->
    <div class="metrics-grid" style="margin-bottom: 24px;">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Total Staff</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
        </div>
        <div class="metric-value">${totalDrivers}</div>
        <div class="metric-sub">Registered drivers & staff</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Driver Status</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
        <div class="metric-value" style="color: #047857;">${onTripCount} On Trip</div>
        <div class="metric-sub">${availableCount} Available for dispatch</div>
      </div>

      <div class="metric-card card-orange">
        <div class="metric-header">
          <span class="metric-title">Trip Advances Due</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
        </div>
        <div class="metric-value text-pending">${formatRupee(totalAdvancePending)}</div>
        <div class="metric-sub">Pending driver Kharacha balance</div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar-card">
      <div class="search-box">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input type="text" id="driv-search-input" placeholder="Search driver by name, phone, license, assigned truck..." value="${escapeHtml(state.driverFilter.search)}" />
      </div>

      <div class="filter-group">
        <select id="driv-status-filter" class="filter-select">
          <option value="all" ${state.driverFilter.status === 'all' ? 'selected' : ''}>All Statuses</option>
          <option value="Available" ${state.driverFilter.status === 'Available' ? 'selected' : ''}>Available</option>
          <option value="On Trip" ${state.driverFilter.status === 'On Trip' ? 'selected' : ''}>On Trip</option>
          <option value="On Leave" ${state.driverFilter.status === 'On Leave' ? 'selected' : ''}>On Leave</option>
        </select>

        <button id="btn-export-drivers-csv" class="btn btn-secondary btn-sm">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export CSV
        </button>

        <button id="btn-add-driver-modal" class="btn btn-primary">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Add New Driver
        </button>
      </div>
    </div>

    <!-- Drivers Cards Grid -->
    <div class="drivers-grid">
      ${cards || '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--slate-500);">No drivers found matching criteria. Click "+ Add New Driver" to add drivers.</div>'}
    </div>
  `;
}

function attachDriverEvents() {
  const addDrivBtn = document.getElementById('btn-add-driver-modal');
  if (addDrivBtn) addDrivBtn.addEventListener('click', () => openDriverModal());

  const searchInput = document.getElementById('driv-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.driverFilter.search = e.target.value;
      renderCurrentTab();
    });
  }

  const statusSelect = document.getElementById('driv-status-filter');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      state.driverFilter.status = e.target.value;
      renderCurrentTab();
    });
  }

  const exportBtn = document.getElementById('btn-export-drivers-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportDriversToCSV(state.drivers);
      showToast('Drivers exported to CSV successfully', 'success');
    });
  }

  document.querySelectorAll('.btn-driver-advance').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openDriverAdvanceModal(id, 'advance');
    });
  });

  document.querySelectorAll('.btn-driver-settle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openDriverAdvanceModal(id, 'settle');
    });
  });

  document.querySelectorAll('.btn-edit-driver').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openDriverModal(id);
    });
  });

  document.querySelectorAll('.btn-delete-driver').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this driver profile?')) {
        await deleteDriver(id);
        loadState();
        renderCurrentTab();
        showToast('Driver deleted', 'success');
      }
    });
  });
}

/* ==========================================================================
   5. CUSTOMERS VIEW
   ========================================================================== */
function renderCustomersView() {
  const customerStats = state.customers.map(c => {
    const cTrips = state.trips.filter(t => t.customerName.toLowerCase() === c.name.toLowerCase());
    let totalBusiness = 0;
    let paidAmt = 0;
    cTrips.forEach(t => {
      const amt = Number(t.amount) || 0;
      const paid = Number(t.paidAmount) || (t.status === 'Paid' ? amt : 0);
      totalBusiness += amt;
      paidAmt += paid;
    });

    const pendingAmt = totalBusiness - paidAmt;
    const waUrl = pendingAmt > 0 ? generateWhatsAppReminderLink(c.phone, c.name, pendingAmt, null, state.settings) : null;

    return {
      ...c,
      tripCount: cTrips.length,
      totalBusiness,
      paidAmt,
      pendingAmt,
      waUrl
    };
  });

  customerStats.sort((a, b) => b.totalBusiness - a.totalBusiness);

  const cards = customerStats.map(c => `
    <div class="customer-card">
      <div style="display: flex; align-items: flex-start; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="customer-avatar">${escapeHtml(c.name.substring(0, 2).toUpperCase())}</div>
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--slate-900);">${escapeHtml(c.name)}</h3>
            <p style="font-size: 0.8rem; color: var(--slate-500);">${escapeHtml(c.city || 'City not set')} • ${escapeHtml(c.phone || 'No phone')}</p>
          </div>
        </div>
        <span class="badge-status" style="background: var(--slate-100); color: var(--slate-700);">${c.tripCount} trip${c.tripCount !== 1 ? 's' : ''}</span>
      </div>

      ${c.gstin ? `<div style="font-size: 0.76rem; font-family: monospace; color: var(--slate-500);">GSTIN: ${escapeHtml(c.gstin)}</div>` : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--primary-50); padding: 14px; border-radius: var(--radius-md);">
        <div>
          <span style="font-size: 0.72rem; color: var(--slate-500); text-transform: uppercase; font-weight: 600;">Total Business</span>
          <div style="font-weight: 800; font-size: 1.1rem; color: var(--slate-900);">${formatRupee(c.totalBusiness)}</div>
        </div>
        <div>
          <span style="font-size: 0.72rem; color: var(--slate-500); text-transform: uppercase; font-weight: 600;">Pending Balance</span>
          <div style="font-weight: 800; font-size: 1.1rem; color: ${c.pendingAmt > 0 ? 'var(--accent-orange)' : '#047857'};">
            ${formatRupee(c.pendingAmt)}
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: auto;">
        ${c.waUrl ? `<a href="${c.waUrl}" target="_blank" class="btn btn-whatsapp btn-sm" style="flex: 1; text-align:center;">WhatsApp</a>` : ''}
        <button class="btn btn-secondary btn-sm btn-view-statement" data-name="${escapeHtml(c.name)}" style="flex: 1;">Statement</button>
        <button class="btn btn-outline btn-sm btn-edit-customer" data-id="${c.id}">Edit</button>
      </div>
    </div>
  `).join('');

  return `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
      <div>
        <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--slate-900);">Customer Directory (${state.customers.length})</h3>
        <p style="font-size: 0.82rem; color: var(--slate-500);">Individual customer ledgers & pending dues</p>
      </div>
      <button id="btn-add-customer-modal" class="btn btn-primary">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        Add New Customer
      </button>
    </div>

    <div class="customers-grid">
      ${cards}
    </div>
  `;
}

function attachCustomerEvents() {
  const addCustBtn = document.getElementById('btn-add-customer-modal');
  if (addCustBtn) {
    addCustBtn.addEventListener('click', () => openCustomerModal());
  }

  document.querySelectorAll('.btn-view-statement').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      openStatementModal(name);
    });
  });

  document.querySelectorAll('.btn-edit-customer').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openCustomerModal(id);
    });
  });
}

/* ==========================================================================
   6. REPORTS VIEW
   ========================================================================== */
function renderReportsView() {
  const todayStr = getTodayString();
  const currentMonthStr = todayStr.substring(0, 7);

  // Compute Grand Totals
  let totalRevenue = 0, totalFuel = 0, totalDriver = 0, totalToll = 0, totalOther = 0;
  let totalPaid = 0;

  state.trips.forEach(t => {
    const amt = Number(t.amount) || 0;
    const paid = Number(t.paidAmount) || (t.status === 'Paid' ? amt : 0);
    totalRevenue += amt;
    totalPaid += paid;
    totalFuel += (Number(t.fuelCost) || 0);
    totalDriver += (Number(t.driverCost) || 0);
    totalToll += (Number(t.tollCost) || 0);
    totalOther += (Number(t.otherExpense) || 0);
  });

  const totalExpenses = totalFuel + totalDriver + totalToll + totalOther;
  const netProfit = totalRevenue - totalExpenses;
  const marginPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

  // GTA RCM calculation (5% GST under Reverse Charge Mechanism)
  const rcmTaxableValue = totalRevenue;
  const rcmEstimatedGst = Math.round(rcmTaxableValue * 0.05);

  return `
    <!-- High-level Financial Summary -->
    <div class="metrics-grid" style="margin-bottom: 24px;">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Total Freight Turnover</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
        <div class="metric-value">${formatRupee(totalRevenue)}</div>
        <div class="metric-sub">Paid: ${formatRupee(totalPaid)} • Due: ${formatRupee(totalRevenue - totalPaid)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Total Operating Costs</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
        </div>
        <div class="metric-value" style="color: #c2410c;">${formatRupee(totalExpenses)}</div>
        <div class="metric-sub">Diesel: ${formatRupee(totalFuel)} • Driver/Toll: ${formatRupee(totalDriver + totalToll)}</div>
      </div>

      <div class="metric-card card-blue">
        <div class="metric-header">
          <span class="metric-title">Net Operating Profit</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
        </div>
        <div class="metric-value" style="color: #047857;">${formatRupee(netProfit)}</div>
        <div class="metric-sub">Profit Margin: <strong>${marginPct}%</strong></div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">GST GTA (5% RCM)</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
        </div>
        <div class="metric-value">${formatRupee(rcmEstimatedGst)}</div>
        <div class="metric-sub">RCM payable by consignor/consignee</div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="dashboard-grid-2">
      <div class="section-card">
        <div class="section-card-header">
          <div class="section-title-group">
            <h3>Monthly Income Trend</h3>
            <p>Visual freight revenue chart</p>
          </div>
        </div>
        <div id="report-monthly-chart"></div>
      </div>

      <div class="section-card">
        <div class="section-card-header">
          <div class="section-title-group">
            <h3>Payment Status Breakdown</h3>
            <p>Paid vs Pending Payments</p>
          </div>
        </div>
        <div id="report-payment-chart"></div>
      </div>
    </div>

    <!-- Export Dataset Actions -->
    <div class="section-card" style="margin-top: 24px;">
      <div class="section-card-header">
        <div class="section-title-group">
          <h3>One-Click Data Exports (CSV & Excel)</h3>
          <p>Download complete operational registers for your Chartered Accountant (CA) or business ledger</p>
        </div>
      </div>
      <div style="display: flex; gap: 14px; flex-wrap: wrap;">
        <button id="btn-rep-export-trips" class="btn btn-primary">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export All Trips (CSV)
        </button>
        <button id="btn-rep-export-vehicles" class="btn btn-secondary">
          Export Fleet Register (CSV)
        </button>
        <button id="btn-rep-export-drivers" class="btn btn-secondary">
          Export Driver Ledger (CSV)
        </button>
      </div>
    </div>
  `;
}

function initReportCharts() {
  setTimeout(() => {
    renderMonthlyIncomeChart(document.getElementById('report-monthly-chart'), state.trips);
    renderPaymentStatusChart(document.getElementById('report-payment-chart'), state.trips);
  }, 50);
}

function attachReportsEvents() {
  const expTrips = document.getElementById('btn-rep-export-trips');
  if (expTrips) expTrips.addEventListener('click', () => {
    exportTripsToCSV(state.trips);
    showToast('Trips CSV exported successfully', 'success');
  });

  const expVeh = document.getElementById('btn-rep-export-vehicles');
  if (expVeh) expVeh.addEventListener('click', () => {
    exportVehiclesToCSV(state.vehicles);
    showToast('Fleet CSV exported successfully', 'success');
  });

  const expDriv = document.getElementById('btn-rep-export-drivers');
  if (expDriv) expDriv.addEventListener('click', () => {
    exportDriversToCSV(state.drivers);
    showToast('Driver Ledger CSV exported successfully', 'success');
  });
}

/* ==========================================================================
   7. SETTINGS VIEW
   ========================================================================== */
function renderSettingsView() {
  const s = state.settings;
  const sync = getSyncStatus();
  const dbInfo = sync.serverInfo.database || {};

  return `
    <div style="display: grid; grid-template-columns: 1fr; gap: 24px; max-width: 900px;">
      
      <!-- Database & Cloud Connection Card -->
      <div class="section-card">
        <div class="section-card-header">
          <div class="section-title-group">
            <h3>Cloud Database & Server Sync</h3>
            <p>MongoDB Atlas clustering & live multi-device synchronization</p>
          </div>
          <button id="btn-test-db-sync" class="btn btn-secondary btn-sm">
            Ping Database
          </button>
        </div>

        <div style="background: var(--slate-50); border: 1px solid var(--slate-200); padding: 18px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 14px; height: 14px; border-radius: 50%; background: ${sync.isServerOnline ? '#10b981' : '#dc2626'}; box-shadow: 0 0 8px ${sync.isServerOnline ? '#10b981' : '#dc2626'};"></div>
            <div>
              <div style="font-weight: 700; color: var(--slate-900);">
                Engine: ${dbInfo.engine || (sync.isServerOnline ? 'Connected' : 'Offline Browser Cache')}
              </div>
              <div style="font-size: 0.82rem; color: var(--slate-500); margin-top: 2px;">
                Storage: ${dbInfo.storageLocation || 'Local storage memory'}
              </div>
            </div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="window.openDiagnosticsModal()">
            View Network IPs & LAN QR
          </button>
        </div>

        <div style="margin-top: 16px; font-size: 0.85rem; color: var(--slate-600); line-height: 1.5;">
          💡 <strong>MongoDB Atlas Setup:</strong> To connect your live cloud database permanently, add your connection string to <code>.env</code> locally (<code>MONGODB_URI=mongodb+srv://...</code>) or under <strong>Vercel Project Settings &gt; Environment Variables</strong>. The app automatically detects MongoDB and handles migrations and seeding!
        </div>
      </div>

      <!-- Business Profile Form -->
      <div class="section-card">
        <div class="section-card-header">
          <div class="section-title-group">
            <h3>Business Profile & Billing Details</h3>
            <p>Used on printable Lorry Receipts (LR), Bilty invoices and WhatsApp payment reminders</p>
          </div>
        </div>

        <form id="settings-form">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Transport Agency Name</label>
              <input type="text" id="set-biz-name" class="form-input" value="${escapeHtml(s.businessName || '')}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Owner / Proprietor Name</label>
              <input type="text" id="set-owner-name" class="form-input" value="${escapeHtml(s.ownerName || '')}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Primary Mobile Phone</label>
              <input type="text" id="set-phone" class="form-input" value="${escapeHtml(s.phone || '')}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Alternate Phone / Landline</label>
              <input type="text" id="set-alt-phone" class="form-input" value="${escapeHtml(s.altPhone || '')}" />
            </div>

            <div class="form-group">
              <label class="form-label">GSTIN (15 Digits)</label>
              <input type="text" id="set-gstin" class="form-input" value="${escapeHtml(s.gstin || '')}" placeholder="27AABCS123411Z5" />
            </div>

            <div class="form-group">
              <label class="form-label">PAN Number</label>
              <input type="text" id="set-pan" class="form-input" value="${escapeHtml(s.pan || '')}" placeholder="AABCS1234F" />
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Transport Yard / Office Address</label>
              <input type="text" id="set-address" class="form-input" value="${escapeHtml(s.address || '')}" />
            </div>

            <div class="form-group">
              <label class="form-label">City, State</label>
              <input type="text" id="set-city" class="form-input" value="${escapeHtml(s.city || '')}" />
            </div>

            <div class="form-group">
              <label class="form-label">LR Number Prefix</label>
              <input type="text" id="set-lr-prefix" class="form-input" value="${escapeHtml(s.lrPrefix || 'LR-2026-')}" />
            </div>

            <!-- Banking & UPI Details for Instant QR Payments -->
            <div class="form-group form-group-full" style="margin-top: 10px;">
              <h4 style="font-size: 1rem; font-weight: 700; color: var(--slate-900);">Bank &amp; Dynamic UPI QR Settlement</h4>
              <p style="font-size: 0.8rem; color: var(--slate-500);">Dynamic UPI QR codes are generated automatically on Lorry Receipts for customers to pay via PhonePe / GPay</p>
            </div>

            <div class="form-group">
              <label class="form-label">UPI ID (VPA) for Direct QR Scan</label>
              <input type="text" id="set-upi" class="form-input" value="${escapeHtml(s.upiId || '')}" placeholder="e.g. 9820012345@upi" />
            </div>

            <div class="form-group">
              <label class="form-label">Bank Name</label>
              <input type="text" id="set-bank" class="form-input" value="${escapeHtml(s.bankName || '')}" placeholder="e.g. State Bank of India" />
            </div>

            <div class="form-group">
              <label class="form-label">Bank Account Number</label>
              <input type="text" id="set-account" class="form-input" value="${escapeHtml(s.accountNumber || '')}" />
            </div>

            <div class="form-group">
              <label class="form-label">IFSC Code</label>
              <input type="text" id="set-ifsc" class="form-input" value="${escapeHtml(s.ifscCode || '')}" placeholder="e.g. SBIN0001234" />
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">LR Terms &amp; Conditions (Printed on receipts)</label>
              <textarea id="set-terms" class="form-textarea" rows="3">${escapeHtml(s.terms || '')}</textarea>
            </div>
          </div>

          <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
            <button type="submit" class="btn btn-primary">Save Business Settings</button>
          </div>
        </form>
      </div>

      <!-- Safe & Secure Cloud Email Backup Card -->
      <div class="section-card">
        <div class="section-card-header">
          <div class="section-title-group">
            <h3>Safe &amp; Secure Cloud Email Backup</h3>
            <p>Directly linked to your verified Mail ID &amp; stored safely in MongoDB Atlas</p>
          </div>
          <span class="auth-badge-pill" style="background: #ecfdf5; color: #047857; font-weight: 700; border: 1px solid #a7f3d0;">
            🔒 256-bit PBKDF2 Encrypted
          </span>
        </div>

        <!-- Account Profile & Cloud Storage Status -->
        <div style="background: var(--slate-50); border: 1px solid var(--slate-200); padding: 18px; border-radius: var(--radius-md); margin-bottom: 18px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 46px; height: 46px; border-radius: 50%; background: #047857; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; font-weight: 800;">
                ${getCurrentUser() ? getCurrentUser().name.substring(0, 2).toUpperCase() : 'TL'}
              </div>
              <div>
                <div style="font-weight: 800; color: var(--slate-900); font-size: 1.05rem;">
                  ${getCurrentUser() ? escapeHtml(getCurrentUser().name) : 'Demo Business Account'}
                </div>
                <div style="font-size: 0.85rem; color: var(--slate-600); margin-top: 2px;">
                  Registered Mail ID: <strong>${getCurrentUser() ? escapeHtml(getCurrentUser().email) : escapeHtml(s.email || 'contact@jaihanumantransport.com')}</strong>
                </div>
              </div>
            </div>

            ${!getCurrentUser() ? `
              <button class="btn btn-primary btn-sm" onclick="window.openAuthModal('register')">
                Enroll Account / Sign In
              </button>
            ` : `
              <span class="auth-badge-pill" style="background: #dbeafe; color: #1d4ed8; font-weight: 700; border: 1px solid #bfdbfe;">
                ✓ Verified Active Cloud Account
              </span>
            `}
          </div>
        </div>

        <!-- Send Full Backup to Mail ID -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 260px;">
              <label class="form-label" style="font-weight: 600;">Destination Mail ID for Cloud Snapshot</label>
              <input type="email" id="backup-email-input" class="form-input" value="${getCurrentUser() ? escapeHtml(getCurrentUser().email) : escapeHtml(s.email || '')}" placeholder="yourname@gmail.com" />
            </div>
            <button id="btn-send-email-backup" class="btn btn-primary" style="height: 42px; display: inline-flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Send Full Backup to my Email ID
            </button>
          </div>

          <div id="email-backup-status" style="display: none; padding: 12px 16px; border-radius: 8px; font-size: 0.88rem;"></div>

          <!-- Secondary Offline Export & Restore Actions -->
          <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 10px; padding-top: 16px; border-top: 1px solid var(--slate-200);">
            <button id="btn-export-backup" class="btn btn-secondary btn-sm">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download Offline JSON Snapshot
            </button>

            <label class="btn btn-secondary btn-sm" style="cursor: pointer; margin: 0;">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Restore from Backup
              <input type="file" id="input-import-backup" accept=".json" style="display: none;" />
            </label>

            <button id="btn-reset-sample" class="btn btn-outline btn-sm" style="color: #dc2626; border-color: #fca5a5; margin-left: auto;">
              Reset to Sample Data
            </button>
          </div>
        </div>
      </div>

    </div>
  `;
}

function attachSettingsEvents() {
  const form = document.getElementById('settings-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const updated = {
        businessName: document.getElementById('set-biz-name').value,
        ownerName: document.getElementById('set-owner-name').value,
        phone: document.getElementById('set-phone').value,
        altPhone: document.getElementById('set-alt-phone').value,
        gstin: document.getElementById('set-gstin').value,
        pan: document.getElementById('set-pan').value,
        address: document.getElementById('set-address').value,
        city: document.getElementById('set-city').value,
        lrPrefix: document.getElementById('set-lr-prefix').value,
        upiId: document.getElementById('set-upi').value,
        bankName: document.getElementById('set-bank').value,
        accountNumber: document.getElementById('set-account').value,
        ifscCode: document.getElementById('set-ifsc').value,
        terms: document.getElementById('set-terms').value
      };

      await saveSettings(updated);
      loadState();
      showToast('Business settings saved successfully!', 'success');
    });
  }

  // Send Backup to Email ID Button Event
  const emailBackupBtn = document.getElementById('btn-send-email-backup');
  if (emailBackupBtn) {
    emailBackupBtn.addEventListener('click', async () => {
      const emailInput = document.getElementById('backup-email-input');
      const email = emailInput ? emailInput.value.trim() : '';
      if (!email || !email.includes('@')) {
        showToast('Please enter a valid Mail ID', 'error');
        return;
      }
      emailBackupBtn.disabled = true;
      emailBackupBtn.innerHTML = 'Securing &amp; Dispatching...';

      try {
        const res = await sendBackupToEmail(email);
        showToast(`✓ Full database backup safely sent to ${email}!`, 'success');
        const statusEl = document.getElementById('email-backup-status');
        if (statusEl) {
          statusEl.style.display = 'block';
          statusEl.style.background = '#ecfdf5';
          statusEl.style.color = '#065f46';
          statusEl.style.border = '1px solid #a7f3d0';
          statusEl.innerHTML = `<strong>✓ Cloud Backup Confirmed:</strong> Full snapshot (${res.stats?.trips || 0} trips, ${res.stats?.vehicles || 0} vehicles, ${res.stats?.customers || 0} customers) safely secured and dispatched to <strong>${escapeHtml(email)}</strong> (Record ID: ${res.backupId}).`;
        }
      } catch (err) {
        showToast(err.message || 'Failed to dispatch backup', 'error');
      } finally {
        emailBackupBtn.disabled = false;
        emailBackupBtn.innerHTML = `
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          Send Full Backup to my Email ID
        `;
      }
    });
  }

  const pingBtn = document.getElementById('btn-test-db-sync');
  if (pingBtn) {
    pingBtn.addEventListener('click', async () => {
      pingBtn.disabled = true;
      pingBtn.textContent = 'Pinging...';
      const online = await triggerSync();
      pingBtn.disabled = false;
      pingBtn.textContent = 'Ping Database';
      if (online) {
        showToast('Database connection is healthy & synced!', 'success');
      } else {
        showToast('Running in local offline cache mode', 'info');
      }
      renderCurrentTab();
    });
  }

  const exportBackupBtn = document.getElementById('btn-export-backup');
  if (exportBackupBtn) {
    exportBackupBtn.addEventListener('click', () => {
      const jsonStr = exportBackupJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Transport_Ledger_Backup_${formatDateInput()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup downloaded successfully', 'success');
    });
  }

  const importInput = document.getElementById('input-import-backup');
  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        const success = await importBackupJSON(event.target.result);
        if (success) {
          loadState();
          renderCurrentTab();
          showToast('Database restored successfully from backup!', 'success');
        } else {
          showToast('Failed to restore backup: Invalid file format', 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  const resetBtn = document.getElementById('btn-reset-sample');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to reset all data to the factory sample dataset? Current changes will be overwritten.')) {
        await resetToSampleData();
        loadState();
        renderCurrentTab();
        showToast('Reset to default sample data complete', 'success');
      }
    });
  }
}

/* ==========================================================================
   8. MODALS & POPUPS
   ========================================================================== */

function closeModal() {
  const modalBackdrop = document.getElementById('modal-backdrop');
  if (modalBackdrop) {
    modalBackdrop.classList.remove('open');
    modalBackdrop.innerHTML = '';
  }
  state.editingTripId = null;
  state.editingCustomerId = null;
  state.editingVehicleId = null;
  state.editingDriverId = null;
}

window.closeModal = closeModal;

// 1. ADD / EDIT TRIP MODAL
function openTripModal(tripId = null) {
  state.editingTripId = tripId;
  const existing = tripId ? state.trips.find(t => t.id === tripId) : null;
  const lrNo = existing ? existing.lrNumber : generateLRNumber(state.trips, state.settings.lrPrefix || 'LR-2026-');

  // Customer options
  const custOptions = state.customers.map(c =>
    `<option value="${escapeHtml(c.name)}" ${existing && existing.customerName === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('');

  // Vehicle options
  const vehOptions = state.vehicles.map(v =>
    `<option value="${escapeHtml(v.vehicleNumber)}" ${existing && existing.vehicleNumber === v.vehicleNumber ? 'selected' : ''}>${escapeHtml(v.vehicleNumber)} (${escapeHtml(v.makeModel)})</option>`
  ).join('');

  // Driver options
  const drivOptions = state.drivers.map(d =>
    `<option value="${escapeHtml(d.name)}" ${existing && existing.driverName === d.name ? 'selected' : ''}>${escapeHtml(d.name)}</option>`
  ).join('');

  const modalHtml = `
    <div class="modal-card" style="max-width: 700px;">
      <div class="modal-header">
        <h3>${existing ? 'Edit Trip Record' : 'Record New Transport Trip'}</h3>
        <button class="btn-close-modal" onclick="window.closeModal()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <form id="trip-modal-form">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Trip Date</label>
              <input type="date" id="trip-date" class="form-input" value="${existing ? existing.date : getTodayString()}" required />
            </div>

            <div class="form-group">
              <label class="form-label">LR (Bilty) Number</label>
              <input type="text" id="trip-lr" class="form-input" value="${escapeHtml(lrNo)}" />
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Customer / Party Name</label>
              <input type="text" id="trip-customer" list="customer-datalist" class="form-input" placeholder="Select or type customer name..." value="${existing ? escapeHtml(existing.customerName) : ''}" required />
              <datalist id="customer-datalist">
                ${custOptions}
              </datalist>
            </div>

            <div class="form-group">
              <label class="form-label">Consignor (Sender / Dispatcher)</label>
              <input type="text" id="trip-consignor" class="form-input" placeholder="e.g. Tata Steel Yard, Mumbai" value="${existing ? escapeHtml(existing.consignor || '') : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Consignee (Receiver / Destination)</label>
              <input type="text" id="trip-consignee" class="form-input" placeholder="e.g. Delhi Metro Project" value="${existing ? escapeHtml(existing.consignee || '') : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">From City / Origin</label>
              <input type="text" id="trip-from" class="form-input" placeholder="e.g. Mumbai" value="${existing ? escapeHtml(existing.fromLocation) : ''}" required />
            </div>

            <div class="form-group">
              <label class="form-label">To City / Destination</label>
              <input type="text" id="trip-to" class="form-input" placeholder="e.g. Delhi" value="${existing ? escapeHtml(existing.toLocation) : ''}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Vehicle Registration Number</label>
              <input type="text" id="trip-vehicle" list="vehicle-datalist" class="form-input" placeholder="e.g. MH 12 AB 1234" value="${existing ? escapeHtml(existing.vehicleNumber) : ''}" required />
              <datalist id="vehicle-datalist">
                ${vehOptions}
              </datalist>
            </div>

            <div class="form-group">
              <label class="form-label">Driver Name</label>
              <input type="text" id="trip-driver" list="driver-datalist" class="form-input" placeholder="Assigned driver..." value="${existing ? escapeHtml(existing.driverName || '') : ''}" />
              <datalist id="driver-datalist">
                ${drivOptions}
              </datalist>
            </div>

            <div class="form-group">
              <label class="form-label">E-Way Bill Number</label>
              <input type="text" id="trip-eway" class="form-input" placeholder="12 digit E-Way Bill" value="${existing ? escapeHtml(existing.ewayBillNo || '') : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Weight (Metric Tons)</label>
              <input type="number" id="trip-weight" step="0.1" class="form-input" placeholder="e.g. 15.5" value="${existing ? existing.weightTons : ''}" />
            </div>

            <!-- Financials -->
            <div class="form-group">
              <label class="form-label">Total Freight Amount (₹)</label>
              <input type="number" id="trip-amount" class="form-input" placeholder="e.g. 45000" value="${existing ? existing.amount : ''}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Payment Status</label>
              <select id="trip-status" class="form-select">
                <option value="Pending" ${existing && existing.status === 'Pending' ? 'selected' : ''}>Pending (Unpaid)</option>
                <option value="Partial" ${existing && existing.status === 'Partial' ? 'selected' : ''}>Partial (Advance Received)</option>
                <option value="Paid" ${existing && existing.status === 'Paid' ? 'selected' : ''}>Paid (Full Cleared)</option>
              </select>
            </div>

            <div class="form-group" id="group-paid-amount">
              <label class="form-label">Advance / Paid Amount (₹)</label>
              <input type="number" id="trip-paid" class="form-input" placeholder="0" value="${existing ? existing.paidAmount : '0'}" />
            </div>

            <!-- Trip Expenses Breakdown -->
            <div class="form-group form-group-full" style="margin-top: 6px;">
              <span class="form-label" style="font-weight: 700;">Trip Operating Expenses (Diesel, Driver, Toll)</span>
            </div>

            <div class="form-group">
              <label class="form-label">Diesel / Fuel Cost (₹)</label>
              <input type="number" id="trip-fuel" class="form-input" placeholder="0" value="${existing ? existing.fuelCost : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Driver Bhatta / Expense (₹)</label>
              <input type="number" id="trip-driver-cost" class="form-input" placeholder="0" value="${existing ? existing.driverCost : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Toll Tax (₹)</label>
              <input type="number" id="trip-toll" class="form-input" placeholder="0" value="${existing ? existing.tollCost : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Other Expense / Maintenance (₹)</label>
              <input type="number" id="trip-other" class="form-input" placeholder="0" value="${existing ? existing.otherExpense : ''}" />
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Goods Description / Notes</label>
              <textarea id="trip-notes" class="form-textarea" rows="2" placeholder="e.g. 15 Tons TMT Steel Bars">${existing ? escapeHtml(existing.notes || '') : ''}</textarea>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Update Trip Record' : 'Save Trip Entry'}</button>
        </div>
      </form>
    </div>
  `;

  const modalBackdrop = document.getElementById('modal-backdrop');
  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');

  // Auto handle status switch
  const statusEl = document.getElementById('trip-status');
  const amountEl = document.getElementById('trip-amount');
  const paidEl = document.getElementById('trip-paid');

  statusEl.addEventListener('change', () => {
    if (statusEl.value === 'Paid') {
      paidEl.value = amountEl.value || 0;
    } else if (statusEl.value === 'Pending') {
      paidEl.value = 0;
    }
  });

  document.getElementById('trip-modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const tripData = {
      date: document.getElementById('trip-date').value,
      lrNumber: document.getElementById('trip-lr').value,
      customerName: document.getElementById('trip-customer').value,
      consignor: document.getElementById('trip-consignor').value,
      consignee: document.getElementById('trip-consignee').value,
      fromLocation: document.getElementById('trip-from').value,
      toLocation: document.getElementById('trip-to').value,
      vehicleNumber: document.getElementById('trip-vehicle').value,
      driverName: document.getElementById('trip-driver').value,
      ewayBillNo: document.getElementById('trip-eway').value,
      weightTons: Number(document.getElementById('trip-weight').value) || 0,
      amount: Number(document.getElementById('trip-amount').value) || 0,
      paidAmount: Number(document.getElementById('trip-paid').value) || 0,
      status: document.getElementById('trip-status').value,
      fuelCost: Number(document.getElementById('trip-fuel').value) || 0,
      driverCost: Number(document.getElementById('trip-driver-cost').value) || 0,
      tollCost: Number(document.getElementById('trip-toll').value) || 0,
      otherExpense: Number(document.getElementById('trip-other').value) || 0,
      notes: document.getElementById('trip-notes').value
    };

    if (state.editingTripId) {
      await updateTrip(state.editingTripId, tripData);
      showToast('Trip record updated successfully', 'success');
    } else {
      await saveTrip(tripData);
      showToast('New trip recorded successfully', 'success');
    }

    closeModal();
    loadState();
    renderCurrentTab();
  });
}

// 2. ADD / EDIT VEHICLE MODAL
function openVehicleModal(vehicleId = null) {
  state.editingVehicleId = vehicleId;
  const existing = vehicleId ? state.vehicles.find(v => v.id === vehicleId) : null;

  const modalHtml = `
    <div class="modal-card">
      <div class="modal-header">
        <h3>${existing ? 'Edit Vehicle & Document Compliance' : 'Register New Fleet Vehicle'}</h3>
        <button class="btn-close-modal" onclick="window.closeModal()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <form id="vehicle-modal-form">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Vehicle Registration Number</label>
              <input type="text" id="veh-num" class="form-input" placeholder="e.g. MH 12 AB 1234" value="${existing ? escapeHtml(existing.vehicleNumber) : ''}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Make & Model</label>
              <input type="text" id="veh-model" class="form-input" placeholder="e.g. Tata Signa 2823.K" value="${existing ? escapeHtml(existing.makeModel || '') : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Vehicle Type</label>
              <select id="veh-type" class="form-select">
                <option value="10 Wheeler Truck" ${existing && existing.vehicleType === '10 Wheeler Truck' ? 'selected' : ''}>10 Wheeler Truck</option>
                <option value="6 Wheeler Truck" ${existing && existing.vehicleType === '6 Wheeler Truck' ? 'selected' : ''}>6 Wheeler Truck</option>
                <option value="12 Wheeler Heavy" ${existing && existing.vehicleType === '12 Wheeler Heavy' ? 'selected' : ''}>12 Wheeler Heavy</option>
                <option value="Multi-Axle Trailer" ${existing && existing.vehicleType === 'Multi-Axle Trailer' ? 'selected' : ''}>Multi-Axle Trailer</option>
                <option value="Mini Truck" ${existing && existing.vehicleType === 'Mini Truck' ? 'selected' : ''}>Mini Truck (Tata 407/Bolero)</option>
                <option value="Container Truck" ${existing && existing.vehicleType === 'Container Truck' ? 'selected' : ''}>Container Truck</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Gross Capacity (Tons)</label>
              <input type="number" id="veh-cap" step="0.5" class="form-input" placeholder="e.g. 16" value="${existing ? existing.capacityTons : '16'}" />
            </div>

            <div class="form-group">
              <label class="form-label">Fleet Ownership</label>
              <select id="veh-owner" class="form-select">
                <option value="Owned" ${existing && existing.ownership === 'Owned' ? 'selected' : ''}>Owned Fleet</option>
                <option value="Attached" ${existing && existing.ownership === 'Attached' ? 'selected' : ''}>Attached / Market Truck</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Assigned Driver Name</label>
              <input type="text" id="veh-driver" class="form-input" placeholder="Driver name" value="${existing ? escapeHtml(existing.driverName || '') : ''}" />
            </div>

            <!-- Document Compliance Expiries -->
            <div class="form-group form-group-full" style="margin-top: 6px;">
              <span class="form-label" style="font-weight: 700; color: var(--primary-700);">Statutory Compliance & Expiry Dates</span>
            </div>

            <div class="form-group">
              <label class="form-label">Fitness Certificate Expiry</label>
              <input type="date" id="veh-fitness" class="form-input" value="${existing ? existing.fitnessExpiry : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Insurance Policy Expiry</label>
              <input type="date" id="veh-insurance" class="form-input" value="${existing ? existing.insuranceExpiry : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">National Permit Expiry</label>
              <input type="date" id="veh-permit" class="form-input" value="${existing ? existing.permitExpiry : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">PUC (Pollution) Expiry</label>
              <input type="date" id="veh-puc" class="form-input" value="${existing ? existing.pucExpiry : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Vehicle Operating Status</label>
              <select id="veh-status" class="form-select">
                <option value="Active" ${existing && existing.status === 'Active' ? 'selected' : ''}>Active (On Duty)</option>
                <option value="In Maintenance" ${existing && existing.status === 'In Maintenance' ? 'selected' : ''}>In Maintenance / Garage</option>
                <option value="Inactive" ${existing && existing.status === 'Inactive' ? 'selected' : ''}>Inactive / Idle</option>
              </select>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Update Vehicle' : 'Register Vehicle'}</button>
        </div>
      </form>
    </div>
  `;

  const modalBackdrop = document.getElementById('modal-backdrop');
  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');

  document.getElementById('vehicle-modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      vehicleNumber: document.getElementById('veh-num').value,
      makeModel: document.getElementById('veh-model').value,
      vehicleType: document.getElementById('veh-type').value,
      capacityTons: Number(document.getElementById('veh-cap').value) || 16,
      ownership: document.getElementById('veh-owner').value,
      driverName: document.getElementById('veh-driver').value,
      fitnessExpiry: document.getElementById('veh-fitness').value,
      insuranceExpiry: document.getElementById('veh-insurance').value,
      permitExpiry: document.getElementById('veh-permit').value,
      pucExpiry: document.getElementById('veh-puc').value,
      status: document.getElementById('veh-status').value
    };

    if (state.editingVehicleId) {
      await updateVehicle(state.editingVehicleId, data);
      showToast('Vehicle updated successfully', 'success');
    } else {
      await saveVehicle(data);
      showToast('New vehicle registered in fleet', 'success');
    }

    closeModal();
    loadState();
    renderCurrentTab();
  });
}

// 3. ADD / EDIT DRIVER MODAL
function openDriverModal(driverId = null) {
  state.editingDriverId = driverId;
  const existing = driverId ? state.drivers.find(d => d.id === driverId) : null;

  const modalHtml = `
    <div class="modal-card">
      <div class="modal-header">
        <h3>${existing ? 'Edit Driver Profile' : 'Add New Driver / Staff'}</h3>
        <button class="btn-close-modal" onclick="window.closeModal()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <form id="driver-modal-form">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label">Driver Full Name</label>
              <input type="text" id="driv-name" class="form-input" placeholder="e.g. Rajesh Yadav" value="${existing ? escapeHtml(existing.name) : ''}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Mobile Phone Number</label>
              <input type="text" id="driv-phone" class="form-input" placeholder="+91 98221 11223" value="${existing ? escapeHtml(existing.phone || '') : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Driving License Number</label>
              <input type="text" id="driv-lic" class="form-input" placeholder="e.g. MH-1420150001234" value="${existing ? escapeHtml(existing.licenseNumber || '') : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Assigned Vehicle Plate</label>
              <input type="text" id="driv-truck" class="form-input" placeholder="e.g. MH 12 AB 1234" value="${existing ? escapeHtml(existing.assignedVehicle || '') : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Monthly Salary (₹)</label>
              <input type="number" id="driv-salary" class="form-input" placeholder="e.g. 22000" value="${existing ? existing.monthlySalary : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Initial Kharacha / Advance Due (₹)</label>
              <input type="number" id="driv-adv" class="form-input" placeholder="0" value="${existing ? existing.advanceBalance : '0'}" />
            </div>

            <div class="form-group">
              <label class="form-label">Availability Status</label>
              <select id="driv-status" class="form-select">
                <option value="Available" ${existing && existing.status === 'Available' ? 'selected' : ''}>Available</option>
                <option value="On Trip" ${existing && existing.status === 'On Trip' ? 'selected' : ''}>On Trip</option>
                <option value="On Leave" ${existing && existing.status === 'On Leave' ? 'selected' : ''}>On Leave</option>
              </select>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Update Driver' : 'Save Driver'}</button>
        </div>
      </form>
    </div>
  `;

  const modalBackdrop = document.getElementById('modal-backdrop');
  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');

  document.getElementById('driver-modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      name: document.getElementById('driv-name').value,
      phone: document.getElementById('driv-phone').value,
      licenseNumber: document.getElementById('driv-lic').value,
      assignedVehicle: document.getElementById('driv-truck').value,
      monthlySalary: Number(document.getElementById('driv-salary').value) || 0,
      advanceBalance: Number(document.getElementById('driv-adv').value) || 0,
      status: document.getElementById('driv-status').value
    };

    if (state.editingDriverId) {
      await updateDriver(state.editingDriverId, data);
      showToast('Driver profile updated', 'success');
    } else {
      await saveDriver(data);
      showToast('Driver registered successfully', 'success');
    }

    closeModal();
    loadState();
    renderCurrentTab();
  });
}

// 4. DRIVER KHARACHA / ADVANCE MODAL
function openDriverAdvanceModal(driverId, type = 'advance') {
  const driver = state.drivers.find(d => d.id === driverId);
  if (!driver) return;

  const currentBal = Number(driver.advanceBalance) || 0;
  const isAdvance = type === 'advance';

  const modalHtml = `
    <div class="modal-card" style="max-width: 480px;">
      <div class="modal-header">
        <h3>${isAdvance ? 'Disburse Trip Advance / Kharacha' : 'Settle Driver Advance'}</h3>
        <button class="btn-close-modal" onclick="window.closeModal()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <form id="driver-advance-form">
        <div class="modal-body">
          <div style="background: var(--slate-50); padding: 14px; border-radius: var(--radius-md); margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 700; color: var(--slate-900);">${escapeHtml(driver.name)}</div>
              <div style="font-size: 0.8rem; color: var(--slate-500);">${escapeHtml(driver.assignedVehicle || 'No truck')}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.72rem; color: var(--slate-500); text-transform: uppercase;">Current Balance Due</div>
              <div style="font-size: 1.15rem; font-weight: 800; color: #c2410c;">${formatRupee(currentBal)}</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">${isAdvance ? 'Advance Amount Given (₹)' : 'Settlement Amount Deducted (₹)'}</label>
            <input type="number" id="adv-amount" class="form-input" placeholder="e.g. 2000" min="1" required autofocus />
          </div>

          <!-- Quick Chips -->
          <div style="display: flex; gap: 8px; margin-top: 10px; margin-bottom: 16px;">
            <button type="button" class="btn btn-outline btn-sm quick-amt" data-amt="1000">₹1,000</button>
            <button type="button" class="btn btn-outline btn-sm quick-amt" data-amt="2000">₹2,000</button>
            <button type="button" class="btn btn-outline btn-sm quick-amt" data-amt="3000">₹3,000</button>
            <button type="button" class="btn btn-outline btn-sm quick-amt" data-amt="5000">₹5,000</button>
          </div>

          <div class="form-group">
            <label class="form-label">Trip / Reason Note</label>
            <input type="text" id="adv-note" class="form-input" placeholder="e.g. Diesel, Enroute toll & food expense" />
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isAdvance ? 'Confirm & Give Advance' : 'Confirm Settlement'}</button>
        </div>
      </form>
    </div>
  `;

  const modalBackdrop = document.getElementById('modal-backdrop');
  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');

  const amtInput = document.getElementById('adv-amount');
  document.querySelectorAll('.quick-amt').forEach(btn => {
    btn.addEventListener('click', () => {
      amtInput.value = btn.getAttribute('data-amt');
    });
  });

  document.getElementById('driver-advance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(amtInput.value) || 0;
    if (amount <= 0) return;

    await recordDriverAdvance(driverId, amount, type);
    showToast(isAdvance ? `₹${amount} advance recorded for ${driver.name}` : `₹${amount} advance settled for ${driver.name}`, 'success');

    closeModal();
    loadState();
    renderCurrentTab();
  });
}

// 5. PRINTABLE LORRY RECEIPT (LR) & DYNAMIC UPI QR INVOICE MODAL
function openPrintReceiptModal(tripId) {
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;

  const s = state.settings;
  const pending = trip.amount - (trip.paidAmount || (trip.status === 'Paid' ? trip.amount : 0));
  const lrDisplay = trip.lrNumber || `LR-2026-${String(trip.id).slice(-4)}`;

  // Generate dynamic QR code URL for UPI payment
  const upiQrUrl = s.upiId ? generateUpiQrCodeUrl(s.upiId, s.businessName, pending, `Payment for ${lrDisplay}`) : '';
  const upiPayLink = s.upiId ? generateUpiPayLink(s.upiId, s.businessName, pending, `Payment for ${lrDisplay}`) : '';

  // WhatsApp share link
  const cust = state.customers.find(c => c.name.toLowerCase() === trip.customerName.toLowerCase());
  const phone = cust ? cust.phone : '';
  const waShareUrl = generateWhatsAppReminderLink(phone, trip.customerName, pending, trip, s);

  const modalHtml = `
    <div class="modal-card" style="max-width: 780px;">
      <div class="modal-header">
        <h3>Lorry Receipt (LR) &amp; Consignment Bilty</h3>
        <button class="btn-close-modal" onclick="window.closeModal()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="modal-body" style="padding: 0;">
        <div class="print-invoice-wrapper" id="printable-lr-content" style="padding: 24px;">
          
          <!-- Top Transporter Banner -->
          <div class="invoice-header" style="border-bottom: 2px solid var(--slate-900); padding-bottom: 16px; margin-bottom: 16px;">
            <div class="invoice-title-block">
              <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--primary-800);">${escapeHtml(s.businessName || 'Transport Ledger')}</h2>
              <p style="font-size: 0.88rem; font-weight: 600;">Fleet Owners, Transport Contractors &amp; Heavy Freight Logistics</p>
              <p style="font-size: 0.8rem; color: var(--slate-600);">${escapeHtml(s.address || '')} • ${escapeHtml(s.city || '')}</p>
              <div style="font-size: 0.8rem; display: flex; gap: 14px; margin-top: 4px; font-weight: 600;">
                <span>Phone: ${escapeHtml(s.phone || '')}</span>
                ${s.gstin ? `<span>GSTIN: <code>${escapeHtml(s.gstin)}</code></span>` : ''}
                ${s.pan ? `<span>PAN: <code>${escapeHtml(s.pan)}</code></span>` : ''}
              </div>
            </div>
            <div class="invoice-meta" style="text-align: right;">
              <div class="invoice-lr-no" style="font-size: 1.15rem; font-weight: 800; background: var(--primary-900); color:#ffffff; padding: 4px 12px; border-radius: 6px; display: inline-block;">
                ${escapeHtml(lrDisplay)}
              </div>
              <p style="font-size: 0.88rem; font-weight: 700; margin-top: 6px;">Date: ${formatDate(trip.date)}</p>
              ${trip.ewayBillNo ? `<p style="font-size: 0.78rem; font-family: monospace;">E-Way: ${escapeHtml(trip.ewayBillNo)}</p>` : ''}
            </div>
          </div>

          <!-- Consignor & Consignee Details -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; border: 1px solid var(--slate-300); border-radius: 8px; padding: 12px;">
            <div>
              <span style="font-size: 0.72rem; color: var(--slate-500); font-weight: 700; text-transform: uppercase;">Consignor (Sender)</span>
              <h4 style="font-size: 1rem; font-weight: 700; margin-top: 2px;">${escapeHtml(trip.consignor || trip.customerName)}</h4>
              <p style="font-size: 0.85rem; color: var(--slate-600);">Origin: <strong>${escapeHtml(trip.fromLocation)}</strong></p>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--slate-500); font-weight: 700; text-transform: uppercase;">Consignee (Receiver / Deliver To)</span>
              <h4 style="font-size: 1rem; font-weight: 700; margin-top: 2px;">${escapeHtml(trip.consignee || trip.customerName)}</h4>
              <p style="font-size: 0.85rem; color: var(--slate-600);">Destination: <strong>${escapeHtml(trip.toLocation)}</strong></p>
            </div>
          </div>

          <!-- Vehicle & Driver Details Row -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: var(--slate-50); padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-size: 0.85rem;">
            <div>Vehicle: <strong>${escapeHtml(trip.vehicleNumber)}</strong></div>
            <div>Driver: <strong>${escapeHtml(trip.driverName || 'As Assigned')}</strong></div>
            <div>Weight: <strong>${trip.weightTons ? `${trip.weightTons} Tons` : 'Full Truck Load'}</strong></div>
            <div>Route: <strong>${escapeHtml(trip.fromLocation)} ➔ ${escapeHtml(trip.toLocation)}</strong></div>
          </div>

          <!-- Freight Accounting Table -->
          <table class="data-table" style="margin-bottom: 16px; border: 1px solid var(--slate-200);">
            <thead>
              <tr style="background: var(--slate-100);">
                <th>Description / Goods Carried</th>
                <th style="text-align: right;">Total Freight (₹)</th>
                <th style="text-align: right;">Advance Paid (₹)</th>
                <th style="text-align: right;">Balance Payable (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${escapeHtml(trip.notes || 'Commercial Goods Freight Transportation')}</strong></td>
                <td style="text-align: right;"><strong>${formatRupee(trip.amount)}</strong></td>
                <td style="text-align: right; color: #047857;">${formatRupee(trip.paidAmount || (trip.status === 'Paid' ? trip.amount : 0))}</td>
                <td style="text-align: right; color: #c2410c; font-size: 1.05rem;"><strong>${formatRupee(pending)}</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- Dynamic UPI QR & Payment Settlement Block -->
          <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center; border: 1.5px solid var(--slate-300); border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #ffffff;">
            <div>
              <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--slate-900);">Bank &amp; Instant UPI Payment</h4>
              <p style="font-size: 0.8rem; color: var(--slate-500); margin-top: 2px;">
                Scan QR with PhonePe, Google Pay, or Paytm for instant bank clearance
              </p>
              ${s.upiId ? `<div style="font-size: 0.85rem; font-family: monospace; font-weight: 700; margin-top: 6px; color: var(--primary-700);">UPI VPA: ${escapeHtml(s.upiId)}</div>` : ''}
              ${s.bankName && s.accountNumber ? `
                <div style="font-size: 0.8rem; color: var(--slate-600); margin-top: 4px;">
                  ${escapeHtml(s.bankName)} • A/C: <strong>${escapeHtml(s.accountNumber)}</strong> • IFSC: <strong>${escapeHtml(s.ifscCode || '')}</strong>
                </div>
              ` : ''}
              <div style="font-size: 0.75rem; color: var(--slate-500); margin-top: 8px;">
                *GST Reverse Charge (GTA RCM 5%) applies to registered consignors/consignees as per GST laws.
              </div>
            </div>

            <!-- Dynamic QR Code -->
            ${upiQrUrl && pending > 0 ? `
              <div style="text-align: center;">
                <img src="${upiQrUrl}" alt="UPI Payment QR Code" style="width: 120px; height: 120px; display: block; border: 1px solid var(--slate-300); border-radius: 6px; padding: 4px; background: #ffffff;" />
                <span style="font-size: 0.7rem; font-weight: 700; color: #047857; display: block; margin-top: 4px;">SCAN &amp; PAY ${formatRupee(pending)}</span>
              </div>
            ` : ''}
          </div>

          <!-- Terms & Signatures -->
          <div style="font-size: 0.72rem; color: var(--slate-500); margin-bottom: 24px; line-height: 1.4;">
            <strong>Standard GTA Terms:</strong> 1. Goods carried strictly at owner's risk. 2. Demurrage charged after 24 hrs. 3. Subject to local jurisdiction.
          </div>

          <div class="invoice-signatures" style="display: flex; justify-content: space-between; margin-top: 20px;">
            <div class="sig-box" style="width: 220px; border-top: 1px solid var(--slate-400); padding-top: 6px; text-align: center; font-size: 0.82rem;">
              Consignor / Driver Signature
            </div>
            <div class="sig-box" style="width: 220px; border-top: 1px solid var(--slate-400); padding-top: 6px; text-align: center; font-size: 0.82rem; font-weight: 700;">
              For ${escapeHtml(s.businessName || 'Transport Co.')}
            </div>
          </div>

        </div>
      </div>

      <div class="modal-footer">
        <a href="${waShareUrl}" target="_blank" class="btn btn-whatsapp">
          Share on WhatsApp
        </a>
        <button class="btn btn-secondary" onclick="window.closeModal()">Close</button>
        <button class="btn btn-primary" onclick="window.print()">
          Print Receipt (PDF)
        </button>
      </div>
    </div>
  `;

  const modalBackdrop = document.getElementById('modal-backdrop');
  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');
}

// 6. CUSTOMER ACCOUNT MODAL
function openCustomerModal(customerId = null) {
  state.editingCustomerId = customerId;
  const existing = customerId ? state.customers.find(c => c.id === customerId) : null;

  const modalHtml = `
    <div class="modal-card">
      <div class="modal-header">
        <h3>${existing ? 'Edit Customer Account' : 'Add New Customer'}</h3>
        <button class="btn-close-modal" onclick="window.closeModal()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <form id="customer-modal-form">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label">Customer / Party Name</label>
              <input type="text" id="cust-name" class="form-input" placeholder="e.g. Sharma Freight Carriers" value="${existing ? escapeHtml(existing.name) : ''}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Phone / Mobile</label>
              <input type="text" id="cust-phone" class="form-input" placeholder="e.g. +91 98200 12345" value="${existing ? escapeHtml(existing.phone || '') : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">City, State</label>
              <input type="text" id="cust-city" class="form-input" placeholder="e.g. Mumbai, Maharashtra" value="${existing ? escapeHtml(existing.city || '') : ''}" />
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">GSTIN (Optional)</label>
              <input type="text" id="cust-gstin" class="form-input" placeholder="e.g. 27AABCS123411Z5" value="${existing ? escapeHtml(existing.gstin || '') : ''}" />
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Update Customer' : 'Save Customer'}</button>
        </div>
      </form>
    </div>
  `;

  const modalBackdrop = document.getElementById('modal-backdrop');
  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');

  document.getElementById('customer-modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('cust-name').value,
      phone: document.getElementById('cust-phone').value,
      city: document.getElementById('cust-city').value,
      gstin: document.getElementById('cust-gstin').value
    };

    if (state.editingCustomerId) {
      await updateCustomer(state.editingCustomerId, data);
      showToast('Customer account updated', 'success');
    } else {
      await saveCustomer(data);
      showToast('Customer account created', 'success');
    }

    closeModal();
    loadState();
    renderCurrentTab();
  });
}

// 7. CUSTOMER STATEMENT MODAL
function openStatementModal(customerName) {
  state.viewingCustomerStatement = customerName;
  const customerTrips = state.trips.filter(t => t.customerName.toLowerCase() === customerName.toLowerCase());
  const cust = state.customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
  const phone = cust ? cust.phone : '';

  let totalAmt = 0, paidAmt = 0;
  customerTrips.forEach(t => {
    const amt = Number(t.amount) || 0;
    const paid = Number(t.paidAmount) || (t.status === 'Paid' ? amt : 0);
    totalAmt += amt;
    paidAmt += paid;
  });
  const pendingAmt = totalAmt - paidAmt;
  const waUrl = pendingAmt > 0 ? generateWhatsAppReminderLink(phone, customerName, pendingAmt, null, state.settings) : null;

  const rows = customerTrips.map(t => `
    <tr>
      <td><strong>${formatDate(t.date)}</strong></td>
      <td>${escapeHtml(t.fromLocation)} ➔ ${escapeHtml(t.toLocation)}</td>
      <td><span class="vehicle-tag">${escapeHtml(t.vehicleNumber)}</span></td>
      <td>${escapeHtml(t.notes || '-')}</td>
      <td><strong>${formatRupee(t.amount)}</strong></td>
      <td><span class="badge-status badge-${t.status.toLowerCase()}">${t.status}</span></td>
    </tr>
  `).join('');

  const modalHtml = `
    <div class="modal-card" style="max-width: 820px;">
      <div class="modal-header">
        <div>
          <h3 style="margin-bottom: 2px;">Customer Ledger Statement</h3>
          <p style="font-size: 0.85rem; color: var(--slate-500);">${escapeHtml(customerName)}</p>
        </div>
        <button class="btn-close-modal" onclick="window.closeModal()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="modal-body">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; background: var(--slate-50); padding: 16px; border-radius: var(--radius-md);">
          <div>
            <span style="font-size: 0.75rem; color: var(--slate-500); text-transform: uppercase;">Total Freight Volume</span>
            <div style="font-size: 1.2rem; font-weight: 800; color: var(--slate-900);">${formatRupee(totalAmt)}</div>
          </div>
          <div>
            <span style="font-size: 0.75rem; color: var(--slate-500); text-transform: uppercase;">Total Cleared</span>
            <div style="font-size: 1.2rem; font-weight: 800; color: #047857;">${formatRupee(paidAmt)}</div>
          </div>
          <div>
            <span style="font-size: 0.75rem; color: var(--slate-500); text-transform: uppercase;">Outstanding Dues</span>
            <div style="font-size: 1.2rem; font-weight: 800; color: #c2410c;">${formatRupee(pendingAmt)}</div>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Route</th>
                <th>Vehicle No</th>
                <th>Goods Details</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="6" style="text-align:center;">No trip history recorded</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="modal-footer">
        ${waUrl ? `<a href="${waUrl}" target="_blank" class="btn btn-whatsapp btn-sm">WhatsApp Reminder</a>` : ''}
        <button id="btn-export-statement-csv" class="btn btn-secondary btn-sm">
          Export CSV Statement
        </button>
        <button type="button" class="btn btn-primary" onclick="window.closeModal()">Close</button>
      </div>
    </div>
  `;

  const modalBackdrop = document.getElementById('modal-backdrop');
  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');

  document.getElementById('btn-export-statement-csv').addEventListener('click', () => {
    exportCustomerLedgerToCSV(customerName, state.trips);
    showToast(`Statement exported for ${customerName}`, 'success');
  });
}

// 8. DIAGNOSTICS & LAN MOBILE PAIRING MODAL
function openDiagnosticsModal() {
  const sync = getSyncStatus();
  const info = sync.serverInfo || {};
  const dbInfo = info.database || {};
  const isOnline = sync.isServerOnline;
  const isMongo = dbInfo.isMongo;

  const mobileUrls = info.mobileUrls || [];
  const primaryMobileUrl = mobileUrls.length > 0 ? mobileUrls[0] : window.location.origin;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=1&data=${encodeURIComponent(primaryMobileUrl)}`;

  const modalHtml = `
    <div class="modal-card" style="max-width: 520px;">
      <div class="modal-header">
        <h3>Server &amp; Cloud Diagnostics</h3>
        <button class="btn-close-modal" onclick="window.closeModal()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="modal-body">
        <div style="display: flex; flex-direction: column; gap: 14px;">
          
          <!-- Database Engine Status -->
          <div style="background: var(--slate-50); border: 1px solid var(--slate-200); padding: 14px; border-radius: var(--radius-md);">
            <div style="font-size: 0.75rem; color: var(--slate-500); text-transform: uppercase; font-weight: 700;">Database Engine</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: ${isOnline ? '#047857' : '#c2410c'}; margin-top: 2px;">
              ${dbInfo.engine || (isOnline ? 'Online Engine' : 'Offline Browser LocalStorage')}
            </div>
            <div style="font-size: 0.8rem; color: var(--slate-600); margin-top: 2px;">
              ${dbInfo.storageLocation || 'Local client storage'}
            </div>
          </div>

          <!-- Server Uptime & Port -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85rem;">
            <div style="background: var(--slate-50); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--slate-200);">
              <span style="font-size: 0.72rem; color: var(--slate-500);">Server Status:</span>
              <div style="font-weight: 700; color: ${isOnline ? '#047857' : '#c2410c'};">${isOnline ? 'Active Online' : 'Offline'}</div>
            </div>
            <div style="background: var(--slate-50); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--slate-200);">
              <span style="font-size: 0.72rem; color: var(--slate-500);">Server Version:</span>
              <div style="font-weight: 700;">v2.0.0 (Enterprise)</div>
            </div>
          </div>

          <!-- Mobile Phone LAN Pairing -->
          <div style="text-align: center; border: 1.5px dashed var(--slate-300); border-radius: var(--radius-md); padding: 16px;">
            <div style="font-size: 0.88rem; font-weight: 700; color: var(--slate-900);">Instant Mobile Phone Access</div>
            <p style="font-size: 0.78rem; color: var(--slate-500); margin-top: 2px; margin-bottom: 12px;">
              Scan with your mobile phone camera while connected to same Wi-Fi
            </p>
            <img src="${qrUrl}" alt="Mobile QR Code" style="width: 150px; height: 150px; display: inline-block; border-radius: 8px; border: 1px solid var(--slate-200); padding: 4px; background: #ffffff;" />
            <div style="font-family: monospace; font-size: 0.82rem; font-weight: 700; color: var(--primary-700); margin-top: 10px;">
              ${primaryMobileUrl}
            </div>
          </div>

        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-primary" onclick="window.closeModal()">Close</button>
      </div>
    </div>
  `;

  const modalBackdrop = document.getElementById('modal-backdrop');
  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');
}

window.openDiagnosticsModal = openDiagnosticsModal;

// Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ==========================================================================
   9. AUTHENTICATION & ENROLLMENT MODAL (GOOGLE LOGIN & ANTI-BOT CAPTCHA)
   ========================================================================== */

function openGoogleAuthModal() {
  const modalBackdrop = document.getElementById('modal-backdrop');
  if (!modalBackdrop) return;

  const modalHtml = `
    <div class="modal-card" style="max-width: 440px;">
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800;">Sign in with Google</h3>
        </div>
        <button class="btn-close-modal" onclick="window.closeModal()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="modal-body" style="padding-top: 10px;">
        <p style="font-size: 0.85rem; color: var(--slate-600); margin: 0 0 16px;">
          Choose an account to continue to <strong>Transport Ledger Cloud</strong>:
        </p>

        <!-- Quick 1-Click Google Accounts -->
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
          <div class="google-acc-pill" id="btn-modal-goog-acc-sanjay">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: #4285F4; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem;">
                SE
              </div>
              <div style="text-align: left;">
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--slate-900);">Sanjay Elumalai</div>
                <div style="font-size: 0.78rem; color: var(--slate-500);">es3300735@gmail.com</div>
              </div>
            </div>
            <span style="font-size: 0.75rem; background: #ecfdf5; color: #047857; font-weight: 700; padding: 2px 8px; border-radius: 999px;">Cloud Ready</span>
          </div>

          <div class="google-acc-pill" id="btn-modal-goog-acc-demo">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: #059669; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem;">
                TL
              </div>
              <div style="text-align: left;">
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--slate-900);">Demo Transporter</div>
                <div style="font-size: 0.78rem; color: var(--slate-500);">demo.transporter@gmail.com</div>
              </div>
            </div>
            <span style="font-size: 0.75rem; background: #f1f5f9; color: var(--slate-600); font-weight: 600; padding: 2px 8px; border-radius: 999px;">Demo</span>
          </div>
        </div>

        <div class="auth-divider"><span>or enter custom gmail</span></div>

        <form id="form-modal-google-custom">
          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" style="font-size: 0.82rem;">Your Google Email ID</label>
            <input type="email" id="input-modal-google-email" class="form-input" placeholder="transport@gmail.com" required />
          </div>
          <button type="submit" class="btn btn-google" style="padding: 10px; font-weight: 700;">
            Sign in with this Google Account
          </button>
        </form>
      </div>
    </div>
  `;

  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');

  const doGoogleLogin = async (email, name) => {
    try {
      showToast('Authenticating with Google...', 'info');
      await loginWithGoogle({
        email,
        name,
        businessName: `${name} Logistics`,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
      });
      window.closeModal();
      showToast(`Welcome back, ${name}! Signed in with Google.`, 'success');
      switchTab('dashboard');
    } catch (err) {
      showToast(err.message || 'Google sign-in failed', 'error');
    }
  };

  document.getElementById('btn-modal-goog-acc-sanjay')?.addEventListener('click', () => {
    doGoogleLogin('es3300735@gmail.com', 'Sanjay Elumalai');
  });

  document.getElementById('btn-modal-goog-acc-demo')?.addEventListener('click', () => {
    doGoogleLogin('demo.transporter@gmail.com', 'Demo Transporter');
  });

  document.getElementById('form-modal-google-custom')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('input-modal-google-email').value.trim();
    if (!email.includes('@')) {
      showToast('Please enter a valid Google email', 'error');
      return;
    }
    const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    doGoogleLogin(email, name);
  });
}
window.openGoogleAuthModal = openGoogleAuthModal;

async function openAuthModal(initialTab = 'login') {
  let activeTab = initialTab;
  let currentCaptcha = generateClientCaptcha();

  function renderAuthModalContent() {
    const modalBackdrop = document.getElementById('modal-backdrop');
    if (!modalBackdrop) return;

    const modalHtml = `
      <div class="modal-card" style="max-width: 460px;">
        <div class="modal-header">
          <div>
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800;">
              ${activeTab === 'login' ? 'Sign In to Transport Ledger' : 'New User Enrollment'}
            </h3>
            <p style="margin: 3px 0 0; font-size: 0.8rem; color: var(--slate-500);">
              ${activeTab === 'login' ? 'Access your cloud-secured transport ledger' : 'Isolated and encrypted cloud ledger partition'}
            </p>
          </div>
          <button class="btn-close-modal" onclick="window.closeModal()">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="modal-body" style="padding-top: 14px;">
          <!-- Tab Navigation -->
          <div class="auth-tabs" style="margin-bottom: 16px;">
            <button type="button" class="auth-tab ${activeTab === 'login' ? 'active' : ''}" id="tab-btn-login">
              Email ID Sign In
            </button>
            <button type="button" class="auth-tab ${activeTab === 'register' ? 'active' : ''}" id="tab-btn-register">
              New User Enroll
            </button>
          </div>

          <!-- Quick Google & 1-Click Access -->
          <div style="margin-bottom: 16px;">
            <button type="button" class="btn-google" id="btn-modal-google-auth" style="margin-bottom: 10px;">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <button type="button" id="btn-modal-quick-demo" class="btn btn-outline btn-sm btn-block" style="justify-content: center; gap: 6px; font-weight: 700; color: #047857; border-color: #a7f3d0; background: #ecfdf5;">
              ⚡ 1-Click Access: Sanjay Logistics (Cloud)
            </button>

            <div class="auth-divider"><span>or with email credentials</span></div>
          </div>

          <!-- SIGN IN FORM -->
          ${activeTab === 'login' ? `
            <form id="form-auth-login">
              <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label">Email ID Address</label>
                <input type="email" id="auth-login-email" class="form-input" placeholder="transport@gmail.com" required autocomplete="email" />
              </div>

              <div class="form-group" style="margin-bottom: 18px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <label class="form-label" style="margin:0;">Password</label>
                  <button type="button" id="toggle-login-pwd" style="background:none; border:none; font-size:0.75rem; color:var(--primary-600); cursor:pointer; font-weight:600;">Show</button>
                </div>
                <input type="password" id="auth-login-password" class="form-input" style="margin-top:6px;" placeholder="••••••••" required autocomplete="current-password" />
              </div>

              <button type="submit" id="btn-submit-login" class="btn btn-primary btn-block" style="padding: 12px; font-weight: 700;">
                Sign In to Transport Ledger
              </button>

              <div style="text-align: center; margin-top: 16px; font-size: 0.85rem; color: var(--slate-600);">
                New transport business? <a href="#" id="link-goto-register" style="color: var(--primary-700); font-weight: 700; text-decoration: none;">Enroll New Account</a>
              </div>
            </form>
          ` : `
            <!-- REGISTRATION FORM WITH ANTI-BOT CAPTCHA -->
            <form id="form-auth-register">
              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label">Transport Business Name</label>
                <input type="text" id="reg-biz-name" class="form-input" placeholder="e.g. Jai Hanuman Transport Co." required />
              </div>

              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label">Owner / Operator Name</label>
                <input type="text" id="reg-name" class="form-input" placeholder="e.g. Ramesh Sharma" required />
              </div>

              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label">Email ID Address</label>
                <input type="email" id="reg-email" class="form-input" placeholder="e.g. ramesh@transport.com" required autocomplete="email" />
              </div>

              <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label">Create Password (min. 6 characters)</label>
                <input type="password" id="reg-password" class="form-input" placeholder="••••••••" minlength="6" required autocomplete="new-password" />
              </div>

              <!-- ANTI-BOT SECURITY CAPTCHA -->
              <div class="form-group" style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin: 0; font-size: 0.82rem; font-weight: 700; color: var(--slate-800);">
                    🛡️ Anti-Bot Security Verification
                  </label>
                  <button type="button" class="btn-refresh-captcha" id="btn-modal-refresh-captcha" title="Click to refresh code">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Refresh
                  </button>
                </div>
                
                <div style="display: flex; align-items: center; gap: 10px; background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: var(--radius-md); padding: 8px 12px;">
                  <div id="modal-captcha-image-wrapper" style="min-width: 160px; height: 48px; display: flex; align-items: center; justify-content: center; background: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1;">
                    ${currentCaptcha.rawSvg || (currentCaptcha.svg ? `<img src="${currentCaptcha.svg}" alt="Code" style="height:48px;" />` : '')}
                  </div>
                  <div style="flex: 1;">
                    <input type="text" id="modal-reg-captcha-input" class="form-input" placeholder="Code" maxlength="5" style="text-transform: uppercase; letter-spacing: 3px; font-weight: 800; text-align: center; font-size: 1.1rem; padding: 10px 8px; height: 48px;" required autocomplete="off" />
                  </div>
                </div>
                <div id="modal-captcha-hint" style="font-size: 0.75rem; color: var(--slate-500); margin-top: 4px;">
                  Enter the 5 characters shown above (case-insensitive)
                </div>
              </div>

              <button type="submit" id="btn-submit-register" class="btn btn-primary btn-block" style="padding: 12px; font-weight: 700; font-size: 1rem;">
                Enroll &amp; Create Safe Ledger
              </button>

              <div style="text-align: center; margin-top: 14px; font-size: 0.85rem; color: var(--slate-600);">
                Already have an account? <a href="#" id="link-goto-login" style="color: var(--primary-700); font-weight: 700; text-decoration: none;">Sign In</a>
              </div>
            </form>
          `}
        </div>
      </div>
    `;

    modalBackdrop.innerHTML = modalHtml;
    modalBackdrop.classList.add('open');

    // Google Login button
    document.getElementById('btn-modal-google-auth')?.addEventListener('click', () => {
      openGoogleAuthModal();
    });

    // Quick demo 1-click test button
    document.getElementById('btn-modal-quick-demo')?.addEventListener('click', async () => {
      try {
        showToast('Entering cloud ledger as Sanjay...', 'info');
        await loginWithGoogle({
          email: 'es3300735@gmail.com',
          name: 'Sanjay Elumalai',
          businessName: 'Sanjay Transport Logistics'
        });
        window.closeModal();
        showToast('Signed in successfully! Welcome Sanjay.', 'success');
        switchTab('dashboard');
      } catch (e) {
        showToast(e.message || 'Quick login failed', 'error');
      }
    });

    // Tab buttons
    document.getElementById('tab-btn-login')?.addEventListener('click', () => {
      activeTab = 'login';
      renderAuthModalContent();
    });
    document.getElementById('tab-btn-register')?.addEventListener('click', () => {
      activeTab = 'register';
      renderAuthModalContent();
    });

    // Links to switch tabs
    document.getElementById('link-goto-register')?.addEventListener('click', (e) => {
      e.preventDefault();
      activeTab = 'register';
      renderAuthModalContent();
    });
    document.getElementById('link-goto-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      activeTab = 'login';
      renderAuthModalContent();
    });

    // Refresh Captcha in modal
    document.getElementById('btn-modal-refresh-captcha')?.addEventListener('click', async () => {
      currentCaptcha = generateClientCaptcha();
      const wrapper = document.getElementById('modal-captcha-image-wrapper');
      if (wrapper) wrapper.innerHTML = currentCaptcha.rawSvg || `<img src="${currentCaptcha.svg}" alt="Code" style="height:48px;" />`;
      const input = document.getElementById('modal-reg-captcha-input');
      if (input) {
        input.value = '';
        input.style.borderColor = '';
      }
      const hint = document.getElementById('modal-captcha-hint');
      if (hint) hint.innerHTML = 'Enter the 5 characters shown above (case-insensitive)';

      try {
        const srv = await fetchCaptcha();
        if (srv && (srv.rawSvg || srv.svg)) {
          currentCaptcha = srv;
          if (wrapper) wrapper.innerHTML = srv.rawSvg || `<img src="${srv.svg}" alt="Code" style="height:48px;" />`;
        }
      } catch (err) {}
    });

    // Captcha live typing feedback in modal
    const captchaInput = document.getElementById('modal-reg-captcha-input');
    if (captchaInput) {
      captchaInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toUpperCase();
        const hint = document.getElementById('modal-captcha-hint');
        if (val.length === 5) {
          if (currentCaptcha.code && val === currentCaptcha.code.toUpperCase()) {
            captchaInput.style.borderColor = '#059669';
            if (hint) hint.innerHTML = '<span style="color:#059669; font-weight:700;">✓ Security code verified</span>';
          } else {
            captchaInput.style.borderColor = '#e2e8f0';
          }
        }
      });
    }

    // Toggle password visibility
    const togglePwdBtn = document.getElementById('toggle-login-pwd');
    if (togglePwdBtn) {
      togglePwdBtn.addEventListener('click', () => {
        const pwdInput = document.getElementById('auth-login-password');
        if (pwdInput.type === 'password') {
          pwdInput.type = 'text';
          togglePwdBtn.textContent = 'Hide';
        } else {
          pwdInput.type = 'password';
          togglePwdBtn.textContent = 'Show';
        }
      });
    }

    // Login Form Submit
    document.getElementById('form-auth-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-login-email').value.trim();
      const password = document.getElementById('auth-login-password').value;
      const submitBtn = document.getElementById('btn-submit-login');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';

      try {
        await loginUser(email, password);
        window.closeModal();
        showToast(`Signed in successfully as ${email}`, 'success');
      } catch (err) {
        showToast(err.message || 'Sign in failed', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Transport Ledger';
      }
    });

    // Register Form Submit
    document.getElementById('form-auth-register')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const businessName = document.getElementById('reg-biz-name').value.trim();
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const captchaAnswer = document.getElementById('modal-reg-captcha-input')?.value.trim();

      if (!captchaAnswer || captchaAnswer.length < 4) {
        showToast('Please enter the 5-character Anti-Bot security code', 'error');
        return;
      }

      const submitBtn = document.getElementById('btn-submit-register');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enrolling Account...';

      try {
        await registerUser({
          businessName,
          name,
          email,
          password,
          captchaToken: currentCaptcha.token,
          captchaAnswer
        });
        window.closeModal();
        showToast(`Account successfully enrolled! Welcome ${name}`, 'success');
      } catch (err) {
        showToast(err.message || 'Registration failed', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enroll & Create Safe Ledger';
        // Refresh captcha on failure
        document.getElementById('btn-modal-refresh-captcha')?.click();
      }
    });
  }

  renderAuthModalContent();
}

window.openAuthModal = openAuthModal;

// 10. USER PROFILE & CLOUD ACCOUNT MODAL
function openProfileModal() {
  const user = getCurrentUser();
  const s = state.settings;

  const modalHtml = `
    <div class="modal-card" style="max-width: 480px;">
      <div class="modal-header">
        <div>
          <h3 style="margin:0;">User Account &amp; Cloud Security</h3>
          <p style="margin:2px 0 0; font-size:0.8rem; color:var(--slate-500);">MongoDB Atlas isolated cloud profile</p>
        </div>
        <button class="btn-close-modal" onclick="window.closeModal()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="modal-body">
        <div style="display:flex; flex-direction:column; gap:16px;">
          
          <div style="display:flex; align-items:center; gap:14px; background:var(--slate-50); border:1px solid var(--slate-200); padding:16px; border-radius:var(--radius-md);">
            <div style="width:52px; height:52px; border-radius:50%; background:#047857; color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:800;">
              ${user ? user.name.substring(0, 2).toUpperCase() : 'TL'}
            </div>
            <div>
              <div style="font-size:1.1rem; font-weight:800; color:var(--slate-900);">${user ? escapeHtml(user.name) : 'Demo Business'}</div>
              <div style="font-size:0.85rem; color:var(--slate-600); margin-top:2px;">${user ? escapeHtml(user.email) : escapeHtml(s.email || '')}</div>
              <div style="margin-top:6px;">
                <span class="auth-badge-pill" style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;">
                  🔒 Safe &amp; Isolated Cloud Storage
                </span>
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.85rem;">
            <div style="background:var(--slate-50); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--slate-200);">
              <span style="font-size:0.72rem; color:var(--slate-500);">Business Profile:</span>
              <div style="font-weight:700;">${escapeHtml(user?.businessName || s.businessName || 'Transport Co.')}</div>
            </div>
            <div style="background:var(--slate-50); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--slate-200);">
              <span style="font-size:0.72rem; color:var(--slate-500);">Cloud Database:</span>
              <div style="font-weight:700; color:#047857;">MongoDB Atlas Active</div>
            </div>
          </div>

          <div style="border-top:1px solid var(--slate-200); padding-top:14px; display:flex; flex-direction:column; gap:10px;">
            <button id="btn-profile-send-backup" class="btn btn-primary" style="justify-content:center; gap:8px;">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Send Current Backup to My Mail ID
            </button>

            <button id="btn-profile-logout" class="btn btn-outline" style="justify-content:center; color:#dc2626; border-color:#fca5a5;">
              Sign Out / Switch Account
            </button>
          </div>

        </div>
      </div>
    </div>
  `;

  const modalBackdrop = document.getElementById('modal-backdrop');
  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');

  document.getElementById('btn-profile-send-backup')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-profile-send-backup');
    btn.disabled = true;
    btn.textContent = 'Securing & Sending...';
    try {
      const email = user ? user.email : s.email;
      await sendBackupToEmail(email);
      showToast(`Backup sent to ${email}`, 'success');
      window.closeModal();
    } catch (err) {
      showToast(err.message || 'Failed to dispatch backup', 'error');
      btn.disabled = false;
      btn.textContent = 'Send Current Backup to My Mail ID';
    }
  });

  document.getElementById('btn-profile-logout')?.addEventListener('click', async () => {
    await logoutUser();
    window.closeModal();
    showToast('Signed out successfully', 'info');
  });
}

window.openProfileModal = openProfileModal;

/* ==========================================================================
   10. DEDICATED LOGIN / CLOUD ACCOUNT VIEW
   ========================================================================== */

let currentViewCaptcha = null;

function renderLoginView() {
  const user = getCurrentUser();
  const s = state.settings;

  if (user) {
    return `
      <div class="login-view-wrapper">
        <div class="login-view-card">
          <div style="text-align:center; margin-bottom:24px;">
            <div style="width:68px; height:68px; border-radius:50%; background:linear-gradient(135deg, #059669, #047857); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:1.6rem; font-weight:800; box-shadow:0 4px 12px rgba(5, 150, 105, 0.25); margin-bottom:12px; overflow:hidden;">
              ${user.avatar ? `<img src="${user.avatar}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;" />` : (user.name ? user.name.substring(0, 2).toUpperCase() : 'TL')}
            </div>
            <h2 style="font-size:1.4rem; font-weight:800; margin:0 0 4px; color:var(--slate-900);">${escapeHtml(user.name || 'Fleet Operator')}</h2>
            <div style="font-size:0.88rem; color:var(--slate-600); font-weight:500;">${escapeHtml(user.email)}</div>
            <div style="margin-top:8px;">
              <span class="auth-badge-pill" style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:0.78rem; font-weight:700;">
                🔒 Isolated Cloud Ledger Active
              </span>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:22px;">
            <div style="background:var(--slate-50); border:1px solid var(--slate-200); border-radius:var(--radius-md); padding:12px 14px;">
              <span style="font-size:0.75rem; color:var(--slate-500); font-weight:600; text-transform:uppercase;">Business Profile</span>
              <div style="font-size:0.95rem; font-weight:700; color:var(--slate-800); margin-top:2px;">${escapeHtml(user.businessName || s.businessName || 'Transport Co.')}</div>
            </div>
            <div style="background:var(--slate-50); border:1px solid var(--slate-200); border-radius:var(--radius-md); padding:12px 14px;">
              <span style="font-size:0.75rem; color:var(--slate-500); font-weight:600; text-transform:uppercase;">Cloud Storage</span>
              <div style="font-size:0.95rem; font-weight:700; color:#059669; margin-top:2px;">MongoDB Atlas Synced</div>
            </div>
            <div style="background:var(--slate-50); border:1px solid var(--slate-200); border-radius:var(--radius-md); padding:12px 14px;">
              <span style="font-size:0.75rem; color:var(--slate-500); font-weight:600; text-transform:uppercase;">Trips Recorded</span>
              <div style="font-size:1.15rem; font-weight:800; color:var(--slate-800); margin-top:2px;">${state.trips.length}</div>
            </div>
            <div style="background:var(--slate-50); border:1px solid var(--slate-200); border-radius:var(--radius-md); padding:12px 14px;">
              <span style="font-size:0.75rem; color:var(--slate-500); font-weight:600; text-transform:uppercase;">Vehicles &amp; Parties</span>
              <div style="font-size:1.15rem; font-weight:800; color:var(--slate-800); margin-top:2px;">${state.vehicles.length + state.customers.length}</div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px;">
            <button id="btn-login-view-send-backup" class="btn btn-primary" style="justify-content:center; padding:12px; gap:8px;">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Send Current Backup to My Mail ID
            </button>

            <button onclick="window.switchTab('trips')" class="btn btn-secondary" style="justify-content:center; padding:11px;">
              Go to Trip Register &amp; Accounts
            </button>

            <button id="btn-login-view-logout" class="btn btn-outline" style="justify-content:center; color:#dc2626; border-color:#fca5a5; padding:10px; margin-top:4px;">
              Sign Out / Switch Account
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Generate initial client captcha synchronously so view renders immediately
  currentViewCaptcha = generateClientCaptcha();

  return `
    <div class="login-view-wrapper">
      <div class="login-view-card">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-bottom: 10px; box-shadow: 0 4px 10px rgba(5, 150, 105, 0.25);">
            🚚
          </div>
          <h2 style="font-size: 1.35rem; font-weight: 800; margin: 0 0 6px; color: var(--slate-900);">Transport Cloud Access</h2>
          <p style="font-size: 0.85rem; color: var(--slate-500); margin: 0; line-height: 1.4;">
            Sign in to isolate and secure your transport business ledger in MongoDB Atlas cloud storage.
          </p>
        </div>

        <!-- Tab Switcher -->
        <div class="auth-tabs" style="margin-bottom: 16px;">
          <button type="button" class="auth-tab active" id="tab-login-view-signin">
            Email ID Sign In
          </button>
          <button type="button" class="auth-tab" id="tab-login-view-signup">
            New User Enroll
          </button>
        </div>

        <!-- Google Login & 1-Click Fast Track -->
        <div style="margin-bottom: 16px;">
          <button type="button" class="btn-google" id="btn-view-google-login" style="margin-bottom: 10px;">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <button type="button" id="btn-view-quick-demo" class="btn btn-outline btn-sm btn-block" style="justify-content: center; gap: 6px; font-weight: 700; color: #047857; border-color: #a7f3d0; background: #ecfdf5;">
            ⚡ 1-Click Access: Sanjay Logistics (Cloud)
          </button>

          <div class="auth-divider"><span>or with email credentials</span></div>
        </div>

        <!-- Dynamic Feedback Alert -->
        <div id="login-view-feedback" class="auth-form-feedback"></div>

        <!-- 1. SIGN IN SECTION -->
        <div id="section-view-signin">
          <form id="form-view-login">
            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label">Email ID Address</label>
              <input type="email" id="view-login-email" class="form-input" placeholder="transport@gmail.com" required autocomplete="email" />
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <label class="form-label" style="margin:0;">Password</label>
                <button type="button" id="btn-toggle-view-pwd" style="background:none; border:none; font-size:0.75rem; color:var(--primary-600); cursor:pointer; font-weight:600;">Show</button>
              </div>
              <input type="password" id="view-login-password" class="form-input" style="margin-top:6px;" placeholder="••••••••" required autocomplete="current-password" />
            </div>

            <button type="submit" id="btn-submit-view-login" class="btn btn-primary btn-block" style="padding: 12px; font-weight: 700;">
              Sign In to Transport Ledger
            </button>

            <div style="text-align: center; margin-top: 14px; font-size: 0.85rem; color: var(--slate-600);">
              Don't have an account yet? <a href="#" id="link-view-goto-signup" style="color: var(--primary-700); font-weight: 700; text-decoration: none;">Enroll New Account</a>
            </div>
          </form>
        </div>

        <!-- 2. REGISTRATION SECTION WITH ANTI-BOT CAPTCHA -->
        <div id="section-view-signup" style="display: none;">
          <form id="form-view-register">
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Transport Business Name</label>
              <input type="text" id="view-reg-biz" class="form-input" placeholder="e.g. Jai Hanuman Transport Co." required />
            </div>

            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Owner / Operator Name</label>
              <input type="text" id="view-reg-name" class="form-input" placeholder="e.g. Ramesh Sharma" required />
            </div>

            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Email ID Address</label>
              <input type="email" id="view-reg-email" class="form-input" placeholder="ramesh@transport.com" required autocomplete="email" />
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label">Create Password (min. 6 characters)</label>
              <input type="password" id="view-reg-pwd" class="form-input" placeholder="••••••••" minlength="6" required autocomplete="new-password" />
            </div>

            <!-- ANTI-BOT SECURITY CAPTCHA -->
            <div class="form-group" style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" style="margin: 0; font-size: 0.82rem; font-weight: 700; color: var(--slate-800);">
                  🛡️ Anti-Bot Security Verification
                </label>
                <button type="button" class="btn-refresh-captcha" id="btn-view-refresh-captcha" title="Click to refresh code">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Refresh
                </button>
              </div>
              
              <div style="display: flex; align-items: center; gap: 10px; background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: var(--radius-md); padding: 8px 12px;">
                <div id="view-captcha-image-wrapper" style="min-width: 160px; height: 48px; display: flex; align-items: center; justify-content: center; background: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1;">
                  ${currentViewCaptcha.rawSvg || (currentViewCaptcha.svg ? `<img src="${currentViewCaptcha.svg}" alt="Code" style="height:48px;" />` : '')}
                </div>
                <div style="flex: 1;">
                  <input type="text" id="view-reg-captcha-input" class="form-input" placeholder="Code" maxlength="5" style="text-transform: uppercase; letter-spacing: 3px; font-weight: 800; text-align: center; font-size: 1.1rem; padding: 10px 8px; height: 48px;" required autocomplete="off" />
                </div>
              </div>
              <div id="view-captcha-hint" style="font-size: 0.75rem; color: var(--slate-500); margin-top: 4px;">
                Enter the 5 characters shown above (case-insensitive)
              </div>
            </div>

            <button type="submit" id="btn-submit-view-register" class="btn btn-primary btn-block" style="padding: 12px; font-weight: 700;">
              Enroll &amp; Create Safe Ledger
            </button>

            <div style="text-align: center; margin-top: 14px; font-size: 0.85rem; color: var(--slate-600);">
              Already enrolled? <a href="#" id="link-view-goto-signin" style="color: var(--primary-700); font-weight: 700; text-decoration: none;">Sign In to Account</a>
            </div>
          </form>
        </div>

        <div style="margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--slate-200); text-align: center; font-size: 0.75rem; color: var(--slate-500); display: flex; align-items: center; justify-content: center; gap: 6px;">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#059669"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          <span>256-bit PBKDF2 Encryption • Multi-Tenant Isolated Cloud Partition</span>
        </div>
      </div>
    </div>
  `;
}

function attachLoginEvents() {
  const user = getCurrentUser();

  if (user) {
    document.getElementById('btn-login-view-send-backup')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-login-view-send-backup');
      btn.disabled = true;
      btn.textContent = 'Securing & Sending...';
      try {
        await sendBackupToEmail(user.email);
        showToast(`Full backup snapshot sent to ${user.email}`, 'success');
      } catch (err) {
        showToast(err.message || 'Failed to dispatch backup', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send Current Backup to My Mail ID';
      }
    });

    document.getElementById('btn-login-view-logout')?.addEventListener('click', async () => {
      await logoutUser();
      showToast('Signed out successfully', 'info');
      switchTab('login');
    });

    return;
  }

  // Not logged in - Google Login & 1-Click Demo
  document.getElementById('btn-view-google-login')?.addEventListener('click', () => {
    openGoogleAuthModal();
  });

  document.getElementById('btn-view-quick-demo')?.addEventListener('click', async () => {
    try {
      showToast('Entering cloud ledger as Sanjay...', 'info');
      await loginWithGoogle({
        email: 'es3300735@gmail.com',
        name: 'Sanjay Elumalai',
        businessName: 'Sanjay Transport Logistics'
      });
      showToast('Signed in successfully! Welcome Sanjay.', 'success');
      switchTab('dashboard');
    } catch (e) {
      showToast(e.message || 'Quick login failed', 'error');
    }
  });

  // Tab switching
  const tabSignin = document.getElementById('tab-login-view-signin');
  const tabSignup = document.getElementById('tab-login-view-signup');
  const secSignin = document.getElementById('section-view-signin');
  const secSignup = document.getElementById('section-view-signup');
  const feedback = document.getElementById('login-view-feedback');

  const setTab = (tab) => {
    if (feedback) feedback.style.display = 'none';
    if (tab === 'signin') {
      tabSignin?.classList.add('active');
      tabSignup?.classList.remove('active');
      if (secSignin) secSignin.style.display = 'block';
      if (secSignup) secSignup.style.display = 'none';
    } else {
      tabSignup?.classList.add('active');
      tabSignin?.classList.remove('active');
      if (secSignin) secSignin.style.display = 'none';
      if (secSignup) secSignup.style.display = 'block';
    }
  };

  tabSignin?.addEventListener('click', () => setTab('signin'));
  tabSignup?.addEventListener('click', () => setTab('signup'));
  document.getElementById('link-view-goto-signup')?.addEventListener('click', (e) => {
    e.preventDefault();
    setTab('signup');
  });
  document.getElementById('link-view-goto-signin')?.addEventListener('click', (e) => {
    e.preventDefault();
    setTab('signin');
  });

  // Refresh CAPTCHA button
  document.getElementById('btn-view-refresh-captcha')?.addEventListener('click', async () => {
    currentViewCaptcha = generateClientCaptcha();
    const wrapper = document.getElementById('view-captcha-image-wrapper');
    if (wrapper) wrapper.innerHTML = currentViewCaptcha.rawSvg || `<img src="${currentViewCaptcha.svg}" alt="Code" style="height:48px;" />`;
    const input = document.getElementById('view-reg-captcha-input');
    if (input) {
      input.value = '';
      input.style.borderColor = '';
    }
    const hint = document.getElementById('view-captcha-hint');
    if (hint) hint.innerHTML = 'Enter the 5 characters shown above (case-insensitive)';

    try {
      const srv = await fetchCaptcha();
      if (srv && (srv.rawSvg || srv.svg)) {
        currentViewCaptcha = srv;
        if (wrapper) wrapper.innerHTML = srv.rawSvg || `<img src="${srv.svg}" alt="Code" style="height:48px;" />`;
      }
    } catch (err) {}
  });

  // Captcha typing live assistance
  const viewCaptchaInput = document.getElementById('view-reg-captcha-input');
  if (viewCaptchaInput) {
    viewCaptchaInput.addEventListener('input', (e) => {
      const val = e.target.value.trim().toUpperCase();
      const hint = document.getElementById('view-captcha-hint');
      if (val.length === 5) {
        if (currentViewCaptcha.code && val === currentViewCaptcha.code.toUpperCase()) {
          viewCaptchaInput.style.borderColor = '#059669';
          if (hint) hint.innerHTML = '<span style="color:#059669; font-weight:700;">✓ Security code verified</span>';
        } else {
          viewCaptchaInput.style.borderColor = '#e2e8f0';
        }
      }
    });
  }

  // Password visibility toggle
  const toggleBtn = document.getElementById('btn-toggle-view-pwd');
  const pwdInput = document.getElementById('view-login-password');
  if (toggleBtn && pwdInput) {
    toggleBtn.addEventListener('click', () => {
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        toggleBtn.textContent = 'Hide';
      } else {
        pwdInput.type = 'password';
        toggleBtn.textContent = 'Show';
      }
    });
  }

  // Sign In Form Submit
  document.getElementById('form-view-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('view-login-email').value.trim();
    const password = document.getElementById('view-login-password').value;
    const submitBtn = document.getElementById('btn-submit-view-login');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying credentials...';
    if (feedback) { feedback.style.display = 'none'; feedback.className = 'auth-form-feedback'; }

    try {
      await loginUser(email, password);
      showToast(`Signed in successfully as ${email}`, 'success');
      switchTab('dashboard');
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In to Transport Ledger';
      if (feedback) {
        feedback.className = 'auth-form-feedback error';
        feedback.textContent = err.message || 'Invalid Email ID or Password';
        feedback.style.display = 'block';
      }
      showToast(err.message || 'Sign in failed', 'error');
    }
  });

  // Register Form Submit with CAPTCHA validation
  document.getElementById('form-view-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const businessName = document.getElementById('view-reg-biz').value.trim();
    const name = document.getElementById('view-reg-name').value.trim();
    const email = document.getElementById('view-reg-email').value.trim();
    const password = document.getElementById('view-reg-pwd').value;
    const captchaAnswer = document.getElementById('view-reg-captcha-input')?.value.trim();

    if (!captchaAnswer || captchaAnswer.length < 4) {
      if (feedback) {
        feedback.className = 'auth-form-feedback error';
        feedback.textContent = 'Please enter the 5-character Anti-Bot security code';
        feedback.style.display = 'block';
      }
      showToast('Please enter the 5-character Anti-Bot security code', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-view-register');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enrolling Account...';
    if (feedback) { feedback.style.display = 'none'; feedback.className = 'auth-form-feedback'; }

    try {
      await registerUser({
        businessName,
        name,
        email,
        password,
        captchaToken: currentViewCaptcha.token,
        captchaAnswer
      });
      showToast(`Account successfully enrolled! Welcome ${name}`, 'success');
      switchTab('dashboard');
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enroll & Create Safe Ledger';
      if (feedback) {
        feedback.className = 'auth-form-feedback error';
        feedback.textContent = err.message || 'Registration failed';
        feedback.style.display = 'block';
      }
      showToast(err.message || 'Registration failed', 'error');
      // Refresh captcha on failure
      document.getElementById('btn-view-refresh-captcha')?.click();
    }
  });
}

window.renderLoginView = renderLoginView;
window.attachLoginEvents = attachLoginEvents;


