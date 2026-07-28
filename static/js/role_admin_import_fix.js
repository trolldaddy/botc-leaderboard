(() => {
  const safeInt = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number.parseInt(String(value).replace(/[^0-9-]/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeRole = (item) => {
    if (!item || typeof item !== 'object') return null;
    const id = String(item.id || '').trim();
    const name = String(item.name || '').trim();
    const team = String(item.team || '').trim().toLowerCase();
    if (!id || !name || !team) return null;
    return {
      id, name, team,
      firstNight: safeInt(item.firstNight), otherNight: safeInt(item.otherNight),
      firstNightReminder: item.firstNightReminder ? String(item.firstNightReminder) : '',
      otherNightReminder: item.otherNightReminder ? String(item.otherNightReminder) : '',
      ability: item.ability ? String(item.ability) : '', image: item.image ? String(item.image) : '',
    };
  };

  const setStatus = (message, error = false) => {
    const el = document.getElementById('role-admin-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = error ? 'var(--accent-red)' : 'var(--text-muted)';
  };

  const importMasterDbSafe = async () => {
    if (!Array.isArray(window.MASTER_ROLE_DB)) return setStatus('找不到 MASTER_ROLE_DB。', true);
    const unique = new Map(); let invalid = 0; let duplicates = 0;
    for (const raw of window.MASTER_ROLE_DB) {
      const role = normalizeRole(raw);
      if (!role) { invalid += 1; continue; }
      if (unique.has(role.id)) duplicates += 1;
      unique.set(role.id, role);
    }
    const roles = Array.from(unique.values());
    const note = [`準備匯入 ${roles.length} 個有效角色`, invalid ? `略過 ${invalid} 筆缺漏資料` : '', duplicates ? `合併 ${duplicates} 筆重複 ID` : ''].filter(Boolean).join('；');
    if (!confirm(`${note}。繼續嗎？`)) return;
    setStatus(`正在匯入角色資料，共 ${roles.length} 筆...`);
    try {
      const response = await fetch(`${window.API_BASE || ''}/api/admin/roles/import`, { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({roles}) });
      let result = null; let rawText = '';
      try { rawText = await response.text(); result = rawText ? JSON.parse(rawText) : null; } catch (_) { result = null; }
      if (!response.ok) throw new Error(result?.detail || rawText || `HTTP ${response.status}`);
      setStatus(`匯入完成：新增 ${result.created || 0}、更新 ${result.updated || 0}、略過 ${(result.skipped || 0) + invalid}，目前共 ${result.total || 0} 個角色。`);
      if (window.RoleAdmin?.refresh) await window.RoleAdmin.refresh();
    } catch (error) { setStatus(`匯入失敗：${error.message}`, true); console.error('角色匯入失敗', error); }
  };

  const installStyles = () => {
    if (document.getElementById('role-admin-ia-v2-styles')) return;
    const style = document.createElement('style');
    style.id = 'role-admin-ia-v2-styles';
    style.textContent = `
      .ia-tabs{display:flex;gap:.5rem;flex-wrap:wrap;margin:0 0 1rem;padding:.45rem;background:#151924;border:1px solid #39415a;border-radius:14px}
      .ia-tabs button{border:0;background:transparent;color:#aeb6c9;padding:.72rem 1rem;border-radius:10px;font-weight:800;cursor:pointer}
      .ia-tabs button.active{background:#332651;color:#fff;box-shadow:0 0 0 1px #8b7cf6 inset}
      .ia-pane{display:none}.ia-pane.active{display:block}
      .ia-pane-intro{padding:1rem;margin-bottom:1rem;border:1px solid #39415a;border-radius:14px;background:#151924}
      .ia-pane-intro h4{margin:0 0 .35rem;color:#fff}.ia-pane-intro p{margin:0;color:#aeb6c9;line-height:1.65}
      .ia-warning{margin-top:.75rem;padding:.7rem .8rem;border:1px solid #7a6330;border-radius:10px;background:rgba(255,193,7,.08);color:#f4d98b}
      .ia-display-section{margin-top:1rem}.ia-display-section h5{color:#ffd166;margin:.5rem 0}
      .ia-display-row{display:grid;grid-template-columns:minmax(220px,1.5fr) repeat(4,minmax(90px,.45fr)) auto;gap:.65rem;align-items:center;padding:.75rem;border:1px solid #30364a;border-radius:12px;background:#131722;margin-bottom:.55rem}
      .ia-display-row>div strong{display:block;color:#fff}.ia-display-row>div span{display:block;color:#8f99af;font-size:.76rem;margin-top:.15rem}
      .ia-display-row label{display:flex;gap:.35rem;align-items:center;color:#d9deea;font-size:.82rem}.ia-display-row input{accent-color:#8b7cf6}
      .ia-admin-lock{opacity:.7}.ia-static-note{color:#8993aa;font-size:.75rem}
      .ia-card{margin-bottom:.8rem}.role-content-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.role-content-grid .wide{grid-column:1/-1}
      .role-content-head{display:flex;justify-content:space-between;gap:1rem;align-items:center}.role-content-head strong{display:block;color:#fff}.role-content-head span{display:block;color:#9ca6ba;font-size:.76rem;margin-top:.2rem}
      .role-content-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.75rem}
      @media(max-width:900px){.ia-display-row{grid-template-columns:1fr 1fr 1fr}.ia-display-row>div{grid-column:1/-1}.role-content-grid{grid-template-columns:1fr}.role-content-grid .wide{grid-column:auto}}
    `;
    document.head.appendChild(style);
  };

  const install = () => {
    installStyles();
    if (!window.RoleAdmin) return window.setTimeout(install, 50);
    window.RoleAdmin.importMasterDb = importMasterDbSafe;
  };
  install();
})();