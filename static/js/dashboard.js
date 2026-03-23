// js/dashboard.js

function initDashboard() {
    console.log("📊 正在初始化數據看板...");
    fetchDashboardStats();
}

async function fetchDashboardStats() {
    try {
        // 假設你的 FastAPI 後端有一個獲取統計數據的 API
        const response = await fetch('/api/stats'); 
        const data = await response.json();

        // 填充頂部卡片
        document.getElementById('total-games').innerText = data.total_games;
        document.getElementById('good-win-rate').innerText = data.good_win_percent + '%';
        document.getElementById('evil-win-rate').innerText = data.evil_win_percent + '%';

        // 填充排行榜
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = data.top_players.map((p, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${p.name}</td>
                <td>${p.total}</td>
                <td>${p.wins}</td>
                <td><span class="badge badge-gold">${p.rate}%</span></td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("無法抓取數據:", err);
    }
}

// 如果是直接訪問這個頁面（非 SPA 模式）才自動執行
if (document.getElementById('total-games')) {
    initDashboard();
}
