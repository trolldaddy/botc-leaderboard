(() => {
  const fallback = Array.isArray(window.MASTER_ROLE_DB) ? window.MASTER_ROLE_DB : [];

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

  window.RoleCatalog = {
    fallback,
    ready: load()
  };
})();
