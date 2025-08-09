import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0'],
    validate: {
      validator: function(value) {
        return Number.isFinite(value) && value > 0;
      },
      message: 'Amount must be a valid positive number'
    }
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
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now,
    validate: {
      validator: function(value) {
        return value <= new Date();
      },
      message: 'Date cannot be in the future'
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, category: 1 });

// Virtual for formatted amount
expenseSchema.virtual('formattedAmount').get(function() {
  return `$${this.amount.toFixed(2)}`;
});

// Ensure virtual fields are serialized
expenseSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Expense', expenseSchema);