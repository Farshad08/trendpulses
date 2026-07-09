import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

interface StockBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  event?: string;
}

// Generate highly realistic synthetic historical data
function generateHistoricalData(ticker: string, totalDays: number): StockBar[] {
  let basePrice = 500;
  let drift = 0.0003; // Daily drift
  let volatility = 0.016; // Daily volatility
  let cyclicalPeriod = 45; // 45-day cycle
  let cyclicalAmplitude = 0.003;

  const upperTicker = ticker.toUpperCase();

  // Customize baseline properties per preset Indian ticker
  switch (upperTicker) {
    case "RELIANCE":
      basePrice = 2450;
      drift = 0.00045;
      volatility = 0.013;
      cyclicalPeriod = 60;
      cyclicalAmplitude = 0.002;
      break;
    case "TCS":
      basePrice = 3850;
      drift = 0.00035;
      volatility = 0.011;
      cyclicalPeriod = 75;
      cyclicalAmplitude = 0.0015;
      break;
    case "HDFCBANK":
      basePrice = 1620;
      drift = 0.00025;
      volatility = 0.014;
      cyclicalPeriod = 50;
      cyclicalAmplitude = 0.002;
      break;
    case "INFY":
      basePrice = 1530;
      drift = 0.0003;
      volatility = 0.015;
      cyclicalPeriod = 55;
      cyclicalAmplitude = 0.0025;
      break;
    case "ICICIBANK":
      basePrice = 1110;
      drift = 0.00045;
      volatility = 0.014;
      cyclicalPeriod = 40;
      cyclicalAmplitude = 0.003;
      break;
    case "SBIN":
      basePrice = 840;
      drift = 0.0005;
      volatility = 0.018;
      cyclicalPeriod = 45;
      cyclicalAmplitude = 0.004;
      break;
    case "BHARTIAIRTEL":
      basePrice = 1380;
      drift = 0.0006;
      volatility = 0.015;
      cyclicalPeriod = 50;
      cyclicalAmplitude = 0.003;
      break;
    case "ITC":
      basePrice = 425;
      drift = 0.0002;
      volatility = 0.012;
      cyclicalPeriod = 90;
      cyclicalAmplitude = 0.001;
      break;
    case "LT":
      basePrice = 3520;
      drift = 0.0004;
      volatility = 0.013;
      cyclicalPeriod = 65;
      cyclicalAmplitude = 0.002;
      break;
    case "HINDUNILVR":
      basePrice = 2410;
      drift = 0.00015;
      volatility = 0.011;
      cyclicalPeriod = 80;
      cyclicalAmplitude = 0.001;
      break;
    case "TATAMOTORS":
      basePrice = 960;
      drift = 0.0008;
      volatility = 0.022;
      cyclicalPeriod = 35;
      cyclicalAmplitude = 0.005;
      break;
    case "COALINDIA":
      basePrice = 465;
      drift = 0.0003;
      volatility = 0.019;
      cyclicalPeriod = 70;
      cyclicalAmplitude = 0.003;
      break;
    case "SUNPHARMA":
      basePrice = 1510;
      drift = 0.0004;
      volatility = 0.014;
      cyclicalPeriod = 60;
      cyclicalAmplitude = 0.002;
      break;
    case "WIPRO":
      basePrice = 475;
      drift = 0.00025;
      volatility = 0.016;
      cyclicalPeriod = 50;
      cyclicalAmplitude = 0.003;
      break;
    case "ASIANPAINT":
      basePrice = 2850;
      drift = 0.0002;
      volatility = 0.013;
      cyclicalPeriod = 75;
      cyclicalAmplitude = 0.0015;
      break;
    case "ADANIENT":
      basePrice = 3120;
      drift = 0.0009;
      volatility = 0.028;
      cyclicalPeriod = 30;
      cyclicalAmplitude = 0.006;
      break;
    case "BAJFINANCE":
      basePrice = 6980;
      drift = 0.0005;
      volatility = 0.021;
      cyclicalPeriod = 40;
      cyclicalAmplitude = 0.004;
      break;
    case "TITAN":
      basePrice = 3280;
      drift = 0.00045;
      volatility = 0.016;
      cyclicalPeriod = 55;
      cyclicalAmplitude = 0.0025;
      break;
    case "ZOMATO":
      basePrice = 195;
      drift = 0.0012;
      volatility = 0.028;
      cyclicalPeriod = 25;
      cyclicalAmplitude = 0.007;
      break;
    case "MARUTI":
      basePrice = 11950;
      drift = 0.00035;
      volatility = 0.015;
      cyclicalPeriod = 80;
      cyclicalAmplitude = 0.002;
      break;
    default:
      // Deterministic parameter derivation for any custom-typed Indian ticker symbol
      let hash = 0;
      for (let i = 0; i < upperTicker.length; i++) {
        hash = upperTicker.charCodeAt(i) + ((hash << 5) - hash);
      }
      hash = Math.abs(hash);

      basePrice = 150 + (hash % 4850); // ₹150 to ₹5000 range
      drift = -0.0002 + ((hash % 100) / 100) * 0.0020; // -0.0002 to 0.0018
      volatility = 0.010 + (((hash >> 4) % 100) / 100) * 0.025; // 0.010 to 0.035
      cyclicalPeriod = 30 + (hash % 90); // 30 to 120 days
      cyclicalAmplitude = 0.001 + (((hash >> 8) % 100) / 100) * 0.007; // 0.001 to 0.008
      break;
  }

  const data: StockBar[] = [];
  const now = new Date();
  let currentPrice = basePrice;

  // We want to generate days sequentially ending today
  const dates: Date[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    // Exclude weekends for stocks (except crypto, but for simplicity let's keep all trading days)
    dates.push(d);
  }

  // Box-Muller transform for normal distribution
  function randomNormal() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); 
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // List of potential pre-defined market events that trigger price shocks
  const events = [
    { dayOffset: Math.floor(totalDays * 0.15), type: "bullish", desc: "Earnings Beat & Dividend Hike", shock: 0.045 },
    { dayOffset: Math.floor(totalDays * 0.35), type: "bearish", desc: "Regulatory Headwinds Announcement", shock: -0.05 },
    { dayOffset: Math.floor(totalDays * 0.55), type: "bullish", desc: "AI Integration Product Line Unveiled", shock: 0.06 },
    { dayOffset: Math.floor(totalDays * 0.75), type: "bearish", desc: "Macro Inflation Fears & Rate Increase", shock: -0.035 },
    { dayOffset: Math.floor(totalDays * 0.90), type: "bullish", desc: "Competitor Partnership Signed", shock: 0.025 }
  ];

  for (let i = 0; i < totalDays; i++) {
    const dateStr = dates[i].toISOString().split("T")[0];
    
    // Check for events
    const matchingEvent = events.find(e => e.dayOffset === i);
    let eventShock = 0;
    let eventName: string | undefined = undefined;
    if (matchingEvent) {
      eventShock = matchingEvent.shock;
      eventName = matchingEvent.desc;
    }

    // Daily price change math
    const z = randomNormal();
    const cycle = Math.sin((i / cyclicalPeriod) * 2 * Math.PI) * cyclicalAmplitude;
    const changePercent = drift + cycle + (z * volatility) + eventShock;
    
    const open = currentPrice;
    const close = currentPrice * (1 + changePercent);
    
    // Create random spread for High & Low
    const maxVar = currentPrice * volatility;
    const high = Math.max(open, close) + Math.abs(randomNormal() * maxVar * 0.4);
    const low = Math.min(open, close) - Math.abs(randomNormal() * maxVar * 0.4);
    
    // Volume generation based on volatility and events
    const baseVolume = 5000000;
    const multiplier = (upperTicker === "RELIANCE" || upperTicker === "TCS" || upperTicker === "HDFCBANK") ? 8 : 1;
    const volZ = Math.abs(randomNormal());
    const volume = Math.floor((baseVolume * multiplier) * (1 + volZ + (matchingEvent ? 3 : 0)));

    currentPrice = close;

    data.push({
      date: dateStr,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
      event: eventName
    });
  }

  return data;
}

// 1. Get stock historical data API
app.get("/api/stock-data", (req, res) => {
  try {
    const ticker = (req.query.ticker as string) || "AAPL";
    const days = parseInt(req.query.days as string) || 180;
    
    if (days < 30 || days > 730) {
      return res.status(400).json({ error: "Days must be between 30 and 730" });
    }

    const stockData = generateHistoricalData(ticker, days);
    res.json({ ticker: ticker.toUpperCase(), data: stockData });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Gemini Prediction & Market Insight Advisor API
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { ticker, dataSummary, technicalSignals, predictionSummary } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: "Ticker is required" });
    }

    const prompt = `
      You are an elite financial quantitative analyst and market strategist. 
      Analyze the following stock market data and forecasting model results for ticker: ${ticker}.
      
      --- MARKET DATA SUMMARY (Last 30 Days) ---
      ${JSON.stringify(dataSummary)}
      
      --- RECENT TECHNICAL SIGNALS ---
      ${JSON.stringify(technicalSignals)}
      
      --- MODEL PREDICTION RESULTS (Next 10-Day Horizon) ---
      ${JSON.stringify(predictionSummary)}
      
      Please generate a comprehensive, highly professional, and quantitative market trend analysis report.
      Format the response in structured markdown with the following sections:
      
      1. ### Executive Trend Summary
         - A concise summary of the overall direction (Strong Bullish, Bullish, Neutral, Bearish, Strong Bearish) and underlying momentum.
      
      2. ### Technical Indicator Breakdown
         - Interpret the RSI, MACD crossovers, Bollinger Band positioning, and Volume Moving Averages. Detail how they confirm or conflict with each other.
      
      3. ### Evaluation of Forecasting Models
         - Assess the statistical validity of the models (Linear Regression, Double Exponential Smoothing, KNN). Which model should be trusted more under current market conditions and why?
      
      4. ### Strategic Recommendations & Risk Management
         - Provide mock investment suggestions (e.g., Entry Zone, Target Price, Stop-Loss Level) based strictly on technical boundaries (support/resistance).
         - Detail specific risk factors (volatility levels, potential macroeconomic triggers).

      Ensure the tone is objective, math-backed, clear, and structured. Do not use generic hand-waving statements. Use bold metrics where appropriate.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ report: response.text });
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    res.status(500).json({ error: error.message || "Failed to generate market advisor report" });
  }
});

// Vite server connection (development vs production)
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
