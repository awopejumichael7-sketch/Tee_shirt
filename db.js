/**
 * =========================================================================
 * DATA LAYER  (DB)
 * =========================================================================
 * This app ships with a fully working local database built on
 * window.localStorage, structured exactly like the collections described
 * in the spec (PRODUCTS, ORDERS, ORDER_ITEMS folded into ORDERS, SETTINGS,
 * ADMIN). Every screen — cart, checkout, order numbers, admin dashboard,
 * production report — reads and writes through the functions below.
 *
 * WHY LOCAL STORAGE AND NOT A LIVE FIREBASE PROJECT:
 * A real shared backend (Firebase Firestore, or a Google Sheet driven by
 * Apps Script) needs its own project, credentials, and billing identity
 * that only you can create — I cannot provision a Google/Firebase account
 * on your behalf, and this environment has no network access to test one
 * against. So this build gives you the entire application, fully
 * functional end to end, running on a local data layer. See
 * README.md → "Connecting a real shared database" for the exact steps to
 * point this same UI at Firestore so every customer's order lands in one
 * shared place instead of their own browser.
 *
 * Everything in this file is written so that swap is mechanical: every
 * function below is `async` and returns Promises already, matching the
 * shape of the Firestore SDK, so app.js / admin.js never need to change.
 * =========================================================================
 */

const DB = (() => {
  const KEYS = {
    PRODUCTS: "cga_products",
    ORDERS: "cga_orders",
    SETTINGS: "cga_settings",
    COUNTER: "cga_order_counter",
    ADMIN: "cga_admin",
    SESSION: "cga_admin_session",
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error("DB read error", key, e);
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function seedIfNeeded() {
    if (!localStorage.getItem(KEYS.PRODUCTS)) {
      write(KEYS.PRODUCTS, CONFIG.PRODUCTS);
    }
    if (!localStorage.getItem(KEYS.SETTINGS)) {
      write(KEYS.SETTINGS, {
        price: CONFIG.PRICE,
        churchName: CONFIG.CHURCH_NAME,
        eventName: CONFIG.EVENT_NAME,
        theme: CONFIG.THEME,
        scripture: CONFIG.SCRIPTURE,
        accountNumber: CONFIG.ACCOUNT_NUMBER,
        accountName: CONFIG.ACCOUNT_NAME,
        bank: CONFIG.BANK,
        whatsapp: CONFIG.WHATSAPP_NUMBER,
      });
    }
    if (!localStorage.getItem(KEYS.ORDERS)) {
      write(KEYS.ORDERS, []);
    }
    if (!localStorage.getItem(KEYS.COUNTER)) {
      write(KEYS.COUNTER, 0);
    }
    if (!localStorage.getItem(KEYS.ADMIN)) {
      // Default admin credentials — CHANGE THESE IMMEDIATELY.
      // Password default: campmeeting2026
      write(KEYS.ADMIN, {
        username: "admin",
        passwordHash: null, // computed on first load, see ensureAdminHash()
      });
    }
  }

  async function sha256(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function ensureAdminHash() {
    const admin = read(KEYS.ADMIN, null);
    if (admin && !admin.passwordHash) {
      admin.passwordHash = await sha256("campmeeting2026");
      write(KEYS.ADMIN, admin);
    }
  }

  seedIfNeeded();
  ensureAdminHash();

  // ---------------------------------------------------------------------
  // PRODUCTS
  // ---------------------------------------------------------------------
  async function getProducts() {
    return read(KEYS.PRODUCTS, []);
  }

  async function saveProducts(products) {
    write(KEYS.PRODUCTS, products);
    return products;
  }

  async function upsertProduct(product) {
    const products = await getProducts();
    const idx = products.findIndex((p) => p.id === product.id);
    if (idx >= 0) products[idx] = { ...products[idx], ...product };
    else products.push(product);
    write(KEYS.PRODUCTS, products);
    return products;
  }

  // ---------------------------------------------------------------------
  // SETTINGS
  // ---------------------------------------------------------------------
  async function getSettings() {
    return read(KEYS.SETTINGS, {});
  }

  async function saveSettings(settings) {
    const current = await getSettings();
    const merged = { ...current, ...settings };
    write(KEYS.SETTINGS, merged);
    return merged;
  }

  // ---------------------------------------------------------------------
  // ORDER NUMBER
  // ---------------------------------------------------------------------
  async function nextOrderNumber() {
    let counter = read(KEYS.COUNTER, 0);
    counter += 1;
    write(KEYS.COUNTER, counter);
    const padded = String(counter).padStart(5, "0");
    return `${CONFIG.ORDER_PREFIX}-${CONFIG.ORDER_YEAR}-${padded}`;
  }

  // ---------------------------------------------------------------------
  // ORDERS
  // ---------------------------------------------------------------------
  async function getOrders() {
    return read(KEYS.ORDERS, []);
  }

  async function getOrderByNumber(orderNumber) {
    const orders = await getOrders();
    return orders.find(
      (o) => o.orderNumber.toLowerCase() === orderNumber.trim().toLowerCase()
    );
  }

  async function createOrder(order) {
    const orders = await getOrders();
    orders.unshift(order);
    write(KEYS.ORDERS, orders);
    return order;
  }

  async function updateOrder(orderNumber, patch) {
    const orders = await getOrders();
    const idx = orders.findIndex((o) => o.orderNumber === orderNumber);
    if (idx === -1) return null;
    orders[idx] = {
      ...orders[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    write(KEYS.ORDERS, orders);
    return orders[idx];
  }

  async function softDeleteOrder(orderNumber) {
    return updateOrder(orderNumber, { deleted: true });
  }

  // ---------------------------------------------------------------------
  // ADMIN AUTH (client-side demo auth — see README security notes)
  // ---------------------------------------------------------------------
  async function verifyAdmin(username, password) {
    const admin = read(KEYS.ADMIN, null);
    if (!admin) return false;
    const hash = await sha256(password);
    return admin.username === username && admin.passwordHash === hash;
  }

  async function changeAdminPassword(newPassword) {
    const admin = read(KEYS.ADMIN, {});
    admin.passwordHash = await sha256(newPassword);
    write(KEYS.ADMIN, admin);
  }

  function setSession(active) {
    if (active) sessionStorage.setItem(KEYS.SESSION, "1");
    else sessionStorage.removeItem(KEYS.SESSION);
  }

  function hasSession() {
    return sessionStorage.getItem(KEYS.SESSION) === "1";
  }

  return {
    getProducts,
    saveProducts,
    upsertProduct,
    getSettings,
    saveSettings,
    nextOrderNumber,
    getOrders,
    getOrderByNumber,
    createOrder,
    updateOrder,
    softDeleteOrder,
    verifyAdmin,
    changeAdminPassword,
    setSession,
    hasSession,
  };
})();
