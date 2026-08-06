(() => {
  const apiBase = window.API_BASE || '';
  const carousel = document.getElementById('script-carousel');
  const previousButton = document.getElementById('script-carousel-prev');
  const nextButton = document.getElementById('script-carousel-next');
  const detail = document.getElementById('script-detail');
  const search = document.getElementById('script-search');
  const count = document.getElementById('script-count');
  let scripts = [];
  let visibleScripts = [], activeSlug = '', scrollTimer = null;
  const escapeHtml = value => String(value || '').replace(/[&<>"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));

  function displayImages(item) {
    const images = item.images || [];
    // The first Wafuleiming asset is a horizontal logo, not a script face.
    if (item.slug === '\u74e6\u91dc\u96f7\u9cf4' && images.length >= 3) return images.slice(1, 3);
    return images.slice(0, 2);
  }

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

  function carouselSlideMarkup(item, index) {
    const images = displayImages(item), first = images[0];
    const imageMarkup = first ? `<img src="${escapeHtml(first.url)}" alt="${escapeHtml(first.alt)}" draggable="false" data-gallery-main-image>` : '<span class="script-carousel-no-image"><i class="fa-solid fa-image"></i></span>';
    return `<article class="script-carousel-slide" data-script-slide data-index="${index}" data-slug="${escapeHtml(item.slug)}"><div class="script-carousel-card">
      <div class="script-carousel-title"><div><div class="script-category">${escapeHtml(item.category || '\u5287\u672c')}</div><h2>${escapeHtml(item.name_zh_tw)} <small>${escapeHtml(item.version || '')}</small></h2><div class="script-byline">${escapeHtml(item.author_name ? `\u4f5c\u8005　${item.author_name}` : '\u4f5c\u8005\u5f85\u88dc')}</div></div>${item.source_url ? `<a class="script-source" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> \u539f\u59cb\u6587\u7ae0</a>` : ''}</div>
      <div class="script-carousel-image" data-gallery-view>${imageMarkup}</div>
      <div class="script-carousel-controls"><button type="button" data-script-previous aria-label="\u4e0a\u4e00\u5957\u5287\u672c" title="\u4e0a\u4e00\u5957\u5287\u672c"><i class="fa-solid fa-chevron-left"></i></button>${images.length > 1 ? '<button type="button" data-script-flip aria-label="\u7ffb\u9762" title="\u7ffb\u9762"><i class="fa-solid fa-repeat"></i></button>' : ''}<button type="button" data-script-fullscreen aria-label="\u5168\u87a2\u5e55\u67e5\u770b" title="\u5168\u87a2\u5e55\u67e5\u770b"><i class="fa-solid fa-expand"></i></button><button type="button" data-script-next aria-label="\u4e0b\u4e00\u5957\u5287\u672c" title="\u4e0b\u4e00\u5957\u5287\u672c"><i class="fa-solid fa-chevron-right"></i></button></div>
    </div></article>`;
  }

  function openScriptViewer(images, initialIndex, onChange) {
    if (!images.length) return;
    let activeIndex = initialIndex;
    const viewer = document.createElement('div');
    viewer.className = 'script-image-viewer';
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', '\u5287\u672c\u5716\u5168\u87a2\u5e55\u6aa2\u8996');
    const positionBelowNavigation = () => {
      const explicitNavigation = [...document.querySelectorAll('.sidebar, .top-nav, .navbar, [data-site-navigation]')];
      const fixedTopBars = [...document.querySelectorAll('body *')].filter(element => {
        if (element === viewer || viewer.contains(element)) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (style.position === 'fixed' || style.position === 'sticky')
          && rect.width >= window.innerWidth * 0.5
          && rect.height > 0
          && rect.height <= Math.min(220, window.innerHeight * 0.3)
          && rect.top <= 2
          && rect.bottom > 0;
      });
      const navigationCandidates = [...new Set([...explicitNavigation, ...fixedTopBars])];
      const navigationBottom = navigationCandidates.reduce((bottom, navigation) => {
        const rect = navigation.getBoundingClientRect();
        const style = window.getComputedStyle(navigation);
        const isTopBar = rect.height > 0 && rect.top <= 1 && (style.position === 'fixed' || style.position === 'sticky');
        return isTopBar ? Math.max(bottom, Math.ceil(rect.bottom)) : bottom;
      }, 0);
      // Keep the viewer above the fixed navigation in stacking order while
      // reserving enough vertical room for its title bar and the close action.
      viewer.style.setProperty('--script-viewer-top', `${Math.max(88, navigationBottom + 16)}px`);
    };
    positionBelowNavigation();
    const desktopSpread = images.length > 1 && window.matchMedia('(min-width: 800px) and (orientation: landscape)').matches;
    viewer.classList.toggle('is-spread', desktopSpread);
    viewer.innerHTML = `<div class="script-image-viewer-stage"><div class="script-image-viewer-pages">${desktopSpread ? images.map(item => `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt || '\u5287\u672c\u5716')}">`).join('') : '<img alt="">'}</div><div class="script-image-viewer-actions">${!desktopSpread && images.length > 1 ? '<button type="button" data-viewer-flip aria-label="\u7ffb\u9762" title="\u7ffb\u9762"><i class="fa-solid fa-repeat"></i></button>' : ''}<button type="button" data-viewer-close aria-label="\u95dc\u9589\u5168\u87a2\u5e55" title="\u95dc\u9589"><i class="fa-solid fa-xmark"></i></button></div></div>`;
    const image = viewer.querySelector('.script-image-viewer-pages img');
    const flipButton = viewer.querySelector('[data-viewer-flip]');
    const render = () => {
      if (desktopSpread) return;
      image.src = images[activeIndex].url;
      image.alt = images[activeIndex].alt || `\u5287\u672c\u5716 ${activeIndex + 1}`;
    };
    const close = () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', positionBelowNavigation);
      document.body.classList.remove('script-viewer-open');
      viewer.remove();
    };
    const onKeyDown = event => { if (event.key === 'Escape') close(); };
    flipButton?.addEventListener('click', () => {
      activeIndex = (activeIndex + 1) % images.length;
      render();
      onChange(activeIndex);
    });
    viewer.querySelector('[data-viewer-close]').addEventListener('click', close);
    viewer.addEventListener('click', event => { if (event.target === viewer || event.target.classList.contains('script-image-viewer-stage')) close(); });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', positionBelowNavigation);
    document.body.classList.add('script-viewer-open');
    document.body.appendChild(viewer);
    render();
    viewer.querySelector('[data-viewer-close]').focus();
  }

  function bindSlideGallery(slide, item) {
    const images = displayImages(item), frame = slide.querySelector('[data-gallery-view]');
    if (!frame || !images.length) return;
    const mainImage = frame.querySelector('[data-gallery-main-image]');
    let activeIndex = 0, flipping = false;
    const previousControl = slide.querySelector('[data-script-previous]');
    const flipControl = slide.querySelector('[data-script-flip]');
    const fullscreenControl = slide.querySelector('[data-script-fullscreen]');
    const nextControl = slide.querySelector('[data-script-next]');
    const syncControls = () => {
      if (flipControl) flipControl.title = flipControl.getAttribute('aria-label') = activeIndex === 0 ? '\u7ffb\u81f3\u80cc\u9762' : '\u7ffb\u56de\u6b63\u9762';
    };
    const setFace = index => {
      activeIndex = index;
      mainImage.src = images[activeIndex].url;
      mainImage.alt = images[activeIndex].alt || `\u5287\u672c\u5716 ${activeIndex + 1}`;
      syncControls();
    };
    slide.flipScriptImage = () => {
      if (images.length < 2 || flipping) return;
      flipping = true;
      frame.classList.add('is-flipping');
      window.setTimeout(() => setFace((activeIndex + 1) % images.length), 140);
      window.setTimeout(() => { frame.classList.remove('is-flipping'); flipping = false; }, 300);
    };
    slide.openScriptImage = () => openScriptViewer(images, activeIndex, setFace);
    previousControl?.addEventListener('click', event => { event.stopPropagation(); moveCarousel(-1); });
    flipControl?.addEventListener('click', event => { event.stopPropagation(); slide.flipScriptImage(); });
    fullscreenControl?.addEventListener('click', event => { event.stopPropagation(); slide.openScriptImage(); });
    nextControl?.addEventListener('click', event => { event.stopPropagation(); moveCarousel(1); });
  }
  function renderDetail(item) {
    const roster = groupedRosterMarkup(item.roles || [], item.special_entries || []);
    const guides = item.guides || {};
    const storytellerGuide = guides.storyteller || {};
    const loginNext = encodeURIComponent(`/#scripts/${item.slug}`);
    const locked = `<div class="script-guide-lock"><i class="fa-solid fa-lock"></i><h4>\u767b\u5165\u5f8c\u67e5\u770b\u8aaa\u66f8\u4eba\u653b\u7565</h4><p>\u73a9\u5bb6\u653b\u7565\u5c0d\u6240\u6709\u4eba\u516c\u958b\uff1b\u8aaa\u66f8\u4eba\u64cd\u4f5c\u7d30\u7bc0\u9700\u4f7f\u7528 LINE \u767b\u5165\u5f8c\u67e5\u770b\u3002</p><a class="script-guide-action" href="/api/auth/line/login?next=${loginNext}"><i class="fa-brands fa-line"></i> \u4f7f\u7528 LINE \u767b\u5165</a></div>`;
    const tags = (item.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join('');
    detail.innerHTML = `
      <header class="script-detail-heading"><div><div class="script-category">${escapeHtml(item.category || '\u5287\u672c')}</div><h2>${escapeHtml(item.name_zh_tw)} <small>${escapeHtml(item.version || '')}</small></h2><div class="script-detail-meta"><span><i class="fa-solid fa-user-pen"></i> ${escapeHtml(item.author_name || '\u4f5c\u8005\u5f85\u88dc')}</span>${tags}</div>${item.tagline ? `<p>${escapeHtml(item.tagline)}</p>` : ''}</div>${item.source_url ? `<a class="script-source" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> \u539f\u59cb\u6587\u7ae0</a>` : ''}</header>

      <nav class="script-tabs" role="tablist" aria-label="\u5287\u672c\u5167\u5bb9"><button class="active" type="button" role="tab" aria-selected="true" data-script-tab="intro">\u5287\u672c\u4ecb\u7d39</button><button type="button" role="tab" aria-selected="false" data-script-tab="roster">\u89d2\u8272\u69cb\u6210</button><button type="button" role="tab" aria-selected="false" data-script-tab="guide">\u62c9\u666e\u62c9\u65af\u653b\u7565</button></nav>
      <div data-script-panel="intro"><div class="script-intro-layout"><div><section class="script-section"><h3>\u5287\u672c\u80cc\u666f\u4ecb\u7d39${item.needs_review ? '<span class="script-review">\u5f85\u5be9\u95b1</span>' : ''}</h3><div class="script-prose">${escapeHtml(item.background_introduction || item.introduction || '\u5c1a\u672a\u6574\u7406\u80cc\u666f\u4ecb\u7d39\u3002')}</div></section><section class="script-section"><h3>\u6838\u5fc3\u9ad4\u9a57\u8207\u73a9\u6cd5\u7279\u8272</h3><div class="script-prose">${escapeHtml(item.gameplay_overview || '\u5c1a\u672a\u6574\u7406\u73a9\u6cd5\u7279\u8272\u3002')}</div></section></div><aside><section class="script-section"><h3>\u4f5c\u8005</h3><div class="script-prose">${escapeHtml(item.author_name || '\u5f85\u88dc')}</div></section><section class="script-section"><h3>\u4f5c\u8005\u7684\u8a71</h3><div class="script-prose">${escapeHtml(item.author_note || '\u5c1a\u672a\u6536\u9304\u3002')}</div></section><section class="script-section"><h3>\u88fd\u4f5c\u8207\u66f4\u65b0\u8cc7\u8a0a</h3><div class="script-prose">${escapeHtml(item.production_updates || item.version || '\u5c1a\u672a\u6536\u9304\u3002')}</div></section></aside></div></div>
      <div data-script-panel="roster" hidden><section class="script-section"><h3>\u89d2\u8272\u8207\u898f\u5247\u69cb\u6210</h3>${roster || '<div class="script-role-missing">\u5c1a\u672a\u53d6\u5f97\u5b8c\u6574\u5287\u672c JSON\u3002</div>'}</section></div>
      <div data-script-panel="guide" hidden><div class="script-guide-grid"><section class="script-section"><h3>\u73a9\u5bb6\u653b\u7565</h3><p class="script-guide-note">\u6240\u6709\u4eba\u7686\u53ef\u95b1\u8b80\u3002</p><div class="script-prose">${escapeHtml(guides.player?.content || '\u73a9\u5bb6\u653b\u7565\u6b63\u5728\u6574\u7406\u4e2d\u3002')}</div></section><section class="script-section"><h3>\u8aaa\u66f8\u4eba\u653b\u7565</h3>${storytellerGuide.locked ? locked : '<div class="script-guide-loading" data-storyteller-guide-content>\u6b63\u5728\u6e96\u5099\u6388\u6b0a\u5167\u5bb9\u3002</div>'}</section></div></div>`;

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

  function slideForSlug(slug) {
    return carousel.querySelector(`[data-script-slide][data-slug="${CSS.escape(slug)}"]`);
  }

  function scrollToSlug(slug, behavior = 'smooth') {
    const slide = slideForSlug(slug);
    if (!slide) return;
    const left = slide.offsetLeft - (carousel.clientWidth - slide.offsetWidth) / 2;
    carousel.scrollTo({ left: Math.max(0, left), behavior });
  }

  function renderCarousel() {
    const keyword = search.value.trim().toLowerCase();
    visibleScripts = scripts.filter(item => item.name_zh_tw.toLowerCase().includes(keyword));
    count.textContent = `\u5171 ${visibleScripts.length} \u5957\u5287\u672c`;
    carousel.innerHTML = visibleScripts.length ? visibleScripts.map(carouselSlideMarkup).join('') : '<div class="script-empty">\u627e\u4e0d\u5230\u5287\u672c\u3002</div>';
    carousel.querySelectorAll('[data-script-slide]').forEach((slide, index) => bindSlideGallery(slide, visibleScripts[index]));
    if (!visibleScripts.some(item => item.slug === activeSlug) && visibleScripts.length) selectScript(visibleScripts[0].slug, { syncCarousel: false });
    requestAnimationFrame(() => scrollToSlug(activeSlug || visibleScripts[0]?.slug, 'auto'));
  }

  function selectScript(slug, options = {}) {
    const item = scripts.find(script => script.slug === slug);
    if (!item) return;
    activeSlug = slug; renderDetail(item);
    carousel.querySelectorAll('[data-script-slide]').forEach(slide => {
      const active = slide.dataset.slug === slug;
      slide.classList.toggle('active', active); slide.setAttribute('aria-current', active ? 'true' : 'false');
    });
    if (options.syncCarousel !== false) scrollToSlug(slug);
    if (window.location.hash !== `#scripts/${encodeURIComponent(slug)}`) history.replaceState(null, '', `#scripts/${encodeURIComponent(slug)}`);
  }

  function moveCarousel(direction) {
    if (!visibleScripts.length) return;
    const current = Math.max(0, visibleScripts.findIndex(item => item.slug === activeSlug));
    const next = (current + direction + visibleScripts.length) % visibleScripts.length;
    selectScript(visibleScripts[next].slug);
  }

  let dragging = false, dragStartX = 0, dragStartScroll = 0, draggedSlide = null, dragMoved = false;
  carousel.addEventListener('pointerdown', event => {
    if (event.target.closest('button, a')) return;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    dragging = true; dragMoved = false; dragStartX = event.clientX; dragStartScroll = carousel.scrollLeft;
    draggedSlide = event.target.closest('[data-script-slide]');
    if (draggedSlide) draggedSlide.dataset.wasDragged = 'false';
    carousel.setPointerCapture?.(event.pointerId);
  });
  carousel.addEventListener('pointermove', event => {
    if (!dragging) return;
    const delta = event.clientX - dragStartX;
    if (Math.abs(delta) > 12 && draggedSlide) { dragMoved = true; draggedSlide.dataset.wasDragged = 'true'; }
    carousel.scrollLeft = dragStartScroll - delta;
  });
  const finishDrag = event => {
    dragging = false; carousel.releasePointerCapture?.(event.pointerId);
    if (draggedSlide) {
      const slide = draggedSlide;
      if (!dragMoved) slide.dataset.wasDragged = 'false';
      else setTimeout(() => { slide.dataset.wasDragged = 'false'; }, 180);
    }
    draggedSlide = null;
  };
  carousel.addEventListener('pointerup', finishDrag);
  carousel.addEventListener('pointercancel', finishDrag);
  let touchStartX = 0, touchStartY = 0, touchStartScroll = 0, touchStartSlug = '', touchStartTime = 0;
  let touchLastX = 0, touchLastTime = 0, touchDragging = false, touchHorizontal = false;
  carousel.addEventListener('touchstart', event => {
    if (event.target.closest('.script-carousel-controls, .script-carousel-title a') || event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartX = touch.clientX; touchStartY = touch.clientY; touchStartScroll = carousel.scrollLeft; touchStartSlug = activeSlug;
    touchLastX = touch.clientX; touchStartTime = touchLastTime = performance.now();
    touchDragging = true; touchHorizontal = false; carousel.classList.add('is-touching');
  }, { passive: true });
  carousel.addEventListener('touchmove', event => {
    if (!touchDragging || event.touches.length !== 1) return;
    const touch = event.touches[0], deltaX = touch.clientX - touchStartX, deltaY = touch.clientY - touchStartY;
    const horizontalDistance = Math.abs(deltaX), verticalDistance = Math.abs(deltaY);
    if (!touchHorizontal && horizontalDistance >= 2) {
      if (verticalDistance > 18 && horizontalDistance < verticalDistance * 0.5) {
        touchDragging = false;
        carousel.classList.remove('is-touching');
        return;
      }
      if (horizontalDistance >= verticalDistance * 0.5) touchHorizontal = true;
    }
    if (!touchHorizontal) return;
    event.preventDefault();
    touchLastX = touch.clientX; touchLastTime = performance.now();
    carousel.scrollLeft = touchStartScroll - deltaX * 1.18;
  }, { passive: false });
  carousel.addEventListener('touchend', () => {
    if (touchHorizontal) {
      const delta = carousel.scrollLeft - touchStartScroll;
      const elapsed = Math.max(1, touchLastTime - touchStartTime);
      const velocity = Math.abs(touchLastX - touchStartX) / elapsed;
      if (Math.abs(delta) >= 14 || velocity >= 0.12) {
        const start = Math.max(0, visibleScripts.findIndex(item => item.slug === touchStartSlug));
        const next = (start + (delta > 0 ? 1 : -1) + visibleScripts.length) % visibleScripts.length;
        selectScript(visibleScripts[next].slug);
      } else scrollToSlug(touchStartSlug || activeSlug);
    }
    touchDragging = false; touchHorizontal = false; carousel.classList.remove('is-touching');
  }, { passive: true });
  carousel.addEventListener('touchcancel', () => { touchDragging = false; touchHorizontal = false; carousel.classList.remove('is-touching'); }, { passive: true });
  carousel.addEventListener('scroll', () => {
    if (touchDragging) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const center = carousel.scrollLeft + carousel.clientWidth / 2;
      const slides = [...carousel.querySelectorAll('[data-script-slide]')];
      const nearest = slides.reduce((best, slide) => Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - center) ? slide : best, slides[0]);
      if (nearest && nearest.dataset.slug !== activeSlug) selectScript(nearest.dataset.slug, { syncCarousel: false });
    }, 100);
  });
  previousButton.addEventListener('click', () => moveCarousel(-1));
  nextButton.addEventListener('click', () => moveCarousel(1));
  carousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); moveCarousel(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });

  async function init() {
    try {
      const pageHeader = document.querySelector('.script-browser-header');
      const pageToolbar = document.querySelector('.script-toolbar');
      if (pageHeader && pageToolbar && !pageHeader.parentElement.classList.contains('script-browser-topline')) {
        const topline = document.createElement('div');
        topline.className = 'script-browser-topline';
        pageHeader.before(topline);
        topline.append(pageHeader, pageToolbar);
      }
      const response = await fetch(`${apiBase}/api/scripts`);
      if (!response.ok) throw new Error('\u5287\u672c\u7d22\u5f15\u8f09\u5165\u5931\u6557');
      const summaries = (await response.json()).items || [];
      scripts = await Promise.all(summaries.map(async summary => {
        const detailResponse = await fetch(`${apiBase}/api/scripts/${encodeURIComponent(summary.slug)}`);
        return detailResponse.ok ? detailResponse.json() : summary;
      }));
      const requested = decodeURIComponent(window.location.hash.replace(/^#scripts\/?/, ''));
      activeSlug = scripts.some(item => item.slug === requested) ? requested : (scripts[0]?.slug || '');
      renderCarousel();
      if (activeSlug) selectScript(activeSlug, { syncCarousel: false });
    } catch (error) {
      count.textContent = error.message;
      carousel.innerHTML = '<div class="script-empty">\u76ee\u524d\u7121\u6cd5\u8b80\u53d6\u5287\u672c\u3002</div>';
    }
  }
  search.addEventListener('input', renderCarousel); init();
})();
