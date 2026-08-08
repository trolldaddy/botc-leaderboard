(() => {
  const STORAGE_KEY = 'botc_town_checkin_room';
  const NICKNAME_KEY = 'botc_player_display_name';
  let scannerStream = null;
  let scanTimer = null;
  let profileState = { logged_in: false, user: null };

  const $ = (id) => document.getElementById(id);

  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (err) { return null; }
  };

  const writeRoom = (room) => {
    if (room) localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
  };

  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value;
  };

  const setHtml = (id, value) => {
    const el = $(id);
    if (el) el.innerHTML = value;
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const today = () => new Date().toISOString().split('T')[0];

  const getJoinCode = () => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('join');
    const fromInput = $('room-code-input')?.value;
    return String(fromInput || fromUrl || '').trim().toUpperCase();
  };

  const getRoomFormData = () => ({
    title: ($('room-title')?.value || '小鎮報到').trim() || '小鎮報到',
    script: ($('room-script')?.value || '').trim(),
    date: ($('room-date')?.value || today()).trim(),
    location: ($('room-location')?.value || '拉普拉斯').trim() || '拉普拉斯',
    storyteller: ($('room-storyteller')?.value || profileState.user?.display_name || '').trim()
  });

  const setProfileStatus = (message, isError = false) => {
    const el = $('player-profile-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
  };

  const setStorytellerStatus = (message, isError = false) => {
    const el = $('storyteller-auth-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
  };

  const renderStorytellerAuth = () => {
    const loginButton = $('storyteller-login-button');
    const createButton = $('storyteller-create-button');
    const updateButton = $('storyteller-update-button');
    const room = readRoom();

    if (profileState.logged_in && profileState.user) {
      setStorytellerStatus(`已使用 LINE 登入：${profileState.user.display_name || 'LINE 使用者'}。開房與更新房間資料會使用這個身分。`);
      if (loginButton) loginButton.style.display = 'none';
      if (createButton) createButton.disabled = false;
      if (updateButton) updateButton.disabled = !room;
      if ($('room-storyteller') && !$('room-storyteller').value) {
        $('room-storyteller').value = profileState.user.display_name || '';
      }
    } else {
      setStorytellerStatus('說書人建議先 LINE 登入再開房，房間才會綁定建立者。', true);
      if (loginButton) loginButton.style.display = '';
      if (createButton) createButton.disabled = false;
      if (updateButton) updateButton.disabled = !room;
    }
  };

  const renderProfile = async () => {
    const savedName = localStorage.getItem(NICKNAME_KEY) || '';
    if ($('join-display-name') && savedName && !$('join-display-name').value) {
      $('join-display-name').value = savedName;
    }

    try {
      const resp = await fetch(`${window.API_BASE || ''}/api/me`, { credentials: 'same-origin' });
      const data = resp.ok ? await resp.json() : { logged_in: false, user: null };
      const user = data.user || null;
      profileState = { logged_in: !!data.logged_in, user };
      if (data.logged_in && user) {
        setText('player-line-name', user.display_name || 'LINE 使用者');
        setText('player-line-state', '已連結 LINE');
        setProfileStatus('可使用 LINE 身分加入房間。');
        if ($('player-line-avatar')) {
          if (user.picture_url) {
            $('player-line-avatar').innerHTML = `<img src="${escapeHtml(user.picture_url)}" alt="LINE avatar">`;
          } else {
            $('player-line-avatar').innerHTML = '<i class="fa-brands fa-line"></i>';
          }
        }
        if ($('join-display-name') && !$('join-display-name').value) {
          $('join-display-name').value = user.display_name || '';
        }
      } else {
        setText('player-line-name', '尚未 LINE 登入');
        setText('player-line-state', '可用臨時玩家加入');
        setProfileStatus('你可以先設定店內暱稱，或使用 LINE 登入。');
        if ($('player-line-avatar')) $('player-line-avatar').innerHTML = '<i class="fa-solid fa-user"></i>';
      }
    } catch (err) {
      profileState = { logged_in: false, user: null };
      setText('player-line-name', '無法讀取登入狀態');
      setText('player-line-state', '仍可臨時加入');
      setProfileStatus('登入狀態讀取失敗。', true);
    }
    renderStorytellerAuth();
  };

  const saveDisplayName = () => {
    const value = ($('join-display-name')?.value || '').trim();
    if (!value) return setProfileStatus('請先輸入顯示暱稱。', true);
    localStorage.setItem(NICKNAME_KEY, value);
    setProfileStatus(`已儲存顯示暱稱：${value}`);
  };

  const renderRoomSummary = () => {
    const room = readRoom();
    const params = new URLSearchParams(window.location.search);
    const pendingCode = params.get('join') || getJoinCode();

    if (!room) {
      setHtml('active-room-summary', `
        <div class="empty-room-summary">
          <div class="summary-title">尚未加入房間</div>
          <div class="summary-subtitle">輸入五碼房間代碼，或掃描說書人的 QR Code。</div>
          ${pendingCode ? `<div class="room-code-pill">目前代碼：${escapeHtml(pendingCode.toUpperCase())}</div>` : ''}
        </div>
      `);
      renderStorytellerAuth();
      return;
    }

    setHtml('active-room-summary', `
      <div class="room-summary-card">
        <div class="summary-title">${escapeHtml(room.title || '小鎮報到')}</div>
        <div class="room-code-pill">${escapeHtml(room.room_code || '-----')}</div>
        <div class="summary-grid">
          <span><i class="fa-solid fa-scroll"></i> ${escapeHtml(room.script || '未設定劇本')}</span>
          <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(room.location || '未知地點')}</span>
          <span><i class="fa-solid fa-calendar-day"></i> ${escapeHtml(String(room.date || '').slice(0, 10) || '未設定日期')}</span>
          <span><i class="fa-solid fa-user-tie"></i> ${escapeHtml(room.storyteller || '未設定說書人')}</span>
        </div>
        <div class="summary-subtitle">目前 ${Array.isArray(room.players) ? room.players.length : 0} 位玩家在房間內。狀態：${room.status === 'locked' ? '已鎖定' : '開放報到'}</div>
      </div>
    `);
    renderStorytellerAuth();
  };

  const joinByCode = async () => {
    const code = getJoinCode();
    const nickname = ($('join-display-name')?.value || '').trim();
    if (!code) return alert('請輸入五碼房間代碼。');
    if (!nickname) return alert('請先輸入你的店內暱稱。');

    if ($('room-code-input')) $('room-code-input').value = code;
    const url = new URL(window.location.href);
    url.searchParams.set('join', code);
    url.hash = 'rooms';
    window.history.replaceState({}, '', url.toString());

    if (window.TownCheckin?.loadRoomFromInput) {
      await window.TownCheckin.loadRoomFromInput();
    }
    if (window.TownCheckin?.joinRoom) {
      await window.TownCheckin.joinRoom();
    }
    localStorage.setItem(NICKNAME_KEY, nickname);
    setTimeout(renderRoomSummary, 150);
  };

  const lineLoginWithCode = () => {
    const code = getJoinCode();
    const url = new URL(window.location.href);
    if (code) url.searchParams.set('join', code);
    url.hash = 'rooms';
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.location.href = `/api/auth/line/login?next=${encodeURIComponent(next)}`;
  };

  const switchLineAccount = () => {
    const code = getJoinCode();
    const url = new URL(window.location.href);
    if (code) url.searchParams.set('join', code);
    url.hash = 'rooms';
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.location.href = `/api/auth/line/login?switch_account=1&next=${encodeURIComponent(next)}`;
  };

  const storytellerLogin = () => {
    const url = new URL(window.location.href);
    url.hash = 'rooms';
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.location.href = `/api/auth/line/login?next=${encodeURIComponent(next)}`;
  };

  const updateRoomDetails = async () => {
    const room = readRoom();
    if (!room?.room_code) return alert('請先建立或載入房間。');

    const payload = getRoomFormData();
    const previous = { ...room };
    const optimisticRoom = { ...room, ...payload };
    writeRoom(optimisticRoom);
    renderRoomSummary();
    setStorytellerStatus('正在更新房間資料...');

    try {
      const resp = await fetch(`${window.API_BASE || ''}/api/rooms/${encodeURIComponent(room.room_code)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        let message = '更新房間資料失敗';
        try {
          const error = await resp.json();
          message = error.detail || message;
        } catch (err) {}
        throw new Error(message);
      }
      const data = await resp.json();
      if (data.room) writeRoom(data.room);
      if (window.TownCheckin?.refreshRoom) await window.TownCheckin.refreshRoom();
      renderRoomSummary();
      setStorytellerStatus('房間資料已更新，上方摘要也已同步。');
    } catch (err) {
      writeRoom(previous);
      renderRoomSummary();
      setStorytellerStatus(err.message || '更新房間資料失敗。', true);
    }
  };

  const startQrScanner = async () => {
    const panel = $('qr-scan-panel');
    const video = $('qr-scan-video');
    if (!panel || !video) return;

    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
      alert('這個瀏覽器不支援開啟攝影機。');
      return;
    }
    if (!('BarcodeDetector' in window)) {
      alert('這個瀏覽器不支援網頁 QR 掃描。請先手動輸入五碼房間代碼。');
      return;
    }

    try {
      panel.style.display = 'block';
      scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = scannerStream;
      await video.play();
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      scanTimer = setInterval(async () => {
        try {
          const codes = await detector.detect(video);
          if (!codes.length) return;
          const raw = codes[0].rawValue || '';
          const parsed = new URL(raw, window.location.origin);
          const joinCode = parsed.searchParams.get('join') || raw.trim();
          if ($('room-code-input')) $('room-code-input').value = joinCode.toUpperCase();
          stopQrScanner();
          renderRoomSummary();
        } catch (err) {}
      }, 700);
    } catch (err) {
      alert('無法開啟攝影機，請確認瀏覽器權限。');
      stopQrScanner();
    }
  };

  const stopQrScanner = () => {
    if (scanTimer) clearInterval(scanTimer);
    scanTimer = null;
    if (scannerStream) scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
    if ($('qr-scan-video')) $('qr-scan-video').srcObject = null;
    if ($('qr-scan-panel')) $('qr-scan-panel').style.display = 'none';
  };

  const wrapTownCheckinMethods = () => {
    if (!window.TownCheckin || window.TownCheckin.__uiWrapped) return;
    const originalCreateRoom = window.TownCheckin.createRoom;
    if (typeof originalCreateRoom === 'function') {
      window.TownCheckin.createRoom = async (...args) => {
        await renderProfile();
        if (!profileState.logged_in) {
          setStorytellerStatus('請先用 LINE 登入再建立房間。正在前往登入...', true);
          setTimeout(storytellerLogin, 500);
          return null;
        }
        const result = await originalCreateRoom(...args);
        setTimeout(renderRoomSummary, 120);
        return result;
      };
    }

    ['loadRoomFromInput', 'joinRoom', 'addTemporaryPlayer', 'updateSeat', 'updateName', 'removePlayer', 'lockRoom', 'openRoom', 'refreshRoom', 'clearLocalRoom'].forEach((key) => {
      const original = window.TownCheckin[key];
      if (typeof original !== 'function') return;
      window.TownCheckin[key] = async (...args) => {
        const result = await original(...args);
        setTimeout(renderRoomSummary, 120);
        return result;
      };
    });
    window.TownCheckin.__uiWrapped = true;
  };

  const init = async () => {
    await renderProfile();
    renderRoomSummary();
    wrapTownCheckinMethods();
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode && $('room-code-input')) $('room-code-input').value = joinCode.toUpperCase();
  };

  window.TownCheckinUI = {
    saveDisplayName,
    joinByCode,
    lineLoginWithCode,
    switchLineAccount,
    storytellerLogin,
    updateRoomDetails,
    startQrScanner,
    stopQrScanner,
    renderRoomSummary,
    renderProfile
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
