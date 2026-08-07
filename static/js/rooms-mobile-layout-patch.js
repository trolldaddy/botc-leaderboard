(() => {
  const ROOM_KEY = 'botc_town_checkin_room';
  const DEVICE_TOKEN_KEY = 'botc_town_checkin_device_token';
  let refreshTimer = null;
  let refreshing = false;

  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(ROOM_KEY) || 'null'); }
    catch (err) { return null; }
  };

  const getDeviceToken = () => {
    try { return localStorage.getItem(DEVICE_TOKEN_KEY) || ''; }
    catch (err) { return ''; }
  };

  const roomCode = () => {
    const params = new URLSearchParams(window.location.search);
    return String(
      document.getElementById('room-code-input')?.value ||
      params.get('join') ||
      readRoom()?.room_code ||
      ''
    ).trim().toUpperCase();
  };

  const installStyles = () => {
    if (document.getElementById('rooms-mobile-layout-style')) return;
    const style = document.createElement('style');
    style.id = 'rooms-mobile-layout-style';
    style.textContent = `
      .profile-seat-control{margin-top:1rem;padding:1rem;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.035)}
      .profile-seat-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.65rem}
      .profile-seat-title{display:flex;align-items:center;gap:.45rem;color:var(--accent-gold);font-size:.76rem;font-weight:900;letter-spacing:.08em}
      .profile-seat-status{color:var(--text-muted);font-size:.75rem;text-align:right}
      .profile-seat-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.7rem;align-items:center}
      .profile-seat-select{min-height:46px;font-size:1rem;font-weight:800}
      .profile-seat-save{min-height:46px;white-space:nowrap}
      .town-tab-storyteller.room-members-card{margin-top:0}
      @media(max-width:640px){
        .town-layout-v2{display:flex!important;flex-direction:column;gap:1rem}
        .player-profile-card{order:1}
        .join-room-card{order:2}
        .storyteller-room-card{order:1}
        .room-members-card{order:2}
        .player-profile-card,.join-room-card,.storyteller-room-card,.room-members-card{grid-column:auto!important}
        .player-profile-card .profile-main{margin-top:.55rem}
        .player-profile-card .form-group{margin-top:.8rem!important}
        .profile-seat-control{margin-top:.8rem;padding:.85rem}
        .room-members-card{margin-top:0}
      }
    `;
    document.head.appendChild(style);
  };

  const rearrangeSections = () => {
    const tabs = document.querySelectorAll('.town-mode-tab');
    tabs.forEach((button) => {
      if (button.dataset.townTabTarget === 'storyteller') {
        const label = button.querySelector('span');
        if (label) label.textContent = '房間資訊';
        const icon = button.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-door-open';
      }
    });

    const members = document.querySelector('.room-members-card');
    const storyteller = document.querySelector('.storyteller-room-card');
    if (members) {
      members.classList.remove('town-tab-player');
      members.classList.add('town-tab-storyteller');
    }
    if (
      storyteller &&
      members &&
      storyteller.parentElement === members.parentElement &&
      storyteller.nextElementSibling !== members
    ) {
      storyteller.insertAdjacentElement('afterend', members);
    }
  };

  const ensureSeatControl = () => {
    const card = document.querySelector('.player-profile-card');
    if (!card) return null;
    let control = document.getElementById('profile-seat-control');
    if (control) return control;

    control = document.createElement('div');
    control.id = 'profile-seat-control';
    control.className = 'profile-seat-control';
    control.innerHTML = `
      <div class="profile-seat-head">
        <div class="profile-seat-title"><i class="fa-solid fa-chair"></i> 我的座位號</div>
        <div id="profile-seat-status" class="profile-seat-status">加入房間後可選擇</div>
      </div>
      <div class="profile-seat-row">
        <select id="profile-seat-select" class="form-control dark-input profile-seat-select" disabled>
          <option value="">尚未選擇</option>
          ${Array.from({ length: 20 }, (_, index) => `<option value="${index + 1}">${index + 1} 號</option>`).join('')}
        </select>
        <button id="profile-seat-save" type="button" class="btn btn-outline profile-seat-save" disabled>
          <i class="fa-solid fa-check"></i> 套用
        </button>
      </div>`;

    const status = card.querySelector('#player-profile-status');
    if (status) status.insertAdjacentElement('beforebegin', control);
    else card.appendChild(control);

    control.querySelector('#profile-seat-save')?.addEventListener('click', saveSeat);
    control.querySelector('#profile-seat-select')?.addEventListener('change', (event) => {
      const seat = event.currentTarget.value;
      const status = control.querySelector('#profile-seat-status');
      if (status) status.textContent = seat ? `將改為 ${seat} 號` : '將清除座位';
    });
    return control;
  };

  const findOwnPlayer = async (room) => {
    if (!room?.players?.length) return null;
    const token = getDeviceToken();
    let me = null;
    try {
      const response = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
      if (response.ok) me = await response.json();
    } catch (err) {}

    const lineUserId = me?.user?.line_user_id || '';
    return room.players.find((player) =>
      (token && player.device_token && player.device_token === token) ||
      (lineUserId && player.line_user_id === lineUserId)
    ) || null;
  };

  const fetchRoom = async () => {
    const code = roomCode();
    if (!code) return readRoom();
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) return readRoom();
      const room = await response.json();
      localStorage.setItem(ROOM_KEY, JSON.stringify(room));
      return room;
    } catch (err) {
      return readRoom();
    }
  };

  const refreshSeatControl = async () => {
    if (refreshing) return;
    refreshing = true;
    try {
      const control = ensureSeatControl();
      if (!control) return;
      const select = control.querySelector('#profile-seat-select');
      const button = control.querySelector('#profile-seat-save');
      const status = control.querySelector('#profile-seat-status');
      const room = await fetchRoom();
      const player = await findOwnPlayer(room);

      control.dataset.playerId = player?.id || '';
      control.dataset.roomCode = room?.room_code || '';
      if (!player) {
        select.value = '';
        select.disabled = true;
        button.disabled = true;
        status.textContent = room?.room_code ? '尚未完成報到' : '加入房間後可選擇';
        return;
      }

      select.disabled = false;
      button.disabled = false;
      select.value = player.seat_number ? String(player.seat_number) : '';
      status.textContent = player.seat_number ? `目前 ${player.seat_number} 號` : '尚未選擇座位';
    } finally {
      refreshing = false;
    }
  };

  async function saveSeat() {
    const control = ensureSeatControl();
    const playerId = control?.dataset.playerId;
    const select = control?.querySelector('#profile-seat-select');
    const button = control?.querySelector('#profile-seat-save');
    const status = control?.querySelector('#profile-seat-status');
    if (!playerId || !select) return alert('請先完成房間報到。');

    button.disabled = true;
    status.textContent = '更新中...';
    try {
      if (!window.TownCheckin?.updateSeat) throw new Error('座位功能尚未載入');
      await window.TownCheckin.updateSeat(playerId, select.value);
      await refreshSeatControl();
    } catch (err) {
      alert(err?.message || '座位更新失敗，請稍後再試。');
      await refreshSeatControl();
    } finally {
      button.disabled = false;
    }
  }

  const scheduleRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refreshSeatControl().catch(console.warn), 120);
  };

  const install = () => {
    installStyles();
    const root = document.querySelector('.town-layout-v2');
    if (!root) return false;
    rearrangeSections();
    ensureSeatControl();

    const observer = new MutationObserver(() => {
      rearrangeSections();
      scheduleRefresh();
    });
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener('focus', scheduleRefresh);
    window.addEventListener('storage', scheduleRefresh);
    setInterval(scheduleRefresh, 3000);
    scheduleRefresh();
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
