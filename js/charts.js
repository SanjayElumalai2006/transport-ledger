/**
 * Custom SVG & Canvas Charting Engine for Transport Ledger
 * Renders Monthly Income Trends, Top Customers Bar Charts, and Payment Status Doughnuts.
 */

import { formatRupee } from './utils.js';

// Render Monthly Income Bar Chart
export function renderMonthlyIncomeChart(containerEl, trips, targetYear = new Date().getFullYear()) {
  if (!containerEl) return;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthData = new Array(12).fill(0);

  trips.forEach(t => {
    if (!t.date) return;
    const [year, mStr] = t.date.split('-');
    if (parseInt(year) === parseInt(targetYear)) {
      const mIdx = parseInt(mStr) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        monthData[mIdx] += (Number(t.amount) || 0);
      }
    }
  });

  const maxVal = Math.max(...monthData, 10000);
  const chartHeight = 220;
  const barWidth = 24;

  let svgHtml = `
    <div class="chart-wrapper">
      <div class="chart-header-subtitle">Monthly Collection Trend (${targetYear})</div>
      <svg viewBox="0 0 600 ${chartHeight + 40}" preserveAspectRatio="xMidYMid meet" class="svg-chart">
        <!-- Grid lines -->
        <line x1="40" y1="20" x2="580" y2="20" stroke="#e2e8f0" stroke-dasharray="4" />
        <line x1="40" y1="${chartHeight/2 + 10}" x2="580" y2="${chartHeight/2 + 10}" stroke="#e2e8f0" stroke-dasharray="4" />
        <line x1="40" y1="${chartHeight}" x2="580" y2="${chartHeight}" stroke="#cbd5e1" stroke-width="1.5" />
  `;

  const totalWidth = 540;
  const step = totalWidth / 12;

  monthData.forEach((val, i) => {
    const barH = (val / maxVal) * (chartHeight - 30);
    const x = 40 + i * step + (step - barWidth) / 2;
    const y = chartHeight - barH;

    const isCurrentMonth = i === new Date().getMonth() && parseInt(targetYear) === new Date().getFullYear();
    const fill = isCurrentMonth ? 'url(#greenGradientActive)' : 'url(#greenGradient)';

    svgHtml += `
      <defs>
        <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#047857" />
        </linearGradient>
        <linearGradient id="greenGradientActive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#22c55e" />
          <stop offset="100%" stop-color="#15803d" />
        </linearGradient>
      </defs>
      <g class="bar-group" data-month="${months[i]}" data-value="${val}">
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="5" ry="5" fill="${fill}" class="chart-bar" />
        ${val > 0 ? `<text x="${x + barWidth/2}" y="${y - 6}" font-size="10" font-weight="600" fill="#047857" text-anchor="middle">₹${Math.round(val/1000)}k</text>` : ''}
        <text x="${x + barWidth/2}" y="${chartHeight + 20}" font-size="12" font-weight="${isCurrentMonth ? '700' : '500'}" fill="${isCurrentMonth ? '#047857' : '#64748b'}" text-anchor="middle">${months[i]}</text>
      </g>
    `;
  });

  svgHtml += `</svg></div>`;
  containerEl.innerHTML = svgHtml;
}

// Render Top Customers Horizontal Progress Bar Chart
export function renderTopCustomersChart(containerEl, trips, limit = 5) {
  if (!containerEl) return;

  const customerMap = {};
  trips.forEach(t => {
    const name = t.customerName || 'Unknown';
    if (!customerMap[name]) {
      customerMap[name] = { total: 0, paid: 0, pending: 0, trips: 0 };
    }
    const amt = Number(t.amount) || 0;
    const paid = Number(t.paidAmount) || (t.status === 'Paid' ? amt : 0);
    customerMap[name].total += amt;
    customerMap[name].paid += paid;
    customerMap[name].pending += (amt - paid);
    customerMap[name].trips += 1;
  });

  const sorted = Object.entries(customerMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit);

  if (sorted.length === 0) {
    containerEl.innerHTML = `<div class="empty-state-small">No customer business data available</div>`;
    return;
  }

  const maxTotal = sorted[0][1].total || 1;

  let html = `<div class="top-customers-list">`;
  sorted.forEach(([name, data], idx) => {
    const pct = Math.round((data.total / maxTotal) * 100);
    const paidPct = Math.round((data.paid / data.total) * 100);
    
    html += `
      <div class="top-customer-item">
        <div class="cust-info-row">
          <div class="cust-name-badge">
            <span class="cust-rank">#${idx + 1}</span>
            <span class="cust-name">${escapeHtml(name)}</span>
            <span class="cust-trips-count">${data.trips} trip${data.trips > 1 ? 's' : ''}</span>
          </div>
          <div class="cust-amt-badge">
            <span class="cust-total-amt">${formatRupee(data.total)}</span>
            ${data.pending > 0 ? `<span class="cust-pending-tag">Pending: ${formatRupee(data.pending)}</span>` : ''}
          </div>
        </div>
        <div class="cust-progress-track">
          <div class="cust-progress-bar" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  containerEl.innerHTML = html;
}

// Render Payment Status Doughnut Chart
export function renderPaymentStatusChart(containerEl, trips) {
  if (!containerEl) return;

  let paidTotal = 0;
  let pendingTotal = 0;

  trips.forEach(t => {
    const amt = Number(t.amount) || 0;
    const paid = Number(t.paidAmount) || (t.status === 'Paid' ? amt : 0);
    paidTotal += paid;
    pendingTotal += (amt - paid);
  });

  const total = paidTotal + pendingTotal;
  if (total === 0) {
    containerEl.innerHTML = `<div class="empty-state-small">No payment data recorded</div>`;
    return;
  }

  const paidPct = Math.round((paidTotal / total) * 100);
  const pendingPct = 100 - paidPct;

  // Render Doughnut SVG
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const paidOffset = circumference * (1 - paidPct / 100);

  const html = `
    <div class="doughnut-chart-container">
      <div class="doughnut-svg-wrapper">
        <svg viewBox="0 0 160 160" width="140" height="140">
          <circle cx="80" cy="80" r="${radius}" fill="transparent" stroke="#f97316" stroke-width="22" />
          <circle cx="80" cy="80" r="${radius}" fill="transparent" stroke="#10b981" stroke-width="22"
            stroke-dasharray="${circumference}" stroke-dashoffset="${paidOffset}"
            transform="rotate(-90 80 80)" style="transition: stroke-dashoffset 0.8s ease;" />
          <text x="80" y="74" text-anchor="middle" font-size="20" font-weight="700" fill="#0f172a">${paidPct}%</text>
          <text x="80" y="94" text-anchor="middle" font-size="11" font-weight="600" fill="#64748b">RECOVERED</text>
        </svg>
      </div>
      <div class="doughnut-legend">
        <div class="legend-item">
          <span class="legend-dot dot-paid"></span>
          <div class="legend-text">
            <span class="legend-label">Paid Received</span>
            <span class="legend-val text-paid">${formatRupee(paidTotal)} (${paidPct}%)</span>
          </div>
        </div>
        <div class="legend-item">
          <span class="legend-dot dot-pending"></span>
          <div class="legend-text">
            <span class="legend-label">Pending Collection</span>
            <span class="legend-val text-pending">${formatRupee(pendingTotal)} (${pendingPct}%)</span>
          </div>
        </div>
      </div>
    </div>
  `;

  containerEl.innerHTML = html;
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
