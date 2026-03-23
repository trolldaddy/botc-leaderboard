const API_BASE = '';

document.addEventListener('DOMContentLoaded', () => {
    fetchStats();

    // 监听排行榜标签页切换
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
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        // 保存全局状态用于前端切换
        window.currentStats = data;

        // 更新总览
        document.getElementById('val-total-matches').innerText = data.total_matches;

        // 渲染排行榜 (默认 Overall)
        renderPlayersBox(data.players, 'all');

        // 渲染角色榜
        renderCharacters(data.characters);

        // 渲染名人堂
        updateHallOfFame(data.players, data.characters);

    } catch (error) {
        console.error("Failed to fetch stats:", error);
        document.getElementById('players-tbody').innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">無法召喚靈魂，請檢查後端是否開啟？</td></tr>`;
    }
}

function renderPlayersBox(players, teamFilter) {
    const tbody = document.getElementById('players-tbody');
    tbody.innerHTML = '';

    // 门槛：至少玩过 3 局才上分榜（防止某人只玩1局且赢了就是100%胜率）
    let validPlayers = players.filter(p => {
        if (teamFilter === 'all') return p.total_played >= 3;
        if (teamFilter === 'good') return p.good_played >= 3;
        if (teamFilter === 'bad') return p.bad_played >= 3;
    });

    // 排序
    validPlayers.sort((a, b) => {
        let rateA = teamFilter === 'all' ? a.win_rate : (teamFilter === 'good' ? a.good_win_rate : a.bad_win_rate);
        let rateB = teamFilter === 'all' ? b.win_rate : (teamFilter === 'good' ? b.good_win_rate : b.bad_win_rate);
        return rateB - rateA;
    });

    if (validPlayers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading">獻祭的生命還不夠多（需要參與至少 3 場遊戲才能上榜）</td></tr>`;
        return;
    }

    validPlayers.slice(0, 10).forEach((p, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';

        let winRate, totalGames;
        let pClass = "bg-white"; // 进度条颜色

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

        // 动画填充进度条
        setTimeout(() => {
            tr.querySelector('.progress-fill').style.width = `${winRate}%`;
        }, 100);
    });
}

function renderCharacters(characters) {
    const container = document.getElementById('characters-list');
    container.innerHTML = '';

    if (characters.length === 0) {
        container.innerHTML = `<div class="loading">尚未記錄任何角色。</div>`;
        return;
    }

    characters.slice(0, 5).forEach((c, index) => {
        const topClass = index === 0 ? 'top-1' : '';
        const item = document.createElement('div');
        item.className = `char-item ${topClass}`;
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.8rem;">
                <img src="icons/${c.character}.png" class="char-icon" onerror="this.style.display='none'" alt="">
                <div class="char-info">
                    <span class="char-name">${c.character}</span>
                    <span class="char-stats">出场: ${c.played} 次</span>
                </div>
            </div>
            <div class="char-winrate ${c.win_rate > 50 ? 'text-blue' : 'text-red'}">
                胜率 ${c.win_rate}%
            </div>
        `;
        container.appendChild(item);
    });
}

function updateHallOfFame(players, characters) {
    if (players.length > 0) {
        // 最强坏人 (玩过坏人 >= 2次)
        let evilPlayers = players.filter(p => p.bad_played >= 2).sort((a, b) => b.bad_win_rate - a.bad_win_rate);
        if (evilPlayers.length > 0) document.getElementById('best-evil-player').innerText = evilPlayers[0].name;

        // 最强好人 (玩过好人 >= 2次)
        let goodPlayers = players.filter(p => p.good_played >= 2).sort((a, b) => b.good_win_rate - a.good_win_rate);
        if (goodPlayers.length > 0) document.getElementById('best-good-player').innerText = goodPlayers[0].name;
    }

    if (characters.length > 0) {
        let metaChar = characters.sort((a, b) => b.played - a.played)[0];
        document.getElementById('most-played-char').innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.2rem;">
                <img src="icons/${metaChar.character}.png" class="char-icon-small" onerror="this.style.display='none'" alt="">
                <span>${metaChar.character}</span>
            </div>
        `;
    }
}
