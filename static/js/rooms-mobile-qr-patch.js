(() => {
  let html5QrCode = null;
  let scanning = false;
  const SCANNER_ID = 'qr-scan-reader';

  const $ = (id) => document.getElementById(id);

  const setStatus = (message, isError = false) => {
    const hint = $('qr-scan-hint');
    if (hint) {
      hint.textContent = message;
      hint.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
    }
  };

  const extractRoomCode = (rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';

    try {
      const parsed = new URL(raw, window.location.origin);
      const fromQuery = parsed.searchParams.get('join');
      if (fromQuery) return fromQuery.trim().toUpperCase();
    } catch (err) {}

    const joinMatch = raw.match(/[?&]join=([A-Za-z0-9]{4,8})/);
    if (joinMatch) return joinMatch[1].toUpperCase();

    const codeMatch = raw.match(/\b[A-Za-z0-9]{5}\b/);
    return codeMatch ? codeMatch[0].toUpperCase() : raw.toUpperCase();
  };

  const ensureScannerBox = () => {
    const panel = $('qr-scan-panel');
    if (!panel) return null;

    let reader = $(SCANNER_ID);
    if (!reader) {
      reader = document.createElement('div');
      reader.id = SCANNER_ID;
      reader.className = 'qr-scan-reader';
      const video = $('qr-scan-video');
      if (video) video.replaceWith(reader);
      else panel.insertBefore(reader, panel.firstChild);
    }

    let hint = $('qr-scan-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'qr-scan-hint';
      hint.className = 'scan-hint';
      hint.textContent = '將 QR Code 放在畫面中央。第一次使用時請允許相機權限。';
      panel.insertBefore(hint, reader.nextSibling);
    }

    return reader;
  };

  const stopQrScanner = async () => {
    scanning = false;
    try {
      if (html5QrCode) {
        const state = html5QrCode.getState ? html5QrCode.getState() : null;
        if (state !== 1) await html5QrCode.stop();
        await html5QrCode.clear();
      }
    } catch (err) {
      try { await html5QrCode?.clear?.(); } catch (clearErr) {}
    }
    html5QrCode = null;
    const panel = $('qr-scan-panel');
    if (panel) panel.style.display = 'none';
  };

  const startQrScanner = async () => {
    const panel = $('qr-scan-panel');
    const reader = ensureScannerBox();
    if (!panel || !reader) return;

    if (!window.Html5Qrcode) {
      alert('掃描元件尚未載入完成，請稍等幾秒後再試。也可以先手動輸入五碼。');
      return;
    }

    if (!window.isSecureContext) {
      alert('手機瀏覽器需要 HTTPS 才能開啟相機。請使用 https 網址。');
      return;
    }

    await stopQrScanner();
    panel.style.display = 'block';
    setStatus('正在開啟相機，第一次使用時請允許相機權限。');

    try {
      html5QrCode = new Html5Qrcode(SCANNER_ID, { verbose: false });
      scanning = true;
      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(180, Math.floor(minEdge * 0.72));
            return { width: size, height: size };
          },
          aspectRatio: 1.7777778,
          disableFlip: false
        },
        async (decodedText) => {
          if (!scanning) return;
          scanning = false;
          const code = extractRoomCode(decodedText);
          if (!code) {
            setStatus('掃到了 QR，但沒有找到房間代碼。', true);
            scanning = true;
            return;
          }
          if ($('room-code-input')) $('room-code-input').value = code;
          setStatus(`已掃到房間 ${code}，正在加入...`);
          await stopQrScanner();

          if (window.TownCheckinUI?.joinByCode) {
            await window.TownCheckinUI.joinByCode();
          } else if (window.TownCheckin?.joinRoom) {
            await window.TownCheckin.joinRoom();
          }
        },
        () => {}
      );
      setStatus('請將 QR Code 放在畫面中央。');
    } catch (err) {
      await stopQrScanner();
      const message = String(err?.message || err || '無法開啟相機');
      alert(`無法開啟相機：${message}\n\n請確認瀏覽器相機權限，或改用手動輸入五碼。`);
    }
  };

  const install = () => {
    if (!window.TownCheckinUI) return false;
    window.TownCheckinUI.startQrScanner = startQrScanner;
    window.TownCheckinUI.stopQrScanner = stopQrScanner;
    window.TownCheckinMobileQr = { start: startQrScanner, stop: stopQrScanner, extractRoomCode };
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