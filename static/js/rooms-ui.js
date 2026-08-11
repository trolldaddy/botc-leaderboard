/* Town Check-in: tabs, QR/join flows, check-in wizard, and responsive UI. */

/* Consolidated from static/js/rooms-tabs-patch.js. */
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
    installDeviceTokenFetchPatch();    const root = $('.town-layout-v2');
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

/* Consolidated from static/js/rooms-qr-patch.js. */
(() => {
  const BRANCH_ALIAS_HOST = 'botc-leaderboard-git-feature-town-checkin-trolldaddys-projects.vercel.app';
  const getCanonicalOrigin = () => {
    const { protocol, hostname, origin } = window.location;

    // Vercel single deployment URLs look like:
    // botc-leaderboard-bh6p0v5h8-trolldaddys-projects.vercel.app
    // They change every deploy, so convert them to the stable branch alias while testing.
    if (/^botc-leaderboard-[a-z0-9]+-trolldaddys-projects\.vercel\.app$/i.test(hostname)) {
      return `${protocol}//${BRANCH_ALIAS_HOST}`;
    }

    return origin;
  };

  const buildCleanJoinUrl = (roomCode) => {
    const code = String(roomCode || '').trim().toUpperCase();
    if (!code || code === '---') return '';
    return `${getCanonicalOrigin()}/?join=${encodeURIComponent(code)}#rooms`;
  };

  const redrawQr = () => {
    const codeEl = document.getElementById('room-code-display');
    const urlEl = document.getElementById('room-join-url');
    const qrBox = document.getElementById('room-qr');
    if (!codeEl || !urlEl || !qrBox) return;

    const code = codeEl.textContent.trim();
    const cleanUrl = buildCleanJoinUrl(code);
    if (!cleanUrl) return;

    if (urlEl.textContent === cleanUrl && qrBox.dataset.cleanQrUrl === cleanUrl) return;

    urlEl.textContent = cleanUrl;
    qrBox.dataset.cleanQrUrl = cleanUrl;
    qrBox.innerHTML = '';

    if (window.QRCode) {
      new QRCode(qrBox, {
        text: cleanUrl,
        width: 180,
        height: 180,
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      qrBox.textContent = cleanUrl;
    }
  };

  const install = () => {
    const codeEl = document.getElementById('room-code-display');
    const qrBox = document.getElementById('room-qr');
    if (!codeEl || !qrBox) return false;

    redrawQr();
    const observer = new MutationObserver(() => setTimeout(redrawQr, 0));
    observer.observe(codeEl, { childList: true, characterData: true, subtree: true });
    observer.observe(qrBox, { childList: true, subtree: true });

    window.TownCheckinQrPatch = { redraw: redrawQr, buildCleanJoinUrl };
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


/* Consolidated from static/js/rooms-join-patch.js. */
(() => {
  const STORAGE_KEY = 'botc_town_checkin_room';
  const COMMUNITY_INVITE_URL = 'https://line.me/ti/g2/g2hnZGPTRX-R9yVux58sU6VFp8EybNJA_ej5xg?utm_source=invitation&utm_medium=link_copy&utm_campaign=default';
  const OFFICIAL_ACCOUNT_URL = 'https://line.me/R/ti/p/@210huawo';
  const apiBase = () => window.API_BASE || '';
  const $ = (id) => document.getElementById(id);
  let joinInFlight = false;

  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (err) { return null; }
  };

  const writeRoom = (room) => {
    if (room) localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
  };

  const getCode = () => {
    const params = new URLSearchParams(window.location.search);
    return String($('room-code-input')?.value || params.get('join') || readRoom()?.room_code || '').trim().toUpperCase();
  };

  const getDisplayName = () => String($('join-display-name')?.value || '').trim();

  const normalizeStatus = (value) => String(value || 'open').trim().toLowerCase();

  const buildJoinUrl = (code) => {
    const origin = window.location.origin;
    return `${origin}/?join=${encodeURIComponent(code)}#rooms`;
  };

  const showStatus = (message, isError = false) => {
    const el = $('town-status');
    if (el) {
      el.textContent = message;
      el.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
    }
    if (isError) alert(message);
  };

  const findJoinButtons = () => Array.from(document.querySelectorAll('button')).filter((button) => {
    const text = String(button.textContent || '');
    return text.includes('使用目前暱稱加入') || text.includes('加入');
  });

  const setJoinButtonsBusy = (busy) => {
    findJoinButtons().forEach((button) => {
      if (busy) {
        button.dataset.prevDisabled = String(button.disabled ? '1' : '0');
        button.disabled = true;
      } else if (button.dataset.prevDisabled !== '1') {
        button.disabled = false;
      }
    });
  };

  const hasSameNameInRoom = (room, displayName) => {
    const target = String(displayName || '').trim().toLowerCase();
    if (!target || !Array.isArray(room?.players)) return false;
    return room.players.some((player) => String(player?.display_name || player?.name || '').trim().toLowerCase() === target);
  };

  const ensureInviteStyles = () => {
    if ($('line-invite-card-style')) return;
    const style = document.createElement('style');
    style.id = 'line-invite-card-style';
    style.textContent = `
      .line-community-invite-card-shell {
        margin-top: 1.15rem;
        border: 1px solid rgba(124, 255, 138, .28);
        background:
          radial-gradient(circle at top left, rgba(0, 185, 0, .18), transparent 34%),
          linear-gradient(135deg, rgba(255,255,255,.075), rgba(255,255,255,.035));
        border-radius: 22px;
        padding: 1.25rem;
        box-shadow: 0 18px 42px rgba(0,0,0,.22);
      }
      .line-community-invite-card-header {
        display: flex;
        gap: .95rem;
        align-items: flex-start;
        flex-wrap: wrap;
      }
      .line-community-invite-card-icon {
        width: 56px;
        height: 56px;
        border-radius: 18px;
        background: rgba(0, 185, 0, .2);
        border: 1px solid rgba(124, 255, 138, .22);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #7CFF8A;
        font-size: 1.8rem;
        flex-shrink: 0;
      }
      .line-community-invite-card-title {
        font-size: 1.12rem;
        font-weight: 950;
        color: #fff;
        margin-bottom: .35rem;
        letter-spacing: .03em;
      }
      .line-community-invite-card-subtitle {
        color: var(--text-muted);
        font-size: .93rem;
        line-height: 1.65;
      }
      .line-community-invite-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: .85rem;
        margin-top: 1.1rem;
      }
      .line-community-invite-action {
        min-height: 86px;
        border-radius: 18px;
        padding: 1rem;
        border: 1px solid rgba(255,255,255,.13);
        display: flex;
        align-items: center;
        gap: .8rem;
        color: #fff;
        text-decoration: none;
        cursor: pointer;
        transition: transform .16s ease, border-color .16s ease, background .16s ease;
        box-sizing: border-box;
        width: 100%;
        font: inherit;
        text-align: left;
      }
      .line-community-invite-action:hover {
        transform: translateY(-1px);
        border-color: rgba(255,255,255,.26);
      }
      .line-community-invite-action i {
        font-size: 1.55rem;
        width: 34px;
        text-align: center;
        flex-shrink: 0;
      }
      .line-community-invite-action strong {
        display: block;
        font-size: .98rem;
        line-height: 1.25;
      }
      .line-community-invite-action span {
        display: block;
        color: rgba(255,255,255,.72);
        font-size: .78rem;
        line-height: 1.35;
        margin-top: .18rem;
      }
      .line-community-invite-action.official {
        background: linear-gradient(135deg, rgba(0, 185, 0, .34), rgba(0, 120, 0, .18));
      }
      .line-community-invite-action.community {
        background: linear-gradient(135deg, rgba(124, 58, 237, .34), rgba(255, 183, 3, .12));
      }
      .line-community-invite-action.share {
        background: rgba(255,255,255,.07);
      }
      @media (max-width: 820px) {
        .line-community-invite-actions { grid-template-columns: 1fr; }
        .line-community-invite-action { min-height: 74px; }
      }
    `;
    document.head.appendChild(style);
  };

  const ensureInviteCard = (room) => {
    const summary = $('active-room-summary');
    if (!summary || !room?.room_code) return;
    ensureInviteStyles();

    let card = $('line-community-invite-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'line-community-invite-card';
      card.className = 'line-community-invite-card';
      summary.insertAdjacentElement('afterend', card);
    }

    const joinUrl = buildJoinUrl(room.room_code);
    card.innerHTML = `
      <div class="line-community-invite-card-shell">
        <div class="line-community-invite-card-header">
          <div class="line-community-invite-card-icon">
            <i class="fa-brands fa-line"></i>
          </div>
          <div style="flex:1;min-width:220px;">
            <div class="line-community-invite-card-title">報到完成！加入拉普拉斯血染情報網</div>
            <div class="line-community-invite-card-subtitle">想收到開團通知、臨時缺人、活動消息，或把這場房間分享給朋友，可以從這裡繼續。</div>
          </div>
        </div>
        <div class="line-community-invite-actions">
          <a class="line-community-invite-action official" href="${OFFICIAL_ACCOUNT_URL}" target="_blank" rel="noopener">
            <i class="fa-brands fa-line"></i>
            <div><strong>加入官方帳號</strong><span>接收開團通知與活動消息</span></div>
          </a>
          <a class="line-community-invite-action community" href="${COMMUNITY_INVITE_URL}" target="_blank" rel="noopener">
            <i class="fa-solid fa-comments"></i>
            <div><strong>加入血染聊天室</strong><span>找團、閒聊、揪朋友入鎮</span></div>
          </a>
          <button id="share-room-button" class="line-community-invite-action share" type="button">
            <i class="fa-solid fa-share-nodes"></i>
            <div><strong>分享這場房間</strong><span>把報到連結傳給朋友</span></div>
          </button>
        </div>
      </div>
    `;

    const shareButton = $('share-room-button');
    if (shareButton && !shareButton.dataset.bound) {
      shareButton.dataset.bound = '1';
      shareButton.addEventListener('click', async () => {
        const text = `我正在拉普拉斯加入血染鐘樓房間 ${room.room_code}，一起報到吧：${joinUrl}`;
        try {
          if (navigator.share) {
            await navigator.share({ title: '拉普拉斯血染鐘樓小鎮報到', text, url: joinUrl });
          } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            alert('已複製房間邀請連結');
          } else {
            prompt('請複製房間邀請連結', text);
          }
        } catch (err) {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            alert('已複製房間邀請連結');
          }
        }
      });
    }
  };

  const normalizeRoom = (room) => ({
    id: room?.id || null,
    room_code: room?.room_code || room?.code || getCode(),
    title: room?.title || '小鎮報到',
    script: room?.script || '',
    date: room?.date || new Date().toISOString().split('T')[0],
    location: room?.location || '拉普拉斯',
    storyteller: room?.storyteller || '',
    status: room?.status || 'open',
    created_by_id: room?.created_by_id || null,
    created_by_line_user_id: room?.created_by_line_user_id || null,
    created_by_display_name: room?.created_by_display_name || null,
    players: Array.isArray(room?.players) ? room.players : []
  });

  const fetchRoomBeforeJoin = async (code) => {
    const resp = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}`, { credentials: 'same-origin' });
    let data = null;
    try { data = await resp.json(); } catch (err) {}
    if (!resp.ok) {
      throw new Error(data?.detail || `讀取房間失敗（HTTP ${resp.status}）`);
    }
    const room = normalizeRoom(data);
    writeRoom(room);
    if (normalizeStatus(room.status) !== 'open') {
      throw new Error('房間已鎖定，無法加入');
    }
    return room;
  };

  const joinRoomStrict = async () => {
    if (joinInFlight) return showStatus('正在加入房間，請稍候。');

    const code = getCode();
    const displayName = getDisplayName();
    if (!code) return showStatus('缺少房間代碼。', true);
    if (!displayName) return showStatus('請先輸入你的店內暱稱。', true);

    if ($('room-code-input')) $('room-code-input').value = code;

    joinInFlight = true;
    setJoinButtonsBusy(true);

    try {
      const beforeRoom = await fetchRoomBeforeJoin(code);
      if (hasSameNameInRoom(beforeRoom, displayName)) {
        showStatus(`你已經用「${displayName}」加入房間 ${beforeRoom.room_code}`);
        ensureInviteCard(beforeRoom);
        if (window.TownCheckinUI?.renderRoomSummary) window.TownCheckinUI.renderRoomSummary();
        return;
      }

      const resp = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName })
      });

      let data = null;
      try { data = await resp.json(); } catch (err) {}

      if (!resp.ok) {
        const detail = data?.detail || `加入房間失敗（HTTP ${resp.status}）`;
        showStatus(detail, true);
        return;
      }

      const room = normalizeRoom(data?.room);
      writeRoom(room);
      showStatus(`已加入房間 ${room.room_code}｜目前 ${room.players.length} 位玩家`);
      setTimeout(() => ensureInviteCard(room), 120);

      if (window.TownCheckin?.loadRoomFromInput) await window.TownCheckin.loadRoomFromInput();
      if (window.TownCheckinUI?.renderRoomSummary) window.TownCheckinUI.renderRoomSummary();
      setTimeout(() => ensureInviteCard(readRoom() || room), 250);
      if (window.TownCheckinRoomSync?.syncNow) setTimeout(() => window.TownCheckinRoomSync.syncNow(), 200);
    } catch (err) {
      showStatus(err?.message || `加入房間時發生錯誤：${err}`, true);
    } finally {
      joinInFlight = false;
      setJoinButtonsBusy(false);
    }
  };

  const install = () => {
    if (!window.TownCheckin || window.TownCheckin.__joinStrictPatched) return false;
    window.TownCheckin.joinRoom = joinRoomStrict;
    window.TownCheckin.__joinStrictPatched = true;
    const room = readRoom();
    if (room?.room_code) setTimeout(() => ensureInviteCard(room), 300);
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

/* Consolidated from static/js/rooms-checkin-wizard.js. */
(() => {
  const ROOM_KEY = 'botc_town_checkin_room';
  const DEVICE_TOKEN_KEY = 'botc_town_checkin_device_token';
  const apiBase = () => window.API_BASE || '';
  let room = null;
  let account = null;
  let currentPlayer = null;
  let busy = false;

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const getCode = () => String(new URLSearchParams(window.location.search).get('join') || '').trim().toUpperCase();
  const getDeviceToken = () => localStorage.getItem(DEVICE_TOKEN_KEY) || '';
  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(ROOM_KEY) || 'null'); }
    catch (err) { return null; }
  };

  const ensureStyles = () => {
    if (document.getElementById('checkin-wizard-style')) return;
    const style = document.createElement('style');
    style.id = 'checkin-wizard-style';
    style.textContent = `
      body.checkin-wizard-open { overflow:hidden; }
      .checkin-wizard-backdrop { position:fixed; inset:0; z-index:10050; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(5,3,12,.84); backdrop-filter:blur(13px); }
      .checkin-wizard-card { width:min(100%,560px); max-height:min(92vh,780px); overflow:auto; border:1px solid rgba(255,255,255,.14); border-radius:26px; background:linear-gradient(155deg,rgba(32,24,54,.99),rgba(13,10,24,.99)); box-shadow:0 30px 90px rgba(0,0,0,.58); color:#fff; }
      .checkin-wizard-hero { padding:25px 25px 20px; background:radial-gradient(circle at 12% 0,rgba(124,58,237,.33),transparent 43%),radial-gradient(circle at 92% 20%,rgba(255,183,3,.16),transparent 35%); border-bottom:1px solid rgba(255,255,255,.08); }
      .checkin-wizard-kicker { color:#ffd36b; font-size:.74rem; font-weight:950; letter-spacing:.16em; text-transform:uppercase; }
      .checkin-wizard-title { margin:.45rem 0 .35rem; font-size:1.55rem; line-height:1.25; font-weight:950; }
      .checkin-wizard-subtitle { color:rgba(255,255,255,.68); font-size:.91rem; line-height:1.6; }
      .checkin-wizard-room { display:grid; grid-template-columns:1fr 1fr; gap:.55rem; margin-top:1.05rem; }
      .checkin-wizard-room-item { min-width:0; padding:.7rem .8rem; border:1px solid rgba(255,255,255,.08); border-radius:13px; background:rgba(255,255,255,.045); }
      .checkin-wizard-room-item span { display:block; color:rgba(255,255,255,.5); font-size:.7rem; margin-bottom:.18rem; }
      .checkin-wizard-room-item strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.9rem; }
      .checkin-wizard-body { padding:23px 25px 26px; }
      .checkin-step-label { color:rgba(255,255,255,.5); font-size:.72rem; font-weight:900; letter-spacing:.12em; margin-bottom:.65rem; }
      .checkin-choice-grid { display:grid; grid-template-columns:1fr 1fr; gap:.85rem; }
      .checkin-choice { border:1px solid rgba(255,255,255,.12); border-radius:19px; padding:1rem; background:rgba(255,255,255,.045); color:#fff; text-align:left; cursor:pointer; font:inherit; transition:.16s ease; }
      .checkin-choice:hover { transform:translateY(-1px); border-color:rgba(255,255,255,.28); }
      .checkin-choice.line { background:linear-gradient(145deg,rgba(0,185,0,.24),rgba(0,100,0,.08)); }
      .checkin-choice.temp { background:linear-gradient(145deg,rgba(255,183,3,.18),rgba(255,255,255,.035)); }
      .checkin-choice-icon { width:46px; height:46px; display:flex; align-items:center; justify-content:center; border-radius:14px; background:rgba(255,255,255,.1); font-size:1.35rem; margin-bottom:.8rem; }
      .checkin-choice strong { display:block; font-size:1rem; margin-bottom:.38rem; }
      .checkin-choice small { display:block; color:rgba(255,255,255,.62); line-height:1.5; }
      .checkin-field { margin-top:.9rem; }
      .checkin-field label { display:block; color:#ffd36b; font-size:.76rem; font-weight:900; margin-bottom:.42rem; }
      .checkin-field input { width:100%; box-sizing:border-box; border:1px solid rgba(255,255,255,.14); border-radius:14px; background:rgba(0,0,0,.28); color:#fff; padding:.95rem 1rem; font:inherit; font-size:1rem; outline:none; }
      .checkin-field input:focus { border-color:rgba(167,139,250,.9); box-shadow:0 0 0 3px rgba(124,58,237,.15); }
      .checkin-actions { display:flex; gap:.7rem; margin-top:1rem; flex-wrap:wrap; }
      .checkin-action { flex:1; min-width:150px; min-height:50px; border:0; border-radius:14px; padding:.8rem 1rem; color:#fff; font:inherit; font-weight:950; cursor:pointer; }
      .checkin-action.primary { background:linear-gradient(135deg,#7c3aed,#a78bfa); }
      .checkin-action.line { background:linear-gradient(135deg,#00b900,#087d08); }
      .checkin-action.secondary { border:1px solid rgba(255,255,255,.13); background:rgba(255,255,255,.06); color:rgba(255,255,255,.78); }
      .checkin-action:disabled { opacity:.5; cursor:wait; }
      .checkin-note { margin-top:.8rem; color:rgba(255,255,255,.56); font-size:.78rem; line-height:1.55; }
      .checkin-status { display:none; margin-top:.9rem; border-radius:13px; padding:.78rem .9rem; font-size:.84rem; line-height:1.45; }
      .checkin-status.show { display:block; }
      .checkin-status.error { color:#ffb4b4; background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.25); }
      .checkin-status.info { color:#ddd6fe; background:rgba(124,58,237,.12); border:1px solid rgba(167,139,250,.22); }
      .checkin-complete { text-align:center; padding:.4rem 0; }
      .checkin-complete-icon { width:72px; height:72px; margin:0 auto .9rem; display:flex; align-items:center; justify-content:center; border-radius:999px; color:#9cffaa; background:rgba(0,185,0,.14); border:1px solid rgba(124,255,138,.24); font-size:2rem; }
      .checkin-complete h3 { margin:.2rem 0 .45rem; font-size:1.3rem; }
      .checkin-player-pill { display:inline-flex; align-items:center; gap:.4rem; margin:.65rem 0; padding:.48rem .72rem; border-radius:999px; background:rgba(255,255,255,.07); color:#ffd36b; font-weight:900; }
      .checkin-upgrade-box { padding:1rem; border:1px solid rgba(124,255,138,.18); border-radius:16px; background:rgba(0,185,0,.08); margin-top:.85rem; text-align:left; }
      .checkin-wizard-close { width:100%; margin-top:.85rem; border:0; background:transparent; color:rgba(255,255,255,.5); padding:.55rem; cursor:pointer; font:inherit; }
      @media (max-width:600px) {
        .checkin-wizard-backdrop { align-items:flex-end; padding:0; }
        .checkin-wizard-card { width:100%; max-height:94vh; border-radius:25px 25px 0 0; }
        .checkin-wizard-hero,.checkin-wizard-body { padding-left:19px; padding-right:19px; }
        .checkin-choice-grid { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(style);
  };

  const shell = () => {
    let root = document.getElementById('checkin-wizard');
    if (root) return root;
    ensureStyles();
    root = document.createElement('div');
    root.id = 'checkin-wizard';
    root.className = 'checkin-wizard-backdrop';
    root.innerHTML = '<div class="checkin-wizard-card" role="dialog" aria-modal="true"><div id="checkin-wizard-content"></div></div>';
    document.body.appendChild(root);
    document.body.classList.add('checkin-wizard-open');
    return root;
  };

  const close = () => {
    document.getElementById('checkin-wizard')?.remove();
    document.body.classList.remove('checkin-wizard-open');
  };

  const roomHeader = () => `
    <div class="checkin-wizard-hero">
      <div class="checkin-wizard-kicker">TOWN CHECK-IN · ${escapeHtml(room?.room_code || getCode())}</div>
      <div class="checkin-wizard-title">歡迎來到這場血染鐘樓</div>
      <div class="checkin-wizard-subtitle">跟著指引完成報到，最後記得選擇你的座號。</div>
      <div class="checkin-wizard-room">
        <div class="checkin-wizard-room-item"><span>房間</span><strong>${escapeHtml(room?.title || '小鎮報到')}</strong></div>
        <div class="checkin-wizard-room-item"><span>劇本</span><strong>${escapeHtml(room?.script || '尚未公布')}</strong></div>
        <div class="checkin-wizard-room-item"><span>說書人</span><strong>${escapeHtml(room?.storyteller || '尚未填寫')}</strong></div>
        <div class="checkin-wizard-room-item"><span>目前人數</span><strong>${Number(room?.players?.length || 0)} 位玩家</strong></div>
      </div>
    </div>`;

  const setContent = (body) => {
    const root = shell();
    root.querySelector('#checkin-wizard-content').innerHTML = `${roomHeader()}<div class="checkin-wizard-body">${body}<div id="checkin-wizard-status" class="checkin-status"></div></div>`;
  };

  const status = (message, isError = false) => {
    const el = document.getElementById('checkin-wizard-status');
    if (!el) return;
    el.textContent = message;
    el.className = `checkin-status show ${isError ? 'error' : 'info'}`;
  };

  const setButtonsBusy = (value) => {
    busy = value;
    document.querySelectorAll('#checkin-wizard button').forEach((button) => { button.disabled = value; });
  };

  const findCurrentPlayer = () => {
    const players = Array.isArray(room?.players) ? room.players : [];
    const token = getDeviceToken();
    if (account?.id) {
      const byAccount = players.find((player) => Number(player.account_id) === Number(account.id));
      if (byAccount) return byAccount;
    }
    if (token) return players.find((player) => player.device_token && player.device_token === token) || null;
    return null;
  };

  const fetchContext = async () => {
    const code = getCode();
    if (!code) return false;
    const [roomResp, meResp] = await Promise.all([
      fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}`, { credentials: 'same-origin' }),
      fetch(`${apiBase()}/api/me`, { credentials: 'same-origin' }).catch(() => null),
    ]);
    if (!roomResp.ok) throw new Error('找不到房間，請向說書人確認 QR Code 是否仍有效。');
    room = await roomResp.json();
    localStorage.setItem(ROOM_KEY, JSON.stringify(room));
    try {
      const me = meResp?.ok ? await meResp.json() : null;
      account = me?.logged_in ? me.user : null;
    } catch (err) { account = null; }
    currentPlayer = findCurrentPlayer();
    return true;
  };

  const syncPageFields = (name) => {
    const codeInput = document.getElementById('room-code-input');
    const nameInput = document.getElementById('join-display-name');
    if (codeInput) codeInput.value = room?.room_code || getCode();
    if (nameInput && name) nameInput.value = name;
  };

  const join = async (name) => {
    if (busy) return;
    const displayName = String(name || '').trim();
    if (!displayName) return status('請先輸入你在店內使用的暱稱。', true);
    syncPageFields(displayName);
    setButtonsBusy(true);
    status(account ? '正在以 LINE 玩家身分加入房間…' : '正在建立臨時玩家資料…');
    try {
      if (!window.TownCheckin?.joinRoom) throw new Error('報到功能尚未載入，請稍候後再試。');
      await window.TownCheckin.joinRoom();
      await fetchContext();
      currentPlayer = findCurrentPlayer();
      if (!currentPlayer) throw new Error('尚未確認加入成功，請再按一次加入房間。');
      renderComplete();
      if (window.TownCheckinRoomSync?.syncNow) window.TownCheckinRoomSync.syncNow();
    } catch (err) {
      status(err?.message || '加入房間失敗，請稍後再試。', true);
    } finally {
      setButtonsBusy(false);
    }
  };

  const lineLogin = () => {
    syncPageFields(document.getElementById('checkin-name')?.value || currentPlayer?.display_name || account?.display_name || '');
    if (window.TownCheckinUI?.lineLoginWithCode) {
      window.TownCheckinUI.lineLoginWithCode();
    } else {
      status('LINE 登入功能尚未載入，請稍候後再試。', true);
    }
  };

  const renderChoice = () => {
    const suggestedName = account?.display_name || '';
    setContent(`
      <div class="checkin-step-label">步驟 1 / 3 · 選擇報到方式</div>
      <div class="checkin-choice-grid">
        <button id="checkin-line-choice" class="checkin-choice line" type="button">
          <div class="checkin-choice-icon"><i class="fa-brands fa-line"></i></div>
          <strong>${account ? '以 LINE 玩家加入' : '使用 LINE 登入'}</strong>
          <small>保留戰績與玩家資料，下次不必重新建立身分。</small>
        </button>
        <button id="checkin-temp-choice" class="checkin-choice temp" type="button">
          <div class="checkin-choice-icon"><i class="fa-solid fa-user-clock"></i></div>
          <strong>以臨時玩家加入</strong>
          <small>不用登入，輸入今天使用的暱稱即可快速報到。</small>
        </button>
      </div>
      <div class="checkin-note">LINE 登入本身不等於完成報到。登入回來後，精靈會繼續帶你完成「加入房間」。</div>
      <button id="checkin-close" class="checkin-wizard-close" type="button">先關閉，查看完整頁面</button>
    `);
    document.getElementById('checkin-line-choice').onclick = () => account ? renderLineJoin(suggestedName) : lineLogin();
    document.getElementById('checkin-temp-choice').onclick = renderTemporaryJoin;
    document.getElementById('checkin-close').onclick = close;
  };

  const renderLineJoin = (suggestedName = '') => {
    setContent(`
      <div class="checkin-step-label">步驟 2 / 3 · 確認 LINE 玩家資料</div>
      <div class="checkin-field">
        <label>今天在店內顯示的暱稱</label>
        <input id="checkin-name" maxlength="40" autocomplete="nickname" value="${escapeHtml(suggestedName || account?.display_name || '')}" placeholder="例如：廚爹、阿陳、棋宣">
      </div>
      <div class="checkin-actions">
        <button id="checkin-line-join" class="checkin-action line" type="button"><i class="fa-brands fa-line"></i> 加入房間</button>
        <button id="checkin-back" class="checkin-action secondary" type="button">返回</button>
      </div>
      <div class="checkin-note">將以 ${escapeHtml(account?.display_name || '你的 LINE 帳號')} 綁定這場玩家紀錄。</div>
    `);
    document.getElementById('checkin-line-join').onclick = () => join(document.getElementById('checkin-name').value);
    document.getElementById('checkin-back').onclick = renderChoice;
    setTimeout(() => document.getElementById('checkin-name')?.focus(), 50);
  };

  const renderTemporaryJoin = () => {
    setContent(`
      <div class="checkin-step-label">步驟 2 / 3 · 建立臨時玩家</div>
      <div class="checkin-field">
        <label>今天在店內顯示的暱稱</label>
        <input id="checkin-name" maxlength="40" autocomplete="nickname" placeholder="例如：小華、阿明">
      </div>
      <div class="checkin-actions">
        <button id="checkin-temp-join" class="checkin-action primary" type="button"><i class="fa-solid fa-right-to-bracket"></i> 加入房間</button>
        <button id="checkin-back" class="checkin-action secondary" type="button">返回</button>
      </div>
      <div class="checkin-note">之後在同一支手機登入 LINE，可以保留座號並把這筆資料升級成正式玩家。</div>
    `);
    const input = document.getElementById('checkin-name');
    document.getElementById('checkin-temp-join').onclick = () => join(input.value);
    document.getElementById('checkin-back').onclick = renderChoice;
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') join(input.value); });
    setTimeout(() => input.focus(), 50);
  };

  const renderTemporaryUpgrade = () => {
    setContent(`
      <div class="checkin-complete">
        <div class="checkin-complete-icon"><i class="fa-solid fa-user-check"></i></div>
        <h3>你已經在房間裡了</h3>
        <div class="checkin-player-pill">${currentPlayer?.seat_number ? `${currentPlayer.seat_number} 號 · ` : ''}${escapeHtml(currentPlayer?.display_name || '臨時玩家')}</div>
        <p class="checkin-wizard-subtitle">目前是臨時玩家。你可以直接繼續遊戲，或登入 LINE 保留未來戰績。</p>
      </div>
      <div class="checkin-upgrade-box">
        <strong><i class="fa-brands fa-line"></i> 升級為 LINE 玩家</strong>
        <div class="checkin-note">會保留目前的房間、暱稱與座號，不會新增第二個玩家。</div>
      </div>
      <div class="checkin-actions">
        <button id="checkin-upgrade" class="checkin-action line" type="button">登入 LINE 並綁定</button>
        <button id="checkin-finish" class="checkin-action secondary" type="button">稍後再說</button>
      </div>
    `);
    document.getElementById('checkin-upgrade').onclick = lineLogin;
    document.getElementById('checkin-finish').onclick = close;
  };

  const renderComplete = () => {
    const isLine = Boolean(currentPlayer?.account_id || (!currentPlayer?.is_temporary && account));
    setContent(`
      <div class="checkin-complete">
        <div class="checkin-complete-icon"><i class="fa-solid fa-check"></i></div>
        <div class="checkin-step-label">步驟 3 / 3 · 報到完成</div>
        <h3>已成功加入房間</h3>
        <div class="checkin-player-pill">${currentPlayer?.seat_number ? `${currentPlayer.seat_number} 號 · ` : ''}${escapeHtml(currentPlayer?.display_name || account?.display_name || '玩家')}</div>
        <p class="checkin-wizard-subtitle">身分：${isLine ? 'LINE 玩家' : '臨時玩家'}。接下來請在玩家名單中選擇你的座號。</p>
      </div>
      <div class="checkin-actions">
        <button id="checkin-seat" class="checkin-action primary" type="button"><i class="fa-solid fa-chair"></i> 前往選擇座號</button>
      </div>
    `);
    document.getElementById('checkin-seat').onclick = () => {
      close();
      document.querySelector('.room-members-card')?.scrollIntoView({ behavior:'smooth', block:'start' });
      setTimeout(() => {
        const own = document.querySelector('#room-players-body select:not(:disabled)');
        own?.focus();
      }, 650);
    };
  };

  const start = async () => {
    if (!getCode()) return;
    try {
      shell();
      setContent('<div class="checkin-complete"><div class="checkin-complete-icon"><i class="fa-solid fa-spinner fa-spin"></i></div><h3>正在讀取房間</h3><p class="checkin-wizard-subtitle">請稍候，魔典正在確認你的報到狀態。</p></div>');
      await fetchContext();
      if (String(room?.status || 'open').toLowerCase() !== 'open' && !currentPlayer) {
        return setContent('<div class="checkin-complete"><div class="checkin-complete-icon"><i class="fa-solid fa-lock"></i></div><h3>房間已鎖定</h3><p class="checkin-wizard-subtitle">請向說書人確認是否重新開放報到。</p><button id="checkin-close" class="checkin-wizard-close" type="button">關閉</button></div>'), document.getElementById('checkin-close').onclick = close;
      }
      if (currentPlayer) {
        if (!currentPlayer.account_id && !account) renderTemporaryUpgrade();
        else if (!currentPlayer.account_id && account) renderLineJoin(currentPlayer.display_name || account.display_name || '');
        else renderComplete();
      } else if (account) {
        renderLineJoin(account.display_name || '');
      } else {
        renderChoice();
      }
    } catch (err) {
      setContent(`<div class="checkin-complete"><div class="checkin-complete-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h3>無法開始報到</h3><p class="checkin-wizard-subtitle">${escapeHtml(err?.message || '讀取房間失敗')}</p><button id="checkin-close" class="checkin-wizard-close" type="button">關閉</button></div>`);
      document.getElementById('checkin-close').onclick = close;
    }
  };

  window.TownCheckinWizard = { start, close, refresh: start };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 250));
  else setTimeout(start, 250);
})();

/* Consolidated from static/js/rooms-mobile-layout-patch.js. */
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

    const accountId = Number(me?.user?.id || 0);
    const lineUserId = me?.user?.line_user_id || '';
    return room.players.find((player) =>
      (accountId && Number(player.account_id) === accountId) ||
      (lineUserId && player.line_user_id === lineUserId) ||
      (token && player.device_token && player.device_token === token)
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



