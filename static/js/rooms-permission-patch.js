(() => {
  const STORAGE_KEY = 'botc_town_checkin_room';
  let currentUser = null;
  let refreshTimer = null;
  let hydrating = false;

  const $ = (id) => document.getElementById(id);
  const apiBase = () => window.API_BASE || '';

  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (err) { return null; }
  };

  const writeRoom = (room) => {
    if (room) localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
  };

  const fetchMe = async () => {
    try {
      const resp = await fetch(`${apiBase()}/api/me`, { credentials: 'same-origin' });
      const data = resp.ok ? await resp.json() : null;
      currentUser = data?.logged_in ? data.user : null;
    } catch (err) {
      currentUser = null;
    }
  };

  const hydrateRoomOwner = async () => {
    const room = readRoom();
    const code = room?.room_code || new URLSearchParams(window.location.search).get('join') || $('room-code-input')?.value;
    if (!code || hydrating) return room;
    if (room?.created_by_line_user_id || room?.created_by_id || room?.created_by_display_name) return room;

    hydrating = true;
    try {
      const resp = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(String(code).toUpperCase())}`, { credentials: 'same-origin' });
      if (!resp.ok) return room;
      const freshRoom = await resp.json();
      const merged = { ...(room || {}), ...freshRoom };
      writeRoom(merged);
      if (window.TownCheckinUI?.renderRoomSummary) window.TownCheckinUI.renderRoomSummary();
      return merged;
    } catch (err) {
      return room;
    } finally {
      hydrating = false;
    }
  };

  const isRoomOwner = () => {
    const room = readRoom();
    if (!room || !currentUser) return false;
    if (room.created_by_line_user_id && currentUser.line_user_id) {
      return room.created_by_line_user_id === currentUser.line_user_id;
    }
    if (room.created_by_id && currentUser.id) {
      return Number(room.created_by_id) === Number(currentUser.id);
    }
    return false;
  };

  const setDisabled = (el, disabled, title = '') => {
    if (!el) return;
    el.disabled = disabled;
    if (disabled && title) el.title = title;
    if (!disabled) el.removeAttribute('title');
  };

  const setFieldReadOnly = (el, disabled) => {
    if (!el) return;
    if (el.tagName === 'SELECT') {
      el.disabled = disabled;
    } else {
      el.readOnly = disabled;
      el.classList.toggle('permission-readonly', disabled);
    }
    if (disabled) el.title = '只有房間建立者可以編輯';
    else el.removeAttribute('title');
  };

  const findButtonsByOnclick = (pattern) => {
    return Array.from(document.querySelectorAll('button[onclick]')).filter((button) => String(button.getAttribute('onclick') || '').includes(pattern));
  };

  const renderPermissionHint = (owner) => {
    const room = readRoom();
    const hostBox = $('storyteller-auth-status');
    if (!room || !hostBox) return;

    if (!currentUser) {
      hostBox.textContent = '目前未 LINE 登入。你可以加入房間，但管理房間需要用建立者帳號登入。';
      hostBox.style.color = 'var(--accent-red)';
      return;
    }

    if (owner) {
      hostBox.textContent = `你是此房間建立者：${currentUser.display_name || 'LINE 使用者'}。可以管理房間與玩家座號。`;
      hostBox.style.color = 'var(--text-muted)';
      return;
    }

    if (room.created_by_display_name) {
      hostBox.textContent = `此房間由 ${room.created_by_display_name} 建立。你可以查看與加入，但不能管理房間。`;
    } else {
      hostBox.textContent = '正在補抓房間建立者資訊...';
      setTimeout(() => hydrateRoomOwner().then(applyPermissions), 100);
    }
    hostBox.style.color = 'var(--accent-red)';
  };

  const applyPermissions = async () => {
    await hydrateRoomOwner();
    const room = readRoom();
    const owner = isRoomOwner();
    const hasRoom = Boolean(room?.room_code);
    const shouldLockManage = hasRoom && !owner;
    const disabledTitle = '只有房間建立者可以操作';

    renderPermissionHint(owner);

    ['storyteller-update-button'].forEach((id) => setDisabled($(id), shouldLockManage, disabledTitle));
    findButtonsByOnclick('TownCheckin.lockRoom').forEach((btn) => setDisabled(btn, shouldLockManage, disabledTitle));
    findButtonsByOnclick('TownCheckin.openRoom').forEach((btn) => setDisabled(btn, shouldLockManage, disabledTitle));
    findButtonsByOnclick('TownCheckin.addTemporaryPlayer').forEach((btn) => setDisabled(btn, shouldLockManage, disabledTitle));
    findButtonsByOnclick('TownCheckin.transferToRecorder').forEach((btn) => setDisabled(btn, shouldLockManage, disabledTitle));

    document.querySelectorAll('#room-players-body select[data-seat-selector="true"], #room-players-body input').forEach((field) => setFieldReadOnly(field, shouldLockManage));
    document.querySelectorAll('#room-players-body button').forEach((button) => setDisabled(button, shouldLockManage, disabledTitle));

    ['room-title', 'room-script', 'room-date', 'room-location', 'room-storyteller'].forEach((id) => setFieldReadOnly($(id), shouldLockManage));
  };

  const wrapMethods = () => {
    if (!window.TownCheckin || window.TownCheckin.__permissionWrapped) return false;
    ['createRoom', 'loadRoomFromInput', 'joinRoom', 'refreshRoom', 'updateSeat', 'updateName', 'removePlayer', 'lockRoom', 'openRoom', 'clearLocalRoom'].forEach((key) => {
      const original = window.TownCheckin[key];
      if (typeof original !== 'function') return;
      window.TownCheckin[key] = async (...args) => {
        const result = await original(...args);
        setTimeout(applyPermissions, 150);
        return result;
      };
    });
    window.TownCheckin.__permissionWrapped = true;
    return true;
  };

  const init = async () => {
    await fetchMe();
    wrapMethods();
    await applyPermissions();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(applyPermissions, 1500);
    window.TownCheckinPermissions = { refresh: applyPermissions, fetchMe, hydrateRoomOwner };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();