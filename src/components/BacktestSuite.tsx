import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { ChartDataPoint, Hyperparameters, ForecastModelType, Trade, BacktestHistoryPoint } from "../types";
import {
  trainLinearRegression,
  trainExponentialSmoothing,
  trainKNNRegression
} from "../utils/models";
import { ShieldCheck, Award, ArrowUpRight, ArrowDownRight, RefreshCw, Layers } from "lucide-react";

interface BacktestSuiteProps {
  data: ChartDataPoint[];
  hyperparams: Hyperparameters;
  activeModel: ForecastModelType;
}

export default function BacktestSuite({ data, hyperparams, activeModel }: BacktestSuiteProps) {
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [backtestHistory, setBacktestHistory] = useState<BacktestHistoryPoint[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategyReturn, setStrategyReturn] = useState<number>(0);
  const [buyHoldReturn, setBuyHoldReturn] = useState<number>(0);
  const [sharpeRatio, setSharpeRatio] = useState<number>(0);
  const [maxDrawdown, setMaxDrawdown] = useState<number>(0);
  const [winRate, setWinRate] = useState<number>(0);

  const runBacktestSimulation = () => {
    if (data.length < 50) return;
    setIsSimulating(true);

    setTimeout(() => {
      // Define backtest duration: last 30 days
      const backtestSize = 30;
      const startIndex = data.length - backtestSize;
      
      let cash = 10000; // Start with $10,000 cash
      let shares = 0;
      let activePosition: "none" | "long" = "none";

      // Buy & hold tracker
      const buyHoldStartPrice = data[startIndex].close;
      const initialBuyHoldShares = 10000 / buyHoldStartPrice;

      const history: BacktestHistoryPoint[] = [];
      const tradeList: Trade[] = [];

      // Daily walk-forward simulation
      for (let i = startIndex; i < data.length; i++) {
        const currentDate = data[i].date;
        const currentPrice = data[i].close;

        // Create historical slice leading up to day i (not including day i itself for prediction, to prevent leakage!)
        const historicalSlice = data.slice(0, i);
        const pricesSlice = historicalSlice.map(d => d.close);

        // 1. Generate prediction for tomorrow (1 step horizon)
        let predictedPrice = currentPrice;
        if (activeModel === "linear") {
          const preds = trainLinearRegression(pricesSlice, hyperparams.linear.lookback, 1);
          predictedPrice = preds[0] || currentPrice;
        } else if (activeModel === "exponential") {
          const preds = trainExponentialSmoothing(
            pricesSlice,
            hyperparams.exponential.lookback,
            1,
            hyperparams.exponential.alpha,
            hyperparams.exponential.beta
          );
          predictedPrice = preds[0] || currentPrice;
        } else if (activeModel === "knn") {
          const preds = trainKNNRegression(
            historicalSlice,
            hyperparams.knn.lookback,
            1,
            hyperparams.knn.k,
            hyperparams.knn.features
          );
          predictedPrice = preds[0] || currentPrice;
        }

        // 2. Formulate Trade Signals
        const signalUp = predictedPrice > currentPrice;

        // 3. Execute decisions at start of day / close of day
        if (signalUp && activePosition === "none") {
          // BUY Signal
          shares = cash / currentPrice;
          cash = 0;
          activePosition = "long";
          tradeList.push({
            type: "BUY",
            date: currentDate,
            price: currentPrice,
            shares: parseFloat(shares.toFixed(4)),
            cash: 0,
            portfolioValue: 10000 // Just metadata, will calculate below
          });
        } else if (!signalUp && activePosition === "long") {
          // SELL Signal (Liquidate to cash)
          cash = shares * currentPrice;
          const soldShares = shares;
          shares = 0;
          activePosition = "none";
          
          // Calculate win status of trade
          const lastBuy = [...tradeList].reverse().find(t => t.type === "BUY");
          const profit = lastBuy ? (currentPrice - lastBuy.price) : 0;

          tradeList.push({
            type: "SELL",
            date: currentDate,
            price: currentPrice,
            shares: parseFloat(soldShares.toFixed(4)),
            cash: parseFloat(cash.toFixed(2)),
            portfolioValue: parseFloat(cash.toFixed(2))
          });
        }

        // Calculate portfolio values for today
        const strategyValue = cash + shares * currentPrice;
        const buyHoldValue = initialBuyHoldShares * currentPrice;

        // Update trade list portfolio metadata
        if (tradeList.length > 0 && tradeList[tradeList.length - 1].date === currentDate) {
          tradeList[tradeList.length - 1].portfolioValue = parseFloat(strategyValue.toFixed(2));
        }

        history.push({
          date: currentDate,
          strategyValue: parseFloat(strategyValue.toFixed(2)),
          buyHoldValue: parseFloat(buyHoldValue.toFixed(2)),
          price: currentPrice
        });
      }

      // 4. Calculate Backtest Metrics
      const finalStrategyVal = history[history.length - 1]?.strategyValue || 10000;
      const finalBuyHoldVal = history[history.length - 1]?.buyHoldValue || 10000;

      const stratReturn = ((finalStrategyVal - 10000) / 10000) * 100;
      const bhReturn = ((finalBuyHoldVal - 10000) / 10000) * 100;

      // Calculate Sharpe Ratio (simplified daily standard deviation annualized)
      const dailyReturns: number[] = [];
      for (let j = 1; j < history.length; j++) {
        const prev = history[j - 1].strategyValue;
        const curr = history[j].strategyValue;
        dailyReturns.push((curr - prev) / prev);
      }
      const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / dailyReturns.length;
      const stdDev = Math.sqrt(variance) || 0.001;
      const annualizedSharpe = meanReturn !== 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

      // Calculate Max Drawdown
      let peak = -Infinity;
      let maxDD = 0;
      history.forEach(pt => {
        if (pt.strategyValue > peak) peak = pt.strategyValue;
        const dd = ((peak - pt.strategyValue) / peak) * 100;
        if (dd > maxDD) maxDD = dd;
      });

      // Calculate Win Rate on completed round-trip trades
      let completedTradesCount = 0;
      let profitableTradesCount = 0;
      for (let j = 0; j < tradeList.length; j++) {
        if (tradeList[j].type === "SELL") {
          completedTradesCount++;
          // Find matching buy preceding this sell
          const prevBuys = tradeList.slice(0, j).filter(t => t.type === "BUY");
          const matchingBuy = prevBuys[prevBuys.length - 1];
          if (matchingBuy && tradeList[j].price > matchingBuy.price) {
            profitableTradesCount++;
          }
        }
      }

      const winR = completedTradesCount > 0 ? (profitableTradesCount / completedTradesCount) * 100 : 100;

      // Update States
      setBacktestHistory(history);
      setTrades(tradeList);
      setStrategyReturn(parseFloat(stratReturn.toFixed(2)));
      setBuyHoldReturn(parseFloat(bhReturn.toFixed(2)));
      setSharpeRatio(parseFloat(Math.max(-5, Math.min(10, annualizedSharpe)).toFixed(2)));
      setMaxDrawdown(parseFloat(maxDD.toFixed(2)));
      setWinRate(parseFloat(winR.toFixed(1)));
      setIsSimulating(false);
    }, 1000);
  };

  // Initialize backtest on tab mount
  useEffect(() => {
    if (data.length >= 50) {
      runBacktestSimulation();
    }
  }, [activeModel, data]);

  const CustomBacktestTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload as BacktestHistoryPoint;
      return (
        <div className="bg-[#0A0A0A] border border-white/10 text-neutral-200 p-2.5 rounded-lg shadow-xl text-xs font-mono">
          <p className="font-bold border-b border-white/5 pb-1 mb-1">{p.date}</p>
          <p>Strategy Portfolio: <span className="text-emerald-400 font-semibold">₹{p.strategyValue.toLocaleString()}</span></p>
          <p>Buy & Hold Value: <span className="text-amber-400">₹{p.buyHoldValue.toLocaleString()}</span></p>
          <p className="text-[10px] text-neutral-400 mt-1">Asset Price: ₹{p.price.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#080808] border border-white/10 rounded-xl p-6 shadow-sm space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <h2 className="text-lg font-serif italic text-white flex items-center gap-2">
            <Layers size={18} className="text-indigo-400" />
            Historical Backtesting Simulator
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Evaluate a standard long-only trading strategy guided by forecasting signals over the last 30 trading days.
          </p>
        </div>

        <button
          onClick={runBacktestSimulation}
          disabled={isSimulating || data.length < 50}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 text-white font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 text-xs transition cursor-pointer self-start md:self-auto"
        >
          <RefreshCw size={14} className={isSimulating ? "animate-spin" : ""} />
          {isSimulating ? "Backtesting Strategy..." : "Re-Run Backtest Strategy"}
        </button>
      </div>

      {data.length < 50 && (
        <div className="bg-amber-950/40 border border-amber-900/50 p-4 rounded-lg text-amber-200 text-xs">
          <strong>Backtest Unavailable:</strong> Interactive backtesting requires at least 50 trading days to construct reliable out-of-sample forward slices. Increase your dataset range to proceed.
        </div>
      )}

      {/* Main Backtest metrics */}
      {backtestHistory.length > 0 && !isSimulating && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-[#0A0A0A] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wide font-bold">Strategy Return</span>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-xl font-bold ${strategyReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {strategyReturn >= 0 ? "+" : ""}{strategyReturn}%
                </span>
                {strategyReturn >= 0 ? <ArrowUpRight size={16} className="text-emerald-500" /> : <ArrowDownRight size={16} className="text-rose-500" />}
              </div>
              <span className="text-[9px] text-neutral-400 block mt-1">Starting from ₹10,000.</span>
            </div>

            <div className="bg-[#0A0A0A] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wide font-bold">Buy & Hold Return</span>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-xl font-bold ${buyHoldReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {buyHoldReturn >= 0 ? "+" : ""}{buyHoldReturn}%
                </span>
                {buyHoldReturn >= 0 ? <ArrowUpRight size={16} className="text-emerald-500" /> : <ArrowDownRight size={16} className="text-rose-500" />}
              </div>
              <span className="text-[9px] text-neutral-400 block mt-1">Benchmarked passive returns.</span>
            </div>

            <div className="bg-[#0A0A0A] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wide font-bold">Sharpe Ratio</span>
              <span className="text-xl font-bold text-white mt-1 block">{sharpeRatio}</span>
              <span className="text-[9px] text-neutral-400 block mt-1">Returns adjusted for volatility risk.</span>
            </div>

            <div className="bg-[#0A0A0A] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wide font-bold">Max Drawdown</span>
              <span className="text-xl font-bold text-rose-500 mt-1 block">{maxDrawdown}%</span>
              <span className="text-[9px] text-neutral-400 block mt-1">Largest peak-to-trough decline.</span>
            </div>

            <div className="bg-[#0A0A0A] p-4 rounded-xl border border-white/5 col-span-2 lg:col-span-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wide font-bold">Win Rate</span>
              <span className="text-xl font-bold text-white mt-1 block">{winRate}%</span>
              <span className="text-[9px] text-neutral-400 block mt-1">Percentage of profitable trades.</span>
            </div>
          </div>

          {/* Comparison chart */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award size={14} className="text-indigo-400" />
              Strategy Valuation vs Buy & Hold Benchmark (₹10,000 baseline)
            </h3>
            <div className="h-[240px] w-full bg-[#0A0A0A] rounded-xl p-2 border border-white/5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={backtestHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={9} tickMargin={8} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={9} tickMargin={8} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip content={<CustomBacktestTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />

                  <Line
                    name="Predictive Strategy"
                    type="monotone"
                    dataKey="strategyValue"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    name="Buy & Hold"
                    type="monotone"
                    dataKey="buyHoldValue"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Execution trades list */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Executed Trade History Log</h3>
            <div className="max-h-48 overflow-y-auto border border-white/10 rounded-lg text-xs scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0A0A0A] text-neutral-400 uppercase text-[10px] tracking-wider border-b border-white/10 font-semibold sticky top-0">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4 text-right">Execution Price</th>
                    <th className="py-2.5 px-4 text-right">Shares Handled</th>
                    <th className="py-2.5 px-4 text-right">Total Cash</th>
                    <th className="py-2.5 px-4 text-right">Portfolio Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {trades.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 px-4 text-center text-neutral-500 italic">
                        The strategy remained in cash or hold positions for the entire backtest window (no trades triggered).
                      </td>
                    </tr>
                  ) : (
                    trades.map((t, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.01]">
                        <td className="py-2 px-4 text-neutral-400">{t.date}</td>
                        <td className="py-2 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.type === "BUY"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right text-neutral-200">₹{t.price.toFixed(2)}</td>
                        <td className="py-2 px-4 text-right text-neutral-300">{t.shares}</td>
                        <td className="py-2 px-4 text-right text-neutral-300">₹{t.cash.toLocaleString()}</td>
                        <td className="py-2 px-4 text-right font-semibold text-white">₹{t.portfolioValue.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
