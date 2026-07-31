(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const apiBase = () => window.API_BASE || '';
  const modal = $('role-display-settings-modal');
  const body = $('role-display-settings-body');
  const status = $('role-display-settings-status');
  let items = [];

  if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);

  const request = async (path, options = {}) => {
    const response = await fetch(`${apiBase()}${path}`, { credentials:'same-origin', headers:{'Content-Type':'application/json'}, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = Array.isArray(data.detail) ? data.detail.map((item) => item.msg || JSON.stringify(item)).join("；") : (typeof data.detail === "object" ? JSON.stringify(data.detail) : data.detail);
      throw new Error(detail || `HTTP ${response.status}`);
    }
    return data;
  };
  const targetCell = (item, view, label) => `<label class="rds-target"><span class="rds-target-label">${label}</span><input type="checkbox" data-rds-show="${view}" ${item[`show_${view}`] ? 'checked' : ''}>${item.item_type === 'block' ? `<input type="number" data-rds-sort="${view}" value="${Number(item[`sort_${view}`] || 0)}" title="${label}排序">` : `<input type="hidden" data-rds-sort="${view}" value="${Number(item[`sort_${view}`] || 0)}">`}</label>`;
  const renderSection = (title, rows) => `<section class="rds-section"><h4>${esc(title)}</h4><div class="rds-columns"><span>資料項目</span><span>玩家</span><span>百科</span><span>說書人</span></div>${rows.map((item) => `<div class="rds-row" data-rds-key="${esc(item.item_key)}"><strong>${esc(item.label)}</strong>${targetCell(item,'player','玩家')}${targetCell(item,'encyclopedia','百科')}${targetCell(item,'storyteller','說書人')}</div>`).join('')}</section>`;
  const render = () => {
    const modules = items.filter((item) => item.item_type === 'module');
    const blocks = items.filter((item) => item.item_type === 'block');
    body.innerHTML = renderSection('固定資料模組', modules) + renderSection('內容 Block 類型', blocks);
  };
  const open = async () => {
    modal.hidden = false; modal.scrollTop = 0; document.body.style.overflow = 'hidden'; status.textContent = '讀取中…';
    try { const data = await request('/api/admin/roles/display-settings'); items = data.items || []; render(); status.textContent = '套用至所有角色'; }
    catch (err) { body.innerHTML = `<div class="role-admin-empty">讀取失敗：${esc(err.message)}</div>`; status.textContent = ''; }
  };
  const close = () => { modal.hidden = true; document.body.style.overflow = ''; };
  const save = async () => {
    const button = $('role-display-settings-save'); button.disabled = true; status.textContent = '儲存中…';
    try {
      const payload = { items:Array.from(body.querySelectorAll('[data-rds-key]')).map((row) => {
        const item = { item_key:row.dataset.rdsKey };
        ['player','encyclopedia','storyteller'].forEach((view) => { item[`show_${view}`] = row.querySelector(`[data-rds-show="${view}"]`).checked; item[`sort_${view}`] = Number(row.querySelector(`[data-rds-sort="${view}"]`).value || 0); });
        return item;
      }) };
      const data = await request('/api/admin/roles/display-settings', { method:'PUT', body:JSON.stringify(payload) }); items = data.items || items; status.textContent = '已儲存，公開角色頁將立即套用'; setTimeout(close, 700);
    } catch (err) { status.textContent = `儲存失敗：${err.message}`; }
    finally { button.disabled = false; }
  };
  $('role-display-settings-open')?.addEventListener('click', open);
  $('role-display-settings-save')?.addEventListener('click', save);
  modal?.querySelectorAll('[data-rds-close]').forEach((node) => node.addEventListener('click', close));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal && !modal.hidden) close(); });
})();