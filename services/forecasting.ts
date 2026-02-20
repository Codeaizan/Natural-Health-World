import { Bill, Product } from '../types';

export interface ForecastData {
  date: string;
  predicted: number;
  actual?: number;
  confidence: number;
}

export interface ProductForecast {
  productId: number;
  productName: string;
  forecast: ForecastData[];
  trend: 'upward' | 'downward' | 'stable';
  avgDailySales: number;
  totalUnitsForecasted: number;
}

export const ForecastingService = {
  /**
   * Calculates moving average for smoothing data
   */
  movingAverage: (data: number[], window: number): number[] => {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - window + 1);
      const slice = data.slice(start, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      result.push(avg);
    }
    return result;
  },

  /**
   * Exponential Smoothing for forecasting
   */
  exponentialSmoothing: (data: number[], alpha: number = 0.3): number[] => {
    if (data.length === 0) return [];
    const result: number[] = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      const smoothed = alpha * data[i] + (1 - alpha) * result[i - 1];
      result.push(smoothed);
    }
    return result;
  },

  /**
   * Linear regression for trend analysis
   */
  linearRegression: (data: number[]): { slope: number; intercept: number } => {
    const n = data.length;
    if (n === 0) return { slope: 0, intercept: 0 };

    const x = Array.from({ length: n }, (_, i) => i);
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = data.reduce((a, b) => a + b, 0) / n;

    const numerator = x.reduce((sum, xi, i) => sum + (xi - xMean) * (data[i] - yMean), 0);
    const denominator = x.reduce((sum, xi) => sum + (xi - xMean) ** 2, 0);

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;

    return { slope, intercept };
  },

  /**
   * Calculate forecast accuracy (confidence level)
   */
  calculateConfidence: (data: number[], forecastwindow: number = 7): number => {
    if (data.length < 2) return 0.5;

    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + (val - mean) ** 2, 0) / data.length;
    const stdDev = Math.sqrt(variance);

    // Confidence based on coefficient of variation
    const cv = mean === 0 ? 1 : stdDev / mean;
    const confidence = Math.max(0.3, Math.min(0.95, 1 - (cv / 2)));

    return parseFloat(confidence.toFixed(2));
  },

  /**
   * Forecast sales for upcoming days
   */
  forecastSales: (bills: Bill[], days: number = 30): ForecastData[] => {
    const dailySales: { [key: string]: number } = {};

    // Aggregate sales by day
    bills.forEach(bill => {
      const dateStr = bill.date.split('T')[0];
      dailySales[dateStr] = (dailySales[dateStr] || 0) + bill.grandTotal;
    });

    // Get last 60 days of data for trend analysis
    const sortedDates = Object.keys(dailySales).sort();
    const recentData = sortedDates.slice(Math.max(0, sortedDates.length - 60));
    const recentSales = recentData.map(d => dailySales[d]);

    if (recentSales.length === 0) {
      return Array.from({ length: days }, (_, i) => ({
        date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
        predicted: 0,
        confidence: 0,
      }));
    }

    // Get smoothed data for more stable forecast
    const smoothed = ForecastingService.exponentialSmoothing(recentSales, 0.3);
    const { slope, intercept } = ForecastingService.linearRegression(smoothed);

    // Generate forecast
    const forecast: ForecastData[] = [];
    const lastIndex = recentSales.length - 1;
    const baseConfidence = ForecastingService.calculateConfidence(recentSales);

    for (let i = 1; i <= days; i++) {
      const predictedValue = Math.max(0, intercept + slope * (lastIndex + i));
      const dateStr = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
      
      // Reduce confidence for distant future
      const confidenceDecay = Math.pow(0.98, i);
      const confidence = parseFloat((baseConfidence * confidenceDecay).toFixed(2));

      forecast.push({
        date: dateStr,
        predicted: parseFloat(predictedValue.toFixed(2)),
        confidence: Math.max(0.3, confidence),
      });
    }

    return forecast;
  },

  /**
   * Forecast product-level demand
   */
  forecastProductDemand: (
    bills: Bill[],
    products: Product[],
    forecastDays: number = 30
  ): ProductForecast[] => {
    const productSales: { [key: number]: { [key: string]: number } } = {};

    // Aggregate sales by product and date
    bills.forEach(bill => {
      bill.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {};
        }
        const dateStr = bill.date.split('T')[0];
        productSales[item.productId][dateStr] =
          (productSales[item.productId][dateStr] || 0) + item.quantity;
      });
    });

    // Generate forecast for each product
    return (products
      .map(product => {
        const dailySales = productSales[product.id] || {};
        const sortedDates = Object.keys(dailySales).sort();
        const recentData = sortedDates.slice(Math.max(0, sortedDates.length - 60));
        const recentQuantities = recentData.map(d => dailySales[d]);

        if (recentQuantities.length === 0) {
          return {
            productId: product.id,
            productName: product.name,
            forecast: Array.from({ length: forecastDays }, (_, i) => ({
              date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split('T')[0],
              predicted: 0,
              confidence: 0,
            })),
            trend: 'stable' as const,
            avgDailySales: 0,
            totalUnitsForecasted: 0,
          };
        }

        // Smooth and forecast
        const smoothed = ForecastingService.exponentialSmoothing(recentQuantities, 0.3);
        const { slope, intercept } = ForecastingService.linearRegression(smoothed);
        const baseConfidence = ForecastingService.calculateConfidence(recentQuantities);

        const forecast: ForecastData[] = [];
        let totalForecasted = 0;
        const lastIndex = recentQuantities.length - 1;

        for (let i = 1; i <= forecastDays; i++) {
          const predicted = Math.max(0, Math.round(intercept + slope * (lastIndex + i)));
          totalForecasted += predicted;
          const dateStr = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
          const confidenceDecay = Math.pow(0.98, i);
          const confidence = parseFloat((baseConfidence * confidenceDecay).toFixed(2));

          forecast.push({
            date: dateStr,
            predicted,
            confidence: Math.max(0.3, confidence),
          });
        }

        const avgDaily =
          recentQuantities.reduce((a, b) => a + b, 0) / recentQuantities.length;

        // Determine trend
        let trendValue: 'upward' | 'downward' | 'stable' = 'stable';
        if (slope > avgDaily * 0.05) trendValue = 'upward';
        else if (slope < -avgDaily * 0.05) trendValue = 'downward';

        return {
          productId: product.id,
          productName: product.name,
          forecast,
          trend: trendValue,
          avgDailySales: parseFloat(avgDaily.toFixed(2)),
          totalUnitsForecasted: totalForecasted,
        };
      })
      .filter(f => f.avgDailySales > 0 || f.totalUnitsForecasted > 0)) as ProductForecast[];
  },

  /**
   * Get demand recommendations
   */
  getDemandRecommendations: (forecastedProducts: ProductForecast[]) => {
    const highDemand = forecastedProducts.filter(
      p => p.trend === 'upward' && p.avgDailySales > 0
    );
    const lowDemand = forecastedProducts.filter(
      p => p.trend === 'downward' && p.avgDailySales > 0
    );

    return {
      highDemand: highDemand.sort((a, b) => b.totalUnitsForecasted - a.totalUnitsForecasted),
      lowDemand: lowDemand.sort((a, b) => a.totalUnitsForecasted - b.totalUnitsForecasted),
      stable: forecastedProducts.filter(p => p.trend === 'stable'),
    };
  },
};
