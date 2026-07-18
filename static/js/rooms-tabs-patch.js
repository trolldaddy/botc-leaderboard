(() => {
  const TAB_KEY = 'botc_town_checkin_active_tab';
  const DEVICE_TOKEN_KEY = 'botc_town_checkin_device_token';
  const ROOM_KEY = 'botc_town_checkin_room';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  let currentUser = null;
  let userLoaded = false;

  const getSavedTab = () => localStorage.getItem(TAB_KEY) || 'player';

  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(ROOM_KEY) || 'null'); }
    catch (err) { return null; }
  };

  const fetchCurrentUser = async () => {
    if (userLoaded) return currentUser;
    userLoaded = true;
    try {
      const resp = await fetch('/api/me', { credentials: 'same-origin' });
      const data = await resp.json();
      currentUser = data?.user || null;
    } catch (err) {
      currentUser = null;
    }
    return currentUser;
  };

  const isRoomOwner = () => {
    const room = readRoom();
    const user = currentUser;
    if (!room || !user) return false;

    const userIds = [
      user.id,
      user.account_id,
      user.storyteller_account_id,
      user.line_user_id,
    ].filter((value) => value !== undefined && value !== null).map(String);

    const ownerIds = [
      room.created_by_id,
      room.created_by_account_id,
      room.created_by_line_user_id,
    ].filter((value) => value !== undefined && value !== null).map(String);

    return ownerIds.some((ownerId) => userIds.includes(ownerId));
  };

  const shouldShowManagementControls = (activeTab) => {
    if (activeTab === 'storyteller') return true;
    return isRoomOwner();
  };

  const updateManagementVisibility = (activeTab) => {
    const showControls = shouldShowManagementControls(activeTab);
    $$('.room-members-card .card-header button, .room-members-card .footer-actions').forEach((el) => {
      el.style.display = showControls ? '' : 'none';
    });
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
            init = {
              ...init,
              headers,
              body: JSON.stringify(payload),
            };
          }
        }
      } catch (err) {
        console.warn('裝置識別碼加入失敗，將照原流程送出', err);
      }
      return originalFetch(input, init);
    };
    window.__botcRoomDeviceFetchPatched = true;
  };

  const loadSelfSeatPatch = () => {
    if (window.__botcSelfSeatPatchLoading || document.querySelector('script[data-botc-self-seat="1"]')) return;
    window.__botcSelfSeatPatchLoading = true;
    const script = document.createElement('script');
    script.src = `/js/rooms-self-seat-patch.js?v=${Date.now()}`;
    script.dataset.botcSelfSeat = '1';
    script.onload = () => { window.__botcSelfSeatPatchLoading = false; };
    script.onerror = () => {
      window.__botcSelfSeatPatchLoading = false;
      console.warn('玩家自選座號功能載入失敗');
    };
    document.head.appendChild(script);
  };

  const setActiveTab = (tab) => {
    const nextTab = tab === 'storyteller' ? 'storyteller' : 'player';
    localStorage.setItem(TAB_KEY, nextTab);

    $$('.town-mode-tab').forEach((button) => {
      const active = button.dataset.townTabTarget === nextTab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    $$('.town-tab-player').forEach((el) => {
      el.style.display = nextTab === 'player' ? '' : 'none';
    });
    $$('.town-tab-storyteller').forEach((el) => {
      el.style.display = nextTab === 'storyteller' ? '' : 'none';
    });

    // 玩家分頁保留玩家列表。若使用者是房主，仍顯示管理操作；一般玩家則隱藏。
    updateManagementVisibility(nextTab);
    fetchCurrentUser().then(() => updateManagementVisibility(nextTab));
  };

  const install = () => {
    installDeviceTokenFetchPatch();
    loadSelfSeatPatch();

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
        <i class="fa-solid fa-user"></i>
        <span>玩家</span>
      </button>
      <button class="town-mode-tab" type="button" role="tab" data-town-tab-target="storyteller">
        <i class="fa-solid fa-user-gear"></i>
        <span>房主管理</span>
      </button>
    `;
    header.insertAdjacentElement('afterend', tabs);

    $$('.player-profile-card, .join-room-card, .room-members-card').forEach((el) => el.classList.add('town-tab-player'));
    $$('.storyteller-room-card').forEach((el) => el.classList.add('town-tab-storyteller'));

    $$('.town-mode-tab').forEach((button) => {
      button.addEventListener('click', () => setActiveTab(button.dataset.townTabTarget));
    });

    window.addEventListener('storage', () => updateManagementVisibility(getSavedTab()));
    setInterval(() => updateManagementVisibility(getSavedTab()), 1500);

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
