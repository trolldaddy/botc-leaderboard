(() => {
  let html5QrCode = null;
  let scanning = false;
  let fallbackTimer = null;
  let jsQrLoadPromise = null;
  let scanStartedAt = 0;
  const SCANNER_ID = 'qr-scan-reader';
  const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';

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

    const hashMatch = raw.match(/join=([A-Za-z0-9]{4,8})/);
    if (hashMatch) return hashMatch[1].toUpperCase();

    const pathMatch = raw.match(/(?:join|room|rooms)[\/=:-]([A-Za-z0-9]{4,8})/i);
    if (pathMatch) return pathMatch[1].toUpperCase();

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

    let actions = $('qr-scan-extra-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.id = 'qr-scan-extra-actions';
      actions.className = 'town-actions compact-actions';
      actions.style.marginTop = '.75rem';
      actions.innerHTML = `
        <button id="qr-force-check" class="btn btn-outline" type="button"><i class="fa-solid fa-bullseye"></i> 手動檢查畫面</button>
        <button id="qr-manual-code" class="btn btn-outline" type="button"><i class="fa-solid fa-keyboard"></i> 手動輸入五碼</button>
      `;
      panel.insertBefore(actions, hint.nextSibling);
    }

    const forceButton = $('qr-force-check');
    if (forceButton && !forceButton.dataset.bound) {
      forceButton.dataset.bound = '1';
      forceButton.addEventListener('click', () => detectFromCurrentFrame(true));
    }

    const manualButton = $('qr-manual-code');
    if (manualButton && !manualButton.dataset.bound) {
      manualButton.dataset.bound = '1';
      manualButton.addEventListener('click', async () => {
        const code = prompt('請輸入房間五碼');
        if (!code) return;
        await handleDecodedText(code, '手動輸入');
      });
    }

    return reader;
  };

  const loadJsQr = () => {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (jsQrLoadPromise) return jsQrLoadPromise;
    jsQrLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${JSQR_URL}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.jsQR));
        existing.addEventListener('error', () => reject(new Error('jsQR 載入失敗')));
        return;
      }
      const script = document.createElement('script');
      script.src = JSQR_URL;
      script.async = true;
      script.onload = () => window.jsQR ? resolve(window.jsQR) : reject(new Error('jsQR 未正確初始化'));
      script.onerror = () => reject(new Error('jsQR 載入失敗'));
      document.head.appendChild(script);
    });
    return jsQrLoadPromise;
  };

  const getActiveVideo = () => {
    const reader = $(SCANNER_ID);
    return reader?.querySelector('video') || $('qr-scan-video') || document.querySelector('#qr-scan-panel video');
  };

  const handleDecodedText = async (decodedText, source = 'QR') => {
    if (!scanning && html5QrCode && source !== '手動輸入') return;
    const code = extractRoomCode(decodedText);
    if (!code) {
      setStatus(`${source} 有讀到內容，但沒有找到房間代碼：${String(decodedText || '').slice(0, 80)}`, true);
      scanning = true;
      return;
    }

    scanning = false;
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    if ($('room-code-input')) $('room-code-input').value = code;
    setStatus(`已掃到房間 ${code}，正在加入...`);
    await stopQrScanner();

    if (window.TownCheckinUI?.joinByCode) {
      await window.TownCheckinUI.joinByCode();
    } else if (window.TownCheckin?.joinRoom) {
      await window.TownCheckin.joinRoom();
    }
  };

  const detectWithJsQr = async (manual = false) => {
    const video = getActiveVideo();
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      if (manual) setStatus('相機畫面尚未準備好，請再等一秒。', true);
      return false;
    }

    let jsQR;
    try {
      jsQR = await loadJsQr();
    } catch (err) {
      if (manual) setStatus(`jsQR 載入失敗：${err?.message || err}`, true);
      return false;
    }

    const canvas = document.createElement('canvas');
    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const result = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });

    if (result?.data) {
      setStatus('jsQR 已讀到 QR，正在解析...');
      await handleDecodedText(result.data, 'jsQR');
      return true;
    }

    if (manual) setStatus('這一格畫面沒有讀到 QR，請靠近一點、避免反光，或讓 QR 佔畫面 40% 以上。', true);
    return false;
  };

  const detectWithNativeBarcode = async (manual = false) => {
    if (!('BarcodeDetector' in window)) {
      if (manual) setStatus('此瀏覽器沒有原生 QR 偵測器，改用 jsQR 畫面解碼。');
      return detectWithJsQr(manual);
    }

    const video = getActiveVideo();
    if (!video || video.readyState < 2) {
      if (manual) setStatus('相機畫面尚未準備好，請再等一秒。', true);
      return false;
    }

    try {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(video);
      if (codes?.length) {
        setStatus('原生偵測器已讀到 QR，正在解析...');
        await handleDecodedText(codes[0].rawValue || '', 'BarcodeDetector');
        return true;
      }
    } catch (err) {}

    return detectWithJsQr(manual);
  };

  const detectFromCurrentFrame = (manual = false) => detectWithNativeBarcode(manual);

  const startFallbackLoop = () => {
    if (fallbackTimer) clearInterval(fallbackTimer);
    fallbackTimer = setInterval(async () => {
      if (!scanning) return;
      await detectFromCurrentFrame(false);
      const elapsed = Math.floor((Date.now() - scanStartedAt) / 1000);
      if (elapsed > 0 && elapsed % 8 === 0) {
        setStatus('仍在掃描中。如果畫面沒反應，請讓 QR 佔畫面 40%～60%，或按「手動檢查畫面」。');
      }
    }, 900);
  };

  const stopQrScanner = async () => {
    scanning = false;
    if (fallbackTimer) clearInterval(fallbackTimer);
    fallbackTimer = null;
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
    ensureScannerBox();
    panel.style.display = 'block';
    setStatus('正在開啟相機，第一次使用時請允許相機權限。');

    try {
      loadJsQr().catch(() => {});

      html5QrCode = new Html5Qrcode(SCANNER_ID, { verbose: false });
      scanning = true;
      scanStartedAt = Date.now();
      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(200, Math.floor(minEdge * 0.78));
            return { width: size, height: size };
          },
          disableFlip: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        },
        async (decodedText) => {
          setStatus('連續掃描器已讀到 QR，正在解析...');
          await handleDecodedText(decodedText, 'html5-qrcode');
        },
        () => {}
      );
      startFallbackLoop();
      setStatus('請將 QR Code 放在畫面中央。掃不到時可按「手動檢查畫面」。');
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
    window.TownCheckinMobileQr = { start: startQrScanner, stop: stopQrScanner, extractRoomCode, detectFromCurrentFrame, detectWithJsQr };
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