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
  {id:"thief",name:"竊賊",team:"traveller",firstNight:105,otherNight:110,firstNightReminder:"竊賊指向一名玩家。將負票標記放在那名玩家旁。",otherNightReminder:"竊賊指向一名玩家。將負票標記放在那名玩家旁。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/thief.png"},
  {id:"investigator",name:"調查員",team:"townsfolk",firstNight:7700,otherNight:0,firstNightReminder:"展示那個爪牙角色標記。指向被你標記“爪牙”和“錯誤”的兩名玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/investigator.png"},
  {id:"librarian",name:"圖書管理員",team:"townsfolk",firstNight:7600,otherNight:0,firstNightReminder:"展示那個外來者角色標記。指向被你標記“外來者”和“錯誤”的兩名玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/librarian.png"},
  {id:"washerwoman",name:"洗衣婦",team:"townsfolk",firstNight:7500,otherNight:0,firstNightReminder:"展示那個鎮民角色標記。指向被你標記“鎮民”和“錯誤”的兩名玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/washerwoman.png"},
  {id:"bureaucrat",name:"官員",team:"traveller",firstNight:100,otherNight:100,firstNightReminder:"官員指向一名玩家。將三票標記放在那名玩家旁。",otherNightReminder:"官員指向一名玩家。將三票標記放在那名玩家旁。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/bureaucrat.png"},
  {id:"chef",name:"廚師",team:"townsfolk",firstNight:7800,otherNight:0,firstNightReminder:"給他展示數字手勢來告訴他場上鄰座邪惡玩家有多少對。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/chef.png"},
  {id:"empath",name:"共情者",team:"townsfolk",firstNight:7900,otherNight:11000,firstNightReminder:"給他展示數字手勢來告訴他與他鄰近的存活玩家有幾人是邪惡的。",otherNightReminder:"給他展示數字手勢來告訴他與他鄰近的存活玩家有幾人是邪惡的。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/empath.png"},
  {id:"fortune_teller",name:"占卜師",team:"townsfolk",firstNight:8000,otherNight:11100,firstNightReminder:"讓占卜師選擇兩名玩家。如果其中有惡魔或“幹擾項”，點頭示意，否則搖頭。",otherNightReminder:"讓占卜師選擇兩名玩家。如果其中有惡魔或“幹擾項”，點頭示意，否則搖頭。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/fortune_teller.png"},
  {id:"undertaker",name:"送葬者",team:"townsfolk",firstNight:0,otherNight:11300,otherNightReminder:"如果有玩家今天白天死於處決，喚醒送葬者並對他展示那名玩家的角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/undertaker.png"},
  {id:"slayer",name:"獵手",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/slayer.png"},
  {id:"virgin",name:"貞潔者",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/virgin.png"},
  {id:"ravenkeeper",name:"守鴉人",team:"townsfolk",firstNight:0,otherNight:9800,otherNightReminder:"如果守鴉人今晚死亡，喚醒他並讓他選擇一名玩家。對他展示那名玩家的角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/ravenkeeper.png"},
  {id:"monk",name:"僧侶",team:"townsfolk",firstNight:0,otherNight:2200,otherNightReminder:"讓僧侶選擇除自己外的一名玩家。標記那名玩家被保護。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/monk.png"},
  {id:"soldier",name:"士兵",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/soldier.png"},
  {id:"mayor",name:"鎮長",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/mayor.png"},
  {id:"butler",name:"管家",team:"outsider",firstNight:8100,otherNight:11200,firstNightReminder:"讓管家選擇一名玩家。標記那名玩家為他的主人。",otherNightReminder:"讓管家選擇一名玩家。標記那名玩家為他的主人。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/butler.png"},
  {id:"drunk",name:"酒鬼",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/drunk.png"},
  {id:"spy",name:"間諜",team:"minion",firstNight:11700,otherNight:14400,firstNightReminder:"將魔典展示給間諜，他想看多久就看多久。",otherNightReminder:"將魔典展示給間諜，他想看多久就看多久。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/spy.png"},
  {id:"poisoner",name:"投毒者",team:"minion",firstNight:4600,otherNight:1400,firstNightReminder:"讓投毒者選擇一名玩家。標記那名玩家中毒。",otherNightReminder:"讓投毒者選擇一名玩家。標記那名玩家中毒。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/poisoner.png"},
  {id:"saint",name:"聖徒",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/saint.png"},
  {id:"recluse",name:"陌客",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/recluse.png"},
  {id:"scarlet_woman",name:"紅唇女郎",team:"minion",firstNight:0,otherNight:3700,otherNightReminder:"如果紅唇女郎今天變成了小惡魔，對她展示“你是”信息標記，和小惡魔角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/scarlet_woman.png"},
  {id:"baron",name:"男爵",team:"minion",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/baron.png"},
  {id:"imp",name:"小惡魔",team:"demon",firstNight:0,otherNight:4900,otherNightReminder:"讓小惡魔選擇一名玩家。標記那名玩家死亡。如果小惡魔選擇了自己：用一個備用的小惡魔標記替換一個存活的爪牙角色標記。讓原來的小惡魔重新入睡。喚醒新的小惡魔。對他展示“你是”信息標記，和小惡魔角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/imp.png"},
  {id:"voudon",name:"巫毒師",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/voudon.png"},
  {id:"apprentice",name:"學徒",team:"traveller",firstNight:120,otherNight:0,firstNightReminder:"對學徒展示一個鎮民或爪牙標記。在魔典中，用那個角色標記代替學徒標記，並在一旁標識該玩家是學徒。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/apprentice.png"},
  {id:"matron",name:"女舍監",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/matron.png"},
  {id:"judge",name:"法官",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/judge.png"},
  {id:"bishop",name:"主教",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/bishop.png"},
  {id:"grandmother",name:"祖母",team:"townsfolk",firstNight:8300,otherNight:9500,firstNightReminder:"指向她的孫子玩家，並展示該玩家的角色標記。",otherNightReminder:"如果孫子被惡魔殺死，祖母也會一同死亡。標記祖母死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/grandmother.png"},
  {id:"sailor",name:"水手",team:"townsfolk",firstNight:3500,otherNight:1000,firstNightReminder:"讓水手選擇一名存活玩家。標記那名玩家或水手醉酒。",otherNightReminder:"讓水手選擇一名存活玩家。標記那名玩家或水手醉酒。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/sailor.png"},
  {id:"chambermaid",name:"侍女",team:"townsfolk",firstNight:12400,otherNight:14800,firstNightReminder:"讓侍女選擇除自己外的兩名存活玩家。給她展示數字手勢來告訴她這些玩家中有幾人因自身能力被喚醒。",otherNightReminder:"讓侍女選擇除自己外的兩名存活玩家。給她展示數字手勢來告訴她這些玩家中有幾人因自身能力被喚醒。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/chambermaid.png"},
  {id:"exorcist",name:"驅魔人",team:"townsfolk",firstNight:0,otherNight:4300,otherNightReminder:"讓驅魔人選擇一名玩家，不能是上一夜他選擇過的玩家。讓驅魔人重新入睡。如果驅魔人選中了惡魔：喚醒惡魔。展示“該角色的能力對你生效”信息標記和驅魔人角色標記。指向驅魔人玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/exorcist.png"},
  {id:"courtier",name:"侍臣",team:"townsfolk",firstNight:5100,otherNight:1900,firstNightReminder:"侍臣可以選擇一個角色。如果他這麽做了，標記侍臣失去能力，標記被選擇的角色所對應的玩家之一醉酒。",otherNightReminder:"侍臣可以選擇一個角色。如果他這麽做了，標記侍臣失去能力，標記被選擇的角色所對應的玩家之一醉酒。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/courtier.png"},
  {id:"gossip",name:"造謠者",team:"townsfolk",firstNight:0,otherNight:9100,otherNightReminder:"如果白天的聲明為真，會有一名玩家死亡，並由說書人來選擇一名玩家，標記該玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/gossip.png"},
  {id:"gambler",name:"賭徒",team:"townsfolk",firstNight:0,otherNight:2000,otherNightReminder:"讓賭徒選擇一名玩家和一個角色。如果賭徒猜錯了，標記賭徒死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/gambler.png"},
  {id:"innkeeper",name:"旅店老板",team:"townsfolk",firstNight:0,otherNight:1800,otherNightReminder:"讓旅店老板選擇兩名玩家。標記這兩名玩家不會死亡，並標記其中一人醉酒。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/innkeeper.png"},
  {id:"professor",name:"教授",team:"townsfolk",firstNight:0,otherNight:10500,otherNightReminder:"教授可以選擇一名死亡玩家。如果他這麽做了，標記教授失去能力，然後如果那名玩家是鎮民，標記那名玩家被覆活。之後的夜晚無需再喚醒教授。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/professor.png"},
  {id:"minstrel",name:"吟遊詩人",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/minstrel.png"},
  {id:"tea_lady",name:"茶藝師",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/tea_lady.png"},
  {id:"pacifist",name:"和平主義者",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/pacifist.png"},
  {id:"goon",name:"莽夫",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/goon.png"},
  {id:"moonchild",name:"月之子",team:"outsider",firstNight:0,otherNight:9300,otherNightReminder:"如果月之子在白天觸發了死亡能力並選擇了一名善良玩家，該玩家死亡。標記那名玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/moonchild.png"},
  {id:"tinker",name:"修補匠",team:"outsider",firstNight:0,otherNight:9200,otherNightReminder:"修補匠可能會死亡。如果說書人選擇讓修補匠死亡，放置死亡標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/tinker.png"},
  {id:"fool",name:"弄臣",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/fool.png"},
  {id:"lunatic",name:"瘋子",team:"outsider",firstNight:2300,otherNight:4200,firstNightReminder:"如果有七名或更多玩家，喚醒瘋子：展示“他們是你的爪牙”信息標記。指向任意對應數量的玩家。展示“這些角色不在場”信息標記。展示三個善良角色。讓瘋子重新入睡。喚醒惡魔。展示“你是”信息標記和惡魔角色標記。展示“這名玩家是”信息標記和瘋子角色標記，然後指向瘋子玩家。",otherNightReminder:"做任何需要做的事情來模擬一位惡魔的行动。讓瘋子重新入睡。喚醒惡魔。對惡魔展示瘋子角色標記，並指向瘋子玩家，隨後是瘋子的攻擊目標。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/lunatic.png"},
  {id:"godfather",name:"教父",team:"minion",firstNight:5400,otherNight:8700,firstNightReminder:"對他展示所有在場的外來者標記。",otherNightReminder:"如果有外來者在今天白天死亡，讓教父選擇一名玩家。標記那名玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/godfather.png"},
  {id:"devils_advocate",name:"魔鬼代言人",team:"minion",firstNight:5500,otherNight:2600,firstNightReminder:"讓魔鬼代言人選擇一名存活玩家。標記那名玩家處決不死。",otherNightReminder:"讓魔鬼代言人選擇一名存活玩家，不能是上一夜他選擇過的玩家。標記那名玩家處決不死。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/devils_advocate.png"},
  {id:"assassin",name:"刺客",team:"minion",firstNight:0,otherNight:8600,otherNightReminder:"刺客可以選擇一名玩家。如果他這麽做了，標記那名玩家死亡，且刺客失去能力，之後的夜晚無需再喚醒刺客。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/assassin.png"},
  {id:"shabaloth",name:"沙巴洛斯",team:"demon",firstNight:0,otherNight:5200,otherNightReminder:"上一夜被沙巴洛斯選擇且當前已死亡的玩家之一可能被反芻，如果被反芻，標記那名玩家被覆活。讓沙巴洛斯選擇兩名玩家。標記這兩名玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/shabaloth.png"},
  {id:"pukka",name:"普卡",team:"demon",firstNight:6600,otherNight:5100,firstNightReminder:"讓普卡選擇一名玩家。標記那名玩家中毒。",otherNightReminder:"讓普卡選擇一名玩家。標記那名玩家中毒。【圓】上一個因普卡中毒的玩家死亡，隨後恢覆健康。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/pukka.png"},
  {id:"zombuul",name:"僵怖",team:"demon",firstNight:0,otherNight:5000,otherNightReminder:"如果今天白天沒有人死亡，讓僵怖選擇一名玩家。標記那名玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/zombuul.png"},
  {id:"mastermind",name:"主謀",team:"minion",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/mastermind.png"},
  {id:"po",name:"珀",team:"demon",firstNight:0,otherNight:5300,otherNightReminder:"珀可以選擇一名玩家；或如果上一次他被喚醒時未做選擇，讓他選擇三名玩家。標記這些玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/po.png"},
  {id:"deviant",name:"怪咖",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/deviant.png"},
  {id:"bone_collector",name:"集骨者",team:"traveller",firstNight:0,otherNight:140,otherNightReminder:"集骨者選擇不使用能力，或指向一名死亡玩家。放置恢覆能力標記提示，並且該玩家當晚可能會因此醒來並使用能力。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/bone_collector.png"},
  {id:"butcher",name:"屠夫",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/butcher.png"},
  {id:"dreamer",name:"築夢師",team:"townsfolk",firstNight:8500,otherNight:11500,firstNightReminder:"讓築夢師指向一名玩家。對他展示善良和邪惡的角色標記各一個，其中一個是屬於該玩家的角色。",otherNightReminder:"讓築夢師指向一名玩家。對他展示善良和邪惡的角色標記各一個，其中一個是屬於該玩家的角色。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/dreamer.png"},
  {id:"clockmaker",name:"鐘表匠",team:"townsfolk",firstNight:8400,otherNight:0,firstNightReminder:"給他展示數字手勢來告訴他惡魔與爪牙之間最近的距離。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/clockmaker.png"},
  {id:"barista",name:"咖啡師",team:"traveller",firstNight:130,otherNight:120,firstNightReminder:"說書人選擇一名玩家喚醒，並告訴他觸發了咖啡師的什麽效果。",otherNightReminder:"說書人選擇一名玩家喚醒，並告訴他觸發了咖啡師的什麽效果。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/barista.png"},
  {id:"harlot",name:"流鶯",team:"traveller",firstNight:0,otherNight:130,otherNightReminder:"流鶯選擇一名玩家，將其喚醒，那名玩家選擇同意或拒絕。如果同意，將他的角色標記展示給流鶯看。然後說書人可以決定兩名玩家是否會一起死去。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/harlot.png"},
  {id:"snake_charmer",name:"舞蛇人",team:"townsfolk",firstNight:5200,otherNight:2100,firstNightReminder:"讓舞蛇人選擇一名玩家。如果舞蛇人選中了惡魔：展示“你是”信息標記和惡魔角色標記。用拇指向下代表他陣營變為邪惡。在魔典中交換舞蛇人和惡魔的角色標記。讓原來的舞蛇人重新入睡。喚醒原來的惡魔。對原惡魔展示“你是”信息標記和舞蛇人角色標記，並用拇指向上代表他陣營變為善良，並標記這名玩家中毒。",otherNightReminder:"讓舞蛇人选择一名玩家。如果舞蛇人选中了恶魔：展示“你是”信息标記和恶魔角色标記。用拇指向下代表他阵营变为邪恶。在魔典中交换舞蛇人和恶魔的角色标記。让原来的舞蛇人重新入睡。唤醒原来的恶魔。对原恶魔展示“你是”信息标記和舞蛇人角色标記，并用拇指向上代表他阵营变为善良，并标記这名玩家中毒。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/snake_charmer.png"},
  {id:"mathematician",name:"數學家",team:"townsfolk",firstNight:12500,otherNight:14900,firstNightReminder:"給他展示數字手勢來告訴他在首個夜晚里有多少玩家的角色能力受他人影響而未正常生效。",otherNightReminder:"給他展示數字手勢來告訴他從上個黎明到數學家醒來前有多少玩家的角色能力受他人影響而未正常生效。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/mathematician.png"},
  {id:"flowergirl",name:"賣花女孩",team:"townsfolk",firstNight:0,otherNight:11600,otherNightReminder:"對她點頭或搖頭來示意今天白天是否有惡魔投過票。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/flowergirl.png"},
  {id:"town_crier",name:"城鎮公告員",team:"townsfolk",firstNight:0,otherNight:11700,otherNightReminder:"對他點頭或搖頭示意今天白天是否有爪牙發起過提名。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/town_crier.png"},
  {id:"philosopher",name:"哲學家",team:"townsfolk",firstNight:300,otherNight:400,firstNightReminder:"哲學家可以選擇一個角色。如果選擇的角色不在場，將哲學家的角色標題替換成對應角色，並標記“是哲學家”，否則標記該角色對應的玩家醉酒。從現在開始，你需要以哲學家獲得能力的那種角色的行動方式來喚醒哲學家。",otherNightReminder:"哲學家可以選擇一個角色。如果選擇的角色不在場，將哲學家的角色標題替換成對應角色，並標記“是哲學家”，否則標記該角色對應的玩家醉酒。從現在開始，你需要以哲學家獲得能力的那種角色的行動方式來喚醒哲學家。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/philosopher.png"},
  {id:"seamstress",name:"女裁縫",team:"townsfolk",firstNight:8600,otherNight:11900,firstNightReminder:"女裁縫可以選擇除自己以外的兩名玩家。如果她這麽做了，對她點頭或搖頭示意這兩名玩家是否為同一陣營，隨後標記女裁縫失去能力。之後的夜晚無需再喚醒女裁縫。",otherNightReminder:"女裁縫可以選擇除自己以外的兩名玩家。如果她這麽做了，對她點頭或搖頭示意這兩名玩家是否為同一陣營，隨後標記女裁縫失去能力。之後的夜晚無需再喚醒女裁縫。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/seamstress.png"},
  {id:"savant",name:"博學者",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/savant.png"},
  {id:"oracle",name:"神諭者",team:"townsfolk",firstNight:0,otherNight:11800,otherNightReminder:"給他展示數字手勢來告訴他當前已死亡的玩家中有多少玩家是邪惡的。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/oracle.png"},
  {id:"artist",name:"藝術家",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/artist.png"},
  {id:"juggler",name:"雜耍藝人",team:"townsfolk",firstNight:0,otherNight:12000,otherNightReminder:"給他展示數字手勢來告訴他他當天白天猜測正確的次數。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/juggler.png"},
  {id:"sage",name:"賢者",team:"townsfolk",firstNight:0,otherNight:9900,otherNightReminder:"如果惡魔殺死了賢者，喚醒賢者並指向兩名玩家，其中一名玩家是殺死他的惡魔。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/sage.png"},
  {id:"mutant",name:"畸形秀演員",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/mutant.png"},
  {id:"evil_twin",name:"鏡像雙子",team:"minion",firstNight:5600,otherNight:0,firstNightReminder:"喚醒鏡像雙子和他的對立雙子，讓他們進行眼神接觸。對鏡像雙子展示對立雙子的角色標記，並對對立雙子展示鏡像雙子的角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/evil_twin.png"},
  {id:"klutz",name:"呆瓜",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/klutz.png"},
  {id:"barber",name:"理發師",team:"outsider",firstNight:0,otherNight:9600,otherNightReminder:"如果理發師今天死亡了，喚醒惡魔並展示“該角色的效果對你生效”信息標記和理發師角色標記。如果惡魔選擇了兩名玩家，將這兩名玩家分別獨自喚醒。對他們展示“你是”信息標記和他們的新角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/barber.png"},
  {id:"sweetheart",name:"心上人",team:"outsider",firstNight:0,otherNight:9700,otherNightReminder:"如果心上人死亡，會有一名玩家立刻醉酒。如果你還沒有讓這件事情發生，那麽現在為任意一位玩家放置醉酒標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/sweetheart.png"},
  {id:"witch",name:"女巫",team:"minion",firstNight:5700,otherNight:2700,firstNightReminder:"讓女巫選擇一名玩家。標記那名玩家被詛咒。",otherNightReminder:"讓女巫選擇一名玩家。標記那名玩家被詛咒。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/witch.png"},
  {id:"cerenovus",name:"洗腦師",team:"minion",firstNight:5800,otherNight:2800,firstNightReminder:"讓洗腦師選擇一名玩家和一個善良角色。標記那名玩家瘋狂。讓洗腦師重新入睡。喚醒洗腦師的目標。對這名玩家展示“該角色的能力對你生效”信息標記，洗腦師角色標記，該玩家需要瘋狂證明的角色標記。",otherNightReminder:"讓洗腦師選擇一名玩家和一個善良角色。標記那名玩家瘋狂。讓洗腦師重新入睡。喚醒洗腦師的目標。對這名玩家展示“該角色的能力對你生效”信息標記，洗腦師角色標記，該玩家需要瘋狂證明的角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/cerenovus.png"},
  {id:"pit-hag",name:"麻臉巫婆",team:"minion",firstNight:0,otherNight:1390,otherNightReminder:"讓麻臉巫婆選擇一名玩家和一個角色。如果她選擇的角色不在場：讓麻臉巫婆重新入睡。喚醒她的目標玩家。對該玩家展示“你是”信息標記和他的新角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/pit-hag.png"},
  {id:"fang_gu",name:"方古",team:"demon",firstNight:0,otherNight:5400,otherNightReminder:"讓方古選擇一名玩家。標記那名玩家死亡。如果他選擇了外來者，且“限一次”標記未放置在魔典中：用備用的方古角色標記替換那名外來者的角色標記。讓方古重新入睡。喚醒方古的目標玩家。對該玩家展示“你是”信息標記和方古角色標記，並用拇指向下代表他陣營變為邪惡。將“限一次”標記放置在魔典中。標記原本的方古玩家死亡，且他選擇的玩家不會被標記為死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/fang_gu.png"},
  {id:"alsaahir",name:"戲法師",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202406/c_0969358269171_d18a1072.jpg"},
  {id:"vortox",name:"渦流",team:"demon",firstNight:0,otherNight:5600,otherNightReminder:"讓渦流選擇一名玩家。標記那名玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/vortox.png"},
  {id:"no_dashii",name:"諾-達鯴",team:"demon",firstNight:0,otherNight:5500,otherNightReminder:"讓諾-達鯴選擇一名玩家。標記那名玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/no_dashii.png"},
  {id:"vigormortis",name:"亡骨魔",team:"demon",firstNight:0,otherNight:6100,otherNightReminder:"讓亡骨魔選擇一名玩家。標記那名玩家死亡。如果該玩家是爪牙，標記該玩家保留能力，並標記與該玩家鄰近的鎮民玩家之一中毒。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/vigormortis.png"},
  {id:"steward",name:"事務官",team:"townsfolk",firstNight:8700,otherNight:0,firstNightReminder:"喚醒事務官，指向標記有“得知”的那名玩家。讓事務官重新入睡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202305/c_9219342584861_b889322f.jpg"},
  {id:"high_priestess",name:"女祭司",team:"townsfolk",firstNight:11900,otherNight:14500,firstNightReminder:"喚醒女祭司，指向一名玩家。讓女祭司重新入睡。",otherNightReminder:"喚醒女祭司，指向一名玩家。讓女祭司重新入睡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202403/c_7239274181171_90052fc9.jpg"},
  {id:"harpy",name:"鷹身女妖",team:"minion",firstNight:6000,otherNight:3100,firstNightReminder:"喚醒鷹身女妖並讓他依次指向兩名玩家。標記第一名玩家“瘋狂”，標記第二名玩家“第二名”。",otherNightReminder:"喚醒鷹身女妖並讓他依次指向兩名玩家。標記第一名玩家“瘋狂”，標記第二名玩家“第二名”。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202307/c_4331482099861_0db1bfaf.jpg"},
  {id:"shugenja",name:"修行者",team:"townsfolk",firstNight:12000,otherNight:0,firstNightReminder:"在首個夜晚，喚醒修行者。用手指水平指向修行者的某一側，告訴他與他距離最近的邪惡玩家位於這一側。如果修行者兩側最近的邪惡玩家與他的距離相等，由你來決定告訴他什麽樣的信息，並用手指指向對應的一側。讓修行者重新入睡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202411/c_9825126871371_4fbea129.jpg"},
  {id:"kazali",name:"卡紮力",team:"demon",firstNight:1000,otherNight:7750,firstNightReminder:"喚醒卡紮力，讓他選擇玩家變成邪惡爪牙。",otherNightReminder:"除首個夜晚以外的每個夜晚，喚醒卡紮力。讓他指向任意一名玩家。那名玩家死亡——在他角色標記旁放置“死亡”提示標記。讓卡紮力重新入睡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202312/c_7795403383071_0f9107d8.jpg"},
  {id:"hatter",name:"帽匠",team:"outsider",firstNight:0,otherNight:800,otherNightReminder:"在當晚，一同喚醒所有爪牙和惡魔。對他們展示“該角色的能力對你生效”信息標記，然後展示帽匠角色標記。每名以此被喚醒的玩家可以選擇搖頭或指向角色列表上與自己當前角色類型相同的一個角色。如果一名玩家在做出自己的選擇後會使得自己的角色與一名其他玩家选择的角色相同，对他摇头示意他重新选择。在选择完成后让他重新入睡。移除“今晚茶会”提示标记。根据这些玩家的选择，在魔典上执行相应的角色变化操作。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202312/c_9723021341071_86da6df4.jpg"},
  {id:"ojo",name:"奧赫",team:"demon",firstNight:0,otherNight:6200,otherNightReminder:"喚醒奧赫。讓奧赫指向角色列表上的一個角色標記。如果被選擇的角色在場，對應的玩家死亡——使用“死亡”提示標記標記那名玩家。如果被選擇的角色不在場，那麽改為你來選擇任意一名玩家，那名玩家死亡——使用“死亡”提示標記標記那名玩家。讓奧赫重新入睡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_6886084308961_f221dd48.jpg"},
  {id:"plague_doctor",name:"瘟疫醫生",team:"outsider",firstNight:0,otherNight:10000,otherNightReminder:"當瘟疫醫生死亡時，將一個不在場的爪牙角色標記放置在魔典左側的正中位置，並用瘟疫醫生的“說書人能力”標記標記該爪牙角色。如可能，在夜晚順序表旁添加相應的夜晚標記用以提示。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_9614144308961_fe5074b8.jpg"},
  {id:"village_idiot",name:"村夫",team:"townsfolk",firstNight:10100,otherNight:12800,firstNightReminder:"喚醒任意一名村夫。讓村夫指向一名玩家，對他給出拇指向上或向下的手勢代表那名玩家的陣營。重覆這個操作，直到所有村夫玩家都進行了夜晚行動。",otherNightReminder:"喚醒任意一名村夫。讓村夫指向一名玩家，對他給出拇指向上或向下的手勢代表那名玩家的陣營。重覆這個操作，直到所有村夫玩家都進行了夜晚行動。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202401/c_2996546816071_b144d82c.jpg"},
  {id:"yaggababble",name:"牙噶巴卜",team:"demon",firstNight:6610,otherNight:7700,firstNightReminder:"在為首個夜晚做準備時，用紙條或手機便簽或其他便捷的設備寫下一段短語。在首個夜晚，喚醒牙噶巴卜，對他展示這段短語，然後讓他重新入睡。",otherNightReminder:"每當牙噶巴卜在白天公開說出這段短語時，將一枚“死亡”提示標記放入魔典左側的中央位置，用以提示你需要在今晚放置這個標記。每個夜晚，你需要選擇是否將放入魔典中央的“死亡”提示標記放置在一名玩家的角色標記旁。如果你這麽做，那麽同時為放置了提示標記的角色標記上再放置帷幕標記。這些玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202402/c_9719440568071_03aa8062.jpg"},
  {id:"summoner",name:"召喚師",team:"minion",firstNight:2210,otherNight:3710,firstNightReminder:"喚醒召喚師，對他展示三個不在場的善良角色標記。",otherNightReminder:"在夜晚時，如果召喚師旁放置了“第三晚”提示標記，喚醒召喚師。讓他指向一名玩家，和角色列表上的一個惡魔圖標。讓召喚師重新入睡。喚醒被召喚師選擇的玩家。對他展示“你是”信息標記，和惡魔角色標記。再對他展示“你是”信息標記，和朝下的大拇指。用那個惡魔角色標記替換他的角色標記，並讓新惡魔重新入睡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202403/c_2685000701171_6b776d07.jpg"},
  {id:"banshee",name:"報喪女妖",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_1527923824171_6eff7fda.jpg"},
  {id:"boffin",name:"科學怪人",team:"minion",firstNight:110,otherNight:0,firstNightReminder:"（分別或同時）喚醒科學怪人和惡魔，通知他們惡魔因為科學怪人而獲得的善良角色的能力。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202410/c_2810398318271_0bc1440b.jpg"},
  {id:"lord_of_typhon",name:"堤豐之首",team:"demon",firstNight:90,otherNight:7800,firstNightReminder:"將位於堤豐之首兩側的對應數量的玩家變成邪惡的爪牙，並分別喚醒他們通知他們的角色和陣營變化。",otherNightReminder:"在除首個夜晚以外的每個夜晚，喚醒堤豐之首。讓他指向任意一名玩家。那名玩家死亡——用“死亡”提示標記標記那名玩家。讓堤豐之首重新入睡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202408/c_3707150105271_e57fc482.jpg"},
  {id:"zealot",name:"狂熱者",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202408/c_8622652692271_a37e7f2c.jpg"},
  {id:"ogre",name:"食人魔",team:"outsider",firstNight:11750,otherNight:0,firstNightReminder:"讓食人魔選擇一名玩家。如果他選擇了邪惡玩家，標記食人魔玩家為邪惡陣營。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202405/c_0102424156171_21d2f372.jpg"},
  {id:"balloonist",name:"氣球駕駛員",team:"townsfolk",firstNight:9101,otherNight:12101,firstNightReminder:"喚醒氣球駕駛員，指向一名玩家，在其角色標記旁放置“得知”提示標記。",otherNightReminder:"喚醒氣球駕駛員，指向一名與放置“得知”角色標記玩家角色類型不同的玩家，在其角色標記旁放置“得知”提示標記。移除上一晚放置的“得知”角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202410/c_7787277188271_9eba6446.jpg"},
  {id:"acrobat",name:"雜技演員",team:"townsfolk",firstNight:0,otherNight:2050,otherNightReminder:"讓雜技演員選擇一名玩家。標記該名玩家“被選擇”。讓雜技演員重新入睡。 如果被選擇的玩家在當晚任何時刻醉酒或中毒，標記雜技演員”死亡“。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202410/c_2958693199271_6cc6c522.jpg"},
  {id:"gnome",name:"侏儒",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202411/c_2576281040371_3babe7fd.jpg"},
  {id:"xaan",name:"限",team:"minion",firstNight:4575,otherNight:1300,firstNightReminder:"如果初始外來者的數量等於1，則標記大限將至。",otherNightReminder:"如果初始外來者的數量等於當前遊戲的夜晚數，則標記大限將至。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202411/c_7860002933371_9c39e151.jpg"},
  {id:"wraith",name:"亡魂",team:"minion",firstNight:100,otherNight:290,firstNightReminder:"當其他邪惡玩家被喚醒時，喚醒亡魂。",otherNightReminder:"當其他邪惡玩家被喚醒時，喚醒亡魂。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202507/c_2131757751571_fd2bffda.jpg"},
  {id:"princess",name:"公主",team:"townsfolk",firstNight:0,otherNight:4500,otherNightReminder:"如果公主在白天提名並處決了一名玩家，如常喚醒惡魔，但惡魔的能力不會造成死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202506/c_6411087360571_5b26738b.jpg"},
  {id:"hermit",name:"隱士",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202506/c_6131437679471_8c370f0a.jpg"},
  {id:"wizard",name:"巫師",team:"minion",firstNight:210,otherNight:310,firstNightReminder:"根據巫師的許願決定是否需要喚醒巫師、何時喚醒、喚醒後讓他做出什麽操作或得知什麽信息。",otherNightReminder:"如果有必要，讓巫師的能力生效。 ",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202501/c_5793544485371_bf9d4743.jpg"},
  {id:"noble",name:"貴族",team:"townsfolk",firstNight:8900,otherNight:0,firstNightReminder:"以任意順序指向三名玩家，其中一名邪惡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/noble.png"},
  {id:"bounty_hunter",name:"賞金獵人",team:"townsfolk",firstNight:10600,otherNight:13300,firstNightReminder:"指向一名邪惡玩家。隨後喚醒那名因賞金獵人而轉變為邪惡的鎮民，並告知他變成了邪惡陣營。",otherNightReminder:"如果賞金獵人知曉的邪惡玩家死亡，指向另一名邪惡玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/bounty_hunter.png"},
  {id:"pixie",name:"小精靈",team:"townsfolk",firstNight:7300,otherNight:0,firstNightReminder:"對小精靈展示一個在場的鎮民角色。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/pixie.png"},
  {id:"general",name:"將軍",team:"townsfolk",firstNight:12300,otherNight:14700,firstNightReminder:"告訴將軍你認為的答案。",otherNightReminder:"告訴將軍你認為的答案。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/general.png"},
  {id:"lycanthrope",name:"半獸人",team:"townsfolk",firstNight:0,otherNight:4400,otherNightReminder:"讓半獸人選擇一名玩家。如果該玩家是善良玩家，該玩家死亡，且當晚惡魔不會造成死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/lycanthrope.png"},
  {id:"cult_leader",name:"異教領袖",team:"townsfolk",firstNight:11600,otherNight:14200,firstNightReminder:"如果異教領袖改變了陣營，告訴他。",otherNightReminder:"如果異教領袖改變了陣營，告訴他。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/cult_leader.png"},
  {id:"king",name:"國王",team:"townsfolk",firstNight:3100,otherNight:13100,firstNightReminder:"如果國王在場，對惡魔展示國王角色標記並指向國王玩家。",otherNightReminder:"如果死亡玩家人數大於存活玩家，喚醒國王並對其展示一個存活的角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/king.png"},
  {id:"preacher",name:"傳教士",team:"townsfolk",firstNight:4200,otherNight:1200,firstNightReminder:"傳教士選擇一名玩家。如果選中了爪牙，則喚醒並告知他被傳教士選中。",otherNightReminder:"傳教士選擇一名玩家。如果選中了爪牙，則喚醒並告知他被傳教士選中。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/preacher.png"},
  {id:"amnesiac",name:"失憶者",team:"townsfolk",firstNight:200,otherNight:300,firstNightReminder:"決定失憶者的能力，並根據具體能力決定是否需要喚醒失憶者、何時喚醒、喚醒後讓他做出什麽操作或得知什麽信息。",otherNightReminder:"如果失憶者的能力會讓他在今晚醒來：喚醒他並執行其能力。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/amnesiac.png"},
  {id:"engineer",name:"工程師",team:"townsfolk",firstNight:4100,otherNight:1100,firstNightReminder:"工程師選擇不使用能力，或在劇本列表中選擇惡魔或爪牙角色。如果他選擇爪牙角色，則需要選擇對應數量的爪牙。然後將這些玩家依次喚醒，並告知他們變成了什麽角色。",otherNightReminder:"工程師選擇不使用能力，或在劇本列表中選擇惡魔或爪牙角色。如果他选择爪牙角色，则需要选择对应数量的爪牙。然后将这些玩家依次唤醒，并告知他们变成了什么角色。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/engineer.png"},
  {id:"fisherman",name:"漁夫",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/fisherman.png"},
  {id:"huntsman",name:"巡山人",team:"townsfolk",firstNight:7400,otherNight:10900,firstNightReminder:"巡山人選擇不使用能力，或指向一名玩家。如果他指向了落難少女，則為落難少女安排一個新的不在場鎮民角色，將其喚醒並告知她新的角色。",otherNightReminder:"巡山人選擇不使用能力，或指向一名玩家。如果他指向了落難少女，則為落難少女安排一個新的不在場鎮民角色，將其喚醒並告知她新的角色。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/huntsman.png"},
  {id:"choirboy",name:"唱詩男孩",team:"townsfolk",firstNight:0,otherNight:10200,otherNightReminder:"如果國王被惡魔殺死，將唱詩男孩喚醒並告訴他誰是那個殺死國王的惡魔。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/choirboy.png"},
  {id:"magician",name:"魔術師",team:"townsfolk",firstNight:1100,otherNight:0,firstNightReminder:"如果魔術師在場，則需要對爪牙信息環節和惡魔信息環節的相關內容進行調整。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/magician.png"},
  {id:"farmer",name:"農夫",team:"townsfolk",firstNight:0,otherNight:10300,otherNightReminder:"如果農民在夜晚死去，則選擇另一位善良玩家成為農民。喚醒這名玩家，並告知他成為了農民。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/farmer.png"},
  {id:"alchemist",name:"煉金術士",team:"townsfolk",firstNight:600,otherNight:0,firstNightReminder:"喚醒煉金術士，對他展示他獲得的能力所對應的爪牙角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/alchemist.png"},
  {id:"poppy_grower",name:"罌粟種植者",team:"townsfolk",firstNight:700,otherNight:900,firstNightReminder:"不要讓惡魔和爪牙相認。",otherNightReminder:"如果罌粟種植者死亡，安排惡魔和爪牙相認環節。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/poppy_grower.png"},
  {id:"atheist",name:"無神論者",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/atheist.png"},
  {id:"cannibal",name:"食人族",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/cannibal.png"},
  {id:"snitch",name:"告密者",team:"outsider",firstNight:2100,otherNight:0,firstNightReminder:"如果告密者在場，對爪牙展示三個不在場的善良角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/snitch.png"},
  {id:"golem",name:"魔像",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/golem.png"},
  {id:"damsel",name:"落難少女",team:"outsider",firstNight:2200,otherNight:0,firstNightReminder:"如果落難少女在場，對爪牙展示落難少女角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/damsel.png"},
  {id:"heretic",name:"異端分子",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/heretic.png"},
  {id:"puzzlemaster",name:"解謎大師",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/puzzlemaster.png"},
  {id:"politician",name:"政客",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/politician.png"},
  {id:"widow",name:"寡婦",team:"minion",firstNight:4700,otherNight:0,firstNightReminder:"向寡婦展示魔典，她想看多久就看多久。在她查看完畢後讓她選擇一名玩家，標記那名玩家中毒。隨後如果寡婦未醉酒中毒，喚醒一名善良玩家，對他展示寡婦角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/widow.png"},
  {id:"fearmonger",name:"恐懼之靈",team:"minion",firstNight:5900,otherNight:3000,firstNightReminder:"讓恐懼之靈選擇一名玩家，標記那名玩家恐懼，隨後通知所有玩家恐懼之靈選擇了一名玩家。",otherNightReminder:"讓恐懼之靈選擇一名玩家，標記那名玩家恐懼，隨後如果恐懼之靈的目標發生了變更，通知所有玩家恐懼之靈選擇了另一名玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/fearmonger.png"},
  {id:"psychopath",name:"精神病患者",team:"minion",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/psychopath.png"},
  {id:"boomdandy",name:"炸彈人",team:"minion",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/boomdandy.png"},
  {id:"marionette",name:"提線木偶",team:"minion",firstNight:3200,otherNight:0,firstNightReminder:"如果提線木偶在場，對惡魔展示提線木偶角色標記並指向提線木偶玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/marionette.png"},
  {id:"mezepheles",name:"靈言師",team:"minion",firstNight:6100,otherNight:3200,firstNightReminder:"喚醒靈言師，對他展示他的關鍵詞。",otherNightReminder:"喚醒第一個說出靈言師詞語的玩家並告知他已經變成邪惡陣營。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/mezepheles.png"},
  {id:"goblin",name:"哥布林",team:"minion",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/goblin.png"},
  {id:"lil_monsta",name:"小怪寶",team:"demon",firstNight:4400,otherNight:7300,firstNightReminder:"喚醒所有爪牙，允許他們以指向的方式決定誰照看小怪寶，但不能產生其他交流，否則會有非常糟糕的事情發生。",otherNightReminder:"喚醒所有爪牙，允許他們以指向的方式決定誰照看小怪寶，但不能产生其他交流，否则会有非常糟糕的事情发生。说书人选择一名玩家，那名玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/lil_monsta.png"},
  {id:"lleech",name:"痢蛭",team:"demon",firstNight:4500,otherNight:7200,firstNightReminder:"讓痢蛭指向一名玩家。標記那名玩家中毒。",otherNightReminder:"寄生蛭指向一名玩家。那名玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/lleech.png"},
  {id:"al-hadikhia",name:"哈迪寂亞",team:"demon",firstNight:0,otherNight:7000,otherNightReminder:"哈迪寂亞選擇三名玩家。對所有人宣告第一位玩家，然後喚醒他並讓他秘密選擇活著還是死去。依次對第二第三位玩家如此做。如果三名玩家都選擇活著，他們都死去。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/al-hadikhia.png"},
  {id:"legion",name:"軍團",team:"demon",firstNight:0,otherNight:6000,otherNightReminder:"由說書人決定，讓哪一名玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/legion.png"},
  {id:"nightwatchman",name:"守夜人",team:"townsfolk",firstNight:10700,otherNight:13400,firstNightReminder:"守夜人可以指向一名玩家。如果他這麽做，則喚醒那名玩家，告知其被守夜人選中，且告知他守夜人是誰。",otherNightReminder:"守夜人可以指向一名玩家。如果他這麽做，則喚醒那名玩家，告知其被守夜人選中，且告知他守夜人是誰。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/nightwatchman.png"},
  {id:"gangster",name:"黑幫",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/gangster.png"},
  {id:"riot",name:"暴亂",team:"demon",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/riot.png"},
  {id:"leviathan",name:"利維坦",team:"demon",firstNight:12800,otherNight:15100,firstNightReminder:"放置利維坦的第一天標記，告知所有玩家：利維坦在場，現在是第一天。",otherNightReminder:"將利維坦的標記轉換到下一天。",image:"https://oss.gstonegames.com/data_file/clocktower/role_icon/leviathan.png"},
  {id:"organ_grinder",name:"街頭風琴手",team:"minion",firstNight:5410,otherNight:2520,firstNightReminder:"街頭風琴手點頭或搖頭。街頭風琴手如果點頭：放置“醉酒”提示標記；如果搖頭：移除“醉酒”提示標記。",otherNightReminder:"街頭風琴手點頭或搖頭。街頭風琴手如果點頭：放置“醉酒”提示標記；如果搖頭：移除“醉酒”提示標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202410/c_4549185199271_d0420902.jpg"},
  {id:"knight",name:"騎士",team:"townsfolk",firstNight:8800,otherNight:0,firstNightReminder:"喚醒騎士，然後指向標記了“得知”的兩名玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202304/c_7251125151861_73cfd5f9.jpg"},
  {id:"vizier",name:"維齊爾",team:"minion",firstNight:12900,otherNight:0,firstNightReminder:"告訴所有玩家維齊爾在場，並指向維齊爾玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202304/c_8651385151861_48d3dd5d.jpg"},
  {id:"shijie",name:"使節",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_8334197694761_80377ad9.jpg"},
  {id:"qiongqi",name:"窮奇",team:"demon",firstNight:0,otherNight:8000,otherNightReminder:"每個白天，如果有外來者死亡，將窮奇的“死於今日”提示標記放置到該玩家的角色標記旁。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_3300298608961_2077dc45.jpg"},
  {id:"taowu",name:"梼杌",team:"demon",firstNight:2800,otherNight:8200,firstNightReminder:"如果梼杌在場，跳過他的惡魔信息環節。",otherNightReminder:"喚醒梼杌，並讓他指向任意一名玩家。讓梼杌重新入睡。被梼杌選擇的玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_9082388608961_e3ff7173.jpg"},
  {id:"hundun",name:"混沌",team:"demon",firstNight:0,otherNight:7900,otherNightReminder:"喚醒混沌。讓混沌指向一名玩家。該玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_9149178608961_89693def.jpg"},
  {id:"xionghaizi",name:"熊孩子",team:"townsfolk",firstNight:7200,otherNight:2500,firstNightReminder:"喚醒熊孩子，讓其選擇一個鎮民角色。",otherNightReminder:"移除上個夜晚放置的“搗蛋”提示標記。喚醒熊孩子，讓其選擇一個鎮民角色。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_6984587694761_17384eb3.jpg"},
  {id:"taotie",name:"饕餮",team:"demon",firstNight:0,otherNight:8100,otherNightReminder:"喚醒饕餮，讓其選擇任意數量的玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_5897997694761_fbe1f00c.jpg"},
  {id:"heshang",name:"和尚",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_4432977694761_315f1863.jpg"},
  {id:"yangguren",name:"養蠱人",team:"minion",firstNight:0,otherNight:8800,otherNightReminder:"如果有玩家被放置了“提名”標記，標記該玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_1981945308961_042e5529.jpg"},
  {id:"jinweijun",name:"禁衛軍",team:"minion",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_6646397694761_b8fa3a26.jpg"},
  {id:"shusheng",name:"書生",team:"outsider",firstNight:3300,otherNight:8500,firstNightReminder:"如果書生在場，對惡魔展示書生角色標記。",otherNightReminder:"如果白天惡魔成功猜中了書生是誰，喚醒那個惡魔，讓其選擇一名玩家。標記那名玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_9486455308961_c35f60ab.jpg"},
  {id:"jiaohuazi",name:"叫花子",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_4509255308961_63a95d5b.jpg"},
  {id:"ganshiren",name:"趕屍人",team:"minion",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_4215797694761_97f10b13.jpg"},
  {id:"humeiniang",name:"狐媚娘",team:"minion",firstNight:6200,otherNight:3300,firstNightReminder:"讓狐媚娘選擇一名玩家。標記那名玩家“被魅惑”。隨後喚醒那名玩家，對他展示“該角色的能力對你觸發”和狐媚娘角色標記。",otherNightReminder:"如果今日狐媚娘死於處決，且被魅惑的玩家為善良陣營，喚醒被魅惑的玩家，對他展示“你是”和朝下的大拇指。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_4772055308961_7bc92354.jpg"},
  {id:"banxian",name:"半仙",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_3833755308961_7e6f7e09.jpg"},
  {id:"shaxing",name:"煞星",team:"outsider",firstNight:0,otherNight:9400,otherNightReminder:"如果煞星死亡，將與其鄰近的存活善良玩家之一標記為死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_0178555308961_1721ee8f.jpg"},
  {id:"nichen",name:"逆臣",team:"outsider",firstNight:8200,otherNight:3400,firstNightReminder:"喚醒逆臣，讓其選擇一名玩家。在該玩家的角色標記旁放置“不共戴天”提示標記。",otherNightReminder:"如果逆臣或標記了“不共戴天”的玩家死於處決，喚醒兩者之中的另一名玩家，告訴他變為邪惡陣營。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_6302887694761_9ba8a0f3.jpg"},
  {id:"yinyangshi",name:"陰陽師",team:"townsfolk",firstNight:9200,otherNight:0,firstNightReminder:"喚醒陰陽師，並對其展示兩個善良角色，兩個邪惡角色，共四個角色標記。其中正好只有兩個角色在場。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_4630967694761_bd56d041.jpg"},
  {id:"langzhong",name:"郎中",team:"townsfolk",firstNight:9300,otherNight:12200,firstNightReminder:"喚醒郎中，讓其指向一名玩家。以不會被其他玩家察覺的形式對其提供與該玩家角色能力相關的一個詞語。",otherNightReminder:"喚醒郎中，讓其指向一名玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_9255777694761_7594675d.jpg"},
  {id:"qintianjian",name:"欽天監",team:"townsfolk",firstNight:12100,otherNight:0,firstNightReminder:"喚醒欽天監，對其用拇指指向其左側或右側示意。如果兩側邪惡玩家與他距離相同，拇指朝下示意。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_4484677694761_241d43f7.jpg"},
  {id:"wudaozhe",name:"悟道者",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_9233465308961_9aa67828.jpg"},
  {id:"xizi",name:"戲子",team:"townsfolk",firstNight:3400,otherNight:0,firstNightReminder:"喚醒所有戲子，讓他們互相確認。如有必要，對他們展示“你是”提示標記和戲子角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_8392176308961_c524bafb.jpg"},
  {id:"jinyiwei",name:"錦衣衛",team:"townsfolk",firstNight:0,otherNight:1940,otherNightReminder:"移除上個夜晚放置的“保護”標記。喚醒錦衣衛，讓其選擇一名玩家。在該玩家角色標記旁放置“保護”提示標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_5878087694761_691045fa.jpg"},
  {id:"geling",name:"歌伶",team:"townsfolk",firstNight:0,otherNight:9000,otherNightReminder:"如果歌伶在白天使用了能力，且惡魔成為了觀眾，標記歌伶死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_3570909608961_efc2d989.jpg"},
  {id:"dianxiaoer",name:"店小二",team:"townsfolk",firstNight:9400,otherNight:0,firstNightReminder:"喚醒店小二，對他指向標記有店小二的“熟客”和“醉酒”提示標記的這兩名玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_8586487694761_0ecde168.jpg"},
  {id:"dagengren",name:"打更人",team:"townsfolk",firstNight:0,otherNight:1920,otherNightReminder:"喚醒打更人，並讓其猜測距離，以數字手勢給出。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_3777477694761_d60dec0e.jpg"},
  {id:"daoshi",name:"道士",team:"townsfolk",firstNight:0,otherNight:4350,otherNightReminder:"喚醒道士，讓其選擇一名玩家。如果他選中了惡魔，在他的角色標記旁放置“死亡”提示標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_0866187694761_98fba0d5.jpg"},
  {id:"yanluo",name:"閻羅",team:"demon",firstNight:11710,otherNight:8410,firstNightReminder:"首個夜晚，喚醒閻羅並讓他按自己意願的時長來查看魔典。讓閻羅選擇一名玩家，放置“選擇”標記在其角色圖標旁，其在覅三個夜晚必定會死亡。讓閻羅選擇一名玩家，放置“即將死亡”標記在其角色圖標旁。",otherNightReminder:"讓閻羅選擇一名玩家，放置“即將死亡”標記在其角色圖標旁。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202403/c_2190498760171_1c483826.jpg"},
  {id:"ranfangfangzhu",name:"染坊坊主",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_0616062943171_bbdbbb4c.jpg"},
  {id:"bianlianshi",name:"變臉師",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202310/c_2669745308961_3cd6048e.jpg"},
  {id:"diaomin",name:"刁民",team:"traveller",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_8385231943171_9383f742.jpg"},
  {id:"fangshi",name:"方士",team:"townsfolk",firstNight:12350,otherNight:14750,firstNightReminder:"讓方士選擇一個數字。如果他選擇了當晚對應的數字，向他展示對應數量在場的角色標記。",otherNightReminder:"在對應數字的夜晚，喚醒方士，向他展示對應數量在場的角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_9290087694761_94c7b6f3.jpg"},
  {id:"fengshuishi",name:"風水師",team:"townsfolk",firstNight:9420,otherNight:12240,firstNightReminder:"在首個夜晚，喚醒風水師，告知他“標記”提示標記旁的玩家角色類型，並將標記順時針移動一名玩家。",otherNightReminder:"喚醒風水師，告知他“標記”提示標記旁的玩家角色類型，並將標記順時針移動一名玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_0697822943171_0efef766.jpg"},
  {id:"guhuoniao",name:"姑獲鳥",team:"demon",firstNight:0,otherNight:8430,otherNightReminder:"喚醒姑獲鳥，讓其選擇一名玩家，在玩家角色標記旁放置“死亡”提示標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_3002932943171_72f4def0.jpg"},
  {id:"xuncha",name:"巡察",team:"townsfolk",firstNight:0,otherNight:1980,otherNightReminder:"喚醒巡查，讓其選擇兩個善良角色，如果這兩個角色都在場，在對應玩家角色標記旁放置“保護”標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_7108682943171_ed7a0042.jpg"},
  {id:"shutong",name:"書童",team:"outsider",firstNight:7430,otherNight:8910,firstNightReminder:"喚醒書童，讓其選擇一名玩家，在其選擇的玩家標記旁放置“選擇”。",otherNightReminder:"如果標記有“選擇”的玩家被邪惡玩家的能力選擇或影響時，在書童旁放置“死亡”標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_2027903943171_36d374a5.jpg"},
  {id:"jinweijun2",name:"禁衛軍Ⅱ",team:"minion",firstNight:5610,otherNight:0,firstNightReminder:"喚醒禁衛軍，給他展示“求生”和“求死”標記，讓其選擇一枚，並讓他重新入睡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202403/c_7937248760171_37b438da.jpg"},
  {id:"mengpo",name:"孟婆",team:"minion",firstNight:0,otherNight:8820,otherNightReminder:"喚醒孟婆，讓其選擇一名玩家，隨後讓孟婆閉眼。喚醒孟婆選擇的玩家，依次向他展示“該角色的能力對你生效”信息標記、孟婆的角色標記，隨後讓其用點頭或者搖頭來表示想要生死。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_1302942943171_588f083d.jpg"},
  {id:"zhen",name:"鴆",team:"townsfolk",firstNight:0,otherNight:8899,otherNightReminder:"喚醒鴆，讓其選擇一個鎮民角色，如果該角色在場，在其角色標記旁放置“死亡”和“醉酒”提示標記",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_1134823943171_5fc42e52.jpg"},
  {id:"yongjiang",name:"俑匠",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_3275680943171_caaa933e.jpg"},
  {id:"shiguan",name:"史官",team:"townsfolk",firstNight:0,otherNight:14760,otherNightReminder:"如果白天有玩家死於處決，喚醒史官。對他用手勢比劃存活的鎮民玩家的數量。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_7627472943171_a65c3206.jpg"},
  {id:"baojun",name:"暴君",team:"demon",firstNight:0,otherNight:8420,otherNightReminder:"喚醒典獄長，讓其選擇至多兩名玩家。在這些玩家角色標記旁放置“死亡”提示標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_6000301943171_d2f257a6.jpg"},
  {id:"tixingguan",name:"提刑官",team:"townsfolk",firstNight:0,otherNight:11400,otherNightReminder:"如果提刑官在白天進行了整局遊戲中他的首次提名，喚醒他並對他展示他提名的玩家的角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_7402377694761_cd9eb282.jpg"},
  {id:"qianke",name:"掮客",team:"townsfolk",firstNight:3450,otherNight:950,firstNightReminder:"讓掮客指向兩名存活玩家。如果這兩名玩家陣營相同，在這些玩家的角色標記旁放置“熟客”提示標記。",otherNightReminder:"移除上個夜晚放置的“熟客”標記。喚醒掮客，讓他指向兩名存活玩家。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202401/c_2978127816071_ab841bc9.jpg"},
  {id:"dianyuzhang",name:"典獄長",team:"demon",firstNight:6700,otherNight:8300,firstNightReminder:"喚醒典獄長，讓其選擇至多三名玩家。在這些玩家角色標記旁放置“囚禁”提示標記。",otherNightReminder:"如果今天白天被處決的玩家標記有“囚禁”，則其他標記有囚禁的玩家死亡。否則，將其中一人標記為死亡。移除所有“囚禁”提示標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202401/c_5570117816071_2f5793fd.jpg"},
  {id:"xizi_new",name:"戲子（改）",team:"townsfolk",firstNight:3410,otherNight:0,firstNightReminder:"同時喚醒所有除了旅行者以外的善良玩家，讓他們互認。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202410/c_0309859199271_214cc957.jpg"},
  {id:"chongfei",name:"寵妃",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202401/c_3373896816071_be9c7270.jpg"},
  {id:"yinluren",name:"引路人",team:"townsfolk",firstNight:12450,otherNight:14850,firstNightReminder:"讓引路人選擇一至三名玩家，以點頭或搖頭告知他選擇的玩家中是否有玩家在當晚被邪惡玩家的能力選擇或影響過。",otherNightReminder:"讓引路人選擇一至三名玩家，以點頭或搖頭告知他選擇的玩家中是否有玩家在當晚被邪惡玩家的能力選擇或影響過。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_2147287694761_01761fcb.jpg"},
  {id:"jiubao",name:"酒保",team:"outsider",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_4591987694761_11d3a855.jpg"},
  {id:"rulianshi",name:"入殮師",team:"outsider",firstNight:0,otherNight:3600,otherNightReminder:"如果白天入殮師提名了惡魔且惡魔被處決，喚醒他，並對他展示“你是”提示標記和惡魔角色標記。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_5757097694761_2de60c7b.jpg"},
  {id:"jianning",name:"奸佞",team:"demon",firstNight:0,otherNight:8400,otherNightReminder:"喚醒奸佞，讓其選擇一名玩家。如果白天奸佞未投票，改為讓其選擇兩名玩家。標記他選擇的玩家死亡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202401/c_6705607816071_60588424.jpg"},
  {id:"yanshi",name:"偃師",team:"townsfolk",firstNight:0,otherNight:0,image:"https://oss.gstonegames.com/data_file/clocktower/upload/202401/c_8796986816071_85680b81.jpg"},
  {id:"niangjiushi",name:"釀酒師",team:"minion",firstNight:4900,otherNight:1600,firstNightReminder:"喚醒釀酒師，讓其選擇一個角色並給出該角色對應的信息形式。",otherNightReminder:"喚醒釀酒師，讓其選擇一個角色並給出該角色對應的信息形式。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_3356597694761_0a4b67e6.jpg"},
  {id:"gudiao",name:"蠱雕",team:"minion",firstNight:4800,otherNight:1500,firstNightReminder:"喚醒蠱雕，讓其選擇一個方向。將他的“中毒”標記移動至那個方向上的下一個存活玩家的角色標記旁。",otherNightReminder:"喚醒蠱雕，讓其選擇一個方向。將他的“中毒”標記移動至那個方向上的下一個存活玩家的角色標記旁。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202301/c_4078497694761_5c6ddcce.jpg"},
  {id:"daoke",name:"刀客",team:"townsfolk",firstNight:9410,otherNight:0,firstNightReminder:"在為首個夜晚做準備時，將刀客的“追殺”標記放置在一個爪牙角色標記旁。在首個夜晚，喚醒刀客。對他展示標記了“追殺”的爪牙角色標記。讓刀客重新入睡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202403/c_5751437760171_79dd1401.jpg"},
  {id:"bingbi",name:"秉筆",team:"townsfolk",firstNight:0,otherNight:10310,otherNightReminder:"如果秉筆人在夜晚死去，喚醒他並指向一名邪惡玩家；如果秉筆在白天死去，喚醒他並指向一名善良玩家。隨後讓他重新入睡。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202403/c_5918227760171_7f310c1b.jpg"},
  {id:"limao",name:"貍貓",team:"townsfolk",firstNight:0,otherNight:1960,otherNightReminder:"喚醒貍貓，讓他指向一名玩家。讓貍貓重新入睡。將“太子”標記放在對應玩家角色標記旁。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202403/c_2553047760171_ed091519.jpg"},
  {id:"zhifu",name:"知府",team:"townsfolk",firstNight:0,otherNight:12220,otherNightReminder:"如果在白天以及夜晚，只有鎮民玩家死亡，對司民搖頭表示“否”，否則點頭表示“是”。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202404/c_2565080943171_2bd68241.jpg"},
  {id:"huapi",name:"畫皮",team:"minion",firstNight:4550,otherNight:8810,firstNightReminder:"讓畫皮選擇一名玩家，該玩家進入“活屍”狀態。",otherNightReminder:"每個夜晚，如果畫皮有“重獲能力”標記，喚醒畫皮，讓其選擇一名玩家，該玩家進入“活屍”狀態。",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202403/c_8796728760171_7caa0950.jpg"},
  {id:"yishi",name:"驛使",team:"townsfolk",firstNight:0,otherNight:12210,otherNightReminder:"當晚，喚醒驛使藝人。如果他猜測正確，對他點頭表示“是”，對他搖頭表示“否”",image:"https://oss.gstonegames.com/data_file/clocktower/upload/202403/c_9168557760171_8ae6a36c.jpg"}
];

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
                  {players.map(p => <option key={p.id} value={p.name}>{p.id}號 {p.name}</option>)}
                </select>
              ) : c.type === 'role' ? (
                <select onChange={e=>setFormData({...formData, [c.key]: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-1 text-slate-200 outline-none">
                  <option value="">{c.label}...</option>
                  {script.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
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
  const [searchTerm, setSearchTerm] = useState("");

  const loadBuiltInScript = (scriptKey) => {
    const roleIds = DEFAULT_SCRIPTS_DATA[scriptKey];
    if (!roleIds) return;
    
    // 從 window 全域的角色庫比對 ID 並產生新的 script 狀態
    const parsed = roleIds.map(id => {
      let dbRole = window.MASTER_ROLE_DB.find(r => r.id === id);
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
  const [nominationRecord, setNominationRecord] = useState({ nominator: "", target: "", votes: "", result: "未達門檻" });

  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: 'alert', message: '', onConfirm: null });

  // 強制合併旅行者到選角池
  const allAvailableRoles = useMemo(() => {
    const travellers = MASTER_ROLE_DB.filter(r => r.team === 'traveller');
    const combined = [...script];
    travellers.forEach(tr => {
      if (!combined.some(r => r.id === tr.id)) combined.push(tr);
    });
    return combined;
  }, [script]);

  const showAlert = (message) => {
    setModalConfig({ isOpen: true, type: 'alert', message, onConfirm: null });
  };

  const showConfirm = (message, onConfirm) => {
    setModalConfig({ isOpen: true, type: 'confirm', message, onConfirm });
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
  }, [script, players, gamePhase, logs, playerCount, scriptName, gameDate, gameLocation, customLocation, demonBluffs]);
  const generatePlayerListText = () => {
      let text = "\n【當前玩家狀態】\n";
      players.forEach(p => {
          const status = p.isAlive ? "存活" : "死亡";
          const roleName = p.role ? p.role.name : "未知";
          text += `[${p.id}號] ${status} - (${roleName}) ${p.name || "空"}\n`;
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
      const statusDisplay = p.isDead ? '💀 死亡' : '存活';
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

  const exportHistory = () => {
    if (logs.length === 0) return;
    const displayLocation = gameLocation === '其他' ? customLocation : gameLocation;
    let header = `劇本名稱：${scriptName}\n遊戲日期：${gameDate}\n遊戲地點：${displayLocation}\n-----------------------------------\n\n`;

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
    
    const fullContent = header + content;
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

            let dbRole = MASTER_ROLE_DB.find(r => r.id === roleId);
            
            if (!dbRole && tName) {
              dbRole = MASTER_ROLE_DB.find(r => r.name === tName || tName.includes(r.name));
            }

            if (!dbRole && tAbility) {
              const normalize = (str) => (str || "").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
              const normItem = normalize(tAbility);
              dbRole = MASTER_ROLE_DB.find(r => {
                const dbNorm = normalize(r.ability);
                return dbNorm === normItem && dbNorm.length > 0;
              });
            }
            
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
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-bold">
              {modalConfig.message}
            </p>
            <div className="flex justify-end gap-3 mt-2">
              {modalConfig.type === 'confirm' && (
                <button 
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  取消
                </button>
              )}
              <button 
                onClick={() => {
                  if (modalConfig.onConfirm) modalConfig.onConfirm();
                  closeModal();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
              >
                確定
              </button>
            </div>
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
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl w-full max-w-5xl max-h-[85vh] border border-slate-700 flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h2 className="text-lg font-black flex items-center gap-2">為 <span className="text-indigo-400">{players.find(p=>p.id===selectingRoleFor)?.name}</span> 選擇劇本角色</h2>
              <div className="flex gap-4">
                <div className="relative">
                  <span className="absolute left-3 top-2 opacity-50">🔍</span>
                  <input type="text" placeholder="搜尋角色..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-indigo-500 text-white" />
                </div>
                <button onClick={() => setSelectingRoleFor(null)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400"><span className="text-xl">❌</span></button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {allAvailableRoles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                  <span className="text-4xl opacity-20">📖</span>
                  <p>請先由右上角讀入劇本 JSON 檔案</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {['townsfolk', 'outsider', 'minion', 'demon', 'traveller'].map(team => {
                    const source = (script && script.length > 0) ? allAvailableRoles : MASTER_ROLE_DB;
                    const teamRoles = source.filter(r => r.team === team && (r.name.includes(searchTerm) || r.id.toLowerCase().includes(searchTerm.toLowerCase())));
                    if (teamRoles.length === 0) return null;
                    return (
                      <div key={team} className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-widest border-l-4 pl-2 border-indigo-500 text-slate-400">
                          {team === 'townsfolk' ? '鎮民' : team === 'outsider' ? '外來者' : team === 'minion' ? '爪牙' : team === 'demon' ? '惡魔' : '旅行者'}
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        <main className="flex-1 flex flex-col sm:flex-row min-h-screen bg-[#020617]">
        
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
        <label className="text-base font-black text-indigo-500 uppercase tracking-widest text-center">快速載入官方劇本</label>
        <div className="grid grid-cols-3 gap-3">
          {Object.keys(DEFAULT_SCRIPTS_DATA).map(name => (
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
                        {script.map(r => (
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
                      <option key={p.id} value={p.id}>{p.id} 號 - {p.name} {p.role ? `(${p.role.name})` : ''}</option>
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
                      />
                    );
                  })}
                </div>
              )}
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
                      {players.filter(p => p.name).map(p => <option key={p.id} value={p.name}>{p.id} 號 - {p.name}</option>)}
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
                      {players.filter(p => p.name).map(p => <option key={p.id} value={p.name}>{p.id} 號 - {p.name}</option>)}
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
                  onClick={() => {
                    if(!nominationRecord.nominator || !nominationRecord.target) return;
                    recordEvent(nominationRecord.nominator, "發起提名", nominationRecord.target, `${nominationRecord.votes} 票 | 結果: ${nominationRecord.result}`);
                    setNominationRecord({ nominator: "", target: "", votes: "", result: "未達門檻" });
                  }}
                  className="w-full bg-yellow-700 hover:bg-yellow-600 text-white font-black py-3 rounded-xl transition-all active:scale-95"
                >
                  記錄提名
                </button>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] shadow-inner space-y-4">
                <h3 className="text-sm font-black text-slate-400 flex items-center gap-2 mb-2">
                  📝 自由事件紀錄
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase">執行者 / 發起人</label>
                    <input type="text" value={dayAction.actor} onChange={e => setDayAction({...dayAction, actor: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-slate-500 text-sm" placeholder="例如: 玩家A" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase">動作</label>
                    <input type="text" value={dayAction.action} onChange={e => setDayAction({...dayAction, action: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-slate-500 text-sm" placeholder="例如: 發動技能" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase">目標對象 (選填)</label>
                    <input type="text" value={dayAction.target} onChange={e => setDayAction({...dayAction, target: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-slate-500 text-sm" placeholder="例如: 玩家B" />
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
        <button onClick={exportHistory} className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 font-bold bg-indigo-900/30 px-3 py-1.5 rounded-lg transition-colors">
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
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('recorder-root'));
root.render(<App />);
