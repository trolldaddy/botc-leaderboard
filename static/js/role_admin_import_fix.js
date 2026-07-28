(() => {
  const installRoleAdminVisuals = () => {
    const old = document.getElementById('role-admin-wide-layout-v2');
    if (old) old.remove();
    if (document.getElementById('role-admin-visual-v3')) return;

    const style = document.createElement('style');
    style.id = 'role-admin-visual-v3';
    style.textContent = `
      .role-admin-shell {
        width: min(100%, 1500px) !important;
        max-width: calc(100vw - 2rem) !important;
        margin-inline: auto !important;
      }

      .role-admin-layout {
        grid-template-columns: clamp(220px, 20vw, 290px) minmax(0, 1fr) !important;
        gap: 1rem !important;
        width: 100% !important;
      }

      .role-admin-list,
      .role-admin-editor,
      .role-admin-editor > *,
      .ia-pane,
      .role-content-list,
      .role-content-card,
      .role-content-grid,
      .ia-display-section,
      .ia-display-row {
        min-width: 0 !important;
        max-width: 100% !important;
      }

      .role-admin-editor {
        width: 100% !important;
        overflow-x: hidden !important;
        padding: 1.25rem !important;
      }

      .ia-tabs {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        gap: .55rem !important;
        width: 100% !important;
        margin: 0 0 1.15rem !important;
        padding: .38rem !important;
        border: 1px solid #30364a !important;
        border-radius: 14px !important;
        background: #151924 !important;
      }

      .ia-tabs button {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 46px !important;
        padding: .75rem .8rem !important;
        border: 1px solid transparent !important;
        border-radius: 10px !important;
        background: transparent !important;
        color: #c3cad9 !important;
        font-size: .96rem !important;
        font-weight: 800 !important;
        line-height: 1.2 !important;
        white-space: normal !important;
        cursor: pointer !important;
      }

      .ia-tabs button:hover {
        color: #fff !important;
        background: #202638 !important;
      }

      .ia-tabs button.active {
        color: #fff !important;
        border-color: #7d67d8 !important;
        background: linear-gradient(180deg, #372b59, #2a2143) !important;
        box-shadow: 0 0 0 1px rgba(139,124,246,.2) inset !important;
      }

      .ia-pane {
        display: none !important;
        width: 100% !important;
      }

      .ia-pane.active {
        display: block !important;
      }

      .ia-pane-intro,
      .ia-display-section,
      .role-reminder-section {
        margin-bottom: 1rem !important;
        padding: 1rem 1.05rem !important;
        border: 1px solid #30364a !important;
        border-radius: 14px !important;
        background: #151924 !important;
      }

      .ia-pane-intro h4,
      .ia-display-section h5,
      .role-reminder-title h4 {
        margin: 0 0 .35rem !important;
        color: #fff !important;
        font-size: 1rem !important;
      }

      .ia-pane-intro p,
      .role-reminder-title p {
        margin: 0 !important;
        color: #aeb6c9 !important;
        line-height: 1.6 !important;
      }

      .role-content-list {
        display: grid !important;
        gap: 1rem !important;
      }

      .role-content-card {
        padding: 1rem !important;
        border: 1px solid #39415a !important;
        border-radius: 14px !important;
        background: #11151f !important;
        box-shadow: 0 10px 24px rgba(0,0,0,.12) !important;
      }

      .role-content-head {
        display: flex !important;
        justify-content: space-between !important;
        align-items: flex-start !important;
        gap: 1rem !important;
        margin-bottom: .95rem !important;
        padding-bottom: .8rem !important;
        border-bottom: 1px solid #2f3548 !important;
      }

      .role-content-head strong {
        display: block !important;
        color: #fff !important;
        font-size: 1rem !important;
      }

      .role-content-head span {
        display: block !important;
        margin-top: .25rem !important;
        color: #aeb6c9 !important;
        font-size: .78rem !important;
      }

      .role-content-active,
      .ia-display-row label {
        display: inline-flex !important;
        align-items: center !important;
        gap: .4rem !important;
        color: #d9deea !important;
      }

      .role-content-grid {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: .9rem !important;
      }

      .role-content-grid .wide {
        grid-column: 1 / -1 !important;
      }

      .role-content-grid label {
        display: block !important;
        margin-bottom: .38rem !important;
        color: #ffd166 !important;
        font-size: .78rem !important;
        font-weight: 800 !important;
      }

      .role-content-grid textarea {
        min-height: 150px !important;
        resize: vertical !important;
      }

      .role-content-actions {
        display: flex !important;
        justify-content: flex-end !important;
        gap: .6rem !important;
        margin-top: 1rem !important;
        padding-top: 1rem !important;
        border-top: 1px solid #2f3548 !important;
      }

      .ia-warning {
        margin-top: .85rem !important;
        padding: .75rem .85rem !important;
        border: 1px solid rgba(255,209,102,.3) !important;
        border-radius: 10px !important;
        background: rgba(255,209,102,.07) !important;
        color: #e8d9a6 !important;
        line-height: 1.55 !important;
      }

      .ia-display-section {
        display: grid !important;
        gap: .7rem !important;
      }

      .ia-display-row {
        display: grid !important;
        grid-template-columns: minmax(180px, 1fr) repeat(4, auto) auto !important;
        gap: .7rem !important;
        align-items: center !important;
        padding: .8rem !important;
        border: 1px solid #30364a !important;
        border-radius: 11px !important;
        background: #11151f !important;
      }

      .ia-display-row > div strong {
        display: block !important;
        color: #fff !important;
      }

      .ia-display-row > div span {
        display: block !important;
        margin-top: .2rem !important;
        color: #9da7bc !important;
        font-size: .76rem !important;
      }

      .ia-admin-lock {
        opacity: .72 !important;
      }

      @media (max-width: 1180px) {
        .ia-tabs {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .ia-display-row {
          grid-template-columns: minmax(160px, 1fr) repeat(3, auto) !important;
        }
        .ia-display-row .ia-admin-lock,
        .ia-display-row .ia-static-note,
        .ia-display-row .ia-save-display {
          grid-column: auto !important;
        }
      }

      @media (max-width: 900px) {
        .role-admin-layout {
          grid-template-columns: 1fr !important;
        }
        .role-admin-list {
          max-height: 34vh !important;
        }
      }

      @media (max-width: 680px) {
        .role-content-grid {
          grid-template-columns: 1fr !important;
        }
        .role-content-grid .wide {
          grid-column: auto !important;
        }
        .ia-display-row {
          grid-template-columns: 1fr 1fr !important;
        }
        .ia-display-row > div {
          grid-column: 1 / -1 !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  installRoleAdminVisuals();

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