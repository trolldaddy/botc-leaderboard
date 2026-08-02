(() => {
  const apiBase = window.API_BASE || '';
  const state = { items: [], activeSlug: null, types: [], resultStatus: 'idle', expandedRelationGroups: new Set(), expandedSourceBlocks: new Set(), nodeRequestId: 0, roleCatalogPromise: null };
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const typeLabel = (type) => ({ role: '角色', script: '劇本', guide: '指南', mechanic: '規則／機制', article: '文章' }[type] || type || '其他');
  const teamLabel = (team) => ({ townsfolk: '鎮民', outsider: '外來者', minion: '爪牙', demon: '惡魔', traveller: '旅行者', fabled: '傳奇角色', loric: '奇遇角色' }[team] || '');
  const blockLabel = (type) => ({ background: '背景故事', ability: '角色能力', overview: '角色簡介', how_it_works: '運作方式', rules_detail: '規則細節', rules_interactions: '角色互動', rules_jinx: '相剋規則', reminders: '提示標記', examples: '範例', strategy_play: '如何遊玩', strategy_bluff: '如何偽裝', strategy_counter: '如何對抗', storyteller_advice: '說書人建議', source_excerpt: '原始來源節錄' }[type] || typeLabel(type));
  const blockIcon = (type) => ({ background: 'fa-book-open', ability: 'fa-wand-sparkles', overview: 'fa-circle-info', how_it_works: 'fa-gears', rules_detail: 'fa-scale-balanced', rules_interactions: 'fa-arrows-left-right', rules_jinx: 'fa-link', reminders: 'fa-tag', examples: 'fa-lightbulb', strategy_play: 'fa-chess', strategy_bluff: 'fa-masks-theater', strategy_counter: 'fa-shield-halved', storyteller_advice: 'fa-user-tie', source_excerpt: 'fa-box-archive' }[type] || 'fa-note-sticky');
  const relationGroupOrder = ['mechanic', 'article'];

  async function requireJson(resp) {
    let data = null;
    try { data = await resp.json(); } catch (err) {}
    if (!resp.ok) throw new Error(data?.detail || `讀取失敗 (${resp.status})`);
    return data;
  }

  function renderTypes() {
    const select = $('knowledge-type-filter');
    if (!select) return;
    select.innerHTML = '<option value="">全部類型</option>' + state.types
      .map((item) => `<option value="${escapeHtml(item.node_type)}">${escapeHtml(typeLabel(item.node_type))}${item.node_type === 'role' ? '' : `（${item.count}）`}</option>`)
      .join('');
  }

  function renderResults() {
    const container = $('knowledge-results');
    if (!container) return;
    if (!state.items.length) {
      const messages = {
        idle: '<i class="fa-solid fa-magnifying-glass"></i>輸入名稱、英文名或別名，或選擇內容／角色分類開始瀏覽。',
        loading: '<i class="fa-solid fa-spinner fa-spin"></i>正在整理搜尋結果...',
        error: '<i class="fa-solid fa-triangle-exclamation"></i>搜尋暫時無法使用，請稍後再試。',
        ready: '<i class="fa-solid fa-circle-info"></i>沒有找到符合條件的條目。',
      };
      container.innerHTML = `<div class="knowledge-empty">${messages[state.resultStatus] || messages.ready}</div>`;
      return;
    }
    container.innerHTML = state.items.map((item) => `
      <button class="knowledge-result ${state.activeSlug === item.slug ? 'is-active' : ''}" type="button" data-knowledge-slug="${escapeHtml(item.slug)}">
        <div class="knowledge-result-title">${escapeHtml(item.name)}</div>
        <div class="knowledge-result-meta"><span class="knowledge-type-chip">${escapeHtml(item.team ? teamLabel(item.team) : typeLabel(item.node_type))}</span>${escapeHtml(item.name_en || item.name_zh_cn || item.slug)}</div>
      </button>
    `).join('');
    container.querySelectorAll('[data-knowledge-slug]').forEach((button) => button.addEventListener('click', () => loadNode(button.dataset.knowledgeSlug, { focusDetail: true })));
  }

  function sortedUniqueItems(items, query) {
    const seen = new Set();
    const keyword = String(query || '').toLocaleLowerCase('zh-Hant');
    return (items || []).filter((item) => {
      if (!item.slug || seen.has(item.slug)) return false;
      seen.add(item.slug);
      return true;
    }).sort((a, b) => {
      const score = (item) => {
        if (!keyword) return 3;
        const names = [item.name, item.name_en, item.name_zh_cn, item.slug].filter(Boolean).map((value) => String(value).toLocaleLowerCase('zh-Hant'));
        if (names.some((value) => value === keyword)) return 0;
        if (names.some((value) => value.startsWith(keyword))) return 1;
        if (names.some((value) => value.includes(keyword))) return 2;
        return 3;
      };
      return score(a) - score(b)
        || (a.node_type === 'role' ? -1 : 0) - (b.node_type === 'role' ? -1 : 0)
        || String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
    });
  }

  function relationButton(rel) {
    const node = rel.node || {};
    return `<button type="button" class="knowledge-relation" data-related-slug="${escapeHtml(node.slug)}" title="${escapeHtml(rel.edge_type || '')}">${escapeHtml(node.name || node.slug)} <small>${escapeHtml(rel.edge_type || '相關')}</small></button>`;
  }

  function groupRelations(relations) {
    const groups = new Map();
    const seen = new Set();
    relations.forEach((rel) => {
      const type = rel?.node?.node_type || 'other';
      const slug = rel?.node?.slug || '';
      if (!relationGroupOrder.includes(type) || !slug || seen.has(slug)) return;
      seen.add(slug);
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push(rel);
    });
    return relationGroupOrder
      .filter((type) => groups.has(type))
      .map((type) => ({ type, items: groups.get(type) }));
  }

  function renderTitleRelations(relations) {
    const items = groupRelations(relations).flatMap((group) => group.items);
    if (!items.length) return '';
    return `<aside class="knowledge-title-relations" aria-label="相關條目"><span class="knowledge-title-relations-label">相關條目</span><div class="knowledge-title-relation-list">${items.map(relationButton).join('')}</div></aside>`;
  }

  function isNavigationOnlyIntro(block) {
    if (String(block?.title || '').trim() !== '導言') return false;
    const text = String(block?.content || '').replace(/\s+/g, ' ').trim();
    return /^(?:<<|←|返回|回到).*?(?:總覽|分類|上一層)/.test(text);
  }
  function renderRelationGroups(relations) {
    const groups = groupRelations(relations);
    if (!groups.length) return '<span class="knowledge-result-meta">目前沒有可顯示的規則或文章關聯。</span>';
    return groups.map((group) => {
      const expanded = state.expandedRelationGroups.has(group.type);
      const visible = expanded ? group.items : group.items.slice(0, 12);
      return `<div class="knowledge-relation-group"><div class="knowledge-relation-group-head"><h4>${escapeHtml(typeLabel(group.type))} <span>${group.items.length}</span></h4>${group.items.length > 12 ? `<button type="button" class="knowledge-relation-toggle" data-relation-group="${escapeHtml(group.type)}">${expanded ? '收合' : `展開其餘 ${group.items.length - 12} 筆`}</button>` : ''}</div><div class="knowledge-relations">${visible.map(relationButton).join('')}</div></div>`;
    }).join('');
  }

  function inlineMarkup(value) {
    return escapeHtml(value)
      .replace(/\[size=(sm|md|lg|xl)\]([\s\S]*?)\[\/size\]/g, '<span class="rich-size-$1">$2</span>')
      .replace(/\[knowledge=([^\]]+)\]([\s\S]*?)\[\/knowledge\]/g, (_, slug, label) => `<a href="#knowledge/${encodeURIComponent(slug)}" data-knowledge-slug="${slug}">${label}</a>`)
      .replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<strong>$1</strong>')
      .replace(/\[i\]([\s\S]*?)\[\/i\]/g, '<em>$1</em>')
      .replace(/\[url=(https?:\/\/[^\]\s]+)\]([\s\S]*?)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
      .replace(/\[color=#[0-9a-fA-F]{6}\]|\[\/color\]/g, '');
  }

  function renderTable(lines) {
    const rows = lines.map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
    if (rows.length < 2) return '';
    const header = rows[0];
    const body = rows.slice(2);
    return `<div class="knowledge-table-wrap"><table class="knowledge-table"><thead><tr>${header.map((cell) => `<th>${inlineMarkup(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkup(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function structuredText(content) {
    const lines = String(content || '').replace(/\r/g, '').split('\n');
    const output = [];
    let paragraph = [];
    let listItems = [];
    let listType = '';
    let tableLines = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      output.push(`<p>${inlineMarkup(paragraph.join(' '))}</p>`);
      paragraph = [];
    };
    const flushList = () => {
      if (!listItems.length) return;
      const tag = listType === 'ol' ? 'ol' : 'ul';
      output.push(`<${tag}>${listItems.map((item) => `<li>${inlineMarkup(item)}</li>`).join('')}</${tag}>`);
      listItems = [];
      listType = '';
    };
    const flushTable = () => {
      if (!tableLines.length) return;
      output.push(renderTable(tableLines));
      tableLines = [];
    };
    const flushAll = () => { flushParagraph(); flushList(); flushTable(); };

    lines.forEach((raw) => {
      const line = raw.trim();
      if (!line) { flushAll(); return; }
      if (/^\|.*\|$/.test(line)) {
        flushParagraph(); flushList(); tableLines.push(line); return;
      }
      flushTable();
      const taggedQuote = line.match(/^\[quote\]([\s\S]*)\[\/quote\]$/);
      if (taggedQuote) {
        flushParagraph(); flushList(); output.push(`<blockquote>${inlineMarkup(taggedQuote[1])}</blockquote>`); return;
      }
      const taggedNumber = line.match(/^\[number\]([\s\S]*)\[\/number\]$/);
      const taggedBullet = line.match(/^\[bullet\]([\s\S]*)\[\/bullet\]$/);
      if (taggedNumber || taggedBullet) {
        flushParagraph();
        const nextType = taggedNumber ? 'ol' : 'ul';
        if (listType && listType !== nextType) flushList();
        listType = nextType;
        listItems.push((taggedNumber || taggedBullet)[1]);
        return;
      }
      if (line.startsWith('### ')) {
        flushParagraph(); flushList(); output.push(`<h4>${inlineMarkup(line.slice(4))}</h4>`); return;
      }
      if (line.startsWith('> ')) {
        flushParagraph(); flushList(); output.push(`<blockquote>${inlineMarkup(line.slice(2))}</blockquote>`); return;
      }
      const ordered = line.match(/^\d+\.\s+(.+)$/);
      if (ordered) {
        flushParagraph();
        if (listType && listType !== 'ol') flushList();
        listType = 'ol'; listItems.push(ordered[1]); return;
      }
      const bullet = line.match(/^[-•]\s+(.+)$/);
      if (bullet) {
        flushParagraph();
        if (listType && listType !== 'ul') flushList();
        listType = 'ul'; listItems.push(bullet[1]); return;
      }
      flushList();
      paragraph.push(line);
    });
    flushAll();
    return output.join('') || '<p class="knowledge-result-meta">目前沒有內容。</p>';
  }

  function renderBlock(block, index) {
    const baseType = String(block.block_type || '').replace(/_\d+$/, '');
    const isSource = baseType === 'source_excerpt';
    if (isSource) {
      const key = String(block.id || index);
      const expanded = state.expandedSourceBlocks.has(key);
      return `<div class="knowledge-block knowledge-block-source"><button type="button" class="knowledge-source-toggle" data-source-block="${escapeHtml(key)}"><span><i class="fa-solid ${blockIcon(baseType)}"></i> ${escapeHtml(block.title || blockLabel(baseType))}</span><span>${expanded ? '收合' : '展開備查'}</span></button>${expanded ? `<div class="knowledge-block-body">${structuredText(block.content)}</div>` : '<div class="knowledge-source-note">保留原始來源節錄，供比對與後續人工審核。</div>'}</div>`;
    }
    return `<article class="knowledge-block knowledge-block-structured"><div class="knowledge-block-heading"><i class="fa-solid ${blockIcon(baseType)}"></i><div><strong>${escapeHtml(block.title || blockLabel(baseType))}</strong><span>依原始百科章節整理・待審核</span></div></div><div class="knowledge-block-body">${structuredText(block.content)}</div></article>`;
  }

  function bindDetailEvents(detail, node) {
    detail.querySelectorAll('[data-related-slug]').forEach((button) => button.addEventListener('click', () => loadNode(button.dataset.relatedSlug)));
    detail.querySelectorAll('[data-relation-group]').forEach((button) => button.addEventListener('click', () => {
      const key = button.dataset.relationGroup;
      state.expandedRelationGroups.has(key) ? state.expandedRelationGroups.delete(key) : state.expandedRelationGroups.add(key);
      renderNode(node);
    }));
    detail.querySelectorAll('[data-source-block]').forEach((button) => button.addEventListener('click', () => {
      const key = button.dataset.sourceBlock;
      state.expandedSourceBlocks.has(key) ? state.expandedSourceBlocks.delete(key) : state.expandedSourceBlocks.add(key);
      renderNode(node);
    }));
  }

  function renderNode(node) {
    const detail = $('knowledge-detail');
    if (!detail) return;
    const aliases = (node.aliases || []).filter((alias) => alias.alias && alias.alias !== node.name);
    const blocks = (node.blocks || []).filter((block) => !isNavigationOnlyIntro(block));
    const relations = node.relations || [];
    detail.dataset.knowledgeSlug = node.slug;
    detail.className = '';
    detail.innerHTML = `
      <div class="knowledge-detail-title"><div class="knowledge-title-identity"><div class="knowledge-type-chip">${escapeHtml(typeLabel(node.node_type))}</div><h2>${escapeHtml(node.name)}</h2>${node.name_en ? `<div class="knowledge-name-en">${escapeHtml(node.name_en)}</div>` : ''}</div>${renderTitleRelations(relations)}</div>
      ${blocks.length ? `<div class="knowledge-section"><h3>整理內容</h3><div class="knowledge-block-list">${blocks.map(renderBlock).join('')}</div></div>` : `<div class="knowledge-section"><div class="knowledge-warning">目前尚未建立結構化內容。後續會逐步補上能力、規則、說書人提醒與常見誤解。</div></div>`}
      ${node.source_record?.url ? `<div class="knowledge-section knowledge-source-reference"><h3>來源</h3><a class="knowledge-source-link" href="${escapeHtml(node.source_record.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> 查看原始來源</a></div>` : ''}
      ${aliases.length ? `<div class="knowledge-section"><h3>別名與其他語言</h3><div class="knowledge-aliases">${aliases.map((alias) => `<span class="knowledge-alias">${escapeHtml(alias.alias)} <small>${escapeHtml(alias.language || '')}</small></span>`).join('')}</div></div>` : ''}`;
    bindDetailEvents(detail, node);
    window.RoleKnowledgePreview?.linkRoleMentions?.({
      root: detail,
      apiBase,
      requireJson,
      currentNode: node,
      onNavigate: loadNode,
      isCurrent: () => detail.dataset.knowledgeSlug === node.slug
    }).catch((error) => console.warn('文章角色提及連結載入失敗', error));
  }

  const slugFromLocation = () => {
    const match = window.location.hash.match(/^#knowledge\/(.*)$/);
    if (!match) return '';
    try { return decodeURIComponent(match[1]); } catch (_) { return match[1]; }
  };

  async function loadNode(slug, { historyMode = 'push', focusDetail = false } = {}) {
    if (!slug) return;
    const requestId = ++state.nodeRequestId;
    state.activeSlug = slug;
    state.expandedRelationGroups.clear();
    state.expandedSourceBlocks.clear();
    renderResults();
    const detail = $('knowledge-detail');
    if (detail) detail.innerHTML = '<div class="knowledge-detail-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>正在讀取條目...</p></div>';
    try {
      const node = await fetch(`${apiBase}/api/knowledge/nodes/${encodeURIComponent(slug)}`, { cache: 'no-store' }).then(requireJson);
      if (requestId !== state.nodeRequestId) return;
      if (node.node_type === 'role' && window.RoleKnowledgePreview) {
        await window.RoleKnowledgePreview.render({
          apiBase, node, detail, requireJson,
          onNavigate: loadNode,
          onFallback: (err) => {
            renderNode(node);
            const warning = document.createElement('div');
            warning.className = 'knowledge-warning';
            warning.textContent = `角色主資料尚未完成連結：${err.message}`;
            detail.prepend(warning);
          }
        });
      } else {
        renderNode(node);
      }
      if (requestId !== state.nodeRequestId) return;
      const hash = `knowledge/${encodeURIComponent(slug)}`;
      if (window.location.hash !== `#${hash}`) {
        if (historyMode === 'replace') history.replaceState({ knowledgeSlug: slug }, '', `#${hash}`);
        else if (historyMode === 'push') history.pushState({ knowledgeSlug: slug }, '', `#${hash}`);
      }
      if (focusDetail && window.innerWidth <= 900) detail?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      if (requestId !== state.nodeRequestId) return;
      if (detail) detail.innerHTML = `<div class="knowledge-detail-empty"><h3>無法讀取條目</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  async function searchKnowledge() {
    const q = $('knowledge-search-input')?.value.trim() || '';
    const nodeType = $('knowledge-type-filter')?.value || '';
    const team = $('knowledge-team-filter')?.value || '';
    const meta = $('knowledge-search-meta');
    const detail = $('knowledge-detail');
    if (!state.activeSlug && detail) {
      detail.className = 'knowledge-detail-empty';
      detail.innerHTML = '<i class="fa-solid fa-book-open"></i><h3>選擇一個條目</h3><p>搜尋後從結果中選擇角色、規則或文章。</p>';
    }
    if (!q && !nodeType && !team) {
      state.items = [];
      state.resultStatus = 'idle';
      if (meta) meta.textContent = '輸入關鍵字，或選擇內容類型與角色分類。';
      renderResults();
      return;
    }
    state.items = [];
    state.resultStatus = 'loading';
    renderResults();
    if (meta) meta.textContent = '正在搜尋...';
    try {
      let data;
      if (team || nodeType === 'role') {
        const params = new URLSearchParams({ q, team, limit: '500' });
        const roles = await fetch(`${apiBase}/api/roles?${params.toString()}`, { cache: 'no-store' }).then(requireJson);
        const items = (roles.items || []).filter((role) => role.knowledge_slug).map((role) => ({
          slug: role.knowledge_slug,
          node_type: 'role',
          name: role.name_zh_tw,
          name_en: role.name_en,
          team: role.team,
        }));
        data = { total: items.length, items };
      } else {
        const params = new URLSearchParams({ q, limit: '100' });
        if (nodeType) params.set('node_type', nodeType);
        data = await fetch(`${apiBase}/api/knowledge/search?${params.toString()}`, { cache: 'no-store' }).then(requireJson);
      }
      state.items = sortedUniqueItems(data.items, q);
      state.resultStatus = 'ready';
      const category = team ? teamLabel(team) : (nodeType ? typeLabel(nodeType) : '全部類型');
      if (meta) meta.textContent = q ? `找到 ${state.items.length} 筆與「${q}」相關的${category}條目` : `${category}共有 ${state.items.length} 筆可查詢條目`;
      renderResults();
    } catch (err) {
      state.items = [];
      state.resultStatus = 'error';
      renderResults();
      if (meta) meta.textContent = err.message;
    }
  }

  async function init() {
    $('knowledge-search-form')?.addEventListener('submit', (event) => { event.preventDefault(); state.activeSlug = null; searchKnowledge(); });
    $('knowledge-type-filter')?.addEventListener('change', (event) => {
      state.activeSlug = null;
      if (event.target.value && event.target.value !== 'role') $('knowledge-team-filter').value = '';
      searchKnowledge();
    });
    $('knowledge-team-filter')?.addEventListener('change', (event) => {
      state.activeSlug = null;
      if (event.target.value) $('knowledge-type-filter').value = 'role';
      searchKnowledge();
    });
    try {
      const data = await fetch(`${apiBase}/api/knowledge/types`, { cache: 'no-store' }).then(requireJson);
      state.types = data.items || [];
      renderTypes();
    } catch (err) { console.warn('知識類型載入失敗', err); }
    const hash = slugFromLocation();
    if (hash) await loadNode(hash, { historyMode: 'replace' });
    else await searchKnowledge();
    window.addEventListener('popstate', () => {
      const slug = slugFromLocation();
      if (slug) loadNode(slug, { historyMode: 'none' });
    });
  }

  init();
})();
