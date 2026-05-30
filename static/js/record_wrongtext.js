/**
 * BOTC Stats - Record Match page
 */
function setupRoleDatalist() {
    let datalist = document.getElementById('all-roles-list');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'all-roles-list';
        document.body.appendChild(datalist);
    }
    if (window.MASTER_ROLE_DB && window.MASTER_ROLE_DB.length > 0) {
        datalist.innerHTML = window.MASTER_ROLE_DB.map(role => `<option value="${role.name}">`).join('');
    }
}

window.addEventListener('DOMContentLoaded', setupRoleDatalist);

{
    let currentAuth = { authenticated: false, logged_in: false, can_upload: false };
    const apiBase = () => window.API_BASE || '';
    const isLoggedIn = () => Boolean(currentAuth.logged_in || currentAuth.authenticated);
    const defaultLocations = ['拉普拉斯', '線上', '台北', '新北', '桃園', '台中', '台南', '高雄', '其他'];
    const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    const injectRecordPolish = () => {
        if (document.getElementById('record-select-polish')) return;
        const style = document.createElement('style');
        style.id = 'record-select-polish';
        style.textContent = `
            #record-form select,.player-row select,#match-location,#match-winner{background:rgba(15,23,42,.96)!important;color:#f8fafc!important;border:1px solid rgba(51,65,85,.95)!important;color-scheme:dark;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
            #record-form select:focus,.player-row select:focus,#match-location:focus,#match-winner:focus{border-color:rgba(255,183,3,.72)!important;box-shadow:0 0 0 2px rgba(255,183,3,.12)!important;outline:none}
            #record-form select option,.player-row select option,#match-location option,#match-winner option{background:#0f172a!important;color:#f8fafc!important}
        `;
        document.head.appendChild(style);
    };

    const ensureLocationOption = (select, value) => {
        if (!select || !value) return;
        const exists = Array.from(select.options).some((opt) => opt.value === value);
        if (!exists) select.appendChild(new Option(value, value));
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
            const resp = await fetch(`${apiBase()}/api/locations`, { credentials: 'same-origin' });
            if (!resp.ok) throw new Error('load failed');
            const locations = await resp.json();
            const names = [...new Set([...(locations || []).map((loc) => loc.name).filter(Boolean), ...defaultLocations])];
            select.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
        } catch (err) {
            const names = [...new Set([...Array.from(select.options).map((opt) => opt.value), ...defaultLocations])];
            select.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
        }
        ensureLocationOption(select, selected);
        if (selected) select.value = selected;
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
        btn.innerHTML = enabled ? `<i class="fa-solid fa-cloud-arrow-up"></i> 確認並提交戰績` : `<i class="fa-solid fa-lock"></i> 請先使用 LINE 登入`;
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
            const resp = await fetch(`${apiBase()}/api/me`, { credentials: 'same-origin' });
            currentAuth = resp.ok ? await resp.json() : { logged_in: false, authenticated: false, can_upload: false };
        } catch (err) {
            currentAuth = { logged_in: false, authenticated: false, can_upload: false };
        }
        renderAuthState();
    };

    const initRecord = async () => {
        injectRecordPolish();
        setupRoleDatalist();
        const dateInput = document.getElementById('match-date');
        if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
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
            renderPlayersFromData((data.players || []).map(p => ({ name: p.name, initial_character: p.role, final_character: p.actualRole || p.role, survived: p.isAlive, alignment: p.team || 'good' })));
            localStorage.removeItem('botc_transfer_data');
        } else if (draftData) {
            restoreDraft(JSON.parse(draftData));
        } else {
            list.innerHTML = '';
            for (let i = 0; i < 12; i++) addPlayerRow();
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
            if (recent.length === 0) { container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">尚未有紀錄</div>`; return; }
            container.innerHTML = recent.map(m => {
                const d = new Date(m.date);
                const isGood = m.winning_team === 'good';
                return `<div class="side-match-item"><div class="side-match-flex"><div class="side-left-info"><div class="m-title" title="${escapeHtml(m.script || '')}">${escapeHtml(m.script || '未知劇本')}</div><div class="m-meta"><span><i class="fa-solid fa-users"></i> ${m.players?.length || 0}人</span><span><i class="fa-solid fa-user-tie"></i> ${escapeHtml(m.storyteller || '未知')}</span></div><div class="m-meta"><span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(m.location || '未知')}</span></div></div><div class="side-mini-box date-box"><div class="box-label">${Number.isNaN(d.getTime()) ? '' : d.getFullYear()}</div><div class="box-value">${Number.isNaN(d.getTime()) ? '-' : `${d.getMonth()+1}/${d.getDate()}`}</div></div><div class="side-mini-box status-box ${isGood ? 'box-good' : 'box-evil'}"><div class="box-value">${isGood ? '善良' : '邪惡'}</div><div class="box-label">獲勝</div></div></div></div>`;
            }).join('');
        } catch (err) {
            container.innerHTML = `<div style="color: var(--accent-red); padding: 1rem; text-align:center;">讀取失敗</div>`;
        }
    };

    window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');
        if (!list) return;
        const index = list.children.length + 1;
        const alignment = data?.alignment || (data?.team === 'evil' ? 'evil' : 'good');
        const row = document.createElement('div');
        row.className = 'player-row grid grid-cols-12 gap-2 items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800';
        row.innerHTML = `<div class="col-span-1 text-center font-bold text-slate-300">${index}</div><div class="col-span-3 sm:col-span-2"><label class="sm:hidden text-[10px] text-slate-500 mb-1 block">玩家暱稱</label><input type="text" class="p-name w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-yellow-500" list="player-names-list" value="${escapeHtml(data?.name || '')}" placeholder="暱稱" oninput="saveDraft()"></div><div class="col-span-1 sm:col-span-2"><label class="sm:hidden text-[10px] text-slate-500 mb-1 block">初始角色</label><input type="text" class="p-initial w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-yellow-500" list="all-roles-list" value="${escapeHtml(data?.initial_character || '')}" placeholder="初始" oninput="saveDraft()"></div><div class="col-span-1 sm:col-span-2"><label class="sm:hidden text-[10px] text-slate-500 mb-1 block">最終角色</label><input type="text" class="p-final w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-yellow-500" list="all-roles-list" value="${escapeHtml(data?.final_character || '')}" placeholder="最終" oninput="saveDraft()"></div><div class="col-span-1 sm:col-span-2"><label class="sm:hidden text-[10px] text-slate-500 mb-1 block">陣營</label><select class="p-team w-full bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-200 outline-none" oninput="saveDraft()"><option value="good" ${alignment === 'good' ? 'selected' : ''}>善良</option><option value="evil" ${alignment === 'evil' ? 'selected' : ''}>邪惡</option></select></div><div class="col-span-1 sm:col-span-2"><label class="sm:hidden text-[10px] text-slate-500 mb-1 block">狀態</label><select class="p-status w-full bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-200 outline-none" oninput="saveDraft()"><option value="alive" ${data?.survived !== false ? 'selected' : ''}>存活</option><option value="dead" ${data?.survived === false ? 'selected' : ''}>死亡</option></select></div><div class="col-span-1 text-center"><button type="button" onclick="this.closest('.player-row').remove(); renumberRows(); saveDraft();" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button></div>`;
        list.appendChild(row);
    };

    window.renumberRows = () => { document.querySelectorAll('.player-row').forEach((row, i) => { row.querySelector('div').textContent = i + 1; }); };
    window.renderPlayersFromData = (players) => { const list = document.getElementById('players-list'); if (!list) return; list.innerHTML = ''; players.forEach(p => addPlayerRow(p)); if (players.length === 0) addPlayerRow(); };
    window.autoFillFromLog = () => { const text = document.getElementById('log-input').value; if (!text) return alert('請先貼上文字紀錄'); const players = []; text.split('\n').forEach(line => { const match = line.match(/^(\d+)\.?\s*([^\s]+)\s+(.+)$/); if (match && parseInt(match[1], 10) < 20) players.push({ name: match[2], initial_character: '', final_character: '', survived: true }); }); if (players.length > 0) { renderPlayersFromData(players); saveDraft(); } else alert('無法自動解析玩家，請確認格式或手動輸入。'); };
    window.saveDraft = () => { localStorage.setItem('botc_record_draft', JSON.stringify(collectFormData())); };

    const collectFormData = () => ({ script: document.getElementById('match-script')?.value || '', date: document.getElementById('match-date')?.value || '', location: document.getElementById('match-location')?.value || '', storyteller: document.getElementById('match-storyteller')?.value || '', winner: document.getElementById('match-winner')?.value || 'good', log: document.getElementById('log-input')?.value || '', players: Array.from(document.querySelectorAll('.player-row')).map(row => ({ name: row.querySelector('.p-name').value, initial_character: row.querySelector('.p-initial').value, final_character: row.querySelector('.p-final').value, alignment: row.querySelector('.p-team').value, survived: row.querySelector('.p-status').value === 'alive' })) });

    window.restoreDraft = (data) => {
        document.getElementById('match-script').value = data.script || '';
        document.getElementById('match-date').value = data.date || '';
        const locationSelect = document.getElementById('match-location');
        ensureLocationOption(locationSelect, data.location || '');
        if (locationSelect) locationSelect.value = data.location || '';
        document.getElementById('match-storyteller').value = data.storyteller || '';
        document.getElementById('match-winner').value = data.winner || 'good';
        document.getElementById('log-input').value = data.log || '';
        renderPlayersFromData(data.players || []);
    };

    window.clearForm = () => {
        if (!confirm('確定清空目前表單？')) return;
        localStorage.removeItem('botc_record_draft');
        document.getElementById('record-form').reset();
        document.getElementById('players-list').innerHTML = '';
        for (let i = 0; i < 12; i++) addPlayerRow();
        document.getElementById('match-date').value = new Date().toISOString().split('T')[0];
        loadLocationOptions();
        applyDefaultStoryteller();
    };
    window.clearFullForm = window.clearForm;

    document.getElementById('record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isLoggedIn() || !currentAuth.can_upload) { alert(isLoggedIn() ? '此 LINE 帳號尚未開放上傳權限。' : '請先使用 LINE 登入。'); if (!isLoggedIn()) window.location.href = lineLoginUrl(); return; }
        const btn = document.getElementById('submit-btn');
        btn.disabled = true;
        btn.innerText = '寫入中...';
        const payload = { script: document.getElementById('match-script').value, date: document.getElementById('match-date').value, location: document.getElementById('match-location').value || '未知', storyteller: document.getElementById('match-storyteller').value, winning_team: document.getElementById('match-winner').value, replay_log: document.getElementById('log-input').value, players: Array.from(document.querySelectorAll('.player-row')).map((row, index) => ({ seat_number: index + 1, seat: index + 1, name: row.querySelector('.p-name').value.trim(), initial_character: row.querySelector('.p-initial').value.trim(), initial_role: row.querySelector('.p-initial').value.trim(), final_character: row.querySelector('.p-final').value.trim(), final_role: row.querySelector('.p-final').value.trim(), alignment: row.querySelector('.p-team').value, status: row.querySelector('.p-status').value, survived: row.querySelector('.p-status').value === 'alive' })).filter(p => p.name !== '') };
        try {
            const resp = await fetch(`${apiBase()}/api/matches`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (resp.ok) { alert('上傳成功！'); localStorage.removeItem('botc_record_draft'); clearForm(); loadRecentMatches(); }
            else { const err = await resp.json().catch(() => ({})); alert('失敗: ' + (err.detail || '沒有上傳權限')); await refreshAuthState(); }
        } catch (err) { alert('連線錯誤，請稍後再試'); }
        finally { renderAuthState(); }
    });

    const refreshPlayerDatalist = async () => {
        const datalist = document.getElementById('player-names-list');
        if (!datalist) return;
        try { const resp = await fetch(`${apiBase()}/api/players`); if (resp.ok) { const names = await resp.json(); datalist.innerHTML = names.map(name => `<option value="${escapeHtml(name)}">`).join(''); } } catch (err) {}
    };

    window.importFile = (input) => { const file = input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { document.getElementById('log-input').value = e.target.result; autoFillFromLog(); }; reader.readAsText(file); };

    initRecord();
}
