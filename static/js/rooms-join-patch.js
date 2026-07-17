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