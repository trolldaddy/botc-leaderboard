(() => {
  const apiBase = () => window.API_BASE || '';
  const $ = (id) => document.getElementById(id);

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const setStatus = (message, isError = false) => {
    const el = $('binding-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
  };

  const shortUid = (uid) => {
    const text = String(uid || '');
    if (text.length <= 12) return text;
    return `${text.slice(0, 6)}...${text.slice(-5)}`;
  };

  const formatDate = (value) => {
    if (!value) return '—';
    return String(value).slice(0, 10);
  };

  const getFilters = () => ({
    q: ($('binding-search')?.value || '').trim(),
    unboundOnly: !!$('binding-unbound-only')?.checked
  });

  const render = (accounts) => {
    const list = $('binding-list');
    if (!list) return;
    if (!accounts.length) {
      list.innerHTML = '<div class="empty-binding">沒有符合條件的 LINE 帳號。</div>';
      return;
    }

    list.innerHTML = accounts.map((account) => {
      const bound = !!account.player_id;
      const avatar = account.picture_url
        ? `<img src="${escapeHtml(account.picture_url)}" alt="avatar">`
        : '<i class="fa-brands fa-line"></i>';
      const aliases = (account.aliases || []).map((name) => `<span class="binding-pill">${escapeHtml(name)}</span>`).join('') || '<span class="hint-text">尚無小鎮暱稱紀錄</span>';
      const rooms = (account.latest_rooms || []).slice(0, 4).map((room) => `
        <span class="room-chip">${escapeHtml(room.room_code || '')}｜${escapeHtml(room.script || room.title || '未命名')}｜${escapeHtml(room.display_name || '')}</span>
      `).join('') || '<span class="hint-text">尚無房間紀錄</span>';
      return `
        <article class="binding-row" data-account-id="${account.id}">
          <div class="binding-avatar">${avatar}</div>
          <div>
            <div class="binding-name">${escapeHtml(account.display_name || 'LINE 使用者')}</div>
            <div class="binding-meta">UID：<span title="${escapeHtml(account.line_user_id)}">${escapeHtml(shortUid(account.line_user_id))}</span></div>
            <div class="binding-meta">最後登入：${escapeHtml(formatDate(account.last_login_at))}｜建立：${escapeHtml(formatDate(account.created_at))}</div>
            <div style="margin-top:.5rem;">
              ${bound ? `<span class="binding-pill bound-pill">已綁定：#${account.player_id} ${escapeHtml(account.player?.name || '')}</span>` : '<span class="binding-pill unbound-pill">尚未綁定 Player</span>'}
              <span class="binding-pill">${account.can_host ? '可開房' : '不可開房'}</span>
              ${account.is_banned ? '<span class="binding-pill unbound-pill">已停權</span>' : ''}
            </div>
            <div style="margin-top:.65rem;">
              <div class="hint-text">店內暱稱紀錄</div>
              ${aliases}
            </div>
            <div style="margin-top:.65rem;">
              <div class="hint-text">近期房間紀錄</div>
              ${rooms}
            </div>
          </div>
          <div class="binding-actions">
            <div class="hint-text">搜尋既有 Player 並綁定</div>
            <input class="form-control dark-input player-search" placeholder="輸入玩家名稱，例如：廚爹" value="${escapeHtml(account.player?.name || account.display_name || '')}">
            <div class="binding-action-row">
              <button class="btn btn-purple" onclick="AccountBindings.searchPlayers(${account.id})"><i class="fa-solid fa-magnifying-glass"></i> 搜尋</button>
              <button class="btn btn-outline" onclick="AccountBindings.createAndBind(${account.id})"><i class="fa-solid fa-user-plus"></i> 建立並綁定</button>
              ${bound ? `<button class="btn btn-outline" onclick="AccountBindings.unbind(${account.id})"><i class="fa-solid fa-link-slash"></i> 解除</button>` : ''}
            </div>
            <div class="player-results" id="player-results-${account.id}"></div>
            <label class="checkline" style="margin-top:.65rem;"><input type="checkbox" class="can-host-toggle" ${account.can_host ? 'checked' : ''} onchange="AccountBindings.toggleHost(${account.id}, this.checked)"> 可開房 / 主持</label>
            <input class="form-control dark-input host-note" placeholder="主持備註，例如：店員、熟客主持" value="${escapeHtml(account.host_note || '')}" onblur="AccountBindings.saveHostNote(${account.id}, this.value)">
          </div>
        </article>
      `;
    }).join('');
  };

  const refresh = async () => {
    const { q, unboundOnly } = getFilters();
    setStatus('正在讀取 LINE 帳號資料...');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (unboundOnly) params.set('unbound_only', 'true');
      const resp = await fetch(`${apiBase()}/api/admin/account-bindings?${params.toString()}`, { credentials: 'same-origin' });
      if (!resp.ok) {
        let message = `讀取失敗（HTTP ${resp.status}）`;
        try { message = (await resp.json()).detail || message; } catch (err) {}
        throw new Error(message);
      }
      const accounts = await resp.json();
      render(accounts);
      setStatus(`已載入 ${accounts.length} 個 LINE 帳號。`);
    } catch (err) {
      setStatus(err.message || '讀取帳號資料失敗。', true);
    }
  };

  const getRow = (accountId) => document.querySelector(`.binding-row[data-account-id="${accountId}"]`);
  const getSearchValue = (accountId) => (getRow(accountId)?.querySelector('.player-search')?.value || '').trim();

  const searchPlayers = async (accountId) => {
    const q = getSearchValue(accountId);
    const box = $(`player-results-${accountId}`);
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = '<div class="player-result">搜尋中...</div>';
    try {
      const resp = await fetch(`${apiBase()}/api/admin/account-bindings/players?q=${encodeURIComponent(q)}`, { credentials: 'same-origin' });
      if (!resp.ok) throw new Error('搜尋 Player 失敗');
      const players = await resp.json();
      if (!players.length) {
        box.innerHTML = '<div class="player-result">沒有找到玩家，可使用「建立並綁定」。</div>';
        return;
      }
      box.innerHTML = players.map((player) => `
        <div class="player-result" onclick="AccountBindings.bind(${accountId}, ${player.id})">
          <span>#${player.id} ${escapeHtml(player.name)}</span>
          <span>綁定</span>
        </div>
      `).join('');
    } catch (err) {
      box.innerHTML = `<div class="player-result">${escapeHtml(err.message || '搜尋失敗')}</div>`;
    }
  };

  const bind = async (accountId, playerId) => {
    await updateAccount(accountId, { player_id: playerId }, '已綁定玩家資料。');
  };

  const unbind = async (accountId) => {
    if (!confirm('確定解除這個 LINE 帳號的 Player 綁定？')) return;
    await updateAccount(accountId, { player_id: null }, '已解除綁定。');
  };

  const createAndBind = async (accountId) => {
    const name = getSearchValue(accountId);
    if (!name) return alert('請先輸入要建立的玩家名稱。');
    if (!confirm(`建立或使用 Player「${name}」並綁定這個 LINE 帳號？`)) return;
    setStatus('正在建立並綁定 Player...');
    try {
      const resp = await fetch(`${apiBase()}/api/admin/account-bindings/${accountId}/create-player`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!resp.ok) {
        let message = '建立並綁定失敗';
        try { message = (await resp.json()).detail || message; } catch (err) {}
        throw new Error(message);
      }
      setStatus('已建立並綁定 Player。');
      await refresh();
    } catch (err) {
      setStatus(err.message || '建立並綁定失敗。', true);
    }
  };

  const toggleHost = async (accountId, canHost) => {
    await updateAccount(accountId, { can_host: canHost }, canHost ? '已標記為可開房。' : '已取消開房權限。', false);
  };

  const saveHostNote = async (accountId, note) => {
    await updateAccount(accountId, { host_note: note }, '主持備註已儲存。', false);
  };

  const updateAccount = async (accountId, payload, successMessage, rerender = true) => {
    setStatus('正在更新帳號綁定...');
    try {
      const resp = await fetch(`${apiBase()}/api/admin/account-bindings/${accountId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        let message = `更新失敗（HTTP ${resp.status}）`;
        try { message = (await resp.json()).detail || message; } catch (err) {}
        throw new Error(message);
      }
      setStatus(successMessage || '已更新帳號。');
      if (rerender) await refresh();
    } catch (err) {
      setStatus(err.message || '更新帳號失敗。', true);
      if (rerender) await refresh();
    }
  };

  const init = () => {
    $('binding-search')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') refresh();
    });
    $('binding-unbound-only')?.addEventListener('change', refresh);
    refresh();
  };

  window.AccountBindings = { refresh, searchPlayers, bind, unbind, createAndBind, toggleHost, saveHostNote };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
