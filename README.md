# 血染鐘樓戰績魔典

一個為《血染鐘樓》社群設計的對局紀錄、覆盤與戰績統計工具。

這個專案的核心目標不是取代說書人的魔典，而是成為一個「血染過程的紀錄器」：在遊戲進行中協助記錄白天、夜晚、提名、投票與角色行動；遊戲結束後把紀錄整理成正式戰績；長期則累積成玩家、劇本、地點與陣營勝率的資料看板。

## 主要功能

- **覆盤紀錄器**：依照遊戲階段記錄設置、白天、夜晚、角色行動、提名與投票。
- **角色與夜序輔助**：內建角色資料、夜序與角色提醒，協助說書人逐步記錄行動。
- **對局錄入**：記錄劇本、日期、地點、說書人、勝利陣營與每位玩家的角色表現。
- **覆盤文字解析**：可從覆盤紀錄器輸出的文字中快速帶入對局資料，減少賽後手動整理。
- **歷史紀錄查詢**：可回顧過去對局，展開查看玩家座位、初始角色、最終角色、陣營與存活狀態。
- **統計看板**：統計總場數、善良／邪惡勝率，以及不同地點的對局表現。
- **PWA 支援**：包含 `manifest.json` 與 service worker，可作為類 app 體驗使用。

## 使用流程

1. 進入「覆盤紀錄器」，建立玩家與角色配置。
2. 遊戲進行時，依照白天／夜晚流程記錄角色行動、提名、投票與自由備註。
3. 遊戲結束後匯出或複製覆盤紀錄。
4. 進入「錄入對局」，貼上覆盤文字並自動解析。
5. 補齊勝利陣營、說書人、玩家最終狀態等資訊後提交。
6. 在「資料看板」與「歷史紀錄」中查看長期統計與戰績。

## 專案架構

```text
.
├── main.py                 # FastAPI 入口與 API 路由
├── database.py             # SQLAlchemy 資料庫連線設定
├── models.py               # Player / Match / MatchPlayer 資料模型
├── schemas.py              # Pydantic 資料結構
├── requirements.txt        # Python 依賴
├── vercel.json             # Vercel 部署設定
├── static/
│   ├── index.html          # 單頁式前端入口
│   ├── pages/              # Dashboard / Recorder / Record / History 頁面
│   ├── js/                 # 前端互動邏輯
│   ├── css/                # 樣式
│   ├── icons/              # 角色與 PWA 圖示
│   └── manifest.json       # PWA 設定
└── botc.db                 # 本機 SQLite 資料庫範例
```

## 技術棧

- **Backend**：FastAPI、SQLAlchemy、Pydantic
- **Database**：SQLite（本機開發）／PostgreSQL（雲端部署）
- **Frontend**：HTML、CSS、JavaScript、React UMD、Tailwind CSS
- **Deployment**：Vercel Python Runtime

## 本機啟動

請先安裝 Python 3.10 以上版本。

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

啟動後開啟：

```text
http://localhost:8000
```

## 環境變數

| 變數 | 說明 | 預設值 |
| --- | --- | --- |
| `DATABASE_URL` | 資料庫連線字串。未設定時使用本機 SQLite。 | `sqlite:///./botc.db` |
| `ADMIN_PASSWORD` | 提交對局時使用的管理員密碼。 | `mmmm` |

正式部署時建議務必設定自己的 `ADMIN_PASSWORD`，避免任何人都能寫入對局資料。

## API 概覽

| Method | Path | 說明 |
| --- | --- | --- |
| `POST` | `/api/matches` | 新增一場對局與玩家表現紀錄 |
| `GET` | `/api/stats` | 取得總場數、善惡勝率與地點統計 |
| `GET` | `/api/players` | 取得已記錄玩家名稱清單 |
| `GET` | `/api/history` | 取得最近對局與玩家詳細資料 |

## 資料模型概念

- **Player**：玩家主檔，確保每個暱稱對應唯一玩家。
- **Match**：單場對局資料，包含劇本、日期、地點、說書人、勝利陣營與覆盤紀錄。
- **MatchPlayer**：玩家在某場對局中的表現，包含座位、初始角色、最終角色、陣營與存活狀態。

## 開發狀態

這是一個持續開發中的個人／社群工具。repo 中可能保留部分實驗檔、舊版檔案與測試用資料，方便快速迭代與回溯功能變化。

後續可考慮整理的方向：

- 清理舊版或失敗實驗檔案，例如 `*_old`、`*_fail`、`__pycache__`。
- 將角色資料與前端邏輯拆分成更小的模組。
- 補上管理後台、資料匯出與更完整的權限控制。
- 增加自動化測試，保護統計與解析邏輯。

## 關於

本工具由廚爹為《血染鐘樓》玩家與說書人社群製作，目標是讓每一場精彩的對局都能被好好記錄、整理與回顧。
