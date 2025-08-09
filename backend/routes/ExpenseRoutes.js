import express from 'express';
import {
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
} from '../controllers/ExpenseController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// All expense routes require authentication
router.use(auth);

// CRUD operations
router.post('/', addExpense);                         // POST /api/expenses
router.get('/', getExpenses);                         // GET /api/expenses
router.get('/stats', getExpenseStats);                // GET /api/expenses/stats
router.get('/summary/monthly', getMonthlyExpenseSummary); // GET /api/expenses/summary/monthly
router.get('/summary/yearly', getYearToDateSummary);  // GET /api/expenses/summary/yearly
router.get('/categories', getExpenseCategories);      // GET /api/expenses/categories
router.get('/date-range', getExpenseDateRange);       // GET /api/expenses/date-range
router.get('/:id', getExpenseById);                   // GET /api/expenses/:id
router.put('/:id', updateExpense);                    // PUT /api/expenses/:id
router.delete('/:id', deleteExpense);                 // DELETE /api/expenses/:id

export default router;