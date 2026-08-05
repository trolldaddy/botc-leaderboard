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

  function renderDetail(item) {
    const images = item.images || [];
    const gallery = images.length ? `<div class="script-gallery"><img src="${escapeHtml(images[0].url)}" alt="${escapeHtml(images[0].alt)}"><div class="script-gallery-side">${images.slice(1,3).map(image => `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" loading="lazy">`).join('')}</div></div>` : '';
    const roles = item.roles || [];
    detail.innerHTML = `<header class="script-hero"><div class="script-title-line"><div><div class="script-category">${escapeHtml(item.category || '劇本')}</div><h2>${escapeHtml(item.name_zh_tw)} <small>${escapeHtml(item.version || '')}</small></h2></div>${item.source_url ? `<a class="script-source" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> 原始文章</a>` : ''}</div>${gallery}</header><section class="script-section"><h3>劇本介紹${item.needs_review ? '<span class="script-review">待審閱</span>' : ''}</h3><div class="script-intro">${escapeHtml(item.introduction || '尚未整理介紹。')}</div></section><section class="script-section"><h3>角色構成</h3>${roles.length ? `<div class="script-role-grid">${roles.map(roleCard).join('')}</div>` : '<div class="script-role-missing">尚未取得完整劇本 JSON，因此目前不公開不完整的角色名單。換上完整 JSON 重新匯入後，角色卡會依劇本順序自動顯示。</div>'}</section>`;
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
