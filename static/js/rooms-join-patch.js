(() => {
  const STORAGE_KEY = 'botc_town_checkin_room';
  const COMMUNITY_INVITE_URL = 'https://line.me/ti/g2/g2hnZGPTRX-R9yVux58sU6VFp8EybNJA_ej5xg?utm_source=invitation&utm_medium=link_copy&utm_campaign=default';
  const OFFICIAL_ACCOUNT_URL = 'https://line.me/R/ti/p/@210huawo';
  const apiBase = () => window.API_BASE || '';
  const $ = (id) => document.getElementById(id);

  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (err) { return null; }
  };

  const writeRoom = (room) => {
    if (room) localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
  };

  const getCode = () => {
    const params = new URLSearchParams(window.location.search);
    return String($('room-code-input')?.value || params.get('join') || readRoom()?.room_code || '').trim().toUpperCase();
  };

  const getDisplayName = () => String($('join-display-name')?.value || '').trim();

  const normalizeStatus = (value) => String(value || 'open').trim().toLowerCase();

  const buildJoinUrl = (code) => {
    const origin = window.location.origin;
    return `${origin}/?join=${encodeURIComponent(code)}#rooms`;
  };

  const showStatus = (message, isError = false) => {
    const el = $('town-status');
    if (el) {
      el.textContent = message;
      el.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
    }
    if (isError) alert(message);
  };

  const ensureInviteCard = (room) => {
    const summary = $('active-room-summary');
    if (!summary || !room?.room_code) return;

    let card = $('line-community-invite-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'line-community-invite-card';
      card.className = 'line-community-invite-card';
      summary.insertAdjacentElement('afterend', card);
    }

    const joinUrl = buildJoinUrl(room.room_code);
    card.innerHTML = `
      <div style="margin-top:1rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.045);border-radius:16px;padding:1rem;">
        <div style="display:flex;gap:.75rem;align-items:flex-start;flex-wrap:wrap;">
          <div style="width:42px;height:42px;border-radius:999px;background:rgba(0,185,0,.16);display:flex;align-items:center;justify-content:center;color:#7CFF8A;font-size:1.35rem;">
            <i class="fa-brands fa-line"></i>
          </div>
          <div style="flex:1;min-width:220px;">
            <div style="font-weight:900;color:#fff;margin-bottom:.25rem;">報到完成，加入拉普拉斯血染情報網</div>
            <div style="color:var(--text-muted);font-size:.9rem;line-height:1.55;">想收到開團通知、活動消息，或把這場房間分享給朋友，可以使用下面的按鈕。</div>
          </div>
        </div>
        <div class="town-actions compact-actions" style="margin-top:1rem;">
          <a class="btn btn-outline" href="${OFFICIAL_ACCOUNT_URL}" target="_blank" rel="noopener"><i class="fa-brands fa-line"></i> 加官方帳號</a>
          <a class="btn btn-purple" href="${COMMUNITY_INVITE_URL}" target="_blank" rel="noopener"><i class="fa-solid fa-comments"></i> 加血染社群</a>
          <button id="share-room-button" class="btn btn-outline" type="button"><i class="fa-solid fa-share-nodes"></i> 分享這場房間</button>
        </div>
      </div>
    `;

    const shareButton = $('share-room-button');
    if (shareButton && !shareButton.dataset.bound) {
      shareButton.dataset.bound = '1';
      shareButton.addEventListener('click', async () => {
        const text = `我正在拉普拉斯加入血染鐘樓房間 ${room.room_code}，一起報到吧：${joinUrl}`;
        try {
          if (navigator.share) {
            await navigator.share({ title: '拉普拉斯血染鐘樓小鎮報到', text, url: joinUrl });
          } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            alert('已複製房間邀請連結');
          } else {
            prompt('請複製房間邀請連結', text);
          }
        } catch (err) {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            alert('已複製房間邀請連結');
          }
        }
      });
    }
  };

  const normalizeRoom = (room) => ({
    id: room?.id || null,
    room_code: room?.room_code || room?.code || getCode(),
    title: room?.title || '小鎮報到',
    script: room?.script || '',
    date: room?.date || new Date().toISOString().split('T')[0],
    location: room?.location || '拉普拉斯',
    storyteller: room?.storyteller || '',
    status: room?.status || 'open',
    created_by_id: room?.created_by_id || null,
    created_by_line_user_id: room?.created_by_line_user_id || null,
    created_by_display_name: room?.created_by_display_name || null,
    players: Array.isArray(room?.players) ? room.players : []
  });

  const fetchRoomBeforeJoin = async (code) => {
    const resp = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}`, { credentials: 'same-origin' });
    let data = null;
    try { data = await resp.json(); } catch (err) {}
    if (!resp.ok) {
      throw new Error(data?.detail || `讀取房間失敗（HTTP ${resp.status}）`);
    }
    const room = normalizeRoom(data);
    writeRoom(room);
    if (normalizeStatus(room.status) !== 'open') {
      throw new Error('房間已鎖定，無法加入');
    }
    return room;
  };

  const joinRoomStrict = async () => {
    const code = getCode();
    const displayName = getDisplayName();
    if (!code) return showStatus('缺少房間代碼。', true);
    if (!displayName) return showStatus('請先輸入你的店內暱稱。', true);

    if ($('room-code-input')) $('room-code-input').value = code;

    try {
      await fetchRoomBeforeJoin(code);

      const resp = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName })
      });

      let data = null;
      try { data = await resp.json(); } catch (err) {}

      if (!resp.ok) {
        const detail = data?.detail || `加入房間失敗（HTTP ${resp.status}）`;
        showStatus(detail, true);
        return;
      }

      const room = normalizeRoom(data?.room);
      writeRoom(room);
      showStatus(`已加入房間 ${room.room_code}｜目前 ${room.players.length} 位玩家`);
      setTimeout(() => ensureInviteCard(room), 120);

      if (window.TownCheckin?.loadRoomFromInput) await window.TownCheckin.loadRoomFromInput();
      if (window.TownCheckinUI?.renderRoomSummary) window.TownCheckinUI.renderRoomSummary();
      setTimeout(() => ensureInviteCard(readRoom() || room), 250);
      if (window.TownCheckinRoomSync?.syncNow) setTimeout(() => window.TownCheckinRoomSync.syncNow(), 200);
    } catch (err) {
      showStatus(err?.message || `加入房間時發生錯誤：${err}`, true);
    }
  };

  const install = () => {
    if (!window.TownCheckin || window.TownCheckin.__joinStrictPatched) return false;
    window.TownCheckin.joinRoom = joinRoomStrict;
    window.TownCheckin.__joinStrictPatched = true;
    const room = readRoom();
    if (room?.room_code) setTimeout(() => ensureInviteCard(room), 300);
    return true;
  };

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (install() || tries > 30) clearInterval(timer);
    }, 100);
  }
})();