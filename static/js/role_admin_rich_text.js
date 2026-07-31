(() => {
  const editor = document.getElementById('role-admin-editor');
  if (!editor) return;

  const toolbar = document.createElement('div');
  toolbar.className = 'role-rich-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', '文字格式工具列');
  toolbar.innerHTML = `
    <select data-rich-heading title="段落與標題">
      <option value="">段落</option><option value="## ">H2</option><option value="### ">H3</option><option value="#### ">H4</option>
    </select>
    <button type="button" data-rich-wrap="**" title="粗體"><b>B</b></button>
    <button type="button" data-rich-wrap="*" title="斜體"><i>I</i></button>
    <label class="role-rich-color" title="文字顏色"><span>A</span><input type="color" value="#ffd166" data-rich-color></label>
    <span class="role-rich-separator"></span>
    <button type="button" data-rich-line="- " title="項目清單">•</button>
    <button type="button" data-rich-number title="編號清單">1.</button>
    <button type="button" data-rich-line="> " title="引用">❝</button>
    <button type="button" data-rich-link title="插入連結">🔗</button>
    <button type="button" data-rich-clear title="清除格式">Tx</button>
    <span class="role-rich-separator"></span>
    <button type="button" data-rich-undo title="復原">↶</button>
    <button type="button" data-rich-redo title="重做">↷</button>`;
  document.body.appendChild(toolbar);

  const style = document.createElement('style');
  style.textContent = `
    .role-rich-toolbar{position:fixed;z-index:10050;display:none;align-items:center;gap:.3rem;max-width:min(760px,calc(100vw - 1rem));padding:.42rem;border:1px solid #49516b;border-radius:10px;background:#111522;box-shadow:0 10px 30px rgba(0,0,0,.42);overflow-x:auto;scrollbar-width:thin;scrollbar-color:#7657c8 #171b29}
    .role-rich-toolbar.is-visible{display:flex}.role-rich-toolbar button,.role-rich-toolbar select{height:32px;min-width:32px;border:1px solid #39415a;border-radius:7px;background:#22283b;color:#f5f7ff;cursor:pointer}.role-rich-toolbar button:hover,.role-rich-toolbar select:hover{border-color:#9a78ff;background:#302650}.role-rich-toolbar select{padding:0 .45rem}.role-rich-toolbar button{padding:0 .5rem;font-size:.86rem}.role-rich-separator{width:1px;height:22px;background:#39415a;flex:0 0 1px}.role-rich-color{position:relative;width:34px;height:32px;display:grid;place-items:center;border:1px solid #39415a;border-radius:7px;background:#22283b;font-weight:800;cursor:pointer}.role-rich-color input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.role-rich-color span{border-bottom:3px solid #ffd166}.role-rich-toolbar::-webkit-scrollbar{height:7px}.role-rich-toolbar::-webkit-scrollbar-track{background:#171b29;border-radius:8px}.role-rich-toolbar::-webkit-scrollbar-thumb{background:#7657c8;border-radius:8px}
  `;
  document.head.appendChild(style);

  let active = null;
  const selection = { start: 0, end: 0 };
  const saveSelection = () => { if (active) { selection.start = active.selectionStart; selection.end = active.selectionEnd; } };
  const emit = () => { active.dispatchEvent(new Event('input', { bubbles: true })); active.focus(); saveSelection(); position(); };
  const replace = (text, start = selection.start, end = selection.end, selectStart = null, selectEnd = null) => {
    if (!active) return;
    active.focus(); active.setSelectionRange(start, end); active.setRangeText(text, start, end, 'end');
    if (selectStart !== null) active.setSelectionRange(selectStart, selectEnd);
    emit();
  };
  const selected = () => active ? active.value.slice(selection.start, selection.end) : '';
  const wrap = (mark) => { const value = selected() || '文字'; replace(mark + value + mark, selection.start, selection.end, selection.start + mark.length, selection.start + mark.length + value.length); };
  const lineRange = () => { const value = active.value; return { start: value.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1, end: (value.indexOf('\n', selection.end) < 0 ? value.length : value.indexOf('\n', selection.end)) }; };
  const lineFormat = (prefix, numbered = false) => {
    if (!active) return; const range = lineRange();
    const lines = active.value.slice(range.start, range.end).split('\n').map((line, index) => {
      const clean = line.replace(/^(?:#{2,4}\s+|>\s+|[-*+]\s+|\d+\.\s+)/, '');
      return (numbered ? `${index + 1}. ` : prefix) + clean;
    });
    replace(lines.join('\n'), range.start, range.end);
  };
  const position = () => {
    if (!active || !toolbar.classList.contains('is-visible')) return;
    const r = active.getBoundingClientRect(); const h = toolbar.offsetHeight || 44;
    toolbar.style.left = `${Math.max(8, Math.min(r.left, innerWidth - toolbar.offsetWidth - 8))}px`;
    toolbar.style.top = `${r.top > h + 10 ? r.top - h - 6 : Math.min(innerHeight - h - 8, r.bottom + 6)}px`;
  };
  const activate = (textarea) => { active = textarea; saveSelection(); toolbar.classList.add('is-visible'); requestAnimationFrame(position); };

  editor.addEventListener('focusin', (event) => { if (event.target.matches('textarea')) activate(event.target); });
  editor.addEventListener('select', saveSelection, true); editor.addEventListener('keyup', saveSelection, true); editor.addEventListener('mouseup', saveSelection, true);
  toolbar.addEventListener('pointerdown', (event) => { if (!event.target.matches('select,input[type=color]')) event.preventDefault(); });
  toolbar.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button || !active) return;
    if (button.dataset.richWrap) wrap(button.dataset.richWrap);
    else if (button.dataset.richLine) lineFormat(button.dataset.richLine);
    else if (button.hasAttribute('data-rich-number')) lineFormat('', true);
    else if (button.hasAttribute('data-rich-link')) { const label = selected() || '連結文字'; const url = window.prompt('請輸入 https:// 開頭的網址', 'https://'); if (url && /^https?:\/\//i.test(url)) replace(`[${label}](${url})`, selection.start, selection.end); }
    else if (button.hasAttribute('data-rich-clear')) { const value = selected() || active.value; const clean = value.replace(/\[color=#[0-9a-f]{6}\]|\[\/color\]|\*\*|\*/gi, '').replace(/^#{2,4}\s+/gm, '').replace(/^>\s+/gm, '').replace(/^[-*+]\s+/gm, '').replace(/^\d+\.\s+/gm, '').replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1'); replace(clean, selected() ? selection.start : 0, selected() ? selection.end : active.value.length); }
    else if (button.hasAttribute('data-rich-undo')) { active.focus(); document.execCommand('undo'); }
    else if (button.hasAttribute('data-rich-redo')) { active.focus(); document.execCommand('redo'); }
  });
  toolbar.querySelector('[data-rich-heading]').addEventListener('change', (event) => { if (event.target.value) lineFormat(event.target.value); event.target.value = ''; });
  toolbar.querySelector('[data-rich-color]').addEventListener('input', (event) => { const value = selected() || '文字'; const mark = `[color=${event.target.value}]`; replace(`${mark}${value}[/color]`, selection.start, selection.end, selection.start + mark.length, selection.start + mark.length + value.length); toolbar.querySelector('.role-rich-color span').style.borderColor = event.target.value; });
  document.addEventListener('pointerdown', (event) => { if (!toolbar.contains(event.target) && !editor.contains(event.target)) toolbar.classList.remove('is-visible'); });
  addEventListener('resize', position); addEventListener('scroll', position, true);
})();
