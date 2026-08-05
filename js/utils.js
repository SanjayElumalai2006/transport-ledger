/**
 * Utility functions for Transport Ledger
 * Indian Currency (₹), Indian Date Format (DD/MM/YYYY), and CSV Exporter
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

// Prepare trips for CSV download
export function exportTripsToCSV(trips) {
  const formattedRows = trips.map((t, idx) => ({
    'Sr No': idx + 1,
    'Date': formatDate(t.date),
    'Customer Name': t.customerName,
    'From Location': t.fromLocation,
    'To Location': t.toLocation,
    'Route': `${t.fromLocation} -> ${t.toLocation}`,
    'Vehicle Number': t.vehicleNumber,
    'Total Amount (₹)': t.amount,
    'Paid Amount (₹)': t.paidAmount || (t.status === 'Paid' ? t.amount : 0),
    'Pending Amount (₹)': t.amount - (t.paidAmount || (t.status === 'Paid' ? t.amount : 0)),
    'Payment Status': t.status,
    'Notes / Goods': t.notes || ''
  }));

  const filename = `Transport_Ledger_Trips_${formatDateInput()}.csv`;
  downloadCSV(filename, formattedRows);
}

// Prepare Customer Ledger for CSV download
export function exportCustomerLedgerToCSV(customerName, trips) {
  const customerTrips = trips.filter(t => t.customerName.toLowerCase() === customerName.toLowerCase());
  const formattedRows = customerTrips.map((t, idx) => ({
    'Sr No': idx + 1,
    'Trip Date': formatDate(t.date),
    'Route': `${t.fromLocation} to ${t.toLocation}`,
    'Vehicle No': t.vehicleNumber,
    'Goods Detail': t.notes || '-',
    'Total Amount (₹)': t.amount,
    'Paid (₹)': t.paidAmount || (t.status === 'Paid' ? t.amount : 0),
    'Balance Due (₹)': t.amount - (t.paidAmount || (t.status === 'Paid' ? t.amount : 0)),
    'Status': t.status
  }));

  const cleanName = customerName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Ledger_${cleanName}_${formatDateInput()}.csv`;
  downloadCSV(filename, formattedRows);
}

// Generate WhatsApp Payment Reminder Link
export function generateWhatsAppReminderLink(phone, customerName, pendingAmount, tripDetails = null, businessName = 'Transport Ledger') {
  let cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone; // Default to India country code +91
  }

  let text = `Hello *${customerName}*,\n\nThis is a friendly payment reminder from *${businessName}*.\n`;

  if (tripDetails) {
    text += `\n*Trip Details:*`;
    text += `\n• Route: ${tripDetails.fromLocation} to ${tripDetails.toLocation}`;
    text += `\n• Vehicle No: ${tripDetails.vehicleNumber}`;
    text += `\n• Date: ${formatDate(tripDetails.date)}`;
    if (tripDetails.notes) text += `\n• Goods: ${tripDetails.notes}`;
  }

  text += `\n\n*Pending Balance Due:* ${formatRupee(pendingAmount)}`;
  text += `\n\nPlease arrange for payment settlement at your earliest convenience. Thank you! 🙏`;

  const encodedText = encodeURIComponent(text);
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
}

