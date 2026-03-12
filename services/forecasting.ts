import { Bill, Product } from '../types'; // Import Bill (sale record) and Product (inventory item) types

// Shape of a single data point in a time-series forecast
export interface ForecastData {
  date: string;         // ISO date string (YYYY-MM-DD) for this forecast day
  predicted: number;    // Forecasted value — sales ₹ or units quantity
  actual?: number;      // Actual observed value if available (used for back-testing accuracy)
  confidence: number;   // Model confidence 0.0–1.0; higher = more reliable prediction
}

// Aggregated forecast result for one product across multiple future days
export interface ProductForecast {
  productId: number;                         // Unique product ID matching Product.id
  productName: string;                       // Display name of the product
  forecast: ForecastData[];                  // Day-by-day forecast array for forecastDays days
  trend: 'upward' | 'downward' | 'stable';  // Overall demand direction derived from regression slope
  avgDailySales: number;                     // Mean daily unit sales over the last 60 days of history
  totalUnitsForecasted: number;              // Sum of all predicted units across the forecast window
}

// Singleton service object — all forecasting algorithms live here as pure functions
export const ForecastingService = {
  /**
   * Calculates moving average for smoothing data
   */
  movingAverage: (data: number[], window: number): number[] => { // Smooth a numeric array using a sliding window average
    const result: number[] = []; // Accumulator for smoothed output values
    for (let i = 0; i < data.length; i++) { // Iterate over every index in the input array
      const start = Math.max(0, i - window + 1); // Clamp window start to index 0 so early points aren't skipped
      const slice = data.slice(start, i + 1); // Extract the current window of size ≤ window
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length; // Sum the window values and divide by actual window size
      result.push(avg); // Append the smoothed value for this index
    }
    return result; // Return smoothed array — same length as input
  },

  /**
   * Exponential Smoothing for forecasting
   */
  exponentialSmoothing: (data: number[], alpha: number = 0.3): number[] => { // Apply EMA (exponential moving average) with smoothing factor alpha
    if (data.length === 0) return []; // Guard: return empty array if no data to smooth
    const result: number[] = [data[0]]; // Seed result with the first data point as the initial EMA value
    
    for (let i = 1; i < data.length; i++) { // Process each subsequent data point
      const smoothed = alpha * data[i] + (1 - alpha) * result[i - 1]; // EMA formula: blend current value with previous smoothed value
      result.push(smoothed); // Append blended value to output
    }
    return result; // Return EMA-smoothed array — same length as input
  },

  /**
   * Linear regression for trend analysis
   */
  linearRegression: (data: number[]): { slope: number; intercept: number } => { // Fit a least-squares line y = slope*x + intercept to the data
    const n = data.length; // Total number of data points
    if (n === 0) return { slope: 0, intercept: 0 }; // Guard: return zero line when there is no data

    const x = Array.from({ length: n }, (_, i) => i); // Create x-axis indices [0, 1, 2, ..., n-1]
    const xMean = x.reduce((a, b) => a + b, 0) / n; // Compute mean of x values (always (n-1)/2)
    const yMean = data.reduce((a, b) => a + b, 0) / n; // Compute mean of y (data) values

    const numerator = x.reduce((sum, xi, i) => sum + (xi - xMean) * (data[i] - yMean), 0); // Sum of (xi − x̄)(yi − ȳ) — covariance numerator
    const denominator = x.reduce((sum, xi) => sum + (xi - xMean) ** 2, 0); // Sum of (xi − x̄)² — variance of x

    const slope = denominator === 0 ? 0 : numerator / denominator; // Slope = covariance / variance; guard against divide-by-zero
    const intercept = yMean - slope * xMean; // Intercept = ȳ − slope × x̄ (line passes through means)

    return { slope, intercept }; // Return both line parameters for extrapolation
  },

  /**
   * Calculate forecast accuracy (confidence level)
   */
  calculateConfidence: (data: number[], forecastwindow: number = 7): number => { // Derive a confidence score 0.3–0.95 based on data variability
    if (data.length < 2) return 0.5; // Not enough data to compute variability — return neutral confidence

    const mean = data.reduce((a, b) => a + b, 0) / data.length; // Arithmetic mean of the dataset
    const variance = data.reduce((sum, val) => sum + (val - mean) ** 2, 0) / data.length; // Population variance of the dataset
    const stdDev = Math.sqrt(variance); // Standard deviation — square root of variance

    // Confidence based on coefficient of variation
    const cv = mean === 0 ? 1 : stdDev / mean; // Coefficient of variation = stdDev / mean; use 1.0 if mean is zero
    const confidence = Math.max(0.3, Math.min(0.95, 1 - (cv / 2))); // Map CV to confidence: high variability → low confidence; clamp to [0.30, 0.95]

    return parseFloat(confidence.toFixed(2)); // Round to 2 decimal places and return
  },

  /**
   * Forecast sales for upcoming days
   */
  forecastSales: (bills: Bill[], days: number = 30): ForecastData[] => { // Generate a day-by-day sales forecast for the next `days` days
    const dailySales: { [key: string]: number } = {}; // Map of ISO date → total grandTotal ₹ for that day

    // Aggregate sales by day
    bills.forEach(bill => { // Loop over every historical bill
      const dateStr = bill.date.split('T')[0]; // Strip time component to get YYYY-MM-DD key
      dailySales[dateStr] = (dailySales[dateStr] || 0) + bill.grandTotal; // Accumulate total sales for this date
    });

    // Get last 60 days of data for trend analysis
    const sortedDates = Object.keys(dailySales).sort(); // Chronologically sorted list of unique sales dates
    const recentData = sortedDates.slice(Math.max(0, sortedDates.length - 60)); // Use only the most recent 60 days of history
    const recentSales = recentData.map(d => dailySales[d]); // Convert date keys to their corresponding sales values

    if (recentSales.length === 0) { // No historical data — return zeros for every forecasted day
      return Array.from({ length: days }, (_, i) => ({ // Build an array of `days` zero-prediction elements
        date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0], // Future date: today + i days (86400000 ms = 1 day)
        predicted: 0, // No data to learn from — predict zero sales
        confidence: 0, // Zero confidence because no history
      }));
    }

    // Get smoothed data for more stable forecast
    const smoothed = ForecastingService.exponentialSmoothing(recentSales, 0.3); // Smooth the sales history with EMA, alpha=0.3
    const { slope, intercept } = ForecastingService.linearRegression(smoothed); // Fit a trend line to the smoothed history

    // Generate forecast
    const forecast: ForecastData[] = []; // Output array of future day predictions
    const lastIndex = recentSales.length - 1; // Index of the last known data point in the history
    const baseConfidence = ForecastingService.calculateConfidence(recentSales); // Confidence score derived from historical variability

    for (let i = 1; i <= days; i++) { // Generate one entry per forecasted day
      const predictedValue = Math.max(0, intercept + slope * (lastIndex + i)); // Extrapolate the regression line; clamp to ≥ 0 (no negative sales)
      const dateStr = new Date(Date.now() + i * 86400000).toISOString().split('T')[0]; // Compute this future day's calendar date
      
      // Reduce confidence for distant future
      const confidenceDecay = Math.pow(0.98, i); // Geometric decay: confidence drops by 2% per additional day ahead
      const confidence = parseFloat((baseConfidence * confidenceDecay).toFixed(2)); // Apply decay to base confidence and round

      forecast.push({ // Append this day's prediction to the output array
        date: dateStr,                        // Forecasted date (YYYY-MM-DD)
        predicted: parseFloat(predictedValue.toFixed(2)), // Predicted ₹ sales rounded to 2 decimal places
        confidence: Math.max(0.3, confidence), // Clamp final confidence to minimum 0.30
      });
    }

    return forecast; // Return the complete day-by-day forecast array
  },

  /**
   * Forecast product-level demand
   */
  forecastProductDemand: ( // Generate per-product unit demand forecasts for all provided products
    bills: Bill[],            // Historical bills array used as the data source
    products: Product[],      // Full product catalogue — one forecast generated per product
    forecastDays: number = 30 // Number of future days to forecast; default 30
  ): ProductForecast[] => {
    const productSales: { [key: number]: { [key: string]: number } } = {}; // productId → (ISO date → total units sold)

    // Aggregate sales by product and date
    bills.forEach(bill => { // Iterate over each historical bill
      bill.items.forEach(item => { // Iterate over each line item within the bill
        if (!productSales[item.productId]) { // Initialise inner date-map on first encounter of this product
          productSales[item.productId] = {};
        }
        const dateStr = bill.date.split('T')[0]; // Get the bill date as YYYY-MM-DD
        productSales[item.productId][dateStr] =
          (productSales[item.productId][dateStr] || 0) + item.quantity; // Accumulate total units sold on this date for this product
      });
    });

    // Generate forecast for each product
    return (products
      .map(product => { // Process each product in the catalogue
        const dailySales = productSales[product.id] || {}; // Get date-keyed unit sales for this product (empty if none)
        const sortedDates = Object.keys(dailySales).sort(); // Sort the sale dates chronologically
        const recentData = sortedDates.slice(Math.max(0, sortedDates.length - 60)); // Use the last 60 sales days for trend fitting
        const recentQuantities = recentData.map(d => dailySales[d]); // Convert date keys to their unit quantities

        if (recentQuantities.length === 0) { // Product has no recorded sales — return a zero-prediction placeholder
          return {
            productId: product.id,            // Identify the product
            productName: product.name,         // Display name
            forecast: Array.from({ length: forecastDays }, (_, i) => ({ // Build array of zero-prediction entries
              date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split('T')[0], // Each future day starting tomorrow
              predicted: 0,   // No history → predict zero demand
              confidence: 0,  // No confidence without data
            })),
            trend: 'stable' as const, // Default to stable when there is nothing to analyse
            avgDailySales: 0,          // No average because no sales
            totalUnitsForecasted: 0,   // Zero units expected
          };
        }

        // Smooth and forecast
        const smoothed = ForecastingService.exponentialSmoothing(recentQuantities, 0.3); // EMA-smooth the unit quantity history
        const { slope, intercept } = ForecastingService.linearRegression(smoothed); // Fit a trend line to the smoothed quantities
        const baseConfidence = ForecastingService.calculateConfidence(recentQuantities); // Compute confidence from variability of raw data

        const forecast: ForecastData[] = []; // Accumulator for this product's day-by-day predictions
        let totalForecasted = 0; // Running total of all predicted units across the window
        const lastIndex = recentQuantities.length - 1; // Index of the last historical data point

        for (let i = 1; i <= forecastDays; i++) { // Generate one prediction per forecasted day
          const predicted = Math.max(0, Math.round(intercept + slope * (lastIndex + i))); // Extrapolate regression; round to whole units; clamp to ≥ 0
          totalForecasted += predicted; // Accumulate total forecasted units
          const dateStr = new Date(Date.now() + i * 86400000).toISOString().split('T')[0]; // Calendar date for this forecast day
          const confidenceDecay = Math.pow(0.98, i); // 2% confidence decay per day into future
          const confidence = parseFloat((baseConfidence * confidenceDecay).toFixed(2)); // Apply decay and round

          forecast.push({ // Append prediction for this day
            date: dateStr,                        // Forecasted date
            predicted,                            // Integer units predicted
            confidence: Math.max(0.3, confidence), // Floor confidence at 0.30
          });
        }

        const avgDaily =
          recentQuantities.reduce((a, b) => a + b, 0) / recentQuantities.length; // Mean daily units over the 60-day history window

        // Determine trend
        let trendValue: 'upward' | 'downward' | 'stable' = 'stable'; // Default trend classification
        if (slope > avgDaily * 0.05) trendValue = 'upward';          // Slope > 5% of average → growing demand
        else if (slope < -avgDaily * 0.05) trendValue = 'downward';  // Slope < −5% of average → declining demand

        return { // Assemble the complete ProductForecast object
          productId: product.id,                          // Product identifier
          productName: product.name,                      // Product display name
          forecast,                                       // Day-by-day prediction array
          trend: trendValue,                              // Classified demand direction
          avgDailySales: parseFloat(avgDaily.toFixed(2)), // Average daily units (2 decimal places)
          totalUnitsForecasted: totalForecasted,          // Total units expected across the window
        };
      })
      .filter(f => f.avgDailySales > 0 || f.totalUnitsForecasted > 0)) as ProductForecast[]; // Drop products with zero history AND zero forecast (never sold, never expected)
  },

  /**
   * Get demand recommendations
   */
  getDemandRecommendations: (forecastedProducts: ProductForecast[]) => { // Bucket products into high/low/stable demand categories for procurement advice
    const highDemand = forecastedProducts.filter( // Products trending upward with some sales activity
      p => p.trend === 'upward' && p.avgDailySales > 0
    );
    const lowDemand = forecastedProducts.filter( // Products trending downward with some sales activity
      p => p.trend === 'downward' && p.avgDailySales > 0
    );

    return {
      highDemand: highDemand.sort((a, b) => b.totalUnitsForecasted - a.totalUnitsForecasted), // Sort high-demand products by most units expected first
      lowDemand: lowDemand.sort((a, b) => a.totalUnitsForecasted - b.totalUnitsForecasted),   // Sort low-demand products by fewest units expected first
      stable: forecastedProducts.filter(p => p.trend === 'stable'), // All products with no significant slope change
    };
  },
};
