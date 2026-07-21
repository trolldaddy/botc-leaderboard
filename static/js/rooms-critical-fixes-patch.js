(() => {
  const ROOM_KEY = 'botc_town_checkin_room';
  const DEVICE_TOKEN_KEY = 'botc_town_checkin_device_token';
  let installed = false;
  let joinBusy = false;

  const apiBase = () => window.API_BASE || '';
  const $ = (id) => document.getElementById(id);
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
    return String($('room-code-input')?.value || params.get('join') || readRoom()?.room_code || '').trim().toUpperCase();
  };
  const getDisplayName = () => String($('join-display-name')?.value || '').trim();

  const showStatus = (message, isError = false) => {
    const el = $('town-status');
    if (el) {
      el.textContent = message;
      el.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
    }
    if (isError) alert(message);
  };

  const refreshRoom = async (code) => {
    if ($('room-code-input')) $('room-code-input').value = code;
    if (window.TownCheckin?.loadRoomFromInput) await window.TownCheckin.loadRoomFromInput();
    if (window.TownCheckinPermissions?.refresh) await window.TownCheckinPermissions.refresh();
    if (window.TownCheckinSelfSeat?.refresh) window.TownCheckinSelfSeat.refresh();
    if (window.TownCheckinMobilePlayerList?.refresh) window.TownCheckinMobilePlayerList.refresh();
  };

  const joinOrUpgradeIdentity = async () => {
    if (joinBusy) return showStatus('正在更新報到資料，請稍候。');
    const code = getRoomCode();
    const displayName = getDisplayName();
    if (!code) return showStatus('缺少房間代碼。', true);
    if (!displayName) return showStatus('請先輸入你的店內暱稱。', true);

    joinBusy = true;
    try {
      // 不再用「同名已存在」阻擋。後端會依 LINE account 或 device_token
      // 更新既有 RoomPlayer，讓臨時玩家原地升級為 LINE 玩家。
      const resp = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          device_token: getDeviceToken(),
        }),
      });
      let data = null;
      try { data = await resp.json(); } catch (err) {}
      if (!resp.ok) return showStatus(data?.detail || `報到更新失敗（HTTP ${resp.status}）`, true);

      writeRoom(data.room);
      const upgraded = Boolean(data.updated_existing && data.player && !data.player.is_temporary);
      showStatus(upgraded
        ? `已將「${data.player.display_name}」升級為 LINE 玩家`
        : `已加入房間 ${data.room.room_code}｜目前 ${data.room.players.length} 位玩家`);
      await refreshRoom(code);
    } catch (err) {
      showStatus(err?.message || '報到更新時發生錯誤', true);
    } finally {
      joinBusy = false;
    }
  };

  const removePlayerReliable = async (id) => {
    const room = readRoom();
    if (!room?.room_code) return showStatus('尚未載入房間。', true);
    if (!confirm('確定要將此玩家移出房間？')) return;

    if (String(id).startsWith('local-')) {
      room.players = (room.players || []).filter((player) => String(player.id) !== String(id));
      writeRoom(room);
      if (window.TownCheckin?.loadRoomFromInput) await window.TownCheckin.loadRoomFromInput();
      return;
    }

    try {
      const resp = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(room.room_code)}/players/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      let data = null;
      try { data = await resp.json(); } catch (err) {}
      if (!resp.ok) return showStatus(data?.detail || `移除玩家失敗（HTTP ${resp.status}）`, true);
      showStatus('已將玩家移出房間。');
      await refreshRoom(room.room_code);
    } catch (err) {
      showStatus(err?.message || '移除玩家時發生錯誤', true);
    }
  };

  const install = () => {
    if (!window.TownCheckin) return false;
    window.TownCheckin.joinRoom = joinOrUpgradeIdentity;
    window.TownCheckin.removePlayer = removePlayerReliable;
    window.TownCheckin.__criticalFixesInstalled = true;
    installed = true;
    return true;
  };

  const start = () => {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (install() || tries > 40) clearInterval(timer);
    }, 100);

    // 其他舊 patch 可能在 DOMContentLoaded 包裝函式，稍後再確認一次，避免被蓋回去。
    setTimeout(() => install(), 900);
    setTimeout(() => install(), 1800);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();