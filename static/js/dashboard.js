/**
 * BOTC Stats - 數據看板邏輯
 */
{
    const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    let dashboardLocations = [];

    const injectLocationModalStyle = () => {
        if (document.getElementById('dashboard-location-style')) return;
        const style = document.createElement('style');
        style.id = 'dashboard-location-style';
        style.textContent = `
            .location-card{cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.location-card:hover{transform:translateY(-2px);border-color:rgba(255,183,3,.35);background:rgba(255,255,255,.05)}.loc-info-badge{display:inline-flex;align-items:center;gap:.35rem;margin-top:.8rem;color:var(--accent-gold);font-size:.78rem;font-weight:800}.location-detail-backdrop{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;padding:1.5rem;background:rgba(0,0,0,.62);backdrop-filter:blur(4px)}.location-detail-backdrop.is-open{display:flex}.location-detail-dialog{width:min(760px,100%);max-height:min(86vh,760px);overflow:auto;border-radius:12px;background:rgba(15,18,28,.98);border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(0,0,0,.5);color:var(--text-main)}.location-detail-image{width:100%;aspect-ratio:16/8;object-fit:cover;background:rgba(0,0,0,.28);display:block}.location-detail-body{padding:1.35rem}.location-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1rem}.location-detail-title{font-size:1.4rem;font-weight:900;color:#fff}.location-detail-close{border:0;background:rgba(255,255,255,.08);color:#fff;width:36px;height:36px;border-radius:999px;cursor:pointer}.location-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.85rem;margin:1rem 0}.location-detail-item{padding:.85rem;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(255,255,255,.03)}.location-detail-label{display:block;color:var(--accent-gold);font-size:.72rem;font-weight:900;margin-bottom:.35rem}.location-detail-text{line-height:1.8;color:var(--text-main);white-space:pre-wrap}.location-detail-link{display:inline-flex;align-items:center;gap:.45rem;margin-top:1rem;padding:.7rem 1rem;border-radius:999px;background:var(--accent-red);color:#fff;text-decoration:none;font-weight:900}@media(max-width:680px){.location-detail-grid{grid-template-columns:1fr}.location-detail-image{aspect-ratio:4/3}}
        `;
        document.head.appendChild(style);
    };

    const ensureLocationModal = () => {
        injectLocationModalStyle();
        let modal = document.getElementById('location-detail-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'location-detail-modal';
            modal.className = 'location-detail-backdrop';
            modal.innerHTML = '<div class="location-detail-dialog" role="dialog" aria-modal="true"></div>';
            modal.addEventListener('click', (event) => { if (event.target === modal) window.closeLocationDetail(); });
            document.body.appendChild(modal);
        }
        return modal;
    };

    window.closeLocationDetail = () => {
        const modal = document.getElementById('location-detail-modal');
        if (modal) modal.classList.remove('is-open');
    };

    window.openLocationDetail = (index) => {
        const loc = dashboardLocations[index];
        if (!loc) return;
        const detail = loc.detail || {};
        const modal = ensureLocationModal();
        const dialog = modal.querySelector('.location-detail-dialog');
        const image = detail.image_url ? `<img class="location-detail-image" src="${escapeHtml(detail.image_url)}" alt="${escapeHtml(loc.name)}">` : '';
        const link = detail.link_url ? `<a class="location-detail-link" href="${escapeHtml(detail.link_url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> 開啟連結</a>` : '';
        dialog.innerHTML = `${image}<div class="location-detail-body"><div class="location-detail-head"><div><div class="location-detail-title">${escapeHtml(loc.name)}</div><div class="admin-chip-row"><span class="admin-chip">${loc.total} 場對局</span><span class="admin-chip good">善良 ${loc.good_rate}%</span><span class="admin-chip danger">邪惡 ${loc.evil_rate}%</span></div></div><button class="location-detail-close" type="button" onclick="closeLocationDetail()" aria-label="關閉"><i class="fa-solid fa-xmark"></i></button></div>${detail.description ? `<div class="location-detail-text">${escapeHtml(detail.description)}</div>` : '<div class="location-detail-text" style="color:var(--text-muted);">這個地點目前還沒有介紹文字。</div>'}<div class="location-detail-grid">${detail.address ? `<div class="location-detail-item"><span class="location-detail-label">地址 / 地區</span>${escapeHtml(detail.address)}</div>` : ''}${detail.schedule_note ? `<div class="location-detail-item"><span class="location-detail-label">活動 / 開團資訊</span><div class="location-detail-text">${escapeHtml(detail.schedule_note)}</div></div>` : ''}${detail.contact_note ? `<div class="location-detail-item"><span class="location-detail-label">聯絡方式</span><div class="location-detail-text">${escapeHtml(detail.contact_note)}</div></div>` : ''}${detail.type ? `<div class="location-detail-item"><span class="location-detail-label">類型</span>${escapeHtml(detail.type === 'discord' ? 'Discord / 線上' : detail.type === 'store' ? '店家' : '其他')}</div>` : ''}</div>${link}</div>`;
        modal.classList.add('is-open');
    };

    const loadDashboardStats = async (retries = 3) => {
        const container = document.getElementById('location-cards-container');
        const apiBase = window.API_BASE || '';
        try {
            const resp = await fetch(`${apiBase}/api/stats`);
            if (!resp.ok) throw new Error(`無法抓取統計數據 (Status: ${resp.status})`);
            const data = await resp.json();
            const g = data.global;
            document.getElementById('global-total').innerText = g.total;
            document.getElementById('global-good').innerHTML = `${g.good_rate}% <small style="font-size:0.8rem; opacity:0.6;">(${g.good_wins}場)</small>`;
            document.getElementById('global-evil').innerHTML = `${g.evil_rate}% <small style="font-size:0.8rem; opacity:0.6;">(${g.evil_wins}場)</small>`;
            if (!container) return;
            dashboardLocations = data.locations || [];
            if (dashboardLocations.length === 0) {
                container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:3rem;">目前魔典尚未記載任何地點數據</div>`;
                return;
            }
            container.innerHTML = dashboardLocations.map((loc, index) => `
                <div class="card location-card" role="button" tabindex="0" onclick="openLocationDetail(${index})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openLocationDetail(${index});}">
                    <div class="loc-header"><span class="loc-name"><i class="fa-solid fa-map-location-dot" style="margin-right:8px; opacity:0.5;"></i>${escapeHtml(loc.name)}</span><span class="loc-total-badge">${loc.total} 場對局</span></div>
                    <div class="loc-content"><div class="loc-stat-item"><span class="loc-stat-label">善良勝率</span><span class="loc-stat-value text-blue">${loc.good_rate}%</span><span class="loc-stat-games">(${loc.good_wins}場)</span></div><div style="height:40px; width:1px; background:var(--border-color);"></div><div class="loc-stat-item"><span class="loc-stat-label">邪惡勝率</span><span class="loc-stat-value text-red">${loc.evil_rate}%</span><span class="loc-stat-games">(${loc.evil_wins}場)</span></div></div>
                    <div class="loc-bar-container"><div class="bar-segment" style="width: ${loc.good_rate}%; background: linear-gradient(90deg, #457b9d, #a8dadc);"></div><div class="bar-segment" style="width: ${loc.evil_rate}%; background: linear-gradient(90deg, #f08080, #e63946);"></div></div>
                    <div class="loc-info-badge"><i class="fa-solid fa-circle-info"></i> ${loc.detail ? '查看地點介紹' : '尚未建立介紹'}</div>
                </div>`).join('');
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

    injectLocationModalStyle();
    loadDashboardStats();
}
