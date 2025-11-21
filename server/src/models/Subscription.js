const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  tier: {
    type: String,
    enum: ['trial', 'basic', 'pro', 'enterprise'],
    default: 'trial',
  },
  status: {
    type: String,
    enum: ['active', 'past_due', 'canceled', 'expired', 'pending_upgrade'],
    default: 'active',
  },
  trialStartDate: {
    type: Date,
    default: Date.now,
  },
  trialEndDate: {
    type: Date,
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
  },
  currentPeriodStart: {
    type: Date,
    default: Date.now,
  },
  currentPeriodEnd: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'annual'],
    default: 'monthly',
  },
  // Pending upgrade (before payment confirmation)
  pendingUpgrade: {
    tier: String,
    billingCycle: String,
    amount: Number,
    initiatedAt: Date,
  },
  // Usage tracking
  usage: {
    invoices: {
      type: Number,
      default: 0,
    },
    customers: {
      type: Number,
      default: 0,
    },
    ocrScans: {
      type: Number,
      default: 0,
    },
    customerOcrScans: {
      type: Number,
      default: 0,
    },
    records: {
      type: Number,
      default: 0,
    },
    lastResetDate: {
      type: Date,
      default: Date.now,
    },
  },
  // Payment tracking
  lastPaymentDate: {
    type: Date,
  },
  lastPaymentAmount: {
    type: Number,
  },
  lastPaymentMethod: {
    type: String,
  },
  nextBillingDate: {
    type: Date,
  },
  // Payment provider reference (IntaSend)
  paymentProviderCustomerId: {
    type: String,
  },
  paymentHistory: [{
    date: {
      type: Date,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: true,
    },
    tier: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    transactionId: {
      type: String,
    },
    method: {
      type: String,
    },
  }],
}, {
  timestamps: true,
});

// Method to check if trial has expired
subscriptionSchema.methods.isTrialExpired = function() {
  if (this.tier !== 'trial') return false;
  return new Date() > this.trialEndDate;
};

// Method to check if subscription is active
subscriptionSchema.methods.isActive = function() {
  if (this.status !== 'active') return false;
  if (this.tier === 'trial') {
    return !this.isTrialExpired();
  }
  return new Date() <= this.currentPeriodEnd;
};

// Method to check if user can perform action based on tier limits
subscriptionSchema.methods.canPerformAction = function(action) {
  const limits = {
    trial: {
      invoices: 10,
      customers: 5,
      ocrScans: 20,
      customerOcrScans: 30,
      records: 50,
    },
    basic: {
      invoices: 50,
      customers: 25,
      ocrScans: 100,
      customerOcrScans: 150,
      records: 200,
    },
    pro: {
      invoices: 500,
      customers: 250,
      ocrScans: 1000,
      customerOcrScans: 1500,
      records: 2000,
    },
    enterprise: {
      invoices: Infinity,
      customers: Infinity,
      ocrScans: Infinity,
      customerOcrScans: Infinity,
      records: Infinity,
    },
  };

  const tierLimits = limits[this.tier] || limits.trial;
  const currentUsage = this.usage[action] || 0;

  return currentUsage < tierLimits[action];
};

// Method to increment usage counter
subscriptionSchema.methods.incrementUsage = async function(action) {
  // Reset monthly counters if needed
  const now = new Date();
  const lastReset = this.usage.lastResetDate || new Date(0);
  const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

  if (daysSinceReset >= 30) {
    // Reset all counters for new billing period
    this.usage = {
      invoices: 0,
      customers: 0,
      ocrScans: 0,
      customerOcrScans: 0,
      records: 0,
      lastResetDate: now,
    };
  }

  // Increment the specific counter
  if (!this.usage[action]) this.usage[action] = 0;
  this.usage[action]++;
  
  await this.save();
};

// Static method to get tier pricing
subscriptionSchema.statics.getPricing = function() {
  return {
    trial: { 
      price: 0, 
      currency: 'USD', 
      duration: '14 days',
      annual: null,
    },
    basic: { 
      price: 3, 
      currency: 'USD', 
      duration: 'month',
      annual: { price: 30, savings: 6, discount: '17%' }, // $2.50/month vs $3
    },
    pro: { 
      price: 10, 
      currency: 'USD', 
      duration: 'month',
      annual: { price: 100, savings: 20, discount: '17%' }, // $8.33/month vs $10
    },
    enterprise: { 
      price: 100, 
      currency: 'USD', 
      duration: 'month',
      annual: { price: 1000, savings: 200, discount: '17%' }, // $83.33/month vs $100
    },
  };
};

// Static method to get tier limits
subscriptionSchema.statics.getLimits = function() {
  return {
    trial: {
      invoices: 10,
      customers: 5,
      ocrScans: 20,
      customerOcrScans: 30,
      records: 50,
      duration: '14 days',
    },
    basic: {
      invoices: 50,
      customers: 25,
      ocrScans: 100,
      customerOcrScans: 150,
      records: 200,
      duration: 'unlimited',
    },
    pro: {
      invoices: 500,
      customers: 250,
      ocrScans: 1000,
      customerOcrScans: 1500,
      records: 2000,
      duration: 'unlimited',
    },
    enterprise: {
      invoices: 'unlimited',
      customers: 'unlimited',
      ocrScans: 'unlimited',
      customerOcrScans: 'unlimited',
      records: 'unlimited',
      duration: 'unlimited',
    },
  };
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
