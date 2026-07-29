(() => {
  const installStyles = () => {
    if (document.getElementById('role-admin-reminder-merge-style')) return;
    const style = document.createElement('style');
    style.id = 'role-admin-reminder-merge-style';
    style.textContent = `
      .role-reminder-section.reminder-merged {
        width: 100% !important;
        min-width: 0 !important;
        margin: 1rem 0 0 !important;
        padding: 1rem !important;
        border: 1px solid #39415a !important;
        border-radius: 14px !important;
        background: #11151f !important;
      }

      .role-reminder-section.reminder-merged .role-reminder-title {
        display: flex !important;
        justify-content: space-between !important;
        align-items: flex-start !important;
        gap: 1rem !important;
        margin: 0 0 1rem !important;
        padding: 0 0 .9rem !important;
        border-bottom: 1px solid #2f3548 !important;
      }

      .role-reminder-section.reminder-merged .role-reminder-title h4 {
        margin: 0 0 .3rem !important;
        color: #fff !important;
        font-size: 1.05rem !important;
      }

      .role-reminder-section.reminder-merged .role-reminder-title p {
        max-width: 64ch;
        margin: 0 !important;
        color: #aeb6c9 !important;
        line-height: 1.55 !important;
      }

      .role-reminder-section.reminder-merged .role-reminder-list {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)) !important;
        gap: .9rem !important;
        align-items: start !important;
      }

      .role-reminder-section.reminder-merged .role-reminder-card {
        display: flex !important;
        flex-direction: column !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 1rem !important;
        overflow: hidden !important;
        border: 1px solid #39415a !important;
        border-radius: 14px !important;
        background: #171c28 !important;
      }

      .role-reminder-section.reminder-merged .role-reminder-head {
        display: flex !important;
        justify-content: space-between !important;
        align-items: flex-start !important;
        gap: .75rem !important;
        margin: 0 0 .85rem !important;
        padding: 0 0 .75rem !important;
        border-bottom: 1px solid #30364a !important;
      }

      .role-reminder-section.reminder-merged .role-reminder-head strong {
        min-width: 0;
        color: #ffd166 !important;
        font-size: 1.05rem !important;
        overflow-wrap: anywhere;
      }

      .role-reminder-section.reminder-merged .role-reminder-meta {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: .35rem;
      }

      .role-reminder-section.reminder-merged .role-reminder-source,
      .role-reminder-section.reminder-merged .role-reminder-review {
        display: inline-flex;
        align-items: center;
        min-height: 26px;
        padding: .25rem .55rem;
        border: 1px solid #46506b;
        border-radius: 999px;
        color: #cfd5e4;
        background: #202638;
        font-size: .72rem;
        font-weight: 800;
        white-space: nowrap;
      }

      .role-reminder-section.reminder-merged .role-reminder-review {
        border-color: rgba(255, 209, 102, .35);
        color: #ffd166;
        background: rgba(255, 209, 102, .08);
      }

      .role-reminder-section.reminder-merged .role-reminder-fields {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: .7rem !important;
      }

      .role-reminder-section.reminder-merged .role-reminder-fields > div {
        min-width: 0;
      }

      .role-reminder-section.reminder-merged .role-reminder-fields label {
        display: block;
        margin: 0 0 .35rem;
        color: #d9deea;
        font-size: .78rem;
        font-weight: 800;
      }

      .role-reminder-section.reminder-merged .role-reminder-fields textarea.form-control {
        min-height: 82px !important;
        max-height: 180px;
        resize: vertical;
        line-height: 1.55;
      }

      .role-reminder-section.reminder-merged .role-reminder-footer {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        gap: .75rem !important;
        margin-top: .9rem !important;
        padding-top: .8rem !important;
        border-top: 1px solid #30364a !important;
      }

      .role-reminder-section.reminder-merged .role-reminder-source-link {
        color: #c9b8ff;
        font-size: .8rem;
        font-weight: 800;
        text-decoration: none;
      }

      .role-reminder-section.reminder-merged .role-reminder-source-link:hover {
        color: #fff;
        text-decoration: underline;
      }

      .role-reminder-section.reminder-merged .role-editor-actions {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: .6rem !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
      }

      .role-reminder-section.reminder-merged .role-editor-actions label {
        display: inline-flex;
        align-items: center;
        gap: .35rem;
        color: #cfd5e4;
        font-size: .78rem;
        white-space: nowrap;
      }

      @media (max-width: 760px) {
        .role-reminder-section.reminder-merged {
          padding: .8rem !important;
        }

        .role-reminder-section.reminder-merged .role-reminder-title,
        .role-reminder-section.reminder-merged .role-reminder-footer {
          align-items: stretch !important;
          flex-direction: column !important;
        }

        .role-reminder-section.reminder-merged .role-reminder-title .btn,
        .role-reminder-section.reminder-merged .role-editor-actions,
        .role-reminder-section.reminder-merged .role-editor-actions .btn {
          width: 100%;
        }

        .role-reminder-section.reminder-merged .role-reminder-meta {
          justify-content: flex-start;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const mergeReminderUi = () => {
    const editor = document.getElementById('role-admin-editor');
    if (!editor) return;

    const reminderBlockIds = [];
    editor.querySelectorAll('[data-content-block]').forEach((card) => {
      const typeInput = card.querySelector('[id^="rc-type-"]');
      if ((typeInput?.value || '').trim().toLowerCase() !== 'reminders') return;
      const blockId = card.getAttribute('data-content-block');
      if (blockId) reminderBlockIds.push(blockId);
      card.remove();
    });

    reminderBlockIds.forEach((blockId) => {
      editor.querySelector(`[data-display-block="${CSS.escape(blockId)}"]`)?.remove();
    });

    const section = editor.querySelector('.role-reminder-section');
    if (!section) return;
    section.classList.add('reminder-merged');

    const title = section.querySelector('.role-reminder-title h4');
    if (title) title.textContent = '提示標記';
    const description = section.querySelector('.role-reminder-title p');
    if (description) description.textContent = '以 GStone 官方鐘樓百科為準。每一種實體標記各自一張卡片。';

    const empty = section.querySelector('.role-admin-meta');
    if (empty && !section.querySelector('.role-reminder-card')) {
      empty.textContent = '目前尚未匯入此角色的提示標記。';
    }
  };

  installStyles();
  const observer = new MutationObserver(() => {
    clearTimeout(observer.timer);
    observer.timer = setTimeout(mergeReminderUi, 60);
  });

  const start = () => {
    const editor = document.getElementById('role-admin-editor');
    if (!editor) return setTimeout(start, 150);
    observer.observe(editor, { childList: true, subtree: true });
    mergeReminderUi();
  };

  start();
})();
