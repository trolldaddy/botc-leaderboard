(() => {
  const ROOM_KEY = 'botc_town_checkin_room';
  const DEVICE_TOKEN_KEY = 'botc_town_checkin_device_token';
  let installed = false;
  let observer = null;
  let scheduled = false;
  let context = null;

  const apiBase = () => window.API_BASE || '';
  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(ROOM_KEY) || 'null'); }
    catch (err) { return null; }
  };
  const writeRoom = (room) => {
    if (room) localStorage.setItem(ROOM_KEY, JSON.stringify(room));
  };
  const getDeviceToken = () => localStorage.getItem(DEVICE_TOKEN_KEY) || '';
  const getRoomCode = () => {
    const params = new URLSearchParams(window.location.search);
    return String(document.getElementById('room-code-input')?.value || params.get('join') || readRoom()?.room_code || '').trim().toUpperCase();
  };

  const fetchContext = async () => {
    const code = getRoomCode();
    if (!code) return null;
    const [roomResp, permissionResp, meResp] = await Promise.all([
      fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}`, { credentials: 'same-origin', cache: 'no-store' }),
      fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}/permissions`, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null),
      fetch(`${apiBase()}/api/me`, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null),
    ]);
    if (!roomResp.ok) return null;
    const room = await roomResp.json();
    let permissions = { is_owner: false, can_manage_players: false, can_manage_room: false };
    try { if (permissionResp?.ok) permissions = await permissionResp.json(); } catch (err) {}
    let me = null;
    try { if (meResp?.ok) me = await meResp.json(); } catch (err) {}
    context = { room, permissions, account: me?.user || null, deviceToken: getDeviceToken() };
    writeRoom(room);
    return context;
  };

  const isRoomOwner = (ctx) => Boolean(ctx?.permissions?.is_owner || ctx?.permissions?.can_manage_players);

  const isOwnPlayer = (player, ctx) => {
    if (!player || !ctx) return false;
    if (ctx.account?.id && Number(player.account_id) === Number(ctx.account.id)) return true;
    return Boolean(ctx.deviceToken && player.device_token && player.device_token === ctx.deviceToken);
  };

  const findPlayer = (id, ctx) => (ctx?.room?.players || []).find((player) => String(player.id) === String(id));

  const decorateSeatSelectors = async () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody) return;
    const ctx = await fetchContext();
    if (!ctx) return;
    const owner = isRoomOwner(ctx);
    tbody.querySelectorAll('select[data-seat-selector="true"]').forEach((select) => {
      const player = findPlayer(select.dataset.playerId, ctx);
      const own = isOwnPlayer(player, ctx);
      select.disabled = !(owner || own);
      select.title = owner ? '房主可調整所有玩家座號' : own ? '選擇你目前坐的位置' : '你只能修改自己的座號';
      select.closest('td')?.classList.toggle('own-seat-cell', own);
    });
  };

  const scheduleDecorate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorateSeatSelectors().catch((err) => console.warn('座號權限更新失敗', err));
    });
  };

  const updateSeatDirect = async (id, value) => {
    const ctx = await fetchContext();
    const player = findPlayer(id, ctx);
    if (!ctx || !player) return alert('找不到房間玩家資料，請重新整理後再試。');
    if (!isRoomOwner(ctx) && !isOwnPlayer(player, ctx)) {
      alert('你只能修改自己的座號。');
      scheduleDecorate();
      return;
    }

    const seat = value ? Number.parseInt(value, 10) : null;
    const response = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(ctx.room.room_code)}/players/${encodeURIComponent(id)}/seat`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seat_number: seat, device_token: ctx.deviceToken }),
    });

    let data = null;
    try { data = await response.json(); } catch (err) {}
    if (!response.ok) {
      alert(data?.detail || '座號更新失敗');
      if (window.TownCheckin?.loadRoomFromInput) await window.TownCheckin.loadRoomFromInput();
      scheduleDecorate();
      return;
    }

    writeRoom(data.room);
    context = { ...ctx, room: data.room };
    if (window.TownCheckin?.loadRoomFromInput) await window.TownCheckin.loadRoomFromInput();
    if (window.TownCheckinSeatPatch?.refresh) window.TownCheckinSeatPatch.refresh();
    if (window.TownCheckinPermissions?.refresh) window.TownCheckinPermissions.refresh();
    scheduleDecorate();
  };

  const install = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody || !window.TownCheckin) return false;
    if (installed) return true;
    installed = true;
    window.TownCheckin.updateSeat = (id, value) => {
      return updateSeatDirect(id, value).catch((err) => {
        console.error(err);
        alert('座號更新時發生錯誤，請重新整理後再試。');
        throw err;
      });
    };
    observer = new MutationObserver(scheduleDecorate);
    observer.observe(tbody, { childList: true });
    window.addEventListener('focus', scheduleDecorate);
    window.TownCheckinSelfSeat = { refresh: scheduleDecorate };
    scheduleDecorate();
    return true;
  };

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (install() || tries > 40) clearInterval(timer);
    }, 100);
  }
})();
