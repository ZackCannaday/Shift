export const EMBED_SCRIPT = `(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var apiKey = script.getAttribute('data-shift-key');
  var autoMode = script.getAttribute('data-shift-auto') !== 'false';
  var startedAt = Date.now();

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

  var CACHE_KEY = 'shift_r_' + apiKey.slice(-8);
  attachTracking();
  try {
    var cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      dispatch(JSON.parse(cached));
      return;
    }
  } catch (e) {}

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
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch (e) {}
      dispatch(result);
    })
    .catch(function (err) {
      console.warn('[Shift] Detection error:', err.message);
    });

  function dispatch(result) {
    window.Shift = Object.assign({}, result, { track: track });
    try {
      window.dispatchEvent(new CustomEvent('shift:ready', { detail: result, bubbles: false }));
    } catch (e) {}
    if (autoMode) applyAuto(result);
  }

  function track(name) {
    sendEvent({ event: 'conversion', name: String(name || 'conversion').slice(0, 100) });
  }

  function sendEvent(event) {
    fetch(apiBase + '/api/embed/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ key: apiKey, sessionId: sessionId }, event)),
      keepalive: true,
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
