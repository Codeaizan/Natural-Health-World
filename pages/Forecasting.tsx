import React, { useEffect, useState } from 'react';
import { StorageService } from '../services/storage';
import { ForecastingService, ProductForecast, ForecastData } from '../services/forecasting';
import { Bill, Product } from '../types';
import { TrendingUp, TrendingDown, AlertCircle, BarChart3, Calendar } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const Forecasting: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [forecastedProducts, setForecastedProducts] = useState<ProductForecast[]>([]);
  const [generalForecast, setGeneralForecast] = useState<ForecastData[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductForecast | null>(null);
  const [forecastDays, setForecastDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const billsData = StorageService.getBills();
    const productsData = StorageService.getProducts();

    setBills(billsData);
    setProducts(productsData);

    // Generate forecasts
    const productForecasts = ForecastingService.forecastProductDemand(
      billsData,
      productsData,
      forecastDays
    );
    setForecastedProducts(productForecasts);

    const generalForecastData = ForecastingService.forecastSales(billsData, forecastDays);
    setGeneralForecast(generalForecastData);

    if (productForecasts.length > 0) {
      setSelectedProduct(productForecasts[0]);
    }

    setLoading(false);
  }, [forecastDays]);

  const recommendations = ForecastingService.getDemandRecommendations(forecastedProducts);

  // Prepare chart data for general forecast
  const generalChartData = generalForecast.map(d => ({
    date: d.date,
    predicted: parseFloat(d.predicted.toFixed(2)),
    confidence: (d.confidence * 100).toFixed(0),
  }));

  // Prepare chart data for selected product forecast
  const productChartData = selectedProduct?.forecast.slice(0, forecastDays).map((f) => ({
    date: f.date,
    predicted: f.predicted,
    confidence: (f.confidence * 100).toFixed(0),
  })) || [];

  const StatCard = ({ label, value, trend, color }: any) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <p className="text-sm text-gray-600 font-medium">{label}</p>
      <div className="flex items-baseline justify-between mt-2">
        <p className="text-2xl font-bold">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${color}`}>
            {trend === 'upward' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          </div>
        )}
      </div>
    </div>
  );

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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sales Forecasting</h1>
          <p className="text-gray-600 mt-2">Predict demand using historical sales trends</p>
        </div>

        {/* Forecast Period Selector */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Forecast Period (Days)
          </label>
          <div className="flex gap-3">
            {[7, 14, 30, 60, 90].map(days => (
              <button
                key={days}
                onClick={() => setForecastDays(days)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  forecastDays === days
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Forecasted Revenue"
            value={`₹${generalForecast
              .reduce((sum, d) => sum + d.predicted, 0)
              .toFixed(0)}`}
            trend="upward"
            color="text-green-600"
          />
          <StatCard
            label="Avg Daily Revenue"
            value={`₹${(
              generalForecast.reduce((sum, d) => sum + d.predicted, 0) / generalForecast.length
            ).toFixed(0)}`}
          />
          <StatCard
            label="Products Tracked"
            value={forecastedProducts.length}
          />
          <StatCard
            label="High Demand Items"
            value={recommendations.highDemand.length}
            trend="upward"
            color="text-green-600"
          />
        </div>

        {/* General Sales Forecast Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Overall Sales Forecast</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={generalChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: any) => [
                  typeof value === 'number' ? `₹${value.toFixed(0)}` : value,
                  'Revenue',
                ]}
              />
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

        {/* Product-Level Forecasting */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Products</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {forecastedProducts.map(product => (
                <button
                  key={product.productId}
                  onClick={() => setSelectedProduct(product)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedProduct?.productId === product.productId
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900 truncate">{product.productName}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500">
                      {product.avgDailySales.toFixed(0)} units/day
                    </p>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        product.trend === 'upward'
                          ? 'bg-green-100 text-green-800'
                          : product.trend === 'downward'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
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

          {/* Product Forecast Chart */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            {selectedProduct ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {selectedProduct.productName} - Demand Forecast
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} label={{ value: 'Units', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value: any) => [value, 'Units']} />
                    <Bar dataKey="predicted" fill="#3b82f6" name="Predicted Demand" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Total Forecasted Units:</span>{' '}
                    {selectedProduct.totalUnitsForecasted}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Avg Daily Demand:</span>{' '}
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

        {/* Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* High Demand */}
          <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-green-600" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">High Demand</h3>
            </div>
            <div className="space-y-2">
              {recommendations.highDemand.slice(0, 5).map(product => (
                <div key={product.productId} className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-gray-900">{product.productName}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {product.totalUnitsForecasted} units in {forecastDays} days
                  </p>
                </div>
              ))}
              {recommendations.highDemand.length === 0 && (
                <p className="text-sm text-gray-500">No high-demand items identified</p>
              )}
            </div>
          </div>

          {/* Low Demand */}
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="text-red-600" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">Low Demand</h3>
            </div>
            <div className="space-y-2">
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

          {/* Stable Demand */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-gray-600" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">Stable Demand</h3>
            </div>
            <div className="space-y-2">
              {recommendations.stable.slice(0, 5).map(product => (
                <div key={product.productId} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{product.productName}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {product.totalUnitsForecasted} units in {forecastDays} days
                  </p>
                </div>
              ))}
              {recommendations.stable.length === 0 && (
                <p className="text-sm text-gray-500">No stable-demand items</p>
              )}
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <div className="flex gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Forecasting Insights</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>
                  • Forecasts are based on {Math.min(60, bills.length)} days of historical sales data
                </li>
                <li>• Accuracy decreases for longer forecast periods - confidence scores are shown in charts</li>
                <li>• High-demand items should have prioritized stock and supply planning</li>
                <li>• Consider seasonal patterns and external factors when making decisions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Forecasting;
