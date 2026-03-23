// ==========================================
// 日間行動角色清單 (用於在白天階段自動列出)
// ==========================================
const DAY_ACTION_ROLES = [
  'slayer', 'savant', 'gossip', 'juggler', 'artist', 'fisherman',
  'alsaahir', 'bianlianshi', 'geling', 'yishi', 'princess',
  'psychopath', 'goblin', 'vizier',
  'gunslinger', 'matron', 'butcher', 'judge', 'gangster', 'jiaohuazi', 'diaomin',
  'mutant', 'klutz', 'moonchild', 'golem',
  '殺手', '博學者', '造謠者', '雜耍藝人', '藝術家', '漁夫', '戲法師', '變臉師', '歌伶', '驛使', '公主', '精神病患者', '精神病患', '哥布林', '維齊爾', '槍手', '女舍監', '屠夫', '法官', '黑幫', '叫花子', '刁民', '畸形秀演員', '呆瓜', '月之子', '魔像'
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

  if (isRole(['banshee', 'zealot', 'xaan', 'wraith', 'princess', 'hermit', 'soldier', 'mayor', 'drunk', 'saint', 'recluse', 'scarlet_woman', 'baron', 'mastermind', 'deviant', 'butcher', 'mutant', 'sweetheart', 'atheist', 'cannibal', 'snitch', 'damsel', 'heretic', 'politician', 'boomdandy', 'marionette', 'leviathan', 'vizier', 'shijie', 'heshang', 'yangguren', 'jinweijun', 'shusheng', 'ganshiren', 'banxian', 'wudaozhe', 'xizi', 'ranfangfangzhu', 'diaomin', 'yongjiang', 'xizi_new', 'rulianshi', 'beggar', 'scapegoat'], ['報喪女妖', '狂熱者', '限', '亡魂', '公主', '隱士', '士兵', '鎮長', '市長', '酒鬼', '聖徒', '陌客', '紅唇女郎', '猩紅女郎', '男爵', '主謀', '怪咖', '屠夫', '畸形秀演員', '心上人', '無神論者', '食人族', '告密者', '落難少女', '異端分子', '政客', '炸彈人', '提線木偶', '利維坦', '維齊爾', '使節', '和尚', '養蠱人', '禁衛軍', '書生', '趕屍人', '半仙', '悟道者', '戲子', '染坊坊主', '刁民', '俑匠', '戲子（改）', '入殮師', '乞丐', '替罪羊', '报丧女妖', '狂热者', '镇长', '市长', '圣徒', '红唇女郎', '猩红女郎', '主谋', '畸形秀演员', '无神论者', '落难少女', '异端分子', '炸弹人', '提线木偶', '利维坦', '维齐尔', '使节', '养蛊人', '禁卫军', '书生', '赶尸人', '戏子(改)', '入殓师'])) return [];

  return [
    { key: 'target', type: 'player', label: '目標對象' }
  ];
};
