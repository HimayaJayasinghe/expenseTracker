const API_BASE_URL = 'http://localhost:5000/api';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  // Auth methods
  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  // Expense methods
  async getExpenses(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/expenses${queryString ? `?${queryString}` : ''}`);
  }

  async addExpense(expenseData) {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData)
    });
  }

  async updateExpense(id, expenseData) {
    return this.request(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(expenseData)
    });
  }

  async deleteExpense(id) {
    return this.request(`/expenses/${id}`, {
      method: 'DELETE'
    });
  }

  async getExpenseStats(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/expenses/stats${queryString ? `?${queryString}` : ''}`);
  }

  async getMonthlyExpenseSummary(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/expenses/summary/monthly${queryString ? `?${queryString}` : ''}`);
  }

  // Budget methods
  async getBudgets(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/budgets${queryString ? `?${queryString}` : ''}`);
  }

  async createOrUpdateBudget(budgetData) {
    return this.request('/budgets', {
      method: 'POST',
      body: JSON.stringify(budgetData)
    });
  }

  async deleteBudget(id) {
    return this.request(`/budgets/${id}`, {
      method: 'DELETE'
    });
  }

  async getBudgetDashboard(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/budgets/dashboard${queryString ? `?${queryString}` : ''}`);
  }
}

export const apiClient = new ApiClient();