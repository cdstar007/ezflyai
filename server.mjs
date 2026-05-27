import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const reportsDir = join(__dirname, "data", "reports");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const defaultSymbols = ["2408", "2344", "2330", "3481"];
const reportSymbols = [
  "2330",
  "2317",
  "2454",
  "2382",
  "3231",
  "2376",
  "3017",
  "3324",
  "3661",
  "3443",
  "5274",
  "6442",
  "4979",
  "3450",
  "1519",
  "1503",
  "1513",
  "1514",
  "6869",
  "2603",
  "2609",
  "2615",
  "2408",
  "2344",
  "3481"
];
const reportCache = new Map();
const reportInFlight = new Map();

const dailyReportPrompt = `你是一名专业的台股市场日报分析师、总体经济策略分析师和台湾电子半导体产业研究员。

请你每天[选择：傍晚 18:00 / 早上 07:30]，为我生成一份完整的《台股收盘与盘后筹码日报》。

报告语言：正体中文（台湾财经术语，如：法人、買賣超、融資融券、均線、跳空、斷頭、軋空、權值股）。
报告风格：专业、清晰、数据驱动、适合投资复盘和次日交易计画。
报告目标：帮助我快速理解今日（或昨夜美股联动后）台股发生了什么、大盘为什么涨跌、三大法人资金在买什么卖什么、哪些族群/个股出现异动、接下来应该关注哪些风险和机会。

貨幣與單位規則（極重要）：
- 報告中的台股金額、成交值、買賣超、融資餘額、公司營收、市值與資金流，請一律使用新台幣（NT$）。
- 台股市場常用大額單位請寫「新台幣億元」或「億元（新台幣）」，不要只寫「億元」。
- 不得使用人民幣、人民币、RMB、CNY、元人民幣等中國貨幣語境。
- 若引用美股、ADR、美元指數、美債或國際商品，才可使用美元（US$），並需清楚標註。
- 股價請使用該市場原始報價貨幣，例如台股個股為新台幣，TSM ADR 為美元。

请务必使用最新数据，优先参考权威来源，包括但不限于：
台湾证券交易所（TWSE）、柜买中心（TPEx）、公开资讯观测站、中央银行、钜亨网、MoneyDJ、经济日报、工商时报、Cmoney、富邦/元大等大型投顾报告、以及昨夜美股/费城半导体指数（SOX）表现。

如果数据存在冲突，优先采用台湾证交所及官方公开资讯观测站的最终盘后数据。
所有关键事实、重要数据、公司营收、重大讯息、宏观数据都需要注明来源。不要编造数据。如果某项数据暂时无法获取，请明确写“暂无可靠数据”。

请按照以下结构生成日报：
台股收盘日报｜YYYY-MM-DD

0. 今日一句话总结
用 3-5 句话概括今日台股最重要的变化：
- 加权指数与柜买指数是上涨、下跌还是震荡？
- 驱动因素是美股联动、外资汇入/汇出、台积电法说、供应链营收、还是内资投信作帐？
- 资金是 Risk-on 还是 Risk-off？市场宽度（涨跌家数比）是改善还是恶化？
- 今天最值得关注的主线（如：AI 伺服器、散热、光通讯、重电、绿能、金融等）是什么？
- 最后给出一句简洁判断：
今日市场状态：例如“权值股撑盘、中小型股修正，AI 硬件继续主导，但短线隔日冲拥挤度上升。”

1. 大盘表现与盘后筹码总览
请列出以下指数及关键指标的当日表现：
【指数/指标 | 收盘点位/数值 | 涨跌幅/绝对值 | 日内高低点 | 成交量 | 技术状态】
- 加权指数 (TAIEX)
- 柜买指数 (TWO)
- 电子指数
- 金融指数
- 昨夜费城半导体指数 (SOX)
- 昨夜台积电 ADR (TSM)
- 新台币汇率 (TWD/USD)

【三大法人及信用交易筹码】（极重要）
- 外資及陸資買賣超（新台幣億元）：
- 投信買賣超（新台幣億元）：
- 自營商買賣超（新台幣億元）：
- 三大法人合計買賣超（新台幣億元）：
- 外资台指期货未平仓净口数（口）：[说明多空增减]
- 融資餘額變化（新台幣億元）：
- 融券余额外化（张）：
- 八大官股券商动向（买超/卖超）：

请额外说明：
- 大盘是否创历史新高 / 阶段新高 / 跌破关键均线（如月线、季线）？
- 柜买指数（中小型股）是否明显弱于/强于加权指数？
- 台积电（2330）单一个股对大盘涨跌点的贡献度？
- 外资期现货是“双买”、“双卖”还是“期现货背离”？

2. 盘中走势与国际联动复盘
请用时间线方式复盘：
- 昨夜美股（尤其是科技股、AI 概念股、台积电 ADR）对今日台股开盘的影响？
- 9:00 开盘后是高开低走、低开高走，还是震荡？是否有估值修正或强力拉抬？
- 11:30-13:00 盘中是否有特定族群集体发动或主力出货？
- 13:00-13:30 尾盘拉抬或杀尾盘动向（特别是周三台指期结算日或摩台期结算日）？
- 请解释当天涨跌的核心原因。是否有明显的利多出尽（Sell the news）/ 逢低承接（Buy the dip）/ 轧空（Short squeeze）/ 族群轮动？

3. 总体经济与台币汇率
请覆盖以下宏观变量，并解释它们对台股的潜在影响：
- 新台币汇率走势：台币升贬值方向与外资热钱流入/流出的相关性。
- 美国 10 年期美债收益率与美元指数（DXY）最新状态。
- 台湾央行动态、利率决策、或重要总体经济指标（如景气对策信号、出口数据、PCE/CPI等对电子供应链的预期压制或释放）。

4. 类股与产业族群表现
请列出今日表现最强与最弱的台股上市/上柜产业分类（参考证交所分类）：
【排名 | 产业族群/概念 | 当日涨跌幅 | 三大法人主要动向 | 主要驱动事件】
- 电子半导体（晶圆代工、IC设计、封测）
- AI 供应链（伺服器代工、散热、光通讯/矽光子、网通、CCL、PCB）
- 关键零组件（被动元件、光学镜头、记忆体）
- 传统产业与周期（航运/货柜/散装、钢铁、塑化、水泥）
- 政策利多与防守族群（重电/生技/绿能/军工）
- 金融股

请额外说明：
- 今天资金主要集中在电子核心、还是流向传产/金融避险？
- 是否出现 AI 硬件链内部的轮动（如资金从代工大厂流向低价位零组件，或从硬件切向绿能、重电等电力链）？

5. 市场宽度与参与度分析
6.1 均线参与度
- 大盘成份股高于 20日、50日、200日均线的比例及解读。
- 是否出现“指数靠台积电创新高，但扣除台积电后大多数股票下跌”的“垃圾盘/拉积盘”背离现象？
6.2 涨跌家数与涨跌停数
- 上市/上柜：上涨家数、下跌家数、持平家数。
- 今日涨停家数、跌停家数（分析市场投机气氛与散户活跃度）。

6. 技术面分析
请分析以下核心标的的波段形态：
【标的：加权指数、柜买指数、台积电(2330)、鸿海(2317)、广达(2382)】
- 当前价格、5日线、20日线（月线）、60日线（季线）的位置。
- RSI / MACD 指标状态（是否超买/超卖，是否出现日线级别背离）。
- 关键支撑位与关键压力位。

7. 重点个股新闻与异动（台股核心观察链）
请重点追踪并列出今日最重要的个股消息（重大讯息、法说会、营收公告、券商评级调整）：
7.1 权值三雄及AI代工核心：
- 台积电 (2330)、鸿海 (2317)、联发科 (2454)、广达 (2382)、纬创 (3231)、技嘉 (2376)。
7.2 AI关键零组件（散热、光通讯、IC设计）：
- 奇鋐 (3017)、双鸿 (3324)、世芯-KY (3661)、创意 (3443)、信骅 (5274)、光圣 (6442)、华星光 (4979)、联钧 (3450) 等。
7.3 政策重电与绿能基础设施：
- 华城 (1519)、士电 (1503)、中兴电 (1513)、亚力 (1514)、云豹能源 (6869)。
7.4 传产人气股（如航运）：
- 长荣 (2603)、阳明 (2609)、万海 (2615)。

请说明上述个股：当日涨跌幅、异动原因（如：月营收创历史新高、外资上调目标价、法说会释出乐观指引、隔日冲主力大买等）、及后续技术面关注点。

8. 重大财经日历与公司法说会
- 昨夜/今日已公布重要重大讯息或法说会内容的公司之核心解读（营收、毛利率、展望是否 Beat？市场如何反应？）。
- 未来 1-3 个交易日台股重要公司法说会、除权息日程、或美国重要科技股财报预告。

9. 板块轮动判断
请明确回答当前市场处于哪种状态：
【拉积盘(仅台积电涨) / 电子主升段 / 中小型股活蹦乱跳 / 资金避险传产金融 / 高切低(寻找低基期股) / 普跌断头恐慌】
- 今天资金主要流入哪里？主要流出哪里？
- AI 主线与半导体链是否依然健康？

10. 我的交易计画与风险提示
10.1 今日/明日观察要点
- 新台币汇率是否止贬回升？外资期货空单是否有回补迹象？
- 加权指数与柜买指数的关键守备位置。
10.2 风险等级评估
- 请针对以下维度评估风险等级（低 / 中 / 中高 / 高）：
【外资提款风险、融资断头压力、AI族群拥挤度、美股科技股回调风险、台币贬值压力】

11. 最终结论
- 今日市场结论（用 3-5 句话精准总结）。
- 建议的操作倾向：操作上适合逢低布局主流、短线高抛低吸、还是应该控制仓位观望法说会？
- 明日开盘最值得关注的 5 个核心信号。
並且生成html代碼提供。
這個網站獲取html代碼，並且顯示在這個tw.limelink.cc的網站上`;

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

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
    if (Buffer.concat(chunks).length > 64 * 1024) {
      throw new Error("Request body is too large");
    }
  }

  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function taipeiDateString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function extractHtml(content) {
  const match = content.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (match ? match[1] : content).trim();
}

function reportFilePath(date) {
  return join(reportsDir, `${date}.json`);
}

async function readStoredReport(date) {
  try {
    const report = JSON.parse(await readFile(reportFilePath(date), "utf8"));
    return {
      ...report,
      cached: true,
      persisted: true
    };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeStoredReport(report) {
  await mkdir(reportsDir, { recursive: true });
  await writeFile(reportFilePath(report.date), JSON.stringify(report, null, 2), "utf8");
}

function buildReportPrompt(slot, marketContext) {
  const slotText = slot === "morning" ? "早上 07:30" : "傍晚 18:00";
  return `${dailyReportPrompt}

本次請選擇：${slotText}
今日日期：${taipeiDateString()}

本服務於呼叫 DeepSeek 前即時抓取的官方報價資料（極重要，優先使用）：
${marketContext}

資料使用規則：
- 上方「本服務即時抓取資料」來自 TWSE/TPEx MIS API，請視為本次報告的優先基準資料。
- 若你自己的知識、搜尋結果或其他來源與上方資料衝突，一律以上方資料為準。
- 尤其台積電 2330 的現價/收盤價不得沿用舊資料；請使用上方 2330 欄位中的 price、previousClose、date、time。
- 報告中若某項數據沒有在上方資料或可靠來源出現，請寫「暫無可靠資料」，不要以舊資料補齊。

輸出要求：
- 只輸出可直接嵌入 iframe srcdoc 的完整 HTML。
- HTML 內請包含 <style>，版面需適合桌面與手機閱讀。
- 不要輸出 Markdown，不要用代碼圍欄。
- 台股相關金額一律標示為新台幣，例如「新台幣 125.4 億元」或「125.4 億元（新台幣）」。
- 不得以人民幣、人民币、RMB、CNY 表示台股資料。
- 若無法取得最新可靠資料，請在對應欄位明確寫「暫無可靠資料」，不要編造。`;
}

async function generateDailyReport(slot) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("伺服器尚未設定 DEEPSEEK_API_KEY");
  }

  const date = taipeiDateString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  try {
    const marketContext = await fetchReportMarketContext();
    const response = await fetch(
      process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "你是嚴謹的台股市場分析師。台股相關金額必須使用新台幣，不得使用人民幣語境。使用者提供的 TWSE/TPEx 即時資料優先於你的既有知識；必須標註來源；不知道就說暫無可靠資料。"
            },
            {
              role: "user",
              content: buildReportPrompt(slot, marketContext)
            }
          ],
          temperature: 0.2,
          max_tokens: Number(process.env.DEEPSEEK_MAX_TOKENS || 8192),
          stream: false
        })
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error?.message || `DeepSeek API responded with ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek API 未回傳報告內容");
    }

    const report = {
      date,
      slot,
      generatedAt: new Date().toISOString(),
      model: payload.model || process.env.DEEPSEEK_MODEL || "deepseek-chat",
      html: extractHtml(content),
      cached: false,
      persisted: true
    };
    return report;
  } finally {
    clearTimeout(timeout);
  }
}

async function createDailyReport({ slot = "close" } = {}) {
  const date = taipeiDateString();
  const cacheKey = date;

  if (reportCache.has(cacheKey)) {
    return { ...reportCache.get(cacheKey), cached: true, persisted: true };
  }

  const storedReport = await readStoredReport(date);
  if (storedReport) {
    reportCache.set(cacheKey, storedReport);
    return storedReport;
  }

  if (!reportInFlight.has(cacheKey)) {
    reportInFlight.set(
      cacheKey,
      (async () => {
        const report = await generateDailyReport(slot);
        await writeStoredReport(report);
        reportCache.set(cacheKey, report);
        return report;
      })().finally(() => {
        reportInFlight.delete(cacheKey);
      })
    );
  }

  return reportInFlight.get(cacheKey);
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

function formatTaiwanDateTime() {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date());
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
  const channels = symbols
    .flatMap((symbol) => [`tse_${symbol}.tw`, `otc_${symbol}.tw`])
    .join("|");
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

  const quotes = (payload.msgArray || [])
      .filter((item) => /^\d{4}$/.test(item.c || ""))
      .map(mapQuote);

  return {
    quotes,
    queryTime: payload.queryTime,
    userDelay: payload.userDelay
  };
}

function formatQuoteContext(quote) {
  return {
    symbol: quote.symbol,
    name: quote.name,
    exchange: quote.exchange,
    price: quote.price,
    previousClose: quote.previousClose,
    change: quote.change,
    changePercent: quote.changePercent,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    volumeLots: quote.volumeLots,
    date: quote.date,
    time: quote.time,
    source: quote.exchange === "otc" ? "TPEx/TWSE MIS" : "TWSE MIS"
  };
}

async function fetchReportMarketContext() {
  try {
    const data = await fetchQuotes(reportSymbols);
    const quotes = data.quotes.map(formatQuoteContext);
    const tsmcQuote = quotes.find((quote) => quote.symbol === "2330");

    return JSON.stringify(
      {
        generatedAtTaipei: formatTaiwanDateTime(),
        source: "TWSE/TPEx MIS 即時報價 API",
        queryTime: data.queryTime,
        note:
          "此資料由網站後端在呼叫 DeepSeek 前即時取得。若模型記憶或其他來源與此處衝突，請以此處為準。",
        criticalReminder: tsmcQuote
          ? `台積電 2330 本次抓取價格為 ${tsmcQuote.price} 新台幣，日期 ${tsmcQuote.date}，時間 ${tsmcQuote.time}。不得使用 895 元等舊資料。`
          : "本次未取得台積電 2330 即時報價，請勿編造。",
        quotes
      },
      null,
      2
    );
  } catch (error) {
    return JSON.stringify(
      {
        generatedAtTaipei: formatTaiwanDateTime(),
        source: "TWSE/TPEx MIS 即時報價 API",
        error: `即時報價抓取失敗：${error.message}`,
        instruction: "即時資料不可用時，所有無可靠來源的數據請寫「暫無可靠資料」。"
      },
      null,
      2
    );
  }
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

  if (url.pathname === "/api/daily-report") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const body = await readJsonBody(req);
      sendJson(
        res,
        200,
        await createDailyReport({
          slot: body.slot === "morning" ? "morning" : "close"
        })
      );
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
