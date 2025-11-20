const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  // 'sale' or 'expense' - General category
  type: {
    type: String,
    enum: ['sale', 'expense'],
    required: true,
  },
  // 'receipt', 'invoice', 'utility' - Specific document type
  recordType: {
    type: String,
    enum: ['receipt', 'invoice', 'utility'],
    required: true,
  },
  // For sales, this is the total amount. For expenses, the cost.
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    trim: true,
  },
  // The user who created the record
  user: {
    type: String,
    required: true,
  },
  // Optional: link to a customer for sales records
  customer: {
    type: String,
    ref: 'Customer',
  },
  recordDate: {
    type: Date,
    default: Date.now,
  },
  imagePath: {
    type: String,
  },
  // Store the rich, structured data from OCR scans
  ocrData: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  modelSpecs: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

const Record = mongoose.model('Record', recordSchema);

module.exports = Record;
