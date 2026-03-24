const { useState, useEffect, useMemo } = React;

// 從外部 window 對象取得拆分出去的數據與函式
const { MASTER_ROLE_DB, DAY_ACTION_ROLES, toTraditional, getRoleInputConfig } = window;

// ==========================================
// 角色行動卡片組件
// ==========================================
const RoleActionCard = ({ player, reminder, onRecord, players, script }) => {
  const [isRecorded, setIsRecorded] = useState(false);
  const [formData, setFormData] = useState({});
  const [detailNote, setDetailNote] = useState(""); 
  
  // 呼叫拆分出的配置邏輯
  const configs = getRoleInputConfig(player.role);

  const handleInputChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleRecord = () => {
    let targetStr = "";
    const details = [];

    configs.forEach(c => {
      const val = formData[c.key];
      if (!val) return;
      if (['p1', 'p2', 'p3', 'target'].includes(c.key)) {
        targetStr = targetStr ? `${targetStr} & ${val}` : val;
      } else {
        details.push(`${c.label}: ${val}`);
      }
    });

    let finalDetailStr = details.join(" | ");
    if (detailNote.trim()) {
      finalDetailStr = finalDetailStr ? `${finalDetailStr} | ${detailNote}` : detailNote;
    }

    onRecord("使用能力", targetStr || "無", finalDetailStr || "無備註");
    setIsRecorded(true);
    setTimeout(() => setIsRecorded(false), 2000); 
  };

  const cleanName = player.role.baseRoleId || player.role.id.replace(/_/g, '').toLowerCase();
  const imgUrl = player.role.image || `https://raw.githubusercontent.com/trolldaddy/botc_overlay/48e8573061c16d172912dc9e5aef5e07dac64a62/public/Allicon/240px-${cleanName}.png`;

  return (
    <div className="bg-slate-900 border border-slate-700 p-4 rounded-3xl flex flex-col md:flex-row gap-4 mb-3 transition-all">
      <div className="flex flex-col items-center justify-center gap-1 md:w-32 shrink-0 border-b md:border-b-0 md:border-r border-slate-700/50 pb-4 md:pb-0">
        <img src={imgUrl} className="w-12 h-12 object-contain mb-1" alt="" onError={(e)=>e.target.style.display='none'} />
        <h3 className="font-black text-sm text-indigo-100 text-center leading-tight">{player.role.name}</h3>
        <span className="text-[10px] text-slate-400 font-bold text-center">{player.name}</span>
      </div>

      <div className="flex-1 flex flex-col justify-between gap-3">
        <div className="text-[11px] text-slate-400 bg-black/30 p-2.5 rounded-xl border-l-2 border-indigo-500/50 italic">
          提醒：{reminder}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {configs.map((config) => (
            <div key={config.key} className="flex flex-col">
              <label className="text-[9px] font-black text-slate-500 uppercase mb-1">{config.label}</label>
              {config.type === 'player' && (
                <select value={formData[config.key] || ""} onChange={(e) => handleInputChange(config.key, e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-xs text-slate-200">
                  <option value="">選擇玩家...</option>
                  {players.filter(p => p.name).map(p => <option key={p.id} value={p.name}>{p.id}號 - {p.name}</option>)}
                </select>
              )}
              {config.type === 'role' && (
                <select value={formData[config.key] || ""} onChange={(e) => handleInputChange(config.key, e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-xs text-slate-200">
                  <option value="">選擇角色...</option>
                  {script.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              )}
              {config.type === 'select' && (
                <select value={formData[config.key] || ""} onChange={(e) => handleInputChange(config.key, e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-xs text-slate-200">
                  <option value="">請選擇...</option>
                  {config.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}
              {(config.type === 'number' || config.type === 'text') && (
                <input type={config.type} value={formData[config.key] || ""} onChange={(e) => handleInputChange(config.key, e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200" placeholder="填寫資料..." />
              )}
            </div>
          ))}
        </div>
        
        <div className="flex gap-2 items-stretch pt-2">
          <input type="text" value={detailNote} onChange={(e) => setDetailNote(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200" placeholder="額外備註..." />
          <button onClick={handleRecord} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${isRecorded ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500'} text-white`}>
            {isRecorded ? '✅ 已紀錄' : '寫入日誌'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 主應用組件
// ==========================================
const App = () => {
  const [script, setScript] = useState(() => JSON.parse(localStorage.getItem('botc_script') || '[]'));
  const [players, setPlayers] = useState(() => JSON.parse(localStorage.getItem('botc_players') || '[]'));
  const [gamePhase, setGamePhase] = useState(() => JSON.parse(localStorage.getItem('botc_gamePhase') || '{"type": "Setup", "number": 0}'));
  const [logs, setLogs] = useState(() => JSON.parse(localStorage.getItem('botc_logs') || '[]'));

  useEffect(() => {
    localStorage.setItem('botc_script', JSON.stringify(script));
    localStorage.setItem('botc_players', JSON.stringify(players));
    localStorage.setItem('botc_gamePhase', JSON.stringify(gamePhase));
    localStorage.setItem('botc_logs', JSON.stringify(logs));
  }, [script, players, gamePhase, logs]);

  const handleScriptUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        const rawRoles = Array.isArray(json) ? json : (json.roles || []);
        const parsedRoles = rawRoles.map(item => {
          const roleId = typeof item === 'string' ? item : item.id;
          if (roleId === '_meta') return null;
          
          // 智慧搜尋資料庫
          let dbRole = MASTER_ROLE_DB.find(r => r.id === roleId);
          const tName = toTraditional(item.name || "");
          if (!dbRole && tName) dbRole = MASTER_ROLE_DB.find(r => r.name === tName);

          return {
            id: roleId,
            baseRoleId: dbRole?.id || roleId,
            name: dbRole?.name || tName || roleId,
            team: dbRole?.team || item.team || "townsfolk",
            firstNight: dbRole?.firstNight || item.firstNight || 0,
            otherNight: dbRole?.otherNight || item.otherNight || 0,
            firstNightReminder: dbRole?.firstNightReminder || item.firstNightReminder || "",
            otherNightReminder: dbRole?.otherNightReminder || item.otherNightReminder || "",
            image: dbRole?.image || item.image || "",
            ability: dbRole?.ability || toTraditional(item.ability || "")
          };
        }).filter(Boolean);
        setScript(parsedRoles);
      } catch (err) { alert("劇本讀取失敗"); }
    };
    reader.readAsText(file);
  };

  const dayActors = useMemo(() => {
    if (gamePhase.type !== 'Day') return [];
    return players.filter(p => p.role && DAY_ACTION_ROLES.some(role => 
      p.role.id.toLowerCase().includes(role.toLowerCase()) || p.role.name.includes(role)
    ));
  }, [players, gamePhase]);

  const wakingOrder = useMemo(() => {
    if (gamePhase.type !== 'Night') return [];
    return players
      .filter(p => p.role && (gamePhase.number === 1 ? p.role.firstNight > 0 : p.role.otherNight > 0))
      .sort((a, b) => gamePhase.number === 1 ? a.role.firstNight - b.role.firstNight : a.role.otherNight - b.role.otherNight);
  }, [players, gamePhase]);

  const recordEvent = (actor, action, target, detail) => {
    const phaseLabel = gamePhase.type === 'Setup' ? '設置' : `第 ${gamePhase.number} ${gamePhase.type === 'Night' ? '夜' : '天'}`;
    const newEvent = { id: Date.now(), time: new Date().toLocaleTimeString(), actor, action, target, detail };
    setLogs(prev => {
      const newLogs = [...prev];
      const phaseIdx = newLogs.findIndex(l => l.phase === phaseLabel);
      if (phaseIdx >= 0) newLogs[phaseIdx].events.unshift(newEvent);
      else newLogs.unshift({ phase: phaseLabel, events: [newEvent] });
      return newLogs;
    });
  };

  return (
    <div className="h-full bg-slate-950 text-slate-200 flex flex-col overflow-hidden">
      <header className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
        <h1 className="font-black text-xl">血染覆盤記錄器</h1>
        <div className="flex gap-2">
            <input type="file" onChange={handleScriptUpload} className="hidden" id="script-upload" />
            <label htmlFor="script-upload" className="btn btn-primary cursor-pointer text-xs">載入劇本</label>
            <button onClick={() => setGamePhase(prev => ({...prev, type: prev.type === 'Night' ? 'Day' : 'Night', number: prev.type === 'Day' ? prev.number + 1 : prev.number}))} className="btn bg-indigo-600 text-white text-xs">下一階段</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {gamePhase.type === 'Night' && (
          <div className="space-y-4">
            <h2 className="font-bold text-indigo-400">🌙 第 {gamePhase.number} 夜 喚醒順序</h2>
            {wakingOrder.map(p => (
              <RoleActionCard 
                key={p.id} 
                player={p} 
                reminder={gamePhase.number === 1 ? p.role.firstNightReminder : p.role.otherNightReminder} 
                onRecord={(act, tar, det) => recordEvent(p.role.name, act, tar, det)}
                players={players}
                script={script}
              />
            ))}
          </div>
        )}

        {gamePhase.type === 'Day' && (
          <div className="space-y-4">
            <h2 className="font-bold text-yellow-400">☀️ 第 {gamePhase.number} 天 日間行動</h2>
            {dayActors.map(p => (
              <RoleActionCard 
                key={p.id} 
                player={p} 
                reminder={p.role.ability} 
                onRecord={(act, tar, det) => recordEvent(p.role.name, act, tar, det)}
                players={players}
                script={script}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('recorder-root'));
root.render(<App />);
