/**
 * BOTC Stats - 錄入對局邏輯 (RECORD MATCH)
 * 整合：自動解析、草稿儲存、後端 API 對接
 */

{
    const initRecord = () => {
        console.log("📝 錄入系統初始化中...");
        
        // 1. 設定日期輸入框預設值
        const dateInput = document.getElementById('match-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        const list = document.getElementById('players-list');
        if (!list) return;

        // 2. 資料來源優先權：魔典同步資料 > 本地自動存檔 > 預設 5 行
        const transferData = localStorage.getItem('botc_transfer_data');
        const draftData = localStorage.getItem('botc_record_draft');

        if (transferData) {
            console.log("📥 載入魔典傳輸數據");
            const data = JSON.parse(transferData);
            // 轉換傳輸數據格式
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
            // 預設生成 5 行供手動錄入
            list.innerHTML = "";
            for(let i = 0; i < 5; i++) addPlayerRow();
        }
    };

    // --- 草稿儲存功能 ---
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

    // 清空表單
    window.clearFullForm = () => {
        if (!confirm("確定要清空所有填寫內容嗎？此動作不可逆。")) return;
        localStorage.removeItem('botc_record_draft');
        const form = document.getElementById('record-form');
        if (form) form.reset();
        document.getElementById('log-input').value = "";
        document.getElementById('import-status').innerText = "";
        initRecord();
    };

    // --- 核心：文字檔解析 (提取首尾狀態) ---
    window.autoFillFromLog = () => {
        const text = document.getElementById('log-input').value;
        if (!text.trim()) return;

        const statusLabel = document.getElementById('import-status');
        statusLabel.innerText = "⏳ 正在提取首尾狀態...";

        // 1. 解析基礎資訊
        const scriptMatch = text.match(/劇本名稱：(.+)/);
        const dateMatch = text.match(/遊戲日期：([\d-]+)/);
        const locationMatch = text.match(/遊戲地點：(.+)/);

        if (scriptMatch) document.getElementById('match-script').value = scriptMatch[1].trim();
        if (dateMatch) document.getElementById('match-date').value = dateMatch[1].trim();
        if (locationMatch) document.getElementById('match-location').value = locationMatch[1].trim();

        // 2. 切分「當前玩家狀態」區塊
        const blocks = text.split('【當前玩家狀態】');
        if (blocks.length < 2) {
            statusLabel.innerText = "❌ 無法解析玩家列表";
            return;
        }

        const firstBlock = blocks[1]; // 索引 1 為初始狀態
        const lastBlock = blocks[blocks.length - 1]; // 最後一個為最終狀態

        // 正則例：[1號] 存活 - (角色 / 實際:角色) 玩家名
        const rowRegex = /\[(\d+)號\]\s+(存活|死亡|💀 死亡)\s+-\s+\(([^)]+)\)\s+(.+)/g;
        const playerMap = {};

        // 抓初始
        let m;
        while ((m = rowRegex.exec(firstBlock)) !== null) {
            playerMap[m[1]] = { 
                name: m[4].trim(), 
                initialRole: m[3].trim(), 
                finalRole: m[3].trim(), 
                isAlive: !m[2].includes("死亡") 
            };
        }

        // 抓最終 (重置 regex)
        rowRegex.lastIndex = 0;
        while ((m = rowRegex.exec(lastBlock)) !== null) {
            if (playerMap[m[1]]) {
                playerMap[m[1]].finalRole = m[3].trim();
                playerMap[m[1]].isAlive = !m[2].includes("死亡");
            }
        }

        const players = Object.values(playerMap);
        if (players.length > 0) {
            renderPlayersFromData(players.map(p => ({
                name: p.name,
                initialRole: p.initialRole,
                finalRole: p.finalRole,
                isAlive: p.isAlive
            })));
            statusLabel.innerText = `✅ 已解析 ${players.length} 名玩家`;
            saveDraft();
        }
    };

    // --- 動態生成玩家欄位 ---
    window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');
        const row = document.createElement('tr');
        
        // 陣營判定：從角色名稱判斷 (擴充常用關鍵字)
        const evilKeywords = ['惡魔', '爪牙', '惡魔', '代言', '女郎', '投毒', '男爵', '間諜', '洗腦', '刺客', '教父', '主謀', '魔鬼', '猩紅', '巫婆', '小惡魔'];
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

    // --- 🚀 提交戰績至後端 API ---
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

        const payload = {
            script_name: document.getElementById('match-script').value,
            storyteller: document.getElementById('match-storyteller').value,
            winning_team: document.getElementById('match-winner').value,
            admin_password: password, // 注意：這裏要對齊後端接收的名稱
            location: document.getElementById('match-location').value,
            date: document.getElementById('match-date').value,
            players: Array.from(document.querySelectorAll('#players-list tr')).map(row => ({
                name: row.querySelector('.p-name').value,
                role: row.querySelector('.p-final').value,
                team: row.querySelector('.p-team').value,
                is_alive: row.querySelector('.p-status').value === 'alive'
            }))
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
                // 優化錯誤顯示：處理 FastAPI 傳回的詳細錯誤陣列
                let errorDetail = result.detail || "提交失敗";
                if (Array.isArray(errorDetail)) {
                    errorDetail = errorDetail.map(err => `${err.loc.join('.')}: ${err.msg}`).join('\n');
                }
                throw new Error(errorDetail);
            }
        } catch (err) {
            console.error("提交失敗:", err);
            alert(`❌ 儲存出錯：\n${err.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> 確認並提交戰績`;
        }
    });

    // 處理檔案上傳
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

    // 初始化執行
    initRecord();
}
