/**
 * BOTC Stats - 歷史紀錄進階邏輯 (修復過寬與統計問題)
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
                container.innerHTML = `<div style="text-align:center; padding:5rem; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> 翻閱魔典紀錄中...</div>`;
            }
            
            const resp = await fetch(`${apiBase}/api/history`);
            if (!resp.ok) throw new Error("遠端魔典無回應");
            
            allMatches = await resp.json();
            
            // 初始化，預設顯示全部資料
            applyLogic(); 

        } catch (err) {
            if (container) {
                container.innerHTML = `<div style="text-align:center; color:var(--accent-red); padding:5rem;">讀取錯誤：${err.message}</div>`;
            }
        }
    };

    // 🟢 handleSearch: 處理輸入關鍵字
    window.handleSearch = () => {
        const inputEl = document.getElementById('history-search');
        if (!inputEl) return;
        
        currentKeyword = inputEl.value.trim().toLowerCase();
        
        const tabsEl = document.getElementById('filter-tabs-container');
        if (tabsEl) {
            // 有打字才顯示 Tab，沒打字就不需要篩選身份
            tabsEl.style.display = currentKeyword ? 'flex' : 'none';
        }
        
        // 搜尋時如果原本不是 all，可以選擇保留或跳回 all
        // 這裡我們保留使用者的選擇，讓他們可以直接在搜尋後點擊分類
        applyLogic();
    };

    // 🟢 setFilterType: 切換身份 Tab
    window.setFilterType = (type) => {
        currentFilterType = type;
        
        // 更新按鈕外觀
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const btnType = btn.getAttribute('data-type');
            btn.classList.toggle('active', btnType === type);
        });
        
        applyLogic();
    };

    // 🟢 applyLogic: 核心過濾與標題變動邏輯
    const applyLogic = () => {
        const titleEl = document.getElementById('summary-title');
        const hintEl = document.getElementById('search-hint');
        if (!titleEl || !hintEl) return;

        let filtered = [];

        // 情境：完全沒搜尋 -> 總覽模式
        if (!currentKeyword) {
            filtered = allMatches;
            titleEl.innerText = "總對局紀錄回顧";
            hintEl.innerText = "顯示所有魔典中記載的對局紀錄";
        } 
        // 情境：有搜尋關鍵字 -> 進階篩選模式
        else {
            const labelMap = { 
                'all': '全局搜尋', 'player': '作為玩家', 
                'storyteller': '作為說書人', 'location': '作為地點', 'script': '作為劇本' 
            };
            
            titleEl.innerText = `「${currentKeyword}」的統計結果`;
            hintEl.innerText = `篩選條件：${labelMap[currentFilterType]}`;
            
            filtered = allMatches.filter(m => {
                const searchInScript = m.script.toLowerCase().includes(currentKeyword);
                const searchInLocation = (m.location || "").toLowerCase().includes(currentKeyword);
                const searchInST = (m.storyteller || "").toLowerCase().includes(currentKeyword);
                const searchInPlayers = m.players.some(p => p.player_name.toLowerCase().includes(currentKeyword));

                if (currentFilterType === 'all') return searchInScript || searchInLocation || searchInST || searchInPlayers;
                
                // 精確匹配
                if (currentFilterType === 'player') return m.players.some(p => p.player_name.toLowerCase() === currentKeyword);
                if (currentFilterType === 'storyteller') return (m.storyteller || "").toLowerCase() === currentKeyword;
                if (currentFilterType === 'location') return (m.location || "").toLowerCase() === currentKeyword;
                if (currentFilterType === 'script') return m.script.toLowerCase().includes(currentKeyword);
                
                return false;
            });
        }

        updateStatsUI(filtered);
        renderHistoryList(filtered);
    };

    // 🟢 updateStatsUI: 即時計算並更新看板
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

        let goodWins = 0;
        let evilWins = 0;
        const locations = {};
        const roles = {};

        matches.forEach(m => {
            // 勝率計算邏輯：
            // 如果搜尋的是特定玩家，則看「該玩家在那場是否獲勝」
            if (currentFilterType === 'player' && currentKeyword) {
                const targetPlayer = m.players.find(p => p.player_name.toLowerCase() === currentKeyword);
                if (targetPlayer) {
                    // 該玩家最終陣營 == 獲勝陣營 -> 算贏
                    if (targetPlayer.alignment === m.winning_team) {
                        if (targetPlayer.alignment === 'good') goodWins++; else evilWins++;
                    }
                    // 統計角色使用次數
                    const char = targetPlayer.final_character || "未知";
                    roles[char] = (roles[char] || 0) + 1;
                }
            } else {
                // 一般模式：直接看該場對局是哪邊贏
                if (m.winning_team === 'good') goodWins++; else evilWins++;
            }
            
            // 統計地點
            if (m.location) locations[m.location] = (locations[m.location] || 0) + 1;
        });

        // 填充資料
        totalEl.innerText = total;
        document.getElementById('stat-good-rate').innerText = Math.round((goodWins / total) * 100) + "%";
        document.getElementById('stat-evil-rate').innerText = Math.round((evilWins / total) * 100) + "%";

        const topLoc = Object.entries(locations).sort((a,b) => b[1] - a[1])[0]?.[0] || "未知";
        const topRole = Object.entries(roles).sort((a,b) => b[1] - a[1])[0]?.[0] || "暫無";
        
        document.getElementById('stat-top-location').innerText = topLoc;
        document.getElementById('stat-top-role').innerText = topRole;
    };

    // 🟢 renderHistoryList: 列表渲染
    const renderHistoryList = (matches) => {
        const container = document.getElementById('history-list-area');
        if (!container) return;

        if (matches.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:4rem;">魔典中找不到相關記載</div>`;
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
                                <span><i class="fa-solid fa-users"></i> ${m.players.length} 人</span>
                            </div>
                        </div>
                        <div class="match-result-tag ${isGood ? 'res-good' : 'res-evil'}" style="flex-shrink:0;">
                            ${isGood ? '善良獲勝' : '邪惡獲勝'}
                        </div>
                        <i class="fa-solid fa-chevron-down toggle-icon" style="margin-left:10px; flex-shrink:0;"></i>
                    </div>
                    
                    <!-- 🟢 展開詳情區：強制橫捲，不影響外層寬度 -->
                    <div class="match-details-panel" id="detail-panel-${m.id}">
                        <div class="horizontal-detail-bar">
                            <table class="detail-table">
                                <thead>
                                    <tr>
                                        <th>玩家暱稱</th>
                                        <th>初始角色</th>
                                        <th>最終角色</th>
                                        <th>陣營</th>
                                        <th>狀態</th>
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
