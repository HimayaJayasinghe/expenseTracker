import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const DashboardPage = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [budgetDashboard, setBudgetDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryResponse, budgetResponse] = await Promise.all([
        apiClient.getMonthlyExpenseSummary(),
        apiClient.getBudgetDashboard()
      ]);
      
      setMonthlySummary(summaryResponse.data);
      setBudgetDashboard(budgetResponse.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingSpinner size="lg" className="mt-20" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="text-3xl mr-4">💰</div>
            <div>
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {monthlySummary?.summary?.formattedTotalSpending || '$0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="text-3xl mr-4">📊</div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900">
                {monthlySummary?.summary?.totalExpenses || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="text-3xl mr-4">📅</div>
            <div>
              <p className="text-sm font-medium text-gray-600">Daily Average</p>
              <p className="text-2xl font-bold text-gray-900">
                {monthlySummary?.summary?.formattedAveragePerDay || '$0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="text-3xl mr-4">📋</div>
            <div>
              <p className="text-sm font-medium text-gray-600">Active Budgets</p>
              <p className="text-2xl font-bold text-gray-900">
                {budgetDashboard?.summary?.totalBudgets || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Comparison */}
        {monthlySummary?.comparison && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Comparison</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">This Month</span>
                <span className="font-semibold">
                  {monthlySummary.summary.formattedTotalSpending}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Last Month</span>
                <span className="font-semibold">
                  {monthlySummary.comparison.previousMonth.formattedTotal}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Change</span>
                <span className={`font-semibold ${
                  monthlySummary.comparison.monthOverMonthChange > 0 
                    ? 'text-red-600' 
                    : monthlySummary.comparison.monthOverMonthChange < 0 
                    ? 'text-green-600' 
                    : 'text-gray-600'
                }`}>
                  {monthlySummary.comparison.monthOverMonthChange > 0 ? '+' : ''}
                  {monthlySummary.comparison.monthOverMonthChange.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Top Categories */}
        {monthlySummary?.breakdown?.categoryBreakdown && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Categories</h3>
            <div className="space-y-3">
              {monthlySummary.breakdown.categoryBreakdown.slice(0, 5).map((category) => (
                <div key={category._id} className="flex justify-between items-center">
                  <span className="text-gray-600 capitalize">{category._id}</span>
                  <div className="text-right">
                    <div className="font-semibold">{category.formattedAmount}</div>
                    <div className="text-sm text-gray-500">{category.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Budget Status */}
        {budgetDashboard?.dashboardData && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Status</h3>
            <div className="space-y-4">
              {budgetDashboard.dashboardData.slice(0, 5).map((budgetItem) => (
                <div key={budgetItem.budget._id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 capitalize">{budgetItem.budget.category}</span>
                    <span className="text-sm font-medium">
                      {budgetItem.spending.formattedTotalSpent} / {budgetItem.budget.formattedAmount}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(budgetItem.visualIndicator.progressBarWidth, 100)}%`,
                        backgroundColor: budgetItem.visualIndicator.color
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {budgetItem.visualIndicator.statusMessage}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        {monthlySummary?.insights && monthlySummary.insights.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Insights</h3>
            <div className="space-y-4">
              {monthlySummary.insights.map((insight, index) => (
                <div key={index} className={`p-4 rounded-lg border ${
                  insight.level === 'warning' ? 'bg-red-50 border-red-200' :
                  insight.level === 'caution' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <h4 className="font-medium text-gray-900">{insight.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{insight.message}</p>
                  {insight.value && (
                    <span className="inline-block mt-2 text-sm font-semibold text-gray-900">
                      {insight.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;