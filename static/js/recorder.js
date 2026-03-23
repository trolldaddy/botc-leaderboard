// /js/recorder.js

(function() {
    // 確保 React 已經載入，如果沒載入就報錯提醒
    if (typeof React === 'undefined') {
        console.error("React is not loaded! Please check your script tags in HTML.");
        return;
    }

    const { useState, useEffect, useMemo } = React;

    // 子組件：行動卡片
    const RoleActionCard = ({ player, reminder, onRecord, players, script }) => {
        const [isRecorded, setIsRecorded] = useState(false);
        const [formData, setFormData] = useState({});
        const [detailNote, setDetailNote] = useState(""); 
        
        // 呼叫外部 roleConfig.js 裡的函數，增加安全判斷
        const configs = typeof getRoleInputConfig === 'function' ? getRoleInputConfig(player.role) : [];

        const handleInputChange = (key, value) => {
            setFormData(prev => ({ ...prev, [key]: value }));
        };

        const handleRecord = () => {
            let targetStr = "";
            const details = [];

            configs.forEach(c => {
                const val = formData[c.key];
                if (!val) return;

                if (c.key === 'p1' || c.key === 'target') {
                    targetStr = val;
                } else if (c.key === 'p2' && targetStr) {
                    targetStr += ` & ${val}`;
                } else if (c.key === 'p3' && targetStr) {
                    targetStr += ` & ${val}`;
                } else {
                    details.push(`${c.label}: ${val}`);
                }
            });

            let finalDetailStr = details.join(" | ");
            if (detailNote.trim()) {
                finalDetailStr = finalDetailStr ? `${finalDetailStr} | ${detailNote}` : detailNote;
            }
            if (!finalDetailStr) finalDetailStr = "無備註";

            onRecord("使用能力", targetStr || "無", finalDetailStr);
            
            setIsRecorded(true);
            setFormData({}); 
            setDetailNote(""); 
            setTimeout(() => setIsRecorded(false), 2000); 
        };

        const cleanName = player.role.id.replace(/_/g, '').toLowerCase();
        const imgUrl = player.role.image || `https://raw.githubusercontent.com/trolldaddy/botc_overlay/48e8573061c16d172912dc9e5aef5e07dac64a62/public/Allicon/240px-${cleanName}.png`;

        return (
            <div className={`bg-[#0f172a] border p-4 rounded-3xl flex flex-col md:flex-row gap-4 transition-all mb-4 ${player.isDead ? 'border-red-900/50 opacity-70' : 'border-slate-700'}`}>
                <div className="flex flex-col items-center justify-center gap-1 md:w-32 shrink-0 border-b md:border-b-0 md:border-r border-slate-700/50 pb-4 md:pb-0 md:pr-4">
                    <div className="relative">
                        <img src={imgUrl} className="w-16 h-16 object-contain mb-1" alt="" onError={(e)=>e.target.style.display='none'} />
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-slate-800 text-slate-300 text-[10px] font-black rounded-full flex items-center justify-center border border-slate-600 shadow-md">
                            {player.id}
                        </div>
                    </div>
                    <h3 className="font-black text-sm text-indigo-100 text-center leading-tight">{player.role.name}</h3>
                    <span className="text-[10px] text-slate-400 font-bold text-center">{player.name}</span>
                    {player.isDead && <span className="text-[10px] bg-red-900/50 text-red-400 px-2 py-0.5 rounded font-black mt-1 inline-block">死亡</span>}
                </div>

                <div className="flex-1 flex flex-col justify-between gap-3">
                    <div>
                        {reminder && (
                            <div className="text-[11px] text-slate-400 bg-black/30 p-2.5 rounded-xl border-l-2 border-indigo-500/50 italic leading-relaxed mb-2">
                                提醒：{reminder}
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {configs.map((config) => (
                                <div key={config.key} className="flex flex-col">
                                    <label className="text-[9px] font-black text-slate-500 uppercase mb-1">{config.label}</label>
                                    {config.type === 'player' && (
                                        <select value={formData[config.key] || ""} onChange={(e) => handleInputChange(config.key, e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-slate-200 outline-none">
                                            <option value="">選擇玩家...</option>
                                            {players.map(p => <option key={p.id} value={p.name}>{p.id} 號 - {p.name}</option>)}
                                        </select>
                                    )}
                                    {config.type === 'role' && (
                                        <select value={formData[config.key] || ""} onChange={(e) => handleInputChange(config.key, e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-slate-200 outline-none">
                                            <option value="">選擇角色...</option>
                                            {script.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                        </select>
                                    )}
                                    {/* 更多類型可擴充 */}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2 items-stretch pt-2 border-t border-slate-800/50">
                        <input type="text" value={detailNote} onChange={(e) => setDetailNote(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none" placeholder="結果 / 備註..." />
                        <button onClick={handleRecord} className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${isRecorded ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                            {isRecorded ? "✅" : "寫入"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // 輔助函式：LocalStorage 讀寫
    const loadState = (key, defaultValue) => {
        try {
            const saved = localStorage.getItem(key);
            return saved !== null ? JSON.parse(saved) : defaultValue;
        } catch (e) { return defaultValue; }
    };
    const saveState = (key, value) => {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    };

    // 主應用程式
    const App = () => {
        const [script, setScript] = useState(() => loadState('botc_script', []));
        const [players, setPlayers] = useState(() => loadState('botc_players', []));
        const [gamePhase, setGamePhase] = useState(() => loadState('botc_gamePhase', { type: 'Setup', number: 0 }));
        const [logs, setLogs] = useState(() => loadState('botc_logs', []));
        const [playerCount, setPlayerCount] = useState(() => loadState('botc_playerCount', 8));
        const [scriptName, setScriptName] = useState(() => loadState('botc_scriptName', '未知劇本'));
        const [gameDate, setGameDate] = useState(() => loadState('botc_gameDate', new Date().toISOString().split('T')[0]));
        const [gameLocation, setGameLocation] = useState(() => loadState('botc_gameLocation', '線上 (Discord)'));
        const [editingLog, setEditingLog] = useState(null);

        // 即時同步到 LocalStorage
        useEffect(() => { saveState('botc_players', players); }, [players]);
        useEffect(() => { saveState('botc_gamePhase', gamePhase); }, [gamePhase]);
        useEffect(() => { saveState('botc_logs', logs); }, [logs]);
        useEffect(() => { saveState('botc_scriptName', scriptName); }, [scriptName]);

        const recordEvent = (actor, action, target, detail) => {
            const currentPhaseLabel = gamePhase.type === 'Setup' ? '設置' : gamePhase.type === 'Prep' ? '準備' : `第 ${gamePhase.number} ${gamePhase.type === 'Night' ? '夜' : '天'}`;
            const newEvent = { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }), actor, action, target, detail };
            setLogs(prev => {
                const newLogs = [...prev];
                const phaseIdx = newLogs.findIndex(l => l.phase === currentPhaseLabel);
                if (phaseIdx >= 0) newLogs[phaseIdx].events.push(newEvent);
                else newLogs.push({ phase: currentPhaseLabel, events: [newEvent] });
                return newLogs;
            });
        };

        const advancePhase = () => {
            if (gamePhase.type === 'Setup') {
                setGamePhase({ type: 'Prep', number: 0 });
                setLogs([...logs, { phase: '準備階段', events: [] }]);
                return;
            }
            // 邏輯同之前...
            let next = { ...gamePhase };
            if (gamePhase.type === 'Prep') { next.type = 'Night'; next.number = 1; }
            else if (gamePhase.type === 'Night') { next.type = 'Day'; }
            else { next.type = 'Night'; next.number++; }
            setGamePhase(next);
            setLogs([...logs, { phase: `第 ${next.number} ${next.type === 'Night' ? '夜' : '天'}`, events: [] }]);
        };

        const handleReset = () => {
            if (confirm("確定要重置所有資料嗎？")) {
                localStorage.clear();
                window.location.reload();
            }
        };

        const exportHistory = () => {
            const content = logs.map(p => `=== ${p.phase} ===\n` + p.events.map(e => `  ${e.actor} -> ${e.action} -> ${e.target} (${e.detail})`).join('\n')).join('\n\n');
            const blob = new Blob([content], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `覆盤紀錄_${gameDate}.txt`;
            a.click();
        };

        return (
            <div className="flex flex-col h-full text-slate-200">
                {/* 頂部工具列 */}
                <div className="bg-slate-900/50 p-4 border-b border-white/10 flex flex-wrap gap-4 items-center">
                    <input type="text" value={scriptName} onChange={e=>setScriptName(e.target.value)} className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs w-40" placeholder="劇本名稱" />
                    <input type="date" value={gameDate} onChange={e=>setGameDate(e.target.value)} className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs" />
                    <button onClick={exportHistory} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded text-xs font-bold transition-all">📥 匯出文字</button>
                    <button onClick={handleReset} className="bg-red-900/50 hover:bg-red-800 px-3 py-1 rounded text-xs font-bold transition-all ml-auto">🔄 重置</button>
                </div>

                <div className="flex-1 flex min-h-0">
                    {/* 左側操作區 */}
                    <div className="w-1/2 p-4 overflow-y-auto border-r border-white/10 custom-scrollbar">
                        {gamePhase.type === 'Setup' ? (
                            <div className="text-center py-20 opacity-50">請先完成座位指派...</div>
                        ) : (
                            <div>
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    {gamePhase.type === 'Night' ? '🌙' : '☀️'} 目前階段：{gamePhase.phase}
                                </h2>
                                {/* 這裡放入 RoleActionCard 循環 */}
                                {players.filter(p => p.role).map(p => (
                                    <RoleActionCard key={p.id} player={p} players={players} script={script} onRecord={(ac, ta, de) => recordEvent(p.role.name, ac, ta, de)} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 右側時間軸 */}
                    <div className="w-1/2 p-4 overflow-y-auto bg-black/20 custom-scrollbar">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">時間軸紀錄</h3>
                        {logs.map((group, gIdx) => (
                            <div key={gIdx} className="mb-6">
                                <div className="text-[10px] text-indigo-400 font-bold mb-2 border-b border-indigo-400/20 pb-1">{group.phase}</div>
                                {group.events.map(e => (
                                    <div key={e.id} className="text-xs mb-2 flex gap-2">
                                        <span className="text-slate-600">{e.time}</span>
                                        <span className="text-indigo-300">{e.actor}</span>
                                        <span className="opacity-50">-></span>
                                        <span>{e.action}</span>
                                        <span className="text-emerald-400">{e.target}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 底部切換按鈕 */}
                <div className="p-3 bg-slate-900 border-t border-white/10 flex justify-center">
                    <button onClick={advancePhase} className="bg-indigo-600 px-8 py-2 rounded-full font-bold shadow-lg hover:scale-105 transition-all">
                        {gamePhase.type === 'Setup' ? "開始遊戲" : "進入下個階段 ▶️"}
                    </button>
                </div>
            </div>
        );
    };

    const root = ReactDOM.createRoot(document.getElementById('recorder-root'));
    root.render(<App />);
})();
