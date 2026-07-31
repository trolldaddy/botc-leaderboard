(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const apiBase = () => window.API_BASE || '';

  const installStableLayout = () => {
    if (document.getElementById('role-admin-stable-layout')) return;
    const style = document.createElement('style');
    style.id = 'role-admin-stable-layout';
    style.textContent = `
      html, body { max-width: 100%; overflow-x: hidden; }
      html { scrollbar-gutter: stable; }
      .role-admin-shell,
      .role-sync-panel {
        width: min(100%, 1500px) !important;
        max-width: calc(100vw - 2rem) !important;
        margin-inline: auto !important;
      }
      .role-admin-layout {
        display: grid !important;
        grid-template-columns: clamp(220px, 20vw, 290px) minmax(0, 1fr) !important;
        width: 100%;
        max-width: 100%;
        gap: 1rem;
      }
      .role-admin-list,
      .role-admin-editor,
      .role-admin-editor > *,
      .ia-pane,
      .role-content-list,
      .role-content-card,
      .role-content-grid,
      .ia-display-section,
      .ia-display-row { min-width: 0; max-width: 100%; }
      .role-admin-editor {
        width: 100%;
        overflow-x: hidden;
      }
      .role-admin-editor.ia-enhancing {
        position: relative;
        min-height: 420px;
      }
      .role-admin-editor.ia-enhancing > * {
        visibility: hidden !important;
      }
      .role-admin-editor.ia-enhancing::after {
        content: '正在整理角色資料…';
        position: absolute;
        inset: 0;
        min-height: 220px;
        display: grid;
        place-items: center;
        visibility: visible;
        color: #aeb6c9;
        border: 1px solid #30364a;
        border-radius: 14px;
        background: linear-gradient(145deg, rgba(22,26,40,.98), rgba(15,18,29,.98));
      }
      .ia-tabs {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        width: 100%;
        gap: .5rem;
        margin: 0 0 1rem;
      }
      .ia-tabs button {
        width: 100%;
        min-width: 0;
        min-height: 46px;
        padding: .7rem .45rem;
        white-space: normal;
        line-height: 1.25;
        text-align: center;
      }
      .role-admin-editor > .role-editor-actions { position:sticky; top:.5rem; z-index:20; margin-top:1rem; padding:.7rem; border:1px solid #39415a; border-radius:12px; background:rgba(17,21,34,.96); box-shadow:0 -8px 24px rgba(0,0,0,.34); backdrop-filter:blur(10px); }
      .ia-pane { display: none !important; width: 100%; }
      .ia-pane.active { display: block !important; }
      .role-editor-grid,
      .role-content-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .role-content-grid input,
      .role-content-grid textarea,
      .role-content-grid select,
      .role-editor-grid input,
      .role-editor-grid textarea,
      .role-editor-grid select { min-width: 0; max-width: 100%; }
      .ia-display-row > div { min-width: 0; overflow-wrap: anywhere; }
      .role-admin-toolbar { width: 100%; max-width: 100%; }
      .role-tag-picker { display:grid; gap:.55rem; }
      .role-tag-controls { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:.5rem; }
      .role-tag-selected { display:flex; flex-wrap:wrap; gap:.4rem; min-height:34px; align-items:center; }
      .role-tag-selected > span { color:#8993aa; font-size:.8rem; }
      .role-tag-selected button { border:1px solid rgba(255,209,102,.35); background:rgba(255,209,102,.09); color:#ffd166; border-radius:999px; padding:.32rem .62rem; cursor:pointer; font-weight:800; }
      .role-identity-card { display:flex; justify-content:space-between; gap:1rem; align-items:center; margin:0 0 1rem; padding:1rem; border:1px solid #39415a; border-radius:16px; background:linear-gradient(135deg,#171b27,#11141d); }
      .role-identity-main { display:flex; align-items:center; gap:1rem; min-width:0; }
      .role-identity-main img,.role-identity-icon { width:84px; height:84px; flex:0 0 84px; border-radius:50%; object-fit:contain; background:#252a38; }
      .role-identity-main h4 { margin:0 0 .55rem; color:#fff; font-size:1.3rem; }
      .role-identity-main h4 span { display:block; margin-top:.2rem; color:#aeb6c9; font-size:.82rem; font-weight:600; }
      .role-identity-tags,.role-ability-tags,.role-reference-links { display:flex; flex-wrap:wrap; gap:.4rem; }
      .role-identity-tags span,.role-ability-tags span,.role-ability-tags a { padding:.28rem .58rem; border-radius:999px; border:1px solid rgba(139,124,246,.38); background:rgba(139,124,246,.12); color:#ece9ff; font-size:.76rem; font-weight:800; }
      .role-ability-tags { margin-top:.45rem; }
      .role-ability-tags span,.role-ability-tags a { text-decoration:none; border-color:rgba(255,209,102,.35); background:rgba(255,209,102,.09); color:#ffd166; }
      .role-ability-tags span.empty { color:#aeb6c9; border-color:#39415a; background:transparent; }
      .role-reference-links { justify-content:flex-end; }
      .role-editor-head { justify-content:space-between; }
      .role-editor-head-main { display:flex; align-items:center; gap:1rem; min-width:0; }
      .role-editor-head-links { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:.5rem; margin-left:auto; }
      .role-editor-head-links a { display:inline-flex; align-items:center; gap:.38rem; padding:.42rem .68rem; border:1px solid #39415a; border-radius:999px; color:#cfc8ff; text-decoration:none; font-size:.76rem; font-weight:800; background:#171b27; }
      .role-editor-head-links a:hover { border-color:#8b7cf6; color:#fff; }
      .role-reference-links a { display:inline-flex; align-items:center; gap:.4rem; color:#cfc8ff; text-decoration:none; font-size:.8rem; font-weight:800; }
      .role-source-details { margin:1rem 0; padding:.8rem; border:1px solid #30364a; border-radius:12px; background:#131722; }
      .role-source-details summary { cursor:pointer; color:#ffd166; font-weight:900; }
      .role-source-details .role-editor-grid { margin-top:.8rem; }
      .role-display-details { margin:1rem 0; border:1px solid #30364a; border-radius:12px; background:#131722; overflow:hidden; }
      .role-display-details > summary { cursor:pointer; padding:.85rem 1rem; color:#ffd166; font-weight:900; }
      .role-display-help { margin:0; padding:0 1rem .8rem; color:#aeb6c9; font-size:.8rem; line-height:1.6; }
      .role-display-details .ia-display-section { border-top:1px solid #30364a; }
      .role-display-details .ia-display-row { display:grid; grid-template-columns:minmax(180px,1fr) minmax(150px,.45fr) auto; gap:.7rem; align-items:center; padding:.7rem 1rem; border-bottom:1px solid #282e40; }
      .role-display-details .ia-display-row:last-child { border-bottom:0; }
      .role-display-details .ia-display-row span { display:block; margin-top:.2rem; color:#8993aa; font-size:.72rem; }
      .role-setting-groups { display:grid; gap:1rem; margin-top:1rem; }
      .role-setting-groups > section { overflow:hidden; border:1px solid #30364a; border-radius:12px; background:#131722; }
      .role-setting-groups h4 { margin:0; padding:.8rem 1rem; color:#ffd166; border-bottom:1px solid #30364a; }
      .role-setting-columns,.role-setting-row { display:grid; grid-template-columns:minmax(210px,1fr) repeat(3,104px); gap:.7rem; align-items:center; }
      .role-setting-columns { position:sticky; top:0; z-index:2; padding:.55rem 1rem; color:#aab1c5; font-size:.78rem; text-align:center; border-bottom:1px solid #343b50; background:#131722; box-shadow:0 5px 10px rgba(0,0,0,.16); }
      .role-setting-columns span:first-child { text-align:left; }
      .role-setting-row { padding:.65rem 1rem; border-bottom:1px solid #282e40; }
      .role-setting-row:last-child { border-bottom:0; }
      .role-setting-row.is-dirty { background:rgba(255,209,102,.06); box-shadow:inset 3px 0 #ffd166; }
      .role-setting-name span { display:block; margin-top:.2rem; color:#8993aa; font-size:.72rem; }
      .role-setting-view { display:grid; grid-template-columns:auto 1fr; gap:.35rem .5rem; align-items:center; color:#dfe3ee; font-size:.78rem; font-weight:800; }
      .role-setting-view > span { display:none; grid-column:1 / -1; color:#8993aa; }
      .role-setting-view input[type="number"] { width:64px; min-width:64px; max-width:64px; height:34px; padding:.35rem .45rem; text-align:center; }
      .role-setting-view input[type="checkbox"] { width:19px; height:19px; accent-color:#8b7cf6; cursor:pointer; }
      .role-setting-actions { display:flex; justify-content:flex-end; margin-top:1rem; }
      @media (max-width:720px) { .role-setting-columns { display:none; } .role-setting-row { grid-template-columns:1fr; } .role-setting-view > span { display:block; } .role-editor-head { align-items:flex-start; flex-direction:column; } .role-editor-head-links { justify-content:flex-start; margin-left:0; } .role-identity-card { align-items:flex-start; flex-direction:column; } .role-reference-links { justify-content:flex-start; } .role-display-details .ia-display-row { grid-template-columns:1fr; } }      @media (max-width: 1180px) {
        .role-admin-layout { grid-template-columns: 230px minmax(0, 1fr) !important; }
        .ia-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 900px) {
        .role-admin-shell,
        .role-sync-panel { max-width: calc(100vw - 1rem) !important; }
        .role-admin-layout { grid-template-columns: 1fr !important; }
        .role-admin-list { max-height: 34vh !important; }
      }
      @media (max-width: 640px) {
        .role-editor-grid,
        .role-content-grid { grid-template-columns: 1fr !important; }
        .role-editor-grid .wide,
        .role-content-grid .wide { grid-column: auto !important; }
        .ia-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .ia-tabs button { min-height: 44px; font-size: .9rem; }
      }
    `;
    document.head.appendChild(style);
  };
  installStableLayout();

  const request = async (path, options = {}) => {
    const requestOptions = {
      credentials: 'same-origin',
      headers: { 'Content-Type':'application/json', ...(options.headers || {}) },
      ...options,
    };
    const method = String(requestOptions.method || 'GET').toUpperCase();
    const retryableStatuses = new Set([500, 502, 503, 504]);
    let response;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      response = await fetch(`${apiBase()}${path}`, requestOptions);
      if (method !== 'GET' || !retryableStatuses.has(response.status) || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data?.detail || `HTTP ${response.status}`);
    return data;
  };
  const labelForType = (type) => ({
    background:'背景故事', ability:'角色能力補充', overview:'角色簡介', how_it_works:'運作方式',
    rules_detail:'規則細節', rules_interactions:'角色互動', rules_jinx:'相剋規則',
    examples:'範例', common_mistakes:'常見誤解', strategy_play:'如何遊玩',
    strategy_bluff:'如何偽裝', strategy_counter:'如何對抗', storyteller_advice:'說書人建議',
    player_summary:'玩家摘要', reminders:'提示標記說明',
    custom_note:'自訂內容', source_excerpt:'來源節錄',
  }[type] || type || '未分類');

  const getRoleId = () => Number(document.querySelector('.role-admin-row.active[data-role-id]')?.dataset?.roleId || 0);

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
    <article class="role-content-card ia-card" data-content-block="${block.id}">
      <div class="role-content-head">
        <div><strong>${esc(block.title || labelForType(block.block_type))}</strong><span>${esc(labelForType(block.block_type))} · ${esc(block.source || 'manual')} · ${esc(block.review_status || '')}</span></div>
        <label class="role-content-active"><input id="rc-active-${block.id}" type="checkbox" ${block.is_active ? 'checked' : ''}> 啟用</label>
      </div>
      <div class="role-content-grid">
        <div><label>區塊類型</label><input id="rc-type-${block.id}" class="form-control dark-input" value="${esc(block.block_type || '')}"></div>
        <div><label>審核狀態</label><select id="rc-review-${block.id}" class="form-control dark-input"><option value="needs_review" ${block.review_status==='needs_review'?'selected':''}>待確認</option><option value="confirmed" ${block.review_status==='confirmed'?'selected':''}>已確認</option><option value="rejected" ${block.review_status==='rejected'?'selected':''}>不採用</option></select></div>
        <div><label>排序</label><input id="rc-order-${block.id}" class="form-control dark-input" type="number" value="${Number(block.sort_order || 0)}"></div>
        <div><label>來源</label><input class="form-control dark-input" value="${esc(block.source || '')}" readonly></div>
        <div class="wide"><label>標題</label><input id="rc-title-${block.id}" class="form-control dark-input" value="${esc(block.title || '')}"></div>
        <div class="wide"><label>內容</label><textarea id="rc-content-${block.id}" class="form-control dark-input">${esc(block.content || '')}</textarea></div>
        <div class="wide"><label>來源網址</label><input id="rc-url-${block.id}" class="form-control dark-input" value="${esc(block.source_url || '')}"></div>
      </div>
      <div class="role-content-actions"><button type="button" class="btn btn-outline" data-delete-content="${block.id}">刪除</button><button type="button" class="btn btn-purple" data-save-content="${block.id}">儲存區塊</button></div>
    </article>`;

  const roleDisplayRow = (item) => `<div class="role-setting-row" data-role-setting="${esc(item.item_key)}">
    <div class="role-setting-name"><strong>${esc(item.label)}</strong><span>${esc(item.item_key)}${item.is_overridden ? ' \u00b7 \u6b64\u89d2\u8272\u5df2\u81ea\u8a02' : ' \u00b7 \u6cbf\u7528\u5168\u57df\u503c'}</span></div>
    ${['player','encyclopedia','storyteller'].map((view) => `<label class="role-setting-view"><span>${({player:'\u73a9\u5bb6',encyclopedia:'\u767e\u79d1',storyteller:'\u8aaa\u66f8\u4eba'})[view]}</span><input type="checkbox" data-show="${view}" ${item[`show_${view}`] ? 'checked' : ''}><input class="form-control dark-input" type="number" data-sort="${view}" value="${Number(item[`sort_${view}`] || 0)}" aria-label="${view} \u6392\u5e8f"></label>`).join('')}
  </div>`;

  const saveBlock = async (roleId, blockId) => {
    const payload = {
      block_type:$(`rc-type-${blockId}`).value.trim(), review_status:$(`rc-review-${blockId}`).value,
      sort_order:Number($(`rc-order-${blockId}`).value || 0), title:$(`rc-title-${blockId}`).value.trim() || null,
      content:$(`rc-content-${blockId}`).value, source_url:$(`rc-url-${blockId}`).value.trim() || null,
      is_active:$(`rc-active-${blockId}`).checked,
    };
    await request(`/api/admin/roles/${roleId}/content/${blockId}`, { method:'PATCH', body:JSON.stringify(payload) });
  };

  const enhance = async () => {
    const editor = $('role-admin-editor');
    const roleId = getRoleId();
    if (!editor || !roleId || !editor.querySelector('.role-editor-grid')) return;
    if (editor.dataset.iaV2Role === String(roleId) && editor.querySelector('.ia-tabs')) return;
    editor.classList.add('ia-enhancing');
    editor.dataset.iaV2Role = String(roleId);

    let data;
    let abilityTypeNodes = [];
    try {
      const [contentData, mechanicData] = await Promise.all([
        request(`/api/admin/roles/${roleId}/content`),
        request('/api/admin/knowledge/ability-types'),
      ]);
      data = contentData;
      abilityTypeNodes = mechanicData.items || [];
    } catch (err) {
      data = await request(`/api/admin/roles/${roleId}/content`).catch(() => ({ content_blocks:[], knowledge_links:[], error:err.message }));
    }

    const abilityInput = $('ra-ability-tags');
    if (abilityInput) {
      const holder = abilityInput.parentElement;
      const picker = document.createElement('div');
      picker.className = 'role-tag-picker';
      const selected = new Set(String(abilityInput.value || '').split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean));
      const renderTags = () => {
        abilityInput.value = Array.from(selected).join('、');
        picker.querySelector('.role-tag-selected').innerHTML = Array.from(selected).map((tag) => `<button type="button" data-remove-tag="${esc(tag)}">${esc(tag)} <i class="fa-solid fa-xmark"></i></button>`).join('') || '<span>尚未選擇能力類型</span>';
        picker.querySelectorAll('[data-remove-tag]').forEach((button) => button.addEventListener('click', () => { selected.delete(button.dataset.removeTag); renderTags(); }));
      };
      picker.innerHTML = `<div class="role-tag-controls"><select class="form-control dark-input"><option value="">從百科機制節點選擇…</option>${abilityTypeNodes.map((node) => `<option value="${esc(node.name_zh_tw)}">${esc(node.name_zh_tw)}</option>`).join('')}</select><button type="button" class="btn btn-outline">加入</button></div><div class="role-tag-selected"></div>`;
      picker.querySelector('button').addEventListener('click', () => { const select = picker.querySelector('select'); if (!select.value) return; selected.add(select.value); select.value=''; renderTags(); });
      abilityInput.hidden = true;
      holder.appendChild(picker);
      renderTags();
    }

    const header = editor.querySelector('.role-editor-head');
    const originalGrid = editor.querySelector('.role-editor-grid');
    const checks = editor.querySelector('.role-checkboxes');
    const reminder = editor.querySelector('.role-reminder-section');
    const aliasTitle = Array.from(editor.children).find((node) => node.tagName === 'H4' && node.textContent.includes('外部 ID'));
    const aliasList = editor.querySelector('.alias-list');
    const aliasAdd = editor.querySelector('.alias-add');
    const actions = Array.from(editor.querySelectorAll(':scope > .role-editor-actions')).pop();

    const takeFields = (ids) => {
      const grid = document.createElement('div');
      grid.className = 'role-editor-grid';
      ids.forEach((id) => {
        const field = $(`${id}`)?.closest('.role-editor-grid > div');
        if (field) grid.appendChild(field);
      });
      return grid;
    };

    const identityGrid = takeFields(['ra-name-zh','ra-name-en','ra-team','ra-scripts','ra-ability-tags','ra-image','ra-ability']);
    const sourceGrid = takeFields(['ra-source-type','ra-source-name','ra-author']);
    const extensionGrid = takeFields(['ra-first-order','ra-other-order','ra-first-reminder','ra-other-reminder']);
    const larplusGrid = takeFields(['ra-guide-summary','ra-guide-ability','ra-guide-play','ra-guide-advanced','ra-guide-storyteller','ra-guide-mistakes']);
    originalGrid.remove();

    const blocks = (data.content_blocks || []).filter((block) => {
      const source = String(block.source || '').toLowerCase();
      return block.is_active || ['larplus', 'manual'].includes(source);
    });
    const shared = blocks.filter((b) => !['larplus','manual'].includes(String(b.source || '').toLowerCase()) && !String(b.block_type || '').startsWith('reminders'));
    const larplus = blocks.filter((b) => ['larplus','manual'].includes(String(b.source || '').toLowerCase()));
    const baseType = (block) => String(block.block_type || '').replace(/_\d+$/, '');
    const extendedTypes = new Set(['how_it_works','rules_detail','rules_interactions','rules_jinx']);
    const extendedBlocks = shared.filter((block) => extendedTypes.has(baseType(block)));
    const coreBlocks = shared.filter((block) => !extendedTypes.has(baseType(block)));

    const externalSource = shared.find((block) => block.source_url)?.source_url || '';
    const primaryKnowledge = (data.knowledge_links || [])[0];
    const headerMain = document.createElement('div');
    headerMain.className = 'role-editor-head-main';
    while (header.firstChild) headerMain.appendChild(header.firstChild);
    header.appendChild(headerMain);
    const headerLinks = document.createElement('div');
    headerLinks.className = 'role-editor-head-links';
    headerLinks.innerHTML = `${primaryKnowledge ? `<a href="#knowledge/${encodeURIComponent(primaryKnowledge.knowledge_slug || '')}"><i class="fa-solid fa-book-open"></i> \u89d2\u8272\u8cc7\u6599\u9801</a>` : ''}${externalSource ? `<a href="${esc(externalSource)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> GStone \u5b98\u65b9\u8cc7\u6599</a>` : ''}`;
    if (headerLinks.childElementCount) header.appendChild(headerLinks);

    const core = document.createElement('section'); core.className='ia-pane active'; core.dataset.iaPane='content';
    core.innerHTML='<div class="ia-pane-intro"><h4>角色內容</h4><p>角色識別、官方能力、百科閱讀內容與策略集中在這裡。</p></div>';
    core.appendChild(identityGrid);
    const sourceDetails = document.createElement('details'); sourceDetails.className='role-source-details'; sourceDetails.innerHTML='<summary>來源與同步資料</summary>'; sourceDetails.appendChild(sourceGrid); core.appendChild(sourceDetails);
    if (checks) core.appendChild(checks);
    const coreList = document.createElement('div'); coreList.className='role-content-list'; coreList.innerHTML=coreBlocks.map(blockCard).join('') || '<div class="role-admin-empty">尚無百科角色內容。</div>'; core.appendChild(coreList);
    if (aliasTitle) core.appendChild(aliasTitle); if (aliasList) core.appendChild(aliasList); if (aliasAdd) core.appendChild(aliasAdd);

    const extension = document.createElement('section'); extension.className='ia-pane'; extension.dataset.iaPane='extension';
    extension.innerHTML='<div class="ia-pane-intro"><h4>延伸資料</h4><p>運作方式、夜間流程、提示標記與規則細節集中在這裡。</p></div>';
    extension.appendChild(extensionGrid);
    if (reminder) extension.appendChild(reminder);
    const extensionList = document.createElement('div'); extensionList.className='role-content-list'; extensionList.innerHTML=extendedBlocks.map(blockCard).join('') || '<div class="role-admin-empty">尚無延伸規則資料。</div>'; extension.appendChild(extensionList);

    const lap = document.createElement('section'); lap.className='ia-pane'; lap.dataset.iaPane='larplus';
    lap.innerHTML='<div class="ia-pane-intro"><h4>拉普拉斯資料</h4><p>一句話定位、店內教學、常見誤解與說書人建議集中於此，不受百科同步覆蓋。</p></div>';
    lap.appendChild(larplusGrid);
    const lapList = document.createElement('div'); lapList.className='role-content-list'; lapList.innerHTML=larplus.map(blockCard).join('') || '<div class="role-admin-empty">目前沒有額外的拉普拉斯 Block。</div>'; lap.appendChild(lapList);

    const displayPane = document.createElement('section'); displayPane.className='ia-pane role-display-pane'; displayPane.dataset.iaPane='display';
    const roleSettings = data.display_settings || [];
    const moduleSettings = roleSettings.filter((item) => item.item_type === 'module');
    const blockSettings = roleSettings.filter((item) => item.item_type === 'block');
    displayPane.innerHTML=`<div class="ia-pane-intro"><h4>\u986f\u793a\u8a2d\u5b9a</h4><p>\u9019\u88e1\u53ef\u70ba\u76ee\u524d\u89d2\u8272\u8986\u5beb\u5b8c\u6574\u7684\u73a9\u5bb6\u3001\u767e\u79d1\u8207\u8aaa\u66f8\u4eba\u986f\u793a\u898f\u5247\u3002\u672a\u4fee\u6539\u6642\u6cbf\u7528\u4e0a\u65b9\u5de5\u5177\u5217\u7684\u5168\u57df\u8a2d\u5b9a\u3002</p><p><strong>\u53ea\u60f3\u589e\u52a0\u300c\u4e00\u53e5\u8a71\u5b9a\u4f4d\u300d\uff1a</strong>\u5148\u5728\u300c\u62c9\u666e\u62c9\u65af\u8cc7\u6599\u300d\u586b\u5beb\u4e00\u53e5\u8a71\uff0c\u518d\u56de\u6b64\u9801\u52fe\u9078\u300c\u4e00\u53e5\u8a71\u5b9a\u4f4d\u300d\u8981\u51fa\u73fe\u7684\u8996\u89d2\u3002</p></div><div class="role-setting-groups"><section><h4>\u56fa\u5b9a\u8cc7\u6599\u6a21\u7d44</h4><div class="role-setting-columns"><span>資料項目</span><span>玩家</span><span>百科</span><span>說書人</span></div>${moduleSettings.map(roleDisplayRow).join('')}</section><section><h4>\u5167\u5bb9 Block \u985e\u578b</h4><div class="role-setting-columns"><span>資料項目</span><span>玩家</span><span>百科</span><span>說書人</span></div>${blockSettings.map(roleDisplayRow).join('')}</section></div><div class="role-setting-actions"><button type="button" class="btn btn-purple" data-save-role-settings><i class="fa-solid fa-floppy-disk"></i> \u5132\u5b58\u6b64\u89d2\u8272\u986f\u793a\u8a2d\u5b9a</button></div>`;

    const tabs=document.createElement('nav'); tabs.className='ia-tabs'; tabs.innerHTML='<button class="active" data-ia-tab="content">角色內容</button><button data-ia-tab="extension">延伸資料</button><button data-ia-tab="larplus">拉普拉斯資料</button><button data-ia-tab="display">顯示設定</button>';
    header.insertAdjacentElement('afterend',tabs);
    if(actions){tabs.insertAdjacentElement('afterend',actions);actions.insertAdjacentElement('afterend',core);}else{tabs.insertAdjacentElement('afterend',core);}
    core.insertAdjacentElement('afterend',extension); extension.insertAdjacentElement('afterend',lap); lap.insertAdjacentElement('afterend',displayPane);

    tabs.querySelectorAll('[data-ia-tab]').forEach((button)=>button.addEventListener('click',()=>{
      tabs.querySelectorAll('button').forEach((item)=>item.classList.toggle('active',item===button));
      editor.querySelectorAll('.ia-pane').forEach((pane)=>pane.classList.toggle('active',pane.dataset.iaPane===button.dataset.iaTab));
    }));

    displayPane.querySelectorAll('[data-role-setting] input').forEach((input) => input.addEventListener('change', () => input.closest('[data-role-setting]').classList.add('is-dirty')));

    displayPane.querySelector('[data-save-role-settings]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const dirtyRows = Array.from(displayPane.querySelectorAll('[data-role-setting].is-dirty'));
      if (!dirtyRows.length) {
        button.innerHTML = '<i class="fa-solid fa-check"></i> \u6c92\u6709\u5f85\u5132\u5b58\u7684\u8b8a\u66f4';
        setTimeout(() => { button.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> \u5132\u5b58\u6b64\u89d2\u8272\u986f\u793a\u8a2d\u5b9a'; }, 900);
        return;
      }
      const items = dirtyRows.map((row) => {
        const item = { item_key: row.dataset.roleSetting };
        ['player','encyclopedia','storyteller'].forEach((view) => {
          item[`show_${view}`] = row.querySelector(`[data-show="${view}"]`).checked;
          item[`sort_${view}`] = Number(row.querySelector(`[data-sort="${view}"]`).value || 0);
        });
        return item;
      });
      button.disabled = true;
      try {
        await request(`/api/admin/roles/${roleId}/display-settings`, { method:'PUT', body:JSON.stringify({ items }) });
        button.innerHTML = '<i class="fa-solid fa-check"></i> \u5df2\u5132\u5b58';
        dirtyRows.forEach((row) => {
          row.classList.remove('is-dirty');
          const span = row.querySelector('.role-setting-name span');
          span.textContent = span.textContent.replace('\u6cbf\u7528\u5168\u57df\u503c', '\u6b64\u89d2\u8272\u5df2\u81ea\u8a02');
        });
      } catch (err) { alert(`\u5132\u5b58\u5931\u6557\uff1a${err.message}`); }
      finally { setTimeout(() => { button.disabled = false; button.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> \u5132\u5b58\u6b64\u89d2\u8272\u986f\u793a\u8a2d\u5b9a'; }, 900); }
    });
    editor.querySelectorAll('[data-save-content]').forEach((button)=>button.addEventListener('click',async()=>{button.disabled=true;try{await saveBlock(roleId,Number(button.dataset.saveContent));button.textContent='已儲存';}catch(err){alert(`儲存失敗：${err.message}`);}finally{setTimeout(()=>{button.disabled=false;button.textContent='儲存區塊';},800);}}));
    editor.querySelectorAll('[data-delete-content]').forEach((button)=>button.addEventListener('click',async()=>{if(!confirm('確定刪除此內容區塊？'))return;try{await request(`/api/admin/roles/${roleId}/content/${button.dataset.deleteContent}`,{method:'DELETE'});editor.dataset.iaV2Role='';window.RoleAdmin?.refresh?.();}catch(err){alert(`刪除失敗：${err.message}`);}}));
  };
  const runEnhance=async()=>{const editor=$('role-admin-editor');try{await enhance();}finally{editor?.classList.remove('ia-enhancing');}};
  const observer=new MutationObserver(()=>{const editor=$('role-admin-editor');if(editor?.querySelector('.role-editor-grid')&&!editor.querySelector('.ia-tabs'))editor.classList.add('ia-enhancing');clearTimeout(observer.timer);observer.timer=setTimeout(runEnhance,20);});
  const start=()=>{const editor=$('role-admin-editor');if(!editor)return setTimeout(start,200);observer.observe(editor,{childList:true,subtree:false});runEnhance();};
  start();
})();
