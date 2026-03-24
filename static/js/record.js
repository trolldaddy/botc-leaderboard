// 確保作用域獨立，防止 SPA 架構下的變數衝突
{
    const initRecord = () => {
        console.log("📝 錄入系統正在啟動...");
        
        // 1. 設定日期輸入框的預設值為今天
        const dateInput = document.getElementById('match-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        const list = document.getElementById('players-list');
        if (!list) return;

        // 2. 優先檢查是否有從「覆盤紀錄器」同步過來的臨時資料
        const transferData = localStorage.getItem('botc_transfer_data');
        if (transferData) {
            console.log("📥 偵測到來自魔典的同步數據...");
            const data = JSON.parse(transferData);
            list.innerHTML = ""; // 清空原本內容
            data.players.forEach(p => addPlayerRow(p));
            localStorage.removeItem('botc_transfer_data'); // 填充完畢後清除，避免重複填充
        } else {
            // 3. 如果沒有同步資料，則預設生成 5 行空白填寫格
            list.innerHTML = "";
            for(let i = 0; i < 5; i++) {
                addPlayerRow();
            }
        }
    };

    /**
     * 核心解析邏輯：從文字紀錄中自動填充表單
     */
    window.autoFillFromLog = () => {
        const text = document.getElementById('log-input').value;
        if (!text.trim()) return;

        const statusLabel = document.getElementById('import-status');
        statusLabel.innerText = "⏳ 正在解析內容...";

        // A. 解析基礎資訊 (正則表達式)
        const scriptMatch = text.match(/劇本名稱：(.+)/);
        const dateMatch = text.match(/遊戲日期：([\d-]+)/);
        const locationMatch = text.match(/遊戲地點：(.+)/);

        if (scriptMatch) document.getElementById('match-script').value = scriptMatch[1].trim();
        if (dateMatch) document.getElementById('match-date').value = dateMatch[1].trim();
        if (locationMatch) document.getElementById('match-location').value = locationMatch[1].trim();

        // B. 解析玩家列表
        // 格式支援：[1號] 存活 - (角色 / 實際:隱藏角色) 玩家姓名
        const playerRegex = /\[(\d+)號\]\s+(存活|死亡)\s+-\s+\(([^)]+)\)\s+(.+)/g;
        const players = [];
        let match;

        while ((match = playerRegex.exec(text)) !== null) {
            const roleInfo = match[3]; 
            let initialRole = roleInfo;
            let actualRole = "";

            // 處理「陰陽師 / 實際:酒鬼」這類結構
            if (roleInfo.includes('/')) {
                const parts = roleInfo.split('/');
                initialRole = parts[0].trim();
                actualRole = parts[1].replace('實際:', '').trim();
            }

            players.push({
                isAlive: match[2] === "存活",
                role: initialRole,
                actualRole: actualRole,
                name: match[4].trim()
            });
        }

        if (players.length > 0) {
            const list = document.getElementById('players-list');
            list.innerHTML = ""; // 清空預設格
            players.forEach(p => addPlayerRow(p));
            statusLabel.innerText = `✅ 已成功填充 ${players.length} 名玩家`;
            statusLabel.style.color = "var(--accent-gold)";
        } else {
            statusLabel.innerText = "❌ 解析失敗：找不到標準玩家格式";
            statusLabel.style.color = "var(--accent-red)";
        }
    };

    /**
     * 匯入檔案按鈕處理
     */
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
     * 動態新增玩家列
     */
    window.addPlayerRow = (data = null) => {
        const list = document.getElementById('players-list');
        const row = document.createElement('tr');
        
        // 判定陣營預設值 (簡單邏輯)
        const isEvil = data && (data.role.includes('惡魔') || data.role.includes('爪牙') || data.role === '小惡魔');

        row.innerHTML = `
            <td><input type="text" class="form-control dark-input p-name" value="${data ? data.name : ''}" placeholder="玩家名字"></td>
            <td><input type="text" class="form-control dark-input p-role" value="${data ? data.role : ''}" placeholder="例如：共情者"></td>
            <td><input type="text" class="form-control dark-input p-actual" value="${data ? data.actualRole : ''}" placeholder="實際身分 (如：酒鬼)"></td>
            <td>
                <select class="form-control dark-input p-team">
                    <option value="good" ${!isEvil ? 'selected' : ''}>好人陣營</option>
                    <option value="evil" ${isEvil ? 'selected' : ''}>壞人陣營</option>
                </select>
            </td>
            <td>
                <select class="form-control dark-input p-status">
                    <option value="alive" ${!data || data.isAlive ? 'selected' : ''}>存活</option>
                    <option value="dead" ${data && !data.isAlive ? 'selected' : ''}>死亡</option>
                </select>
            </td>
            <td>
                <button type="button" class="btn" style="color: var(--text-muted); padding: 0.2rem;" onclick="this.closest('tr').remove()">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        list.appendChild(row);
    };

    // 表單提交攔截
    document.getElementById('record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("💾 正在準備存檔...");
        alert("匯入與解析功能已完成！下一步我們將串接 FastAPI 以保存這筆紀錄。");
    });

    // 啟動初始化
    initRecord();
}
