(() => {
  const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const teamLabel = (team) => ({ townsfolk: '鎮民', outsider: '外來者', minion: '爪牙', demon: '惡魔', traveller: '旅行者', fabled: '傳奇角色', loric: '奇遇角色' }[team] || team || '未分類');
  const viewLabel = (view) => ({ player: '玩家', encyclopedia: '百科', storyteller: '說書人' }[view] || view);
  const blockIcon = (type) => ({ background: 'fa-book-open', ability: 'fa-wand-sparkles', overview: 'fa-circle-info', how_it_works: 'fa-gears', rules_detail: 'fa-scale-balanced', rules_interactions: 'fa-arrows-left-right', rules_jinx: 'fa-link', examples: 'fa-lightbulb', strategy_play: 'fa-chess', strategy_bluff: 'fa-masks-theater', strategy_counter: 'fa-shield-halved', storyteller_advice: 'fa-user-tie' }[type] || 'fa-note-sticky');
  const inline = (value) => esc(value)
    .replace(/\[size=(sm|md|lg|xl)\]([\s\S]*?)\[\/size\]/g, '<span class="rich-size-$1">$2</span>')
    .replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<strong>$1</strong>')
    .replace(/\[i\]([\s\S]*?)\[\/i\]/g, '<em>$1</em>')
    .replace(/\[url=(https?:\/\/[^\]\s]+)\]([\s\S]*?)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
    .replace(/\[color=#[0-9a-fA-F]{6}\]|\[\/color\]/g, '');

  const roleViewCache = new Map();
  let roleMentionTargetsPromise = null;
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
  const loadRoleMentionTargets = (apiBase, requireJson) => {
    if (!roleMentionTargetsPromise) {
      roleMentionTargetsPromise = fetch(`${apiBase}/api/roles?limit=500`, { cache: 'no-store' })
        .then(requireJson)
        .then((payload) => (payload.items || []).flatMap((item) => {
          const target = String(item.name_zh_tw || '').trim();
          const canonicalLabel = ({ '卡紮力': '卡札力', '卡扎力': '卡札力', '映像雙子': '鏡像雙子', '映像双子': '鏡像雙子', '镜像双子': '鏡像雙子' })[target] || target;
          if (canonicalLabel.length < 2 && canonicalLabel !== '限') return [];
          const fallbackAliases = ({
            '檮杌': ['梼杌'],
            '鴆': ['鸩'],
            '卡札力': ['卡紮力', '卡扎力'],
            '鏡像雙子': ['映像雙子', '映像双子', '镜像双子'],
          })[canonicalLabel] || [];
          return [canonicalLabel, ...(item.mention_aliases || []), ...fallbackAliases]
            .map((label) => String(label || '').trim())
            .filter((label) => label.length >= 2 || label === '限')
            .map((label) => ({
              label,
              displayLabel: canonicalLabel,
              target: item.knowledge_slug || canonicalLabel,
              team: String(item.team || 'unknown').toLowerCase(),
              imageUrl: String(item.image_url || '').trim(),
            }));
        }).sort((a, b) => b.label.length - a.label.length))
        .catch((error) => { roleMentionTargetsPromise = null; throw error; });
    }
    return roleMentionTargetsPromise;
  };
  const mentionTone = (team) => {
    if (['townsfolk', 'outsider'].includes(team)) return 'good';
    if (['minion', 'demon'].includes(team)) return 'evil';
    if (team === 'traveller') return 'traveller';
    if (['loric', 'adventure', 'special'].includes(team)) return 'loric';
    if (team === 'fabled') return 'fabled';
    return 'article';
  };

  const uniqueMentionTargets = (targets) => {
    const seen = new Set();
    return targets.filter((item) => {
      const key = `${item.label}::${item.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => b.label.length - a.label.length);
  };
  const singleCharacterBoundaries = /[\s，。、「」『』（）()【】：；！？、]/;
  const isValidMentionAt = (text, index, label) => {
    if (label.length > 1) return true;
    const before = index > 0 ? text[index - 1] : '';
    const after = index + label.length < text.length ? text[index + label.length] : '';
    return (!before || singleCharacterBoundaries.test(before))
      && (!after || singleCharacterBoundaries.test(after));
  };
  const nextValidMentionIndex = (text, label, start) => {
    let index = text.indexOf(label, start);
    while (index >= 0 && !isValidMentionAt(text, index, label)) index = text.indexOf(label, index + label.length);
    return index;
  };
  function replaceInlineMentions(root, targets, currentRole, currentNode, onNavigate) {
    if (!root || !targets.length || typeof onNavigate !== 'function') return;
    const currentNames = new Set([
      currentRole.name_zh_tw, currentRole.name_en, currentRole.canonical_key, currentNode.name, currentNode.slug,
    ].filter(Boolean).map((value) => String(value).trim()));
    const candidates = uniqueMentionTargets(targets)
      .filter((item) => !currentNames.has(item.label) && !currentNames.has(item.target));
    if (!candidates.length) return;

    const nodeFilter = root.ownerDocument.defaultView.NodeFilter;
    root.querySelectorAll('.role-ability-panel p, .knowledge-block-body, .role-reminder-field p, .role-night-grid p').forEach((body) => {
      const walker = root.ownerDocument.createTreeWalker(body, nodeFilter.SHOW_TEXT, {
        acceptNode(textNode) {
          if (!String(textNode.nodeValue || '').trim()) return nodeFilter.FILTER_REJECT;
          const parent = textNode.parentElement;
          if (!parent || parent.closest('a, button, .role-mention-chip')) return nodeFilter.FILTER_REJECT;
          return candidates.some((item) => textNode.nodeValue.includes(item.label))
            ? nodeFilter.FILTER_ACCEPT : nodeFilter.FILTER_REJECT;
        },
      });
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach((textNode) => {
        const textValue = textNode.nodeValue;
        const fragment = root.ownerDocument.createDocumentFragment();
        let cursor = 0;
        let changed = false;
        while (cursor < textValue.length) {
          let match = null;
          candidates.forEach((item) => {
            const index = nextValidMentionIndex(textValue, item.label, cursor);
            if (index < 0) return;
            if (!match || index < match.index || (index === match.index && item.label.length > match.item.label.length)) match = { index, item };
          });
          if (!match) break;
          if (match.index > cursor) fragment.append(textValue.slice(cursor, match.index));
          const button = root.ownerDocument.createElement('button');
          button.type = 'button';
          button.className = `role-mention-chip role-mention-inline role-mention-${mentionTone(match.item.team)}`;


          button.append(match.item.displayLabel || match.item.label);
          button.title = `查看「${match.item.label}」資料`;
          button.addEventListener('click', () => onNavigate(match.item.target));
          fragment.append(button);
          cursor = match.index + match.item.label.length;
          changed = true;
        }
        if (!changed) return;
        if (cursor < textValue.length) fragment.append(textValue.slice(cursor));
        textNode.replaceWith(fragment);
      });
    });
  }
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
      const taggedQuote = line.match(/^\[quote\]([\s\S]*)\[\/quote\]$/);
      if (taggedQuote) { flushParagraph(); flushList(); output.push(`<blockquote>${inline(taggedQuote[1])}</blockquote>`); return; }
      const taggedNumber = line.match(/^\[number\]([\s\S]*)\[\/number\]$/);
      const taggedBullet = line.match(/^\[bullet\]([\s\S]*)\[\/bullet\]$/);
      if (taggedNumber || taggedBullet) {
        flushParagraph();
        const nextOrdered = Boolean(taggedNumber);
        if (list.length && ordered !== nextOrdered) flushList();
        ordered = nextOrdered;
        list.push((taggedNumber || taggedBullet)[1]);
        return;
      }
      const heading = line.match(/^(#{2,4})\s+(.+)$/);
      if (heading) { flushParagraph(); flushList(); const tag = ({ 2:'h3', 3:'h4', 4:'h5' })[heading[1].length]; output.push(`<${tag}>${inline(heading[2])}</${tag}>`); return; }
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
      const ability = visible('official_ability') ? `<section class="role-ability-panel"><div><i class="fa-solid fa-wand-sparkles"></i><span>官方能力</span></div><div class="knowledge-block-body">${richText(role.ability_zh_tw || '尚未填入官方能力文字。')}</div></section>` : '';
      const coreBlocks = blockGroup(blocks, 'core', showSourceStatus);
      const extendedBlocks = blockGroup(blocks, 'extended', showSourceStatus);
      const larplusBlocks = blockGroup(blocks, 'larplus', showSourceStatus);
      const contentSections = `${coreBlocks ? section('角色內容', '角色背景、簡介、範例與策略', coreBlocks) : ''}${extendedBlocks ? section('延伸資料', '運作方式、規則細節、互動與相剋', extendedBlocks) : ''}${larplusBlocks ? section('拉普拉斯資料', '店內教學、補充與裁定', larplusBlocks) : ''}`;
      const viewContent = `${ability}${visible('guide') ? guideCards(role.guide) : ''}${blocks.length ? contentSections : ''}${nightSection}${reminderSection}`;      const applyRoleMentionLinks = (root) => {
        loadRoleMentionTargets(apiBase, requireJson)
          .then((targets) => replaceInlineMentions(root, targets, role, node, options.onNavigate))
          .catch((error) => console.warn('角色提及連結載入失敗', error));
      };
      if (preserveShell) {
        const content = detail.querySelector('.role-view-content');
        if (content) { content.innerHTML = viewContent; content.removeAttribute('aria-busy'); applyRoleMentionLinks(content); }
        detail.querySelectorAll('[data-role-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.roleView === role.view));
        return;
      }
      detail.className = 'role-preview';
      detail.innerHTML = `${hero}<nav class="role-view-tabs" aria-label="${'\u89d2\u8272\u9810\u89bd\u8996\u89d2'}">${['player', 'encyclopedia', 'storyteller'].map((item) => `<button type="button" data-role-view="${item}" class="${role.view === item ? 'is-active' : ''}">${viewLabel(item)}</button>`).join('')}</nav><div class="role-view-content">${viewContent}</div>`;
      applyRoleMentionLinks(detail.querySelector('.role-view-content'));
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
  async function linkRoleMentions(options = {}) {
    const { root, apiBase = '', requireJson, currentRole = {}, currentNode = {}, onNavigate, isCurrent } = options;
    if (!root || typeof requireJson !== 'function') return;
    const targets = await loadRoleMentionTargets(apiBase, requireJson);
    if (typeof isCurrent === 'function' && !isCurrent()) return;
    replaceInlineMentions(root, targets, currentRole, currentNode, onNavigate);
  }

  window.RoleKnowledgePreview = { render, linkRoleMentions };
})();