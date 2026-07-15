(() => {
  const MAX_SEAT = 20;

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
    select.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '未分配';
    select.appendChild(empty);

    for (let i = 1; i <= MAX_SEAT; i += 1) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = `${i}號`;
      if (used.has(i) && Number(currentValue) !== i) {
        option.disabled = true;
        option.textContent += '（已使用）';
      }
      select.appendChild(option);
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
          setTimeout(refreshAllSeatOptions, 0);
        });
        input.replaceWith(select);
      });
      refreshAllSeatOptions();
    } finally {
      tbody.dataset.seatPatchBusy = '0';
    }
  };

  const install = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody) return false;
    replaceSeatInputs();
    const observer = new MutationObserver(() => replaceSeatInputs());
    observer.observe(tbody, { childList: true, subtree: true });
    window.TownCheckinSeatPatch = { refresh: replaceSeatInputs };
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
