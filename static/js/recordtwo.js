/**
 * recordtwo.js - BOTC record parser test patch
 * 用法：測試時把頁面原本引用 static/js/record.js 的地方，暫時改成 static/js/recordtwo.js。
 * 這支檔案會先載入原本的 record.js，再覆寫戰報解析器，不直接破壞正式版。
 */
(() => {
  const ORIGINAL_RECORD_SRC = '/static/js/record.js';
  const DRAFT_KEY = 'botc_record_draft';

  const esc = (v) => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const getMode = () => document.getElementById('log-parser-mode')?.value || 'auto';

  // 讓原本 record.js 的 submit payload 也帶 parser_format 給後端。
  const patchFetch = () => {
    if (window.__recordTwoFetchPatched) return;
    window.__recordTwoFetchPatched = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        const method = String(init?.method || 'GET').toUpperCase();
        if (method === 'POST' && url.includes('/api/matches') && init?.body) {
          const payload = JSON.parse(init.body);
          payload.parser_format = getMode();
          init = { ...init, body: JSON.stringify(payload) };
        }
      } catch (err) {}
      return originalFetch(input, init);
    };
  };

  const injectParserSelect = () => {
    if (document.getElementById('log-parser-mode')) return;
    const logInput = document.getElementById('log-input');
    if (!logInput || !logInput.parentNode) return;

    if (!document.getElementById('recordtwo-parser-style')) {
      const style = document.createElement('style');
      style.id = 'recordtwo-parser-style';
      style.textContent = `
        .recordtwo-parser-row{margin:.75rem 0;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}
        .recordtwo-parser-row label{font-size:.85rem;color:var(--text-muted,#94a3b8)}
        #log-parser-mode{min-width:220px;border-radius:.75rem;padding:.55rem .8rem;background:rgba(15,23,42,.96)!important;color:#f8fafc!important;border:1px solid rgba(51,65,85,.95)!important;color-scheme:dark}
        #log-parser-mode option{background:#0f172a!important;color:#f8fafc!important}
      `;
      document.head.appendChild(style);
    }

    const row = document.createElement('div');
    row.className = 'recordtwo-parser-row';
    row.innerHTML = `
      <label for="log-parser-mode">戰報格式</label>
      <select id="log-parser-mode" onchange="saveDraft()">
        <option value="auto">自動辨識</option>
        <option value="clocktower_recorder">血染覆盤紀錄格式</option>
        <option value="simple_role_list">玩家角色列表格式</option>
      </select>
    `;
    logInput.parentNode.insertBefore(row, logInput);

    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      if (draft.parser_format) document.getElementById('log-parser-mode').value = draft.parser_format;
    } catch (err) {}
  };

  const normalizeRole = (role) => String(role || '')
    .replace(/[()（）]/g, '')
    .replace(/實際:/g, '')
    .replace(/善良陣營/g, '')
    .replace(/邪惡陣營/g, '')
    .trim();

  const getAlignmentByRole = (role) => {
    const target = normalizeRole(role);
    if (!target) return 'good';

    const db = window.MASTER_ROLE_DB || [];
    const roleData = db.find(r => {
      const names = [r.name, r.id, r.name_zh, r.zh, r.chinese, r.display_name]
        .filter(Boolean)
        .map(normalizeRole);
      return names.includes(target);
    });

    if (roleData) {
      const team = String(roleData.team || roleData.type || roleData.alignment || '').toLowerCase();
      if (['minion', 'demon', 'evil'].includes(team)) return 'evil';
      if (['townsfolk', 'outsider', 'good'].includes(team)) return 'good';
    }

    const evilRoles = new Set([
      '小惡魔','亡骨魔','牙噶巴卜','利維坦','維格莫提斯','諾-達鯤','珀','西西弗斯','姑獲鳥',
      '投毒者','洗腦師','巫師','間諜','男爵','猩紅女郎','刺客','精神病患者','哥布林','教父','惡魔律師','恐懼之靈',
      '紅唇女郎','麻臉巫婆','寡婦','女巫','澤布魯斯','坑洞魔','普卡','沙巴洛斯','小怪寶','暴亂','死神'
    ]);
    return evilRoles.has(target) ? 'evil' : 'good';
  };

  const parseWinner = (text) => {
    if (!text) return '';
    if (text.includes('邪惡')) return 'evil';
    if (text.includes('善良') || text.includes('正義')) return 'good';
    return '';
  };

  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (!el || value === undefined || value === null || value === '') return;
    if (id === 'match-location' && el.tagName === 'SELECT') {
      const exists = Array.from(el.options).some(opt => opt.value === value);
      if (!exists) el.appendChild(new Option(value, value));
    }
    el.value = String(value).trim();
  };

  const cleanName = (raw) => String(raw || '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+(間諜|邪惡間諜|酒醉|中毒|死亡|存活)$/g, '')
    .trim();

  const makePlayer = (seat, name, initialRole, finalRole, survived = true) => ({
    seat_number: seat,
    seat,
    name,
    initial_character: initialRole,
    initial_role: initialRole,
    final_character: finalRole,
    final_role: finalRole,
    alignment: getAlignmentByRole(finalRole || initialRole),
    status: survived ? 'alive' : 'dead',
    survived
  });

  const parseRowsFromOldBlock = (block) => {
    const rows = {};
    const rowRegex = /\[(\d+)號\]\s*(.*?)\s*-\s*[（(](.*?)[）)]\s*(.*)/g;
    let m;
    while ((m = rowRegex.exec(block)) !== null) {
      const seat = parseInt(m[1], 10);
      if (!seat || seat >= 20) continue;
      const status = String(m[2] || '').trim();
      const role = normalizeRole(m[3]);
      const rawName = String(m[4] || '').trim();
      rows[seat] = {
        seat,
        role,
        rawName,
        name: cleanName(rawName),
        survived: !status.includes('死亡') && !status.includes('死')
      };
    }
    return rows;
  };

  const parseOldReplay = (text) => {
    const result = { meta: {}, players: [] };
    const script = text.match(/劇本名稱：(.+)/);
    const location = text.match(/遊戲地點：(.+)/);
    const date = text.match(/遊戲日期：(\d{4}-\d{2}-\d{2})/);
    const storyteller = text.match(/說書人：(.+)/) || text.match(/記錄者：(.+)/);
    const winner = text.match(/勝利陣營：(.+)/);

    if (script) result.meta.script = script[1].trim();
    if (location) result.meta.location = location[1].trim();
    if (date) result.meta.date = date[1].trim();
    if (storyteller) result.meta.storyteller = storyteller[1].trim();
    if (winner) result.meta.winner = parseWinner(winner[1]);

    const blocks = text.split('【當前玩家狀態】').slice(1);
    const finalSnapshot = text.match(/【最終玩家狀態快照】([\s\S]*)$/);
    if (finalSnapshot) blocks.push(finalSnapshot[1]);
    if (!blocks.length) return result;

    const firstRows = parseRowsFromOldBlock(blocks[0]);
    const map = {};
    Object.keys(firstRows).forEach(k => {
      const seat = Number(k);
      const first = firstRows[seat];
      map[seat] = makePlayer(seat, first.name, first.role, first.role, first.survived);
    });

    blocks.forEach(block => {
      const rows = parseRowsFromOldBlock(block);
      Object.keys(rows).forEach(k => {
        const seat = Number(k);
        const row = rows[seat];
        const finalRole = /\s(邪惡)?間諜$/.test(row.rawName) ? '間諜' : row.role;
        if (!map[seat]) map[seat] = makePlayer(seat, row.name, row.role, finalRole, row.survived);
        else {
          if (row.name) map[seat].name = row.name;
          map[seat].final_character = finalRole;
          map[seat].final_role = finalRole;
          map[seat].alignment = getAlignmentByRole(finalRole);
          map[seat].survived = row.survived;
          map[seat].status = row.survived ? 'alive' : 'dead';
        }
      });
    });

    result.players = Object.values(map).sort((a, b) => a.seat_number - b.seat_number).filter(p => p.name);
    return result;
  };

  const splitRole = (roleText) => {
    const text = String(roleText || '').trim();
    const m = text.match(/^(.+?)[（(](.+?)[）)]$/);
    if (m) return { actual: normalizeRole(m[1]), reminder: normalizeRole(m[2]), raw: text };
    return { actual: normalizeRole(text), reminder: '', raw: text };
  };

  const parseSimpleRoleListReplay = (text) => {
    const result = { meta: {}, players: [] };
    const title = text.split(/\r?\n/).map(l => l.trim()).find(l => l && !l.includes('玩家角色列表'));
    const winner = text.match(/(善良陣營|邪惡陣營)獲勝/);
    if (title) result.meta.script = title;
    if (winner) result.meta.winner = parseWinner(winner[1]);

    const list = text.match(/玩家角色列表:\s*([\s\S]*?)(?:\n\s*設置|\n\s*首夜|\n\s*第一個白天|\n\s*第一個夜晚|$)/);
    if (!list) return result;

    const map = {};
    list[1].split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(line => {
      const m = line.match(/^(.+?)【\s*(\d+)\.([^】]+)\s*】$/);
      if (!m) return;
      const name = m[1].trim();
      const seat = parseInt(m[2], 10);
      const role = splitRole(m[3]).actual;
      if (!seat || seat >= 20 || !name) return;
      map[seat] = makePlayer(seat, name, role, role, true);
    });

    // 角色轉換，例如：【11.麻臉巫婆】熬製【03.寡婦】為【03.死神】
    const transformRegex = /【\s*\d+\.[^】]+】.*?【\s*(\d+)\.[^】]+】\s*為\s*【\s*(\d+)\.([^】]+)\s*】/g;
    let tm;
    while ((tm = transformRegex.exec(text)) !== null) {
      const beforeSeat = parseInt(tm[1], 10);
      const afterSeat = parseInt(tm[2], 10);
      const newRole = splitRole(tm[3]).actual;
      if (beforeSeat && afterSeat && beforeSeat === afterSeat && map[afterSeat]) {
        map[afterSeat].final_character = newRole;
        map[afterSeat].final_role = newRole;
        map[afterSeat].alignment = getAlignmentByRole(newRole);
      }
    }

    // 最後一個「存活玩家」作為最終存活狀態，再處理尾段處決死亡。
    const aliveRegex = /存活玩家\s*:\s*([0-9\s]+)/g;
    let am;
    let lastAlive = null;
    while ((am = aliveRegex.exec(text)) !== null) {
      lastAlive = {
        endIndex: aliveRegex.lastIndex,
        seats: am[1].trim().split(/\s+/).map(n => parseInt(n, 10)).filter(Boolean)
      };
    }

    if (lastAlive) {
      const aliveSet = new Set(lastAlive.seats);
      Object.values(map).forEach(p => {
        p.survived = aliveSet.has(p.seat_number);
        p.status = p.survived ? 'alive' : 'dead';
      });
      const tail = text.slice(lastAlive.endIndex);
      const deathRegex = /【\s*(\d+)\.[^】]+】(?:被處決)?死亡/g;
      let dm;
      while ((dm = deathRegex.exec(tail)) !== null) {
        const seat = parseInt(dm[1], 10);
        if (map[seat]) {
          map[seat].survived = false;
          map[seat].status = 'dead';
        }
      }
    } else {
      const deathRegex = /【\s*(\d+)\.[^】]+】(?:被處決)?死亡/g;
      let dm;
      while ((dm = deathRegex.exec(text)) !== null) {
        const seat = parseInt(dm[1], 10);
        if (map[seat]) {
          map[seat].survived = false;
          map[seat].status = 'dead';
        }
      }
    }

    result.players = Object.values(map).sort((a, b) => a.seat_number - b.seat_number).filter(p => p.name);
    return result;
  };

  const detectFormat = (text) => {
    if (text.includes('玩家角色列表:')) return 'simple_role_list';
    if (text.includes('【當前玩家狀態】')) return 'clocktower_recorder';
    return 'unknown';
  };

  const applyParsed = (parsed, mode) => {
    if (parsed.meta?.script) setValue('match-script', parsed.meta.script);
    if (parsed.meta?.date) setValue('match-date', parsed.meta.date);
    if (parsed.meta?.storyteller) setValue('match-storyteller', parsed.meta.storyteller);
    if (parsed.meta?.winner) setValue('match-winner', parsed.meta.winner);
    if (parsed.meta?.location) setValue('match-location', parsed.meta.location);

    window.renderPlayersFromData(parsed.players);
    if (window.updateRowNumbers) window.updateRowNumbers();
    if (window.saveDraft) window.saveDraft();
    alert(`已使用「${mode === 'simple_role_list' ? '玩家角色列表格式' : '血染覆盤紀錄格式'}」解析 ${parsed.players.length} 位玩家。`);
  };

  const installPatch = () => {
    injectParserSelect();

    const originalSaveDraft = window.saveDraft;
    window.saveDraft = () => {
      if (typeof originalSaveDraft === 'function') originalSaveDraft();
      try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        draft.parser_format = getMode();
        draft.replay_log = document.getElementById('log-input')?.value || draft.replay_log || draft.log || '';
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch (err) {}
    };

    window.autoFillFromLog = () => {
      const text = document.getElementById('log-input')?.value || '';
      if (!text.trim()) return alert('請先貼上文字紀錄');

      const selected = getMode();
      const mode = selected === 'auto' ? detectFormat(text) : selected;
      let parsed = null;

      if (mode === 'simple_role_list') parsed = parseSimpleRoleListReplay(text);
      else if (mode === 'clocktower_recorder') parsed = parseOldReplay(text);
      else return alert('無法自動辨識戰報格式，請手動選擇格式。');

      if (!parsed?.players?.length) return alert('無法自動解析玩家，請確認格式或手動輸入。');
      applyParsed(parsed, mode);
    };

    window.importFile = (input) => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('log-input').value = e.target.result;
        window.autoFillFromLog();
      };
      reader.readAsText(file);
    };
  };

  const loadOriginalRecord = () => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${ORIGINAL_RECORD_SRC}?recordtwo=${Date.now()}`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  patchFetch();
  loadOriginalRecord()
    .then(() => setTimeout(installPatch, 0))
    .catch(() => {
      console.error('recordtwo.js 無法載入原始 record.js，將只安裝解析器補丁。');
      setTimeout(installPatch, 0);
    });
})();
