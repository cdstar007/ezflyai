import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const defaultSymbols = ["2408", "2344", "2330", "3481"];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function normalizeSymbols(value) {
  const raw = value ? value.split(",") : defaultSymbols;
  return raw
    .map((symbol) => symbol.trim())
    .filter((symbol) => /^\d{4}$/.test(symbol))
    .slice(0, 20);
}

function toNumber(value) {
  if (!value || value === "-") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseLevel(value) {
  if (!value || value === "-") return [];
  return value
    .split("_")
    .filter(Boolean)
    .map(toNumber)
    .filter((number) => number !== null);
}

function mapQuote(item) {
  const price = toNumber(item.z) ?? toNumber(item.pz);
  const previousClose = toNumber(item.y);
  const change = price !== null && previousClose !== null ? price - previousClose : null;
  const changePercent =
    change !== null && previousClose ? (change / previousClose) * 100 : null;

  return {
    symbol: item.c,
    name: item.n,
    fullName: item.nf,
    exchange: item.ex,
    price,
    previousClose,
    open: toNumber(item.o),
    high: toNumber(item.h),
    low: toNumber(item.l),
    limitUp: toNumber(item.u),
    limitDown: toNumber(item.w),
    volumeLots: toNumber(item.v),
    tradeVolumeLots: toNumber(item.tv),
    time: item.t,
    date: item.d,
    change,
    changePercent,
    bestAsk: parseLevel(item.a),
    bestAskVolume: parseLevel(item.f),
    bestBid: parseLevel(item.b),
    bestBidVolume: parseLevel(item.g)
  };
}

async function fetchQuotes(symbols) {
  const channels = symbols.map((symbol) => `tse_${symbol}.tw`).join("|");
  const endpoint = new URL("https://mis.twse.com.tw/stock/api/getStockInfo.jsp");
  endpoint.searchParams.set("ex_ch", channels);
  endpoint.searchParams.set("json", "1");
  endpoint.searchParams.set("delay", "0");
  endpoint.searchParams.set("_", Date.now().toString());

  const response = await fetch(endpoint, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": "twstock-watchlist/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`TWSE responded with ${response.status}`);
  }

  const payload = await response.json();
  if (payload.rtcode !== "0000") {
    throw new Error(payload.rtmessage || "TWSE quote lookup failed");
  }

  return {
    quotes: (payload.msgArray || []).map(mapQuote),
    queryTime: payload.queryTime,
    userDelay: payload.userDelay
  };
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-cache"
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/quotes") {
    const symbols = normalizeSymbols(url.searchParams.get("symbols"));
    if (!symbols.length) {
      sendJson(res, 400, { error: "請輸入 4 碼台股代號" });
      return;
    }

    try {
      sendJson(res, 200, await fetchQuotes(symbols));
    } catch (error) {
      sendJson(res, 502, { error: error.message });
    }
    return;
  }

  await serveStatic(req, res);
});

server.listen(port, host, () => {
  console.log(`TW stock watchlist running at http://${host}:${port}`);
});
