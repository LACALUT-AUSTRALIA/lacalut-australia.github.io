// Lacalut Chat Admin Panel

var WORKER_URL = localStorage.getItem('lc_worker_url') || '';
var ADMIN_SECRET = localStorage.getItem('lc_admin_secret') || '';

var allKBEntries = [];
var editingId = null;

// ── Init ──────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', function () {
  // Restore connection settings
  if (WORKER_URL) document.getElementById('setting-worker-url').value = WORKER_URL;
  if (ADMIN_SECRET) document.getElementById('setting-admin-secret').value = ADMIN_SECRET;

  checkConfigWarning();

  // Colour picker sync
  document.getElementById('setting-colour').addEventListener('input', function () {
    document.getElementById('setting-colour-text').value = this.value;
  });
  document.getElementById('setting-colour-text').addEventListener('input', function () {
    if (/^#[0-9a-fA-F]{6}$/.test(this.value)) {
      document.getElementById('setting-colour').value = this.value;
    }
  });

  if (WORKER_URL) {
    loadKB();
    loadWidgetConfig();
  }
});

function checkConfigWarning() {
  var warning = document.getElementById('config-warning');
  if (WORKER_URL && ADMIN_SECRET) {
    warning.style.display = 'none';
  } else {
    warning.style.display = 'block';
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  document.querySelectorAll('.tab-content').forEach(function (c) {
    c.classList.toggle('active', c.id === 'tab-' + name);
  });
  if (name === 'conversations') loadConversations();
}

// ── API helpers ───────────────────────────────────────────────────────────────

function api(path, options) {
  if (!WORKER_URL) { showStatus('⚠️ Worker URL not set — go to Settings.', 'error'); return Promise.reject('no worker url'); }
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

// ── Status ────────────────────────────────────────────────────────────────────

function showStatus(msg, type) {
  var el = document.getElementById('save-status');
  el.textContent = msg;
  el.className = 'save-status ' + (type || 'ok');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(function () { el.textContent = ''; el.className = 'save-status'; }, 3000);
}

// ── Knowledge Base ────────────────────────────────────────────────────────────

function loadKB() {
  document.getElementById('kb-loading').style.display = 'block';
  document.getElementById('kb-table').style.display = 'none';
  document.getElementById('kb-empty').style.display = 'none';

  api('/kb', { auth: true })
    .then(function (data) {
      allKBEntries = data || [];
      renderKB(allKBEntries);
      document.getElementById('kb-loading').style.display = 'none';
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
  var filtered = allKBEntries.filter(function (e) {
    var matchCat = !cat || e.category === cat;
    var matchSearch = !search || e.question.toLowerCase().includes(search) || e.answer.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });
  renderKB(filtered);
}

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add KB Entry';
  document.getElementById('modal-question').value = '';
  document.getElementById('modal-answer').value = '';
  document.getElementById('modal-category').value = 'other';
  document.getElementById('modal-active').checked = true;
  document.getElementById('modal-save-btn').textContent = 'Add';
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-question').focus();
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
  btn.disabled = true;
  btn.textContent = 'Saving…';

  var wasEditing = !!editingId;
  var body = { question: q, answer: a, category: cat, active: active };
  var req;
  if (editingId) {
    req = api('/kb/' + editingId, { method: 'PUT', auth: true, body: JSON.stringify(body) });
  } else {
    req = api('/kb', { method: 'POST', auth: true, body: JSON.stringify(body) });
  }

  req.then(function () {
    closeModal();
    loadKB();
    showStatus(wasEditing ? '✅ Entry updated' : '✅ Entry added');
  })
  .catch(function (err) { showStatus('Error: ' + (err.message || err), 'error'); })
  .finally(function () { btn.disabled = false; btn.textContent = wasEditing ? 'Save Changes' : 'Add'; });
}

function deleteKB(id) {
  var entry = allKBEntries.find(function (e) { return e.id === id; });
  if (!confirm('Delete "' + (entry ? entry.question : id) + '"?')) return;
  api('/kb/' + id, { method: 'DELETE', auth: true })
    .then(function () { loadKB(); showStatus('🗑️ Entry deleted'); })
    .catch(function (err) { showStatus('Error: ' + err.message, 'error'); });
}

// ── Conversations ─────────────────────────────────────────────────────────────

function loadConversations() {
  var el = document.getElementById('conv-list');
  el.innerHTML = '';
  document.getElementById('conv-loading').style.display = 'block';
  document.getElementById('conv-empty').style.display = 'none';

  // Fetch directly from Supabase using service key stored in Worker config
  // We route this through the Worker's /conversations endpoint if available,
  // otherwise we note that admin secret is required
  fetch(WORKER_URL + '/conversations', {
    headers: { Authorization: 'Bearer ' + ADMIN_SECRET }
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      document.getElementById('conv-loading').style.display = 'none';
      if (!data || !data.length) { document.getElementById('conv-empty').style.display = 'block'; return; }
      data.forEach(renderConversation);
    })
    .catch(function () {
      document.getElementById('conv-loading').style.display = 'none';
      document.getElementById('conv-loading').textContent = '';
      // Show fallback message
      var msg = document.createElement('div');
      msg.className = 'empty-state';
      msg.innerHTML = '⚠️ Conversations endpoint not available.<br>' +
        'View conversations directly in <a href="https://supabase.com/dashboard/project/bfzvxxcsfxvgeblnkqne/editor" target="_blank">Supabase Table Editor</a> → <strong>chat_conversations</strong> table.';
      el.appendChild(msg);
    });
}

function renderConversation(conv) {
  var el = document.createElement('div');
  el.className = 'conv-card';
  var msgs = conv.messages || [];
  var date = new Date(conv.created_at).toLocaleString('en-AU');
  var preview = msgs.length ? msgs[0].content.slice(0, 80) + (msgs[0].content.length > 80 ? '…' : '') : '(empty)';

  el.innerHTML =
    '<div class="conv-header" onclick="this.parentElement.classList.toggle(\'open\')">' +
      '<div class="conv-meta"><strong>' + esc(conv.session_id.slice(0, 20)) + '…</strong> <span class="conv-date">' + esc(date) + '</span></div>' +
      '<div class="conv-preview">' + esc(preview) + '</div>' +
      '<span class="conv-toggle">▼</span>' +
    '</div>' +
    '<div class="conv-messages">' +
      msgs.map(function (m) {
        return '<div class="conv-msg conv-msg-' + esc(m.role) + '">' +
          '<span class="conv-role">' + (m.role === 'user' ? '👤' : '🤖') + '</span>' +
          '<span class="conv-text">' + esc(m.content) + '</span>' +
        '</div>';
      }).join('') +
    '</div>';

  document.getElementById('conv-list').appendChild(el);
}

// ── Settings ──────────────────────────────────────────────────────────────────

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
  status.textContent = 'Testing…';
  status.className = 'connection-status';

  api('/config')
    .then(function () {
      status.textContent = '✅ Connected successfully';
      status.className = 'connection-status ok';
    })
    .catch(function (err) {
      status.textContent = '❌ Failed: ' + err.message;
      status.className = 'connection-status error';
    })
    .finally(function () { btn.disabled = false; });
}

function loadWidgetConfig() {
  api('/config').then(function (cfg) {
    if (!cfg) return;
    if (cfg.greeting) document.getElementById('setting-greeting').value = cfg.greeting;
    if (cfg.suggested_questions) {
      try {
        var qs = JSON.parse(cfg.suggested_questions);
        document.getElementById('setting-suggested').value = qs.join('\n');
      } catch (e) {}
    }
    if (cfg.brand_colour) {
      document.getElementById('setting-colour').value = cfg.brand_colour;
      document.getElementById('setting-colour-text').value = cfg.brand_colour;
    }
  }).catch(function () {});
}

function saveWidgetConfig() {
  var greeting = document.getElementById('setting-greeting').value.trim();
  var suggestedRaw = document.getElementById('setting-suggested').value.trim();
  var colour = document.getElementById('setting-colour-text').value.trim() || document.getElementById('setting-colour').value;

  var suggested = suggestedRaw
    ? JSON.stringify(suggestedRaw.split('\n').map(function (s) { return s.trim(); }).filter(Boolean))
    : '[]';

  api('/config', {
    method: 'PUT', auth: true,
    body: JSON.stringify({ greeting: greeting, suggested_questions: suggested, brand_colour: colour })
  })
    .then(function () { showStatus('✅ Widget config saved'); })
    .catch(function (err) { showStatus('Error: ' + err.message, 'error'); });
}

// ── Util ──────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
