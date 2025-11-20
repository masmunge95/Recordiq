const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
    unique: true,
    // Add sparse index to allow multiple null values if phone is not required
    sparse: true, 
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true,
  },
  // The user who owns this customer record
  user: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// To avoid creating a customer with the same phone/email for the same user
customerSchema.index({ user: 1, phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });
customerSchema.index({ user: 1, email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });


const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
