const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  sequence_value: {
    type: Number,
    default: 1000, // Start from 1000
  },
});

module.exports = mongoose.model('Counter', counterSchema);