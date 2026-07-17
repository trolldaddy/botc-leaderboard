(() => {
  const $ = (selector) => document.querySelector(selector);
  let observer = null;
  let scheduled = false;

  const ensureStyles = () => {
    if ($('#rooms-mobile-player-list-style')) return;
    const style = document.createElement('style');
    style.id = 'rooms-mobile-player-list-style';
    style.textContent = `
      .mobile-player-meta,
      .mobile-player-stats {
        display: none;
      }

      @media (max-width: 640px) {
        .room-members-card .table-scroll {
          overflow-x: visible;
        }

        .room-members-card .town-table,
        .room-members-card .town-table tbody,
        .room-members-card .town-table tr,
        .room-members-card .town-table td {
          display: block;
          width: 100%;
          box-sizing: border-box;
        }

        .room-members-card .town-table thead {
          display: none;
        }

        .room-members-card .town-table tr {
          display: grid;
          grid-template-columns: minmax(82px, 108px) minmax(0, 1fr);
          gap: .75rem;
          align-items: start;
          border: 1px solid rgba(255,255,255,.09);
          background: rgba(255,255,255,.035);
          border-radius: 18px;
          padding: .85rem;
          margin-bottom: .75rem;
        }

        .room-members-card .town-table tr:has(.empty-row) {
          display: block;
          padding: 0;
          border: 0;
          background: transparent;
        }

        .room-members-card .town-table td {
          border-bottom: 0;
          padding: 0;
          text-align: left;
        }

        .room-members-card .town-table td:first-child {
          position: static !important;
          left: auto !important;
          z-index: auto !important;
          background: transparent !important;
          grid-column: 1;
          grid-row: 1 / span 2;
        }

        .room-members-card .town-table td:nth-child(2) {
          grid-column: 2;
          grid-row: 1;
          min-width: 0;
        }

        .room-members-card .town-table td:nth-child(3),
        .room-members-card .town-table td:nth-child(4),
        .room-members-card .town-table td:nth-child(5) {
          display: none;
        }

        .room-members-card .town-table td:first-child::before {
          content: '座號';
          display: block;
          color: var(--accent-gold);
          font-size: .72rem;
          font-weight: 900;
          letter-spacing: .12em;
          margin-bottom: .4rem;
        }

        .room-members-card .town-table td:nth-child(2) input {
          width: 100% !important;
          max-width: 100% !important;
          font-size: 1.05rem;
          font-weight: 850;
        }

        .room-members-card .town-table select[data-seat-selector="true"] {
          width: 100%;
          min-width: 82px;
          max-width: 108px;
          min-height: 52px;
          font-size: 1.05rem;
          font-weight: 900;
          text-align: center;
        }

        .room-members-card .player-avatar {
          width: 36px;
          height: 36px;
          margin-right: .45rem;
        }

        .mobile-player-meta,
        .mobile-player-stats {
          display: flex;
          flex-wrap: wrap;
          gap: .35rem;
          margin-top: .45rem;
        }

        .mobile-player-pill {
          display: inline-flex;
          align-items: center;
          gap: .28rem;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(255,255,255,.065);
          border-radius: 999px;
          padding: .24rem .52rem;
          color: rgba(255,255,255,.78);
          font-size: .76rem;
          line-height: 1.2;
          white-space: nowrap;
        }

        .mobile-player-pill.line {
          color: #7CFF8A;
          background: rgba(0,185,0,.12);
          border-color: rgba(124,255,138,.2);
        }

        .mobile-player-pill.temp {
          color: #ffd36b;
          background: rgba(255,183,3,.12);
          border-color: rgba(255,183,3,.2);
        }

        .mobile-player-pill.record {
          color: #c4b5fd;
          background: rgba(124,58,237,.12);
          border-color: rgba(196,181,253,.18);
        }

        .mobile-player-stats {
          color: var(--text-muted);
          font-size: .78rem;
          line-height: 1.45;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const getCellText = (row, index) => String(row.children[index]?.textContent || '').trim();

  const annotateRows = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody || tbody.dataset.mobilePatchBusy === '1') return;
    ensureStyles();

    tbody.dataset.mobilePatchBusy = '1';
    if (observer) observer.disconnect();

    try {
      Array.from(tbody.querySelectorAll('tr')).forEach((row) => {
        if (row.querySelector('.empty-row')) return;
        const nameCell = row.children[1];
        if (!nameCell) return;

        row.querySelectorAll('.mobile-player-meta, .mobile-player-stats').forEach((el) => el.remove());

        const sourceText = getCellText(row, 2) || '玩家';
        const lineText = getCellText(row, 3) || '';
        const nameInput = nameCell.querySelector('input');
        const displayName = nameInput ? nameInput.value : getCellText(row, 1);
        const isLine = sourceText.includes('LINE');
        const isTemp = sourceText.includes('臨時');
        const hasRecordName = displayName && !isTemp && lineText.includes('已綁定');

        const meta = document.createElement('div');
        meta.className = 'mobile-player-meta';
        meta.innerHTML = `
          <span class="mobile-player-pill ${isLine ? 'line' : isTemp ? 'temp' : ''}">
            <i class="${isLine ? 'fa-brands fa-line' : 'fa-solid fa-user-clock'}"></i>
            ${sourceText}
          </span>
          <span class="mobile-player-pill ${lineText.includes('已綁定') ? 'line' : ''}">
            <i class="fa-solid fa-link"></i>
            ${lineText || '未綁定'}
          </span>
          ${hasRecordName ? `<span class="mobile-player-pill record"><i class="fa-solid fa-chart-simple"></i> 戰績已綁定</span>` : ''}
        `;

        const stats = document.createElement('div');
        stats.className = 'mobile-player-stats';
        stats.textContent = '勝率資料待接入：善良% / 邪惡%';
        stats.style.display = 'none';

        nameCell.appendChild(meta);
        nameCell.appendChild(stats);
      });
    } finally {
      tbody.dataset.mobilePatchBusy = '0';
      if (observer) observer.observe(tbody, { childList: true, subtree: false });
    }
  };

  const scheduleAnnotate = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      annotateRows();
    });
  };

  const install = () => {
    const tbody = document.getElementById('room-players-body');
    if (!tbody) return false;
    if (!observer) {
      observer = new MutationObserver(scheduleAnnotate);
      observer.observe(tbody, { childList: true, subtree: false });
    }
    annotateRows();
    window.TownCheckinMobilePlayerList = { refresh: annotateRows };
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
