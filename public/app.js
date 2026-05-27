const grid = document.querySelector("#quote-grid");
const template = document.querySelector("#quote-card-template");
const symbolsInput = document.querySelector("#symbols");
const refreshButton = document.querySelector("#refresh");
const autoRefreshInput = document.querySelector("#auto-refresh");
const errorBox = document.querySelector("#error");
const lastUpdated = document.querySelector("#last-updated");
const marketStatus = document.querySelector("#market-status");
const pageTitle = document.querySelector("#page-title");
const pageSubtitle = document.querySelector(".topbar .subtle");
const navTabs = document.querySelectorAll(".nav-tab");
const views = document.querySelectorAll(".view");
const generateReportButton = document.querySelector("#generate-report");
const reportSlot = document.querySelector("#report-slot");
const reportErrorBox = document.querySelector("#report-error");
const reportStatus = document.querySelector("#report-status");
const reportGeneratedAt = document.querySelector("#report-generated-at");
const reportFrame = document.querySelector("#report-frame");

let timer = null;
let reportLoaded = false;

const numberFormatter = new Intl.NumberFormat("zh-TW", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

const percentFormatter = new Intl.NumberFormat("zh-TW", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

function formatNumber(value) {
  return value === null || value === undefined ? "--" : numberFormatter.format(value);
}

function formatVolume(value) {
  if (value === null || value === undefined) return "--";
  if (value >= 10000) return `${numberFormatter.format(value / 10000)} 萬張`;
  return `${numberFormatter.format(value)} 張`;
}

function formatDate(dateValue, timeValue) {
  if (!dateValue || !timeValue) return "--";
  const year = dateValue.slice(0, 4);
  const month = dateValue.slice(4, 6);
  const day = dateValue.slice(6, 8);
  return `${year}/${month}/${day} ${timeValue}`;
}

function normalizeSymbols() {
  return symbolsInput.value
    .replace(/(\d{4})(?=\d{4})/g, "$1 ")
    .split(/[,\s，、；;]+/)
    .map((symbol) => symbol.trim())
    .filter(Boolean)
    .filter((symbol) => /^\d{4}$/.test(symbol))
    .filter((symbol, index, array) => array.indexOf(symbol) === index)
    .join(",");
}

function updateMarketStatus(queryTime) {
  const time = queryTime?.sysTime || "";
  const isTradeWindow = time >= "09:00:00" && time <= "13:35:00";
  marketStatus.classList.toggle("open", isTradeWindow);
  marketStatus.classList.toggle("closed", !isTradeWindow);
  marketStatus.textContent = isTradeWindow ? "盤中報價" : "非交易時段";
}

function setError(message) {
  errorBox.hidden = !message;
  errorBox.textContent = message || "";
}

function setReportError(message) {
  reportErrorBox.hidden = !message;
  reportErrorBox.textContent = message || "";
}

function switchView(viewName) {
  const isReport = viewName === "report";
  navTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });
  views.forEach((view) => {
    view.classList.toggle("active", view.id === `${viewName}-view`);
  });
  pageTitle.textContent = isReport ? "台股每日股市報告" : "台股自選股即時報價";
  pageSubtitle.textContent = isReport
    ? "DeepSeek 生成 HTML 日報，聚焦收盤、籌碼、產業與隔日交易計畫"
    : "南亞科 2408、華邦電 2344、台積電 2330、群創 3481";

  if (isReport && !reportLoaded) {
    loadDailyReport();
  }
}

function formatGeneratedAt(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Taipei"
  }).format(new Date(value));
}

function setField(card, field, value) {
  card.querySelector(`[data-field="${field}"]`).textContent = value;
}

function renderQuote(quote) {
  const card = template.content.firstElementChild.cloneNode(true);
  const change = quote.change ?? 0;
  const directionClass = change > 0 ? "up" : change < 0 ? "down" : "";
  const sign = change > 0 ? "+" : "";
  const bestBid = quote.bestBid?.length ? quote.bestBid[0] : null;
  const bestAsk = quote.bestAsk?.length ? quote.bestAsk[0] : null;

  card.querySelector(".symbol").textContent = quote.symbol;
  card.querySelector("h2").textContent = quote.name;
  card.querySelector(".badge").textContent = quote.exchange?.toUpperCase() || "TW";
  card.querySelector(".price").textContent = formatNumber(quote.price);

  const changeNode = card.querySelector(".change");
  changeNode.className = `change ${directionClass}`.trim();
  changeNode.textContent =
    quote.change === null
      ? "--"
      : `${sign}${formatNumber(change)} (${sign}${percentFormatter.format(
          quote.changePercent || 0
        )}%)`;

  setField(card, "open", formatNumber(quote.open));
  setField(card, "high", formatNumber(quote.high));
  setField(card, "low", formatNumber(quote.low));
  setField(card, "previousClose", formatNumber(quote.previousClose));
  setField(card, "volumeLots", formatVolume(quote.volumeLots));
  setField(card, "time", quote.time || "--");
  setField(card, "bestBid", formatNumber(bestBid));
  setField(card, "bestAsk", formatNumber(bestAsk));

  return card;
}

function renderQuotes(quotes) {
  grid.replaceChildren(...quotes.map(renderQuote));
}

async function loadQuotes() {
  const symbols = normalizeSymbols();
  if (!symbols) {
    setError("請輸入至少一個 4 碼股票代號。");
    return;
  }

  refreshButton.disabled = true;
  setError("");

  try {
    const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols)}`, {
      cache: "no-store"
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "報價讀取失敗");
    }

    renderQuotes(data.quotes);
    updateMarketStatus(data.queryTime);
    const sysDate = data.queryTime?.sysDate;
    const sysTime = data.queryTime?.sysTime;
    lastUpdated.textContent = `系統時間 ${formatDate(sysDate, sysTime)}`;
  } catch (error) {
    setError(`無法取得即時股價：${error.message}`);
  } finally {
    refreshButton.disabled = false;
  }
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

async function loadDailyReport({ force = false } = {}) {
  generateReportButton.disabled = true;
  setReportError("");
  reportStatus.textContent = force ? "正在重新生成報告..." : "正在生成今日報告...";
  reportGeneratedAt.textContent = "請稍候";

  try {
    const response = await fetch("/api/daily-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slot: reportSlot.value,
        force
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "報告生成失敗");
    }

    reportFrame.srcdoc = data.html || reportFallbackHtml("DeepSeek 未回傳 HTML 內容。");
    reportStatus.textContent = data.cached ? "已載入今日快取報告" : "今日報告已生成";
    reportGeneratedAt.textContent = formatGeneratedAt(data.generatedAt);
    generateReportButton.textContent = "重新生成報告";
    reportLoaded = true;
  } catch (error) {
    const message = `無法生成每日股市報告：${error.message}`;
    setReportError(message);
    reportFrame.srcdoc = reportFallbackHtml(message);
    reportStatus.textContent = "生成失敗";
    reportGeneratedAt.textContent = "--";
  } finally {
    generateReportButton.disabled = false;
  }
}

function syncTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (autoRefreshInput.checked) {
    timer = setInterval(loadQuotes, 5000);
  }
}

refreshButton.addEventListener("click", loadQuotes);
symbolsInput.addEventListener("change", loadQuotes);
autoRefreshInput.addEventListener("change", syncTimer);
generateReportButton.addEventListener("click", () => loadDailyReport({ force: true }));
reportSlot.addEventListener("change", () => {
  reportLoaded = false;
  loadDailyReport();
});
navTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

syncTimer();
loadQuotes();
reportFrame.srcdoc = reportFallbackHtml("切換到每日股市報告後，系統會生成今日報告。");
