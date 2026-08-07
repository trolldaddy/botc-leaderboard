(() => {
  const BRANCH_ALIAS_HOST = 'botc-leaderboard-git-feature-town-checkin-trolldaddys-projects.vercel.app';
  const QR_CODE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  let qrLibraryPromise = null;

  const loadQrLibrary = () => {
    if (typeof window.QRCode === 'function') return Promise.resolve(true);
    if (qrLibraryPromise) return qrLibraryPromise;

    qrLibraryPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      let timer = null;
      let settled = false;
      const finish = (loaded) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(loaded && typeof window.QRCode === 'function');
      };

      script.src = QR_CODE_CDN;
      script.async = true;
      script.onload = () => finish(true);
      script.onerror = () => finish(false);
      timer = setTimeout(() => finish(false), 4000);
      document.head.appendChild(script);
    });

    return qrLibraryPromise;
  };

  const getCanonicalOrigin = () => {
    const { protocol, hostname, origin } = window.location;

    // Vercel single deployment URLs look like:
    // botc-leaderboard-bh6p0v5h8-trolldaddys-projects.vercel.app
    // They change every deploy, so convert them to the stable branch alias while testing.
    if (/^botc-leaderboard-[a-z0-9]+-trolldaddys-projects\.vercel\.app$/i.test(hostname)) {
      return `${protocol}//${BRANCH_ALIAS_HOST}`;
    }

    return origin;
  };

  const buildCleanJoinUrl = (roomCode) => {
    const code = String(roomCode || '').trim().toUpperCase();
    if (!code || code === '---') return '';
    return `${getCanonicalOrigin()}/?join=${encodeURIComponent(code)}#rooms`;
  };

  const redrawQr = () => {
    const codeEl = document.getElementById('room-code-display');
    const urlEl = document.getElementById('room-join-url');
    const qrBox = document.getElementById('room-qr');
    if (!codeEl || !urlEl || !qrBox) return;

    const code = codeEl.textContent.trim();
    const cleanUrl = buildCleanJoinUrl(code);
    if (!cleanUrl) return;

    if (urlEl.textContent === cleanUrl && qrBox.dataset.cleanQrUrl === cleanUrl) return;

    urlEl.textContent = cleanUrl;
    qrBox.dataset.cleanQrUrl = cleanUrl;
    qrBox.innerHTML = '';

    if (window.QRCode) {
      new QRCode(qrBox, {
        text: cleanUrl,
        width: 180,
        height: 180,
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      qrBox.textContent = cleanUrl;
    }
  };

  const install = () => {
    const codeEl = document.getElementById('room-code-display');
    const qrBox = document.getElementById('room-qr');
    if (!codeEl || !qrBox) return false;

    redrawQr();
    loadQrLibrary().then((loaded) => {
      if (!loaded) return;
      delete qrBox.dataset.cleanQrUrl;
      redrawQr();
    });

    const observer = new MutationObserver(() => setTimeout(redrawQr, 0));
    observer.observe(codeEl, { childList: true, characterData: true, subtree: true });
    observer.observe(qrBox, { childList: true, subtree: true });

    window.TownCheckinQrPatch = { redraw: redrawQr, buildCleanJoinUrl };
    return true;
  };

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (install() || tries > 30) clearInterval(timer);
    }, 100);
  }
})();
