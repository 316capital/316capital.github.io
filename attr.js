/* 316 Capital site attribution v1 (18 Sep 2026).
   First touch is captured once per browser on 316cap.com and carried across to apply / fullapp /
   estimate / vault on click, so a visitor who arrived from a ChatGPT answer, a Google ad or a
   Facebook post is still that visitor when the form lands in the Desk. No cookies, no vendors. */
(function (w, d) {
  'use strict';
  var KEY = 'kt_first_touch', TRACK = 'https://tejxacuehbhssqougufr.supabase.co/functions/v1/marketing-track';
  var KEEP = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'msclkid', 'kt_link'];
  var CARRY_HOSTS = /(^|\.)(apply|fullapp|estimate|vault)\.316cap\.com$/i;
  var AI = [[/chatgpt\.com|chat\.openai\.com|openai\.com/i, 'chatgpt'], [/perplexity\.ai/i, 'perplexity'], [/gemini\.google\.com|bard\.google/i, 'gemini'], [/claude\.ai|anthropic\.com/i, 'claude'], [/copilot\.microsoft|bing\.com\/chat/i, 'copilot']];
  var ENGINES = [[/(^|\.)google\./i, 'google'], [/(^|\.)bing\.com$/i, 'bing'], [/duckduckgo\.com$/i, 'duckduckgo'], [/(^|\.)yahoo\./i, 'yahoo']];
  var SOCIAL = [[/facebook\.com|fb\.com|l\.facebook/i, 'facebook'], [/instagram\.com|l\.instagram/i, 'instagram'], [/linkedin\.com|lnkd\.in/i, 'linkedin'], [/youtube\.com|youtu\.be/i, 'youtube'], [/(^|\.)x\.com$|twitter\.com|t\.co$/i, 'x'], [/tiktok\.com/i, 'tiktok'], [/reddit\.com/i, 'reddit'], [/biggerpockets\.com/i, 'biggerpockets']];
  function uid() { return w.crypto && w.crypto.randomUUID ? w.crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2); }
  function store(k, session) { try { var s = session ? w.sessionStorage : w.localStorage; var v = s.getItem(k); if (!v) { v = uid(); s.setItem(k, v); } return v; } catch (_) { return uid(); } }
  function host(u) { try { return new URL(u).hostname; } catch (_) { return ''; } }
  function match(list, h) { for (var i = 0; i < list.length; i++) if (list[i][0].test(h)) return list[i][1]; return null; }
  function normalize(src) { src = String(src || '').toLowerCase(); if (/chatgpt|openai/.test(src)) return 'chatgpt'; if (/perplexity/.test(src)) return 'perplexity'; if (/gemini/.test(src)) return 'gemini'; if (/claude|anthropic/.test(src)) return 'claude'; if (/^fb$|facebook/.test(src)) return 'facebook'; if (/^ig$|instagram/.test(src)) return 'instagram'; return src; }
  function infer(saved) {
    // A visitor with no UTM still came from somewhere. ChatGPT appends utm_source=chatgpt.com itself;
    // the rest we read off the referrer. Same-site and our own subdomains count as direct.
    var ref = saved.referrer || '', h = host(ref);
    if (!h || /(^|\.)316cap\.com$/i.test(h)) return;
    var s = match(AI, h); if (s) { saved.utm_source = s; saved.utm_medium = 'ai'; return; }
    s = match(ENGINES, h); if (s) { saved.utm_source = s; saved.utm_medium = saved.gclid ? 'cpc' : 'organic'; return; }
    s = match(SOCIAL, h); if (s) { saved.utm_source = s; saved.utm_medium = saved.fbclid ? 'paid_social' : 'social'; return; }
    saved.utm_source = h.replace(/^www\./, ''); saved.utm_medium = 'referral';
  }
  function capture() {
    var q = new URLSearchParams(w.location.search), saved = {}, fresh = false;
    try { saved = JSON.parse(w.localStorage.getItem(KEY) || '{}') || {}; } catch (_) { }
    if (!saved.landing_url) { fresh = true; saved.landing_url = w.location.href.slice(0, 1000); saved.first_seen = new Date().toISOString(); }
    if (!saved.referrer && d.referrer) saved.referrer = d.referrer.slice(0, 1000);
    KEEP.forEach(function (k) { if (!saved[k] && q.get(k)) saved[k] = q.get(k).slice(0, 300); });
    if (saved.utm_source) saved.utm_source = normalize(saved.utm_source);
    if (!saved.utm_source && (fresh || !saved.inferred)) { infer(saved); saved.inferred = true; }
    if (saved.gclid && !saved.utm_source) { saved.utm_source = 'google'; saved.utm_medium = 'cpc'; }
    if (saved.fbclid && !saved.utm_source) { saved.utm_source = 'facebook'; saved.utm_medium = 'paid_social'; }
    try { w.localStorage.setItem(KEY, JSON.stringify(saved)); } catch (_) { }
    saved.visitor_id = store('kt_visitor', false); saved.session_id = store('kt_session', true);
    return saved;
  }
  function carry(url) {
    var a = capture(), u; try { u = new URL(url, w.location.href); } catch (_) { return url; }
    if (!CARRY_HOSTS.test(u.hostname)) return url;
    KEEP.forEach(function (k) { if (a[k] && !u.searchParams.get(k)) u.searchParams.set(k, a[k]); });
    if (!u.searchParams.get('kt_ref')) u.searchParams.set('kt_ref', (a.landing_url || '').slice(0, 300));
    return u.toString();
  }
  function decorate(a) { if (!a || !a.href || a.getAttribute('data-kt-carried')) return; var next = carry(a.href); if (next !== a.href) { a.href = next; a.setAttribute('data-kt-carried', '1'); } }
  function pageView() {
    var a = capture(), k = 'kt_pv_' + a.session_id; try { if (w.sessionStorage.getItem(k)) return; w.sessionStorage.setItem(k, '1'); } catch (_) { }
    var body = { event_type: 'page_view', visitor_id: a.visitor_id, session_id: a.session_id, source: a.utm_source || 'direct', medium: a.utm_medium || null, campaign: a.utm_campaign || null, content: a.utm_content || null, term: a.utm_term || null, click_id: a.gclid || a.fbclid || a.msclkid || null, link_id: a.kt_link || null, landing_url: a.landing_url, referrer: a.referrer || null };
    try { if (navigator.sendBeacon) { navigator.sendBeacon(TRACK, new Blob([JSON.stringify(body)], { type: 'application/json' })); return; } } catch (_) { }
    fetch(TRACK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(function () { });
  }
  // Click-time decoration survives React re-renders; the sweep below covers middle-click and copy-link.
  d.addEventListener('click', function (e) { var a = e.target && e.target.closest ? e.target.closest('a[href]') : null; if (a) decorate(a); }, true);
  d.addEventListener('auxclick', function (e) { var a = e.target && e.target.closest ? e.target.closest('a[href]') : null; if (a) decorate(a); }, true);
  function sweep() { var links = d.querySelectorAll('a[href*=".316cap.com"]'); for (var i = 0; i < links.length; i++) decorate(links[i]); }
  function ready() { capture(); pageView(); sweep(); setTimeout(sweep, 1500); setTimeout(sweep, 5000); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', ready); else ready();
  w.KT_SITE = { firstTouch: capture, carry: carry, utm: function () { var a = capture(), o = {}; KEEP.forEach(function (k) { if (a[k]) o[k] = a[k]; }); if (a.landing_url) o.landing_url = a.landing_url; if (a.referrer) o.first_referrer = a.referrer; o.visitor_id = a.visitor_id; return o; } };
})(window, document);
