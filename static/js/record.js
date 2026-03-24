// 確保作用域獨立，防止 API_BASE 衝突
{
    const initRecord = () => {
        console.log("📝 錄入系統已就緒");
        
        // 設定預設日期為今天
        const dateInput = document.getElementById('match-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // 🟢 自動讀取「覆盤紀錄器」同步過來的資料
        const transferData = localStorage.getItem('botc_transfer_data');
        if (transferData) {
            console.log("📥 偵測到同步數據，正在填充...");
            const data = JSON.parse(transferData);
            fillFormWithData(data);
            localStorage.removeItem('botc_transfer_data'); // 用完即丟
        }
    };

    // 讀取檔案
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

    // 核心解析邏輯：解析文字檔內容
    window.autoFillFromLog = () => {
        const text = document.getElementById('log-input').value;
        if (!text.trim()) return;

        const statusLabel = document.getElementById('import-status');
        statusLabel.innerText = "⏳ 正在解析...";

        // 1. 解析基礎資訊
        const scriptMatch = text.match(/劇本名稱：(.+)/);
        const dateMatch = text.match(/遊戲日期：([\d-]+)/);
        const locationMatch = text.match(/遊戲地點：(.+)/);

        if (scriptMatch) document.getElementById('match-script').value = scriptMatch[1].trim();
        if (dateMatch) document.getElementById('match-date').value = dateMatch[1].trim();
        if (locationMatch) document.getElementById('match-location').value = locationMatch[1].trim();

        // 2. 解析玩家狀態 (使用多行正則)
        // 格式例：[1號] 存活 - (陰陽師 / 實際:酒鬼) 玩家 1
        const playerRegex = /\[(\d+)號\]\s+(存活|死亡)\s+-\s+\(([^)]+)\)\s+(.+)/g;
        const players = [];
        let match;

        while ((match = playerRegex.exec(text)) !== null) {
            const roleInfo = match[3]; // "陰陽師 / 實際:酒鬼" 或 "共情者"
            let initialRole = roleInfo;
            let actualRole = "";

            if (roleInfo.includes('/')) {
                const parts = roleInfo.split('/');
                initialRole = parts[0].trim();
                actualRole = parts[1].replace('實際:', '').trim();
            }

            players.push({
                id: match[1],
                isAlive: match[2] === "存活",
                role: initialRole,
                actualRole: actualRole || initialRole,
                name: match[4].trim()
            });
        }

        if (players.length > 0) {
            renderPlayersList(players);
            statusLabel.innerText = `✅ 成功匯入 ${players.length} 名玩家`;
        } else {
            statusLabel.innerText = "❌ 找不到玩家數據，請檢查格式";
        }
    };

    // 填充列表
    const renderPlayersList = (players) => {
        const list = document.getElementById('players-list');
        list.innerHTML = "";
        players.forEach(p => addPlayerRow(p));
    };

    // 新增玩家列
    window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td><input type="text" class="form-control p-name" value="${data ? data.name : ''}" placeholder="玩家名字"></td>
            <td><input type="text" class="form-control p-role" value="${data ? data.role : ''}" placeholder="角色"></td>
            <td><input type="text" class="form-control p-actual" value="${data ? data.actualRole : ''}" placeholder="真實身分"></td>
            <td>
                <select class="form-control p-team">
                    <option value="good">正義</option>
                    <option value="evil">邪惡</option>
                </select>
            </td>
            <td>
                <select class="form-control p-status">
                    <option value="alive" ${data && data.isAlive ? 'selected' : ''}>存活</option>
                    <option value="dead" ${data && !data.isAlive ? 'selected' : ''}>死亡</option>
                </select>
            </td>
            <td><button type="button" class="btn" style="color: var(--accent-red);" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash-can"></i></button></td>
        `;
        list.appendChild(row);
    };

    // 監聽表單提交
    document.getElementById('record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        // 這裡未來會寫串接後端的 fetch 代碼
        console.log("💾 正在準備存檔...");
        alert("功能開發中：資料已收集完畢，等待串接資料庫！");
    });

    // 執行初始化
    initRecord();
}
