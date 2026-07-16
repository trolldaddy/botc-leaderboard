(() => {
  const STORAGE_KEY = 'botc_town_checkin_room';
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

  const showStatus = (message, isError = false) => {
    const el = $('town-status');
    if (el) {
      el.textContent = message;
      el.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
    }
    if (isError) alert(message);
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

      if (window.TownCheckin?.loadRoomFromInput) await window.TownCheckin.loadRoomFromInput();
      if (window.TownCheckinUI?.renderRoomSummary) window.TownCheckinUI.renderRoomSummary();
      if (window.TownCheckinRoomSync?.syncNow) setTimeout(() => window.TownCheckinRoomSync.syncNow(), 200);
    } catch (err) {
      showStatus(err?.message || `加入房間時發生錯誤：${err}`, true);
    }
  };

  const install = () => {
    if (!window.TownCheckin || window.TownCheckin.__joinStrictPatched) return false;
    window.TownCheckin.joinRoom = joinRoomStrict;
    window.TownCheckin.__joinStrictPatched = true;
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
