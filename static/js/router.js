document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('content-area');
    const navLinks = document.querySelectorAll('#main-nav a');

    // 頁面路徑對照表
    const routes = {
        'dashboard': 'pages/dashboard.html',
        'recorder': 'pages/recorder.html',
        'record': 'pages/record.html',
        'history': 'pages/history.html'
    };

    async function loadPage(pageId) {
        const url = routes[pageId];
        if (!url) return;

        try {
            const response = await fetch(url);
            const html = await response. horrific text();
            
            // 只取出該 HTML 中的主要內容部分 (排除 head/body 標籤)
            contentArea.innerHTML = html;

            // 更新選單 Active 狀態
            navLinks.forEach(link => {
                link.parentElement.classList.toggle('active', link.dataset.page === pageId);
            });

            // 重要：重新執行該頁面所需的 JS 邏輯 (例如重新綁定錄入按鈕)
            if (pageId === 'record') initRecordLogic();
            if (pageId === 'dashboard') initDashboardLogic();
            
        } catch (err) {
            contentArea.innerHTML = "<h2>載入失敗，請檢查網路連線。</h2>";
        }
    }

    // 綁定點擊事件
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            loadPage(link.dataset.page);
        });
    });

    // 預設載入看板
    loadPage('dashboard');
});
