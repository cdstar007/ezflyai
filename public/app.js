const reportErrorBox = document.querySelector("#report-error");
const reportStatus = document.querySelector("#report-status");
const reportGeneratedAt = document.querySelector("#report-generated-at");
const reportFrame = document.querySelector("#report-frame");

function setReportError(message) {
  reportErrorBox.hidden = !message;
  reportErrorBox.textContent = message || "";
}

function formatGeneratedAt(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Taipei"
  }).format(new Date(value));
}

function reportFallbackHtml(message) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      padding: 32px;
      color: #172026;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif;
    }
    .empty {
      border: 1px solid #d9e1e5;
      border-radius: 8px;
      padding: 24px;
      background: #f7fafb;
      font-weight: 700;
    }
  </style>
</head>
<body><div class="empty">${message}</div></body>
</html>`;
}

async function loadDailyReport() {
  setReportError("");
  reportStatus.textContent = "正在讀取今日報告...";
  reportGeneratedAt.textContent = "請稍候";

  try {
    const response = await fetch("/api/daily-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "報告生成失敗");
    }

    reportFrame.srcdoc = data.html || reportFallbackHtml("DeepSeek 未回傳 HTML 內容。");
    reportStatus.textContent = data.cached ? "已載入今日保存報告" : "今日報告已生成並保存";
    reportGeneratedAt.textContent = formatGeneratedAt(data.generatedAt);
  } catch (error) {
    const message = `無法載入每日股市報告：${error.message}`;
    setReportError(message);
    reportFrame.srcdoc = reportFallbackHtml(message);
    reportStatus.textContent = "載入失敗";
    reportGeneratedAt.textContent = "--";
  }
}

reportFrame.srcdoc = reportFallbackHtml("正在讀取今日保存報告。若今日尚未生成，系統才會建立一次。");
loadDailyReport();
