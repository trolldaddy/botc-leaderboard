const API_BASE = '';

// 初始化至少添加 5 个玩家行
document.addEventListener('DOMContentLoaded', () => {
    for (let i = 0; i < 5; i++) {
        addPlayerRow();
    }

    document.getElementById('record-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitMatch();
    });
});

function addPlayerRow() {
    const tbody = document.getElementById('players-list');
    const tr = document.createElement('tr');
    tr.className = 'player-entry';

    tr.innerHTML = `
        <td>
            <input type="text" class="form-control p-name" placeholder="暱稱" required>
        </td>
        <td>
            <input type="text" class="form-control p-char" placeholder="例如：小惡魔" required>
        </td>
        <td>
            <select class="form-control p-init">
                <option value="good">善良</option>
                <option value="bad">邪惡</option>
            </select>
        </td>
        <td>
            <select class="form-control p-final">
                <option value="good">善良</option>
                <option value="bad">邪惡</option>
            </select>
        </td>
        <td style="text-align:center;">
            <input type="checkbox" class="p-survive" style="width: 20px; height: 20px;">
        </td>
        <td>
            <button type="button" class="btn" style="background: rgba(255,0,0,0.2); color: #ff4d4d; padding: 0.5rem;" onclick="this.closest('tr').remove()">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
}

async function submitMatch() {
    const msgBox = document.getElementById('form-msg');
    msgBox.innerText = "對局儲存中 (Saving) ...";
    msgBox.className = "text-blue";

    try {
        // 构建玩家数据，动态注册新玩家
        const rows = document.querySelectorAll('.player-entry');
        if (rows.length < 5) {
            throw new Error("一場遊戲至少需要5名玩家！");
        }

        const matchPlayers = [];

        for (let row of rows) {
            const nameInput = row.querySelector('.p-name').value.trim();
            if (!nameInput) continue;

            // 1. 获取或创建玩家
            let playerId = await getOrCreatePlayer(nameInput);

            // 2. 收集此玩家这局表现
            matchPlayers.push({
                player_id: playerId,
                character: row.querySelector('.p-char').value.trim(),
                initial_alignment: row.querySelector('.p-init').value,
                final_alignment: row.querySelector('.p-final').value,
                survived: row.querySelector('.p-survive').checked
            });
        }

        // 3. 构建比赛表单
        const payload = {
            script: document.getElementById('match-script').value,
            storyteller: document.getElementById('match-storyteller').value,
            winning_team: document.getElementById('match-winner').value,
            password: document.getElementById('match-password').value,
            players: matchPlayers
        };

        // 4. 提交数据
        const response = await fetch(`${API_BASE}/matches/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "儲存失敗！可能是管理員密碼錯誤。");
        }

        msgBox.innerHTML = '<i class="fa-solid fa-check"></i> 覆盤紀錄已成功儲存！';
        msgBox.className = "text-gold";

        // 成功后重置表单，但不清空密码和说书人，方便连续录入
        setTimeout(() => {
            const script = document.getElementById('match-script').value;
            const st = document.getElementById('match-storyteller').value;
            const pw = document.getElementById('match-password').value;
            document.getElementById('record-form').reset();
            document.getElementById('match-script').value = script;
            document.getElementById('match-storyteller').value = st;
            document.getElementById('match-password').value = pw;
            msgBox.innerHTML = '';
        }, 3000);

    } catch (error) {
        msgBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 错误: ${error.message}`;
        msgBox.className = "text-red";
    }
}

// 辅助函数：根据名字检查并在后端创建玩家
async function getOrCreatePlayer(name) {
    try {
        // 先尝试创建，如果已存在后端会返回 400
        const res = await fetch(`${API_BASE}/players/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });

        if (res.ok) {
            const newPlayer = await res.json();
            return newPlayer.id;
        } else {
            // 已存在，则去获取列表找到他
            const listRes = await fetch(`${API_BASE}/players/`);
            const allPlayers = await listRes.json();
            const existing = allPlayers.find(p => p.name.toLowerCase() === name.toLowerCase());
            return existing.id;
        }
    } catch (err) {
        throw new Error("Failed to link player data.");
    }
}
