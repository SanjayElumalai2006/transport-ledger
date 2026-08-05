/**
 * Main Application Logic & Event Controller for Transport Ledger
 * Integrated with WhatsApp Reminders, Trip Expense Tracker, and Printable LR/Invoice Receipts.
 */

import { initStorage, getTrips, saveTrip, updateTrip, deleteTrip, getCustomers, saveCustomer, updateCustomer, deleteCustomer, getSettings, saveSettings, exportBackupJSON, importBackupJSON, resetToSampleData } from './storage.js';
import { formatRupee, formatDate, formatDateInput, getTodayString, exportTripsToCSV, exportCustomerLedgerToCSV, generateWhatsAppReminderLink } from './utils.js';
import { renderMonthlyIncomeChart, renderTopCustomersChart, renderPaymentStatusChart } from './charts.js';

// Application State
const state = {
  currentTab: 'dashboard',
  trips: [],
  customers: [],
  settings: {},
  tripFilter: {
    search: '',
    customer: 'all',
    status: 'all',
    dateRange: 'all' // all, today, month, year
  },
  editingTripId: null,
  editingCustomerId: null,
  viewingCustomerStatement: null
};

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  loadState();
  setupNavigation();
  setupGlobalEvents();
  renderCurrentTab();
});

function loadState() {
  state.trips = getTrips();
  state.customers = getCustomers();
  state.settings = getSettings();
  updateHeaderInfo();
}

function updateHeaderInfo() {
  const bizNameEls = document.querySelectorAll('.biz-name-text');
  const ownerEls = document.querySelectorAll('.biz-owner-text');
  
  bizNameEls.forEach(el => el.textContent = state.settings.businessName || 'Transport Ledger');
  ownerEls.forEach(el => el.textContent = state.settings.ownerName || 'Owner');
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

function switchTab(tabName) {
  state.currentTab = tabName;

  // Update Nav Active States
  document.querySelectorAll('[data-tab]').forEach(el => {
    if (el.getAttribute('data-tab') === tabName) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Update Page Title
  const titleEl = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');

  const titles = {
    dashboard: { title: 'Dashboard', subtitle: 'Overview of daily trips, collections & customer business' },
    trips: { title: 'Trip Register', subtitle: 'All transport trips, route details, and payment statuses' },
    customers: { title: 'Customer Directory', subtitle: 'Manage customer accounts, total business & pending dues' },
    reports: { title: 'Financial Reports', subtitle: 'Daily, Monthly, Yearly income analytics & visual charts' },
    settings: { title: 'Business Settings', subtitle: 'Business profile details, backup & data management' }
  };

  if (titles[tabName]) {
    if (titleEl) titleEl.textContent = titles[tabName].title;
    if (subtitleEl) subtitleEl.textContent = titles[tabName].subtitle;
  }

  renderCurrentTab();
}

function renderCurrentTab() {
  const viewContainer = document.getElementById('view-container');
  if (!viewContainer) return;

  switch (state.currentTab) {
    case 'dashboard':
      viewContainer.innerHTML = renderDashboardView();
      initDashboardCharts();
      break;
    case 'trips':
      viewContainer.innerHTML = renderTripsView();
      attachTripEvents();
      break;
    case 'customers':
      viewContainer.innerHTML = renderCustomersView();
      attachCustomerEvents();
      break;
    case 'reports':
      viewContainer.innerHTML = renderReportsView();
      initReportCharts();
      break;
    case 'settings':
      viewContainer.innerHTML = renderSettingsView();
      attachSettingsEvents();
      break;
    default:
      viewContainer.innerHTML = renderDashboardView();
      initDashboardCharts();
  }
}

/* ==========================================================================
   1. DASHBOARD VIEW
   ========================================================================== */
function renderDashboardView() {
  const todayStr = getTodayString();
  const currentMonthStr = todayStr.substring(0, 7);
  const currentYearStr = todayStr.substring(0, 4);

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

  const recentTrips = [...state.trips].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return `
    <!-- Top Metric Cards -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Today's Collection</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
        <div class="metric-value">${formatRupee(todayAmt)}</div>
        <div class="metric-sub">${todayTrips} trip${todayTrips !== 1 ? 's' : ''} recorded today</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">This Month Net Profit</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
        </div>
        <div class="metric-value" style="color: #047857;">${formatRupee(monthProfit)}</div>
        <div class="metric-sub">Gross: ${formatRupee(monthAmt)} • Exp: ${formatRupee(monthExpenses)}</div>
      </div>

      <div class="metric-card card-blue">
        <div class="metric-header">
          <span class="metric-title">This Year Income</span>
          <div class="metric-icon-box">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
        </div>
        <div class="metric-value">${formatRupee(yearAmt)}</div>
        <div class="metric-sub">${yearTrips} trip${yearTrips !== 1 ? 's' : ''} in ${currentYearStr}</div>
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

    <!-- Quick Action Banner -->
    <div class="quick-action-banner">
      <div class="qa-text">
        <h3>Record Transport Trips & Expenses</h3>
        <p>Keep track of routes, diesel costs, driver salary, Lorry Receipts, and WhatsApp payment reminders.</p>
      </div>
      <div class="qa-buttons">
        <button class="btn btn-orange action-add-trip">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Add New Trip
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

  // Filter totals
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
        <input type="text" id="trip-search-input" placeholder="Search by customer, vehicle number, or location..." value="${escapeHtml(state.tripFilter.search)}" />
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

    <!-- Filter Summary Pill Bar -->
    <div style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; background: #ffffff; padding: 14px 20px; border-radius: var(--radius-md); border: 1px solid var(--slate-200);">
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
            <th>Date</th>
            <th>Customer</th>
            <th>Route</th>
            <th>Vehicle No</th>
            <th>Freight & Expenses</th>
            <th>Payment Status</th>
            <th>Notes / Goods</th>
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
          No matching trips found. Try clearing search filters or add a new trip.
        </td>
      </tr>
    `;
  }

  return trips.map(t => {
    const cust = state.customers.find(c => c.name.toLowerCase() === t.customerName.toLowerCase());
    const phone = cust ? cust.phone : '';
    const pending = t.amount - (t.paidAmount || (t.status === 'Paid' ? t.amount : 0));
    const totalExp = (Number(t.fuelCost) || 0) + (Number(t.driverCost) || 0) + (Number(t.tollCost) || 0) + (Number(t.otherExpense) || 0);

    const waUrl = pending > 0 ? generateWhatsAppReminderLink(phone, t.customerName, pending, t, state.settings.businessName) : null;

    return `
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
        <td>
          <div><strong>${formatRupee(t.amount)}</strong></div>
          ${totalExp > 0 ? `<div style="font-size:0.75rem; color:#64748b;">Exp: ${formatRupee(totalExp)} (Profit: ${formatRupee(t.amount - totalExp)})</div>` : ''}
        </td>
        <td><span class="badge-status badge-${t.status.toLowerCase()}">${t.status}</span></td>
        <td style="max-width: 200px; font-size: 0.82rem; color: var(--slate-600);">${escapeHtml(t.notes || '-')}</td>
        <td style="text-align: right; white-space: nowrap;">
          ${waUrl ? `<a href="${waUrl}" target="_blank" class="btn btn-whatsapp btn-sm" style="margin-right: 4px; padding: 5px 8px;" title="Send WhatsApp Payment Reminder">WA</a>` : ''}
          <button class="btn btn-secondary btn-sm btn-print-lr" data-id="${t.id}" style="margin-right: 4px;">Receipt</button>
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
    // Search query
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const matchCust = t.customerName.toLowerCase().includes(q);
      const matchVeh = t.vehicleNumber.toLowerCase().includes(q);
      const matchRoute = `${t.fromLocation} ${t.toLocation}`.toLowerCase().includes(q);
      const matchNotes = (t.notes || '').toLowerCase().includes(q);
      if (!matchCust && !matchVeh && !matchRoute && !matchNotes) return false;
    }

    // Customer
    if (filter.customer !== 'all' && t.customerName !== filter.customer) {
      return false;
    }

    // Status
    if (filter.status !== 'all' && t.status !== filter.status) {
      return false;
    }

    // Date Range
    if (filter.dateRange === 'today' && t.date !== todayStr) {
      return false;
    }
    if (filter.dateRange === 'month' && (!t.date || !t.date.startsWith(currentMonthStr))) {
      return false;
    }
    if (filter.dateRange === 'year' && (!t.date || !t.date.startsWith(currentYearStr))) {
      return false;
    }

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
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this trip record?')) {
        deleteTrip(id);
        loadState();
        renderCurrentTab();
        showToast('Trip record deleted', 'success');
      }
    });
  });
}

/* ==========================================================================
   3. CUSTOMERS VIEW
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
    const waUrl = pendingAmt > 0 ? generateWhatsAppReminderLink(c.phone, c.name, pendingAmt, null, state.settings.businessName) : null;

    return {
      ...c,
      tripCount: cTrips.length,
      totalBusiness,
      paidAmt,
      pendingAmt,
      waUrl
    };
  });

  // Sort customers by total business volume descending
  customerStats.sort((a, b) => b.totalBusiness - a.totalBusiness);

  const cards = customerStats.map(c => `
    <div class="section-card" style="display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--slate-900);">${escapeHtml(c.name)}</h3>
            <p style="font-size: 0.8rem; color: var(--slate-500);">${escapeHtml(c.city || 'City not set')} • ${escapeHtml(c.phone || 'No phone')}</p>
          </div>
          <span class="badge-status" style="background: var(--slate-100); color: var(--slate-700);">${c.tripCount} trip${c.tripCount !== 1 ? 's' : ''}</span>
        </div>

        ${c.gstin ? `<div style="font-size: 0.76rem; font-family: monospace; color: var(--slate-500); margin-bottom: 16px;">GSTIN: ${escapeHtml(c.gstin)}</div>` : ''}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--primary-50); padding: 14px; border-radius: var(--radius-md); margin-bottom: 20px;">
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
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${c.waUrl ? `<a href="${c.waUrl}" target="_blank" class="btn btn-whatsapp btn-sm" style="flex: 1; text-align:center;">WhatsApp Reminder</a>` : ''}
        <button class="btn btn-secondary btn-sm btn-view-statement" data-name="${escapeHtml(c.name)}" style="flex: 1;">Statement</button>
        <button class="btn btn-outline btn-sm btn-edit-customer" data-id="${c.id}">Edit</button>
      </div>
    </div>
  `).join('');

  return `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
      <div>
        <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--slate-900);">Customer Accounts (${state.customers.length})</h3>
        <p style="font-size: 0.82rem; color: var(--slate-500);">Individual customer ledgers & pending dues</p>
      </div>
      <button id="btn-add-customer-modal" class="btn btn-primary">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        Add New Customer
      </button>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
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
   4. REPORTS VIEW
   ========================================================================== */
function renderReportsView() {
  const todayStr = getTodayString();
  const currentMonthStr = todayStr.substring(0, 7);

  return `
    <!-- Reports Navigation Banner -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 28px;">
      <div class="section-card">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary-700); text-transform: uppercase;">Daily Report</div>
        <div style="font-size: 1.4rem; font-weight: 800; margin: 6px 0;">Today's Income</div>
        <div style="font-size: 0.85rem; color: var(--slate-500); margin-bottom: 14px;">Selected date analytics & trip logs</div>
        <input type="date" id="report-daily-date" class="form-input" value="${todayStr}" />
      </div>

      <div class="section-card">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary-700); text-transform: uppercase;">Monthly Report</div>
        <div style="font-size: 1.4rem; font-weight: 800; margin: 6px 0;">Monthly Collection</div>
        <div style="font-size: 0.85rem; color: var(--slate-500); margin-bottom: 14px;">Full monthly breakdown & charts</div>
        <input type="month" id="report-monthly-date" class="form-input" value="${currentMonthStr}" />
      </div>

      <div class="section-card">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary-700); text-transform: uppercase;">Yearly Report</div>
        <div style="font-size: 1.4rem; font-weight: 800; margin: 6px 0;">Annual Freight Business</div>
        <div style="font-size: 0.85rem; color: var(--slate-500); margin-bottom: 14px;">Yearly growth & collection trends</div>
        <select id="report-yearly-date" class="form-select">
          <option value="2026" selected>2026</option>
          <option value="2025">2025</option>
        </select>
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
  `;
}

function initReportCharts() {
  setTimeout(() => {
    renderMonthlyIncomeChart(document.getElementById('report-monthly-chart'), state.trips);
    renderPaymentStatusChart(document.getElementById('report-payment-chart'), state.trips);
  }, 50);
}

/* ==========================================================================
   5. SETTINGS VIEW
   ========================================================================== */
function renderSettingsView() {
  const s = state.settings;
  return `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      <!-- Business Details Form -->
      <div class="section-card">
        <div class="section-card-header">
          <div class="section-title-group">
            <h3>Business Details</h3>
            <p>Update company name, phone, and GSTIN</p>
          </div>
        </div>

        <form id="settings-form" class="form-grid">
          <div class="form-group form-group-full">
            <label class="form-label">Business Name</label>
            <input type="text" id="set-biz-name" class="form-input" value="${escapeHtml(s.businessName || '')}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Owner Name</label>
            <input type="text" id="set-owner-name" class="form-input" value="${escapeHtml(s.ownerName || '')}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Mobile Number</label>
            <input type="text" id="set-phone" class="form-input" value="${escapeHtml(s.phone || '')}" />
          </div>

          <div class="form-group">
            <label class="form-label">City / Location</label>
            <input type="text" id="set-city" class="form-input" value="${escapeHtml(s.city || '')}" />
          </div>

          <div class="form-group">
            <label class="form-label">GSTIN Number (Optional)</label>
            <input type="text" id="set-gstin" class="form-input" value="${escapeHtml(s.gstin || '')}" />
          </div>

          <div class="form-group-full" style="margin-top: 10px;">
            <button type="submit" class="btn btn-primary">Save Business Details</button>
          </div>
        </form>
      </div>

      <!-- Backup & Restore -->
      <div class="section-card">
        <div class="section-card-header">
          <div class="section-title-group">
            <h3>Data Management</h3>
            <p>Backup, restore, or reset sample data</p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="background: var(--slate-50); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--slate-200);">
            <h4 style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px;">Download Data Backup (JSON)</h4>
            <p style="font-size: 0.8rem; color: var(--slate-500); margin-bottom: 12px;">Save a copy of all trips, customers, and settings to your computer.</p>
            <button id="btn-export-json" class="btn btn-secondary btn-sm">Download Backup</button>
          </div>

          <div style="background: var(--slate-50); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--slate-200);">
            <h4 style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px;">Restore Data Backup</h4>
            <p style="font-size: 0.8rem; color: var(--slate-500); margin-bottom: 12px;">Upload a previously saved JSON backup file.</p>
            <input type="file" id="input-import-json" accept=".json" style="display: none;" />
            <button id="btn-import-json" class="btn btn-secondary btn-sm">Choose Backup File</button>
          </div>

          <div style="background: #fff1f2; padding: 16px; border-radius: var(--radius-md); border: 1px solid #fecdd3; margin-top: 10px;">
            <h4 style="font-weight: 700; font-size: 0.95rem; color: #991b1b; margin-bottom: 4px;">Reset Sample Data</h4>
            <p style="font-size: 0.8rem; color: #9f1239; margin-bottom: 12px;">Restore default 5 customers and 12 sample trips.</p>
            <button id="btn-reset-data" class="btn btn-secondary btn-sm" style="color: #991b1b; border-color: #fca5a5;">Reset to Sample Data</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function attachSettingsEvents() {
  const form = document.getElementById('settings-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveSettings({
        businessName: document.getElementById('set-biz-name').value,
        ownerName: document.getElementById('set-owner-name').value,
        phone: document.getElementById('set-phone').value,
        city: document.getElementById('set-city').value,
        gstin: document.getElementById('set-gstin').value
      });
      loadState();
      showToast('Business details updated successfully!', 'success');
    });
  }

  const exportBtn = document.getElementById('btn-export-json');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const json = exportBackupJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Transport_Ledger_Backup_${getTodayString()}.json`;
      a.click();
      showToast('Backup downloaded!', 'success');
    });
  }

  const importBtn = document.getElementById('btn-import-json');
  const importInput = document.getElementById('input-import-json');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const success = importBackupJSON(evt.target.result);
        if (success) {
          loadState();
          renderCurrentTab();
          showToast('Data restored successfully!', 'success');
        } else {
          alert('Invalid backup JSON file.');
        }
      };
      reader.readAsText(file);
    });
  }

  const resetBtn = document.getElementById('btn-reset-data');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset data back to default sample data?')) {
        resetToSampleData();
        loadState();
        renderCurrentTab();
        showToast('Reset to sample data completed', 'success');
      }
    });
  }
}

/* ==========================================================================
   MODAL CONTROLLERS & EVENT HANDLERS
   ========================================================================== */
function setupGlobalEvents() {
  window.switchTab = switchTab;

  // Backdrop overlay click to close
  const modalBackdrop = document.getElementById('modal-backdrop');
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }
}

function closeModal() {
  const modalBackdrop = document.getElementById('modal-backdrop');
  if (modalBackdrop) {
    modalBackdrop.classList.remove('open');
  }
}

// OPEN ADD/EDIT TRIP MODAL WITH EXPENSE TRACKER
function openTripModal(tripId = null) {
  state.editingTripId = tripId;
  const existing = tripId ? state.trips.find(t => t.id === tripId) : null;

  const customerOptions = state.customers.map(c => 
    `<option value="${escapeHtml(c.name)}" ${existing && existing.customerName === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('');

  const modalHtml = `
    <div class="modal-card">
      <div class="modal-header">
        <h3>${existing ? 'Edit Trip & Expense Record' : 'Add New Transport Trip'}</h3>
        <button class="btn-close-modal" onclick="window.closeModal()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <form id="trip-form">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Trip Date</label>
              <input type="date" id="trip-date" class="form-input" value="${existing ? existing.date : getTodayString()}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Customer Name</label>
              <select id="trip-customer" class="form-select" required>
                <option value="">-- Select Customer --</option>
                ${customerOptions}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">From Location</label>
              <input type="text" id="trip-from" class="form-input" placeholder="e.g. Mumbai" value="${existing ? escapeHtml(existing.fromLocation) : ''}" required />
            </div>

            <div class="form-group">
              <label class="form-label">To Location</label>
              <input type="text" id="trip-to" class="form-input" placeholder="e.g. Delhi" value="${existing ? escapeHtml(existing.toLocation) : ''}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Vehicle Number</label>
              <input type="text" id="trip-vehicle" class="form-input" placeholder="e.g. MH 12 AB 1234" value="${existing ? escapeHtml(existing.vehicleNumber) : ''}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Total Freight Amount (₹)</label>
              <input type="number" id="trip-amount" class="form-input" placeholder="e.g. 45000" value="${existing ? existing.amount : ''}" min="0" required />
            </div>

            <div class="form-group">
              <label class="form-label">Payment Status</label>
              <select id="trip-status" class="form-select" required>
                <option value="Paid" ${existing && existing.status === 'Paid' ? 'selected' : ''}>Paid</option>
                <option value="Pending" ${!existing || existing.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Partial" ${existing && existing.status === 'Partial' ? 'selected' : ''}>Partial</option>
              </select>
            </div>

            <div class="form-group" id="group-paid-amount" style="display: ${existing && existing.status === 'Partial' ? 'flex' : 'none'};">
              <label class="form-label">Paid Amount (₹)</label>
              <input type="number" id="trip-paid-amount" class="form-input" placeholder="Amount paid so far" value="${existing ? existing.paidAmount : 0}" min="0" />
            </div>

            <!-- EXPENSE BREAKDOWN SECTION -->
            <div class="form-group-full expense-section-card">
              <div class="expense-title">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                Trip Expenses & Net Profit Breakdown
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Diesel / Fuel (₹)</label>
                  <input type="number" id="trip-fuel" class="form-input" placeholder="0" value="${existing ? existing.fuelCost || 0 : ''}" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Driver Salary / Allowance (₹)</label>
                  <input type="number" id="trip-driver" class="form-input" placeholder="0" value="${existing ? existing.driverCost || 0 : ''}" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Toll & Permit (₹)</label>
                  <input type="number" id="trip-toll" class="form-input" placeholder="0" value="${existing ? existing.tollCost || 0 : ''}" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Maintenance / Misc (₹)</label>
                  <input type="number" id="trip-other-exp" class="form-input" placeholder="0" value="${existing ? existing.otherExpense || 0 : ''}" min="0" />
                </div>
              </div>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Notes / Goods Details</label>
              <textarea id="trip-notes" class="form-textarea" rows="2" placeholder="e.g. 15 Tons Steel Pipes, Lorry Receipt #45892">${existing ? escapeHtml(existing.notes) : ''}</textarea>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-orange">${existing ? 'Update Trip' : 'Save Trip Record'}</button>
        </div>
      </form>
    </div>
  `;

  const modalBackdrop = document.getElementById('modal-backdrop');
  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');
  window.closeModal = closeModal;

  // Form Status change toggle paid amount
  const statusSelect = document.getElementById('trip-status');
  const paidGroup = document.getElementById('group-paid-amount');
  statusSelect.addEventListener('change', () => {
    paidGroup.style.display = statusSelect.value === 'Partial' ? 'flex' : 'none';
  });

  // Submit Handler
  document.getElementById('trip-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const tripData = {
      date: document.getElementById('trip-date').value,
      customerName: document.getElementById('trip-customer').value,
      fromLocation: document.getElementById('trip-from').value,
      toLocation: document.getElementById('trip-to').value,
      vehicleNumber: document.getElementById('trip-vehicle').value,
      amount: document.getElementById('trip-amount').value,
      status: document.getElementById('trip-status').value,
      paidAmount: document.getElementById('trip-paid-amount').value,
      fuelCost: document.getElementById('trip-fuel').value,
      driverCost: document.getElementById('trip-driver').value,
      tollCost: document.getElementById('trip-toll').value,
      otherExpense: document.getElementById('trip-other-exp').value,
      notes: document.getElementById('trip-notes').value
    };

    if (state.editingTripId) {
      updateTrip(state.editingTripId, tripData);
      showToast('Trip & Expense record updated!', 'success');
    } else {
      saveTrip(tripData);
      showToast('New trip recorded successfully!', 'success');
    }

    closeModal();
    loadState();
    renderCurrentTab();
  });
}

// OPEN PRINTABLE LORRY RECEIPT (LR) / INVOICE MODAL
function openPrintReceiptModal(tripId) {
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;

  const s = state.settings;
  const pending = trip.amount - (trip.paidAmount || (trip.status === 'Paid' ? trip.amount : 0));

  const modalHtml = `
    <div class="modal-card" style="max-width: 750px;">
      <div class="modal-header">
        <h3>Lorry Receipt (LR) & Invoice Bill</h3>
        <button class="btn-close-modal" onclick="window.closeModal()">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="print-invoice-wrapper">
          <div class="invoice-header">
            <div class="invoice-title-block">
              <h2>${escapeHtml(s.businessName || 'Transport Ledger')}</h2>
              <p>Fleet Owner & Transport Contractor</p>
              <p style="font-size: 0.8rem; color: #64748b;">${escapeHtml(s.city || '')} • Phone: ${escapeHtml(s.phone || '')}</p>
              ${s.gstin ? `<p style="font-size: 0.78rem; font-family: monospace;">GSTIN: ${escapeHtml(s.gstin)}</p>` : ''}
            </div>
            <div class="invoice-meta">
              <div class="invoice-lr-no">LR NO: #${trip.id.substring(trip.id.length - 6).toUpperCase()}</div>
              <p style="font-size: 0.85rem; font-weight: 600;">Date: ${formatDate(trip.date)}</p>
            </div>
          </div>

          <div class="invoice-details-grid">
            <div>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Billed To Customer</span>
              <h4 style="font-size: 1.05rem; font-weight: 700; margin-top: 4px;">${escapeHtml(trip.customerName)}</h4>
            </div>
            <div>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Route & Vehicle</span>
              <p style="font-size: 0.95rem; font-weight: 700; margin-top: 4px;">${escapeHtml(trip.fromLocation)} ➔ ${escapeHtml(trip.toLocation)}</p>
              <p style="font-size: 0.85rem; font-family: monospace;">Vehicle: ${escapeHtml(trip.vehicleNumber)}</p>
            </div>
          </div>

          <table class="data-table" style="margin-bottom: 20px;">
            <thead>
              <tr>
                <th>Description / Goods</th>
                <th style="text-align: right;">Total Amount</th>
                <th style="text-align: right;">Advance Paid</th>
                <th style="text-align: right;">Balance Due</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${escapeHtml(trip.notes || 'Freight Transport Charges')}</td>
                <td style="text-align: right;"><strong>${formatRupee(trip.amount)}</strong></td>
                <td style="text-align: right; color: #047857;">${formatRupee(trip.paidAmount || (trip.status === 'Paid' ? trip.amount : 0))}</td>
                <td style="text-align: right; color: #c2410c;"><strong>${formatRupee(pending)}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="invoice-signatures">
            <div class="sig-box">Consignor / Customer Sign</div>
            <div class="sig-box">For ${escapeHtml(s.businessName || 'Transport Co.')}</div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="window.closeModal()">Close</button>
        <button class="btn btn-primary" onclick="window.print()">Print Receipt (PDF)</button>
      </div>
    </div>
  `;

  const modalBackdrop = document.getElementById('modal-backdrop');
  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');
  window.closeModal = closeModal;
}

// OPEN ADD/EDIT CUSTOMER MODAL
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

      <form id="customer-form">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label">Customer / Company Name</label>
              <input type="text" id="cust-name" class="form-input" placeholder="e.g. Sharma Freight Carriers" value="${existing ? escapeHtml(existing.name) : ''}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Phone / Mobile</label>
              <input type="text" id="cust-phone" class="form-input" placeholder="e.g. +91 98200 12345" value="${existing ? escapeHtml(existing.phone) : ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">City / State</label>
              <input type="text" id="cust-city" class="form-input" placeholder="e.g. Mumbai, Maharashtra" value="${existing ? escapeHtml(existing.city) : ''}" />
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">GSTIN Number (Optional)</label>
              <input type="text" id="cust-gstin" class="form-input" placeholder="e.g. 27AAAAA0000A1Z5" value="${existing ? escapeHtml(existing.gstin) : ''}" />
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
  window.closeModal = closeModal;

  document.getElementById('customer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('cust-name').value,
      phone: document.getElementById('cust-phone').value,
      city: document.getElementById('cust-city').value,
      gstin: document.getElementById('cust-gstin').value
    };

    if (state.editingCustomerId) {
      updateCustomer(state.editingCustomerId, data);
      showToast('Customer updated', 'success');
    } else {
      saveCustomer(data);
      showToast('Customer account created', 'success');
    }

    closeModal();
    loadState();
    renderCurrentTab();
  });
}

// OPEN STATEMENT MODAL FOR A CUSTOMER
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
  const waUrl = pendingAmt > 0 ? generateWhatsAppReminderLink(phone, customerName, pendingAmt, null, state.settings.businessName) : null;

  const rows = customerTrips.map(t => `
    <tr>
      <td><strong>${formatDate(t.date)}</strong></td>
      <td>${escapeHtml(t.fromLocation)} -> ${escapeHtml(t.toLocation)}</td>
      <td><span class="vehicle-tag">${escapeHtml(t.vehicleNumber)}</span></td>
      <td>${escapeHtml(t.notes || '-')}</td>
      <td><strong>${formatRupee(t.amount)}</strong></td>
      <td><span class="badge-status badge-${t.status.toLowerCase()}">${t.status}</span></td>
    </tr>
  `).join('');

  const modalHtml = `
    <div class="modal-card" style="max-width: 800px;">
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
        <!-- Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; background: var(--slate-50); padding: 16px; border-radius: var(--radius-md);">
          <div>
            <span style="font-size: 0.75rem; color: var(--slate-500); text-transform: uppercase;">Total Business</span>
            <div style="font-size: 1.2rem; font-weight: 800; color: var(--slate-900);">${formatRupee(totalAmt)}</div>
          </div>
          <div>
            <span style="font-size: 0.75rem; color: var(--slate-500); text-transform: uppercase;">Total Paid</span>
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
            <tbody>${rows || '<tr><td colspan="6" style="text-align:center;">No trip history</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="modal-footer">
        ${waUrl ? `<a href="${waUrl}" target="_blank" class="btn btn-whatsapp btn-sm">WhatsApp Reminder</a>` : ''}
        <button id="btn-export-statement-csv" class="btn btn-secondary btn-sm">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export CSV Statement
        </button>
        <button type="button" class="btn btn-primary" onclick="window.closeModal()">Close</button>
      </div>
    </div>
  `;

  const modalBackdrop = document.getElementById('modal-backdrop');
  modalBackdrop.innerHTML = modalHtml;
  modalBackdrop.classList.add('open');
  window.closeModal = closeModal;

  document.getElementById('btn-export-statement-csv').addEventListener('click', () => {
    exportCustomerLedgerToCSV(customerName, state.trips);
    showToast(`Statement exported for ${customerName}`, 'success');
  });
}

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
  }, 3000);
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
