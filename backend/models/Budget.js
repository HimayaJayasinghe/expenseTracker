import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: [
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
      ],
      message: 'Category must be one of the predefined options'
    },
    lowercase: true
  },
  amount: {
    type: Number,
    required: [true, 'Budget amount is required'],
    min: [0.01, 'Budget amount must be greater than 0'],
    validate: {
      validator: function(value) {
        return Number.isFinite(value) && value > 0;
      },
      message: 'Budget amount must be a valid positive number'
    }
  },
  month: {
    type: Number,
    required: [true, 'Month is required'],
    min: [1, 'Month must be between 1 and 12'],
    max: [12, 'Month must be between 1 and 12']
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [2000, 'Year must be 2000 or later'],
    max: [2100, 'Year must be 2100 or earlier']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    trim: true
  }
}, {
  timestamps: true
});

// Compound index to ensure one budget per user per category per month/year
budgetSchema.index({ user: 1, category: 1, month: 1, year: 1 }, { unique: true });

// Index for efficient queries
budgetSchema.index({ user: 1, month: 1, year: 1 });
budgetSchema.index({ user: 1, isActive: 1 });

// Virtual for formatted amount
budgetSchema.virtual('formattedAmount').get(function() {
  return `$${this.amount.toFixed(2)}`;
});

// Virtual for period description
budgetSchema.virtual('period').get(function() {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[this.month - 1]} ${this.year}`;
});

// Static method to get current month/year
budgetSchema.statics.getCurrentPeriod = function() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear()
  };
};

// Instance method to check if budget is for current period
budgetSchema.methods.isCurrentPeriod = function() {
  const current = this.constructor.getCurrentPeriod();
  return this.month === current.month && this.year === current.year;
};

// Ensure virtual fields are serialized
budgetSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Budget', budgetSchema);