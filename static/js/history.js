/**
 * BOTC Stats - 歷史紀錄邏輯 (HISTORY)
 * 整合：對局統計、即時搜尋、點擊展開詳情
 */

{
    let allMatches = []; // 儲存完整資料供搜尋使用

    const initHistory = async () => {
        console.log("📜 正在翻閱歷史魔典...");
        const container = document.getElementById('history-list-area');
        const apiBase = window.API_BASE || "";

        try {
            const resp = await fetch(`${apiBase}/api/history`);
            if (!resp.ok) throw new Error("魔典連接失敗");
            
            allMatches = await resp.json();
            
            // 更新頂部小結數據
            updateHistoryStats(allMatches);
            // 渲染列表
            renderHistoryList(allMatches);

        } catch (err) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--accent-red); padding: 5rem;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
                    <p>無法讀取紀錄：${err.message}</p>
                </div>
            `;
        }
    };

    const updateHistoryStats = (matches) => {
        const total = matches.length;
        const goodWins = matches.filter(m => m.winning_team === 'good').length;
        const evilWins = matches.filter(m => m.winning_team === 'evil').length;
        
        document.getElementById('count-total').innerText = total;
        document.getElementById('count-good').innerText = goodWins;
        document.getElementById('count-evil').innerText = evilWins;
    };

    const renderHistoryList = (matches) => {
        const container = document.getElementById('history-list-area');
        
        if (matches.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 5rem;">查無對局紀錄</div>`;
            return;
        }

        container.innerHTML = matches.map(m => {
            const d = new Date(m.date);
            const dateStr = `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
            const yearStr = d.getFullYear();
            
            const isGood = m.winning_team === 'good';
            const playerCount = m.players ? m.players.length : 0;

            return `
                <div class="match-history-card" id="match-card-${m.id}">
                    <div class="match-main-row" onclick="toggleMatchDetails(${m.id})">
                        <!-- 日期徽章 -->
                        <div class="match-date-badge">
                            <span class="year">${yearStr}</span>
                            <span class="date-text">${dateStr}</span>
                        </div>
                        
                        <!-- 主要對局資訊 -->
                        <div class="match-info-main">
                            <h4>${m.script}</h4>
                            <div class="match-meta-info">
                                <span><i class="fa-solid fa-location-dot"></i> ${m.location || '未知'}</span>
                                <span><i class="fa-solid fa-user-tie"></i> ${m.storyteller || '未知'}</span>
                                <span><i class="fa-solid fa-users"></i> ${playerCount} 人參戰</span>
                            </div>
                        </div>

                        <!-- 醒目的獲勝標籤 -->
                        <div class="match-result-tag ${isGood ? 'res-good' : 'res-evil'}">
                            ${isGood ? '善良獲勝' : '邪惡獲勝'}
                        </div>
                        
                        <!-- 展開圖示 -->
                        <div class="toggle-icon">
                            <i class="fa-solid fa-chevron-down"></i>
                        </div>
                    </div>
                    
                    <!-- 點擊後展開的玩家詳細列表 -->
                    <div class="match-details-panel" id="detail-panel-${m.id}">
                        <div class="detail-table-container">
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
                                    ${renderPlayerRows(m.players, m.winning_team)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    const renderPlayerRows = (players, winningTeam) => {
        if (!players || players.length === 0) {
            return `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">無詳細數據</td></tr>`;
        }

        return players.map(p => {
            const isWinner = p.alignment === winningTeam;
            return `
                <tr>
                    <td style="font-weight:bold; color:#fff;">
                        ${p.player_name}
                    </td>
                    <td>${p.initial_character || '-'}</td>
                    <td>${p.final_character || '-'}</td>
                    <td>
                        <span class="${p.alignment === 'good' ? 'text-blue' : 'text-red'}" style="font-weight:bold;">
                            ${p.alignment === 'good' ? '善良' : '邪惡'}
                        </span>
                    </td>
                    <td>
                        <span style="${p.survived ? 'color:#a8dadc;' : 'color:#e63946; opacity:0.6;'}">
                            ${p.survived ? '存活' : '💀 死亡'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    };

    // 🟢 展開與收合功能
    window.toggleMatchDetails = (matchId) => {
        const panel = document.getElementById(`detail-panel-${matchId}`);
        const card = document.getElementById(`match-card-${matchId}`);
        
        const isOpen = panel.style.display === 'block';
        
        // 關閉所有其他已打開的（可選，看你喜歡哪種體驗）
        // document.querySelectorAll('.match-details-panel').forEach(p => p.style.display = 'none');
        // document.querySelectorAll('.match-history-card').forEach(c => c.classList.remove('open'));

        if (isOpen) {
            panel.style.display = 'none';
            card.classList.remove('open');
        } else {
            panel.style.display = 'block';
            card.classList.add('open');
        }
    };

    // 🟢 搜尋篩選功能
    window.filterHistory = () => {
        const keyword = document.getElementById('history-search').value.toLowerCase();
        const filtered = allMatches.filter(m => 
            m.script.toLowerCase().includes(keyword) ||
            (m.location && m.location.toLowerCase().includes(keyword)) ||
            (m.storyteller && m.storyteller.toLowerCase().includes(keyword))
        );
        renderHistoryList(filtered);
    };

    initHistory();
}
