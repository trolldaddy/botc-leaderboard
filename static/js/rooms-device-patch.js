(() => {
  const DEVICE_TOKEN_KEY = 'botc_town_checkin_device_token';

  const getDeviceToken = () => {
    try {
      let token = localStorage.getItem(DEVICE_TOKEN_KEY);
      if (!token) {
        const randomPart = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        token = `device_${randomPart}`;
        localStorage.setItem(DEVICE_TOKEN_KEY, token);
      }
      return token;
    } catch (err) {
      return `volatile_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  };

  const install = () => {
    if (window.__botcRoomDeviceFetchPatched) return;
    const originalFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        const method = String(init?.method || 'GET').toUpperCase();
        const isRoomJoin = method === 'POST' && /\/api\/rooms\/[^/]+\/join(?:\?|$)/.test(url);
        if (isRoomJoin) {
          const headers = new Headers(init.headers || {});
          const contentType = headers.get('Content-Type') || headers.get('content-type') || '';
          if (contentType.includes('application/json') && typeof init.body === 'string') {
            const payload = JSON.parse(init.body || '{}');
            payload.device_token = payload.device_token || getDeviceToken();
            init = {
              ...init,
              headers,
              body: JSON.stringify(payload),
            };
          }
        }
      } catch (err) {
        console.warn('裝置識別碼加入失敗，將照原流程送出', err);
      }
      return originalFetch(input, init);
    };
    window.__botcRoomDeviceFetchPatched = true;
  };

  install();
})();
