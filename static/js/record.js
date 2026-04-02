/**
 * BOTC Stats - 錄入對局邏輯 (RECORD MATCH)
 * 修復：Master Role DB 連結、存活狀態精確解析
 */

{
    const initRecord = async () => {
        console.log("📝 錄入系統初始化中...");
        
        // 檢查數據庫是否加載成功
        if (!window.MASTER_ROLE_DB || window.MASTER_ROLE_DB.length === 0) {
            console.error("❌ 警告：未偵測到 window.MASTER_ROLE_DB，請確保 index.html 已載入 roles_db.js");
        }

        const dateInput = document.getElementById('match-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        await refreshPlayerDatalist();

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
        } catch (err) { console.warn("Datalist fetch failed"); }
    };

    // --- 🛡️ 智慧陣營判定 (修正數據庫匹配) ---
    const getAlignmentByRole = (roleStr) => {
        if (!roleStr) return "good";
        
        // 1. 處理複雜格式如 "小精靈 / 實際: 毒蛇"
        let targetRole = roleStr;
        if (roleStr.includes("實際:")) {
            targetRole = roleStr.split("實際:")[1].trim();
        } else if (roleStr.includes("/")) {
            targetRole = roleStr.split("/")[1]?.trim() || roleStr.split("/")[0].trim();
        }
        
        // 2. 清理括號
        targetRole = targetRole.replace(/[()（）]/g, "").trim();

        const db = window.MASTER_ROLE_DB || [];
        // 同時嘗試比對名稱 (name) 與標籤 (id)
        const roleData = db.find(r => r.name === targetRole || r.id === targetRole);
        
        if (roleData) {
            console.log(`🔍 匹配角色: ${roleData.name} (${roleData.team})`);
            if (roleData.team === 'minion' || roleData.team === 'demon') return "evil";
        }
        return "good";
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
    };

    const restoreDraft = (data) => {
        document.getElementById('match-script').value = data.script || "";
        document.getElementById('match-date').value = data.date || "";
        document.getElementById('match-location').value = data.location || "";
        document.getElementById('match-storyteller').value = data.storyteller || "";
        document.getElementById('match-winner').value = data.winner || "good";
        const list = document.getElementById('players-list');
        list.innerHTML = "";
        (data.players || []).forEach(p => addPlayerRow(p));
    };

    const renderPlayersFromData = (players) => {
        const list = document.getElementById('players-list');
        list.innerHTML = "";
        players.forEach(p => addPlayerRow(p));
    };

    window.clearFullForm = () => {
        if (!confirm("確定要清空所有內容嗎？")) return;
        localStorage.removeItem('botc_record_draft');
        location.reload();
    };

    // --- 🔮 解析覆盤文字 (強化存活判定) ---
    window.autoFillFromLog = () => {
        const text = document.getElementById('log-input').value;
        if (!text.trim()) return;

        const statusLabel = document.getElementById('import-status');
        statusLabel.innerText = "⏳ 正在提取狀態...";

        const scriptMatch = text.match(/劇本名稱：(.+)/);
        const locationMatch = text.match(/遊戲地點：(.+)/);
        if (scriptMatch) document.getElementById('match-script').value = scriptMatch[1].trim();
        if (locationMatch) document.getElementById('match-location').value = locationMatch[1].trim();

        const blocks = text.split('【當前玩家狀態】');
        if (blocks.length < 2) {
            statusLabel.innerText = "❌ 找不到狀態區塊";
            return;
        }

        const firstBlock = blocks[1]; 
        const lastBlock = blocks[blocks.length - 1]; 

        // Regex 修復：處理寬空格與特殊的連字號
        const rowRegex = /\[(\d+)號\]\s+(.+?)\s+-\s+\(([^)]+)\)\s+(.+)/g;
        const playerMap = {};

        let m;
        while ((m = rowRegex.exec(firstBlock)) !== null) {
            const id = m[1];
            playerMap[id] = { 
                name: m[4].trim(), 
                initial_character: m[3].trim(), 
                final_character: m[3].trim(), 
                survived: true 
            };
        }

        rowRegex.lastIndex = 0;
        while ((m = rowRegex.exec(lastBlock)) !== null) {
            const id = m[1];
            if (playerMap[id]) {
                playerMap[id].final_character = m[3].trim();
                // 🟢 精確判定：只要字串包含「死亡」二字即為 False
                const statusText = m[2].trim();
                playerMap[id].survived = !statusText.includes("死亡");
            }
        }

        const players = Object.values(playerMap);
        if (players.length > 0) {
            renderPlayersFromData(players);
            statusLabel.innerText = `✅ 已導入 ${players.length} 名玩家`;
            saveDraft();
        }
    };

    window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');
        const row = document.createElement('tr');
        
        // 抓取智慧陣營
        const alignment = data?.alignment || getAlignmentByRole(data?.final_character);

        row.innerHTML = `
            <td>
                <input type="text" class="form-control dark-input p-name" 
                       list="player-names-list" value="${data?.name || ''}" 
                       placeholder="玩家暱稱" oninput="saveDraft()">
            </td>
            <td><input type="text" class="form-control dark-input p-initial" value="${data?.initial_character || ''}" placeholder="初始角色" oninput="saveDraft()"></td>
            <td><input type="text" class="form-control dark-input p-final" value="${data?.final_character || ''}" placeholder="最終角色" oninput="saveDraft()"></td>
            <td>
                <select class="form-control dark-input p-team" oninput="saveDraft()">
                    <option value="good" ${alignment === 'good' ? 'selected' : ''}>正義 Good</option>
                    <option value="evil" ${alignment === 'evil' ? 'selected' : ''}>邪惡 Evil</option>
                </select>
            </td>
            <td>
                <select class="form-control dark-input p-status" oninput="saveDraft()">
                    <option value="alive" ${data?.survived !== false ? 'selected' : ''}>存活</option>
                    <option value="dead" ${data?.survived === false ? 'selected' : ''}>死亡</option>
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

    document.getElementById('record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        const password = document.getElementById('admin-password').value;
        const apiBase = window.API_BASE || "";
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
            const resp = await fetch(`${apiBase}/api/matches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                alert("🎉 錄入成功！");
                localStorage.removeItem('botc_record_draft');
                if (window.loadPage) window.loadPage('dashboard');
            } else {
                const err = await resp.json();
                alert("❌ 失敗: " + (err.detail || "未知錯誤"));
            }
        } catch (err) { alert(`❌ 網路錯誤：${err.message}`); }
        finally {
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
