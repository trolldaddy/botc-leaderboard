/**
 * BOTC Stats - Record Match page
 * 合併版：
 * 1. 保留 LINE 登入 / 上傳權限檢查
 * 2. 恢復完整覆盤解析：玩家名稱、初始角色、最終角色、陣營、存活狀態
 * 3. 保留 replay_log 草稿
 * 4. 修正 saveDraft 內 seat_number index 問題
 */

function setupRoleDatalist() {
    let datalist = document.getElementById('all-roles-list');

    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'all-roles-list';
        document.body.appendChild(datalist);
    }

    if (window.MASTER_ROLE_DB && window.MASTER_ROLE_DB.length > 0) {
        datalist.innerHTML = window.MASTER_ROLE_DB
            .map(role => `<option value="${role.name}">`)
            .join('');
    }
}

window.addEventListener('DOMContentLoaded', setupRoleDatalist);

{
    let currentAuth = {
        authenticated: false,
        logged_in: false,
        can_upload: false
    };

    const apiBase = () => window.API_BASE || '';

    const isLoggedIn = () => Boolean(currentAuth.logged_in || currentAuth.authenticated);

    const defaultLocations = [
        '拉普拉斯',
        '線上',
        '台北',
        '新北',
        '桃園',
        '台中',
        '台南',
        '高雄',
        '其他'
    ];

    const escapeHtml = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const injectRecordPolish = () => {
        if (document.getElementById('record-select-polish')) return;

        const style = document.createElement('style');
        style.id = 'record-select-polish';
        style.textContent = `
            #record-form select,
            .player-row select,
            #match-location,
            #match-winner {
                background: rgba(15,23,42,.96) !important;
                color: #f8fafc !important;
                border: 1px solid rgba(51,65,85,.95) !important;
                color-scheme: dark;
                box-shadow: inset 0 0 0 1px rgba(0,0,0,.12);
            }

            #record-form select:focus,
            .player-row select:focus,
            #match-location:focus,
            #match-winner:focus {
                border-color: rgba(255,183,3,.72) !important;
                box-shadow: 0 0 0 2px rgba(255,183,3,.12) !important;
                outline: none;
            }

            #record-form select option,
            .player-row select option,
            #match-location option,
            #match-winner option {
                background: #0f172a !important;
                color: #f8fafc !important;
            }
        `;
        document.head.appendChild(style);
    };

    const ensureLocationOption = (select, value) => {
        if (!select || !value) return;

        const exists = Array.from(select.options).some((opt) => opt.value === value);

        if (!exists) {
            select.appendChild(new Option(value, value));
        }
    };

    const loadLocationOptions = async () => {
        const select = document.getElementById('match-location');
        if (!select) return;

        let selected = select.value;

        try {
            const draft = JSON.parse(localStorage.getItem('botc_record_draft') || '{}');
            selected = draft.location || selected;
        } catch (err) {}

        try {
            const resp = await fetch(`${apiBase()}/api/locations`, {
                credentials: 'same-origin'
            });

            if (!resp.ok) throw new Error('load failed');

            const locations = await resp.json();

            const names = [
                ...new Set([
                    ...(locations || []).map((loc) => loc.name).filter(Boolean),
                    ...defaultLocations
                ])
            ];

            select.innerHTML = names
                .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
                .join('');
        } catch (err) {
            const names = [
                ...new Set([
                    ...Array.from(select.options).map((opt) => opt.value),
                    ...defaultLocations
                ])
            ];

            select.innerHTML = names
                .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
                .join('');
        }

        ensureLocationOption(select, selected);

        if (selected) {
            select.value = selected;
        }
    };

    const lineLoginUrl = () => {
        const next = encodeURIComponent(`${window.location.pathname}${window.location.hash || '#record'}`);
        return `/api/auth/line/login?next=${next}`;
    };

    const setSubmitEnabled = (enabled) => {
        const btn = document.getElementById('submit-btn');
        if (!btn) return;

        btn.disabled = !enabled;
        btn.style.background = 'var(--accent-red)';
        btn.style.color = '#fff';
        btn.style.borderRadius = '999px';
        btn.style.opacity = '1';
        btn.style.boxShadow = enabled ? 'var(--shadow-glow)' : 'none';
        btn.style.cursor = enabled ? 'pointer' : 'not-allowed';

        btn.innerHTML = enabled
            ? `<i class="fa-solid fa-cloud-arrow-up"></i> 確認並提交戰績`
            : `<i class="fa-solid fa-lock"></i> 請先使用 LINE 登入`;
    };

    const applyDefaultStoryteller = () => {
        const storytellerInput = document.getElementById('match-storyteller');
        const displayName = currentAuth.user?.display_name;

        if (storytellerInput && isLoggedIn() && displayName && !storytellerInput.value.trim()) {
            storytellerInput.value = displayName;
            saveDraft();
        }
    };

    const renderAuthState = () => {
        const statusEl = document.getElementById('line-auth-status');
        const actionsEl = document.getElementById('line-auth-actions');
        const summaryEl = document.getElementById('upload-auth-summary');

        if (!statusEl || !actionsEl || !summaryEl) return;

        summaryEl.classList.remove('dark-input', 'is-verified', 'is-warning');
        summaryEl.style.minHeight = '44px';
        summaryEl.style.padding = '0';
        summaryEl.style.background = 'transparent';
        summaryEl.style.border = '0';
        summaryEl.style.display = 'flex';
        summaryEl.style.alignItems = 'center';

        actionsEl.innerHTML = '';
        actionsEl.style.display = 'none';
        statusEl.style.display = 'none';

        if (!isLoggedIn()) {
            summaryEl.innerHTML = `<a class="line-login-button" href="${lineLoginUrl()}" aria-label="使用 LINE 登入" title="使用 LINE 登入"></a>`;
            setSubmitEnabled(false);
            return;
        }

        const user = currentAuth.user || {};

        actionsEl.style.display = 'flex';
        actionsEl.innerHTML = `<a class="btn btn-outline" href="/auth/logout"><i class="fa-solid fa-right-from-bracket"></i> 登出</a>`;

        if (!currentAuth.can_upload) {
            summaryEl.classList.add('is-warning');
            summaryEl.innerHTML = `<span style="color: var(--accent-red); padding: 0.85rem 1rem;">${escapeHtml(user.display_name || 'LINE 使用者')} 尚未開放上傳權限</span>`;
            setSubmitEnabled(false);
            return;
        }

        summaryEl.classList.add('is-verified');
        summaryEl.innerHTML = `<span style="color: var(--text-muted); padding: 0.85rem 1rem;">${escapeHtml(user.display_name || 'LINE 使用者')} 已通過登入驗證</span>`;
        setSubmitEnabled(true);
    };

    const refreshAuthState = async () => {
        try {
            const resp = await fetch(`${apiBase()}/api/me`, {
                credentials: 'same-origin'
            });

            currentAuth = resp.ok
                ? await resp.json()
                : {
                    logged_in: false,
                    authenticated: false,
                    can_upload: false
                };
        } catch (err) {
            currentAuth = {
                logged_in: false,
                authenticated: false,
                can_upload: false
            };
        }

        renderAuthState();
    };

    const initRecord = async () => {
        injectRecordPolish();
        setupRoleDatalist();

        const dateInput = document.getElementById('match-date');

        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        await loadLocationOptions();
        await refreshAuthState();
        await refreshPlayerDatalist();

        loadRecentMatches();

        const list = document.getElementById('players-list');

        if (!list) return;

        const transferData = localStorage.getItem('botc_transfer_data');
        const draftData = localStorage.getItem('botc_record_draft');

        if (transferData) {
            const data = JSON.parse(transferData);

            renderPlayersFromData((data.players || []).map(p => ({
                name: p.name,
                initial_character: p.role,
                final_character: p.actualRole || p.role,
                survived: p.isAlive,
                alignment: p.team || getAlignmentByRole(p.actualRole || p.role)
            })));

            localStorage.removeItem('botc_transfer_data');
        } else if (draftData) {
            restoreDraft(JSON.parse(draftData));
        } else {
            list.innerHTML = '';

            for (let i = 0; i < 12; i++) {
                addPlayerRow();
            }
        }

        applyDefaultStoryteller();
        await loadLocationOptions();
    };

    const loadRecentMatches = async () => {
        const container = document.getElementById('recent-matches-list');

        if (!container) return;

        try {
            const resp = await fetch(`${apiBase()}/api/history`);

            if (!resp.ok) throw new Error();

            const data = await resp.json();
            const recent = data.slice(0, 6);

            if (recent.length === 0) {
                container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">尚未有紀錄</div>`;
                return;
            }

            container.innerHTML = recent.map(m => {
                const d = new Date(m.date);
                const isGood = m.winning_team === 'good';

                return `
                    <div class="side-match-item">
                        <div class="side-match-flex">
                            <div class="side-left-info">
                                <div class="m-title" title="${escapeHtml(m.script || '')}">
                                    ${escapeHtml(m.script || '未知劇本')}
                                </div>
                                <div class="m-meta">
                                    <span><i class="fa-solid fa-users"></i> ${m.players?.length || 0}人</span>
                                    <span><i class="fa-solid fa-user-tie"></i> ${escapeHtml(m.storyteller || '未知')}</span>
                                </div>
                                <div class="m-meta">
                                    <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(m.location || '未知')}</span>
                                </div>
                            </div>

                            <div class="side-mini-box date-box">
                                <div class="box-label">${Number.isNaN(d.getTime()) ? '' : d.getFullYear()}</div>
                                <div class="box-value">${Number.isNaN(d.getTime()) ? '-' : `${d.getMonth() + 1}/${d.getDate()}`}</div>
                            </div>

                            <div class="side-mini-box status-box ${isGood ? 'box-good' : 'box-evil'}">
                                <div class="box-value">${isGood ? '善良' : '邪惡'}</div>
                                <div class="box-label">獲勝</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            container.innerHTML = `<div style="color: var(--accent-red); padding: 1rem; text-align:center;">讀取失敗</div>`;
        }
    };

    const normalizeRoleName = (roleStr) => {
        return String(roleStr || '')
            .replace(/[()（）]/g, '')
            .replace(/實際:/g, '')
            .replace(/善良陣營/g, '')
            .replace(/邪惡陣營/g, '')
            .trim();
    };

    const getAlignmentByRole = (roleStr) => {
        if (!roleStr) return 'good';

        let targetRole = String(roleStr);

        if (targetRole.includes('實際:')) {
            targetRole = targetRole.split('實際:')[1].trim();
        } else if (targetRole.includes('/')) {
            targetRole = targetRole.split('/')[1]?.trim() || targetRole.split('/')[0].trim();
        }

        targetRole = normalizeRoleName(targetRole);

        const db = window.MASTER_ROLE_DB || [];

        const roleData = db.find(r => {
            const candidates = [
                r.name,
                r.id,
                r.name_zh,
                r.zh,
                r.chinese,
                r.display_name
            ]
                .filter(Boolean)
                .map(normalizeRoleName);

            return candidates.includes(targetRole);
        });

        if (roleData) {
            const team = String(roleData.team || roleData.type || roleData.alignment || '').toLowerCase();

            if (team === 'minion' || team === 'demon' || team === 'evil') return 'evil';
            if (team === 'townsfolk' || team === 'outsider' || team === 'good') return 'good';
        }

        // MASTER_ROLE_DB 尚未載入或中文名對不上時的保底判斷。
        const evilFallbackRoles = new Set([
            '小惡魔',
            '亡骨魔',
            '牙噶巴卜',
            '利維坦',
            '維格莫提斯',
            '諾-達鯤',
            '珀',
            '投毒者',
            '洗腦師',
            '巫師',
            '間諜',
            '男爵',
            '猩紅女郎',
            '刺客',
            '精神病患者',
            '哥布林',
            '教父',
            '惡魔律師',
            '恐懼之靈',
            '紅唇女郎',
            '麻臉巫婆',
            '寡婦',
            '女巫',
            '澤布魯斯',
            '坑洞魔',
            '普卡',
            '沙巴洛斯',
            '小怪寶',
            '暴亂'
        ]);

        return evilFallbackRoles.has(targetRole) ? 'evil' : 'good';
    };

    window.updateRowNumbers = () => {
        const rows = document.querySelectorAll('.player-row');

        rows.forEach((row, index) => {
            const numEl = row.querySelector('.row-index');

            if (numEl) {
                numEl.innerText = index + 1;
            } else {
                const firstDiv = row.querySelector('div');
                if (firstDiv) firstDiv.textContent = index + 1;
            }
        });
    };

    window.renumberRows = window.updateRowNumbers;

    window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');

        if (!list) return;

        const row = document.createElement('div');

        row.className = 'player-row grid grid-cols-2 sm:grid-cols-12 gap-2 p-3 sm:p-2 bg-slate-800/40 rounded-xl sm:rounded-lg border border-slate-700 sm:border-slate-800/50 items-center';

        const alignment = data?.alignment || data?.team || getAlignmentByRole(data?.final_character || data?.initial_character);

        row.innerHTML = `
            <div class="hidden sm:flex sm:col-span-1 justify-center items-center font-mono text-gold font-bold">
                <span class="row-index">0</span>
            </div>

            <div class="col-span-2 sm:col-span-2">
                <label class="sm:hidden text-[10px] text-slate-500 mb-1 block">玩家暱稱</label>
                <input
                    type="text"
                    class="p-name w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-yellow-500"
                    list="player-names-list"
                    value="${escapeHtml(data?.name || '')}"
                    placeholder="暱稱"
                    oninput="saveDraft()"
                >
            </div>

            <div class="col-span-1 sm:col-span-2">
                <label class="sm:hidden text-[10px] text-slate-500 mb-1 block">初始角色</label>
                <input
                    type="text"
                    class="p-initial w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-yellow-500"
                    list="all-roles-list"
                    value="${escapeHtml(data?.initial_character || data?.initial_role || '')}"
                    placeholder="初始"
                    oninput="saveDraft()"
                >
            </div>

            <div class="col-span-1 sm:col-span-2">
                <label class="sm:hidden text-[10px] text-slate-500 mb-1 block">最終角色</label>
                <input
                    type="text"
                    class="p-final w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-yellow-500"
                    list="all-roles-list"
                    value="${escapeHtml(data?.final_character || data?.final_role || '')}"
                    placeholder="最終"
                    oninput="saveDraft()"
                >
            </div>

            <div class="col-span-1 sm:col-span-2">
                <label class="sm:hidden text-[10px] text-slate-500 mb-1 block">陣營</label>
                <select
                    class="p-team w-full bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-200 outline-none"
                    oninput="saveDraft()"
                    onchange="saveDraft()"
                >
                    <option value="good" ${alignment === 'good' ? 'selected' : ''}>善良</option>
                    <option value="evil" ${alignment === 'evil' ? 'selected' : ''}>邪惡</option>
                </select>
            </div>

            <div class="col-span-1 sm:col-span-2">
                <label class="sm:hidden text-[10px] text-slate-500 mb-1 block">狀態</label>
                <select
                    class="p-status w-full bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-200 outline-none"
                    oninput="saveDraft()"
                    onchange="saveDraft()"
                >
                    <option value="alive" ${data?.survived !== false && data?.status !== 'dead' ? 'selected' : ''}>存活</option>
                    <option value="dead" ${data?.survived === false || data?.status === 'dead' ? 'selected' : ''}>死亡</option>
                </select>
            </div>

            <div class="col-span-2 sm:col-span-1 flex justify-end sm:justify-center">
                <button
                    type="button"
                    class="text-slate-600 hover:text-red-500 p-2"
                    onclick="if(confirm('確定刪除？')){this.closest('.player-row').remove(); window.updateRowNumbers(); saveDraft();}"
                >
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;

        list.appendChild(row);
        updateRowNumbers();
    };

    window.renderPlayersFromData = (players) => {
        const list = document.getElementById('players-list');

        if (!list) return;

        list.innerHTML = '';

        (players || []).forEach(p => addPlayerRow(p));

        if (!players || players.length === 0) {
            addPlayerRow();
        }

        updateRowNumbers();
    };

    const collectFormData = () => {
        return {
            script: document.getElementById('match-script')?.value || '',
            date: document.getElementById('match-date')?.value || '',
            location: document.getElementById('match-location')?.value || '',
            storyteller: document.getElementById('match-storyteller')?.value || '',
            winner: document.getElementById('match-winner')?.value || 'good',
            log: document.getElementById('log-input')?.value || '',
            replay_log: document.getElementById('log-input')?.value || '',
            players: Array.from(document.querySelectorAll('.player-row')).map((row, index) => ({
                seat_number: index + 1,
                seat: index + 1,
                name: row.querySelector('.p-name')?.value || '',
                initial_character: row.querySelector('.p-initial')?.value || '',
                initial_role: row.querySelector('.p-initial')?.value || '',
                final_character: row.querySelector('.p-final')?.value || '',
                final_role: row.querySelector('.p-final')?.value || '',
                alignment: row.querySelector('.p-team')?.value || 'good',
                status: row.querySelector('.p-status')?.value || 'alive',
                survived: row.querySelector('.p-status')?.value === 'alive'
            }))
        };
    };

    window.saveDraft = () => {
        const scriptEl = document.getElementById('match-script');

        if (!scriptEl) return;

        localStorage.setItem('botc_record_draft', JSON.stringify(collectFormData()));

        const statusEl = document.getElementById('save-status');

        if (statusEl) {
            statusEl.innerText = '草稿已儲存 (' + new Date().toLocaleTimeString() + ')';
        }
    };

    window.restoreDraft = (data) => {
        document.getElementById('match-script').value = data.script || '';
        document.getElementById('match-date').value = data.date || '';

        const locationSelect = document.getElementById('match-location');
        ensureLocationOption(locationSelect, data.location || '');

        if (locationSelect) {
            locationSelect.value = data.location || '';
        }

        document.getElementById('match-storyteller').value = data.storyteller || '';
        document.getElementById('match-winner').value = data.winner || 'good';

        const logInput = document.getElementById('log-input');
        if (logInput) {
            logInput.value = data.replay_log || data.log || '';
        }

        renderPlayersFromData(data.players || []);
    };

    window.clearForm = () => {
        if (!confirm('確定清空目前表單？')) return;

        localStorage.removeItem('botc_record_draft');

        document.getElementById('record-form').reset();
        document.getElementById('players-list').innerHTML = '';

        for (let i = 0; i < 12; i++) {
            addPlayerRow();
        }

        document.getElementById('match-date').value = new Date().toISOString().split('T')[0];

        loadLocationOptions();
        applyDefaultStoryteller();
    };

    window.clearFullForm = window.clearForm;

    const safeSet = (id, value) => {
        const el = document.getElementById(id);

        if (!el || value === undefined || value === null || value === '') {
            return false;
        }

        el.value = String(value).trim();
        return true;
    };

    const parseWinnerText = (winnerText) => {
        if (!winnerText) return '';

        if (winnerText.includes('邪惡')) return 'evil';
        if (winnerText.includes('善良') || winnerText.includes('正義')) return 'good';

        return '';
    };

    const cleanPlayerNameFromLog = (rawName) => {
        return String(rawName || '')
            .replace(/[（(].*?[）)]/g, '')
            .replace(/\s+(間諜|邪惡間諜|酒醉|中毒|死亡|存活)$/g, '')
            .trim();
    };

    const inferFinalCharacterFromParsedRow = (row) => {
        if (!row) return '';

        const rawName = String(row.rawName || '').trim();

        // 例如：玩家 3 間諜
        // 括號內仍可能是原角色，但尾端標記代表最終轉化狀態。
        if (/\s邪惡間諜$/.test(rawName) || /\s間諜$/.test(rawName)) {
            return '間諜';
        }

        return row.role;
    };

    const parsePlayerRowsFromBlock = (block) => {
        const rows = {};

        // 支援：
        // [1號] ❤️ 存活 - (村夫) 玩家 1
        // [13號] ☠️ 死亡  - (巫師) 玩家 13
        const rowRegex = /\[(\d+)號\]\s*(.*?)\s*-\s*[（(](.*?)[）)]\s*(.*)/g;

        let m;

        while ((m = rowRegex.exec(block)) !== null) {
            const seat = parseInt(m[1], 10);
            const statusText = String(m[2] || '').trim();
            const role = normalizeRoleName(m[3]);
            const rawName = String(m[4] || '').trim();

            if (!seat || seat >= 20) continue;

            rows[seat] = {
                seat,
                statusText,
                role,
                rawName,
                name: cleanPlayerNameFromLog(rawName),
                survived: !statusText.includes('死亡') && !statusText.includes('死')
            };
        }

        return rows;
    };

    const getStatusBlocksFromReplayLog = (text) => {
        const blocks = text.split('【當前玩家狀態】').slice(1);

        // 你的覆盤最後有「【最終玩家狀態快照】」，優先讓它成為最後狀態來源。
        const finalSnapshotMatch = text.match(/【最終玩家狀態快照】([\s\S]*)$/);

        if (finalSnapshotMatch) {
            blocks.push(finalSnapshotMatch[1]);
        }

        return blocks;
    };

    window.autoFillFromLog = () => {
        const text = document.getElementById('log-input')?.value || '';

        if (!text.trim()) {
            alert('請先貼上文字紀錄');
            return;
        }

        // 1. 基礎資訊解析
        const scriptMatch = text.match(/劇本名稱：(.+)/);
        const locationMatch = text.match(/遊戲地點：(.+)/);
        const dateMatch = text.match(/遊戲日期：(\d{4}-\d{2}-\d{2})/);
        const storytellerMatch = text.match(/說書人：(.+)/) || text.match(/記錄者：(.+)/);
        const winnerMatch = text.match(/勝利陣營：(.+)/);

        if (scriptMatch) {
            safeSet('match-script', scriptMatch[1]);
        }

        if (dateMatch) {
            safeSet('match-date', dateMatch[1]);
        }

        if (storytellerMatch) {
            safeSet('match-storyteller', storytellerMatch[1]);
        }

        if (winnerMatch) {
            const winnerValue = parseWinnerText(winnerMatch[1]);
            safeSet('match-winner', winnerValue);
        }

        if (locationMatch) {
            const locSelect = document.getElementById('match-location');
            const locVal = locationMatch[1].trim();

            ensureLocationOption(locSelect, locVal);

            if (locSelect) {
                locSelect.value = locVal;
            }
        }

        // 2. 玩家狀態解析
        const blocks = getStatusBlocksFromReplayLog(text);

        if (blocks.length < 1) {
            alert('無法找到【當前玩家狀態】區塊，請確認覆盤格式。');
            return;
        }

        const firstRows = parsePlayerRowsFromBlock(blocks[0]);
        const playerMap = {};

        // 第一個狀態區塊作為初始角色來源。
        Object.keys(firstRows).forEach((seatKey) => {
            const seat = Number(seatKey);
            const first = firstRows[seat];

            playerMap[seat] = {
                seat_number: seat,
                seat,
                name: first.name,
                initial_character: first.role,
                initial_role: first.role,
                final_character: first.role,
                final_role: first.role,
                alignment: getAlignmentByRole(first.role),
                status: first.survived ? 'alive' : 'dead',
                survived: first.survived
            };
        });

        // 後續所有區塊一路更新，最後出現的狀態即最終狀態。
        blocks.forEach((block) => {
            const rows = parsePlayerRowsFromBlock(block);

            Object.keys(rows).forEach((seatKey) => {
                const seat = Number(seatKey);
                const row = rows[seat];

                if (!playerMap[seat]) {
                    playerMap[seat] = {
                        seat_number: seat,
                        seat,
                        name: row.name,
                        initial_character: row.role,
                        initial_role: row.role,
                        final_character: row.role,
                        final_role: row.role,
                        alignment: getAlignmentByRole(row.role),
                        status: row.survived ? 'alive' : 'dead',
                        survived: row.survived
                    };
                } else {
                    const finalCharacter = inferFinalCharacterFromParsedRow(row);

                    if (row.name) {
                        playerMap[seat].name = row.name;
                    }

                    playerMap[seat].final_character = finalCharacter;
                    playerMap[seat].final_role = finalCharacter;
                    playerMap[seat].alignment = getAlignmentByRole(finalCharacter);
                    playerMap[seat].status = row.survived ? 'alive' : 'dead';
                    playerMap[seat].survived = row.survived;
                }
            });
        });

        const players = Object.values(playerMap)
            .sort((a, b) => a.seat_number - b.seat_number)
            .filter(p => p.name);

        if (players.length === 0) {
            alert('無法自動解析玩家，請確認格式或手動輸入。');
            return;
        }

        renderPlayersFromData(players);
        updateRowNumbers();
        saveDraft();

        alert(`已自動解析 ${players.length} 位玩家。`);
    };

    document.getElementById('record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!isLoggedIn() || !currentAuth.can_upload) {
            alert(isLoggedIn() ? '此 LINE 帳號尚未開放上傳權限。' : '請先使用 LINE 登入。');

            if (!isLoggedIn()) {
                window.location.href = lineLoginUrl();
            }

            return;
        }

        const btn = document.getElementById('submit-btn');

        btn.disabled = true;
        btn.innerText = '寫入中...';

        const payload = {
            script: document.getElementById('match-script').value,
            date: document.getElementById('match-date').value,
            location: document.getElementById('match-location').value || '未知',
            storyteller: document.getElementById('match-storyteller').value,
            winning_team: document.getElementById('match-winner').value,
            replay_log: document.getElementById('log-input').value,
            players: Array.from(document.querySelectorAll('.player-row'))
                .map((row, index) => ({
                    seat_number: index + 1,
                    seat: index + 1,
                    name: row.querySelector('.p-name').value.trim(),
                    initial_character: row.querySelector('.p-initial').value.trim(),
                    initial_role: row.querySelector('.p-initial').value.trim(),
                    final_character: row.querySelector('.p-final').value.trim(),
                    final_role: row.querySelector('.p-final').value.trim(),
                    alignment: row.querySelector('.p-team').value,
                    status: row.querySelector('.p-status').value,
                    survived: row.querySelector('.p-status').value === 'alive'
                }))
                .filter(p => p.name !== '')
        };

        try {
            const resp = await fetch(`${apiBase()}/api/matches`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (resp.ok) {
                alert('上傳成功！');
                localStorage.removeItem('botc_record_draft');
                clearForm();
                loadRecentMatches();
            } else {
                const err = await resp.json().catch(() => ({}));
                alert('失敗: ' + (err.detail || '沒有上傳權限'));
                await refreshAuthState();
            }
        } catch (err) {
            alert('連線錯誤，請稍後再試');
        } finally {
            renderAuthState();
        }
    });

    const refreshPlayerDatalist = async () => {
        const datalist = document.getElementById('player-names-list');

        if (!datalist) return;

        try {
            const resp = await fetch(`${apiBase()}/api/players`);

            if (resp.ok) {
                const names = await resp.json();

                datalist.innerHTML = names
                    .map(name => `<option value="${escapeHtml(name)}">`)
                    .join('');
            }
        } catch (err) {}
    };

    window.importFile = (input) => {
        const file = input.files[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = (e) => {
            document.getElementById('log-input').value = e.target.result;
            autoFillFromLog();
        };

        reader.readAsText(file);
    };

    initRecord();
}
