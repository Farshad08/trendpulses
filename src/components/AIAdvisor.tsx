import React, { useState } from "react";
import { ChartDataPoint, ForecastModelType, PredictionPoint, EvaluationMetrics } from "../types";
import { MessageSquare, Sparkles, Copy, Check, FileText, AlertTriangle, ShieldCheck } from "lucide-react";

interface AIAdvisorProps {
  data: ChartDataPoint[];
  ticker: string;
  activeModel: ForecastModelType;
  predictions: PredictionPoint[];
  metrics: EvaluationMetrics | null;
}

export default function AIAdvisor({
  data,
  ticker,
  activeModel,
  predictions,
  metrics
}: AIAdvisorProps) {
  const [report, setReport] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleGenerateAdvisorReport = async () => {
    if (data.length < 30 || predictions.length === 0) return;

    setIsLoading(true);
    setError("");
    setReport("");

    // Calculate statistical summaries of the last 30 days
    const recentSlice = data.slice(-30);
    const recentPrices = recentSlice.map((d) => d.close);
    const avgVolume = recentSlice.reduce((sum, d) => sum + d.volume, 0) / recentSlice.length;
    const maxPrice = Math.max(...recentPrices);
    const minPrice = Math.min(...recentPrices);
    const overallReturn = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;

    const dataSummary = {
      periodDays: 30,
      minPrice: parseFloat(minPrice.toFixed(2)),
      maxPrice: parseFloat(maxPrice.toFixed(2)),
      lastPrice: parseFloat(recentPrices[recentPrices.length - 1].toFixed(2)),
      averageVolume: Math.floor(avgVolume),
      overallReturnPercent: parseFloat(overallReturn.toFixed(2))
    };

    // Extract recent technical signals
    const lastBar = data[data.length - 1];
    const technicalSignals = {
      rsi: lastBar.rsi !== undefined ? parseFloat(lastBar.rsi.toFixed(2)) : undefined,
      macdLine: lastBar.macdLine !== undefined ? parseFloat(lastBar.macdLine.toFixed(4)) : undefined,
      macdSignal: lastBar.macdSignal !== undefined ? parseFloat(lastBar.macdSignal.toFixed(4)) : undefined,
      macdHist: lastBar.macdHist !== undefined ? parseFloat(lastBar.macdHist.toFixed(4)) : undefined,
      bbUpper: lastBar.bbandUpper !== undefined ? parseFloat(lastBar.bbandUpper.toFixed(2)) : undefined,
      bbMiddle: lastBar.bbandMiddle !== undefined ? parseFloat(lastBar.bbandMiddle.toFixed(2)) : undefined,
      bbLower: lastBar.bbandLower !== undefined ? parseFloat(lastBar.bbandLower.toFixed(2)) : undefined
    };

    const predictionSummary = {
      activeModel,
      horizon: predictions.length,
      predictedEndPrice: predictions[predictions.length - 1]?.price,
      directionAccuracyPercent: metrics?.directionAcc,
      mae: metrics?.mae,
      rmse: metrics?.rmse
    };

    try {
      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ticker,
          dataSummary,
          technicalSignals,
          predictionSummary
        })
      });

      if (!response.ok) {
        throw new Error("Failed to communicate with Gemini Advisory backend");
      }

      const resData = await response.json();
      setReport(resData.report || "No analysis generated.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while generating the report.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Safe and clean custom Markdown renderer to avoid Peer-Dependency complications
  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();

      // Check for headers (e.g. ### Header or 1. ### Header)
      if (trimmed.startsWith("###") || trimmed.includes("###")) {
        const headerText = trimmed.replace(/^(?:\d+\.\s*)?###\s*/, "");
        return (
          <h3 key={idx} className="text-sm font-serif italic text-indigo-400 mt-6 mb-2 border-l-4 border-indigo-500 pl-2 uppercase tracking-wide">
            {headerText}
          </h3>
        );
      }

      // Check for bullet points
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const bulletText = trimmed.substring(2);
        return (
          <li key={idx} className="text-xs text-neutral-300 ml-4 list-disc pl-1 py-1 leading-relaxed">
            {parseBoldText(bulletText)}
          </li>
        );
      }

      // Check for regular text
      if (trimmed === "") {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-xs text-neutral-300 leading-relaxed mb-2">
          {parseBoldText(trimmed)}
        </p>
      );
    });
  };

  // Helper to parse **bold** words
  const parseBoldText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-semibold text-white">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="bg-[#080808] border border-white/10 rounded-xl p-6 shadow-sm space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <h2 className="text-lg font-serif italic text-white flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400" />
            AI Quantitative Market Advisor
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Generate an executive-level strategic report consolidating indicators, trend math, and statistical error coefficients.
          </p>
        </div>

        <button
          onClick={handleGenerateAdvisorReport}
          disabled={isLoading || data.length < 30 || predictions.length === 0}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 text-white font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 text-xs transition cursor-pointer self-start md:self-auto"
        >
          <MessageSquare size={14} className={isLoading ? "animate-bounce" : ""} />
          {isLoading ? "Synthesizing Report..." : "Generate AI Strategic Report"}
        </button>
      </div>

      {error && (
        <div className="bg-rose-950/20 border border-rose-500/30 text-rose-300 p-4 rounded-lg flex items-center gap-2 text-xs">
          <AlertTriangle size={16} className="text-rose-500 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Main Report area */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-white/5"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-neutral-200">Synthesizing market metrics via Gemini 3.5-flash...</p>
            <p className="text-[10px] text-neutral-400">Comparing SMA/EMA crossovers, Bollinger bands margins, and projection residuals.</p>
          </div>
        </div>
      ) : report ? (
        <div className="space-y-4">
          {/* Controls to Copy / Print */}
          <div className="flex items-center justify-between bg-[#0A0A0A] px-4 py-2 rounded-lg border border-white/5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <FileText size={12} />
              Securities Report: {ticker}
            </span>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-white/10 hover:bg-white/5 rounded text-xs text-neutral-300 transition cursor-pointer font-medium"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy Report
                </>
              )}
            </button>
          </div>

          {/* AI Advisor Rendered Output */}
          <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-6 shadow-inner font-sans prose prose-invert max-h-[420px] overflow-y-auto scrollbar-thin">
            {renderMarkdown(report)}
          </div>

          <div className="bg-indigo-950/10 border border-indigo-500/20 p-3.5 rounded-lg flex items-start gap-2 text-[10px] text-indigo-300 leading-relaxed">
            <ShieldCheck size={14} className="shrink-0 mt-0.5 text-indigo-500" />
            <p>
              <strong>Generative Disclosure:</strong> This report is synthesized using historical mathematical signals and predictive machine learning approximations. It is designed to evaluate statistical trend probabilities and does not constitute formal financial advice.
            </p>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center bg-[#0A0A0A] border border-dashed border-white/10 rounded-xl space-y-3">
          <Sparkles size={24} className="mx-auto text-neutral-600" />
          <div className="max-w-md mx-auto space-y-1">
            <p className="text-xs font-semibold text-neutral-300 font-serif italic">Advisory Report Standby</p>
            <p className="text-[11px] text-neutral-400">
              Click the button above to compile historical pricing bounds, technical indices, and predictive error metrics for a customized AI-guided market strategy report.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
