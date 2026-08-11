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
// 角色主資料由全站 RoleCatalog 載入；此檔不再內嵌另一份角色資料。

// 🟢 新增：官方三大劇本角色 ID 清單
const DEFAULT_SCRIPTS_DATA = {
  "暗流湧動": ["washerwoman", "librarian", "investigator", "chef", "empath", "fortune_teller", "undertaker", "monk", "slayer", "soldier", "mayor", "virgin", "ravenkeeper", "butler", "drunk", "recluse", "saint", "poisoner", "spy", "scarlet_woman", "baron", "imp"],
  "黯月初升": ["grandmother", "sailor", "chambermaid", "exorcist", "innkeeper", "gambler", "gossip", "courtier", "professor", "minstrel", "tea_lady", "pacifist", "fool", "goon", "moonchild", "tinker", "lunatic", "godfather", "devils_advocate", "assassin", "mastermind", "zombuul", "pukka", "shabaloth", "po"],
  "夢殞春宵": ["clockmaker", "dreamer", "snake_charmer","mathematician", "philosopher", "artist", "oracle", "savant", "seamstress", "flowergirl", "town_crier", "juggler", "sage", "mutant", "sweetheart", "barber", "klutz", "evil_twin", "witch", "cerenovus", "pit-hag", "fang_gu", "vigormortis", "no_dashii", "vortox"],
  "瓦釜雷鳴": [
    "investigator", "chef", "grandmother", "balloonist", "dreamer", "snake_charmer", "fortune_teller", "gambler", "savant", "amnesiac", "philosopher", "ravenkeeper", "cannibal", 
    "drunk", "recluse", "mutant", "sweetheart", "lunatic", 
    "godfather", "cerenovus", "pit-hag", "widow", 
    "fang_gu", "vigormortis", "imp", 
    "bone_collector", "harlot", "apprentice", "beggar", "barista"
  ]
};


const DAY_ACTION_ROLES = [
  'slayer', 'savant', 'gossip', 'juggler', 'artist', 'fisherman',
  'alsaahir', 'bianlianshi', 'geling', 'yishi', 'princess',
  'psychopath', 'goblin', 'vizier',
  'gunslinger', 'matron', 'butcher', 'judge', 'gangster', 'jiaohuazi', 'diaomin',
  'mutant', 'klutz', 'moonchild', 'golem',
  // 加入中文名稱雙重保險
  '獵手', '博學者', '造謠者', '雜耍藝人', '藝術家', '漁夫', '戲法師', '變臉師', '歌伶', '驛使', '公主', '精神病患者', '哥布林', '維齊爾', '槍手', '女舍監', '屠夫', '法官', '黑幫', '叫花子', '刁民', '畸形秀演員', '呆瓜', '月之子', '魔像'
];

const getRoleInputConfig = (role) => {
  const id = (role.baseRoleId || role.id || "").toLowerCase();
  const name = role.name || "";

  const isRole = (ids, names = []) => {
    return ids.includes(id) || names.some(n => name.includes(n));
  };

  if (isRole(['yinyangshi'], ['陰陽師', '阴阳师'])) return [
    { key: 'r1', type: 'role', label: '善良角色 1' },
    { key: 'r2', type: 'role', label: '善良角色 2' },
    { key: 'r3', type: 'role', label: '邪惡角色 1' },
    { key: 'r4', type: 'role', label: '邪惡角色 2' }
  ];

  if (isRole(['washerwoman', 'librarian', 'investigator'], ['洗衣婦', '圖書管理員', '圖書館員', '調查員', '洗衣妇', '图书管理员', '图书馆员', '调查员'])) return [
    { key: 'p1', type: 'player', label: '玩家 1' },
    { key: 'p2', type: 'player', label: '玩家 2' },
    { key: 'r1', type: 'role', label: '對應角色' }
  ];

  if (isRole(['dreamer'], ['築夢師', '筑梦师'])) return [
    { key: 'p1', type: 'player', label: '目標玩家' },
    { key: 'r1', type: 'role', label: '善良角色' },
    { key: 'r2', type: 'role', label: '邪惡角色' }
  ];

  if (isRole(['cerenovus', 'pit-hag', 'kazali', 'grandmother', 'widow', 'puzzlemaster', 'jiaohuazi'], ['洗腦師', '麻臉巫婆', '卡扎力', '卡紮力', '祖母', '寡婦', '解謎大師', '叫花子', '洗脑师', '麻脸巫婆', '寡妇', '解谜大师'])) return [
    { key: 'p1', type: 'player', label: '目標玩家' },
    { key: 'r1', type: 'role', label: '對應角色' }
  ];

  if (isRole(['chef', 'empath', 'mathematician', 'shiguan', 'fangshi', 'clockmaker', 'oracle', 'juggler', 'dagengren', 'chambermaid'], ['廚師', '共情者', '數學家', '史官', '方士', '鐘錶匠', '鐘表匠', '神諭者', '雜耍藝人', '打更人', '侍女', '厨师', '数学家', '钟表匠', '神谕者', '杂耍艺人'])) return [
    { key: 'num', type: 'number', label: '得知數字' }
  ];

  if (isRole(['fortune_teller', 'seamstress'], ['占卜師', '女裁縫', '占卜师', '女裁缝'])) return [
    { key: 'p1', type: 'player', label: '玩家 1' },
    { key: 'p2', type: 'player', label: '玩家 2' },
    { key: 'res', type: 'select', label: '結果判斷', options: ['是 (Yes)', '否 (No)'] }
  ];

  if (isRole(['noble'], ['貴族', '贵族'])) return [
    { key: 'p1', type: 'player', label: '善良玩家 1' },
    { key: 'p2', type: 'player', label: '善良玩家 2' },
    { key: 'evilTarget', type: 'player', label: '邪惡玩家' }
  ];

  if (isRole(['al-hadikhia', 'dianyuzhang', 'yinluren'], ['哈迪寂亞', '典獄長', '引路人', '哈迪寂亚', '典狱长'])) return [
    { key: 'p1', type: 'player', label: '玩家 1' },
    { key: 'p2', type: 'player', label: '玩家 2' },
    { key: 'p3', type: 'player', label: '玩家 3' }
  ];

  if (isRole(['shabaloth', 'harpy', 'qianke', 'evil_twin', 'dianxiaoer', 'knight', 'baojun', 'innkeeper', 'barber', 'xuncha', 'jianning'], ['沙巴洛斯', '鷹身女妖', '掮客', '鏡像雙子', '店小二', '騎士', '暴君', '旅店老闆', '旅店老板', '理髮師', '理發師', '巡察', '奸佞', '鹰身女妖', '镜像双子', '骑士', '理发师'])) return [
    { key: 'p1', type: 'player', label: '玩家 1' },
    { key: 'p2', type: 'player', label: '玩家 2' }
  ];

  if (isRole(['qintianjian', 'fengshuishi', 'shugenja', 'gudiao'], ['欽天監', '風水師', '修行者', '蠱雕', '钦天监', '风水师', '蛊雕'])) return [
    { key: 'dir', type: 'select', label: '方向', options: ['左/順時針', '右/逆時針', '相同'] }
  ];

  if (isRole(['langzhong', 'niangjiushi'], ['郎中', '釀酒師', '酿酒师'])) return [
    { key: 'p1', type: 'player', label: '目標對象' },
    { key: 'word', type: 'text', label: '給予提示詞/信息' }
  ];

  if (isRole(['zhen', 'xionghaizi', 'ojo', 'courtier', 'pixie', 'alchemist', 'daoke', 'bianlianshi'], ['鴆', '熊孩子', '奧赫', '侍臣', '小精靈', '煉金術士', '刀客', '變臉師', '鸩', '奥赫', '小精灵', '炼金术士', '变脸师'])) return [
    { key: 'r1', type: 'role', label: '選擇角色' }
  ];

  if (isRole(['village_idiot'], ['村夫'])) return [
    { key: 'p1', type: 'player', label: '目標玩家' },
    { key: 'res', type: 'select', label: '該玩家陣營', options: ['善良 (Good)', '邪惡 (Evil)'] }
  ];
  if (isRole(['general'], ['將軍', '将军'])) return [
    { key: 'res', type: 'select', label: '優勢陣營', options: ['善良', '邪惡', '均勢'] }
  ];
  if (isRole(['mengpo'], ['孟婆'])) return [
    { key: 'p1', type: 'player', label: '目標玩家' },
    { key: 'res', type: 'select', label: '該玩家選擇', options: ['失去能力', '保留能力並死亡'] }
  ];
  if (isRole(['jinweijun2'], ['禁衛軍Ⅱ', '禁衛軍2', '禁卫军Ⅱ', '禁卫军2'])) return [
    { key: 'res', type: 'select', label: '禁衛軍選擇', options: ['求生', '求死'] }
  ];
  if (isRole(['organ_grinder'], ['街頭風琴手', '街头风琴手'])) return [
    { key: 'res', type: 'select', label: '是否醉酒', options: ['是 (醉酒)', '否 (清醒)'] }
  ];
  if (isRole(['barista'], ['咖啡師', '咖啡师'])) return [
    { key: 'p1', type: 'player', label: '目標玩家' },
    { key: 'res', type: 'select', label: '附加效果', options: ['解除醉酒中毒', '能力發動兩次'] }
  ];

  if (isRole(['mezepheles', 'yaggababble', 'savant', 'artist', 'wizard', 'chongfei', 'taotie'], ['靈言師', '牙噶巴卜', '博學者', '藝術家', '巫師', '寵妃', '饕餮', '灵言师', '博学者', '艺术家', '巫师', '宠妃'])) return [
    { key: 'word', type: 'text', label: '記錄詞語/短語/問題' }
  ];

  if (isRole(['flowergirl', 'town_crier', 'zhifu', 'yishi'], ['賣花女孩', '城鎮公告員', '知府', '驛使', '卖花女孩', '城镇公告员', '驿使'])) return [
    { key: 'res', type: 'select', label: '結果', options: ['是 (Yes)', '否 (No)'] }
  ];

  // --- 白天專屬行動的動態表單 ---
  if (isRole(['savant'], ['博學者', '博学者'])) return [
    { key: 'word', type: 'text', label: '真實資訊' },
    { key: 'detail2', type: 'text', label: '虛假資訊' }
  ];
  if (isRole(['artist', 'fisherman', 'gossip', 'juggler', 'alsaahir', 'goblin'], ['藝術家', '漁夫', '造謠者', '雜耍藝人', '戲法師', '哥布林', '艺术家', '渔夫', '造谣者', '杂耍艺人', '戏法师'])) return [
    { key: 'word', type: 'text', label: '聲明/提問/提示內容' }
  ];
  if (isRole(['slayer', 'psychopath', 'gunslinger', 'golem', 'moonchild', 'klutz'], ['殺手', '精神病患者', '精神病患', '槍手', '魔像', '月之子', '呆瓜', '杀手', '枪手'])) return [
    { key: 'target', type: 'player', label: '目標對象' },
    { key: 'res', type: 'select', label: '行動結果', options: ['死亡', '無事發生/存活', '猜測正確', '猜測錯誤'] }
  ];
  if (isRole(['geling', 'matron', 'gangster', 'jiaohuazi'], ['歌伶', '女舍監', '黑幫', '叫花子', '女舍监', '黑帮'])) return [
    { key: 'p1', type: 'player', label: '目標 1' },
    { key: 'p2', type: 'player', label: '目標 2 (選填)' }
  ];
  // ------------------------------------

  // 移除被動/無目標技能的動態表單回傳
  if (isRole(['banshee', 'zealot', 'xaan', 'wraith', 'princess', 'hermit', 'soldier', 'mayor', 'drunk', 'saint', 'recluse', 'scarlet_woman', 'baron', 'mastermind', 'deviant', 'butcher', 'mutant', 'sweetheart', 'atheist', 'cannibal', 'snitch', 'damsel', 'heretic', 'politician', 'boomdandy', 'marionette', 'leviathan', 'vizier', 'shijie', 'heshang', 'yangguren', 'jinweijun', 'shusheng', 'ganshiren', 'banxian', 'wudaozhe', 'xizi', 'ranfangfangzhu', 'diaomin', 'yongjiang', 'xizi_new', 'rulianshi', 'beggar', 'scapegoat'], ['報喪女妖', '狂熱者', '限', '亡魂', '公主', '隱士', '士兵', '鎮長', '市長', '酒鬼', '聖徒', '陌客', '紅唇女郎', '猩紅女郎', '男爵', '主謀', '怪咖', '屠夫', '畸形秀演員', '心上人', '無神論者', '食人族', '告密者', '落難少女', '異端分子', '政客', '炸彈人', '提線木偶', '利維坦', '維齊爾', '使節', '和尚', '養蠱人', '禁衛軍', '書生', '趕屍人', '半仙', '悟道者', '戲子', '染坊坊主', '刁民', '俑匠', '戲子（改）', '入殮師', '乞丐', '替罪羊', '报丧女妖', '狂热者', '镇长', '市长', '圣徒', '红唇女郎', '猩红女郎', '主谋', '畸形秀演员', '无神论者', '落难少女', '异端分子', '炸弹人', '提线木偶', '利维坦', '维齐尔', '使节', '养蛊人', '禁卫军', '书生', '赶尸人', '戏子(改)', '入殓师'])) return [];

  return [
    { key: 'target', type: 'player', label: '目標對象' }
  ];
};
// ==========================================
// 輔助函式：window.name 方案
// ==========================================
const RECORDER_STORAGE_KEY = 'botc_recorder_state_v2';

const readRecorderStore = () => {
  try {
    const current = JSON.parse(localStorage.getItem(RECORDER_STORAGE_KEY) || '{}');
    if (current && typeof current === 'object') return current;
  } catch (e) {}
  return {};
};

const loadState = (key, defaultValue) => {
  const store = readRecorderStore();
  if (store[key] !== undefined) return store[key];

  // One-way compatibility with recorder builds that stored each field alone.
  try {
    const legacy = localStorage.getItem(key);
    if (legacy !== null) return JSON.parse(legacy);
  } catch (e) {}
  return defaultValue;
};

const saveState = (key, value) => {
  try {
    const store = readRecorderStore();
    store[key] = value;
    localStorage.setItem(RECORDER_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {}
};

// ==========================================
// 子組件：行動卡片
// ==========================================
const RoleActionCard = ({ player, reminder, onRecord, players, script, roleCatalog }) => {
  const [isRecorded, setIsRecorded] = useState(false);
  const [formData, setFormData] = useState({});
  const [detailNote, setDetailNote] = useState(""); 
  
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
                  {players.map(p => <option key={p.id} value={`${p.id}. ${p.name} (${p.role?.name || "尚未選角"})`}>{p.id}號 {p.name} ({p.role?.name || "尚未選角"})</option>)}
                </select>
              ) : c.type === 'role' ? (
                <select onChange={e=>setFormData({...formData, [c.key]: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-1 text-slate-200 outline-none">
                  <option value="">{c.label}...</option>
                  {(script && script.length > 0 ? script : roleCatalog).map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              ) : (
                <input type="text" placeholder={c.label} onChange={e=>setFormData({...formData, [c.key]: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-1 text-slate-200 outline-none" />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-white/5 pt-2">
          <input type="text" value={detailNote} onChange={e=>setDetailNote(e.target.value)} placeholder="自由備註..." className="flex-1 bg-slate-800 border border-slate-700 rounded-lg text-xs p-1 text-slate-200 outline-none" />
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
const normalizedRoleId = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizedRoleText = value => String(value || '').toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]/g, '');

const findCatalogRole = (catalog, role) => {
  if (window.RoleCatalog?.resolve) return window.RoleCatalog.resolve(role, catalog);
  if (!role) return null;

  const roleId = normalizedRoleId(role.id || role.baseRoleId);
  const idMatch = roleId && catalog.find(item => normalizedRoleId(item.id) === roleId);
  if (idMatch) return idMatch;

  if (role.databaseId) {
    const databaseMatch = catalog.find(item => item.databaseId && item.databaseId === role.databaseId);
    if (databaseMatch) return databaseMatch;
  }

  // 完整自創角色的能力是其身分的一部分。同名但能力不同時，不可套用官方角色。
  const ability = normalizedRoleText(role.ability);
  if (ability) {
    return catalog.find(item => normalizedRoleText(item.ability) === ability) || null;
  }

  // 只有缺少穩定 ID 與能力的舊資料，才允許用名稱補救；有 ID 的同名角色不可互相合併。
  if (roleId || !role.name) return null;
  return catalog.find(item =>
    item.name === role.name || (item.aliases || []).includes(role.name)
  ) || null;
};

const App = () => {
  // 正式角色資料由百科共用的 RoleCatalog 提供；只有 API 尚未完成時才使用全站靜態 fallback。
  const [roleCatalog, setRoleCatalog] = useState(() => window.MASTER_ROLE_DB || []);
  const [script, setScript] = useState(() => loadState('botc_script', [])); 
  const [players, setPlayers] = useState(() => loadState('botc_players', [])); 
  const [gamePhase, setGamePhase] = useState(() => loadState('botc_gamePhase', { type: 'Setup', number: 0 })); 
  const [logs, setLogs] = useState(() => loadState('botc_logs', [])); 

  const [playerCount, setPlayerCount] = useState(() => loadState('botc_playerCount', 12));
  const [storyteller, setStoryteller] = useState(() => loadState('botc_storyteller', ''));
  const [scriptName, setScriptName] = useState(() => loadState('botc_scriptName', '未命名劇本'));
  const [gameDate, setGameDate] = useState(() => loadState('botc_gameDate', new Date().toISOString().split('T')[0]));
  const [gameLocation, setGameLocation] = useState(() => loadState('botc_gameLocation', '線上 (Discord)'));
  const [customLocation, setCustomLocation] = useState(() => loadState('botc_customLocation', ''));

  const [selectingRoleFor, setSelectingRoleFor] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [publicScripts, setPublicScripts] = useState([]);

  useEffect(() => {
    let active = true;
    const applyCatalog = (catalog) => {
      if (!active || !Array.isArray(catalog) || catalog.length === 0) return;
      setRoleCatalog(catalog);
      const findRole = role => findCatalogRole(catalog, role);
      setScript(current => current.map(role => ({ ...role, ...(findRole(role) || {}) })));
      setPlayers(current => current.map(player => player.role
        ? { ...player, role: { ...player.role, ...(findRole(player.role) || {}) } }
        : player
      ));
    };
    window.RoleCatalog?.ready?.then(applyCatalog).catch(() => {});
    const onReady = event => applyCatalog(event.detail);
    window.addEventListener('botc:role-catalog-ready', onReady);
    return () => {
      active = false;
      window.removeEventListener('botc:role-catalog-ready', onReady);
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${window.API_BASE || ''}/api/scripts`, { credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(data => { if (active) setPublicScripts(data.items || []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const loadBuiltInScript = (scriptKey) => {
    const roleIds = DEFAULT_SCRIPTS_DATA[scriptKey];
    if (!roleIds) return;
    
    // 從 window 全域的角色庫比對 ID 並產生新的 script 狀態
    const parsed = roleIds.map(id => {
      let dbRole = roleCatalog.find(r => normalizedRoleId(r.id) === normalizedRoleId(id));
      return dbRole ? { ...dbRole } : null;
    }).filter(Boolean);

    setScript(parsed);
    setScriptName(scriptKey);
  };

  const resetScript = () => {
  setScript([]);
  setScriptName("自定義 / 全角色");
  };
  
  const [hiddenTarget, setHiddenTarget] = useState("");
  const [hiddenValue, setHiddenValue] = useState("");
  const [demonBluffs, setDemonBluffs] = useState(() => loadState('botc_demonBluffs', { r1: "", r2: "", r3: "", recorded: false }));
  const [editingLog, setEditingLog] = useState(null); 
  const [dayAction, setDayAction] = useState({ actor: "", action: "白天行動", target: "", detail: "" });
  const [nightAction, setNightAction] = useState({ actor: "", action: "夜間行動", target: "", detail: "" });
  const [nominationRecord, setNominationRecord] = useState({ nominator: "", target: "", votes: "", result: "未達門檻" });

  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: 'alert', message: '', onConfirm: null });

  // 強制合併旅行者到選角池
  const allAvailableRoles = useMemo(() => {
    const travellers = roleCatalog.filter(r => r.team === 'traveller');
    const combined = [...script];
    travellers.forEach(tr => {
      if (!combined.some(r => normalizedRoleId(r.id) === normalizedRoleId(tr.id))) combined.push(tr);
    });
    return combined;
  }, [script, roleCatalog]);

  const showAlert = (message) => {
    setModalConfig({ isOpen: true, type: 'alert', message, onConfirm: null });
  };

  const showConfirm = (message, onConfirm) => {
    setModalConfig({ isOpen: true, type: 'confirm', message, onConfirm });
  };
  const triggerExportSelection = () => {
  setModalConfig({
    isOpen: true,
    type: 'export', // 借用 confirm 的版型
    message: "請選擇對局結果以完成匯出：",
    onConfirm: null // 這裡改用下方的自訂按鈕
  });
};

  
  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (gamePhase.type !== 'Setup' && players.length > 0) {
        e.preventDefault();
        e.returnValue = ''; 
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [gamePhase.type, players.length]);

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
    saveState('botc_demonBluffs', demonBluffs);
    saveState('botc_storyteller', storyteller);
  }, [script, players, gamePhase, logs, playerCount, scriptName, gameDate, gameLocation, customLocation, demonBluffs,storyteller]);
  // 🟢 最終更新：使用 ☠️ 與 ❤️ 作為生死標記
  const generatePlayerListText = () => {
    let text = "\n【最終玩家狀態快照】\n";
    players.forEach(p => {
        // 🔴 根據你的要求更換圖示
        const status = p.isDead ? "☠️ 死亡" : "❤️ 存活";
        
        // 處理身分顯示邏輯
        let roleDisplay = p.role ? p.role.name : "未知";
        if (p.hiddenRole) {
            roleDisplay += ` / 實際:${p.hiddenRole}`;
        }
        
        // 格式：[1號] ❤️ 存活 - (角色) 暱稱
        text += `[${p.id}號] ${status} - (${roleDisplay}) ${p.name || "空"}\n`;
    });
    return text;
};


  const recordEvent = (actor, action, target, detail) => {
    const currentPhaseLabel = gamePhase.type === 'Setup' ? '設置階段' : gamePhase.type === 'Prep' ? '準備階段' : `第 ${gamePhase.number} ${gamePhase.type === 'Night' ? '夜' : '天'}`;
    const newEvent = { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }), actor, action, target, detail };
    
    setLogs(prevLogs => {
      const newLogs = [...prevLogs];
      const phaseIndex = newLogs.findIndex(l => l.phase === currentPhaseLabel);
      if (phaseIndex >= 0) {
        newLogs[phaseIndex].events.push(newEvent); // 舊在前，新在後
      } else {
        newLogs.push({ phase: currentPhaseLabel, events: [newEvent] });
      }

      return newLogs;
    });
  };

  const addNewPlayer = () => {
    const nextId = players.length > 0 ? Math.max(...players.map(p => p.id)) + 1 : 1;
    const newPlayer = { id: nextId, name: `玩家 ${nextId}`, role: null, hiddenRole: "", isDead: false };
    setPlayers([...players, newPlayer]);
    setPlayerCount(players.length + 1);
    if (gamePhase.type !== 'Setup') {
      recordEvent("系統", "玩家加入", newPlayer.name, "中途加入");
    }
  };

  const advancePhase = () => {
    if (gamePhase.type === 'Setup') {
      if (players.some(p => p.role === null)) {
        showConfirm("尚有玩家未分配角色，確定要進入準備階段嗎？", proceedToPrep);
        return;
      }
      proceedToPrep();
      return;
    }

  const snapshotDetail = players.map(p => {
    let roleDisplay = p.role ? p.role.name : '未指派';
    if (p.hiddenRole) roleDisplay += ` / 實際:${p.hiddenRole}`;
    
    // 🔴 同步更新為 ☠️ 與 ❤️
    const statusDisplay = p.isDead ? '☠️ 死亡' : '❤️ 存活';
    return `[${p.id}號] ${statusDisplay} - (${roleDisplay}) ${p.name}`;
    }).join('\n');
    
    const snapshotEvent = { 
      id: Date.now() + Math.random(), 
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }), 
      actor: '系統', action: '狀態快照', target: '全體玩家', detail: snapshotDetail 
    };

    setLogs(prevLogs => {
      const newLogs = [...prevLogs];
      if (newLogs.length > 0) {
        newLogs[newLogs.length - 1].events.push(snapshotEvent); // 將快照放在該階段的最後
      }
      
      let nextPhaseLabel = '';
      if (gamePhase.type === 'Prep') nextPhaseLabel = '第 1 夜';
      else if (gamePhase.type === 'Night') nextPhaseLabel = `第 ${gamePhase.number} 天`;
      else nextPhaseLabel = `第 ${gamePhase.number + 1} 夜`;

      newLogs.push({ phase: nextPhaseLabel, events: [] });
      return newLogs;
    });

    if (gamePhase.type === 'Prep') {
      setGamePhase({ type: 'Night', number: 1 });
    } else if (gamePhase.type === 'Night') {
      setGamePhase({ type: 'Day', number: gamePhase.number });
    } else {
      setGamePhase({ type: 'Night', number: gamePhase.number + 1 });
    }
  };

  const proceedToPrep = () => {
    setGamePhase({ type: 'Prep', number: 0 });
    setLogs([...logs, { phase: '準備階段', events: [] }]);
  };

  const deleteLog = (phaseIdx, eventId) => {
    setLogs(prev => {
      const newLogs = [...prev];
      newLogs[phaseIdx].events = newLogs[phaseIdx].events.filter(e => e.id !== eventId);
      return newLogs;
    });
  };

  const moveEvent = (phaseIdx, eventId, direction) => {
    setLogs(prevLogs => {
      const newLogs = [...prevLogs];
      const events = [...newLogs[phaseIdx].events];
      const eventIdx = events.findIndex(e => e.id === eventId);
      
      if (eventIdx === -1) return prevLogs;

      if (direction === 'up' && eventIdx > 0) {
        [events[eventIdx], events[eventIdx - 1]] = [events[eventIdx - 1], events[eventIdx]];
      } else if (direction === 'down' && eventIdx < events.length - 1) {
        [events[eventIdx], events[eventIdx + 1]] = [events[eventIdx + 1], events[eventIdx]];
      }
      
      newLogs[phaseIdx].events = events;
      return newLogs;
    });
  };

  const startEditLog = (phaseIdx, event) => {
    setEditingLog({ phaseIdx, id: event.id, actor: event.actor, action: event.action, target: event.target, detail: event.detail });
  };

  const saveEditLog = () => {
    setLogs(prev => {
      const newLogs = [...prev];
      const pIdx = editingLog.phaseIdx;
      newLogs[pIdx].events = newLogs[pIdx].events.map(e => e.id === editingLog.id ? { ...e, actor: editingLog.actor, action: editingLog.action, target: editingLog.target, detail: editingLog.detail } : e);
      return newLogs;
    });
    setEditingLog(null);
  };

  const exportHistory = (winner) => {
    if (logs.length === 0) return;
    const displayLocation = gameLocation === '其他' ? customLocation : gameLocation;

    let winnerText = "";
      if (winner === 'good') winnerText = "勝利陣營：善良陣營\n";
      else if (winner === 'evil') winnerText = "勝利陣營：邪惡陣營\n";
      else winnerText = "對局狀態：中途紀錄\n";
    let header = `劇本名稱：${scriptName}\n遊戲日期：${gameDate}\n遊戲地點：${displayLocation}\n說書人：${storyteller}\n${winnerText}-----------------------------------\n\n`;

    const content = logs.map(p => {
      const events = p.events
        .map(e => {
          if (e.action === '狀態快照') {
            return `\n【當前玩家狀態】\n${e.detail}\n`;
          }
          const baseStr = `  ${e.actor} -> ${e.action} -> ${e.target}`;
          let detailStr = '';
          
          if (e.detail && e.detail !== "無備註" && e.detail.trim() !== "") {
            if (e.action === '發起提名') {
              detailStr = `\n    ${e.detail}`;
            } else {
              detailStr = `\n    └ ${e.detail}`;
            }
          }
          return baseStr + detailStr;
        })
        .join('\n'); // 移除 .reverse() 保持時間序
      return `=== ${p.phase} ===\n${events || '  (無紀錄)'}`;
    }).join('\n\n'); // 移除 .reverse() 保持時間序
    
    const footer = `\n\n===================================\n` + generatePlayerListText();
    
    const fullContent = header + content + footer;
    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // 替換不合法的檔名字元，確保各種作業系統都能正常下載
    const safeScriptName = scriptName.replace(/[\\/:*?"<>|]/g, '-');
    const safeLocation = displayLocation.replace(/[\\/:*?"<>|]/g, '-');
    a.download = `血染覆盤紀錄_${gameDate}_${safeScriptName}_${safeLocation}.txt`;
    
    a.click();
  };

  const handleResetClick = () => {
    showConfirm("⚠️ 確定要清空所有紀錄並重新開始嗎？\n\n(這將會刪除所有玩家設定與日誌，無法復原)", () => {
      saveState('botc_scriptName', '未命名劇本');
      saveState('botc_gameDate', new Date().toISOString().split('T')[0]);
      saveState('botc_gameLocation', '線上 (Discord)');
      saveState('botc_customLocation', '');
      saveState('botc_script', []);
      saveState('botc_playerCount', 8);
      saveState('botc_players', []); 
      saveState('botc_gamePhase', { type: 'Setup', number: 0 });
      saveState('botc_logs', []);
      saveState('botc_demonBluffs', { r1: "", r2: "", r3: "", recorded: false });

      setScriptName('未命名劇本');
      setGameDate(new Date().toISOString().split('T')[0]);
      setGameLocation('線上 (Discord)');
      setCustomLocation('');
      setScript([]);
      setPlayerCount(8);
      setPlayers(Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `玩家 ${i + 1}`, role: null, hiddenRole: "", isDead: false })));
      setGamePhase({ type: 'Setup', number: 0 });
      setLogs([]);
      setDemonBluffs({ r1: "", r2: "", r3: "", recorded: false });
      setHiddenTarget("");
      setHiddenValue("");
      setSelectingRoleFor(null);
      setDayAction({ actor: "", action: "白天行動", target: "", detail: "" });
      setNominationRecord({ nominator: "", target: "", votes: "", result: "未達門檻" });
    });
  };

  const applyScriptJson = (json, fallbackName = '') => {
    const rawRoles = Array.isArray(json) ? json : (json.roles || []);
    const metaInfo = rawRoles.find(item => item.id === '_meta');
    setScriptName(metaInfo?.name || fallbackName || '未命名劇本');
    const parsedRoles = rawRoles.map(item => {
      const roleId = typeof item === 'string' ? item : item.id;
      if (roleId === '_meta') return null;
      const tName = toTraditional(item.name || "");
      const tAbility = toTraditional(item.ability || "");
      const dbRole = findCatalogRole(roleCatalog, { id: roleId, name: tName, ability: tAbility });
      return {
        id: roleId,
        baseRoleId: dbRole ? dbRole.id : roleId,
        name: dbRole?.name || tName || roleId,
        team: dbRole?.team || item.team || "townsfolk",
        firstNight: Number(dbRole?.firstNight) || Number(item.firstNight) || 0,
        otherNight: Number(dbRole?.otherNight) || Number(item.otherNight) || 0,
        firstNightReminder: dbRole?.firstNightReminder || item.firstNightReminder || "",
        otherNightReminder: dbRole?.otherNightReminder || item.otherNightReminder || "",
        image: dbRole?.image || item.image || "",
        ability: dbRole?.ability || tAbility || ""
      };
    }).filter(Boolean);
    setScript(parsedRoles);
    return parsedRoles.length;
  };

  const loadPublicScript = async (item) => {
    try {
      const response = await fetch(item.json_download_url || `/api/scripts/${encodeURIComponent(item.slug)}/download.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const count = applyScriptJson(await response.json(), item.name_zh_tw);
      showAlert(`已載入「${item.name_zh_tw}」共 ${count} 個角色。`);
    } catch (err) {
      showAlert(`劇本載入失敗：${err.message}`);
    }
  };

  const handleScriptUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        const rawRoles = Array.isArray(json) ? json : (json.roles || []);
        
        const metaInfo = rawRoles.find(item => item.id === '_meta');
        if (metaInfo && metaInfo.name) {
          setScriptName(metaInfo.name);
        } else if (file.name) {
          setScriptName(file.name.replace('.json', ''));
        }

        const parsedRoles = rawRoles
          .map(item => {
            const roleId = typeof item === 'string' ? item : item.id;
            if (roleId === '_meta') return null;
            
            const tName = toTraditional(item.name || "");
            const tAbility = toTraditional(item.ability || "");

            const dbRole = findCatalogRole(roleCatalog, { id: roleId, name: tName, ability: tAbility });
            
            return {
              id: roleId,
              baseRoleId: dbRole ? dbRole.id : roleId,
              name: dbRole?.name || tName || roleId,
              team: dbRole?.team || item.team || "townsfolk",
              firstNight: Number(dbRole?.firstNight) || Number(item.firstNight) || 0,
              otherNight: Number(dbRole?.otherNight) || Number(item.otherNight) || 0,
              firstNightReminder: dbRole?.firstNightReminder || item.firstNightReminder || "",
              otherNightReminder: dbRole?.otherNightReminder || item.otherNightReminder || "",
              image: dbRole?.image || item.image || "",
              ability: dbRole?.ability || tAbility || ""
            };
          })
          .filter(Boolean);
        
        setScript(parsedRoles);
        showAlert(`成功讀取劇本並對接資料庫！共載入 ${parsedRoles.length} 個角色。`);
      } catch (err) {
        showAlert("JSON 格式錯誤，請檢查檔案。");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const exportSaveData = () => {
    const saveData = { script, playerCount, players, gamePhase, logs, demonBluffs, scriptName, gameDate, gameLocation, customLocation };
    const blob = new Blob([JSON.stringify(saveData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `血染存檔_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    a.click();
  };

  const importSaveData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.players && data.gamePhase) {
          setScript(data.script || []);
          setPlayerCount(data.playerCount || 8);
          setPlayers(data.players);
          setGamePhase(data.gamePhase);
          setLogs(data.logs || []);
          setDemonBluffs(data.demonBluffs || { r1: "", r2: "", r3: "", recorded: false });
          setScriptName(data.scriptName || '未命名劇本');
          setGameDate(data.gameDate || new Date().toISOString().split('T')[0]);
          setGameLocation(data.gameLocation || '線上 (Discord)');
          setCustomLocation(data.customLocation || '');
          showAlert("✅ 進度讀取成功！歡迎回到遊戲。");
        } else {
          showAlert("⚠️ 檔案格式不正確，請確認您上傳的是「存檔」而非「劇本」。");
        }
      } catch (err) {
        showAlert("⚠️ 讀取失敗，檔案可能已損壞。");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const getIconUrl = (role) => {
    if (!role) return "";
    if (role.image && role.image.startsWith('http')) return role.image;
    const cleanName = role.id.replace(/_/g, '').toLowerCase();
    return `https://raw.githubusercontent.com/trolldaddy/botc_overlay/48e8573061c16d172912dc9e5aef5e07dac64a62/public/Allicon/240px-${cleanName}.png`;
  };

  useEffect(() => {
    if (gamePhase.type === 'Setup' && players.length !== playerCount) {
      setPlayers(prev => {
        if (prev.length === playerCount) return prev;
        return Array.from({ length: playerCount }, (_, i) => {
          const existing = prev.find(p => p.id === i + 1);
          return existing || { id: i + 1, name: `玩家 ${i + 1}`, role: null, hiddenRole: "", isDead: false };
        });
      });
    }
  }, [playerCount, gamePhase.type]);

  const togglePlayerDead = (id) => {
    setPlayers(players.map(p => p.id === id ? { ...p, isDead: !p.isDead } : p));
  };

  const updatePlayerName = (id, newName) => {
    setPlayers(players.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  const wakingOrder = useMemo(() => {
    if (gamePhase.type !== 'Night') return [];
    const inPlay = players.filter(p => p.role !== null);
    let order = [];
    if (gamePhase.number === 1) {
      order = inPlay.filter(p => p.role.firstNight > 0).sort((a, b) => a.role.firstNight - b.role.firstNight);
    } else {
      order = inPlay.filter(p => p.role.otherNight > 0).sort((a, b) => a.role.otherNight - b.role.otherNight);
    }
    return order;
  }, [players, gamePhase]);

  const dayActors = useMemo(() => {
    if (gamePhase.type !== 'Day') return [];
    const _DAY_ACTION_ROLES = typeof DAY_ACTION_ROLES !== 'undefined' ? DAY_ACTION_ROLES : [];
    return players.filter(p => p.role && (
      _DAY_ACTION_ROLES.includes(p.role.baseRoleId) || 
      _DAY_ACTION_ROLES.includes(p.role.id.toLowerCase()) ||
      _DAY_ACTION_ROLES.some(dayRole => p.role.name.includes(dayRole))
    ));
  }, [players, gamePhase]);

  return (
    <div className="h-full bg-slate-950 text-slate-200 font-sans flex flex-col relative overflow-hidden">

      {modalConfig.isOpen && (
  <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4">
    {modalConfig.type === 'export' ? (
        <>  
    <div className="flex items-center gap-3 mb-2">
        <span className="text-xl">📥</span>
        <h3 className="text-slate-200 font-black">匯出對局紀錄</h3>
      </div>
      
      <p className="text-slate-400 text-xs leading-relaxed">
        請標註本局結果，這將會自動寫入文字檔開頭，方便後續戰績錄入：
      </p>
      
      <div className="flex flex-col gap-2 mt-2">
        {/* 🏆 勝利選項 */}
        <button onClick={() => { exportHistory('good'); closeModal(); }} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2">
          😇 善良陣營獲勝
        </button>
        <button onClick={() => { exportHistory('evil'); closeModal(); }} className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2">
          😈 邪惡陣營獲勝
        </button>
        
        <div className="h-px bg-slate-800 my-1"></div>

        {/* 📝 其他選項 */}
        <button onClick={() => { exportHistory('none'); closeModal(); }} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all">
          中途紀錄 (尚未結束)
        </button>

        {/* 🔴 取消選項：放在最下面且用不同顏色 */}
        <button onClick={closeModal} className="w-full py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-500 rounded-xl text-xs font-bold transition-all mt-1">
          取消，回到對局
        </button>
      </div>
          </>
      ) : (
        /* 🔵 情況 B：一般確認或警告視窗 (重置、刪除等) */
        <>
        <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-bold">
            {modalConfig.message}
          </p>
          <div className="flex justify-end gap-3 mt-2">
            {modalConfig.type === 'confirm' && (
              <button onClick={closeModal} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all">
                取消
              </button>
            )}
            <button 
              onClick={() => { if (modalConfig.onConfirm) modalConfig.onConfirm(); closeModal(); }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
            >
              確定
            </button>
          </div>
        </>
      )}
    </div>
  </div>
)}

      <header className="bg-slate-900 border-b border-slate-800 p-4 shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4 z-20">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-xl text-white text-xl">📖</div>
          <div>
            <h1 className="text-xl font-black text-white leading-tight flex items-center gap-3">
              血染覆盤記錄器
              <button onClick={handleResetClick} className="bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 px-2 py-1 rounded-lg transition-all flex items-center gap-1 shadow-lg" title="清空全部並重置">
                <span className="text-xs">🔄 重置</span>
              </button>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Storyteller Tablet UI</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto pb-1 sm:pb-0 flex-wrap sm:flex-nowrap">
          {gamePhase.type === 'Setup' && (
            <div className="flex items-center bg-slate-800 rounded-xl px-3 py-1.5 border border-slate-700 shrink-0">
              <span className="text-sm mr-2 opacity-70">👥</span>
              <select 
                value={playerCount} 
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="bg-transparent outline-none font-bold text-indigo-400 text-sm"
              >
                {[...Array(16)].map((_, i) => <option key={i+5} value={i+5}>{i+5} 人</option>)}
              </select>
            </div>
          )}

          <button onClick={addNewPlayer} className="flex items-center gap-2 bg-emerald-950/40 hover:bg-emerald-900/60 px-3 py-1.5 rounded-xl border border-emerald-800/50 text-emerald-400 transition-all shrink-0" title="新增玩家">
            <span className="text-sm">➕</span>
            <span className="text-xs font-bold whitespace-nowrap hidden sm:inline">新增玩家</span>
          </button>

          <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl border border-slate-700 cursor-pointer transition-all shrink-0" title="載入官方或自訂劇本">
            <span className="text-sm">📜</span>
            <span className="text-xs font-bold whitespace-nowrap hidden sm:inline">載入劇本</span>
            <input type="file" accept=".json" onChange={handleScriptUpload} className="hidden" />
          </label>

          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 shrink-0">
            <button onClick={exportSaveData} className="hover:bg-slate-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors text-emerald-400" title="下載當前進度存檔">
              <span>💾</span> <span className="hidden lg:inline">存檔</span>
            </button>
            <div className="w-px h-4 bg-slate-600 mx-0.5"></div>
            <label className="hover:bg-slate-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors text-amber-400 cursor-pointer" title="上傳並恢復遊戲進度">
              <span>📂</span> <span className="hidden lg:inline">讀檔</span>
              <input type="file" accept=".json" onChange={importSaveData} className="hidden" />
            </label>
          </div>

          <div className="h-8 w-px bg-slate-800 hidden sm:block mx-1"></div>

          <div className={`px-5 py-2 rounded-xl border flex items-center gap-2 shrink-0 ${gamePhase.type === 'Setup' ? 'bg-slate-800 border-slate-700' : gamePhase.type === 'Prep' ? 'bg-purple-950/40 border-purple-800/50 text-purple-300' : gamePhase.type === 'Night' ? 'bg-indigo-950/40 border-indigo-800/50 text-indigo-300' : 'bg-yellow-950/40 border-yellow-800/50 text-yellow-300'}`}>
            <span className="text-sm">{gamePhase.type === 'Setup' || gamePhase.type === 'Prep' ? '📖' : gamePhase.type === 'Night' ? '🌙' : '☀️'}</span>
            <span className="font-black text-sm whitespace-nowrap">
              {gamePhase.type === 'Setup' ? '設置階段' : gamePhase.type === 'Prep' ? '準備階段' : `第 ${gamePhase.number} ${gamePhase.type === 'Night' ? '夜' : '天'}`}
            </span>
          </div>

          <button onClick={advancePhase} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-black transition-all flex items-center gap-2 shrink-0 shadow-lg">
            <span className="text-sm">▶️</span>
            <span className="text-sm">{gamePhase.type === 'Setup' ? '進入準備階段' : gamePhase.type === 'Prep' ? '開始第一夜' : '下個階段'}</span>
          </button>
        </div>
      </header>

      {/* 遊戲資訊設定區 */}
      <div className="bg-[#0f172a] border-b border-white/10 px-4 py-2 shrink-0 flex flex-wrap items-center gap-4 z-10 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold uppercase tracking-widest">📜 劇本</span>
          <input type="text" value={scriptName} onChange={e=>setScriptName(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 text-slate-200 w-32 md:w-48" placeholder="未命名劇本" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold uppercase tracking-widest">📅 日期</span>
          <input type="date" value={gameDate} onChange={e=>setGameDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 text-slate-200" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold uppercase tracking-widest">📍 地點</span>
          <select value={gameLocation} onChange={e=>setGameLocation(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 text-slate-200">
            <option value="線上 (Discord)">線上 (Discord)</option>
            <option value="拉普拉斯">拉普拉斯</option>
            <option value="台北">台北</option>
            <option value="新北">新北</option>
            <option value="桃園">桃園</option>
            <option value="台中">台中</option>
            <option value="台南">台南</option>
            <option value="高雄">高雄</option>
            <option value="其他">其他...</option>
          </select>
          {gameLocation === '其他' && (
            <input type="text" placeholder="自訂地點" value={customLocation} onChange={e=>setCustomLocation(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 text-slate-200 w-28" />
          )}
        </div>
            <div className="flex items-center gap-2">
        <span className="text-slate-400 font-bold uppercase tracking-widest">🎙️ 說書人</span>
        <input 
            type="text" 
            value={storyteller} 
            onChange={e => setStoryteller(e.target.value)} 
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 text-slate-200 w-28" 
            placeholder="說書人姓名" 
        />
    </div>
      </div>

      <div className="bg-slate-900/50 border-b border-slate-800 p-4 shrink-0 shadow-inner z-10 w-full overflow-y-auto max-h-[35vh] custom-scrollbar"
            style={{ 
            resize: 'vertical', 
            minHeight: '120px', 
            maxHeight: '70vh', 
            height: '25vh', 
            borderBottom: '4px solid rgba(99, 102, 241, 0.2)' 
        }}
>
        <div className="flex overflow-x-auto snap-x scroll-smooth gap-3 p-2 sm:grid sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 justify-items-center max-w-full custom-scrollbar">
          {players.map((p) => (
            <div key={p.id} className={`snap-center shrink-0 w-24 sm:w-full flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all relative ${p.isDead ? 'bg-slate-950/80 border-slate-800 grayscale' : p.role ? 'bg-slate-800 border-indigo-500/30' : 'bg-slate-800/50 border-dashed border-slate-600'}`}>
              <div className="absolute -top-2 -left-2 w-6 h-6 bg-slate-800 text-slate-300 text-[11px] font-black rounded-full flex items-center justify-center border border-slate-600 shadow-lg z-10">
                {p.id}
              </div>
              {gamePhase.type !== 'Setup' && gamePhase.type !== 'Prep' && (
                <button onClick={() => togglePlayerDead(p.id)} className={`absolute -top-2 -right-2 p-1.5 rounded-full shadow-lg border ${p.isDead ? 'bg-slate-700 text-slate-400 border-slate-600' : 'bg-red-900/80 text-red-400 border-red-700 hover:scale-110 z-10'}`}>
                  <span className="text-sm">💀</span>
                </button>
              )}
              <button onClick={() => setSelectingRoleFor(p.id)} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-indigo-400 transition-all shrink-0">
                {p.role ? (
                  <img src={getIconUrl(p.role)} className="w-12 h-12 sm:w-14 sm:h-14 object-contain filter drop-shadow-md" alt="" onError={(e)=>e.target.style.display='none'} />
                ) : (
                  <span className="text-xl opacity-50">➕</span>
                )}
              </button>
              <div className="text-[9px] sm:text-[10px] font-black text-slate-400 h-3 truncate w-full text-center">
                {p.role ? p.role.name : '未指派'}
                {p.hiddenRole && <span className="text-purple-400 ml-1">({p.hiddenRole})</span>}
              </div>
              <input 
                type="text" 
                value={p.name}
                onChange={(e) => updatePlayerName(p.id, e.target.value)}
                className={`w-full bg-black/40 text-center text-xs font-bold py-1.5 rounded-lg outline-none focus:border-indigo-500 border border-transparent ${p.isDead ? 'text-slate-500 line-through' : 'text-white'}`}
              />
            </div>
          ))}
        </div>
      </div>

      {selectingRoleFor !== null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-start sm:items-center justify-center p-4 pt-24 sm:pt-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl w-full max-w-5xl max-h-[85vh] border border-slate-700 flex flex-col shadow-2xl">
   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-5 border-b border-slate-800 gap-3 sm:gap-0">
  
  {/* 標題區：縮小手機版字體並允許換行 */}
  <h2 className="text-base sm:text-lg font-black flex flex-wrap items-center gap-1 sm:gap-2">
    為 <span className="text-indigo-400">{players.find(p=>p.id===selectingRoleFor)?.name}</span> 選擇劇本角色
  </h2>

  {/* 操作區：手機版佔滿寬度，搜尋框與關閉按鈕並排 */}
  <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
    <div className="relative flex-1 sm:flex-none">
      <span className="absolute left-3 top-2.5 sm:top-2 opacity-50">🔍</span>
      <input 
        type="text" 
        placeholder="搜尋角色..." 
        value={searchTerm} 
        onChange={(e) => setSearchTerm(e.target.value)} 
        className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 text-white w-full sm:w-64" 
      />
    </div>
    
    {/* 關閉按鈕 */}
    <button 
      onClick={() => setSelectingRoleFor(null)} 
      className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 shrink-0"
    >
      <span className="text-lg sm:text-xl">❌</span>
    </button>
  </div>

 <div className="flex gap-2 overflow-x-auto pb-2 px-1 no-scrollbar sm:flex-wrap">
  {[
    { id: 'townsfolk', name: '鎮民', color: 'border-blue-500 text-blue-400' },
    { id: 'outsider', name: '外來者', color: 'border-blue-300 text-blue-200' },
    { id: 'minion', name: '爪牙', color: 'border-red-500 text-red-400' },
    { id: 'demon', name: '惡魔', color: 'border-red-700 text-red-600' },
    { id: 'traveller', name: '旅行者', color: 'border-purple-500 text-purple-400' }
  ].map(cat => (
    <button
      key={cat.id}
      onClick={() => {
        const el = document.getElementById(`role-section-${cat.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
      className={`px-3 py-1 rounded-full border bg-slate-800/50 text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all hover:bg-slate-700 ${cat.color}`}
    >
      {cat.name}
    </button>
  ))}
</div>
</div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {allAvailableRoles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                  <span className="text-4xl opacity-20">📖</span>
                  <p>請先由右上角讀入劇本 JSON 檔案</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {['townsfolk', 'outsider', 'minion', 'demon', 'traveller'].map(team => {
                    const source = (script && script.length > 0) ? allAvailableRoles : roleCatalog;
                    const teamRoles = source.filter(r => r.team === team && (r.name.includes(searchTerm) || r.id.toLowerCase().includes(searchTerm.toLowerCase())));
                    if (teamRoles.length === 0) return null;
                    return (
                      <section key={team} id={`role-section-${team}`} className="space-y-3 scroll-mt-4">
                        <h3 className="text-xs font-black uppercase tracking-widest border-l-4 pl-2 border-indigo-500 text-slate-400">
                          {team === 'townsfolk' ? '鎮民' : team === 'outsider' ? '外來者' : team === 'minion' ? '爪牙' : team === 'demon' ? '惡魔' : '旅行者'}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
                          {teamRoles.map(role => (
                            <button 
                              key={role.id}
                              onClick={() => {
                                setPlayers(players.map(p => p.id === selectingRoleFor ? { ...p, role, hiddenRole: "" } : p));
                                setSelectingRoleFor(null);
                              }}
                              className="flex flex-col items-center p-3 bg-slate-800 hover:bg-indigo-600/30 rounded-xl border border-slate-700 transition-all group relative"
                            >
                              <img src={getIconUrl(role)} className="w-12 h-12 object-contain group-hover:scale-110 transition-transform mb-2" alt="" onError={(e)=>e.target.style.display='none'} />
                              <span className="text-xs font-bold text-center w-full truncate">{role.name}</span>
                              {role.team === 'traveller' && <span className="text-[8px] text-slate-500 opacity-60 absolute top-1 right-2">旅行者</span>}
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        <main className="flex-1 flex flex-col sm:flex-row  sm:overflow-hidden bg-[#020617] ">
        
        <div className="flex-1 min-h-0 min-w-0 p-4 lg:p-6 overflow-y-auto custom-scrollbar border-r border-slate-800">
          {gamePhase.type === 'Setup' ? (
            /*
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 py-10">
              <span className="text-6xl opacity-20">👥</span>
              <h2 className="text-xl font-black text-slate-400">遊戲準備中</h2>
              <p className="text-sm">請在上方的網格座位中，點擊加號為每位玩家分配角色。</p>
              <p className="text-xs text-center">分配完成後點擊右上角的「進入準備階段」。<br/>⚠️ 如果想重置，點擊左上角的「🔄 重置」按鈕。</p>
            </div>
               */
          <div className="h-full flex flex-col items-center justify-center space-y-8 animate-fadeIn">
     <div className="text-center">
        <h2 className="text-2xl font-black text-slate-400 mb-2">準備開局</h2>
        <p className="text-xs text-slate-600 uppercase tracking-widest">請先分配玩家角色或選擇官方劇本</p>
     </div>
        
        <button 
        type="button"
        onClick={resetScript}
        className={`w-fit mx-auto px-10 p-3 rounded-2xl border-2 mb-2 transition-all flex items-center justify-center gap-2 ${
            script.length === 0 
            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' // 當前就是全角色模式的樣式
            : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-indigo-500 hover:text-indigo-400'
        }`}
    >
        <span className="text-xs">🌐</span>
        <span className="text-base font-black">顯示所有角色 (不限劇本)</span>
    </button>
        
     <div className="flex flex-col gap-4 w-full max-w-sm">
        <label className="text-base font-black text-indigo-500 uppercase tracking-widest text-center">快速載入劇本庫</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
          {publicScripts.length > 0 ? publicScripts.map(item => (
            <button
              key={item.slug}
              type="button"
              onClick={() => loadPublicScript(item)}
              className={`relative min-h-24 overflow-hidden rounded-2xl border-2 bg-slate-900 transition-all ${scriptName === item.name_zh_tw ? 'border-indigo-400' : 'border-slate-800 hover:border-indigo-500'}`}
            >
              {item.logo_image_url && <img src={item.logo_image_url} alt="" className="absolute inset-0 w-full h-full object-contain p-2" />}
              <span className="absolute inset-x-0 bottom-0 bg-black/75 px-2 py-1.5 text-sm font-black text-white">{item.name_zh_tw}</span>
            </button>
          )) : Object.keys(DEFAULT_SCRIPTS_DATA).map(name => (
            <button 
              key={name} 
              type="button"
              onClick={() => loadBuiltInScript(name)}
              className={`p-3 rounded-2xl border-2 text-base font-black transition-all ${scriptName === name ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
            >
              {name}
            </button>
          ))}


        </div>
       
        <div className="h-px bg-slate-800 my-2"></div>
              
     </div>
     
     <p className="text-[14px] text-slate-700 italic text-center max-w-xs">或者點擊右上角「📜 載入劇本」上傳 JSON。完成後點擊右上角「進入準備階段」。</p>
     </div>
          ) : gamePhase.type === 'Prep' ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <span className="text-2xl opacity-80">📖</span>
                <h2 className="text-xl font-black">準備階段 (配置隱藏資訊)</h2>
              </div>
              
              <div className="bg-red-950/20 border border-red-900/30 p-5 rounded-3xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/10 blur-2xl rounded-full"></div>
                <h3 className="text-sm font-black text-red-400 flex items-center gap-2 mb-4 relative z-10">
                  <span className="text-sm">💀</span> 惡魔首夜偽裝 (三個不在場角色)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
                  {[1, 2, 3].map(num => (
                    <div key={num}>
                      <label className="text-[10px] font-black text-red-500/70 uppercase">偽裝角色 {num}</label>
                      <select 
                        value={demonBluffs[`r${num}`]}
                        onChange={e => setDemonBluffs({...demonBluffs, [`r${num}`]: e.target.value})}
                        className="w-full bg-slate-900/80 border border-red-900/50 rounded-xl px-3 py-2 text-xs outline-none focus:border-red-500 mt-1 text-slate-200"
                      >
                        <option value="">選擇角色...</option>
                        {(script && script.length > 0 ? script : roleCatalog).map(r => (
                          <option key={r.id} value={r.name}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => {
                    recordEvent("系統", "給予偽裝", "惡魔", `不在場角色: ${demonBluffs.r1 || '無'}, ${demonBluffs.r2 || '無'}, ${demonBluffs.r3 || '無'}`);
                    setDemonBluffs({...demonBluffs, recorded: true});
                  }}
                  className={`mt-5 w-full font-black py-2.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2 relative z-10 ${demonBluffs.recorded ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-900/50 hover:bg-red-800/80 text-red-200 border border-red-700/50'}`}
                >
                  {demonBluffs.recorded ? <><span className="text-sm">✅</span> 已記錄偽裝</> : '記錄惡魔偽裝'}
                </button>
              </div>

              <div className="bg-purple-950/20 border border-purple-900/30 p-5 rounded-3xl shadow-lg relative overflow-hidden mt-6">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/10 blur-2xl rounded-full"></div>
                <h3 className="text-sm font-black text-purple-400 flex items-center gap-2 mb-4 relative z-10">
                  <span className="text-sm opacity-80">👥</span> 🎭 指派隱藏身分 (酒鬼、提線木偶、瘋子、悟道者)
                </h3>
                <div className="flex gap-3 relative z-10 items-center">
                  <select 
                    value={hiddenTarget}
                    onChange={e => setHiddenTarget(e.target.value)}
                    className="flex-1 bg-slate-900/80 border border-purple-900/50 rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-500 text-slate-200"
                  >
                    <option value="">選擇目標玩家...</option>
                    {players.filter(p => p.name).map(p => (
                      <option key={p.id} value={p.id}>
                    {p.id}號 {p.name} ({p.role?.name || "尚未選角"})
                      </option>
                    ))}
                  </select>
                  <select 
                    value={hiddenValue}
                    onChange={e => setHiddenValue(e.target.value)}
                    className="w-32 bg-slate-900/80 border border-purple-900/50 rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-500 text-slate-200 shrink-0"
                  >
                    <option value="">選擇身分...</option>
                    <option value="酒鬼">酒鬼</option>
                    <option value="提線木偶">提線木偶</option>
                    <option value="瘋子">瘋子</option>
                    <option value="悟道者">悟道者</option>
                  </select>
                </div>
                <button 
                  onClick={() => {
                    if (!hiddenTarget || !hiddenValue) return;
                    const targetPlayer = players.find(p => p.id === Number(hiddenTarget));
                    if (targetPlayer) {
                      setPlayers(players.map(p => p.id === targetPlayer.id ? { ...p, hiddenRole: hiddenValue } : p));
                      recordEvent("系統", "指派隱藏身分", targetPlayer.name, `表面角色: ${targetPlayer.role ? targetPlayer.role.name : '未指派'} | 實際身分: ${hiddenValue}`);
                      setHiddenTarget("");
                      setHiddenValue("");
                    }
                  }}
                  className="mt-5 w-full bg-purple-900/50 hover:bg-purple-800/80 text-purple-200 border border-purple-700/50 font-black py-2.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2 relative z-10"
                >
                  寫入日誌並標記
                </button>
              </div>
            </div>
          ) : gamePhase.type === 'Night' ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <span className="text-2xl">🌙</span>
                <h2 className="text-xl font-black">第 {gamePhase.number} 夜 - 喚醒順序清單</h2>
              </div>
              
              {wakingOrder.length === 0 ? (
                <p className="text-slate-500 italic text-center py-10">今晚沒有任何角色需要被喚醒。</p>
              ) : (
                <div className="space-y-4">
                  {wakingOrder.map((player) => {
                    const reminderText = gamePhase.number === 1 ? player.role.firstNightReminder : player.role.otherNightReminder;
                    return (
                      <RoleActionCard 
                        key={player.id} 
                        player={player} 
                        reminder={reminderText}
                        onRecord={(action, target, detail) => recordEvent(player.role.name, action, target, detail)}
                        players={players}
                        script={script}
                        roleCatalog={roleCatalog}
                      />
                    );
                  })}
                </div>
              )}
<div className="bg-slate-900/50 border border-slate-700 p-6 rounded-[2rem] shadow-xl space-y-4 mt-8 mb-10">
  <h3 className="text-sm font-black text-indigo-400 flex items-center gap-2 mb-2">
    🌙 自由夜間行動
  </h3>
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="text-[10px] font-black text-slate-500 uppercase">執行者</label>
      <input 
        type="text" 
        list="player-list"
        value={nightAction.actor} 
        onChange={e => setNightAction({...nightAction, actor: e.target.value})} 
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-indigo-500 text-sm" 
        placeholder="例如: 某玩家、系統..." 
      />
    </div>
    <div>
      <label className="text-[10px] font-black text-slate-500 uppercase">動作</label>
      <input 
        type="text" 
        value={nightAction.action} 
        onChange={e => setNightAction({...nightAction, action: e.target.value})} 
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-indigo-500 text-sm" 
        placeholder="例如: 更改標記、筆記..." 
      />
    </div>
    <div>
      <label className="text-[10px] font-black text-slate-500 uppercase">目標對象 (選填)</label>
      <input 
        type="text" 
        list="player-list"
        value={nightAction.target} 
        onChange={e => setNightAction({...nightAction, target: e.target.value})} 
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-indigo-500 text-sm" 
        placeholder="例如: 玩家B" 
      />
    </div>
    <div>
      <label className="text-[10px] font-black text-slate-500 uppercase">細節備註</label>
      <input 
        type="text" 
        value={nightAction.detail} 
        onChange={e => setNightAction({...nightAction, detail: e.target.value})} 
        onKeyPress={(e) => e.key === 'Enter' && recordEvent(nightAction.actor, nightAction.action, nightAction.target, nightAction.detail)}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-indigo-500 text-sm" 
        placeholder="輸入更多細節..." 
      />
    </div>
  </div>
  <button 
    onClick={() => {
      if(!nightAction.actor && !nightAction.detail) return;
      recordEvent(nightAction.actor || "說書人", nightAction.action, nightAction.target, nightAction.detail);
      setNightAction({ actor: "", action: "夜間行動", target: "", detail: "" });
    }}
    className="w-full bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-200 border border-indigo-700/50 font-black py-3 rounded-xl transition-all active:scale-95"
  >
    寫入夜間日誌
  </button>
</div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <span className="text-2xl">☀️</span>
                <h2 className="text-xl font-black">第 {gamePhase.number} 天 - 事件紀錄</h2>
              </div>

              {dayActors.length > 0 && (
                <div className="space-y-4 mb-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="text-sm">☀️</span> 專屬日間行動
                  </h3>
                  {dayActors.map(player => (
                    <RoleActionCard 
                      key={player.id} 
                      player={player} 
                      reminder={player.role.ability}
                      onRecord={(action, target, detail) => recordEvent(player.role.name, action, target, detail)}
                      players={players}
                      script={script}
                      roleCatalog={roleCatalog}
                    />
                  ))}
                </div>
              )}
              
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-[2rem] shadow-xl space-y-4">
                <h3 className="text-sm font-black text-yellow-500 flex items-center gap-2 mb-2">
                  ⚖️ 提名與投票紀錄
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase">提名人</label>
                    <select 
                      value={nominationRecord.nominator} 
                      onChange={e => setNominationRecord({...nominationRecord, nominator: e.target.value})} 
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 mt-1 outline-none focus:border-yellow-500 text-sm"
                    >
                      <option value="">選擇玩家...</option>
                      {players.filter(p => p.name).map(p => <option key={p.id} value={p.name}>{p.id} 號 - {p.name} ({p.role?.name || "尚未選角"})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase">被提名人</label>
                    <select 
                      value={nominationRecord.target} 
                      onChange={e => setNominationRecord({...nominationRecord, target: e.target.value})} 
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 mt-1 outline-none focus:border-yellow-500 text-sm"
                    >
                      <option value="">選擇玩家...</option>
                      {players.filter(p => p.name).map(p => <option key={p.id} value={p.name}>{p.id} 號 - {p.name} ({p.role?.name || "尚未選角"})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase">獲得票數</label>
                    <input 
                      type="number" min="0" 
                      value={nominationRecord.votes} 
                      onChange={e => setNominationRecord({...nominationRecord, votes: e.target.value})} 
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-yellow-500 text-sm" 
                      placeholder="輸入票數..." 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase">表決結果</label>
                    <select 
                      value={nominationRecord.result} 
                      onChange={e => setNominationRecord({...nominationRecord, result: e.target.value})} 
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 mt-1 outline-none focus:border-yellow-500 text-sm"
                    >
                      <option value="未達門檻">未達門檻</option>
                      <option value="上處決台">上處決台</option>
                    </select>
                  </div>
                </div>
                <button 
           // 🟢 修改提名按鈕的 onClick 邏輯
                onClick={() => {
              if(!nominationRecord.nominator || !nominationRecord.target) return;
  
                // 🔴 格式微調：讓票數與結果更顯眼
              const voteDetail = `【票數: ${nominationRecord.votes}】» 判決: ${nominationRecord.result}`;
              recordEvent(nominationRecord.nominator, "發起提名", nominationRecord.target, voteDetail);
  
              setNominationRecord({ nominator: "", target: "", votes: "", result: "未達門檻" });
              }}
                  className="w-full bg-yellow-700 hover:bg-yellow-600 text-white font-black py-3 rounded-xl transition-all active:scale-95"
                >
                  記錄提名
                </button>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] shadow-inner space-y-4">
                <h3 className="text-sm font-black text-slate-400 flex items-center gap-2 mb-2">
                  📝 自由日間紀錄
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase">執行者 / 發起人</label>
                    <input type="text" list="player-list" value={dayAction.actor} onChange={e => setDayAction({...dayAction, actor: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-slate-500 text-sm" placeholder="例如: 玩家A" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase">動作</label>
                    <input type="text" value={dayAction.action} onChange={e => setDayAction({...dayAction, action: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-slate-500 text-sm" placeholder="例如: 發動技能" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase">目標對象 (選填)</label>
                    <input type="text" list="player-list" value={dayAction.target} onChange={e => setDayAction({...dayAction, target: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-slate-500 text-sm" placeholder="例如: 玩家B" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase">結果細節</label>
                    <input type="text" value={dayAction.detail} onChange={e => setDayAction({...dayAction, detail: e.target.value})} onKeyPress={(e) => e.key === 'Enter' && recordEvent(dayAction.actor, dayAction.action, dayAction.target, dayAction.detail)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-slate-500 text-sm" placeholder="例如: 額外資訊" />
                  </div>
                </div>
                <button 
                  onClick={() => {
                    recordEvent(dayAction.actor, dayAction.action, dayAction.target, dayAction.detail);
                    setDayAction({ actor: "", action: "白天行動", target: "", detail: "" });
                  }}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-black py-3 rounded-xl transition-all active:scale-95"
                >
                  寫入自由紀錄
                </button>
              </div>
            </div>
          )}

        </div>

        <div className="flex-1 min-h-0 min-w-0 bg-slate-950/50 p-4 lg:p-6 overflow-y-auto custom-scrollbar flex flex-col relative border-l border-slate-800">
          <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-950 py-2 z-10 px-2">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">時間軸紀錄 (Timeline)</h3>
        <button onClick={triggerExportSelection} className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 font-bold bg-indigo-900/30 px-3 py-1.5 rounded-lg transition-colors">
         <span className="text-sm">📥</span> 匯出文字檔
            </button>
          </div>

          <div className="space-y-8 pb-20">
            {logs.length === 0 && <p className="text-center text-slate-600 italic py-10">尚無紀錄...</p>}
            
            {logs.map((phaseLog, idx) => (
              <div key={idx} className="animate-fadeIn">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-slate-800"></div>
                  <span className="text-xs font-black text-slate-500 tracking-[0.2em]">{phaseLog.phase}</span>
                  <div className="h-px flex-1 bg-slate-800"></div>
                </div>

                <div className="space-y-2">
                  {phaseLog.events.map((event) => (
                    <div key={event.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex gap-4 hover:border-slate-700 transition-colors group relative">
                      
                      {editingLog?.id === event.id ? (
                        <div className="flex-1 flex flex-col gap-2 w-full animate-in fade-in">
                          <div className="flex gap-2">
                            <input className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 text-xs px-3 py-2 rounded-lg outline-none text-white" value={editingLog.actor} onChange={e=>setEditingLog({...editingLog, actor:e.target.value})} placeholder="執行者" />
                            <input className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 text-xs px-3 py-2 rounded-lg outline-none text-white" value={editingLog.action} onChange={e=>setEditingLog({...editingLog, action:e.target.value})} placeholder="動作" />
                            <input className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 text-xs px-3 py-2 rounded-lg outline-none text-white" value={editingLog.target} onChange={e=>setEditingLog({...editingLog, target:e.target.value})} placeholder="目標" />
                          </div>
                          <textarea className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 text-xs px-3 py-2 rounded-lg outline-none text-white min-h-[60px]" value={editingLog.detail} onChange={e=>setEditingLog({...editingLog, detail:e.target.value})} placeholder="備註" />
                          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800">
                            <div className="flex items-center gap-1">
                              <button onClick={() => moveEvent(idx, event.id, 'up')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg text-xs font-bold text-white flex items-center gap-1" title="上移">
                                <span className="text-[10px]">⬆️</span> 上移
                              </button>
                              <button onClick={() => moveEvent(idx, event.id, 'down')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg text-xs font-bold text-white flex items-center gap-1" title="下移">
                                <span className="text-[10px]">⬇️</span> 下移
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setEditingLog(null)} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 transition-colors rounded-lg text-xs font-bold text-white">取消</button>
                              <button onClick={saveEditLog} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-lg text-xs font-bold text-white">儲存變更</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <button onClick={() => moveEvent(idx, event.id, 'up')} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors" title="上移"><span className="text-xs">⬆️</span></button>
                            <button onClick={() => moveEvent(idx, event.id, 'down')} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors" title="下移"><span className="text-xs">⬇️</span></button>
                            <button onClick={() => startEditLog(idx, event)} className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors ml-1" title="編輯"><span className="text-xs">✏️</span></button>
                            <button onClick={() => deleteLog(idx, event.id)} className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors" title="刪除"><span className="text-xs">🗑️</span></button>
                          </div>

                          {event.action === '狀態快照' ? (
                            <div className="flex-1 w-full text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                              {event.detail}
                            </div>
                          ) : (
                            <>
                              <div className="text-[10px] font-black text-slate-600 pt-1 shrink-0">{event.time}</div>
                              <div className="flex-1 pr-24">
                                <div className="text-sm font-bold text-white flex flex-wrap items-center gap-x-2">
                                  <span className={`${event.actor === '系統' ? 'text-slate-400' : 'text-indigo-300'}`}>{event.actor}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${event.actor === '系統' ? 'bg-slate-800 text-slate-500' : 'bg-slate-800 text-slate-400'}`}>{event.action}</span>
                                  {event.target && event.target !== "無" && <span className={`${event.actor === '系統' ? 'text-slate-500' : 'text-emerald-300'}`}>{event.target}</span>}
                                </div>
                                {event.detail && event.detail !== "無備註" && event.detail.trim() !== "" && (
                                  <div className="text-xs text-slate-400 mt-2 whitespace-pre-wrap leading-relaxed bg-black/20 p-2 rounded-lg border-l-2 border-slate-700">
                                    └ {event.detail}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  {phaseLog.events.length === 0 && <div className="text-xs text-slate-600 italic pl-12">無動作紀錄</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
            <datalist id="player-list">
  {players.map(p => (
    <option key={p.id} value={`${p.id}. ${p.name} (${p.role?.name || "尚未選角"})`} />
    ))}
</datalist>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('recorder-root'));
root.render(<App />);
