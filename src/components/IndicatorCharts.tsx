import React, { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea
} from "recharts";
import { ChartDataPoint } from "../types";
import { TrendingUp, Eye, Activity, BarChart2 } from "lucide-react";

interface IndicatorChartsProps {
  data: ChartDataPoint[];
  ticker: string;
}

export default function IndicatorCharts({ data, ticker }: IndicatorChartsProps) {
  const [activeChart, setActiveChart] = useState<"price" | "rsi" | "macd" | "volume">("price");
  const [showBB, setShowBB] = useState<boolean>(true);
  const [showEMA, setShowEMA] = useState<boolean>(true);
  const [showSMA, setShowSMA] = useState<boolean>(false);

  // Custom tooltips
  const PriceTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload as ChartDataPoint;
      const isUp = point.close >= point.open;
      return (
        <div className="bg-[#0A0A0A] border border-white/10 text-neutral-200 p-3 rounded-lg shadow-xl text-xs space-y-1.5 font-mono">
          <p className="font-semibold text-neutral-400 border-b border-white/5 pb-1 mb-1">{point.date}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <span>Open:</span> <span className="text-right text-neutral-300">₹{point.open.toFixed(2)}</span>
            <span>Close:</span> <span className={`text-right font-medium ${isUp ? "text-emerald-400" : "text-rose-400"}`}>₹{point.close.toFixed(2)}</span>
            <span>High:</span> <span className="text-right text-neutral-300">₹{point.high.toFixed(2)}</span>
            <span>Low:</span> <span className="text-right text-neutral-300">₹{point.low.toFixed(2)}</span>
            <span>Volume:</span> <span className="text-right text-neutral-400">{point.volume.toLocaleString()}</span>
          </div>
          {point.event && (
            <p className="mt-1.5 pt-1.5 border-t border-white/5 text-amber-400 italic">
              📢 {point.event}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const RSITooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint;
      const rsi = data.rsi;
      let state = "Neutral";
      let color = "text-neutral-400";
      if (rsi !== undefined) {
        if (rsi >= 70) {
          state = "Overbought (Bearish Risk)";
          color = "text-rose-400 font-semibold";
        } else if (rsi <= 30) {
          state = "Oversold (Bullish Opportunity)";
          color = "text-emerald-400 font-semibold";
        }
      }
      return (
        <div className="bg-[#0A0A0A] border border-white/10 text-neutral-200 p-2.5 rounded-lg shadow-xl text-xs font-mono">
          <p className="font-semibold text-neutral-400">{data.date}</p>
          <p className="mt-1">
            RSI (14): <span className="text-indigo-400 font-semibold">{rsi !== undefined ? rsi.toFixed(2) : "N/A"}</span>
          </p>
          <p className={`text-[10px] mt-0.5 ${color}`}>Status: {state}</p>
        </div>
      );
    }
    return null;
  };

  const MACDTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint;
      return (
        <div className="bg-[#0A0A0A] border border-white/10 text-neutral-200 p-2.5 rounded-lg shadow-xl text-xs font-mono">
          <p className="font-semibold text-neutral-400">{data.date}</p>
          <div className="space-y-0.5 mt-1">
            <p>MACD: <span className="text-sky-400">{data.macdLine !== undefined ? data.macdLine.toFixed(4) : "N/A"}</span></p>
            <p>Signal: <span className="text-amber-400">{data.macdSignal !== undefined ? data.macdSignal.toFixed(4) : "N/A"}</span></p>
            <p>Histogram: <span className={(data.macdHist || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {data.macdHist !== undefined ? data.macdHist.toFixed(4) : "N/A"}
            </span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  const formattedVolumeData = data.map(d => ({
    ...d,
    fillColor: d.close >= d.open ? "#10b981" : "#f43f5e"
  }));

  return (
    <div className="bg-[#080808] border border-white/10 rounded-xl p-6 shadow-sm">
      {/* Header and Ticker Meta */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#121212] border border-white/10 text-indigo-400 font-mono text-xs font-bold px-2.5 py-1 rounded-md tracking-wider">
              {ticker}
            </span>
            <h2 className="text-lg font-serif italic text-white">Historical Market Indicators</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Analyze pricing trends, volatility ranges, and key oscillators to validate forecasting inputs.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#030303] border border-white/5 p-1 rounded-lg self-start">
          <button
            onClick={() => setActiveChart("price")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeChart === "price"
                ? "bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <TrendingUp size={14} />
            Price Overlay
          </button>
          <button
            onClick={() => setActiveChart("rsi")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeChart === "rsi"
                ? "bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Eye size={14} />
            RSI Oscillator
          </button>
          <button
            onClick={() => setActiveChart("macd")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeChart === "macd"
                ? "bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Activity size={14} />
            MACD Indicators
          </button>
          <button
            onClick={() => setActiveChart("volume")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeChart === "volume"
                ? "bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <BarChart2 size={14} />
            Trade Volume
          </button>
        </div>
      </div>

      {/* Sub-controls specifically for main price overlay */}
      {activeChart === "price" && (
        <div className="flex items-center gap-4 mb-4 text-xs bg-white/[0.02] px-4 py-2.5 rounded-lg border border-white/5">
          <span className="text-neutral-400 font-semibold">Overlays:</span>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-neutral-300 font-medium">
            <input
              type="checkbox"
              checked={showBB}
              onChange={(e) => setShowBB(e.target.checked)}
              className="accent-indigo-500 rounded"
            />
            Bollinger Bands (20,2)
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-neutral-300 font-medium">
            <input
              type="checkbox"
              checked={showEMA}
              onChange={(e) => setShowEMA(e.target.checked)}
              className="accent-indigo-500 rounded"
            />
            EMA (20)
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-neutral-300 font-medium">
            <input
              type="checkbox"
              checked={showSMA}
              onChange={(e) => setShowSMA(e.target.checked)}
              className="accent-indigo-500 rounded"
            />
            SMA Fast/Slow (12/26)
          </label>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="h-[360px] w-full bg-[#0A0A0A] rounded-xl p-2 border border-white/5">
        <ResponsiveContainer width="100%" height="100%">
          {activeChart === "price" ? (
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} tickMargin={8} />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                fontSize={10}
                domain={["auto", "auto"]}
                tickFormatter={(val) => `₹${val}`}
                tickMargin={8}
              />
              <Tooltip content={<PriceTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />

              {/* Bollinger Bands Shading */}
              {showBB && (
                <Line
                  name="BB Upper"
                  type="monotone"
                  dataKey="bbandUpper"
                  stroke="rgba(99, 102, 241, 0.4)"
                  strokeDasharray="4 4"
                  dot={false}
                  strokeWidth={1}
                />
              )}
              {showBB && (
                <Line
                  name="BB Lower"
                  type="monotone"
                  dataKey="bbandLower"
                  stroke="rgba(99, 102, 241, 0.4)"
                  strokeDasharray="4 4"
                  dot={false}
                  strokeWidth={1}
                />
              )}

              {/* Core close price line */}
              <Line
                name="Close Price"
                type="monotone"
                dataKey="close"
                stroke="#ffffff"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />

              {/* Technical Indicator lines */}
              {showEMA && (
                <Line
                  name="EMA (20)"
                  type="monotone"
                  dataKey="ema"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}
              {showSMA && (
                <Line
                  name="SMA Fast (12)"
                  type="monotone"
                  dataKey="smaFast"
                  stroke="#10b981"
                  strokeWidth={1.2}
                  dot={false}
                />
              )}
              {showSMA && (
                <Line
                  name="SMA Slow (26)"
                  type="monotone"
                  dataKey="smaSlow"
                  stroke="#f59e0b"
                  strokeWidth={1.2}
                  dot={false}
                />
              )}
            </ComposedChart>
          ) : activeChart === "rsi" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} tickMargin={8} />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} domain={[0, 100]} tickMargin={8} />
              <Tooltip content={<RSITooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />

              {/* Overbought / Oversold zones */}
              <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "Overbought (70)", position: "insideTopLeft", fill: "#ef4444", fontSize: 9 }} />
              <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" label={{ value: "Oversold (30)", position: "insideBottomLeft", fill: "#10b981", fontSize: 9 }} />
              <ReferenceLine y={50} stroke="rgba(255,255,255,0.15)" strokeDasharray="1 1" />

              <Line
                name="RSI (14)"
                type="monotone"
                dataKey="rsi"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          ) : activeChart === "macd" ? (
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} tickMargin={8} />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} domain={["auto", "auto"]} tickMargin={8} />
              <Tooltip content={<MACDTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />

              <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />

              <Bar name="Histogram" dataKey="macdHist" fill="#94a3b8" radius={[2, 2, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={(entry.macdHist || 0) >= 0 ? "rgba(16, 185, 129, 0.8)" : "rgba(244, 63, 94, 0.8)"}
                  />
                ))}
              </Bar>

              <Line
                name="MACD Line"
                type="monotone"
                dataKey="macdLine"
                stroke="#38bdf8"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                name="Signal Line"
                type="monotone"
                dataKey="macdSignal"
                stroke="#fbbf24"
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          ) : (
            <BarChart data={formattedVolumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} tickMargin={8} />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                fontSize={10}
                tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                tickMargin={8}
              />
              <Tooltip
                formatter={(val: number) => [val.toLocaleString(), "Volume"]}
                contentStyle={{ fontSize: "11px", backgroundColor: "#0A0A0A", borderColor: "rgba(255,255,255,0.1)", color: "#E0E0E0", fontFamily: "monospace" }}
              />
              <Bar name="Volume" dataKey="volume">
                {formattedVolumeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fillColor === "#10b981" ? "rgba(16, 185, 129, 0.8)" : "rgba(244, 63, 94, 0.8)"} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Summary indicators info box */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="bg-[#0A0A0A] border border-white/5 p-3.5 rounded-lg">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold">Trend Momentum</p>
          <p className="text-sm font-bold text-white mt-1">
            {(() => {
              const last = data[data.length - 1];
              if (!last || last.smaFast === undefined || last.smaSlow === undefined) return "Calculating...";
              return last.smaFast > last.smaSlow ? "Bullish (SMA 12 > 26)" : "Bearish (SMA 12 < 26)";
            })()}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Determined by Moving Average Crossover.</p>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 p-3.5 rounded-lg">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold">RSI Conditions</p>
          <p className="text-sm font-bold text-white mt-1">
            {(() => {
              const last = data[data.length - 1];
              if (!last || last.rsi === undefined) return "Calculating...";
              if (last.rsi >= 70) return `Overbought (${last.rsi.toFixed(1)})`;
              if (last.rsi <= 30) return `Oversold (${last.rsi.toFixed(1)})`;
              return `Neutral (${last.rsi.toFixed(1)})`;
            })()}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Indicates over-extended price pressure.</p>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 p-3.5 rounded-lg">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold">Volatilty Width</p>
          <p className="text-sm font-bold text-white mt-1">
            {(() => {
              const last = data[data.length - 1];
              if (!last || last.bbandUpper === undefined || last.bbandLower === undefined) return "Calculating...";
              const spread = ((last.bbandUpper - last.bbandLower) / last.close) * 100;
              return `${spread.toFixed(2)}% Spread`;
            })()}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">Bollinger Band width as % of price.</p>
        </div>
      </div>
    </div>
  );
}

// Extra subcomponent needed by Recharts Composed/Bar Charts
import { Cell } from "recharts";
