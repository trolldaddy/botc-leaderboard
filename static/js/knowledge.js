(() => {
  const apiBase = window.API_BASE || '';
  const state = { items: [], activeSlug: null, types: [], expandedRelationGroups: new Set(), expandedBlocks: new Set() };
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const typeLabel = (type) => ({ role: '角色', script: '劇本', guide: '指南', mechanic: '規則／機制', article: '文章' }[type] || type || '其他');
  const relationGroupOrder = ['role', 'mechanic', 'script', 'guide', 'article', 'other'];

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
      .map((item) => `<option value="${escapeHtml(item.node_type)}">${escapeHtml(typeLabel(item.node_type))}（${item.count}）</option>`)
      .join('');
  }

  function renderResults() {
    const container = $('knowledge-results');
    if (!container) return;
    if (!state.items.length) {
      container.innerHTML = '<div class="knowledge-empty">沒有找到符合條件的條目。</div>';
      return;
    }
    container.innerHTML = state.items.map((item) => `
      <button class="knowledge-result ${state.activeSlug === item.slug ? 'is-active' : ''}" type="button" data-knowledge-slug="${escapeHtml(item.slug)}">
        <div class="knowledge-result-title">${escapeHtml(item.name)}</div>
        <div class="knowledge-result-meta"><span class="knowledge-type-chip">${escapeHtml(typeLabel(item.node_type))}</span>${escapeHtml(item.name_en || item.name_zh_cn || item.slug)}</div>
      </button>
    `).join('');
    container.querySelectorAll('[data-knowledge-slug]').forEach((button) => {
      button.addEventListener('click', () => loadNode(button.dataset.knowledgeSlug));
    });
  }

  function relationButton(rel) {
    const node = rel.node || {};
    return `<button type="button" class="knowledge-relation" data-related-slug="${escapeHtml(node.slug)}" title="${escapeHtml(rel.edge_type || '')}">${escapeHtml(node.name || node.slug)} <small>${escapeHtml(rel.edge_type || '相關')}</small></button>`;
  }

  function groupRelations(relations) {
    const groups = new Map();
    relations.forEach((rel) => {
      const type = rel?.node?.node_type || 'other';
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push(rel);
    });
    return relationGroupOrder
      .filter((type) => groups.has(type))
      .map((type) => ({ type, items: groups.get(type) }))
      .concat(Array.from(groups.entries()).filter(([type]) => !relationGroupOrder.includes(type)).map(([type, items]) => ({ type, items })));
  }

  function renderRelationGroups(relations) {
    if (!relations.length) return '<span class="knowledge-result-meta">目前沒有可顯示的關聯。</span>';
    return groupRelations(relations).map((group) => {
      const key = group.type;
      const expanded = state.expandedRelationGroups.has(key);
      const visible = expanded ? group.items : group.items.slice(0, 12);
      return `
        <div class="knowledge-relation-group">
          <div class="knowledge-relation-group-head">
            <h4>${escapeHtml(typeLabel(group.type))} <span>${group.items.length}</span></h4>
            ${group.items.length > 12 ? `<button type="button" class="knowledge-relation-toggle" data-relation-group="${escapeHtml(key)}">${expanded ? '收合' : `展開其餘 ${group.items.length - 12} 筆`}</button>` : ''}
          </div>
          <div class="knowledge-relations">${visible.map(relationButton).join('')}</div>
        </div>`;
    }).join('');
  }

  function paragraphize(value) {
    const text = String(value || '').trim();
    if (!text) return [];
    const existing = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    if (existing.length > 1) return existing;
    const sentences = text.split(/(?<=[。！？!?])\s*/).map((part) => part.trim()).filter(Boolean);
    const paragraphs = [];
    let current = '';
    sentences.forEach((sentence) => {
      if ((current + sentence).length > 260 && current) {
        paragraphs.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    });
    if (current) paragraphs.push(current.trim());
    return paragraphs.length ? paragraphs : [text];
  }

  function renderBlock(block) {
    const paragraphs = paragraphize(block.content || '');
    const key = String(block.id || `${block.block_type}-${block.title || ''}`);
    const expanded = state.expandedBlocks.has(key);
    const previewCount = 3;
    const visible = expanded ? paragraphs : paragraphs.slice(0, previewCount);
    const hasMore = paragraphs.length > previewCount;
    return `
      <article class="knowledge-block ${expanded ? 'is-expanded' : ''}">
        <div class="knowledge-block-head">
          <div>
            <strong>${escapeHtml(block.title || typeLabel(block.block_type))}</strong>
            <span class="knowledge-block-label">來源整理 · 待審核</span>
          </div>
          ${hasMore ? `<button type="button" class="knowledge-block-toggle" data-block-toggle="${escapeHtml(key)}">${expanded ? '收合' : '展開全文'}</button>` : ''}
        </div>
        <div class="knowledge-block-body">${visible.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</div>
        ${!expanded && hasMore ? `<div class="knowledge-block-fade"></div>` : ''}
      </article>`;
  }

  function bindDetailEvents(detail, node) {
    detail.querySelectorAll('[data-related-slug]').forEach((button) => button.addEventListener('click', () => loadNode(button.dataset.relatedSlug)));
    detail.querySelectorAll('[data-relation-group]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.relationGroup;
        if (state.expandedRelationGroups.has(key)) state.expandedRelationGroups.delete(key);
        else state.expandedRelationGroups.add(key);
        renderNode(node);
      });
    });
    detail.querySelectorAll('[data-block-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.blockToggle;
        if (state.expandedBlocks.has(key)) state.expandedBlocks.delete(key);
        else state.expandedBlocks.add(key);
        renderNode(node);
      });
    });
  }

  function renderNode(node) {
    const detail = $('knowledge-detail');
    if (!detail) return;
    const aliases = (node.aliases || []).filter((alias) => alias.alias && alias.alias !== node.name);
    const blocks = node.blocks || [];
    const source = node.source_record;
    const sourceContent = source?.content || node.summary || '';
    const relations = node.relations || [];
    const hasSourceExcerptBlock = blocks.some((block) => block.block_type === 'source_excerpt');
    detail.className = '';
    detail.innerHTML = `
      <div class="knowledge-detail-title">
        <div>
          <div class="knowledge-type-chip">${escapeHtml(typeLabel(node.node_type))}</div>
          <h2>${escapeHtml(node.name)}</h2>
          ${node.name_en ? `<div class="knowledge-name-en">${escapeHtml(node.name_en)}</div>` : ''}
        </div>
        <div class="knowledge-result-meta">${escapeHtml(node.slug)}</div>
      </div>

      ${blocks.length ? `
        <div class="knowledge-section">
          <h3>整理內容</h3>
          ${blocks.map(renderBlock).join('')}
        </div>` : `
        <div class="knowledge-section">
          <div class="knowledge-warning">目前尚未建立人工整理的 Knowledge Blocks，下方先顯示爬取來源內容。之後會逐步補上能力、規則、說書人提醒與常見誤解。</div>
        </div>`}

      <div class="knowledge-section">
        <h3>來源</h3>
        ${!hasSourceExcerptBlock ? `<div class="knowledge-source-content">${escapeHtml(sourceContent || '目前沒有可顯示的來源內容。')}</div>` : '<div class="knowledge-source-note">完整原始內容已整理到上方區塊，這裡保留來源連結與查核入口。</div>'}
        ${source?.url ? `<a class="knowledge-source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> 查看原始來源</a>` : ''}
      </div>

      ${aliases.length ? `<div class="knowledge-section"><h3>別名與其他語言</h3><div class="knowledge-aliases">${aliases.map((alias) => `<span class="knowledge-alias">${escapeHtml(alias.alias)} <small>${escapeHtml(alias.language || '')}</small></span>`).join('')}</div></div>` : ''}

      <div class="knowledge-section">
        <h3>相關條目（${relations.length}）</h3>
        <div class="knowledge-relation-groups">${renderRelationGroups(relations)}</div>
      </div>
    `;
    bindDetailEvents(detail, node);
  }

  async function loadNode(slug) {
    if (!slug) return;
    state.activeSlug = slug;
    state.expandedRelationGroups.clear();
    state.expandedBlocks.clear();
    renderResults();
    const detail = $('knowledge-detail');
    if (detail) detail.innerHTML = '<div class="knowledge-detail-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>正在讀取條目...</p></div>';
    try {
      const node = await fetch(`${apiBase}/api/knowledge/nodes/${encodeURIComponent(slug)}`, { cache: 'no-store' }).then(requireJson);
      renderNode(node);
      const hash = `knowledge/${encodeURIComponent(slug)}`;
      if (window.location.hash !== `#${hash}`) history.replaceState(null, '', `#${hash}`);
    } catch (err) {
      if (detail) detail.innerHTML = `<div class="knowledge-detail-empty"><h3>無法讀取條目</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  async function searchKnowledge() {
    const q = $('knowledge-search-input')?.value.trim() || '';
    const nodeType = $('knowledge-type-filter')?.value || '';
    const meta = $('knowledge-search-meta');
    if (meta) meta.textContent = '正在搜尋...';
    try {
      const params = new URLSearchParams({ q, limit: '60' });
      if (nodeType) params.set('node_type', nodeType);
      const data = await fetch(`${apiBase}/api/knowledge/search?${params.toString()}`, { cache: 'no-store' }).then(requireJson);
      state.items = data.items || [];
      if (meta) meta.textContent = q ? `找到 ${data.total} 筆與「${q}」相關的條目` : `目前共有 ${data.total} 筆可查詢條目`;
      renderResults();
      if (state.items.length && !state.activeSlug) loadNode(state.items[0].slug);
    } catch (err) {
      state.items = [];
      renderResults();
      if (meta) meta.textContent = err.message;
    }
  }

  async function init() {
    $('knowledge-search-form')?.addEventListener('submit', (event) => { event.preventDefault(); state.activeSlug = null; searchKnowledge(); });
    $('knowledge-type-filter')?.addEventListener('change', () => { state.activeSlug = null; searchKnowledge(); });
    try {
      const data = await fetch(`${apiBase}/api/knowledge/types`, { cache: 'no-store' }).then(requireJson);
      state.types = data.items || [];
      renderTypes();
    } catch (err) {
      console.warn('知識類型載入失敗', err);
    }
    const hash = decodeURIComponent(window.location.hash.replace(/^#knowledge\/?/, ''));
    await searchKnowledge();
    if (hash && hash !== window.location.hash.replace('#', '')) loadNode(hash);
  }

  init();
})();