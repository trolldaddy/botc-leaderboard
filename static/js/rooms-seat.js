/* Town Check-in: seat ownership, selection, and player-list presentation. */

/* Consolidated from static/js/rooms-self-seat-patch.js. */
(() => {
  const ROOM_KEY = 'botc_town_checkin_room';
  const DEVICE_TOKEN_KEY = 'botc_town_checkin_device_token';
  let installed = false;
  let observer = null;
  let scheduled = false;
  let context = null;

  const apiBase = () => window.API_BASE || '';
  const readRoom = () => {
    try { return JSON.parse(localStorage.getItem(ROOM_KEY) || 'null'); }
    catch (err) { return null; }
  };
  const writeRoom = (room) => {
    if (room) localStorage.setItem(ROOM_KEY, JSON.stringify(room));
  };
  const getDeviceToken = () => localStorage.getItem(DEVICE_TOKEN_KEY) || '';
  const getRoomCode = () => {
    const params = new URLSearchParams(window.location.search);
    return String(document.getElementById('room-code-input')?.value || params.get('join') || readRoom()?.room_code || '').trim().toUpperCase();
  };

  const fetchContext = async () => {
    const code = getRoomCode();
    if (!code) return null;
    const [roomResp, permissionResp, meResp] = await Promise.all([
      fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}`, { credentials: 'same-origin', cache: 'no-store' }),
      fetch(`${apiBase()}/api/rooms/${encodeURIComponent(code)}/permissions`, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null),
      fetch(`${apiBase()}/api/me`, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null),
    ]);
    if (!roomResp.ok) return null;
    const room = await roomResp.json();
    let permissions = { is_owner: false, can_manage_players: false, can_manage_room: false };
    try { if (permissionResp?.ok) permissions = await permissionResp.json(); } catch (err) {}
    let me = null;
    try { if (meResp?.ok) me = await meResp.json(); } catch (err) {}
    context = { room, permissions, account: me?.user || null, deviceToken: getDeviceToken() };
    writeRoom(room);
    return context;
  };

  const isRoomOwner = (ctx) => Boolean(ctx?.permissions?.is_owner || ctx?.permissions?.can_manage_players);

  const isOwnPlayer = (player, ctx) => {
    if (!player || !ctx) return false;
    if (ctx.account?.id && Number(player.account_id) === Number(ctx.account.id)) return true;
    return Boolean(ctx.deviceToken && player.device_token && player.device_token === ctx.deviceToken);
  };

  const findPlayer = (id, ctx) => (ctx?.room?.players || []).find((player) => String(player.id) === String(id));

  const decorateSeatSelectors = async () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody) return;
    const ctx = await fetchContext();
    if (!ctx) return;
    const owner = isRoomOwner(ctx);
    tbody.querySelectorAll('select[data-seat-selector="true"]').forEach((select) => {
      const player = findPlayer(select.dataset.playerId, ctx);
      const own = isOwnPlayer(player, ctx);
      select.disabled = !(owner || own);
      select.title = owner ? '房主可調整所有玩家座號' : own ? '選擇你目前坐的位置' : '你只能修改自己的座號';
      select.closest('td')?.classList.toggle('own-seat-cell', own);
    });
  };

  const scheduleDecorate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorateSeatSelectors().catch((err) => console.warn('座號權限更新失敗', err));
    });
  };

  const updateSeatDirect = async (id, value) => {
    const ctx = await fetchContext();
    const player = findPlayer(id, ctx);
    if (!ctx || !player) return alert('找不到房間玩家資料，請重新整理後再試。');
    if (!isRoomOwner(ctx) && !isOwnPlayer(player, ctx)) {
      alert('你只能修改自己的座號。');
      scheduleDecorate();
      return;
    }

    const seat = value ? Number.parseInt(value, 10) : null;
    const response = await fetch(`${apiBase()}/api/rooms/${encodeURIComponent(ctx.room.room_code)}/players/${encodeURIComponent(id)}/seat`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seat_number: seat, device_token: ctx.deviceToken }),
    });

    let data = null;
    try { data = await response.json(); } catch (err) {}
    if (!response.ok) {
      alert(data?.detail || '座號更新失敗');
      if (window.TownCheckin?.loadRoomFromInput) await window.TownCheckin.loadRoomFromInput();
      scheduleDecorate();
      return;
    }

    writeRoom(data.room);
    context = { ...ctx, room: data.room };
    if (window.TownCheckin?.loadRoomFromInput) await window.TownCheckin.loadRoomFromInput();
    if (window.TownCheckinSeatPatch?.refresh) window.TownCheckinSeatPatch.refresh();
    if (window.TownCheckinPermissions?.refresh) window.TownCheckinPermissions.refresh();
    scheduleDecorate();
  };

  const install = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody || !window.TownCheckin) return false;
    if (installed) return true;
    installed = true;
    window.TownCheckin.updateSeat = (id, value) => {
      return updateSeatDirect(id, value).catch((err) => {
        console.error(err);
        alert('座號更新時發生錯誤，請重新整理後再試。');
        throw err;
      });
    };
    observer = new MutationObserver(scheduleDecorate);
    observer.observe(tbody, { childList: true });
    window.addEventListener('focus', scheduleDecorate);
    window.TownCheckinSelfSeat = { refresh: scheduleDecorate };
    scheduleDecorate();
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


/* Consolidated from static/js/rooms-seat-select-patch.js. */
(() => {
  const MAX_SEAT = 20;
  let observer = null;
  let scheduled = false;
  let installed = false;

  const parseUpdateSeatCall = (value) => {
    const match = String(value || '').match(/TownCheckin\.updateSeat\('([^']+)'/);
    return match ? match[1] : null;
  };

  const collectUsedSeats = (tbody, currentSelect) => {
    const used = new Set();
    tbody.querySelectorAll('select[data-seat-selector="true"]').forEach((select) => {
      if (select === currentSelect) return;
      const value = Number(select.value || 0);
      if (value) used.add(value);
    });
    tbody.querySelectorAll('td:first-child input[type="number"]').forEach((input) => {
      const value = Number(input.value || 0);
      if (value) used.add(value);
    });
    return used;
  };

  const buildOptions = (select, currentValue, tbody) => {
    const used = collectUsedSeats(tbody, select);
    const desired = [];
    desired.push({ value: '', text: '未分配', disabled: false });
    for (let i = 1; i <= MAX_SEAT; i += 1) {
      const disabled = used.has(i) && Number(currentValue) !== i;
      desired.push({
        value: String(i),
        text: `${i}號${disabled ? '（已使用）' : ''}`,
        disabled
      });
    }

    const currentSignature = select.dataset.optionSignature || '';
    const nextSignature = JSON.stringify(desired);
    if (currentSignature !== nextSignature) {
      select.innerHTML = '';
      desired.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.text;
        option.disabled = item.disabled;
        select.appendChild(option);
      });
      select.dataset.optionSignature = nextSignature;
    }

    select.value = currentValue ? String(currentValue) : '';
  };

  const refreshAllSeatOptions = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody) return;
    tbody.querySelectorAll('select[data-seat-selector="true"]').forEach((select) => {
      const currentValue = select.value;
      buildOptions(select, currentValue, tbody);
    });
  };

  const replaceSeatInputs = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody || tbody.dataset.seatPatchBusy === '1') return;

    tbody.dataset.seatPatchBusy = '1';
    if (observer) observer.disconnect();
    try {
      tbody.querySelectorAll('td:first-child input[type="number"]').forEach((input) => {
        const onchange = input.getAttribute('onchange') || '';
        const playerId = parseUpdateSeatCall(onchange);
        if (!playerId) return;

        const currentValue = input.value || '';
        const select = document.createElement('select');
        select.className = input.className || 'form-control dark-input';
        select.dataset.seatSelector = 'true';
        select.dataset.playerId = playerId;
        buildOptions(select, currentValue, tbody);
        select.addEventListener('change', async () => {
          const selectedValue = select.value;
          select.disabled = true;
          select.setAttribute('aria-busy', 'true');
          try {
            await window.TownCheckin?.updateSeat(playerId, selectedValue);
          } catch (_) {
            // updateSeat 已顯示錯誤訊息並回復伺服器狀態。
          } finally {
            select.removeAttribute('aria-busy');
            window.TownCheckinSelfSeat?.refresh?.();
            window.setTimeout(refreshAllSeatOptions, 0);
          }
        });
        input.replaceWith(select);
      });
      refreshAllSeatOptions();
    } finally {
      tbody.dataset.seatPatchBusy = '0';
      if (observer) observer.observe(tbody, { childList: true });
    }
  };

  const scheduleReplace = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      replaceSeatInputs();
    });
  };

  const install = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody) return false;
    if (installed) return true;
    installed = true;
    observer = new MutationObserver(scheduleReplace);
    observer.observe(tbody, { childList: true });
    replaceSeatInputs();
    window.TownCheckinSeatPatch = { refresh: replaceSeatInputs };
    return true;
  };

  if (!install()) {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (install() || tries > 30) window.clearInterval(timer);
    }, 100);
  }
})();


/* Consolidated from static/js/rooms-mobile-player-list-patch.js. */
(() => {
  const $ = (selector) => document.querySelector(selector);
  let observer = null;
  let scheduled = false;

  const ensureStyles = () => {
    if ($('#rooms-mobile-player-list-style')) return;
    const style = document.createElement('style');
    style.id = 'rooms-mobile-player-list-style';
    style.textContent = `
      .mobile-player-meta,
      .mobile-player-stats {
        display: none;
      }

      @media (max-width: 640px) {
        .room-members-card .table-scroll {
          overflow-x: visible;
        }

        .room-members-card .town-table,
        .room-members-card .town-table tbody,
        .room-members-card .town-table tr,
        .room-members-card .town-table td {
          display: block;
          width: 100%;
          box-sizing: border-box;
        }

        .room-members-card .town-table thead {
          display: none;
        }

        .room-members-card .town-table tr {
          display: grid;
          grid-template-columns: minmax(82px, 108px) minmax(0, 1fr);
          gap: .75rem;
          align-items: start;
          border: 1px solid rgba(255,255,255,.09);
          background: rgba(255,255,255,.035);
          border-radius: 18px;
          padding: .85rem;
          margin-bottom: .75rem;
        }

        .room-members-card .town-table tr:has(.empty-row) {
          display: block;
          padding: 0;
          border: 0;
          background: transparent;
        }

        .room-members-card .town-table td {
          border-bottom: 0;
          padding: 0;
          text-align: left;
        }

        .room-members-card .town-table td:first-child {
          position: static !important;
          left: auto !important;
          z-index: auto !important;
          background: transparent !important;
          grid-column: 1;
          grid-row: 1 / span 2;
        }

        .room-members-card .town-table td:nth-child(2) {
          grid-column: 2;
          grid-row: 1;
          min-width: 0;
        }

        .room-members-card .town-table td:nth-child(3),
        .room-members-card .town-table td:nth-child(4),
        .room-members-card .town-table td:nth-child(5) {
          display: none;
        }

        .room-members-card .town-table td:first-child::before {
          content: '座號';
          display: block;
          color: var(--accent-gold);
          font-size: .72rem;
          font-weight: 900;
          letter-spacing: .12em;
          margin-bottom: .4rem;
        }

        .room-members-card .town-table td:nth-child(2) input {
          width: 100% !important;
          max-width: 100% !important;
          font-size: 1.05rem;
          font-weight: 850;
        }

        .room-members-card .town-table select[data-seat-selector="true"] {
          width: 100%;
          min-width: 82px;
          max-width: 108px;
          min-height: 52px;
          font-size: 1.05rem;
          font-weight: 900;
          text-align: center;
        }

        .room-members-card .player-avatar {
          width: 36px;
          height: 36px;
          margin-right: .45rem;
        }

        .mobile-player-meta,
        .mobile-player-stats {
          display: flex;
          flex-wrap: wrap;
          gap: .35rem;
          margin-top: .45rem;
        }

        .mobile-player-pill {
          display: inline-flex;
          align-items: center;
          gap: .28rem;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(255,255,255,.065);
          border-radius: 999px;
          padding: .24rem .52rem;
          color: rgba(255,255,255,.78);
          font-size: .76rem;
          line-height: 1.2;
          white-space: nowrap;
        }

        .mobile-player-pill.line {
          color: #7CFF8A;
          background: rgba(0,185,0,.12);
          border-color: rgba(124,255,138,.2);
        }

        .mobile-player-pill.temp {
          color: #ffd36b;
          background: rgba(255,183,3,.12);
          border-color: rgba(255,183,3,.2);
        }

        .mobile-player-pill.record {
          color: #c4b5fd;
          background: rgba(124,58,237,.12);
          border-color: rgba(196,181,253,.18);
        }

        .mobile-player-stats {
          color: var(--text-muted);
          font-size: .78rem;
          line-height: 1.45;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const getCellText = (row, index) => String(row.children[index]?.textContent || '').trim();

  const annotateRows = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody || tbody.dataset.mobilePatchBusy === '1') return;
    ensureStyles();

    tbody.dataset.mobilePatchBusy = '1';
    if (observer) observer.disconnect();

    try {
      Array.from(tbody.querySelectorAll('tr')).forEach((row) => {
        if (row.querySelector('.empty-row')) return;
        const nameCell = row.children[1];
        if (!nameCell) return;

        row.querySelectorAll('.mobile-player-meta, .mobile-player-stats').forEach((el) => el.remove());

        const sourceText = getCellText(row, 2) || '玩家';
        const lineText = getCellText(row, 3) || '';
        const nameInput = nameCell.querySelector('input');
        const displayName = nameInput ? nameInput.value : getCellText(row, 1);
        const isLine = sourceText.includes('LINE');
        const isTemp = sourceText.includes('臨時');
        const hasRecordName = displayName && !isTemp && lineText.includes('已綁定');

        const meta = document.createElement('div');
        meta.className = 'mobile-player-meta';
        meta.innerHTML = `
          <span class="mobile-player-pill ${isLine ? 'line' : isTemp ? 'temp' : ''}">
            <i class="${isLine ? 'fa-brands fa-line' : 'fa-solid fa-user-clock'}"></i>
            ${sourceText}
          </span>
          <span class="mobile-player-pill ${lineText.includes('已綁定') ? 'line' : ''}">
            <i class="fa-solid fa-link"></i>
            ${lineText || '未綁定'}
          </span>
          ${hasRecordName ? `<span class="mobile-player-pill record"><i class="fa-solid fa-chart-simple"></i> 戰績已綁定</span>` : ''}
        `;

        const stats = document.createElement('div');
        stats.className = 'mobile-player-stats';
        stats.textContent = '勝率資料待接入：善良% / 邪惡%';
        stats.style.display = 'none';

        nameCell.appendChild(meta);
        nameCell.appendChild(stats);
      });
    } finally {
      tbody.dataset.mobilePatchBusy = '0';
      if (observer) observer.observe(tbody, { childList: true, subtree: false });
    }
  };

  const scheduleAnnotate = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      annotateRows();
    });
  };

  const install = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody) return false;
    if (!observer) {
      observer = new MutationObserver(scheduleAnnotate);
      observer.observe(tbody, { childList: true, subtree: false });
    }
    annotateRows();
    window.TownCheckinMobilePlayerList = { refresh: annotateRows };
    return true;
  };

  if (!install()) {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (install() || tries > 30) window.clearInterval(timer);
    }, 100);
  }
})();



