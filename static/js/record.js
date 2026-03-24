// 確保作用域獨立
{
    const initRecord = () => {
        console.log("📝 錄入系統初始化中...");
        
        // 設定預設日期
        const dateInput = document.getElementById('match-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        const list = document.getElementById('players-list');
        if (!list) return;

        // 檢查魔典同步資料
        const transferData = localStorage.getItem('botc_transfer_data');
        if (transferData) {
            const data = JSON.parse(transferData);
            list.innerHTML = "";
            data.players.forEach(p => addPlayerRow(p));
            localStorage.removeItem('botc_transfer_data');
        } else if (list.children.length === 0) {
            // 預設生成 5 行
            for(let i = 0; i < 5; i++) addPlayerRow();
        }
    };

    /**
     * 核心解析邏輯：抓取「第一份」與「最後一份」玩家狀態
     */
    window.autoFillFromLog = () => {
        const text = document.getElementById('log-input').value;
        if (!text.trim()) return;

        const statusLabel = document.getElementById('import-status');
        statusLabel.innerText = "⏳ 正在分析起點與終點...";

        // 1. 解析基礎資訊
        const scriptMatch = text.match(/劇本名稱：(.+)/);
        const dateMatch = text.match(/遊戲日期：([\d-]+)/);
        const locationMatch = text.match(/遊戲地點：(.+)/);

        if (scriptMatch) document.getElementById('match-script').value = scriptMatch[1].trim();
        if (dateMatch) document.getElementById('match-date').value = dateMatch[1].trim();
        if (locationMatch) document.getElementById('match-location').value = locationMatch[1].trim();

        // 2. 切分狀態區塊
        const blocks = text.split('【當前玩家狀態】');
        if (blocks.length < 2) {
            statusLabel.innerText = "❌ 格式錯誤：找不到玩家狀態表";
            return;
        }

        const firstBlock = blocks[1]; // 第一個狀態區
        const lastBlock = blocks[blocks.length - 1]; // 最後一個狀態區

        // 正則表達式：[數字號] 狀態 - (角色資訊) 姓名
        const rowRegex = /\[(\d+)號\]\s+(存活|死亡)\s+-\s+\(([^)]+)\)\s+(.+)/g;

        const playerMap = {}; // 用玩家 ID 作為 key 來合併數據

        // 解析初始狀態
        let match;
        while ((match = rowRegex.exec(firstBlock)) !== null) {
            const id = match[1];
            playerMap[id] = {
                name: match[4].trim(),
                initialRole: match[3].trim(),
                finalRole: match[3].trim(), // 預設跟初始一樣
                isAlive: match[2] === "存活"
            };
        }

        // 解析最終狀態 (重置 regex 的 index)
        rowRegex.lastIndex = 0;
        while ((match = rowRegex.exec(lastBlock)) !== null) {
            const id = match[1];
            if (playerMap[id]) {
                playerMap[id].finalRole = match[3].trim();
                playerMap[id].isAlive = match[2] === "存活";
            }
        }

        // 轉為陣列並渲染
        const players = Object.values(playerMap);
        if (players.length > 0) {
            const list = document.getElementById('players-list');
            list.innerHTML = "";
            players.forEach(p => addPlayerRow(p));
            statusLabel.innerText = `✅ 成功對齊 ${players.length} 名玩家數據`;
        }
    };

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

    /**
     * 動態新增玩家列 (依照新欄位順序：暱稱、初始、最終、陣營、狀態)
     */
    window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');
        const row = document.createElement('tr');
        
        // 陣營判定邏輯：如果角色包含惡魔/爪牙字眼
        const isEvil = data && (data.finalRole.includes('惡魔') || data.finalRole.includes('爪牙') || data.finalRole.includes('小惡魔'));

        row.innerHTML = `
            <td><input type="text" class="form-control dark-input p-name" value="${data ? data.name : ''}" placeholder="玩家名"></td>
            <td><input type="text" class="form-control dark-input p-initial" value="${data ? data.initialRole : ''}" placeholder="初始角色"></td>
            <td><input type="text" class="form-control dark-input p-final" value="${data ? data.finalRole : ''}" placeholder="最終角色"></td>
            <td>
                <select class="form-control dark-input p-team">
                    <option value="good" ${!isEvil ? 'selected' : ''}>正義 Good</option>
                    <option value="evil" ${isEvil ? 'selected' : ''}>邪惡 Evil</option>
                </select>
            </td>
            <td>
                <select class="form-control dark-input p-status">
                    <option value="alive" ${!data || data.isAlive ? 'selected' : ''}>存活</option>
                    <option value="dead" ${data && !data.isAlive ? 'selected' : ''}>死亡</option>
                </select>
            </td>
            <td style="text-align:center;">
                <button type="button" class="btn" style="color: rgba(255,255,255,0.2); padding: 5px;" onclick="this.closest('tr').remove()">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </td>
        `;
        list.appendChild(row);
    };

    // 攔截提交
    document.getElementById('record-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        alert("功能預覽：數據已收集完畢，準備發送至後端資料庫！");
    });

    initRecord();
}
