/**
 * BOTC Stats - 錄入對局邏輯 (RECORD MATCH)
 * 整合功能：
 * 1. 自動解析覆盤文字 (含日期、地點、首尾角色)
 * 2. 側邊欄顯示最近 5 場對局詳細紀錄 (劇本/地點/說書人/日期)
 * 3. 玩家名稱自動建議 (Datalist)
 * 4. 串接 MASTER_ROLE_DB 智慧判定陣營
 * 5. 提交成功後跳轉至歷史紀錄
 */

{
    const initRecord = async () => {
        console.log("📝 錄入系統初始化中...");
        
        if (!window.MASTER_ROLE_DB || window.MASTER_ROLE_DB.length === 0) {
            console.error("❌ 警告：未偵測到角色數據庫。");
        }

        const dateInput = document.getElementById('match-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        await refreshPlayerDatalist(); 
        loadRecentMatches();           

        const list = document.getElementById('players-list');
        if (!list) return;

        const transferData = localStorage.getItem('botc_transfer_data');
        const draftData = localStorage.getItem('botc_record_draft');

        if (transferData) {
            const data = JSON.parse(transferData);
            renderPlayersFromData(data.players.map(p => ({
                name: p.name,
                initial_character: p.role,
                final_character: p.actualRole || p.role,
                survived: p.isAlive
            })));
            localStorage.removeItem('botc_transfer_data');
        } else if (draftData) {
            restoreDraft(JSON.parse(draftData));
        } else {
            list.innerHTML = "";
            for(let i = 0; i < 12; i++) addPlayerRow();
        }
    };

    const refreshPlayerDatalist = async () => {
        const apiBase = window.API_BASE || "";
        const datalist = document.getElementById('player-names-list');
        if (!datalist) return;
        try {
            const resp = await fetch(`${apiBase}/api/players`);
            if (resp.ok) {
                const names = await resp.json();
                datalist.innerHTML = names.map(name => `<option value="${name}">`).join('');
            }
        } catch (err) {}
    };

    // --- 🟢 載入左側「最近錄入對局」詳細版 ---
    const loadRecentMatches = async () => {
        const container = document.getElementById('recent-matches-list');
        if (!container) return;
        const apiBase = window.API_BASE || "";

        try {
            const resp = await fetch(`${apiBase}/api/history`);
            if (!resp.ok) throw new Error();
            const data = await resp.json();
            
            const recent = data.slice(0, 5);
            if (recent.length === 0) {
                container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 1.5rem;">尚未有紀錄</div>`;
                return;
            }

            container.innerHTML = recent.map(m => {
                const d = new Date(m.date);
                const dateStr = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
                // 這裡目前資料庫沒存 created_at，暫時以 ID 或當前時間展示邏輯
                const entryTime = "系統同步中"; 
                
                const winClass = m.winning_team === 'good' ? 'win-good' : 'win-evil';
                const winLabel = m.winning_team === 'good' ? '善良獲勝' : '邪惡獲勝';
                
                return `
                    <div class="match-item">
                        <div class="match-header">
                            <span class="match-script-name">${m.script}</span>
                            <span class="match-tag ${winClass}">${winLabel}</span>
                        </div>
                        <div class="match-detail-row">
                            <span><i class="fa-solid fa-location-dot"></i> ${m.location || '未知'}</span>
                            <span><i class="fa-solid fa-user-tie"></i> ${m.storyteller || '未知'}</span>
                        </div>
                        <div class="match-time-row">
                            <div><i class="fa-solid fa-calendar-day"></i> 遊戲：${dateStr}</div>
                            <div style="opacity: 0.6;"><i class="fa-solid fa-clock"></i> 序號：#${m.id}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            container.innerHTML = `<div style="text-align: center; color: var(--accent-red); font-size: 0.8rem; padding: 1rem;">載入失敗</div>`;
        }
    };

    const getAlignmentByRole = (roleStr) => {
        if (!roleStr) return "good";
        let targetRole = roleStr;
        if (roleStr.includes("實際:")) targetRole = roleStr.split("實際:")[1].trim();
        else if (roleStr.includes("/")) targetRole = roleStr.split("/")[1]?.trim() || roleStr.split("/")[0].trim();
        targetRole = targetRole.replace(/[()（）]/g, "").trim();
        const db = window.MASTER_ROLE_DB || [];
        const roleData = db.find(r => r.name === targetRole || r.id === targetRole);
        return (roleData && (roleData.team === 'minion' || roleData.team === 'demon')) ? "evil" : "good";
    };

    window.saveDraft = () => {
        const scriptEl = document.getElementById('match-script');
        if (!scriptEl) return;
        const draft = {
            script: scriptEl.value,
            date: document.getElementById('match-date').value,
            location: document.getElementById('match-location').value,
            storyteller: document.getElementById('match-storyteller').value,
            winner: document.getElementById('match-winner').value,
            players: Array.from(document.querySelectorAll('#players-list tr')).map(row => ({
                name: row.querySelector('.p-name').value,
                initial_character: row.querySelector('.p-initial').value,
                final_character: row.querySelector('.p-final').value,
                alignment: row.querySelector('.p-team').value,
                survived: row.querySelector('.p-status').value === 'alive'
            }))
        };
        localStorage.setItem('botc_record_draft', JSON.stringify(draft));
        const statusEl = document.getElementById('save-status');
        if (statusEl) statusEl.innerText = "草稿已更新 (" + new Date().toLocaleTimeString() + ")";
    };

    const restoreDraft = (data) => {
        document.getElementById('match-script').value = data.script || "";
        document.getElementById('match-date').value = data.date || "";
        document.getElementById('match-location').value = data.location || "";
        document.getElementById('match-storyteller').value = data.storyteller || "";
        document.getElementById('match-winner').value = data.winner || "good";
        renderPlayersFromData(data.players || []);
    };

    const renderPlayersFromData = (players) => {
        const list = document.getElementById('players-list');
        list.innerHTML = "";
        players.forEach(p => addPlayerRow(p));
    };

    window.clearFullForm = () => {
        if (!confirm("確定要清空嗎？")) return;
        localStorage.removeItem('botc_record_draft');
        location.reload();
    };

    window.autoFillFromLog = () => {
        const text = document.getElementById('log-input').value;
        if (!text.trim()) return;
        const statusLabel = document.getElementById('import-status');
        statusLabel.innerText = "⏳ 提取中...";
        const scriptMatch = text.match(/劇本名稱：(.+)/);
        const locationMatch = text.match(/遊戲地點：(.+)/);
        const dateMatch = text.match(/遊戲日期：(\d{4}-\d{2}-\d{2})/);
        if (scriptMatch) document.getElementById('match-script').value = scriptMatch[1].trim();
        if (locationMatch) document.getElementById('match-location').value = locationMatch[1].trim();
        if (dateMatch) document.getElementById('match-date').value = dateMatch[1];
        const blocks = text.split('【當前玩家狀態】');
        if (blocks.length < 2) return;
        const firstBlock = blocks[1]; const lastBlock = blocks[blocks.length - 1]; 
        const rowRegex = /\[(\d+)號\]\s+(.+?)\s+-\s+\(([^)]+)\)\s+(.+)/g;
        const playerMap = {};
        let m;
        while ((m = rowRegex.exec(firstBlock)) !== null) {
            playerMap[m[1]] = { name: m[4].trim(), initial_character: m[3].trim(), final_character: m[3].trim(), survived: true };
        }
        rowRegex.lastIndex = 0;
        while ((m = rowRegex.exec(lastBlock)) !== null) {
            const id = m[1];
            if (playerMap[id]) {
                playerMap[id].final_character = m[3].trim();
                playerMap[id].survived = !m[2].includes("死亡");
            }
        }
        renderPlayersFromData(Object.values(playerMap));
        saveDraft();
    };

    window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');
        const row = document.createElement('tr');
        const alignment = data?.alignment || getAlignmentByRole(data?.final_character);
        row.innerHTML = `
            <td><input type="text" class="form-control dark-input p-name" list="player-names-list" value="${data?.name || ''}" placeholder="暱稱" oninput="saveDraft()"></td>
            <td><input type="text" class="form-control dark-input p-initial" value="${data?.initial_character || ''}" placeholder="初始" oninput="saveDraft()"></td>
            <td><input type="text" class="form-control dark-input p-final" value="${data?.final_character || ''}" placeholder="最終" oninput="saveDraft()"></td>
            <td><select class="form-control dark-input p-team" oninput="saveDraft()"><option value="good" ${alignment === 'good' ? 'selected' : ''}>正義</option><option value="evil" ${alignment === 'evil' ? 'selected' : ''}>邪惡</option></select></td>
            <td><select class="form-control dark-input p-status" oninput="saveDraft()"><option value="alive" ${data?.survived !== false ? 'selected' : ''}>存活</option><option value="dead" ${data?.survived === false ? 'selected' : ''}>死亡</option></select></td>
            <td><button type="button" class="btn-delete" onclick="this.closest('tr').remove(); saveDraft();"><i class="fa-solid fa-xmark"></i></button></td>
        `;
        list.appendChild(row);
    };

    document.getElementById('record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        const password = document.getElementById('admin-password').value;
        btn.disabled = true;
        btn.innerText = "⏳ 寫入中...";
        const payload = {
            script: document.getElementById('match-script').value,
            date: document.getElementById('match-date').value,
            location: document.getElementById('match-location').value || "未知",
            storyteller: document.getElementById('match-storyteller').value,
            winning_team: document.getElementById('match-winner').value,
            password: password,
            players: Array.from(document.querySelectorAll('#players-list tr')).map(row => ({
                name: row.querySelector('.p-name').value.trim(),
                initial_character: row.querySelector('.p-initial').value.trim(),
                final_character: row.querySelector('.p-final').value.trim(),
                alignment: row.querySelector('.p-team').value,
                survived: row.querySelector('.p-status').value === 'alive'
            })).filter(p => p.name !== "")
        };
        try {
            const resp = await fetch(`${window.API_BASE}/api/matches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (resp.ok) { alert("🎉 錄入成功！"); localStorage.removeItem('botc_record_draft'); if (window.loadPage) window.loadPage('history'); }
            else { const err = await resp.json(); alert("❌ 失敗: " + (err.detail || "密碼錯誤")); }
        } catch (err) { alert(`❌ 網路錯誤：${err.message}`); }
        finally { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> 確認並提交戰績`; }
    });

    initRecord();
}
