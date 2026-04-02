/**
 * BOTC Stats - 數據看板邏輯
 * 功能：抓取彙總數據，動態渲染全域總覽與各地點卡片
 */

{
    const loadDashboardStats = async () => {
        const container = document.getElementById('location-cards-container');
        const apiBase = window.API_BASE || "";
        
        try {
            const resp = await fetch(`${apiBase}/api/stats`);
            if (!resp.ok) throw new Error("無法抓取統計數據");
            const data = await resp.json();

            // 1. 渲染頂部全域總覽
            const g = data.global;
            document.getElementById('global-total').innerText = g.total;
            document.getElementById('global-good').innerHTML = `${g.good_rate}% <small style="font-size:0.8rem; opacity:0.6;">(${g.good_wins}場)</small>`;
            document.getElementById('global-evil').innerHTML = `${g.evil_rate}% <small style="font-size:0.8rem; opacity:0.6;">(${g.evil_wins}場)</small>`;

            // 2. 渲染各個地點卡片
            if (!container) return;
            
            if (data.locations.length === 0) {
                container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:3rem;">目前魔典尚未記載任何地點數據</div>`;
                return;
            }

            container.innerHTML = data.locations.map(loc => {
                return `
                    <div class="card location-card">
                        <div class="loc-header">
                            <span class="loc-name"><i class="fa-solid fa-map-location-dot" style="margin-right:8px; opacity:0.5;"></i>${loc.name}</span>
                            <span class="loc-total-badge">${loc.total} 場對局</span>
                        </div>
                        <div class="loc-content">
                            <div class="loc-stat-item">
                                <span class="loc-stat-label">善良勝率</span>
                                <span class="loc-stat-value text-blue">${loc.good_rate}%</span>
                                <span class="loc-stat-games">(${loc.good_wins}場)</span>
                            </div>
                            <div style="height:40px; width:1px; background:var(--border-color);"></div>
                            <div class="loc-stat-item">
                                <span class="loc-stat-label">邪惡勝率</span>
                                <span class="loc-stat-value text-red">${loc.evil_rate}%</span>
                                <span class="loc-stat-games">(${loc.evil_wins}場)</span>
                            </div>
                        </div>
                        <!-- 拉鋸比例條 -->
                        <div class="loc-bar-container">
                            <div class="bar-segment" style="width: ${loc.good_rate}%; background: linear-gradient(90deg, #457b9d, #a8dadc);"></div>
                            <div class="bar-segment" style="width: ${loc.evil_rate}%; background: linear-gradient(90deg, #f08080, #e63946);"></div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (err) {
            console.error("Dashboard Stats Error:", err);
            if (container) container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--accent-red); padding:3rem;">數據載入失敗，請確認後端連線</div>`;
        }
    };

    // 啟動載入
    loadDashboardStats();
}
