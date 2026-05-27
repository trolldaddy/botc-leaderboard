/**
 * BOTC Stats - 數據看板邏輯
 */
{
    const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    let dashboardLocations = [];
    let dashboardMatches = [];
    let expandedLocationIndex = null;

    const injectLocationStyle = () => {
        if (document.getElementById('dashboard-location-style')) return;
        const style = document.createElement('style');
        style.id = 'dashboard-location-style';
        style.textContent = `
            .location-card{cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease;min-width:0}.location-card:hover{transform:translateY(-2px);border-color:rgba(255,183,3,.35);background:rgba(255,255,255,.05)}.location-card.is-expanded{grid-column:1/-1;cursor:default;border-color:rgba(255,183,3,.45);background:rgba(255,255,255,.055);transform:none}.location-card.is-expanded:hover{transform:none}.loc-name,.loc-total-badge,.location-detail-text,.location-detail-item,.location-record-item{overflow-wrap:anywhere;word-break:break-word}.loc-info-badge{display:flex;align-items:center;justify-content:center;gap:.55rem;margin:1.05rem 1.2rem 1.15rem 1.2rem;padding:.85rem 1rem;border-radius:10px;background:rgba(255,183,3,.08);border:1px solid rgba(255,183,3,.22);color:var(--accent-gold);font-size:1rem;font-weight:900;text-align:center}.location-detail-wide{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.85fr);gap:1rem;margin:0 1.2rem 1.2rem 1.2rem;padding:1rem;border-radius:12px;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.08)}.location-detail-left,.location-detail-right{min-width:0}.location-detail-media{width:100%;max-height:320px;object-fit:cover;border-radius:10px;background:rgba(0,0,0,.28);margin-bottom:1rem}.location-detail-title{font-size:1.15rem;font-weight:900;color:#fff;margin-bottom:.45rem}.location-detail-text{line-height:1.8;color:var(--text-main);white-space:pre-wrap;max-height:260px;overflow:auto;padding-right:.25rem}.location-detail-info-grid{display:grid;grid-template-columns:1fr;gap:.75rem}.location-detail-item{padding:.82rem;border-radius:9px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.075);line-height:1.65}.location-detail-label{display:block;color:var(--accent-gold);font-size:.72rem;font-weight:900;margin-bottom:.35rem}.location-detail-link{display:inline-flex;align-items:center;gap:.45rem;margin-top:.8rem;max-width:100%;padding:.68rem 1rem;border-radius:999px;background:var(--accent-red);color:#fff;text-decoration:none;font-weight:900;overflow-wrap:anywhere;word-break:break-word}.location-records{margin-top:1rem}.location-records-title{display:flex;align-items:center;justify-content:space-between;gap:.75rem;color:#fff;font-weight:900;margin-bottom:.65rem}.location-record-list{display:grid;gap:.55rem;max-height:280px;overflow:auto;padding-right:.2rem}.location-record-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.7rem;padding:.75rem;border-radius:9px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.location-record-date{min-width:58px;text-align:center;border-radius:8px;background:rgba(0,0,0,.28);padding:.42rem .5rem;color:#fff;font-weight:900;line-height:1.2}.location-record-date span{display:block;color:var(--accent-gold);font-size:.82rem}.location-record-main{min-width:0}.location-record-script{color:#fff;font-weight:900;margin-bottom:.25rem}.location-record-meta{color:var(--text-muted);font-size:.76rem;line-height:1.45}.location-record-result{white-space:nowrap;border-radius:8px;padding:.45rem .6rem;font-size:.78rem;font-weight:900;color:#d9edff;background:rgba(69,123,157,.3);border:1px solid rgba(168,218,220,.16)}.location-record-result.evil{color:#ffd0d4;background:rgba(230,57,70,.24);border-color:rgba(230,57,70,.2)}@media(max-width:900px){.location-detail-wide{grid-template-columns:1fr}.location-detail-text{max-height:none}.location-record-list{max-height:none}}@media(max-width:560px){.loc-info-badge{font-size:.92rem;margin-left:.8rem;margin-right:.8rem}.location-detail-wide{margin-left:.8rem;margin-right:.8rem;padding:.85rem}.location-record-item{grid-template-columns:1fr}.location-record-result{justify-self:start}}
        `;
        document.head.appendChild(style);
    };

    const formatDateParts = (value) => {
        const d = value ? new Date(value) : null;
        if (!d || Number.isNaN(d.getTime())) return { year: '----', day: '--/--' };
        return { year: d.getFullYear(), day: `${d.getMonth() + 1}/${d.getDate()}` };
    };

    const matchesForLocation = (locName) => dashboardMatches.filter((match) => (match.location || '未知') === locName);

    const recordsHtml = (loc) => {
        const matches = matchesForLocation(loc.name);
        if (!matches.length) return '<div class="location-detail-item" style="color:var(--text-muted);">目前還沒有這個地點的戰績紀錄。</div>';
        return `<div class="location-record-list">${matches.map((match) => {
            const date = formatDateParts(match.date || match.created_at);
            const evil = match.winning_team === 'evil';
            return `<div class="location-record-item"><div class="location-record-date">${date.year}<span>${date.day}</span></div><div class="location-record-main"><div class="location-record-script">${escapeHtml(match.script || '未知劇本')}</div><div class="location-record-meta"><i class="fa-solid fa-user-tie"></i> ${escapeHtml(match.storyteller || '未知說書人')} ｜ <i class="fa-solid fa-users"></i> ${Array.isArray(match.players) ? match.players.length : 0} 人</div></div><div class="location-record-result ${evil ? 'evil' : ''}">${evil ? '邪惡獲勝' : '善良獲勝'}</div></div>`;
        }).join('')}</div>`;
    };

    const locationDetailHtml = (loc) => {
        const detail = loc.detail || {};
        const image = detail.image_url ? `<img class="location-detail-media" src="${escapeHtml(detail.image_url)}" alt="${escapeHtml(loc.name)}">` : '';
        const link = detail.link_url ? `<a class="location-detail-link" href="${escapeHtml(detail.link_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="fa-solid fa-arrow-up-right-from-square"></i> 開啟連結</a>` : '';
        const infoItems = [
            detail.address ? `<div class="location-detail-item"><span class="location-detail-label">地址 / 地區</span>${escapeHtml(detail.address)}</div>` : '',
            detail.schedule_note ? `<div class="location-detail-item"><span class="location-detail-label">活動 / 開團資訊</span><div class="location-detail-text" style="max-height:120px;">${escapeHtml(detail.schedule_note)}</div></div>` : '',
            detail.contact_note ? `<div class="location-detail-item"><span class="location-detail-label">聯絡方式</span><div class="location-detail-text" style="max-height:140px;">${escapeHtml(detail.contact_note)}</div>${link}</div>` : link ? `<div class="location-detail-item"><span class="location-detail-label">連結</span>${link}</div>` : '',
            detail.type ? `<div class="location-detail-item"><span class="location-detail-label">類型</span>${escapeHtml(detail.type === 'discord' ? 'Discord / 線上' : detail.type === 'store' ? '店家' : '其他')}</div>` : '',
        ].filter(Boolean).join('') || '<div class="location-detail-item" style="color:var(--text-muted);">尚未填寫地點資訊。</div>';
        return `<div class="location-detail-wide" onclick="event.stopPropagation()"><div class="location-detail-left">${image}<div class="location-detail-title">${escapeHtml(loc.name)}介紹</div>${detail.description ? `<div class="location-detail-text">${escapeHtml(detail.description)}</div>` : '<div class="location-detail-text" style="color:var(--text-muted);">這個地點目前還沒有介紹文字。</div>'}</div><div class="location-detail-right"><div class="location-detail-info-grid">${infoItems}</div><div class="location-records"><div class="location-records-title"><span><i class="fa-solid fa-scroll"></i> 這裡的戰績</span><span class="loc-total-badge">${loc.total} 場</span></div>${recordsHtml(loc)}</div></div></div>`;
    };

    const renderLocations = (container) => {
        container.innerHTML = dashboardLocations.map((loc, index) => {
            const expanded = expandedLocationIndex === index;
            return `<div class="card location-card ${expanded ? 'is-expanded' : ''}" role="button" tabindex="0" onclick="toggleLocationDetail(${index})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleLocationDetail(${index});}"><div class="loc-header"><span class="loc-name"><i class="fa-solid fa-map-location-dot" style="margin-right:8px; opacity:0.5;"></i>${escapeHtml(loc.name)}</span><span class="loc-total-badge">${loc.total} 場對局</span></div><div class="loc-content"><div class="loc-stat-item"><span class="loc-stat-label">善良勝率</span><span class="loc-stat-value text-blue">${loc.good_rate}%</span><span class="loc-stat-games">(${loc.good_wins}場)</span></div><div style="height:40px; width:1px; background:var(--border-color);"></div><div class="loc-stat-item"><span class="loc-stat-label">邪惡勝率</span><span class="loc-stat-value text-red">${loc.evil_rate}%</span><span class="loc-stat-games">(${loc.evil_wins}場)</span></div></div><div class="loc-bar-container"><div class="bar-segment" style="width: ${loc.good_rate}%; background: linear-gradient(90deg, #457b9d, #a8dadc);"></div><div class="bar-segment" style="width: ${loc.evil_rate}%; background: linear-gradient(90deg, #f08080, #e63946);"></div></div><div class="loc-info-badge"><i class="fa-solid fa-circle-info"></i> ${expanded ? '收合地點介紹' : '點擊查看介紹'}</div>${expanded ? locationDetailHtml(loc) : ''}</div>`;
        }).join('');
    };

    window.toggleLocationDetail = (index) => {
        const container = document.getElementById('location-cards-container');
        expandedLocationIndex = expandedLocationIndex === index ? null : index;
        if (container) renderLocations(container);
    };

    const loadDashboardStats = async (retries = 3) => {
        const container = document.getElementById('location-cards-container');
        const apiBase = window.API_BASE || '';
        try {
            const [statsResp, historyResp] = await Promise.all([
                fetch(`${apiBase}/api/stats`),
                fetch(`${apiBase}/api/history`).catch(() => null),
            ]);
            if (!statsResp.ok) throw new Error(`無法抓取統計數據 (Status: ${statsResp.status})`);
            const data = await statsResp.json();
            dashboardMatches = historyResp && historyResp.ok ? await historyResp.json() : [];
            const g = data.global;
            document.getElementById('global-total').innerText = g.total;
            document.getElementById('global-good').innerHTML = `${g.good_rate}% <small style="font-size:0.8rem; opacity:0.6;">(${g.good_wins}場)</small>`;
            document.getElementById('global-evil').innerHTML = `${g.evil_rate}% <small style="font-size:0.8rem; opacity:0.6;">(${g.evil_wins}場)</small>`;
            if (!container) return;
            dashboardLocations = data.locations || [];
            expandedLocationIndex = null;
            if (dashboardLocations.length === 0) {
                container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:3rem;">目前魔典尚未記載任何地點數據</div>`;
                return;
            }
            renderLocations(container);
        } catch (err) {
            console.error('Dashboard Stats Error:', err);
            if (retries > 0) {
                if (container) container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:3rem;"><i class="fa-solid fa-sync fa-spin"></i> 伺服器正在喚醒中，請稍候...</div>`;
                setTimeout(() => loadDashboardStats(retries - 1), 2000);
            } else if (container) {
                container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--accent-red); padding:3rem;">數據載入失敗，伺服器反應超時。請重新整理頁面。</div>`;
            }
        }
    };

    injectLocationStyle();
    loadDashboardStats();
}
