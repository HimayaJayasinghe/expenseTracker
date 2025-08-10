import React, { useState } from 'react';
import Button from '../common/Button';

const ExpenseList = ({ expenses, onEdit, onDelete, loading = false }) => {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCategoryEmoji = (category) => {
    const emojiMap = {
      groceries: '🛒',
      utilities: '💡',
      transportation: '🚗',
      entertainment: '🎬',
      healthcare: '🏥',
      dining: '🍽️',
      shopping: '🛍️',
      education: '📚',
      travel: '✈️',
      housing: '🏠',
      insurance: '🛡️',
      savings: '💰',
      other: '📋'
    };
    return emojiMap[category] || '📋';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-lg shadow animate-pulse">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">💸</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses found</h3>
        <p className="text-gray-500">Start tracking your expenses by adding your first expense.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {expenses.map((expense) => (
        <div key={expense._id} className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <span className="text-xl mr-2">{getCategoryEmoji(expense.category)}</span>
                <h3 className="text-lg font-medium text-gray-900">{expense.description}</h3>
              </div>
              <div className="flex items-center text-sm text-gray-500 space-x-4">
                <span className="capitalize">{expense.category}</span>
                <span>{formatDate(expense.date)}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-lg font-semibold text-gray-900">
                ${expense.amount.toFixed(2)}
              </span>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onEdit(expense)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={deletingId === expense._id}
                  onClick={() => handleDelete(expense._id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ExpenseList;