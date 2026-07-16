(() => {
  const STORAGE_KEY = 'botc_town_checkin_room';
  let currentUser = null;
  let refreshTimer = null;

  const $ = (id) => document.getElementById(id);

  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (err) { return null; }
  };

  const fetchMe = async () => {
    try {
      const resp = await fetch(`${window.API_BASE || ''}/api/me`, { credentials: 'same-origin' });
      const data = resp.ok ? await resp.json() : null;
      currentUser = data?.logged_in ? data.user : null;
    } catch (err) {
      currentUser = null;
    }
  };

  const isRoomOwner = () => {
    const room = readRoom();
    if (!room || !currentUser) return false;
    return Boolean(room.created_by_line_user_id && currentUser.line_user_id && room.created_by_line_user_id === currentUser.line_user_id);
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
      hostBox.textContent = '此房間沒有建立者資訊，請重新開房以啟用管理權限。';
    }
    hostBox.style.color = 'var(--accent-red)';
  };

  const applyPermissions = () => {
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
    applyPermissions();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(applyPermissions, 1500);
    window.TownCheckinPermissions = { refresh: applyPermissions, fetchMe };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
