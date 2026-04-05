// 這是最簡單的 Service Worker
// 即使不處理離線快取，也必須監聽 fetch 事件，Chrome 才會顯示「安裝」按鈕

self.addEventListener('fetch', function(event) {
  // 這裡可以留空，或者讓請求正常通過
  // 它的存在本身就是告訴瀏覽器：我有能力處理網路請求
});
