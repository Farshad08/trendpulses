import { ChartDataPoint, PredictionPoint, EvaluationMetrics, LinearParams, ExponentialParams, KNNParams } from "../types";

// ==========================================
// 1. Data Normalization Utilities
// ==========================================

export function normalizeSeries(
  series: number[],
  method: "none" | "minmax" | "zscore" | "returns"
): { normalized: number[]; min?: number; max?: number; mean?: number; std?: number } {
  if (series.length === 0) return { normalized: [] };

  switch (method) {
    case "minmax": {
      const min = Math.min(...series);
      const max = Math.max(...series);
      const range = max - min || 1;
      const normalized = series.map(v => (v - min) / range);
      return { normalized, min, max };
    }
    case "zscore": {
      const mean = series.reduce((a, b) => a + b, 0) / series.length;
      const variance = series.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / series.length;
      const std = Math.sqrt(variance) || 1;
      const normalized = series.map(v => (v - mean) / std);
      return { normalized, mean, std };
    }
    case "returns": {
      // Percentage return of index i relative to index i-1. First element becomes 0.
      const normalized: number[] = [0];
      for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1] || 1;
        normalized.push((series[i] - prev) / prev);
      }
      return { normalized };
    }
    case "none":
    default:
      return { normalized: [...series] };
  }
}

export function denormalizeValue(
  value: number,
  method: "none" | "minmax" | "zscore" | "returns",
  baseVal?: number, // Needed for returns to reconstruct prices
  stats?: { min?: number; max?: number; mean?: number; std?: number }
): number {
  switch (method) {
    case "minmax": {
      if (stats?.min !== undefined && stats?.max !== undefined) {
        return value * (stats.max - stats.min) + stats.min;
      }
      return value;
    }
    case "zscore": {
      if (stats?.mean !== undefined && stats?.std !== undefined) {
        return value * stats.std + stats.mean;
      }
      return value;
    }
    case "returns": {
      if (baseVal !== undefined) {
        return baseVal * (1 + value);
      }
      return value;
    }
    case "none":
    default:
      return value;
  }
}

// ==========================================
// 2. Core Forecasting Models
// ==========================================

/**
 * Fits a simple linear regression line (Y = mX + c) over a historical lookback window.
 * Projects that line into the future.
 */
export function trainLinearRegression(
  prices: number[],
  lookback: number,
  horizon: number
): number[] {
  const n = Math.min(lookback, prices.length);
  const startIdx = prices.length - n;
  
  // X indices: 0, 1, 2, ..., n-1
  // Y values: prices in lookback window
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = prices[startIdx + i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  let slope = 0;
  let intercept = prices[prices.length - 1]; // Fallback

  if (denominator !== 0) {
    slope = (n * sumXY - sumX * sumY) / denominator;
    intercept = (sumY - slope * sumX) / n;
  }

  // Predict future steps
  const predictions: number[] = [];
  for (let step = 1; step <= horizon; step++) {
    // Current point index is n-1. Future index is n-1 + step
    const futureX = (n - 1) + step;
    const predictedPrice = slope * futureX + intercept;
    predictions.push(parseFloat(predictedPrice.toFixed(2)));
  }

  return predictions;
}

/**
 * Holt's Double Exponential Smoothing (captures local level and trend)
 * Equations:
 * Level: L_t = alpha * Y_t + (1 - alpha) * (L_{t-1} + T_{t-1})
 * Trend: T_t = beta * (L_t - L_{t-1}) + (1 - beta) * T_{t-1}
 * Forecast: F_{t+m} = L_t + m * T_t
 */
export function trainExponentialSmoothing(
  prices: number[],
  lookback: number,
  horizon: number,
  alpha: number,
  beta: number
): number[] {
  const n = Math.min(lookback, prices.length);
  const startIdx = prices.length - n;
  const windowPrices = prices.slice(startIdx);

  if (windowPrices.length < 2) {
    return Array(horizon).fill(prices[prices.length - 1] || 0);
  }

  // Initializations
  let level = windowPrices[0];
  let trend = windowPrices[1] - windowPrices[0];

  for (let i = 1; i < windowPrices.length; i++) {
    const y = windowPrices[i];
    const prevLevel = level;
    level = alpha * y + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  // Forecast
  const predictions: number[] = [];
  for (let m = 1; m <= horizon; m++) {
    const forecast = level + m * trend;
    predictions.push(parseFloat(Math.max(0, forecast).toFixed(2)));
  }

  return predictions;
}

/**
 * K-Nearest Neighbors Regression
 * Uses recent historical features (1-day returns, RSI, MACD histogram)
 * Finds similarity to project the percentage returns of the next steps.
 */
export function trainKNNRegression(
  data: ChartDataPoint[],
  lookback: number, // Lookback range of history to search for neighbors
  horizon: number,
  k: number,
  selectedFeatures: ("rsi" | "macd" | "returns" | "momentum")[]
): number[] {
  if (data.length < 30) {
    return Array(horizon).fill(data[data.length - 1]?.close || 0);
  }

  // Create features for the dataset
  interface KNNInstance {
    index: number;
    features: number[];
    targetReturn: number; // Next day return
  }

  const instances: KNNInstance[] = [];

  // Construct features for all past indices where indicators are available
  for (let i = 20; i < data.length - 1; i++) {
    const feats: number[] = [];
    
    if (selectedFeatures.includes("rsi")) {
      feats.push(data[i].rsi || 50);
    }
    if (selectedFeatures.includes("macd")) {
      feats.push(data[i].macdHist || 0);
    }
    if (selectedFeatures.includes("returns")) {
      const prevClose = data[i - 1]?.close || 1;
      feats.push((data[i].close - prevClose) / prevClose);
    }
    if (selectedFeatures.includes("momentum")) {
      const pastClose = data[i - 5]?.close || 1;
      feats.push((data[i].close - pastClose) / pastClose);
    }

    const targetReturn = (data[i + 1].close - data[i].close) / data[i].close;

    instances.push({
      index: i,
      features: feats,
      targetReturn
    });
  }

  // Current state feature vector
  const currentFeats: number[] = [];
  const currIdx = data.length - 1;
  if (selectedFeatures.includes("rsi")) {
    currentFeats.push(data[currIdx].rsi || 50);
  }
  if (selectedFeatures.includes("macd")) {
    currentFeats.push(data[currIdx].macdHist || 0);
  }
  if (selectedFeatures.includes("returns")) {
    const prevClose = data[currIdx - 1]?.close || 1;
    currentFeats.push((data[currIdx].close - prevClose) / prevClose);
  }
  if (selectedFeatures.includes("momentum")) {
    const pastClose = data[currIdx - 5]?.close || 1;
    currentFeats.push((data[currIdx].close - pastClose) / pastClose);
  }

  // Helper to compute Euclidean distance
  function euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let j = 0; j < a.length; j++) {
      sum += Math.pow(a[j] - b[j], 2);
    }
    return Math.sqrt(sum);
  }

  // Autoregressive projection of horizon steps
  const predictions: number[] = [];
  let lastClose = data[data.length - 1].close;
  let simulatedFeats = [...currentFeats];

  for (let h = 0; h < horizon; h++) {
    // Search the history within the lookback window
    // Only search indices within 'lookback' days from the current point
    const searchInstances = instances.filter(inst => currIdx - inst.index <= lookback);

    if (searchInstances.length === 0) {
      predictions.push(lastClose);
      continue;
    }

    // Compute distances
    const withDistances = searchInstances.map(inst => ({
      ...inst,
      distance: euclideanDistance(simulatedFeats, inst.features)
    }));

    // Sort by distance ascending
    withDistances.sort((a, b) => a.distance - b.distance);

    // Pick top K
    const neighbors = withDistances.slice(0, Math.min(k, withDistances.length));
    
    // Average target returns
    const avgReturn = neighbors.reduce((sum, n) => sum + n.targetReturn, 0) / neighbors.length;

    // Project price
    const predictedClose = lastClose * (1 + avgReturn);
    predictions.push(parseFloat(predictedClose.toFixed(2)));

    // For multi-step forecasting, update state
    lastClose = predictedClose;
    
    // Update simulated feature vector (simple approximations)
    // 1-day return is updated with the predicted one
    let featurePointer = 0;
    if (selectedFeatures.includes("rsi")) {
      // Simulate RSI drifting toward middle ground or following return trend
      simulatedFeats[featurePointer] = simulatedFeats[featurePointer] * 0.9 + (avgReturn > 0 ? 55 : 45) * 0.1;
      featurePointer++;
    }
    if (selectedFeatures.includes("macd")) {
      // Update macd histogram slightly
      simulatedFeats[featurePointer] = simulatedFeats[featurePointer] * 0.8 + (avgReturn * 10) * 0.2;
      featurePointer++;
    }
    if (selectedFeatures.includes("returns")) {
      simulatedFeats[featurePointer] = avgReturn;
      featurePointer++;
    }
    if (selectedFeatures.includes("momentum")) {
      // Blend return into momentum
      simulatedFeats[featurePointer] = simulatedFeats[featurePointer] * 0.8 + avgReturn * 0.2;
      featurePointer++;
    }
  }

  return predictions;
}

// ==========================================
// 3. Validation & Evaluation System
// ==========================================

export function evaluatePredictions(
  actualPrices: number[],
  predictedPrices: number[]
): EvaluationMetrics {
  const n = Math.min(actualPrices.length, predictedPrices.length);
  if (n === 0) return { mae: 0, rmse: 0, mape: 0, directionAcc: 0 };

  let absErrorSum = 0;
  let squaredErrorSum = 0;
  let pctErrorSum = 0;
  let correctDirectionCount = 0;

  for (let i = 0; i < n; i++) {
    const actual = actualPrices[i];
    const predicted = predictedPrices[i];
    
    const absErr = Math.abs(actual - predicted);
    absErrorSum += absErr;
    squaredErrorSum += absErr * absErr;
    pctErrorSum += actual !== 0 ? absErr / actual : 0;

    // Directional Accuracy: did it predict the trend direction from the start?
    // Let's compare the change direction from day i relative to the last known historical price
    // But for sequential evaluation, let's compare changes from day to day or from base price:
    if (i === 0) {
      // Compared to last known historical price (which is the actual baseline index preceding evaluation)
      // Standardize to say if correct up/down direction predicted
      const actualUp = actual > actualPrices[0];
      const predictedUp = predicted > actualPrices[0];
      if (actualUp === predictedUp) correctDirectionCount++;
    } else {
      const actualUp = actual > actualPrices[i - 1];
      const predictedUp = predicted > predictedPrices[i - 1];
      if (actualUp === predictedUp) correctDirectionCount++;
    }
  }

  return {
    mae: parseFloat((absErrorSum / n).toFixed(2)),
    rmse: parseFloat(Math.sqrt(squaredErrorSum / n).toFixed(2)),
    mape: parseFloat(((pctErrorSum / n) * 100).toFixed(2)),
    directionAcc: parseFloat(((correctDirectionCount / n) * 100).toFixed(1))
  };
}

/**
 * Validates models using a walk-forward validation scheme.
 * Pretends to stand at T - valSize. Generates forecasts, compares to actual, repeats.
 */
export function validateForecastModel(
  data: ChartDataPoint[],
  modelType: "linear" | "exponential" | "knn",
  lookback: number,
  horizon: number,
  hyperparams: {
    alpha?: number;
    beta?: number;
    k?: number;
    features?: ("rsi" | "macd" | "returns" | "momentum")[];
  }
): EvaluationMetrics {
  const totalLength = data.length;
  const valHorizon = horizon;
  const valPeriod = Math.min(30, totalLength - lookback - valHorizon);

  if (valPeriod <= 0) {
    return { mae: 0, rmse: 0, mape: 0, directionAcc: 0 };
  }

  let totalMae = 0;
  let totalRmse = 0;
  let totalMape = 0;
  let totalDirAcc = 0;
  let validRuns = 0;

  // Jump in steps of 3 days to keep walk-forward validations speed-friendly but accurate
  for (let testIdx = totalLength - valHorizon - valPeriod; testIdx <= totalLength - valHorizon; testIdx += 3) {
    const historicalSubSlice = data.slice(0, testIdx);
    const actualSubSlice = data.slice(testIdx, testIdx + valHorizon).map(d => d.close);
    const historicalPrices = historicalSubSlice.map(d => d.close);

    let predictions: number[] = [];

    if (modelType === "linear") {
      predictions = trainLinearRegression(historicalPrices, lookback, valHorizon);
    } else if (modelType === "exponential") {
      predictions = trainExponentialSmoothing(
        historicalPrices,
        lookback,
        valHorizon,
        hyperparams.alpha || 0.3,
        hyperparams.beta || 0.1
      );
    } else if (modelType === "knn") {
      predictions = trainKNNRegression(
        historicalSubSlice,
        lookback,
        valHorizon,
        hyperparams.k || 5,
        hyperparams.features || ["rsi", "returns"]
      );
    }

    const runMetrics = evaluatePredictions(actualSubSlice, predictions);
    
    totalMae += runMetrics.mae;
    totalRmse += runMetrics.rmse;
    totalMape += runMetrics.mape;
    totalDirAcc += runMetrics.directionAcc;
    validRuns++;
  }

  return {
    mae: parseFloat((totalMae / validRuns).toFixed(2)),
    rmse: parseFloat((totalRmse / validRuns).toFixed(2)),
    mape: parseFloat((totalMape / validRuns).toFixed(2)),
    directionAcc: parseFloat((totalDirAcc / validRuns).toFixed(1))
  };
}

// ==========================================
// 4. Automated Hyperparameter Tuning
// ==========================================

export function tuneLinearParams(prices: number[]): LinearParams {
  const lookbackOptions = [10, 20, 30, 45, 60];
  let bestMAE = Infinity;
  let bestLookback = 30;

  const validationSize = 15;
  const testPrices = prices.slice(0, prices.length - validationSize);
  const valActuals = prices.slice(prices.length - validationSize);

  for (const lb of lookbackOptions) {
    if (testPrices.length < lb) continue;
    const preds = trainLinearRegression(testPrices, lb, validationSize);
    const metrics = evaluatePredictions(valActuals, preds);
    if (metrics.mae < bestMAE) {
      bestMAE = metrics.mae;
      bestLookback = lb;
    }
  }

  return { lookback: bestLookback };
}

export function tuneExponentialParams(prices: number[]): ExponentialParams {
  const lookbackOptions = [15, 30, 50];
  const alphaOptions = [0.1, 0.3, 0.5, 0.7];
  const betaOptions = [0.05, 0.1, 0.2, 0.4];

  let bestMAE = Infinity;
  let bestLookback = 30;
  let bestAlpha = 0.3;
  let bestBeta = 0.1;

  const validationSize = 15;
  const testPrices = prices.slice(0, prices.length - validationSize);
  const valActuals = prices.slice(prices.length - validationSize);

  for (const lb of lookbackOptions) {
    if (testPrices.length < lb) continue;
    for (const a of alphaOptions) {
      for (const b of betaOptions) {
        const preds = trainExponentialSmoothing(testPrices, lb, validationSize, a, b);
        const metrics = evaluatePredictions(valActuals, preds);
        if (metrics.mae < bestMAE) {
          bestMAE = metrics.mae;
          bestLookback = lb;
          bestAlpha = a;
          bestBeta = b;
        }
      }
    }
  }

  return { lookback: bestLookback, alpha: bestAlpha, beta: bestBeta };
}

export function tuneKNNParams(data: ChartDataPoint[]): KNNParams {
  const lookbackOptions = [30, 60, 90];
  const kOptions = [3, 5, 7, 9];
  const featureCombos: ("rsi" | "macd" | "returns" | "momentum")[][] = [
    ["rsi", "returns"],
    ["macd", "returns"],
    ["rsi", "macd", "returns"],
    ["returns", "momentum"]
  ];

  let bestMAE = Infinity;
  let bestLookback = 60;
  let bestK = 5;
  let bestFeatures = featureCombos[0];

  const validationSize = 15;
  const testData = data.slice(0, data.length - validationSize);
  const valActuals = data.slice(data.length - validationSize).map(d => d.close);

  for (const lb of lookbackOptions) {
    for (const k of kOptions) {
      for (const feats of featureCombos) {
        const preds = trainKNNRegression(testData, lb, validationSize, k, feats);
        const metrics = evaluatePredictions(valActuals, preds);
        if (metrics.mae < bestMAE) {
          bestMAE = metrics.mae;
          bestLookback = lb;
          bestK = k;
          bestFeatures = feats;
        }
      }
    }
  }

  return { lookback: bestLookback, k: bestK, features: bestFeatures };
}
