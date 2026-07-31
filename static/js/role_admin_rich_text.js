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
    <span class="role-rich-separator"></span><button type="button" data-rich-line="bullet" title="項目清單">•</button><button type="button" data-rich-line="number" title="編號清單">1.</button><button type="button" data-rich-line="quote" title="引用">❝</button><button type="button" data-rich-link title="插入連結">🔗</button><button type="button" data-rich-clear title="清除格式">Tx</button>
    <span class="role-rich-separator"></span><button type="button" data-rich-undo title="復原">↶</button><button type="button" data-rich-redo title="重做">↷</button>`;
  document.body.appendChild(toolbar);
  const style = document.createElement('style');
  style.textContent = `.role-rich-toolbar{position:fixed;z-index:10050;display:none;align-items:center;gap:.3rem;max-width:min(700px,calc(100vw - 1rem));padding:.42rem;border:1px solid #49516b;border-radius:10px;background:#111522;box-shadow:0 10px 30px rgba(0,0,0,.42);overflow-x:auto;scrollbar-width:thin;scrollbar-color:#7657c8 #171b29}.role-rich-toolbar.is-visible{display:flex}.role-rich-toolbar button,.role-rich-toolbar select{height:32px;min-width:32px;border:1px solid #39415a;border-radius:7px;background:#22283b;color:#f5f7ff;cursor:pointer}.role-rich-toolbar button:hover,.role-rich-toolbar select:hover{border-color:#9a78ff;background:#302650}.role-rich-toolbar select{padding:0 .45rem}.role-rich-toolbar button{padding:0 .5rem;font-size:.86rem}.role-rich-separator{width:1px;height:22px;background:#39415a;flex:0 0 1px}.role-rich-toolbar::-webkit-scrollbar{height:7px}.role-rich-toolbar::-webkit-scrollbar-track{background:#171b29;border-radius:8px}.role-rich-toolbar::-webkit-scrollbar-thumb{background:#7657c8;border-radius:8px}`;
  document.head.appendChild(style);
  let active = null; const selection = { start:0, end:0 };
  const saveSelection = () => { if(active){selection.start=active.selectionStart;selection.end=active.selectionEnd;} };
  const position = () => { if(!active||!toolbar.classList.contains('is-visible'))return;const r=active.getBoundingClientRect(),h=toolbar.offsetHeight||44;toolbar.style.left=`${Math.max(8,Math.min(r.left,innerWidth-toolbar.offsetWidth-8))}px`;toolbar.style.top=`${r.top>h+10?r.top-h-6:Math.min(innerHeight-h-8,r.bottom+6)}px`; };
  const emit = () => { active.dispatchEvent(new Event('input',{bubbles:true}));active.focus();saveSelection();position(); };
  const replace = (text,start=selection.start,end=selection.end,ss=null,se=null) => { if(!active)return;active.focus();active.setSelectionRange(start,end);active.setRangeText(text,start,end,'end');if(ss!==null)active.setSelectionRange(ss,se);emit(); };
  const selected = () => active ? active.value.slice(selection.start,selection.end) : '';
  const wrapTag = (tag,attrs='') => {const value=selected()||'文字',open=`[${tag}${attrs}]`,close=`[/${tag}]`;replace(open+value+close,selection.start,selection.end,selection.start+open.length,selection.start+open.length+value.length);};
  const lineRange = () => {const value=active.value,start=value.lastIndexOf('\n',Math.max(0,selection.start-1))+1,next=value.indexOf('\n',selection.end);return {start,end:next<0?value.length:next};};
  const lineTag = (tag) => {const range=lineRange();const text=active.value.slice(range.start,range.end).split('\n').map(line=>`[${tag}]${line.replace(/^\[(?:bullet|number|quote)\](.*)\[\/(?:bullet|number|quote)\]$/,'$1')}[/${tag}]`).join('\n');replace(text,range.start,range.end);};
  const clear = () => {const has=Boolean(selected()),value=has?selected():active.value;const clean=value.replace(/\[\/?(?:b|i|size(?:=(?:sm|md|lg|xl))?|bullet|number|quote)\]/gi,'').replace(/\[url=https?:\/\/[^\]]+\]([\s\S]*?)\[\/url\]/gi,'$1').replace(/\[color=#[0-9a-f]{6}\]|\[\/color\]/gi,'');replace(clean,has?selection.start:0,has?selection.end:active.value.length);};
  editor.addEventListener('focusin',e=>{if(e.target.matches('textarea')){active=e.target;saveSelection();toolbar.classList.add('is-visible');requestAnimationFrame(position);}});
  ['select','keyup','mouseup'].forEach(type=>editor.addEventListener(type,saveSelection,true));
  toolbar.addEventListener('pointerdown',e=>{if(!e.target.matches('select'))e.preventDefault();});
  toolbar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!active)return;if(b.dataset.richTag)wrapTag(b.dataset.richTag);else if(b.dataset.richLine)lineTag(b.dataset.richLine);else if(b.hasAttribute('data-rich-link')){const label=selected()||'連結文字',url=prompt('請輸入 https:// 開頭的網址','https://');if(url&&/^https?:\/\//i.test(url))replace(`[url=${url}]${label}[/url]`,selection.start,selection.end);}else if(b.hasAttribute('data-rich-clear'))clear();else if(b.hasAttribute('data-rich-undo')){active.focus();document.execCommand('undo');}else if(b.hasAttribute('data-rich-redo')){active.focus();document.execCommand('redo');}});
  toolbar.querySelector('[data-rich-size]').addEventListener('change',e=>{if(e.target.value)wrapTag('size',`=${e.target.value}`);e.target.value='';});
  document.addEventListener('pointerdown',e=>{if(!toolbar.contains(e.target)&&!editor.contains(e.target))toolbar.classList.remove('is-visible');});addEventListener('resize',position);addEventListener('scroll',position,true);
})();
