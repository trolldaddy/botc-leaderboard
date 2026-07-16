(() => {
  const MAX_SEAT = 20;
  let observer = null;
  let scheduled = false;
  let installed = false;

  const parseUpdateSeatCall = (value) => {
    const match = String(value || '').match(/TownCheckin\.updateSeat\('([^']+)'/);
    return match ? match[1] : null;
  };

  const collectUsedSeats = (tbody, currentSelect) => {
    const used = new Set();
    tbody.querySelectorAll('select[data-seat-selector="true"]').forEach((select) => {
      if (select === currentSelect) return;
      const value = Number(select.value || 0);
      if (value) used.add(value);
    });
    tbody.querySelectorAll('td:first-child input[type="number"]').forEach((input) => {
      const value = Number(input.value || 0);
      if (value) used.add(value);
    });
    return used;
  };

  const buildOptions = (select, currentValue, tbody) => {
    const used = collectUsedSeats(tbody, select);
    const desired = [];
    desired.push({ value: '', text: '未分配', disabled: false });
    for (let i = 1; i <= MAX_SEAT; i += 1) {
      const disabled = used.has(i) && Number(currentValue) !== i;
      desired.push({
        value: String(i),
        text: `${i}號${disabled ? '（已使用）' : ''}`,
        disabled
      });
    }

    const currentSignature = select.dataset.optionSignature || '';
    const nextSignature = JSON.stringify(desired);
    if (currentSignature !== nextSignature) {
      select.innerHTML = '';
      desired.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.text;
        option.disabled = item.disabled;
        select.appendChild(option);
      });
      select.dataset.optionSignature = nextSignature;
    }

    select.value = currentValue ? String(currentValue) : '';
  };

  const refreshAllSeatOptions = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody) return;
    tbody.querySelectorAll('select[data-seat-selector="true"]').forEach((select) => {
      const currentValue = select.value;
      buildOptions(select, currentValue, tbody);
    });
  };

  const replaceSeatInputs = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody || tbody.dataset.seatPatchBusy === '1') return;

    tbody.dataset.seatPatchBusy = '1';
    if (observer) observer.disconnect();
    try {
      tbody.querySelectorAll('td:first-child input[type="number"]').forEach((input) => {
        const onchange = input.getAttribute('onchange') || '';
        const playerId = parseUpdateSeatCall(onchange);
        if (!playerId) return;

        const currentValue = input.value || '';
        const select = document.createElement('select');
        select.className = input.className || 'form-control dark-input';
        select.dataset.seatSelector = 'true';
        select.dataset.playerId = playerId;
        buildOptions(select, currentValue, tbody);
        select.addEventListener('change', () => {
          window.TownCheckin?.updateSeat(playerId, select.value);
          window.setTimeout(refreshAllSeatOptions, 0);
        });
        input.replaceWith(select);
      });
      refreshAllSeatOptions();
    } finally {
      tbody.dataset.seatPatchBusy = '0';
      if (observer) observer.observe(tbody, { childList: true });
    }
  };

  const scheduleReplace = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      replaceSeatInputs();
    });
  };

  const install = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody) return false;
    if (installed) return true;
    installed = true;
    observer = new MutationObserver(scheduleReplace);
    observer.observe(tbody, { childList: true });
    replaceSeatInputs();
    window.TownCheckinSeatPatch = { refresh: replaceSeatInputs };
    return true;
  };

  if (!install()) {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (install() || tries > 30) window.clearInterval(timer);
    }, 100);
  }
})();