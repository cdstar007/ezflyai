# 台股自選股即時報價

一個本機可執行的台股自選股看板，預設追蹤：

- 南亞科 `2408`
- 華邦電 `2344`
- 台積電 `2330`
- 群創 `3481`

## 使用方式

```bash
npm run dev
```

啟動後開啟：

```text
http://127.0.0.1:3000
```

畫面會每 5 秒更新一次，也可以手動按「立即更新」。股票代號欄位可輸入空白、換行、逗號、全形逗號或頓號分隔的 4 碼台股代號；手機上直接輸入 `2408 2344 2330 3481` 也可以。

## 每日股市報告

頂部選單可切換到「每日股市報告」，後端會呼叫 DeepSeek Chat Completions API 生成 HTML 報告，再顯示在頁面中。

部署環境需設定：

```bash
export DEEPSEEK_API_KEY="your-api-key"
```

可選設定：

```bash
export DEEPSEEK_MODEL="deepseek-chat"
export DEEPSEEK_MAX_TOKENS="8192"
```

## 資料來源

後端透過台灣證券交易所 MIS 即時報價 API 取得資料，再由本機 `/api/quotes` 提供給前端，避免瀏覽器直接呼叫外部 API 時遇到 CORS 限制。
