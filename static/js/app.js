const API_BASE = ''; // 已改為相對路徑

document.addEventListener('DOMContentLoaded', () => {
    fetchStats();

    // 監聽排行榜標籤切換
    const filterButtons = document.querySelectorAll('#player-filter button');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderPlayersBox(window.currentStats.players, e.target.dataset.team);
        });
    });
});

async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE}/stats/`);
        if (!response.ok) throw new Error('網路回應不正常');
        const data = await response.json();

        // 保存全域狀態
        window.currentStats = data;

        // 更新數據總覽
        document.getElementById('val-total-matches').innerText = data.total_matches;
        document.getElementById('val-total-players').innerText = data.players.length;

        // 渲染排行榜 (預設 綜合榜)
        renderPlayersBox(data.players, 'all');

        // 渲染熱門角色
        renderCharacters(data.characters);

        // 渲染名人堂
        updateHallOfFame(data.players, data.characters);

    } catch (error) {
        console.error("無法取得數據:", error);
        document.getElementById('players-tbody').innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">無法召喚靈魂，請確認後端連線是否正常？</td></tr>`;
    }
}

function renderPlayersBox(players, teamFilter) {
    const tbody = document.getElementById('players-tbody');
    tbody.innerHTML = '';

    // 門檻：至少玩過 3 局才上分榜
    let validPlayers = players.filter(p => {
        if (teamFilter === 'all') return p.total_played >= 3;
        if (teamFilter === 'good') return p.good_played >= 3;
        if (teamFilter === 'bad') return p.bad_played >= 3;
    });

    // 排序勝率
    validPlayers.sort((a, b) => {
        let rateA = teamFilter === 'all' ? a.win_rate : (teamFilter === 'good' ? a.good_win_rate : a.bad_win_rate);
        let rateB = teamFilter === 'all' ? b.win_rate : (teamFilter === 'good' ? b.good_win_rate : b.bad_win_rate);
        return rateB - rateA;
    });

    if (validPlayers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading">獻祭的生命還不夠多（需參與至少 3 場遊戲才能上榜）</td></tr>`;
        return;
    }

    validPlayers.slice(0, 10).forEach((p, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';

        let winRate, totalGames;
        let pClass = "bg-white"; 

        if (teamFilter === 'all') { winRate = p.win_rate; totalGames = p.total_played; pClass = ""; }
        if (teamFilter === 'good') { winRate = p.good_win_rate; totalGames = p.good_played; pClass = "blue"; }
        if (teamFilter === 'bad') { winRate = p.bad_win_rate; totalGames = p.bad_played; pClass = "red"; }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="rank-badge ${rankClass}">${rank}</span></td>
            <td class="player-name">${p.name}</td>
            <td>${totalGames}</td>
            <td style="font-weight:bold">${winRate}%</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill ${pClass}" style="width: 0%"></div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);

        setTimeout(() => {
            const fill = tr.querySelector('.progress-fill');
            if (fill) fill.style.width = `${winRate}%`;
        }, 100);
    });
}

function renderCharacters(characters) {
    const container = document.getElementById('characters-list');
    container.innerHTML = '';

    if (characters.length === 0) {
        container.innerHTML = `<div class="loading">尚未紀錄任何角色。</div>`;
        return;
    }

    characters.slice(0, 5).forEach((c, index) => {
        const topClass = index === 0 ? 'top-1' : '';
        const item = document.createElement('div');
        item.className = `char-item ${topClass}`;
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.8rem;">
                <img src="/static/icons/${c.character}.png" class="char-icon" onerror="this.style.display='none'" alt="">
                <div class="char-info">
                    <span class="char-name">${c.character}</span>
                    <span class="char-stats">出場: ${c.played} 次</span>
                </div>
            </div>
            <div class="char-winrate ${c.win_rate > 50 ? 'text-blue' : 'text-red'}">
                勝率 ${c.win_rate}%
            </div>
        `;
        container.appendChild(item);
    });
}

function updateHallOfFame(players, characters) {
    if (players.length > 0) {
        let evilPlayers = players.filter(p => p.bad_played >= 2).sort((a, b) => b.bad_win_rate - a.bad_win_rate);
        if (evilPlayers.length > 0) document.getElementById('best-evil-player').innerText = evilPlayers[0].name;

        let goodPlayers = players.filter(p => p.good_played >= 2).sort((a, b) => b.good_win_rate - a.good_win_rate);
        if (goodPlayers.length > 0) document.getElementById('best-good-player').innerText = goodPlayers[0].name;
    }

    if (characters.length > 0) {
        let metaChar = characters.sort((a, b) => b.played - a.played)[0];
        document.getElementById('most-played-char').innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.2rem;">
                <img src="/static/icons/${metaChar.character}.png" class="char-icon-small" onerror="this.style.display='none'" alt="">
                <span>${metaChar.character}</span>
            </div>
        `;
    }
}
