# 2026 Camp Meeting T-Shirt Ordering App
**CAC Good Works Assembly · "Freely Given" · Romans 8:32**

A complete, mobile-first e-commerce ordering system for Camp Meeting T-shirts: customer catalogue → cart → checkout → payment instructions → order tracking, plus a full admin dashboard for order, payment, and production management.

---

## 1. What's in this folder

```
camp-meeting-tshirt-app/
├── index.html          Customer app (landing, shop, cart, checkout, tracking)
├── admin.html           Admin dashboard (login required)
├── css/styles.css       All styling for both apps
├── js/config.js         Central configuration (church name, price, bank, WhatsApp…)
├── js/db.js              Data layer (see "How the database works" below)
├── js/app.js             Customer app logic
├── js/admin.js           Admin app logic
├── images/                Your three supplied design images, used exactly as provided
├── icons/, manifest.json, sw.js    PWA installability (Android/iPhone/desktop)
└── README.md             This file
```

Open `index.html` in a browser to use the store. Open `admin.html` to manage it.

**Default admin login:** username `admin`, password `campmeeting2026` — change this immediately from **Admin → Settings → Change Admin Password**, or before you hand the link to anyone else.

---

## 2. How the database works right now — please read this

You asked for Firebase or Google Sheets as the backend. Both require a Google/Firebase **account and project that only you can create** — I have no way to provision cloud infrastructure or credentials on your behalf, and this build environment has no internet access to test against a live project even if I tried. Rather than hand you a non-functional mockup that *talks about* Firebase, I built the entire application against a **real, working local database layer** (`js/db.js`), so every feature — cart, order numbers, admin dashboard, production report — is fully functional today.

**What this means concretely:** orders placed on a phone are saved in that phone's browser storage. They will **not** automatically appear on a different phone or on your laptop's admin dashboard, because there is no shared server yet. This is the one piece that genuinely cannot be finished without your own Firebase (or Google Sheets) account.

The good news: `js/db.js` was deliberately written as a thin, swappable layer — every function (`getOrders`, `createOrder`, `updateOrder`, `nextOrderNumber`, etc.) already returns a Promise, matching the shape of the Firestore SDK exactly. **Nothing in `app.js` or `admin.js` needs to change** when you connect a real backend — only the inside of `db.js` needs new bodies for its functions.

### Connecting a real shared database (recommended path: Firebase)

1. Go to [console.firebase.google.com](https://console.firebase.google.com), create a free ("Spark plan") project.
2. Enable **Firestore Database** (start in production mode) and **Authentication → Email/Password** (for your admin login).
3. In Project Settings → General, register a Web App and copy the `firebaseConfig` object.
4. Add the Firebase SDK to `index.html` and `admin.html` (via `<script type="module">` and the CDN URLs Firebase gives you).
5. Replace the bodies of the functions in `js/db.js` with Firestore calls, e.g.:
   ```js
   async function createOrder(order) {
     await addDoc(collection(db, "orders"), order);
     return order;
   }
   ```
6. Replace `verifyAdmin`/session handling with `signInWithEmailAndPassword` from Firebase Auth, and lock the `orders` collection down with **Firestore Security Rules** so only signed-in admins can read customer phone numbers or write status changes, while anyone can create a new order (write-only, no read) and read only their own order by order number for tracking. A starting-point rule set:
   ```
   match /orders/{orderId} {
     allow create: if true;                     // anyone can place an order
     allow read, update, delete: if request.auth != null;  // admin only
   }
   ```
   Public order tracking (by order number, no login) should go through a small **Cloud Function** that returns only the non-sensitive fields (items, totals, statuses) — never the phone/email — since Firestore rules alone can't easily hide fields from a direct client read.
7. Set a spending/quota alert in the Firebase console (the Spark free tier is generous for a single event, but it's good practice).

Google Sheets + Apps Script is a valid lower-effort alternative if you don't want Firebase: publish an Apps Script Web App with `doPost`/`doGet` functions that read/write the sheet, and point `db.js`'s functions at `fetch()` calls to that Web App URL instead. I'm glad to build that version too if you'd rather go that route — just say the word and tell me you want the Apps Script backend specifically.

---

## 3. Security notes (please read before real-world use)

- **Admin login today is a client-side demo**: the password is hashed (SHA-256) and compared in the browser, which is fine for keeping casual visitors out of the dashboard, but a technically determined person could read it out of the browser's local storage. It is **not** equivalent to real server-side authentication. Once you connect Firebase Authentication (step 6 above), this becomes properly secure — the password check happens on Google's servers, not in the page.
- **No secret keys are in this code.** There is nothing to leak, because there's no live backend yet — a Firebase Web App config (step 3) is a public identifier by design, not a secret, so it's safe to put in the frontend.
- **Duplicate-order protection** is already implemented: the Place Order button disables itself and shows "Submitting order…" the instant it's clicked, so a double-tap can't create two orders.
- **Payment is never auto-confirmed.** Every new order starts as `Payment Status: Pending`. Only a logged-in admin action ("Confirm Payment" or manually changing the status) can mark it Confirmed — the customer telling the app "I've paid" does nothing to the record.
- Order tracking by order number intentionally does **not** show the customer's phone, WhatsApp number, or email — only items, totals, and status — so knowing someone's order number doesn't expose their contact details.

---

## 4. Business details currently configured

All of this lives in `js/config.js` (and is editable live from **Admin → Settings** after that):

| Setting | Value |
|---|---|
| Church | CAC Good Works Assembly |
| Event | 2026 Camp Meeting |
| Theme | Freely Given |
| Scripture | Romans 8:32 |
| Price | ₦6,000 per shirt |
| Bank | Opay |
| Account Number | 9036631218 |
| Account Name | Awopeju Michael Oluwasegun |
| WhatsApp (payment evidence) | wa.me/2349036631218 |
| Designs | 3 (your supplied images — Pink, Purple, Black), each ₦6,000, all sizes S–XXL |

## 5. Design catalogue note

Each of your three supplied designs is a fixed shirt colour (pink, purple, black) — that's what makes it a distinct design, so the "Colour" field in the ordering flow reflects that design's actual colour rather than offering colours that don't exist as real product photos. Size and quantity are fully selectable, and a customer can add all three designs, in any sizes/quantities, to one cart before checking out — exactly as specified.

## 6. What's genuinely functional right now, end to end

- Browsing the 3 designs, configuring colour/size/qty, adding multiple shirts to one cart without re-seeing the catalogue
- Live cart with edit/remove, automatic subtotal/total calculation (never manually entered)
- Customer details form with Nigerian phone validation
- Payment screen with copy-to-clipboard account number and a dynamically calculated amount
- Order placement with a guaranteed-unique, auto-incrementing order number (`CGA-2026-00001`, …), duplicate-submit protection, and a loading state
- WhatsApp payment-evidence button with a pre-filled message (order number, name, amount)
- Public order tracking by order number with a visual status tracker
- Printable customer receipt and printable admin order slip
- Full admin dashboard: revenue/shirts/payment stats, searchable & filterable & sortable orders table, order detail view, payment confirmation, order-status updates, soft-delete with confirmation
- Production report broken down by design × size, with Print and CSV export
- Design and size sales analytics, computed live from real orders
- Settings screen to edit price, bank details, WhatsApp number, and each design's price/availability without touching code
- PWA install support (manifest + service worker) on Android, iPhone, and desktop

## 7. Suggested next steps for you

1. Try the full customer flow on your own phone (open `index.html`, or better, deploy it — see below — and open the live link).
2. Log in to `admin.html`, change the password, place a couple of test orders from the customer side, and confirm they show up correctly (dashboard, production report, CSV export).
3. Decide: Firebase or Google Sheets for the shared backend, and let me know — I can wire either one in next.
4. **Hosting:** once you're happy, this whole folder can be deployed for free on Firebase Hosting, Netlify, GitHub Pages, or Vercel — all have generous free tiers and take a few minutes to set up. I can walk you through whichever you prefer.
