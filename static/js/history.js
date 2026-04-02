/**
 * BOTC Stats - 歷史紀錄進階邏輯
 * 修正：針對特定身分標籤採用「完全匹配」邏輯，確保統計數據精準。
 */

{
    let allMatches = [];
    let currentFilterType = 'all'; 
    let currentKeyword = '';

    const initHistory = async () => {
        const container = document.getElementById('history-list-area');
        const apiBase = window.API_BASE || "";

        try {
            if (container) {
                container.innerHTML = `<div style="text-align:center; padding:5rem; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> 正在召喚歷史紀錄...</div>`;
            }
            
            const resp = await fetch(`${apiBase}/api/history`);
            if (!resp.ok) throw new Error("讀取失敗");
            allMatches = await resp.json();
            
            applyLogic(); 
        } catch (err) {
            if (container) {
                container.innerHTML = `<div style="text-align:center; color:var(--accent-red); padding:5rem;">讀取錯誤：${err.message}</div>`;
            }
        }
    };

    window.handleSearch = () => {
        const inputEl = document.getElementById('history-search');
        if (!inputEl) return;
        currentKeyword = inputEl.value.trim().toLowerCase();
        const tabsEl = document.getElementById('filter-tabs-container');
        if (tabsEl) tabsEl.style.display = currentKeyword ? 'flex' : 'none';
        applyLogic();
    };

    window.setFilterType = (type) => {
        currentFilterType = type;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-type') === type);
        });
        applyLogic();
    };

    const applyLogic = () => {
        const titleEl = document.getElementById('summary-title');
        const hintEl = document.getElementById('search-hint');
        if (!titleEl || !hintEl) return;

        let filtered = [];

        if (!currentKeyword) {
            filtered = allMatches;
            titleEl.innerText = "總對局紀錄回顧";
            hintEl.innerText = "顯示所有魔典中記載的對局";
        } else {
            const labelMap = { 'all': '全局搜尋', 'player': '作為玩家', 'storyteller': '作為說書人', 'location': '作為地點', 'script': '作為劇本' };
            titleEl.innerText = `「${currentKeyword}」的統計結果`;
            hintEl.innerText = `目前的篩選條件：${labelMap[currentFilterType]}`;
            
            filtered = allMatches.filter(m => {
                // 全域搜尋使用 .includes (模糊匹配)
                const sScript = m.script.toLowerCase().includes(currentKeyword);
                const sLoc = (m.location || "").toLowerCase().includes(currentKeyword);
                const sST = (m.storyteller || "").toLowerCase().includes(currentKeyword);
                const sPlayers = m.players.some(p => p.player_name.toLowerCase().includes(currentKeyword));

                if (currentFilterType === 'all') return sScript || sLoc || sST || sPlayers;
                
                // 🟢 關鍵修正：特定身分搜尋改用 === (完全匹配)，避免「魚」搜到「熱帶魚」
                if (currentFilterType === 'player') return m.players.some(p => p.player_name.toLowerCase() === currentKeyword);
                if (currentFilterType === 'storyteller') return (m.storyteller || "").toLowerCase() === currentKeyword;
                if (currentFilterType === 'location') return (m.location || "").toLowerCase() === currentKeyword;
                if (currentFilterType === 'script') return m.script.toLowerCase() === currentKeyword;
                return false;
            });
        }

        updateStatsUI(filtered);
        renderHistoryList(filtered);
    };

    const updateStatsUI = (matches) => {
        const total = matches.length;
        const totalEl = document.getElementById('stat-total');
        if (!totalEl) return;

        if (total === 0) {
            totalEl.innerText = 0;
            document.getElementById('stat-good-rate').innerText = "0%";
            document.getElementById('stat-evil-rate').innerText = "0%";
            document.getElementById('stat-top-location').innerText = "-";
            document.getElementById('stat-top-role').innerText = "-";
            return;
        }

        let goodWins = 0, evilWins = 0;
        const locations = {}, roles = {};

        matches.forEach(m => {
            // 判斷勝率計算視角
            if (currentFilterType === 'player' && currentKeyword) {
                // 這裡也必須使用精確匹配
                const p = m.players.find(p => p.player_name.toLowerCase() === currentKeyword);
                if (p) {
                    if (p.alignment === m.winning_team) {
                        if (p.alignment === 'good') goodWins++; else evilWins++;
                    }
                    roles[p.final_character] = (roles[p.final_character] || 0) + 1;
                }
            } else {
                if (m.winning_team === 'good') goodWins++; else evilWins++;
                m.players.forEach(p => {
                    if (p.final_character) {
                        roles[p.final_character] = (roles[p.final_character] || 0) + 1;
                    }
                });
            }
            if (m.location) locations[m.location] = (locations[m.location] || 0) + 1;
        });

        totalEl.innerText = total;
        document.getElementById('stat-good-rate').innerText = Math.round((goodWins / total) * 100) + "%";
        document.getElementById('stat-evil-rate').innerText = Math.round((evilWins / total) * 100) + "%";
        const topLoc = Object.entries(locations).sort((a,b)=>b[1]-a[1])[0]?.[0] || "未知";
        const sortedRoles = Object.entries(roles).sort((a,b)=>b[1]-a[1]);
        const topRole = sortedRoles[0]?.[0] || "暫無";
        document.getElementById('stat-top-location').innerText = topLoc;
        document.getElementById('stat-top-role').innerText = topRole;
    };

    const renderHistoryList = (matches) => {
        const container = document.getElementById('history-list-area');
        if (!container) return;

        container.innerHTML = matches.map(m => {
            const d = new Date(m.date);
            const isGood = m.winning_team === 'good';
            const playerNames = m.players ? m.players.map(p => p.player_name).join('、') : "";

            return `
                <div class="match-history-card" id="match-card-${m.id}">
                    <div class="match-main-row" onclick="toggleMatchDetails(${m.id})">
                        <div class="match-date-box">
                            <span class="year-label">${d.getFullYear()}</span>
                            <span class="date-label">${d.getMonth()+1}/${d.getDate()}</span>
                        </div>
                        <div class="match-info-content">
                            <div class="info-row-top">
                                <h4 class="match-title">${m.script}</h4>
                                <div class="meta-tags">
                                    <span><i class="fa-solid fa-location-dot"></i> ${m.location || '未知'}</span>
                                    <span><i class="fa-solid fa-user-tie"></i> ${m.storyteller || '未知'}</span>
                                    <span><i class="fa-solid fa-users"></i> ${m.players.length} 人</span>
                                </div>
                            </div>
                            <div class="info-row-bottom">
                                <i class="fa-solid fa-id-card-clip" style="font-size:0.7rem; color:var(--accent-gold); opacity:0.6; margin-top:2px;"></i>
                                <span class="player-preview-text">${playerNames}</span>
                            </div>
                        </div>
                        <div class="match-result-badge ${isGood ? 'res-good' : 'res-evil'}">
                            ${isGood ? '善良獲勝' : '邪惡獲勝'}
                        </div>
                        <i class="fa-solid fa-chevron-down toggle-icon"></i>
                    </div>
                    
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

    initHistory();
}
