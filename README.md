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

> **Update:** the Firebase integration described as a future step below has now been built and included in this app (see **Section 8 — Firebase is now built in**). Section 2 is kept as-is for context on *why* the app defaults to a local database; Section 8 covers exactly how to switch it on.

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

---

## 8. Firebase is now built in — how to switch it on

Full Firebase CRUD is now written and included in this app, in a brand-new file, **`js/firebase-db.js`**, plus a new **`firestore.rules`** file. Nothing in `js/db.js`, `js/app.js`, or `js/admin.js` was changed to add this — `firebase-db.js` loads afterward and, only if you turn it on, swaps the *implementation* behind every `DB.` call (getProducts, createOrder, updateOrder, verifyAdmin, etc.) for a real Firestore + Firebase Authentication version. Until you turn it on, the app behaves exactly as it did before — nothing about your existing local database, cart, checkout, or admin flow has changed.

### What's implemented

| Data | Operation | Where |
|---|---|---|
| Products | Create, Read, Update | `products` collection |
| Settings | Read, Update | `settings/main` document |
| Orders | Create, Read (single + list), Update, Soft delete | `orders` collection, document ID = order number |
| Order numbers | Atomic increment (no duplicates even with simultaneous submissions) | `counters/orderCounter`, via a Firestore transaction |
| Admin login | Real sign-in against Firebase Authentication | Email/Password provider |
| Admin password change | Real password update on the signed-in account | Firebase Authentication |

### Steps to activate it

1. **Create the Firebase project** — [console.firebase.google.com](https://console.firebase.google.com) → Add project (free "Spark" plan is enough).
2. **Enable Firestore** — Build → Firestore Database → Create database → start in *production mode*.
3. **Enable Authentication** — Build → Authentication → Sign-in method → enable **Email/Password**.
4. **Create your admin account** — Authentication → Users → Add user. Use a real email address (e.g. `admin@yourchurch.org`) and a strong password. This is deliberately a manual, console-only step — the app itself has no public "create admin" button, so a stranger can never create their own admin login.
   - If you'd rather log in with a short username like `admin` instead of a full email, that still works: the login form sends whatever you type, and if it doesn't contain `@`, `firebase-db.js` automatically appends `FIREBASE.adminEmailDomain` (default `@campmeeting.local`) before signing in — so create the Firebase user as `admin@campmeeting.local`, and log in with just `admin`.
5. **Deploy the security rules** — copy the contents of `firestore.rules` into Firebase Console → Firestore Database → Rules → publish. (Read the notes at the top of that file — particularly the one about public order tracking.)
6. **Get your web app config** — Project Settings (gear icon) → General → scroll to "Your apps" → Add app → Web (`</>`) → register it (no need for Firebase Hosting at this step) → copy the `firebaseConfig` object it shows you.
7. **Paste it into `js/config.js`** — at the bottom of the file, fill in the `FIREBASE` object's `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId` with the values from step 6, then set:
   ```js
   enabled: true,
   ```
8. **Open the app.** The first time it loads with `enabled: true`, `firebase-db.js` automatically seeds your empty Firestore `products` and `settings` collections from `CONFIG` (your existing designs, prices, bank details) — it only does this once, and only if those collections are empty, so it will never overwrite real data on later visits.
9. **Test it**: place an order on your phone, then open the admin dashboard on your laptop and confirm it appears — that's the multi-device sync working.

### If something goes wrong

`firebase-db.js` is written defensively: if the SDK fails to load, the config is incomplete, or Firestore is unreachable, it logs a warning to the browser console and the app **automatically keeps using the local database** instead of breaking. So turning this on is safe to try — worst case, you're back to exactly where you are today until it's fixed.

### Payment-evidence file upload

The original spec offered two options for payment evidence: WhatsApp (built and working today) or an in-app upload. That upload isn't wired up yet because it needs **Firebase Storage** specifically (a separate product from Firestore) with its own security rules. If you'd like that added once Firebase is live, say so and I'll build it as another additive layer, the same way this one was.

### A small, deliberate admin-panel note

You'll now see a low-emphasis **"Admin Login"** link in the customer site's footer, so the dashboard is reachable without you needing to remember or bookmark `admin.html` separately. It's still fully gated behind the login screen either way (local password check today; real Firebase Authentication once Section 8 above is switched on) — nothing about who can *get in* has changed, only how easy the link is to find.
