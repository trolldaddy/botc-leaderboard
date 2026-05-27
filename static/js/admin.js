{
    const apiBase = window.API_BASE || '';
    let adminUsers = [];
    let adminReplays = [];

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const toDateInput = (value) => {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
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

    const playerRows = (players = []) => players.map((p, index) => `
        <tr class="admin-player-row">
            <td><input class="dark-input js-player-seat" type="number" min="1" value="${escapeHtml(p.seat_number || p.seat || index + 1)}"></td>
            <td><input class="dark-input js-player-name" value="${escapeHtml(p.player_name || p.name || '')}"></td>
            <td><input class="dark-input js-player-initial" value="${escapeHtml(p.initial_character || p.initial_role || '')}"></td>
            <td><input class="dark-input js-player-final" value="${escapeHtml(p.final_character || p.final_role || '')}"></td>
            <td>
                <select class="dark-input js-player-alignment">
                    <option value="good" ${(p.alignment || 'good') === 'good' ? 'selected' : ''}>善良</option>
                    <option value="evil" ${p.alignment === 'evil' ? 'selected' : ''}>邪惡</option>
                </select>
            </td>
            <td>
                <select class="dark-input js-player-survived">
                    <option value="alive" ${p.survived !== false ? 'selected' : ''}>存活</option>
                    <option value="dead" ${p.survived === false ? 'selected' : ''}>死亡</option>
                </select>
            </td>
            <td><button class="admin-icon-btn" type="button" onclick="removeAdminPlayerRow(this)" title="刪除玩家"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');

    const renderUsers = () => {
        const area = document.getElementById('admin-users-area');
        if (!area) return;
        if (!adminUsers.length) {
            area.innerHTML = '<div class="admin-list-status">目前還沒有 LINE 登入紀錄。</div>';
            return;
        }
        area.innerHTML = `<div class="admin-user-list">
            ${adminUsers.map(user => `
                <div class="admin-user-item">
                    <div class="admin-user-top">
                        <div>
                            <div class="admin-title">${escapeHtml(user.display_name || 'LINE 使用者')}</div>
                            <div class="admin-meta">${escapeHtml(user.line_user_id)}</div>
                            <div class="admin-chip-row">
                                ${user.is_admin ? '<span class="admin-chip gold"><i class="fa-solid fa-shield-halved"></i> 管理員</span>' : ''}
                                ${user.is_banned ? '<span class="admin-chip danger"><i class="fa-solid fa-ban"></i> 已 BAN</span>' : '<span class="admin-chip good"><i class="fa-solid fa-circle-check"></i> 可登入</span>'}
                                ${user.is_allowed ? '<span class="admin-chip good">允許上傳</span>' : '<span class="admin-chip">未白名單</span>'}
                                <span class="admin-chip">${user.upload_count || 0} 筆上傳</span>
                            </div>
                            <div class="admin-meta" style="margin-top:0.45rem;">最近登入：${fmtDateTime(user.last_login_at)}</div>
                        </div>
                        <div class="admin-actions">
                            <button class="btn btn-outline" onclick="toggleUserAllowed(${user.id}, ${!user.is_allowed})">${user.is_allowed ? '移除上傳' : '允許上傳'}</button>
                            <button class="btn" style="background:${user.is_banned ? 'rgba(69,123,157,0.8)' : 'var(--accent-red)'}; color:#fff;" onclick="toggleUserBan(${user.id}, ${!user.is_banned})">${user.is_banned ? '解除 BAN' : 'BAN'}</button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>`;
    };

    const renderReplays = () => {
        const area = document.getElementById('admin-replays-area');
        if (!area) return;
        if (!adminReplays.length) {
            area.innerHTML = '<div class="admin-list-status">目前還沒有 Replay 紀錄。</div>';
            return;
        }
        area.innerHTML = `<div class="admin-replay-list">
            ${adminReplays.map(match => `
                <div class="admin-replay-item" id="admin-replay-${match.id}">
                    <div class="admin-replay-top">
                        <div>
                            <div class="admin-title">#${match.id} ${escapeHtml(match.script || '未知劇本')}</div>
                            <div class="admin-meta">上傳人：${escapeHtml(match.uploaded_by || '未知')} ｜ 說書人：${escapeHtml(match.storyteller || '未知')} ｜ ${fmtDateTime(match.created_at || match.date)}</div>
                        </div>
                        <div class="admin-actions">
                            <button class="btn btn-outline" onclick="saveReplay(${match.id})">儲存</button>
                            <button class="btn" style="background:var(--accent-red); color:#fff;" onclick="deleteReplay(${match.id})">刪除</button>
                        </div>
                    </div>

                    <div class="admin-edit-grid">
                        <div><label>劇本</label><input class="dark-input js-script" value="${escapeHtml(match.script || '')}"></div>
                        <div><label>日期</label><input class="dark-input js-date" type="date" value="${toDateInput(match.date)}"></div>
                        <div><label>地點</label><input class="dark-input js-location" value="${escapeHtml(match.location || '')}"></div>
                        <div><label>勝利陣營</label><select class="dark-input js-winning-team"><option value="good" ${match.winning_team === 'good' ? 'selected' : ''}>善良</option><option value="evil" ${match.winning_team === 'evil' ? 'selected' : ''}>邪惡</option></select></div>
                        <div class="wide"><label>說書人</label><input class="dark-input js-storyteller" value="${escapeHtml(match.storyteller || '')}"></div>
                    </div>

                    <div class="admin-section-title"><i class="fa-solid fa-users"></i> 參與玩家</div>
                    <div class="admin-player-table-wrap">
                        <table class="admin-player-table">
                            <thead><tr><th>No.</th><th>玩家暱稱</th><th>初始角色</th><th>最終角色</th><th>最終陣營</th><th>存活狀態</th><th></th></tr></thead>
                            <tbody class="js-player-body">${playerRows(match.players || [])}</tbody>
                        </table>
                    </div>
                    <button class="admin-add-player" type="button" onclick="addAdminPlayerRow(${match.id})"><i class="fa-solid fa-plus"></i> 新增玩家</button>

                    <div class="admin-section-title"><i class="fa-solid fa-file-lines"></i> Replay 文字</div>
                    <textarea class="dark-input admin-replay-log js-replay-log">${escapeHtml(match.replay_log || '')}</textarea>
                </div>
            `).join('')}
        </div>`;
    };

    const collectPlayers = (item) => Array.from(item.querySelectorAll('.admin-player-row')).map((row, index) => ({
        seat_number: Number(row.querySelector('.js-player-seat').value) || index + 1,
        player_name: row.querySelector('.js-player-name').value.trim(),
        initial_character: row.querySelector('.js-player-initial').value.trim(),
        final_character: row.querySelector('.js-player-final').value.trim(),
        alignment: row.querySelector('.js-player-alignment').value,
        survived: row.querySelector('.js-player-survived').value === 'alive',
    })).filter(p => p.player_name);

    window.addAdminPlayerRow = (matchId) => {
        const body = document.querySelector(`#admin-replay-${matchId} .js-player-body`);
        if (!body) return;
        const index = body.querySelectorAll('tr').length + 1;
        body.insertAdjacentHTML('beforeend', playerRows([{ seat_number: index, survived: true, alignment: 'good' }]));
    };

    window.removeAdminPlayerRow = (button) => {
        button.closest('tr')?.remove();
    };

    window.refreshAdminPanel = async () => {
        const usersArea = document.getElementById('admin-users-area');
        const replaysArea = document.getElementById('admin-replays-area');
        if (usersArea) usersArea.innerHTML = '<div class="admin-list-status">正在讀取帳號...</div>';
        if (replaysArea) replaysArea.innerHTML = '<div class="admin-list-status">正在讀取 Replay...</div>';
        try {
            const [usersResp, replaysResp] = await Promise.all([
                fetch(`${apiBase}/api/admin/users`, { credentials: 'same-origin' }).then(requireOk),
                fetch(`${apiBase}/api/admin/replays`, { credentials: 'same-origin' }).then(requireOk),
            ]);
            adminUsers = await usersResp.json();
            adminReplays = await replaysResp.json();
            renderUsers();
            renderReplays();
        } catch (err) {
            const message = escapeHtml(err.message || '無法讀取管理後台');
            if (usersArea) usersArea.innerHTML = `<div style="color:var(--accent-red); padding:1rem 0;">${message}</div>`;
            if (replaysArea) replaysArea.innerHTML = `<div style="color:var(--accent-red); padding:1rem 0;">${message}</div>`;
        }
    };

    window.toggleUserBan = async (id, isBanned) => {
        try {
            await fetch(`${apiBase}/api/admin/users/${id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_banned: isBanned }) }).then(requireOk);
            await window.refreshAdminPanel();
        } catch (err) { alert(err.message); }
    };

    window.toggleUserAllowed = async (id, isAllowed) => {
        try {
            await fetch(`${apiBase}/api/admin/users/${id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_allowed: isAllowed }) }).then(requireOk);
            await window.refreshAdminPanel();
        } catch (err) { alert(err.message); }
    };

    window.saveReplay = async (id) => {
        const item = document.getElementById(`admin-replay-${id}`);
        if (!item) return;
        const payload = {
            script: item.querySelector('.js-script').value,
            date: item.querySelector('.js-date').value,
            location: item.querySelector('.js-location').value,
            storyteller: item.querySelector('.js-storyteller').value,
            winning_team: item.querySelector('.js-winning-team').value,
            replay_log: item.querySelector('.js-replay-log').value,
            players: collectPlayers(item),
        };
        try {
            await fetch(`${apiBase}/api/admin/matches/${id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(requireOk);
            alert('已儲存');
            await window.refreshAdminPanel();
        } catch (err) { alert(err.message); }
    };

    window.deleteReplay = async (id) => {
        if (!confirm(`確定刪除 #${id} 這筆 Replay 與所有玩家紀錄嗎？`)) return;
        try {
            await fetch(`${apiBase}/api/admin/matches/${id}`, { method: 'DELETE', credentials: 'same-origin' }).then(requireOk);
            await window.refreshAdminPanel();
        } catch (err) { alert(err.message); }
    };

    window.refreshAdminPanel();
}
