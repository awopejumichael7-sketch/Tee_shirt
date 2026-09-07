/* =========================================================================
   CUSTOMER APP LOGIC
   ========================================================================= */
(function () {
  "use strict";

  const STEPS = ["Shop", "Cart", "Details", "Payment", "Confirm"];

  const state = {
    products: [],
    settings: {},
    cart: [], // {lineId, productId, name, image, color, size, qty, unitPrice}
    editingLineId: null,
    activeProduct: null,
    customer: null,
    collectionMethod: CONFIG.COLLECTION_METHODS[0],
    submitting: false,
    lastOrder: null,
  };

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  function money(n) {
    return CONFIG.CURRENCY_SYMBOL + Number(n).toLocaleString("en-NG");
  }

  function uid() {
    return "l" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  }

  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function waLink(number, text) {
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  }

  function progressHTML(activeIndex) {
    return STEPS.map((label, i) => {
      const cls = i < activeIndex ? "done" : i === activeIndex ? "active" : "";
      const dot = i < activeIndex ? "✓" : i + 1;
      const line = i < STEPS.length - 1 ? '<span class="progress-line"></span>' : "";
      return `<div class="progress-step ${cls}"><div class="progress-dot">${dot}</div><span class="progress-label">${label}</span></div>${line}`;
    }).join("");
  }

  function paintProgress(activeIndex) {
    ["progressBar", "progressBarCart", "progressBarDetails", "progressBarPayment", "progressBarSummary"]
      .forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = progressHTML(activeIndex);
      });
  }

  // ---------------------------------------------------------------------
  // Catalogue rendering
  // ---------------------------------------------------------------------
  function productCardHTML(p) {
    const available = p.active !== false && p.available !== false;
    return `
    <article class="product-card">
      <div class="thumb">
        <img src="${p.image}" alt="${p.name} — official 2026 Camp Meeting T-shirt design">
        ${available ? "" : '<span class="badge sold-out">Sold Out</span>'}
      </div>
      <div class="body">
        <div class="name">${p.name}</div>
        <div class="meta"><span class="swatch" style="background:${swatchColor(p.color)}"></span>${p.color}</div>
        <div class="price-row">
          <span class="price">${money(p.price)}</span>
          <span class="avail ${available ? "" : "out"}">${available ? "Available" : "Unavailable"}</span>
        </div>
        <button class="btn ${available ? "btn-primary" : "btn-ghost"} btn-block" data-add="${p.id}" ${available ? "" : "disabled"}>
          ${available ? "Add to Order" : "Sold Out"}
        </button>
      </div>
    </article>`;
  }

  function swatchColor(name) {
    const map = { pink: "#e0338f", purple: "#4b2a7d", black: "#14110d" };
    return map[(name || "").toLowerCase()] || "#999";
  }

  function renderCatalogue() {
    const html = state.products.map(productCardHTML).join("");
    ["catalogueGridLanding", "catalogueGridShop"].forEach((id) => {
      const el = document.getElementById(id);
      el.innerHTML = html;
      el.querySelectorAll("[data-add]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const product = state.products.find((p) => p.id === btn.dataset.add);
          if (product) openConfig(product);
        });
      });
    });
  }

  // ---------------------------------------------------------------------
  // Configure sheet
  // ---------------------------------------------------------------------
  const overlay = document.getElementById("configOverlay");

  function openConfig(product, editLine) {
    state.activeProduct = product;
    state.editingLineId = editLine ? editLine.lineId : null;

    document.getElementById("configTitle").textContent = editLine ? "Edit Shirt" : product.name;
    document.getElementById("configImage").src = product.image;
    document.getElementById("configImage").alt = product.name;

    const colorSel = document.getElementById("configColor");
    colorSel.innerHTML = `<option value="${product.color}">${product.color}</option>`;

    const sizeSel = document.getElementById("configSize");
    sizeSel.innerHTML = '<option value="">Select Size</option>' +
      CONFIG.SIZES.map((s) => `<option value="${s}">${s}</option>`).join("");
    if (editLine) sizeSel.value = editLine.size;
    document.getElementById("configSizeField").classList.remove("has-error");

    const qty = editLine ? editLine.qty : 1;
    document.getElementById("qtyValue").textContent = qty;
    document.getElementById("qtyValue").dataset.qty = qty;

    updateConfigPrice();
    overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeConfig() {
    overlay.classList.add("hidden");
    document.body.style.overflow = "";
    state.activeProduct = null;
    state.editingLineId = null;
  }

  function updateConfigPrice() {
    const qty = Number(document.getElementById("qtyValue").dataset.qty || 1);
    const price = state.activeProduct ? state.activeProduct.price : 0;
    document.getElementById("configPrice").textContent = money(price * qty);
  }

  document.getElementById("configClose").addEventListener("click", closeConfig);
  document.getElementById("configCancel").addEventListener("click", closeConfig);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeConfig(); });

  document.getElementById("qtyMinus").addEventListener("click", () => {
    const el = document.getElementById("qtyValue");
    let q = Math.max(1, Number(el.dataset.qty) - 1);
    el.dataset.qty = q; el.textContent = q; updateConfigPrice();
  });
  document.getElementById("qtyPlus").addEventListener("click", () => {
    const el = document.getElementById("qtyValue");
    let q = Math.min(50, Number(el.dataset.qty) + 1);
    el.dataset.qty = q; el.textContent = q; updateConfigPrice();
  });

  document.getElementById("addToCartBtn").addEventListener("click", () => {
    const product = state.activeProduct;
    if (!product) return;
    const sizeSel = document.getElementById("configSize");
    const sizeField = document.getElementById("configSizeField");
    if (!sizeSel.value) {
      sizeField.classList.add("has-error");
      return;
    }
    sizeField.classList.remove("has-error");
    const qty = Number(document.getElementById("qtyValue").dataset.qty || 1);
    const color = document.getElementById("configColor").value;

    if (state.editingLineId) {
      const line = state.cart.find((l) => l.lineId === state.editingLineId);
      if (line) {
        line.size = sizeSel.value;
        line.qty = qty;
        line.color = color;
        line.unitPrice = product.price;
      }
      toast("Shirt updated");
    } else {
      state.cart.push({
        lineId: uid(),
        productId: product.id,
        name: product.name,
        image: product.image,
        color,
        size: sizeSel.value,
        qty,
        unitPrice: product.price,
      });
      toast("Added to cart");
    }
    closeConfig();
    updateCartBadge();
    if (!document.getElementById("screen-cart").classList.contains("hidden")) {
      renderCart();
    }
  });

  // ---------------------------------------------------------------------
  // Cart
  // ---------------------------------------------------------------------
  function cartTotals() {
    const shirts = state.cart.reduce((s, l) => s + l.qty, 0);
    const total = state.cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    return { shirts, total };
  }

  function updateCartBadge() {
    const { shirts } = cartTotals();
    const badge = document.getElementById("cartCountTop");
    if (shirts > 0) {
      badge.textContent = shirts;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  function renderCart() {
    const listEl = document.getElementById("cartList");
    const emptyEl = document.getElementById("cartEmpty");
    const totalsWrap = document.getElementById("cartTotalsWrap");
    const actions = document.getElementById("cartActions");

    if (state.cart.length === 0) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      totalsWrap.classList.add("hidden");
      actions.classList.add("hidden");
      return;
    }
    emptyEl.classList.add("hidden");
    totalsWrap.classList.remove("hidden");
    actions.classList.remove("hidden");

    listEl.innerHTML = state.cart.map((l) => `
      <div class="cart-item" data-line="${l.lineId}">
        <img src="${l.image}" alt="${l.name}">
        <div class="info">
          <div class="name">${l.name}</div>
          <div class="attrs">${l.color} · Size ${l.size} · Qty ${l.qty}</div>
          <div class="row2">
            <span class="subtotal">${money(l.qty * l.unitPrice)}</span>
            <span class="actions">
              <button data-edit="${l.lineId}">Edit</button>
              <button data-remove="${l.lineId}" class="remove">Remove</button>
            </span>
          </div>
        </div>
      </div>`).join("");

    listEl.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const line = state.cart.find((l) => l.lineId === btn.dataset.edit);
        const product = state.products.find((p) => p.id === line.productId);
        if (product && line) openConfig(product, line);
      });
    });
    listEl.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.cart = state.cart.filter((l) => l.lineId !== btn.dataset.remove);
        renderCart();
        updateCartBadge();
        toast("Item removed");
      });
    });

    const { shirts, total } = cartTotals();
    document.getElementById("cartSubtotal").textContent = money(total);
    document.getElementById("cartTotal").textContent = money(total);
  }

  // ---------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------
  function goShop() { renderCatalogue(); paintProgress(0); show("screen-shop"); }
  function goCart() { renderCart(); paintProgress(1); show("screen-cart"); }
  function goDetails() {
    if (state.cart.length === 0) { toast("Your cart is empty."); goShop(); return; }
    paintProgress(2);
    renderCollectionGroup();
    show("screen-details");
  }
  function goPayment() {
    const { shirts, total } = cartTotals();
    document.getElementById("payTotal").textContent = money(total);
    document.getElementById("payShirtCount").textContent = shirts + (shirts === 1 ? " shirt" : " shirts");
    document.getElementById("payAccNumber").textContent = state.settings.accountNumber;
    document.getElementById("payAccName").textContent = state.settings.accountName;
    document.getElementById("payBank").textContent = state.settings.bank;
    document.getElementById("payAmountAgain").textContent = money(total);
    paintProgress(3);
    show("screen-payment");
  }
  function goSummary() {
    const { shirts, total } = cartTotals();
    document.getElementById("summaryCustomer").innerHTML = `
      <div class="summary-item"><span class="l">Name</span><span class="r">${state.customer.name}</span></div>
      <div class="summary-item"><span class="l">Phone</span><span class="r">${state.customer.phone}</span></div>
      <div class="summary-item"><span class="l">Collection</span><span class="r">${state.customer.collectionMethod}</span></div>`;
    document.getElementById("summaryItems").innerHTML = state.cart.map((l) => `
      <div class="summary-item"><span class="l">${l.name} — ${l.color}, ${l.size} × ${l.qty}</span><span class="r">${money(l.qty * l.unitPrice)}</span></div>
    `).join("");
    document.getElementById("summaryShirtCount").textContent = shirts;
    document.getElementById("summaryTotal").textContent = money(total);
    document.getElementById("confirmCheck").checked = false;
    document.getElementById("placeOrderError").style.display = "none";
    paintProgress(4);
    show("screen-summary");
  }

  function renderCollectionGroup() {
    const group = document.getElementById("collectionGroup");
    group.innerHTML = CONFIG.COLLECTION_METHODS.map((m, i) => `
      <label class="radio-chip ${i === 0 ? "checked" : ""}">
        <input type="radio" name="collection" value="${m}" ${i === 0 ? "checked" : ""}>
        ${m}
      </label>`).join("");
    group.querySelectorAll('input[name="collection"]').forEach((input) => {
      input.addEventListener("change", () => {
        group.querySelectorAll(".radio-chip").forEach((chip) => chip.classList.remove("checked"));
        input.closest(".radio-chip").classList.add("checked");
        state.collectionMethod = input.value;
      });
    });
  }

  // ---------------------------------------------------------------------
  // Wire nav buttons
  // ---------------------------------------------------------------------
  document.getElementById("ctaOrder").addEventListener("click", goShop);
  document.getElementById("navCart").addEventListener("click", goCart);
  document.getElementById("browseFromEmptyCart").addEventListener("click", goShop);
  document.getElementById("continueShopping").addEventListener("click", goShop);
  document.getElementById("proceedToOrder").addEventListener("click", () => {
    if (state.cart.length === 0) { toast("Your cart is empty."); return; }
    goDetails();
  });
  document.getElementById("logoHome").addEventListener("click", () => show("screen-landing"));

  ["ctaTrack", "navTrack"].forEach((id) =>
    document.getElementById(id).addEventListener("click", () => show("screen-track"))
  );

  // ---------------------------------------------------------------------
  // Details form
  // ---------------------------------------------------------------------
  function fieldError(id, has) {
    document.getElementById(id).closest(".field").classList.toggle("has-error", has);
  }

  document.getElementById("detailsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("fldName").value.trim();
    const phone = document.getElementById("fldPhone").value.trim();
    const whatsapp = document.getElementById("fldWhatsapp").value.trim();
    const email = document.getElementById("fldEmail").value.trim();
    const branch = document.getElementById("fldBranch").value.trim();

    let valid = true;
    if (!name) { fieldError("fldName", true); valid = false; } else fieldError("fldName", false);
    if (!isValidNigerianPhone(phone)) { fieldError("fldPhone", true); valid = false; } else fieldError("fldPhone", false);
    if (!isValidNigerianPhone(whatsapp)) { fieldError("fldWhatsapp", true); valid = false; } else fieldError("fldWhatsapp", false);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldError("fldEmail", true); valid = false; } else fieldError("fldEmail", false);
    if (!valid) { toast("Please fix the highlighted fields."); return; }

    state.customer = { name, phone, whatsapp, email, branch, collectionMethod: state.collectionMethod };
    goPayment();
  });

  // ---------------------------------------------------------------------
  // Payment screen
  // ---------------------------------------------------------------------
  document.getElementById("copyAccBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.settings.accountNumber);
    } catch (e) {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = state.settings.accountNumber;
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    const toastEl = document.getElementById("copyToast");
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2200);
  });

  document.getElementById("goToSummary").addEventListener("click", goSummary);

  // ---------------------------------------------------------------------
  // Place order
  // ---------------------------------------------------------------------
  document.getElementById("placeOrderBtn").addEventListener("click", async () => {
    const errEl = document.getElementById("placeOrderError");
    errEl.style.display = "none";
    if (!document.getElementById("confirmCheck").checked) {
      errEl.textContent = "Please confirm your order details are correct.";
      errEl.style.display = "block";
      return;
    }
    if (state.submitting) return;
    if (state.cart.length === 0) { toast("Your cart is empty."); goShop(); return; }

    state.submitting = true;
    const btn = document.getElementById("placeOrderBtn");
    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Submitting order...';

    try {
      const { shirts, total } = cartTotals();
      const orderNumber = await DB.nextOrderNumber();
      const order = {
        orderNumber,
        customer: state.customer,
        items: state.cart.map((l) => ({
          productId: l.productId,
          designName: l.name,
          color: l.color,
          size: l.size,
          qty: l.qty,
          unitPrice: l.unitPrice,
          subtotal: l.qty * l.unitPrice,
        })),
        totalQuantity: shirts,
        totalAmount: total,
        paymentStatus: "Pending",
        orderStatus: "Order Received",
        deleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await DB.createOrder(order);
      state.lastOrder = order;

      document.getElementById("confOrderNumber").textContent = orderNumber;
      document.getElementById("confShirtCount").textContent = shirts;
      document.getElementById("confTotal").textContent = money(total);

      const waText = `Hello, I have made payment for my 2026 Camp Meeting T-shirt order.\n\nOrder Number: ${orderNumber}\nName: ${state.customer.name}\nAmount: ${money(total)}\n\nI am sending my payment evidence.`;
      document.getElementById("confWhatsapp").onclick = () =>
        window.open(waLink(state.settings.whatsapp, waText), "_blank");

      // reset cart for next order
      state.cart = [];
      updateCartBadge();

      show("screen-confirmation");
    } catch (err) {
      console.error(err);
      errEl.textContent = "Something went wrong while submitting your order. Please try again.";
      errEl.style.display = "block";
    } finally {
      state.submitting = false;
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  });

  document.getElementById("confTrack").addEventListener("click", () => show("screen-track"));
  document.getElementById("confNewOrder").addEventListener("click", () => { show("screen-landing"); });
  document.getElementById("confPrint").addEventListener("click", () => printReceipt(state.lastOrder));

  // ---------------------------------------------------------------------
  // Track order
  // ---------------------------------------------------------------------
  function trackerHTML(order) {
    const flow = ["Order Received", "Payment Confirmed", "In Production", "Ready for Collection", "Collected"];
    let currentIndex = 0;
    if (order.orderStatus === "Cancelled") {
      return `<div class="status-badge cancelled">Order Cancelled</div>`;
    }
    if (order.paymentStatus === "Confirmed") currentIndex = Math.max(currentIndex, 1);
    if (order.orderStatus === "In Production") currentIndex = 2;
    if (order.orderStatus === "Ready for Collection") currentIndex = 3;
    if (order.orderStatus === "Collected") currentIndex = 4;
    if (order.orderStatus === "Processing" && currentIndex < 1) currentIndex = 0;

    return flow.map((label, i) => {
      const cls = i < currentIndex ? "done" : i === currentIndex ? "current" : "";
      const icon = i < currentIndex ? "✓" : i === currentIndex ? "●" : "○";
      const connector = i < flow.length - 1 ? '<div class="tracker-connector"></div>' : "";
      return `<div class="tracker-step ${cls}">
        <div class="rail"><div class="tracker-dot">${icon}</div>${connector}</div>
        <div class="content"><div class="t">${label}</div></div>
      </div>`;
    }).join("");
  }

  document.getElementById("trackBtn").addEventListener("click", async () => {
    const val = document.getElementById("trackInput").value.trim();
    const resultEl = document.getElementById("trackResult");
    if (!val) { toast("Please enter your order number."); return; }
    resultEl.innerHTML = '<div class="loading-line"><span class="spinner" style="border-top-color:var(--ink);border-color:rgba(20,17,13,.2);"></span> Checking order...</div>';
    const order = await DB.getOrderByNumber(val);
    if (!order || order.deleted) {
      resultEl.innerHTML = `<div class="card" style="margin-top:16px;text-align:center;color:var(--wine);">No order found for that order number. Please check and try again.</div>`;
      return;
    }
    const itemsHTML = order.items.map((it) => `
      <div class="summary-item"><span class="l">${it.designName} — ${it.color}, ${it.size} × ${it.qty}</span><span class="r">${money(it.subtotal)}</span></div>
    `).join("");
    resultEl.innerHTML = `
      <div class="card" style="margin-top:16px;">
        <div class="card-title">Order ${order.orderNumber}</div>
        <div class="tracker">${trackerHTML(order)}</div>
        <div class="summary-item"><span class="l">Payment Status</span><span class="r"><span class="status-badge ${order.paymentStatus === "Confirmed" ? "confirmed" : "pending"}">${order.paymentStatus}</span></span></div>
        <div class="summary-item"><span class="l">Order Status</span><span class="r">${order.orderStatus}</span></div>
      </div>
      <div class="card">
        <div class="card-title">Items</div>
        ${itemsHTML}
        <div class="totals-box">
          <div class="totals-row"><span>Total Shirts</span><span>${order.totalQuantity}</span></div>
          <div class="totals-row grand"><span>Total Amount</span><span>${money(order.totalAmount)}</span></div>
        </div>
      </div>
    `;
  });

  // ---------------------------------------------------------------------
  // Print receipt
  // ---------------------------------------------------------------------
  function printReceipt(order) {
    if (!order) return;
    const itemsRows = order.items.map((it) =>
      `<tr><td>${it.designName}</td><td>${it.color}</td><td>${it.size}</td><td>${it.qty}</td><td>${money(it.subtotal)}</td></tr>`
    ).join("");
    const w = window.open("", "_blank");
    w.document.write(`
      <html><head><title>Receipt ${order.orderNumber}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#14110d;}
        h1{font-size:18px;margin-bottom:2px;} h2{font-size:14px;color:#97741f;margin-top:0;}
        table{width:100%;border-collapse:collapse;margin-top:16px;}
        th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:13px;}
        .tot{font-weight:bold;font-size:15px;margin-top:14px;}
      </style></head><body>
      <h1>CAC Good Works Assembly</h1>
      <h2>2026 Camp Meeting · Freely Given · Romans 8:32</h2>
      <p><strong>Order Number:</strong> ${order.orderNumber}<br>
      <strong>Customer:</strong> ${order.customer.name}<br>
      <strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}<br>
      <strong>Payment Status:</strong> ${order.paymentStatus}<br>
      <strong>Order Status:</strong> ${order.orderStatus}</p>
      <table><thead><tr><th>Design</th><th>Colour</th><th>Size</th><th>Qty</th><th>Subtotal</th></tr></thead>
      <tbody>${itemsRows}</tbody></table>
      <p class="tot">Total Shirts: ${order.totalQuantity} &nbsp; | &nbsp; Total Amount: ${money(order.totalAmount)}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  // ---------------------------------------------------------------------
  // Footer WhatsApp
  // ---------------------------------------------------------------------
  document.getElementById("footerWhatsapp").addEventListener("click", (e) => {
    e.preventDefault();
    window.open(waLink(state.settings.whatsapp || CONFIG.WHATSAPP_NUMBER, "Hello, I have a question about the 2026 Camp Meeting T-shirt order."), "_blank");
  });

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  async function init() {
    state.products = await DB.getProducts();
    state.settings = await DB.getSettings();
    document.getElementById("heroPrice").textContent = money(state.settings.price || CONFIG.PRICE);
    renderCatalogue();
    updateCartBadge();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  init();
})();
