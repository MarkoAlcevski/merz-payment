/* ============================================================
   Merdz Sky Wellness — admin panel logic
   Auth: password -> signed token (sessionStorage). All data via /api/admin.
   ============================================================ */
(function () {
  "use strict";

  var API = "/api";
  var TOKEN_KEY = "merdz-admin-token";
  var token = sessionStorage.getItem(TOKEN_KEY) || "";
  var settingsCache = { currency: "EUR" };
  var $ = function (id) { return document.getElementById(id); };

  /* ---- toast ---- */
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("is-visible");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("is-visible"); }, 3500);
  }
  function money(n) { return (settingsCache.currency || "EUR") + " " + Number(n || 0).toFixed(2); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function pill(s) { return '<span class="pill ' + esc(s) + '">' + esc(String(s || "").replace(/_/g, " ")) + "</span>"; }

  /* ---- API ---- */
  async function login(password) {
    var res = await fetch(API + "/admin-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: password }) });
    var data = await res.json().catch(function () { return {}; });
    return { ok: res.ok, status: res.status, data: data };
  }
  async function adminReq(action, method, body) {
    var url = API + "/admin?action=" + encodeURIComponent(action);
    if (method === "GET" && body) {
      Object.keys(body).forEach(function (k) { if (body[k] != null && body[k] !== "") url += "&" + k + "=" + encodeURIComponent(body[k]); });
    }
    var res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: method === "POST" ? JSON.stringify(body || {}) : undefined
    });
    if (res.status === 401) { doLogout(); throw new Error("unauthorized"); }
    var data = await res.json().catch(function () { return {}; });
    return { ok: res.ok, status: res.status, data: data };
  }

  /* ---- auth flow ---- */
  $("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = $("loginBtn"); btn.disabled = true; $("loginErr").textContent = "";
    try {
      var r = await login($("adminPw").value);
      if (r.ok && r.data.token) {
        token = r.data.token; sessionStorage.setItem(TOKEN_KEY, token);
        if (r.data.demo) $("appDemoBadge").classList.remove("hidden");
        enterApp();
      } else {
        $("loginErr").textContent = r.data.message || "Incorrect password.";
      }
    } catch (e2) { $("loginErr").textContent = "Could not sign in. Try again."; }
    finally { btn.disabled = false; }
  });

  function doLogout() {
    token = ""; sessionStorage.removeItem(TOKEN_KEY);
    $("appView").classList.add("hidden"); $("loginView").classList.remove("hidden");
  }
  $("logoutBtn").addEventListener("click", doLogout);
  $("refreshBtn").addEventListener("click", function () { loadDashboard(); loadBookings(); });

  async function enterApp() {
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    await loadSettings();
    await loadDashboard();
    await loadBookings();
    await loadBlocked();
  }

  /* ---- tabs ---- */
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("is-active"); });
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("is-active"); });
      tab.classList.add("is-active");
      $("view-" + tab.getAttribute("data-view")).classList.add("is-active");
    });
  });

  /* ---- dashboard ---- */
  async function loadDashboard() {
    try {
      var r = await adminReq("list", "GET");
      var s = r.data.summary || {};
      $("statCards").innerHTML =
        stat(s.upcoming || 0, "Upcoming") + stat(s.awaiting || 0, "Awaiting payment") +
        stat(s.paid || 0, "Confirmed / paid") + stat(money(s.revenue || 0), "Revenue (paid)");
      var today = new Date().toISOString().slice(0, 10);
      var upcoming = (r.data.bookings || []).filter(function (b) {
        return (b.booking_status === "paid" || b.booking_status === "confirmed") && b.check_out >= today;
      });
      $("upcomingBody").innerHTML = upcoming.length ? upcoming.map(rowMini).join("") : '<tr><td colspan="6" class="empty">No upcoming reservations.</td></tr>';
      bindRowClicks("upcomingBody");
    } catch (e) {}
  }
  function stat(n, l) { return '<div class="stat"><div class="n">' + esc(n) + '</div><div class="l">' + l + "</div></div>"; }
  function rowMini(b) {
    return '<tr data-ref="' + esc(b.public_booking_reference) + '"><td>' + esc(b.public_booking_reference) + "</td><td>" + esc(b.guest_name) +
      "</td><td>" + esc(b.check_in) + "</td><td>" + esc(b.check_out) + "</td><td>" + money(b.total_amount) + "</td><td>" + pill(b.booking_status) + "</td></tr>";
  }

  /* ---- bookings ---- */
  $("applyFilters").addEventListener("click", loadBookings);
  $("fltSearch").addEventListener("keydown", function (e) { if (e.key === "Enter") loadBookings(); });
  async function loadBookings() {
    try {
      var r = await adminReq("list", "GET", {
        q: $("fltSearch").value, status: $("fltStatus").value, from: $("fltFrom").value, to: $("fltTo").value
      });
      var rows = r.data.bookings || [];
      $("bookingsBody").innerHTML = rows.length ? rows.map(function (b) {
        return '<tr data-ref="' + esc(b.public_booking_reference) + '"><td>' + esc(b.public_booking_reference) +
          "</td><td>" + esc(b.guest_name) + "<br><small style='color:var(--ink-faint)'>" + esc(b.guest_email) + "</small></td>" +
          "<td>" + esc(b.check_in) + " → " + esc(b.check_out) + "</td><td>" + esc(b.number_of_nights) + "</td><td>" + money(b.total_amount) +
          "</td><td>" + esc(b.payment_method || "—") + "</td><td>" + pill(b.booking_status) + "</td></tr>";
      }).join("") : '<tr><td colspan="7" class="empty">No reservations found.</td></tr>';
      bindRowClicks("bookingsBody");
    } catch (e) {}
  }
  function bindRowClicks(bodyId) {
    Array.prototype.forEach.call($(bodyId).querySelectorAll("tr[data-ref]"), function (tr) {
      tr.addEventListener("click", function () { openDetail(tr.getAttribute("data-ref")); });
    });
  }

  /* ---- detail modal ---- */
  async function openDetail(ref) {
    try {
      var r = await adminReq("get", "GET", { ref: ref });
      var b = r.data.booking; if (!b) return;
      $("detailTitle").textContent = b.public_booking_reference;
      $("detailBody").innerHTML =
        kv("Guest", b.guest_name) + kv("Email", b.guest_email) + kv("Phone", b.guest_phone || "—") +
        kv("Country", b.guest_country || "—") + kv("Check-in", b.check_in) + kv("Check-out", b.check_out) +
        kv("Nights", b.number_of_nights) + kv("Guests", b.adults + (b.children ? " + " + b.children : "")) +
        kv("Per night", money(b.price_per_night)) + kv("Cleaning", money(b.cleaning_fee)) +
        kv("Total", money(b.total_amount)) + kv("Payment", (b.payment_method || "—") + " · " + b.payment_status) +
        kv("Status", b.booking_status) + (b.special_requests ? kv("Requests", b.special_requests) : "") +
        kv("Provider ref", b.payment_provider_reference || "—");
      var acts = [];
      if (b.payment_status !== "paid") acts.push(btn("Mark as paid", "btn-primary", "mark-paid"));
      if (b.booking_status !== "confirmed" && b.booking_status !== "paid") acts.push(btn("Confirm", "btn-outline", "confirm"));
      if (b.booking_status !== "cancelled") acts.push(btn("Cancel", "btn-danger", "cancel"));
      if (b.payment_status === "paid") acts.push(btn("Refund", "btn-danger", "refund"));
      $("detailActions").innerHTML = acts.join("");
      Array.prototype.forEach.call($("detailActions").querySelectorAll("button[data-op]"), function (bt) {
        bt.addEventListener("click", function () { updateBooking(ref, bt.getAttribute("data-op")); });
      });
      openModal("detailModal");
    } catch (e) {}
  }
  function kv(k, v) { return '<div class="kv"><span>' + esc(k) + "</span><span>" + esc(v) + "</span></div>"; }
  function btn(label, cls, op) { return '<button class="btn btn-sm ' + cls + '" data-op="' + op + '">' + label + "</button>"; }

  async function updateBooking(ref, op) {
    try {
      var r = await adminReq("update", "POST", { ref: ref, op: op });
      if (r.ok) { toast("Updated."); closeModals(); loadDashboard(); loadBookings(); }
      else { toast(r.data.message || "Could not update."); }
    } catch (e) {}
  }

  /* ---- new booking ---- */
  $("newBookingBtn").addEventListener("click", function () { openModal("newModal"); });
  $("nbCreate").addEventListener("click", async function () {
    var body = {
      name: $("nbName").value, email: $("nbEmail").value, phone: $("nbPhone").value,
      checkIn: $("nbCheckin").value, checkOut: $("nbCheckout").value,
      adults: $("nbAdults").value, children: $("nbChildren").value,
      specialRequests: $("nbSpecial").value, markPaid: $("nbPaid").checked, force: $("nbForce").checked
    };
    try {
      var r = await adminReq("create", "POST", body);
      if (r.status === 201) { toast("Reservation created."); closeModals(); loadDashboard(); loadBookings(); }
      else { toast(r.data.message || "Could not create (check dates/conflict)."); }
    } catch (e) {}
  });

  /* ---- blocked dates ---- */
  $("blockBtn").addEventListener("click", async function () {
    try {
      var r = await adminReq("block", "POST", { date_from: $("blkFrom").value, date_to: $("blkTo").value, reason: $("blkReason").value });
      if (r.status === 201) { toast("Dates blocked."); $("blkReason").value = ""; loadBlocked(); }
      else { toast(r.data.error === "invalid_range" ? "Invalid range (To must be after From)." : "Could not block."); }
    } catch (e) {}
  });
  async function loadBlocked() {
    try {
      var r = await adminReq("blocked-list", "GET");
      var rows = r.data.blocked || [];
      $("blockedBody").innerHTML = rows.length ? rows.map(function (bd) {
        return "<tr><td>" + esc(bd.date_from) + "</td><td>" + esc(bd.date_to) + "</td><td>" + esc(bd.reason || "—") +
          '</td><td><button class="btn btn-danger btn-sm" data-unblock="' + esc(bd.id) + '">Remove</button></td></tr>';
      }).join("") : '<tr><td colspan="4" class="empty">No blocked dates.</td></tr>';
      Array.prototype.forEach.call($("blockedBody").querySelectorAll("button[data-unblock]"), function (bt) {
        bt.addEventListener("click", async function () {
          await adminReq("unblock", "POST", { id: bt.getAttribute("data-unblock") });
          toast("Removed."); loadBlocked();
        });
      });
    } catch (e) {}
  }

  /* ---- settings ---- */
  async function loadSettings() {
    try {
      var r = await adminReq("settings-get", "GET");
      var s = r.data.settings || {};
      settingsCache = s;
      $("setPrice").value = s.price_per_night; $("setCleaning").value = s.cleaning_fee;
      $("setAdditional").value = s.additional_fees || 0; $("setCurrency").value = s.currency || "EUR";
      $("setMaxGuests").value = s.maximum_guests; $("setMinNights").value = s.minimum_nights;
      $("setHold").value = s.hold_duration_minutes;
    } catch (e) {}
  }
  $("saveSettings").addEventListener("click", async function () {
    var patch = {
      price_per_night: $("setPrice").value, cleaning_fee: $("setCleaning").value, additional_fees: $("setAdditional").value,
      currency: $("setCurrency").value, maximum_guests: $("setMaxGuests").value,
      minimum_nights: $("setMinNights").value, hold_duration_minutes: $("setHold").value
    };
    try {
      var r = await adminReq("settings-put", "POST", { settings: patch });
      if (r.ok) { settingsCache = r.data.settings || settingsCache; toast("Settings saved."); loadDashboard(); loadBookings(); }
      else toast("Could not save.");
    } catch (e) {}
  });

  /* ---- CSV export (with auth header) ---- */
  $("exportBtn").addEventListener("click", async function () {
    try {
      var res = await fetch(API + "/admin?action=export", { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) { toast("Export failed."); return; }
      var blob = await res.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = "merdz-bookings.csv"; document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
    } catch (e) { toast("Export failed."); }
  });

  /* ---- modals ---- */
  function openModal(id) { $(id).classList.add("is-open"); }
  function closeModals() { document.querySelectorAll(".modal").forEach(function (m) { m.classList.remove("is-open"); }); }
  document.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", closeModals); });
  document.querySelectorAll(".modal").forEach(function (m) { m.addEventListener("click", function (e) { if (e.target === m) closeModals(); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModals(); });

  /* ---- boot ---- */
  // Probe demo mode for the login note (admin-login returns demo flag, but
  // we hint here too by trying a no-op settings fetch only after login).
  fetch(API + "/settings").then(function (r) { return r.json(); }).then(function (s) {
    if (s && s.demo && s.demo.admin) $("loginDemoNote").classList.remove("hidden");
  }).catch(function () {});

  if (token) { enterApp().catch(function () { doLogout(); }); }
})();
