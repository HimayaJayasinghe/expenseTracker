import express from 'express';
import {
  createOrUpdateBudget,
  getBudgets,
  getBudgetById,
  deleteBudget,
  getBudgetDashboard
} from '../controllers/BudgetController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// All budget routes require authentication
router.use(auth);

// Budget CRUD operations
router.post('/', createOrUpdateBudget);           // POST /api/budgets
router.get('/', getBudgets);                      // GET /api/budgets
router.get('/dashboard', getBudgetDashboard);     // GET /api/budgets/dashboard
router.get('/:id', getBudgetById);                // GET /api/budgets/:id
router.delete('/:id', deleteBudget);              // DELETE /api/budgets/:id

export default router;