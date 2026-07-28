(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const apiBase = () => window.API_BASE || '';

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
    background:'背景故事', ability:'角色能力補充', rules_detail:'規則細節', rules:'規則說明',
    examples:'範例', common_mistakes:'常見誤解', strategy:'策略', storyteller_advice:'說書人建議',
    jinx:'相剋規則', interactions:'角色互動', player_summary:'玩家摘要', reminders:'提示標記說明',
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
    if (!editor || !roleId || editor.dataset.iaV2Role === String(roleId) || !editor.querySelector('.role-editor-grid')) return;
    editor.dataset.iaV2Role = String(roleId);

    let data;
    try { data = await request(`/api/admin/roles/${roleId}/content`); }
    catch (err) { data = { content_blocks:[], knowledge_links:[], error:err.message }; }

    const header = editor.querySelector('.role-editor-head');
    const grid = editor.querySelector('.role-editor-grid');
    const checks = editor.querySelector('.role-checkboxes');
    const reminder = editor.querySelector('.role-reminder-section');
    const aliasTitle = Array.from(editor.children).find((node) => node.tagName === 'H4' && node.textContent.includes('外部 ID'));
    const aliasList = editor.querySelector('.alias-list');
    const aliasAdd = editor.querySelector('.alias-add');
    const actions = Array.from(editor.querySelectorAll(':scope > .role-editor-actions')).pop();

    const core = document.createElement('section'); core.className='ia-pane active'; core.dataset.iaPane='core';
    if (grid) core.appendChild(grid); if (checks) core.appendChild(checks); if (aliasTitle) core.appendChild(aliasTitle); if (aliasList) core.appendChild(aliasList); if (aliasAdd) core.appendChild(aliasAdd); if (actions) core.appendChild(actions);

    const blocks = data.content_blocks || [];
    const shared = blocks.filter((b) => !['larplus','manual'].includes(String(b.source || '').toLowerCase()));
    const larplus = blocks.filter((b) => ['larplus','manual'].includes(String(b.source || '').toLowerCase()));

    const content = document.createElement('section'); content.className='ia-pane'; content.dataset.iaPane='content';
    content.innerHTML=`<div class="ia-pane-intro"><h4>角色內容</h4><p>百科、規則、範例與其他可分眾內容集中在這裡。資料內容與顯示對象分開管理。</p></div><div class="role-content-list">${shared.map(blockCard).join('') || '<div class="role-admin-empty">尚無通用角色內容。</div>'}</div>`;
    if (reminder) content.appendChild(reminder);

    const lap = document.createElement('section'); lap.className='ia-pane'; lap.dataset.iaPane='larplus';
    lap.innerHTML=`<div class="ia-pane-intro"><h4>拉普拉斯專屬內容</h4><p>店內裁定、主持提醒、教學話術與人工補充集中於此，不受百科同步覆蓋。</p></div><div class="role-content-list">${larplus.map(blockCard).join('') || '<div class="role-admin-empty">目前沒有拉普拉斯專屬 Block。</div>'}</div>`;

    const display = document.createElement('section'); display.className='ia-pane'; display.dataset.iaPane='display';
    display.innerHTML=`<div class="ia-pane-intro"><h4>顯示設定</h4><p>這裡只決定資料給誰看，不在此編輯正文。後台固定可見。</p><div class="ia-warning">目前資料庫仍是單一 audience 欄位。多選組合會先依相容規則折算儲存，這一版主要用來驗證操作邏輯。</div></div>
      <div class="ia-display-section"><h5>固定資料模組</h5>${['角色名稱','角色 icon','陣營','官方能力','首夜／其他夜順序','提示標記'].map((name,i)=>`<div class="ia-display-row static"><div><strong>${name}</strong><span>核心模組</span></div><label><input type="checkbox" ${i<4?'checked':''}> 玩家</label><label><input type="checkbox" ${i<4?'checked':''}> 百科</label><label><input type="checkbox" checked> 說書人</label><label class="ia-admin-lock"><input type="checkbox" checked disabled> 後台</label><span class="ia-static-note">預覽</span></div>`).join('')}</div>
      <div class="ia-display-section"><h5>內容 Blocks</h5>${blocks.map(displayRow).join('') || '<div class="role-admin-empty">尚無內容 Block。</div>'}</div>`;

    const tabs=document.createElement('nav'); tabs.className='ia-tabs'; tabs.innerHTML='<button class="active" data-ia-tab="core">核心資料</button><button data-ia-tab="content">角色內容</button><button data-ia-tab="larplus">拉普拉斯內容</button><button data-ia-tab="display">顯示設定</button>';
    header.insertAdjacentElement('afterend',tabs); tabs.insertAdjacentElement('afterend',core); core.insertAdjacentElement('afterend',content); content.insertAdjacentElement('afterend',lap); lap.insertAdjacentElement('afterend',display);

    tabs.querySelectorAll('[data-ia-tab]').forEach((button)=>button.addEventListener('click',()=>{
      tabs.querySelectorAll('button').forEach((item)=>item.classList.toggle('active',item===button));
      editor.querySelectorAll('.ia-pane').forEach((pane)=>pane.classList.toggle('active',pane.dataset.iaPane===button.dataset.iaTab));
    }));

    editor.querySelectorAll('[data-save-content]').forEach((button)=>button.addEventListener('click',async()=>{button.disabled=true;try{await saveBlock(roleId,Number(button.dataset.saveContent));button.textContent='已儲存';}catch(err){alert(`儲存失敗：${err.message}`);}finally{setTimeout(()=>{button.disabled=false;button.textContent='儲存區塊';},800);}}));
    editor.querySelectorAll('[data-delete-content]').forEach((button)=>button.addEventListener('click',async()=>{if(!confirm('確定刪除此內容區塊？'))return;try{await request(`/api/admin/roles/${roleId}/content/${button.dataset.deleteContent}`,{method:'DELETE'});editor.dataset.iaV2Role='';window.RoleAdmin?.refresh?.();}catch(err){alert(`刪除失敗：${err.message}`);}}));
    display.querySelectorAll('.ia-save-display').forEach((button)=>button.addEventListener('click',async()=>{const row=button.closest('[data-display-block]');const targets=Array.from(row.querySelectorAll('input:not(:disabled):checked')).map((input)=>input.value);if(!targets.length)return alert('至少選擇一個顯示情境。');button.disabled=true;try{await request(`/api/admin/roles/${roleId}/content/${row.dataset.displayBlock}`,{method:'PATCH',body:JSON.stringify({audience:audienceFromTargets(targets)})});button.textContent='已儲存';}catch(err){alert(`儲存失敗：${err.message}`);}finally{setTimeout(()=>{button.disabled=false;button.textContent='儲存';},800);}}));
  };

  const observer=new MutationObserver(()=>{clearTimeout(observer.timer);observer.timer=setTimeout(enhance,100);});
  const start=()=>{const editor=$('role-admin-editor');if(!editor)return setTimeout(start,200);observer.observe(editor,{childList:true,subtree:false});enhance();};
  start();
})();