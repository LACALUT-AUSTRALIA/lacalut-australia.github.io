// Lacalut Chat Widget v2
// <script src="https://lacalut-australia.github.io/chat-widget/lacalut-chat.js" defer></script>

(function () {
  'use strict';

  var WORKER_URL = 'https://lacalut-chat.lacalut.workers.dev';
  var BRAND = '#cf102d';
  var STORE = 'https://lacalut.com.au';

  // ── Symptom intake chips ─────────────────────────────────────────────────────
  var SYMPTOMS = [
    { icon: '🩸', label: 'Bleeding or\nsore gums',   message: 'I have bleeding or sore gums — what do you recommend?' },
    { icon: '😮', label: 'Bad breath',                message: 'I have bad breath and want to treat it at the source — what do you recommend?' },
    { icon: '😬', label: 'Sensitive\nteeth',          message: 'I have sensitive teeth — what product do you recommend?' },
    { icon: '🤔', label: 'Not sure\nwhere to start', message: "I'm not sure which Lacalut product is right for me — can you help?" },
  ];

  // ── Product recommendation cards ─────────────────────────────────────────────
  // Keywords are checked against the bot's reply (case-insensitive).
  // Order matters — more specific first (herbal before aktiv).
  var PRODUCTS = [
    {
      name: 'LACALUT Aktiv Herbal Toothpaste',
      keywords: ['aktiv herbal', 'herbal toothpaste', 'herbal formula'],
      url: STORE + '/products/lacalut%C2%AE-herbal-anti-gingivitis-toothpaste-for-gum-disease',
      img: 'https://cdn.shopify.com/s/files/1/0635/3960/9651/files/11_Herbal_Images_14.png?v=1764801592',
    },
    {
      name: 'LACALUT Aktiv Toothpaste',
      keywords: ['aktiv', 'aktiv toothpaste', 'gingivitis toothpaste', 'bleeding gum', 'gum disease toothpaste'],
      url: STORE + '/products/lacalut%C2%AE-aktiv-anti-gingivitis-toothpaste-for-gum-disease',
      img: 'https://cdn.shopify.com/s/files/1/0635/3960/9651/files/11_Aktiv_Toothpaste_Images_2.png?v=1764814195',
    },
    {
      name: 'LACALUT Flora Toothpaste',
      keywords: ['flora', 'bad breath toothpaste', 'halitosis toothpaste', 'bad breath', 'halitosis'],
      url: STORE + '/products/lacalut%C2%AE-flora-anti-halitosis-toothpaste-for-bad-breath',
      img: 'https://cdn.shopify.com/s/files/1/0635/3960/9651/files/Copy_of_11_Flora_Images_4.png?v=1769556440',
    },
    {
      name: 'LACALUT Aktiv Mouthwash',
      keywords: ['mouthwash', 'aktiv mouthwash', 'gingivitis mouthwash', 'gum mouthwash'],
      url: STORE + '/products/300ml-lacalut%C2%AE-aktiv-anti-gingivitis-gum-repair-mouthwash',
      img: 'https://cdn.shopify.com/s/files/1/0635/3960/9651/files/11_Mouthwash_Images_3.png?v=1775528910',
    },
    {
      name: 'LACALUT Aktiv Toothbrush',
      keywords: ['toothbrush', 'aktiv toothbrush'],
      url: STORE + '/products/lacalut%C2%AE-8x-micro-fine-bristle-gum-repair-toothbrush-for-gingivitis',
      img: 'https://cdn.shopify.com/s/files/1/0635/3960/9651/files/11_Toothbrush_Images_5.png?v=1769558290',
    },
    {
      name: 'LACALUT Sample Pack',
      keywords: ['sample pack', 'sample', 'try first', 'starter pack'],
      url: STORE + '/products/lacalut%C2%AE-aktiv-gingivitis-toothpaste-mouthwash-dental-floss-sample-pack-for-gum-disease',
      img: 'https://cdn.shopify.com/s/files/1/0635/3960/9651/files/11_Bundle_Images_9c7a3968-1d3a-4e64-ab89-0135240ce861.png?v=1776211855',
    },
  ];

  // ── Session state ────────────────────────────────────────────────────────────
  var sessionId = sessionStorage.getItem('lc_sid');
  if (!sessionId) {
    sessionId = 'lc_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
    sessionStorage.setItem('lc_sid', sessionId);
  }

  var isOpen = false;
  var mode = 'home';
  var isBusy = false;
  var captureShown = false;
  var unreadCount = 0;
  var config = {
    greeting: 'Hi! Ask me anything about our products, shipping, or orders.',
    suggested_questions: '["Which product is best for bleeding gums?","How long does shipping take?","What is your return policy?","Do you offer free shipping?","Where can I buy LACALUT in store?"]',
    brand_colour: BRAND,
    proactive_delay: '8000',
  };

  // ── CSS ──────────────────────────────────────────────────────────────────────
  var css = `
    #lc-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 60px; height: 60px; border-radius: 50%;
      background: var(--lc, #cf102d); border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.28);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s;
    }
    #lc-btn:hover { transform: scale(1.1); box-shadow: 0 6px 24px rgba(0,0,0,0.35); }
    #lc-btn svg { width: 28px; height: 28px; fill: #fff; }
    #lc-btn.lc-open .lc-icon-chat { display: none; }
    #lc-btn:not(.lc-open) .lc-icon-close { display: none; }
    #lc-btn.lc-pulse { animation: lc-ring 1.8s ease-out 3; }
    #lc-unread {
      position: absolute; top: -4px; right: -4px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #16a34a; border: 2px solid #fff;
      font-size: 10px; font-weight: 700; color: #fff;
      display: none; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #lc-btn.lc-has-unread #lc-unread { display: flex; }
    @keyframes lc-ring {
      0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(207,16,45,0.5); }
      35%  { transform: scale(1.1); box-shadow: 0 0 0 14px rgba(207,16,45,0); }
      70%  { transform: scale(1); }
      100% { box-shadow: 0 0 0 0 rgba(207,16,45,0); }
    }

    /* Proactive nudge bubble */
    #lc-nudge {
      position: fixed; bottom: 96px; right: 24px; z-index: 99998;
      background: #fff; border-radius: 14px;
      box-shadow: 0 6px 28px rgba(0,0,0,0.18);
      padding: 12px 14px 12px 16px; max-width: 220px;
      display: flex; align-items: center; gap: 8px; cursor: pointer;
      animation: lc-nudge-in 0.35s cubic-bezier(.34,1.2,.64,1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #lc-nudge::after {
      content: ''; position: absolute; bottom: -8px; right: 26px;
      border-left: 8px solid transparent; border-right: 8px solid transparent;
      border-top: 8px solid #fff;
    }
    @keyframes lc-nudge-in {
      from { transform: scale(0.8) translateY(12px); opacity: 0; }
      to   { transform: scale(1) translateY(0); opacity: 1; }
    }
    #lc-nudge-text { font-size: 14px; font-weight: 600; color: #111; flex: 1; line-height: 1.3; }
    #lc-nudge-dismiss {
      background: none; border: none; cursor: pointer; color: #9ca3af;
      font-size: 14px; padding: 2px 0 2px 4px; line-height: 1; flex-shrink: 0;
    }
    #lc-nudge-dismiss:hover { color: #374151; }

    /* Panel */
    #lc-panel {
      position: fixed; bottom: 100px; right: 24px; z-index: 99998;
      width: 380px; height: 580px; max-height: calc(100vh - 120px);
      background: #fff; border-radius: 20px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.2);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transform: scale(0.88) translateY(24px); opacity: 0; pointer-events: none;
      transition: transform 0.28s cubic-bezier(.34,1.2,.64,1), opacity 0.22s ease;
    }
    #lc-panel.lc-open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }

    /* Header */
    #lc-head {
      background: var(--lc, #cf102d); color: #fff;
      padding: 14px 16px; display: flex; align-items: center; gap: 10px; flex-shrink: 0;
    }
    .lc-back-btn {
      background: rgba(255,255,255,0.2); border: none; cursor: pointer; color: #fff;
      width: 32px; height: 32px; border-radius: 50%;
      display: none; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0; transition: background 0.15s;
    }
    .lc-back-btn:hover { background: rgba(255,255,255,0.35); }
    .lc-back-btn.lc-visible { display: flex; }
    .lc-avatar {
      width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center; font-size: 19px; flex-shrink: 0;
    }
    .lc-head-info { flex: 1; }
    .lc-head-name { font-weight: 700; font-size: 15px; }
    .lc-head-status { font-size: 12px; opacity: 0.85; display: flex; align-items: center; gap: 5px; margin-top: 1px; }
    .lc-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; flex-shrink: 0; }
    #lc-close { background: none; border: none; cursor: pointer; color: #fff; opacity: 0.8; font-size: 20px; line-height: 1; padding: 4px; flex-shrink: 0; }
    #lc-close:hover { opacity: 1; }

    /* Home screen */
    #lc-home { flex: 1; overflow-y: auto; padding: 18px 16px 12px; display: flex; flex-direction: column; }
    .lc-greeting-bubble {
      background: #f3f4f6; border-radius: 0 16px 16px 16px;
      padding: 13px 15px; font-size: 14px; line-height: 1.5; color: #111;
      margin-bottom: 18px; align-self: flex-start; max-width: 90%;
    }
    .lc-qa-label { font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 10px; }
    .lc-qa-list { display: flex; flex-direction: column; gap: 8px; }
    .lc-qa-btn {
      width: 100%; background: #fff; border: 1.5px solid #e5e7eb;
      border-radius: 12px; padding: 12px 16px; text-align: left;
      font-size: 14px; color: #111; cursor: pointer; line-height: 1.4;
      transition: border-color 0.15s, background 0.15s, color 0.15s; font-family: inherit;
    }
    .lc-qa-btn:hover { border-color: var(--lc, #cf102d); background: #fff5f5; color: var(--lc, #cf102d); }
    .lc-leave-details { margin-top: 16px; text-align: center; font-size: 13px; color: #9ca3af; }
    .lc-leave-details a { color: var(--lc, #cf102d); text-decoration: none; cursor: pointer; }
    .lc-leave-details a:hover { text-decoration: underline; }

    /* Symptom intake chips */
    .lc-symptom-label { font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: 0.06em; text-transform: uppercase; margin: 0 0 10px; }
    .lc-symptom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }
    .lc-symptom-btn {
      background: #fff; border: 1.5px solid #e5e7eb; border-radius: 12px;
      padding: 10px 10px; text-align: left; font-size: 13px; color: #374151;
      cursor: pointer; line-height: 1.35; font-family: inherit;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
      display: flex; flex-direction: column; gap: 3px;
    }
    .lc-symptom-btn:hover { border-color: var(--lc, #cf102d); background: #fff5f5; box-shadow: 0 2px 8px rgba(207,16,45,0.08); }
    .lc-symptom-icon { font-size: 18px; }
    .lc-symptom-text { font-weight: 600; color: #111; font-size: 12px; }

    /* Chat */
    #lc-chat { flex: 1; overflow-y: auto; padding: 14px 14px 8px; display: flex; flex-direction: column; gap: 10px; }
    .lc-msg { max-width: 84%; padding: 11px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
    .lc-msg-bot { background: #f3f4f6; color: #111; border-bottom-left-radius: 4px; align-self: flex-start; }
    .lc-msg-user { background: var(--lc, #cf102d); color: #fff; border-bottom-right-radius: 4px; align-self: flex-end; }
    .lc-typing { display: flex; gap: 4px; padding: 12px 16px; align-items: center; align-self: flex-start; background: #f3f4f6; border-radius: 16px; border-bottom-left-radius: 4px; }
    .lc-dot { width: 7px; height: 7px; border-radius: 50%; background: #9ca3af; animation: lc-bounce 1.2s infinite ease-in-out; }
    .lc-dot:nth-child(2) { animation-delay: 0.2s; }
    .lc-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes lc-bounce { 0%,80%,100%{transform:scale(0.75);opacity:0.5} 40%{transform:scale(1.1);opacity:1} }

    /* Suggestion chips */
    .lc-suggestions { display: flex; flex-wrap: wrap; gap: 6px; align-self: flex-start; max-width: 100%; animation: lc-fadein 0.2s ease; }
    .lc-chip {
      background: #fff; border: 1.5px solid #e5e7eb; border-radius: 20px;
      padding: 6px 13px; font-size: 13px; color: #374151; cursor: pointer;
      font-family: inherit; transition: border-color 0.15s, background 0.15s, color 0.15s;
      white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis;
    }
    .lc-chip:hover { border-color: var(--lc, #cf102d); background: #fff5f5; color: var(--lc, #cf102d); }

    /* Product cards */
    .lc-product-cards { display: flex; flex-direction: column; gap: 8px; align-self: stretch; animation: lc-fadein 0.2s ease; }
    .lc-product-card {
      display: flex; align-items: center; gap: 12px;
      background: #fff; border: 1.5px solid #e5e7eb; border-radius: 12px;
      padding: 10px 12px; text-decoration: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .lc-product-card:hover { border-color: var(--lc, #cf102d); box-shadow: 0 2px 12px rgba(207,16,45,0.1); }
    .lc-product-img { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #f9fafb; }
    .lc-product-info { flex: 1; min-width: 0; }
    .lc-product-name { font-size: 13px; font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lc-product-cta { font-size: 12px; color: var(--lc, #cf102d); margin-top: 2px; font-weight: 600; }

    @keyframes lc-fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

    /* Lead capture */
    .lc-capture-card {
      background: #f8fafc; border: 1.5px solid #e5e7eb; border-radius: 14px;
      padding: 14px; margin: 4px 0; align-self: stretch;
    }
    .lc-capture-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 10px; }
    .lc-capture-input {
      width: 100%; border: 1.5px solid #e5e7eb; border-radius: 8px;
      padding: 9px 12px; font-size: 13px; margin-bottom: 8px;
      box-sizing: border-box; font-family: inherit; outline: none; transition: border-color 0.15s;
    }
    .lc-capture-input:focus { border-color: var(--lc, #cf102d); }
    .lc-capture-btn {
      width: 100%; background: var(--lc, #cf102d); color: #fff;
      border: none; border-radius: 8px; padding: 10px;
      font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s;
    }
    .lc-capture-btn:hover { background: #a80d24; }
    .lc-capture-thanks { font-size: 13px; color: #16a34a; font-weight: 600; text-align: center; padding: 4px 0; }
    .lc-capture-dismiss { text-align: right; margin-bottom: 6px; }
    .lc-capture-dismiss button { background: none; border: none; font-size: 11px; color: #9ca3af; cursor: pointer; padding: 0; }
    .lc-capture-dismiss button:hover { color: #6b7280; }

    /* Input row */
    #lc-input-row { padding: 10px 12px 14px; border-top: 1px solid #f0f0f0; display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
    #lc-input {
      flex: 1; border: 1.5px solid #e5e7eb; border-radius: 24px;
      padding: 10px 16px; font-size: 14px; outline: none; font-family: inherit;
      transition: border-color 0.15s; resize: none; max-height: 80px; line-height: 1.4;
    }
    #lc-input:focus { border-color: var(--lc, #cf102d); }
    #lc-send {
      width: 40px; height: 40px; border-radius: 50%; background: var(--lc, #cf102d);
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background 0.15s, transform 0.15s;
    }
    #lc-send:hover { background: #a80d24; transform: scale(1.05); }
    #lc-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    #lc-send svg { width: 17px; height: 17px; fill: #fff; }
    #lc-powered { text-align: center; font-size: 11px; color: #d1d5db; padding: 0 0 6px; flex-shrink: 0; }

    @media (max-width: 440px) {
      #lc-panel { width: calc(100vw - 20px); right: 10px; bottom: 90px; }
      #lc-btn, #lc-nudge { right: 10px; }
    }
  `;

  // ── Build DOM ────────────────────────────────────────────────────────────────
  function build() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var btn = el('button', { id: 'lc-btn', 'aria-label': 'Open chat' });
    btn.innerHTML =
      '<svg class="lc-icon-chat" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' +
      '<svg class="lc-icon-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' +
      '<span id="lc-unread" aria-label="New message"></span>';
    btn.onclick = toggle;
    document.body.appendChild(btn);

    var panel = el('div', { id: 'lc-panel', role: 'dialog', 'aria-label': 'Ask Lacalut' });
    panel.innerHTML =
      '<div id="lc-head">' +
        '<button class="lc-back-btn" id="lc-back" aria-label="Back">&#8592;</button>' +
        '<div class="lc-avatar">🦷</div>' +
        '<div class="lc-head-info">' +
          '<div class="lc-head-name">Ask Lacalut</div>' +
          '<div class="lc-head-status"><span class="lc-status-dot"></span>Always here to help</div>' +
        '</div>' +
        '<button id="lc-close" aria-label="Close">&#10005;</button>' +
      '</div>' +
      '<div id="lc-home">' +
        '<div class="lc-greeting-bubble" id="lc-greeting-text">' + config.greeting + '</div>' +
        '<p class="lc-symptom-label">What brings you here today?</p>' +
        '<div class="lc-symptom-grid" id="lc-symptom-grid"></div>' +
        '<div class="lc-qa-label">Quick Questions</div>' +
        '<div class="lc-qa-list" id="lc-qa-list"></div>' +
        '<div class="lc-leave-details">or <a onclick="lcShowHomeCapture()">leave your email for a personal reply</a></div>' +
      '</div>' +
      '<div id="lc-chat" style="display:none"></div>' +
      '<div id="lc-input-row">' +
        '<input id="lc-input" type="text" placeholder="Type a message…" autocomplete="off" />' +
        '<button id="lc-send" aria-label="Send" disabled>' +
          '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
        '</button>' +
      '</div>' +
      '<div id="lc-powered">Powered by Lacalut AI</div>';
    document.body.appendChild(panel);

    document.getElementById('lc-close').onclick = toggle;
    document.getElementById('lc-back').onclick = goHome;

    var input = document.getElementById('lc-input');
    var sendBtn = document.getElementById('lc-send');
    input.addEventListener('input', function () { sendBtn.disabled = !this.value.trim(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !isBusy) { e.preventDefault(); send(); }
    });
    sendBtn.onclick = send;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  // ── Config ───────────────────────────────────────────────────────────────────
  function applyConfig() {
    document.documentElement.style.setProperty('--lc', config.brand_colour || BRAND);
    var greetingEl = document.getElementById('lc-greeting-text');
    if (greetingEl) greetingEl.textContent = config.greeting;

    var grid = document.getElementById('lc-symptom-grid');
    if (grid) {
      grid.innerHTML = '';
      SYMPTOMS.forEach(function (s) {
        var btn = document.createElement('button');
        btn.className = 'lc-symptom-btn';
        btn.innerHTML = '<span class="lc-symptom-icon">' + s.icon + '</span><span class="lc-symptom-text">' + s.label.replace('\n', '<br>') + '</span>';
        btn.onclick = function () { startChat(s.message); };
        grid.appendChild(btn);
      });
    }

    var list = document.getElementById('lc-qa-list');
    if (!list) return;
    list.innerHTML = '';
    try {
      JSON.parse(config.suggested_questions).slice(0, 6).forEach(function (q) {
        var btn = document.createElement('button');
        btn.className = 'lc-qa-btn';
        btn.textContent = q;
        btn.onclick = function () { startChat(q); };
        list.appendChild(btn);
      });
    } catch (e) {}
  }

  // ── Proactive trigger ────────────────────────────────────────────────────────
  function setupProactiveTrigger() {
    var delay = parseInt(config.proactive_delay || '8000', 10);
    if (!delay || sessionStorage.getItem('lc_nudge_shown')) return;
    setTimeout(function () {
      if (isOpen || sessionStorage.getItem('lc_nudge_shown')) return;
      sessionStorage.setItem('lc_nudge_shown', '1');
      showNudge();
    }, delay);
  }

  function showNudge() {
    var nudge = document.createElement('div');
    nudge.id = 'lc-nudge';
    nudge.innerHTML =
      '<span id="lc-nudge-text">🦷 Got a gum question?</span>' +
      '<button id="lc-nudge-dismiss" aria-label="Dismiss">&#10005;</button>';
    document.getElementById('lc-nudge-dismiss').addEventListener('click', function (e) {
      e.stopPropagation();
      nudge.remove();
    });
    nudge.addEventListener('click', function () { nudge.remove(); toggle(); });
    document.body.appendChild(nudge);

    var btn = document.getElementById('lc-btn');
    btn.classList.add('lc-pulse');
    setTimeout(function () { btn.classList.remove('lc-pulse'); }, 6000);
    setTimeout(function () { if (nudge.parentNode) nudge.remove(); }, 10000);
  }

  // ── Open / close ─────────────────────────────────────────────────────────────
  function setUnread(count) {
    unreadCount = count;
    var btn = document.getElementById('lc-btn');
    var badge = document.getElementById('lc-unread');
    if (!btn || !badge) return;
    if (count > 0 && !isOpen) {
      btn.classList.add('lc-has-unread');
      badge.textContent = count > 9 ? '9+' : count;
    } else {
      btn.classList.remove('lc-has-unread');
      badge.textContent = '';
    }
  }

  function toggle() {
    isOpen = !isOpen;
    document.getElementById('lc-panel').classList.toggle('lc-open', isOpen);
    document.getElementById('lc-btn').classList.toggle('lc-open', isOpen);
    var nudge = document.getElementById('lc-nudge');
    if (nudge) nudge.remove();
    if (isOpen) {
      setUnread(0);
      setTimeout(function () { if (mode === 'home') document.getElementById('lc-input').focus(); }, 300);
    }
  }

  function goHome() {
    mode = 'home';
    document.getElementById('lc-home').style.display = 'flex';
    document.getElementById('lc-home').style.flexDirection = 'column';
    document.getElementById('lc-chat').style.display = 'none';
    document.getElementById('lc-back').classList.remove('lc-visible');
  }

  // ── Lead capture ─────────────────────────────────────────────────────────────
  window.lcShowHomeCapture = function () {
    if (document.getElementById('lc-home-capture')) return;
    var card = document.createElement('div');
    card.id = 'lc-home-capture';
    card.className = 'lc-capture-card';
    card.innerHTML =
      '<div class="lc-capture-title">Leave your details and we\'ll get back to you personally.</div>' +
      '<input class="lc-capture-input" id="lc-hcap-email" type="email" placeholder="Email address (optional)" />' +
      '<input class="lc-capture-input" id="lc-hcap-phone" type="tel" placeholder="Phone number (optional)" />' +
      '<button class="lc-capture-btn" onclick="lcSubmitCapture(\'lc-hcap-email\',\'lc-hcap-phone\',\'lc-home-capture\')">Save details</button>';
    document.getElementById('lc-home').appendChild(card);
    card.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('lc-hcap-email').focus();
  };

  window.lcSubmitCapture = function (emailId, phoneId, cardId) {
    var email = (document.getElementById(emailId).value || '').trim();
    var phone = (document.getElementById(phoneId).value || '').trim();
    if (!email && !phone) { document.getElementById(emailId).focus(); return; }
    document.getElementById(cardId).innerHTML = '<div class="lc-capture-thanks">Thanks! We\'ll be in touch soon.</div>';
    fetch(WORKER_URL + '/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, email: email, phone: phone }),
    }).catch(function () {});
  };

  // ── Chat mode ────────────────────────────────────────────────────────────────
  function startChat(question) {
    if (mode === 'home') {
      mode = 'chat';
      document.getElementById('lc-home').style.display = 'none';
      document.getElementById('lc-chat').style.display = 'flex';
      document.getElementById('lc-chat').style.flexDirection = 'column';
      document.getElementById('lc-back').classList.add('lc-visible');
    }
    sendText(question);
  }

  function send() {
    var input = document.getElementById('lc-input');
    var text = (input.value || '').trim();
    if (!text || isBusy) return;
    input.value = '';
    document.getElementById('lc-send').disabled = true;
    startChat(text);
  }

  function sendText(text) {
    isBusy = true;
    appendMsg('user', text);
    var typingEl = showTyping();

    fetch(WORKER_URL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        typingEl.remove();
        var reply = d.reply || 'Sorry, something went wrong. Please try again.';
        var suggestions = d.suggestions || [];
        var botDiv = appendMsg('bot', '');
        typeMessage(botDiv, reply, function () {
          isBusy = false;
          document.getElementById('lc-send').disabled = !document.getElementById('lc-input').value.trim();
          showSuggestions(suggestions);
          showProductCards(reply);
          maybeShowCapture();
          if (!isOpen) setUnread(unreadCount + 1);
        });
      })
      .catch(function () {
        typingEl.remove();
        isBusy = false;
        appendMsg('bot', 'I\'m having trouble connecting right now. Please email hello@lacalut.com.au.');
      });
  }

  function renderBotText(div, text) {
    div.innerHTML = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  // ── Typewriter effect ────────────────────────────────────────────────────────
  function typeMessage(div, text, onComplete) {
    var chat = document.getElementById('lc-chat');
    // Skip animation for long replies — instant render
    if (text.length > 280) {
      renderBotText(div, text);
      chat.scrollTop = chat.scrollHeight;
      if (onComplete) onComplete();
      return;
    }
    var i = 0;
    (function next() {
      if (i < text.length) {
        i++;
        renderBotText(div, text.slice(0, i));
        chat.scrollTop = chat.scrollHeight;
        setTimeout(next, 18);
      } else if (onComplete) {
        onComplete();
      }
    })();
  }

  // ── Suggestion chips ─────────────────────────────────────────────────────────
  function showSuggestions(suggestions) {
    if (!suggestions || !suggestions.length) return;
    var chat = document.getElementById('lc-chat');
    var wrap = document.createElement('div');
    wrap.className = 'lc-suggestions';
    suggestions.forEach(function (s) {
      var chip = document.createElement('button');
      chip.className = 'lc-chip';
      chip.textContent = s;
      chip.onclick = function () { wrap.remove(); sendText(s); };
      wrap.appendChild(chip);
    });
    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
  }

  // ── Product cards ────────────────────────────────────────────────────────────
  function showProductCards(replyText) {
    var lower = replyText.toLowerCase();
    var matched = [];
    for (var i = 0; i < PRODUCTS.length && matched.length < 2; i++) {
      var p = PRODUCTS[i];
      if (p.keywords.some(function (kw) { return lower.indexOf(kw.toLowerCase()) !== -1; })) {
        matched.push(p);
      }
    }
    if (!matched.length) return;

    var chat = document.getElementById('lc-chat');
    var wrap = document.createElement('div');
    wrap.className = 'lc-product-cards';
    matched.forEach(function (p) {
      var a = document.createElement('a');
      a.className = 'lc-product-card';
      a.href = p.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML =
        '<img class="lc-product-img" src="' + p.img + '" alt="" loading="lazy" />' +
        '<div class="lc-product-info">' +
          '<div class="lc-product-name">' + p.name + '</div>' +
          '<div class="lc-product-cta">Shop Now →</div>' +
        '</div>';
      wrap.appendChild(a);
    });
    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
  }

  // ── Message helpers ──────────────────────────────────────────────────────────
  function appendMsg(role, text) {
    var chat = document.getElementById('lc-chat');
    var div = document.createElement('div');
    div.className = 'lc-msg lc-msg-' + role;
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  }

  function showTyping() {
    var chat = document.getElementById('lc-chat');
    var div = document.createElement('div');
    div.className = 'lc-typing';
    div.innerHTML = '<div class="lc-dot"></div><div class="lc-dot"></div><div class="lc-dot"></div>';
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  }

  function maybeShowCapture() {
    if (captureShown) return;
    captureShown = true;
    var chat = document.getElementById('lc-chat');
    var card = document.createElement('div');
    card.id = 'lc-chat-capture';
    card.className = 'lc-capture-card';
    card.innerHTML =
      '<div class="lc-capture-dismiss"><button onclick="document.getElementById(\'lc-chat-capture\').remove()">Dismiss</button></div>' +
      '<div class="lc-capture-title">Want a personal reply from our team?</div>' +
      '<input class="lc-capture-input" id="lc-ccap-email" type="email" placeholder="Email address (optional)" />' +
      '<input class="lc-capture-input" id="lc-ccap-phone" type="tel" placeholder="Phone number (optional)" />' +
      '<button class="lc-capture-btn" onclick="lcSubmitCapture(\'lc-ccap-email\',\'lc-ccap-phone\',\'lc-chat-capture\')">Save details</button>';
    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    build();
    applyConfig();
    fetch(WORKER_URL + '/config')
      .then(function (r) { return r.json(); })
      .then(function (d) { config = Object.assign(config, d); applyConfig(); setupProactiveTrigger(); })
      .catch(function () { setupProactiveTrigger(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
