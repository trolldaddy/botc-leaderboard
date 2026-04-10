/**
 * BOTC Stats - 錄入對局邏輯 (RECORD MATCH)
 */
function setupRoleDatalist() {
    // 檢查頁面上是否已經有清單，沒有就建立一個
    let datalist = document.getElementById('all-roles-list');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'all-roles-list';
        document.body.appendChild(datalist);
    }
    
    // 從 window.MASTER_ROLE_DB 抓取角色
    if (window.MASTER_ROLE_DB) {
        datalist.innerHTML = window.MASTER_ROLE_DB
            .map(role => `<option value="${role.name}">`)
            .join('');
    }
}

// 頁面載入完成後自動執行
window.addEventListener('DOMContentLoaded', setupRoleDatalist);

{
    const initRecord = async () => {
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

    // --- 🟢 載入左側「最近錄入對局」：補上說書人資訊 ---
    const loadRecentMatches = async () => {
        const container = document.getElementById('recent-matches-list');
        if (!container) return;
        const apiBase = window.API_BASE || "";

        try {
            const resp = await fetch(`${apiBase}/api/history`);
            if (!resp.ok) throw new Error();
            const data = await resp.json();
            
            const recent = data.slice(0, 6);
            if (recent.length === 0) {
                container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 1.5rem;">尚未有錄入紀錄</div>`;
                return;
            }

            container.innerHTML = recent.map(m => {
                const isGood = m.winning_team === 'good';
                return `
                    <div class="side-match-item">
                        <span class="m-title">${m.script}</span>
                        <div class="m-meta">
                            <span><i class="fa-solid fa-location-dot"></i> ${m.location || '未知'}</span>
                            <span><i class="fa-solid fa-user-tie"></i> ${m.storyteller || '未知'}</span>
                        </div>
                        <div class="m-tag ${isGood ? 'tag-good' : 'tag-evil'}">
                            ${isGood ? '善良陣營獲勝' : '邪惡陣營獲勝'}
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
/**
    window.saveDraft = () => {
        const scriptEl = document.getElementById('match-script');
        if (!scriptEl) return;
        const draft = {
            script: scriptEl.value, date: document.getElementById('match-date').value,
            location: document.getElementById('match-location').value, storyteller: document.getElementById('match-storyteller').value,
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
        if (statusEl) statusEl.innerText = "草稿已儲存 (" + new Date().toLocaleTimeString() + ")";
    };
**/

    window.saveDraft = () => {
    const scriptEl = document.getElementById('match-script');
    if (!scriptEl) return;
    const draft = {
        script: scriptEl.value, 
        date: document.getElementById('match-date').value,
        location: document.getElementById('match-location').value, 
        storyteller: document.getElementById('match-storyteller').value,
        winner: document.getElementById('match-winner').value,
        // 🔴 關鍵修改：從 tr 改成 .player-row
        players: Array.from(document.querySelectorAll('.player-row')).map(row => ({
            name: row.querySelector('.p-name').value,
            initial_character: row.querySelector('.p-initial').value,
            final_character: row.querySelector('.p-final').value,
            alignment: row.querySelector('.p-team').value,
            survived: row.querySelector('.p-status').value === 'alive'
        }))
    };
    localStorage.setItem('botc_record_draft', JSON.stringify(draft));
    const statusEl = document.getElementById('save-status');
    if (statusEl) statusEl.innerText = "草稿已儲存 (" + new Date().toLocaleTimeString() + ")";
};
    
    const restoreDraft = (data) => {
        const locSelect = document.getElementById('match-location');
        document.getElementById('match-script').value = data.script || "";
        document.getElementById('match-date').value = data.date || "";
        
        // 🟢 處理選單值（如果草稿中的地點不在選項中，預設選為「其他」或第一個）
        if (locSelect) {
            locSelect.value = data.location || "拉普拉斯";
        }

        document.getElementById('match-storyteller').value = data.storyteller || "";
        document.getElementById('match-winner').value = data.winner || "good";
        renderPlayersFromData(data.players || []);
    };

    const renderPlayersFromData = (players) => {
        const list = document.getElementById('players-list');
        list.innerHTML = "";
        players.forEach(p => addPlayerRow(p));
    };

    window.clearFullForm = () => { if (confirm("確定清空嗎？")) { localStorage.removeItem('botc_record_draft'); location.reload(); } };

    window.autoFillFromLog = () => {
        const text = document.getElementById('log-input').value;
        if (!text.trim()) return;
        const scriptMatch = text.match(/劇本名稱：(.+)/);
        const locationMatch = text.match(/遊戲地點：(.+)/);
        const dateMatch = text.match(/遊戲日期：(\d{4}-\d{2}-\d{2})/);
        if (scriptMatch) document.getElementById('match-script').value = scriptMatch[1].trim();
        
        if (locationMatch) {
            const locVal = locationMatch[1].trim();
            const locSelect = document.getElementById('match-location');
            // 如果解析的地點在選單中就選取，否則預設為「其他」
            const exists = Array.from(locSelect.options).some(opt => opt.value === locVal);
            locSelect.value = exists ? locVal : "其他";
        }

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
/**
     window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');
        const row = document.createElement('tr');
        const alignment = data?.alignment || getAlignmentByRole(data?.final_character);
        row.innerHTML = `
            <td><input type="text" class="form-control dark-input p-name" list="player-names-list" value="${data?.name || ''}" placeholder="暱稱" oninput="saveDraft()"></td>
            <td><input type="text" class="form-control dark-input p-initial" value="${data?.initial_character || ''}" placeholder="初始" oninput="saveDraft()"></td>
            <td><input type="text" class="form-control dark-input p-final" value="${data?.final_character || ''}" placeholder="最終" oninput="saveDraft()"></td>
            <td><select class="form-control dark-input p-team" oninput="saveDraft()"><option value="good" ${alignment === 'good' ? 'selected' : ''}>善良</option><option value="evil" ${alignment === 'evil' ? 'selected' : ''}>邪惡</option></select></td>
            <td><select class="form-control dark-input p-status" oninput="saveDraft()"><option value="alive" ${data?.survived !== false ? 'selected' : ''}>存活</option><option value="dead" ${data?.survived === false ? 'selected' : ''}>死亡</option></select></td>
            <td style="text-align:center;"><button type="button" class="btn" style="color: rgba(255,255,255,0.1); border:none; background:none;" onclick="this.closest('tr').remove(); saveDraft();"><i class="fa-solid fa-xmark"></i></button></td>
        `;
        list.appendChild(row);
    };
**/

window.addPlayerRow = (data = null) => {
    const list = document.getElementById('players-list');
    if (!list) return;

    // 建立一個 div 容器，手機版 1 欄，電腦版 6 欄 (包含刪除按鈕)
    const row = document.createElement('div');
    row.className = "player-row grid grid-cols-2 sm:grid-cols-6 gap-2 p-3 mb-3 bg-slate-800/40 rounded-2xl border border-slate-700 items-end transition-all";
    
    // 呼叫你原本就有的自動陣營判斷邏輯
    const alignment = data?.alignment || getAlignmentByRole(data?.final_character);
    
    row.innerHTML = `
        <div class="col-span-2 sm:col-span-1 flex flex-col gap-1">
            <label class="sm:hidden text-[10px] font-bold text-slate-500 ml-1">玩家暱稱</label>
            <input type="text" class="form-control dark-input p-name w-full" list="player-names-list" value="${data?.name || ''}" placeholder="暱稱" oninput="saveDraft()">
        </div>
        
        <div class="flex flex-col gap-1">
            <label class="sm:hidden text-[10px] font-bold text-slate-500 ml-1">初始角色</label>
            <input type="text" class="form-control dark-input p-initial w-full" list="all-roles-list" value="${data?.initial_character || ''}" placeholder="初始" oninput="saveDraft()">
        </div>
        
        <div class="flex flex-col gap-1">
            <label class="sm:hidden text-[10px] font-bold text-slate-500 ml-1">最終角色</label>
            <input type="text" class="form-control dark-input p-final w-full" list="all-roles-list" value="${data?.final_character || ''}" placeholder="最終" oninput="saveDraft()">
        </div>
        
        <div class="flex flex-col gap-1">
            <label class="sm:hidden text-[10px] font-bold text-slate-500 ml-1">陣營</label>
            <select class="form-control dark-input p-team w-full" oninput="saveDraft()">
                <option value="good" ${alignment === 'good' ? 'selected' : ''}>善良</option>
                <option value="evil" ${alignment === 'evil' ? 'selected' : ''}>邪惡</option>
            </select>
        </div>
        
        <div class="flex flex-col gap-1">
            <label class="sm:hidden text-[10px] font-bold text-slate-500 ml-1">最終狀態</label>
            <select class="form-control dark-input p-status w-full" oninput="saveDraft()">
                <option value="alive" ${data?.survived !== false ? 'selected' : ''}>存活</option>
                <option value="dead" ${data?.survived === false ? 'selected' : ''}>死亡</option>
            </select>
        </div>
        
        <div class="col-span-2 sm:col-span-1 flex justify-end sm:justify-center pb-1">
            <button type="button" class="btn text-slate-600 hover:text-red-500 p-2" 
                onclick="if(window.confirm('確定要移除這位玩家嗎？')) { this.closest('.player-row').remove(); saveDraft(); }">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `;
    list.appendChild(row);
};

    document.getElementById('record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        const password = document.getElementById('admin-password').value;
        const apiBase = window.API_BASE || "";
        btn.disabled = true; btn.innerText = "⏳ 寫入中...";
        const payload = {
            script: document.getElementById('match-script').value, date: document.getElementById('match-date').value,
            location: document.getElementById('match-location').value || "未知", storyteller: document.getElementById('match-storyteller').value,
            winning_team: document.getElementById('match-winner').value, password: password,
            players: Array.from(document.querySelectorAll('.player-row')).map(row => ({
                name: row.querySelector('.p-name').value.trim(), initial_character: row.querySelector('.p-initial').value.trim(),
                final_character: row.querySelector('.p-final').value.trim(), alignment: row.querySelector('.p-team').value,
                survived: row.querySelector('.p-status').value === 'alive'
            })).filter(p => p.name !== "")
        };
        try {
            const resp = await fetch(`${apiBase}/api/matches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (resp.ok) { alert("🎉 錄入成功！"); localStorage.removeItem('botc_record_draft'); if (window.loadPage) window.loadPage('history'); }
            else { const err = await resp.json(); alert("❌ 失敗: " + (err.detail || "密碼錯誤")); }
        } catch (err) { alert(`❌ 網路錯誤：${err.message}`); }
        finally { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> 確認並提交戰績`; }
    });

    const refreshPlayerDatalist = async () => {
        const datalist = document.getElementById('player-names-list');
        if (!datalist) return;
        try { const resp = await fetch(`${window.API_BASE}/api/players`); if (resp.ok) { const names = await resp.json(); datalist.innerHTML = names.map(name => `<option value="${name}">`).join(''); } } catch (err) {}
    };

    window.importFile = (input) => {
        const file = input.files[0]; if (!file) return;
        const reader = new FileReader(); reader.onload = (e) => { document.getElementById('log-input').value = e.target.result; autoFillFromLog(); }; reader.readAsText(file);
    };

    initRecord();
}
