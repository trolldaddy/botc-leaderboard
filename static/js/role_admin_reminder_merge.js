(() => {
  const installStyles = () => {
    if (document.getElementById('role-admin-reminder-merge-style')) return;
    const style = document.createElement('style');
    style.id = 'role-admin-reminder-merge-style';
    style.textContent = `
      .role-reminder-section.reminder-merged {
        margin-top: 1rem;
        padding: 1rem;
        border: 1px solid #39415a;
        border-radius: 16px;
        background: #11151f;
      }
      .role-reminder-section.reminder-merged .role-reminder-title {
        margin: 0 0 1rem;
        padding-bottom: .9rem;
        border-bottom: 1px solid #2f3548;
      }
      .role-reminder-section.reminder-merged .role-reminder-title h4 {
        margin: 0 0 .35rem;
        color: #fff;
        font-size: 1.05rem;
      }
      .role-reminder-section.reminder-merged .role-reminder-title p {
        margin: 0;
        color: #aeb6c9;
        line-height: 1.6;
      }
      .role-reminder-section.reminder-merged .role-reminder-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: .85rem;
      }
      .role-reminder-section.reminder-merged .role-reminder-card {
        min-width: 0;
        margin: 0;
        padding: .9rem;
        border: 1px solid #39415a;
        border-radius: 14px;
        background: #171c28;
      }
      .role-reminder-section.reminder-merged .role-reminder-head {
        margin-bottom: .75rem;
        padding-bottom: .65rem;
        border-bottom: 1px solid #30364a;
      }
      .role-reminder-section.reminder-merged .role-reminder-head strong {
        color: #ffd166;
        font-size: 1rem;
      }
      .role-reminder-section.reminder-merged .role-reminder-head span {
        color: #aeb6c9;
        font-size: .76rem;
      }
      .role-reminder-section.reminder-merged textarea.form-control {
        min-height: 88px;
      }
      .role-reminder-section.reminder-merged .role-editor-actions {
        margin-top: .75rem;
      }
      @media (max-width: 760px) {
        .role-reminder-section.reminder-merged .role-reminder-list {
          grid-template-columns: 1fr;
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
    if (!section || section.dataset.reminderMerged === '1') return;
    section.dataset.reminderMerged = '1';
    section.classList.add('reminder-merged');

    const title = section.querySelector('.role-reminder-title h4');
    if (title) title.textContent = '提示標記';
    const description = section.querySelector('.role-reminder-title p');
    if (description) description.textContent = '每一種實體標記各自一張小卡。角色若有多種標記，會在同一個提示標記模組內並列顯示。';

    const empty = section.querySelector('.role-admin-meta');
    if (empty && !section.querySelector('.role-reminder-card')) {
      empty.textContent = '目前尚未匯入此角色的提示標記。';
    }
  };

  installStyles();
  const observer = new MutationObserver(() => {
    clearTimeout(observer.timer);
    observer.timer = setTimeout(mergeReminderUi, 80);
  });

  const start = () => {
    const editor = document.getElementById('role-admin-editor');
    if (!editor) return setTimeout(start, 150);
    observer.observe(editor, { childList: true, subtree: true });
    mergeReminderUi();
  };
  start();
})();