(() => {
  const editor = document.getElementById('role-admin-editor');
  if (!editor) return;

  const toolbar = document.createElement('div');
  toolbar.className = 'role-rich-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', '文字格式工具列');
  toolbar.innerHTML = `
    <select data-rich-size title="文字尺寸"><option value="">文字大小</option><option value="sm">小</option><option value="md">一般</option><option value="lg">大</option><option value="xl">標題</option></select>
    <button type="button" data-rich-tag="b" title="粗體"><b>B</b></button><button type="button" data-rich-tag="i" title="斜體"><i>I</i></button>
    <span class="role-rich-separator"></span><button type="button" data-rich-list="ul" title="項目清單">•</button><button type="button" data-rich-list="ol" title="編號清單">1.</button><button type="button" data-rich-quote title="引用">❝</button><button type="button" data-rich-link title="插入連結">🔗</button><button type="button" data-rich-clear title="清除格式">Tx</button>
    <span class="role-rich-separator"></span><button type="button" data-rich-undo title="復原">↶</button><button type="button" data-rich-redo title="重做">↷</button>`;
  document.body.appendChild(toolbar);

  const style = document.createElement('style');
  style.textContent = `
    .role-rich-source{display:none!important}
    .role-rich-editor{width:100%;min-height:112px;max-height:360px;overflow:auto;white-space:pre-wrap;background:#202638;color:#f4f6fb;border:1px solid #39415a;border-radius:10px;padding:.72rem .8rem;line-height:1.58;outline:none;scrollbar-width:thin;scrollbar-color:#7657c8 #171b29}
    .role-rich-editor:focus{border-color:#9a78ff;box-shadow:0 0 0 2px rgba(139,124,246,.16)}
    .role-rich-editor:empty:before{content:'輸入內容…';color:#8993aa;pointer-events:none}
    .role-rich-editor .rich-size-sm{font-size:.82em}.role-rich-editor .rich-size-md{font-size:1em}.role-rich-editor .rich-size-lg{font-size:1.18em;line-height:1.55}.role-rich-editor .rich-size-xl{font-size:1.38em;line-height:1.4;font-weight:800;color:#fff}
    .role-rich-editor blockquote{margin:.45rem 0;padding:.45rem .75rem;border-left:3px solid #8b7cf6;background:rgba(139,124,246,.08)}
    .role-rich-editor ul,.role-rich-editor ol{display:block!important;margin:.35rem 0!important;padding-left:1.75rem!important}
    .role-rich-editor ul{list-style:disc outside!important}.role-rich-editor ol{list-style:decimal outside!important}
    .role-rich-editor li{display:list-item!important;margin:.16rem 0}.role-rich-editor a{color:#b9a7ff;text-decoration:underline}
    .role-rich-toolbar{position:fixed;z-index:10050;display:none;align-items:center;gap:.3rem;max-width:min(700px,calc(100vw - 1rem));padding:.42rem;border:1px solid #49516b;border-radius:10px;background:#111522;box-shadow:0 10px 30px rgba(0,0,0,.42);overflow-x:auto;scrollbar-width:thin;scrollbar-color:#7657c8 #171b29}.role-rich-toolbar.is-visible{display:flex}.role-rich-toolbar button,.role-rich-toolbar select{height:32px;min-width:32px;border:1px solid #39415a;border-radius:7px;background:#22283b;color:#f5f7ff;cursor:pointer}.role-rich-toolbar button:hover,.role-rich-toolbar select:hover{border-color:#9a78ff;background:#302650}.role-rich-toolbar select{padding:0 .45rem}.role-rich-toolbar button{padding:0 .5rem;font-size:.86rem}.role-rich-separator{width:1px;height:22px;background:#39415a;flex:0 0 1px}.role-rich-toolbar::-webkit-scrollbar{height:7px}.role-rich-toolbar::-webkit-scrollbar-track{background:#171b29;border-radius:8px}.role-rich-toolbar::-webkit-scrollbar-thumb{background:#7657c8;border-radius:8px}`;
  document.head.appendChild(style);

  const esc = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const inlineHtml = (value) => esc(value)
    .replace(/\[size=(sm|md|lg|xl)\]([\s\S]*?)\[\/size\]/gi,'<span class="rich-size-$1" data-rich-size="$1">$2</span>')
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi,'<strong>$1</strong>')
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi,'<em>$1</em>')
    .replace(/\[url=(https?:\/\/[^\]\s]+)\]([\s\S]*?)\[\/url\]/gi,'<a href="$1" target="_blank" rel="noopener">$2</a>')
    .replace(/\[color=#[0-9a-f]{6}\]|\[\/color\]/gi,'');
  const toHtml = (value) => String(value || '').replace(/\r/g,'').split('\n').map((line) => {
    let match = line.match(/^\[quote\]([\s\S]*)\[\/quote\]$/i); if(match) return `<blockquote>${inlineHtml(match[1])}</blockquote>`;
    match = line.match(/^\[bullet\]([\s\S]*)\[\/bullet\]$/i); if(match) return `<ul><li>${inlineHtml(match[1])}</li></ul>`;
    match = line.match(/^\[number\]([\s\S]*)\[\/number\]$/i); if(match) return `<ol><li>${inlineHtml(match[1])}</li></ol>`;
    return `<div>${inlineHtml(line) || '<br>'}</div>`;
  }).join('').replace(/<\/ul><ul>/g,'').replace(/<\/ol><ol>/g,'');

  const nodeText = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '\n';
    const inner = Array.from(node.childNodes).map(nodeText).join('');
    if (tag === 'strong' || tag === 'b') return `[b]${inner}[/b]`;
    if (tag === 'em' || tag === 'i') return `[i]${inner}[/i]`;
    if (tag === 'span' && node.dataset.richSize) return `[size=${node.dataset.richSize}]${inner}[/size]`;
    if (tag === 'a' && /^https?:\/\//i.test(node.href)) return `[url=${node.href}]${inner}[/url]`;
    if (tag === 'blockquote') return `[quote]${inner.replace(/\n+$/,'')}[/quote]\n`;
    if (tag === 'li') return inner.replace(/\n+$/,'');
    if (tag === 'ul' || tag === 'ol') return Array.from(node.children).map((li) => `[${tag === 'ol' ? 'number' : 'bullet'}]${nodeText(li)}[/${tag === 'ol' ? 'number' : 'bullet'}]`).join('\n') + '\n';
    if (tag === 'div' || tag === 'p') return `${inner}\n`;
    return inner;
  };
  const serialize = (visual) => Array.from(visual.childNodes).map(nodeText).join('').replace(/\n{3,}/g,'\n\n').replace(/\n$/,'');

  const states = new WeakMap();
  let active = null;
  let savedRange = null;
  const snapshot = (visual) => ({ html: visual.innerHTML, value: serialize(visual) });
  const record = (visual) => {
    const state = states.get(visual); if (!state || state.applying) return;
    const value = snapshot(visual); if (state.undo[state.undo.length - 1]?.value === value.value) return;
    state.undo.push(value); if (state.undo.length > 100) state.undo.shift(); state.redo.length = 0;
  };
  const sync = (visual, shouldRecord = true) => {
    const textarea = visual.previousElementSibling; if (!textarea?.matches('textarea')) return;
    textarea.value = serialize(visual); textarea.dispatchEvent(new Event('input',{bubbles:true}));
    if (shouldRecord) record(visual);
  };
  const applyState = (saved) => {
    const state=states.get(active); if(!state || !saved) return;
    state.applying=true; active.innerHTML=saved.html;
    const textarea=active.previousElementSibling;
    if(textarea?.matches('textarea')){textarea.value=saved.value;textarea.dispatchEvent(new Event('input',{bubbles:true}));}
    state.applying=false; active.focus();
  };
  const undo = () => {const state=states.get(active);if(!state||state.undo.length<2)return;state.redo.push(state.undo.pop());applyState(state.undo[state.undo.length-1]);};
  const redo = () => {const state=states.get(active);if(!state||!state.redo.length)return;const value=state.redo.pop();state.undo.push(value);applyState(value);};

  const enhance = (textarea) => {
    if (textarea.dataset.richEnhanced) return;
    textarea.dataset.richEnhanced='true'; textarea.classList.add('role-rich-source');
    const visual=document.createElement('div');visual.className='role-rich-editor';visual.contentEditable='true';visual.setAttribute('role','textbox');visual.setAttribute('aria-multiline','true');visual.innerHTML=toHtml(textarea.value);textarea.after(visual);
    states.set(visual,{undo:[snapshot(visual)],redo:[],applying:false});
    visual.addEventListener('focus',()=>{active=visual;saveRange();toolbar.classList.add('is-visible');requestAnimationFrame(position);});
    visual.addEventListener('input',()=>sync(visual,true));
    visual.addEventListener('keyup',saveRange);visual.addEventListener('mouseup',saveRange);
    visual.addEventListener('paste',(event)=>{event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));});
  };
  const enhanceAll = (root=editor) => root.querySelectorAll('textarea').forEach(enhance);
  enhanceAll(); new MutationObserver((records)=>records.forEach((record)=>record.addedNodes.forEach((node)=>{if(node.nodeType===1){if(node.matches?.('textarea'))enhance(node);enhanceAll(node);}}))).observe(editor,{childList:true,subtree:true});

  const saveRange = () => {const selection=getSelection();if(active&&selection?.rangeCount&&active.contains(selection.anchorNode))savedRange=selection.getRangeAt(0).cloneRange();};
  const restoreRange = () => {active?.focus();if(savedRange&&active.contains(savedRange.commonAncestorContainer)){const selection=getSelection();selection.removeAllRanges();selection.addRange(savedRange);}};
  const position = () => {if(!active||!toolbar.classList.contains('is-visible'))return;const r=active.getBoundingClientRect(),h=toolbar.offsetHeight||44;toolbar.style.left=`${Math.max(8,Math.min(r.left,innerWidth-toolbar.offsetWidth-8))}px`;toolbar.style.top=`${r.top>h+10?r.top-h-6:Math.min(innerHeight-h-8,r.bottom+6)}px`;};
  const wrapSelection = (tag, attrs={}) => {restoreRange();const selection=getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0),wrapper=document.createElement(tag);Object.entries(attrs).forEach(([key,value])=>key==='class'?wrapper.className=value:wrapper.dataset[key]=value);if(range.collapsed)wrapper.textContent='文字';else wrapper.appendChild(range.extractContents());range.insertNode(wrapper);range.selectNodeContents(wrapper);selection.removeAllRanges();selection.addRange(range);saveRange();sync(active,true);position();};
  const command = (name, value=null) => {restoreRange();document.execCommand(name,false,value);saveRange();sync(active,true);position();};

  document.addEventListener('selectionchange',()=>{if(active&&active.contains(getSelection()?.anchorNode))saveRange();});
  toolbar.addEventListener('pointerdown',(event)=>{if(!event.target.matches('select'))event.preventDefault();saveRange();});
  toolbar.addEventListener('click',(event)=>{const button=event.target.closest('button');if(!button||!active)return;if(button.dataset.richTag==='b')command('bold');else if(button.dataset.richTag==='i')command('italic');else if(button.dataset.richList)command(button.dataset.richList==='ol'?'insertOrderedList':'insertUnorderedList');else if(button.hasAttribute('data-rich-quote'))command('formatBlock','blockquote');else if(button.hasAttribute('data-rich-link')){const url=prompt('請輸入 https:// 開頭的網址','https://');if(url&&/^https?:\/\//i.test(url))command('createLink',url);}else if(button.hasAttribute('data-rich-clear'))command('removeFormat');else if(button.hasAttribute('data-rich-undo'))undo();else if(button.hasAttribute('data-rich-redo'))redo();});
  toolbar.querySelector('[data-rich-size]').addEventListener('change',(event)=>{if(event.target.value)wrapSelection('span',{class:`rich-size-${event.target.value}`,richSize:event.target.value});event.target.value='';});
  document.addEventListener('pointerdown',(event)=>{if(!toolbar.contains(event.target)&&!editor.contains(event.target))toolbar.classList.remove('is-visible');});addEventListener('resize',position);addEventListener('scroll',position,true);
})();
