window.RoleAdmin = (() => {
  const apiBase = () => window.API_BASE || '';
  const $ = (id) => document.getElementById(id);
  let roles = [];
  let selectedId = null;

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const status = (message, error = false) => {
    const el = $('role-admin-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = error ? 'var(--accent-red)' : 'var(--text-muted)';
  };

  const request = async (path, options = {}) => {
    const resp = await fetch(`${apiBase()}${path}`, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    let data = null;
    try { data = await resp.json(); } catch (err) {}
    if (!resp.ok) throw new Error(data?.detail || `HTTP ${resp.status}`);
    return data;
  };

  const teamLabel = (team) => ({
    townsfolk: '鎮民', outsider: '外來者', minion: '爪牙', demon: '惡魔', traveller: '旅行者', fabled: '傳奇角色'
  }[team] || team || '未分類');

  const renderList = () => {
    const list = $('role-admin-list');
    if (!list) return;
    if (!roles.length) {
      list.innerHTML = '<div class="role-admin-empty">目前沒有角色資料。請先匯入現有角色庫。</div>';
      return;
    }
    list.innerHTML = roles.map((role) => `
      <button type="button" class="role-admin-row ${Number(selectedId) === Number(role.id) ? 'active' : ''}" data-role-id="${role.id}">
        ${role.image_url ? `<img class="role-admin-thumb" src="${escapeHtml(role.image_url)}" alt="">` : '<div class="role-admin-thumb"></div>'}
        <div>
          <div class="role-admin-name">${escapeHtml(role.name_zh_tw)}</div>
          <div class="role-admin-meta">${escapeHtml(role.canonical_key)} · ${escapeHtml(teamLabel(role.team))}</div>
        </div>
        <div class="role-admin-score">${role.needs_review ? '待確認' : `${role.completeness?.score ?? 0}%`}</div>
      </button>`).join('');
    list.querySelectorAll('[data-role-id]').forEach((button) => {
      button.addEventListener('click', () => openRole(Number(button.dataset.roleId)));
    });
  };

  const field = (label, id, value = '', type = 'text', wide = false) => `
    <div class="${wide ? 'wide' : ''}"><label for="${id}">${label}</label>
    ${type === 'textarea'
      ? `<textarea id="${id}" class="form-control dark-input">${escapeHtml(value)}</textarea>`
      : `<input id="${id}" type="${type}" class="form-control dark-input" value="${escapeHtml(value)}">`}
    </div>`;

  const openRole = async (id) => {
    selectedId = id;
    renderList();
    status('正在讀取角色資料...');
    try {
      const role = await request(`/api/admin/roles/${id}`);
      renderEditor(role);
      status(`正在編輯：${role.name_zh_tw}`);
    } catch (err) {
      status(`讀取失敗：${err.message}`, true);
    }
  };

  const renderEditor = (role) => {
    const editor = $('role-admin-editor');
    const guide = role.guide || {};
    editor.innerHTML = `
      <div class="role-editor-head">
        ${role.image_url ? `<img src="${escapeHtml(role.image_url)}" alt="">` : '<div class="role-admin-thumb"></div>'}
        <div><h3>${escapeHtml(role.name_zh_tw)}</h3><div class="role-admin-meta">${escapeHtml(role.canonical_key)}</div></div>
      </div>
      <div class="role-editor-grid">
        ${field('繁體中文名稱', 'ra-name-zh', role.name_zh_tw)}
        ${field('英文名稱', 'ra-name-en', role.name_en || '')}
        <div><label for="ra-team">陣營</label><select id="ra-team" class="form-control dark-input">
          ${['townsfolk','outsider','minion','demon','traveller','fabled'].map((team) => `<option value="${team}" ${role.team === team ? 'selected' : ''}>${teamLabel(team)}</option>`).join('')}
        </select></div>
        <div><label for="ra-source-type">來源類型</label><select id="ra-source-type" class="form-control dark-input">
          ${['unclassified','official','experimental','custom','variant'].map((value) => `<option value="${value}" ${role.source_type === value ? 'selected' : ''}>${value}</option>`).join('')}
        </select></div>
        ${field('來源名稱', 'ra-source-name', role.source_name || '')}
        ${field('作者', 'ra-author', role.author || '')}
        ${field('圖片網址', 'ra-image', role.image_url || '', 'text', true)}
        ${field('玩家能力文字', 'ra-ability', role.ability_zh_tw || '', 'textarea', true)}
        ${field('首夜順序', 'ra-first-order', role.first_night_order || 0, 'number')}
        ${field('其他夜晚順序', 'ra-other-order', role.other_night_order || 0, 'number')}
        ${field('首夜說書人提示', 'ra-first-reminder', role.first_night_reminder || '', 'textarea', true)}
        ${field('其他夜晚說書人提示', 'ra-other-reminder', role.other_night_reminder || '', 'textarea', true)}
        ${field('一句話定位', 'ra-guide-summary', guide.beginner_summary || '', 'textarea', true)}
        ${field('這個角色要做什麼', 'ra-guide-play', guide.how_to_play || '', 'textarea', true)}
        ${field('開局建議', 'ra-guide-first-day', guide.first_day_advice || '', 'textarea', true)}
        ${field('常見誤區', 'ra-guide-mistakes', guide.common_mistakes || '', 'textarea', true)}
        ${field('進階技巧', 'ra-guide-advanced', guide.advanced_tips || '', 'textarea', true)}
      </div>
      <div class="role-checkboxes">
        <label><input id="ra-official" type="checkbox" ${role.is_official ? 'checked' : ''}> 官方角色</label>
        <label><input id="ra-custom" type="checkbox" ${role.is_custom ? 'checked' : ''}> 自創角色</label>
        <label><input id="ra-active" type="checkbox" ${role.is_active ? 'checked' : ''}> 啟用</label>
        <label><input id="ra-review" type="checkbox" ${role.needs_review ? 'checked' : ''}> 待確認</label>
      </div>
      <h4 style="color:#fff;margin:1.2rem 0 .5rem;">外部 ID 與別名</h4>
      <div class="alias-list">${(role.aliases || []).map((alias) => `
        <div class="alias-row"><span>${escapeHtml(alias.source)} · ${escapeHtml(alias.external_id)}${alias.external_name ? ` · ${escapeHtml(alias.external_name)}` : ''}</span>
        <button type="button" class="btn btn-outline" data-delete-alias="${alias.id}"><i class="fa-solid fa-trash"></i></button></div>`).join('') || '<div class="role-admin-meta">尚無別名</div>'}</div>
      <div class="alias-add">
        <input id="ra-alias-source" class="form-control dark-input" placeholder="來源，例如 museum">
        <input id="ra-alias-id" class="form-control dark-input" placeholder="外部 ID">
        <input id="ra-alias-name" class="form-control dark-input" placeholder="外部名稱（可選）">
        <button type="button" id="ra-add-alias" class="btn btn-outline">新增</button>
      </div>
      <div class="role-editor-actions"><button type="button" id="ra-save" class="btn btn-purple"><i class="fa-solid fa-floppy-disk"></i> 儲存角色</button></div>`;

    $('ra-save').addEventListener('click', () => saveRole(role.id));
    $('ra-add-alias').addEventListener('click', () => addAlias(role.id));
    editor.querySelectorAll('[data-delete-alias]').forEach((button) => button.addEventListener('click', () => deleteAlias(role.id, Number(button.dataset.deleteAlias))));
  };

  const saveRole = async (id) => {
    const payload = {
      name_zh_tw: $('ra-name-zh').value.trim(), name_en: $('ra-name-en').value.trim() || null,
      team: $('ra-team').value, source_type: $('ra-source-type').value,
      source_name: $('ra-source-name').value.trim() || null, author: $('ra-author').value.trim() || null,
      image_url: $('ra-image').value.trim() || null, ability_zh_tw: $('ra-ability').value.trim() || null,
      first_night_order: Number($('ra-first-order').value || 0), other_night_order: Number($('ra-other-order').value || 0),
      first_night_reminder: $('ra-first-reminder').value.trim() || null, other_night_reminder: $('ra-other-reminder').value.trim() || null,
      is_official: $('ra-official').checked, is_custom: $('ra-custom').checked, is_active: $('ra-active').checked, needs_review: $('ra-review').checked,
      guide: {
        beginner_summary: $('ra-guide-summary').value.trim(), how_to_play: $('ra-guide-play').value.trim(),
        first_day_advice: $('ra-guide-first-day').value.trim(), common_mistakes: $('ra-guide-mistakes').value.trim(),
        advanced_tips: $('ra-guide-advanced').value.trim(),
      },
    };
    status('正在儲存...');
    try {
      await request(`/api/admin/roles/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      status('角色資料已儲存。');
      await refresh();
      await openRole(id);
    } catch (err) { status(`儲存失敗：${err.message}`, true); }
  };

  const addAlias = async (id) => {
    const externalId = $('ra-alias-id').value.trim();
    if (!externalId) return status('請輸入外部 ID。', true);
    try {
      await request(`/api/admin/roles/${id}/aliases`, { method: 'POST', body: JSON.stringify({
        source: $('ra-alias-source').value.trim() || 'manual', external_id: externalId, external_name: $('ra-alias-name').value.trim() || null,
      }) });
      await openRole(id);
    } catch (err) { status(`新增別名失敗：${err.message}`, true); }
  };

  const deleteAlias = async (roleId, aliasId) => {
    if (!confirm('確定刪除此別名？')) return;
    try {
      await request(`/api/admin/roles/${roleId}/aliases/${aliasId}`, { method: 'DELETE' });
      await openRole(roleId);
    } catch (err) { status(`刪除別名失敗：${err.message}`, true); }
  };

  const refresh = async () => {
    const params = new URLSearchParams();
    const q = $('role-admin-search')?.value.trim();
    const team = $('role-admin-team')?.value;
    const review = $('role-admin-review')?.value;
    if (q) params.set('q', q);
    if (team) params.set('team', team);
    if (review) params.set('needs_review', review);
    status('正在讀取角色資料...');
    try {
      roles = await request(`/api/admin/roles?${params.toString()}`);
      renderList();
      status(`共 ${roles.length} 個角色。`);
    } catch (err) { status(`讀取失敗：${err.message}`, true); }
  };

  const importMasterDb = async () => {
    if (!Array.isArray(window.MASTER_ROLE_DB)) return status('找不到 MASTER_ROLE_DB。', true);
    if (!confirm(`將匯入或更新 ${window.MASTER_ROLE_DB.length} 個角色，繼續嗎？`)) return;
    status('正在匯入角色資料...');
    try {
      const result = await request('/api/admin/roles/import', { method: 'POST', body: JSON.stringify({ roles: window.MASTER_ROLE_DB }) });
      status(`匯入完成：新增 ${result.created}、更新 ${result.updated}、略過 ${result.skipped}，目前共 ${result.total} 個角色。`);
      await refresh();
    } catch (err) { status(`匯入失敗：${err.message}`, true); }
  };

  setTimeout(refresh, 50);
  return { refresh, importMasterDb };
})();
