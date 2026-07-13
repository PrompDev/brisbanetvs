(function () {
  "use strict";

  var CONSENT_KEY = "brisbane_tvs_analytics_consent_v1";
  var CONFIG_ENDPOINT = "/analytics-config";
  var tagRequested = false;
  var analyticsReady = false;
  var queuedEvents = [];
  var deniedConsent = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    ads_data_redaction: true,
  };
  var grantedConsent = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  };

  function getChoice() {
    try {
      return window.localStorage.getItem(CONSENT_KEY);
    } catch (_) {
      return null;
    }
  }

  function setChoice(value) {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch (_) {
      // Analytics remains disabled if the preference cannot be persisted.
    }
  }

  function gtag() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }

  function cleanEventParams(params) {
    if (!params || typeof params !== "object") return {};

    var safe = {};
    Object.keys(params).forEach(function (key) {
      if (!/^[a-z][a-z0-9_]{0,39}$/i.test(key) || /email|phone|name|address|postcode|ip|id/i.test(key)) {
        return;
      }

      var value = params[key];
      if (typeof value === "string" && /^[a-z0-9 _-]{1,80}$/i.test(value)) {
        safe[key] = value;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        safe[key] = value;
      } else if (typeof value === "boolean") {
        safe[key] = value;
      }
    });
    return safe;
  }

  window.brisbaneTrack = function (eventName, params) {
    if (getChoice() !== "granted" || !/^[a-z][a-z0-9_]{0,39}$/i.test(eventName || "")) return;

    var event = { name: eventName, params: cleanEventParams(params) };
    if (analyticsReady) {
      gtag("event", event.name, event.params);
    } else {
      queuedEvents.push(event);
    }
  };

  function flushEvents() {
    queuedEvents.forEach(function (event) {
      gtag("event", event.name, event.params);
    });
    queuedEvents = [];
  }

  function measurementIdIsValid(value) {
    return typeof value === "string" && /^G-[A-Z0-9]+$/i.test(value);
  }

  function installTag(measurementId) {
    if (tagRequested || !measurementIdIsValid(measurementId)) return;
    tagRequested = true;
    window.gtag = gtag;
    gtag("consent", "default", deniedConsent);

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    script.onload = function () {
      gtag("consent", "update", grantedConsent);
      gtag("config", measurementId, { send_page_view: true });
      analyticsReady = true;
      flushEvents();
    };
    document.head.appendChild(script);
  }

  function loadAnalytics() {
    if (tagRequested || getChoice() !== "granted") return;

    window.fetch(CONFIG_ENDPOINT, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (config) {
        if (config && config.enabled === true && measurementIdIsValid(config.measurementId)) {
          installTag(config.measurementId);
        }
      })
      .catch(function () {
        // Do not surface analytics failures to visitors or retry aggressively.
      });
  }

  function deleteAnalyticsCookies() {
    var names = document.cookie.split(";").map(function (cookie) {
      return cookie.trim().split("=")[0];
    });
    var hostname = window.location.hostname;
    var domains = ["", hostname];
    var hostParts = hostname.split(".");

    if (hostParts.length >= 2) domains.push("." + hostParts.slice(-2).join("."));

    names.forEach(function (name) {
      if (!/^_(ga|gac|gid)/i.test(name)) return;
      domains.forEach(function (domain) {
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax" + (domain ? "; domain=" + domain : "");
      });
    });
  }

  function closeBanner() {
    var existing = document.querySelector("[data-analytics-banner]");
    if (existing) existing.remove();
  }

  function choose(value) {
    setChoice(value);
    closeBanner();

    if (value === "granted") {
      loadAnalytics();
      return;
    }

    if (window.gtag) gtag("consent", "update", deniedConsent);
    deleteAnalyticsCookies();
    if (tagRequested) window.location.reload();
  }

  function showBanner() {
    closeBanner();
    var banner = document.createElement("section");
    banner.setAttribute("aria-label", "Analytics preference");
    banner.setAttribute("data-analytics-banner", "");
    banner.style.cssText = "position:fixed;z-index:99999;right:1rem;bottom:1rem;left:1rem;max-width:42rem;margin:0 auto;padding:1rem 1.1rem;border:1px solid #d8d3c9;border-radius:.75rem;background:#fffdf8;color:#182633;box-shadow:0 18px 50px rgba(0,0,0,.18);font:14px/1.5 Inter,Arial,sans-serif;";

    var copy = document.createElement("p");
    copy.style.margin = "0";
    copy.append("With your permission, Brisbane TVs uses Google Analytics to understand how the site is used. We do not send lead details to Analytics. ");
    var privacy = document.createElement("a");
    privacy.href = "/privacy/";
    privacy.textContent = "Privacy details";
    privacy.style.color = "#715728";
    privacy.style.fontWeight = "700";
    copy.append(privacy, ".");

    var actions = document.createElement("div");
    actions.style.cssText = "display:flex;flex-wrap:wrap;gap:.65rem;margin-top:.9rem;";
    var reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "No thanks";
    reject.style.cssText = "cursor:pointer;border:1px solid #abb4ba;border-radius:.4rem;padding:.6rem .8rem;background:#fff;color:#263541;font:inherit;font-weight:700;";
    reject.addEventListener("click", function () { choose("denied"); });
    var accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = "Allow analytics";
    accept.style.cssText = "cursor:pointer;border:1px solid #bd9b5a;border-radius:.4rem;padding:.6rem .8rem;background:#bd9b5a;color:#162330;font:inherit;font-weight:800;";
    accept.addEventListener("click", function () { choose("granted"); });
    actions.append(reject, accept);
    banner.append(copy, actions);
    document.body.append(banner);
  }

  function start() {
    if (getChoice() === "granted") {
      loadAnalytics();
    } else if (getChoice() !== "denied") {
      showBanner();
    }
  }

  document.addEventListener("click", function (event) {
    var target = event.target instanceof Element
      ? event.target.closest("[data-analytics-preferences]")
      : null;
    if (!target) return;
    event.preventDefault();
    showBanner();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
