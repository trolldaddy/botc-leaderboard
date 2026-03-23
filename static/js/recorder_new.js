const { useState, useEffect, useMemo } = React;

// ==========================================
// 輕量級：血染專用「簡體轉繁體」字典
// ==========================================
const S2T_MAP = {
  '缝':'縫', '师':'師', '猎':'獵', '恶':'惡', '阵':'陣', '营':'營', '杀':'殺', '处':'處', '决':'決', '蛊':'蠱',
  '僵':'殭', '丧':'喪', '业':'業', '馆':'館', '员':'員', '妇':'婦', '术':'術', '药':'藥', '农':'農', '长':'長',
  '护':'護', '帮':'幫', '戏':'戲', '脸':'臉', '说':'說', '书':'書', '这':'這', '么':'麼', '没':'沒', '样':'樣',
  '唤':'喚', '醒':'醒', '择':'擇', '两':'兩', '个':'個', '当':'當', '会':'會', '从':'從', '来':'來', '让':'讓',
  '记':'記', '为':'為', '该':'該', '复':'復', '隐':'隱', '离':'離', '异':'異', '钟':'鐘', '表':'錶', '梦':'夢',
  '卖':'賣', '讯':'訊', '杂':'雜', '发':'髮', '门':'門', '间':'間', '关':'關', '头':'頭', '风':'風', '飞':'飛',
  '鸟':'鳥', '龙':'龍', '马':'馬', '鱼':'魚', '鸡':'雞', '阴':'陰', '阳':'陽', '東':'東', '西':'西', '视':'視',
  '覺':'覺', '腦':'腦', '對':'對', '爾':'爾', '亞':'亞', '歐':'歐', '盧':'盧', '卡':'卡', '瑪':'瑪', '薩':'薩',
  '達':'達', '奧':'奧', '克':'克', '圖':'圖', '斯':'斯', '特':'特', '傑':'傑', '普':'普', '羅':'羅', '修':'修',
  '補':'補', '靈':'靈', '瘋':'瘋', '魘':'魘', '屍':'屍', '見':'見', '現':'現', '隨':'隨', '錯':'錯', '誤':'誤',
  '預':'預', '測':'測', '騙':'騙', '瞞':'瞞', '謊':'謊', '言':'言', '竊':'竊', '賊':'賊', '貧':'貧', '窮':'窮',
  '買':'買', '鎮':'鎮', '莊':'莊', '鐵':'鐵', '鑽':'鑽', '銀':'銀', '銅':'銅', '錫':'錫', '鍋':'鍋', '鑰':'鑰',
  '飲':'飲', '飯':'飯', '辭':'辭', '職':'職', '釀':'釀', '醫':'醫', '劍':'劍', '俠':'俠', '戰':'戰', '斗':'鬥',
  '騎':'騎', '導':'導', '錄':'錄', '詢':'詢', '調':'調', '網':'網', '絡':'絡', '線':'線', '秘':'秘', '碼':'碼',
  '嬰':'嬰', '兒':'兒', '動':'動', '植':'植', '蟲':'蟲', '豬':'豬', '貓':'貓', '龜':'龜', '鱉':'鱉', '鼋':'黿',
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
// 內建全角色參考資料庫 (Master Database)
// ==========================================
const MASTER_ROLE_DB = [
  {id:"beggar",name:"乞丐",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/beggar.png"},
  {id:"scapegoat",name:"替罪羊",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/scapegoat.png"},
  {id:"gunslinger",name:"槍手",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/gunslinger.png"},
  {id:"thief",name:"竊賊",team:"traveller",firstNight:105,otherNight:110,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/thief.png"},
  {id:"bureaucrat",name:"官員",team:"traveller",firstNight:100,otherNight:100,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/bureaucrat.png"},
  {id:"voudon",name:"巫毒師",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/voudon.png"},
  {id:"apprentice",name:"學徒",team:"traveller",firstNight:120,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/apprentice.png"},
  {id:"matron",name:"女舍監",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/matron.png"},
  {id:"judge",name:"法官",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/judge.png"},
  {id:"bishop",name:"主教",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/bishop.png"},
  {id:"deviant",name:"怪咖",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/deviant.png"},
  {id:"bone_collector",name:"集骨者",team:"traveller",firstNight:0,otherNight:140,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/bone_collector.png"},
  {id:"butcher",name:"屠夫",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/butcher.png"},
  {id:"barista",name:"咖啡師",team:"traveller",firstNight:130,otherNight:120,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/barista.png"},
  {id:"harlot",name:"流鶯",team:"traveller",firstNight:0,otherNight:130,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/harlot.png"},
  {id:"gangster",name:"黑幫",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/gangster.png"},
  {id:"jiaohuazi",name:"叫花子",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_4509255308961_63a95d5b.jpg"},
  {id:"diaomin",name:"刁民",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_8385231943171_9383f742.jpg"},
  {id:"gnome",name:"侏儒",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202411/c_2576281040371_3babe7fd.jpg"},
  // 非旅行者角色
  {id:"investigator",name:"調查員",team:"townsfolk",firstNight:7700,otherNight:0},
  {id:"librarian",name:"圖書管理員",team:"townsfolk",firstNight:7600,otherNight:0},
  {id:"washerwoman",name:"洗衣婦",team:"townsfolk",firstNight:7500,otherNight:0},
  {id:"chef",name:"廚師",team:"townsfolk",firstNight:7800,otherNight:0},
  {id:"empath",name:"共情者",team:"townsfolk",firstNight:7900,otherNight:11000},
  {id:"fortune_teller",name:"占卜師",team:"townsfolk",firstNight:8000,otherNight:11100},
  {id:"undertaker",name:"送葬者",team:"townsfolk",firstNight:0,otherNight:11300},
  {id:"monk",name:"僧侶",team:"townsfolk",firstNight:0,otherNight:2200},
  {id:"ravenkeeper",name:"守鴉人",team:"townsfolk",firstNight:0,otherNight:9800},
  {id:"butler",name:"管家",team:"outsider",firstNight:8100,otherNight:11200},
  {id:"poisoner",name:"投毒者",team:"minion",firstNight:4600,otherNight:1400},
  {id:"spy",name:"間諜",team:"minion",firstNight:11700,otherNight:14400},
  {id:"scarlet_woman",name:"紅唇女郎",team:"minion",firstNight:0,otherNight:3700},
  {id:"imp",name:"小惡魔",team:"demon",firstNight:0,otherNight:4900},
  {id:"drunk",name:"酒鬼",team:"outsider",firstNight:0,otherNight:0},
  {id:"marionette",name:"提線木偶",team:"minion",firstNight:3200,otherNight:0},
  {id:"lunatic",name:"瘋子",team:"outsider",firstNight:2300,otherNight:4200},
  {id:"wudaozhe",name:"悟道者",team:"townsfolk",firstNight:0,otherNight:0}
];

// ==========================================
// 輔助函式：window.name 方案
// ==========================================
const loadState = (key, defaultValue) => {
  try {
    const store = window.name ? JSON.parse(window.name) : {};
    if (store[key] !== undefined) return store[key];
  } catch (e) {}
  return defaultValue;
};

const saveState = (key, value) => {
  try {
    const store = window.name ? JSON.parse(window.name) : {};
    store[key] = value;
    window.name = JSON.stringify(store);
  } catch (e) {}
};

// ==========================================
// 子組件：行動卡片
// ==========================================
const RoleActionCard = ({ player, reminder, onRecord, players, script }) => {
  const [isRecorded, setIsRecorded] = useState(false);
  const [formData, setFormData] = useState({});
  const [detailNote, setDetailNote] = useState(""); 
  
  const configs = useMemo(() => {
    const r = player.role;
    if(!r) return [];
    const id = (r.baseRoleId || r.id || "").toLowerCase();
    if(['washerwoman', 'librarian', 'investigator'].includes(id)) return [{ key: 'p1', type: 'player', label: '得知玩家' }, { key: 'r1', type: 'role', label: '角色資訊' }];
    if(['chef', 'empath'].includes(id)) return [{ key: 'num', type: 'number', label: '得知數字' }];
    return [{ key: 'p1', type: 'player', label: '目標對象' }];
  }, [player.role]);

  const handleRecord = () => {
    let targetStr = formData.p1 || "無";
    let detailParts = [];
    if(formData.r1) detailParts.push(`角色:${formData.r1}`);
    if(formData.num) detailParts.push(`數字:${formData.num}`);
    if(detailNote) detailParts.push(detailNote);
    
    onRecord("使用能力", targetStr, detailParts.join(" | ") || "無備註");
    setIsRecorded(true);
    setDetailNote("");
    setTimeout(() => setIsRecorded(false), 2000); 
  };

  const imgUrl = player.role?.image || `https://oss.gstonegames.com/data_file/clocktower/role_icon/${player.role?.id}.png`;

  return (
    <div className={`bg-slate-900 border p-4 rounded-3xl flex flex-col md:flex-row gap-4 mb-4 transition-all ${player.isDead ? 'opacity-70 grayscale' : 'border-slate-800'}`}>
      <div className="flex flex-col items-center shrink-0 w-24">
        <div className="relative">
          <img src={imgUrl} className="w-12 h-12 object-contain" alt="" onError={e=>e.target.style.display='none'} />
          <span className="absolute -top-1 -right-1 bg-slate-800 text-[10px] w-5 h-5 rounded-full flex items-center justify-center border border-slate-700">{player.id}</span>
        </div>
        <div className="text-xs font-bold mt-1 text-center truncate w-full">{player.role?.name}</div>
        <div className="text-[10px] text-slate-500 text-center truncate w-full">{player.name}</div>
      </div>
      <div className="flex-1 space-y-2">
        {reminder && <div className="text-[11px] text-slate-400 italic bg-black/20 p-2 rounded-lg">提醒：{reminder}</div>}
        <div className="grid grid-cols-2 gap-2">
          {configs.map(c => (
            <div key={c.key}>
              {c.type === 'player' ? (
                <select onChange={e=>setFormData({...formData, [c.key]: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-1 text-slate-200 outline-none">
                  <option value="">{c.label}...</option>
                  {players.map(p => <option key={p.id} value={p.name}>{p.id}號 {p.name}</option>)}
                </select>
              ) : c.type === 'role' ? (
                <select onChange={e=>setFormData({...formData, [c.key]: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-1 text-slate-200 outline-none">
                  <option value="">{c.label}...</option>
                  {script.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              ) : (
                <input type="number" placeholder={c.label} onChange={e=>setFormData({...formData, [c.key]: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-1 text-slate-200 outline-none" />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-white/5 pt-2">
          <input type="text" value={detailNote} onChange={e=>setDetailNote(e.target.value)} placeholder="自由備註..." className="flex-1 bg-slate-800 border border-slate-700 rounded-lg text-xs p-1 text-slate-200 outline-none" />
          <button onClick={handleRecord} className={`px-4 py-1 rounded-xl text-xs font-black transition-all ${isRecorded ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
            {isRecorded ? "✅" : "寫入"}
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
  const [script, setScript] = useState(() => loadState('botc_script', [])); 
  const [players, setPlayers] = useState(() => loadState('botc_players', [])); 
  const [gamePhase, setGamePhase] = useState(() => loadState('botc_gamePhase', { type: 'Setup', number: 0 })); 
  const [logs, setLogs] = useState(() => loadState('botc_logs', [])); 
  const [playerCount, setPlayerCount] = useState(() => loadState('botc_playerCount', 12));

  const [scriptName, setScriptName] = useState(() => loadState('botc_scriptName', '未命名劇本'));
  const [gameDate, setGameDate] = useState(() => loadState('botc_gameDate', new Date().toISOString().split('T')[0]));
  const [gameLocation, setGameLocation] = useState(() => loadState('botc_gameLocation', '線上 (Discord)'));
  const [customLocation, setCustomLocation] = useState(() => loadState('botc_customLocation', ''));

  const [selectingRoleFor, setSelectingRoleFor] = useState(null);
  const [hiddenTarget, setHiddenTarget] = useState("");
  const [hiddenValue, setHiddenValue] = useState("");
  const [demonBluffs, setDemonBluffs] = useState({ r1: "", r2: "", r3: "", recorded: false });

  // ★ 合併當前劇本角色與所有旅行者角色
  const allAvailableRoles = useMemo(() => {
    const travellers = MASTER_ROLE_DB.filter(r => r.team === 'traveller');
    const combined = [...script];
    travellers.forEach(tr => {
      if (!combined.some(r => r.id === tr.id)) combined.push(tr);
    });
    return combined;
  }, [script]);

  useEffect(() => {
    saveState('botc_script', script);
    saveState('botc_players', players);
    saveState('botc_gamePhase', gamePhase);
    saveState('botc_logs', logs);
    saveState('botc_playerCount', playerCount);
    saveState('botc_scriptName', scriptName);
    saveState('botc_gameDate', gameDate);
    saveState('botc_gameLocation', gameLocation);
    saveState('botc_customLocation', customLocation);
  }, [script, players, gamePhase, logs, playerCount, scriptName, gameDate, gameLocation, customLocation]);

  const recordEvent = (actor, action, target, detail) => {
    const currentPhase = gamePhase.type === 'Setup' ? '設置' : gamePhase.type === 'Prep' ? '準備' : `第 ${gamePhase.number} ${gamePhase.type === 'Night' ? '夜' : '天'}`;
    const newEvent = { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }), actor, action, target, detail };
    setLogs(prev => {
      const copy = [...prev];
      const idx = copy.findIndex(l => l.phase === currentPhase);
      if (idx >= 0) copy[idx].events.push(newEvent);
      else copy.push({ phase: currentPhase, events: [newEvent] });
      return copy;
    });
  };

  // ★ 新增玩家功能 (中途加入)
  const addNewPlayer = () => {
    const nextId = players.length > 0 ? Math.max(...players.map(p => p.id)) + 1 : 1;
    const newPlayer = { id: nextId, name: `新玩家 ${nextId}`, role: null, isDead: false, hiddenRole: "" };
    setPlayers([...players, newPlayer]);
    setPlayerCount(players.length + 1);
    if (gamePhase.type !== 'Setup') {
      recordEvent("系統", "玩家加入", newPlayer.name, "中途加入");
    }
  };

  const advancePhase = () => {
    if (gamePhase.type === 'Setup') {
      setGamePhase({ type: 'Prep', number: 0 });
      setLogs([...logs, { phase: '準備階段', events: [] }]);
      return;
    }

    const snapshot = players.map(p => `[${p.id}號] ${p.isDead ? '💀 死亡' : '存活'} - (${p.role?.name || '未指派'}${p.hiddenRole ? '/' + p.hiddenRole : ''}) ${p.name}`).join('\n');
    const snapshotEvent = { id: Date.now() + Math.random(), actor: '系統', action: '狀態快照', target: '全體', detail: snapshot };
    const copy = [...logs];
    if (copy.length > 0) copy[copy.length - 1].events.push(snapshotEvent);

    let next = { ...gamePhase };
    if (gamePhase.type === 'Prep') { next.type = 'Night'; next.number = 1; }
    else if (gamePhase.type === 'Night') { next.type = 'Day'; }
    else { next.type = 'Night'; next.number++; }
    
    setGamePhase(next);
    setLogs([...copy, { phase: `第 ${next.number} ${next.type === 'Night' ? '夜' : '天'}`, events: [] }]);
  };

  const moveEvent = (pIdx, eId, direction) => {
    setLogs(prev => {
      const copy = [...prev];
      const events = [...copy[pIdx].events];
      const idx = events.findIndex(e => e.id === eId);
      if (direction === 'up' && idx > 0) [events[idx], events[idx-1]] = [events[idx-1], events[idx]];
      if (direction === 'down' && idx < events.length - 1) [events[idx], events[idx+1]] = [events[idx+1], events[idx]];
      copy[pIdx].events = events;
      return copy;
    });
  };

  const deleteLog = (pIdx, eId) => {
    setLogs(prev => {
      const copy = [...prev];
      copy[pIdx].events = copy[pIdx].events.filter(e => e.id !== eId);
      return copy;
    });
  };

  const exportHistory = () => {
    const loc = gameLocation === '其他' ? customLocation : gameLocation;
    let header = `劇本名稱：${scriptName}\n遊戲日期：${gameDate}\n遊戲地點：${loc}\n\n`;
    const body = logs.map(p => {
      const evs = p.events.map(e => {
        if (e.action === '狀態快照') return `\n【當前狀態】\n${e.detail}\n`;
        return `  ${e.actor} -> ${e.action} -> ${e.target}\n    └ ${e.detail}`;
      }).join('\n');
      return `=== ${p.phase} ===\n${evs || '  (無紀錄)'}`;
    }).join('\n\n');
    const blob = new Blob([header + body], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `覆盤紀錄_${gameDate}.txt`;
    a.click();
  };

  const handleReset = () => {
    if (confirm("🔄 確定要重置所有資料嗎？")) {
      window.name = "";
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleScriptUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        const roles = Array.isArray(json) ? json : (json.roles || []);
        const meta = roles.find(r => r.id === '_meta');
        if (meta && meta.name) setScriptName(meta.name);
        const parsed = roles.filter(r => r.id !== '_meta').map(r => {
            const db = MASTER_ROLE_DB.find(d => d.id === r.id);
            return { ...r, ...db, name: toTraditional(r.name || r.id) };
        });
        setScript(parsed);
      } catch(err) { alert("JSON 格式錯誤！"); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-full flex flex-col bg-[#020617] text-slate-200">
      
      {/* 頂部資訊列 */}
      <div className="bg-[#0f172a] border-b border-white/10 p-3 flex flex-wrap items-center gap-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
            <input type="text" value={scriptName} onChange={e=>setScriptName(e.target.value)} className="bg-black/40 border border-slate-700 rounded px-2 py-1 text-xs w-32 focus:border-indigo-500 outline-none" placeholder="劇本名稱" />
            <input type="date" value={gameDate} onChange={e=>setGameDate(e.target.value)} className="bg-black/40 border border-slate-700 rounded px-2 py-1 text-xs outline-none" />
            <select value={gameLocation} onChange={e=>setGameLocation(e.target.value)} className="bg-black/40 border border-slate-700 rounded px-1 py-1 text-xs outline-none">
                <option value="線上 (Discord)">線上 (Discord)</option>
                <option value="台北">台北</option>
                <option value="台中">台中</option>
                <option value="高雄">高雄</option>
                <option value="其他">其他...</option>
            </select>
            {gameLocation === '其他' && <input type="text" placeholder="自訂地點" value={customLocation} onChange={e=>setCustomLocation(e.target.value)} className="bg-black/40 border border-slate-700 rounded px-2 py-1 text-xs w-24" />}
        </div>
        
        <div className="flex gap-2 ml-auto">
          <button onClick={addNewPlayer} className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-3 py-1 rounded text-xs font-bold hover:bg-emerald-900 transition-all">➕ 新增玩家</button>
          <label className="bg-slate-800 px-3 py-1 rounded text-xs font-bold cursor-pointer hover:bg-slate-700 transition-colors border border-white/10">📜 載入劇本<input type="file" accept=".json" onChange={handleScriptUpload} className="hidden" /></label>
          <button onClick={exportHistory} className="bg-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-500 transition-colors">📥 匯出紀錄</button>
          <button onClick={handleReset} className="bg-red-950/50 text-red-400 px-2 py-1 rounded text-xs font-bold hover:bg-red-900 border border-red-900/20">🔄 重置</button>
        </div>
      </div>

      <div className="bg-[#0f172a] border-b border-slate-800 p-2 shrink-0 flex items-center justify-between z-10 shadow-md">
        <div className="flex items-center gap-2 px-3">
          {gamePhase.type === 'Setup' && (
            <div className="flex items-center bg-slate-800 rounded-lg px-2 py-1 border border-slate-700">
                <span className="text-[10px] mr-2 opacity-70 uppercase font-black">Initial Size:</span>
                <select value={playerCount} onChange={e=>{
                    const c = Number(e.target.value);
                    setPlayerCount(c);
                    setPlayers(Array.from({length:c}, (_,i)=>({id:i+1, name:`玩家 ${i+1}`, role:null, isDead:false})));
                }} className="bg-transparent outline-none font-bold text-indigo-400 text-xs">
                    {[...Array(11)].map((_,i)=><option key={i+5} value={i+5}>{i+5}人</option>)}
                </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-4 py-1.5 rounded-xl border flex items-center gap-2 ${gamePhase.type === 'Setup' ? 'bg-slate-800 border-slate-700 text-slate-300' : gamePhase.type === 'Prep' ? 'bg-purple-950/40 border-purple-800/50 text-purple-300' : gamePhase.type === 'Night' ? 'bg-indigo-950/40 border-indigo-800/50 text-indigo-300' : 'bg-yellow-950/40 border-yellow-800/50 text-yellow-300'}`}>
            <span className="font-black text-sm uppercase">
              {gamePhase.type === 'Setup' ? 'Setup' : gamePhase.type === 'Prep' ? 'Pre-game' : `Phase: ${gamePhase.number}${gamePhase.type === 'Night' ? 'N' : 'D'}`}
            </span>
          </div>
          <button onClick={advancePhase} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-1.5 rounded-xl font-black transition-all shadow-lg active:scale-95">
            {gamePhase.type === 'Setup' ? "進入準備" : gamePhase.type === 'Prep' ? "第一夜開始" : "進入下個階段"}
          </button>
        </div>
      </div>

      <div className="bg-[#0f172a]/50 border-b border-slate-800 p-4 shrink-0 shadow-inner w-full overflow-y-auto max-h-[30vh] custom-scrollbar">
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {players.map((p) => (
            <div key={p.id} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all relative ${p.isDead ? 'bg-slate-950/80 border-slate-800 grayscale' : p.role ? 'bg-slate-800 border-indigo-500/30' : 'bg-slate-800/50 border-dashed border-slate-600'}`}>
              <div className="absolute -top-2 -left-2 w-6 h-6 bg-slate-800 text-slate-300 text-[11px] font-black rounded-full flex items-center justify-center border border-slate-600 shadow-lg z-10">{p.id}</div>
              {gamePhase.type !== 'Setup' && gamePhase.type !== 'Prep' && (
                <button onClick={() => togglePlayerDead(p.id)} className={`absolute -top-2 -right-2 p-1.5 rounded-full shadow-lg border ${p.isDead ? 'bg-slate-700 text-slate-400 border-slate-600' : 'bg-red-900/80 text-red-400 border-red-700 hover:scale-110 z-10'}`}>💀</button>
              )}
              <button onClick={() => setSelectingRoleFor(p.id)} className="w-12 h-12 rounded-full bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden hover:border-indigo-500 transition-all">
                {p.role ? <img src={p.role.image || `https://oss.gstonegames.com/data_file/clocktower/role_icon/${p.role.id}.png`} className="w-10 h-10 object-contain" /> : "+"}
              </button>
              <div className="text-[9px] font-black text-slate-400 text-center truncate w-full">
                {p.role ? p.role.name : '未指派'}
                {p.hiddenRole && <span className="text-purple-400 ml-1">({p.hiddenRole})</span>}
              </div>
              <input type="text" value={p.name} onChange={(e) => updatePlayerName(p.id, e.target.value)} className="w-full bg-black/40 text-center text-[10px] font-bold py-1 rounded outline-none border border-transparent focus:border-indigo-500" />
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 bg-[#020617]">
        <div className="flex-1 min-h-0 p-4 overflow-y-auto custom-scrollbar border-r border-white/5">
          {gamePhase.type === 'Setup' ? (
            <div className="h-full flex flex-col items-center justify-center opacity-40">
              <p>請完成座位與角色指派...</p>
            </div>
          ) : gamePhase.type === 'Prep' ? (
            <div className="space-y-6">
                <div className="bg-purple-950/20 border border-purple-900/30 p-5 rounded-3xl shadow-lg mt-6">
                    <h3 className="text-sm font-black text-purple-400 mb-4">🎭 指派隱藏身分</h3>
                    <div className="flex gap-3">
                      <select value={hiddenTarget} onChange={e => setHiddenTarget(e.target.value)} className="flex-1 bg-slate-900 border border-purple-900/50 rounded-xl px-3 py-2 text-xs text-slate-200">
                        <option value="">選擇玩家...</option>
                        {players.map(p => <option key={p.id} value={p.id}>{p.id}號 {p.name}</option>)}
                      </select>
                      <select value={hiddenValue} onChange={e => setHiddenValue(e.target.value)} className="w-32 bg-slate-900 border border-purple-900/50 rounded-xl px-3 py-2 text-xs text-slate-200">
                        <option value="">身分...</option>
                        <option value="酒鬼">酒鬼</option>
                        <option value="提線木偶">提線木偶</option>
                        <option value="瘋子">瘋子</option>
                        <option value="悟道者">悟道者</option>
                      </select>
                    </div>
                    <button onClick={() => {
                        if (!hiddenTarget || !hiddenValue) return;
                        const p = players.find(x => x.id === Number(hiddenTarget));
                        if (p) {
                          setPlayers(players.map(x => x.id === p.id ? { ...x, hiddenRole: hiddenValue } : x));
                          recordEvent("系統", "指派身分", p.name, `實際：${hiddenValue}`);
                        }
                      }} className="mt-4 w-full bg-purple-900/50 text-purple-200 font-black py-2 rounded-xl text-xs">確認標記</button>
                </div>
                <div className="bg-red-950/20 border border-red-900/30 p-5 rounded-3xl shadow-lg">
                    <h3 className="text-sm font-black text-red-400 mb-4">💀 惡魔首夜偽裝</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3].map(i => (
                        <select key={i} onChange={e => setDemonBluffs({...demonBluffs, [`r${i}`]: e.target.value})} className="bg-slate-900 border border-red-900/50 rounded-xl px-3 py-2 text-xs text-slate-200">
                          <option value="">選擇...</option>
                          {script.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                        </select>
                      ))}
                    </div>
                    <button onClick={() => recordEvent("系統", "給予偽裝", "惡魔", `不在場角色：${demonBluffs.r1}, ${demonBluffs.r2}, ${demonBluffs.r3}`)} className="mt-4 w-full bg-red-900/40 text-red-200 font-black py-2 rounded-xl text-xs">寫入日誌</button>
                </div>
            </div>
          ) : (
            <div className="space-y-4">
               {players.filter(p => p.role).map(p => (
                 <RoleActionCard key={p.id} player={p} players={players} script={script} onRecord={(ac, ta, de) => recordEvent(p.role.name, ac, ta, de)} />
               ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 bg-black/20 p-4 overflow-y-auto custom-scrollbar border-l border-white/5">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Timeline (舊 -> 新)</h3>
          {logs.map((group, pIdx) => (
            <div key={pIdx} className="mb-8 relative border-l border-white/5 pl-4 animate-fadeIn">
              <div className="text-[10px] bg-indigo-900/40 text-indigo-300 px-2 py-0.5 rounded inline-block mb-4 font-black">{group.phase}</div>
              {group.events.map((event) => (
                <div key={event.id} className="text-xs mb-4 group relative">
                  <div className="flex gap-2 items-center">
                    <span className="text-[10px] text-slate-600 shrink-0">{event.time}</span>
                    <span className="text-indigo-300 font-bold">{event.actor}</span>
                    <span className="text-slate-600">→</span>
                    <span className="text-emerald-400 font-bold">{event.target}</span>
                    <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <button onClick={()=>moveEvent(pIdx, event.id, 'up')} className="hover:text-white">⬆️</button>
                      <button onClick={()=>moveEvent(pIdx, event.id, 'down')} className="hover:text-white">⬇️</button>
                      <button onClick={()=>deleteLog(pIdx, event.id)} className="text-red-400 ml-1 hover:scale-125 transition-transform text-[10px]">✖</button>
                    </div>
                  </div>
                  {event.detail && <div className="pl-12 text-slate-500 text-[11px] leading-relaxed">└ {event.detail}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>

      {selectingRoleFor && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 backdrop-blur-md animate-fadeIn">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[80vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-900">
                    <h2 className="font-bold text-slate-300">為玩家指派角色</h2>
                    <button onClick={()=>setSelectingRoleFor(null)} className="text-slate-500 hover:text-white text-xl">✖</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 custom-scrollbar">
                    {/* 使用合併後的 allAvailableRoles */}
                    {allAvailableRoles.map(r => (
                        <button key={r.id} onClick={()=>{
                            setPlayers(players.map(x=>x.id===selectingRoleFor?{...x, role:r}:x));
                            setSelectingRoleFor(null);
                        }} className="bg-slate-800/50 p-2 rounded-xl border border-white/5 hover:bg-indigo-900/40 hover:border-indigo-500 transition-all flex flex-col items-center gap-1 group">
                            <img src={r.image || `https://oss.gstonegames.com/data_file/clocktower/role_icon/${r.id}.png`} className="w-10 h-10 object-contain group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-white">{r.name}</span>
                            <span className="text-[8px] opacity-40 uppercase">{r.team === 'traveller' ? '旅行者' : ''}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('recorder-root'));
root.render(<App />);
