/**
 * BOTC Stats - 歷史紀錄進階邏輯
 */

{
    let allMatches = [];

    const initHistory = async () => {
        const container = document.getElementById('history-list-area');
        const apiBase = window.API_BASE || "";

        try {
            container.innerHTML = `<div style="text-align: center; padding: 5rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> 正在翻閱魔典...</div>`;
            
            const resp = await fetch(`${apiBase}/api/history`);
            if (!resp.ok) throw new Error("讀取失敗");
            
            allMatches = await resp.json();
            
            // 初始渲染
            applyFilters();

        } catch (err) {
            container.innerHTML = `<div style="text-align: center; color: var(--accent-red); padding: 5rem;">讀取錯誤：${err.message}</div>`;
        }
    };

    // 🟢 核心篩選與統計計算邏輯
    window.applyFilters = () => {
        const keyword = document.getElementById('history-search').value.trim().toLowerCase();
        const type = document.getElementById('search-type').value;
        const titleEl = document.getElementById('summary-title');

        let filtered = [];

        if (!keyword) {
            filtered = allMatches;
            titleEl.innerText = "目前顯示：總對局紀錄";
        } else {
            titleEl.innerText = `搜尋結果：「${keyword}」的${type === 'all' ? '相關' : type === 'player' ? '個人' : '專屬'}紀錄`;
            
            filtered = allMatches.filter(m => {
                if (type === 'all') {
                    return m.script.toLowerCase().includes(keyword) ||
                           (m.location && m.location.toLowerCase().includes(keyword)) ||
                           (m.storyteller && m.storyteller.toLowerCase().includes(keyword)) ||
                           m.players.some(p => p.player_name.toLowerCase().includes(keyword));
                }
                if (type === 'player') return m.players.some(p => p.player_name.toLowerCase() === keyword);
                if (type === 'storyteller') return m.storyteller && m.storyteller.toLowerCase() === keyword;
                if (type === 'location') return m.location && m.location.toLowerCase() === keyword;
                if (type === 'script') return m.script.toLowerCase().includes(keyword);
                return false;
            });
        }

        calculateAndRenderStats(filtered, keyword, type);
        renderHistoryList(filtered);
    };

    // 🟢 統計計算與渲染
    const calculateAndRenderStats = (matches, keyword, type) => {
        const total = matches.length;
        if (total === 0) {
            document.getElementById('stat-total').innerText = 0;
            document.getElementById('stat-good-rate').innerText = "0%";
            document.getElementById('stat-evil-rate').innerText = "0%";
            return;
        }

        let goodWins = 0;
        let evilWins = 0;
        const locations = {};
        const roles = {};

        matches.forEach(m => {
            // 判定勝率邏輯
            // 如果搜尋的是特定玩家，勝率依照該玩家的陣營判定
            if (type === 'player' && keyword) {
                const p = m.players.find(p => p.player_name.toLowerCase() === keyword);
                if (p) {
                    if (p.alignment === m.winning_team) {
                        if (p.alignment === 'good') goodWins++; else evilWins++;
                    }
                    // 統計角色
                    const char = p.final_character || "未知";
                    roles[char] = (roles[char] || 0) + 1;
                }
            } else {
                // 一般模式：統計場景勝率
                if (m.winning_team === 'good') goodWins++; else evilWins++;
            }

            // 統計地點
            if (m.location) locations[m.location] = (locations[m.location] || 0) + 1;
        });

        // 渲染基礎勝率
        document.getElementById('stat-total').innerText = total;
        document.getElementById('stat-good-rate').innerText = Math.round((goodWins / total) * 100) + "%";
        document.getElementById('stat-evil-rate').innerText = Math.round((evilWins / total) * 100) + "%";

        // 渲染地點與角色排名
        const topLoc = Object.entries(locations).sort((a, b) => b[1] - a[1])[0]?.[0] || "無數據";
        const topRole = Object.entries(roles).sort((a, b) => b[1] - a[1])[0]?.[0] || "無數據";
        
        document.getElementById('stat-top-location').innerText = topLoc;
        document.getElementById('stat-top-role').innerText = topRole;
    };

    const renderHistoryList = (matches) => {
        const container = document.getElementById('history-list-area');
        
        container.innerHTML = matches.map(m => {
            const d = new Date(m.date);
            const dateStr = `${(d.getMonth()+1)}/${d.getDate()}`;
            const playerCount = m.players ? m.players.length : 0;
            const isGood = m.winning_team === 'good';

            return `
                <div class="match-history-card" id="match-card-${m.id}">
                    <div class="match-main-row" onclick="toggleMatchDetails(${m.id})">
                        <div style="background:rgba(0,0,0,0.3); padding:8px; border-radius:10px; width:60px; text-align:center;">
                            <span style="font-size:0.6rem; opacity:0.5; display:block;">${d.getFullYear()}</span>
                            <span style="font-weight:bold; color:var(--accent-gold);">${dateStr}</span>
                        </div>
                        
                        <div style="flex:1;">
                            <h4 style="margin:0; font-size:1.1rem;">${m.script}</h4>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
                                <i class="fa-solid fa-location-dot"></i> ${m.location || '未知'} &nbsp;
                                <i class="fa-solid fa-user-tie"></i> ${m.storyteller || '未知'} &nbsp;
                                <i class="fa-solid fa-users"></i> ${playerCount} 人
                            </div>
                        </div>

                        <div class="match-result-tag ${isGood ? 'res-good' : 'res-evil'}" style="padding:6px 15px; border-radius:8px; font-weight:bold; font-size:0.85rem;">
                            ${isGood ? '善良獲勝' : '邪惡獲勝'}
                        </div>
                        
                        <i class="fa-solid fa-chevron-down toggle-icon" style="color:var(--text-muted);"></i>
                    </div>
                    
                    <!-- 🟢 展開區：使用橫向 Bar 解決過寬問題 -->
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
                                            <td>${p.initial_character || '-'}</td>
                                            <td>${p.final_character || '-'}</td>
                                            <td>
                                                <span class="${p.alignment === 'good' ? 'text-blue' : 'text-red'}" style="font-weight:bold;">
                                                    ${p.alignment === 'good' ? '善良' : '邪惡'}
                                                </span>
                                            </td>
                                            <td style="${p.survived ? 'color:#a8dadc;' : 'color:#e63946; opacity:0.6;'}">
                                                ${p.survived ? '存活' : '💀 死亡'}
                                            </td>
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
        const isOpen = panel.style.display === 'block';
        panel.style.display = isOpen ? 'none' : 'block';
        card.classList.toggle('open', !isOpen);
    };

    initHistory();
}
