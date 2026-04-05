const { useState, useEffect, useMemo, useRef } = React;

// ==========================================
// 輕量級：血染專用「簡體轉繁體」字典 (已移除重複項)
// ==========================================
const S2T_MAP = {
  '缝':'縫', '师':'師', '猎':'獵', '恶':'惡', '阵':'陣', '营':'營', '杀':'殺', '处':'處', '决':'決', '蛊':'蠱',
  '僵':'殭', '丧':'喪', '业':'業', '馆':'館', '员':'員', '妇':'婦', '术':'術', '药':'藥', '农':'農', '长':'長',
  '护':'護', '帮':'幫', '戏':'戲', '脸':'臉', '说':'說', '书':'書', '这':'這', '么':'麼', '没':'沒', '样':'樣',
  '唤':'喚', '醒':'醒', '择':'擇', '两':'兩', '个':'個', '当':'當', '会':'會', '从':'從', '来':'來', '让':'讓',
  '记':'記', '为':'為', '该':'該', '复':'復', '隐':'隱', '离':'離', '异':'異', '钟':'鐘', '表':'錶', '梦':'夢',
  '卖':'賣', '讯':'訊', '杂':'雜', '发':'髮', '门':'門', '间':'間', '关':'關', '头':'頭', '风':'風', '飞':'飛',
  '鸟':'鳥', '龙':'龍', '马':'馬', '鱼':'魚', '鸡':'雞', '阴':'陰', '阳':'陽', '東':'東', '西':'西', '視':'視',
  '覺':'覺', '腦':'腦', '對':'對', '爾':'爾', '亞':'亞', '歐':'歐', '盧':'盧', '卡':'卡', '瑪':'瑪', '薩':'薩',
  '達':'達', '奧':'奧', '克':'克', '圖':'圖', '斯':'斯', '特':'特', '傑':'傑', '普':'普', '羅':'羅', '修':'修',
  '補':'補', '靈':'靈', '瘋':'瘋', '魘':'魘', '屍':'屍', '見':'見', '現':'現', '隨':'隨', '錯':'錯', '誤':'誤',
  '預':'預', '測':'測', '騙':'騙', '瞞':'瞞', '謊':'謊', '言':'言', '竊':'竊', '賊':'賊', '貧':'貧', '窮':'窮',
  '買':'買', '鎮':'鎮', '莊':'莊', '鐵':'鐵', '鑽':'鑽', '銀':'銀', '銅':'銅', '錫':'錫', '鍋':'鍋', '鑰':'鑰',
  '飲':'飲', '飯':'飯店', '辭':'辭', '職':'職', '釀':'釀', '醫':'醫', '劍':'劍', '俠':'俠', '戰':'戰', '斗':'鬥',
  '騎':'騎', '導':'導', '錄':'錄', '詢':'詢', '調':'調', '網':'網', '絡':'絡', '線':'線', '秘':'秘', '碼':'碼',
  '嬰':'嬰', '兒':'兒', '動':'動', '植':'植', '蟲':'蟲', '豬':'豬', '貓':'貓', '龜':'龜', '鱉':'鱉', '鼋':'黻',
  '蝦':'蝦', '貝':'貝', '蠣':'蠣', '蝸':'蝸', '蟻':'蟻', '蠅':'蠅', '蟬':'蟬', '紅':'紅', '儀':'儀', '詭':'詭',
  '計':'計', '詛':'詛', '咒':'咒', '號':'號', '索':'索', '規':'規', '則':'則', '條':'條', '款':'款', '約':'約',
  '協':'協', '議':'議', '態':'態', '鄉':'鄉', '嚇':'嚇', '懼':'懼', '選':'選', '遊':'遊', '開':'開', '結':'結',
  '睜':'睜', '閉':'閉', '確':'確', '認':'認', '獲':'獲', '勝':'勝', '敗':'敗', '輸':'輸', '贏':'贏', '數':'數',
  '過':'過', '棄':'棄', '權':'權', '給':'給', '標':'標', '偽':'偽', '裝':'裝', '裡':'裡', '時':'時', '後':'後',
  '著':'著', '遲':'遲', '壞':'壞', '醜':'醜', '雕':'雕', '貴':'貴', '謠':'謠', '藝':'藝', '傳':'傳', '煉':'煉', 
  '罌':'罌', '氣':'氣', '駛':'駛', '築':'築'
};

const toTraditional = (str) => {
  if (!str) return "";
  return str.split('').map(c => S2T_MAP[c] || c).join('');
};

// ==========================================
// 角色資料庫 (Master Role Database)
// ==========================================
const MASTER_ROLE_DB = [
  {id:"beggar",name:"乞丐",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/beggar.png"},
  {id:"scapegoat",name:"替罪羊",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/scapegoat.png"},
  {id:"gunslinger",name:"槍手",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/gunslinger.png"},
  {id:"thief",name:"竊賊",team:"traveller",firstNight:105,otherNight:110,firstNightReminder:"竊賊指向一名玩家。將負票標記放在那名玩家旁。",otherNightReminder:"竊賊指向一名玩家。將負票標記放在那名玩家旁。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/thief.png"},
  {id:"investigator",name:"調查員",team:"townsfolk",firstNight:7700,otherNight:0,firstNightReminder:"展示那個爪牙角色標記。指向被你標記“爪牙”和“錯誤”的兩名玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/investigator.png"},
  {id:"librarian",name:"圖書管理員",team:"townsfolk",firstNight:7600,otherNight:0,firstNightReminder:"展示那個外來者角色標記。指向被你標記“外來者”和“錯誤”的兩名玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/librarian.png"},
  {id:"washerwoman",name:"洗衣婦",team:"townsfolk",firstNight:7500,otherNight:0,firstNightReminder:"展示那個鎮民角色標記。指向被你標記“鎮民”和“錯誤”的兩名玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/washerwoman.png"},
  {id:"chef",name:"廚師",team:"townsfolk",firstNight:7800,otherNight:0,firstNightReminder:"給他展示數字手勢來告訴他場上鄰座邪惡玩家有多少對。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/chef.png"},
  {id:"empath",name:"共情者",team:"townsfolk",firstNight:7900,otherNight:11000,firstNightReminder:"給他展示數字手勢來告訴他與他鄰近的存活玩家有幾人是邪惡的。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/empath.png"},
  {id:"fortune_teller",name:"占卜師",team:"townsfolk",firstNight:8000,otherNight:11100,firstNightReminder:"讓占卜師選擇兩名玩家。如果其中有惡魔或“幹擾項”，點頭示意，否則搖頭。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/fortune_teller.png"},
  {id:"imp",name:"小惡魔",team:"demon",firstNight:0,otherNight:4900,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/imp.png"},
  {id:"yinyangshi",name:"陰陽師",team:"townsfolk",firstNight:9200,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_4630967694761_bd56d041.jpg"},
  {id:"yaggababble",name:"牙噶巴卜",team:"demon",firstNight:6610,otherNight:7700,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202402/c_9719440568071_03aa8062.jpg"},
  {id:"yangguren",name:"養蠱人",team:"minion",firstNight:0,otherNight:8800,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_1981945308961_042e5529.jpg"}
];

const DAY_ACTION_ROLES = ['slayer', 'savant', 'gossip', 'juggler', 'artist', 'fisherman', 'alsaahir', 'bianlianshi', 'geling', 'yishi', 'princess', 'psychopath', 'goblin', 'vizier', 'gunslinger', 'matron', 'butcher', 'judge', 'gangster', 'jiaohuazi', 'diaomin', 'mutant', 'klutz', 'moonchild', 'golem', '殺手', '博學者', '造謠者', '雜耍藝人', '藝術家', '漁夫', '戲法師', '變臉師', '歌伶', '驛使', '公主', '精神病患者', '哥布林', '維齊爾', '槍手', '女舍監', '屠夫', '法官', '黑幫', '叫花子', '刁民', '畸形秀演員', '呆瓜', '月之子', '魔像'];

const getRoleInputConfig = (role) => {
  const id = (role.baseRoleId || role.id || "").toLowerCase();
  const name = role.name || "";
  const isRole = (ids, names = []) => ids.includes(id) || names.some(n => name.includes(n));

  if (isRole(['yinyangshi'], ['陰陽師'])) return [{ key: 'r1', type: 'role', label: '善良角色 1' }, { key: 'r2', type: 'role', label: '善良角色 2' }, { key: 'r3', type: 'role', label: '邪惡角色 1' }, { key: 'r4', type: 'role', label: '邪惡角色 2' }];
  if (isRole(['washerwoman', 'librarian', 'investigator'], ['洗衣婦', '圖書管理員', '調查員'])) return [{ key: 'p1', type: 'player', label: '玩家 1' }, { key: 'p2', type: 'player', label: '玩家 2' }, { key: 'r1', type: 'role', label: '對應角色' }];
  if (isRole(['chef', 'empath', 'mathematician'], ['廚師', '共情者', '數學家'])) return [{ key: 'num', type: 'number', label: '得知數字' }];
  if (isRole(['mezepheles', 'yaggababble', 'savant', 'artist', 'wizard'], ['靈言師', '牙噶巴卜', '博學者', '藝術家'])) return [{ key: 'word', type: 'text', label: '紀錄內容/短語' }];
  if (isRole(['fortune_teller', 'seamstress'], ['占卜師', '女裁縫'])) return [{ key: 'p1', type: 'player', label: '玩家 1' }, { key: 'p2', type: 'player', label: '玩家 2' }, { key: 'res', type: 'select', label: '結果判斷', options: ['是 (Yes)', '否 (No)'] }];
  return [{ key: 'target', type: 'player', label: '目標對象' }];
};

// ==========================================
// 子組件：行動卡片
// ==========================================
const RoleActionCard = ({ player, reminder, onRecord, players, script }) => {
  const [isRecorded, setIsRecorded] = useState(false);
  const [formData, setFormData] = useState({});
  const [detailNote, setDetailNote] = useState(""); 
  
  const configs = getRoleInputConfig(player.role);

  const handleRecord = () => {
    let targetStr = "";
    const details = [];
    configs.forEach(c => {
      const val = formData[c.key];
      if (!val) return;
      if (['p1', 'target'].includes(c.key)) targetStr = val;
      else if (c.key === 'p2' && targetStr) targetStr += ` & ${val}`;
      else details.push(`${c.label}: ${val}`);
    });
    let finalDetailStr = details.join(" | ");
    if (detailNote.trim()) finalDetailStr = finalDetailStr ? `${finalDetailStr} | ${detailNote}` : detailNote;
    onRecord("使用能力", targetStr || "無", finalDetailStr || "無備註");
    setIsRecorded(true); setFormData({}); setDetailNote("");
    setTimeout(() => setIsRecorded(false), 2000); 
  };

  const imgUrl = player.role?.image || `https://oss.gstonegames.com/data_file/clocktower/role_icon/${player.role?.id}.png`;

  return (
    <div className={`bg-slate-900 border p-4 rounded-3xl flex flex-col md:flex-row gap-4 mb-4 transition-all ${player.isDead ? 'opacity-70 grayscale' : 'border-slate-800 shadow-xl'}`}>
      <div className="flex flex-col items-center shrink-0 w-24">
        <div className="relative">
          <img src={imgUrl} className="w-12 h-12 object-contain" alt="" />
          <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black">{player.id}</span>
        </div>
        <div className="text-xs font-bold mt-1 text-center truncate w-full">{player.role?.name}</div>
        <div className="text-[10px] text-slate-500 text-center truncate w-full">{player.name}</div>
      </div>
      <div className="flex-1 space-y-2">
        {reminder && <div className="text-[11px] text-slate-300 italic bg-black/20 p-2 rounded-lg">能力：{reminder}</div>}
        <div className="grid grid-cols-2 gap-2">
          {configs.map(c => (
            <div key={c.key}>
              {c.type === 'player' ? (
                <select value={formData[c.key] || ""} onChange={e=>setFormData({...formData, [c.key]: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-1.5 text-slate-200 outline-none">
                  <option value="">{c.label}...</option>
                  {players.map(p => <option key={p.id} value={p.name}>{p.id}號 {p.name}</option>)}
                </select>
              ) : c.type === 'role' ? (
                <select value={formData[c.key] || ""} onChange={e=>setFormData({...formData, [c.key]: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-1.5 text-slate-200 outline-none">
                  <option value="">{c.label}...</option>
                  {script.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              ) : c.type === 'select' ? (
                <select value={formData[c.key] || ""} onChange={e=>setFormData({...formData, [c.key]: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-1.5 text-slate-200 outline-none">
                  <option value="">{c.label}...</option>
                  {c.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={c.type || "text"} value={formData[c.key] || ""} placeholder={c.label} onChange={e=>setFormData({...formData, [c.key]: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-1.5 text-slate-200 outline-none" />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-white/5 pt-2">
          <input type="text" value={detailNote} onChange={e=>setDetailNote(e.target.value)} placeholder="自由備註..." className="flex-1 bg-slate-800 border border-slate-700 rounded-lg text-xs p-1.5 text-slate-200 outline-none" />
          <button onClick={handleRecord} className={`px-4 py-1 rounded-xl text-xs font-bold transition-all ${isRecorded ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
            {isRecorded ? "✅ 已寫入" : "寫入"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 主應用程式
// ==========================================
const App = () => {
  const [script, setScript] = useState(() => JSON.parse(localStorage.getItem('botc_script') || '[]'));
  const [players, setPlayers] = useState(() => JSON.parse(localStorage.getItem('botc_players') || '[]'));
  const [gamePhase, setGamePhase] = useState(() => JSON.parse(localStorage.getItem('botc_gamePhase') || '{"type":"Setup","number":0}'));
  const [logs, setLogs] = useState(() => JSON.parse(localStorage.getItem('botc_logs') || '[]'));
  const [playerBarHeight, setPlayerBarHeight] = useState(() => Number(localStorage.getItem('botc_bar_height')) || 240);
  const isResizing = useRef(false);

  const [scriptName, setScriptName] = useState("未命名劇本");
  const [selectingRoleFor, setSelectingRoleFor] = useState(null);
  const [dayAction, setDayAction] = useState({ actor: "", action: "自由記錄", target: "", detail: "" });
  const [demonBluffs, setDemonBluffs] = useState({ r1: "", r2: "", r3: "", recorded: false });
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  // 處理拉伸邏輯
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const newHeight = clientY - 120;
      if (newHeight > 100 && newHeight < 600) setPlayerBarHeight(newHeight);
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = 'default';
      localStorage.setItem('botc_bar_height', playerBarHeight);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [playerBarHeight]);

  useEffect(() => {
    localStorage.setItem('botc_script', JSON.stringify(script));
    localStorage.setItem('botc_players', JSON.stringify(players));
    localStorage.setItem('botc_gamePhase', JSON.stringify(gamePhase));
    localStorage.setItem('botc_logs', JSON.stringify(logs));
  }, [script, players, gamePhase, logs]);

  const recordEvent = (actor, action, target, detail) => {
    const phaseLabel = gamePhase.type === 'Setup' ? '設置' : gamePhase.type === 'Prep' ? '準備' : `第 ${gamePhase.number} ${gamePhase.type === 'Night' ? '夜' : '天'}`;
    const newEvent = { id: Date.now(), time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }), actor, action, target, detail };
    setLogs(prev => {
      const newLogs = [...prev];
      const pIdx = newLogs.findIndex(l => l.phase === phaseLabel);
      if (pIdx >= 0) newLogs[pIdx].events.push(newEvent);
      else newLogs.push({ phase: phaseLabel, events: [newEvent] });
      return newLogs;
    });
  };

  const advancePhase = () => {
    if (gamePhase.type === 'Setup') { setGamePhase({ type: 'Prep', number: 0 }); return; }
    if (gamePhase.type === 'Prep') setGamePhase({ type: 'Night', number: 1 });
    else if (gamePhase.type === 'Night') setGamePhase({ type: 'Day', number: gamePhase.number });
    else setGamePhase({ type: 'Night', number: gamePhase.number + 1 });
    
    const snapshot = players.map(p => `[${p.id}號] ${p.isDead ? '💀 死亡' : '存活'} - (${p.role?.name || '未指派'}) ${p.name}`).join('\n');
    recordEvent('系統', '狀態快照', '全體玩家', snapshot);
  };

  const wakingOrder = useMemo(() => {
    const inPlay = players.filter(p => p.role);
    return gamePhase.number === 1 
      ? inPlay.filter(p => p.role.firstNight > 0).sort((a,b)=>a.role.firstNight - b.role.firstNight)
      : inPlay.filter(p => p.role.otherNight > 0).sort((a,b)=>a.role.otherNight - b.role.otherNight);
  }, [players, gamePhase]);

  const dayActors = useMemo(() => {
    if (gamePhase.type !== 'Day') return [];
    return players.filter(p => p.role && DAY_ACTION_ROLES.some(r => p.role.id.toLowerCase().includes(r.toLowerCase()) || p.role.name.includes(r)));
  }, [players, gamePhase]);

  const exportHistory = (winnerLabel) => {
    let content = `劇本：${scriptName}\n日期：${new Date().toLocaleDateString()}\n獲勝：${winnerLabel}\n\n`;
    logs.forEach(g => {
        content += `=== ${g.phase} ===\n`;
        g.events.forEach(e => {
            content += `[${e.time}] ${e.actor} -> ${e.action} -> ${e.target}${e.detail ? `\n    └ ${e.detail}` : ''}\n`;
        });
        content += "\n";
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `BOTC_Log_${Date.now()}.txt`;
    a.click();
    setShowWinnerModal(false);
  };

  return (
    <div className="h-full bg-slate-950 text-slate-200 flex flex-col relative overflow-hidden font-sans">
      
      {showWinnerModal && (
          <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-indigo-500/30 p-8 rounded-[40px] max-w-sm w-full shadow-2xl text-center">
                  <h2 className="text-xl font-black text-indigo-400 mb-2">📜 結算匯出</h2>
                  <div className="flex flex-col gap-3 mt-4">
                      <button onClick={() => exportHistory("善良獲勝")} className="py-3 bg-sky-600 rounded-2xl font-black text-sm">善良獲勝</button>
                      <button onClick={() => exportHistory("邪惡獲勝")} className="py-3 bg-rose-600 rounded-2xl font-black text-sm">邪惡獲勝</button>
                      <button onClick={() => setShowWinnerModal(false)} className="mt-2 text-xs text-slate-500">取消</button>
                  </div>
              </div>
          </div>
      )}

      <header className="bg-slate-900 border-b border-white/5 p-4 flex justify-between items-center z-20">
        <h1 className="text-lg font-black text-indigo-400">血染覆盤記錄器</h1>
        <div className="flex gap-3">
          <div className="px-4 py-1.5 bg-slate-800 rounded-xl border border-slate-700 text-xs font-black">
            {gamePhase.type === 'Setup' ? '設置中' : `第 ${gamePhase.number} ${gamePhase.type === 'Night' ? '夜' : '天'}`}
          </div>
          <button onClick={advancePhase} className="bg-indigo-600 px-6 py-1.5 rounded-xl font-black text-xs shadow-lg">▶️ 下個階段</button>
        </div>
      </header>

      <div className="bg-slate-900/30 flex flex-col shrink-0">
        <div className="overflow-y-auto p-4 custom-scrollbar" style={{ height: `${playerBarHeight}px` }}>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {players.map(p => (
                    <div key={p.id} className={`p-3 rounded-2xl border-2 text-center relative transition-all ${p.isDead ? 'bg-slate-950 grayscale border-slate-800' : 'bg-slate-800 border-indigo-500/20 shadow-lg'}`}>
                        <button onClick={()=>setSelectingRoleFor(p.id)} className="w-12 h-12 rounded-full bg-slate-950 mx-auto mb-2 flex items-center justify-center overflow-hidden border border-slate-700">
                            {p.role ? <img src={p.role.image} className="w-10 h-10" /> : <span className="opacity-20">+</span>}
                        </button>
                        <div className="text-[10px] font-black text-slate-400 truncate">{p.role?.name || "未分配"}</div>
                        <input value={p.name} onChange={e=>setPlayers(players.map(pl=>pl.id===p.id?{...pl, name:e.target.value}:pl))} className="w-full bg-black/30 rounded-lg px-1 text-[11px] text-center outline-none text-indigo-100 font-bold" />
                        {gamePhase.type !== 'Setup' && <button onClick={()=>setPlayers(players.map(pl=>pl.id===p.id?{...pl, isDead:!pl.isDead}:pl))} className="absolute -top-1 -right-1 text-xs">{p.isDead ? '💀' : '❤️'}</button>}
                    </div>
                ))}
                {gamePhase.type === 'Setup' && <button onClick={()=>setPlayers([...players, {id:players.length+1, name:"", role:null, isDead:false}])} className="border-2 border-dashed border-slate-800 rounded-2xl h-24 flex items-center justify-center text-slate-600">+</button>}
            </div>
        </div>
        <div 
          onPointerDown={(e) => { e.target.setPointerCapture(e.pointerId); isResizing.current = true; document.body.style.cursor = 'ns-resize'; }}
          className="h-8 bg-slate-800/80 hover:bg-indigo-900/30 cursor-ns-resize flex items-center justify-center border-y border-white/5 transition-all group"
        >
          <div className="w-12 h-1 bg-white/10 group-hover:bg-indigo-400/50 rounded-full"></div>
        </div>
      </div>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#020617]">
        <div className="flex-1 p-6 overflow-y-auto border-r border-slate-800 shadow-2xl">
          {gamePhase.type === 'Prep' ? (
            <div className="space-y-6">
                <h2 className="text-xl font-black text-indigo-400">準備階段 - 配置身分</h2>
                <div className="bg-red-950/20 border border-red-900/30 p-5 rounded-3xl space-y-4">
                    <h3 className="text-xs font-black text-red-400">惡魔首夜偽裝</h3>
                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3].map(n => (
                            <select key={n} value={demonBluffs[`r${n}`]} onChange={e => setDemonBluffs({...demonBluffs, [`r${n}`]: e.target.value})} className="bg-slate-900 border border-red-900/40 rounded-xl p-2 text-xs text-white">
                                <option value="">選擇偽裝 {n}</option>
                                {script.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                            </select>
                        ))}
                    </div>
                    <button onClick={()=>{ recordEvent("系統", "偽裝", "惡魔", `不在場角色:${demonBluffs.r1}, ${demonBluffs.r2}, ${demonBluffs.r3}`); setDemonBluffs({...demonBluffs, recorded: true}); }} className="w-full bg-red-900/40 py-2 rounded-xl text-xs font-black shadow-lg">寫入日誌</button>
                </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className={`text-xl font-black ${gamePhase.type === 'Night' ? 'text-indigo-400' : 'text-yellow-400'}`}>{gamePhase.type === 'Night' ? '🌙' : '☀️'} 第 {gamePhase.number} {gamePhase.type === 'Night' ? '夜' : '天'}</h2>
              <div className="space-y-4">
                {(gamePhase.type === 'Night' ? wakingOrder : dayActors).map(p => (
                  <RoleActionCard key={p.id} player={p} reminder={gamePhase.type === 'Night' ? (gamePhase.number === 1 ? p.role.firstNightReminder : p.role.otherNightReminder) : p.role.ability} onRecord={(a, t, d) => recordEvent(p.role.name, a, t, d)} players={players} script={script} />
                ))}
              </div>
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] space-y-4 shadow-inner mt-8">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">📝 自由事件紀錄</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" value={dayAction.actor} onChange={e=>setDayAction({...dayAction, actor:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white" placeholder="發起人" />
                  <input type="text" value={dayAction.action} onChange={e=>setDayAction({...dayAction, action:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white" placeholder="動作" />
                  <input type="text" value={dayAction.target} onChange={e=>setDayAction({...dayAction, target:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white" placeholder="目標" />
                  <input type="text" value={dayAction.detail} onChange={e=>setDayAction({...dayAction, detail:e.target.value})} onKeyPress={e=>e.key==='Enter' && recordEvent(dayAction.actor||'系統', dayAction.action, dayAction.target||'無', dayAction.detail||'')} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white" placeholder="細節" />
                </div>
                <button onClick={()=>{ recordEvent(dayAction.actor||'系統', dayAction.action||'記錄', dayAction.target||'無', dayAction.detail||''); setDayAction({actor:'', action:'自由記錄', target:'', detail:''}); }} className="w-full bg-slate-700 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all">寫入日誌</button>
              </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-[400px] bg-slate-950/50 p-6 overflow-y-auto border-l border-slate-800 flex flex-col relative">
          <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-950/80 backdrop-blur py-2 z-10">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">時間軸 (Timeline)</h3>
            <button onClick={() => setShowWinnerModal(true)} className="text-[10px] text-indigo-400 font-bold hover:underline">匯出文字檔</button>
          </div>
          <div className="space-y-6 pb-20">
            {logs.slice().reverse().map((phase, idx) => (
              <div key={idx} className="relative border-l border-slate-800 pl-6 py-2 animate-fadeIn">
                <div className="absolute -left-1 top-2 w-2 h-2 rounded-full bg-indigo-500"></div>
                <div className="text-[10px] font-black text-indigo-400 mb-4 uppercase">{phase.phase}</div>
                <div className="space-y-3">
                  {phase.events.slice().reverse().map(e => (
                    <div key={e.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                      <div className="flex justify-between text-[9px] text-slate-600 mb-1 font-bold"><span>{e.time}</span><span>{e.actor}</span></div>
                      <div className="text-xs font-black text-slate-200">{e.action} → <span className="text-indigo-300 font-bold">{e.target}</span></div>
                      {e.detail && e.detail !== "無備註" && <div className="text-[10px] text-slate-500 mt-2 italic border-l border-slate-800 pl-2 leading-relaxed">{e.detail}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {selectingRoleFor && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-xl animate-fadeIn">
          <div className="bg-slate-900 w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] border border-slate-700 flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center gap-4">
              <h2 className="font-black text-indigo-300">選擇角色</h2>
              <input placeholder="搜尋..." onChange={e=>setSearchTerm(e.target.value)} className="bg-slate-800 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-white flex-1" />
              <button onClick={()=>setSelectingRoleFor(null)} className="text-slate-400">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-2 md:grid-cols-5 gap-4 custom-scrollbar">
              {MASTER_ROLE_DB.filter(r=>r.name.includes(searchTerm)).map(r => (
                <button key={r.id} onClick={()=>{ setPlayers(players.map(p=>p.id===selectingRoleFor?{...p, role:r}:p)); setSelectingRoleFor(null); }} className="bg-slate-800/50 p-4 rounded-3xl border border-slate-700 flex flex-col items-center hover:bg-indigo-600/20 transition-all group shadow-inner">
                  <img src={r.image} className="w-10 h-10 mb-3 object-contain group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black text-center leading-tight">{r.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 初始化修復
const renderApp = () => {
  const container = document.getElementById('recorder-root');
  if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(<App />);
  }
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}
