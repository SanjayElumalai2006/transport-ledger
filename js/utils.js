/**
 * Utility functions for Transport Ledger
 * Indian Currency (₹), Indian Date Format (DD/MM/YYYY), CSV Exporter,
 * Dynamic UPI QR Code generator, Document Compliance Expiry Analyzer, and LR Generator.
 */

// Format currency in Indian format (₹ X,XX,XXX)
export function formatRupee(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
}

// Format ISO date string (YYYY-MM-DD) to Indian format (DD/MM/YYYY)
export function formatDate(dateString) {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

// Format Date object to YYYY-MM-DD input format
export function formatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get Today's date string YYYY-MM-DD
export function getTodayString() {
  return formatDateInput(new Date());
}

// Get Month string YYYY-MM from YYYY-MM-DD
export function getMonthString(dateString) {
  if (!dateString) return '';
  return dateString.substring(0, 7);
}

// Get Year string YYYY from YYYY-MM-DD
export function getYearString(dateString) {
  if (!dateString) return '';
  return dateString.substring(0, 4);
}

// Check Document Expiry for Commercial Vehicles (Fitness, Insurance, Permit, PUC)
export function checkDocumentExpiry(dateString) {
  if (!dateString) {
    return { status: 'missing', badgeClass: 'badge-missing', label: 'Not Set', daysLeft: 0 };
  }

  const target = new Date(dateString);
  const now = new Date();
  // Strip hours for clean calendar day difference
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'expired',
      badgeClass: 'badge-expired',
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      daysLeft: diffDays
    };
  } else if (diffDays <= 30) {
    return {
      status: 'expiring',
      badgeClass: 'badge-expiring',
      label: `Expiring in ${diffDays}d`,
      daysLeft: diffDays
    };
  } else {
    return {
      status: 'valid',
      badgeClass: 'badge-valid',
      label: `Valid (${diffDays}d)`,
      daysLeft: diffDays
    };
  }
}

// Generate Next Sequential Lorry Receipt (LR) Number
export function generateLRNumber(existingTrips = [], prefix = 'LR-2026-') {
  let highestNum = 100;
  existingTrips.forEach(t => {
    if (t.lrNumber) {
      const match = t.lrNumber.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > highestNum) highestNum = num;
      }
    }
  });
  return `${prefix}${String(highestNum + 1).padStart(4, '0')}`;
}

// Generate Dynamic Indian UPI Payment Intent Link
export function generateUpiPayLink(upiId, payeeName, amount, note = '') {
  if (!upiId) return '';
  const cleanUpi = upiId.trim();
  const encodedName = encodeURIComponent(payeeName || 'Transport Ledger');
  const encodedNote = encodeURIComponent(note || 'Transport Freight Payment');
  const amt = Number(amount) || 0;
  return `upi://pay?pa=${cleanUpi}&pn=${encodedName}&am=${amt}&cu=INR&tn=${encodedNote}`;
}

// Generate Dynamic QR Code Image URL for Instant UPI Scanning
export function generateUpiQrCodeUrl(upiId, payeeName, amount, note = '') {
  const upiLink = generateUpiPayLink(upiId, payeeName, amount, note);
  if (!upiLink) return '';
  const encodedPayload = encodeURIComponent(upiLink);
  // Uses high-speed QR rendering API with SVG/PNG support
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=1&data=${encodedPayload}`;
}

// Generate WhatsApp Payment Reminder Link with embedded UPI details
export function generateWhatsAppReminderLink(phone, customerName, pendingAmount, tripDetails = null, settings = {}) {
  let cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone; // Default to India country code +91
  }

  const bizName = settings.businessName || 'Transport Ledger';
  const upiId = settings.upiId || '';

  let text = `Hello *${customerName}*,\n\nThis is a payment update from *${bizName}*.\n`;

  if (tripDetails) {
    text += `\n*Trip Summary:*`;
    if (tripDetails.lrNumber) text += `\n• *LR No:* ${tripDetails.lrNumber}`;
    text += `\n• *Route:* ${tripDetails.fromLocation} ➔ ${tripDetails.toLocation}`;
    text += `\n• *Vehicle:* ${tripDetails.vehicleNumber}`;
    text += `\n• *Date:* ${formatDate(tripDetails.date)}`;
    if (tripDetails.notes) text += `\n• *Goods:* ${tripDetails.notes}`;
  }

  text += `\n\n💰 *Total Balance Due:* ${formatRupee(pendingAmount)}`;

  if (upiId) {
    text += `\n\n*Quick Payment Options:*`;
    text += `\n• *UPI ID:* \`${upiId}\``;
    text += `\n• *Instant UPI Link:* ${generateUpiPayLink(upiId, bizName, pendingAmount, 'Freight settlement')}`;
  }

  if (settings.bankName && settings.accountNumber) {
    text += `\n\n*Bank Transfer (NEFT/RTGS/IMPS):*`;
    text += `\n• Bank: ${settings.bankName}`;
    text += `\n• A/C No: ${settings.accountNumber}`;
    text += `\n• IFSC: ${settings.ifscCode || ''}`;
  }

  text += `\n\nPlease share transaction screenshot once cleared. Thank you for your partnership! 🙏`;

  const encodedText = encodeURIComponent(text);
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
}

// Convert Array of objects to CSV string and download file
export function downloadCSV(filename, rows) {
  if (!rows || !rows.length) return;
  
  const separator = ',';
  const keys = Object.keys(rows[0]);
  
  const csvContent = [
    keys.join(separator),
    ...rows.map(row => 
      keys.map(key => {
        let cell = row[key] === null || row[key] === undefined ? '' : String(row[key]);
        cell = cell.replace(/"/g, '""');
        if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
          cell = `"${cell}"`;
        }
        return cell;
      }).join(separator)
    )
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Export trips to CSV
export function exportTripsToCSV(trips) {
  const formattedRows = trips.map((t, idx) => ({
    'Sr No': idx + 1,
    'LR No': t.lrNumber || '-',
    'Date': formatDate(t.date),
    'Customer Name': t.customerName,
    'From Location': t.fromLocation,
    'To Location': t.toLocation,
    'Vehicle Number': t.vehicleNumber,
    'Driver Name': t.driverName || '-',
    'E-Way Bill': t.ewayBillNo || '-',
    'Weight (Tons)': t.weightTons || '-',
    'Freight Amount (₹)': t.amount,
    'Paid Amount (₹)': t.paidAmount || (t.status === 'Paid' ? t.amount : 0),
    'Balance Due (₹)': t.amount - (t.paidAmount || (t.status === 'Paid' ? t.amount : 0)),
    'Status': t.status,
    'Diesel Cost (₹)': t.fuelCost || 0,
    'Driver Cost (₹)': t.driverCost || 0,
    'Toll Cost (₹)': t.tollCost || 0,
    'Other Expense (₹)': t.otherExpense || 0,
    'Net Profit (₹)': (t.amount - ((t.fuelCost || 0) + (t.driverCost || 0) + (t.tollCost || 0) + (t.otherExpense || 0))),
    'Goods Description': t.notes || ''
  }));

  const filename = `Transport_Ledger_Trips_${formatDateInput()}.csv`;
  downloadCSV(filename, formattedRows);
}

// Export customer ledger to CSV
export function exportCustomerLedgerToCSV(customerName, trips) {
  const customerTrips = trips.filter(t => t.customerName.toLowerCase() === customerName.toLowerCase());
  const formattedRows = customerTrips.map((t, idx) => ({
    'Sr No': idx + 1,
    'LR No': t.lrNumber || '-',
    'Trip Date': formatDate(t.date),
    'Route': `${t.fromLocation} to ${t.toLocation}`,
    'Vehicle No': t.vehicleNumber,
    'Goods Detail': t.notes || '-',
    'Total Freight (₹)': t.amount,
    'Advance Paid (₹)': t.paidAmount || (t.status === 'Paid' ? t.amount : 0),
    'Balance Due (₹)': t.amount - (t.paidAmount || (t.status === 'Paid' ? t.amount : 0)),
    'Status': t.status
  }));

  const cleanName = customerName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Ledger_${cleanName}_${formatDateInput()}.csv`;
  downloadCSV(filename, formattedRows);
}

// Export fleet vehicles to CSV
export function exportVehiclesToCSV(vehicles) {
  const formattedRows = vehicles.map((v, idx) => ({
    'Sr No': idx + 1,
    'Vehicle Number': v.vehicleNumber,
    'Make & Model': v.makeModel || '-',
    'Type': v.vehicleType || '-',
    'Capacity (Tons)': v.capacityTons || '-',
    'Ownership': v.ownership || 'Owned',
    'Assigned Driver': v.driverName || '-',
    'Fitness Expiry': formatDate(v.fitnessExpiry),
    'Insurance Expiry': formatDate(v.insuranceExpiry),
    'Permit Expiry': formatDate(v.permitExpiry),
    'PUC Expiry': formatDate(v.pucExpiry),
    'Total Trips': v.totalTrips || 0,
    'Total Revenue (₹)': v.totalRevenue || 0,
    'Total Expenses (₹)': v.totalExpenses || 0,
    'Net Profit (₹)': v.netProfit || 0,
    'Status': v.status || 'Active'
  }));
  const filename = `Fleet_Vehicles_${formatDateInput()}.csv`;
  downloadCSV(filename, formattedRows);
}

// Export drivers to CSV
export function exportDriversToCSV(drivers) {
  const formattedRows = drivers.map((d, idx) => ({
    'Sr No': idx + 1,
    'Driver Name': d.name,
    'Phone': d.phone || '-',
    'License Number': d.licenseNumber || '-',
    'Assigned Truck': d.assignedVehicle || '-',
    'Trip Status': d.status || 'Available',
    'Pending Advance / Kharacha (₹)': d.advanceBalance || 0,
    'Monthly Salary (₹)': d.monthlySalary || 0
  }));
  const filename = `Drivers_Ledger_${formatDateInput()}.csv`;
  downloadCSV(filename, formattedRows);
}
