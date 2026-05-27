const grid = document.querySelector("#quote-grid");
const template = document.querySelector("#quote-card-template");
const symbolsInput = document.querySelector("#symbols");
const refreshButton = document.querySelector("#refresh");
const autoRefreshInput = document.querySelector("#auto-refresh");
const errorBox = document.querySelector("#error");
const lastUpdated = document.querySelector("#last-updated");
const marketStatus = document.querySelector("#market-status");

let timer = null;

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
    .split(/[,\s，、]+/)
    .map((symbol) => symbol.trim())
    .filter(Boolean)
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

syncTimer();
loadQuotes();
