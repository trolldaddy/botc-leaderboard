(() => {
  const input = document.getElementById('room-script');
  const datalist = document.getElementById('room-script-options');
  const status = document.getElementById('room-script-picker-status');
  if (!input || !datalist) return;

  const setStatus = (message, isError = false) => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  };

  const loadScripts = async () => {
    try {
      const response = await fetch(`${window.API_BASE || ''}/api/scripts`, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const seen = new Set();
      datalist.innerHTML = '';

      items.forEach((script) => {
        const name = String(script.name_zh_tw || '').trim();
        if (!name || seen.has(name)) return;
        seen.add(name);

        const option = document.createElement('option');
        option.value = name;
        const meta = [script.category, script.author_name].filter(Boolean).join('｜');
        if (meta) option.label = meta;
        datalist.appendChild(option);
      });

      setStatus(seen.size
        ? `可從 ${seen.size} 套公開劇本中選擇，也可手動輸入。`
        : '目前沒有公開劇本，可手動輸入名稱。');
    } catch (error) {
      console.warn('房間劇本清單載入失敗', error);
      setStatus('劇本清單暫時無法載入，仍可手動輸入名稱。', true);
    }
  };

  loadScripts();
})();