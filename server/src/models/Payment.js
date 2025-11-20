const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  invoice: {
    type: String,
    ref: 'Invoice',
    required: true,
  },
  customer: {
    type: String,
    ref: 'Customer',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  // e.g., 'IntaSend', 'Cash', 'Bank Transfer'
  provider: {
    type: String,
    required: true,
    default: 'IntaSend',
  },
  // The transaction ID from the payment provider (e.g., IntaSend)
  transactionId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple documents to have a null value for this field
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
