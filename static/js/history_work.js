/**
 * BOTC Stats - 歷史紀錄進階邏輯 (修復版)
 * 流程：全局搜尋 -> 產生結果 -> 切換身份標籤 (Tab) 篩選統計
 */

{
    let allMatches = [];
    let currentFilterType = 'all'; // 預設篩選身分：全部
    let currentKeyword = '';

    const initHistory = async () => {
        const container = document.getElementById('history-list-area');
        const apiBase = window.API_BASE || "";

        try {
            if (container) {
                container.innerHTML = `<div style="text-align:center; padding:5rem; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> 正在召喚歷史數據...</div>`;
            }
            
            const resp = await fetch(`${apiBase}/api/history`);
            if (!resp.ok) throw new Error("讀取失敗");
            
            allMatches = await resp.json();
            
            // 初始執行一次邏輯 (預設顯示全部)
            applyLogic(); 

        } catch (err) {
            if (container) {
                container.innerHTML = `<div style="text-align:center; color:var(--accent-red); padding:5rem;">讀取錯誤：${err.message}</div>`;
            }
        }
    };

    // 🟢 處理搜尋輸入 (由 HTML 的 oninput="handleSearch()" 觸發)
    window.handleSearch = () => {
        const inputEl = document.getElementById('history-search');
        if (!inputEl) return;
        
        currentKeyword = inputEl.value.trim().toLowerCase();
        
        // 只要搜尋框有字，就顯示身份篩選標籤；沒字就隱藏
        const tabsEl = document.getElementById('filter-tabs-container');
        if (tabsEl) {
            tabsEl.style.display = currentKeyword ? 'flex' : 'none';
        }
        
        // 搜尋時，通常建議跳回「全部」標籤開始看
        if (currentKeyword && currentFilterType === 'all') {
            updateTabUI('all');
        }

        applyLogic();
    };

    // 🟢 切換篩選身分標籤 (由 HTML 的 onclick="setFilterType(...)" 觸發)
    window.setFilterType = (type) => {
        currentFilterType = type;
        updateTabUI(type);
        applyLogic();
    };

    const updateTabUI = (type) => {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const btnType = btn.getAttribute('data-type') || btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
            btn.classList.toggle('active', btnType === type);
        });
    };

    // 🟢 核心邏輯整合：過濾、統計、渲染
    const applyLogic = () => {
        const titleEl = document.getElementById('summary-title');
        const hintEl = document.getElementById('search-hint');
        if (!titleEl || !hintEl) return;

        let filtered = [];

        // 情境 A：搜尋欄位是空的 -> 顯示整個資料庫
        if (!currentKeyword) {
            filtered = allMatches;
            titleEl.innerText = "總對局紀錄回顧";
            hintEl.innerText = "顯示所有魔典中記載的對局紀錄";
        } 
        // 情境 B：有輸入關鍵字 -> 進行過濾
        else {
            titleEl.innerText = `「${currentKeyword}」的統計結果`;
            const labelMap = { 'all': '全局搜尋', 'player': '作為玩家', 'storyteller': '作為說書人', 'location': '作為地點', 'script': '作為劇本' };
            hintEl.innerText = `目前篩選條件：${labelMap[currentFilterType] || '全部'}`;
            
            filtered = allMatches.filter(m => {
                const matchScript = m.script.toLowerCase().includes(currentKeyword);
                const matchLocation = m.location && m.location.toLowerCase().includes(currentKeyword);
                const matchST = m.storyteller && m.storyteller.toLowerCase().includes(currentKeyword);
                const matchPlayer = m.players.some(p => p.player_name.toLowerCase().includes(currentKeyword));

                if (currentFilterType === 'all') return matchScript || matchLocation || matchST || matchPlayer;
                if (currentFilterType === 'player') return m.players.some(p => p.player_name.toLowerCase() === currentKeyword);
                if (currentFilterType === 'storyteller') return m.storyteller && m.storyteller.toLowerCase() === currentKeyword;
                if (currentFilterType === 'location') return m.location && m.location.toLowerCase() === currentKeyword;
                if (currentFilterType === 'script') return m.script.toLowerCase().includes(currentKeyword);
                return false;
            });
        }

        updateStatsUI(filtered);
        renderHistoryList(filtered);
    };

    // 🟢 更新頂部統計看板
    const updateStatsUI = (matches) => {
        const total = matches.length;
        const totalEl = document.getElementById('stat-total');
        if (!totalEl) return;

        if (total === 0) {
            totalEl.innerText = 0;
            document.getElementById('stat-good-rate').innerText = "0%";
            document.getElementById('stat-evil-rate').innerText = "0%";
            document.getElementById('stat-top-location').innerText = "無數據";
            document.getElementById('stat-top-role').innerText = "不適用";
            return;
        }

        let goodWins = 0;
        let evilWins = 0;
        const locations = {};
        const roles = {};

        matches.forEach(m => {
            // 勝率判定：如果篩選「作為玩家」，以該玩家在那場是否獲勝為準
            if (currentFilterType === 'player' && currentKeyword) {
                const p = m.players.find(p => p.player_name.toLowerCase() === currentKeyword);
                if (p) {
                    if (p.alignment === m.winning_team) {
                        if (p.alignment === 'good') goodWins++; else evilWins++;
                    }
                    // 只有搜尋玩家時才統計「最常使用角色」
                    roles[p.final_character] = (roles[p.final_character] || 0) + 1;
                }
            } else {
                // 一般模式：統計該場次的最終陣營獲勝情況
                if (m.winning_team === 'good') goodWins++; else evilWins++;
            }
            
            // 統計地點
            if (m.location) {
                locations[m.location] = (locations[m.location] || 0) + 1;
            }
        });

        totalEl.innerText = total;
        document.getElementById('stat-good-rate').innerText = Math.round((goodWins / total) * 100) + "%";
        document.getElementById('stat-evil-rate').innerText = Math.round((evilWins / total) * 100) + "%";

        const topLoc = Object.entries(locations).sort((a,b) => b[1] - a[1])[0]?.[0] || "未知";
        const topRole = Object.entries(roles).sort((a,b) => b[1] - a[1])[0]?.[0] || "暫無統計";
        
        document.getElementById('stat-top-location').innerText = topLoc;
        document.getElementById('stat-top-role').innerText = topRole;
    };

    // 🟢 渲染對局清單
    const renderHistoryList = (matches) => {
        const container = document.getElementById('history-list-area');
        if (!container) return;

        if (matches.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:4rem;">找不到符合篩選條件的紀錄</div>`;
            return;
        }

        container.innerHTML = matches.map(m => {
            const d = new Date(m.date);
            const isGood = m.winning_team === 'good';
            return `
                <div class="match-history-card" id="match-card-${m.id}">
                    <div class="match-main-row" onclick="toggleMatchDetails(${m.id})">
                        <div style="background:rgba(0,0,0,0.3); padding:8px; border-radius:10px; width:60px; text-align:center; flex-shrink:0;">
                            <span style="font-size:0.6rem; opacity:0.5; display:block;">${d.getFullYear()}</span>
                            <span style="font-weight:bold; color:var(--accent-gold);">${d.getMonth()+1}/${d.getDate()}</span>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <h4 style="margin:0; font-size:1.1rem; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.script}</h4>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px; display:flex; flex-wrap:wrap; gap:10px;">
                                <span><i class="fa-solid fa-location-dot"></i> ${m.location || '未知'}</span>
                                <span><i class="fa-solid fa-user-tie"></i> ${m.storyteller || '未知'}</span>
                                <span><i class="fa-solid fa-users"></i> ${m.players.length} 人參戰</span>
                            </div>
                        </div>
                        <div class="match-result-tag ${isGood ? 'res-good' : 'res-evil'}" style="padding:6px 15px; border-radius:8px; font-weight:bold; font-size:0.85rem; flex-shrink:0;">
                            ${isGood ? '善良獲勝' : '邪惡獲勝'}
                        </div>
                        <i class="fa-solid fa-chevron-down toggle-icon" style="margin-left:10px; flex-shrink:0;"></i>
                    </div>
                    
                    <!-- 展開詳情區 -->
                    <div class="match-details-panel" id="detail-panel-${m.id}">
                        <div class="horizontal-detail-bar">
                            <table class="detail-table">
                                <thead>
                                    <tr>
                                        <th>玩家暱稱</th>
                                        <th>初始角色</th>
                                        <th>最終角色</th>
                                        <th>最終陣營</th>
                                        <th>存活狀態</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${m.players.map(p => `
                                        <tr>
                                            <td style="font-weight:bold; color:#fff;">${p.player_name}</td>
                                            <td>${p.initial_character}</td>
                                            <td>${p.final_character}</td>
                                            <td class="${p.alignment === 'good' ? 'text-blue' : 'text-red'}" style="font-weight:bold;">${p.alignment === 'good' ? '善良' : '邪惡'}</td>
                                            <td style="${p.survived ? 'color:#a8dadc;' : 'color:#e63946; opacity:0.6;'}">${p.survived ? '存活' : '💀 死亡'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    window.toggleMatchDetails = (id) => {
        const panel = document.getElementById(`detail-panel-${id}`);
        const card = document.getElementById(`match-card-${id}`);
        if (!panel || !card) return;
        const isOpen = panel.style.display === 'block';
        panel.style.display = isOpen ? 'none' : 'block';
        card.classList.toggle('open', !isOpen);
    };

    // 啟動初始化
    initHistory();
}
