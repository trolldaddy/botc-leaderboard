const API_BASE = ''; // 改為相對路徑

document.addEventListener('DOMContentLoaded', () => {
    // 預設添加一個空白行，防止表格太乾淨
    if (document.getElementById('players-list').children.length === 0) {
        addPlayerRow();
    }

    // 處理表單提交
    document.getElementById('record-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        submitGame();
    });
});

// --- 核心功能：智慧導錄解析 ---
function autoFillFromLog() {
    const logText = document.getElementById('log-input').value;
    if (!logText) return alert("請先貼上紀錄檔內容！");

    // 1. 尋找最後一個「當前玩家狀態」區塊
    const sections = logText.split("【當前玩家狀態】");
    if (sections.length < 2) return alert("解析失敗：找不到「當前玩家狀態」區塊，請確認格式。");
    const lastSection = sections[sections.length - 1];

    // 2. 正則解析：[數字號] 狀態 - (角色資訊) 玩家名
    const regex = /\[(\d+)號\]\s*(.*?)\s*-\s*\((.*?)\)\s*(.*)/g;
    let match;
    const players = [];

    while ((match = regex.exec(lastSection)) !== null) {
        let seat = match[1];
        let status = match[2];     // 存活 或 死亡
        let charInfo = match[3];   // 角色資訊，如 "祖母 / 實際:酒鬼"
        let playerName = match[4]; // 玩家名

        // 處理實際身分
        let actualChar = charInfo.includes("實際:") 
            ? charInfo.split("實際:")[1].trim() 
            : charInfo.trim();

        players.push({
            name: playerName.trim(),
            character: actualChar,
            isAlive: !status.includes("死亡")
        });
    }

    if (players.length === 0) return alert("解析失敗：找不到任何玩家資訊。");

    // 3. 清空現有表格並填充
    const list = document.getElementById('players-list');
    list.innerHTML = '';
    
    players.forEach(p => {
        addPlayerRow(p);
    });

    alert(`成功解析 ${players.length} 位玩家！請手動調整陣營與勝負關係。`);
}

// --- 渲染表格行 ---
function addPlayerRow(data = null) {
    const tbody = document.getElementById('players-list');
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
        <td><input type="text" class="form-control p-name" placeholder="玩家姓名" value="${data ? data.name : ''}" required></td>
        <td><input type="text" class="form-control p-char" placeholder="角色" value="${data ? data.character : ''}" required></td>
        <td>
            <select class="form-control p-initial-team">
                <option value="good">正義</option>
                <option value="bad">邪惡</option>
            </select>
        </td>
        <td>
            <select class="form-control p-final-team">
                <option value="good">正義</option>
                <option value="bad">邪惡</option>
            </select>
        </td>
        <td>
            <select class="form-control p-status">
                <option value="alive" ${data && data.isAlive ? 'selected' : ''}>存活</option>
                <option value="dead" ${data && !data.isAlive ? 'selected' : ''}>死亡</option>
            </select>
        </td>
        <td>
            <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
}

// --- 提交數據到後端 ---
async function submitGame() {
    const msgDiv = document.getElementById('form-msg');
    msgDiv.innerText = "正在封印紀錄...";
    msgDiv.style.color = "var(--gold)";

    const rows = document.querySelectorAll('#players-list tr');
    const players = [];
    
    rows.forEach(row => {
        players.push({
            name: row.querySelector('.p-name').value,
            character: row.querySelector('.p-char').value,
            initial_team: row.querySelector('.p-initial-team').value,
            final_team: row.querySelector('.p-final-team').value,
            is_alive: row.querySelector('.p-status').value === 'alive'
        });
    });

    const payload = {
        script: document.getElementById('match-script').value,
        storyteller: document.getElementById('match-storyteller').value,
        winning_team: document.getElementById('match-winner').value,
        password: document.getElementById('match-password').value,
        players: players
    };

    try {
        const response = await fetch(`${API_BASE}/add_game`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok) {
            msgDiv.innerText = "紀錄成功！魔典已更新。";
            msgDiv.style.color = "#00ff00";
            setTimeout(() => location.href = 'index.html', 1500);
        } else {
            msgDiv.innerText = "紀錄失敗：" + (result.detail || "未知錯誤");
            msgDiv.style.color = "#ff4d4d";
        }
    } catch (err) {
        msgDiv.innerText = "連線失敗，請檢查伺服器。";
        msgDiv.style.color = "#ff4d4d";
    }
}
