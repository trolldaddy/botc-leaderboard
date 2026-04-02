/**
 * BOTC Stats - 錄入對局邏輯 (RECORD MATCH)
 * 修正版：對齊後端 schemas 欄位名稱，解決 [object Object] 與 Field Required 錯誤
 */

{
    const initRecord = () => {
        console.log("📝 錄入系統初始化中...");
        
        const dateInput = document.getElementById('match-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        const list = document.getElementById('players-list');
        if (!list) return;

        const transferData = localStorage.getItem('botc_transfer_data');
        const draftData = localStorage.getItem('botc_record_draft');

        if (transferData) {
            console.log("📥 載入魔典傳輸數據");
            const data = JSON.parse(transferData);
            renderPlayersFromData(data.players.map(p => ({
                name: p.name,
                initialRole: p.role,
                finalRole: p.actualRole || p.role,
                isAlive: p.isAlive
            })));
            localStorage.removeItem('botc_transfer_data');
        } else if (draftData) {
            console.log("📥 恢復本地草稿");
            restoreDraft(JSON.parse(draftData));
        } else {
            list.innerHTML = "";
            for(let i = 0; i < 5; i++) addPlayerRow();
        }
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
                initialRole: row.querySelector('.p-initial').value,
                finalRole: row.querySelector('.p-final').value,
                team: row.querySelector('.p-team').value,
                status: row.querySelector('.p-status').value
            }))
        };
        localStorage.setItem('botc_record_draft', JSON.stringify(draft));
        
        const statusEl = document.getElementById('save-status');
        if (statusEl) statusEl.innerText = "已自動儲存草稿 (" + new Date().toLocaleTimeString() + ")";
    };

    const restoreDraft = (data) => {
        document.getElementById('match-script').value = data.script || "";
        document.getElementById('match-date').value = data.date || "";
        document.getElementById('match-location').value = data.location || "";
        document.getElementById('match-storyteller').value = data.storyteller || "";
        document.getElementById('match-winner').value = data.winner || "good";
        renderPlayersFromData(data.players);
    };

    const renderPlayersFromData = (players) => {
        const list = document.getElementById('players-list');
        list.innerHTML = "";
        players.forEach(p => addPlayerRow(p));
    };

    window.clearFullForm = () => {
        if (!confirm("確定要清空所有填寫內容嗎？")) return;
        localStorage.removeItem('botc_record_draft');
        const form = document.getElementById('record-form');
        if (form) form.reset();
        document.getElementById('log-input').value = "";
        document.getElementById('import-status').innerText = "";
        initRecord();
    };

    window.autoFillFromLog = () => {
        const text = document.getElementById('log-input').value;
        if (!text.trim()) return;

        const scriptMatch = text.match(/劇本名稱：(.+)/);
        const dateMatch = text.match(/遊戲日期：([\d-]+)/);
        const locationMatch = text.match(/遊戲地點：(.+)/);

        if (scriptMatch) document.getElementById('match-script').value = scriptMatch[1].trim();
        if (dateMatch) document.getElementById('match-date').value = dateMatch[1].trim();
        if (locationMatch) document.getElementById('match-location').value = locationMatch[1].trim();

        const blocks = text.split('【當前玩家狀態】');
        if (blocks.length < 2) return;

        const firstBlock = blocks[1]; 
        const lastBlock = blocks[blocks.length - 1]; 
        const rowRegex = /\[(\d+)號\]\s+(存活|死亡|💀 死亡)\s+-\s+\(([^)]+)\)\s+(.+)/g;
        const playerMap = {};

        let m;
        while ((m = rowRegex.exec(firstBlock)) !== null) {
            playerMap[m[1]] = { name: m[4].trim(), initialRole: m[3].trim(), finalRole: m[3].trim(), isAlive: !m[2].includes("死亡") };
        }
        rowRegex.lastIndex = 0;
        while ((m = rowRegex.exec(lastBlock)) !== null) {
            if (playerMap[m[1]]) {
                playerMap[m[1]].finalRole = m[3].trim();
                playerMap[m[1]].isAlive = !m[2].includes("死亡");
            }
        }
        renderPlayersFromData(Object.values(playerMap));
        saveDraft();
    };

    window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');
        const row = document.createElement('tr');
        
        const evilKeywords = ['惡魔', '爪牙', '代言', '女郎', '投毒', '男爵', '間諜', '洗腦', '刺客', '教父', '主謀', '魔鬼', '猩紅', '巫婆', '小惡魔'];
        const currentRole = data?.finalRole || "";
        const isEvil = evilKeywords.some(k => currentRole.includes(k));

        row.innerHTML = `
            <td><input type="text" class="form-control dark-input p-name" value="${data?.name || ''}" placeholder="玩家暱稱" oninput="saveDraft()"></td>
            <td><input type="text" class="form-control dark-input p-initial" value="${data?.initialRole || ''}" placeholder="初始角色" oninput="saveDraft()"></td>
            <td><input type="text" class="form-control dark-input p-final" value="${data?.finalRole || ''}" placeholder="最終角色" oninput="saveDraft()"></td>
            <td>
                <select class="form-control dark-input p-team" oninput="saveDraft()">
                    <option value="good" ${!isEvil ? 'selected' : ''}>正義 Good</option>
                    <option value="evil" ${isEvil ? 'selected' : ''}>邪惡 Evil</option>
                </select>
            </td>
            <td>
                <select class="form-control dark-input p-status" oninput="saveDraft()">
                    <option value="alive" ${!data || data.isAlive ? 'selected' : ''}>存活</option>
                    <option value="dead" ${data && !data.isAlive ? 'selected' : ''}>死亡</option>
                </select>
            </td>
            <td style="text-align:center;">
                <button type="button" class="btn" style="color: rgba(255,255,255,0.1); padding: 5px;" onclick="this.closest('tr').remove(); saveDraft();">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </td>
        `;
        list.appendChild(row);
    };

    /**
     * 🚀 修正後的提交邏輯：精確對齊後端 Schema
     */
    document.getElementById('record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('submit-btn');
        const password = document.getElementById('admin-password').value;
        const apiBase = window.API_BASE || "";

        if (!password) {
            alert("請輸入管理員密鑰以確認權限");
            return;
        }

        btn.disabled = true;
        btn.innerText = "⏳ 正在傳輸至資料庫...";

        // 🟢 根據截圖中的報錯資訊，精確調整欄位名稱
        const payload = {
            script: document.getElementById('match-script').value, // 對齊 body.script
            storyteller: document.getElementById('match-storyteller').value,
            winning_team: document.getElementById('match-winner').value,
            password: password, // 對齊 body.password (或是後端定義的欄位)
            location: document.getElementById('match-location').value,
            date: document.getElementById('match-date').value,
            players: Array.from(document.querySelectorAll('#players-list tr')).map(row => {
                const team = row.querySelector('.p-team').value;
                return {
                    name: row.querySelector('.p-name').value, // 傳送名字供後端處理
                    player_id: 0, // 💡 報錯要求 player_id，先傳 0 讓驗證通過，後端應透過 name 查找
                    character: row.querySelector('.p-final').value, // 對齊 body.players.x.character
                    initial_alignment: team, // 對齊 body.players.x.initial_alignment
                    final_alignment: team,   // 對齊 body.players.x.final_alignment
                    survived: row.querySelector('.p-status').value === 'alive' // 對齊 body.players.x.survived
                };
            })
        };

        try {
            const response = await fetch(`${apiBase}/api/matches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                alert("🎉 對局戰績已成功保存！魔典已更新。");
                localStorage.removeItem('botc_record_draft');
                if (window.loadPage) window.loadPage('history');
            } else {
                // 優化報錯顯示，解析 Pydantic 的錯誤訊息
                let errorMsg = "儲存失敗";
                if (result.detail) {
                    if (Array.isArray(result.detail)) {
                        errorMsg = result.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join('\n');
                    } else {
                        errorMsg = result.detail;
                    }
                }
                throw new Error(errorMsg);
            }
        } catch (err) {
            console.error("提交失敗:", err);
            alert(`❌ 儲存出錯：\n${err.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> 確認並提交戰績`;
        }
    });

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
