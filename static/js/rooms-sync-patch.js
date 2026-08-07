(() => {
  const STORAGE_KEY = 'botc_town_checkin_room';
  const ACTIVE_INTERVAL_MS = 1500;
  const HIDDEN_INTERVAL_MS = 12000;
  let timer = null;
  let syncing = false;
  let lastSignature = '';

  const $ = (id) => document.getElementById(id);

  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (err) { return null; }
  };

  const writeRoom = (room) => {
    if (room) localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
  };

  const apiBase = () => window.API_BASE || '';

  const roomSignature = (room) => JSON.stringify({
    code: room?.room_code || '',
    title: room?.title || '',
    script: room?.script || '',
    date: room?.date || '',
    location: room?.location || '',
    storyteller: room?.storyteller || '',
    status: room?.status || '',
    players: (room?.players || []).map((p) => ({
      id: p.id,
      seat_number: p.seat_number,
      display_name: p.display_name || p.name || '',
      line_user_id: p.line_user_id || '',
      is_temporary: !!p.is_temporary
    }))
  });

  const setStatus = (message, isError = false) => {
    const el = $('town-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
  };

  const getActiveCode = () => {
    const room = readRoom();
    const inputCode = $('room-code-input')?.value;
    const urlCode = new URLSearchParams(window.location.search).get('join');
    return String(room?.room_code || inputCode || urlCode || '').trim().toUpperCase();
  };

  const hydrateTownCheckinFromServer = async (freshRoom) => {
    writeRoom(freshRoom);
    if ($('room-code-input')) $('room-code-input').value = freshRoom.room_code || '';

    // 重要：rooms.js 的 currentRoom 是閉包狀態，只改 localStorage 不會讓畫面重畫。
    // 透過公開的 loadRoomFromInput 讓主程式自己走一次後端載入與 render。
    if (window.TownCheckin?.loadRoomFromInput && !window.TownCheckin.__syncLoadingRoom) {
      window.TownCheckin.__syncLoadingRoom = true;
      try {
        await window.TownCheckin.loadRoomFromInput();
      } finally {
        window.TownCheckin.__syncLoadingRoom = false;
      }
    }

    if (window.TownCheckinUI?.renderRoomSummary) {
      window.TownCheckinUI.renderRoomSummary();
    }
    if (window.TownCheckinSeatPatch?.refresh) {
      window.TownCheckinSeatPatch.refresh();
    }
  };

  const syncOnce = async () => {
    const code = getActiveCode();
    if (!code || syncing) return;
    syncing = true;
    try {
      const resp = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}`, { credentials: 'same-origin' });
      if (!resp.ok) {
        if (resp.status !== 404) setStatus(`房間同步失敗：HTTP ${resp.status}`, true);
        return;
      }
      const freshRoom = await resp.json();
      const signature = roomSignature(freshRoom);
      if (signature === lastSignature) return;
      lastSignature = signature;
      await hydrateTownCheckinFromServer(freshRoom);
      setStatus(`房間 ${freshRoom.room_code}｜${freshRoom.status === 'open' ? '開放報到' : '已鎖定'}｜${(freshRoom.players || []).length} 位玩家`);
    } catch (err) {
      setStatus('房間同步失敗，稍後會再試。', true);
      console.warn('[TownCheckin sync] failed', err);
    } finally {
      syncing = false;
    }
  };

  const schedule = () => {
    if (timer) clearInterval(timer);
    const interval = document.hidden ? HIDDEN_INTERVAL_MS : ACTIVE_INTERVAL_MS;
    timer = setInterval(syncOnce, interval);
  };

  const install = () => {
    if (window.TownCheckinRoomSync?.installed) return;
    window.TownCheckinRoomSync = {
      installed: true,
      syncNow: syncOnce,
      restart: () => {
        syncOnce();
        schedule();
      }
    };

    document.addEventListener('visibilitychange', () => {
      syncOnce();
      schedule();
    });

    ['createRoom', 'joinRoom', 'updateSeat', 'updateName', 'removePlayer', 'lockRoom', 'openRoom'].forEach((key) => {
      const api = window.TownCheckin;
      if (!api || typeof api[key] !== 'function' || api[key].__roomSyncWrapped) return;
      const original = api[key];
      api[key] = async (...args) => {
        const result = await original(...args);
        setTimeout(syncOnce, 350);
        return result;
      };
      api[key].__roomSyncWrapped = true;
    });

    syncOnce();
    schedule();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
