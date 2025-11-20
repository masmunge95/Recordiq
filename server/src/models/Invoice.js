const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true, // Ensure invoice numbers are unique across the system
  },
  customer: {
    type: String,
    ref: 'Customer',
    required: true,
    index: true, // Index for faster queries by customer
  },
  customerName: {
    type: String,
    required: true,
  },
  user: {
    type: String,
    required: true,
    index: true, // Index for faster queries by user
  },
  // Line items for the invoice
  items: [lineItemSchema],
  subTotal: {
    type: Number,
    required: true,
  },
  tax: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'void'],
    default: 'draft',
  },
  issueDate: {
    type: Date,
    default: Date.now,
  },
  dueDate: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
});

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;
