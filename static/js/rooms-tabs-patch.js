(() => {
  const TAB_KEY = 'botc_town_checkin_active_tab';
  const DEVICE_TOKEN_KEY = 'botc_town_checkin_device_token';
  const ROOM_KEY = 'botc_town_checkin_room';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  let permissionFetchInFlight = null;

  const getSavedTab = () => localStorage.getItem(TAB_KEY) || 'player';

  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(ROOM_KEY) || 'null'); }
    catch (err) { return null; }
  };

  const writeRoom = (room) => {
    if (room) localStorage.setItem(ROOM_KEY, JSON.stringify(room));
  };

  const fetchRoomPermissions = async () => {
    if (permissionFetchInFlight) return permissionFetchInFlight;
    const room = readRoom();
    const code = String(room?.room_code || '').trim().toUpperCase();
    if (!code) return null;

    permissionFetchInFlight = (async () => {
      try {
        const resp = await fetch(`/api/rooms/${encodeURIComponent(code)}/permissions`, {
          credentials: 'same-origin', cache: 'no-store'
        });
        if (!resp.ok) return null;
        const permissions = await resp.json();
        const latestRoom = readRoom() || room;
        latestRoom.is_owner = Boolean(permissions.is_owner);
        latestRoom.can_manage_players = Boolean(permissions.can_manage_players);
        latestRoom.can_manage_room = Boolean(permissions.can_manage_room);
        writeRoom(latestRoom);
        return permissions;
      } catch (err) {
        console.warn('房間權限讀取失敗', err);
        return null;
      } finally {
        permissionFetchInFlight = null;
      }
    })();

    return permissionFetchInFlight;
  };

  const isRoomOwner = () => Boolean(readRoom()?.is_owner);
  const updateManagementVisibility = () => {
    const showControls = isRoomOwner();
    $$('.room-members-card .card-header button, .room-members-card .footer-actions').forEach((el) => {
      el.style.display = showControls ? '' : 'none';
    });
  };

  const refreshManagementPermissions = async () => {
    await fetchRoomPermissions();
    updateManagementVisibility();
  };

  const getDeviceToken = () => {
    try {
      let token = localStorage.getItem(DEVICE_TOKEN_KEY);
      if (!token) {
        const randomPart = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        token = `device_${randomPart}`;
        localStorage.setItem(DEVICE_TOKEN_KEY, token);
      }
      return token;
    } catch (err) {
      return `volatile_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  };

  const installDeviceTokenFetchPatch = () => {
    if (window.__botcRoomDeviceFetchPatched) return;
    const originalFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        const method = String(init?.method || 'GET').toUpperCase();
        const isRoomJoin = method === 'POST' && /\/api\/rooms\/[^/]+\/join(?:\?|$)/.test(url);
        if (isRoomJoin) {
          const headers = new Headers(init.headers || {});
          const contentType = headers.get('Content-Type') || headers.get('content-type') || '';
          if (contentType.includes('application/json') && typeof init.body === 'string') {
            const payload = JSON.parse(init.body || '{}');
            payload.device_token = payload.device_token || getDeviceToken();
            init = { ...init, headers, body: JSON.stringify(payload) };
          }
        }
      } catch (err) {
        console.warn('裝置識別碼加入失敗，將照原流程送出', err);
      }
      return originalFetch(input, init);
    };
    window.__botcRoomDeviceFetchPatched = true;
  };

  const loadPatch = (src, dataKey, warning) => {
    if (document.querySelector(`script[data-${dataKey}="1"]`)) return;
    const script = document.createElement('script');
    script.src = `${src}?v=${Date.now()}`;
    script.setAttribute(`data-${dataKey}`, '1');
    script.onerror = () => console.warn(warning);
    document.head.appendChild(script);
  };

  const loadRuntimePatches = () => {
    loadPatch('/js/rooms-self-seat-patch.js', 'botc-self-seat', '玩家自選座號功能載入失敗');
    loadPatch('/js/rooms-critical-fixes-patch.js', 'botc-critical-fixes', '房間核心修正載入失敗');
    loadPatch('/js/rooms-checkin-wizard.js', 'botc-checkin-wizard', 'QR 報到精靈載入失敗');
    loadPatch('/js/rooms-mobile-layout-patch.js', 'botc-mobile-layout', '手機房間版面載入失敗');
  };

  const setActiveTab = (tab) => {
    const nextTab = tab === 'storyteller' ? 'storyteller' : 'player';
    localStorage.setItem(TAB_KEY, nextTab);
    $$('.town-mode-tab').forEach((button) => {
      const active = button.dataset.townTabTarget === nextTab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $$('.town-tab-player').forEach((el) => { el.style.display = nextTab === 'player' ? '' : 'none'; });
    $$('.town-tab-storyteller').forEach((el) => { el.style.display = nextTab === 'storyteller' ? '' : 'none'; });
    updateManagementVisibility();
    refreshManagementPermissions();
  };

  const install = () => {
    installDeviceTokenFetchPatch();
    loadRuntimePatches();
    const root = $('.town-layout-v2');
    const header = $('.top-header');
    if (!root || !header) return false;
    if ($('#town-mode-tabs')) {
      setActiveTab(getSavedTab());
      return true;
    }

    const tabs = document.createElement('div');
    tabs.id = 'town-mode-tabs';
    tabs.className = 'town-mode-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.innerHTML = `
      <button class="town-mode-tab" type="button" role="tab" data-town-tab-target="player">
        <i class="fa-solid fa-user"></i><span>玩家</span>
      </button>
      <button class="town-mode-tab" type="button" role="tab" data-town-tab-target="storyteller">
        <i class="fa-solid fa-door-open"></i><span>房間資訊</span>
      </button>`;
    header.insertAdjacentElement('afterend', tabs);
    $$('.player-profile-card, .join-room-card').forEach((el) => el.classList.add('town-tab-player'));
    $$('.storyteller-room-card, .room-members-card').forEach((el) => el.classList.add('town-tab-storyteller'));
    const storytellerCard = $('.storyteller-room-card');
    const membersCard = $('.room-members-card');
    if (
      storytellerCard &&
      membersCard &&
      storytellerCard.parentElement === membersCard.parentElement &&
      storytellerCard.nextElementSibling !== membersCard
    ) {
      storytellerCard.insertAdjacentElement('afterend', membersCard);
    }
    $$('.town-mode-tab').forEach((button) => button.addEventListener('click', () => setActiveTab(button.dataset.townTabTarget)));
    window.addEventListener('storage', refreshManagementPermissions);
    window.addEventListener('focus', refreshManagementPermissions);
    setInterval(refreshManagementPermissions, 3000);
    setActiveTab(getSavedTab());
    return true;
  };

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (install() || tries > 30) clearInterval(timer);
    }, 100);
  }
})();