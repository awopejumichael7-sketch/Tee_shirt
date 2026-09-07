/* =========================================================================
   FIREBASE DATA LAYER  (fully additive — js/db.js is never modified)
   =========================================================================
   How this file works:

   1. js/db.js loads first and builds the working local (localStorage)
      database exactly as before — nothing about it changes.
   2. This file loads after it. If FIREBASE.enabled is false (the default),
      this file does nothing at all and the app runs exactly as it did
      before this file existed.
   3. If FIREBASE.enabled is true AND the Firebase compat SDK loaded
      successfully AND initialization succeeds, this file swaps the
      *implementation* of every DB method (DB.getOrders, DB.createOrder,
      etc.) for a real Firestore-backed version, in place, on the same
      `DB` object every other script already calls. app.js and admin.js
      need zero changes — they still just call `DB.createOrder(...)` etc.
      and now that call goes to Firestore instead of localStorage.
   4. If anything above fails (no internet, bad config, SDK blocked), the
      whole thing is wrapped in try/catch and quietly falls back to the
      original local database — the store never breaks because of this.

   Order numbers, admin auth, products, orders and settings are all
   implemented below as real Firestore/Firebase Auth operations — this is
   the "full CRUD" layer. See README.md → "Connecting a real shared
   database (Firebase)" for the exact setup steps this depends on.
   ========================================================================= */

(function () {
  "use strict";

  if (typeof FIREBASE === "undefined" || !FIREBASE.enabled) {
    console.info("[Firebase] Disabled — running on the local database (js/db.js).");
    window.DB_READY = Promise.resolve();
    return;
  }

  if (typeof firebase === "undefined") {
    console.warn("[Firebase] FIREBASE.enabled is true but the Firebase SDK did not load. Falling back to the local database.");
    window.DB_READY = Promise.resolve();
    return;
  }

  let fsDB, fsAuth;
  const COL = FIREBASE.collections;

  try {
    firebase.initializeApp(FIREBASE);
    fsDB = firebase.firestore();
    fsAuth = firebase.auth();
  } catch (err) {
    console.error("[Firebase] Initialization failed — falling back to the local database.", err);
    window.DB_READY = Promise.resolve();
    return;
  }

  const productsCol = () => fsDB.collection(COL.products);
  const ordersCol = () => fsDB.collection(COL.orders);
  const settingsDoc = () => fsDB.collection(COL.settings).doc("main");
  const counterDoc = () => fsDB.collection(COL.counters).doc("orderCounter");

  function normalizeOrderId(orderNumber) {
    return orderNumber.trim().toUpperCase();
  }

  // -----------------------------------------------------------------------
  // ONE-TIME SEEDING — only writes if the collections are empty, so this
  // never overwrites real data on subsequent loads.
  // -----------------------------------------------------------------------
  async function seedIfEmpty() {
    const productsSnap = await productsCol().limit(1).get();
    if (productsSnap.empty) {
      const batch = fsDB.batch();
      CONFIG.PRODUCTS.forEach((p) => batch.set(productsCol().doc(p.id), p));
      await batch.commit();
      console.info("[Firebase] Seeded products collection from CONFIG.PRODUCTS.");
    }

    const settingsSnap = await settingsDoc().get();
    if (!settingsSnap.exists) {
      await settingsDoc().set({
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
      console.info("[Firebase] Seeded settings document from CONFIG.");
    }

    const counterSnap = await counterDoc().get();
    if (!counterSnap.exists) {
      await counterDoc().set({ value: 0 });
    }
  }

  // -----------------------------------------------------------------------
  // PRODUCTS (Create / Read / Update)
  // -----------------------------------------------------------------------
  async function getProducts() {
    const snap = await productsCol().get();
    return snap.docs.map((d) => d.data());
  }

  async function saveProducts(products) {
    const batch = fsDB.batch();
    products.forEach((p) => batch.set(productsCol().doc(p.id), p, { merge: true }));
    await batch.commit();
    return products;
  }

  async function upsertProduct(product) {
    await productsCol().doc(product.id).set(product, { merge: true });
    return getProducts();
  }

  // -----------------------------------------------------------------------
  // SETTINGS (Read / Update)
  // -----------------------------------------------------------------------
  async function getSettings() {
    const snap = await settingsDoc().get();
    return snap.exists ? snap.data() : {};
  }

  async function saveSettings(settings) {
    await settingsDoc().set(settings, { merge: true });
    const snap = await settingsDoc().get();
    return snap.data();
  }

  // -----------------------------------------------------------------------
  // ORDER NUMBER — atomic Firestore transaction, so two customers
  // submitting at the exact same second can never receive the same number.
  // -----------------------------------------------------------------------
  async function nextOrderNumber() {
    const newValue = await fsDB.runTransaction(async (tx) => {
      const doc = await tx.get(counterDoc());
      const current = doc.exists ? doc.data().value || 0 : 0;
      const next = current + 1;
      tx.set(counterDoc(), { value: next }, { merge: true });
      return next;
    });
    const padded = String(newValue).padStart(5, "0");
    return `${CONFIG.ORDER_PREFIX}-${CONFIG.ORDER_YEAR}-${padded}`;
  }

  // -----------------------------------------------------------------------
  // ORDERS (Create / Read / Update / Soft Delete)
  // Each order is stored with its order number as the document ID, so
  // lookups for order tracking are a single direct read — fast and cheap.
  // -----------------------------------------------------------------------
  async function getOrders() {
    const snap = await ordersCol().orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => d.data());
  }

  async function getOrderByNumber(orderNumber) {
    const snap = await ordersCol().doc(normalizeOrderId(orderNumber)).get();
    return snap.exists ? snap.data() : undefined;
  }

  async function createOrder(order) {
    const id = normalizeOrderId(order.orderNumber);
    await ordersCol().doc(id).set(order);
    return order;
  }

  async function updateOrder(orderNumber, patch) {
    const id = normalizeOrderId(orderNumber);
    const ref = ordersCol().doc(id);
    const fullPatch = { ...patch, updatedAt: new Date().toISOString() };
    await ref.set(fullPatch, { merge: true });
    const snap = await ref.get();
    return snap.exists ? snap.data() : null;
  }

  async function softDeleteOrder(orderNumber) {
    return updateOrder(orderNumber, { deleted: true });
  }

  // -----------------------------------------------------------------------
  // ADMIN AUTH — real, server-side Firebase Authentication.
  // Admin users are created from the Firebase Console (Authentication →
  // Users → Add user), never from this app — see README for why.
  // The login form's "Username" field accepts either a full email address
  // or a short username; a short username is expanded using
  // FIREBASE.adminEmailDomain (default "@campmeeting.local") so it can be
  // used with Firebase's email/password sign-in.
  // -----------------------------------------------------------------------
  function toAuthEmail(username) {
    if (username.includes("@")) return username;
    const domain = FIREBASE.adminEmailDomain || "@campmeeting.local";
    return username + domain;
  }

  async function verifyAdmin(username, password) {
    try {
      const email = toAuthEmail(username);
      await fsAuth.signInWithEmailAndPassword(email, password);
      return true;
    } catch (err) {
      console.warn("[Firebase] Admin sign-in failed:", err.code || err.message);
      return false;
    }
  }

  async function changeAdminPassword(newPassword) {
    const user = fsAuth.currentUser;
    if (!user) throw new Error("No authenticated admin session — please log in again.");
    await user.updatePassword(newPassword);
  }

  // -----------------------------------------------------------------------
  // ACTIVATE — replace the local implementations on the existing DB
  // object. DB.setSession / DB.hasSession are intentionally left
  // untouched: they already work fine as a same-device UI session guard
  // on top of Firebase Auth's own persisted sign-in.
  // -----------------------------------------------------------------------
  window.DB_READY = seedIfEmpty()
    .then(() => {
      Object.assign(DB, {
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
      });
      console.info("[Firebase] Connected. DB is now backed by Firestore + Firebase Authentication.");
    })
    .catch((err) => {
      console.error("[Firebase] Seeding/connection failed — falling back to the local database.", err);
    });
})();
