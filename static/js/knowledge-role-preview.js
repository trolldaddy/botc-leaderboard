(() => {
  const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const teamLabel = (team) => ({ townsfolk: '鎮民', outsider: '外來者', minion: '爪牙', demon: '惡魔', traveller: '旅行者', fabled: '傳奇角色' }[team] || team || '未分類');
  const viewLabel = (view) => ({ player: '玩家', encyclopedia: '百科', storyteller: '說書人' }[view] || view);
  const blockIcon = (type) => ({ background: 'fa-book-open', ability: 'fa-wand-sparkles', overview: 'fa-circle-info', how_it_works: 'fa-gears', rules_detail: 'fa-scale-balanced', rules_interactions: 'fa-arrows-left-right', rules_jinx: 'fa-link', examples: 'fa-lightbulb', strategy_play: 'fa-chess', strategy_bluff: 'fa-masks-theater', strategy_counter: 'fa-shield-halved', storyteller_advice: 'fa-user-tie' }[type] || 'fa-note-sticky');
  const inline = (value) => esc(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const roleViewCache = new Map();
  const roleCacheKey = (node, view) => `${node.slug || node.name}::${view}`;
  const loadRoleView = (apiBase, node, view, requireJson) => {
    const key = roleCacheKey(node, view);
    if (!roleViewCache.has(key)) {
      const promise = fetch(`${apiBase}/api/roles/${encodeURIComponent(node.name || node.slug)}?view=${encodeURIComponent(view)}`, { cache: 'no-store' })
        .then(requireJson)
        .catch((error) => { roleViewCache.delete(key); throw error; });
      roleViewCache.set(key, promise);
    }
    return roleViewCache.get(key);
  };

  function richText(content) {
    const lines = String(content || '').replace(/\r/g, '').split('\n');
    const output = [];
    let paragraph = [];
    let list = [];
    let ordered = false;
    const flushParagraph = () => { if (paragraph.length) { output.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; } };
    const flushList = () => { if (list.length) { const tag = ordered ? 'ol' : 'ul'; output.push(`<${tag}>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`); list = []; } };
    lines.forEach((raw) => {
      const line = raw.trim();
      if (!line) { flushParagraph(); flushList(); return; }
      if (line.startsWith('### ')) { flushParagraph(); flushList(); output.push(`<h4>${inline(line.slice(4))}</h4>`); return; }
      if (line.startsWith('> ')) { flushParagraph(); flushList(); output.push(`<blockquote>${inline(line.slice(2))}</blockquote>`); return; }
      const number = line.match(/^\d+\.\s+(.+)$/);
      const bullet = line.match(/^[-•]\s+(.+)$/);
      if (number || bullet) { flushParagraph(); const nextOrdered = Boolean(number); if (list.length && ordered !== nextOrdered) flushList(); ordered = nextOrdered; list.push((number || bullet)[1]); return; }
      flushList(); paragraph.push(line);
    });
    flushParagraph(); flushList();
    return output.join('') || '<p class="knowledge-result-meta">目前沒有內容。</p>';
  }

  const baseType = (block) => String(block.block_type || '').replace(/_\d+$/, '');
  function groupFor(block) {
    const source = String(block.source || '').toLowerCase();
    if (source === 'larplus' || source === 'manual') return 'larplus';
    if (['how_it_works', 'rules_detail', 'rules_interactions', 'rules_jinx'].includes(baseType(block))) return 'extended';
    return 'core';
  }
  function blockCard(block, showSourceStatus) {
    return `<article class="knowledge-block knowledge-block-structured"><div class="knowledge-block-heading"><i class="fa-solid ${blockIcon(baseType(block))}"></i><div><strong>${esc(block.title || baseType(block))}</strong>${showSourceStatus ? `<span>${esc(block.source || '資料庫')} · ${esc(block.review_status || '待確認')}</span>` : ''}</div></div><div class="knowledge-block-body">${richText(block.content)}</div></article>`;
  }
  function blockGroup(blocks, group, showSourceStatus) {
    const items = (blocks || []).filter((block) => groupFor(block) === group && !['reminders', 'source_excerpt'].includes(baseType(block)));
    return items.length ? `<div class="knowledge-block-list">${items.map((block) => blockCard(block, showSourceStatus)).join('')}</div>` : '';
  }
  function guideCards(guide) {
    if (!guide) return '';
    const fields = [['一句話定位', guide.beginner_summary, 'fa-bullseye'], ['這個角色要做什麼', guide.how_to_play, 'fa-compass'], ['開局建議', guide.first_day_advice, 'fa-sun'], ['常見誤解', guide.common_mistakes, 'fa-triangle-exclamation'], ['進階技巧', guide.advanced_tips, 'fa-arrow-trend-up'], ['角色能力補充', guide.ability_supplement, 'fa-puzzle-piece'], ['說書人建議', guide.storyteller_advice, 'fa-user-tie']].filter(([, value]) => String(value || '').trim());
    return fields.length ? `<div class="role-guide-grid">${fields.map(([title, content, icon]) => `<article class="role-guide-card"><h4><i class="fa-solid ${icon}"></i>${esc(title)}</h4><div class="knowledge-block-body">${richText(content)}</div></article>`).join('')}</div>` : '';
  }
  function reminderCards(reminders) {
    if (!(reminders || []).length) return '<div class="role-preview-empty">目前沒有提示標記資料。</div>';
    return `<div class="role-reminder-grid">${reminders.map((item) => `<article class="role-reminder-card"><div class="role-reminder-head"><i class="fa-solid fa-tag"></i><strong>${esc(item.label_zh_tw || '未命名標記')}</strong>${item.needs_review ? '<span>待確認</span>' : ''}</div>${[['放置時機', item.placement_timing], ['放置條件', item.placement_condition], ['移除時機', item.removal_timing], ['特殊說明', item.special_notes]].filter(([, value]) => String(value || '').trim()).map(([label, value]) => `<div class="role-reminder-field"><b>${esc(label)}</b><p>${esc(value)}</p></div>`).join('')}</article>`).join('')}</div>`;
  }
  function section(title, note, content) { return `<section class="role-preview-section"><div class="role-section-heading"><span>${esc(title)}</span><small>${esc(note)}</small></div>${content}</section>`; }
  function knowledgeTag(item, icon) { return `<button type="button" class="role-meta-tag" data-knowledge-tag="${esc(item)}"><i class="fa-solid ${icon}"></i>${esc(item)}</button>`; }

  async function render(options) {
    const { apiBase, node, detail, view = 'encyclopedia', requireJson, onFallback, preserveShell = false } = options;
    if (!preserveShell) {
      detail.className = '';
      detail.innerHTML = '<div class="role-preview-loading"><div class="role-skeleton role-skeleton-icon"></div><div><div class="role-skeleton role-skeleton-title"></div><div class="role-skeleton role-skeleton-line"></div></div></div>';
    } else {
      detail.querySelector('.role-view-content')?.setAttribute('aria-busy', 'true');
    }
    try {
      const requestToken = `${roleCacheKey(node, view)}::${Date.now()}`;
      detail.dataset.roleViewRequest = requestToken;
      const role = await loadRoleView(apiBase, node, view, requireJson);
      if (detail.dataset.roleViewRequest !== requestToken) return;
      const blocks = role.content_blocks || [];
      const modules = role.display_modules || {};
      const visible = (key) => modules[key] !== false;
      const showSourceStatus = visible('source_status');
      const nightSection = visible('night_operation') ? section('夜間操作', '只在說書人視角顯示', `<div class="role-night-grid"><article><b>首夜順序</b><strong>${esc(role.first_night_order ?? '未設定')}</strong><p>${esc(role.first_night_reminder || '無首夜提醒')}</p></article><article><b>其他夜順序</b><strong>${esc(role.other_night_order ?? '未設定')}</strong><p>${esc(role.other_night_reminder || '無其他夜提醒')}</p></article></div>`) : '';
      const reminderSection = visible('reminders') ? section('提示標記', '以 GStone 百科資料為準', reminderCards(role.reminders)) : '';
      const hero = visible('identity') ? `<article class="role-hero role-team-${esc(role.team || 'unknown')}"><div class="role-hero-icon">${role.image_url ? `<img src="${esc(role.image_url)}" alt="${esc(role.name_zh_tw)}角色圖示">` : '<i class="fa-solid fa-masks-theater"></i>'}</div><div class="role-hero-copy"><div class="role-eyebrow">${esc(teamLabel(role.team))}${role.is_official ? ' · 官方角色' : ''}</div><h2>${esc(role.name_zh_tw)}</h2>${visible('role_metadata') ? `<div class="knowledge-name-en">${esc(role.name_en || role.canonical_key || '')}</div><div class="role-meta-row">${(role.script_names || []).map((item) => knowledgeTag(item, 'fa-book')).join('')}${(role.ability_tags || []).map((item) => knowledgeTag(item, 'fa-diagram-project')).join('')}</div>` : ''}</div>${visible('references') ? `<div class="role-hero-links">${(role.references || []).map((ref) => `<a href="${esc(ref.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i>${esc(ref.label)}</a>`).join('')}</div>` : ''}</article>` : '';
      const ability = visible('official_ability') ? `<section class="role-ability-panel"><div><i class="fa-solid fa-wand-sparkles"></i><span>官方能力</span></div><p>${esc(role.ability_zh_tw || '尚未填入官方能力文字。')}</p></section>` : '';
      const coreBlocks = blockGroup(blocks, 'core', showSourceStatus);
      const extendedBlocks = blockGroup(blocks, 'extended', showSourceStatus);
      const larplusBlocks = blockGroup(blocks, 'larplus', showSourceStatus);
      const contentSections = `${coreBlocks ? section('角色內容', '角色背景、簡介、範例與策略', coreBlocks) : ''}${extendedBlocks ? section('延伸資料', '運作方式、規則細節、互動與相剋', extendedBlocks) : ''}${larplusBlocks ? section('拉普拉斯資料', '店內教學、補充與裁定', larplusBlocks) : ''}`;
      const viewContent = `${ability}${visible('guide') ? guideCards(role.guide) : ''}${blocks.length ? contentSections : ''}${nightSection}${reminderSection}`;
      if (preserveShell) {
        const content = detail.querySelector('.role-view-content');
        if (content) { content.innerHTML = viewContent; content.removeAttribute('aria-busy'); }
        detail.querySelectorAll('[data-role-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.roleView === role.view));
        return;
      }
      detail.className = 'role-preview';
      detail.innerHTML = `${hero}<nav class="role-view-tabs" aria-label="${'\u89d2\u8272\u9810\u89bd\u8996\u89d2'}">${['player', 'encyclopedia', 'storyteller'].map((item) => `<button type="button" data-role-view="${item}" class="${role.view === item ? 'is-active' : ''}">${viewLabel(item)}</button>`).join('')}</nav><div class="role-view-content">${viewContent}</div>`;
      detail.querySelectorAll('[data-role-view]').forEach((button) => button.addEventListener('click', () => {
        if (button.classList.contains('is-active')) return;
        render({ ...options, view: button.dataset.roleView, preserveShell: true });
      }));
      detail.querySelectorAll('[data-knowledge-tag]').forEach((button) => button.addEventListener('click', () => options.onNavigate?.(button.dataset.knowledgeTag)));
      ['player', 'encyclopedia', 'storyteller'].filter((item) => item !== role.view).forEach((item) => {
        loadRoleView(apiBase, node, item, requireJson).catch(() => {});
      });
    } catch (err) {
      detail.querySelector('.role-view-content')?.removeAttribute('aria-busy');
      if (!preserveShell) onFallback(err);
      else console.error(err);
    }
  }
  window.RoleKnowledgePreview = { render };
})();