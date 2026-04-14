/**
 * BOTC Stats - 數據看板邏輯
 * 功能：抓取彙總數據，動態渲染全域總覽與各地點卡片
 * 修正：加入自動重試機制，解決首次載入 500 錯誤
 */

{
    // 🟢 1. 加入 retries 參數，預設重試 3 次
    const loadDashboardStats = async (retries = 3) => {
        const container = document.getElementById('location-cards-container');
        const apiBase = window.API_BASE || "";
        
        try {
            const resp = await fetch(`${apiBase}/api/stats`);
            
            // 如果後端回傳 500，直接拋出錯誤進入重試邏輯
            if (!resp.ok) throw new Error(`無法抓取統計數據 (Status: ${resp.status})`);
            
            const data = await resp.json();

            // 渲染頂部全域總覽 (保持不變)
            const g = data.global;
            document.getElementById('global-total').innerText = g.total;
            document.getElementById('global-good').innerHTML = `${g.good_rate}% <small style="font-size:0.8rem; opacity:0.6;">(${g.good_wins}場)</small>`;
            document.getElementById('global-evil').innerHTML = `${g.evil_rate}% <small style="font-size:0.8rem; opacity:0.6;">(${g.evil_wins}場)</small>`;

            // 渲染各個地點卡片 (保持不變)
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
                        <div class="loc-bar-container">
                            <div class="bar-segment" style="width: ${loc.good_rate}%; background: linear-gradient(90deg, #457b9d, #a8dadc);"></div>
                            <div class="bar-segment" style="width: ${loc.evil_rate}%; background: linear-gradient(90deg, #f08080, #e63946);"></div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (err) {
            console.error("Dashboard Stats Error:", err);

            // 🔴 2. 關鍵修正：判斷是否還有重試機會
            if (retries > 0) {
                console.warn(`⚠️ 數據載入失敗，將在 2 秒後進行第 ${4 - retries} 次重試...`);
                
                // 在介面上給予小小提示，不要直接顯示大紅字
                if (container) container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:3rem;"><i class="fa-solid fa-sync fa-spin"></i> 伺服器正在喚醒中，請稍候...</div>`;
                
                // 延遲 2 秒後再次執行，給資料庫連線一點緩衝時間
                setTimeout(() => loadDashboardStats(retries - 1), 2000);
            } else {
                // 重試次數用完後，才顯示錯誤訊息
                if (container) container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--accent-red); padding:3rem;">數據載入失敗，伺服器反應超時。請重新整理頁面。</div>`;
            }
        }
    };

    // 啟動載入
    loadDashboardStats();
}
