/* Town Check-in: authoritative room state and server synchronization. */

/* Consolidated from static/js/rooms.js. */
window.TownCheckin = (() => {
  const STORAGE_KEY = 'botc_town_checkin_room';
  const apiBase = () => window.API_BASE || '';
  let currentRoom = null;
  let currentUser = null;
  let localMode = false;

  const $ = (id) => document.getElementById(id);

  const setStatus = (message, isError = false) => {
    const el = $('town-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
  };

  const randomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();

  const today = () => new Date().toISOString().split('T')[0];

  const buildJoinUrl = (roomCode) => {
    const url = new URL(window.location.href);
    url.searchParams.set('join', roomCode);
    url.hash = 'rooms';
    return url.toString();
  };

  const saveLocalRoom = () => {
    if (currentRoom) localStorage.setItem(STORAGE_KEY, JSON.stringify(currentRoom));
    window.dispatchEvent(new CustomEvent('botc:town-room-changed', { detail: { room: currentRoom } }));
  };

  const loadLocalRoom = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (err) {
      return null;
    }
  };

  const fetchMe = async () => {
    try {
      const resp = await fetch(`${apiBase()}/api/me`, { credentials: 'same-origin' });
      if (!resp.ok) throw new Error('not logged in');
      const data = await resp.json();
      currentUser = data.user || null;
      if (currentUser && $('join-display-name') && !$('join-display-name').value) {
        $('join-display-name').value = currentUser.display_name || '';
      }
      return data;
    } catch (err) {
      currentUser = null;
      return { logged_in: false, user: null };
    }
  };

  const normalizeRoom = (room) => {
    if (!room) return null;
    return {
      id: room.id || null,
      room_code: room.room_code || room.code || randomCode(),
      title: room.title || '小鎮報到',
      script: room.script || '',
      date: room.date || today(),
      location: room.location || '拉普拉斯',
      storyteller: room.storyteller || '',
      status: room.status || 'open',
      players: Array.isArray(room.players) ? room.players : []
    };
  };

  const getFormData = () => ({
    title: $('room-title')?.value || '小鎮報到',
    script: $('room-script')?.value || '',
    date: $('room-date')?.value || today(),
    location: $('room-location')?.value || '拉普拉斯',
    storyteller: $('room-storyteller')?.value || currentUser?.display_name || ''
  });

  const fillForm = (room) => {
    if (!room) return;
    if ($('room-title')) $('room-title').value = room.title || '小鎮報到';
    if ($('room-script')) $('room-script').value = room.script || '';
    if ($('room-date')) $('room-date').value = (room.date || today()).slice(0, 10);
    if ($('room-location')) $('room-location').value = room.location || '拉普拉斯';
    if ($('room-storyteller')) $('room-storyteller').value = room.storyteller || currentUser?.display_name || '';
    if ($('room-code-input')) $('room-code-input').value = room.room_code || '';
  };

  const renderQr = (room) => {
    const qrBox = $('room-qr');
    const codeEl = $('room-code-display');
    const urlEl = $('room-join-url');
    if (!room || !qrBox) return;
    const joinUrl = buildJoinUrl(room.room_code);
    qrBox.innerHTML = '';
    if (window.QRCode) {
      new QRCode(qrBox, { text: joinUrl, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
    } else {
      qrBox.textContent = joinUrl;
    }
    if (codeEl) codeEl.textContent = room.room_code;
    if (urlEl) urlEl.textContent = joinUrl;
  };

  const renderJoinPanel = () => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    const panel = $('join-panel');
    if (!panel) return;
    if (joinCode) {
      panel.style.display = 'block';
      if ($('join-room-code')) $('join-room-code').textContent = joinCode.toUpperCase();
    } else {
      panel.style.display = 'none';
    }
  };

  const renderPlayers = (room) => {
    const body = $('room-players-body');
    if (!body) return;
    const players = [...(room?.players || [])].sort((a, b) => {
      const as = a.seat_number || 999;
      const bs = b.seat_number || 999;
      if (as !== bs) return as - bs;
      return (a.id || 0) - (b.id || 0);
    });
    if (players.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="empty-row">尚未有玩家加入。</td></tr>';
      return;
    }
    body.innerHTML = players.map((p, index) => {
      const fallbackId = p.id || `local-${index}`;
      const avatar = p.picture_url
        ? `<img class="player-avatar" src="${escapeHtml(p.picture_url)}" alt="">`
        : '<span class="player-avatar player-avatar-placeholder"><i class="fa-solid fa-user"></i></span>';
      const playerName = p.player_name || p.display_name || p.name || '未命名玩家';
      return `
        <tr>
          <td><input class="form-control dark-input" type="number" min="1" max="20" value="${p.seat_number || ''}" onchange="TownCheckin.updateSeat('${fallbackId}', this.value)"></td>
          <td><div class="room-player-identity">${avatar}<span>${escapeHtml(playerName)}</span></div></td>
          <td><input class="form-control dark-input room-player-nickname" value="${escapeHtml(p.display_name || p.name || '')}" aria-label="${escapeHtml(playerName)}的暱稱" onchange="TownCheckin.updateName('${fallbackId}', this.value)"></td>
          <td>${p.is_temporary ? '臨時玩家' : 'LINE'}</td>
          <td>${p.line_user_id ? '已綁定' : '未綁定'}</td>
          <td><button class="btn btn-outline" onclick="TownCheckin.removePlayer('${fallbackId}')"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    }).join('');
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const render = () => {
    currentRoom = normalizeRoom(currentRoom);
    fillForm(currentRoom);
    renderQr(currentRoom);
    renderPlayers(currentRoom);
    renderJoinPanel();
    if (currentRoom) {
      setStatus(`${localMode ? '本機測試模式｜' : ''}房間 ${currentRoom.room_code}｜${currentRoom.status === 'open' ? '開放報到' : '已鎖定'}｜${currentRoom.players.length} 位玩家`);
    }
  };

  const createRoom = async () => {
    const payload = getFormData();
    try {
      const resp = await fetch(`${apiBase()}/api/rooms`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('API not available');
      const data = await resp.json();
      currentRoom = normalizeRoom(data.room);
      localMode = false;
    } catch (err) {
      currentRoom = normalizeRoom({ ...payload, room_code: randomCode(), status: 'open', players: [] });
      localMode = true;
      setStatus('後端 API 尚未啟用，已建立本機測試房間。', true);
    }
    saveLocalRoom();
    render();
  };

  const loadRoom = async (code) => {
    if (!code) return;
    try {
      const resp = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}`, { credentials: 'same-origin' });
      if (!resp.ok) throw new Error('not found');
      currentRoom = normalizeRoom(await resp.json());
      localMode = false;
    } catch (err) {
      const saved = loadLocalRoom();
      if (saved && saved.room_code === code.toUpperCase()) {
        currentRoom = normalizeRoom(saved);
        localMode = true;
      } else {
        setStatus('找不到房間。若後端尚未接上，只能載入本機建立的測試房。', true);
        return;
      }
    }
    saveLocalRoom();
    render();
  };

  const loadRoomFromInput = () => loadRoom(($('room-code-input')?.value || '').trim().toUpperCase());

  const refreshRoom = () => currentRoom ? loadRoom(currentRoom.room_code) : setStatus('尚未載入房間。', true);

  const joinRoom = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('join') || currentRoom?.room_code || '').toUpperCase();
    const displayName = ($('join-display-name')?.value || currentUser?.display_name || '').trim();
    if (!code) return setStatus('缺少房間代碼。', true);
    if (!displayName) return setStatus('請輸入玩家名稱。', true);
    try {
      const resp = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName })
      });
      if (!resp.ok) throw new Error('join failed');
      const data = await resp.json();
      currentRoom = normalizeRoom(data.room);
      localMode = false;
    } catch (err) {
      currentRoom = normalizeRoom(currentRoom || loadLocalRoom() || { room_code: code, players: [] });
      currentRoom.players.push({ id: `local-${Date.now()}`, display_name: displayName, name: displayName, is_temporary: !currentUser, line_user_id: currentUser?.line_user_id || null, picture_url: currentUser?.picture_url || null });
      localMode = true;
    }
    saveLocalRoom();
    render();
  };

  const addTemporaryPlayer = () => {
    if (!currentRoom) currentRoom = normalizeRoom(loadLocalRoom() || { room_code: randomCode(), players: [] });
    const name = prompt('請輸入臨時玩家名稱');
    if (!name) return;
    currentRoom.players.push({ id: `local-${Date.now()}`, display_name: name.trim(), name: name.trim(), is_temporary: true, line_user_id: null, picture_url: null });
    localMode = true;
    saveLocalRoom();
    render();
  };

  const findPlayer = (id) => (currentRoom?.players || []).find(p => String(p.id) === String(id));

  const syncPlayer = async (id, patch) => {
    const player = findPlayer(id);
    if (!player || !currentRoom) return;
    Object.assign(player, patch);
    saveLocalRoom();
    renderPlayers(currentRoom);
    if (!localMode && !String(id).startsWith('local-')) {
      try {
        const resp = await fetch(`${apiBase()}/api/rooms/${currentRoom.room_code}/players/${id}`, {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        if (resp.ok) {
          const data = await resp.json();
          currentRoom = normalizeRoom(data.room);
          saveLocalRoom();
          render();
        }
      } catch (err) {}
    }
  };

  const updateSeat = (id, value) => {
    const seat = value ? parseInt(value, 10) : null;
    if (seat && (currentRoom.players || []).some(p => String(p.id) !== String(id) && Number(p.seat_number) === seat)) {
      alert('此座號已被分配。');
      renderPlayers(currentRoom);
      return;
    }
    syncPlayer(id, { seat_number: seat });
  };

  const updateName = (id, value) => syncPlayer(id, { display_name: value, name: value });

  const removePlayer = async (id) => {
    if (!currentRoom || !confirm('確定移除此玩家？')) return;
    currentRoom.players = currentRoom.players.filter(p => String(p.id) !== String(id));
    saveLocalRoom();
    render();
    if (!localMode && !String(id).startsWith('local-')) {
      try { await fetch(`${apiBase()}/api/rooms/${currentRoom.room_code}/players/${id}`, { method: 'DELETE', credentials: 'same-origin' }); } catch (err) {}
    }
  };

  const setRoomStatus = async (status) => {
    if (!currentRoom) return setStatus('尚未建立房間。', true);
    currentRoom.status = status;
    saveLocalRoom();
    render();
    if (!localMode) {
      try {
        const resp = await fetch(`${apiBase()}/api/rooms/${currentRoom.room_code}`, {
          method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
        });
        if (resp.ok) { const data = await resp.json(); currentRoom = normalizeRoom(data.room); saveLocalRoom(); render(); }
      } catch (err) {}
    }
  };

  const lockRoom = () => setRoomStatus('locked');
  const openRoom = () => setRoomStatus('open');

  const copyJoinUrl = async () => {
    if (!currentRoom) return;
    const url = buildJoinUrl(currentRoom.room_code);
    try {
      await navigator.clipboard.writeText(url);
      setStatus('已複製加入連結。');
    } catch (err) {
      prompt('複製加入連結', url);
    }
  };

  const goLineLogin = () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join') || currentRoom?.room_code || '';
    const next = `${window.location.pathname}?join=${encodeURIComponent(code)}#rooms`;
    window.location.href = `/api/auth/line/login?next=${encodeURIComponent(next)}`;
  };

  const transferToRecorder = () => {
    if (!currentRoom) return setStatus('尚未建立房間。', true);
    const players = [...(currentRoom.players || [])]
      .filter(p => p.display_name || p.name)
      .sort((a, b) => (a.seat_number || 999) - (b.seat_number || 999))
      .map((p, index) => ({
        id: p.seat_number || index + 1,
        name: p.display_name || p.name,
        role: null,
        hiddenRole: '',
        isDead: false,
        roomPlayerId: p.id,
        lineUserId: p.line_user_id || null,
        isTemporary: !!p.is_temporary
      }));
    if (players.length === 0) return setStatus('沒有玩家可帶入。', true);
    localStorage.setItem('botc_room_to_recorder', JSON.stringify({ room: currentRoom, players }));
    localStorage.setItem('botc_players', JSON.stringify(players));
    localStorage.setItem('botc_playerCount', JSON.stringify(players.length));
    localStorage.setItem('botc_scriptName', JSON.stringify(currentRoom.script || currentRoom.title || '未命名劇本'));
    localStorage.setItem('botc_gameDate', JSON.stringify((currentRoom.date || today()).slice(0, 10)));
    localStorage.setItem('botc_gameLocation', JSON.stringify(currentRoom.location || '拉普拉斯'));
    localStorage.setItem('botc_storyteller', JSON.stringify(currentRoom.storyteller || ''));
    localStorage.setItem('botc_gamePhase', JSON.stringify({ type: 'Setup', number: 0 }));
    localStorage.setItem('botc_logs', JSON.stringify([]));
    window.location.hash = 'recorder';
  };

  const clearLocalRoom = () => {
    localStorage.removeItem(STORAGE_KEY);
    currentRoom = null;
    window.dispatchEvent(new CustomEvent('botc:town-room-changed', { detail: { room: null } }));
    render();
    setStatus('已清空本機暫存。');
  };

  const init = async () => {
    if ($('room-date')) $('room-date').value = today();
    await fetchMe();
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) await loadRoom(joinCode.toUpperCase());
    else {
      const saved = loadLocalRoom();
      if (saved) { currentRoom = normalizeRoom(saved); localMode = true; }
    }
    render();
  };

  init();

  return {
    createRoom,
    loadRoomFromInput,
    refreshRoom,
    joinRoom,
    addTemporaryPlayer,
    updateSeat,
    updateName,
    removePlayer,
    lockRoom,
    openRoom,
    copyJoinUrl,
    goLineLogin,
    transferToRecorder,
    clearLocalRoom,
    getCurrentRoom: () => currentRoom
  };
})();


/* Consolidated from static/js/rooms-sync-patch.js. */
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


/* Consolidated from static/js/rooms-critical-fixes-patch.js. */
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


