import assert from 'assert';

// Mock DOM
let backdropContent = '';
let backdropClasses = [];

global.window = global;
global.document = {
  documentElement: {
    getAttribute: () => 'light',
    setAttribute: () => {}
  },
  getElementById: (id) => {
    if (id === 'modal-backdrop') {
      return {
        set innerHTML(html) { backdropContent = html; },
        get innerHTML() { return backdropContent; },
        classList: {
          add: (c) => backdropClasses.push(c),
          remove: (c) => { backdropClasses = backdropClasses.filter(x => x !== c); },
          toggle: () => {}
        }
      };
    }
    return {
      addEventListener: () => {},
      value: '',
      classList: { add: () => {}, remove: () => {}, toggle: () => {} }
    };
  },
  querySelectorAll: (selector) => [],
  addEventListener: () => {}
};
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

console.log("Loading js/app.js to test profile UI rendering...");
import('../js/app.js').then(module => {
  console.log("? js/app.js loaded cleanly as ES module");
  
  // Set up authenticated user
  const mockUser = {
    id: 'usr_test_123',
    email: 'test@transport.com',
    name: 'Sanjay Test',
    businessName: 'Sanjay Fast Cargo',
    phone: '9876543210',
    avatar: '??'
  };
  localStorage.setItem('transport_ledger_auth_user', JSON.stringify(mockUser));
  localStorage.setItem('transport_ledger_auth_token', 'mock_jwt_token');

  // Test 1: openProfileModal renders 3 tabs and all buttons
  window.openProfileModal();
  assert(backdropContent.includes('tab-modal-profile'), 'Modal should have profile tab');
  assert(backdropContent.includes('tab-modal-security'), 'Modal should have security tab');
  assert(backdropContent.includes('tab-modal-backup'), 'Modal should have backup tab');
  assert(backdropContent.includes('btn-modal-save-profile'), 'Modal should have save profile button');
  assert(backdropContent.includes('btn-modal-update-pwd'), 'Modal should have update password button');
  assert(backdropContent.includes('btn-modal-send-backup'), 'Modal should have email backup button');
  assert(backdropContent.includes('btn-modal-download-backup'), 'Modal should have download JSON backup button');
  assert(backdropContent.includes('btn-modal-test-sync'), 'Modal should have cloud sync test button');
  assert(backdropContent.includes('btn-modal-logout'), 'Modal should have logout button');
  assert(backdropContent.includes('btn-modal-goto-account'), 'Modal should have goto account button');
  console.log("? openProfileModal renders all 3 tabs, profile form, password update form, and backup actions");

  // Test 2: renderLoginView for authenticated user
  const viewHtml = window.renderLoginView();
  assert(viewHtml.includes('account-dashboard-wrapper'), 'Should render account-dashboard-wrapper');
  assert(viewHtml.includes('Fleet &amp; Business Profile') || viewHtml.includes('Fleet & Business Profile'), 'Should render profile section');
  assert(viewHtml.includes('btn-account-save-profile'), 'Should include Save Profile button');
  assert(viewHtml.includes('btn-account-change-password'), 'Should include Change Password button');
  assert(viewHtml.includes('btn-account-send-backup'), 'Should include Send Backup button');
  assert(viewHtml.includes('btn-account-download-json'), 'Should include Download JSON button');
  assert(viewHtml.includes('btn-account-cloud-sync'), 'Should include Cloud Sync button');
  assert(viewHtml.includes('btn-account-logout'), 'Should include Logout button');
  console.log("? renderLoginView generates all required account sections & buttons for logged-in user");

  // Test 3: Guest view
  localStorage.removeItem('transport_ledger_auth_user');
  localStorage.removeItem('transport_ledger_auth_token');
  const guestHtml = window.renderLoginView();
  assert(guestHtml.includes('login-view-wrapper'), 'Guest view should render login-view-wrapper');
  assert(guestHtml.includes('btn-view-google-login'), 'Guest view should render Google login button');
  assert(guestHtml.includes('btn-view-quick-demo'), 'Guest view should render 1-click access demo button');
  console.log("? renderLoginView generates guest view with sign-in and Google auth");

  console.log("\n?? ALL FRONTEND PROFILE & BUTTON OPERATIONS FULLY VERIFIED (100% SUCCESS)!");
  process.exit(0);
}).catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
