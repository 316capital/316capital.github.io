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
 * BRAND. Colours are lifted from the live stylesheet rather than eyeballed:
 *   navy   #07194c   the primary, and the exact fill of the favicon's background square
 *   gold   #edbf01   the accent, used sparingly so it stays an accent
 *   sand   #f4f1eb   the warm neutral the site uses behind content
 * The logo is /favicon.svg used as-is. Its background rect is #07194c, identical to the
 * header, so the square disappears and the white 316 reads as a floating mark. No new
 * asset, no 11KB of inlined path data, and it stays in sync if the logo is ever replaced.
 *
 * Other design notes that are not cosmetic:
 *  - The capture step is ONE card with three fields, not three chat questions. Contact
 *    details first and "as seamless as possible" pull against each other: asking name, then
 *    email, then phone as separate turns is three chances to close the tab.
 *  - The SMS consent checkbox is unticked by default and the exact wording is stored server
 *    side with a timestamp. Under the TCPA a pre-ticked box is not consent.
 *  - Phone is optional. Email is not. A visitor who will not give a number is still a lead.
 *  - No localStorage. Session id lives in memory for the page view.
 */
(function () {
  "use strict";

  var API = "https://tejxacuehbhssqougufr.supabase.co/functions/v1/web-chat";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlanhhY3VlaGJoc3Nxb3VndWZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDY0NDUsImV4cCI6MjA5MDQ4MjQ0NX0.1T_3VP6WZH1E2oZ-4qS1O0eGXucZ9DBONvPrJadrC0U";

  var NAVY = "#07194c", GOLD = "#edbf01", SAND = "#f4f1eb";
  var LOGO = (document.currentScript && document.currentScript.getAttribute("data-logo")) || "/favicon.svg";

  var sessionId = null, busy = false, opened = false;

  var CSS = [
    "#c316{position:fixed;right:22px;bottom:22px;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif}",
    "#c316 *{box-sizing:border-box}",

    /* Launcher. Gold sits on the underside as a struck rule, not as a fill: the brand uses
       gold as a line, and a solid gold button would read as a warning. */
    "#c316-btn{position:relative;display:flex;align-items:center;gap:11px;background:" + NAVY + ";color:#fff;border:0;border-radius:999px;padding:15px 24px;font-size:15px;font-weight:600;letter-spacing:.01em;cursor:pointer;box-shadow:0 10px 34px rgba(7,25,76,.34);transition:transform .16s ease,box-shadow .16s ease}",
    "#c316-btn:after{content:'';position:absolute;left:24px;right:24px;bottom:9px;height:2px;background:" + GOLD + ";border-radius:2px;opacity:.9}",
    "#c316-btn:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(7,25,76,.42)}",
    "#c316-btn svg{flex-shrink:0}",

    "#c316-panel{display:none;flex-direction:column;width:398px;max-width:calc(100vw - 32px);height:614px;max-height:calc(100vh - 100px);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 28px 80px rgba(7,25,76,.32);border:1px solid rgba(7,25,76,.1)}",
    "#c316.open #c316-panel{display:flex}",
    "#c316.open #c316-btn{display:none}",

    /* Header: logo, wordmark, and the gold rule that ties the whole thing to the site. */
    "#c316-hd{background:" + NAVY + ";color:#fff;padding:17px 18px 15px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid " + GOLD + "}",
    "#c316-id{display:flex;align-items:center;gap:11px;min-width:0}",
    "#c316-logo{width:34px;height:34px;flex-shrink:0;display:block;border-radius:7px}",
    "#c316-mono{width:34px;height:34px;flex-shrink:0;display:none;align-items:center;justify-content:center;border:1.5px solid " + GOLD + ";border-radius:7px;font-size:12px;font-weight:700;letter-spacing:.02em;color:" + GOLD + "}",
    "#c316-hd h4{margin:0;font-size:15px;font-weight:650;letter-spacing:.01em;line-height:1.2}",
    "#c316-hd p{margin:3px 0 0;font-size:11.5px;opacity:.75;line-height:1.3}",
    "#c316-x{background:none;border:0;color:#fff;font-size:24px;cursor:pointer;opacity:.65;line-height:1;padding:0 2px;transition:opacity .15s}",
    "#c316-x:hover{opacity:1}",

    "#c316-log{flex:1;overflow-y:auto;padding:20px 18px;background:" + SAND + "}",
    ".c316-m{margin-bottom:14px;display:flex}",
    ".c316-m.v{justify-content:flex-end}",
    ".c316-b{max-width:85%;padding:12px 15px;border-radius:15px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}",
    ".c316-m.b .c316-b{background:#fff;color:#16224a;border:1px solid rgba(7,25,76,.09);border-bottom-left-radius:5px;box-shadow:0 1px 3px rgba(7,25,76,.05)}",
    ".c316-m.v .c316-b{background:" + NAVY + ";color:#fff;border-bottom-right-radius:5px}",

    "#c316-form{padding:15px;background:#fff;border-top:1px solid rgba(7,25,76,.09)}",
    "#c316-form input[type=text],#c316-form input[type=email],#c316-form input[type=tel]{width:100%;padding:11px 13px;margin-bottom:9px;border:1px solid rgba(7,25,76,.18);border-radius:10px;font-size:14px;font-family:inherit;color:#16224a;transition:border-color .15s,box-shadow .15s}",
    "#c316-form input::placeholder{color:#8e97ab}",
    "#c316-form input:focus{outline:none;border-color:" + NAVY + ";box-shadow:0 0 0 3px rgba(237,191,1,.28)}",
    ".c316-row{display:flex;gap:9px}",
    ".c316-row input{flex:1}",
    ".c316-consent{display:flex;gap:9px;align-items:flex-start;margin:5px 0 12px;font-size:11px;color:#5b6375;line-height:1.5}",
    ".c316-consent input{margin-top:2px;flex-shrink:0;accent-color:" + NAVY + "}",
    ".c316-consent a{color:" + NAVY + ";text-decoration:underline;text-decoration-color:" + GOLD + ";text-underline-offset:2px}",
    "#c316-go{width:100%;background:" + NAVY + ";color:#fff;border:0;border-radius:10px;padding:13px;font-size:14px;font-weight:600;letter-spacing:.01em;cursor:pointer;font-family:inherit;transition:background .15s}",
    "#c316-go:hover:not(:disabled){background:#0a2160}",
    "#c316-go:disabled{opacity:.5;cursor:default}",

    "#c316-bar{display:flex;gap:9px;padding:13px 15px;background:#fff;border-top:1px solid rgba(7,25,76,.09)}",
    "#c316-in{flex:1;padding:12px 14px;border:1px solid rgba(7,25,76,.18);border-radius:10px;font-size:14px;font-family:inherit;color:#16224a;resize:none;max-height:92px;transition:border-color .15s,box-shadow .15s}",
    "#c316-in::placeholder{color:#8e97ab}",
    "#c316-in:focus{outline:none;border-color:" + NAVY + ";box-shadow:0 0 0 3px rgba(237,191,1,.28)}",
    "#c316-send{background:" + NAVY + ";color:#fff;border:0;border-radius:10px;padding:0 18px;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s}",
    "#c316-send:hover:not(:disabled){background:#0a2160}",
    "#c316-send:disabled{opacity:.42;cursor:default}",

    "#c316-foot{padding:9px 15px 13px;font-size:10.5px;color:#8b93a6;text-align:center;background:#fff;line-height:1.45}",
    "#c316-foot b{color:#5b6375;font-weight:600}",

    ".c316-dots span{display:inline-block;width:6px;height:6px;margin-right:4px;background:" + GOLD + ";border-radius:50%;animation:c316b 1.2s infinite}",
    ".c316-dots span:nth-child(2){animation-delay:.15s}.c316-dots span:nth-child(3){animation-delay:.3s}",
    "@keyframes c316b{0%,60%,100%{opacity:.22;transform:translateY(0)}30%{opacity:1;transform:translateY(-2px)}}",
    "#c316-log::-webkit-scrollbar{width:7px}",
    "#c316-log::-webkit-scrollbar-thumb{background:rgba(7,25,76,.16);border-radius:4px}",
    "@media(max-width:480px){#c316{right:12px;bottom:12px}#c316-panel{width:calc(100vw - 24px);height:calc(100vh - 88px)}}",
    "@media(prefers-reduced-motion:reduce){#c316-btn,.c316-dots span{transition:none;animation:none}}"
  ].join("");

  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }

  var root = el(
    '<div id="c316">' +
      '<button id="c316-btn" aria-label="Chat with 316 Capital">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5A8.4 8.4 0 0 1 21 11.5z"/></svg>' +
        "Finance a deal</button>" +
      '<div id="c316-panel" role="dialog" aria-label="316 Capital chat">' +
        '<div id="c316-hd">' +
          '<div id="c316-id">' +
            '<img id="c316-logo" src="' + LOGO + '" alt="">' +
            '<div id="c316-mono">316</div>' +
            '<div><h4>316 Capital</h4><p>Private lending for real estate investors</p></div>' +
          "</div>" +
          '<button id="c316-x" aria-label="Close">&times;</button></div>' +
        '<div id="c316-log"></div>' +
        '<div id="c316-form"></div>' +
        '<div id="c316-foot"><b>Business purpose investment loans only.</b> Not available for primary residences.</div>' +
      "</div></div>"
  );

  var style = document.createElement("style"); style.textContent = CSS;
  document.head.appendChild(style); document.body.appendChild(root);

  // If the logo cannot load, fall back to a gold-ruled monogram rather than a broken image.
  var logoImg = root.querySelector("#c316-logo");
  logoImg.onerror = function () {
    logoImg.style.display = "none";
    root.querySelector("#c316-mono").style.display = "flex";
  };

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
      'We never share your number. <a href="/sms-consent" target="_blank" rel="noopener">Details</a></span></label>' +
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
    input.oninput = function () { this.style.height = "auto"; this.style.height = Math.min(this.scrollHeight, 92) + "px"; };
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
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && root.classList.contains("open")) root.classList.remove("open");
  });
})();
