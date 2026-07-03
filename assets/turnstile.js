/* ============================================================
   Merdz Cloudflare Turnstile anti-bot layer
   - Launch gate: quick check when the public website opens.
   - Transfer gate: second check ONLY before Request a Transfer / driver SMS.
   - Booking/payment is NOT gated here, per client requirement.
   - Dual hosting: supports Netlify clean endpoints and future PHP .php endpoints.
   ============================================================ */
(function () {
  "use strict";

  var API = "/api";
  var LAUNCH_OK_KEY = "MERDZ_TURNSTILE_LAUNCH_OK";
  var TRANSFER_OK_KEY = "MERDZ_TURNSTILE_TRANSFER_OK_AT";
  var TRANSFER_TOKEN_WINDOW_MS = 4 * 60 * 1000; // Cloudflare tokens expire after 5 min; keep margin.
  var CONFIG_CACHE = null;
  var CONFIG_READY = null;
  var TURNSTILE_READY = null;
  var launchReady = false;
  var launchWaiters = [];
  var originalFetch = window.fetch ? window.fetch.bind(window) : null;

  var T = {
    en: {
      secureAccess: "Secure access",
      launchTitle: "Quick security check",
      launchBody: "Please complete this quick check before entering the website. It helps protect reservations from spam bots.",
      transferTitle: "Transfer request security check",
      transferBody: "Please complete this quick check before sending your transfer request. This protects the driver from spam messages.",
      loading: "Loading protection…",
      verifying: "Verifying…",
      success: "Verified. You can continue.",
      failed: "Verification failed. Please try again.",
      unavailable: "Security check is unavailable right now. Please refresh and try again.",
      protectedBy: "Protected by Cloudflare Turnstile."
    },
    mk: {
      secureAccess: "Безбеден пристап",
      launchTitle: "Брза безбедносна проверка",
      launchBody: "Завршете ја оваа кратка проверка пред да влезете на веб-страната. Ова помага да се заштитат резервациите од спам ботови.",
      transferTitle: "Безбедносна проверка за трансфер",
      transferBody: "Завршете ја оваа кратка проверка пред да го испратите барањето за трансфер. Ова го штити возачот од спам пораки.",
      loading: "Се вчитува заштитата…",
      verifying: "Се проверува…",
      success: "Потврдено. Може да продолжите.",
      failed: "Проверката не успеа. Обидете се повторно.",
      unavailable: "Безбедносната проверка моментално не е достапна. Освежете и обидете се повторно.",
      protectedBy: "Заштитено со Cloudflare Turnstile."
    }
  };

  function lang() {
    return (document.documentElement.lang === "mk") ? "mk" : "en";
  }

  function t(key) {
    return (T[lang()] && T[lang()][key]) || T.en[key] || key;
  }

  function sessionGet(key) {
    try { return sessionStorage.getItem(key) || ""; } catch (e) { return ""; }
  }

  function sessionSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) {}
  }

  function endpoint(path) {
    return API + path;
  }

  async function apiFirst(paths, options) {
    var last = null;
    for (var i = 0; i < paths.length; i++) {
      try {
        var res = await originalFetch(endpoint(paths[i]), options || {});
        last = res;
        if (res.status !== 404) return res;
      } catch (e) {
        last = e;
      }
    }
    if (last && typeof last.status === "number") return last;
    throw last || new Error("request_failed");
  }

  async function jsonFirst(paths, options) {
    var res = await apiFirst(paths, options);
    var data = {};
    try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data: data };
  }

  async function loadConfig() {
    if (CONFIG_CACHE) return CONFIG_CACHE;
    if (CONFIG_READY) return CONFIG_READY;

    CONFIG_READY = jsonFirst(["/turnstile-config", "/turnstile-config.php"], {
      method: "GET",
      headers: { "Accept": "application/json" }
    }).then(function (r) {
      CONFIG_CACHE = {
        enabled: !!(r.ok && r.data && r.data.enabled && r.data.siteKey),
        siteKey: (r.data && r.data.siteKey) || ""
      };
      return CONFIG_CACHE;
    }).catch(function () {
      CONFIG_CACHE = { enabled: false, siteKey: "" };
      return CONFIG_CACHE;
    });

    return CONFIG_READY;
  }

  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve();
    if (TURNSTILE_READY) return TURNSTILE_READY;

    TURNSTILE_READY = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-merdz-turnstile="true"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      s.setAttribute("data-merdz-turnstile", "true");
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

    return TURNSTILE_READY;
  }

  function releaseLaunch() {
    launchReady = true;
    while (launchWaiters.length) launchWaiters.shift()();
  }

  function waitForLaunch() {
    if (launchReady || sessionGet(LAUNCH_OK_KEY) === "1") return Promise.resolve();
    return new Promise(function (resolve) { launchWaiters.push(resolve); });
  }

  function isApiUrl(input, cleanPath) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if (!url) return false;
    var absolute = url.indexOf(location.origin) === 0 ? url.slice(location.origin.length) : url;
    return absolute === API + cleanPath ||
      absolute.indexOf(API + cleanPath + "?") === 0 ||
      absolute === API + cleanPath + ".php" ||
      absolute.indexOf(API + cleanPath + ".php?") === 0;
  }

  function looksLikeTransferApi(input) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if (!url) return false;
    var u = url.indexOf(location.origin) === 0 ? url.slice(location.origin.length) : url;
    if (u.indexOf(API + "/") !== 0) return false;
    return /transfer|transport|driver|sms|twilio/i.test(u);
  }

  function methodOf(init) {
    return String((init && init.method) || "GET").toUpperCase();
  }

  function withTokenBody(init, token) {
    init = init || {};

    if (init.body instanceof FormData) {
      var fd = init.body;
      fd.set("turnstileToken", token);
      fd.set("cf-turnstile-response", token);
      return init;
    }

    if (init.body instanceof URLSearchParams) {
      init.body.set("turnstileToken", token);
      init.body.set("cf-turnstile-response", token);
      return init;
    }

    var body = {};
    if (init.body && typeof init.body === "string") {
      try { body = JSON.parse(init.body); } catch (e) { body = {}; }
    }
    body.turnstileToken = token;
    body["cf-turnstile-response"] = token;

    var headers = new Headers(init.headers || {});
    headers.set("Content-Type", "application/json");

    var next = Object.assign({}, init);
    next.headers = headers;
    next.body = JSON.stringify(body);
    return next;
  }

  function makeOverlay(options) {
    var overlay = document.createElement("div");
    overlay.className = "merdz-turnstile-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    var card = document.createElement("div");
    card.className = "merdz-turnstile-card";
    card.innerHTML = '' +
      '<p class="merdz-turnstile-kicker">' + t("secureAccess") + '</p>' +
      '<h2>' + options.title + '</h2>' +
      '<p>' + options.body + '</p>' +
      '<div class="merdz-turnstile-widget" data-widget></div>' +
      '<div class="merdz-turnstile-status" data-status>' + t("loading") + '</div>' +
      '<div class="merdz-turnstile-note">' + t("protectedBy") + '</div>';

    overlay.appendChild(card);
    return overlay;
  }

  function setStatus(overlay, message, kind) {
    var node = overlay.querySelector("[data-status]");
    if (!node) return;
    node.className = "merdz-turnstile-status" + (kind ? " is-" + kind : "");
    node.textContent = message || "";
  }

  async function challenge(action, mode) {
    var cfg = await loadConfig();
    if (!cfg.enabled) return "";

    await loadTurnstileScript();
    if (!window.turnstile) throw new Error("turnstile_unavailable");

    return new Promise(function (resolve, reject) {
      var overlay = makeOverlay({
        title: action === "transfer" ? t("transferTitle") : t("launchTitle"),
        body: action === "transfer" ? t("transferBody") : t("launchBody")
      });

      function cleanup() {
        try {
          var widgetId = overlay.getAttribute("data-widget-id");
          if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
        } catch (e) {}
        overlay.remove();
        if (action === "launch") {
          document.documentElement.classList.remove("merdz-turnstile-lock");
          document.body.classList.remove("merdz-turnstile-lock");
        }
      }

      function fail(message) {
        setStatus(overlay, message || t("failed"), "error");
        try {
          var widgetId = overlay.getAttribute("data-widget-id");
          if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
        } catch (e) {}
      }

      if (action === "launch") {
        document.documentElement.classList.add("merdz-turnstile-lock");
        document.body.classList.add("merdz-turnstile-lock");
      }

      var append = function () {
        document.body.appendChild(overlay);
        var holder = overlay.querySelector("[data-widget]");
        try {
          var widgetId = window.turnstile.render(holder, {
            sitekey: cfg.siteKey,
            action: action,
            theme: "auto",
            callback: async function (token) {
              if (!token) return fail(t("failed"));

              // Launch tokens are validated immediately to unlock the site.
              // Transfer tokens are passed to the transfer/SMS endpoint and verified server-side.
              if (mode === "server-verify") {
                setStatus(overlay, t("verifying"));
                try {
                  var r = await jsonFirst(["/turnstile-verify", "/turnstile-verify.php"], {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: token, action: action })
                  });
                  if (!r.ok || !r.data || !r.data.success) return fail(t("failed"));
                  setStatus(overlay, t("success"), "ok");
                  setTimeout(function () { cleanup(); resolve(token); }, 220);
                } catch (e) {
                  fail(t("unavailable"));
                }
                return;
              }

              setStatus(overlay, t("success"), "ok");
              setTimeout(function () { cleanup(); resolve(token); }, 180);
            },
            "error-callback": function () { fail(t("failed")); },
            "expired-callback": function () { fail(t("failed")); },
            "timeout-callback": function () { fail(t("failed")); }
          });
          overlay.setAttribute("data-widget-id", widgetId);
          setStatus(overlay, "");
        } catch (e) {
          cleanup();
          reject(e);
        }
      };

      if (document.body) append();
      else document.addEventListener("DOMContentLoaded", append, { once: true });
    });
  }

  async function requireTransferToken() {
    await waitForLaunch();
    var cfg = await loadConfig();
    if (!cfg.enabled) return "";
    var token = await challenge("transfer", "pass-through");
    sessionSet(TRANSFER_OK_KEY, String(Date.now()));
    return token;
  }

  async function startLaunchGate() {
    var cfg = await loadConfig();
    if (!cfg.enabled) {
      releaseLaunch();
      return;
    }

    if (sessionGet(LAUNCH_OK_KEY) === "1") {
      releaseLaunch();
      return;
    }

    try {
      await challenge("launch", "server-verify");
      sessionSet(LAUNCH_OK_KEY, "1");
      releaseLaunch();
    } catch (e) {
      releaseLaunch();
    }
  }

  function textOf(node) {
    return ((node && node.textContent) || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function closestTransferContainer(node) {
    var cur = node;
    while (cur && cur !== document.documentElement) {
      var idc = ((cur.id || "") + " " + (cur.className || "") + " " + (cur.getAttribute && (cur.getAttribute("data-section") || cur.getAttribute("aria-label") || ""))).toLowerCase();
      var txt = textOf(cur);
      if (/transfer|transport|driver|airport/.test(idc)) return cur;
      if ((txt.indexOf("request a transfer") !== -1 || txt.indexOf("airport transfer") !== -1) && txt.length < 2500) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function looksLikeTransferForm(form) {
    if (!form) return false;
    var attr = ((form.id || "") + " " + (form.name || "") + " " + (form.className || "") + " " + (form.action || "")).toLowerCase();
    if (/transfer|transport|driver|sms|airport/.test(attr)) return true;
    return !!closestTransferContainer(form);
  }

  function looksLikeTransferClick(target) {
    var clickable = target && target.closest && target.closest("button, a, [role='button']");
    if (!clickable) return false;

    var attr = ((clickable.id || "") + " " + (clickable.name || "") + " " + (clickable.className || "") + " " + (clickable.getAttribute("href") || "") + " " + (clickable.getAttribute("data-action") || "")).toLowerCase();
    var txt = textOf(clickable);

    if (/transfer|transport|driver|sms/.test(attr)) return true;
    if (/transfer|driver|airport/.test(txt) && /send|request|book|confirm|submit|испрати|побарај/i.test(txt)) return true;
    if ((txt.indexOf("send request") !== -1 || txt.indexOf("open whatsapp") !== -1) && closestTransferContainer(clickable)) return true;
    return false;
  }

  function installTransferDomGate() {
    document.addEventListener("submit", async function (ev) {
      var form = ev.target;
      if (!looksLikeTransferForm(form)) return;
      if (form.getAttribute("data-merdz-turnstile-ok") === "1") {
        form.removeAttribute("data-merdz-turnstile-ok");
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();
      try {
        var token = await requireTransferToken();
        if (token) {
          var input = form.querySelector('input[name="turnstileToken"]');
          if (!input) {
            input = document.createElement("input");
            input.type = "hidden";
            input.name = "turnstileToken";
            form.appendChild(input);
          }
          input.value = token;
        }
        form.setAttribute("data-merdz-turnstile-ok", "1");
        if (form.requestSubmit) form.requestSubmit();
        else form.submit();
      } catch (err) {}
    }, true);

    document.addEventListener("click", async function (ev) {
      if (!looksLikeTransferClick(ev.target)) return;
      var clickable = ev.target.closest("button, a, [role='button']");
      var form = clickable && clickable.closest && clickable.closest("form");
      if (form && looksLikeTransferForm(form)) return; // submit handler handles it.
      if (clickable && clickable.getAttribute("data-merdz-turnstile-ok") === "1") {
        clickable.removeAttribute("data-merdz-turnstile-ok");
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();
      try {
        await requireTransferToken();
        if (!clickable) return;
        clickable.setAttribute("data-merdz-turnstile-ok", "1");
        var href = clickable.getAttribute("href");
        if (href && href !== "#") {
          window.location.href = href;
        } else {
          clickable.click();
        }
      } catch (err) {}
    }, true);
  }

  if (originalFetch) {
    window.fetch = async function (input, init) {
      init = init || {};

      // Keep calendar/API quiet until launch gate is passed.
      if (isApiUrl(input, "/availability")) {
        await waitForLaunch();
      }

      // IMPORTANT: No create-booking/payment CAPTCHA here.
      // Only transfer/SMS/driver endpoints get the second token.
      if (looksLikeTransferApi(input) && methodOf(init) !== "GET") {
        var cfg = await loadConfig();
        if (cfg.enabled) {
          var token = await requireTransferToken();
          init = withTokenBody(init, token);
        }
      }

      return originalFetch(input, init);
    };
  }

  installTransferDomGate();
  startLaunchGate();
})();
