/**
 * BOTC Stats - 錄入對局邏輯 (RECORD MATCH)
 * 功能：自動解析、自動完成、智慧陣營判定、草稿儲存
 */

{
    const initRecord = async () => {
        console.log("📝 錄入系統初始化中...");
        
        // 1. 設定日期預設值
        const dateInput = document.getElementById('match-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // 2. 🟢 從後端同步玩家名單以供自動完成使用
        await refreshPlayerDatalist();

        const list = document.getElementById('players-list');
        if (!list) return;

        // 3. 處理資料來源
        const transferData = localStorage.getItem('botc_transfer_data');
        const draftData = localStorage.getItem('botc_record_draft');

        if (transferData) {
            console.log("📥 載入魔典傳輸數據");
            const data = JSON.parse(transferData);
            renderPlayersFromData(data.players.map(p => ({
                name: p.name,
                initial_character: p.role,
                final_character: p.actualRole || p.role,
                survived: p.isAlive
            })));
            localStorage.removeItem('botc_transfer_data');
        } else if (draftData) {
            console.log("📥 恢復本地草稿");
            restoreDraft(JSON.parse(draftData));
        } else {
            // 預設生成 12 行
            list.innerHTML = "";
            for(let i = 0; i < 12; i++) addPlayerRow();
        }
    };

    // --- 🟢 獲取玩家自動完成清單 ---
    const refreshPlayerDatalist = async () => {
        const apiBase = window.API_BASE || "";
        const datalist = document.getElementById('player-names-list');
        if (!datalist) return;

        try {
            const resp = await fetch(`${apiBase}/api/players`);
            if (resp.ok) {
                const names = await resp.json();
                // 將名單轉化為 option 標籤
                datalist.innerHTML = names.map(name => `<option value="${name}">`).join('');
                console.log(`✅ 已載入 ${names.length} 名玩家至建議清單`);
            }
        } catch (err) {
            console.warn("無法取得玩家建議名單:", err);
        }
    };

    // --- 🛡️ 智慧陣營判定 (串接 roles_db.js) ---
    const getAlignmentByRole = (roleStr) => {
        if (!roleStr) return "good";
        
        let targetRole = roleStr;
        // 處理隱藏身分標籤 (如：小精靈 / 實際: 毒蛇)
        if (roleStr.includes("實際:")) {
            targetRole = roleStr.split("實際:")[1].trim();
        } else if (roleStr.includes("/")) {
            targetRole = roleStr.split("/")[0].trim();
        }
        targetRole = targetRole.replace(/[()（）]/g, "").trim();

        const db = window.MASTER_ROLE_DB || [];
        const roleData = db.find(r => r.name === targetRole || r.id === targetRole);
        
        if (roleData && (roleData.team === 'minion' || roleData.team === 'demon')) {
            return "evil";
        }
        return "good";
    };

    // --- 💾 草稿系統 ---
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
        if (statusEl) statusEl.innerText = "已自動儲存草稿 (" + new Date().toLocaleTimeString() + ")";
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
        if (!confirm("確定要清空所有填寫內容嗎？")) return;
        localStorage.removeItem('botc_record_draft');
        location.reload();
    };

    // --- 🔮 解析覆盤文字 (首尾狀態提取) ---
    window.autoFillFromLog = () => {
        const text = document.getElementById('log-input').value;
        if (!text.trim()) return;

        const statusLabel = document.getElementById('import-status');
        statusLabel.innerText = "⏳ 正在分析魔典...";

        const scriptMatch = text.match(/劇本名稱：(.+)/);
        const locationMatch = text.match(/遊戲地點：(.+)/);
        if (scriptMatch) document.getElementById('match-script').value = scriptMatch[1].trim();
        if (locationMatch) document.getElementById('match-location').value = locationMatch[1].trim();

        const blocks = text.split('【當前玩家狀態】');
        if (blocks.length < 2) {
            statusLabel.innerText = "❌ 找不到玩家狀態區塊";
            return;
        }

        const firstBlock = blocks[1]; 
        const lastBlock = blocks[blocks.length - 1]; 

        // 處理包含 emoji 或空格的狀態字串
        const rowRegex = /\[(\d+)號\]\s+(.+?)\s+-\s+\(([^)]+)\)\s+(.+)/g;
        const playerMap = {};

        let m;
        while ((m = rowRegex.exec(firstBlock)) !== null) {
            const id = m[1];
            playerMap[id] = { name: m[4].trim(), initial_character: m[3].trim(), final_character: m[3].trim(), survived: true };
        }

        rowRegex.lastIndex = 0;
        while ((m = rowRegex.exec(lastBlock)) !== null) {
            const id = m[1];
            if (playerMap[id]) {
                playerMap[id].final_character = m[3].trim();
                playerMap[id].survived = !m[2].includes("死亡");
            }
        }

        const players = Object.values(playerMap);
        if (players.length > 0) {
            renderPlayersFromData(players);
            statusLabel.innerText = `✅ 解析成功 (${players.length}人)`;
            saveDraft();
        }
    };

    // --- ➕ 生成玩家行 ---
    window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');
        const row = document.createElement('tr');
        
        // 智慧陣營預判
        const alignment = data?.alignment || getAlignmentByRole(data?.final_character);

        row.innerHTML = `
            <td>
                <!-- 🟢 加入 list 連結到 datalist 容器 -->
                <input type="text" class="form-control dark-input p-name" 
                       list="player-names-list"
                       value="${data?.name || ''}" 
                       placeholder="玩家暱稱" 
                       oninput="saveDraft()">
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

    // --- 🚀 提交數據 ---
    document.getElementById('record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        const password = document.getElementById('admin-password').value;
        const apiBase = window.API_BASE || "";

        btn.disabled = true;
        btn.innerText = "⏳ 正在寫入魔典...";

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
            const response = await fetch(`${apiBase}/api/matches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const contentType = response.headers.get("content-type");
            let result;
            if (contentType && contentType.includes("application/json")) {
                result = await response.json();
            } else {
                throw new Error(`伺服器報錯 (${response.status})。可能是資料庫欄位不匹配。`);
            }

            if (response.ok) {
                alert("🎉 戰績存檔成功！魔典已更新。");
                localStorage.removeItem('botc_record_draft');
                if (window.loadPage) window.loadPage('dashboard');
            } else {
                throw new Error(result.detail || "錄入失敗");
            }
        } catch (err) {
            alert(`❌ 失敗：${err.message}`);
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

    // 啟動初始化 (必須是 async 呼叫)
    initRecord();
}
