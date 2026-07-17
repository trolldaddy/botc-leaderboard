(() => {
  const TAB_KEY = 'botc_town_checkin_active_tab';
  const DEVICE_TOKEN_KEY = 'botc_town_checkin_device_token';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const getSavedTab = () => localStorage.getItem(TAB_KEY) || 'player';

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

    // 玩家頁保留玩家列表，但避免管理操作吃版面；說書人頁才顯示這些控制。
    const playerTab = nextTab === 'player';
    $$('.room-members-card .card-header button, .room-members-card .footer-actions').forEach((el) => {
      el.style.display = playerTab ? 'none' : '';
    });
  };

  const install = () => {
    installDeviceTokenFetchPatch();

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
        <i class="fa-solid fa-user-tie"></i>
        <span>說書人</span>
      </button>
    `;
    header.insertAdjacentElement('afterend', tabs);

    $$('.player-profile-card, .join-room-card, .room-members-card').forEach((el) => el.classList.add('town-tab-player'));
    $$('.storyteller-room-card').forEach((el) => el.classList.add('town-tab-storyteller'));

    $$('.town-mode-tab').forEach((button) => {
      button.addEventListener('click', () => setActiveTab(button.dataset.townTabTarget));
    });

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
