# 台股每日股市報告

一個本機可執行的台股每日報告網站。網站會讀取今日保存報告；若今日尚未生成，後端會呼叫 DeepSeek Chat Completions API 生成 HTML 報告並保存。

## 使用方式

```bash
npm run dev
```

啟動後開啟：

```text
http://127.0.0.1:3000
```

## 每日股市報告

每日報告一天只會生成一次，生成後保存到 `data/reports/YYYY-MM-DD.json`；同一天重新打開頁面只會讀取保存內容，不會再次呼叫 DeepSeek。

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

報告生成前，後端會先透過 TWSE/TPEx MIS 即時報價 API 取得核心台股報價，提供給 DeepSeek 作為優先基準資料，降低模型沿用舊價格的風險。
