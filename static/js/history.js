/**
 * BOTC Stats - 歷史紀錄進階邏輯 (角色搜尋與精準勝率)
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
                container.innerHTML = `<div style="text-align:center; padding:5rem; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> 正在召喚歷史數據...</div>`;
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
        
        let val = inputEl.value.trim().toLowerCase();
        // 如果全域有繁簡轉換工具則使用
        if (window.toTraditional) {
            val = window.toTraditional(val);
        }
        currentKeyword = val;

        const tabsEl = document.getElementById('filter-tabs-container');
        if (tabsEl) tabsEl.style.display = currentKeyword ? 'flex' : 'none';
        applyLogic();
    };

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

    const applyLogic = () => {
        const titleEl = document.getElementById('summary-title');
        const hintEl = document.getElementById('search-hint');
        if (!titleEl || !hintEl) return;

        let filtered = [];

        if (!currentKeyword) {
            filtered = allMatches;
            titleEl.innerText = "總對局紀錄回顧";
            hintEl.innerText = "顯示所有魔典中記載的對局紀錄";
        } else {
            titleEl.innerText = `「${currentKeyword}」的統計結果`;
            const labelMap = { 
                'all': '全局搜尋', 
                'player': '作為玩家', 
                'storyteller': '作為說書人', 
                'location': '作為地點', 
                'script': '作為劇本',
                'character': '出現角色' 
            };
            hintEl.innerText = `目前篩選條件：${labelMap[currentFilterType] || '全部'}`;
            
            filtered = allMatches.filter(m => {
                const matchScript = m.script.toLowerCase().includes(currentKeyword);
                const matchLocation = m.location && m.location.toLowerCase().includes(currentKeyword);
                const matchST = m.storyteller && m.storyteller.toLowerCase().includes(currentKeyword);
                const matchPlayer = m.players.some(p => p.player_name.toLowerCase().includes(currentKeyword));
                
                // 🟢 角色模糊匹配邏輯
                const matchChar = m.players.some(p => 
                    (p.initial_character && p.initial_character.toLowerCase().includes(currentKeyword)) ||
                    (p.final_character && p.final_character.toLowerCase().includes(currentKeyword))
                );

                if (currentFilterType === 'all') return matchScript || matchLocation || matchST || matchPlayer || matchChar;
                if (currentFilterType === 'player') return m.players.some(p => p.player_name.toLowerCase() === currentKeyword);
                if (currentFilterType === 'storyteller') return m.storyteller && m.storyteller.toLowerCase() === currentKeyword;
                if (currentFilterType === 'location') return m.location && m.location.toLowerCase() === currentKeyword;
                if (currentFilterType === 'script') return m.script.toLowerCase() === currentKeyword;
                if (currentFilterType === 'character') return matchChar;
                return false;
            });
        }

        updateStatsUI(filtered);
        renderHistoryList(filtered);
    };

    const updateStatsUI = (matches) => {
        const total = matches.length;
        const totalEl = document.getElementById('stat-total');
        const goodRateEl = document.getElementById('stat-good-rate');
        const evilRateEl = document.getElementById('stat-evil-rate');
        
        if (!totalEl) return;

        if (total === 0) {
            totalEl.innerText = 0;
            goodRateEl.innerText = "0%";
            evilRateEl.innerText = "0%";
            return;
        }

        let goodWins = 0, evilWins = 0;
        let goodTotal = 0, evilTotal = 0;
        const locations = {}, roles = {};

        matches.forEach(m => {
            // 🟢 核心計算修正：當搜尋特定玩家或角色時，依據陣營分母統計
            if ((currentFilterType === 'player' || currentFilterType === 'character') && currentKeyword) {
                const targets = m.players.filter(p => {
                    if (currentFilterType === 'player') return p.player_name.toLowerCase() === currentKeyword;
                    return (p.initial_character.toLowerCase().includes(currentKeyword) || p.final_character.toLowerCase().includes(currentKeyword));
                });

                targets.forEach(p => {
                    const win = p.alignment === m.winning_team;
                    if (p.alignment === 'good') {
                        goodTotal++;
                        if (win) goodWins++;
                    } else {
                        evilTotal++;
                        if (win) evilWins++;
                    }
                    roles[p.final_character] = (roles[p.final_character] || 0) + 1;
                });
            } else {
                // 全域統計保持原本的總場次分母
                if (m.winning_team === 'good') goodWins++; else evilWins++;
            }
            if (m.location) locations[m.location] = (locations[m.location] || 0) + 1;
        });

        totalEl.innerText = total;

        if ((currentFilterType === 'player' || currentFilterType === 'character') && currentKeyword) {
            const gRate = goodTotal > 0 ? Math.round((goodWins / goodTotal) * 100) : 0;
            const eRate = evilTotal > 0 ? Math.round((evilWins / evilTotal) * 100) : 0;
            goodRateEl.innerHTML = `${gRate}% <small style="font-size:0.6rem; opacity:0.5; display:block;">(${goodWins}/${goodTotal} 善良場)</small>`;
            evilRateEl.innerHTML = `${eRate}% <small style="font-size:0.6rem; opacity:0.5; display:block;">(${evilWins}/${evilTotal} 邪惡場)</small>`;
        } else {
            goodRateEl.innerText = Math.round((goodWins / total) * 100) + "%";
            evilRateEl.innerText = Math.round((evilWins / total) * 100) + "%";
        }

        const topLoc = Object.entries(locations).sort((a,b)=>b[1]-a[1])[0]?.[0] || "未知";
        const topRole = Object.entries(roles).sort((a,b)=>b[1]-a[1])[0]?.[0] || "不適用";
        document.getElementById('stat-top-location').innerText = topLoc;
        document.getElementById('stat-top-role').innerText = topRole;
    };

    const renderHistoryList = (matches) => {
        const container = document.getElementById('history-list-area');
        if (!container) return;

        container.innerHTML = matches.map(m => {
            const d = new Date(m.date);
            const isGood = m.winning_team === 'good';
            const playerNamesStr = m.players ? m.players.map(p => p.player_name).join('、') : "無玩家數據";

            return `
                <div class="match-history-card" id="match-card-${m.id}">
                    <div class="match-main-row" onclick="toggleMatchDetails(${m.id})">
                        <div class="match-date-box">
                            <span class="date-label">${d.getMonth()+1}/${d.getDate()}</span>
                        </div>
                        <div class="match-info-content">
                            <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                                <h4 class="match-title">${m.script}</h4>
                                <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 10px;">
                                    <span><i class="fa-solid fa-location-dot"></i> ${m.location || '未知'}</span>
                                    <span><i class="fa-solid fa-user-tie"></i> ${m.storyteller || '未知'}</span>
                                    <span><i class="fa-solid fa-users"></i> ${m.players.length}人</span>
                                </div>
                            </div>
                            <div class="info-row-bottom">
                                <span class="player-preview-text">${playerNamesStr}</span>
                            </div>
                        </div>
                        <div class="match-result-badge ${isGood ? 'res-good' : 'res-evil'}">
                            ${isGood ? '正義獲勝' : '邪惡獲勝'}
                        </div>
                        <i class="fa-solid fa-chevron-down" style="color: var(--text-muted);"></i>
                    </div>
                    <div class="match-details-panel" id="detail-panel-${m.id}">
                        <div class="horizontal-detail-bar">
                            <table class="detail-table">
                                <thead>
                                    <tr>
                                        <th>玩家暱稱</th><th>初始角色</th><th>最終角色</th><th>陣營</th><th>狀態</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${m.players.map(p => {
                                        const highlight = (currentKeyword && (p.initial_character.includes(currentKeyword) || p.final_character.includes(currentKeyword)));
                                        return `
                                        <tr>
                                            <td style="font-weight:bold; color:${p.player_name.toLowerCase() === currentKeyword ? 'var(--accent-gold)' : '#fff'};">${p.player_name}</td>
                                            <td style="${highlight ? 'color:var(--accent-gold); font-weight:900;' : ''}">${p.initial_character}</td>
                                            <td style="${highlight ? 'color:var(--accent-gold); font-weight:900;' : ''}">${p.final_character}</td>
                                            <td class="${p.alignment === 'good' ? 'text-blue' : 'text-red'}">${p.alignment === 'good' ? '善良' : '邪惡'}</td>
                                            <td>${p.survived ? '存活' : '💀 死亡'}</td>
                                        </tr>
                                    `}).join('')}
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
