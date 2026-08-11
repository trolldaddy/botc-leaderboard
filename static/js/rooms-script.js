/* Town Check-in: script selection, artwork summary, and recorder transfer. */

/* Consolidated from static/js/rooms-script-picker.js. */
(() => {
  const input = document.getElementById('room-script');
  const datalist = document.getElementById('room-script-options');
  const status = document.getElementById('room-script-picker-status');
  if (!input || !datalist) return;

  const setStatus = (message, isError = false) => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  };

  const loadScripts = async () => {
    try {
      const response = await fetch(`${window.API_BASE || ''}/api/scripts`, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const seen = new Set();
      datalist.innerHTML = '';

      items.forEach((script) => {
        const name = String(script.name_zh_tw || '').trim();
        if (!name || seen.has(name)) return;
        seen.add(name);

        const option = document.createElement('option');
        option.value = name;
        const meta = [script.category, script.author_name].filter(Boolean).join('｜');
        if (meta) option.label = meta;
        datalist.appendChild(option);
      });

      setStatus(seen.size
        ? `可從 ${seen.size} 套公開劇本中選擇，也可手動輸入。`
        : '目前沒有公開劇本，可手動輸入名稱。');
    } catch (error) {
      console.warn('房間劇本清單載入失敗', error);
      setStatus('劇本清單暫時無法載入，仍可手動輸入名稱。', true);
    }
  };

  loadScripts();
})();

/* Consolidated from static/js/rooms-script-summary-patch.js. */
(() => {
  window.__roomsScriptSummaryPatchDestroy?.();

  const STORAGE_KEY = 'botc_town_checkin_room';
  let stopped = false;
  let scripts = [];
  let renderQueued = false;

  const normalize = (value) => String(value || '')
    .toLocaleLowerCase('zh-Hant')
    .replace(/[\s\-—–·・:：,，.。()（）《》〈〉【】\[\]]+/g, '');

  const roomScriptName = () => {
    const activeRoom = window.TownCheckin?.getCurrentRoom?.();
    if (activeRoom) return activeRoom.script || '';
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').script || '';
    } catch (_) {
      return '';
    }
  };

  const scriptNames = (script) => [
    script.name_zh_tw,
    script.name,
    script.title,
    script.slug,
  ].filter(Boolean);

  const findScript = (name) => {
    const needle = normalize(name);
    if (!needle) return null;
    const exact = scripts.find((script) => scriptNames(script).some((item) => normalize(item) === needle));
    if (exact) return exact;
    return scripts.find((script) => scriptNames(script).some((item) => {
      const candidate = normalize(item);
      return candidate && (candidate.includes(needle) || needle.includes(candidate));
    })) || null;
  };

  const render = () => {
    renderQueued = false;
    if (stopped) return;
    const summary = document.querySelector('#active-room-summary');
    if (!summary) return;

    summary.querySelector('.room-script-library-link')?.remove();
    const script = findScript(roomScriptName());
    if (!script?.slug) return;

    const link = document.createElement('a');
    link.className = 'room-script-library-link';
    const scriptHash = `#scripts/${encodeURIComponent(script.slug)}`;
    link.href = scriptHash;
    link.setAttribute('aria-label', `前往劇本庫查看${script.name_zh_tw || script.name || script.slug}`);
    const navigateToScript = (event) => {
      if (event.type === 'pointerdown' && event.button !== 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.hash = scriptHash;
    };
    link.addEventListener('pointerdown', navigateToScript);
    link.addEventListener('click', navigateToScript);

    const logo = document.createElement('span');
    logo.className = 'room-script-library-logo';
    const frontImageUrl = script.images?.[0]?.url || '';
    const artworkUrl = script.logo_image_url || frontImageUrl;
    if (artworkUrl) {
      if (!script.logo_image_url) {
        link.classList.add('is-front-fallback');
        logo.classList.add('is-front-fallback');
        logo.style.backgroundImage = `url(${JSON.stringify(artworkUrl)})`;
        logo.style.backgroundSize = 'cover';
        logo.style.backgroundPosition = 'center 55%';
        logo.style.backgroundRepeat = 'no-repeat';
      } else {
        const image = document.createElement('img');
        image.src = artworkUrl;
        image.alt = '';
        image.addEventListener('error', () => { logo.textContent = '📜'; }, { once: true });
        logo.appendChild(image);
      }
    } else {
      logo.textContent = '📜';
    }

    const copy = document.createElement('span');
    copy.className = 'room-script-library-copy';
    const label = document.createElement('small');
    label.textContent = '劇本庫';
    const title = document.createElement('strong');
    title.textContent = script.name_zh_tw || script.name || script.slug;
    copy.append(label, title);

    const arrow = document.createElement('span');
    arrow.className = 'room-script-library-arrow';
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');
    link.append(logo, copy, arrow);

    const summaryTitle = summary.querySelector('.summary-title');
    const titleBlock = summaryTitle
      ? [...summary.children].find((child) => child === summaryTitle || child.contains(summaryTitle))
      : null;
    const insertionPoint = titleBlock?.nextSibling || summary.firstChild;
    summary.insertBefore(link, insertionPoint);
  };

  const queueRender = () => {
    if (renderQueued || stopped) return;
    renderQueued = true;
    requestAnimationFrame(render);
  };

  const observer = new MutationObserver((mutations) => {
    if (mutations.every((mutation) => [...mutation.addedNodes, ...mutation.removedNodes]
      .every((node) => node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('room-script-library-link')))) return;
    queueRender();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) queueRender();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('botc:town-room-changed', queueRender);

  fetch(`${window.API_BASE || ''}/api/scripts`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
    .then((payload) => {
      scripts = Array.isArray(payload) ? payload : (payload.items || []);
      queueRender();
    })
    .catch((error) => console.warn('[rooms] 無法載入劇本庫連結', error));

  queueRender();
  window.__roomsScriptSummaryPatchDestroy = () => {
    stopped = true;
    observer.disconnect();
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('botc:town-room-changed', queueRender);
    document.querySelector('#active-room-summary .room-script-library-link')?.remove();
  };
})();


/* Consolidated from static/js/rooms-transfer-patch.js. */
(() => {
  const STORAGE_KEY = 'botc_town_checkin_room';
  const RECORDER_STORAGE_KEY = 'botc_recorder_state_v2';

  const today = () => new Date().toISOString().split('T')[0];

  const readRoom = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (err) {
      return null;
    }
  };

  const buildRecorderPlayers = (room) => {
    return [...(room?.players || [])]
      .filter((p) => p.display_name || p.name)
      .sort((a, b) => {
        const as = Number(a.seat_number || 999);
        const bs = Number(b.seat_number || 999);
        if (as !== bs) return as - bs;
        return String(a.display_name || a.name || '').localeCompare(String(b.display_name || b.name || ''), 'zh-Hant');
      })
      .map((p, index) => ({
        id: Number(p.seat_number) || index + 1,
        name: p.display_name || p.name,
        role: null,
        hiddenRole: '',
        isDead: false,
        roomPlayerId: p.id || null,
        accountId: p.account_id || null,
        lineUserId: p.line_user_id || null,
        playerId: p.player_id || null,
        playerName: p.player_name || null,
        isTemporary: !!p.is_temporary
      }));
  };

  const patchedTransferToRecorder = () => {
    const room = readRoom();
    if (!room) {
      alert('尚未建立或載入房間。');
      return;
    }

    const players = buildRecorderPlayers(room);
    if (players.length === 0) {
      alert('沒有玩家可帶入。');
      return;
    }

    const recorderState = {
      botc_script: [],
      botc_players: players,
      botc_playerCount: players.length,
      botc_scriptName: room.script || room.title || '未命名劇本',
      botc_gameDate: String(room.date || today()).slice(0, 10),
      botc_gameLocation: room.location || '拉普拉斯',
      botc_customLocation: '',
      botc_storyteller: room.storyteller || '',
      botc_gamePhase: { type: 'Setup', number: 0 },
      botc_logs: [],
      botc_demonBluffs: { r1: '', r2: '', r3: '', recorded: false }
    };

    // recorder.js 使用 window.name，而不是 localStorage。
    localStorage.setItem(RECORDER_STORAGE_KEY, JSON.stringify(recorderState));

    // 同步保留一份給未來 record/rooms 橋接用。
    localStorage.setItem('botc_room_to_recorder', JSON.stringify({ room, players }));

    window.location.hash = 'recorder';
  };

  const install = () => {
    if (!window.TownCheckin) return false;
    window.TownCheckin.transferToRecorder = patchedTransferToRecorder;
    return true;
  };

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (install() || tries > 20) clearInterval(timer);
    }, 100);
  }
})();


