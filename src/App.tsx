import React, { useState, useEffect } from "react";
import { ChartDataPoint, ForecastModelType, Hyperparameters, PredictionPoint, EvaluationMetrics } from "./types";
import { augmentStockData } from "./utils/indicators";
import IndicatorCharts from "./components/IndicatorCharts";
import ModelSelector from "./components/ModelSelector";
import TuningSuite from "./components/TuningSuite";
import BacktestSuite from "./components/BacktestSuite";
import AIAdvisor from "./components/AIAdvisor";
import {
  TrendingUp,
  Cpu,
  Layers,
  Sparkles,
  BarChart2,
  Calendar,
  AlertCircle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Coins
} from "lucide-react";

const SUPPORTED_TICKERS = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd.", sector: "Energy, Retail & Telecom" },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd.", sector: "Information Technology" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd.", sector: "Banking & Financials" },
  { symbol: "INFY", name: "Infosys Ltd.", sector: "Information Technology" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd.", sector: "Banking & Financials" },
  { symbol: "SBIN", name: "State Bank of India", sector: "Public Sector Banking" },
  { symbol: "BHARTIAIRTEL", name: "Bharti Airtel Ltd.", sector: "Telecommunications" },
  { symbol: "ITC", name: "ITC Ltd.", sector: "FMCG, Hotels & Paper" },
  { symbol: "LT", name: "Larsen & Toubro Ltd.", sector: "Engineering & Construction" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd.", sector: "FMCG & Consumer Goods" },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd.", sector: "Automotive" },
  { symbol: "COALINDIA", name: "Coal India Ltd.", sector: "Mining & Energy" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries Ltd.", sector: "Pharmaceuticals" },
  { symbol: "WIPRO", name: "Wipro Ltd.", sector: "Information Technology" },
  { symbol: "ASIANPAINT", name: "Asian Paints Ltd.", sector: "Chemicals & Paints" },
  { symbol: "ADANIENT", name: "Adani Enterprises Ltd.", sector: "Conglomerate & Infrastructure" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd.", sector: "Financial Services" },
  { symbol: "TITAN", name: "Titan Company Ltd.", sector: "Consumer Goods & Jewellery" },
  { symbol: "ZOMATO", name: "Zomato Ltd.", sector: "Internet Services & Logistics" },
  { symbol: "MARUTI", name: "Maruti Suzuki India Ltd.", sector: "Automotive" }
];

export default function App() {
  const [ticker, setTicker] = useState<string>("RELIANCE");
  const [customInput, setCustomInput] = useState<string>("");
  const [historyDays, setHistoryDays] = useState<number>(180);
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Navigation state
  const [activeTab, setActiveTab] = useState<"dashboard" | "models" | "tuning" | "backtest" | "ai">("dashboard");

  // Forecasting parameters & states
  const [activeModel, setActiveModel] = useState<ForecastModelType>("linear");
  const [horizon, setHorizon] = useState<number>(10);
  const [forecastPoints, setForecastPoints] = useState<PredictionPoint[]>([]);
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);

  const [hyperparams, setHyperparams] = useState<Hyperparameters>({
    linear: { lookback: 20 },
    exponential: { lookback: 30, alpha: 0.3, beta: 0.1 },
    knn: { lookback: 60, k: 5, features: ["rsi", "returns"] }
  });

  // Fetch and augment stock data
  const fetchStockData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/stock-data?ticker=${ticker}&days=${historyDays}`);
      if (!response.ok) {
        throw new Error("Failed to retrieve historical market data from service.");
      }
      const json = await response.json();
      
      // Augment the raw candles with our local technical indicators
      const augmented = augmentStockData(json.data);
      setData(augmented);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during database fetching.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, [ticker, historyDays]);

  // Callback to receive predictions from ModelSelector so other tabs (AIAdvisor/Backtest) can access it
  const handleForecastComputed = (
    modelType: ForecastModelType,
    predictions: PredictionPoint[],
    evalMetrics: EvaluationMetrics
  ) => {
    setForecastPoints(predictions);
    setMetrics(evalMetrics);
  };

  // Helper properties for dashboard cards
  const currentPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const previousPrice = data.length > 1 ? data[data.length - 2].close : 0;
  const absoluteChange = currentPrice - previousPrice;
  const percentageChange = previousPrice !== 0 ? (absoluteChange / previousPrice) * 100 : 0;

  // Compute bullish vs bearish indicator counts
  const computeSentimentScore = () => {
    if (data.length === 0) return { bullish: 0, bearish: 0 };
    const last = data[data.length - 1];
    let bullish = 0;
    let bearish = 0;

    // 1. SMA check
    if (last.smaFast !== undefined && last.smaSlow !== undefined) {
      if (last.smaFast > last.smaSlow) bullish++;
      else bearish++;
    }
    // 2. EMA check
    if (last.ema !== undefined) {
      if (last.close > last.ema) bullish++;
      else bearish++;
    }
    // 3. RSI check
    if (last.rsi !== undefined) {
      if (last.rsi < 30) bullish++; // oversold is bullish
      else if (last.rsi > 70) bearish++; // overbought is bearish
    }
    // 4. MACD check
    if (last.macdLine !== undefined && last.macdSignal !== undefined) {
      if (last.macdLine > last.macdSignal) bullish++;
      else bearish++;
    }

    return { bullish, bearish };
  };

  const sentiment = computeSentimentScore();

  return (
    <div className="min-h-screen bg-[#050505] text-[#E0E0E0] flex flex-col font-sans">
      {/* Premium Top Navbar */}
      <header className="bg-[#080808] border-b border-white/10 py-4 px-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="font-serif italic text-2xl tracking-tighter text-indigo-400">Aethelgard</span>
            <div className="h-4 w-px bg-white/20 hidden sm:block"></div>
            <div>
              <h1 className="text-xs uppercase tracking-[0.2em] font-medium text-neutral-300">
                Predictive Engine v4.2
              </h1>
              <p className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider mt-0.5">
                Technical Forecasting & Strategy Backtesting Suite
              </p>
            </div>
          </div>

          {/* Controls to select ticker */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-1.5 bg-white/[0.03] p-1.5 rounded-xl border border-white/10">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2">Presets:</span>
              <select
                value={SUPPORTED_TICKERS.some(t => t.symbol === ticker) ? ticker : "CUSTOM"}
                onChange={(e) => {
                  if (e.target.value !== "CUSTOM") {
                    setTicker(e.target.value);
                  }
                }}
                className="bg-[#0A0A0A] border border-white/10 text-xs font-bold text-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer max-w-[160px] sm:max-w-[200px]"
              >
                {SUPPORTED_TICKERS.map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.symbol} ({t.name.split(" ")[0]})
                  </option>
                ))}
                <option value="CUSTOM">-- Search Custom --</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-white/[0.03] p-1.5 rounded-xl border border-white/10">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2">Search Ticker:</span>
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customInput.trim()) {
                    setTicker(customInput.trim());
                  }
                }}
                placeholder="e.g. ZOMATO, TATASTEEL"
                className="bg-[#0A0A0A] border border-white/10 text-xs font-bold text-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 w-28 sm:w-36 placeholder:text-neutral-600 font-mono"
              />
              <button
                onClick={() => {
                  if (customInput.trim()) {
                    setTicker(customInput.trim());
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer"
              >
                Go
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-white/[0.03] p-1.5 rounded-xl border border-white/10">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2">Data Window:</span>
              <select
                value={historyDays}
                onChange={(e) => setHistoryDays(parseInt(e.target.value))}
                className="bg-[#0A0A0A] border border-white/10 text-xs font-bold text-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
              >
                <option value={90}>Last 90 Days</option>
                <option value={180}>Last 180 Days</option>
                <option value={240}>Last 240 Days</option>
                <option value={360}>Last 360 Days</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Loading and error state displays */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-500/25 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-xs text-neutral-400 font-semibold animate-pulse">Downloading market datasets & calculating technical envelopes...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-950/40 border border-rose-900/50 text-rose-200 p-6 rounded-2xl flex items-start gap-4 shadow-sm">
            <AlertCircle size={24} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-sm">Server Service Disturbance</h3>
              <p className="text-xs text-rose-300">{error}</p>
              <button
                onClick={fetchStockData}
                className="mt-3 bg-rose-600 hover:bg-rose-500 text-white font-bold py-1.5 px-3 rounded text-xs transition cursor-pointer"
              >
                Retry Database Fetch
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bento Grid Top Level Securities Metadata */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Price card */}
              <div className="bg-[#080808] border border-white/10 p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Real-time Asset Quote</span>
                    <span className="text-2xl font-extrabold text-white font-mono mt-1 block">
                      ₹{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <span className={`flex items-center gap-0.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                    percentageChange >= 0
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}>
                    {percentageChange >= 0 ? "+" : ""}{percentageChange.toFixed(2)}%
                  </span>
                </div>
                <div className="text-[10px] text-neutral-400 border-t border-white/5 pt-3 mt-4 flex justify-between">
                  <span>Daily Delta:</span>
                  <span className={`font-semibold ${absoluteChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {absoluteChange >= 0 ? "+" : ""}₹{absoluteChange.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Technical alignment sentiment slider */}
              <div className="bg-[#080808] border border-white/10 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Indicator Alignment</span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-lg font-extrabold text-neutral-200">
                      {sentiment.bullish > sentiment.bearish ? "Bullish Alignment" : sentiment.bullish < sentiment.bearish ? "Bearish Alignment" : "Balanced Neutral"}
                    </span>
                  </div>
                </div>
                {/* Horizontal simple index bar */}
                <div className="space-y-1.5 mt-4">
                  <div className="h-2 w-full bg-white/5 rounded-full flex overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${(sentiment.bullish / 4) * 100}%` }}></div>
                    <div className="bg-rose-500 h-full" style={{ width: `${(sentiment.bearish / 4) * 100}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-400 font-semibold font-mono">
                    <span>{sentiment.bullish} Bull Signals</span>
                    <span>{sentiment.bearish} Bear Signals</span>
                  </div>
                </div>
              </div>

              {/* Volatilty metrics */}
              <div className="bg-[#080808] border border-white/10 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Computed Daily Volatility</span>
                  <span className="text-lg font-extrabold text-neutral-200 mt-1 block">
                    {(() => {
                      const prices = data.map((d) => d.close);
                      const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
                      const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
                      const dailyVolatility = (Math.sqrt(variance) / mean) * 100;
                      return `${dailyVolatility.toFixed(2)}% Deviation`;
                    })()}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-400 border-t border-white/5 pt-3 mt-4 flex justify-between items-center">
                  <span>Risk Category:</span>
                  <span className="font-bold text-neutral-300 bg-white/5 px-2 py-0.5 rounded uppercase text-[9px]">
                    {(() => {
                      const prices = data.map((d) => d.close);
                      const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
                      const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
                      const dailyVolatility = (Math.sqrt(variance) / mean) * 100;
                      if (dailyVolatility > 2.5) return "High Risk";
                      if (dailyVolatility > 1.2) return "Moderate";
                      return "Low Risk";
                    })()}
                  </span>
                </div>
              </div>

              {/* Trading day events list */}
              <div className="bg-[#080808] border border-white/10 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Security Metadata</span>
                  <p className="text-xs font-semibold text-neutral-200 mt-1">
                    {SUPPORTED_TICKERS.find((t) => t.symbol === ticker)?.name || `${ticker} (NSE/BSE Custom Stock)`}
                  </p>
                </div>
                <div className="text-[10px] text-neutral-400 border-t border-white/5 pt-3 mt-4 flex justify-between items-center">
                  <span>Sector classification:</span>
                  <span className="font-semibold text-indigo-400">
                    {SUPPORTED_TICKERS.find((t) => t.symbol === ticker)?.sector || "Indian Capital Markets"}
                  </span>
                </div>
              </div>
            </section>

            {/* In-app navigation tabs */}
            <div className="flex border border-white/10 bg-[#080808] p-2 rounded-xl">
              <nav className="flex flex-wrap gap-1.5 w-full">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === "dashboard"
                      ? "bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 shadow-sm"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <BarChart2 size={14} />
                  Historical Indicators
                </button>
                <button
                  onClick={() => setActiveTab("models")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === "models"
                      ? "bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 shadow-sm"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <TrendingUp size={14} />
                  Forecasting Models
                </button>
                <button
                  onClick={() => setActiveTab("tuning")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === "tuning"
                      ? "bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 shadow-sm"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Cpu size={14} />
                  Parameter Tuning
                </button>
                <button
                  onClick={() => setActiveTab("backtest")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === "backtest"
                      ? "bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 shadow-sm"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Layers size={14} />
                  Strategy Backtesting
                </button>
                <button
                  onClick={() => setActiveTab("ai")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === "ai"
                      ? "bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 shadow-sm"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Sparkles size={14} />
                  AI Advisor
                </button>
              </nav>
            </div>

            {/* Display active tab views */}
            <div className="transition-all duration-300">
              {activeTab === "dashboard" && <IndicatorCharts data={data} ticker={ticker} />}

              {activeTab === "models" && (
                <ModelSelector
                  data={data}
                  hyperparams={hyperparams}
                  setHyperparams={setHyperparams}
                  horizon={horizon}
                  setHorizon={setHorizon}
                  onForecastComputed={handleForecastComputed}
                  activeModel={activeModel}
                  setActiveModel={setActiveModel}
                />
              )}

              {activeTab === "tuning" && (
                <TuningSuite
                  data={data}
                  hyperparams={hyperparams}
                  setHyperparams={setHyperparams}
                  activeModel={activeModel}
                />
              )}

              {activeTab === "backtest" && (
                <BacktestSuite data={data} hyperparams={hyperparams} activeModel={activeModel} />
              )}

              {activeTab === "ai" && (
                <AIAdvisor
                  data={data}
                  ticker={ticker}
                  activeModel={activeModel}
                  predictions={forecastPoints}
                  metrics={metrics}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modern footer */}
      <footer className="bg-[#080808] border-t border-white/10 py-5 text-center text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>STOCHASTIC TREND PREDICTION LAB</span>
          <span className="flex items-center gap-1 text-neutral-400">
            <Coins size={12} className="text-neutral-500" />
            VIRTUAL TRANSACTION ENGINE ACTIVE
          </span>
        </div>
      </footer>
    </div>
  );
}
