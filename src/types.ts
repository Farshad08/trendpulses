export interface StockBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  event?: string;
}

export interface TechnicalIndicators {
  smaFast?: number;
  smaSlow?: number;
  ema?: number;
  rsi?: number;
  macdLine?: number;
  macdSignal?: number;
  macdHist?: number;
  bbandUpper?: number;
  bbandMiddle?: number;
  bbandLower?: number;
}

export interface ChartDataPoint extends StockBar, TechnicalIndicators {}

export type ForecastModelType = "linear" | "exponential" | "knn";

export interface LinearParams {
  lookback: number;
}

export interface ExponentialParams {
  lookback: number;
  alpha: number; // Level smoothing
  beta: number;  // Trend smoothing
}

export interface KNNParams {
  lookback: number;
  features: ("rsi" | "macd" | "returns" | "momentum")[];
  k: number;
}

export interface Hyperparameters {
  linear: LinearParams;
  exponential: ExponentialParams;
  knn: KNNParams;
}

export interface PredictionPoint {
  date: string;
  price: number;
  actual?: number;
  upper?: number;
  lower?: number;
}

export interface ModelForecast {
  modelType: ForecastModelType;
  predictions: PredictionPoint[];
  metrics: EvaluationMetrics;
}

export interface EvaluationMetrics {
  mae: number;          // Mean Absolute Error
  rmse: number;         // Root Mean Squared Error
  mape: number;         // Mean Absolute Percentage Error (percentage)
  directionAcc: number; // Directional Accuracy (percentage of correct up/down predictions)
}

export interface Trade {
  type: "BUY" | "SELL" | "HOLD";
  date: string;
  price: number;
  shares: number;
  cash: number;
  portfolioValue: number;
}

export interface BacktestHistoryPoint {
  date: string;
  strategyValue: number;
  buyHoldValue: number;
  price: number;
}

export interface BacktestResult {
  history: BacktestHistoryPoint[];
  trades: Trade[];
  strategyReturn: number;
  buyHoldReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}

export interface OptimizingParamsState {
  isOptimizing: boolean;
  currentStep?: string;
  bestParams?: {
    linear: LinearParams;
    exponential: ExponentialParams;
    knn: KNNParams;
  };
}
