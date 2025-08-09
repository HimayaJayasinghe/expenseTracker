import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';
import mongoose from 'mongoose';

// Create or update budget
const createOrUpdateBudget = async (req, res) => {
  try {
    const { category, amount, month, year, notes } = req.body;

    // Validate required fields
    if (!category || !amount || !month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Category, amount, month, and year are required'
      });
    }

    // Check if budget already exists for this user/category/month/year
    const existingBudget = await Budget.findOne({
      user: req.user.userId,
      category: category.toLowerCase(),
      month: parseInt(month),
      year: parseInt(year)
    });

    let budget;

    if (existingBudget) {
      // Update existing budget
      budget = await Budget.findByIdAndUpdate(
        existingBudget._id,
        {
          amount: parseFloat(amount),
          notes,
          isActive: true
        },
        { new: true, runValidators: true }
      ).populate('user', 'username firstName lastName');

      res.json({
        success: true,
        message: 'Budget updated successfully',
        data: { budget }
      });
    } else {
      // Create new budget
      budget = new Budget({
        user: req.user.userId,
        category: category.toLowerCase(),
        amount: parseFloat(amount),
        month: parseInt(month),
        year: parseInt(year),
        notes
      });

      await budget.save();
      await budget.populate('user', 'username firstName lastName');

      res.status(201).json({
        success: true,
        message: 'Budget created successfully',
        data: { budget }
      });
    }

  } catch (error) {
    console.error('Create/Update budget error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Budget already exists for this category and period'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get budgets with spending comparison
const getBudgets = async (req, res) => {
  try {
    const { month, year, category, includeInactive = false } = req.query;

    // Build filter
    const filter = { user: req.user.userId };
    
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (category && category !== 'all') filter.category = category.toLowerCase();
    if (!includeInactive) filter.isActive = true;

    // Get budgets
    const budgets = await Budget.find(filter)
      .sort({ year: -1, month: -1, category: 1 })
      .populate('user', 'username firstName lastName');

    // Get corresponding expenses for budget comparison
    const budgetComparisons = await Promise.all(
      budgets.map(async (budget) => {
        // Calculate date range for the budget period
        const startDate = new Date(budget.year, budget.month - 1, 1);
        const endDate = new Date(budget.year, budget.month, 0, 23, 59, 59, 999);

        // Get total expenses for this category in this period
        const expenseStats = await Expense.aggregate([
          {
            $match: {
              user: new mongoose.Types.ObjectId(req.user.userId),
              category: budget.category,
              date: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalSpent: { $sum: '$amount' },
              expenseCount: { $sum: 1 }
            }
          }
        ]);

        const totalSpent = expenseStats.length > 0 ? expenseStats[0].totalSpent : 0;
        const expenseCount = expenseStats.length > 0 ? expenseStats[0].expenseCount : 0;
        const remainingBudget = budget.amount - totalSpent;
        const percentageUsed = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;

        // Determine budget status
        let status = 'within_budget';
        if (percentageUsed >= 100) {
          status = 'exceeded';
        } else if (percentageUsed >= 90) {
          status = 'warning';
        } else if (percentageUsed >= 75) {
          status = 'caution';
        }

        return {
          budget: budget.toJSON(),
          spending: {
            totalSpent,
            expenseCount,
            remainingBudget,
            percentageUsed: Math.round(percentageUsed * 100) / 100,
            formattedTotalSpent: `$${totalSpent.toFixed(2)}`,
            formattedRemainingBudget: `$${remainingBudget.toFixed(2)}`,
            status,
            isOverBudget: totalSpent > budget.amount,
            daysInPeriod: new Date(budget.year, budget.month, 0).getDate(),
            daysRemaining: Math.max(0, new Date(budget.year, budget.month, 0).getDate() - new Date().getDate())
          }
        };
      })
    );

    // Calculate summary statistics
    const summary = {
      totalBudgets: budgets.length,
      totalBudgetAmount: budgets.reduce((sum, budget) => sum + budget.amount, 0),
      totalSpent: budgetComparisons.reduce((sum, comp) => sum + comp.spending.totalSpent, 0),
      budgetsExceeded: budgetComparisons.filter(comp => comp.spending.isOverBudget).length,
      budgetsInWarning: budgetComparisons.filter(comp => comp.spending.status === 'warning').length
    };

    summary.formattedTotalBudgetAmount = `$${summary.totalBudgetAmount.toFixed(2)}`;
    summary.formattedTotalSpent = `$${summary.totalSpent.toFixed(2)}`;
    summary.overallPercentageUsed = summary.totalBudgetAmount > 0 ? 
      Math.round((summary.totalSpent / summary.totalBudgetAmount) * 10000) / 100 : 0;

    res.json({
      success: true,
      data: {
        budgets: budgetComparisons,
        summary,
        filters: { month, year, category, includeInactive }
      }
    });

  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get budget by ID
const getBudgetById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid budget ID'
      });
    }

    const budget = await Budget.findOne({
      _id: id,
      user: req.user.userId
    }).populate('user', 'username firstName lastName');

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    // Get spending data for this budget
    const startDate = new Date(budget.year, budget.month - 1, 1);
    const endDate = new Date(budget.year, budget.month, 0, 23, 59, 59, 999);

    const expenses = await Expense.find({
      user: req.user.userId,
      category: budget.category,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 });

    const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const remainingBudget = budget.amount - totalSpent;
    const percentageUsed = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;

    res.json({
      success: true,
      data: {
        budget,
        expenses,
        spending: {
          totalSpent,
          remainingBudget,
          percentageUsed: Math.round(percentageUsed * 100) / 100,
          formattedTotalSpent: `$${totalSpent.toFixed(2)}`,
          formattedRemainingBudget: `$${remainingBudget.toFixed(2)}`,
          isOverBudget: totalSpent > budget.amount,
          expenseCount: expenses.length
        }
      }
    });

  } catch (error) {
    console.error('Get budget by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete budget
const deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid budget ID'
      });
    }

    const budget = await Budget.findOneAndDelete({
      _id: id,
      user: req.user.userId
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    res.json({
      success: true,
      message: 'Budget deleted successfully'
    });

  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get budget dashboard with visual indicators
const getBudgetDashboard = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    // Default to current month/year if not provided
    const currentPeriod = Budget.getCurrentPeriod();
    const targetMonth = month ? parseInt(month) : currentPeriod.month;
    const targetYear = year ? parseInt(year) : currentPeriod.year;

    // Get all active budgets for the period
    const budgets = await Budget.find({
      user: req.user.userId,
      month: targetMonth,
      year: targetYear,
      isActive: true
    });

    // Calculate date range
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // Get expense data for all categories
    const expensesByCategory = await Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.userId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$category',
          totalSpent: { $sum: '$amount' },
          expenseCount: { $sum: 1 }
        }
      }
    ]);

    // Create expense lookup map
    const expenseMap = {};
    expensesByCategory.forEach(expense => {
      expenseMap[expense._id] = expense;
    });

    // Build dashboard data
    const dashboardData = budgets.map(budget => {
      const expenseData = expenseMap[budget.category] || { totalSpent: 0, expenseCount: 0 };
      const totalSpent = expenseData.totalSpent;
      const remainingBudget = budget.amount - totalSpent;
      const percentageUsed = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;

      // Determine visual indicator status
      let status = 'success';
      let statusMessage = 'Within budget';
      let alertLevel = 'none';

      if (percentageUsed >= 100) {
        status = 'danger';
        statusMessage = 'Budget exceeded';
        alertLevel = 'high';
      } else if (percentageUsed >= 90) {
        status = 'warning';
        statusMessage = 'Budget almost exceeded';
        alertLevel = 'medium';
      } else if (percentageUsed >= 75) {
        status = 'caution';
        statusMessage = 'Approaching budget limit';
        alertLevel = 'low';
      }

      return {
        budget,
        spending: {
          totalSpent,
          remainingBudget,
          percentageUsed: Math.round(percentageUsed * 100) / 100,
          expenseCount: expenseData.expenseCount,
          formattedTotalSpent: `$${totalSpent.toFixed(2)}`,
          formattedRemainingBudget: `$${remainingBudget.toFixed(2)}`
        },
        visualIndicator: {
          status,
          statusMessage,
          alertLevel,
          progressBarWidth: Math.min(percentageUsed, 100),
          color: status === 'success' ? '#10B981' : 
                 status === 'caution' ? '#F59E0B' :
                 status === 'warning' ? '#EF4444' : '#DC2626'
        }
      };
    });

    // Calculate overall dashboard summary
    const totalBudgetAmount = budgets.reduce((sum, budget) => sum + budget.amount, 0);
    const totalSpent = dashboardData.reduce((sum, item) => sum + item.spending.totalSpent, 0);
    const overallPercentage = totalBudgetAmount > 0 ? (totalSpent / totalBudgetAmount) * 100 : 0;

    const summary = {
      period: `${new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })} ${targetYear}`,
      totalBudgets: budgets.length,
      totalBudgetAmount,
      totalSpent,
      totalRemaining: totalBudgetAmount - totalSpent,
      overallPercentage: Math.round(overallPercentage * 100) / 100,
      budgetsExceeded: dashboardData.filter(item => item.visualIndicator.status === 'danger').length,
      budgetsInWarning: dashboardData.filter(item => item.visualIndicator.status === 'warning').length,
      formattedTotalBudgetAmount: `$${totalBudgetAmount.toFixed(2)}`,
      formattedTotalSpent: `$${totalSpent.toFixed(2)}`,
      formattedTotalRemaining: `$${(totalBudgetAmount - totalSpent).toFixed(2)}`
    };

    res.json({
      success: true,
      data: {
        dashboardData,
        summary,
        period: { month: targetMonth, year: targetYear }
      }
    });

  } catch (error) {
    console.error('Get budget dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export {
  createOrUpdateBudget,
  getBudgets,
  getBudgetById,
  deleteBudget,
  getBudgetDashboard
};