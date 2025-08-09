import Expense from '../models/Expense.js';
import mongoose from 'mongoose';

// Add new expense
const addExpense = async (req, res) => {
  try {
    const { description, amount, category, date } = req.body;

    // Create new expense
    const expense = new Expense({
      user: req.user.userId,
      description,
      amount,
      category,
      date: date ? new Date(date) : new Date()
    });

    await expense.save();

    // Populate user info and return
    await expense.populate('user', 'username firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Expense added successfully',
      data: { expense }
    });

  } catch (error) {
    console.error('Add expense error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all expenses for authenticated user with advanced filtering
const getExpenses = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      startDate, 
      endDate, 
      sortBy = 'date', 
      sortOrder = 'desc',
      search,
      minAmount,
      maxAmount
    } = req.query;

    // Build filter object
    const filter = { user: req.user.userId };

    // Category filter
    if (category && category !== 'all') {
      filter.category = category.toLowerCase();
    }

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        filter.date.$lte = endOfDay;
      }
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
    }

    // Search filter (description)
    if (search) {
      filter.description = { $regex: search, $options: 'i' };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get expenses with pagination
    const expenses = await Expense.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'username firstName lastName');

    // Get total count for pagination
    const total = await Expense.countDocuments(filter);

    // Calculate summary statistics
    const summaryStats = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          minAmount: { $min: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const summary = summaryStats.length > 0 ? summaryStats[0] : {
      totalAmount: 0,
      avgAmount: 0,
      maxAmount: 0,
      minAmount: 0,
      count: 0
    };

    // Get category breakdown
    const categoryBreakdown = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        expenses,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalExpenses: total,
          hasNext: skip + expenses.length < total,
          hasPrev: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        summary: {
          ...summary,
          formattedTotalAmount: `$${summary.totalAmount.toFixed(2)}`,
          formattedAvgAmount: `$${summary.avgAmount.toFixed(2)}`,
          formattedMaxAmount: `$${summary.maxAmount.toFixed(2)}`,
          formattedMinAmount: `$${summary.minAmount.toFixed(2)}`
        },
        categoryBreakdown,
        filters: {
          category,
          startDate,
          endDate,
          search,
          minAmount,
          maxAmount,
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get available categories for the user
const getExpenseCategories = async (req, res) => {
  try {
    const categories = await Expense.distinct('category', { user: req.user.userId });
    
    // Get predefined categories from the schema
    const allCategories = [
      'groceries',
      'utilities', 
      'transportation',
      'entertainment',
      'healthcare',
      'dining',
      'shopping',
      'education',
      'travel',
      'housing',
      'insurance',
      'savings',
      'other'
    ];

    res.json({
      success: true,
      data: {
        userCategories: categories,
        allCategories,
        categoriesWithData: categories.length
      }
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get expense date range for the user
const getExpenseDateRange = async (req, res) => {
  try {
    const dateRange = await Expense.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.user.userId) } },
      {
        $group: {
          _id: null,
          earliestDate: { $min: '$date' },
          latestDate: { $max: '$date' }
        }
      }
    ]);

    if (dateRange.length === 0) {
      return res.json({
        success: true,
        data: {
          earliestDate: null,
          latestDate: null,
          hasExpenses: false
        }
      });
    }

    res.json({
      success: true,
      data: {
        earliestDate: dateRange[0].earliestDate,
        latestDate: dateRange[0].latestDate,
        hasExpenses: true
      }
    });

  } catch (error) {
    console.error('Get date range error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single expense by ID
const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expense ID'
      });
    }

    const expense = await Expense.findOne({
      _id: id,
      user: req.user.userId
    }).populate('user', 'username firstName lastName');

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      data: { expense }
    });

  } catch (error) {
    console.error('Get expense by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update expense
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, amount, category, date } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expense ID'
      });
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: id, user: req.user.userId },
      {
        ...(description && { description }),
        ...(amount && { amount }),
        ...(category && { category }),
        ...(date && { date: new Date(date) })
      },
      { new: true, runValidators: true }
    ).populate('user', 'username firstName lastName');

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: { expense }
    });

  } catch (error) {
    console.error('Update expense error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete expense
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expense ID'
      });
    }

    const expense = await Expense.findOneAndDelete({
      _id: id,
      user: req.user.userId
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });

  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get expense statistics
const getExpenseStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build match filter
    const matchFilter = { user: new mongoose.Types.ObjectId(req.user.userId) };

    if (startDate || endDate) {
      matchFilter.date = {};
      if (startDate) matchFilter.date.$gte = new Date(startDate);
      if (endDate) matchFilter.date.$lte = new Date(endDate);
    }

    // Aggregate statistics
    const stats = await Expense.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Get overall totals
    const overallStats = await Expense.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalExpenses: { $sum: 1 },
          avgExpense: { $avg: '$amount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        categoryStats: stats,
        overallStats: overallStats[0] || {
          totalAmount: 0,
          totalExpenses: 0,
          avgExpense: 0
        }
      }
    });

  } catch (error) {
    console.error('Get expense stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get monthly expense summary and insights
const getMonthlyExpenseSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    // Default to current month/year if not provided
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    // Calculate date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const currentDay = new Date().getDate();
    const isCurrentMonth = targetMonth === currentDate.getMonth() + 1 && targetYear === currentDate.getFullYear();

    // Get all expenses for the month
    const expenses = await Expense.find({
      user: new mongoose.Types.ObjectId(req.user.userId),
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 });

    // Calculate basic statistics
    const totalExpenses = expenses.length;
    const totalSpending = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const averagePerExpense = totalExpenses > 0 ? totalSpending / totalExpenses : 0;
    const averagePerDay = isCurrentMonth 
      ? totalSpending / currentDay 
      : totalSpending / daysInMonth;

    // Category breakdown
    const categoryBreakdown = await Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.userId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Daily spending pattern
    const dailySpending = await Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.userId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: '$date' },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Weekly spending pattern
    const weeklySpending = await Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.userId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $week: '$date' },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Top 5 highest expenses
    const topExpenses = expenses
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Compare with previous month
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
    const prevStartDate = new Date(prevYear, prevMonth - 1, 1);
    const prevEndDate = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);

    const prevMonthStats = await Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.userId),
          date: { $gte: prevStartDate, $lte: prevEndDate }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const prevMonthTotal = prevMonthStats.length > 0 ? prevMonthStats[0].totalAmount : 0;
    const monthOverMonthChange = prevMonthTotal > 0 
      ? ((totalSpending - prevMonthTotal) / prevMonthTotal) * 100 
      : 0;

    // Generate insights
    const insights = generateSpendingInsights({
      totalSpending,
      averagePerDay,
      categoryBreakdown,
      monthOverMonthChange,
      daysInMonth,
      isCurrentMonth,
      currentDay,
      topExpenses
    });

    res.json({
      success: true,
      data: {
        summary: {
          month: targetMonth,
          year: targetYear,
          monthName: new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' }),
          totalSpending,
          totalExpenses,
          averagePerExpense,
          averagePerDay,
          daysInMonth,
          daysTracked: isCurrentMonth ? currentDay : daysInMonth,
          formattedTotalSpending: `$${totalSpending.toFixed(2)}`,
          formattedAveragePerExpense: `$${averagePerExpense.toFixed(2)}`,
          formattedAveragePerDay: `$${averagePerDay.toFixed(2)}`
        },
        comparison: {
          previousMonth: {
            month: prevMonth,
            year: prevYear,
            totalSpending: prevMonthTotal,
            formattedTotal: `$${prevMonthTotal.toFixed(2)}`
          },
          monthOverMonthChange: Math.round(monthOverMonthChange * 100) / 100,
          changeType: monthOverMonthChange > 0 ? 'increase' : monthOverMonthChange < 0 ? 'decrease' : 'no_change'
        },
        breakdown: {
          categoryBreakdown: categoryBreakdown.map(cat => ({
            ...cat,
            percentage: Math.round((cat.totalAmount / totalSpending) * 10000) / 100,
            formattedAmount: `$${cat.totalAmount.toFixed(2)}`,
            formattedAvg: `$${cat.avgAmount.toFixed(2)}`
          })),
          dailySpending,
          weeklySpending,
          topExpenses
        },
        insights
      }
    });

  } catch (error) {
    console.error('Get monthly summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Helper function to generate spending insights
const generateSpendingInsights = (data) => {
  const insights = [];
  const {
    totalSpending,
    averagePerDay,
    categoryBreakdown,
    monthOverMonthChange,
    daysInMonth,
    isCurrentMonth,
    currentDay,
    topExpenses
  } = data;

  // Monthly spending trend insight
  if (Math.abs(monthOverMonthChange) > 10) {
    const changeDirection = monthOverMonthChange > 0 ? 'increased' : 'decreased';
    insights.push({
      type: 'trend',
      level: Math.abs(monthOverMonthChange) > 25 ? 'warning' : 'info',
      title: `Monthly Spending ${changeDirection}`,
      message: `Your spending has ${changeDirection} by ${Math.abs(monthOverMonthChange).toFixed(1)}% compared to last month.`,
      value: `${monthOverMonthChange > 0 ? '+' : ''}${monthOverMonthChange.toFixed(1)}%`
    });
  }

  // Top category insight
  if (categoryBreakdown.length > 0) {
    const topCategory = categoryBreakdown[0];
    const percentage = (topCategory.totalAmount / totalSpending) * 100;
    insights.push({
      type: 'category',
      level: percentage > 40 ? 'warning' : 'info',
      title: 'Top Spending Category',
      message: `${topCategory._id.charAt(0).toUpperCase() + topCategory._id.slice(1)} accounts for ${percentage.toFixed(1)}% of your monthly spending.`,
      value: `$${topCategory.totalAmount.toFixed(2)}`
    });
  }

  // Daily average insight
  if (isCurrentMonth) {
    const projectedMonthly = averagePerDay * daysInMonth;
    insights.push({
      type: 'projection',
      level: 'info',
      title: 'Monthly Projection',
      message: `Based on your current daily average of $${averagePerDay.toFixed(2)}, you're on track to spend $${projectedMonthly.toFixed(2)} this month.`,
      value: `$${projectedMonthly.toFixed(2)}`
    });
  }

  // High expense insight
  if (topExpenses.length > 0) {
    const highestExpense = topExpenses[0];
    const percentageOfTotal = (highestExpense.amount / totalSpending) * 100;
    if (percentageOfTotal > 15) {
      insights.push({
        type: 'expense',
        level: percentageOfTotal > 25 ? 'warning' : 'caution',
        title: 'Large Single Expense',
        message: `Your highest expense "${highestExpense.description}" represents ${percentageOfTotal.toFixed(1)}% of your monthly spending.`,
        value: `$${highestExpense.amount.toFixed(2)}`
      });
    }
  }

  // Spending distribution insight
  if (categoryBreakdown.length >= 3) {
    const topThreePercentage = categoryBreakdown.slice(0, 3)
      .reduce((sum, cat) => sum + (cat.totalAmount / totalSpending) * 100, 0);
    
    if (topThreePercentage > 80) {
      insights.push({
        type: 'distribution',
        level: 'info',
        title: 'Concentrated Spending',
        message: `${topThreePercentage.toFixed(1)}% of your spending is concentrated in just 3 categories.`,
        value: `${topThreePercentage.toFixed(1)}%`
      });
    }
  }

  return insights;
};

// Get year-to-date expense summary
const getYearToDateSummary = async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    // Calculate date range for the year
    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    // Monthly breakdown for the year
    const monthlyBreakdown = await Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.userId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { month: { $month: '$date' } },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      { $sort: { '_id.month': 1 } }
    ]);

    // Category breakdown for the year
    const yearlyCategories = await Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.userId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Overall year statistics
    const yearTotal = yearlyCategories.reduce((sum, cat) => sum + cat.totalAmount, 0);
    const yearCount = yearlyCategories.reduce((sum, cat) => sum + cat.count, 0);

    res.json({
      success: true,
      data: {
        year: targetYear,
        totalSpending: yearTotal,
        totalExpenses: yearCount,
        averageMonthly: yearTotal / 12,
        monthlyBreakdown: monthlyBreakdown.map(month => ({
          ...month,
          monthName: new Date(targetYear, month._id.month - 1).toLocaleString('default', { month: 'long' }),
          formattedAmount: `$${month.totalAmount.toFixed(2)}`
        })),
        categoryBreakdown: yearlyCategories.map(cat => ({
          ...cat,
          percentage: Math.round((cat.totalAmount / yearTotal) * 10000) / 100,
          formattedAmount: `$${cat.totalAmount.toFixed(2)}`
        })),
        formattedTotal: `$${yearTotal.toFixed(2)}`,
        formattedAverageMonthly: `$${(yearTotal / 12).toFixed(2)}`
      }
    });

  } catch (error) {
    console.error('Get year-to-date summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export {
  addExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseStats,
  getExpenseCategories,
  getExpenseDateRange,
  getMonthlyExpenseSummary,
  getYearToDateSummary
};