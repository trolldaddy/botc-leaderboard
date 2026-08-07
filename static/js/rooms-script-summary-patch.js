(() => {
  window.__roomsScriptSummaryPatchDestroy?.();

  const STORAGE_KEY = 'botc_town_checkin_room';
  let stopped = false;
  let scripts = [];
  let renderQueued = false;

  const normalize = (value) => String(value || '')
    .toLocaleLowerCase('zh-Hant')
    .replace(/[\s\-—–·・:：,，.。()（）《》〈〉【】\[\]]+/g, '');

  const roomScriptName = () => {
    const activeRoom = window.TownCheckin?.getCurrentRoom?.();
    if (activeRoom) return activeRoom.script || '';
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').script || '';
    } catch (_) {
      return '';
    }
  };

  const scriptNames = (script) => [
    script.name_zh_tw,
    script.name,
    script.title,
    script.slug,
  ].filter(Boolean);

  const findScript = (name) => {
    const needle = normalize(name);
    if (!needle) return null;
    const exact = scripts.find((script) => scriptNames(script).some((item) => normalize(item) === needle));
    if (exact) return exact;
    return scripts.find((script) => scriptNames(script).some((item) => {
      const candidate = normalize(item);
      return candidate && (candidate.includes(needle) || needle.includes(candidate));
    })) || null;
  };

  const render = () => {
    renderQueued = false;
    if (stopped) return;
    const summary = document.querySelector('#active-room-summary');
    if (!summary) return;

    summary.querySelector('.room-script-library-link')?.remove();
    const script = findScript(roomScriptName());
    if (!script?.slug) return;

    const link = document.createElement('a');
    link.className = 'room-script-library-link';
    const scriptHash = `#scripts/${encodeURIComponent(script.slug)}`;
    link.href = scriptHash;
    link.setAttribute('aria-label', `前往劇本庫查看${script.name_zh_tw || script.name || script.slug}`);
    const navigateToScript = (event) => {
      if (event.type === 'pointerdown' && event.button !== 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.hash = scriptHash;
    };
    link.addEventListener('pointerdown', navigateToScript);
    link.addEventListener('click', navigateToScript);

    const logo = document.createElement('span');
    logo.className = 'room-script-library-logo';
    const frontImageUrl = script.images?.[0]?.url || '';
    const artworkUrl = script.logo_image_url || frontImageUrl;
    if (artworkUrl) {
      if (!script.logo_image_url) {
        link.classList.add('is-front-fallback');
        logo.classList.add('is-front-fallback');
        logo.style.backgroundImage = `url(${JSON.stringify(artworkUrl)})`;
        logo.style.backgroundSize = 'cover';
        logo.style.backgroundPosition = 'center 55%';
        logo.style.backgroundRepeat = 'no-repeat';
      } else {
        const image = document.createElement('img');
        image.src = artworkUrl;
        image.alt = '';
        image.addEventListener('error', () => { logo.textContent = '📜'; }, { once: true });
        logo.appendChild(image);
      }
    } else {
      logo.textContent = '📜';
    }

    const copy = document.createElement('span');
    copy.className = 'room-script-library-copy';
    const label = document.createElement('small');
    label.textContent = '劇本庫';
    const title = document.createElement('strong');
    title.textContent = script.name_zh_tw || script.name || script.slug;
    copy.append(label, title);

    const arrow = document.createElement('span');
    arrow.className = 'room-script-library-arrow';
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');
    link.append(logo, copy, arrow);

    const summaryTitle = summary.querySelector('.summary-title');
    const titleBlock = summaryTitle
      ? [...summary.children].find((child) => child === summaryTitle || child.contains(summaryTitle))
      : null;
    const insertionPoint = titleBlock?.nextSibling || summary.firstChild;
    summary.insertBefore(link, insertionPoint);
  };

  const queueRender = () => {
    if (renderQueued || stopped) return;
    renderQueued = true;
    requestAnimationFrame(render);
  };

  const observer = new MutationObserver((mutations) => {
    if (mutations.every((mutation) => [...mutation.addedNodes, ...mutation.removedNodes]
      .every((node) => node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('room-script-library-link')))) return;
    queueRender();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) queueRender();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('botc:town-room-changed', queueRender);

  fetch(`${window.API_BASE || ''}/api/scripts`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
    .then((payload) => {
      scripts = Array.isArray(payload) ? payload : (payload.items || []);
      queueRender();
    })
    .catch((error) => console.warn('[rooms] 無法載入劇本庫連結', error));

  queueRender();
  window.__roomsScriptSummaryPatchDestroy = () => {
    stopped = true;
    observer.disconnect();
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('botc:town-room-changed', queueRender);
    document.querySelector('#active-room-summary .room-script-library-link')?.remove();
  };
})();
