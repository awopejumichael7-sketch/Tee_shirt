/* =========================================================================
   ADMIN APP LOGIC
   ========================================================================= */
(function () {
  "use strict";

  const state = { orders: [], products: [], settings: {} };

  function money(n) { return CONFIG.CURRENCY_SYMBOL + Number(n || 0).toLocaleString("en-NG"); }
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------------------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------------------
  const loginShell = document.getElementById("loginShell");
  const adminShell = document.getElementById("adminShell");

  async function checkSession() {
    if (DB.hasSession()) {
      loginShell.classList.add("hidden");
      adminShell.classList.remove("hidden");
      await bootAdmin();
    }
  }

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = document.getElementById("loginUser").value.trim();
    const pass = document.getElementById("loginPass").value;
    const ok = await DB.verifyAdmin(user, pass);
    const errEl = document.getElementById("loginError");
    if (ok) {
      DB.setSession(true);
      errEl.classList.remove("show");
      loginShell.classList.add("hidden");
      adminShell.classList.remove("hidden");
      await bootAdmin();
    } else {
      errEl.classList.add("show");
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    DB.setSession(false);
    location.reload();
  });

  document.getElementById("menuBtn").addEventListener("click", () => {
    document.getElementById("adminSide").classList.toggle("open");
  });

  // ---------------------------------------------------------------------
  // NAV
  // ---------------------------------------------------------------------
  document.querySelectorAll(".admin-nav button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".admin-nav button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
      document.getElementById("view-" + btn.dataset.view).classList.remove("hidden");
      document.getElementById("viewTitle").textContent = btn.textContent.trim().replace(/^\S+\s/, "");
      document.getElementById("adminSide").classList.remove("open");
      if (btn.dataset.view === "production") renderProduction();
      if (btn.dataset.view === "analytics") renderAnalytics();
      if (btn.dataset.view === "orders") renderOrders();
      if (btn.dataset.view === "dashboard") renderDashboard();
    });
  });

  // ---------------------------------------------------------------------
  // DATA REFRESH
  // ---------------------------------------------------------------------
  async function refreshData() {
    state.orders = (await DB.getOrders()).filter((o) => !o.deleted);
    state.products = await DB.getProducts();
    state.settings = await DB.getSettings();
  }

  // ---------------------------------------------------------------------
  // DASHBOARD
  // ---------------------------------------------------------------------
  function renderDashboard() {
    const orders = state.orders;
    const totalShirts = orders.reduce((s, o) => s + o.totalQuantity, 0);
    const expected = orders.reduce((s, o) => s + o.totalAmount, 0);
    const confirmed = orders.filter((o) => o.paymentStatus === "Confirmed").reduce((s, o) => s + o.totalAmount, 0);
    const pending = expected - confirmed;
    const ready = orders.filter((o) => o.orderStatus === "Ready for Collection").length;
    const collected = orders.filter((o) => o.orderStatus === "Collected").length;

    document.getElementById("statOrders").textContent = orders.length;
    document.getElementById("statShirts").textContent = totalShirts;
    document.getElementById("statExpected").textContent = money(expected);
    document.getElementById("statConfirmed").textContent = money(confirmed);
    document.getElementById("statPending").textContent = money(pending);
    document.getElementById("statReady").textContent = ready;
    document.getElementById("statCollected").textContent = collected;

    const recent = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
    document.getElementById("dashboardRecentRows").innerHTML = recent.map(orderRow).join("") ||
      `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">No orders yet.</td></tr>`;
  }

  function orderRow(o) {
    return `<tr>
      <td><strong>${o.orderNumber}</strong></td>
      <td>${o.customer.name}</td>
      <td>${o.totalQuantity}</td>
      <td>${money(o.totalAmount)}</td>
      <td><span class="status-badge ${o.paymentStatus === "Confirmed" ? "confirmed" : "pending"}">${o.paymentStatus}</span></td>
      <td>${o.orderStatus}</td>
      <td>${new Date(o.createdAt).toLocaleDateString()}</td>
    </tr>`;
  }

  // ---------------------------------------------------------------------
  // ORDERS TABLE
  // ---------------------------------------------------------------------
  function populateFilterOptions() {
    const paySel = document.getElementById("filterPayment");
    const statusSel = document.getElementById("filterStatus");
    const designSel = document.getElementById("filterDesign");
    paySel.innerHTML = '<option value="">All Payment Statuses</option>' +
      CONFIG.PAYMENT_STATUSES.map((s) => `<option value="${s}">${s}</option>`).join("");
    statusSel.innerHTML = '<option value="">All Order Statuses</option>' +
      CONFIG.ORDER_STATUSES.map((s) => `<option value="${s}">${s}</option>`).join("");
    designSel.innerHTML = '<option value="">All Designs</option>' +
      state.products.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  }

  function filteredSortedOrders() {
    const q = document.getElementById("orderSearch").value.trim().toLowerCase();
    const pay = document.getElementById("filterPayment").value;
    const status = document.getElementById("filterStatus").value;
    const design = document.getElementById("filterDesign").value;
    const sort = document.getElementById("sortOrders").value;

    let list = state.orders.filter((o) => {
      if (q && !(o.orderNumber.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(q))) return false;
      if (pay && o.paymentStatus !== pay) return false;
      if (status && o.orderStatus !== status) return false;
      if (design && !o.items.some((it) => it.productId === design)) return false;
      return true;
    });

    list.sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === "highest") return b.totalAmount - a.totalAmount;
      if (sort === "lowest") return a.totalAmount - b.totalAmount;
      return 0;
    });
    return list;
  }

  function renderOrders() {
    const list = filteredSortedOrders();
    document.getElementById("ordersRows").innerHTML = list.map((o) => `
      <tr>
        <td><strong>${o.orderNumber}</strong></td>
        <td>${o.customer.name}</td>
        <td>${o.customer.phone}</td>
        <td>${o.totalQuantity}</td>
        <td>${money(o.totalAmount)}</td>
        <td><span class="status-badge ${o.paymentStatus === "Confirmed" ? "confirmed" : "pending"}">${o.paymentStatus}</span></td>
        <td>${o.orderStatus}</td>
        <td>${new Date(o.createdAt).toLocaleDateString()}</td>
        <td class="row-actions">
          <button data-view-order="${o.orderNumber}">View</button>
          <button data-delete-order="${o.orderNumber}">Delete</button>
        </td>
      </tr>`).join("") || `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);">No orders match.</td></tr>`;

    document.getElementById("ordersRows").querySelectorAll("[data-view-order]").forEach((btn) => {
      btn.addEventListener("click", () => openOrderModal(btn.dataset.viewOrder));
    });
    document.getElementById("ordersRows").querySelectorAll("[data-delete-order]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (confirm(`Delete order ${btn.dataset.deleteOrder}? This can't be undone from this screen.`)) {
          await DB.softDeleteOrder(btn.dataset.deleteOrder);
          await refreshData();
          renderOrders();
          renderDashboard();
          toast("Order deleted");
        }
      });
    });
  }

  ["orderSearch", "filterPayment", "filterStatus", "filterDesign", "sortOrders"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderOrders);
    document.getElementById(id).addEventListener("change", renderOrders);
  });

  // ---------------------------------------------------------------------
  // ORDER DETAIL MODAL
  // ---------------------------------------------------------------------
  const modalOverlay = document.getElementById("orderModalOverlay");
  document.getElementById("modalClose").addEventListener("click", () => modalOverlay.classList.add("hidden"));
  modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) modalOverlay.classList.add("hidden"); });

  async function openOrderModal(orderNumber) {
    const order = await DB.getOrderByNumber(orderNumber);
    if (!order) return;
    document.getElementById("modalOrderNumber").textContent = order.orderNumber;

    const itemsRows = order.items.map((it) =>
      `<div class="summary-item"><span class="l">${it.designName} — ${it.color}, ${it.size} × ${it.qty}</span><span class="r">${money(it.subtotal)}</span></div>`
    ).join("");

    document.getElementById("modalBody").innerHTML = `
      <div class="detail-grid">
        <div><div class="k">Customer</div><div class="v">${order.customer.name}</div></div>
        <div><div class="k">Phone</div><div class="v">${order.customer.phone}</div></div>
        <div><div class="k">WhatsApp</div><div class="v">${order.customer.whatsapp}</div></div>
        <div><div class="k">Email</div><div class="v">${order.customer.email || "—"}</div></div>
        <div><div class="k">Branch</div><div class="v">${order.customer.branch || "—"}</div></div>
        <div><div class="k">Collection</div><div class="v">${order.customer.collectionMethod}</div></div>
        <div><div class="k">Date</div><div class="v">${new Date(order.createdAt).toLocaleString()}</div></div>
        <div><div class="k">Last Updated</div><div class="v">${new Date(order.updatedAt).toLocaleString()}</div></div>
      </div>
      <div class="card-title">Order Items</div>
      ${itemsRows}
      <div class="totals-box">
        <div class="totals-row"><span>Total Shirts</span><span>${order.totalQuantity}</span></div>
        <div class="totals-row grand"><span>Total Amount</span><span>${money(order.totalAmount)}</span></div>
      </div>
      <div class="form-grid two" style="margin-top:18px;">
        <div class="field">
          <label>Payment Status</label>
          <select id="modalPaymentStatus">
            ${CONFIG.PAYMENT_STATUSES.map((s) => `<option value="${s}" ${s === order.paymentStatus ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Order Status</label>
          <select id="modalOrderStatus">
            ${CONFIG.ORDER_STATUSES.map((s) => `<option value="${s}" ${s === order.orderStatus ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="sheet-actions">
        <button class="btn btn-primary btn-block" id="modalSaveStatus">Save Changes</button>
        <button class="btn btn-gold btn-block" id="modalConfirmPayment">Confirm Payment</button>
        <button class="btn btn-outline btn-block" id="modalPrint">Print Order</button>
      </div>
    `;

    document.getElementById("modalSaveStatus").addEventListener("click", async () => {
      const paymentStatus = document.getElementById("modalPaymentStatus").value;
      const orderStatus = document.getElementById("modalOrderStatus").value;
      await DB.updateOrder(order.orderNumber, { paymentStatus, orderStatus });
      await refreshData();
      renderOrders(); renderDashboard();
      toast("Order updated");
      modalOverlay.classList.add("hidden");
    });
    document.getElementById("modalConfirmPayment").addEventListener("click", async () => {
      await DB.updateOrder(order.orderNumber, { paymentStatus: "Confirmed" });
      await refreshData();
      renderOrders(); renderDashboard();
      toast("Payment confirmed");
      modalOverlay.classList.add("hidden");
    });
    document.getElementById("modalPrint").addEventListener("click", () => printOrder(order));

    modalOverlay.classList.remove("hidden");
  }

  function printOrder(order) {
    const itemsRows = order.items.map((it) =>
      `<tr><td>${it.designName}</td><td>${it.color}</td><td>${it.size}</td><td>${it.qty}</td><td>${money(it.subtotal)}</td></tr>`
    ).join("");
    const w = window.open("", "_blank");
    w.document.write(`
      <html><head><title>Order ${order.orderNumber}</title>
      <style>body{font-family:Arial;padding:30px;} table{width:100%;border-collapse:collapse;margin-top:14px;}
      th,td{border:1px solid #ccc;padding:8px;font-size:13px;text-align:left;}</style></head>
      <body>
      <h2>CAC Good Works Assembly — 2026 Camp Meeting</h2>
      <p><strong>Order:</strong> ${order.orderNumber} | <strong>Customer:</strong> ${order.customer.name} | <strong>Phone:</strong> ${order.customer.phone}</p>
      <table><thead><tr><th>Design</th><th>Colour</th><th>Size</th><th>Qty</th><th>Subtotal</th></tr></thead><tbody>${itemsRows}</tbody></table>
      <p><strong>Total:</strong> ${money(order.totalAmount)} | <strong>Payment:</strong> ${order.paymentStatus} | <strong>Status:</strong> ${order.orderStatus}</p>
      </body></html>`);
    w.document.close(); w.print();
  }

  // ---------------------------------------------------------------------
  // CSV EXPORT
  // ---------------------------------------------------------------------
  function downloadCsv(filename, rows) {
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
  }

  document.getElementById("exportAllCsv").addEventListener("click", () => {
    const rows = [["Order Number", "Customer", "Phone", "WhatsApp", "Email", "Items", "Total Shirts", "Total Amount", "Payment Status", "Order Status", "Date"]];
    filteredSortedOrders().forEach((o) => {
      rows.push([
        o.orderNumber, o.customer.name, o.customer.phone, o.customer.whatsapp, o.customer.email || "",
        o.items.map((it) => `${it.designName} (${it.color}, ${it.size} x${it.qty})`).join("; "),
        o.totalQuantity, o.totalAmount, o.paymentStatus, o.orderStatus, o.createdAt,
      ]);
    });
    downloadCsv("camp-meeting-orders.csv", rows);
  });

  // ---------------------------------------------------------------------
  // PRODUCTION REPORT
  // ---------------------------------------------------------------------
  function computeProduction() {
    const byDesign = {};
    state.products.forEach((p) => {
      byDesign[p.id] = { name: p.name, sizes: {}, total: 0 };
      CONFIG.SIZES.forEach((s) => (byDesign[p.id].sizes[s] = 0));
    });
    state.orders.forEach((o) => {
      o.items.forEach((it) => {
        if (!byDesign[it.productId]) {
          byDesign[it.productId] = { name: it.designName, sizes: {}, total: 0 };
          CONFIG.SIZES.forEach((s) => (byDesign[it.productId].sizes[s] = 0));
        }
        if (byDesign[it.productId].sizes[it.size] === undefined) byDesign[it.productId].sizes[it.size] = 0;
        byDesign[it.productId].sizes[it.size] += it.qty;
        byDesign[it.productId].total += it.qty;
      });
    });
    return byDesign;
  }

  function renderProduction() {
    const data = computeProduction();
    const wrap = document.getElementById("productionTables");
    wrap.innerHTML = Object.values(data).map((d) => `
      <div class="card">
        <div class="card-title">${d.name}</div>
        <div class="table-wrap">
          <table class="production-table">
            <thead><tr><th>Design</th>${CONFIG.SIZES.map((s) => `<th>${s}</th>`).join("")}<th>Total</th></tr></thead>
            <tbody><tr><td>${d.name}</td>${CONFIG.SIZES.map((s) => `<td>${d.sizes[s] || 0}</td>`).join("")}<td><strong>${d.total}</strong></td></tr></tbody>
          </table>
        </div>
      </div>
    `).join("");
  }

  document.getElementById("printProduction").addEventListener("click", () => window.print());
  document.getElementById("exportProductionCsv").addEventListener("click", () => {
    const data = computeProduction();
    const rows = [["Design", ...CONFIG.SIZES, "Total"]];
    Object.values(data).forEach((d) => rows.push([d.name, ...CONFIG.SIZES.map((s) => d.sizes[s] || 0), d.total]));
    downloadCsv("production-report.csv", rows);
  });

  // ---------------------------------------------------------------------
  // ANALYTICS
  // ---------------------------------------------------------------------
  function renderAnalytics() {
    const production = computeProduction();
    document.getElementById("designSales").innerHTML = Object.values(production).map((d) =>
      `<div class="summary-item"><span class="l">${d.name}</span><span class="r">${d.total} shirts</span></div>`
    ).join("") || `<p style="color:var(--text-muted);">No sales yet.</p>`;

    const sizeTotals = {};
    CONFIG.SIZES.forEach((s) => (sizeTotals[s] = 0));
    Object.values(production).forEach((d) => CONFIG.SIZES.forEach((s) => (sizeTotals[s] += d.sizes[s] || 0)));
    document.getElementById("sizeBreakdown").innerHTML = CONFIG.SIZES.map((s) =>
      `<div class="summary-item"><span class="l">${s}</span><span class="r">${sizeTotals[s]}</span></div>`
    ).join("");
  }

  // ---------------------------------------------------------------------
  // SETTINGS
  // ---------------------------------------------------------------------
  function loadSettingsForm() {
    document.getElementById("setChurch").value = state.settings.churchName || "";
    document.getElementById("setEvent").value = state.settings.eventName || "";
    document.getElementById("setTheme").value = state.settings.theme || "";
    document.getElementById("setScripture").value = state.settings.scripture || "";
    document.getElementById("setPrice").value = state.settings.price || 0;
    document.getElementById("setWhatsapp").value = state.settings.whatsapp || "";
    document.getElementById("setAccNumber").value = state.settings.accountNumber || "";
    document.getElementById("setAccName").value = state.settings.accountName || "";
    document.getElementById("setBank").value = state.settings.bank || "";

    document.getElementById("productAdminList").innerHTML = state.products.map((p) => `
      <div class="card" style="margin-top:10px;">
        <div class="form-grid two">
          <div class="field"><label>Design Name</label><input type="text" data-pf="name" data-pid="${p.id}" value="${p.name}"></div>
          <div class="field"><label>Price (₦)</label><input type="number" data-pf="price" data-pid="${p.id}" value="${p.price}"></div>
        </div>
        <label class="checkbox-row"><input type="checkbox" data-pf="available" data-pid="${p.id}" ${p.available !== false ? "checked" : ""}> Available for ordering</label>
        <button class="btn btn-outline btn-sm" data-save-product="${p.id}">Save Design</button>
      </div>
    `).join("");

    document.getElementById("productAdminList").querySelectorAll("[data-save-product]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pid = btn.dataset.saveProduct;
        const name = document.querySelector(`[data-pf="name"][data-pid="${pid}"]`).value;
        const price = Number(document.querySelector(`[data-pf="price"][data-pid="${pid}"]`).value);
        const available = document.querySelector(`[data-pf="available"][data-pid="${pid}"]`).checked;
        await DB.upsertProduct({ id: pid, name, price, available });
        await refreshData();
        toast("Design saved");
      });
    });
  }

  document.getElementById("settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await DB.saveSettings({
      churchName: document.getElementById("setChurch").value,
      eventName: document.getElementById("setEvent").value,
      theme: document.getElementById("setTheme").value,
      scripture: document.getElementById("setScripture").value,
      price: Number(document.getElementById("setPrice").value),
      whatsapp: document.getElementById("setWhatsapp").value,
      accountNumber: document.getElementById("setAccNumber").value,
      accountName: document.getElementById("setAccName").value,
      bank: document.getElementById("setBank").value,
    });
    await refreshData();
    toast("Settings saved");
  });

  document.getElementById("passwordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = document.getElementById("newPassword").value;
    if (pass.length < 6) { toast("Password must be at least 6 characters."); return; }
    await DB.changeAdminPassword(pass);
    document.getElementById("newPassword").value = "";
    toast("Password updated");
  });

  // ---------------------------------------------------------------------
  // BOOT
  // ---------------------------------------------------------------------
  async function bootAdmin() {
    await refreshData();
    populateFilterOptions();
    renderDashboard();
    loadSettingsForm();
  }

  checkSession();
})();
