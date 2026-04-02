/**
 * BOTC Stats - 數據看板邏輯
 * 強化：陣營比例動畫、搜尋結果優化
 */

{
    const loadDashboardStats = async () => {
        const locationFilter = document.getElementById('location-filter');
        const location = locationFilter?.value || "";
        const apiBase = window.API_BASE || "";
        
        try {
            const resp = await fetch(`${apiBase}/api/stats?location=${encodeURIComponent(location)}`);
            if (!resp.ok) throw new Error("無法抓取統計數據");
            const data = await resp.json();

            // 1. 基礎數字填充
            document.getElementById('total-games-count').innerText = data.total_games || 0;
            const goodRate = data.good_win_percent || 0;
            const evilRate = data.evil_win_percent || 0;

            document.getElementById('good-win-rate').innerText = goodRate + "%";
            document.getElementById('evil-rate-summary').innerText = evilRate + "%";
            
            // 2. 視覺化區塊動畫與數值
            document.getElementById('viz-good-rate').innerText = goodRate + "%";
            document.getElementById('viz-evil-rate').innerText = evilRate + "%";
            document.getElementById('bar-good').style.width = goodRate + "%";
            document.getElementById('bar-evil').style.width = evilRate + "%";

            document.getElementById('current-location-label').innerText = location ? `地點：${location}` : "全域數據";

            // 3. 自動動態更新地點選單 (僅限初次載入且無篩選時)
            if (!location && data.available_locations && locationFilter.options.length <= 1) {
                const currentValue = locationFilter.value;
                locationFilter.innerHTML = '<option value="">所有地點 (Global)</option>';
                data.available_locations.forEach(loc => {
                    const opt = document.createElement('option');
                    opt.value = loc;
                    opt.innerText = loc;
                    locationFilter.appendChild(opt);
                });
                locationFilter.value = currentValue;
            }
        } catch (err) {
            console.error("Dashboard Stats Error:", err);
        }
    };

    // 🟢 查詢個人戰績：增加動畫與樣式
    window.searchPlayerStats = async () => {
        const nameInput = document.getElementById('player-search-input');
        const name = nameInput.value.trim();
        const resultArea = document.getElementById('player-stats-result');
        const emptyArea = document.getElementById('player-search-empty');
        const apiBase = window.API_BASE || "";

        if (!name) return;

        emptyArea.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="display:block; font-size:1.5rem; margin-bottom:0.5rem; color:var(--accent-gold);"></i> 正在魔典中搜尋「${name}」...`;
        resultArea.style.display = "none";

        try {
            const resp = await fetch(`${apiBase}/api/player/${encodeURIComponent(name)}`);
            if (!resp.ok) throw new Error("找不到該玩家");
            
            const data = await resp.json();

            // 填充核心數據
            document.getElementById('res-name').innerText = data.player_name;
            document.getElementById('res-total').innerText = data.total_matches + " 場紀錄";
            document.getElementById('res-winrate').innerText = data.overall_win_rate + "%";
            
            // 填充最常玩角色標籤
            const rolesContainer = document.getElementById('res-roles');
            if (data.most_played_roles && data.most_played_roles.length > 0) {
                rolesContainer.innerHTML = data.most_played_roles
                    .map(r => `<span class="role-tag">${r.role} <small style="opacity:0.6; margin-left:4px;">${r.count}</small></span>`)
                    .join('');
            } else {
                rolesContainer.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">無詳細角色數據</span>';
            }

            emptyArea.style.display = "none";
            resultArea.style.display = "block";
        } catch (err) {
            emptyArea.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="display:block; font-size:1.5rem; margin-bottom:0.5rem; color:var(--accent-red);"></i> 魔典中尚未記載玩家「${name}」的足跡`;
            emptyArea.style.display = "block";
        }
    };

    // 綁定 Enter 鍵
    document.getElementById('player-search-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchPlayerStats();
    });

    // 初始化
    window.loadDashboardStats = loadDashboardStats;
    loadDashboardStats();
}
