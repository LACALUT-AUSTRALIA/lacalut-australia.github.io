// Lacalut Chat Widget — Ask Timmy style
// Paste into Shopify theme > Additional Scripts:
// <script src="https://lacalut-australia.github.io/chat-widget/lacalut-chat.js" defer></script>

(function () {
  'use strict';

  var WORKER_URL = 'https://lacalut-chat.lacalut.workers.dev';
  var BRAND = '#cf102d';

  // Session ID (no login required)
  var sessionId = sessionStorage.getItem('lc_sid');
  if (!sessionId) {
    sessionId = 'lc_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
    sessionStorage.setItem('lc_sid', sessionId);
  }

  var isOpen = false;
  var mode = 'home'; // 'home' | 'chat'
  var isBusy = false;
  var config = {
    greeting: 'Hi! Ask me anything about our products, shipping, or orders.',
    suggested_questions: '["Which product is best for bleeding gums?","How long does shipping take?","What is your return policy?","Do you offer free shipping?","Where can I buy LACALUT in store?"]',
    brand_colour: BRAND,
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
    #lc-btn svg { width: 28px; height: 28px; fill: #fff; transition: opacity 0.2s; }
    #lc-btn.lc-open .lc-icon-chat { display: none; }
    #lc-btn:not(.lc-open) .lc-icon-close { display: none; }

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
      padding: 16px 18px; display: flex; align-items: center; gap: 12px;
      flex-shrink: 0;
    }
    .lc-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center; font-size: 20px;
      flex-shrink: 0;
    }
    .lc-head-info { flex: 1; }
    .lc-head-name { font-weight: 700; font-size: 15px; }
    .lc-head-status { font-size: 12px; opacity: 0.85; display: flex; align-items: center; gap: 5px; margin-top: 1px; }
    .lc-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; flex-shrink: 0; }
    #lc-close { background: none; border: none; cursor: pointer; color: #fff; opacity: 0.8; font-size: 20px; line-height: 1; padding: 2px; }
    #lc-close:hover { opacity: 1; }

    /* Home screen */
    #lc-home {
      flex: 1; overflow-y: auto; padding: 20px 16px 12px;
      display: flex; flex-direction: column;
    }
    .lc-greeting-bubble {
      background: #f3f4f6; border-radius: 0 16px 16px 16px;
      padding: 13px 15px; font-size: 14px; line-height: 1.5; color: #111;
      margin-bottom: 20px; align-self: flex-start; max-width: 90%;
    }
    .lc-qa-label {
      font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: 0.06em;
      text-transform: uppercase; margin-bottom: 10px;
    }
    .lc-qa-list { display: flex; flex-direction: column; gap: 8px; }
    .lc-qa-btn {
      width: 100%; background: #fff; border: 1.5px solid #e5e7eb;
      border-radius: 12px; padding: 13px 16px; text-align: left;
      font-size: 14px; color: #111; cursor: pointer; line-height: 1.4;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
      font-family: inherit;
    }
    .lc-qa-btn:hover { border-color: var(--lc, #cf102d); background: #fff5f5; color: var(--lc, #cf102d); }

    /* Chat screen */
    #lc-chat { flex: 1; overflow-y: auto; padding: 14px 14px 8px; display: flex; flex-direction: column; gap: 10px; }
    .lc-msg { max-width: 84%; padding: 11px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
    .lc-msg-bot { background: #f3f4f6; color: #111; border-bottom-left-radius: 4px; align-self: flex-start; }
    .lc-msg-user { background: var(--lc, #cf102d); color: #fff; border-bottom-right-radius: 4px; align-self: flex-end; }
    .lc-typing { display: flex; gap: 4px; padding: 12px 16px; align-items: center; align-self: flex-start; background: #f3f4f6; border-radius: 16px; border-bottom-left-radius: 4px; }
    .lc-dot { width: 7px; height: 7px; border-radius: 50%; background: #9ca3af; animation: lc-bounce 1.2s infinite ease-in-out; }
    .lc-dot:nth-child(2) { animation-delay: 0.2s; }
    .lc-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes lc-bounce { 0%,80%,100%{transform:scale(0.75);opacity:0.5} 40%{transform:scale(1.1);opacity:1} }

    /* Input row */
    #lc-input-row {
      padding: 10px 12px 14px; border-top: 1px solid #f0f0f0;
      display: flex; gap: 8px; align-items: center; flex-shrink: 0;
    }
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
      #lc-btn { right: 10px; }
    }
  `;

  // ── Build DOM ────────────────────────────────────────────────────────────────
  function build() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // Launcher
    var btn = el('button', { id: 'lc-btn', 'aria-label': 'Open chat' });
    btn.innerHTML =
      '<svg class="lc-icon-chat" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' +
      '<svg class="lc-icon-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    btn.onclick = toggle;
    document.body.appendChild(btn);

    // Panel
    var panel = el('div', { id: 'lc-panel', role: 'dialog', 'aria-label': 'Ask Lacalut' });
    panel.innerHTML = `
      <div id="lc-head">
        <div class="lc-avatar">🦷</div>
        <div class="lc-head-info">
          <div class="lc-head-name">Ask Lacalut</div>
          <div class="lc-head-status"><span class="lc-status-dot"></span>Always here to help</div>
        </div>
        <button id="lc-close" aria-label="Close">✕</button>
      </div>
      <div id="lc-home">
        <div class="lc-greeting-bubble" id="lc-greeting-text">${config.greeting}</div>
        <div class="lc-qa-label">Quick Questions</div>
        <div class="lc-qa-list" id="lc-qa-list"></div>
      </div>
      <div id="lc-chat" style="display:none"></div>
      <div id="lc-input-row">
        <input id="lc-input" type="text" placeholder="Type a message…" autocomplete="off" />
        <button id="lc-send" aria-label="Send" disabled>
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div id="lc-powered">Powered by Lacalut AI</div>
    `;
    document.body.appendChild(panel);

    document.getElementById('lc-close').onclick = toggle;
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

  // ── Config & QA buttons ──────────────────────────────────────────────────────
  function applyConfig() {
    var c = config.brand_colour || BRAND;
    document.documentElement.style.setProperty('--lc', c);

    var greetingEl = document.getElementById('lc-greeting-text');
    if (greetingEl) greetingEl.textContent = config.greeting;

    var list = document.getElementById('lc-qa-list');
    if (!list) return;
    list.innerHTML = '';
    try {
      var qs = JSON.parse(config.suggested_questions);
      qs.slice(0, 6).forEach(function (q) {
        var btn = document.createElement('button');
        btn.className = 'lc-qa-btn';
        btn.textContent = q;
        btn.onclick = function () { startChat(q); };
        list.appendChild(btn);
      });
    } catch (e) {}
  }

  // ── Panel open/close ─────────────────────────────────────────────────────────
  function toggle() {
    isOpen = !isOpen;
    document.getElementById('lc-panel').classList.toggle('lc-open', isOpen);
    document.getElementById('lc-btn').classList.toggle('lc-open', isOpen);
    if (isOpen) setTimeout(function () { document.getElementById('lc-input').focus(); }, 300);
  }

  // ── Switch to chat mode ──────────────────────────────────────────────────────
  function startChat(question) {
    if (mode === 'home') {
      mode = 'chat';
      document.getElementById('lc-home').style.display = 'none';
      document.getElementById('lc-chat').style.display = 'flex';
      document.getElementById('lc-chat').style.flexDirection = 'column';
    }
    sendText(question);
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
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
        isBusy = false;
        appendMsg('bot', d.reply || 'Sorry, something went wrong. Please try again.');
      })
      .catch(function () {
        typingEl.remove();
        isBusy = false;
        appendMsg('bot', 'I\'m having trouble connecting right now. Please email hello@lacalut.com.au.');
      });
  }

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

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    build();
    applyConfig();
    // Load config from Worker (updates greeting + buttons from DB)
    fetch(WORKER_URL + '/config')
      .then(function (r) { return r.json(); })
      .then(function (d) { config = Object.assign(config, d); applyConfig(); })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
