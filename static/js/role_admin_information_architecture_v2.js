(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const apiBase = () => window.API_BASE || '';
  let lastRoleId = null;
  let contentPayload = null;

  const request = async (path, options = {}) => {
    const response = await fetch(`${apiBase()}${path}`, {
      credentials: 'same-origin',
      headers: { 'Content-Type':'application/json', ...(options.headers || {}) },
      ...options,
    });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data?.detail || `HTTP ${response.status}`);
    return data;
  };

  const labelForType = (type) => ({
    background:'背景故事', overview:'角色簡介', how_it_works:'運作方式',
    rules_detail:'規則細節', rules_interactions:'角色互動', rules_jinx:'相剋規則',
    examples:'範例', common_mistakes:'常見誤解', strategy_play:'如何遊玩',
    strategy_bluff:'如何偽裝', strategy_counter:'如何對抗', storyteller_advice:'說書人建議',
    player_summary:'玩家摘要', reminders:'提示標記說明', custom_note:'自訂內容', source_excerpt:'來源節錄',
  }[type] || type || '未分類');

  const targetsFromAudience = (audience) => {
    if (audience === 'all') return ['player','encyclopedia','storyteller'];
    if (audience === 'player') return ['player'];
    if (audience === 'storyteller') return ['storyteller'];
    return ['encyclopedia'];
  };

  const audienceFromTargets = (targets) => {
    const set = new Set(targets);
    if (set.has('player') && set.has('encyclopedia') && set.has('storyteller')) return 'all';
    if (set.size === 1 && set.has('player')) return 'player';
    if (set.size === 1 && set.has('storyteller')) return 'storyteller';
    return 'encyclopedia';
  };

  const blockCard = (block) => `
    <article class="ia-block-card" data-block-id="${block.id}">
      <div class="ia-block-head">
        <div><strong>${esc(block.title || labelForType(block.block_type))}</strong><span>${esc(labelForType(block.block_type))} · ${esc(block.source || 'manual')}</span></div>
        <span class="ia-source-badge ${block.source === 'larplus' || block.source === 'manual' ? 'larplus' : ''}">${esc(block.source || 'manual')}</span>
      </div>
      <div class="ia-block-content">${block.content_format === 'html' ? (block.content || '') : `<pre>${esc(block.content || '')}</pre>`}</div>
    </article>`;

  const displayRow = (block) => {
    const selected = targetsFromAudience(block.audience);
    return `<div class="ia-display-row" data-display-block="${block.id}">
      <div><strong>${esc(block.title || labelForType(block.block_type))}</strong><span>${esc(labelForType(block.block_type))} · ${esc(block.source || 'manual')}</span></div>
      <label><input type="checkbox" value="player" ${selected.includes('player')?'checked':''}> 玩家</label>
      <label><input type="checkbox" value="encyclopedia" ${selected.includes('encyclopedia')?'checked':''}> 百科</label>
      <label><input type="checkbox" value="storyteller" ${selected.includes('storyteller')?'checked':''}> 說書人</label>
      <label class="ia-admin-lock"><input type="checkbox" checked disabled> 後台</label>
      <button type="button" class="btn btn-outline ia-save-display">儲存</button>
    </div>`;
  };

  const injectTabs = async () => {
    const editor = $('role-admin-editor');
    const active = document.querySelector('.role-admin-row.active');
    const roleId = Number(active?.dataset?.roleId || 0);
    if (!editor || !roleId || editor.dataset.iaV2Role === String(roleId)) return;
    if (!editor.querySelector('.role-editor-grid')) return;

    editor.dataset.iaV2Role = String(roleId);
    lastRoleId = roleId;
    try { contentPayload = await request(`/api/admin/roles/${roleId}/content`); }
    catch (err) { contentPayload = { content_blocks:[], knowledge_links:[], error:err.message }; }

    const header = editor.querySelector('.role-editor-head');
    const grid = editor.querySelector('.role-editor-grid');
    const checkboxes = editor.querySelector('.role-checkboxes');
    const reminderSection = editor.querySelector('.role-reminder-section');
    const actions = editor.querySelector('.role-editor-actions:last-child');

    const allChildren = Array.from(editor.children);
    const aliasHeading = allChildren.find((node) => node.tagName === 'H4' && node.textContent.includes('外部 ID'));
    const aliasList = editor.querySelector('.alias-list');
    const aliasAdd = editor.querySelector('.alias-add');

    const corePane = document.createElement('section');
    corePane.className = 'ia-pane active'; corePane.dataset.iaPane = 'core';
    if (grid) corePane.appendChild(grid);
    if (checkboxes) corePane.appendChild(checkboxes);
    if (aliasHeading) corePane.appendChild(aliasHeading);
    if (aliasList) corePane.appendChild(aliasList);
    if (aliasAdd) corePane.appendChild(aliasAdd);
    if (actions) corePane.appendChild(actions);

    const blocks = contentPayload.content_blocks || [];
    const sharedBlocks = blocks.filter((b) => !['larplus','manual'].includes(String(b.source || '').toLowerCase()));
    const larplusBlocks = blocks.filter((b) => ['larplus','manual'].includes(String(b.source || '').toLowerCase()));

    const contentPane = document.createElement('section');
    contentPane.className = 'ia-pane'; contentPane.dataset.iaPane = 'content';
    contentPane.innerHTML = `<div class="ia-pane-intro"><h4>角色內容</h4><p>百科、規則、範例與其他可分眾內容都集中在這裡。提示標記本體仍以說書人操作資料為準。</p></div><div class="ia-block-list">${sharedBlocks.map(blockCard).join('') || '<div class="role-admin-empty">尚無百科或通用內容。</div>'}</div>`;
    if (reminderSection) contentPane.appendChild(reminderSection);

    const larplusPane = document.createElement('section');
    larplusPane.className = 'ia-pane'; larplusPane.dataset.iaPane = 'larplus';
    larplusPane.innerHTML = `<div class="ia-pane-intro"><h4>拉普拉斯專屬內容</h4><p>店內裁定、主持提醒、教學話術與人工補充集中在此，不受百科同步覆蓋。</p></div><div class="ia-block-list">${larplusBlocks.map(blockCard).join('') || '<div class="role-admin-empty">目前沒有拉普拉斯專屬 Block。</div>'}</div>`;

    const displayPane = document.createElement('section');
    displayPane.className = 'ia-pane'; displayPane.dataset.iaPane = 'display';
    displayPane.innerHTML = `<div class="ia-pane-intro"><h4>顯示設定</h4><p>這裡只管理「給誰看」，不在此編輯正文。管理後台永遠可見。</p><div class="ia-warning">目前資料庫仍使用單一 audience 欄位。介面允許勾選多個情境，但會依相容規則折算儲存，作為新版資訊架構試用。</div></div>
      <div class="ia-display-section"><h5>固定資料模組</h5>
        ${['角色名稱','角色 icon','陣營','官方能力','首夜／其他夜順序','提示標記'].map((name,i)=>`<div class="ia-display-row static"><div><strong>${name}</strong><span>核心模組</span></div><label><input type="checkbox" ${i<4?'checked':''}> 玩家</label><label><input type="checkbox" ${i<4?'checked':''}> 百科</label><label><input type="checkbox" checked> 說書人</label><label class="ia-admin-lock"><input type="checkbox" checked disabled> 後台</label><span class="ia-static-note">預覽</span></div>`).join('')}
      </div>
      <div class="ia-display-section"><h5>內容 Blocks</h5>${blocks.map(displayRow).join('') || '<div class="role-admin-empty">尚無內容 Block。</div>'}</div>`;

    const nav = document.createElement('nav');
    nav.className = 'ia-tabs';
    nav.innerHTML = `<button class="active" data-ia-tab="core">核心資料</button><button data-ia-tab="content">角色內容</button><button data-ia-tab="larplus">拉普拉斯內容</button><button data-ia-tab="display">顯示設定</button>`;

    header.insertAdjacentElement('afterend', nav);
    nav.insertAdjacentElement('afterend', corePane);
    corePane.insertAdjacentElement('afterend', contentPane);
    contentPane.insertAdjacentElement('afterend', larplusPane);
    larplusPane.insertAdjacentElement('afterend', displayPane);

    nav.querySelectorAll('[data-ia-tab]').forEach((button) => button.addEventListener('click', () => {
      nav.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
      editor.querySelectorAll('.ia-pane').forEach((pane) => pane.classList.toggle('active', pane.dataset.iaPane === button.dataset.iaTab));
    }));

    displayPane.querySelectorAll('.ia-save-display').forEach((button) => button.addEventListener('click', async () => {
      const row = button.closest('[data-display-block]');
      const blockId = Number(row.dataset.displayBlock);
      const targets = Array.from(row.querySelectorAll('input:not(:disabled):checked')).map((input) => input.value);
      if (!targets.length) return alert('至少選擇一個顯示情境。');
      button.disabled = true; button.textContent = '儲存中…';
      try {
        await request(`/api/admin/roles/${roleId}/content/${blockId}`, { method:'PATCH', body:JSON.stringify({ audience:audienceFromTargets(targets) }) });
        button.textContent = '已儲存';
        setTimeout(() => { button.disabled = false; button.textContent = '儲存'; }, 900);
      } catch (err) {
        button.disabled = false; button.textContent = '儲存'; alert(`儲存失敗：${err.message}`);
      }
    }));
  };

  const observer = new MutationObserver(() => { window.clearTimeout(observer.timer); observer.timer = window.setTimeout(injectTabs, 80); });
  const start = () => {
    const editor = $('role-admin-editor');
    if (!editor) return setTimeout(start, 200);
    observer.observe(editor, { childList:true, subtree:false });
    injectTabs();
  };
  start();
})();