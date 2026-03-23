const API_BASE = '';
let matchToDelete = null;

document.addEventListener('DOMContentLoaded', () => {
    fetchHistory();
});

async function fetchHistory() {
    try {
        const response = await fetch(`${API_BASE}/matches/`);
        if (!response.ok) throw new Error('Failed to fetch');

        const matches = await response.json();
        const tbody = document.getElementById('history-tbody');
        tbody.innerHTML = '';

        if (matches.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="loading">时空长河中暂时没有记录。</td></tr>`;
            return;
        }

        matches.forEach(m => {
            const tr = document.createElement('tr');
            const dateStr = new Date(m.date).toLocaleString('zh-CN');
            const winTeamStr = m.winning_team === 'good' ? '<span class="text-blue">正义盟军</span>' : '<span class="text-red">邪恶阵营</span>';

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td style="font-weight: bold;">${m.script}</td>
                <td>${m.storyteller}</td>
                <td>${winTeamStr}</td>
                <td>${m.players.length} 人</td>
                <td>
                    <button class="btn" style="padding: 0.4rem 0.8rem; background: rgba(230,57,70,0.2); color: #ff4d4d;" onclick="openDeleteModal(${m.id})">
                        <i class="fa-solid fa-trash"></i> 删除
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        document.getElementById('history-tbody').innerHTML = `<tr><td colspan="6" class="loading text-red">获取历史失败。</td></tr>`;
    }
}

function openDeleteModal(matchId) {
    matchToDelete = matchId;
    document.getElementById('delete-pw').value = '';
    document.getElementById('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
    matchToDelete = null;
    document.getElementById('delete-modal').style.display = 'none';
}

async function confirmDelete() {
    const pw = document.getElementById('delete-pw').value;
    if (!pw) {
        alert("必须输入密码！");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/matches/${matchToDelete}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });

        if (res.ok) {
            closeDeleteModal();
            fetchHistory(); // 刷新列表
        } else {
            const err = await res.json();
            alert(`删除失败: ${err.detail}`);
        }
    } catch (err) {
        alert("网络请求失败");
        console.error(err);
    }
}
