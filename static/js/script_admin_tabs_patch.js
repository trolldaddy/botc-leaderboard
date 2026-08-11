(() => {
  const detail = document.getElementById('script-admin-detail');
  if (!detail) return;

  const activate = (name) => {
    detail.querySelectorAll('[data-script-admin-tab]').forEach((button) => {
      const active = button.dataset.scriptAdminTab === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    detail.querySelectorAll('[data-script-admin-pane]').forEach((pane) => {
      pane.hidden = pane.dataset.scriptAdminPane !== name;
    });
  };

  const enhance = () => {
    const header = detail.querySelector('.article-admin-head');
    const meta = detail.querySelector('.script-admin-meta');
    const imageEditor = detail.querySelector('.script-image-editor');
    const copy = detail.querySelector('.script-admin-copy');
    const primaryActions = detail.querySelector('.script-admin-primary-actions');
    if (!header || !meta || !imageEditor || !copy || !primaryActions || header.dataset.scriptTabsReady === 'true') return;
    header.dataset.scriptTabsReady = 'true';

    const publicLink = header.querySelector('a[href*="#scripts/"]');
    const headerActions = document.createElement('div');
    headerActions.className = 'script-admin-head-actions';
    if (publicLink) headerActions.appendChild(publicLink);
    [...primaryActions.children].forEach((button) => headerActions.appendChild(button));
    header.appendChild(headerActions);
    primaryActions.remove();

    const tabs = document.createElement('nav');
    tabs.className = 'script-admin-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '劇本編輯內容');
    tabs.innerHTML = `
      <button type="button" class="active" role="tab" aria-selected="true" data-script-admin-tab="intro">劇本介紹</button>
      <button type="button" role="tab" aria-selected="false" data-script-admin-tab="roster">角色構成</button>
      <button type="button" role="tab" aria-selected="false" data-script-admin-tab="guide">拉普拉斯攻略</button>`;

    const intro = document.createElement('section');
    intro.className = 'script-admin-pane';
    intro.dataset.scriptAdminPane = 'intro';
    const roster = document.createElement('section');
    roster.className = 'script-admin-pane';
    roster.dataset.scriptAdminPane = 'roster';
    const guide = document.createElement('section');
    guide.className = 'script-admin-pane';
    guide.dataset.scriptAdminPane = 'guide';

    meta.insertAdjacentElement('afterend', tabs);
    tabs.insertAdjacentElement('afterend', guide);
    guide.insertAdjacentElement('afterend', roster);
    roster.insertAdjacentElement('afterend', intro);

    intro.append(imageEditor, copy);
    ['sam-player-guide', 'sam-storyteller-guide'].forEach((id) => {
      const label = document.getElementById(id)?.closest('.script-admin-field');
      if (label) guide.appendChild(label);
    });

    const jsonImport = detail.querySelector('.script-json-import');
    if (jsonImport) roster.appendChild(jsonImport);
    const roleSummary = detail.querySelector('.script-role-summary');
    const officialTitle = roleSummary?.previousElementSibling;
    if (officialTitle?.tagName === 'H4') roster.appendChild(officialTitle);
    if (roleSummary) roster.appendChild(roleSummary);
    const customTitle = [...detail.querySelectorAll('.script-custom-title')].find((item) => !item.closest('.script-image-editor'));
    const customList = document.getElementById('script-custom-list');
    if (customTitle) roster.appendChild(customTitle);
    if (customList) roster.appendChild(customList);

    tabs.querySelectorAll('[data-script-admin-tab]').forEach((button) => {
      button.addEventListener('click', () => activate(button.dataset.scriptAdminTab));
    });
    activate('intro');
  };

  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  observer.observe(detail, { childList: true, subtree: true });
  enhance();
})();
