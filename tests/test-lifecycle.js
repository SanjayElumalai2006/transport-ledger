// Automated Browser Simulation Test for Transport Ledger
class LocalStorageMock {
  constructor() { this.store = {}; }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

globalThis.window = globalThis;
globalThis.localStorage = new LocalStorageMock();
globalThis.location = { origin: 'http://localhost:8080', search: '', hash: '' };
globalThis.scrollTo = () => {};

const eventListeners = {};
const mockEl = (id = '') => ({
  id,
  classList: { add: () => {}, remove: () => {} },
  addEventListener: () => {},
  style: {},
  innerHTML: '',
  appendChild: () => {},
  getAttribute: () => '',
  setAttribute: () => {},
  value: ''
});

globalThis.document = {
  documentElement: { getAttribute: () => 'light', setAttribute: () => {} },
  addEventListener: (event, handler) => { eventListeners[event] = handler; },
  getElementById: (id) => mockEl(id),
  querySelector: (sel) => mockEl(sel),
  querySelectorAll: () => [mockEl()],
  createElement: (tag) => mockEl(tag)
};

async function run() {
  try {
    const app = await import('../js/app.js');
    console.log('1. Module imported cleanly.');

    if (eventListeners['DOMContentLoaded']) {
      await eventListeners['DOMContentLoaded']();
      console.log('2. DOMContentLoaded executed without error.');
    }

    const tabs = ['dashboard', 'trips', 'vehicles', 'drivers', 'customers', 'reports', 'settings', 'login'];
    for (const tab of tabs) {
      app.switchTab(tab);
      console.log(`3. Tab '${tab}' rendered cleanly.`);
    }

    console.log('SUCCESS: All 8 tabs rendered with ZERO runtime exceptions!');
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  }
}

run();
