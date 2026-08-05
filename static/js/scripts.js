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
    const gallery = galleryMarkup(images);
    const roles = item.roles || [];
    detail.innerHTML = `<header class="script-hero"><div class="script-title-line"><div><div class="script-category">${escapeHtml(item.category || '劇本')}</div><h2>${escapeHtml(item.name_zh_tw)} <small>${escapeHtml(item.version || '')}</small></h2></div>${item.source_url ? `<a class="script-source" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> 原始文章</a>` : ''}</div>${gallery}</header><section class="script-section"><h3>劇本介紹${item.needs_review ? '<span class="script-review">待審閱</span>' : ''}</h3><div class="script-intro">${escapeHtml(item.introduction || '尚未整理介紹。')}</div></section><section class="script-section"><h3>角色構成</h3>${roles.length ? `<div class="script-role-grid">${roles.map(roleCard).join('')}</div>` : '<div class="script-role-missing">尚未取得完整劇本 JSON，因此目前不公開不完整的角色名單。換上完整 JSON 重新匯入後，角色卡會依劇本順序自動顯示。</div>'}</section>`;
    bindGallery(images);
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
