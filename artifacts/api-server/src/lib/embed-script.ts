export const EMBED_SCRIPT = `(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var apiKey = script.getAttribute('data-shift-key');
  var autoMode = script.getAttribute('data-shift-auto') !== 'false';
  var startedAt = Date.now();
  var eventToken = null;
  var eventTokenExpiresAt = 0;
  var refreshTimer = null;
  var requestInFlight = false;
  var pendingEvents = [];

  if (!apiKey) {
    console.warn('[Shift] Missing data-shift-key attribute on the script tag. Get your key at https://useshift.ai/start');
    return;
  }

  var src = script.src || '';
  var apiBase = src.replace(/\\/shift\\.js(\\?.*)?$/, '');

  if (!apiBase) {
    console.warn('[Shift] Could not determine API base URL from script src.');
    return;
  }

  var SESSION_KEY = 'shift_session';
  var sessionId;
  try {
    sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = 'v1_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
      localStorage.setItem(SESSION_KEY, sessionId);
    }
  } catch (e) {
    sessionId = 'tmp_' + Math.random().toString(36).slice(2) + '_' + Date.now();
  }

  function shortHash(value) {
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  var pageScope = window.location.origin + window.location.pathname;
  var CACHE_KEY = 'shift_r_' + shortHash(apiKey) + '_' + shortHash(pageScope);
  var params = new URLSearchParams(window.location.search);
  var w = window.innerWidth;
  var payload = {
    key: apiKey,
    sessionId: sessionId,
    pageUrl: window.location.href,
    pageTitle: document.title,
    referrer: document.referrer || undefined,
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
    userAgent: navigator.userAgent,
    deviceType: w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop',
  };

  attachTracking();
  try {
    var cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      var cachedResult = JSON.parse(cached);
      if (hasUsableAuthorization(cachedResult)) {
        dispatch(cachedResult);
        return;
      }
      sessionStorage.removeItem(CACHE_KEY);
    }
  } catch (e) {}

  requestDetection(false);

  function hasUsableAuthorization(result) {
    return result
      && typeof result.eventToken === 'string'
      && result.eventToken.length >= 64
      && result.eventToken.length <= 1024
      && typeof result.eventTokenExpiresAt === 'number'
      && result.eventTokenExpiresAt * 1000 > Date.now() + 5000;
  }

  function requestDetection(refreshOnly) {
    if (requestInFlight) return;
    requestInFlight = true;
    fetch(apiBase + '/api/embed/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (result) {
        if (!hasUsableAuthorization(result)) throw new Error('Missing event authorization');
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch (e) {}
        if (refreshOnly) setEventAuthorization(result);
        else dispatch(result);
      })
      .catch(function (err) {
        console.warn('[Shift] Detection error:', err.message);
        scheduleAuthorizationRefresh(15000);
      })
      .finally(function () {
        requestInFlight = false;
      });
  }

  function setEventAuthorization(result) {
    eventToken = result.eventToken;
    eventTokenExpiresAt = result.eventTokenExpiresAt;
    scheduleAuthorizationRefresh(Math.max(1000, eventTokenExpiresAt * 1000 - Date.now() - 30000));
    flushPendingEvents();
  }

  function scheduleAuthorizationRefresh(delay) {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(function () {
      requestDetection(true);
    }, Math.min(Math.max(delay, 1000), 2147483647));
  }

  function dispatch(result) {
    setEventAuthorization(result);
    var publicResult = Object.assign({}, result);
    delete publicResult.eventToken;
    delete publicResult.eventTokenExpiresAt;
    window.Shift = Object.assign({}, publicResult, { track: track });
    try {
      window.dispatchEvent(new CustomEvent('shift:ready', { detail: publicResult, bubbles: false }));
    } catch (e) {}
    if (autoMode) applyAuto(publicResult);
  }

  function track(name) {
    sendEvent({ event: 'conversion', name: String(name || 'conversion').slice(0, 100) });
  }

  function authorizationIsCurrent() {
    return typeof eventToken === 'string' && eventTokenExpiresAt * 1000 > Date.now() + 1000;
  }

  function queueEvent(event) {
    if (pendingEvents.length >= 10) pendingEvents.shift();
    pendingEvents.push(event);
  }

  function flushPendingEvents() {
    if (!authorizationIsCurrent()) return;
    var queued = pendingEvents.splice(0, pendingEvents.length);
    for (var i = 0; i < queued.length; i++) sendAuthorizedEvent(queued[i]);
  }

  function sendEvent(event) {
    if (!authorizationIsCurrent()) {
      queueEvent(event);
      requestDetection(true);
      return;
    }
    sendAuthorizedEvent(event);
  }

  function sendAuthorizedEvent(event) {
    var submittedToken = eventToken;
    fetch(apiBase + '/api/embed/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ key: apiKey, sessionId: sessionId, eventToken: submittedToken }, event)),
      keepalive: true,
    }).then(function (response) {
      if (response.status === 401) {
        queueEvent(event);
        if (submittedToken === eventToken) {
          eventToken = null;
          eventTokenExpiresAt = 0;
          try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {}
          requestDetection(true);
        } else {
          flushPendingEvents();
        }
      }
    }).catch(function () {});
  }

  function attachTracking() {
    document.addEventListener('click', function (event) {
      var target = event.target && event.target.closest
        ? event.target.closest('[data-shift-conversion],[data-shift-cta]')
        : null;
      if (!target) return;
      track(target.getAttribute('data-shift-conversion') || 'cta_click');
    });
    window.addEventListener('pagehide', function () {
      sendEvent({ event: 'session_end', timeOnSite: Math.max(0, Math.round((Date.now() - startedAt) / 1000)) });
    });
  }

  function applyAuto(result) {
    function setText(attr, value) {
      if (!value) return;
      var els = document.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < els.length; i++) els[i].textContent = value;
    }
    setText('data-shift-headline', result.headline);
    setText('data-shift-subheadline', result.subheadline);
    setText('data-shift-cta', result.ctaText);
    setText('data-shift-theme', result.funnelTheme);
    setText('data-shift-persona', result.persona);
    if (result.persona) {
      document.body.setAttribute('data-shift-persona', result.persona);
      document.documentElement.className = (document.documentElement.className + ' shift-' + result.persona).trim();
    }
  }
})();
`;
