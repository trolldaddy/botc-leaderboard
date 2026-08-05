(() => {
  const apiBase = window.API_BASE || '';
  const list = document.getElementById('script-list');
  const detail = document.getElementById('script-detail');
  const search = document.getElementById('script-search');
  const count = document.getElementById('script-count');
  let scripts = [];
  const escapeHtml = value => String(value || '').replace(/[&<>"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));

  function roleCard(role) {
    const href = `#knowledge/${encodeURIComponent(role.knowledge_slug || role.canonical_key)}`;
    const icon = role.image_url ? `<img src="${escapeHtml(role.image_url)}" alt="" loading="lazy">` : '<span class="script-role-fallback"><i class="fa-solid fa-masks-theater"></i></span>';
    return `<a class="script-role-card" href="${href}">${icon}<span><strong>${escapeHtml(role.name_zh_tw)}</strong><small>${escapeHtml(role.team)}</small></span></a>`;
  }

  const groupOrder = ['townsfolk', 'outsider', 'minion', 'demon', 'traveler', 'traveller', 'fabled', 'jinx', 'loric', 'special'];
  const groupLabels = {
    townsfolk: '鎮民', outsider: '外來者', minion: '爪牙', demon: '惡魔',
    traveler: '旅行者', traveller: '旅行者', fabled: '傳奇角色',
    jinx: '相剋／奇遇規則', loric: '規則修正標記', special: '其他劇本標記',
  };

  function specialCard(item) {
    const icon = item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="" loading="lazy">` : '<span class="script-role-fallback"><i class="fa-solid fa-scroll"></i></span>';
    return `<div class="script-role-card script-special-card">${icon}<span><strong>${escapeHtml(item.name_zh_tw)}</strong><small>${escapeHtml(groupLabels[item.team] || item.team || '特殊條目')}</small></span>${item.ability ? `<span class="script-special-ability">${escapeHtml(item.ability)}</span>` : ''}</div>`;
  }

  function groupedRosterMarkup(roles, specialEntries) {
    const groups = new Map();
    roles.forEach(role => {
      const key = String(role.team || 'special').toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ kind: 'role', value: role });
    });
    specialEntries.forEach(item => {
      const key = String(item.team || 'special').toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ kind: 'special', value: item });
    });
    const keys = [...groups.keys()].sort((a, b) => {
      const left = groupOrder.indexOf(a), right = groupOrder.indexOf(b);
      return (left < 0 ? 999 : left) - (right < 0 ? 999 : right);
    });
    return keys.map(key => `<section class="script-roster-group"><h4>${escapeHtml(groupLabels[key] || key)}</h4><div class="script-role-grid">${groups.get(key).map(item => item.kind === 'role' ? roleCard(item.value) : specialCard(item.value)).join('')}</div></section>`).join('');
  }

  function galleryMarkup(images) {
    if (!images.length) return '';
    const first = images[0];
    return `<div class="script-gallery" data-script-gallery>
      <button class="script-gallery-main" type="button" data-gallery-next aria-label="查看下一張劇本圖片">
        <img src="${escapeHtml(first.url)}" alt="${escapeHtml(first.alt)}" data-gallery-main-image>
        <span class="script-gallery-counter" data-gallery-counter>1 / ${images.length}</span>
        ${images.length > 1 ? '<span class="script-gallery-hint"><i class="fa-solid fa-rotate"></i> 點擊翻至下一張</span>' : ''}
      </button>
      ${images.length > 1 ? `<div class="script-gallery-side" role="tablist" aria-label="劇本圖片選擇">${images.map((image, index) => `<button class="script-gallery-thumb${index === 0 ? ' active' : ''}" type="button" role="tab" aria-selected="${index === 0}" data-gallery-index="${index}"><img src="${escapeHtml(image.url)}" alt="" loading="${index === 0 ? 'eager' : 'lazy'}"><span>${escapeHtml(image.alt || `劇本圖片 ${index + 1}`)}</span></button>`).join('')}</div>` : ''}
    </div>`;
  }

  function bindGallery(images) {
    const gallery = detail.querySelector('[data-script-gallery]');
    if (!gallery || images.length < 2) return;
    const mainImage = gallery.querySelector('[data-gallery-main-image]');
    const counter = gallery.querySelector('[data-gallery-counter]');
    const thumbs = [...gallery.querySelectorAll('[data-gallery-index]')];
    let activeIndex = 0;
    const showImage = index => {
      activeIndex = (index + images.length) % images.length;
      const image = images[activeIndex];
      mainImage.src = image.url;
      mainImage.alt = image.alt || `劇本圖片 ${activeIndex + 1}`;
      counter.textContent = `${activeIndex + 1} / ${images.length}`;
      thumbs.forEach((thumb, thumbIndex) => {
        const active = thumbIndex === activeIndex;
        thumb.classList.toggle('active', active);
        thumb.setAttribute('aria-selected', String(active));
      });
    };
    gallery.querySelector('[data-gallery-next]').addEventListener('click', () => showImage(activeIndex + 1));
    thumbs.forEach(thumb => thumb.addEventListener('click', () => showImage(Number(thumb.dataset.galleryIndex))));
  }

  function renderDetail(item) {
    const images = item.images || [];
    const roster = groupedRosterMarkup(item.roles || [], item.special_entries || []);
    const guides = item.guides || {};
    const storytellerGuide = guides.storyteller || {};
    const loginNext = encodeURIComponent(`/#scripts/${item.slug}`);
    const locked = `<div class="script-guide-lock"><i class="fa-solid fa-lock"></i><h4>\u767b\u5165\u5f8c\u67e5\u770b\u8aaa\u66f8\u4eba\u653b\u7565</h4><p>\u73a9\u5bb6\u653b\u7565\u5c0d\u6240\u6709\u4eba\u516c\u958b\uff1b\u8aaa\u66f8\u4eba\u64cd\u4f5c\u7d30\u7bc0\u9700\u4f7f\u7528 LINE \u767b\u5165\u5f8c\u67e5\u770b\u3002</p><a class="script-guide-action" href="/api/auth/line/login?next=${loginNext}"><i class="fa-brands fa-line"></i> \u4f7f\u7528 LINE \u767b\u5165</a></div>`;
    detail.innerHTML = `
      <header class="script-hero"><div class="script-title-line"><div><div class="script-category">${escapeHtml(item.category || '\u5287\u672c')}</div><h2>${escapeHtml(item.name_zh_tw)} <small>${escapeHtml(item.version || '')}</small></h2><div class="script-byline">${escapeHtml(item.author_name ? `\u4f5c\u8005\u3000${item.author_name}` : '\u4f5c\u8005\u5f85\u88dc')}</div></div>${item.source_url ? `<a class="script-source" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> \u539f\u59cb\u6587\u7ae0</a>` : ''}</div>${item.tagline ? `<p class="script-tagline">${escapeHtml(item.tagline)}</p>` : ''}${galleryMarkup(images)}</header>
      <nav class="script-tabs" role="tablist" aria-label="\u5287\u672c\u5167\u5bb9"><button class="active" type="button" role="tab" aria-selected="true" data-script-tab="intro">\u5287\u672c\u4ecb\u7d39</button><button type="button" role="tab" aria-selected="false" data-script-tab="roster">\u89d2\u8272\u69cb\u6210</button><button type="button" role="tab" aria-selected="false" data-script-tab="guide">\u62c9\u666e\u62c9\u65af\u653b\u7565</button></nav>
      <div data-script-panel="intro"><div class="script-intro-layout"><div><section class="script-section"><h3>\u5287\u672c\u80cc\u666f\u4ecb\u7d39${item.needs_review ? '<span class="script-review">\u5f85\u5be9\u95b1</span>' : ''}</h3><div class="script-prose">${escapeHtml(item.background_introduction || item.introduction || '\u5c1a\u672a\u6574\u7406\u80cc\u666f\u4ecb\u7d39\u3002')}</div></section><section class="script-section"><h3>\u6838\u5fc3\u9ad4\u9a57\u8207\u73a9\u6cd5\u7279\u8272</h3><div class="script-prose">${escapeHtml(item.gameplay_overview || '\u5c1a\u672a\u6574\u7406\u73a9\u6cd5\u7279\u8272\u3002')}</div></section></div><aside><section class="script-section"><h3>\u4f5c\u8005</h3><div class="script-prose">${escapeHtml(item.author_name || '\u5f85\u88dc')}</div></section><section class="script-section"><h3>\u4f5c\u8005\u7684\u8a71</h3><div class="script-prose">${escapeHtml(item.author_note || '\u5c1a\u672a\u6536\u9304\u3002')}</div></section><section class="script-section"><h3>\u88fd\u4f5c\u8207\u66f4\u65b0\u8cc7\u8a0a</h3><div class="script-prose">${escapeHtml(item.production_updates || item.version || '\u5c1a\u672a\u6536\u9304\u3002')}</div></section></aside></div></div>
      <div data-script-panel="roster" hidden><section class="script-section"><h3>\u89d2\u8272\u8207\u898f\u5247\u69cb\u6210</h3>${roster || '<div class="script-role-missing">\u5c1a\u672a\u53d6\u5f97\u5b8c\u6574\u5287\u672c JSON\u3002</div>'}</section></div>
      <div data-script-panel="guide" hidden><div class="script-guide-grid"><section class="script-section"><h3>\u73a9\u5bb6\u653b\u7565</h3><p class="script-guide-note">\u6240\u6709\u4eba\u7686\u53ef\u95b1\u8b80\u3002</p><div class="script-prose">${escapeHtml(guides.player?.content || '\u73a9\u5bb6\u653b\u7565\u6b63\u5728\u6574\u7406\u4e2d\u3002')}</div></section><section class="script-section"><h3>\u8aaa\u66f8\u4eba\u653b\u7565</h3>${storytellerGuide.locked ? locked : '<div class="script-guide-loading" data-storyteller-guide-content>\u6b63\u5728\u6e96\u5099\u6388\u6b0a\u5167\u5bb9\u3002</div>'}</section></div></div>`;
    bindGallery(images);
    const tabs = [...detail.querySelectorAll('[data-script-tab]')];
    let storytellerLoaded = false;
    tabs.forEach(button => button.addEventListener('click', async () => {
      tabs.forEach(tab => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
      detail.querySelectorAll('[data-script-panel]').forEach(panel => { const active = panel.dataset.scriptPanel === button.dataset.scriptTab; panel.hidden = !active; });
      if (button.dataset.scriptTab !== 'guide' || storytellerGuide.locked || storytellerLoaded) return;
      const target = detail.querySelector('[data-storyteller-guide-content]'); if (!target) return;
      storytellerLoaded = true;
      try {
        const response = await fetch(`${apiBase}/api/scripts/${encodeURIComponent(item.slug)}/storyteller-guide`, { credentials: 'same-origin' });
        const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.detail || '\u7121\u6cd5\u8b80\u53d6\u8aaa\u66f8\u4eba\u653b\u7565');
        target.className = 'script-prose'; target.textContent = payload.content || '\u8aaa\u66f8\u4eba\u653b\u7565\u6b63\u5728\u6574\u7406\u4e2d\u3002';
      } catch (error) { target.className = 'script-guide-error'; target.textContent = error.message; storytellerLoaded = false; }
    }));
  }

  function renderList() {
    const keyword = search.value.trim().toLowerCase();
    const filtered = scripts.filter(item => item.name_zh_tw.toLowerCase().includes(keyword));
    count.textContent = `共 ${filtered.length} 套劇本`;
    list.innerHTML = filtered.length ? filtered.map(item => `<button class="script-list-button" data-slug="${escapeHtml(item.slug)}"><strong>${escapeHtml(item.name_zh_tw)}</strong><small>${escapeHtml([item.category, item.version].filter(Boolean).join(' · '))}</small></button>`).join('') : '<div class="script-empty">找不到劇本。</div>';
    list.querySelectorAll('[data-slug]').forEach(button => button.addEventListener('click', () => selectScript(button.dataset.slug)));
  }

  async function selectScript(slug) {
    detail.innerHTML = '<div class="script-empty">正在展開劇本...</div>';
    try {
      const response = await fetch(`${apiBase}/api/scripts/${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error('劇本尚未公開或不存在');
      renderDetail(await response.json());
      list.querySelectorAll('[data-slug]').forEach(button => button.classList.toggle('active', button.dataset.slug === slug));
      if (window.location.hash !== `#scripts/${encodeURIComponent(slug)}`) history.replaceState(null, '', `#scripts/${encodeURIComponent(slug)}`);
    } catch (error) { detail.innerHTML = `<div class="script-empty"><h3>無法載入</h3><p>${escapeHtml(error.message)}</p></div>`; }
  }

  async function init() {
    try {
      const response = await fetch(`${apiBase}/api/scripts`);
      if (!response.ok) throw new Error('劇本索引載入失敗');
      scripts = (await response.json()).items || []; renderList();
      const requested = decodeURIComponent(window.location.hash.replace(/^#scripts\/?/, ''));
      if (requested) selectScript(requested); else if (scripts.length) selectScript(scripts[0].slug);
    } catch (error) { count.textContent = error.message; list.innerHTML = '<div class="script-empty">目前無法讀取劇本。</div>'; }
  }
  search.addEventListener('input', renderList); init();
})();
