(() => {
  const fallback = Array.isArray(window.MASTER_ROLE_DB) ? window.MASTER_ROLE_DB : [];

  const normalizeId = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizeText = value => String(value || '').toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]/g, '');

  const normalize = (item) => ({
    databaseId: item.id,
    id: item.canonical_key || String(item.id),
    name: item.name_zh_tw || item.name_en || item.canonical_key || String(item.id),
    nameEn: item.name_en || '',
    team: item.team || '',
    ability: item.ability_zh_tw || '',
    image: item.image_url || '',
    firstNight: Number(item.first_night_order) || 0,
    otherNight: Number(item.other_night_order) || 0,
    firstNightReminder: item.first_night_reminder || '',
    otherNightReminder: item.other_night_reminder || '',
    aliases: Array.isArray(item.mention_aliases) ? item.mention_aliases : [],
    isCustom: Boolean(item.is_custom),
    isOfficial: Boolean(item.is_official)
  });

  const load = async () => {
    try {
      const response = await fetch(`${window.API_BASE || ''}/api/roles?limit=1000`, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`角色資料庫載入失敗 (${response.status})`);
      const payload = await response.json();
      const catalog = (payload.items || []).map(normalize).filter(role => role.id && role.name);
      if (!catalog.length) throw new Error('角色資料庫目前沒有可用角色');
      window.MASTER_ROLE_DB = catalog;
      window.dispatchEvent(new CustomEvent('botc:role-catalog-ready', { detail: catalog }));
      return catalog;
    } catch (error) {
      console.warn('角色資料庫暫時無法使用，改用內建備援角色資料。', error);
      return fallback;
    }
  };

  const resolve = (role, catalog = window.MASTER_ROLE_DB || fallback) => {
    if (!role || !Array.isArray(catalog)) return null;

    const roleId = normalizeId(role.id || role.canonical_key || role.baseRoleId);
    if (roleId) {
      const match = catalog.find(item => normalizeId(item.id || item.canonical_key) === roleId);
      if (match) return match;
    }

    const databaseId = Number(role.databaseId || role.database_id || 0);
    if (databaseId) {
      const match = catalog.find(item => Number(item.databaseId || item.database_id || 0) === databaseId);
      if (match) return match;
    }

    // 自創角色可能和官方角色同名；能力文字存在時，能力必須一起符合。
    const ability = normalizeText(role.ability || role.ability_zh_tw);
    if (ability) {
      return catalog.find(item => normalizeText(item.ability || item.ability_zh_tw) === ability) || null;
    }

    // 有穩定 ID 卻找不到時不可退回名稱，避免把同名自創角色誤認成官方角色。
    const name = String(role.name || role.name_zh_tw || '').trim();
    if (roleId || !name) return null;
    const nameMatches = catalog.filter(item => item.name === name || (item.aliases || []).includes(name));
    return nameMatches.length === 1 ? nameMatches[0] : null;
  };

  const alignmentFor = (role, catalog = window.MASTER_ROLE_DB || fallback) => {
    const resolved = resolve(typeof role === 'string' ? { name: role } : role, catalog);
    const team = String(resolved?.team || role?.team || '').toLowerCase();
    if (team === 'minion' || team === 'demon' || team === 'evil') return 'evil';
    if (team === 'townsfolk' || team === 'outsider' || team === 'traveller' || team === 'good') return 'good';
    return null;
  };

  window.RoleCatalog = {
    fallback,
    normalizeId,
    normalizeText,
    resolve,
    alignmentFor,
    ready: load()
  };
})();
