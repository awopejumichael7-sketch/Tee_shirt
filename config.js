/**
 * =========================================================================
 * CENTRAL CONFIGURATION
 * =========================================================================
 * Every church-specific, event-specific, and business value used by the
 * app lives here. Change a value here and it updates everywhere — the
 * landing page, receipts, WhatsApp messages, payment screen, etc.
 *
 * NOTE: Some of these (price, account details) are also editable live from
 * the Admin → Settings screen once the app is running, which writes back
 * into the database layer. The values below are the day-one defaults.
 * =========================================================================
 */

const CONFIG = {
  CHURCH_NAME: "CAC GOOD WORKS ASSEMBLY",
  EVENT_NAME: "2026 CAMP MEETING",
  THEME: "FREELY GIVEN",
  SCRIPTURE: "Romans 8:32",

  CURRENCY_SYMBOL: "₦",
  PRICE: 6000, // default unit price, naira

  ACCOUNT_NUMBER: "9036631218",
  ACCOUNT_NAME: "Awopeju Michael Oluwasegun",
  BANK: "Opay",

  WHATSAPP_NUMBER: "2349036631218", // international format, no leading +
  ORDER_PREFIX: "CGA", // order numbers look like CGA-2026-00001
  ORDER_YEAR: "2026",

  // Collection methods offered at checkout. Extend this array from here —
  // it flows straight into the checkout form.
  COLLECTION_METHODS: ["Church Collection"],

  // Sizes offered for every design. Change centrally.
  SIZES: ["S", "M", "L", "XL", "XXL"],

  // ---------------------------------------------------------------------
  // PRODUCT CATALOGUE (day-one seed data)
  // Images are the exact files supplied — never regenerated or modified.
  // Colour here reflects the actual shirt colour in the supplied image.
  // ---------------------------------------------------------------------
  PRODUCTS: [
    {
      id: "design-1",
      name: "Design 1 — Radiant Pink",
      color: "Pink",
      image: "images/design-pink.jpg",
      price: 6000,
      active: true,
      available: true,
    },
    {
      id: "design-2",
      name: "Design 2 — Royal Purple",
      color: "Purple",
      image: "images/design-purple.jpg",
      price: 6000,
      active: true,
      available: true,
    },
    {
      id: "design-3",
      name: "Design 3 — Classic Black",
      color: "Black",
      image: "images/design-black.jpg",
      price: 6000,
      active: true,
      available: true,
    },
  ],

  // Order status pipeline, in display order
  ORDER_STATUSES: [
    "Order Received",
    "Processing",
    "In Production",
    "Ready for Collection",
    "Collected",
    "Cancelled",
  ],

  PAYMENT_STATUSES: [
    "Pending",
    "Payment Evidence Submitted",
    "Confirmed",
    "Failed",
  ],

  // Simplified public tracker steps (collapses the full pipeline above)
  TRACKER_STEPS: [
    { key: "received", label: "Order Received" },
    { key: "paid", label: "Payment Confirmed" },
    { key: "production", label: "In Production" },
    { key: "ready", label: "Ready for Collection" },
    { key: "collected", label: "Collected" },
  ],
};

// Nigerian phone validation: 11 digits starting 0, or +234 / 234 followed by 10 digits
function isValidNigerianPhone(value) {
  const v = value.replace(/[\s-]/g, "");
  return /^(0\d{10}|(\+?234)\d{10})$/.test(v);
}

/**
 * =========================================================================
 * FIREBASE CONFIGURATION  (additive — does not affect anything above)
 * =========================================================================
 * This app runs perfectly well without this section (it falls back to the
 * local database in js/db.js automatically). Fill in the values below with
 * your own Firebase project's config — copied from:
 * Firebase Console → Project Settings → General → "Your apps" → Web app →
 * SDK setup and configuration → Config.
 *
 * Leave FIREBASE.enabled as false until you've filled in every value below
 * and created the Firestore database + Authentication admin user described
 * in README.md → "Connecting a real shared database (Firebase)".
 * =========================================================================
 */
const FIREBASE = {
  enabled: false, // set to true once the config below is filled in

  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",

  // Firestore collection names — change only if you want different names.
  collections: {
    products: "products",
    orders: "orders",
    settings: "settings",
    counters: "counters",
  },
};
