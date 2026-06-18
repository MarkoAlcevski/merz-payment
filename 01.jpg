/* ============================================================
   Merdz Sky Wellness — direct booking widget (frontend)
   Talks to Netlify Functions under /api/*. No secrets here.
   Bilingual (reads <html lang> + the site language switch).
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("bookingWidget");
  if (!root) return;

  var API = "/api";
  var settings = null;
  var unavailable = []; // [{from,to}] half-open blocked nights
  var view = startOfMonth(new Date());
  var sel = { checkIn: null, checkOut: null }; // ISO strings
  var guests = { adults: 2, children: 0 };
  var current = { reference: null, price: null, holdExpiresAt: null };
  var holdTimer = null;
  var busy = false;

  /* ---------------- i18n ---------------- */
  var T = {
    en: {
      checkAvail: "Check availability & price", continue: "Continue", back: "Back",
      step1: "Stay details", step2: "Guest details", step3: "Review & pay",
      toGuest: "Continue to guest details", toPay: "Continue to payment",
      selectDates: "Select your check-in and check-out dates.",
      nights: "nights", night: "night", adults: "Adults", children: "Children",
      childrenNote: "Ages 0–12", perNight: "per night", cleaning: "Cleaning fee",
      total: "Total", available: "Great news — those dates are available!",
      unavailable: "Those dates aren't available. Please pick another range.",
      unavailableShort: "Unavailable",
      rangeBlocked: "Your range includes unavailable nights. Please choose again.",
      pickCheckout: "Now choose your check-out date.", minNights: "Minimum stay is {n} night(s).",
      maxGuests: "Maximum {n} guests.", pastDate: "Check-in can't be in the past.",
      checkoutAfter: "Check-out must be after check-in.",
      name: "Full name", email: "Email", phone: "Phone", country: "Country",
      special: "Special requests (optional)", selectCountry: "Select country…",
      required: "This field is required.", invalidEmail: "Please enter a valid email.",
      invalidPhone: "Please enter a valid phone number.",
      terms: "I accept the terms, privacy policy, cancellation policy and payment conditions.",
      mustAccept: "Please accept the terms to continue.",
      summary: "Booking summary", checkin: "Check-in", checkout: "Check-out",
      guestsLbl: "Guests", payMethod: "Payment method", payPaypal: "PayPal",
      payNlb: "NLB Banka card", payWith: "Pay with NLB Banka", processing: "Processing…",
      demoBadge: "DEMO", demoBanner: "Demo mode — bookings and payments are simulated. No money is charged. Add credentials in Netlify to go live.",
      payDemoNote: "Demo payment — this simulates a successful transaction. No card is charged.",
      successTitle: "Reservation confirmed", successBody: "We've emailed your confirmation. We'll be in touch with arrival details.",
      successRef: "Your reservation reference", viewDetails: "View full details",
      holdNote: "We're holding these dates for you for", expired: "Your hold expired. Please start again.",
      errGeneric: "Something went wrong. Please try again.", taken: "Sorry — those dates were just taken.",
      bookAnother: "Make another booking", adultsReq: "At least one adult is required."
    },
    mk: {
      checkAvail: "Провери достапност и цена", continue: "Продолжи", back: "Назад",
      step1: "Детали за престој", step2: "Податоци за гостин", step3: "Преглед и плаќање",
      toGuest: "Кон податоци за гостинот", toPay: "Кон плаќање",
      selectDates: "Изберете датуми на пристигнување и заминување.",
      nights: "ноќевања", night: "ноќевање", adults: "Возрасни", children: "Деца",
      childrenNote: "Возраст 0–12", perNight: "по ноќевање", cleaning: "Надомест за чистење",
      total: "Вкупно", available: "Одлично — тие датуми се слободни!",
      unavailable: "Тие датуми не се слободни. Изберете друг период.",
      unavailableShort: "Зафатено",
      rangeBlocked: "Периодот вклучува зафатени ноќевања. Изберете повторно.",
      pickCheckout: "Сега изберете датум на заминување.", minNights: "Минимален престој е {n} ноќевање(а).",
      maxGuests: "Максимум {n} гости.", pastDate: "Пристигнувањето не може да биде во минатото.",
      checkoutAfter: "Заминувањето мора да е по пристигнувањето.",
      name: "Име и презиме", email: "Е-пошта", phone: "Телефон", country: "Држава",
      special: "Посебни барања (опционално)", selectCountry: "Изберете држава…",
      required: "Ова поле е задолжително.", invalidEmail: "Внесете валидна е-пошта.",
      invalidPhone: "Внесете валиден телефонски број.",
      terms: "Ги прифаќам условите, политиката за приватност, политиката за откажување и условите за плаќање.",
      mustAccept: "Прифатете ги условите за да продолжите.",
      summary: "Резиме на резервацијата", checkin: "Пристигнување", checkout: "Заминување",
      guestsLbl: "Гости", payMethod: "Начин на плаќање", payPaypal: "PayPal",
      payNlb: "Картичка NLB Банка", payWith: "Плати со NLB Банка", processing: "Се обработува…",
      demoBadge: "ДЕМО", demoBanner: "Демо режим — резервациите и плаќањата се симулација. Не се наплаќа. Додадете податоци во Netlify за активирање.",
      payDemoNote: "Демо плаќање — ова симулира успешна трансакција. Не се наплаќа картичка.",
      successTitle: "Резервацијата е потврдена", successBody: "Ви испративме потврда на е-пошта. Ќе ве контактираме со детали за пристигнување.",
      successRef: "Ваш број на резервација", viewDetails: "Види детали",
      holdNote: "Ги задржуваме датумите за вас уште", expired: "Резервацијата истече. Започнете повторно.",
      errGeneric: "Нешто тргна наопаку. Обидете се повторно.", taken: "За жал — датумите штотуку се зафатени.",
      bookAnother: "Нова резервација", adultsReq: "Потребен е најмалку еден возрасен."
    }
  };
  function lang() { return (document.documentElement.lang === "mk") ? "mk" : "en"; }
  function t(k) { return (T[lang()] && T[lang()][k]) || T.en[k] || k; }

  var MONTHS = {
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    mk: ["Јануари", "Февруари", "Март", "Април", "Мај", "Јуни", "Јули", "Август", "Септември", "Октомври", "Ноември", "Декември"]
  };
  var DOW = { en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], mk: ["Пон", "Вто", "Сре", "Чет", "Пет", "Саб", "Нед"] };

  var COUNTRIES = ["North Macedonia", "Albania", "Australia", "Austria", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Canada", "Croatia", "Czech Republic", "Denmark", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Kosovo", "Montenegro", "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Serbia", "Slovenia", "Spain", "Sweden", "Switzerland", "Turkey", "Ukraine", "United Kingdom", "United States", "Other"];

  /* ---------------- helpers ---------------- */
  function el(sel2) { return root.querySelector(sel2); }
  function els(sel2) { return Array.prototype.slice.call(root.querySelectorAll(sel2)); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fromISO(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
  function todayISO() { var n = new Date(); return iso(new Date(n.getFullYear(), n.getMonth(), n.getDate())); }
  function nightsBetween(a, b) { return Math.round((fromISO(b) - fromISO(a)) / 86400000); }
  function money(n) { var c = (settings && settings.currency) || "EUR"; return c + " " + Number(n).toFixed(2); }
  function fmtDate(isoStr) {
    var d = fromISO(isoStr);
    return d.getDate() + " " + MONTHS[lang()][d.getMonth()] + " " + d.getFullYear();
  }
  function isBlockedNight(isoDay) {
    for (var i = 0; i < unavailable.length; i++) {
      if (isoDay >= unavailable[i].from && isoDay < unavailable[i].to) return true;
    }
    return false;
  }
  function rangeHasBlocked(ci, co) {
    var d = fromISO(ci), end = fromISO(co);
    while (d < end) { if (isBlockedNight(iso(d))) return true; d.setDate(d.getDate() + 1); }
    return false;
  }
  async function api(path, opts) {
    var res = await fetch(API + path, Object.assign({ headers: { "Content-Type": "application/json" } }, opts || {}));
    var data = null; try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data: data || {} };
  }
  function toast(msg) {
    var tEl = document.getElementById("bwToast");
    if (!tEl) { tEl = document.createElement("div"); tEl.id = "bwToast"; tEl.className = "bw-toast"; tEl.setAttribute("role", "status"); document.body.appendChild(tEl); }
    tEl.textContent = msg; tEl.classList.add("is-visible");
    clearTimeout(toast._t); toast._t = setTimeout(function () { tEl.classList.remove("is-visible"); }, 4000);
  }
  function setBusy(btn, on) {
    busy = on;
    if (btn) { btn.classList.toggle("is-loading", on); btn.disabled = on; }
  }

  /* ---------------- init ---------------- */
  init();
  async function init() {
    try {
      var s = await api("/settings");
      settings = s.data || {};
    } catch (e) { settings = {}; }
    if (!settings.currency) settings.currency = "EUR";
    if (!settings.minimumNights) settings.minimumNights = 1;
    if (!settings.maximumGuests) settings.maximumGuests = 4;

    // Demo banner if any subsystem is simulated.
    var demo = settings.demo || {};
    var anyDemo = demo.database || demo.paypal || demo.nlb || demo.email;
    if (anyDemo) { el("#bwDemoBanner").hidden = false; }

    // Load unavailable ranges for the calendar.
    try { var a = await api("/availability"); unavailable = (a.data && a.data.unavailable) || []; } catch (e) { unavailable = []; }

    buildCountrySelect();
    bindCounters();
    bindNav();
    bindPayments();
    relabel();
    renderCalendar();
    updateRail();

    // Re-render text on language switch.
    document.querySelectorAll(".lang-switch button").forEach(function (b) {
      b.addEventListener("click", function () { setTimeout(function () { relabel(); renderCalendar(); updateRail(); renderSummary(); }, 0); });
    });

    // Deep link: #reserve focuses the widget.
  }

  /* ---------------- labels ---------------- */
  function relabel() {
    setText("[data-t]", function (n) { return t(n.getAttribute("data-t")); });
    el("#bwDemoBanner span").textContent = t("demoBanner");
    var co = el("#bwCountry");
    if (co && co.options.length) co.options[0].textContent = t("selectCountry");
  }
  function setText(sel2, fn) { els(sel2).forEach(function (n) { n.textContent = fn(n); }); }

  /* ---------------- calendar ---------------- */
  function bindNav() {
    el("#bwPrev").addEventListener("click", function () { view = addMonths(view, -1); renderCalendar(); });
    el("#bwNext").addEventListener("click", function () { view = addMonths(view, 1); renderCalendar(); });
    el("#bwToStep2").addEventListener("click", goStep2);
    el("#bwBackTo1").addEventListener("click", function () { showStep(1); });
    el("#bwToStep3").addEventListener("click", goStep3);
    el("#bwBackTo2").addEventListener("click", function () { showStep(2); });
    var again = el("#bwAgain"); if (again) again.addEventListener("click", function () { location.reload(); });
  }

  function renderCalendar() {
    var two = window.matchMedia("(min-width:560px)").matches;
    var wrap = el("#bwMonths");
    wrap.className = "bw-months" + (two ? " two" : "");
    wrap.innerHTML = "";
    wrap.appendChild(monthEl(view));
    if (two) wrap.appendChild(monthEl(addMonths(view, 1)));

    var minMonth = startOfMonth(new Date());
    el("#bwPrev").disabled = (view.getFullYear() === minMonth.getFullYear() && view.getMonth() === minMonth.getMonth());
    // month titles
    var titles = els(".bw-month-title");
    titles[0].textContent = MONTHS[lang()][view.getMonth()] + " " + view.getFullYear();
    if (titles[1]) { var m2 = addMonths(view, 1); titles[1].textContent = MONTHS[lang()][m2.getMonth()] + " " + m2.getFullYear(); }
  }

  function monthEl(monthDate) {
    var c = document.createElement("div");
    var title = document.createElement("div"); title.className = "bw-month-title"; c.appendChild(title);
    var dow = document.createElement("div"); dow.className = "bw-dow";
    DOW[lang()].forEach(function (d) { var s = document.createElement("span"); s.textContent = d; dow.appendChild(s); });
    c.appendChild(dow);
    var grid = document.createElement("div"); grid.className = "bw-days";
    var first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    var startDow = (first.getDay() + 6) % 7; // Monday-first
    var daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    var today = todayISO();
    for (var i = 0; i < startDow; i++) { var e0 = document.createElement("div"); e0.className = "bw-day is-empty"; grid.appendChild(e0); }
    for (var day = 1; day <= daysInMonth; day++) {
      var dIso = monthDate.getFullYear() + "-" + pad(monthDate.getMonth() + 1) + "-" + pad(day);
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "bw-day"; btn.textContent = day; btn.setAttribute("data-iso", dIso);
      var past = dIso < today;
      var blocked = isBlockedNight(dIso);
      if (past || blocked) btn.disabled = true;
      if (dIso === today) btn.classList.add("is-today");
      applyRangeClasses(btn, dIso);
      btn.addEventListener("click", onPickDay);
      grid.appendChild(btn);
    }
    c.appendChild(grid);
    return c;
  }

  function applyRangeClasses(btn, dIso) {
    btn.classList.remove("is-start", "is-end", "in-range");
    if (sel.checkIn && dIso === sel.checkIn) btn.classList.add("is-start");
    if (sel.checkOut && dIso === sel.checkOut) btn.classList.add("is-end");
    if (sel.checkIn && sel.checkOut && dIso > sel.checkIn && dIso < sel.checkOut) btn.classList.add("in-range");
  }

  function onPickDay(e) {
    var dIso = e.currentTarget.getAttribute("data-iso");
    if (!sel.checkIn || (sel.checkIn && sel.checkOut)) {
      sel.checkIn = dIso; sel.checkOut = null;
      feedback("ok", t("pickCheckout"));
    } else {
      if (dIso <= sel.checkIn) { sel.checkIn = dIso; sel.checkOut = null; feedback("ok", t("pickCheckout")); }
      else if (rangeHasBlocked(sel.checkIn, dIso)) { feedback("err", t("rangeBlocked")); sel.checkIn = dIso; sel.checkOut = null; }
      else { sel.checkOut = dIso; checkAvailability(); }
    }
    renderCalendar(); updateRail();
  }

  /* ---------------- guests ---------------- */
  function bindCounters() {
    els("[data-count]").forEach(function (wrap) {
      var key = wrap.getAttribute("data-count");
      wrap.querySelector("[data-dec]").addEventListener("click", function () { changeGuest(key, -1); });
      wrap.querySelector("[data-inc]").addEventListener("click", function () { changeGuest(key, 1); });
    });
    syncCounters();
  }
  function changeGuest(key, delta) {
    var max = settings.maximumGuests || 4;
    var next = guests[key] + delta;
    if (key === "adults" && next < 1) next = 1;
    if (key === "children" && next < 0) next = 0;
    var totalGuests = (key === "adults" ? next : guests.adults) + (key === "children" ? next : guests.children);
    if (totalGuests > max) { toast(t("maxGuests").replace("{n}", max)); return; }
    guests[key] = next;
    syncCounters();
    if (sel.checkIn && sel.checkOut) checkAvailability();
    updateRail();
  }
  function syncCounters() {
    els("[data-count]").forEach(function (wrap) {
      var key = wrap.getAttribute("data-count");
      wrap.querySelector(".val").textContent = guests[key];
      var max = settings.maximumGuests || 4;
      var totalGuests = guests.adults + guests.children;
      wrap.querySelector("[data-inc]").disabled = totalGuests >= max;
      wrap.querySelector("[data-dec]").disabled = (key === "adults" ? guests.adults <= 1 : guests.children <= 0);
    });
  }

  /* ---------------- availability + price ---------------- */
  function updateRail() {
    var r = el("#bwReadout");
    if (sel.checkIn && sel.checkOut) {
      var n = nightsBetween(sel.checkIn, sel.checkOut);
      r.innerHTML = "<strong>" + fmtDate(sel.checkIn) + "</strong> → <strong>" + fmtDate(sel.checkOut) + "</strong><br>" +
        n + " " + (n === 1 ? t("night") : t("nights"));
    } else if (sel.checkIn) {
      r.innerHTML = "<strong>" + fmtDate(sel.checkIn) + "</strong> → …<br>" + t("pickCheckout");
    } else {
      r.textContent = t("selectDates");
    }
  }

  async function checkAvailability() {
    if (!sel.checkIn || !sel.checkOut) return;
    feedback("warn", t("processing"));
    el("#bwToStep2").disabled = true;
    var res = await api("/availability", {
      method: "POST",
      body: JSON.stringify({ checkIn: sel.checkIn, checkOut: sel.checkOut, adults: guests.adults, children: guests.children })
    });
    var d = res.data || {};
    if (d.available) {
      current.price = d.price;
      renderPricePreview(d.price);
      feedback("ok", t("available"));
      el("#bwToStep2").disabled = false;
    } else {
      current.price = null;
      el("#bwPricePreview").innerHTML = "";
      el("#bwToStep2").disabled = true;
      feedback("err", mapReason(d));
      if (d.unavailable) { unavailable = d.unavailable; renderCalendar(); }
    }
  }

  function mapReason(d) {
    switch (d.reason) {
      case "min_nights": return t("minNights").replace("{n}", d.minNights || settings.minimumNights);
      case "max_guests": return t("maxGuests").replace("{n}", d.maxGuests || settings.maximumGuests);
      case "past_date": return t("pastDate");
      case "checkout_before_checkin": return t("checkoutAfter");
      case "unavailable": return t("unavailable");
      default: return d.message || t("unavailable");
    }
  }

  function renderPricePreview(p) {
    el("#bwPricePreview").innerHTML =
      line(money(p.pricePerNight) + " × " + p.nights + " " + (p.nights === 1 ? t("night") : t("nights")), money(p.nightsTotal)) +
      (p.cleaningFee ? line(t("cleaning"), money(p.cleaningFee)) : "") +
      (p.additionalFees ? line("+", money(p.additionalFees)) : "") +
      '<div class="bw-price-total"><span>' + t("total") + "</span><span>" + money(p.total) + "</span></div>";
    function line(a, b) { return '<div class="bw-price-line"><span>' + a + "</span><span>" + b + "</span></div>"; }
  }

  function feedback(kind, msg) {
    var f = el("#bwAvailFeedback");
    f.className = "bw-feedback is-shown " + kind;
    f.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-' + (kind === "ok" ? "check" : (kind === "err" ? "close" : "shield")) + '"/></svg><span>' + msg + "</span>";
  }

  /* ---------------- step navigation ---------------- */
  function showStep(n) {
    [1, 2, 3].forEach(function (i) {
      var panel = el("#bwStep" + i); if (panel) panel.hidden = (i !== n);
      var tab = el('[data-step-tab="' + i + '"]');
      if (tab) { tab.classList.toggle("is-active", i === n); tab.classList.toggle("is-done", i < n); }
    });
    var succ = el("#bwSuccess"); if (succ) succ.hidden = true;
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goStep2() {
    if (!sel.checkIn || !sel.checkOut || !current.price) { feedback("err", t("selectDates")); return; }
    showStep(2);
  }

  async function goStep3() {
    if (!validateGuest()) return;
    var btn = el("#bwToStep3");
    setBusy(btn, true);
    var payload = {
      checkIn: sel.checkIn, checkOut: sel.checkOut, adults: guests.adults, children: guests.children,
      name: val("#bwName"), email: val("#bwEmail"), phone: val("#bwPhone"),
      country: val("#bwCountry"), specialRequests: val("#bwSpecial"),
      acceptTerms: el("#bwTerms").checked
    };
    var res = await api("/create-booking", { method: "POST", body: JSON.stringify(payload) });
    setBusy(btn, false);
    if (res.status === 201 && res.data.reference) {
      current.reference = res.data.reference;
      current.price = res.data.price || current.price;
      current.holdExpiresAt = res.data.holdExpiresAt;
      renderSummary();
      startHoldTimer();
      showStep(3);
      renderPaymentArea();
    } else if (res.status === 409) {
      toast(t("taken"));
      showStep(1);
      try { var a = await api("/availability"); unavailable = (a.data && a.data.unavailable) || unavailable; } catch (e) {}
      sel.checkOut = null; renderCalendar(); updateRail();
    } else if (res.data && res.data.fields) {
      showGuestErrors(res.data.fields);
    } else {
      toast(res.data.message || t("errGeneric"));
    }
  }

  /* ---------------- guest form ---------------- */
  function buildCountrySelect() {
    var co = el("#bwCountry");
    var opt0 = document.createElement("option"); opt0.value = ""; opt0.textContent = t("selectCountry"); co.appendChild(opt0);
    COUNTRIES.forEach(function (c) { var o = document.createElement("option"); o.value = c; o.textContent = c; co.appendChild(o); });
  }
  function val(s) { var n = el(s); return n ? n.value.trim() : ""; }
  function validateGuest() {
    var ok = true;
    clearErr("#bwName"); clearErr("#bwEmail"); clearErr("#bwPhone"); clearErr("#bwCountry");
    if (!val("#bwName")) { setErr("#bwName", t("required")); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val("#bwEmail"))) { setErr("#bwEmail", t("invalidEmail")); ok = false; }
    if (val("#bwPhone").replace(/[^0-9]/g, "").length < 6) { setErr("#bwPhone", t("invalidPhone")); ok = false; }
    if (!val("#bwCountry")) { setErr("#bwCountry", t("required")); ok = false; }
    if (!el("#bwTerms").checked) { toast(t("mustAccept")); ok = false; }
    return ok;
  }
  function showGuestErrors(fields) {
    if (fields.name) setErr("#bwName", t("required"));
    if (fields.email) setErr("#bwEmail", t("invalidEmail"));
    if (fields.phone) setErr("#bwPhone", t("invalidPhone"));
    if (fields.country) setErr("#bwCountry", t("required"));
    if (fields.acceptTerms) toast(t("mustAccept"));
    showStep(2);
  }
  function setErr(s, msg) {
    var n = el(s); if (!n) return; n.setAttribute("aria-invalid", "true");
    var e = n.parentNode.querySelector(".bw-err"); if (e) { e.textContent = msg; e.classList.add("is-shown"); }
  }
  function clearErr(s) {
    var n = el(s); if (!n) return; n.removeAttribute("aria-invalid");
    var e = n.parentNode.querySelector(".bw-err"); if (e) { e.textContent = ""; e.classList.remove("is-shown"); }
  }

  /* ---------------- summary + payment ---------------- */
  function renderSummary() {
    if (!current.price) return;
    var p = current.price;
    el("#bwSummary").innerHTML =
      row(t("checkin"), fmtDate(sel.checkIn)) +
      row(t("checkout"), fmtDate(sel.checkOut)) +
      row(t("nights"), p.nights) +
      row(t("guestsLbl"), guests.adults + (guests.children ? " + " + guests.children : "")) +
      row(money(p.pricePerNight) + " × " + p.nights, money(p.nightsTotal)) +
      (p.cleaningFee ? row(t("cleaning"), money(p.cleaningFee)) : "") +
      (p.additionalFees ? row("+", money(p.additionalFees)) : "") +
      '<div class="row total"><span>' + t("total") + "</span><span>" + money(p.total) + "</span></div>";
    function row(a, b) { return '<div class="row"><span>' + a + "</span><span><strong>" + b + "</strong></span></div>"; }
  }

  function bindPayments() {
    els('input[name="bwPay"]').forEach(function (r) {
      r.addEventListener("change", renderPaymentArea);
    });
  }

  var paypalRendered = false;
  function renderPaymentArea() {
    var method = (els('input[name="bwPay"]:checked')[0] || {}).value;
    el("#bwPaypalWrap").hidden = method !== "paypal";
    el("#bwNlbWrap").hidden = method !== "nlb";
    if (method === "paypal" && !paypalRendered) initPaypal();
  }

  function initPaypal() {
    paypalRendered = true;
    var demoPaypal = !(settings.paypalClientId);
    if (demoPaypal) {
      // Demo PayPal button (no SDK / no client id).
      var wrap = el("#bwPaypal");
      wrap.innerHTML = "";
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn btn-gold"; b.style.width = "100%";
      b.innerHTML = '<span class="bw-spin"></span><span class="btn-ic">' + t("payPaypal") + " · " + t("demoBadge") + "</span>";
      b.addEventListener("click", function () { payViaApi("paypal", b, true); });
      wrap.appendChild(b);
      el("#bwPayDemoNote").hidden = false;
      el("#bwPayDemoNote").textContent = t("payDemoNote");
      return;
    }
    // Real PayPal SDK
    loadPaypalSdk(settings.paypalClientId, settings.currency).then(function () {
      if (!window.paypal) { toast(t("errGeneric")); return; }
      window.paypal.Buttons({
        style: { color: "gold", shape: "pill", label: "pay" },
        createOrder: async function () {
          var r = await api("/paypal-create-order", { method: "POST", body: JSON.stringify({ reference: current.reference }) });
          if (!r.ok) { toast(r.data.message || t("errGeneric")); throw new Error("create_failed"); }
          return r.data.orderId;
        },
        onApprove: async function (data) {
          var r = await api("/paypal-capture-order", { method: "POST", body: JSON.stringify({ reference: current.reference, orderID: data.orderID }) });
          if (r.ok && r.data.status === "paid") { onPaid(); }
          else { toast(r.data.message || t("errGeneric")); }
        },
        onError: function () { toast(t("errGeneric")); }
      }).render("#bwPaypal");
    }).catch(function () { toast(t("errGeneric")); });
  }

  function loadPaypalSdk(clientId, currency) {
    return new Promise(function (resolve, reject) {
      if (window.paypal) return resolve();
      var s = document.createElement("script");
      s.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(clientId) +
        "&currency=" + encodeURIComponent(currency || "EUR") + "&intent=capture&disable-funding=credit,card";
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Demo PayPal path (and a generic API pay used by demo).
  async function payViaApi(method, btn, isDemo) {
    if (busy) return;
    setBusy(btn, true);
    try {
      var co = await api("/paypal-create-order", { method: "POST", body: JSON.stringify({ reference: current.reference }) });
      if (!co.ok) { toast(co.data.message || t("errGeneric")); return; }
      var cap = await api("/paypal-capture-order", { method: "POST", body: JSON.stringify({ reference: current.reference, orderID: co.data.orderId }) });
      if (cap.ok && cap.data.status === "paid") onPaid();
      else if (cap.status === 410) { toast(t("expired")); showStep(1); }
      else toast(cap.data.message || t("errGeneric"));
    } catch (e) { toast(t("errGeneric")); }
    finally { setBusy(btn, false); }
  }

  function bindNlb() {
    var nbtn = el("#bwNlbBtn");
    if (!nbtn) return;
    nbtn.addEventListener("click", async function () {
      if (busy) return;
      setBusy(nbtn, true);
      var r = await api("/nlb-initiate", { method: "POST", body: JSON.stringify({ reference: current.reference }) });
      if (!r.ok) { setBusy(nbtn, false); toast(r.data.message || t("errGeneric")); if (r.status === 410) showStep(1); return; }
      if (r.data.live && r.data.actionUrl && r.data.fields) {
        // Auto-POST a form to the bank gateway.
        var f = document.createElement("form"); f.method = "POST"; f.action = r.data.actionUrl;
        Object.keys(r.data.fields).forEach(function (k) {
          var inp = document.createElement("input"); inp.type = "hidden"; inp.name = k; inp.value = r.data.fields[k]; f.appendChild(inp);
        });
        document.body.appendChild(f); f.submit();
      } else if (r.data.redirectUrl) {
        window.location.href = r.data.redirectUrl; // demo simulated bank -> /api/nlb-return
      } else { setBusy(nbtn, false); toast(t("errGeneric")); }
    });
  }

  function onPaid() {
    if (holdTimer) clearInterval(holdTimer);
    var s = el("#bwSuccess");
    el("#bwSuccessRef").textContent = current.reference;
    el("#bwSuccessLink").href = "/booking-result.html?ref=" + encodeURIComponent(current.reference);
    [1, 2, 3].forEach(function (i) { var p = el("#bwStep" + i); if (p) p.hidden = true; });
    els(".bw-step-tab").forEach(function (tb) { tb.classList.add("is-done"); tb.classList.remove("is-active"); });
    s.hidden = false;
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------------- hold timer ---------------- */
  function startHoldTimer() {
    if (holdTimer) clearInterval(holdTimer);
    var tEl = el("#bwHoldTimer");
    if (!current.holdExpiresAt) { tEl.hidden = true; return; }
    tEl.hidden = false;
    function tick() {
      var ms = new Date(current.holdExpiresAt).getTime() - Date.now();
      if (ms <= 0) {
        clearInterval(holdTimer);
        tEl.innerHTML = t("expired");
        toast(t("expired"));
        showStep(1);
        return;
      }
      var m = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000);
      tEl.innerHTML = t("holdNote") + " <strong>" + m + ":" + pad(sec) + "</strong>";
    }
    tick();
    holdTimer = setInterval(tick, 1000);
  }

  bindNlb();
})();
