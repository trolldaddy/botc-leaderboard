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