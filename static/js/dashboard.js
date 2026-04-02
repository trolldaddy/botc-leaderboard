/**
 * BOTC Stats - 數據看板邏輯
 * 移除搜尋功能，優化地點篩選與陣營條顯示
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
            
            // 2. 視覺化拉鋸條動畫
            document.getElementById('viz-good-rate').innerText = goodRate + "%";
            document.getElementById('viz-evil-rate').innerText = evilRate + "%";
            
            // 處理極端情況 (防止 0% 時看起來還是 50/50)
            const barGood = document.getElementById('bar-good');
            const barEvil = document.getElementById('bar-evil');
            
            if (barGood && barEvil) {
                barGood.style.width = goodRate + "%";
                barEvil.style.width = evilRate + "%";
            }

            const labelEl = document.getElementById('current-location-label');
            if (labelEl) labelEl.innerText = location ? `地點：${location}` : "全域數據";

            // 3. 自動動態更新地點選單 (初次載入)
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

    // 初始化載入
    window.loadDashboardStats = loadDashboardStats;
    loadDashboardStats();
}
