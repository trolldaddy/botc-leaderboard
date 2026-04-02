/**
 * BOTC Stats - 錄入對局邏輯 (RECORD MATCH)
 * 整合：首尾狀態解析、智慧草稿、後端 API 對接 (對齊 Match / MatchPlayer 模型)
 */

{
    const initRecord = () => {
        console.log("📝 錄入系統初始化中...");
        
        // 1. 設定日期輸入框預設值 (今天)
        const dateInput = document.getElementById('match-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        const list = document.getElementById('players-list');
        if (!list) return;

        // 2. 優先載入草稿或傳輸數據
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
            // 預設生成 12 行 (血染標準人數)
            list.innerHTML = "";
            for(let i = 0; i < 12; i++) addPlayerRow();
        }
    };

    // --- 💾 草稿儲存系統 ---
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

    // --- 🧹 清空表單 ---
    window.clearFullForm = () => {
        if (!confirm("確定要清空所有填寫內容嗎？此動作不可逆。")) return;
        localStorage.removeItem('botc_record_draft');
        const form = document.getElementById('record-form');
        if (form) form.reset();
        document.getElementById('log-input').value = "";
        document.getElementById('import-status').innerText = "";
        initRecord();
    };

    // --- 🔮 核心：解析覆盤文字 (提取首尾對照) ---
    window.autoFillFromLog = () => {
        const text = document.getElementById('log-input').value;
        if (!text.trim()) return;

        const statusLabel = document.getElementById('import-status');
        statusLabel.innerText = "⏳ 正在提取首尾狀態...";

        // 解析劇本/地點
        const scriptMatch = text.match(/劇本名稱：(.+)/);
        const locationMatch = text.match(/遊戲地點：(.+)/);
        if (scriptMatch) document.getElementById('match-script').value = scriptMatch[1].trim();
        if (locationMatch) document.getElementById('match-location').value = locationMatch[1].trim();

        // 以「【當前玩家狀態】」作為分隔點
        const blocks = text.split('【當前玩家狀態】');
        if (blocks.length < 2) {
            statusLabel.innerText = "❌ 找不到玩家狀態區塊";
            return;
        }

        const firstBlock = blocks[1]; // 初始狀態 (遊戲開始)
        const lastBlock = blocks[blocks.length - 1]; // 最終狀態 (遊戲結束)

        // 正則表達式匹配：[1號] 存活 - (角色) 玩家名
        const rowRegex = /\[(\d+)號\]\s+([^\s]+)\s+-\s+\(([^)]+)\)\s+(.+)/g;
        const playerMap = {};

        // 1. 抓取初始名單
        let m;
        while ((m = rowRegex.exec(firstBlock)) !== null) {
            const id = m[1];
            const roleStr = m[3].trim();
            const name = m[4].trim();
            playerMap[id] = { 
                name: name, 
                initial_character: roleStr, 
                final_character: roleStr, 
                survived: true 
            };
        }

        // 2. 抓取最終名單並覆蓋狀態
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
            statusLabel.innerText = `✅ 已解析 ${players.length} 名玩家`;
            saveDraft();
        } else {
            statusLabel.innerText = "❌ 解析失敗，請確認格式";
        }
    };

    // --- ➕ 動態生成玩家行 ---
    window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');
        const row = document.createElement('tr');
        
        // 陣營初步判定
        const evilKeywords = ['惡魔', '爪牙', '惡魔', '代言', '女郎', '投毒', '男爵', '間諜', '洗腦', '刺客', '教父', '主謀', '魔鬼', '猩紅', '巫婆', '小惡魔', '殭怖', '普卡', '沙巴洛斯', '珀', '渦流', '諾-達鯴', '亡骨魔'];
        const currentRole = data?.final_character || "";
        const isEvil = evilKeywords.some(k => currentRole.includes(k));

        row.innerHTML = `
            <td><input type="text" class="form-control dark-input p-name" value="${data?.name || ''}" placeholder="玩家暱稱" oninput="saveDraft()"></td>
            <td><input type="text" class="form-control dark-input p-initial" value="${data?.initial_character || ''}" placeholder="初始角色" oninput="saveDraft()"></td>
            <td><input type="text" class="form-control dark-input p-final" value="${data?.final_character || ''}" placeholder="最終角色" oninput="saveDraft()"></td>
            <td>
                <select class="form-control dark-input p-team" oninput="saveDraft()">
                    <option value="good" ${!isEvil ? 'selected' : ''}>正義 Good</option>
                    <option value="evil" ${isEvil ? 'selected' : ''}>邪惡 Evil</option>
                </select>
            </td>
            <td>
                <select class="form-control dark-input p-status" oninput="saveDraft()">
                    <option value="alive" ${!data || data.survived ? 'selected' : ''}>存活</option>
                    <option value="dead" ${data && !data.survived ? 'selected' : ''}>死亡</option>
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

    // --- 🚀 提交數據至後端 ---
    document.getElementById('record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('submit-btn');
        const password = document.getElementById('admin-password').value;
        const apiBase = window.API_BASE || "";

        btn.disabled = true;
        btn.innerText = "⏳ 正在寫入魔典...";

        // 構建 Payload，精確對應 models.py 欄位
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
            })).filter(p => p.name !== "") // 過濾空行
        };

        try {
            const response = await fetch(`${apiBase}/api/matches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // 安全讀取 Response (處理 500 HTML 錯誤)
            const contentType = response.headers.get("content-type");
            let result;
            if (contentType && contentType.includes("application/json")) {
                result = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`伺服器報錯 (HTTP ${response.status})\n這通常代表資料庫欄位不匹配或程式碼崩潰。`);
            }

            if (response.ok) {
                alert("🎉 戰績已成功保存！魔典已更新。");
                localStorage.removeItem('botc_record_draft');
                if (window.loadPage) window.loadPage('dashboard');
            } else {
                throw new Error(result.detail || "儲存失敗");
            }
        } catch (err) {
            console.error("提交失敗:", err);
            alert(`❌ 儲存失敗：\n${err.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> 確認並提交戰績`;
        }
    });

    // 檔案上傳觸發
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

    // 啟動初始化
    initRecord();
}
