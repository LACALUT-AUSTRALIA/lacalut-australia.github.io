// Lacalut Chat Admin Panel

var WORKER_URL = localStorage.getItem('lc_worker_url') || 'https://lacalut-chat.lacalut.workers.dev';
var ADMIN_SECRET = localStorage.getItem('lc_admin_secret') || '';

var allKBEntries = [];
var allConversations = [];
var allLeads = [];
var allQAs = [];
var editingId = null;
var editingQAId = null;
var showingFlagged = true;

// ── Init ───────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', function () {
  if (WORKER_URL) document.getElementById('setting-worker-url').value = WORKER_URL;
  if (ADMIN_SECRET) document.getElementById('setting-admin-secret').value = ADMIN_SECRET;
  checkConfigWarning();

  document.getElementById('setting-colour').addEventListener('input', function () {
    document.getElementById('setting-colour-text').value = this.value;
  });
  document.getElementById('setting-colour-text').addEventListener('input', function () {
    if (/^#[0-9a-fA-F]{6}$/.test(this.value)) document.getElementById('setting-colour').value = this.value;
  });

  if (WORKER_URL) { loadKB(); loadWidgetConfig(); }
});

function checkConfigWarning() {
  document.getElementById('config-warning').style.display = (WORKER_URL && ADMIN_SECRET) ? 'none' : 'block';
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  document.querySelectorAll('.tab-content').forEach(function (c) {
    c.classList.toggle('active', c.id === 'tab-' + name);
  });
  if (name === 'conversations') loadConversations();
  if (name === 'training') loadTraining();
  if (name === 'leads') loadLeads();
  if (name === 'qas') loadQAs();
}

// ── API ────────────────────────────────────────────────────────────────────────

function api(path, options) {
  if (!WORKER_URL) { showStatus('⚠️ Worker URL not set — go to Settings.', 'error'); return Promise.reject('no url'); }
  options = options || {};
  var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (options.auth) headers['Authorization'] = 'Bearer ' + ADMIN_SECRET;
  return fetch(WORKER_URL + path, Object.assign({}, options, { headers: headers }))
    .then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error(t); });
      if (res.status === 204) return null;
      return res.json();
    });
}

function showStatus(msg, type) {
  var el = document.getElementById('save-status');
  el.textContent = msg;
  el.className = 'save-status ' + (type || 'ok');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.textContent = ''; el.className = 'save-status'; }, 3500);
}

// ── Knowledge Base ─────────────────────────────────────────────────────────────

function loadKB() {
  document.getElementById('kb-loading').style.display = 'block';
  document.getElementById('kb-table').style.display = 'none';
  document.getElementById('kb-empty').style.display = 'none';

  api('/kb', { auth: true })
    .then(function (data) {
      allKBEntries = data || [];
      document.getElementById('kb-loading').style.display = 'none';
      document.getElementById('kb-count').textContent = allKBEntries.length;
      renderKB(allKBEntries);
    })
    .catch(function (err) {
      document.getElementById('kb-loading').textContent = 'Error: ' + (err.message || err);
    });
}

function renderKB(entries) {
  var tbody = document.getElementById('kb-tbody');
  tbody.innerHTML = '';
  if (!entries.length) {
    document.getElementById('kb-empty').style.display = 'block';
    document.getElementById('kb-table').style.display = 'none';
    return;
  }
  document.getElementById('kb-empty').style.display = 'none';
  document.getElementById('kb-table').style.display = 'table';
  entries.forEach(function (e) {
    var tr = document.createElement('tr');
    if (!e.active) tr.classList.add('row-inactive');
    tr.innerHTML =
      '<td class="cell-question">' + esc(e.question) + '</td>' +
      '<td class="cell-answer">' + esc(e.answer) + '</td>' +
      '<td><span class="badge badge-' + esc(e.category) + '">' + esc(e.category) + '</span></td>' +
      '<td class="cell-active">' + (e.active ? '<span class="dot dot-green">●</span>' : '<span class="dot dot-grey">●</span>') + '</td>' +
      '<td class="col-actions">' +
        '<button class="btn-icon" onclick="openEditModal(\'' + e.id + '\')" title="Edit">✏️</button>' +
        '<button class="btn-icon btn-danger" onclick="deleteKB(\'' + e.id + '\')" title="Delete">🗑️</button>' +
      '</td>';
    tbody.appendChild(tr);
  });
}

function filterKB() {
  var cat = document.getElementById('filter-category').value;
  var search = document.getElementById('filter-search').value.toLowerCase();
  renderKB(allKBEntries.filter(function (e) {
    return (!cat || e.category === cat) &&
           (!search || e.question.toLowerCase().includes(search) || e.answer.toLowerCase().includes(search));
  }));
}

function openAddModal(prefillQ) {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add KB Entry';
  document.getElementById('modal-question').value = prefillQ || '';
  document.getElementById('modal-answer').value = '';
  document.getElementById('modal-category').value = 'other';
  document.getElementById('modal-active').checked = true;
  document.getElementById('modal-save-btn').textContent = 'Add to Knowledge Base';
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(function () {
    document.getElementById(prefillQ ? 'modal-answer' : 'modal-question').focus();
  }, 100);
}

function openEditModal(id) {
  var entry = allKBEntries.find(function (e) { return e.id === id; });
  if (!entry) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit KB Entry';
  document.getElementById('modal-question').value = entry.question;
  document.getElementById('modal-answer').value = entry.answer;
  document.getElementById('modal-category').value = entry.category || 'other';
  document.getElementById('modal-active').checked = entry.active !== false;
  document.getElementById('modal-save-btn').textContent = 'Save Changes';
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-question').focus();
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null;
}

function saveKBEntry() {
  var q = document.getElementById('modal-question').value.trim();
  var a = document.getElementById('modal-answer').value.trim();
  var cat = document.getElementById('modal-category').value;
  var active = document.getElementById('modal-active').checked;
  if (!q || !a) { alert('Question and answer are required.'); return; }

  var btn = document.getElementById('modal-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  var wasEditing = !!editingId;
  var body = { question: q, answer: a, category: cat, active: active };
  var req = wasEditing
    ? api('/kb/' + editingId, { method: 'PUT', auth: true, body: JSON.stringify(body) })
    : api('/kb', { method: 'POST', auth: true, body: JSON.stringify(body) });

  req.then(function () {
    closeModal();
    loadKB();
    showStatus(wasEditing ? '✅ Entry updated' : '✅ Added to Knowledge Base');
  })
  .catch(function (err) { showStatus('Error: ' + (err.message || err), 'error'); })
  .finally(function () { btn.disabled = false; btn.textContent = wasEditing ? 'Save Changes' : 'Add to Knowledge Base'; });
}

function deleteKB(id) {
  var entry = allKBEntries.find(function (e) { return e.id === id; });
  if (!confirm('Delete "' + (entry ? entry.question : id) + '"?')) return;
  api('/kb/' + id, { method: 'DELETE', auth: true })
    .then(function () { loadKB(); showStatus('🗑️ Deleted'); })
    .catch(function (err) { showStatus('Error: ' + err.message, 'error'); });
}

// ── Quick Answers ──────────────────────────────────────────────────────────────

function loadQAs() {
  document.getElementById('qas-loading').style.display = 'block';
  document.getElementById('qas-table').style.display = 'none';
  document.getElementById('qas-empty').style.display = 'none';

  api('/quick-qas', { auth: true })
    .then(function (data) {
      allQAs = data || [];
      document.getElementById('qas-loading').style.display = 'none';
      document.getElementById('qas-count').textContent = allQAs.length;
      renderQAs(allQAs);
    })
    .catch(function (err) {
      document.getElementById('qas-loading').textContent = 'Error: ' + (err.message || err);
    });
}

function renderQAs(entries) {
  var tbody = document.getElementById('qas-tbody');
  tbody.innerHTML = '';
  if (!entries.length) {
    document.getElementById('qas-empty').style.display = 'block';
    document.getElementById('qas-table').style.display = 'none';
    return;
  }
  document.getElementById('qas-empty').style.display = 'none';
  document.getElementById('qas-table').style.display = 'table';
  entries.forEach(function (e) {
    var tr = document.createElement('tr');
    if (!e.active) tr.classList.add('row-inactive');
    tr.innerHTML =
      '<td class="cell-question">' + esc(e.question) + '</td>' +
      '<td class="cell-answer">' + esc(e.answer) + '</td>' +
      '<td style="text-align:center;color:#6b7280">' + (e.sort_order || 0) + '</td>' +
      '<td class="cell-active">' + (e.active ? '<span class="dot dot-green">●</span>' : '<span class="dot dot-grey">●</span>') + '</td>' +
      '<td class="col-actions">' +
        '<button class="btn-icon" onclick="openEditQAModal(\'' + e.id + '\')" title="Edit">✏️</button>' +
        '<button class="btn-icon btn-danger" onclick="deleteQA(\'' + e.id + '\')" title="Delete">🗑️</button>' +
      '</td>';
    tbody.appendChild(tr);
  });
}

function openAddQAModal() {
  editingQAId = null;
  document.getElementById('qa-modal-title').textContent = 'Add Quick Answer';
  document.getElementById('qa-modal-question').value = '';
  document.getElementById('qa-modal-answer').value = '';
  document.getElementById('qa-modal-order').value = '0';
  document.getElementById('qa-modal-active').checked = true;
  document.getElementById('qa-modal-save-btn').textContent = 'Add Quick Answer';
  document.getElementById('qa-modal-overlay').classList.add('open');
  setTimeout(function () { document.getElementById('qa-modal-question').focus(); }, 100);
}

function openEditQAModal(id) {
  var entry = allQAs.find(function (e) { return e.id === id; });
  if (!entry) return;
  editingQAId = id;
  document.getElementById('qa-modal-title').textContent = 'Edit Quick Answer';
  document.getElementById('qa-modal-question').value = entry.question;
  document.getElementById('qa-modal-answer').value = entry.answer;
  document.getElementById('qa-modal-order').value = entry.sort_order || 0;
  document.getElementById('qa-modal-active').checked = entry.active !== false;
  document.getElementById('qa-modal-save-btn').textContent = 'Save Changes';
  document.getElementById('qa-modal-overlay').classList.add('open');
  document.getElementById('qa-modal-question').focus();
}

function closeQAModal(e) {
  if (e && e.target !== document.getElementById('qa-modal-overlay')) return;
  document.getElementById('qa-modal-overlay').classList.remove('open');
  editingQAId = null;
}

function saveQAEntry() {
  var q = document.getElementById('qa-modal-question').value.trim();
  var a = document.getElementById('qa-modal-answer').value.trim();
  var order = parseInt(document.getElementById('qa-modal-order').value, 10) || 0;
  var active = document.getElementById('qa-modal-active').checked;
  if (!q || !a) { alert('Question and answer are required.'); return; }

  var btn = document.getElementById('qa-modal-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  var wasEditing = !!editingQAId;
  var body = { question: q, answer: a, sort_order: order, active: active };
  var req = wasEditing
    ? api('/quick-qas/' + editingQAId, { method: 'PUT', auth: true, body: JSON.stringify(body) })
    : api('/quick-qas', { method: 'POST', auth: true, body: JSON.stringify(body) });

  req.then(function () {
    closeQAModal();
    loadQAs();
    showStatus(wasEditing ? '✅ Quick Answer updated' : '✅ Quick Answer added — live on the widget now');
  })
  .catch(function (err) { showStatus('Error: ' + (err.message || err), 'error'); })
  .finally(function () { btn.disabled = false; btn.textContent = wasEditing ? 'Save Changes' : 'Add Quick Answer'; });
}

function deleteQA(id) {
  var entry = allQAs.find(function (e) { return e.id === id; });
  if (!confirm('Delete "' + (entry ? entry.question : id) + '"?')) return;
  api('/quick-qas/' + id, { method: 'DELETE', auth: true })
    .then(function () { loadQAs(); showStatus('🗑️ Deleted'); })
    .catch(function (err) { showStatus('Error: ' + err.message, 'error'); });
}

// ── AI Training ────────────────────────────────────────────────────────────────

function loadTraining() {
  document.getElementById('training-loading').style.display = 'block';
  document.getElementById('training-list').innerHTML = '';
  document.getElementById('training-empty').style.display = 'none';

  api('/conversations', { auth: true })
    .then(function (data) {
      allConversations = data || [];
      document.getElementById('training-loading').style.display = 'none';
      var flagged = allConversations.filter(function (c) { return c.needs_training; });
      document.getElementById('needs-count').textContent = flagged.length > 0 ? flagged.length + ' need attention' : '';
      renderTraining(showingFlagged ? flagged : allConversations, showingFlagged);
    })
    .catch(function (err) {
      document.getElementById('training-loading').textContent = 'Error: ' + (err.message || err);
    });
}

function showFlagged() {
  showingFlagged = true;
  document.getElementById('pill-flagged').classList.add('active');
  document.getElementById('pill-all-training').classList.remove('active');
  renderTraining(allConversations.filter(function (c) { return c.needs_training; }), true);
}

function showAllTraining() {
  showingFlagged = false;
  document.getElementById('pill-flagged').classList.remove('active');
  document.getElementById('pill-all-training').classList.add('active');
  renderTraining(allConversations, false);
}

function renderTraining(convs, isFlaggedView) {
  var list = document.getElementById('training-list');
  list.innerHTML = '';

  if (!convs.length) {
    document.getElementById('training-empty').style.display = 'block';
    document.getElementById('training-empty').textContent = isFlaggedView
      ? '✅ No flagged conversations — the AI is handling everything well!'
      : 'No conversations yet. Once customers start chatting, they\'ll appear here.';
    return;
  }
  document.getElementById('training-empty').style.display = 'none';

  convs.forEach(function (conv) {
    var msgs = conv.messages || [];
    var date = new Date(conv.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
    var pairs = [];
    for (var i = 0; i < msgs.length - 1; i++) {
      if (msgs[i].role === 'user' && msgs[i + 1] && msgs[i + 1].role === 'assistant') {
        pairs.push({ q: msgs[i].content, a: msgs[i + 1].content });
        i++;
      }
    }

    var card = document.createElement('div');
    card.className = 'training-card' + (conv.needs_training ? ' needs-training' : '');

    var escalationPhrases = ['hello@lacalut.com.au', "don't know", "not sure", "not certain", "pass the question", "don't have information"];
    var pairsHtml = pairs.map(function (p, idx) {
      var isEscalated = escalationPhrases.some(function (ph) { return p.a.toLowerCase().includes(ph); });
      var qId = 'tq_' + conv.id + '_' + idx;
      return '<div class="training-pair' + (isEscalated ? ' escalated' : '') + '">' +
        '<div class="pair-q"><span class="pair-label">Customer asked:</span><div class="pair-text">' + esc(p.q) + '</div></div>' +
        '<div class="pair-a"><span class="pair-label' + (isEscalated ? ' label-warn' : '') + '">' + (isEscalated ? '⚠️ AI couldn\'t answer:' : '🤖 AI replied:') + '</span>' +
        '<div class="pair-text pair-text-bot">' + esc(p.a) + '</div></div>' +
        '<div class="pair-actions"><button class="btn btn-train" onclick="openAddModal(\'' + esc(p.q.replace(/'/g, "\\'")) + '\')">+ Train AI with correct answer</button></div>' +
      '</div>';
    }).join('');

    card.innerHTML =
      '<div class="training-card-head" onclick="this.parentElement.classList.toggle(\'open\')">' +
        '<div>' +
          (conv.needs_training ? '<span class="flag-badge">🔴 Needs Training</span>' : '<span class="flag-badge flag-ok">✅ Handled</span>') +
          ' <span class="conv-date">' + esc(date) + '</span>' +
        '</div>' +
        '<div class="conv-preview">' + esc(((msgs[0] || {}).content || '').slice(0, 80)) + '</div>' +
        '<span class="conv-toggle">▼</span>' +
      '</div>' +
      '<div class="training-pairs">' + pairsHtml + '</div>';

    list.appendChild(card);
  });
}

// ── Leads ──────────────────────────────────────────────────────────────────────

function loadLeads() {
  document.getElementById('leads-loading').style.display = 'block';
  document.getElementById('leads-list').innerHTML = '';
  document.getElementById('leads-empty').style.display = 'none';
  document.getElementById('export-btn').style.display = 'none';

  api('/leads', { auth: true })
    .then(function (data) {
      allLeads = data || [];
      document.getElementById('leads-loading').style.display = 'none';
      document.getElementById('leads-count').textContent = allLeads.length;

      // Update tab badge
      var badge = document.getElementById('leads-badge');
      if (allLeads.length) {
        badge.textContent = allLeads.length;
        badge.style.display = 'inline-block';
        document.getElementById('export-btn').style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
        document.getElementById('leads-empty').style.display = 'block';
        return;
      }

      renderLeads(allLeads);
    })
    .catch(function (err) {
      document.getElementById('leads-loading').textContent = 'Error: ' + (err.message || err);
    });
}

function renderLeads(leads) {
  var list = document.getElementById('leads-list');
  list.innerHTML = '';

  leads.forEach(function (lead) {
    var card = document.createElement('div');
    card.className = 'lead-card';

    var date = new Date(lead.lead_at || lead.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
    var contactHtml = '';
    if (lead.email) contactHtml += '<a href="mailto:' + esc(lead.email) + '" class="lead-contact lead-email">' + esc(lead.email) + '</a>';
    if (lead.phone) contactHtml += '<a href="tel:' + esc(lead.phone) + '" class="lead-contact lead-phone">' + esc(lead.phone) + '</a>';

    card.innerHTML =
      '<div class="lead-card-main">' +
        '<div class="lead-contacts">' + (contactHtml || '<span class="lead-anon">Anonymous</span>') + '</div>' +
        '<div class="lead-date">' + esc(date) + '</div>' +
      '</div>' +
      (lead.first_message ? '<div class="lead-preview">"' + esc(lead.first_message.slice(0, 100)) + (lead.first_message.length > 100 ? '…' : '') + '"</div>' : '');

    list.appendChild(card);
  });
}

function exportLeadsCSV() {
  if (!allLeads.length) return;
  var rows = [['Date', 'Email', 'Phone', 'First Message', 'Session ID']];
  allLeads.forEach(function (l) {
    rows.push([
      new Date(l.lead_at || l.created_at).toLocaleString('en-AU'),
      l.email || '',
      l.phone || '',
      (l.first_message || '').replace(/"/g, '""'),
      l.session_id || '',
    ]);
  });
  var csv = rows.map(function (r) {
    return r.map(function (cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\r\n');

  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'lacalut-chat-leads-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showStatus('✅ CSV downloaded');
}

// ── Conversations ──────────────────────────────────────────────────────────────

function loadConversations() {
  var el = document.getElementById('conv-list');
  el.innerHTML = '';
  document.getElementById('conv-loading').style.display = 'block';
  document.getElementById('conv-empty').style.display = 'none';

  api('/conversations', { auth: true })
    .then(function (data) {
      document.getElementById('conv-loading').style.display = 'none';
      if (!data || !data.length) { document.getElementById('conv-empty').style.display = 'block'; return; }
      data.forEach(renderConversation);
    })
    .catch(function () {
      document.getElementById('conv-loading').textContent = '⚠️ Could not load conversations.';
    });
}

function renderConversation(conv) {
  var el = document.createElement('div');
  el.className = 'conv-card';
  var msgs = conv.messages || [];
  var date = new Date(conv.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
  var preview = msgs.length ? (msgs[0].content || '').slice(0, 80) + (msgs[0].content.length > 80 ? '…' : '') : '(empty)';

  el.innerHTML =
    '<div class="conv-header" onclick="this.parentElement.classList.toggle(\'open\')">' +
      '<div class="conv-meta"><strong>' + esc(conv.session_id.slice(0, 16)) + '…</strong> <span class="conv-date">' + esc(date) + '</span>' +
        (conv.needs_training ? ' <span class="flag-badge">🔴 Needs Training</span>' : '') +
      '</div>' +
      '<div class="conv-preview">' + esc(preview) + '</div>' +
      '<span class="conv-toggle">▼</span>' +
    '</div>' +
    '<div class="conv-messages">' +
      msgs.map(function (m) {
        if (m.role === 'lead') {
          return '<div class="conv-msg conv-msg-lead">' +
            '<span class="conv-role">💌</span>' +
            '<span class="conv-text conv-text-lead">Lead captured' + (m.email ? ': ' + esc(m.email) : '') + (m.phone ? (m.email ? ', ' : ': ') + esc(m.phone) : '') + '</span>' +
          '</div>';
        }
        return '<div class="conv-msg conv-msg-' + esc(m.role) + '">' +
          '<span class="conv-role">' + (m.role === 'user' ? '👤' : '🤖') + '</span>' +
          '<span class="conv-text">' + esc(m.content || '') + '</span>' +
        '</div>';
      }).join('') +
    '</div>';

  document.getElementById('conv-list').appendChild(el);
}

// ── Settings ───────────────────────────────────────────────────────────────────

function saveConnection() {
  WORKER_URL = document.getElementById('setting-worker-url').value.trim().replace(/\/$/, '');
  ADMIN_SECRET = document.getElementById('setting-admin-secret').value.trim();
  localStorage.setItem('lc_worker_url', WORKER_URL);
  localStorage.setItem('lc_admin_secret', ADMIN_SECRET);
  checkConfigWarning();
  showStatus('✅ Connection saved');
  if (WORKER_URL) { loadKB(); loadWidgetConfig(); }
}

function testConnection(event) {
  var btn = event.target;
  btn.disabled = true;
  var status = document.getElementById('connection-status');
  status.textContent = 'Testing…'; status.className = 'connection-status';
  api('/config')
    .then(function () { status.textContent = '✅ Connected successfully'; status.className = 'connection-status ok'; })
    .catch(function (err) { status.textContent = '❌ Failed: ' + err.message; status.className = 'connection-status error'; })
    .finally(function () { btn.disabled = false; });
}

function loadWidgetConfig() {
  api('/config').then(function (cfg) {
    if (!cfg) return;
    if (cfg.greeting) document.getElementById('setting-greeting').value = cfg.greeting;
    if (cfg.suggested_questions) {
      try { document.getElementById('setting-suggested').value = JSON.parse(cfg.suggested_questions).join('\n'); } catch (e) {}
    }
    if (cfg.brand_colour) {
      document.getElementById('setting-colour').value = cfg.brand_colour;
      document.getElementById('setting-colour-text').value = cfg.brand_colour;
    }
    if (cfg.proactive_delay !== undefined) {
      document.getElementById('setting-proactive-delay').value = Math.round(parseInt(cfg.proactive_delay, 10) / 1000);
    }
  }).catch(function () {});
}

function saveWidgetConfig() {
  var greeting = document.getElementById('setting-greeting').value.trim();
  var raw = document.getElementById('setting-suggested').value.trim();
  var colour = document.getElementById('setting-colour-text').value.trim() || document.getElementById('setting-colour').value;
  var suggested = raw ? JSON.stringify(raw.split('\n').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 6)) : '[]';

  api('/config', {
    method: 'PUT', auth: true,
    body: JSON.stringify({ greeting: greeting, suggested_questions: suggested, brand_colour: colour }),
  })
    .then(function () { showStatus('✅ Widget updated — changes are live'); })
    .catch(function (err) { showStatus('Error: ' + err.message, 'error'); });
}

function saveProactiveDelay() {
  var secs = parseInt(document.getElementById('setting-proactive-delay').value, 10);
  if (isNaN(secs) || secs < 0) { showStatus('⚠️ Enter a number (0 to disable)', 'error'); return; }
  var ms = secs * 1000;

  api('/config', {
    method: 'PUT', auth: true,
    body: JSON.stringify({ proactive_delay: String(ms) }),
  })
    .then(function () { showStatus('✅ Proactive trigger saved — ' + (secs === 0 ? 'disabled' : 'fires after ' + secs + 's')); })
    .catch(function (err) { showStatus('Error: ' + err.message, 'error'); });
}

// ── Util ───────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
