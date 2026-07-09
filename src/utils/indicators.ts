import { StockBar, ChartDataPoint } from "../types";

export function calculateSMA(prices: number[], period: number): (number | undefined)[] {
  const sma: (number | undefined)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(undefined);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      sma.push(parseFloat((sum / period).toFixed(2)));
    }
  }
  return sma;
}

export function calculateEMA(prices: number[], period: number): (number | undefined)[] {
  const ema: (number | undefined)[] = [];
  if (prices.length === 0) return ema;

  const k = 2 / (period + 1);
  let prevEma = prices[0];
  ema.push(parseFloat(prevEma.toFixed(2)));

  for (let i = 1; i < prices.length; i++) {
    const currentEma = prices[i] * k + prevEma * (1 - k);
    ema.push(parseFloat(currentEma.toFixed(2)));
    prevEma = currentEma;
  }

  // To make it standard, mark initial period - 1 items as undefined or keep them as estimates.
  // For better prediction charts, keeping estimates is good, but let's null out the very start to keep it mathematically pure.
  for (let i = 0; i < Math.min(period - 1, prices.length); i++) {
    ema[i] = undefined;
  }

  return ema;
}

export function calculateRSI(prices: number[], period: number = 14): (number | undefined)[] {
  const rsi: (number | undefined)[] = [];
  if (prices.length < period) {
    return Array(prices.length).fill(undefined);
  }

  // Calculate price changes
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // First RSI requires SMA of gains and losses
  let avgGain = 0;
  let avgLoss = 0;

  // Align with prices indices: changes[i] represents changes between prices[i+1] and prices[i]
  // First indicator is computed at price index = period (which corresponds to period-1 changes)
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  // Pad the first 'period' entries with undefined (since index 'period' is the first with 14 past changes, which corresponds to prices[period])
  for (let i = 0; i < period; i++) {
    rsi.push(undefined);
  }

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(parseFloat((100 - 100 / (1 + rs)).toFixed(2)));

  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    // Wilder's smoothing technique
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(parseFloat((100 - 100 / (1 + rs)).toFixed(2)));
  }

  return rsi;
}

export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macdLine: (number | undefined)[]; signalLine: (number | undefined)[]; histogram: (number | undefined)[] } {
  const length = prices.length;
  const macdLine: (number | undefined)[] = Array(length).fill(undefined);
  const signalLine: (number | undefined)[] = Array(length).fill(undefined);
  const histogram: (number | undefined)[] = Array(length).fill(undefined);

  if (length < slowPeriod) {
    return { macdLine, signalLine, histogram };
  }

  const ema12 = calculateEMA(prices, fastPeriod);
  const ema26 = calculateEMA(prices, slowPeriod);

  // Compute MACD Line = EMA(12) - EMA(26)
  const tempMacd: number[] = [];
  for (let i = 0; i < length; i++) {
    const e12 = ema12[i];
    const e26 = ema26[i];
    if (e12 !== undefined && e26 !== undefined) {
      const val = e12 - e26;
      macdLine[i] = parseFloat(val.toFixed(4));
      tempMacd.push(val);
    } else {
      macdLine[i] = undefined;
      // Push 0 placeholder so index alignment matches prices
      tempMacd.push(0);
    }
  }

  // Compute Signal Line = EMA of MACD Line (over signal period)
  // We should start calculating Signal line from where MACD line becomes valid (which is at index slowPeriod - 1)
  const k = 2 / (signalPeriod + 1);
  let validStartIndex = -1;
  for (let i = 0; i < length; i++) {
    if (macdLine[i] !== undefined) {
      validStartIndex = i;
      break;
    }
  }

  if (validStartIndex !== -1 && length - validStartIndex >= signalPeriod) {
    let prevSignal = 0;
    let sum = 0;
    for (let j = 0; j < signalPeriod; j++) {
      sum += macdLine[validStartIndex + j] as number;
    }
    prevSignal = sum / signalPeriod;
    signalLine[validStartIndex + signalPeriod - 1] = parseFloat(prevSignal.toFixed(4));

    for (let i = validStartIndex + signalPeriod; i < length; i++) {
      const currentMacd = macdLine[i] as number;
      const currentSignal = currentMacd * k + prevSignal * (1 - k);
      signalLine[i] = parseFloat(currentSignal.toFixed(4));
      prevSignal = currentSignal;
    }
  }

  // Calculate histogram
  for (let i = 0; i < length; i++) {
    const m = macdLine[i];
    const s = signalLine[i];
    if (m !== undefined && s !== undefined) {
      histogram[i] = parseFloat((m - s).toFixed(4));
    }
  }

  return { macdLine, signalLine, histogram };
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: (number | undefined)[]; middle: (number | undefined)[]; lower: (number | undefined)[] } {
  const length = prices.length;
  const upper: (number | undefined)[] = Array(length).fill(undefined);
  const middle: (number | undefined)[] = Array(length).fill(undefined);
  const lower: (number | undefined)[] = Array(length).fill(undefined);

  const sma20 = calculateSMA(prices, period);

  for (let i = 0; i < length; i++) {
    const m = sma20[i];
    if (m !== undefined) {
      middle[i] = m;
      
      // Calculate standard deviation over the last 20 days
      let varianceSum = 0;
      for (let j = 0; j < period; j++) {
        varianceSum += Math.pow(prices[i - j] - m, 2);
      }
      const stdDev = Math.sqrt(varianceSum / period);
      upper[i] = parseFloat((m + stdDevMultiplier * stdDev).toFixed(2));
      lower[i] = parseFloat((m - stdDevMultiplier * stdDev).toFixed(2));
    }
  }

  return { upper, middle, lower };
}

export function augmentStockData(data: StockBar[]): ChartDataPoint[] {
  const prices = data.map(d => d.close);
  const smaFast = calculateSMA(prices, 12);
  const smaSlow = calculateSMA(prices, 26);
  const ema = calculateEMA(prices, 20);
  const rsi = calculateRSI(prices, 14);
  const { macdLine, signalLine, histogram } = calculateMACD(prices, 12, 26, 9);
  const bands = calculateBollingerBands(prices, 20, 2);

  return data.map((bar, i) => ({
    ...bar,
    smaFast: smaFast[i],
    smaSlow: smaSlow[i],
    ema: ema[i],
    rsi: rsi[i],
    macdLine: macdLine[i],
    macdSignal: signalLine[i],
    macdHist: histogram[i],
    bbandUpper: bands.upper[i],
    bbandMiddle: bands.middle[i],
    bbandLower: bands.lower[i],
  }));
}
