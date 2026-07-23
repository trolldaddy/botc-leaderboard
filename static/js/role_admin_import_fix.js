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