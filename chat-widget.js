/* 316 Capital website chat widget
 *
 * Self contained. No framework, no build step, no dependencies. Drops onto the site with
 * one script tag.
 *
 * Deliberately NOT React, even though 316cap.com is a Vite React SPA:
 *  - It appends to document.body, not into #root. React's createRoot().render() WIPES #root
 *    on hydration, which is the exact behaviour scripts/seo-inject.js relies on for crawler
 *    fallback content. A widget mounted inside #root would be erased on load.
 *  - As standalone JS it drops onto any page, including ones outside this build.
 *  - React plus ReactDOM is about 45KB gzipped before you write a component. The site
 *    already pays that once; a chat box should not make it pay twice.
 *
 * Other design notes that are not cosmetic:
 *  - The capture step is ONE card with three fields, not three chat questions. Contact
 *    details first and "as seamless as possible" pull against each other: asking name, then
 *    email, then phone as separate turns is three chances to close the tab. One card is one
 *    decision.
 *  - The SMS consent checkbox is unticked by default and the exact wording is stored server
 *    side with a timestamp. Under the TCPA a pre-ticked box is not consent.
 *  - Phone is optional. Email is not. A visitor who will not give a number is still a lead.
 *  - No localStorage. Session id lives in memory for the page view.
 */
(function () {
  "use strict";

  var API = "https://tejxacuehbhssqougufr.supabase.co/functions/v1/web-chat";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlanhhY3VlaGJoc3Nxb3VndWZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDY0NDUsImV4cCI6MjA5MDQ4MjQ0NX0.1T_3VP6WZH1E2oZ-4qS1O0eGXucZ9DBONvPrJadrC0U";

  var sessionId = null;
  var busy = false;
  var opened = false;

  var CSS = [
    "#c316{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif}",
    "#c316 *{box-sizing:border-box}",
    "#c316-btn{display:flex;align-items:center;gap:10px;background:#0b1f3a;color:#fff;border:0;border-radius:999px;padding:14px 22px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 8px 30px rgba(11,31,58,.28)}",
    "#c316-btn:hover{background:#132c52}",
    "#c316-panel{display:none;flex-direction:column;width:390px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 100px);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 70px rgba(11,31,58,.3);border:1px solid #e3e8ef}",
    "#c316.open #c316-panel{display:flex}",
    "#c316.open #c316-btn{display:none}",
    "#c316-hd{background:#0b1f3a;color:#fff;padding:16px 18px;display:flex;justify-content:space-between;align-items:center}",
    "#c316-hd h4{margin:0;font-size:15px;font-weight:600}",
    "#c316-hd p{margin:3px 0 0;font-size:12px;opacity:.72}",
    "#c316-x{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;opacity:.7;line-height:1;padding:0 4px}",
    "#c316-log{flex:1;overflow-y:auto;padding:18px;background:#f7f9fc}",
    ".c316-m{margin-bottom:14px;display:flex}",
    ".c316-m.v{justify-content:flex-end}",
    ".c316-b{max-width:84%;padding:11px 14px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}",
    ".c316-m.b .c316-b{background:#fff;color:#12203a;border:1px solid #e3e8ef;border-bottom-left-radius:4px}",
    ".c316-m.v .c316-b{background:#0b1f3a;color:#fff;border-bottom-right-radius:4px}",
    "#c316-form{padding:14px;background:#fff;border-top:1px solid #e9edf3}",
    "#c316-form input[type=text],#c316-form input[type=email],#c316-form input[type=tel]{width:100%;padding:10px 12px;margin-bottom:8px;border:1px solid #d7dee8;border-radius:9px;font-size:14px;font-family:inherit}",
    "#c316-form input:focus{outline:none;border-color:#0b1f3a}",
    ".c316-row{display:flex;gap:8px}",
    ".c316-row input{flex:1}",
    ".c316-consent{display:flex;gap:9px;align-items:flex-start;margin:4px 0 10px;font-size:11px;color:#5b6880;line-height:1.45}",
    ".c316-consent input{margin-top:2px;flex-shrink:0}",
    "#c316-go{width:100%;background:#0b1f3a;color:#fff;border:0;border-radius:9px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}",
    "#c316-go:disabled{opacity:.5;cursor:default}",
    "#c316-bar{display:flex;gap:8px;padding:12px 14px;background:#fff;border-top:1px solid #e9edf3}",
    "#c316-in{flex:1;padding:11px 13px;border:1px solid #d7dee8;border-radius:9px;font-size:14px;font-family:inherit;resize:none;max-height:90px}",
    "#c316-in:focus{outline:none;border-color:#0b1f3a}",
    "#c316-send{background:#0b1f3a;color:#fff;border:0;border-radius:9px;padding:0 17px;font-size:14px;font-weight:600;cursor:pointer}",
    "#c316-send:disabled{opacity:.45;cursor:default}",
    "#c316-foot{padding:8px 14px 12px;font-size:10.5px;color:#93a0b5;text-align:center;background:#fff}",
    ".c316-dots span{display:inline-block;width:6px;height:6px;margin-right:3px;background:#9fb0c9;border-radius:50%;animation:c316b 1.2s infinite}",
    ".c316-dots span:nth-child(2){animation-delay:.15s}.c316-dots span:nth-child(3){animation-delay:.3s}",
    "@keyframes c316b{0%,60%,100%{opacity:.25}30%{opacity:1}}",
    "@media(max-width:480px){#c316{right:12px;bottom:12px}#c316-panel{width:calc(100vw - 24px);height:calc(100vh - 90px)}}"
  ].join("");

  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }

  var root = el(
    '<div id="c316">' +
      '<button id="c316-btn" aria-label="Chat with 316 Capital">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5A8.4 8.4 0 0 1 21 11.5z"/></svg>' +
        "Finance a deal</button>" +
      '<div id="c316-panel" role="dialog" aria-label="316 Capital chat">' +
        '<div id="c316-hd"><div><h4>316 Capital</h4><p>Private lending for real estate investors</p></div>' +
          '<button id="c316-x" aria-label="Close">&times;</button></div>' +
        '<div id="c316-log"></div>' +
        '<div id="c316-form"></div>' +
        '<div id="c316-foot">Business purpose investment loans only. Not available for primary residences.</div>' +
      "</div></div>"
  );

  var style = document.createElement("style"); style.textContent = CSS;
  document.head.appendChild(style); document.body.appendChild(root);

  var log = root.querySelector("#c316-log");
  var formArea = root.querySelector("#c316-form");

  function push(role, text) {
    var m = el('<div class="c316-m ' + (role === "visitor" ? "v" : "b") + '"><div class="c316-b"></div></div>');
    m.querySelector(".c316-b").textContent = text;
    log.appendChild(m); log.scrollTop = log.scrollHeight;
    return m;
  }
  function thinking() {
    var m = el('<div class="c316-m b"><div class="c316-b c316-dots"><span></span><span></span><span></span></div></div>');
    log.appendChild(m); log.scrollTop = log.scrollHeight; return m;
  }

  function api(payload) {
    return fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + ANON },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function utm() {
    var p = new URLSearchParams(location.search), o = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]
      .forEach(function (k) { if (p.get(k)) o[k] = p.get(k); });
    return o;
  }

  // Step 1: one card, three fields. Not three questions.
  function renderCapture() {
    formArea.innerHTML =
      '<div class="c316-row"><input type="text" id="c316-fn" placeholder="First name" autocomplete="given-name">' +
      '<input type="text" id="c316-ln" placeholder="Last name" autocomplete="family-name"></div>' +
      '<input type="email" id="c316-em" placeholder="Email" autocomplete="email">' +
      '<input type="tel" id="c316-ph" placeholder="Mobile (optional)" autocomplete="tel">' +
      '<label class="c316-consent"><input type="checkbox" id="c316-cs">' +
      "<span>Text me about this deal. Message and data rates may apply, reply STOP to opt out. " +
      'We never share your number. <a href="/sms-consent" target="_blank" style="color:#0b1f3a">Details</a></span></label>' +
      '<button id="c316-go">Continue</button>';

    var go = formArea.querySelector("#c316-go");
    go.onclick = function () {
      var fn = formArea.querySelector("#c316-fn").value.trim();
      var em = formArea.querySelector("#c316-em").value.trim();
      var ph = formArea.querySelector("#c316-ph").value.trim();
      if (!fn || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
        push("bot", "I need a first name and a working email so I can send your terms.");
        return;
      }
      go.disabled = true; go.textContent = "One moment";
      push("visitor", fn + (ph ? "  |  " + em + "  |  " + ph : "  |  " + em));
      var t = thinking();
      api({
        action: "capture", session_id: sessionId,
        first_name: fn, last_name: formArea.querySelector("#c316-ln").value.trim(),
        email: em, phone: ph, sms_consent: formArea.querySelector("#c316-cs").checked
      }).then(function (r) {
        t.remove();
        push("bot", r.reply || "Thanks. What are you working on?");
        renderChat();
      }).catch(function () {
        t.remove(); go.disabled = false; go.textContent = "Continue";
        push("bot", "That did not go through. Email info@316cap.com and we will pick it up.");
      });
    };
  }

  // Step 2: normal conversation. The server decides which qualification slot each answer
  // fills, so the client deliberately sends no state beyond the message itself.
  function renderChat() {
    formArea.outerHTML = '<div id="c316-bar"><textarea id="c316-in" rows="1" placeholder="Type your answer"></textarea>' +
      '<button id="c316-send">Send</button></div>';
    var bar = root.querySelector("#c316-bar");
    var input = bar.querySelector("#c316-in");
    var send = bar.querySelector("#c316-send");

    function submit() {
      var text = input.value.trim();
      if (!text || busy) return;
      busy = true; send.disabled = true;
      push("visitor", text); input.value = ""; input.style.height = "auto";
      var t = thinking();
      api({ action: "message", session_id: sessionId, text: text })
        .then(function (r) {
          t.remove();
          push("bot", r.reply || "Sorry, say that again?");
          if (r.step === "done") { input.placeholder = "Anything else?"; }
        })
        .catch(function () {
          t.remove();
          push("bot", "Connection dropped. Call +1 (617) 546-4817 or email info@316cap.com.");
        })
        .then(function () { busy = false; send.disabled = false; input.focus(); });
    }
    send.onclick = submit;
    input.onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } };
    input.oninput = function () { this.style.height = "auto"; this.style.height = Math.min(this.scrollHeight, 90) + "px"; };
    input.focus();
  }

  function open() {
    root.classList.add("open");
    if (opened) return;
    opened = true;
    var t = thinking();
    api({ action: "start", page: location.href, referrer: document.referrer, utm: utm() })
      .then(function (r) {
        t.remove();
        if (!r.ok) { push("bot", r.reply || "Chat is offline. Email info@316cap.com."); return; }
        sessionId = r.session_id;
        push("bot", r.reply);
        renderCapture();
      })
      .catch(function () {
        t.remove();
        push("bot", "Could not connect. Email info@316cap.com or call +1 (617) 546-4817.");
      });
  }

  root.querySelector("#c316-btn").onclick = open;
  root.querySelector("#c316-x").onclick = function () { root.classList.remove("open"); };
})();
