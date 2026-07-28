window.RoleSync = (() => {
  const apiBase = () => window.API_BASE || '';
  const $ = (id) => document.getElementById(id);
  let result = null;
  let filter = 'different';

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const fieldLabels = {
    name_en: '英文名稱', team: '陣營', ability_zh_tw: '能力',
    first_night_order: '首夜順序', other_night_order: '其他夜晚順序',
    first_night_reminder: '首夜提示', other_night_reminder: '其他夜晚提示',
  };

  const request = async (path) => {
    const resp = await fetch(`${apiBase()}${path}`, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    let data = null;
    try { data = await resp.json(); } catch (err) {}
    if (!resp.ok) throw new Error(data?.detail || `HTTP ${resp.status}`);
    return data;
  };

  const setStatus = (text, error = false) => {
    const el = $('role-sync-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = error ? 'var(--accent-red)' : 'var(--ra-muted)';
  };

  const displayValue = (value) => {
    if (Array.isArray(value)) return value.join('、') || '（空白）';
    if (value === null || value === undefined || value === '') return '（空白）';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const ensureActionButtons = () => {
    const toolbar = document.querySelector('.role-sync-toolbar');
    if (!toolbar) return;

    if (!$('role-sync-fill-empty')) {
      const button = document.createElement('button');
      button.id = 'role-sync-fill-empty';
      button.type = 'button';
      button.className = 'btn btn-purple';
      button.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 補齊空白欄位';
      button.addEventListener('click', fillEmpty);
      toolbar.appendChild(button);
    }

    if (!$('role-sync-import-reminders')) {
      const button = document.createElement('button');
      button.id = 'role-sync-import-reminders';
      button.type = 'button';
      button.className = 'btn btn-outline';
      button.innerHTML = '<i class="fa-solid fa-tags"></i> 匯入提示標記';
      button.addEventListener('click', importReminders);
      toolbar.appendChild(button);
    }

    toolbar.style.gridTemplateColumns = 'minmax(240px,1fr) 220px auto auto';
  };

  const renderSummary = () => {
    const summary = result?.summary || {};
    const el = $('role-sync-summary');
    if (!el) return;
    el.innerHTML = [
      ['來源角色', summary.source_total || 0], ['成功匹配', summary.matched || 0],
      ['能力已存在', summary.database_roles_with_ability || 0], ['能力仍空白', summary.database_roles_without_ability || 0],
      ['有差異', summary.different || 0], ['資料庫缺角色', summary.missing_in_database || 0],
    ].map(([label, value]) => `<button type="button" class="role-sync-stat" data-sync-filter="${label === '有差異' ? 'different' : label === '資料庫缺角色' ? 'missing_role' : 'all'}"><strong>${value}</strong><span>${label}</span></button>`).join('');
    el.querySelectorAll('[data-sync-filter]').forEach((button) => button.addEventListener('click', () => {
      filter = button.dataset.syncFilter;
      renderRows();
    }));
  };

  const renderDiff = (row) => {
    const fields = row.diff_fields || [];
    if (!fields.length) return '<div class="role-sync-same">目前可比較資料與來源一致。中文名稱與圖片固定以本地資料庫為準。</div>';
    return fields.map((field) => `
      <div class="role-sync-field">
        <div class="role-sync-field-title">${escapeHtml(fieldLabels[field] || field)}</div>
        <div class="role-sync-compare-grid">
          <div><small>目前資料庫</small><pre>${escapeHtml(displayValue(row.current?.[field]))}</pre></div>
          <div><small>Pocket Grimoire 轉繁</small><pre>${escapeHtml(displayValue(row.incoming?.[field]))}</pre></div>
        </div>
      </div>`).join('');
  };

  const renderRows = () => {
    const el = $('role-sync-results');
    if (!el || !result) return;
    const keyword = ($('role-sync-search')?.value || '').trim().toLowerCase();
    let rows = result.rows || [];
    if (filter !== 'all') rows = rows.filter((row) => row.status === filter);
    if (keyword) rows = rows.filter((row) => `${row.external_id} ${row.current?.name_zh_tw || ''} ${row.incoming?.name_en || ''}`.toLowerCase().includes(keyword));
    if (!rows.length) {
      el.innerHTML = '<div class="role-admin-empty">這個條件下沒有差異資料。</div>';
      return;
    }
    el.innerHTML = rows.map((row) => {
      const displayName = row.current?.name_zh_tw || (row.incoming?.has_localized_name ? row.incoming?.name_zh_tw : '') || row.incoming?.name_en || row.external_id;
      const matchNote = row.match_method === 'normalized_id' ? ' · 正規化 ID 配對' : '';
      return `
      <details class="role-sync-row" ${row.status === 'different' ? 'open' : ''}>
        <summary>
          <div><strong>${escapeHtml(displayName)}</strong><span>${escapeHtml(row.external_id)}${row.incoming?.name_en ? ` · ${escapeHtml(row.incoming.name_en)}` : ''}${matchNote}</span></div>
          <span class="role-sync-badge ${row.status}">${row.status === 'different' ? `${row.diff_fields.length} 項差異` : row.status === 'missing_role' ? '資料庫缺少' : '一致'}</span>
        </summary>
        <div class="role-sync-row-body">
          ${renderDiff(row)}
          ${(row.incoming?.reminders?.length || row.incoming?.reminders_global?.length) ? `<div class="role-sync-token-box"><strong>提示標記</strong><div>角色 Token：${escapeHtml((row.incoming.reminders || []).join('、') || '無')}</div><div>全域 Token：${escapeHtml((row.incoming.reminders_global || []).join('、') || '無')}</div></div>` : ''}
        </div>
      </details>`;
    }).join('');
  };

  const compare = async () => {
    const panel = $('role-sync-panel');
    if (panel) panel.hidden = false;
    ensureActionButtons();
    setStatus('正在下載 Pocket Grimoire 英文與簡中角色資料，並轉換成繁體中文...');
    const button = $('role-sync-run');
    if (button) button.disabled = true;
    try {
      result = await request('/api/admin/role-sync/pocket-grimoire/compare');
      filter = 'different';
      if ($('role-sync-filter')) $('role-sync-filter').value = filter;
      renderSummary();
      renderRows();
      setStatus(`比對完成。中文名稱與圖片不參與一般差異；來源：${result.source}`);
    } catch (err) {
      setStatus(`比對失敗：${err.message}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  };

  async function fillEmpty() {
    if (!result) return setStatus('請先執行一次比對。', true);
    const missing = result.summary?.database_roles_without_ability || 0;
    if (!confirm(`將只補入資料庫目前為空的英文名稱、能力、夜間順序與夜間提示。\n\n中文名稱、圖片、陣營與所有既有內容都不會被改動。\n目前約有 ${missing} 個角色缺少能力文字，確定繼續嗎？`)) return;
    const button = $('role-sync-fill-empty');
    if (button) button.disabled = true;
    setStatus('正在安全補齊空白欄位，既有內容不會被覆蓋...');
    try {
      const data = await request('/api/admin/role-sync/pocket-grimoire/fill-empty');
      const filled = data.filled || {};
      alert([
        '補齊完成',
        `更新角色：${data.changed_roles || 0}`,
        `英文名稱：${filled.name_en || 0}`,
        `能力：${filled.ability_zh_tw || 0}`,
        `首夜提示：${filled.first_night_reminder || 0}`,
        `其他夜晚提示：${filled.other_night_reminder || 0}`,
        `首夜順序：${filled.first_night_order || 0}`,
        `其他夜晚順序：${filled.other_night_order || 0}`,
      ].join('\n'));
      await compare();
      if (window.RoleAdmin?.refresh) await window.RoleAdmin.refresh();
    } catch (err) {
      setStatus(`補齊失敗：${err.message}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function importReminders() {
    if (!result) return setStatus('請先執行一次比對。', true);
    if (!confirm('將把 Pocket Grimoire 的角色提示標記與全域提示標記加入正式資料表。\n\n只新增不存在的項目，不刪除、不覆蓋既有標記。確定繼續嗎？')) return;
    const button = $('role-sync-import-reminders');
    if (button) button.disabled = true;
    setStatus('正在匯入提示標記，既有資料不會被改動...');
    try {
      const data = await request('/api/admin/role-sync/pocket-grimoire/import-reminders');
      alert([
        '提示標記匯入完成',
        `角色提示標記新增：${data.added_role_reminders || 0}`,
        `全域提示標記新增：${data.added_global_reminders || 0}`,
        `重複略過：${data.skipped_duplicates || 0}`,
        `成功配對角色：${data.matched_roles || 0}`,
        `無角色對應：${data.missing_roles || 0}`,
      ].join('\n'));
      setStatus(`提示標記匯入完成：新增 ${(data.added_role_reminders || 0) + (data.added_global_reminders || 0)} 筆。`);
    } catch (err) {
      setStatus(`提示標記匯入失敗：${err.message}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  const close = () => { const panel = $('role-sync-panel'); if (panel) panel.hidden = true; };
  const init = () => {
    $('role-sync-run')?.addEventListener('click', compare);
    $('role-sync-close')?.addEventListener('click', close);
    $('role-sync-search')?.addEventListener('input', renderRows);
    $('role-sync-filter')?.addEventListener('change', (event) => { filter = event.target.value; renderRows(); });
  };
  setTimeout(init, 50);
  return { compare, fillEmpty, importReminders, close };
})();

(() => {
  if (document.querySelector('script[data-role-reminder-merge]')) return;
  const script = document.createElement('script');
  script.src = '/js/role_admin_reminder_merge.js';
  script.dataset.roleReminderMerge = '1';
  document.head.appendChild(script);
})();