const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
  },
});

const utilityServiceSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  details: String,
  unitPrice: {
    type: Number,
    required: true,
  },
  fees: [feeSchema],
  user: {
    type: String, // Clerk User ID
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('UtilityService', utilityServiceSchema);