(function () {
  "use strict";

  var CONSENT_KEY = "brisbane_tvs_analytics_consent_v1";
  var ATTRIBUTION_KEY = "brisbane_tvs_session_attribution_v1";
  var CONFIG_ENDPOINT = "/analytics-config";
  var ATTRIBUTION_FIELDS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
  ];
  var GA_CAMPAIGN_FIELDS = {
    utm_source: "campaign_source",
    utm_medium: "campaign_medium",
    utm_campaign: "campaign_name",
    utm_term: "campaign_term",
    utm_content: "campaign_content",
    utm_id: "campaign_id",
  };
  var tagRequested = false;
  var analyticsReady = false;
  var queuedEvents = [];
  var startedForms = typeof WeakSet === "function" ? new WeakSet() : null;
  var erroredForms = typeof WeakSet === "function" ? new WeakSet() : null;
  var calculatorTracked = false;
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

  function cleanAttributionValue(value, maximumLength) {
    if (typeof value !== "string") return "";
    return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maximumLength);
  }

  function cleanLandingPath(value) {
    if (typeof value !== "string" || !value.startsWith("/") || /[?#\r\n]/.test(value)) return "";
    return value.slice(0, 512);
  }

  function cleanReferrer(value) {
    if (!value) return "";
    try {
      var referrer = new URL(value);
      if (referrer.protocol !== "https:" && referrer.protocol !== "http:") return "";
      return (referrer.origin + referrer.pathname).slice(0, 512);
    } catch (_) {
      return "";
    }
  }

  function inferredPlatform(params, referrer) {
    var source = cleanAttributionValue(params.get("utm_source") || "", 80).toLowerCase();
    if (source === "ig" || source.indexOf("instagram") !== -1) return "instagram";
    if (source === "fb" || source.indexOf("facebook") !== -1) return "facebook";
    if (source.indexOf("meta") !== -1) return "meta";

    try {
      var hostname = referrer ? new URL(referrer).hostname.toLowerCase() : "";
      if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) return "instagram";
      if (hostname === "facebook.com" || hostname.endsWith(".facebook.com")) return "facebook";
    } catch (_) {
      // The sanitised referrer is optional.
    }

    return params.has("fbclid") ? "meta" : "";
  }

  function attributionFromPage() {
    var params = new URLSearchParams(window.location.search);
    var attribution = {
      landing_page: cleanLandingPath(window.location.pathname),
      referrer: cleanReferrer(document.referrer),
    };

    ATTRIBUTION_FIELDS.forEach(function (key) {
      var value = cleanAttributionValue(params.get(key) || "", key === "utm_id" ? 160 : 200);
      if (value) attribution[key] = value;
    });

    var platform = inferredPlatform(params, attribution.referrer);
    if (platform) attribution.source_platform = platform;
    return attribution;
  }

  function readStoredAttribution() {
    try {
      var value = window.sessionStorage.getItem(ATTRIBUTION_KEY);
      var parsed = value ? JSON.parse(value) : null;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function writeStoredAttribution(value) {
    try {
      window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
    } catch (_) {
      // Current-page attribution still works when session storage is blocked.
    }
  }

  function captureAttribution() {
    var current = attributionFromPage();
    var stored = readStoredAttribution();
    var hasCampaignTouch = ATTRIBUTION_FIELDS.some(function (key) { return Boolean(current[key]); })
      || Boolean(current.source_platform);

    if (!stored || hasCampaignTouch) {
      writeStoredAttribution(current);
      return current;
    }

    return stored;
  }

  function gaCampaignConfig(attribution) {
    var config = {};
    Object.keys(GA_CAMPAIGN_FIELDS).forEach(function (utmKey) {
      var value = cleanAttributionValue(
        attribution && attribution[utmKey] || "",
        utmKey === "utm_id" ? 160 : 200,
      );
      var containsPii = /@|https?:\/\/|www\.|(?:email|phone|mobile|name|address|postcode)\s*[:=]/i.test(value)
        || /(?:^|\D)(?:\+?61|0)4(?:[\s().-]*\d){8}(?:\D|$)/.test(value);
      if (containsPii) value = "";
      if (value) config[GA_CAMPAIGN_FIELDS[utmKey]] = value;
    });
    return config;
  }

  window.brisbaneAttribution = function () {
    return Object.assign({}, captureAttribution());
  };

  window.brisbaneNewSubmissionId = function () {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "web-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
  };

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

  function pageType() {
    var first = window.location.pathname.split("/").filter(Boolean)[0] || "home";
    return cleanAttributionValue(first.replace(/[^a-z0-9_-]/gi, "_"), 40) || "other";
  }

  function ctaLocation(element) {
    if (element.closest("footer")) return "footer";
    if (element.closest(".mobile-menu, [data-mobile-menu]")) return "mobile_menu";
    if (element.closest("header, .main-header, .top-bar")) return "header";
    if (element.closest(".ai-chat-panel, .ai-badge-wrapper, .floating-call-btn")) return "chat_widget";
    if (element.closest("#pricingCalculator, .pricing-section")) return "pricing";
    return "page_content";
  }

  function formLabel(form) {
    var value = form.getAttribute("data-analytics-form") || form.id || form.className || "form";
    return cleanAttributionValue(String(value).replace(/[^a-z0-9_-]+/gi, "_"), 60) || "form";
  }

  function trackPublicInteraction(event) {
    var target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (!calculatorTracked && target.closest("#pricingCalculator")) {
      calculatorTracked = true;
      window.brisbaneTrack("pricing_calculator_use", { page_type: pageType() });
    }

    if (target.closest("#aiBadge")) {
      window.brisbaneTrack("chat_open", { page_type: pageType(), cta_location: "chat_widget" });
    } else if (target.closest("#aiChatSend")) {
      window.brisbaneTrack("chat_message", { page_type: pageType(), cta_location: "chat_widget" });
    }

    var link = target.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href") || "";
    var params = { page_type: pageType(), cta_location: ctaLocation(link) };

    if (/^tel:/i.test(href)) {
      window.brisbaneTrack("click_to_call", params);
      return;
    }
    if (/^mailto:/i.test(href)) {
      window.brisbaneTrack("click_email", params);
      return;
    }
    if ((link.getAttribute("rel") || "").split(/\s+/).includes("sponsored")) {
      window.brisbaneTrack("affiliate_click", params);
      return;
    }

    try {
      var destination = new URL(link.href, window.location.href);
      if (destination.origin === window.location.origin
        && (destination.pathname === "/quote/" || destination.hash === "#pricing")) {
        window.brisbaneTrack("quote_cta_click", params);
      }
    } catch (_) {
      // Ignore malformed, non-navigation href values.
    }
  }

  function measurementIdIsValid(value) {
    return typeof value === "string" && /^G-[A-Z0-9]+$/i.test(value);
  }

  function installTag(measurementId) {
    if (tagRequested || !measurementIdIsValid(measurementId)) return;
    tagRequested = true;
    window.gtag = gtag;
    gtag("consent", "default", deniedConsent);
    gtag("js", new Date());

    var gaConfig = Object.assign({
      send_page_view: true,
      page_location: window.location.origin + window.location.pathname,
      page_referrer: cleanReferrer(document.referrer),
    }, gaCampaignConfig(captureAttribution()));

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    script.onload = function () {
      gtag("consent", "update", grantedConsent);
      gtag("config", measurementId, gaConfig);
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
    captureAttribution();
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

  document.addEventListener("click", trackPublicInteraction);

  document.addEventListener("focusin", function (event) {
    var target = event.target instanceof Element ? event.target : null;
    var form = target ? target.closest("form") : null;
    if (!form || (startedForms && startedForms.has(form))) return;
    if (startedForms) startedForms.add(form);
    window.brisbaneTrack("form_start", { form_type: formLabel(form), page_type: pageType() });
  });

  document.addEventListener("input", function (event) {
    var target = event.target instanceof Element ? event.target : null;
    var form = target ? target.closest("form") : null;
    if (form && erroredForms) erroredForms.delete(form);
  });

  document.addEventListener("invalid", function (event) {
    var target = event.target instanceof Element ? event.target : null;
    var form = target ? target.closest("form") : null;
    if (!form || (erroredForms && erroredForms.has(form))) return;
    if (erroredForms) erroredForms.add(form);
    window.brisbaneTrack("form_error", { form_type: formLabel(form), page_type: pageType() });
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
