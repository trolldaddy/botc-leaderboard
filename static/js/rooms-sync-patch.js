(() => {
  const STORAGE_KEY = 'botc_town_checkin_room';
  const ACTIVE_INTERVAL_MS = 3000;
  const HIDDEN_INTERVAL_MS = 12000;
  let timer = null;
  let syncing = false;
  let lastSignature = '';

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

  const syncOnce = async () => {
    const room = readRoom();
    const code = room?.room_code || new URLSearchParams(window.location.search).get('join');
    if (!code || syncing) return;
    syncing = true;
    try {
      const resp = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(String(code).toUpperCase())}`, { credentials: 'same-origin' });
      if (!resp.ok) return;
      const freshRoom = await resp.json();
      const signature = roomSignature(freshRoom);
      if (signature === lastSignature) return;
      lastSignature = signature;
      writeRoom(freshRoom);

      if (window.TownCheckin?.refreshRoom && !window.TownCheckin.__syncRefreshing) {
        window.TownCheckin.__syncRefreshing = true;
        try {
          await window.TownCheckin.refreshRoom();
        } finally {
          window.TownCheckin.__syncRefreshing = false;
        }
      }

      if (window.TownCheckinUI?.renderRoomSummary) {
        window.TownCheckinUI.renderRoomSummary();
      }
      if (window.TownCheckinSeatPatch?.refresh) {
        window.TownCheckinSeatPatch.refresh();
      }
    } catch (err) {
      // 靜默失敗，下一輪再試。
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

    ['createRoom', 'loadRoomFromInput', 'joinRoom', 'refreshRoom', 'updateSeat', 'updateName', 'removePlayer', 'lockRoom', 'openRoom'].forEach((key) => {
      const api = window.TownCheckin;
      if (!api || typeof api[key] !== 'function' || api[key].__roomSyncWrapped) return;
      const original = api[key];
      api[key] = async (...args) => {
        const result = await original(...args);
        setTimeout(syncOnce, 250);
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
