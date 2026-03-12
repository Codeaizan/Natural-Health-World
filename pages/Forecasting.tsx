import React, { useEffect, useState } from 'react';                          // React hooks
import { StorageService } from '../services/storage';                         // Database access  
import { ForecastingService, ProductForecast, ForecastData } from '../services/forecasting';  // Forecasting calculations
import { Bill } from '../types';                                              // Bill type definition
import { TrendingUp, TrendingDown, AlertCircle, BarChart3, Calendar } from 'lucide-react';  // Icons for charts and trends
import {
  LineChart,                                                                  // Line chart component
  Line,                                                                       // Line series
  BarChart,                                                                   // Bar chart component  
  Bar,                                                                        // Bar series
  XAxis,                                                                      // X axis
  YAxis,                                                                      // Y axis
  CartesianGrid,                                                              // Grid background
  Tooltip,                                                                    // Hover tooltips
  ResponsiveContainer,                                                        // Responsive wrapper
} from 'recharts';

const Forecasting: React.FC = () => {
  // Historical bills data for trend analysis
  const [bills, setBills] = useState<Bill[]>([]);
  // Product-level forecasts with demand predictions
  const [forecastedProducts, setForecastedProducts] = useState<ProductForecast[]>([]);
  // Overall sales forecast data (general trend)
  const [generalForecast, setGeneralForecast] = useState<ForecastData[]>([]);
  // Currently selected product for detailed view
  const [selectedProduct, setSelectedProduct] = useState<ProductForecast | null>(null);
  // Number of days to forecast ahead (7/14/30/60/90 options)
  const [forecastDays, setForecastDays] = useState(30);
  // Loading state during data fetch
  const [loading, setLoading] = useState(true);

  // === LIFECYCLE: Load bills and generate forecasts on mount and when forecast period changes ===
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);  // Show loading spinner
      try {
        // Fetch all bills and products from database
        const billsData = await StorageService.getBills();
        const productsData = await StorageService.getProducts();

        setBills(billsData);  // Store bills for insights display

        // Generate product-level forecasts (demand for each product over forecast period)
        const productForecasts = ForecastingService.forecastProductDemand(
          billsData,
          productsData,
          forecastDays
        );
        setForecastedProducts(productForecasts);

        // Generate overall sales forecast (total revenue trend)
        const generalForecastData = ForecastingService.forecastSales(billsData, forecastDays);
        setGeneralForecast(generalForecastData);

        // Auto-select first product if data exists
        if (productForecasts.length > 0) {
          setSelectedProduct(productForecasts[0]);
        }
      } catch (err) {
        console.error('Error loading forecasting data:', err);  // Log errors
      } finally {
        setLoading(false);  // Always hide loading spinner
      }
    };

    loadData();
  }, [forecastDays]);  // Reload when forecast period changes

  // Calculate demand recommendations (high/low/stable demand categories)
  const recommendations = ForecastingService.getDemandRecommendations(forecastedProducts);

  // === CHART DATA PREP: Transform forecast data for Recharts ===
  // Prepare general sales forecast for line chart display
  const generalChartData = generalForecast.map(d => ({
    date: d.date,  // Date label
    predicted: parseFloat(d.predicted.toFixed(2)),  // Forecasted revenue (rounded)
    confidence: Math.round(d.confidence * 100),  // Confidence percentage (0-100)
  }));

  // Prepare selected product forecast for bar chart display
  const productChartData = selectedProduct?.forecast.slice(0, forecastDays).map((f) => ({
    date: f.date,  // Date label
    predicted: f.predicted,  // Forecasted unit quantity
    confidence: Math.round(f.confidence * 100),  // Confidence percentage
  })) || [];

  // === COMPONENT: Stat card for displaying KPI values with trend ===
  const StatCard = ({ label, value, trend, color }: any) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      {/* Card label/title */}
      <p className="text-sm text-gray-600 font-medium">{label}</p>
      <div className="flex items-baseline justify-between mt-2">
        {/* Metric value (revenue, count, etc) */}
        <p className="text-2xl font-bold">{value}</p>
        {/* Optional trend indicator (up/down arrows if applicable) */}
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${color}`}>
            {trend === 'upward' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          </div>
        )}
      </div>
    </div>
  );

  // Show loading spinner while fetching forecast data
  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Generating forecasts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* === PAGE HEADER === */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sales Forecasting</h1>
          <p className="text-gray-600 mt-2">Predict demand using historical sales trends</p>
        </div>

        {/* === FORECAST PERIOD SELECTOR === Allow user to choose prediction window (7-90 days) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Forecast Period (Days)
          </label>
          {/* Quick-select buttons for common forecast periods */}
          <div className="flex gap-3">
            {[7, 14, 30, 60, 90].map(days => (
              <button
                key={days}
                onClick={() => setForecastDays(days)}  // Trigger data reload with new period
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  forecastDays === days
                    ? 'bg-blue-600 text-white border-blue-600'  // Active button (blue)
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'  // Inactive button
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {/* === OVERVIEW STATISTICS === 4 KPI cards for high-level forecast metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Total forecasted revenue for all products over forecast period */}
          <StatCard
            label="Total Forecasted Revenue"
            value={`₹${generalForecast
              .reduce((sum, d) => sum + d.predicted, 0)
              .toFixed(0)}`}
            trend="upward"
            color="text-green-600"
          />
          {/* Average daily revenue from forecasts */}
          <StatCard
            label="Avg Daily Revenue"
            value={`₹${(
              generalForecast.length > 0
                ? generalForecast.reduce((sum, d) => sum + d.predicted, 0) / generalForecast.length
                : 0
            ).toFixed(0)}`}
          />
          {/* Number of products with demand forecasts */}
          <StatCard
            label="Products Tracked"
            value={forecastedProducts.length}
          />
          {/* Count of products identified as high-demand */}
          <StatCard
            label="High Demand Items"
            value={recommendations.highDemand.length}
            trend="upward"
            color="text-green-600"
          />
        </div>

        {/* === GENERAL SALES FORECAST CHART === Line chart showing overall revenue trend over forecast period */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Overall Sales Forecast</h2>
          </div>
          {/* Line chart: predicted daily revenue trend */}
          <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
            <LineChart data={generalChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: any) => [
                  typeof value === 'number' ? `₹${value.toFixed(0)}` : value,  // Format as currency
                  'Revenue',
                ]}
              />
              {/* Blue line showing predicted sales trend */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Predicted Sales"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* === PRODUCT-LEVEL FORECASTING === 3-column layout: product list (left) + selected product forecast chart (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* === PRODUCT LIST (left column) === Scrollable list of all forecasted products */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Products</h3>
            {/* Scrollable product list with selection state */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {/* Map each forecasted product to clickable button */}
              {forecastedProducts.map(product => (
                <button
                  key={product.productId}
                  onClick={() => setSelectedProduct(product)}  // Select product for detail view
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedProduct?.productId === product.productId
                      ? 'bg-blue-50 border-blue-300'  // Selected product (blue background)
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'  // Unselected products
                  }`}
                >
                  {/* Product name */}
                  <p className="font-medium text-gray-900 truncate">{product.productName}</p>
                  <div className="flex items-center justify-between mt-1">
                    {/* Average daily sales volume */}
                    <p className="text-xs text-gray-500">
                      {product.avgDailySales.toFixed(0)} units/day
                    </p>
                    {/* Trend indicator (upward/downward/stable with icon and color) */}
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        product.trend === 'upward'
                          ? 'bg-green-100 text-green-800'  // Green for uptrend
                          : product.trend === 'downward'
                          ? 'bg-red-100 text-red-800'  // Red for downtrend
                          : 'bg-gray-100 text-gray-800'  // Gray for stable
                      }`}
                    >
                      {product.trend === 'upward' && <TrendingUp size={12} className="mr-1" />}
                      {product.trend === 'downward' && <TrendingDown size={12} className="mr-1" />}
                      {product.trend}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* === PRODUCT FORECAST DETAIL (right 2 columns) === Bar chart showing demand prediction for selected product */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            {selectedProduct ? (
              <>
                {/* Product name + forecast type label */}
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {selectedProduct.productName} - Demand Forecast
                </h3>
                {/* Bar chart: predicted units by date */}
                <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
                  <BarChart data={productChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} label={{ value: 'Units', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value: any) => [value, 'Units']} />
                    {/* Blue bars showing forecasted unit quantities */}
                    <Bar dataKey="predicted" fill="#3b82f6" name="Predicted Demand" />
                  </BarChart>
                </ResponsiveContainer>
                {/* Summary metrics for selected product */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Total Forecasted Units:</span> {/* Total units for entire forecast period */}
                    {' '}
                    {selectedProduct.totalUnitsForecasted}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Avg Daily Demand:</span> {/* Daily average from historical trends */}
                    {' '}
                    {selectedProduct.avgDailySales.toFixed(1)} units
                  </p>
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-gray-500">Select a product to view forecast</p>
              </div>
            )}
          </div>
        </div>

        {/* === DEMAND RECOMMENDATIONS === 3-column categorization recommendations and actionable insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* === HIGH DEMAND PRODUCTS === Stock prioritization needed for items trending up in demand */}
          <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-green-600" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">High Demand</h3>
            </div>
            <div className="space-y-2">
              {/* List top 5 high-demand products with forecast units */}
              {recommendations.highDemand.slice(0, 5).map(product => (
                <div key={product.productId} className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-gray-900">{product.productName}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {product.totalUnitsForecasted} units in {forecastDays} days
                  </p>
                </div>
              ))}
              {/* Empty state */}
              {recommendations.highDemand.length === 0 && (
                <p className="text-sm text-gray-500">No high-demand items identified</p>
              )}
            </div>
          </div>

          {/* === LOW DEMAND PRODUCTS === Clearance opportunity or reduce stock for slow-moving items */}
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="text-red-600" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">Low Demand</h3>
            </div>
            <div className="space-y-2">
              {/* List top 5 low-demand products with forecast units */}
              {recommendations.lowDemand.slice(0, 5).map(product => (
                <div key={product.productId} className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm font-medium text-gray-900">{product.productName}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {product.totalUnitsForecasted} units in {forecastDays} days
                  </p>
                </div>
              ))}
              {recommendations.lowDemand.length === 0 && (
                <p className="text-sm text-gray-500">No low-demand items identified</p>
              )}
            </div>
          </div>

          {/* === STABLE DEMAND PRODUCTS === Consistent sellers with predictable market performance */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-gray-600" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">Stable Demand</h3>
            </div>
            <div className="space-y-2">
              {/* List top 5 stable-demand products with forecast units */}
              {recommendations.stable.slice(0, 5).map(product => (
                <div key={product.productId} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{product.productName}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {product.totalUnitsForecasted} units in {forecastDays} days
                  </p>
                </div>
              ))}
              {/* Empty state */}
              {recommendations.stable.length === 0 && (
                <p className="text-sm text-gray-500">No stable-demand items</p>
              )}
            </div>
          </div>
        </div>

        {/* === INSIGHTS BOX === Educational information about forecasting accuracy and best practices */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <div className="flex gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />  {/* Info icon */}
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Forecasting Insights</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                {/* Note about data basis */}
                <li>
                  • Forecasts are based on {Math.min(60, bills.length)} days of historical sales data
                </li>
                {/* Accuracy disclaimer */}
                <li>• Accuracy decreases for longer forecast periods - confidence scores are shown in charts</li>
                {/* Action item: high-demand prioritization */}
                <li>• High-demand items should have prioritized stock and supply planning</li>
                {/* External factors consideration */}
                <li>• Consider seasonal patterns and external factors when making decisions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// === COMPONENT EXPORT === Sales forecasting and demand prediction page component
export default Forecasting;
