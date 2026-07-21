(() => {
  const STORAGE_KEY = 'botc_town_checkin_room';
  let refreshTimer = null;
  let applying = false;

  const $ = (id) => document.getElementById(id);
  const apiBase = () => window.API_BASE || '';

  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (err) { return null; }
  };

  const getRoomCode = () => {
    const params = new URLSearchParams(window.location.search);
    return String(readRoom()?.room_code || params.get('join') || $('room-code-input')?.value || '').trim().toUpperCase();
  };

  const fetchPermissions = async () => {
    const code = getRoomCode();
    if (!code) return { is_owner: false, can_manage_players: false, can_manage_room: false };
    try {
      const resp = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}/permissions`, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!resp.ok) return { is_owner: false, can_manage_players: false, can_manage_room: false };
      return await resp.json();
    } catch (err) {
      return { is_owner: false, can_manage_players: false, can_manage_room: false };
    }
  };

  const setDisabled = (el, disabled, title = '') => {
    if (!el) return;
    el.disabled = disabled;
    if (disabled && title) el.title = title;
    else el.removeAttribute('title');
  };

  const setFieldReadOnly = (el, disabled) => {
    if (!el) return;
    if (el.tagName === 'SELECT') el.disabled = disabled;
    else {
      el.readOnly = disabled;
      el.classList.toggle('permission-readonly', disabled);
    }
    if (disabled) el.title = '只有房間建立者可以編輯';
    else el.removeAttribute('title');
  };

  const findButtonsByOnclick = (pattern) => Array.from(document.querySelectorAll('button[onclick]'))
    .filter((button) => String(button.getAttribute('onclick') || '').includes(pattern));

  const ensureOwnerMobileStyle = () => {
    if (document.getElementById('room-owner-mobile-actions-style')) return;
    const style = document.createElement('style');
    style.id = 'room-owner-mobile-actions-style';
    style.textContent = `
      @media (max-width:640px) {
        body.botc-room-owner .room-members-card .town-table td:nth-child(5) {
          display:flex !important;
          grid-column:2;
          grid-row:3;
          justify-content:flex-end;
          margin-top:.35rem;
        }
        body.botc-room-owner .room-members-card .town-table td:nth-child(5) .btn {
          min-width:48px;
          min-height:44px;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const renderPermissionHint = (permissions) => {
    const room = readRoom();
    const hostBox = $('storyteller-auth-status');
    if (!room || !hostBox) return;
    if (permissions.is_owner) {
      hostBox.textContent = `你是此房間建立者，可以管理房間、玩家座號與移除玩家。`;
      hostBox.style.color = 'var(--text-muted)';
    } else {
      hostBox.textContent = room.created_by_display_name
        ? `此房間由 ${room.created_by_display_name} 建立。你可以查看與加入，但不能管理房間。`
        : '你不是此房間建立者，無法管理房間。';
      hostBox.style.color = 'var(--accent-red)';
    }
  };

  const applyPermissions = async () => {
    if (applying) return;
    applying = true;
    try {
      ensureOwnerMobileStyle();
      const permissions = await fetchPermissions();
      const room = readRoom();
      const hasRoom = Boolean(room?.room_code || getRoomCode());
      const canManageRoom = Boolean(permissions.can_manage_room);
      const canManagePlayers = Boolean(permissions.can_manage_players);
      const lockRoom = hasRoom && !canManageRoom;
      const lockPlayers = hasRoom && !canManagePlayers;
      const title = '只有房間建立者可以操作';

      document.body.classList.toggle('botc-room-owner', Boolean(permissions.is_owner));
      renderPermissionHint(permissions);

      setDisabled($('storyteller-update-button'), lockRoom, title);
      findButtonsByOnclick('TownCheckin.lockRoom').forEach((btn) => setDisabled(btn, lockRoom, title));
      findButtonsByOnclick('TownCheckin.openRoom').forEach((btn) => setDisabled(btn, lockRoom, title));
      findButtonsByOnclick('TownCheckin.addTemporaryPlayer').forEach((btn) => setDisabled(btn, lockPlayers, title));
      findButtonsByOnclick('TownCheckin.transferToRecorder').forEach((btn) => setDisabled(btn, lockPlayers, title));

      // 座號 select 由 rooms-self-seat-patch.js 決定：房主可改全部，玩家可改自己。
      document.querySelectorAll('#room-players-body input').forEach((field) => setFieldReadOnly(field, lockPlayers));
      document.querySelectorAll('#room-players-body button').forEach((button) => setDisabled(button, lockPlayers, title));
      ['room-title', 'room-script', 'room-date', 'room-location', 'room-storyteller'].forEach((id) => setFieldReadOnly($(id), lockRoom));

      if (window.TownCheckinSelfSeat?.refresh) window.TownCheckinSelfSeat.refresh();
    } finally {
      applying = false;
    }
  };

  const wrapMethods = () => {
    if (!window.TownCheckin || window.TownCheckin.__permissionWrappedV2) return false;
    ['createRoom', 'loadRoomFromInput', 'joinRoom', 'refreshRoom', 'updateSeat', 'updateName', 'removePlayer', 'lockRoom', 'openRoom', 'clearLocalRoom'].forEach((key) => {
      const original = window.TownCheckin[key];
      if (typeof original !== 'function') return;
      window.TownCheckin[key] = async (...args) => {
        const result = await original(...args);
        setTimeout(applyPermissions, 100);
        return result;
      };
    });
    window.TownCheckin.__permissionWrappedV2 = true;
    return true;
  };

  const init = async () => {
    wrapMethods();
    await applyPermissions();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(applyPermissions, 1200);
    window.TownCheckinPermissions = { refresh: applyPermissions, fetchPermissions };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();