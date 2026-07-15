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
      body.innerHTML = '<tr><td colspan="5" class="empty-row">尚未有玩家加入。</td></tr>';
      return;
    }
    body.innerHTML = players.map((p, index) => {
      const fallbackId = p.id || `local-${index}`;
      const avatar = p.picture_url ? `<img class="player-avatar" src="${p.picture_url}" alt="">` : '';
      return `
        <tr>
          <td><input class="form-control dark-input" type="number" min="1" max="20" value="${p.seat_number || ''}" onchange="TownCheckin.updateSeat('${fallbackId}', this.value)"></td>
          <td>${avatar}<input class="form-control dark-input" style="display:inline-block;width:220px;max-width:80%;" value="${escapeHtml(p.display_name || p.name || '')}" onchange="TownCheckin.updateName('${fallbackId}', this.value)"></td>
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
    if (window.loadPage) {
      window.location.hash = 'recorder';
      window.loadPage('recorder');
    } else {
      window.location.href = '/#recorder';
    }
  };

  const clearLocalRoom = () => {
    localStorage.removeItem(STORAGE_KEY);
    currentRoom = null;
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
    clearLocalRoom
  };
})();
