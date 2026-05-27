(() => {
    const DEFAULT_LOCATIONS = ['拉普拉斯', '線上', '台北', '新北', '桃園', '台中', '台南', '高雄', '其他'];
    let cachedNames = null;
    let loadingPromise = null;

    const apiBase = () => window.API_BASE || '';

    const uniq = (items) => [...new Set(items.filter(Boolean))];

    const loadLocationNames = async () => {
        if (cachedNames) return cachedNames;
        if (loadingPromise) return loadingPromise;
        loadingPromise = fetch(`${apiBase()}/api/locations`, { credentials: 'same-origin' })
            .then((resp) => resp.ok ? resp.json() : [])
            .then((locations) => {
                cachedNames = uniq([...(locations || []).map((loc) => loc.name), ...DEFAULT_LOCATIONS]);
                return cachedNames;
            })
            .catch(() => {
                cachedNames = [...DEFAULT_LOCATIONS];
                return cachedNames;
            });
        return loadingPromise;
    };

    const patchSelectStyle = () => {
        if (document.getElementById('botc-location-style')) return;
        const style = document.createElement('style');
        style.id = 'botc-location-style';
        style.textContent = `
            select[data-botc-location-select], select[data-botc-location-select] option {
                background:#0f172a!important;
                color:#f8fafc!important;
                color-scheme:dark;
            }
        `;
        document.head.appendChild(style);
    };

    const applyOptions = (select, names, keepCurrent = true) => {
        if (!select || !names?.length) return;
        patchSelectStyle();
        const original = select.value === '線上 (Discord)' ? '線上' : select.value;
        const current = keepCurrent && original && !names.includes(original) && original !== '其他' ? original : '';
        const finalNames = uniq([...names, current]);
        const nextValue = finalNames.includes(original) ? original : (finalNames.includes('線上') ? '線上' : finalNames[0]);
        const oldMarkup = select.innerHTML;
        const nextMarkup = finalNames.map((name) => `<option value="${name.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${name}</option>`).join('');
        select.setAttribute('data-botc-location-select', 'true');
        if (oldMarkup !== nextMarkup) select.innerHTML = nextMarkup;
        if (select.value !== nextValue) {
            select.value = nextValue;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };

    const findRecorderLocationSelect = () => {
        const root = document.getElementById('recorder-root');
        if (!root) return null;
        return Array.from(root.querySelectorAll('select')).find((select) => {
            const values = Array.from(select.options).map((option) => option.value);
            return values.includes('拉普拉斯') && (values.includes('高雄') || values.includes('線上 (Discord)'));
        });
    };

    const syncRecorderLocationSelect = async () => {
        const select = findRecorderLocationSelect();
        if (!select) return;
        const names = await loadLocationNames();
        applyOptions(select, names, true);
    };

    const installRecorderLocationSync = () => {
        const root = document.getElementById('recorder-root');
        if (!root || root.dataset.locationSyncInstalled === 'true') return;
        root.dataset.locationSyncInstalled = 'true';
        let timer = null;
        const schedule = () => {
            clearTimeout(timer);
            timer = setTimeout(syncRecorderLocationSelect, 80);
        };
        const observer = new MutationObserver(schedule);
        observer.observe(root, { childList: true, subtree: true });
        schedule();
    };

    window.BOTC_LOCATION_OPTIONS = {
        defaults: DEFAULT_LOCATIONS,
        load: loadLocationNames,
        applyOptions,
        syncRecorder: syncRecorderLocationSelect,
        installRecorderSync: installRecorderLocationSync,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installRecorderLocationSync);
    } else {
        installRecorderLocationSync();
    }
})();
