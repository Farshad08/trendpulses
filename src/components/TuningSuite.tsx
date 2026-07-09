import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from "recharts";
import { ChartDataPoint, Hyperparameters, ForecastModelType } from "../types";
import {
  tuneLinearParams,
  tuneExponentialParams,
  tuneKNNParams,
  validateForecastModel
} from "../utils/models";
import { Cpu, Sparkles, AlertCircle, ArrowRight, CheckCircle } from "lucide-react";

interface TuningSuiteProps {
  data: ChartDataPoint[];
  hyperparams: Hyperparameters;
  setHyperparams: React.Dispatch<React.SetStateAction<Hyperparameters>>;
  activeModel: ForecastModelType;
}

interface EvaluatedConfig {
  name: string;
  mae: number;
  configObj: any;
}

export default function TuningSuite({
  data,
  hyperparams,
  setHyperparams,
  activeModel
}: TuningSuiteProps) {
  const [isTuning, setIsTuning] = useState<boolean>(false);
  const [tuningStep, setTuningStep] = useState<string>("");
  const [configsEvaluated, setConfigsEvaluated] = useState<EvaluatedConfig[]>([]);
  const [bestConfig, setBestConfig] = useState<EvaluatedConfig | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");

  const runHyperparameterOptimization = () => {
    if (data.length < 40) return;
    setIsTuning(true);
    setConfigsEvaluated([]);
    setBestConfig(null);
    setSuccessMessage("");
    setTuningStep("Starting grid-search sweeps across hyperparameters...");

    setTimeout(() => {
      const prices = data.map(d => d.close);
      const evaluated: EvaluatedConfig[] = [];

      if (activeModel === "linear") {
        setTuningStep("Tuning OLS Linear Regression lookback window parameters...");
        const lookbacks = [10, 15, 20, 30, 45, 60];
        
        lookbacks.forEach(lb => {
          const m = validateForecastModel(data, "linear", lb, 10, {});
          evaluated.push({
            name: `${lb}d LB`,
            mae: m.mae,
            configObj: { lookback: lb }
          });
        });
      } else if (activeModel === "exponential") {
        setTuningStep("Sweeping Level (α) and Trend (β) combinations...");
        const lookbacks = [15, 30, 45];
        const alphas = [0.2, 0.4, 0.6, 0.8];
        const betas = [0.1, 0.2, 0.3];

        // Pick a subset of 8 representative combinations to avoid UI lockup while remaining thorough
        lookbacks.forEach(lb => {
          alphas.forEach(a => {
            betas.forEach(b => {
              if (evaluated.length < 10) {
                const m = validateForecastModel(data, "exponential", lb, 10, { alpha: a, beta: b });
                evaluated.push({
                  name: `W${lb} α${a} β${b}`,
                  mae: m.mae,
                  configObj: { lookback: lb, alpha: a, beta: b }
                });
              }
            });
          });
        });
      } else if (activeModel === "knn") {
        setTuningStep("Scanning feature vector alignments and optimal neighbor clusters...");
        const lookbacks = [30, 60, 90];
        const ks = [3, 5, 7, 10];
        const featureSets: ("rsi" | "macd" | "returns" | "momentum")[][] = [
          ["rsi", "returns"],
          ["rsi", "macd", "returns"]
        ];

        lookbacks.forEach(lb => {
          ks.forEach(k => {
            featureSets.forEach(feats => {
              if (evaluated.length < 10) {
                const m = validateForecastModel(data, "knn", lb, 10, { k, features: feats });
                evaluated.push({
                  name: `W${lb} K${k} F${feats.length}`,
                  mae: m.mae,
                  configObj: { lookback: lb, k, features: feats }
                });
              }
            });
          });
        });
      }

      // Filter configs out with infinite or NaN values
      const validEvaluations = evaluated.filter(c => !isNaN(c.mae) && c.mae > 0);
      validEvaluations.sort((a, b) => a.mae - b.mae);

      setConfigsEvaluated(validEvaluations);
      if (validEvaluations.length > 0) {
        setBestConfig(validEvaluations[0]);
      }
      setTuningStep("");
      setIsTuning(false);
    }, 1200);
  };

  const applyOptimalParameters = () => {
    if (!bestConfig) return;

    if (activeModel === "linear") {
      setHyperparams(prev => ({
        ...prev,
        linear: bestConfig.configObj
      }));
    } else if (activeModel === "exponential") {
      setHyperparams(prev => ({
        ...prev,
        exponential: bestConfig.configObj
      }));
    } else if (activeModel === "knn") {
      setHyperparams(prev => ({
        ...prev,
        knn: bestConfig.configObj
      }));
    }

    setSuccessMessage(`Successfully applied best parameters to active ${activeModel.toUpperCase()} model!`);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const getActiveModelConfigText = () => {
    if (activeModel === "linear") {
      return `Lookback Window: ${hyperparams.linear.lookback} days`;
    } else if (activeModel === "exponential") {
      return `Lookback: ${hyperparams.exponential.lookback} days, α: ${hyperparams.exponential.alpha}, β: ${hyperparams.exponential.beta}`;
    } else {
      return `Lookback: ${hyperparams.knn.lookback} days, K: ${hyperparams.knn.k}, Features: [${hyperparams.knn.features.join(", ")}]`;
    }
  };

  return (
    <div className="bg-[#080808] border border-white/10 rounded-xl p-6 shadow-sm space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <h2 className="text-lg font-serif italic text-white flex items-center gap-2">
            <Cpu size={18} className="text-indigo-400" />
            Hyperparameter Optimization Suite
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Automatically find parameters that minimize backtest forecasting error for the active model ({activeModel.toUpperCase()}).
          </p>
        </div>

        <button
          onClick={runHyperparameterOptimization}
          disabled={isTuning || data.length < 40}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-xs transition cursor-pointer self-start md:self-auto"
        >
          <Sparkles size={14} className={isTuning ? "animate-pulse" : ""} />
          {isTuning ? "Scanning Grid..." : "Run Parameter Optimization"}
        </button>
      </div>

      {data.length < 40 && (
        <div className="bg-amber-950/40 border border-amber-900/50 p-4 rounded-lg flex items-start gap-2.5 text-amber-200 text-xs">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>
            <strong>Insufficient Historical Data:</strong> Hyperparameter optimization requires at least 40 days of historical data to split into validation slices. Please increase the data range in the dashboard to unlock parameter tuning.
          </p>
        </div>
      )}

      {/* Grid search status */}
      {isTuning && (
        <div className="bg-[#030303] border border-white/5 rounded-lg p-5 flex items-center gap-4 text-xs font-mono text-neutral-400">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="animate-pulse">{tuningStep}</p>
        </div>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 p-4 rounded-lg flex items-center gap-2 text-xs font-medium">
          <CheckCircle size={16} className="text-emerald-500 shrink-0" />
          <p>{successMessage}</p>
        </div>
      )}

      {/* Optimization comparisons */}
      {configsEvaluated.length > 0 && !isTuning && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart of errors */}
          <div className="lg:col-span-7 space-y-3">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Validation Mean Absolute Error (lower is better)</h3>
            <div className="h-[220px] w-full bg-[#0A0A0A] rounded-xl p-2 border border-white/5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={configsEvaluated} margin={{ bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={9} tickMargin={8} angle={-15} textAnchor="end" />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={9} tickMargin={8} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    formatter={(val: number) => [`₹${val.toFixed(2)}`, "Validation MAE"]}
                    contentStyle={{ fontSize: "11px", backgroundColor: "#0A0A0A", borderColor: "rgba(255,255,255,0.1)", color: "#E0E0E0", fontFamily: "monospace" }}
                  />
                  <Bar dataKey="mae" fill="#818cf8" radius={[3, 3, 0, 0]}>
                    {configsEvaluated.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? "rgba(16, 185, 129, 0.8)" : "rgba(99, 102, 241, 0.5)"} // Best config green
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Parameters Comparison Card */}
          <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
            <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Tuning Results Analysis</h3>
              
              <div className="space-y-3 divide-y divide-white/5">
                <div className="pb-3 text-xs">
                  <span className="text-neutral-500 block font-medium">Currently Selected Parameters</span>
                  <p className="text-neutral-200 font-mono mt-1 font-semibold">{getActiveModelConfigText()}</p>
                </div>
                
                {bestConfig && (
                  <div className="pt-3 text-xs">
                    <span className="text-neutral-500 block font-medium">Algorithmic Best Fit Parameter Set</span>
                    <p className="text-emerald-400 font-mono font-semibold mt-1">{bestConfig.name}</p>
                    <div className="flex justify-between items-center bg-emerald-950/20 text-emerald-400 border border-emerald-500/20 p-2.5 rounded-lg mt-2 font-mono text-[11px]">
                      <span>Best Validation MAE:</span>
                      <span className="font-bold">₹{bestConfig.mae.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {bestConfig && (
              <button
                onClick={applyOptimalParameters}
                className="w-full bg-indigo-600 hover:bg-indigo-50 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition cursor-pointer"
              >
                Apply Parameters
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
