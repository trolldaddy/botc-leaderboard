{
    const apiBase = window.API_BASE || '';
    let adminUsers = [];
    let adminReplays = [];
    let currentMode = 'matches';
    let selectedUserId = null;
    let selectedMatchId = null;
    let isSaving = false;

    const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    const injectAdminPolish = () => {
        if (!document.getElementById('admin-polish-style')) {
            const style = document.createElement('style');
            style.id = 'admin-polish-style';
            style.textContent = `
                #admin-detail-area input,#admin-detail-area select,#admin-detail-area textarea{width:100%;min-width:0;box-sizing:border-box;background:rgba(17,22,38,.96)!important;color:#f6f7fb!important;border:1px solid rgba(85,101,148,.58)!important;border-radius:7px;padding:.56rem .65rem;font:inherit;line-height:1.25;outline:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
                #admin-detail-area input,#admin-detail-area select{height:38px}#admin-detail-area textarea{line-height:1.6}#admin-detail-area input:focus,#admin-detail-area select:focus,#admin-detail-area textarea:focus{border-color:rgba(255,183,3,.72)!important;box-shadow:0 0 0 2px rgba(255,183,3,.12)}#admin-detail-area select option{background:#111626;color:#f6f7fb}.admin-actions button:disabled{opacity:.55;cursor:wait}
                .admin-player-table{border-collapse:separate!important;border-spacing:0 .45rem!important;padding:.35rem}.admin-player-table th,.admin-player-table td{padding:.25rem .35rem!important;border-bottom:0!important}.admin-player-row td{background:rgba(20,26,46,.78)}.admin-player-row td:first-child{border-radius:8px 0 0 8px}.admin-player-row td:last-child{border-radius:0 8px 8px 0}
                .admin-match-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.8rem;align-items:center}.admin-match-title{color:#fff;font-weight:900;font-size:1rem;margin-bottom:.35rem}.admin-match-meta{display:flex;flex-wrap:wrap;gap:.25rem .55rem;color:var(--text-muted);font-size:.74rem;line-height:1.5}.admin-match-side{display:grid;gap:.45rem;justify-items:end}.admin-date-pill{min-width:56px;padding:.45rem .5rem;border-radius:8px;background:rgba(0,0,0,.35);text-align:center;line-height:1.15;color:#fff;font-weight:800}.admin-date-pill span{display:block;color:var(--accent-gold);margin-top:.15rem}.admin-result-badge{min-width:72px;border-radius:8px;padding:.45rem .55rem;text-align:center;color:#d9edff;background:rgba(69,123,157,.32);border:1px solid rgba(168,218,220,.18);font-weight:900;font-size:.78rem}.admin-result-badge.evil{color:#ffd0d4;background:rgba(230,57,70,.28);border-color:rgba(230,57,70,.24)}
                .admin-save-overlay{position:fixed;inset:0;z-index:9999;display:none;place-items:center;background:rgba(0,0,0,.42);backdrop-filter:blur(3px)}.admin-save-overlay.is-visible{display:grid}.admin-save-dialog{min-width:220px;display:flex;align-items:center;justify-content:center;gap:.75rem;padding:1.1rem 1.35rem;border-radius:10px;background:rgba(18,22,34,.96);color:#fff;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 50px rgba(0,0,0,.4)}.admin-save-dialog i{color:var(--accent-gold)}@media(max-width:760px){.admin-match-card{grid-template-columns:1fr}.admin-match-side{justify-items:start;grid-template-columns:auto auto}}
            `;
            document.head.appendChild(style);
        }
        if (!document.getElementById('admin-save-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'admin-save-overlay';
            overlay.className = 'admin-save-overlay';
            overlay.setAttribute('aria-live', 'polite');
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = '<div class="admin-save-dialog"><i class="fa-solid fa-circle-notch fa-spin"></i><strong id="admin-save-message">儲存中...</strong></div>';
            document.body.appendChild(overlay);
        }
    };

    const setSaving = (saving, message = '儲存中...') => {
        isSaving = saving;
        const overlay = document.getElementById('admin-save-overlay');
        const messageEl = document.getElementById('admin-save-message');
        if (messageEl) messageEl.textContent = message;
        if (overlay) {
            overlay.classList.toggle('is-visible', saving);
            overlay.setAttribute('aria-hidden', saving ? 'false' : 'true');
        }
        document.querySelectorAll('[data-admin-save]').forEach((button) => { button.disabled = saving; });
    };

    const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const toDateInput = (value) => {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
    };

    const fmtDate = (value) => toDateInput(value) || '未知日期';

    const splitDate = (value) => {
        const dateText = fmtDate(value);
        const parts = dateText.split('-');
        if (parts.length !== 3) return { year: '----', day: '--/--' };
        return { year: parts[0], day: `${Number(parts[1])}/${Number(parts[2])}` };
    };

    const fmtDateTime = (value) => {
        if (!value) return '未知';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '未知';
        return d.toLocaleString('zh-TW', { hour12: false });
    };

    const requireOk = async (resp) => {
        if (resp.ok) return resp;
        let message = '操作失敗';
        try {
            const body = await resp.json();
            message = body.detail || message;
        } catch (err) {}
        throw new Error(message);
    };

    const getMatchPlayers = (match) => Array.isArray(match?.players) ? match.players : [];
    const getMatchUploaderLineId = (match) => match.uploaded_by_line_user_id || match.uploader_line_user_id || match.line_user_id || '';
    const getUserRecords = (user) => adminReplays.filter((match) => getMatchUploaderLineId(match) && getMatchUploaderLineId(match) === user.line_user_id);
    const activeUser = () => adminUsers.find((user) => user.id === selectedUserId) || adminUsers[0] || null;
    const activeMatch = () => adminReplays.find((match) => match.id === selectedMatchId) || adminReplays[0] || null;

    const statusChip = (match) => match.winning_team === 'evil'
        ? '<span class="admin-chip danger">邪惡獲勝</span>'
        : '<span class="admin-chip good">善良獲勝</span>';

    const resultBadge = (match) => `<div class="admin-result-badge ${match.winning_team === 'evil' ? 'evil' : ''}">${match.winning_team === 'evil' ? '邪惡<br>獲勝' : '善良<br>獲勝'}</div>`;

    const setModeButtons = () => {
        document.getElementById('admin-mode-matches')?.classList.toggle('is-active', currentMode === 'matches');
        document.getElementById('admin-mode-users')?.classList.toggle('is-active', currentMode === 'users');
    };

    const renderSidebar = () => {
        setModeButtons();
        const area = document.getElementById('admin-sidebar-list');
        if (!area) return;
        if (currentMode === 'users') {
            if (!adminUsers.length) {
                area.innerHTML = '<div class="admin-list-status">目前還沒有 LINE 登入紀錄。</div>';
                return;
            }
            area.innerHTML = `<div class="admin-sidebar-list">${adminUsers.map((user) => `
                <button class="admin-list-item ${user.id === selectedUserId ? 'is-active' : ''}" type="button" onclick="selectAdminUser(${user.id})">
                    <div class="admin-list-title">${escapeHtml(user.display_name || 'LINE 使用者')}</div>
                    <div class="admin-meta">${escapeHtml(user.line_user_id || '')}</div>
                    <div class="admin-chip-row">
                        ${user.is_admin ? '<span class="admin-chip gold"><i class="fa-solid fa-shield-halved"></i> 管理員</span>' : ''}
                        ${user.is_banned ? '<span class="admin-chip danger">已 BAN</span>' : '<span class="admin-chip good">可登入</span>'}
                        ${user.is_allowed ? '<span class="admin-chip good">允許上傳</span>' : '<span class="admin-chip">未開放上傳</span>'}
                        <span class="admin-chip">${user.upload_count || 0} 筆</span>
                    </div>
                </button>`).join('')}</div>`;
            return;
        }
        if (!adminReplays.length) {
            area.innerHTML = '<div class="admin-list-status">目前還沒有 Replay 紀錄。</div>';
            return;
        }
        area.innerHTML = `<div class="admin-sidebar-list">${adminReplays.map((match) => {
            const date = splitDate(match.date || match.created_at);
            return `
                <button class="admin-list-item ${match.id === selectedMatchId ? 'is-active' : ''}" type="button" onclick="selectAdminMatch(${match.id})">
                    <div class="admin-match-card">
                        <div>
                            <div class="admin-match-title">#${match.id} ${escapeHtml(match.script || '未知劇本')}</div>
                            <div class="admin-match-meta">
                                <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(match.location || '未知地點')}</span>
                                <span><i class="fa-solid fa-user-tie"></i> ${escapeHtml(match.storyteller || '未知說書人')}</span>
                                <span><i class="fa-solid fa-users"></i> ${getMatchPlayers(match).length || 0} 人</span>
                            </div>
                            <div class="admin-chip-row"><span class="admin-chip">上傳：${escapeHtml(match.uploaded_by || '未知')}</span></div>
                        </div>
                        <div class="admin-match-side"><div class="admin-date-pill">${date.year}<span>${date.day}</span></div>${resultBadge(match)}</div>
                    </div>
                </button>`;
        }).join('')}</div>`;
    };

    const renderDetail = () => {
        const area = document.getElementById('admin-detail-area');
        if (!area) return;
        if (currentMode === 'users') renderUserDetail(activeUser());
        else renderMatchDetail(activeMatch());
    };

    const renderUserDetail = (user) => {
        const area = document.getElementById('admin-detail-area');
        if (!area) return;
        if (!user) {
            area.innerHTML = '<div class="admin-list-status">請先選擇一個說書人。</div>';
            return;
        }
        const records = getUserRecords(user);
        area.innerHTML = `
            <div class="admin-detail-head">
                <div>
                    <div class="admin-detail-title">${escapeHtml(user.display_name || 'LINE 使用者')}</div>
                    <div class="admin-meta">LINE ID：${escapeHtml(user.line_user_id || '')}</div>
                    <div class="admin-meta">最近登入：${fmtDateTime(user.last_login_at)}</div>
                    <div class="admin-chip-row">
                        ${user.is_admin ? '<span class="admin-chip gold"><i class="fa-solid fa-shield-halved"></i> 管理員</span>' : ''}
                        ${user.is_banned ? '<span class="admin-chip danger">已 BAN</span>' : '<span class="admin-chip good">可登入</span>'}
                        ${user.is_allowed ? '<span class="admin-chip good">允許上傳</span>' : '<span class="admin-chip">未開放上傳</span>'}
                        <span class="admin-chip">${records.length} 筆上傳</span>
                    </div>
                </div>
                <div class="admin-actions">
                    <button class="btn btn-outline" onclick="toggleUserAllowed(${user.id}, ${!user.is_allowed})">${user.is_allowed ? '移除上傳權限' : '允許上傳'}</button>
                    <button class="btn" style="background:${user.is_banned ? 'rgba(69,123,157,0.8)' : 'var(--accent-red)'}; color:#fff;" onclick="toggleUserBan(${user.id}, ${!user.is_banned})">${user.is_banned ? '解除 BAN' : 'BAN'}</button>
                </div>
            </div>
            <div class="admin-section-title"><i class="fa-solid fa-scroll"></i> 此帳號上傳的戰績</div>
            <div class="admin-user-records">
                ${records.length ? records.map((match) => `
                    <div class="admin-user-record">
                        <div><div class="admin-list-title">#${match.id} ${escapeHtml(match.script || '未知劇本')}</div><div class="admin-meta">${fmtDate(match.date || match.created_at)} ｜ ${escapeHtml(match.location || '未知地點')} ｜ ${escapeHtml(match.storyteller || '未知說書人')}</div></div>
                        <button class="btn btn-outline" onclick="selectAdminMatchFromUser(${match.id})">編輯</button>
                        <button class="btn" style="background:var(--accent-red); color:#fff;" onclick="deleteReplay(${match.id})">刪除</button>
                    </div>`).join('') : '<div class="admin-list-status">這個帳號目前沒有上傳戰績。</div>'}
            </div>`;
    };

    const playerRows = (players = []) => players.map((p, index) => `
        <tr class="admin-player-row">
            <td><input class="dark-input js-player-seat" type="number" min="1" value="${escapeHtml(p.seat_number || p.seat || index + 1)}"></td>
            <td><input class="dark-input js-player-name" value="${escapeHtml(p.player_name || p.name || '')}"></td>
            <td><input class="dark-input js-player-initial" value="${escapeHtml(p.initial_character || p.initial_role || '')}"></td>
            <td><input class="dark-input js-player-final" value="${escapeHtml(p.final_character || p.final_role || '')}"></td>
            <td><select class="dark-input js-player-alignment"><option value="good" ${(p.alignment || 'good') === 'good' ? 'selected' : ''}>善良</option><option value="evil" ${p.alignment === 'evil' ? 'selected' : ''}>邪惡</option></select></td>
            <td><select class="dark-input js-player-survived"><option value="alive" ${p.survived !== false ? 'selected' : ''}>存活</option><option value="dead" ${p.survived === false ? 'selected' : ''}>死亡</option></select></td>
            <td><button class="admin-icon-btn" type="button" onclick="removeAdminPlayerRow(this)" title="刪除玩家"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`).join('');

    const renderMatchDetail = (match) => {
        const area = document.getElementById('admin-detail-area');
        if (!area) return;
        if (!match) {
            area.innerHTML = '<div class="admin-list-status">請先選擇一筆戰績。</div>';
            return;
        }
        const players = getMatchPlayers(match);
        area.innerHTML = `
            <div id="admin-match-detail" data-match-id="${match.id}">
                <div class="admin-detail-head">
                    <div><div class="admin-detail-title">#${match.id} ${escapeHtml(match.script || '未知劇本')}</div><div class="admin-meta">上傳人：${escapeHtml(match.uploaded_by || '未知')} ｜ 建立時間：${fmtDateTime(match.created_at)} ｜ ${players.length} 人</div><div class="admin-chip-row">${statusChip(match)}<span class="admin-chip">${escapeHtml(match.location || '未知地點')}</span></div></div>
                    <div class="admin-actions"><button class="btn btn-outline" data-admin-save onclick="saveSelectedMatch()"><i class="fa-solid fa-floppy-disk"></i> 儲存修改</button><button class="btn" style="background:var(--accent-red); color:#fff;" onclick="deleteReplay(${match.id})">刪除整筆</button></div>
                </div>
                <div class="admin-form-grid">
                    <div class="admin-field span-2"><label>劇本</label><input class="dark-input js-script" value="${escapeHtml(match.script || '')}"></div>
                    <div class="admin-field"><label>日期</label><input class="dark-input js-date" type="date" value="${toDateInput(match.date)}"></div>
                    <div class="admin-field"><label>勝利陣營</label><select class="dark-input js-winning-team"><option value="good" ${match.winning_team === 'good' ? 'selected' : ''}>善良</option><option value="evil" ${match.winning_team === 'evil' ? 'selected' : ''}>邪惡</option></select></div>
                    <div class="admin-field span-2"><label>地點</label><input class="dark-input js-location" value="${escapeHtml(match.location || '')}"></div>
                    <div class="admin-field span-2"><label>說書人名稱</label><input class="dark-input js-storyteller" value="${escapeHtml(match.storyteller || '')}"></div>
                </div>
                <div class="admin-section-title"><i class="fa-solid fa-users"></i> 參與玩家</div>
                <div class="admin-player-table-wrap"><table class="admin-player-table"><thead><tr><th>No.</th><th>玩家暱稱</th><th>初始角色</th><th>最終角色</th><th>最終陣營</th><th>存活狀態</th><th></th></tr></thead><tbody class="js-player-body">${playerRows(players)}</tbody></table></div>
                <button class="admin-add-player" type="button" onclick="addAdminPlayerRow()"><i class="fa-solid fa-plus"></i> 新增玩家</button>
                <div class="admin-section-title"><i class="fa-solid fa-file-lines"></i> Replay 文字</div>
                <textarea class="dark-input admin-replay-log js-replay-log">${escapeHtml(match.replay_log || '')}</textarea>
            </div>`;
    };

    const collectPlayers = (root) => Array.from(root.querySelectorAll('.admin-player-row')).map((row, index) => ({
        seat_number: Number(row.querySelector('.js-player-seat')?.value) || index + 1,
        player_name: row.querySelector('.js-player-name')?.value.trim() || '',
        initial_character: row.querySelector('.js-player-initial')?.value.trim() || '',
        final_character: row.querySelector('.js-player-final')?.value.trim() || '',
        alignment: row.querySelector('.js-player-alignment')?.value || 'good',
        survived: row.querySelector('.js-player-survived')?.value !== 'dead',
    })).filter((player) => player.player_name || player.initial_character || player.final_character);

    const ensureSelections = () => {
        if (!adminReplays.some((match) => match.id === selectedMatchId)) selectedMatchId = adminReplays[0]?.id ?? null;
        if (!adminUsers.some((user) => user.id === selectedUserId)) selectedUserId = adminUsers[0]?.id ?? null;
    };

    window.setAdminMode = (mode) => { currentMode = mode === 'users' ? 'users' : 'matches'; ensureSelections(); renderSidebar(); renderDetail(); };
    window.selectAdminUser = (id) => { selectedUserId = id; currentMode = 'users'; renderSidebar(); renderDetail(); };
    window.selectAdminMatch = (id) => { selectedMatchId = id; currentMode = 'matches'; renderSidebar(); renderDetail(); };
    window.selectAdminMatchFromUser = (id) => { selectedMatchId = id; currentMode = 'matches'; renderSidebar(); renderDetail(); };

    window.addAdminPlayerRow = () => {
        const body = document.querySelector('#admin-match-detail .js-player-body');
        if (!body) return;
        const index = body.querySelectorAll('tr').length + 1;
        body.insertAdjacentHTML('beforeend', playerRows([{ seat_number: index, alignment: 'good', survived: true }]));
    };

    window.removeAdminPlayerRow = (button) => { button.closest('tr')?.remove(); };

    window.refreshAdminPanel = async () => {
        injectAdminPolish();
        const sidebar = document.getElementById('admin-sidebar-list');
        const detail = document.getElementById('admin-detail-area');
        if (sidebar) sidebar.innerHTML = '<div class="admin-list-status">正在讀取清單...</div>';
        if (detail) detail.innerHTML = '<div class="admin-list-status">正在整理資料...</div>';
        try {
            const [usersResp, replaysResp] = await Promise.all([
                fetch(`${apiBase}/api/admin/users`, { credentials: 'same-origin' }).then(requireOk),
                fetch(`${apiBase}/api/admin/replays`, { credentials: 'same-origin' }).then(requireOk),
            ]);
            adminUsers = await usersResp.json();
            adminReplays = await replaysResp.json();
            ensureSelections();
            renderSidebar();
            renderDetail();
        } catch (err) {
            const message = escapeHtml(err.message || '無法讀取管理後台');
            if (sidebar) sidebar.innerHTML = `<div style="color:var(--accent-red); padding:1rem 0;">${message}</div>`;
            if (detail) detail.innerHTML = `<div style="color:var(--accent-red); padding:1rem 0;">${message}</div>`;
        }
    };

    window.toggleUserBan = async (id, isBanned) => {
        try {
            await fetch(`${apiBase}/api/admin/users/${id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_banned: isBanned }) }).then(requireOk);
            selectedUserId = id;
            await window.refreshAdminPanel();
        } catch (err) { alert(err.message); }
    };

    window.toggleUserAllowed = async (id, isAllowed) => {
        try {
            await fetch(`${apiBase}/api/admin/users/${id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_allowed: isAllowed }) }).then(requireOk);
            selectedUserId = id;
            await window.refreshAdminPanel();
        } catch (err) { alert(err.message); }
    };

    window.saveSelectedMatch = async () => {
        if (isSaving) return;
        const root = document.getElementById('admin-match-detail');
        if (!root) return;
        const id = Number(root.dataset.matchId);
        const payload = {
            script: root.querySelector('.js-script')?.value || '',
            date: root.querySelector('.js-date')?.value || '',
            location: root.querySelector('.js-location')?.value || '',
            storyteller: root.querySelector('.js-storyteller')?.value || '',
            winning_team: root.querySelector('.js-winning-team')?.value || 'good',
            replay_log: root.querySelector('.js-replay-log')?.value || '',
            players: collectPlayers(root),
        };
        try {
            setSaving(true, '儲存中...');
            await nextPaint();
            await fetch(`${apiBase}/api/admin/matches/${id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(requireOk);
            selectedMatchId = id;
            setSaving(false);
            alert('儲存完成');
            await window.refreshAdminPanel();
        } catch (err) {
            setSaving(false);
            alert(err.message);
        }
    };

    window.deleteReplay = async (id) => {
        if (!confirm(`確定刪除 #${id} 這筆 Replay 與所有玩家紀錄嗎？`)) return;
        try {
            await fetch(`${apiBase}/api/admin/matches/${id}`, { method: 'DELETE', credentials: 'same-origin' }).then(requireOk);
            if (selectedMatchId === id) selectedMatchId = null;
            await window.refreshAdminPanel();
        } catch (err) { alert(err.message); }
    };

    injectAdminPolish();
    window.refreshAdminPanel();
}
