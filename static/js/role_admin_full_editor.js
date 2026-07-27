(() => {
  const apiBase = () => window.API_BASE || '';
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  let activeRoleId = null;
  let loadingRoleId = null;

  const request = async (path, options = {}) => {
    const response = await fetch(`${apiBase()}${path}`, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    let data = null;
    try { data = await response.json(); } catch (err) {}
    if (!response.ok) throw new Error(data?.detail || `HTTP ${response.status}`);
    return data;
  };

  const status = (message, error = false) => {
    const el = $('role-admin-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = error ? 'var(--accent-red)' : 'var(--text-muted)';
  };

  const blockTypeOptions = [
    ['background', '背景故事'], ['ability', '角色能力補充'], ['rules_detail', '規則細節'],
    ['rules', '規則說明'], ['examples', '範例'], ['common_mistakes', '常見誤解'],
    ['strategy', '策略'], ['storyteller_advice', '說書人建議'], ['jinx', '相剋規則'],
    ['interactions', '角色互動'], ['player_summary', '玩家摘要'], ['custom_note', '自訂注意事項'],
    ['source_excerpt', '原始來源節錄'],
  ];

  const audienceOptions = [
    ['all', '全部視圖'], ['player', '玩家'], ['encyclopedia', '角色百科'], ['storyteller', '說書人'],
  ];

  const reviewOptions = [
    ['needs_review', '待確認'], ['confirmed', '已確認'], ['rejected', '不採用'],
  ];

  const optionList = (items, selected) => items.map(([value, label]) =>
    `<option value="${escapeHtml(value)}" ${String(selected) === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
  ).join('');

  const getSelectedRoleId = () => {
    const active = document.querySelector('.role-admin-row.active[data-role-id]');
    return active ? Number(active.dataset.roleId) : null;
  };

  const sectionPanel = (name) => {
    const panel = document.createElement('section');
    panel.className = 'role-full-panel';
    panel.dataset.roleFullPanel = name;
    return panel;
  };

  const markExistingSections = (editor) => {
    const corePanel = sectionPanel('core');
    const storytellerPanel = sectionPanel('storyteller');
    const sourcePanel = sectionPanel('sources');
    const knowledgePanel = sectionPanel('knowledge');
    knowledgePanel.innerHTML = '<div class="role-admin-empty">正在讀取百科內容...</div>';

    const head = editor.querySelector('.role-editor-head');
    const grid = editor.querySelector('.role-editor-grid');
    const checks = editor.querySelector('.role-checkboxes');
    const reminder = editor.querySelector('.role-reminder-section');
    const aliasTitle = Array.from(editor.children).find((node) => node.tagName === 'H4' && node.textContent.includes('外部 ID'));
    const aliasList = editor.querySelector('.alias-list');
    const aliasAdd = editor.querySelector('.alias-add');
    const actions = Array.from(editor.querySelectorAll(':scope > .role-editor-actions')).pop();

    if (grid) corePanel.appendChild(grid);
    if (checks) corePanel.appendChild(checks);
    if (actions) corePanel.appendChild(actions);
    if (reminder) storytellerPanel.appendChild(reminder);
    if (aliasTitle) sourcePanel.appendChild(aliasTitle);
    if (aliasList) sourcePanel.appendChild(aliasList);
    if (aliasAdd) sourcePanel.appendChild(aliasAdd);

    const tabs = document.createElement('div');
    tabs.className = 'role-full-tabs';
    tabs.innerHTML = `
      <button type="button" data-role-full-tab="core" class="active">基本資料</button>
      <button type="button" data-role-full-tab="knowledge">百科內容</button>
      <button type="button" data-role-full-tab="storyteller">說書人內容</button>
      <button type="button" data-role-full-tab="sources">來源與對應</button>`;

    head.insertAdjacentElement('afterend', tabs);
    tabs.insertAdjacentElement('afterend', corePanel);
    corePanel.insertAdjacentElement('afterend', knowledgePanel);
    knowledgePanel.insertAdjacentElement('afterend', storytellerPanel);
    storytellerPanel.insertAdjacentElement('afterend', sourcePanel);

    tabs.querySelectorAll('[data-role-full-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        tabs.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
        editor.querySelectorAll('[data-role-full-panel]').forEach((panel) => {
          panel.hidden = panel.dataset.roleFullPanel !== button.dataset.roleFullTab;
        });
      });
    });
    knowledgePanel.hidden = true;
    storytellerPanel.hidden = true;
    sourcePanel.hidden = true;
    return { knowledgePanel, sourcePanel };
  };

  const renderBlockEditor = (roleId, block) => `
    <article class="role-content-card" data-content-block="${block.id}">
      <div class="role-content-head">
        <div><strong>${escapeHtml(block.title || block.block_type)}</strong><span>${escapeHtml(block.source)} · ${escapeHtml(block.review_status)}</span></div>
        <label class="role-content-active"><input id="rc-active-${block.id}" type="checkbox" ${block.is_active ? 'checked' : ''}> 啟用</label>
      </div>
      <div class="role-content-grid">
        <div><label>區塊類型</label><select id="rc-type-${block.id}" class="form-control dark-input">${optionList(blockTypeOptions, block.block_type)}</select></div>
        <div><label>顯示對象</label><select id="rc-audience-${block.id}" class="form-control dark-input">${optionList(audienceOptions, block.audience)}</select></div>
        <div><label>審核狀態</label><select id="rc-review-${block.id}" class="form-control dark-input">${optionList(reviewOptions, block.review_status)}</select></div>
        <div><label>排序</label><input id="rc-order-${block.id}" class="form-control dark-input" type="number" value="${Number(block.sort_order || 0)}"></div>
        <div class="wide"><label>標題</label><input id="rc-title-${block.id}" class="form-control dark-input" value="${escapeHtml(block.title || '')}"></div>
        <div class="wide"><label>內容</label><textarea id="rc-content-${block.id}" class="form-control dark-input">${escapeHtml(block.content || '')}</textarea></div>
        <div><label>來源</label><input id="rc-source-${block.id}" class="form-control dark-input" value="${escapeHtml(block.source || '')}" readonly></div>
        <div><label>來源鍵</label><input id="rc-source-key-${block.id}" class="form-control dark-input" value="${escapeHtml(block.source_key || '')}" readonly></div>
        <div class="wide"><label>來源網址</label><input id="rc-url-${block.id}" class="form-control dark-input" value="${escapeHtml(block.source_url || '')}"></div>
      </div>
      <div class="role-content-actions">
        <button type="button" class="btn btn-outline" data-delete-content="${block.id}"><i class="fa-solid fa-trash"></i> 刪除</button>
        <button type="button" class="btn btn-purple" data-save-content="${block.id}"><i class="fa-solid fa-floppy-disk"></i> 儲存區塊</button>
      </div>
    </article>`;

  const renderKnowledgePanel = (panel, roleId, data) => {
    const blocks = data.content_blocks || [];
    panel.innerHTML = `
      <div class="role-full-section-head">
        <div><h4>百科與額外內容</h4><p>這些區塊會依 audience 組合到玩家、百科或說書人視圖。</p></div>
        <button type="button" class="btn btn-outline" id="rc-new-toggle"><i class="fa-solid fa-plus"></i> 新增內容區塊</button>
      </div>
      <div id="rc-new-form" class="role-content-new" hidden>
        <div class="role-content-grid">
          <div><label>區塊類型</label><select id="rc-new-type" class="form-control dark-input">${optionList(blockTypeOptions, 'custom_note')}</select></div>
          <div><label>顯示對象</label><select id="rc-new-audience" class="form-control dark-input">${optionList(audienceOptions, 'storyteller')}</select></div>
          <div><label>排序</label><input id="rc-new-order" class="form-control dark-input" type="number" value="800"></div>
          <div><label>審核狀態</label><select id="rc-new-review" class="form-control dark-input">${optionList(reviewOptions, 'confirmed')}</select></div>
          <div class="wide"><label>標題</label><input id="rc-new-title" class="form-control dark-input" placeholder="例如：我的主持注意事項"></div>
          <div class="wide"><label>內容</label><textarea id="rc-new-content" class="form-control dark-input" placeholder="輸入內容"></textarea></div>
        </div>
        <div class="role-content-actions"><button type="button" id="rc-create" class="btn btn-purple">建立區塊</button></div>
      </div>
      <div class="role-content-list">${blocks.length ? blocks.map((block) => renderBlockEditor(roleId, block)).join('') : '<div class="role-admin-empty">尚無百科內容區塊。</div>'}</div>`;

    $('rc-new-toggle')?.addEventListener('click', () => { const form = $('rc-new-form'); form.hidden = !form.hidden; });
    $('rc-create')?.addEventListener('click', () => createBlock(roleId));
    panel.querySelectorAll('[data-save-content]').forEach((button) => button.addEventListener('click', () => saveBlock(roleId, Number(button.dataset.saveContent))));
    panel.querySelectorAll('[data-delete-content]').forEach((button) => button.addEventListener('click', () => deleteBlock(roleId, Number(button.dataset.deleteContent))));
  };

  const renderKnowledgeLinks = (sourcePanel, roleId, links) => {
    const section = document.createElement('section');
    section.className = 'role-knowledge-links';
    section.innerHTML = `
      <div class="role-full-section-head"><div><h4>百科來源對應</h4><p>顯示角色與鐘樓百科節點的配對狀態。</p></div></div>
      ${links.length ? links.map((link) => `
        <div class="role-knowledge-link" data-link-id="${link.id}">
          <div><strong>${escapeHtml(link.knowledge_name || `節點 #${link.knowledge_node_id}`)}</strong><span>${escapeHtml(link.knowledge_slug || '')} · ${escapeHtml(link.match_method)} · 信心 ${Number(link.confidence || 0).toFixed(2)}</span></div>
          <select id="rkl-status-${link.id}" class="form-control dark-input">${optionList(reviewOptions, link.review_status)}</select>
          <button type="button" class="btn btn-outline" data-save-link="${link.id}">儲存</button>
        </div>`).join('') : '<div class="role-admin-meta">尚未連結百科節點。</div>'}`;
    sourcePanel.insertBefore(section, sourcePanel.firstChild);
    section.querySelectorAll('[data-save-link]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await request(`/api/admin/roles/${roleId}/knowledge-links/${button.dataset.saveLink}`, {
          method: 'PATCH', body: JSON.stringify({ review_status: $(`rkl-status-${button.dataset.saveLink}`).value }),
        });
        status('百科對應狀態已儲存。');
      } catch (err) { status(`儲存失敗：${err.message}`, true); }
    }));
  };

  const loadFullEditor = async (editor, roleId) => {
    if (!roleId || loadingRoleId === roleId) return;
    loadingRoleId = roleId;
    activeRoleId = roleId;
    const panels = markExistingSections(editor);
    try {
      const data = await request(`/api/admin/roles/${roleId}/content`);
      if (activeRoleId !== roleId) return;
      renderKnowledgePanel(panels.knowledgePanel, roleId, data);
      renderKnowledgeLinks(panels.sourcePanel, roleId, data.knowledge_links || []);
    } catch (err) {
      panels.knowledgePanel.innerHTML = `<div class="role-admin-empty">百科內容讀取失敗：${escapeHtml(err.message)}</div>`;
      status(`完整版資料讀取失敗：${err.message}`, true);
    } finally {
      loadingRoleId = null;
    }
  };

  const saveBlock = async (roleId, blockId) => {
    const payload = {
      block_type: $(`rc-type-${blockId}`).value,
      audience: $(`rc-audience-${blockId}`).value,
      review_status: $(`rc-review-${blockId}`).value,
      sort_order: Number($(`rc-order-${blockId}`).value || 0),
      title: $(`rc-title-${blockId}`).value.trim() || null,
      content: $(`rc-content-${blockId}`).value,
      source_url: $(`rc-url-${blockId}`).value.trim() || null,
      is_active: $(`rc-active-${blockId}`).checked,
    };
    try {
      await request(`/api/admin/roles/${roleId}/content/${blockId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      status('百科內容區塊已儲存。');
    } catch (err) { status(`區塊儲存失敗：${err.message}`, true); }
  };

  const createBlock = async (roleId) => {
    const payload = {
      block_type: $('rc-new-type').value,
      audience: $('rc-new-audience').value,
      review_status: $('rc-new-review').value,
      sort_order: Number($('rc-new-order').value || 0),
      title: $('rc-new-title').value.trim() || null,
      content: $('rc-new-content').value.trim(),
      source: 'manual',
      source_key: `manual:${Date.now()}`,
      is_active: true,
    };
    if (!payload.content) return status('新增內容不可空白。', true);
    try {
      await request(`/api/admin/roles/${roleId}/content`, { method: 'POST', body: JSON.stringify(payload) });
      status('已新增內容區塊。');
      const editor = $('role-admin-editor');
      editor.dataset.fullEditorInstalled = '';
      window.RoleAdmin?.refresh?.();
      setTimeout(() => document.querySelector(`[data-role-id="${roleId}"]`)?.click(), 250);
    } catch (err) { status(`新增失敗：${err.message}`, true); }
  };

  const deleteBlock = async (roleId, blockId) => {
    if (!confirm('確定刪除此內容區塊？')) return;
    try {
      await request(`/api/admin/roles/${roleId}/content/${blockId}`, { method: 'DELETE' });
      status('內容區塊已刪除。');
      document.querySelector(`[data-content-block="${blockId}"]`)?.remove();
    } catch (err) { status(`刪除失敗：${err.message}`, true); }
  };

  const installStyle = () => {
    if ($('role-admin-full-editor-style')) return;
    const style = document.createElement('style');
    style.id = 'role-admin-full-editor-style';
    style.textContent = `
      .role-full-tabs{display:flex;gap:.5rem;flex-wrap:wrap;margin:-.1rem 0 1rem;padding:.4rem;border:1px solid #30364a;background:#151924;border-radius:12px}
      .role-full-tabs button{border:0;background:transparent;color:var(--ra-muted);padding:.65rem .9rem;border-radius:9px;font-weight:800;cursor:pointer}
      .role-full-tabs button.active{background:#2b2343;color:#fff;box-shadow:0 0 0 1px #8b7cf6 inset}
      .role-full-panel[hidden]{display:none!important}.role-full-panel{display:grid;gap:1rem}
      .role-full-section-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;border-bottom:1px solid #30364a;padding-bottom:.8rem}
      .role-full-section-head h4{margin:0;color:#fff}.role-full-section-head p{margin:.25rem 0 0;color:var(--ra-muted);font-size:.8rem}
      .role-content-list{display:grid;gap:.8rem}.role-content-card{border:1px solid #30364a;background:#151924;border-radius:14px;padding:.9rem}
      .role-content-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:.8rem}.role-content-head strong{display:block;color:#fff}.role-content-head span{display:block;color:var(--ra-muted);font-size:.74rem;margin-top:.2rem}
      .role-content-active{display:flex;align-items:center;gap:.4rem;color:var(--ra-muted)}
      .role-content-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem}.role-content-grid .wide{grid-column:1/-1}.role-content-grid label{display:block;color:var(--ra-label);font-size:.75rem;font-weight:800;margin-bottom:.35rem}
      .role-content-grid textarea{min-height:180px!important;font-family:inherit}.role-content-actions{display:flex;justify-content:flex-end;gap:.55rem;margin-top:.8rem}
      .role-content-new{border:1px dashed #625b89;background:#11151f;border-radius:14px;padding:.9rem}.role-knowledge-links{display:grid;gap:.65rem;margin-bottom:.5rem}
      .role-knowledge-link{display:grid;grid-template-columns:minmax(0,1fr) 180px auto;gap:.65rem;align-items:center;border:1px solid #30364a;background:#151924;border-radius:12px;padding:.75rem}
      .role-knowledge-link strong{display:block;color:#fff}.role-knowledge-link span{display:block;color:var(--ra-muted);font-size:.74rem;margin-top:.2rem}
      @media(max-width:720px){.role-content-grid,.role-knowledge-link{grid-template-columns:1fr}.role-content-grid .wide{grid-column:auto}.role-full-tabs{display:grid;grid-template-columns:1fr 1fr}.role-content-actions{justify-content:stretch}.role-content-actions .btn{flex:1}}
    `;
    document.head.appendChild(style);
  };

  const observeEditor = () => {
    const editor = $('role-admin-editor');
    if (!editor) return false;
    const tryInstall = () => {
      const roleId = getSelectedRoleId();
      if (!roleId || !editor.querySelector('.role-editor-head') || editor.querySelector('.role-full-tabs')) return;
      loadFullEditor(editor, roleId);
    };
    const observer = new MutationObserver(() => requestAnimationFrame(tryInstall));
    observer.observe(editor, { childList: true, subtree: false });
    tryInstall();
    return true;
  };

  installStyle();
  if (!observeEditor()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (observeEditor() || tries > 40) clearInterval(timer);
    }, 100);
  }
})();
