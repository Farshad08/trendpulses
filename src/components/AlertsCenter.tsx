import React, { useState, useEffect } from "react";
import { AlertRule, AlertNotification, ChartDataPoint, AlertConditionType } from "../types";
import { augmentStockData } from "../utils/indicators";
import { trainLinearRegression } from "../utils/models";
import {
  Bell,
  BellOff,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Info,
  ExternalLink,
  Zap,
  Activity
} from "lucide-react";

interface AlertsCenterProps {
  currentTicker: string;
  setTicker: (ticker: string) => void;
  SUPPORTED_TICKERS: Array<{ symbol: string; name: string; sector: string }>;
}

export default function AlertsCenter({
  currentTicker,
  setTicker,
  SUPPORTED_TICKERS
}: AlertsCenterProps) {
  // Persistence state in LocalStorage
  const [rules, setRules] = useState<AlertRule[]>(() => {
    const saved = localStorage.getItem("alert_rules");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse alert rules", e);
      }
    }
    // Default rule to help user start
    return [
      {
        id: "default-1",
        ticker: "RELIANCE",
        condition: "strong_bullish",
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "default-2",
        ticker: "TCS",
        condition: "strong_bearish",
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];
  });

  const [notifications, setNotifications] = useState<AlertNotification[]>(() => {
    const saved = localStorage.getItem("alert_notifications");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse alert notifications", e);
      }
    }
    return [
      {
        id: "notif-1",
        ticker: "RELIANCE",
        title: "Strong Bullish Indicator Spark",
        message: "Technical analysis indicators show a perfect Bullish alignment. SMA crossover is positive, RSI is oversold at 29.8, and MACD line is above the signal line.",
        type: "success",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        read: false,
        priceAtAlert: 2420.5
      }
    ];
  });

  // Controls for creating rules
  const [newRuleTicker, setNewRuleTicker] = useState<string>("RELIANCE");
  const [customTickerInput, setCustomTickerInput] = useState<string>("");
  const [ruleType, setRuleType] = useState<AlertConditionType>("strong_bullish");
  const [thresholdPercent, setThresholdPercent] = useState<number>(5);

  // Status and settings
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState<boolean>(false);
  const [lastScanTime, setLastScanTime] = useState<string>(() => new Date().toLocaleTimeString());

  // Save state helpers
  useEffect(() => {
    localStorage.setItem("alert_rules", JSON.stringify(rules));
  }, [rules]);

  useEffect(() => {
    localStorage.setItem("alert_notifications", JSON.stringify(notifications));
  }, [notifications]);

  // Technical Indicators Inspector States
  const [inspectTicker, setInspectTicker] = useState<string>(currentTicker || "RELIANCE");
  const [inspectResult, setInspectResult] = useState<{
    ticker: string;
    price: number;
    change: number;
    changePercent: number;
    bullishCount: number;
    bearishCount: number;
    signals: {
      name: string;
      value: string;
      status: "bullish" | "bearish" | "neutral";
      description: string;
      criteria: string;
    }[];
  } | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectError, setInspectError] = useState<string>("");

  const runInspection = async (tickerSymbol: string) => {
    setIsInspecting(true);
    setInspectError("");
    try {
      const response = await fetch(`/api/stock-data?ticker=${tickerSymbol}&days=60`);
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Could not fetch market data for ${tickerSymbol}`);
      }
      const json = await response.json();
      const rawBars = json.data || [];
      if (rawBars.length < 20) {
        throw new Error(`Insufficient historical data available for ${tickerSymbol} to calculate technical indicators.`);
      }

      const augmentedData = augmentStockData(rawBars);
      const last = augmentedData[augmentedData.length - 1];
      const prev = augmentedData[augmentedData.length - 2] || last;
      const currentPrice = last.close;
      const change = currentPrice - prev.close;
      const changePercent = (change / prev.close) * 100;

      let bullishCount = 0;
      let bearishCount = 0;

      const signalsList: {
        name: string;
        value: string;
        status: "bullish" | "bearish" | "neutral";
        description: string;
        criteria: string;
      }[] = [];

      // 1. SMA (12 vs 26) Crossover
      if (last.smaFast !== undefined && last.smaSlow !== undefined) {
        const isBull = last.smaFast > last.smaSlow;
        if (isBull) bullishCount++; else bearishCount++;
        signalsList.push({
          name: "SMA Crossover (12 vs 26)",
          value: `Fast SMA: ₹${last.smaFast.toFixed(2)} | Slow SMA: ₹${last.smaSlow.toFixed(2)}`,
          status: isBull ? "bullish" : "bearish",
          criteria: "Fast SMA (12) > Slow SMA (26) is Bullish. Fast SMA <= Slow SMA is Bearish.",
          description: isBull 
            ? "The shorter-term simple moving average is above the longer-term average, indicating short-term upward price momentum (Golden crossover stance)." 
            : "The shorter-term simple moving average has crossed below the longer-term average, showing active downward sell momentum (Death crossover stance)."
        });
      }

      // 2. EMA (20) Trend Filter
      if (last.ema !== undefined) {
        const isBull = currentPrice > last.ema;
        if (isBull) bullishCount++; else bearishCount++;
        signalsList.push({
          name: "EMA Trend Filter (20)",
          value: `Price: ₹${currentPrice.toFixed(2)} | EMA (20): ₹${last.ema.toFixed(2)}`,
          status: isBull ? "bullish" : "bearish",
          criteria: "Close Price > EMA (20) is Bullish. Close Price <= EMA (20) is Bearish.",
          description: isBull
            ? "The asset price is trading above its 20-day Exponential Moving Average, validating a strong short-to-medium term bullish structure."
            : "The asset price is trading below its 20-day Exponential Moving Average, representing a clean bearish trend structure."
        });
      }

      // 3. Relative Strength Index (RSI 14)
      if (last.rsi !== undefined) {
        let status: "bullish" | "bearish" | "neutral" = "neutral";
        let desc = "RSI is in the healthy neutral momentum zone between 30 and 70.";
        if (last.rsi < 30) {
          status = "bullish";
          bullishCount++;
          desc = `RSI at ${last.rsi.toFixed(1)} is extremely low (Oversold < 30). This indicates severe selling pressure that typically triggers a strong bullish correction / technical bounce up.`;
        } else if (last.rsi > 70) {
          status = "bearish";
          bearishCount++;
          desc = `RSI at ${last.rsi.toFixed(1)} is extremely high (Overbought > 70). This indicates overextended buying momentum that typically triggers a bearish cooling-off pullback.`;
        }
        signalsList.push({
          name: "RSI (14)",
          value: `RSI Value: ${last.rsi.toFixed(1)}`,
          status,
          criteria: "RSI < 30 is Bullish (Oversold bounce). RSI > 70 is Bearish (Overbought pullback). 30-70 is Neutral.",
          description: desc
        });
      }

      // 4. MACD (12, 26, 9) Momentum Line
      if (last.macdLine !== undefined && last.macdSignal !== undefined) {
        const isBull = last.macdLine > last.macdSignal;
        if (isBull) bullishCount++; else bearishCount++;
        signalsList.push({
          name: "MACD Line Crossover",
          value: `MACD Line: ${last.macdLine.toFixed(4)} | Signal Line: ${last.macdSignal.toFixed(4)}`,
          status: isBull ? "bullish" : "bearish",
          criteria: "MACD Line > Signal Line is Bullish. MACD Line <= Signal Line is Bearish.",
          description: isBull
            ? "MACD Line is trending above the Signal Line. This indicates active accelerating buying pressure and expanding bullish momentum."
            : "MACD Line has crossed below the Signal Line. This signals accelerating distributions and expanding bearish sell-side momentum."
        });
      }

      setInspectResult({
        ticker: tickerSymbol,
        price: currentPrice,
        change,
        changePercent,
        bullishCount,
        bearishCount,
        signals: signalsList
      });
    } catch (err: any) {
      console.error(err);
      setInspectError(err.message || "Failed to analyze technical indicators.");
    } finally {
      setIsInspecting(false);
    }
  };

  // Run initial inspection for the inspectTicker when loaded or if it changes
  useEffect(() => {
    runInspection(inspectTicker);
  }, [inspectTicker]);

  // Request browser notification permissions on load if enabled previously
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setBrowserNotificationsEnabled(true);
      }
    }
  }, []);

  // Request permission to send browser notifications
  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("This browser does not support desktop notifications.");
      return;
    }

    if (Notification.permission === "granted") {
      setBrowserNotificationsEnabled(true);
      showDesktopNotification("Alert Notifications Enabled", "You will now receive desktop notifications for predictive events!");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setBrowserNotificationsEnabled(true);
      showDesktopNotification("Alert Notifications Enabled", "You will now receive desktop notifications for predictive events!");
    } else {
      setBrowserNotificationsEnabled(false);
    }
  };

  const showDesktopNotification = (title: string, message: string) => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: message,
          icon: "/favicon.ico"
        });
      } catch (e) {
        console.error("Desktop notification failed to render", e);
      }
    }
  };

  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Play a neat double alert chime
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        
        gainNode.gain.setValueAtTime(0.15, start);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
        
        osc.start(start);
        osc.stop(start + duration);
      };
      
      const now = audioCtx.currentTime;
      playTone(523.25, now, 0.15); // C5
      playTone(659.25, now + 0.12, 0.35); // E5
    } catch (e) {
      console.warn("Audio Context audio play blocked/unavailable until user interaction", e);
    }
  };

  // Run the multi-asset alert scan
  const executeScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress("Initializing system indicators...");

    let triggeredCount = 0;
    const newNotificationsList: AlertNotification[] = [];

    // Filter rules that are active
    const activeRules = rules.filter(r => r.isActive);
    if (activeRules.length === 0) {
      setScanProgress("No active alert rules found. Add one below!");
      setIsScanning(false);
      setLastScanTime(new Date().toLocaleTimeString());
      return;
    }

    // De-duplicate tickers so we only fetch once per ticker
    const tickersToScan: string[] = Array.from(new Set(activeRules.map(r => r.ticker.toUpperCase()))) as string[];

    for (let idx = 0; idx < tickersToScan.length; idx++) {
      const tickerSymbol = tickersToScan[idx];
      setScanProgress(`Scanning indicators for ${tickerSymbol}... (${idx + 1}/${tickersToScan.length})`);

      try {
        // Fetch 60 days of historical data for technical indicators (Fast lookups)
        const response = await fetch(`/api/stock-data?ticker=${tickerSymbol}&days=60`);
        if (!response.ok) {
          console.warn(`Could not scan ticker ${tickerSymbol}: server returned non-ok.`);
          continue;
        }

        const json = await response.json();
        const rawBars = json.data || [];
        if (rawBars.length < 20) continue;

        // Compute technical indicators
        const augmentedData: ChartDataPoint[] = augmentStockData(rawBars);
        const lastBar = augmentedData[augmentedData.length - 1];
        const currentPrice = lastBar.close;

        // Calculate Sentiment Scores
        let bullishSignals = 0;
        let bearishSignals = 0;

        // 1. SMA check
        if (lastBar.smaFast !== undefined && lastBar.smaSlow !== undefined) {
          if (lastBar.smaFast > lastBar.smaSlow) bullishSignals++;
          else bearishSignals++;
        }
        // 2. EMA check
        if (lastBar.ema !== undefined) {
          if (lastBar.close > lastBar.ema) bullishSignals++;
          else bearishSignals++;
        }
        // 3. RSI check
        if (lastBar.rsi !== undefined) {
          if (lastBar.rsi < 35) bullishSignals++;
          else if (lastBar.rsi > 65) bearishSignals++;
        }
        // 4. MACD check
        if (lastBar.macdLine !== undefined && lastBar.macdSignal !== undefined) {
          if (lastBar.macdLine > lastBar.macdSignal) bullishSignals++;
          else bearishSignals++;
        }

        // Generate forecasts for breakout rule evaluations
        const closePrices = augmentedData.map(d => d.close);
        const forecastHorizon = 10;
        const forecastedLinear = trainLinearRegression(closePrices, 20, forecastHorizon);
        const predictedFinal = forecastedLinear[forecastHorizon - 1] || currentPrice;
        const forecastedPct = ((predictedFinal - currentPrice) / currentPrice) * 100;

        // Check rules targeting this ticker
        const tickerRules = activeRules.filter(r => r.ticker.toUpperCase() === tickerSymbol);

        for (const rule of tickerRules) {
          let triggered = false;
          let alertTitle = "";
          let alertMessage = "";
          let alertType: "success" | "danger" | "info" = "info";

          if (rule.condition === "strong_bullish" && bullishSignals >= 3) {
            triggered = true;
            alertTitle = `🚀 STRONG BULLISH: ${tickerSymbol}`;
            alertType = "success";
            alertMessage = `Technical indicators confirm a perfect Strong Bullish score (${bullishSignals}/4 buy signals). RSI is at ${lastBar.rsi?.toFixed(1) || "N/A"} and MACD has entered buying territory. Price is trading at ₹${currentPrice.toFixed(2)}.`;
          } else if (rule.condition === "strong_bearish" && bearishSignals >= 3) {
            triggered = true;
            alertTitle = `🚨 STRONG BEARISH: ${tickerSymbol}`;
            alertType = "danger";
            alertMessage = `Technical indicators warn of an active Strong Bearish alignment (${bearishSignals}/4 sell signals). EMA is trading above close, and RSI shows overbought momentum at ${lastBar.rsi?.toFixed(1) || "N/A"}. Price is currently ₹${currentPrice.toFixed(2)}.`;
          } else if (rule.condition === "breakout_up" && forecastedPct >= (rule.thresholdPercent || 5)) {
            triggered = true;
            alertTitle = `🔥 FORECAST BREAKOUT UP: ${tickerSymbol}`;
            alertType = "success";
            alertMessage = `Predictive engine forecasts a positive bullish breakout of +${forecastedPct.toFixed(1)}% over the next 10 trading days. Target forecast price: ₹${predictedFinal.toFixed(2)} (Current: ₹${currentPrice.toFixed(2)}).`;
          } else if (rule.condition === "breakout_down" && forecastedPct <= -(rule.thresholdPercent || 5)) {
            triggered = true;
            alertTitle = `📉 FORECAST BREAKOUT DOWN: ${tickerSymbol}`;
            alertType = "danger";
            alertMessage = `Predictive engine models a negative bearish decline of ${forecastedPct.toFixed(1)}% over the next 10 trading days. Target forecast price: ₹${predictedFinal.toFixed(2)} (Current: ₹${currentPrice.toFixed(2)}).`;
          }

          if (triggered) {
            // Check if we already triggered this exact alert recently to avoid duplication spam
            const isDuplicate = notifications.some(
              n => n.ticker === tickerSymbol && n.title === alertTitle && (Date.now() - new Date(n.timestamp).getTime()) < 300000 // 5 min cooldown
            );

            if (!isDuplicate) {
              const newNotif: AlertNotification = {
                id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                ruleId: rule.id,
                ticker: tickerSymbol,
                title: alertTitle,
                message: alertMessage,
                type: alertType,
                timestamp: new Date().toISOString(),
                read: false,
                priceAtAlert: currentPrice
              };
              newNotificationsList.push(newNotif);
              triggeredCount++;

              // Trigger OS Desktop notification
              showDesktopNotification(alertTitle, alertMessage);
            }
          }
        }
      } catch (err) {
        console.error(`Error scanning ticker ${tickerSymbol}:`, err);
      }
    }

    if (newNotificationsList.length > 0) {
      setNotifications(prev => [
        ...newNotificationsList,
        ...prev
      ]);
      playChime();
    }

    setScanProgress(`Scan complete. Evaluated ${activeRules.length} rules. Triggered ${triggeredCount} new alerts.`);
    setIsScanning(false);
    setLastScanTime(new Date().toLocaleTimeString());
  };

  // Auto-scan periodically every 45 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      executeScan();
    }, 45000);
    return () => clearInterval(timer);
  }, [rules, notifications]);

  // Add rule helper
  const addRule = () => {
    const symbol = newRuleTicker === "CUSTOM" ? customTickerInput.toUpperCase().trim() : newRuleTicker;
    if (!symbol) return;

    const newRule: AlertRule = {
      id: `rule-${Date.now()}`,
      ticker: symbol,
      condition: ruleType,
      thresholdPercent: (ruleType === "breakout_up" || ruleType === "breakout_down") ? thresholdPercent : undefined,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    setRules(prev => [...prev, newRule]);
    setCustomTickerInput("");
    
    // Auto scan immediately when adding a rule to give instant feedback
    setTimeout(() => {
      executeScan();
    }, 200);
  };

  // Delete rule
  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  // Toggle rule state
  const toggleRuleActive = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="alerts_center_panel">
      {/* Left Column: Alerts Settings and Active Rules Manager */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-[#080808] border border-white/10 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-indigo-600/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                <Bell size={18} />
              </span>
              <div>
                <h3 className="font-extrabold text-neutral-200 text-sm">Notifications Engine</h3>
                <p className="text-[10px] text-neutral-500 font-mono">STOCHASTIC ENGINE ALERT SUITE</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg border transition ${
                  soundEnabled 
                    ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-400" 
                    : "bg-white/5 border-white/5 text-neutral-500"
                }`}
                title={soundEnabled ? "Mute audio alert" : "Enable audio alert"}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              
              <button
                onClick={requestNotificationPermission}
                className={`p-2 rounded-lg border transition ${
                  browserNotificationsEnabled 
                    ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400" 
                    : "bg-white/5 border-white/5 text-neutral-500 hover:text-neutral-300"
                }`}
                title="Toggle Desktop OS Notifications"
              >
                {browserNotificationsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
              </button>
            </div>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            Configure target threshold alert rules. The Predictive Scanning engine runs high-performance technical indicators and stochastic trend predictions continuously across the market.
          </p>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Active Rules</span>
              <span className="text-xl font-mono font-extrabold text-neutral-200 mt-1">
                {rules.filter(r => r.isActive).length} / {rules.length}
              </span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Unread Alerts</span>
              <span className="text-xl font-mono font-extrabold text-indigo-400 mt-1">
                {notifications.filter(n => !n.read).length}
              </span>
            </div>
          </div>
        </div>

        {/* Create a new rule */}
        <div className="bg-[#080808] border border-white/10 p-5 rounded-2xl shadow-sm">
          <h4 className="font-bold text-neutral-200 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
            <Plus size={14} className="text-indigo-400" />
            Establish Alert Rule
          </h4>

          <div className="space-y-4">
            {/* Ticker Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Target Asset</label>
              <div className="flex gap-2">
                <select
                  value={newRuleTicker}
                  onChange={(e) => setNewRuleTicker(e.target.value)}
                  className="bg-[#0A0A0A] border border-white/10 text-xs font-bold text-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer flex-1"
                >
                  {SUPPORTED_TICKERS.map((t) => (
                    <option key={t.symbol} value={t.symbol}>
                      {t.symbol} ({t.name.split(" ")[0]})
                    </option>
                  ))}
                  <option value="CUSTOM">-- Custom Indian Stock --</option>
                </select>

                {newRuleTicker === "CUSTOM" && (
                  <input
                    type="text"
                    value={customTickerInput}
                    onChange={(e) => setCustomTickerInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="e.g. ZOMATO"
                    className="bg-[#0A0A0A] border border-white/10 text-xs font-bold text-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 w-28 uppercase font-mono"
                  />
                )}
              </div>
            </div>

            {/* Condition Type */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Trigger Signal Condition</label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as AlertConditionType)}
                className="bg-[#0A0A0A] border border-white/10 text-xs font-bold text-neutral-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
              >
                <option value="strong_bullish">Strong Bullish Aligned (MACD, RSI, SMA, EMA)</option>
                <option value="strong_bearish">Strong Bearish Aligned (MACD, RSI, SMA, EMA)</option>
                <option value="breakout_up">Predicted Breakout Up (+% in next 10 days)</option>
                <option value="breakout_down">Predicted Breakout Down (-% in next 10 days)</option>
              </select>
            </div>

            {/* Threshold Percent (If prediction based) */}
            {(ruleType === "breakout_up" || ruleType === "breakout_down") && (
              <div className="space-y-1.5 p-3.5 bg-indigo-950/10 border border-indigo-500/20 rounded-xl">
                <div className="flex justify-between items-center text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  <span>Threshold Percentage Rise/Fall:</span>
                  <span className="text-indigo-400 font-mono text-xs">{thresholdPercent}%</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="15"
                  step="1"
                  value={thresholdPercent}
                  onChange={(e) => setThresholdPercent(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 bg-white/5 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[9px] text-neutral-500 font-medium">
                  Triggers alert when the chosen stochastic projection model projects a movement greater than this percentage within the 10-day timeline.
                </p>
              </div>
            )}

            <button
              onClick={addRule}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Plus size={14} /> Add Active Scan Rule
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Alert History Log and Active Rule list */}
      <div className="lg:col-span-7 space-y-6">
        {/* Active Rules List */}
        <div className="bg-[#080808] border border-white/10 p-5 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-neutral-200 text-xs uppercase tracking-wider flex items-center gap-2">
              <Activity size={14} className="text-indigo-400" />
              Active System Watchlist ({rules.length})
            </h4>
            
            <button
              onClick={executeScan}
              disabled={isScanning}
              className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 font-bold px-3 py-1.5 rounded-lg text-[10px] transition uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <RefreshCw size={11} className={isScanning ? "animate-spin" : ""} />
              {isScanning ? "Scanning..." : "Force Scan Now"}
            </button>
          </div>

          {isScanning && (
            <div className="bg-indigo-950/20 border border-indigo-500/30 text-indigo-400 px-3 py-2.5 rounded-xl text-[11px] font-mono flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
              <span>{scanProgress}</span>
            </div>
          )}

          {rules.length === 0 ? (
            <div className="border border-dashed border-white/10 py-8 text-center text-xs text-neutral-500 font-medium">
              No alert rules registered. Use the panel on the left to set trigger parameters.
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {rules.map((rule) => {
                const isPreset = SUPPORTED_TICKERS.some(t => t.symbol === rule.ticker);
                return (
                  <div
                    key={rule.id}
                    className="flex justify-between items-center bg-[#0C0C0C] border border-white/5 hover:border-white/10 p-3 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-xs text-neutral-200 flex items-center gap-1.5">
                          {rule.ticker}
                          {!isPreset && (
                            <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.2 rounded uppercase">
                              Custom
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-semibold flex items-center gap-1 mt-0.5">
                          {rule.condition === "strong_bullish" && (
                            <span className="text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 size={11} /> Indicator Strong Bullish
                            </span>
                          )}
                          {rule.condition === "strong_bearish" && (
                            <span className="text-rose-400 flex items-center gap-0.5">
                              <AlertTriangle size={11} /> Indicator Strong Bearish
                            </span>
                          )}
                          {rule.condition === "breakout_up" && (
                            <span className="text-indigo-400 flex items-center gap-0.5">
                              <TrendingUp size={11} /> Forecast Breakout Up (+{rule.thresholdPercent}%)
                            </span>
                          )}
                          {rule.condition === "breakout_down" && (
                            <span className="text-pink-400 flex items-center gap-0.5">
                              <TrendingDown size={11} /> Forecast Breakout Down (-{rule.thresholdPercent}%)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Toggle Switch */}
                      <button
                        onClick={() => toggleRuleActive(rule.id)}
                        className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border transition uppercase ${
                          rule.isActive 
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                            : "bg-white/5 border-white/5 text-neutral-500"
                        }`}
                      >
                        {rule.isActive ? "Scanning" : "Paused"}
                      </button>

                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="text-neutral-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/5 transition cursor-pointer"
                        title="Delete rule"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="flex justify-between text-[9px] text-neutral-500 mt-3 font-semibold font-mono uppercase">
            <span>Scanner loop: Every 45s</span>
            <span>Last scanned at: {lastScanTime}</span>
          </div>
        </div>

        {/* Alerts Logs Inbox */}
        <div className="bg-[#080808] border border-white/10 p-5 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
          <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
            <h4 className="font-bold text-neutral-200 text-xs uppercase tracking-wider flex items-center gap-2">
              <Bell size={14} className="text-indigo-400" />
              Notifications Inbox ({notifications.length})
            </h4>

            {notifications.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={markAllAsRead}
                  className="text-[10px] text-neutral-400 hover:text-white font-semibold uppercase font-mono tracking-wider transition"
                >
                  Mark All Read
                </button>
                <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                <button
                  onClick={clearAllNotifications}
                  className="text-[10px] text-rose-400/80 hover:text-rose-400 font-semibold uppercase font-mono tracking-wider transition"
                >
                  Clear Logs
                </button>
              </div>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-xs text-neutral-500 font-medium">
              <BellOff size={28} className="text-neutral-600 mb-2.5" />
              <span>Inbox Empty.</span>
              <p className="text-[10px] text-neutral-600 max-w-sm mt-1">
                When one of your alert criteria is matched during active market scans, the notification and technical explanations will show here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`border p-4 rounded-xl transition flex flex-col justify-between relative overflow-hidden ${
                    notif.read 
                      ? "bg-[#0A0A0A]/40 border-white/5 opacity-75" 
                      : "bg-[#0C0C0C] border-white/10 shadow-sm"
                  }`}
                >
                  {!notif.read && (
                    <span className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></span>
                  )}

                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[9px] font-bold font-mono uppercase px-2 py-0.5 rounded ${
                          notif.type === "success" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" 
                            : notif.type === "danger" 
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/10" 
                            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10"
                        }`}>
                          {notif.type === "success" ? "BULLISH SIGNAL" : notif.type === "danger" ? "BEARISH WARNING" : "SIGNAL DETECTED"}
                        </span>
                        
                        <span className="font-mono text-[10px] font-bold text-neutral-400">
                          {notif.ticker}
                        </span>

                        <span className="text-[9px] text-neutral-500 font-mono">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <h5 className="font-bold text-neutral-200 text-xs mt-1">
                        {notif.title}
                      </h5>

                      <p className="text-[11px] text-neutral-400 leading-relaxed font-sans">
                        {notif.message}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-xs font-mono font-extrabold text-neutral-200">
                        ₹{notif.priceAtAlert.toFixed(2)}
                      </span>
                      <span className="text-[8px] text-neutral-500 font-mono uppercase font-semibold">Price logged</span>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 mt-3 flex justify-between items-center">
                    <button
                      onClick={() => {
                        setTicker(notif.ticker);
                        // Mark as read
                        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                      }}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink size={11} /> Load Asset Dashboard
                    </button>

                    {!notif.read && (
                      <button
                        onClick={() => {
                          setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                        }}
                        className="text-[9px] text-neutral-500 hover:text-neutral-300 font-mono font-bold uppercase transition"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Bullish vs Bearish technical indicators validator */}
      <div className="lg:col-span-12 bg-[#080808] border border-white/10 p-6 rounded-2xl shadow-sm space-y-5" id="technical_sentiment_inspector">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-600/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <Zap size={18} />
            </span>
            <div>
              <h3 className="font-extrabold text-neutral-200 text-sm">Live Bullish vs Bearish Technical Signals Validator</h3>
              <p className="text-[10px] text-neutral-500 font-mono">MATHEMATICAL VERIFICATION OF PREDICTIVE TREND TRIGGERS</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <span className="text-xs text-neutral-400 font-medium whitespace-nowrap">Verify Asset:</span>
            <select
              value={inspectTicker}
              onChange={(e) => setInspectTicker(e.target.value)}
              className="bg-[#0A0A0A] border border-white/10 text-xs font-bold text-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
            >
              {SUPPORTED_TICKERS.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol} — {t.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => runInspection(inspectTicker)}
              disabled={isInspecting}
              className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 font-bold px-3 py-2 rounded-xl text-[11px] transition uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <RefreshCw size={12} className={isInspecting ? "animate-spin" : ""} />
              {isInspecting ? "Verifying..." : "Run Diagnostic"}
            </button>
          </div>
        </div>

        {inspectError && (
          <div className="bg-rose-950/20 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-xs font-mono">
            {inspectError}
          </div>
        )}

        {isInspecting && !inspectResult && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <RefreshCw size={24} className="text-indigo-500 animate-spin" />
            <span className="text-xs text-neutral-400 font-mono">Running technical signals diagnostics...</span>
          </div>
        )}

        {inspectResult && (
          <div className="space-y-6">
            {/* Header summary of the selected asset */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white/[0.01] border border-white/5 rounded-2xl">
              <div>
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Asset Diagnostics</span>
                <span className="text-lg font-mono font-extrabold text-white block mt-0.5">{inspectResult.ticker}</span>
              </div>

              <div>
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Real-time Trading Price</span>
                <span className="text-lg font-mono font-extrabold text-neutral-200 block mt-0.5">₹{inspectResult.price.toFixed(2)}</span>
              </div>

              <div>
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Daily Market Drift</span>
                <span className={`text-sm font-mono font-extrabold block mt-1 ${inspectResult.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {inspectResult.change >= 0 ? "+" : ""}{inspectResult.change.toFixed(2)} ({inspectResult.changePercent >= 0 ? "+" : ""}{inspectResult.changePercent.toFixed(2)}%)
                </span>
              </div>

              <div>
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Overall Classification Summary</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {inspectResult.bullishCount >= 3 ? (
                    <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                      ● STRONG BULLISH ({inspectResult.bullishCount}/4)
                    </span>
                  ) : inspectResult.bearishCount >= 3 ? (
                    <span className="text-[10px] font-extrabold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                      ● STRONG BEARISH ({inspectResult.bearishCount}/4)
                    </span>
                  ) : inspectResult.bullishCount > inspectResult.bearishCount ? (
                    <span className="text-[10px] font-extrabold text-emerald-300 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded uppercase tracking-wider">
                      ● WEAK BULLISH ({inspectResult.bullishCount}/4)
                    </span>
                  ) : inspectResult.bearishCount > inspectResult.bullishCount ? (
                    <span className="text-[10px] font-extrabold text-rose-300 bg-rose-500/5 border border-rose-500/10 px-2 py-0.5 rounded uppercase tracking-wider">
                      ● WEAK BEARISH ({inspectResult.bearishCount}/4)
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold text-neutral-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded uppercase tracking-wider">
                      ● EQUAL NEUTRAL (2/4)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Signal breakdown cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inspectResult.signals.map((signal, sIdx) => (
                <div key={sIdx} className="bg-[#0C0C0C] border border-white/5 p-4 rounded-xl flex flex-col justify-between hover:border-white/10 transition">
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-neutral-300 text-xs">{signal.name}</h4>
                      <span className={`text-[9px] font-extrabold font-mono uppercase px-2 py-0.5 rounded border ${
                        signal.status === "bullish" 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                          : signal.status === "bearish" 
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}>
                        {signal.status}
                      </span>
                    </div>

                    <span className="text-xs font-mono font-bold text-white block mt-1.5 p-1.5 bg-black/40 rounded border border-white/5 text-center">
                      {signal.value}
                    </span>

                    <p className="text-[11px] text-neutral-400 leading-relaxed mt-2.5">
                      {signal.description}
                    </p>
                  </div>

                  <div className="border-t border-white/5 pt-2.5 mt-3 text-[9px] text-neutral-500 font-medium font-mono leading-relaxed">
                    <span className="text-indigo-400 font-bold uppercase block">Trigger Formula Logic:</span>
                    {signal.criteria}
                  </div>
                </div>
              ))}
            </div>

            {/* Informational Guidelines Footer */}
            <div className="p-4 bg-indigo-950/5 border border-indigo-500/10 rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Info size={12} /> Technical Interpretation Cheat Sheet
              </span>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Our scan engine aggregates these signals strictly to determine standard and custom alert triggers. A <strong>Strong Bullish</strong> or <strong>Strong Bearish</strong> alert requires a minimum agreement of <strong>3 out of 4 independent technical metrics</strong>. This helps filter out market static and prevent false alarms from temporary noise.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
