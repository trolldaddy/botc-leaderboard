{
    const initRecord = () => {
        console.log("📝 錄入系統正在初始化...");
        
        // 預設日期
        const dateInput = document.getElementById('match-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        const list = document.getElementById('players-list');
        if (!list) return;

        // 讀取優先級：魔典同步 > 本地草稿 > 預設 5 行
        const transferData = localStorage.getItem('botc_transfer_data');
        const draftData = localStorage.getItem('botc_record_draft');

        if (transferData) {
            const data = JSON.parse(transferData);
            renderPlayers(data.players.map(p => ({
                name: p.name,
                initialRole: p.role,
                finalRole: p.actualRole || p.role,
                isAlive: p.isAlive
            })));
            localStorage.removeItem('botc_transfer_data');
        } else if (draftData) {
            restoreDraft(JSON.parse(draftData));
        } else {
            list.innerHTML = "";
            for(let i = 0; i < 5; i++) addPlayerRow();
        }
    };

    // 草稿保存邏輯
    window.saveDraft = () => {
        const data = {
            script: document.getElementById('match-script').value,
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
        localStorage.setItem('botc_record_draft', JSON.stringify(data));
        document.getElementById('save-status').innerText = "草稿已自動儲存於 " + new Date().toLocaleTimeString();
    };

    const restoreDraft = (data) => {
        document.getElementById('match-script').value = data.script || "";
        document.getElementById('match-date').value = data.date || "";
        document.getElementById('match-location').value = data.location || "";
        document.getElementById('match-storyteller').value = data.storyteller || "";
        document.getElementById('match-winner').value = data.winner || "good";
        renderPlayers(data.players);
    };

    const renderPlayers = (players) => {
        const list = document.getElementById('players-list');
        list.innerHTML = "";
        players.forEach(p => addPlayerRow(p));
    };

    window.clearFullForm = () => {
        if (!confirm("確定要清空所有內容嗎？")) return;
        localStorage.removeItem('botc_record_draft');
        document.getElementById('record-form').reset();
        document.getElementById('log-input').value = "";
        document.getElementById('import-status').innerText = "";
        initRecord();
    };

    // 核心：解析文字紀錄（首份名單為初始，最後一份名單為最終）
    window.autoFillFromLog = () => {
        const text = document.getElementById('log-input').value;
        if (!text.trim()) return;

        const statusLabel = document.getElementById('import-status');
        statusLabel.innerText = "⏳ 正在分析首尾狀態...";

        // 基本資訊解析
        const scriptMatch = text.match(/劇本名稱：(.+)/);
        const dateMatch = text.match(/遊戲日期：([\d-]+)/);
        const locationMatch = text.match(/遊戲地點：(.+)/);

        if (scriptMatch) document.getElementById('match-script').value = scriptMatch[1].trim();
        if (dateMatch) document.getElementById('match-date').value = dateMatch[1].trim();
        if (locationMatch) document.getElementById('match-location').value = locationMatch[1].trim();

        const blocks = text.split('【當前玩家狀態】');
        if (blocks.length < 2) {
            statusLabel.innerText = "❌ 格式錯誤";
            return;
        }

        const firstBlock = blocks[1];
        const lastBlock = blocks[blocks.length - 1];
        const rowRegex = /\[(\d+)號\]\s+(存活|死亡)\s+-\s+\(([^)]+)\)\s+(.+)/g;
        const playerMap = {};

        // 1. 抓初始
        let m;
        while ((m = rowRegex.exec(firstBlock)) !== null) {
            playerMap[m[1]] = { 
                name: m[4].trim(), 
                initialRole: m[3].trim(), 
                finalRole: m[3].trim(), 
                isAlive: m[2] === "存活" 
            };
        }

        // 2. 抓最終
        rowRegex.lastIndex = 0;
        while ((m = rowRegex.exec(lastBlock)) !== null) {
            if (playerMap[m[1]]) {
                playerMap[m[1]].finalRole = m[3].trim();
                playerMap[m[1]].isAlive = m[2] === "存活";
            }
        }

        renderPlayers(Object.values(playerMap).map(p => ({
            name: p.name,
            initialRole: p.initialRole,
            finalRole: p.finalRole,
            isAlive: p.isAlive
        })));
        
        statusLabel.innerText = `✅ 解析成功 (${Object.keys(playerMap).length} 名玩家)`;
        saveDraft();
    };

    window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');
        const row = document.createElement('tr');
        
        // 自動判定壞人 (原始邏輯)
        const evilKeywords = ['小惡魔','爪牙','惡魔','魔鬼代言人','紅唇女郎','投毒者','男爵','間諜','洗腦師','刺客','教父','主謀'];
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
                <button type="button" class="btn" style="color: rgba(255,255,255,0.1);" onclick="this.closest('tr').remove(); saveDraft();">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </td>
        `;
        list.appendChild(row);
    };

    // 🚀 正式提交至 FastAPI 後端
    document.getElementById('record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('submit-btn');
        const password = document.getElementById('admin-password').value;
        
        if (!password) {
            alert("請輸入管理員密鑰以確認權限");
            return;
        }

        btn.disabled = true;
        btn.innerText = "正在上傳至資料庫...";

        const payload = {
            script_name: document.getElementById('match-script').value,
            storyteller: document.getElementById('match-storyteller').value,
            winning_team: document.getElementById('match-winner').value,
            admin_password: password,
            players: Array.from(document.querySelectorAll('#players-list tr')).map(row => ({
                name: row.querySelector('.p-name').value,
                role: row.querySelector('.p-final').value, // 原始後端通常存最終角色
                team: row.querySelector('.p-team').value,
                is_alive: row.querySelector('.p-status').value === 'alive'
            }))
        };

        try {
            // 使用你在 index.html 定義的 API_BASE
            const response = await fetch(`${window.API_BASE}/api/matches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert("🎉 對局紀錄已成功存入 Neon 資料庫！");
                localStorage.removeItem('botc_record_draft');
                if (window.loadPage) window.loadPage('history'); // 跳轉
            } else {
                const err = await response.json();
                throw new Error(err.detail || "儲存失敗，請檢查密碼是否正確");
            }
        } catch (err) {
            alert("❌ 提交失敗: " + err.message);
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
