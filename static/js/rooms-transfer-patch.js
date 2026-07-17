(() => {
  const STORAGE_KEY = 'botc_town_checkin_room';

  const today = () => new Date().toISOString().split('T')[0];

  const readRoom = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (err) {
      return null;
    }
  };

  const readWindowStore = () => {
    try {
      return window.name ? JSON.parse(window.name) : {};
    } catch (err) {
      return {};
    }
  };

  const writeWindowStore = (patch) => {
    const store = readWindowStore();
    Object.assign(store, patch);
    window.name = JSON.stringify(store);
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
    writeWindowStore(recorderState);

    // 同步保留一份給未來 record/rooms 橋接用。
    localStorage.setItem('botc_room_to_recorder', JSON.stringify({ room, players }));

    if (window.loadPage) {
      window.location.hash = 'recorder';
      window.loadPage('recorder');
    } else {
      window.location.href = '/#recorder';
    }
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
