(() => {
  const installRoleAdminWideLayout = () => {
    if (document.getElementById('role-admin-wide-layout-v2')) return;
    const style = document.createElement('style');
    style.id = 'role-admin-wide-layout-v2';
    style.textContent = `
      .role-admin-shell {
        max-width: 1760px !important;
        width: calc(100vw - 32px) !important;
      }
      .role-admin-layout {
        grid-template-columns: 270px minmax(760px, 1fr) !important;
        gap: 18px !important;
      }
      .role-admin-list {
        width: 270px !important;
      }
      .role-admin-editor {
        min-width: 0 !important;
        width: 100% !important;
        padding: 18px !important;
        contain: none !important;
      }
      .ia-tabs {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(150px, 1fr)) !important;
        gap: 8px !important;
        width: 100% !important;
      }
      .ia-tabs button {
        min-width: 150px !important;
        min-height: 48px !important;
        padding: 10px 12px !important;
        white-space: nowrap !important;
        overflow: visible !important;
        text-overflow: clip !important;
        font-size: 15px !important;
        font-weight: 800 !important;
      }
      @media (max-width: 1280px) {
        .role-admin-layout {
          grid-template-columns: 230px minmax(650px, 1fr) !important;
        }
        .role-admin-list { width: 230px !important; }
        .ia-tabs { grid-template-columns: repeat(2, minmax(180px, 1fr)) !important; }
      }
      @media (max-width: 980px) {
        .role-admin-shell { width: calc(100vw - 20px) !important; }
        .role-admin-layout { grid-template-columns: 1fr !important; }
        .role-admin-list { width: 100% !important; max-height: 34vh !important; }
        .ia-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .ia-tabs button { min-width: 0 !important; }
      }
    `;
    document.head.appendChild(style);
  };
  installRoleAdminWideLayout();

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
      id,
      name,
      team,
      firstNight: safeInt(item.firstNight),
      otherNight: safeInt(item.otherNight),
      firstNightReminder: item.firstNightReminder ? String(item.firstNightReminder) : '',
      otherNightReminder: item.otherNightReminder ? String(item.otherNightReminder) : '',
      ability: item.ability ? String(item.ability) : '',
      image: item.image ? String(item.image) : '',
    };
  };

  const setStatus = (message, error = false) => {
    const el = document.getElementById('role-admin-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = error ? 'var(--accent-red)' : 'var(--text-muted)';
  };

  const importMasterDbSafe = async () => {
    if (!Array.isArray(window.MASTER_ROLE_DB)) {
      setStatus('找不到 MASTER_ROLE_DB。', true);
      return;
    }

    const unique = new Map();
    let invalid = 0;
    let duplicates = 0;

    for (const raw of window.MASTER_ROLE_DB) {
      const role = normalizeRole(raw);
      if (!role) {
        invalid += 1;
        continue;
      }
      if (unique.has(role.id)) duplicates += 1;
      unique.set(role.id, role);
    }

    const roles = Array.from(unique.values());
    const note = [
      `準備匯入 ${roles.length} 個有效角色`,
      invalid ? `略過 ${invalid} 筆缺漏資料` : '',
      duplicates ? `合併 ${duplicates} 筆重複 ID` : '',
    ].filter(Boolean).join('；');

    if (!confirm(`${note}。繼續嗎？`)) return;
    setStatus(`正在匯入角色資料，共 ${roles.length} 筆...`);

    try {
      const response = await fetch(`${window.API_BASE || ''}/api/admin/roles/import`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles }),
      });

      let result = null;
      let rawText = '';
      try {
        rawText = await response.text();
        result = rawText ? JSON.parse(rawText) : null;
      } catch (error) {
        result = null;
      }

      if (!response.ok) {
        const detail = result?.detail || rawText || `HTTP ${response.status}`;
        throw new Error(detail);
      }

      setStatus(
        `匯入完成：新增 ${result.created || 0}、更新 ${result.updated || 0}、略過 ${(result.skipped || 0) + invalid}，目前共 ${result.total || 0} 個角色。`
      );
      if (window.RoleAdmin?.refresh) await window.RoleAdmin.refresh();
    } catch (error) {
      setStatus(`匯入失敗：${error.message}`, true);
      console.error('角色匯入失敗', error);
    }
  };

  const install = () => {
    if (!window.RoleAdmin) {
      window.setTimeout(install, 50);
      return;
    }
    window.RoleAdmin.importMasterDb = importMasterDbSafe;
  };

  install();
})();