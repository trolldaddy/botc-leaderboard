window.RoleSync = (() => {
  const apiBase = () => window.API_BASE || '';
  const $ = (id) => document.getElementById(id);
  let result = null;
  let filter = 'different';

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const fieldLabels = {
    name_zh_tw: '繁中名稱', name_en: '英文名稱', team: '陣營', ability_zh_tw: '能力',
    first_night_order: '首夜順序', other_night_order: '其他夜晚順序',
    first_night_reminder: '首夜提示', other_night_reminder: '其他夜晚提示', image_url: '圖片',
  };

  const request = async () => {
    const resp = await fetch(`${apiBase()}/api/admin/role-sync/pocket-grimoire/compare`, {
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

  const renderSummary = () => {
    const summary = result?.summary || {};
    const el = $('role-sync-summary');
    if (!el) return;
    el.innerHTML = [
      ['來源角色', summary.source_total || 0], ['成功匹配', summary.matched || 0],
      ['有差異', summary.different || 0], ['完全一致', summary.same || 0],
      ['資料庫缺角色', summary.missing_in_database || 0], ['僅資料庫存在', summary.database_only || 0],
    ].map(([label, value]) => `<button type="button" class="role-sync-stat" data-sync-filter="${label === '有差異' ? 'different' : label === '完全一致' ? 'same' : label === '資料庫缺角色' ? 'missing_role' : 'all'}"><strong>${value}</strong><span>${label}</span></button>`).join('');
    el.querySelectorAll('[data-sync-filter]').forEach((button) => button.addEventListener('click', () => {
      filter = button.dataset.syncFilter;
      renderRows();
    }));
  };

  const renderDiff = (row) => {
    const fields = row.status === 'missing_role' ? ['name_zh_tw', 'name_en', 'team', 'ability_zh_tw', 'first_night_reminder', 'other_night_reminder'] : row.diff_fields;
    if (!fields?.length) return '<div class="role-sync-same">目前資料與來源一致。</div>';
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
    if (keyword) rows = rows.filter((row) => `${row.external_id} ${row.incoming?.name_zh_tw || ''} ${row.incoming?.name_en || ''}`.toLowerCase().includes(keyword));
    if (!rows.length) {
      el.innerHTML = '<div class="role-admin-empty">這個條件下沒有差異資料。</div>';
      return;
    }
    el.innerHTML = rows.map((row) => `
      <details class="role-sync-row" ${row.status === 'different' ? 'open' : ''}>
        <summary>
          <div><strong>${escapeHtml(row.incoming?.name_zh_tw || row.external_id)}</strong><span>${escapeHtml(row.external_id)}${row.incoming?.name_en ? ` · ${escapeHtml(row.incoming.name_en)}` : ''}</span></div>
          <span class="role-sync-badge ${row.status}">${row.status === 'different' ? `${row.diff_fields.length} 項差異` : row.status === 'missing_role' ? '資料庫缺少' : '一致'}</span>
        </summary>
        <div class="role-sync-row-body">
          ${renderDiff(row)}
          ${(row.incoming?.reminders?.length || row.incoming?.reminders_global?.length) ? `<div class="role-sync-token-box"><strong>提示標記</strong><div>角色 Token：${escapeHtml((row.incoming.reminders || []).join('、') || '無')}</div><div>全域 Token：${escapeHtml((row.incoming.reminders_global || []).join('、') || '無')}</div></div>` : ''}
        </div>
      </details>`).join('');
  };

  const compare = async () => {
    const panel = $('role-sync-panel');
    if (panel) panel.hidden = false;
    setStatus('正在下載 Pocket Grimoire 英文與簡中角色資料，並轉換成繁體中文...');
    const button = $('role-sync-run');
    if (button) button.disabled = true;
    try {
      result = await request();
      filter = 'different';
      renderSummary();
      renderRows();
      setStatus(`比對完成。來源：${result.source}；轉換：${result.conversion}`);
    } catch (err) {
      setStatus(`比對失敗：${err.message}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  };

  const close = () => { const panel = $('role-sync-panel'); if (panel) panel.hidden = true; };
  const init = () => {
    $('role-sync-run')?.addEventListener('click', compare);
    $('role-sync-close')?.addEventListener('click', close);
    $('role-sync-search')?.addEventListener('input', renderRows);
    $('role-sync-filter')?.addEventListener('change', (event) => { filter = event.target.value; renderRows(); });
  };
  setTimeout(init, 50);
  return { compare, close };
})();
